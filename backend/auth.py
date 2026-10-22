"""Password hashing, demo account seeding, and server-side session management."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from typing import Any

from .storage import CsvStore


DEMO_ACCOUNTS = (
    {"id": "demo-admin", "email": "admin@aicampus360.com", "password": "Admin@360", "role": "admin", "name": "Campus Admin"},
    {"id": "demo-faculty", "email": "faculty@aicampus360.com", "password": "Faculty@360", "role": "faculty", "name": "Dr. Priya Nair", "assigned_student_ids": ["ST102", "ST105", "ST136"]},
    {"id": "demo-student", "email": "student@aicampus360.com", "password": "Student@360", "role": "student", "name": "Aarav Sharma", "student_id": "ST102"},
    {"id": "demo-parent", "email": "parent@aicampus360.com", "password": "Parent@360", "role": "parent", "name": "Aarav Sharma's Parent/Guardian", "linked_student_id": "ST102"},
)

PBKDF2_ITERATIONS = 310_000
SESSION_SECONDS = 8 * 60 * 60


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt_bytes = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt_bytes.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt_hex, expected = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)).hex()
        return hmac.compare_digest(digest, expected)
    except (ValueError, TypeError):
        return False


class AuthService:
    def __init__(self, store: CsvStore) -> None:
        self.store = store
        self._sessions: dict[str, tuple[str, float]] = {}
        self._seed_accounts()

    def _seed_accounts(self) -> None:
        users = self.store.read("users")
        existing_emails = {row["email"].lower() for row in users}
        additions = []
        for account in DEMO_ACCOUNTS:
            if account["email"] in existing_emails:
                continue
            additions.append({
                "id": account["id"],
                "email": account["email"],
                "password_hash": hash_password(account["password"]),
                "role": account["role"],
                "name": account["name"],
                "student_id": account.get("student_id", ""),
                "linked_student_id": account.get("linked_student_id", ""),
                "assigned_student_ids": ",".join(account.get("assigned_student_ids", [])),
                "active": "true",
            })
        if additions:
            self.store.write("users", users + additions)

    def login(self, email: str, password: str) -> tuple[str, dict[str, Any]] | None:
        normalized_email = email.strip().lower()
        user = next((row for row in self.store.read("users") if row["email"].lower() == normalized_email), None)
        if not user or user["active"].lower() != "true" or not verify_password(password, user["password_hash"]):
            return None
        token = secrets.token_urlsafe(32)
        self._sessions[token] = (user["id"], time.time() + SESSION_SECONDS)
        return token, self.public_user(user)

    def resolve(self, token: str | None) -> dict[str, Any] | None:
        if not token:
            return None
        session = self._sessions.get(token)
        if session is None:
            return None
        user_id, expires_at = session
        if expires_at <= time.time():
            self._sessions.pop(token, None)
            return None
        user = next((row for row in self.store.read("users") if row["id"] == user_id and row["active"].lower() == "true"), None)
        return self.public_user(user) if user else None

    def logout(self, token: str | None) -> None:
        if token:
            self._sessions.pop(token, None)

    def list_users(self) -> list[dict[str, Any]]:
        public_users = []
        for row in self.store.read("users"):
            public_users.append({
                "id": row["id"],
                "email": row["email"],
                "role": row["role"],
                "name": row["name"],
                "studentId": row["student_id"],
                "linkedStudentId": row["linked_student_id"],
                "assignedStudentIds": row["assigned_student_ids"].split(",") if row["assigned_student_ids"] else [],
                "active": row["active"].lower() == "true",
            })
        return public_users

    @staticmethod
    def public_user(user: dict[str, Any] | None) -> dict[str, Any] | None:
        if not user:
            return None
        return {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "name": user["name"],
            "studentId": user["student_id"],
            "linkedStudentId": user["linked_student_id"],
            "assignedStudentIds": user["assigned_student_ids"].split(",") if user["assigned_student_ids"] else [],
        }
