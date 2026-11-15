"""Default offices, office templates and profile-role permissions.

All of this is starting data: admins change permissions in the matrix, create
new offices on the fly (from a template or from scratch) and build each
office's dashboard. `seed_access` creates what is missing and never removes
an admin's changes unless --sync is given.
"""

A = "accounts."
WEB = [A + c for c in ("content_pages", "content_home", "content_news", "content_events", "content_gallery",
                       "content_history", "content_people", "content_awards")]
ADMIN_CORE = [A + c for c in ("users_manage", "users_import", "users_reset_password", "offices_manage", "offices_appoint",
                              "matrix_edit", "regno_manage", "directory_view", "settings_edit", "branding_manage",
                              "dashboards_design")]

PROFILE_ROLES = {
    "student": ("Student", "Every student profile", [], ["welcome", "calendar", "profile_completeness", "latest_news", "upcoming_events", "notifications", "quick_actions"]),
    "lecturer": ("Lecturer", "Every lecturer profile", [A + "directory_view", A + "memo_send", A + "academics_materials", A + "results_upload", A + "cbt_bank", A + "cbt_run", A + "labs_book"],
                 ["welcome", "calendar", "my_offices", "quick_actions", "notifications", "latest_news", "upcoming_events", "profile_completeness"]),
    "staff": ("Staff", "Every non-teaching staff profile", [A + "directory_view", A + "memo_send"],
              ["welcome", "calendar", "my_offices", "quick_actions", "notifications", "latest_news"]),
    "alumni": ("Alumni", "Every alumni profile", [], ["welcome", "latest_news", "upcoming_events", "profile_completeness", "notifications"]),
}

W_LEAD = ["quick_actions", "people_counts", "office_holders", "pending_settings", "recent_audit", "contact_inbox", "content_status", "calendar", "notifications"]
W_COORD = ["quick_actions", "calendar", "office_holders", "people_counts", "notifications", "upcoming_events"]
W_SUPPORT = ["quick_actions", "contact_inbox", "content_status", "upcoming_events", "notifications"]
W_STUDENT = ["quick_actions", "office_holders", "latest_news", "upcoming_events", "notifications"]

# code, name, short, category, profile_kind, scope_kind, rank, icon, color, perms, widgets, description, template?
OFFICES = [
    # ---- Leadership --------------------------------------------------------
    ("hod", "Head of Department", "HOD", "leadership", "lecturer", "department", 100, "crown", "gold",
     ADMIN_CORE + WEB + [A + c for c in ("academics_calendar", "academics_courses", "academics_allocate", "academics_sign_forms",
                                         "academics_timetable", "results_approve", "results_view_all", "results_correct",
                                         "memo_send", "memo_circular", "requests_approve", "complaints_handle", "welfare_cases",
                                         "welfare_fines", "welfare_waive", "welfare_confidential", "feedback_run", "feedback_reports",
                                         "students_promote", "students_graduate", "alumni_approve", "staff_promotion",
                                         "association_manage", "research_moderate")]
     + ["core.view_audit_log", "core.handle_contact_messages", "core.use_import_export", "config.confirm_setting_change",
        "registration.grant_overrides"],
     W_LEAD, "Leads the department: approves results, allocations and appointments, and sets department rules.", False),
    ("deputy-hod", "Deputy Head of Department", "Deputy HOD", "leadership", "lecturer", "department", 90, "shield-half", "gold",
     [A + c for c in ("directory_view", "academics_allocate", "academics_timetable", "results_view_all", "memo_send",
                      "memo_circular", "requests_approve", "welfare_cases", "feedback_reports", "offices_appoint")]
     + ["core.view_audit_log"], W_LEAD, "Acts for the HOD and leads delegated portfolios.", False),
    # ---- Academic administration ---------------------------------------------
    ("exam-officer", "Examination Officer", "Exam Officer", "academic", "lecturer", "department", 80, "file-badge", "green",
     [A + c for c in ("results_review", "results_seal", "results_release", "results_view_all", "results_correct",
                      "cbt_publish", "directory_view", "memo_send", "requests_approve")] + ["core.use_import_export"],
     ["quick_actions", "calendar", "people_counts", "notifications", "office_holders"],
     "Reviews and seals results, signs result sheets and releases results to students who paid.", False),
    ("registration-officer", "Registration Officer", "Registration", "academic", "any", "department", 60, "clipboard-list", "green",
     [A + c for c in ("academics_calendar", "academics_allocate", "users_import", "directory_view", "regno_manage", "memo_send")]
     + ["core.use_import_export", "registration.grant_overrides"],
     ["quick_actions", "calendar", "people_counts", "notifications"],
     "Runs course registration windows and student records, grants registration overrides, confirms courses from other departments and can allocate courses.", False),
    ("course-allocation-officer", "Course Allocation Officer", "Course Allocation", "academic", "any", "department", 58, "users-round", "green",
     [A + c for c in ("academics_allocate", "directory_view", "memo_send", "classes_view", "class_broadcast")],
     ["quick_actions", "class_lists", "calendar", "people_counts", "notifications"],
     "Allocates courses to lecturers and names each course's coordinator, for the HOD.", False),
    ("level-coordinator", "Level Coordinator (Course Adviser)", "Level Coordinator", "academic", "lecturer", "level", 55, "users-round", "volt",
     [A + c for c in ("academics_sign_forms", "welfare_cases", "requests_approve", "directory_view", "memo_send")],
     W_COORD, "Advises one level: signs course forms, follows up struggling students, reviews promotion.", False),
    ("timetable-officer", "Timetable Officer", "Timetable", "academic", "lecturer", "department", 45, "calendar-clock", "volt",
     [A + c for c in ("academics_timetable", "memo_send")], W_COORD, "Builds lecture and exam timetables and resolves clashes.", False),
    ("pg-coordinator", "Postgraduate Coordinator", "PG Coordinator", "coordination", "lecturer", "programme", 60, "graduation-cap", "plum",
     [A + c for c in ("academics_sign_forms", "requests_approve", "directory_view", "admissions_manage", "memo_send")],
     W_COORD, "Coordinates PGD, M.Sc, MPhil and PhD programmes.", False),
    ("siwes-coordinator", "SIWES Coordinator", "SIWES", "coordination", "lecturer", "department", 50, "factory", "ember",
     [A + c for c in ("siwes_manage", "directory_view", "memo_send")], W_COORD,
     "Places and supervises students on industrial training and clears their logbooks.", False),
    ("fyp-coordinator", "Final Year Project Coordinator", "Project Coordinator", "coordination", "lecturer", "level", 50, "cpu", "ember",
     [A + c for c in ("fyp_manage", "elibrary_publish", "directory_view", "memo_send")], W_COORD,
     "Allocates supervisors, schedules defences and publishes approved projects.", False),
    ("seminar-coordinator", "Seminar Coordinator", "Seminars", "coordination", "lecturer", "department", 40, "presentation", "volt",
     [A + c for c in ("content_events", "memo_send")], W_COORD, "Schedules departmental and student seminars.", False),
    ("industrial-liaison", "Industrial Liaison Officer", "Industry Liaison", "coordination", "lecturer", "department", 40, "handshake", "ember",
     [A + c for c in ("careers_manage", "siwes_manage", "memo_send")], W_COORD, "Builds industry partnerships, internships and placements.", False),
    ("admissions-officer", "Admissions Officer", "Admissions", "academic", "any", "department", 45, "door-open", "green",
     [A + c for c in ("admissions_manage", "users_import", "directory_view")] + ["core.use_import_export"], W_COORD,
     "Brings newly admitted students into EE Hub.", False),
    ("accreditation-coordinator", "Accreditation Coordinator (NUC/COREN)", "Accreditation", "academic", "lecturer", "department", 45, "badge-check", "gold",
     [A + c for c in ("academics_courses", "feedback_reports", "directory_view", "memo_send")], W_COORD,
     "Prepares NUC and COREN accreditation evidence.", False),
    ("quality-assurance", "Quality Assurance Officer", "QA Officer", "academic", "lecturer", "department", 40, "gauge", "green",
     [A + c for c in ("feedback_run", "feedback_reports", "memo_send")], W_COORD, "Runs teaching feedback and quality reviews.", False),
    # ---- Support --------------------------------------------------------------------
    ("secretary", "Departmental Secretary", "Secretary", "support", "staff", "department", 35, "notebook-pen", "slate",
     [A + c for c in ("memo_send", "memo_circular", "content_news", "content_events", "directory_view")]
     + ["core.handle_contact_messages"], W_SUPPORT, "Runs the department office: memos, circulars, records and enquiries.", False),
    ("lab-officer", "Laboratory Officer (Chief Technologist)", "Lab Officer", "support", "staff", "department", 30, "flask-conical", "volt",
     [A + c for c in ("memo_send",)], W_SUPPORT, "Manages laboratories, equipment and bookings.", False),
    ("counsellor", "Student Counsellor", "Counsellor", "support", "any", "department", 50, "heart-handshake", "plum",
     [A + c for c in ("welfare_cases", "welfare_confidential", "directory_view")], W_COORD,
     "Handles confidential welfare cases and counselling.", False),
    ("webmaster", "Website and Portal Officer", "Webmaster", "support", "any", "department", 30, "monitor-cog", "volt",
     WEB + [A + c for c in ("branding_manage", "users_reset_password")] + ["core.manage_files", "core.handle_contact_messages"],
     W_SUPPORT, "Keeps the public website and the portal content up to date.", False),
    ("elibrary-officer", "E-Library Officer", "E-Library", "support", "any", "department", 25, "library", "green",
     [A + "elibrary_publish"], W_SUPPORT, "Curates the departmental E-Library.", False),
    ("staff-adviser-eesa", "Staff Adviser, EESA", "EESA Adviser", "association", "lecturer", "department", 40, "flag", "gold",
     [A + c for c in ("association_manage", "elections_manage")], W_COORD, "Advises the Electrical Engineering Students' Association.", False),
    # ---- Committees ---------------------------------------------------------------------
    ("exams-committee", "Examinations Committee", "Exams Committee", "committee", "lecturer", "committee", 35, "file-check-2", "green",
     [A + "results_review"], W_COORD, "Reviews result sheets before they go to the HOD.", False),
    ("academic-committee", "Academic Planning Committee", "Academic Planning", "committee", "lecturer", "committee", 35, "book-open-check", "volt",
     [A + c for c in ("academics_courses",)], W_COORD, "Curriculum and academic planning (course allocation is the HOD's and the Course Allocation Officer's).", False),
    ("welfare-committee", "Welfare and Discipline Committee", "Welfare Committee", "committee", "any", "committee", 35, "scale", "plum",
     [A + "welfare_cases", A + "welfare_fines"], W_COORD, "Student welfare cases, call-ups and discipline.", False),
    ("research-committee", "Research and Publications Committee", "Research Committee", "committee", "lecturer", "committee", 30, "flask-round", "plum",
     [A + "research_moderate"], W_COORD, "Research hub moderation, seminars and publications.", False),
    ("electoral-committee", "Electoral Committee (EESA)", "Electoral Committee", "committee", "any", "committee", 30, "vote", "gold",
     [A + "elections_manage"], W_STUDENT, "Runs EESA elections.", False),
    # ---- Student officers ------------------------------------------------------------------
    ("class-rep", "Class Representative", "Class Rep", "student", "student", "class", 20, "megaphone", "gold",
     [A + c for c in ("requests_verify", "requests_class")], W_STUDENT,
     "Verifies classmates' requests and raises formal requests for the class.", False),
    ("assistant-class-rep", "Assistant Class Representative", "Asst. Class Rep", "student", "student", "class", 15, "megaphone", "gold",
     [A + "requests_verify"], W_STUDENT, "Supports the class rep and endorses class requests.", False),
    ("class-tutor", "Class Tutor (Academic Committee)", "Tutor", "student", "student", "class", 12, "book-marked", "volt",
     [A + "academics_materials"], W_STUDENT, "Runs tutorials and uploads tutorial materials for approval.", False),
    ("eesa-president", "EESA President", "EESA President", "association", "student", "department", 18, "flag", "gold",
     [A + "association_manage"], W_STUDENT, "Leads the Electrical Engineering Students' Association.", False),
    ("ieee-chair", "IEEE Student Branch Chair", "IEEE Chair", "association", "student", "department", 14, "radio-tower", "volt",
     [], W_STUDENT, "Leads the IEEE student branch.", False),
    # ---- Alumni (round 7) ------------------------------------------------------------------------
    ("alumni-mentor", "Alumni Mentor", "Mentor", "support", "alumni", "department", 10, "handshake", "gold",
     [], W_STUDENT, "A graduate who mentors current students (careers and final-year projects).", False),
    # ---- Templates (copy to create a new office on the fly) -------------------------------------
    ("template-coordinator", "Coordinator (template)", "Coordinator", "coordination", "lecturer", "department", 40, "compass", "volt",
     [A + c for c in ("directory_view", "memo_send")], W_COORD, "Starting point for any new coordinator role.", True),
    ("template-committee", "Committee member (template)", "Committee", "committee", "any", "committee", 30, "users", "green",
     [A + "memo_send"], W_COORD, "Starting point for a new committee.", True),
    ("template-student-officer", "Student officer (template)", "Student officer", "student", "student", "class", 12, "star", "gold",
     [], W_STUDENT, "Starting point for a new student office.", True),
    ("template-support", "Support officer (template)", "Support officer", "support", "staff", "department", 25, "life-buoy", "slate",
     [A + "memo_send"], W_SUPPORT, "Starting point for a new support role.", True),
]


# ---------------------------------------------------------------------------
# Round 7 (A1/F6): who may hold each shipped office (master plan section 4).
# code -> (allowed profile kinds, student must be of the office's level)
# Editable per office afterwards (Offices -> edit -> Who may hold it).
# ---------------------------------------------------------------------------
L, S, ST, AL = "lecturer", "staff", "student", "alumni"
ELIGIBILITY = {
    "hod": ([L], False), "deputy-hod": ([L], False),
    "exam-officer": ([L], False), "registration-officer": ([L], False),
    "course-allocation-officer": ([L], False), "timetable-officer": ([L], False),
    "level-coordinator": ([L], False), "pg-coordinator": ([L], False), "siwes-coordinator": ([L], False),
    "fyp-coordinator": ([L], False), "seminar-coordinator": ([L], False), "quality-assurance": ([L], False),
    "accreditation-coordinator": ([L], False), "industrial-liaison": ([L], False),
    "admissions-officer": ([L, S], False), "staff-adviser-eesa": ([L], False),
    "secretary": ([S], False), "lab-officer": ([S], False),
    "counsellor": ([L, S], False), "webmaster": ([L, S], False), "elibrary-officer": ([L, S], False),
    "exams-committee": ([L], False), "academic-committee": ([L], False), "research-committee": ([L], False),
    "welfare-committee": ([L, S], False), "electoral-committee": ([ST], False),
    "class-rep": ([ST], True), "assistant-class-rep": ([ST], True), "class-tutor": ([ST, L], False),
    "eesa-president": ([ST], False), "ieee-chair": ([ST], False),
    "alumni-mentor": ([AL], False),
    "template-coordinator": ([L], False), "template-committee": ([L, S], False),
    "template-student-officer": ([ST], False), "template-support": ([S], False),
}

# Round 7 (F5, A3, A14): capabilities added to shipped offices (added, never removed, by migrations/seed_access).
EXTRA_OFFICE_PERMS = {
    "hod": [A + "grants_manage", A + "access_log_view", A + "classes_view", A + "class_broadcast", A + "student_contacts_view",
            A + "labs_manage", A + "labs_book", A + "staff_records_approve", A + "staff_contacts_view"],
    "lab-officer": [A + "labs_manage", A + "labs_repair", A + "labs_book"],
    "secretary": [A + "staff_records_manage"],
    "siwes-coordinator": [A + "siwes_bank_view"],
    "deputy-hod": [A + "classes_view", A + "class_broadcast"],
    "exam-officer": [A + "classes_view", A + "student_contacts_view"],
    "registration-officer": [A + "classes_view", A + "student_contacts_view"],
    "course-allocation-officer": [A + "classes_view", A + "class_broadcast"],
    "level-coordinator": [A + "classes_view", A + "class_broadcast", A + "student_contacts_view"],
}

# Round 7 (A4): delegation rules shipped with EE Hub (editable under People and access -> Delegation).
# grantor office, offices, office categories, except, permissions, any held permission?, scope rule, max days, note
DELEGATIONS = [
    ("hod", [], ["leadership", "academic", "coordination", "committee", "support", "student", "association", "custom"],
     ["hod"], [], True, "any", 365,
     "The HOD appoints to every department office except Head of Department (the super admin's), "
     "and may grant any permission the HOD holds."),
    ("deputy-hod", ["class-rep", "assistant-class-rep", "class-tutor"], ["committee"], [], [], False, "any", 180,
     "The Deputy HOD appoints class officers, tutors and committee members."),
    ("level-coordinator", ["class-rep", "assistant-class-rep", "class-tutor"], [], [], [], False, "same_level", 180,
     "A level coordinator appoints the class rep, assistant rep and tutors of their own level."),
    ("class-rep", ["class-tutor"], [], [], [], False, "same_level", 180,
     "A class rep makes tutors for their own level (classmates, or students from other levels who apply)."),
    ("assistant-class-rep", ["class-tutor"], [], [], [], False, "same_level", 180,
     "The assistant class rep can act on tutors when the rep is away."),
    ("eesa-president", [], ["association"], ["eesa-president", "staff-adviser-eesa"], [A + "association_manage"], False,
     "any", 365, "The EESA President fills appointed EESA posts and may share EESA page management."),
]
