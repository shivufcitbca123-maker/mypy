from __future__ import annotations

import http.cookiejar
import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener
from http.server import ThreadingHTTPServer

from backend.api import CampusApi, create_handler
from backend.auth import AuthService
from backend.services import CampusService
from backend.storage import CsvStore


class ApiAuthorizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        store = CsvStore(Path(cls.temp_dir.name))
        service = CampusService(store)
        auth = AuthService(store)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), create_handler(CampusApi(service, auth)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.thread.join(timeout=5)
        cls.server.server_close()
        cls.temp_dir.cleanup()

    def setUp(self) -> None:
        self.cookies = http.cookiejar.CookieJar()
        self.client = build_opener(HTTPCookieProcessor(self.cookies))

    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict | str]:
        data = json.dumps(body).encode() if body is not None else None
        request = Request(self.base_url + path, data=data, method=method, headers={"Content-Type": "application/json"})
        try:
            response = self.client.open(request, timeout=5)
        except HTTPError as error:
            response = error
        content = response.read().decode()
        if response.headers.get_content_type() == "application/json":
            content = json.loads(content)
        return response.status, content

    def login(self, email: str, password: str, role: str) -> tuple[int, dict | str]:
        return self.request("POST", "/api/auth/login", {"email": email, "password": password, "selected_role": role})

    def test_login_session_and_server_side_role_scope(self) -> None:
        self.assertEqual(self.request("GET", "/api/students")[0], 401)
        status, payload = self.login("student@aicampus360.com", "Student@360", "student")
        self.assertEqual(status, 200)
        self.assertEqual(payload["user"]["role"], "student")
        self.assertEqual(self.request("GET", "/api/students/ST102")[0], 200)
        self.assertEqual(self.request("GET", "/api/students/ST105")[0], 403)
        self.assertEqual(self.request("POST", "/api/attendance", {
            "student_id": "ST102", "date": "2026-10-01", "subject": "DBMS", "status": "Present",
        })[0], 403)

    def test_guardian_and_faculty_server_authorization(self) -> None:
        self.assertEqual(self.login("parent@aicampus360.com", "Parent@360", "parent")[0], 200)
        self.assertEqual(self.request("GET", "/api/students/ST102")[0], 200)
        self.assertEqual(self.request("GET", "/api/students/ST136")[0], 403)
        self.assertEqual(self.request("POST", "/api/students", {"id": "ST200"})[0], 403)
        self.request("POST", "/api/auth/logout")
        self.assertEqual(self.login("faculty@aicampus360.com", "Faculty@360", "faculty")[0], 200)
        self.assertEqual(self.request("GET", "/api/students/ST136")[0], 200)
        self.assertEqual(self.request("GET", "/api/students/ST121")[0], 403)
        self.assertEqual(self.request("POST", "/api/students", {"id": "ST200"})[0], 403)

    def test_selected_role_and_invalid_credentials_are_rejected(self) -> None:
        self.assertEqual(self.login("admin@aicampus360.com", "Admin@360", "student")[0], 401)
        self.assertEqual(self.login("admin@aicampus360.com", "wrong", "admin")[0], 401)

    def test_admin_directory_exports_and_guardian_notifications(self) -> None:
        self.assertEqual(self.request("GET", "/api/users")[0], 401)
        self.assertEqual(self.login("admin@aicampus360.com", "Admin@360", "admin")[0], 200)

        status, users = self.request("GET", "/api/users")
        self.assertEqual(status, 200)
        self.assertEqual(len(users["items"]), 4)
        self.assertTrue(all("password_hash" not in user for user in users["items"]))
        status, departments = self.request("GET", "/api/departments")
        self.assertEqual(status, 200)
        self.assertEqual(sum(item["student_count"] for item in departments["items"]), 5)
        status, trends = self.request("GET", "/api/trends")
        self.assertEqual(status, 200)
        self.assertTrue(all("day" in item and "attendance" in item and "academic" in item for item in trends["items"]))

        status, payload = self.request("POST", "/api/notifications", {
            "student_id": "ST102",
            "message": "Please review the latest student support update.",
        })
        self.assertEqual(status, 201)
        self.assertEqual(len(payload["items"]), 1)
        self.assertEqual(payload["items"][0]["recipient_id"], "demo-parent")

        self.request("POST", "/api/auth/logout")
        self.assertEqual(self.login("parent@aicampus360.com", "Parent@360", "parent")[0], 200)
        status, notifications = self.request("GET", "/api/notifications")
        self.assertEqual(status, 200)
        self.assertTrue(notifications["items"])
        self.assertTrue(all(item["recipient_id"] == "demo-parent" for item in notifications["items"]))

        self.request("POST", "/api/auth/logout")
        self.assertEqual(self.login("student@aicampus360.com", "Student@360", "student")[0], 200)
        status, notifications = self.request("GET", "/api/notifications")
        self.assertEqual(status, 200)
        self.assertTrue(notifications["items"])
        self.assertTrue(all(item["recipient_id"] == "demo-student" for item in notifications["items"]))
        self.assertEqual(self.request("PUT", f"/api/notifications/{payload['items'][0]['id']}")[0], 403)
        own_notification = notifications["items"][0]
        self.assertEqual(self.request("PUT", f"/api/notifications/{own_notification['id']}")[0], 200)

    def test_non_admin_cannot_send_guardian_notifications_or_list_users(self) -> None:
        self.assertEqual(self.login("admin@aicampus360.com", "Admin@360", "admin")[0], 200)
        self.assertEqual(self.request("POST", "/api/marks", {
            "student_id": "ST121",
            "subject": "Out-of-scope test record",
            "assessment": "Scope check",
            "score": 1,
            "max_score": 1,
            "date": "2099-01-01",
        })[0], 201)
        self.request("POST", "/api/auth/logout")
        self.assertEqual(self.login("faculty@aicampus360.com", "Faculty@360", "faculty")[0], 200)
        self.assertEqual(self.request("GET", "/api/users")[0], 403)
        self.assertEqual(self.request("GET", "/api/departments")[0], 403)
        status, trends = self.request("GET", "/api/trends")
        self.assertEqual(status, 200)
        self.assertTrue(all(item["day"] != "2099-01-01" for item in trends["items"]))
        self.assertEqual(self.request("POST", "/api/notifications", {
            "student_id": "ST102", "message": "Unauthorized notification",
        })[0], 403)


if __name__ == "__main__":
    unittest.main()
