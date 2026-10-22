"""Local HTTP API with server-side role and student relationship checks."""

from __future__ import annotations

import json
import os
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse
from typing import Any

from .auth import AuthService
from .services import CampusService, ServiceError
from .storage import CsvStore, StorageError


COOKIE_NAME = "aicampus360_session"
MAX_BODY_BYTES = 1_000_000
DEMO_USER = {"id": "desktop-admin", "role": "admin", "name": "Local Tkinter operator", "assigned_student_ids": []}


class CampusApi:
    def __init__(self, service: CampusService | None = None, auth: AuthService | None = None) -> None:
        self.service = service or CampusService()
        self.auth = auth or AuthService(self.service.store)


def create_handler(api: CampusApi) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        server_version = "AICampusLocal/1.0"

        def log_message(self, format_string: str, *args: Any) -> None:
            # Avoid logging submitted form values or authorization material.
            super().log_message("%s", format_string.split(" ")[0] if format_string else "request")

        def end_headers(self) -> None:
            origin = self.headers.get("Origin", "")
            if origin in {"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173"}:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Credentials", "true")
                self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            super().end_headers()

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.end_headers()

        def do_GET(self) -> None:
            self._handle("GET")

        def do_POST(self) -> None:
            self._handle("POST")

        def do_PUT(self) -> None:
            self._handle("PUT")

        def do_DELETE(self) -> None:
            self._handle("DELETE")

        def _handle(self, method: str) -> None:
            try:
                path = unquote(urlparse(self.path).path)
                if path == "/api/health" and method == "GET":
                    self._json(200, {"ok": True, "mode": "local-demo"})
                    return
                if path == "/api/auth/login" and method == "POST":
                    self._login()
                    return
                if path == "/api/auth/logout" and method == "POST":
                    self._logout()
                    return
                if path == "/api/auth/me" and method == "GET":
                    user = api.auth.resolve(self._session_token())
                    self._json(200, {"user": user})
                    return
                user = self._current_user()
                self._route(method, path, user or {})
            except ServiceError as error:
                self._json(error.status, {"error": error.message})
            except StorageError:
                self._json(500, {"error": "Campus data could not be safely read or saved. Check the CSV files and data-directory permissions."})
            except (ValueError, json.JSONDecodeError):
                self._json(400, {"error": "Request body must be valid JSON."})
            except Exception as error:
                print(f"API request failed ({type(error).__name__}).")
                self._json(500, {"error": "The request could not be completed. Check the local server log."})

        def _route(self, method: str, path: str, user: dict[str, Any]) -> None:
            service = api.service
            if path == "/api/overview" and method == "GET":
                self._json(200, service.overview(user))
                return
            if path == "/api/trends" and method == "GET":
                self._json(200, {"items": service.trends(user)})
                return
            if path == "/api/data-flow" and method == "GET":
                self._require_role(user, {"admin"})
                self._json(200, {"storage": "CSV files", "stages": service.data_flow()})
                return
            if path == "/api/users" and method == "GET":
                self._require_role(user, {"admin"})
                self._json(200, {"items": api.auth.list_users()})
                return
            if path == "/api/departments" and method == "GET":
                self._require_role(user, {"admin"})
                self._json(200, {"items": service.departments()})
                return
            if path == "/api/students" and method == "GET":
                query = parse_qs(urlparse(self.path).query)
                rows = service.students_for(user)
                text = query.get("q", [""])[0].strip().lower()
                if text:
                    rows = [row for row in rows if text in row["name"].lower() or text in row["id"].lower()]
                self._json(200, {"items": rows})
                return
            if path == "/api/students" and method == "POST":
                self._require_role(user, {"admin"})
                self._json(201, {"item": service.create_student(user, self._body())})
                return
            if path.startswith("/api/students/"):
                parts = path.strip("/").split("/")
                student_id = parts[2]
                if len(parts) == 3 and method == "GET":
                    self._json(200, {"item": service.student(user, student_id)})
                    return
                if len(parts) == 3 and method == "PUT":
                    self._require_role(user, {"admin"})
                    self._json(200, {"item": service.update_student(user, student_id, self._body())})
                    return
                if len(parts) == 3 and method == "DELETE":
                    self._require_role(user, {"admin"})
                    service.deactivate_student(user, student_id)
                    self._json(200, {"ok": True, "message": "Student deactivated; related records preserved."})
                    return
                if len(parts) == 4 and method == "GET":
                    table_name = {"attendance": "attendance", "marks": "marks", "feedback": "feedback", "interventions": "interventions", "recommendations": "recommendations"}.get(parts[3])
                    if table_name is None:
                        raise ServiceError("Unknown student record type.", 404)
                    if table_name == "feedback":
                        self._require_role(user, {"admin", "faculty", "student"})
                    self._json(200, {"items": service.records_for_student(table_name, user, student_id)})
                    return
            if path == "/api/attendance" and method == "POST":
                self._require_role(user, {"admin", "faculty"})
                self._json(201, {"item": service.record_attendance(user, self._body())})
                return
            if path.startswith("/api/attendance/") and method == "PUT":
                self._require_role(user, {"admin", "faculty"})
                record_id = path.rsplit("/", 1)[-1]
                self._json(200, {"item": service.update_attendance(user, record_id, self._body())})
                return
            if path == "/api/marks" and method == "POST":
                self._require_role(user, {"admin", "faculty"})
                self._json(201, {"item": service.record_mark(user, self._body())})
                return
            if path.startswith("/api/marks/") and method == "PUT":
                self._require_role(user, {"admin", "faculty"})
                self._json(200, {"item": service.update_mark(user, path.rsplit("/", 1)[-1], self._body())})
                return
            if path == "/api/feedback" and method == "GET":
                self._require_role(user, {"admin", "faculty"})
                items = [row for row in service.store.read("feedback") if row["student_id"] in service.allowed_student_ids(user)]
                self._json(200, {"items": items})
                return
            if path == "/api/feedback" and method == "POST":
                if user["role"] not in {"student", "admin", "faculty"}:
                    raise ServiceError("You are not authorized to submit feedback for this record.", 403)
                self._json(201, {"item": service.submit_feedback(user, self._body())})
                return
            if path.startswith("/api/feedback/") and method == "POST":
                self._require_role(user, {"admin", "faculty"})
                feedback_id = path.rsplit("/", 1)[-1]
                self._json(200, {"item": service.analyze_feedback_record(user, feedback_id, self._body())})
                return
            if path == "/api/risk" and method == "GET":
                query = parse_qs(urlparse(self.path).query)
                student_id = query.get("student_id", [""])[0]
                if student_id:
                    self._json(200, {"item": service.risk_for_student(user, student_id)})
                else:
                    self._require_role(user, {"admin", "faculty"})
                    items = [service.risk_for_student(user, row["id"]) for row in service.students_for(user)]
                    self._json(200, {"items": items})
                return
            if path == "/api/recommendations" and method == "GET":
                items = [row for row in service.store.read("recommendations") if row["student_id"] in service.allowed_student_ids(user)]
                self._json(200, {"items": items})
                return
            if path == "/api/recommendations" and method == "POST":
                self._require_role(user, {"admin", "faculty"})
                self._json(201, {"item": service.create_recommendation(user, self._body())})
                return
            if path == "/api/interventions" and method == "GET":
                items = [row for row in service.store.read("interventions") if row["student_id"] in service.allowed_student_ids(user)]
                self._json(200, {"items": items})
                return
            if path == "/api/interventions" and method == "POST":
                self._require_role(user, {"admin", "faculty"})
                self._json(201, {"item": service.create_intervention(user, self._body())})
                return
            if path.startswith("/api/interventions/") and method == "PUT":
                self._require_role(user, {"admin", "faculty"})
                self._json(200, {"item": service.update_intervention(user, path.rsplit("/", 1)[-1], self._body())})
                return
            if path == "/api/reports" and method == "GET":
                self._require_role(user, {"admin", "faculty"})
                self._json(200, {"reports": ["students", "attendance", "marks", "feedback", "interventions"]})
                return
            if path.startswith("/api/reports/") and method == "GET":
                report_type = path.rsplit("/", 1)[-1].removesuffix(".csv")
                content = service.report_csv(user, report_type)
                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", f'attachment; filename="{report_type}.csv"')
                self.end_headers()
                self.wfile.write(content.encode("utf-8"))
                return
            if path == "/api/audit" and method == "GET":
                self._require_role(user, {"admin"})
                items = list(reversed(service.store.read("audit_log")))
                self._json(200, {"items": items[:200]})
                return
            if path == "/api/settings" and method == "GET":
                self._require_role(user, {"admin"})
                self._json(200, {"items": service.store.read("settings")})
                return
            if path == "/api/settings" and method == "PUT":
                self._require_role(user, {"admin"})
                self._update_settings(user, self._body())
                return
            if path == "/api/notifications" and method == "GET":
                allowed_ids = service.allowed_student_ids(user)
                rows = [
                    row for row in service.store.read("notifications")
                    if row["student_id"] in allowed_ids
                    and (user["role"] == "admin" or row["recipient_id"] == user["id"])
                ]
                self._json(200, {"items": rows})
                return
            if path == "/api/notifications" and method == "POST":
                self._json(201, {"items": service.create_guardian_notification(user, self._body())})
                return
            if path.startswith("/api/notifications/") and method == "PUT":
                notification_id = path.rsplit("/", 1)[-1]
                row = next((item for item in service.store.read("notifications") if item["id"] == notification_id), None)
                if not row:
                    raise ServiceError("Notification was not found.", 404)
                service.require_student_access(user, row["student_id"])
                if user["role"] != "admin" and row["recipient_id"] != user["id"]:
                    raise ServiceError("You are not authorized to update this notification.", 403)
                updated = service.store.update("notifications", "id", notification_id, {"read": "true"})
                service.record_audit(user, "notification.read", notification_id, "Marked an authorized notification as read.")
                self._json(200, {"item": updated})
                return
            raise ServiceError("API route was not found.", 404)

        def _login(self) -> None:
            values = self._body()
            email = str(values.get("email", ""))
            password = str(values.get("password", ""))
            if len(email) > 254 or len(password) > 256 or not email.strip() or not password:
                raise ServiceError("Enter a valid email address and password.", 400)
            email = email.strip().lower()
            if "@" not in email or email.startswith("@") or email.endswith("@"):
                raise ServiceError("Enter a valid email address and password.", 400)
            result = api.auth.login(email, password)
            selected_role = str(values.get("selected_role", ""))
            if not result or selected_role != result[1]["role"]:
                if result:
                    api.auth.logout(result[0])
                actor = {"id": "anonymous"}
                api.service.record_audit(actor, "login.failed", "auth", "A login attempt was rejected.")
                raise ServiceError("Email or password is incorrect.", 401)
            token, user = result
            api.service.record_audit(user, "login.succeeded", user["id"], f"Successful local demo login for role {user['role']}.")
            self.send_response(200)
            self.send_header("Set-Cookie", f"{COOKIE_NAME}={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"user": user}).encode("utf-8"))

        def _logout(self) -> None:
            token = self._session_token()
            user = api.auth.resolve(token)
            api.auth.logout(token)
            if user:
                api.service.record_audit(user, "logout", user["id"], "Ended local demo session.")
            self.send_response(200)
            self.send_header("Set-Cookie", f"{COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')

        def _current_user(self, required: bool = True) -> dict[str, Any] | None:
            user = api.auth.resolve(self._session_token())
            if required and user is None:
                raise ServiceError("Sign in is required.", 401)
            if user is None:
                return None
            return {
                "id": user["id"],
                "email": user["email"],
                "role": user["role"],
                "name": user["name"],
                "student_id": user["studentId"],
                "linked_student_id": user["linkedStudentId"],
                "assigned_student_ids": json.dumps(user["assignedStudentIds"]),
            }

        def _session_token(self) -> str | None:
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get("Cookie", ""))
            except Exception:
                return None
            morsel = cookie.get(COOKIE_NAME)
            return morsel.value if morsel else None

        def _body(self) -> dict[str, Any]:
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError as error:
                raise ServiceError("Invalid request body length.") from error
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ServiceError("Request body is empty or exceeds the allowed size.")
            raw = self.rfile.read(length)
            try:
                body = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise ServiceError("Request body must be valid JSON.") from error
            if not isinstance(body, dict):
                raise ServiceError("Request body must be a JSON object.")
            return body

        def _update_settings(self, user: dict[str, Any], values: dict[str, Any]) -> None:
            allowed = {"attendance_attention_percent", "attendance_urgent_percent", "academic_attention_percent", "academic_urgent_percent"}
            rows = api.service.store.read("settings")
            by_key = {row["key"]: row for row in rows}
            for key, value in values.items():
                if key not in allowed:
                    continue
                try:
                    number = float(value)
                except (TypeError, ValueError) as error:
                    raise ServiceError(f"{key} must be a number from 0 to 100.") from error
                if not 0 <= number <= 100:
                    raise ServiceError(f"{key} must be from 0 to 100.")
                if key.endswith("urgent_percent"):
                    attention_key = key.replace("urgent", "attention")
                    other = float(values.get(attention_key, by_key[attention_key]["value"]))
                    if number >= other:
                        raise ServiceError("Urgent threshold must be lower than its attention threshold.")
                by_key[key]["value"] = str(number)
                by_key[key]["updated_by"] = str(user["id"])
            if not any(key in values for key in allowed):
                raise ServiceError("No supported thresholds were provided.")
            api.service.store.write("settings", list(by_key.values()))
            api.service.record_audit(user, "settings.updated", "thresholds", "Updated prototype thresholds.")
            self._json(200, {"items": list(by_key.values())})

        def _json(self, status: int, payload: dict[str, Any]) -> None:
            data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        @staticmethod
        def _require_role(user: dict[str, Any], allowed: set[str]) -> None:
            if user.get("role") not in allowed:
                raise ServiceError("You are not authorized to perform this operation.", 403)

    return Handler


def serve(host: str | None = None, port: int | None = None) -> None:
    bind_host = host or os.environ.get("AI_CAMPUS_HOST", "127.0.0.1")
    bind_port = port or int(os.environ.get("AI_CAMPUS_PORT", "8000"))
    api = CampusApi()
    server = ThreadingHTTPServer((bind_host, bind_port), create_handler(api))
    print(f"AI Campus 360 local API listening on http://{bind_host}:{bind_port} (demo mode)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping AI Campus 360 local API.")
    finally:
        server.server_close()


if __name__ == "__main__":
    serve()
