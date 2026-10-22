"""Safe CSV persistence for the fictional local campus demonstration."""

from __future__ import annotations

import csv
import os
import tempfile
from pathlib import Path
from threading import RLock
from typing import Any


SCHEMAS: dict[str, tuple[str, ...]] = {
    "students": ("id", "name", "email", "department", "semester", "status", "active"),
    "attendance": ("id", "student_id", "date", "subject", "status", "present_count", "total_count", "recorded_by", "created_at"),
    "marks": ("id", "student_id", "subject", "assessment", "score", "max_score", "date", "recorded_by"),
    "feedback": ("id", "student_id", "submitted_by", "text", "created_at", "category", "sentiment", "keywords", "explanation", "reviewed_by"),
    "risk_analysis": ("id", "student_id", "score", "category", "factors", "explanation", "created_at", "reviewed_by", "data_sufficient"),
    "recommendations": ("id", "student_id", "issue", "action", "evidence", "status", "created_at", "assigned_to"),
    "interventions": ("id", "student_id", "recommendation_id", "assigned_to", "action", "created_at", "due_date", "status", "follow_up_notes", "outcome", "reviewed_at"),
    "users": ("id", "email", "password_hash", "role", "name", "student_id", "linked_student_id", "assigned_student_ids", "active"),
    "audit_log": ("id", "timestamp", "actor_id", "action", "record_id", "summary"),
    "notifications": ("id", "recipient_id", "student_id", "type", "message", "created_at", "read"),
    "settings": ("key", "value", "updated_by"),
}

DEMO_STUDENTS = [
    {"id": "ST102", "name": "Aarav Sharma", "email": "aarav@example.edu", "department": "Computer Science", "semester": "4", "status": "Support Required", "active": "true"},
    {"id": "ST105", "name": "Meera Iyer", "email": "meera@example.edu", "department": "Computer Science", "semester": "4", "status": "Stable", "active": "true"},
    {"id": "ST118", "name": "Kabir Nair", "email": "kabir@example.edu", "department": "Engineering", "semester": "6", "status": "Monitor", "active": "true"},
    {"id": "ST121", "name": "Riya Menon", "email": "riya@example.edu", "department": "Science", "semester": "2", "status": "Stable", "active": "true"},
    {"id": "ST136", "name": "Dev Patel", "email": "dev@example.edu", "department": "Engineering", "semester": "6", "status": "Support Required", "active": "true"},
]


class StorageError(RuntimeError):
    """Raised when a CSV file is malformed or cannot be safely persisted."""


class CsvStore:
    """Thread-safe CSV store with schema checks and atomic file replacement."""

    def __init__(self, data_dir: Path | None = None) -> None:
        configured = os.environ.get("AI_CAMPUS_DATA_DIR")
        self.data_dir = data_dir or Path(configured) if configured else data_dir or Path(__file__).parent / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self.initialize_files()

    def initialize_files(self) -> None:
        with self._lock:
            for table, columns in SCHEMAS.items():
                path = self._path(table)
                if not path.exists():
                    self._write(table, [])
                self.read(table)
            self._seed_students()
            self._seed_settings()

    def _path(self, table: str) -> Path:
        if table not in SCHEMAS:
            raise StorageError(f"Unknown data table: {table}")
        return self.data_dir / f"{table}.csv"

    def read(self, table: str) -> list[dict[str, str]]:
        path = self._path(table)
        columns = SCHEMAS[table]
        try:
            with path.open("r", newline="", encoding="utf-8-sig") as source:
                reader = csv.DictReader(source)
                if reader.fieldnames is None or not set(columns).issubset(reader.fieldnames):
                    raise StorageError(f"{path.name} is missing required CSV columns.")
                rows = []
                for line_number, row in enumerate(reader, start=2):
                    if None in row:
                        raise StorageError(f"{path.name} has malformed data on line {line_number}.")
                    rows.append({column: (row.get(column) or "").strip() for column in columns})
                return rows
        except (OSError, csv.Error) as error:
            raise StorageError(f"Unable to read {path.name}: {error}") from error

    def write(self, table: str, rows: list[dict[str, Any]]) -> None:
        with self._lock:
            self._write(table, rows)

    def append(self, table: str, row: dict[str, Any], unique_field: str | None = None) -> bool:
        with self._lock:
            rows = self.read(table)
            if unique_field and any(existing.get(unique_field) == str(row.get(unique_field, "")) for existing in rows):
                return False
            rows.append(row)
            self._write(table, rows)
            return True

    def update(self, table: str, field: str, value: str, changes: dict[str, Any]) -> dict[str, str] | None:
        with self._lock:
            rows = self.read(table)
            for row in rows:
                if row.get(field) == value:
                    row.update({key: item for key, item in changes.items() if key in SCHEMAS[table]})
                    self._write(table, rows)
                    return row
            return None

    def _write(self, table: str, rows: list[dict[str, Any]]) -> None:
        path = self._path(table)
        columns = SCHEMAS[table]
        temp_name = ""
        try:
            with tempfile.NamedTemporaryFile("w", newline="", encoding="utf-8", dir=self.data_dir, delete=False) as target:
                temp_name = target.name
                writer = csv.DictWriter(target, fieldnames=columns, extrasaction="ignore")
                writer.writeheader()
                for row in rows:
                    writer.writerow({column: row.get(column, "") for column in columns})
                target.flush()
                os.fsync(target.fileno())
            os.replace(temp_name, path)
        except (OSError, csv.Error) as error:
            if temp_name:
                Path(temp_name).unlink(missing_ok=True)
            raise StorageError(f"Unable to safely write {path.name}: {error}") from error

    def _seed_students(self) -> None:
        existing = self.read("students")
        existing_ids = {row["id"] for row in existing}
        additions = [row for row in DEMO_STUDENTS if row["id"] not in existing_ids]
        if additions:
            self.write("students", existing + additions)

    def _seed_settings(self) -> None:
        rows = self.read("settings")
        existing = {row["key"] for row in rows}
        additions = [
            {"key": "attendance_attention_percent", "value": "75", "updated_by": "system"},
            {"key": "attendance_urgent_percent", "value": "60", "updated_by": "system"},
            {"key": "academic_attention_percent", "value": "60", "updated_by": "system"},
            {"key": "academic_urgent_percent", "value": "40", "updated_by": "system"},
        ]
        missing = [row for row in additions if row["key"] not in existing]
        if missing:
            self.write("settings", rows + missing)
