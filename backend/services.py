"""Campus domain logic shared by the HTTP API and the Tkinter application."""

from __future__ import annotations

import csv
import io
import json
import hashlib
import re
import secrets
from datetime import date, datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from .storage import DEMO_STUDENTS, CsvStore, StorageError


class ServiceError(Exception):
    """Expected domain or authorization error safe to return to a client."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def analyze_feedback(text: str) -> dict[str, Any]:
    cleaned = normalize_text(text)
    if not cleaned:
        raise ServiceError("Feedback cannot be empty.")
    if len(cleaned) > 2000:
        raise ServiceError("Feedback must be 2,000 characters or fewer.")

    tokens = re.findall(r"[A-Za-z][A-Za-z0-9'-]*", cleaned.lower())
    positive_words = {"good", "great", "helpful", "improved", "love", "excellent", "clear", "supportive"}
    negative_words = {"difficult", "hard", "problem", "poor", "bad", "struggle", "confusing", "late", "unsafe", "need", "issue"}
    positive_count = sum(token in positive_words for token in tokens)
    negative_count = sum(token in negative_words for token in tokens)
    if positive_count == negative_count == 0:
        sentiment = "Neutral"
        sentiment_confident = False
    else:
        sentiment = "Positive" if positive_count > negative_count else "Negative" if negative_count > positive_count else "Neutral"
        sentiment_confident = positive_count != negative_count

    categories = {
        "Academic": {"academic", "class", "subject", "exam", "assignment", "dbms", "python", "marks", "study", "practical"},
        "Support": {"support", "counsellor", "counselor", "mentor", "help", "wellbeing", "well-being", "stress"},
        "Campus": {"campus", "hostel", "library", "cafeteria", "transport", "building", "classroom", "lab"},
    }
    category_scores = {category: sum(token in keywords for token in tokens) for category, keywords in categories.items()}
    category = max(category_scores, key=category_scores.get) if max(category_scores.values(), default=0) else "General"
    confidence = bool(max(category_scores.values(), default=0))
    stop_words = {"this", "that", "with", "from", "have", "need", "more", "very", "they", "them", "were", "are", "for", "and"}
    keywords = list(dict.fromkeys(token for token in tokens if len(token) > 3 and token not in stop_words))[:8]
    if category == "Academic":
        action = "Offer a faculty check-in and practical academic support."
    elif category == "Support":
        action = "Offer a private, human-led support check-in."
    elif category == "Campus":
        action = "Review the reported campus service or facility concern."
    else:
        action = "Ask a follow-up question to understand the feedback."
    explanation = (
        f"Rule-based local analysis matched {category.lower()} terms and "
        f"{sentiment.lower()} sentiment keywords."
        if confidence and sentiment_confident
        else "The local keyword rules found limited evidence; review this feedback manually."
    )
    return {
        "normalized_text": cleaned,
        "category": category,
        "sentiment": sentiment,
        "keywords": keywords,
        "action": action,
        "explanation": explanation,
        "uncertain": not (confidence and sentiment_confident),
    }


class CampusService:
    def __init__(self, store: CsvStore | None = None) -> None:
        self.store = store or CsvStore()
        self._seed_demo_data()

    def _seed_demo_data(self) -> None:
        attendance_seed = []
        for student_id, values in {
            "ST102": [76, 72, 69, 66, 64],
            "ST105": [91, 92, 90, 91, 91],
            "ST118": [78, 76, 74, 73, 72],
            "ST121": [82, 83, 84, 85, 84],
            "ST136": [70, 67, 64, 62, 61],
        }.items():
            for index, percent in enumerate(values):
                status = "Present" if percent >= 75 else "Absent"
                attendance_seed.append({
                    "id": f"ATT-{student_id}-W{index + 1}",
                    "student_id": student_id,
                    "date": f"2026-09-{index + 1:02d}",
                    "subject": "Campus aggregate",
                    "status": status,
                    "present_count": str(round(percent)),
                    "total_count": "100",
                    "recorded_by": "demo-seed",
                    "created_at": f"2026-09-{index + 1:02d}T09:00:00+00:00",
                })
        self._append_missing("attendance", attendance_seed, "id")

        marks_seed = []
        subjects_by_student = {
            "ST102": {"DBMS": 49, "Python": 58, "Java": 55},
            "ST105": {"DBMS": 88, "Python": 90, "Java": 86},
            "ST118": {"Networks": 67, "Systems": 72, "Maths": 62},
            "ST121": {"Biology": 79, "Chemistry": 81, "Physics": 77},
            "ST136": {"Networks": 55, "Systems": 59, "Maths": 51},
        }
        for student_id, subjects in subjects_by_student.items():
            for subject, score in subjects.items():
                marks_seed.append({
                    "id": f"MRK-{student_id}-{subject.upper()}",
                    "student_id": student_id,
                    "subject": subject,
                    "assessment": "Demo assessment",
                    "score": str(score),
                    "max_score": "100",
                    "date": "2026-09-20",
                    "recorded_by": "demo-seed",
                })
        self._append_missing("marks", marks_seed, "id")
        if not any(row["student_id"] == "ST102" for row in self.store.read("feedback")):
            self.store.append("feedback", {
                "id": "FDB-ST102-DEMO",
                "student_id": "ST102",
                "submitted_by": "student",
                "text": "DBMS practical sessions are difficult and I need more practice.",
                "created_at": "2026-09-20T09:00:00+00:00",
                "category": "",
                "sentiment": "",
                "keywords": "",
                "explanation": "",
                "reviewed_by": "",
            }, "id")
        self._append_missing("notifications", [
            {"id": "NTF-parent-ST102-attendance", "recipient_id": "demo-parent", "student_id": "ST102", "type": "Attendance alert", "message": "Aarav's demo attendance is below the prototype attention threshold.", "created_at": "2026-09-21T09:00:00+00:00", "read": "false"},
            {"id": "NTF-student-ST102-support", "recipient_id": "demo-student", "student_id": "ST102", "type": "Support update", "message": "DBMS practical mentoring is in progress.", "created_at": "2026-09-21T09:05:00+00:00", "read": "false"},
        ], "id")
        self._append_missing("interventions", [{
            "id": "INT-ST102-DBMS",
            "student_id": "ST102",
            "recommendation_id": "",
            "assigned_to": "demo-faculty",
            "action": "DBMS practical mentoring and attendance check-in",
            "created_at": "2026-09-21T09:00:00+00:00",
            "due_date": "2026-10-04",
            "status": "In Progress",
            "follow_up_notes": "",
            "outcome": "",
            "reviewed_at": "",
        }], "id")
        for student_row in DEMO_STUDENTS:
            student_id = student_row["id"]
            risk = self.risk_for_student({"role": "admin"}, student_id)
            notification_type = "Urgent attendance review" if risk["attendance_percent"] is not None and risk["attendance_percent"] < 60 else "Attendance attention" if risk["attendance_percent"] is not None and risk["attendance_percent"] < 75 else ""
            if notification_type:
                self._append_missing("notifications", [{
                    "id": f"NTF-{student_id}-attendance",
                    "recipient_id": "demo-parent" if student_id == "ST102" else "demo-faculty",
                    "student_id": student_id,
                    "type": notification_type,
                    "message": f"{student_row['name']} attendance is {risk['attendance_percent']}% in the fictional demo data.",
                    "created_at": utc_now(),
                    "read": "false",
                }], "id")

    def _append_missing(self, table: str, values: list[dict[str, str]], key: str) -> None:
        rows = self.store.read(table)
        existing = {row[key] for row in rows}
        additions = [row for row in values if row[key] not in existing]
        if additions:
            self.store.write(table, rows + additions)

    def record_audit(self, user: dict[str, Any], action: str, record_id: str, summary: str) -> None:
        self.store.append("audit_log", {
            "id": secrets.token_hex(12),
            "timestamp": utc_now(),
            "actor_id": str(user["id"]),
            "action": action,
            "record_id": record_id,
            "summary": summary[:240],
        }, "id")

    def students_for(self, user: dict[str, Any]) -> list[dict[str, str]]:
        rows = [row for row in self.store.read("students") if row["active"].lower() == "true"]
        if user["role"] == "admin":
            return rows
        allowed = self.allowed_student_ids(user)
        return [row for row in rows if row["id"] in allowed]

    def allowed_student_ids(self, user: dict[str, Any]) -> set[str]:
        role = user["role"]
        if role == "admin":
            return {row["id"] for row in self.store.read("students")}
        if role == "faculty":
            assigned = user["assigned_student_ids"]
            return set(assigned if isinstance(assigned, list) else json.loads(assigned))
        if role == "student":
            return {user["student_id"]}
        if role == "parent":
            return {user["linked_student_id"]}
        return set()

    def require_student_access(self, user: dict[str, Any], student_id: str) -> None:
        if student_id not in self.allowed_student_ids(user):
            raise ServiceError("You are not authorized to access this student record.", 403)

    def student(self, user: dict[str, Any], student_id: str) -> dict[str, str]:
        self.require_student_access(user, student_id)
        row = next((item for item in self.store.read("students") if item["id"] == student_id and item["active"].lower() == "true"), None)
        if row is None:
            raise ServiceError("Student record was not found.", 404)
        return row

    def create_student(self, user: dict[str, Any], values: dict[str, Any]) -> dict[str, str]:
        student_id = str(values.get("id", "")).strip().upper()
        name = normalize_text(str(values.get("name", "")))
        email = str(values.get("email", "")).strip().lower()
        department = normalize_text(str(values.get("department", "")))
        semester = str(values.get("semester", "")).strip()
        if not re.fullmatch(r"ST[A-Z0-9]{2,12}", student_id):
            raise ServiceError("Student ID must start with ST and contain 2–12 letters or digits.")
        if not name or not department or not semester:
            raise ServiceError("Name, department, and semester are required.")
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise ServiceError("Enter a valid student email address.")
        if any(item["id"] == student_id for item in self.store.read("students")):
            raise ServiceError("A student with this ID already exists.", 409)
        row = {"id": student_id, "name": name, "email": email, "department": department, "semester": semester, "status": "Stable", "active": "true"}
        self.store.append("students", row, "id")
        self.record_audit(user, "student.created", student_id, f"Created student record for {name}.")
        return row

    def update_student(self, user: dict[str, Any], student_id: str, values: dict[str, Any]) -> dict[str, str]:
        self.student(user, student_id)
        changes = {}
        for field in ("name", "department", "semester", "email"):
            if field in values:
                value = normalize_text(str(values[field])) if field != "email" else str(values[field]).strip().lower()
                if not value:
                    raise ServiceError(f"{field.capitalize()} cannot be empty.")
                if field == "email" and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
                    raise ServiceError("Enter a valid student email address.")
                changes[field] = value
        if not changes:
            raise ServiceError("No supported student fields were provided.")
        updated = self.store.update("students", "id", student_id, changes)
        self.record_audit(user, "student.updated", student_id, "Updated student profile fields.")
        return updated or {}

    def deactivate_student(self, user: dict[str, Any], student_id: str) -> None:
        self.student(user, student_id)
        self.store.update("students", "id", student_id, {"active": "false"})
        self.record_audit(user, "student.deactivated", student_id, "Deactivated student; related records preserved.")

    def records_for_student(self, table: str, user: dict[str, Any], student_id: str) -> list[dict[str, str]]:
        self.require_student_access(user, student_id)
        return [row for row in self.store.read(table) if row["student_id"] == student_id]

    def record_attendance(self, user: dict[str, Any], values: dict[str, Any]) -> dict[str, str]:
        student_id = str(values.get("student_id", ""))
        self.student(user, student_id)
        entry_date = str(values.get("date", ""))
        try:
            date.fromisoformat(entry_date)
        except ValueError as error:
            raise ServiceError("Attendance date must use YYYY-MM-DD format.") from error
        status = str(values.get("status", "")).title()
        if status not in {"Present", "Absent", "Excused"}:
            raise ServiceError("Attendance status must be Present, Absent, or Excused.")
        subject = normalize_text(str(values.get("subject", "General")))
        records = self.store.read("attendance")
        if any(row["student_id"] == student_id and row["date"] == entry_date and row["subject"] == subject for row in records):
            raise ServiceError("Attendance is already recorded for this student, date, and class.", 409)
        row = {
            "id": secrets.token_hex(10), "student_id": student_id, "date": entry_date, "subject": subject,
            "status": status, "present_count": "1" if status == "Present" else "0",
            "total_count": "1" if status != "Excused" else "0",
            "recorded_by": str(user["id"]), "created_at": utc_now(),
        }
        self.store.append("attendance", row, "id")
        self.record_audit(user, "attendance.created", row["id"], f"Recorded attendance status {status} for {student_id} on {entry_date}.")
        return row

    def update_attendance(self, user: dict[str, Any], record_id: str, values: dict[str, Any]) -> dict[str, str]:
        rows = self.store.read("attendance")
        row = next((item for item in rows if item["id"] == record_id), None)
        if not row:
            raise ServiceError("Attendance record was not found.", 404)
        self.require_student_access(user, row["student_id"])
        status = str(values.get("status", "")).title()
        if status not in {"Present", "Absent", "Excused"}:
            raise ServiceError("Attendance status must be Present, Absent, or Excused.")
        updated = self.store.update("attendance", "id", record_id, {"status": status, "recorded_by": str(user["id"])})
        self.record_audit(user, "attendance.updated", record_id, f"Corrected attendance for {row['student_id']}.")
        return updated or {}

    def record_mark(self, user: dict[str, Any], values: dict[str, Any]) -> dict[str, str]:
        student_id = str(values.get("student_id", ""))
        self.student(user, student_id)
        subject = normalize_text(str(values.get("subject", "")))
        assessment = normalize_text(str(values.get("assessment", "")))
        try:
            score = float(values["score"])
            maximum = float(values["max_score"])
            date.fromisoformat(str(values.get("date", "")))
        except (KeyError, TypeError, ValueError) as error:
            raise ServiceError("Provide numeric score and maximum, and a valid YYYY-MM-DD date.") from error
        if not subject or not assessment or maximum <= 0 or score < 0 or score > maximum:
            raise ServiceError("Subject and assessment are required; score must be between 0 and the positive maximum.")
        rows = self.store.read("marks")
        if any(row["student_id"] == student_id and row["subject"] == subject and row["assessment"] == assessment for row in rows):
            raise ServiceError("This assessment already has a mark for the student.", 409)
        row = {
            "id": secrets.token_hex(10), "student_id": student_id, "subject": subject, "assessment": assessment,
            "score": str(score), "max_score": str(maximum), "date": str(values["date"]),
            "recorded_by": str(user["id"]),
        }
        self.store.append("marks", row, "id")
        self.record_audit(user, "marks.created", row["id"], f"Recorded a mark for {student_id} in {subject}.")
        return row

    def update_mark(self, user: dict[str, Any], record_id: str, values: dict[str, Any]) -> dict[str, str]:
        rows = self.store.read("marks")
        row = next((item for item in rows if item["id"] == record_id), None)
        if not row:
            raise ServiceError("Mark record was not found.", 404)
        self.require_student_access(user, row["student_id"])
        try:
            score = float(values.get("score", row["score"]))
            maximum = float(values.get("max_score", row["max_score"]))
        except (TypeError, ValueError) as error:
            raise ServiceError("Score and maximum must be numeric.") from error
        if maximum <= 0 or score < 0 or score > maximum:
            raise ServiceError("Score must be from 0 to the positive maximum.")
        updated = self.store.update("marks", "id", record_id, {
            "score": str(score), "max_score": str(maximum), "recorded_by": str(user["id"]),
        })
        self.record_audit(user, "marks.updated", record_id, f"Corrected a mark for {row['student_id']}.")
        return updated or {}

    def submit_feedback(self, user: dict[str, Any], values: dict[str, Any]) -> dict[str, Any]:
        student_id = str(values.get("student_id") or user.get("student_id") or "")
        self.require_student_access(user, student_id)
        text = normalize_text(str(values.get("text", "")))
        if not text:
            raise ServiceError("Feedback cannot be empty.")
        if len(text) > 2000:
            raise ServiceError("Feedback must be 2,000 characters or fewer.")
        row = {
            "id": secrets.token_hex(10), "student_id": student_id, "submitted_by": str(user["id"]),
            "text": text, "created_at": utc_now(), "category": "", "sentiment": "",
            "keywords": "", "explanation": "", "reviewed_by": "",
        }
        self.store.append("feedback", row, "id")
        self.record_audit(user, "feedback.created", row["id"], f"Submitted feedback for {student_id}.")
        return row

    def analyze_feedback_record(self, user: dict[str, Any], feedback_id: str, values: dict[str, Any] | None = None) -> dict[str, Any]:
        self._require_role(user, {"admin", "faculty"})
        rows = self.store.read("feedback")
        row = next((item for item in rows if item["id"] == feedback_id), None)
        if not row:
            raise ServiceError("Feedback record was not found.", 404)
        self.require_student_access(user, row["student_id"])
        result = analyze_feedback(row["text"])
        if values and "category" in values:
            if values["category"] not in {"Academic", "Support", "Campus", "General"}:
                raise ServiceError("Unsupported feedback category.")
            result["category"] = values["category"]
        if values and "sentiment" in values:
            if values["sentiment"] not in {"Positive", "Neutral", "Negative"}:
                raise ServiceError("Unsupported feedback sentiment.")
            result["sentiment"] = values["sentiment"]
        self.store.update("feedback", "id", feedback_id, {
            "category": result["category"],
            "sentiment": result["sentiment"],
            "keywords": json.dumps(result["keywords"]),
            "explanation": result["explanation"],
            "reviewed_by": str(user["id"]),
        })
        self.record_audit(user, "feedback.reviewed", feedback_id, f"Reviewed feedback classification as {result['category']} / {result['sentiment']}.")
        return {**row, **result, "reviewed_by": str(user["id"])}

    def risk_for_student(self, user: dict[str, Any], student_id: str) -> dict[str, Any]:
        self.require_student_access(user, student_id)
        attendance_rows = self.store.read("attendance")
        attendance_rows = [row for row in attendance_rows if row["student_id"] == student_id and row["status"] in {"Present", "Absent"}]
        marks_rows = [row for row in self.store.read("marks") if row["student_id"] == student_id]
        feedback_rows = [row for row in self.store.read("feedback") if row["student_id"] == student_id]
        present = sum(int(row["present_count"] or (row["status"] == "Present")) for row in attendance_rows)
        total = sum(int(row["total_count"] or (row["status"] in {"Present", "Absent"})) for row in attendance_rows)
        attendance_percent = 100 * present / total if total else None
        scores = []
        for row in marks_rows:
            try:
                scores.append(float(row["score"]) / float(row["max_score"]) * 100)
            except (ValueError, ZeroDivisionError):
                continue
        academic_average = float(np.mean(scores)) if scores else None
        factors = []
        score = 0
        configured = {row["key"]: float(row["value"]) for row in self.store.read("settings")}
        attendance_attention = configured.get("attendance_attention_percent", 75)
        attendance_urgent = configured.get("attendance_urgent_percent", 60)
        academic_attention = configured.get("academic_attention_percent", 60)
        academic_urgent = configured.get("academic_urgent_percent", 40)
        if attendance_percent is not None:
            if attendance_percent < attendance_urgent:
                score += 3
                factors.append({"factor": "attendance", "value": round(attendance_percent, 1), "threshold": attendance_urgent, "points": 3, "reason": f"Attendance is below the urgent {attendance_urgent:g}% prototype threshold."})
            elif attendance_percent < attendance_attention:
                score += 2
                factors.append({"factor": "attendance", "value": round(attendance_percent, 1), "threshold": attendance_attention, "points": 2, "reason": f"Attendance is below the {attendance_attention:g}% prototype threshold."})
        if academic_average is not None:
            if academic_average < academic_urgent:
                score += 3
                factors.append({"factor": "academic_average", "value": round(academic_average, 1), "threshold": academic_urgent, "points": 3, "reason": f"Academic average is below the urgent {academic_urgent:g}% prototype threshold."})
            elif academic_average < academic_attention:
                score += 2
                factors.append({"factor": "academic_average", "value": round(academic_average, 1), "threshold": academic_attention, "points": 2, "reason": f"Academic average is below the {academic_attention:g}% prototype threshold."})
        negative = [row for row in feedback_rows if row["sentiment"] == "Negative"]
        if not negative:
            negative = [row for row in feedback_rows if analyze_feedback(row["text"])["sentiment"] == "Negative"]
        if negative:
            score += 2
            factors.append({"factor": "negative_feedback", "value": len(negative), "threshold": 1, "points": 2, "reason": "At least one feedback entry matched negative wording; human review is required."})
        open_cases = [row for row in self.store.read("interventions") if row["student_id"] == student_id and row["status"] in {"Open", "In Progress"}]
        if len(open_cases) > 1:
            score += 2
            factors.append({"factor": "multiple_open_interventions", "value": len(open_cases), "threshold": 2, "points": 2, "reason": "More than one intervention remains open; review support coordination."})
        category = "Low" if score <= 2 else "Moderate" if score <= 5 else "High / Support Review Required"
        sufficient = attendance_percent is not None or academic_average is not None or bool(feedback_rows)
        recommendation = "Continue monitoring and acknowledge progress." if score <= 2 else "Offer a faculty check-in and agree on a practical next step."
        result = {
            "student_id": student_id, "score": score, "category": category, "factors": factors,
            "attendance_percent": None if attendance_percent is None else round(attendance_percent, 1),
            "academic_average": None if academic_average is None else round(academic_average, 1),
            "data_sufficient": sufficient,
            "explanation": "Illustrative prototype score for human review; it is not a validated prediction.",
            "recommendation": recommendation, "assessed_at": utc_now(),
        }
        source_data = json.dumps({
            "attendance": [row["id"] for row in attendance_rows],
            "marks": [row["id"] for row in marks_rows],
            "feedback": [(row["id"], row["sentiment"]) for row in feedback_rows],
            "interventions": [(row["id"], row["status"]) for row in open_cases],
            "thresholds": configured,
        }, sort_keys=True)
        snapshot_id = f"RA-{student_id}-{hashlib.sha256(source_data.encode('utf-8')).hexdigest()[:12]}"
        self.store.append("risk_analysis", {
            "id": snapshot_id,
            "student_id": student_id,
            "score": str(score),
            "category": category,
            "factors": json.dumps(factors, ensure_ascii=False),
            "explanation": result["explanation"],
            "created_at": result["assessed_at"],
            "reviewed_by": "",
            "data_sufficient": str(sufficient).lower(),
        }, "id")
        return result

    def create_recommendation(self, user: dict[str, Any], values: dict[str, Any]) -> dict[str, str]:
        student_id = str(values.get("student_id", ""))
        self.require_student_access(user, student_id)
        issue = normalize_text(str(values.get("issue", "")))
        action = normalize_text(str(values.get("action", "")))
        evidence = normalize_text(str(values.get("evidence", "")))
        if not issue or not action or not evidence:
            raise ServiceError("Issue, action, and evidence are required.")
        rows = self.store.read("recommendations")
        if any(row["student_id"] == student_id and row["issue"] == issue and row["status"] == "Active" for row in rows):
            raise ServiceError("An active recommendation for this issue already exists.", 409)
        row = {"id": secrets.token_hex(10), "student_id": student_id, "issue": issue, "action": action,
               "evidence": evidence, "status": "Active", "created_at": utc_now(), "assigned_to": str(user["id"])}
        self.store.append("recommendations", row, "id")
        self.record_audit(user, "recommendation.created", row["id"], f"Created recommendation for {student_id}: {issue}.")
        return row

    def create_intervention(self, user: dict[str, Any], values: dict[str, Any]) -> dict[str, str]:
        student_id = str(values.get("student_id", ""))
        self.student(user, student_id)
        action = normalize_text(str(values.get("action", "")))
        due_date = str(values.get("due_date", ""))
        try:
            date.fromisoformat(due_date)
        except ValueError as error:
            raise ServiceError("Follow-up date must use YYYY-MM-DD format.") from error
        if not action:
            raise ServiceError("Intervention action is required.")
        recommendation_id = str(values.get("recommendation_id", ""))
        if recommendation_id and not any(row["id"] == recommendation_id and row["student_id"] == student_id for row in self.store.read("recommendations")):
            raise ServiceError("Recommendation does not match the selected student.")
        row = {"id": f"INT-{secrets.token_hex(6)}", "student_id": student_id, "recommendation_id": recommendation_id,
               "assigned_to": str(values.get("assigned_to") or user["id"]), "action": action, "created_at": utc_now(),
               "due_date": due_date, "status": "Open", "follow_up_notes": "", "outcome": "", "reviewed_at": ""}
        self.store.append("interventions", row, "id")
        self.record_audit(user, "intervention.created", row["id"], f"Created intervention for {student_id}.")
        return row

    def update_intervention(self, user: dict[str, Any], intervention_id: str, values: dict[str, Any]) -> dict[str, str]:
        rows = self.store.read("interventions")
        row = next((item for item in rows if item["id"] == intervention_id), None)
        if not row:
            raise ServiceError("Intervention was not found.", 404)
        self.require_student_access(user, row["student_id"])
        changes: dict[str, str] = {}
        if "status" in values:
            status = str(values["status"])
            if status not in {"Open", "In Progress", "Completed", "Cancelled"}:
                raise ServiceError("Unsupported intervention status.")
            changes["status"] = status
        if "follow_up_notes" in values:
            changes["follow_up_notes"] = normalize_text(str(values["follow_up_notes"]))
        if "outcome" in values:
            changes["outcome"] = normalize_text(str(values["outcome"]))
            if not changes["outcome"]:
                raise ServiceError("Outcome cannot be empty.")
            changes["reviewed_at"] = utc_now()
        if not changes:
            raise ServiceError("Provide a status, follow-up note, or outcome to update.")
        updated = self.store.update("interventions", "id", intervention_id, changes)
        self.record_audit(user, "intervention.updated", intervention_id, f"Updated intervention for {row['student_id']}; outcome is recorded only when supplied.")
        return updated or {}

    def overview(self, user: dict[str, Any]) -> dict[str, Any]:
        self._require_role(user, {"admin"})
        students = self.students_for(user)
        attendance = self.store.read("attendance")
        marks = self.store.read("marks")
        feedback = self.store.read("feedback")
        interventions = self.store.read("interventions")
        counted_rows = [row for row in attendance if row["status"] in {"Present", "Absent"}]
        present = sum(int(row["present_count"] or (row["status"] == "Present")) for row in counted_rows)
        counted_attendance = sum(int(row["total_count"] or 1) for row in counted_rows)
        normalized_marks = [float(row["score"]) / float(row["max_score"]) * 100 for row in marks if float(row["max_score"]) > 0]
        feedback_results = [analyze_feedback(row["text"])["sentiment"] for row in feedback]
        departments = pd.DataFrame(students).groupby("department").size().to_dict() if students else {}
        return {
            "demo_data": True,
            "total_students": len(students),
            "total_faculty_accounts": sum(row["role"] == "faculty" for row in self.store.read("users")),
            "departments": departments,
            "attendance_percent": round(100 * present / counted_attendance, 1) if counted_attendance else None,
            "academic_average": round(float(np.mean(normalized_marks)), 1) if normalized_marks else None,
            "open_interventions": sum(row["status"] in {"Open", "In Progress"} for row in interventions),
            "pending_followups": sum(row["status"] in {"Open", "In Progress"} and row["due_date"] <= date.today().isoformat() for row in interventions),
            "feedback_sentiment": {sentiment: feedback_results.count(sentiment) for sentiment in ("Positive", "Neutral", "Negative")},
        }

    def trends(self, user: dict[str, Any]) -> list[dict[str, Any]]:
        self._require_role(user, {"admin", "faculty"})
        allowed_ids = self.allowed_student_ids(user)
        by_date: dict[str, dict[str, Any]] = {}
        for row in self.store.read("attendance"):
            if row["student_id"] not in allowed_ids or row["status"] not in {"Present", "Absent"}:
                continue
            point = by_date.setdefault(row["date"], {"present": 0, "total": 0, "marks": []})
            total_count = int(row["total_count"] or 1)
            point["total"] += total_count
            point["present"] += int(row["present_count"] or (total_count if row["status"] == "Present" else 0))
        for row in self.store.read("marks"):
            if row["student_id"] not in allowed_ids:
                continue
            maximum = float(row["max_score"])
            if maximum <= 0:
                continue
            point = by_date.setdefault(row["date"], {"present": 0, "total": 0, "marks": []})
            point["marks"].append(float(row["score"]) / maximum * 100)
        return [
            {
                "day": day,
                "attendance": round(point["present"] / point["total"] * 100, 1) if point["total"] else None,
                "academic": round(sum(point["marks"]) / len(point["marks"]), 1) if point["marks"] else None,
            }
            for day, point in sorted(by_date.items())
        ]

    def data_flow(self) -> list[dict[str, Any]]:
        return [
            {"stage": "Student records", "count": len(self.store.read("students")), "source": "students.csv", "href": "/students"},
            {"stage": "Attendance and marks", "count": len(self.store.read("attendance")) + len(self.store.read("marks")), "source": "attendance.csv + marks.csv", "href": "/admin/dashboard"},
            {"stage": "Feedback processing", "count": len(self.store.read("feedback")), "source": "feedback.csv", "href": "/feedback"},
            {"stage": "Risk analysis", "count": len(self.store.read("risk_analysis")), "source": "risk_analysis.csv", "href": "/concerns"},
            {"stage": "Recommendations", "count": len(self.store.read("recommendations")), "source": "recommendations.csv", "href": "/interventions"},
            {"stage": "Intervention and follow-up", "count": len(self.store.read("interventions")), "source": "interventions.csv", "href": "/interventions"},
        ]

    def departments(self) -> list[dict[str, Any]]:
        groups: dict[str, list[dict[str, str]]] = {}
        for row in self.students_for({"role": "admin"}):
            groups.setdefault(row["department"], []).append(row)
        return [
            {
                "name": name,
                "student_count": len(rows),
                "support_required": sum(row["status"] == "Support Required" for row in rows),
                "monitor": sum(row["status"] == "Monitor" for row in rows),
                "stable": sum(row["status"] == "Stable" for row in rows),
            }
            for name, rows in sorted(groups.items())
        ]

    def create_guardian_notification(self, user: dict[str, Any], values: dict[str, Any]) -> list[dict[str, str]]:
        self._require_role(user, {"admin"})
        student_id = str(values.get("student_id", "")).strip().upper()
        message = normalize_text(str(values.get("message", "")))
        self.student(user, student_id)
        if len(message) < 2 or len(message) > 2000:
            raise ServiceError("Guardian update must contain between 2 and 2,000 characters.")
        guardians = [
            row for row in self.store.read("users")
            if row["role"] == "parent" and row["active"].lower() == "true" and row["linked_student_id"] == student_id
        ]
        if not guardians:
            raise ServiceError("No active guardian account is linked to this student.", 409)
        created = []
        for guardian in guardians:
            notification = {
                "id": secrets.token_hex(10),
                "recipient_id": guardian["id"],
                "student_id": student_id,
                "type": "Guardian update",
                "message": message,
                "created_at": utc_now(),
                "read": "false",
            }
            self.store.append("notifications", notification, "id")
            created.append(notification)
        self.record_audit(
            user,
            "guardian.notification.created",
            student_id,
            f"Sent a guardian-portal update for {student_id}.",
        )
        return created

    def report_csv(self, user: dict[str, Any], report: str) -> str:
        allowed_reports = {
            "students": "students",
            "attendance": "attendance",
            "marks": "marks",
            "feedback": "feedback",
            "interventions": "interventions",
        }
        if report not in allowed_reports:
            raise ServiceError("Unknown report type.", 404)
        if user["role"] not in {"admin", "faculty"}:
            raise ServiceError("You are not authorized to export reports.", 403)
        rows = self.store.read(allowed_reports[report])
        allowed_ids = self.allowed_student_ids(user)
        if report == "students":
            rows = [row for row in rows if row["id"] in allowed_ids]
        else:
            rows = [row for row in rows if row["student_id"] in allowed_ids]
        if not rows:
            return ""
        output = io.StringIO(newline="")
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
        return output.getvalue()

    @staticmethod
    def _require_role(user: dict[str, Any], allowed: set[str]) -> None:
        if user.get("role") not in allowed:
            raise ServiceError("You are not authorized to perform this operation.", 403)
