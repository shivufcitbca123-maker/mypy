"""Tkinter desktop client using the same validated CSV business services."""

from __future__ import annotations

import tkinter as tk
from datetime import date
from tkinter import filedialog, messagebox, ttk

from .api import DEMO_USER
from .services import CampusService, ServiceError


class CampusDesktop(tk.Tk):
    def __init__(self, service: CampusService | None = None) -> None:
        super().__init__()
        self.service = service or CampusService()
        self.title("AI Campus 360° · Local PBL Desktop")
        self.geometry("1120x760")
        self.minsize(900, 620)
        self.configure(bg="#f4f7fb")
        self.style = ttk.Style(self)
        self.style.configure("Treeview", rowheight=28)
        self.style.configure("Heading.TLabel", font=("Segoe UI", 17, "bold"))
        self.user = dict(DEMO_USER)
        self._build()
        self.refresh_all()

    def _build(self) -> None:
        header = ttk.Frame(self, padding=(20, 16))
        header.pack(fill="x")
        ttk.Label(header, text="AI Campus 360°", style="Heading.TLabel").pack(side="left")
        ttk.Label(header, text="LOCAL DEMO · CSV STORAGE · FICTIONAL DATA", foreground="#287f75").pack(side="right")
        self.tabs = ttk.Notebook(self)
        self.tabs.pack(fill="both", expand=True, padx=16, pady=(0, 16))
        self._build_dashboard()
        self._build_students()
        self._build_attendance()
        self._build_academics()
        self._build_feedback()
        self._build_risk()
        self._build_interventions()
        self._build_reports()

    def _build_dashboard(self) -> None:
        frame = ttk.Frame(self.tabs, padding=18)
        self.tabs.add(frame, text="Dashboard")
        ttk.Label(frame, text="Campus overview (fictional demo data)", style="Heading.TLabel").pack(anchor="w")
        self.dashboard_text = tk.Text(frame, height=8, wrap="word", state="disabled", relief="flat", padx=14, pady=14)
        self.dashboard_text.pack(fill="x", pady=12)
        ttk.Label(frame, text="Data flow · counts are read from the CSV files", font=("Segoe UI", 12, "bold")).pack(anchor="w")
        self.flow_tree = self._tree(frame, ("stage", "count", "source"), (280, 90, 360))

    def _build_students(self) -> None:
        frame = ttk.Frame(self.tabs, padding=14)
        self.tabs.add(frame, text="Students")
        ttk.Label(frame, text="Student management", style="Heading.TLabel").pack(anchor="w", pady=(0, 10))
        self.student_tree = self._tree(frame, ("id", "name", "email", "department", "semester", "status"), (100, 180, 220, 190, 90, 150))
        actions = ttk.Frame(frame)
        actions.pack(fill="x", pady=8)
        ttk.Button(actions, text="Add student", command=self.add_student).pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Edit selected", command=self.edit_student).pack(side="left", padx=8)
        ttk.Button(actions, text="Deactivate selected", command=self.deactivate_student).pack(side="left", padx=8)
        ttk.Button(actions, text="Refresh", command=self.refresh_all).pack(side="right")

    def _build_attendance(self) -> None:
        frame = ttk.Frame(self.tabs, padding=14)
        self.tabs.add(frame, text="Attendance")
        ttk.Label(frame, text="Record attendance", style="Heading.TLabel").pack(anchor="w", pady=(0, 10))
        form = ttk.Frame(frame)
        form.pack(fill="x", pady=(0, 10))
        self.att_student = self._entry(form, "Student ID", 0, 0, "ST102")
        self.att_date = self._entry(form, "Date (YYYY-MM-DD)", 0, 2, date.today().isoformat())
        self.att_subject = self._entry(form, "Class / subject", 0, 4, "General")
        ttk.Label(form, text="Status").grid(row=0, column=6, sticky="w", padx=5)
        self.att_status = ttk.Combobox(form, values=("Present", "Absent", "Excused"), state="readonly", width=12)
        self.att_status.set("Present")
        self.att_status.grid(row=1, column=6, padx=5, sticky="w")
        ttk.Button(form, text="Save attendance", command=self.save_attendance).grid(row=1, column=7, padx=8)
        self.attendance_tree = self._tree(frame, ("id", "student_id", "date", "subject", "status", "present_count", "total_count"), (170, 100, 120, 170, 100, 110, 110))

    def _build_academics(self) -> None:
        frame = ttk.Frame(self.tabs, padding=14)
        self.tabs.add(frame, text="Academic records")
        ttk.Label(frame, text="Record marks", style="Heading.TLabel").pack(anchor="w", pady=(0, 10))
        form = ttk.Frame(frame)
        form.pack(fill="x", pady=(0, 10))
        self.mark_student = self._entry(form, "Student ID", 0, 0, "ST102")
        self.mark_subject = self._entry(form, "Subject", 0, 2, "DBMS")
        self.mark_assessment = self._entry(form, "Assessment", 0, 4, "Practical 1")
        self.mark_score = self._entry(form, "Score", 0, 6, "")
        self.mark_max = self._entry(form, "Maximum", 2, 0, "100")
        self.mark_date = self._entry(form, "Date (YYYY-MM-DD)", 2, 2, date.today().isoformat())
        ttk.Button(form, text="Save mark", command=self.save_mark).grid(row=3, column=4, padx=6, pady=6)
        self.marks_tree = self._tree(frame, ("id", "student_id", "subject", "assessment", "score", "max_score", "date"), (150, 100, 140, 180, 90, 90, 120))

    def _build_feedback(self) -> None:
        frame = ttk.Frame(self.tabs, padding=14)
        self.tabs.add(frame, text="Feedback & NLP")
        ttk.Label(frame, text="Transparent rule-based feedback review", style="Heading.TLabel").pack(anchor="w", pady=(0, 10))
        form = ttk.Frame(frame)
        form.pack(fill="x")
        self.feedback_student = self._entry(form, "Student ID", 0, 0, "ST102")
        ttk.Label(form, text="Feedback text").grid(row=0, column=2, sticky="w", padx=5)
        self.feedback_text = tk.Text(form, height=4, width=74, wrap="word")
        self.feedback_text.grid(row=1, column=2, columnspan=3, padx=5, pady=5, sticky="ew")
        ttk.Button(form, text="Submit and analyze", command=self.submit_feedback).grid(row=1, column=5, padx=8)
        self.feedback_result = ttk.Label(frame, text="Analysis explains matched local keyword rules; it is not a trained model.", wraplength=900)
        self.feedback_result.pack(anchor="w", pady=8)
        self.feedback_tree = self._tree(frame, ("id", "student_id", "category", "sentiment", "keywords", "reviewed_by"), (150, 100, 120, 120, 320, 140))

    def _build_risk(self) -> None:
        frame = ttk.Frame(self.tabs, padding=14)
        self.tabs.add(frame, text="Risk & recommendations")
        ttk.Label(frame, text="Explainable support priorities · human review only", style="Heading.TLabel").pack(anchor="w", pady=(0, 10))
        actions = ttk.Frame(frame)
        actions.pack(fill="x", pady=6)
        ttk.Button(actions, text="Recalculate risk", command=self.refresh_risk).pack(side="left")
        ttk.Button(actions, text="Create recommendation for selected", command=self.create_recommendation).pack(side="left", padx=8)
        self.risk_tree = self._tree(frame, ("student_id", "score", "category", "attendance_percent", "academic_average", "factors"), (120, 80, 220, 140, 140, 400))
        self.risk_tree.bind("<<TreeviewSelect>>", lambda _event: None)
        ttk.Label(frame, text="Scores are illustrative rules, not predictions or proof of future outcomes.", foreground="#9a6a1e").pack(anchor="w", pady=8)

    def _build_interventions(self) -> None:
        frame = ttk.Frame(self.tabs, padding=14)
        self.tabs.add(frame, text="Interventions")
        ttk.Label(frame, text="Closed-loop support tracking", style="Heading.TLabel").pack(anchor="w", pady=(0, 10))
        form = ttk.Frame(frame)
        form.pack(fill="x", pady=(0, 10))
        self.int_student = self._entry(form, "Student ID", 0, 0, "ST102")
        self.int_action = self._entry(form, "Action", 0, 2, "Faculty check-in")
        self.int_due = self._entry(form, "Follow-up date", 0, 4, date.today().isoformat())
        ttk.Button(form, text="Create intervention", command=self.create_intervention).grid(row=1, column=6, padx=7)
        self.intervention_tree = self._tree(frame, ("id", "student_id", "action", "due_date", "status", "follow_up_notes", "outcome"), (150, 100, 250, 110, 120, 220, 220))
        updates = ttk.Frame(frame)
        updates.pack(fill="x", pady=8)
        ttk.Button(updates, text="Mark in progress", command=lambda: self.update_intervention("In Progress")).pack(side="left")
        ttk.Button(updates, text="Add follow-up / outcome", command=self.add_followup).pack(side="left", padx=8)
        ttk.Button(updates, text="Complete", command=lambda: self.update_intervention("Completed")).pack(side="left", padx=8)

    def _build_reports(self) -> None:
        frame = ttk.Frame(self.tabs, padding=14)
        self.tabs.add(frame, text="Reports")
        ttk.Label(frame, text="Export permitted CSV reports", style="Heading.TLabel").pack(anchor="w", pady=(0, 10))
        for report in ("students", "attendance", "marks", "feedback", "interventions"):
            ttk.Button(frame, text=f"Export {report.title()}", command=lambda kind=report: self.export_report(kind)).pack(anchor="w", pady=5)
        ttk.Label(frame, text=f"Source data: {self.service.store.data_dir}", wraplength=900).pack(anchor="w", pady=14)

    @staticmethod
    def _entry(parent: ttk.Frame, label: str, row: int, column: int, default: str) -> tk.Entry:
        ttk.Label(parent, text=label).grid(row=row, column=column, sticky="w", padx=5)
        entry = ttk.Entry(parent, width=19)
        entry.grid(row=row + 1, column=column, sticky="w", padx=5, pady=5)
        entry.insert(0, default)
        return entry

    @staticmethod
    def _tree(parent: ttk.Frame, columns: tuple[str, ...], widths: tuple[int, ...]) -> ttk.Treeview:
        tree = ttk.Treeview(parent, columns=columns, show="headings")
        for column, width in zip(columns, widths):
            tree.heading(column, text=column.replace("_", " ").title())
            tree.column(column, width=width, minwidth=70, anchor="w")
        tree.pack(fill="both", expand=True)
        return tree

    def _fill(self, tree: ttk.Treeview, rows: list[dict[str, object]]) -> None:
        tree.delete(*tree.get_children())
        for row in rows:
            tree.insert("", "end", values=tuple(row.get(column, "") for column in tree["columns"]))

    def refresh_all(self) -> None:
        self._fill(self.student_tree, self.service.students_for(self.user))
        self._fill(self.attendance_tree, self.service.store.read("attendance"))
        self._fill(self.marks_tree, self.service.store.read("marks"))
        self._fill(self.feedback_tree, self.service.store.read("feedback"))
        self._fill(self.intervention_tree, self.service.store.read("interventions"))
        overview = self.service.overview(self.user)
        self.dashboard_text.configure(state="normal")
        self.dashboard_text.delete("1.0", "end")
        self.dashboard_text.insert("1.0", (
            f"Students: {overview['total_students']} · Faculty demo accounts: {overview['total_faculty_accounts']}\n"
            f"Attendance: {overview['attendance_percent']}% · Academic average: {overview['academic_average']}%\n"
            f"Open interventions: {overview['open_interventions']} · Pending follow-ups: {overview['pending_followups']}\n"
            "All sample records are fictional. Low attendance/marks are signals for human review only."
        ))
        self.dashboard_text.configure(state="disabled")
        self._fill(self.flow_tree, self.service.data_flow())
        self.refresh_risk()

    def add_student(self) -> None:
        dialog = StudentDialog(self, "Add student")
        if dialog.values and self._run(lambda: self.service.create_student(self.user, dialog.values)):
            self.refresh_all()

    def edit_student(self) -> None:
        selected = self.student_tree.selection()
        if not selected:
            messagebox.showinfo("Select a student", "Choose a student row first.")
            return
        values = self.student_tree.item(selected[0], "values")
        dialog = StudentDialog(self, "Edit student", dict(zip(("id", "name", "email", "department", "semester"), values)))
        if dialog.values and self._run(lambda: self.service.update_student(self.user, values[0], dialog.values)):
            self.refresh_all()

    def deactivate_student(self) -> None:
        selected = self.student_tree.selection()
        if not selected:
            messagebox.showinfo("Select a student", "Choose a student row first.")
            return
        student_id = self.student_tree.item(selected[0], "values")[0]
        if messagebox.askyesno("Confirm deactivation", f"Deactivate {student_id}? Related CSV records will be preserved."):
            if self._run(lambda: self.service.deactivate_student(self.user, student_id)):
                self.refresh_all()

    def save_attendance(self) -> None:
        values = {"student_id": self.att_student.get(), "date": self.att_date.get(), "subject": self.att_subject.get(), "status": self.att_status.get()}
        if self._run(lambda: self.service.record_attendance(self.user, values)):
            self.refresh_all()

    def save_mark(self) -> None:
        values = {"student_id": self.mark_student.get(), "subject": self.mark_subject.get(), "assessment": self.mark_assessment.get(),
                  "score": self.mark_score.get(), "max_score": self.mark_max.get(), "date": self.mark_date.get()}
        if self._run(lambda: self.service.record_mark(self.user, values)):
            self.refresh_all()

    def submit_feedback(self) -> None:
        values = {"student_id": self.feedback_student.get(), "text": self.feedback_text.get("1.0", "end").strip()}
        result = self._run(lambda: self.service.submit_feedback(self.user, values))
        if result:
            analysis = self._run(lambda: self.service.analyze_feedback_record(self.user, result["id"]))
            if analysis:
                self.feedback_result.configure(text=f"{analysis['category']} · {analysis['sentiment']} · Keywords: {', '.join(analysis['keywords']) or 'none'}\n{analysis['explanation']}\nSuggested: {analysis['action']}")
                self.feedback_text.delete("1.0", "end")
                self.refresh_all()

    def refresh_risk(self) -> None:
        rows = [self.service.risk_for_student(self.user, row["id"]) for row in self.service.students_for(self.user)]
        display = [{**row, "factors": "; ".join(f"{factor['factor']}: {factor['value']} → +{factor['points']}" for factor in row["factors"])} for row in rows]
        self._fill(self.risk_tree, display)

    def create_recommendation(self) -> None:
        selected = self.risk_tree.selection()
        if not selected:
            messagebox.showinfo("Select a student", "Choose a risk row first.")
            return
        values = self.risk_tree.item(selected[0], "values")
        student_id, score, category, attendance, academic, factors = values
        row = {"student_id": student_id, "issue": f"{category} support review", "action": "Arrange a faculty check-in and review next steps.",
               "evidence": f"Score {score}; attendance {attendance}; academic average {academic}; factors {factors}"}
        if self._run(lambda: self.service.create_recommendation(self.user, row)):
            messagebox.showinfo("Recommendation created", "Recommendation was saved with its supporting evidence.")

    def create_intervention(self) -> None:
        values = {"student_id": self.int_student.get(), "action": self.int_action.get(), "due_date": self.int_due.get()}
        if self._run(lambda: self.service.create_intervention(self.user, values)):
            self.refresh_all()

    def update_intervention(self, status: str) -> None:
        selected = self.intervention_tree.selection()
        if not selected:
            messagebox.showinfo("Select an intervention", "Choose an intervention row first.")
            return
        intervention_id = self.intervention_tree.item(selected[0], "values")[0]
        if self._run(lambda: self.service.update_intervention(self.user, intervention_id, {"status": status})):
            self.refresh_all()

    def add_followup(self) -> None:
        selected = self.intervention_tree.selection()
        if not selected:
            messagebox.showinfo("Select an intervention", "Choose an intervention row first.")
            return
        intervention_id = self.intervention_tree.item(selected[0], "values")[0]
        notes = TextDialog(self, "Follow-up notes", "Record the follow-up summary:")
        if notes.value:
            if self._run(lambda: self.service.update_intervention(self.user, intervention_id, {"follow_up_notes": notes.value, "outcome": notes.value})):
                self.refresh_all()

    def export_report(self, kind: str) -> None:
        content = self._run(lambda: self.service.report_csv(self.user, kind))
        if content is None:
            return
        destination = filedialog.asksaveasfilename(defaultextension=".csv", initialfile=f"{kind}.csv", filetypes=[("CSV files", "*.csv")])
        if destination:
            try:
                with open(destination, "w", encoding="utf-8", newline="") as output:
                    output.write(content)
                messagebox.showinfo("Report exported", f"Saved {kind} report.")
            except OSError as error:
                messagebox.showerror("Export failed", f"Could not write report: {error}")

    def _run(self, action):
        try:
            return action()
        except ServiceError as error:
            messagebox.showerror("Unable to complete action", error.message)
        except Exception as error:
            messagebox.showerror("Data error", f"The operation failed safely: {error}")
        return None


class StudentDialog(tk.Toplevel):
    def __init__(self, parent: tk.Misc, title: str, initial: dict[str, str] | None = None) -> None:
        super().__init__(parent)
        self.title(title)
        self.values = None
        self.transient(parent)
        self.grab_set()
        initial = initial or {}
        self.entries = {}
        for row, field in enumerate(("id", "name", "email", "department", "semester")):
            ttk.Label(self, text=field.title()).grid(row=row, column=0, sticky="w", padx=12, pady=6)
            entry = ttk.Entry(self, width=36)
            entry.grid(row=row, column=1, padx=12, pady=6)
            entry.insert(0, initial.get(field, ""))
            self.entries[field] = entry
        ttk.Button(self, text="Save", command=self._save).grid(row=5, column=1, sticky="e", padx=12, pady=12)
        self.wait_window()

    def _save(self) -> None:
        self.values = {field: entry.get().strip() for field, entry in self.entries.items() if field != "id"}
        self.destroy()


class TextDialog(tk.Toplevel):
    def __init__(self, parent: tk.Misc, title: str, prompt: str) -> None:
        super().__init__(parent)
        self.title(title)
        self.value = ""
        self.transient(parent)
        self.grab_set()
        ttk.Label(self, text=prompt).pack(anchor="w", padx=12, pady=8)
        self.text = tk.Text(self, width=60, height=5)
        self.text.pack(padx=12, pady=6)
        ttk.Button(self, text="Save follow-up", command=self._save).pack(anchor="e", padx=12, pady=10)
        self.wait_window()

    def _save(self) -> None:
        self.value = self.text.get("1.0", "end").strip()
        self.destroy()


def launch() -> None:
    CampusDesktop().mainloop()


if __name__ == "__main__":
    launch()
