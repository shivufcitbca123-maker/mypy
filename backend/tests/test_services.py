from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.auth import AuthService, hash_password, verify_password
from backend.services import CampusService, ServiceError, analyze_feedback
from backend.storage import CsvStore


ADMIN = {"id": "demo-admin", "role": "admin", "name": "Campus Admin", "assigned_student_ids": []}
FACULTY = {"id": "demo-faculty", "role": "faculty", "name": "Faculty", "assigned_student_ids": ["ST102", "ST105", "ST136"]}
STUDENT = {"id": "demo-student", "role": "student", "name": "Student", "student_id": "ST102", "assigned_student_ids": []}
PARENT = {"id": "demo-parent", "role": "parent", "name": "Parent", "linked_student_id": "ST102", "assigned_student_ids": []}


class CampusServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = CsvStore(Path(self.temp_dir.name))
        self.service = CampusService(self.store)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_csv_seed_is_idempotent_and_preserves_changes(self) -> None:
        first = len(self.store.read("students"))
        self.store.update("students", "id", "ST102", {"name": "Updated Demo Name"})
        CampusService(self.store)
        self.assertEqual(len(self.store.read("students")), first)
        self.assertEqual(next(row for row in self.store.read("students") if row["id"] == "ST102")["name"], "Updated Demo Name")

    def test_passwords_are_hashed_and_demo_users_seed_idempotently(self) -> None:
        AuthService(self.store)
        users_before = self.store.read("users")
        self.assertEqual(len(users_before), 4)
        self.assertTrue(all(row["password_hash"].startswith("pbkdf2_sha256$") for row in users_before))
        self.assertTrue(all("Admin@360" not in str(row) for row in users_before))
        AuthService(self.store)
        self.assertEqual(len(self.store.read("users")), 4)
        encoded = hash_password("sample", b"0123456789abcdef")
        self.assertTrue(verify_password("sample", encoded))
        self.assertFalse(verify_password("wrong", encoded))

    def test_role_scope_rejects_unrelated_student_records(self) -> None:
        self.assertEqual(self.service.student(STUDENT, "ST102")["id"], "ST102")
        for user in (STUDENT, PARENT):
            with self.assertRaises(ServiceError) as result:
                self.service.student(user, "ST105")
            self.assertEqual(result.exception.status, 403)
        with self.assertRaises(ServiceError):
            self.service.student(FACULTY, "ST121")

    def test_student_create_duplicate_update_deactivate_and_relationship_preservation(self) -> None:
        created = self.service.create_student(ADMIN, {
            "id": "ST200", "name": "Sam Example", "email": "sam@example.edu",
            "department": "Science", "semester": "2",
        })
        self.assertEqual(created["id"], "ST200")
        with self.assertRaises(ServiceError) as duplicate:
            self.service.create_student(ADMIN, {
                "id": "ST200", "name": "Another Student", "email": "other@example.edu",
                "department": "Science", "semester": "2",
            })
        self.assertEqual(duplicate.exception.status, 409)
        self.service.update_student(ADMIN, "ST200", {"name": "Sam Updated"})
        self.assertEqual(self.service.student(ADMIN, "ST200")["name"], "Sam Updated")
        self.service.deactivate_student(ADMIN, "ST200")
        self.assertTrue(any(row["id"] == "ST200" for row in self.store.read("students")))
        self.assertEqual(self.service.records_for_student("marks", ADMIN, "ST102"), [row for row in self.store.read("marks") if row["student_id"] == "ST102"])

    def test_attendance_duplicate_validation_and_analytics(self) -> None:
        entry = self.service.record_attendance(ADMIN, {
            "student_id": "ST102", "date": "2026-10-01", "subject": "DBMS", "status": "Present",
        })
        self.assertEqual(entry["present_count"], "1")
        with self.assertRaises(ServiceError) as duplicate:
            self.service.record_attendance(ADMIN, {
                "student_id": "ST102", "date": "2026-10-01", "subject": "DBMS", "status": "Absent",
            })
        self.assertEqual(duplicate.exception.status, 409)
        with self.assertRaises(ServiceError):
            self.service.record_attendance(ADMIN, {
                "student_id": "ST102", "date": "not-a-date", "subject": "DBMS", "status": "Present",
            })
        risk = self.service.risk_for_student(STUDENT, "ST102")
        self.assertEqual(risk["attendance_percent"], 69.5)
        self.assertTrue(risk["data_sufficient"])
        self.assertTrue(self.store.read("risk_analysis"))

    def test_marks_validate_range_and_report_uses_authorized_scope(self) -> None:
        row = self.service.record_mark(FACULTY, {
            "student_id": "ST102", "subject": "DBMS", "assessment": "Lab test",
            "score": 8, "max_score": 10, "date": "2026-10-01",
        })
        self.service.update_mark(FACULTY, row["id"], {"score": 9})
        self.assertEqual(self.store.read("marks")[-1]["score"], "9.0")
        with self.assertRaises(ServiceError):
            self.service.record_mark(FACULTY, {
                "student_id": "ST102", "subject": "DBMS", "assessment": "Bad test",
                "score": 11, "max_score": 10, "date": "2026-10-01",
            })
        faculty_csv = self.service.report_csv(FACULTY, "students")
        self.assertIn("ST102", faculty_csv)
        self.assertNotIn("ST121", faculty_csv)
        with self.assertRaises(ServiceError) as denied:
            self.service.report_csv(STUDENT, "students")
        self.assertEqual(denied.exception.status, 403)

    def test_rule_based_nlp_and_uncertain_input(self) -> None:
        result = analyze_feedback("DBMS practical sessions are difficult and I need more practice.")
        self.assertEqual(result["category"], "Academic")
        self.assertEqual(result["sentiment"], "Negative")
        self.assertIn("dbms", result["keywords"])
        self.assertFalse(result["uncertain"])
        self.assertTrue(analyze_feedback("This is a sentence").get("uncertain"))
        with self.assertRaises(ServiceError):
            analyze_feedback("  ")

    def test_recommendation_dedup_and_intervention_followup(self) -> None:
        values = {"student_id": "ST102", "issue": "Low DBMS", "action": "Offer a lab session", "evidence": "DBMS 49/100"}
        recommendation = self.service.create_recommendation(FACULTY, values)
        with self.assertRaises(ServiceError):
            self.service.create_recommendation(FACULTY, values)
        intervention = self.service.create_intervention(FACULTY, {
            "student_id": "ST102", "recommendation_id": recommendation["id"], "action": "Lab mentoring",
            "due_date": "2026-10-30",
        })
        updated = self.service.update_intervention(FACULTY, intervention["id"], {
            "status": "Completed", "follow_up_notes": "Student attended lab.", "outcome": "Practice plan agreed.",
        })
        self.assertEqual(updated["status"], "Completed")
        self.assertEqual(updated["outcome"], "Practice plan agreed.")
        self.assertTrue(updated["reviewed_at"])

    def test_admin_overview_uses_csv_calculations(self) -> None:
        overview = self.service.overview(ADMIN)
        self.assertTrue(overview["demo_data"])
        self.assertEqual(overview["total_students"], 5)
        self.assertEqual(overview["attendance_percent"], 76.7)
        self.assertIsNotNone(overview["academic_average"])
        with self.assertRaises(ServiceError):
            self.service.overview(FACULTY)


if __name__ == "__main__":
    unittest.main()
