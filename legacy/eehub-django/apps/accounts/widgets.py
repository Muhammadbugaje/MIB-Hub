"""Round 7 (R7A, F5) dashboard widget: classes with their reps and tutors (class lists only)."""
from dashboards.widgets import Widget, register


def _class_lists(request, office=None):
    from django.db.models import Count, Q

    from .access_r7_views import _class_officers, visible_levels
    levels = list(visible_levels(request.user).annotate(
        n=Count("students", filter=Q(students__is_deleted=False, students__status="active"))).filter(n__gt=0)[:8])
    officers = _class_officers([l.pk for l in levels])
    return {"rows": [{"l": l, "n": l.n, "reps": [a.person.full_name for a in officers.get(l.pk, {}).get("reps", [])][:2],
                      "tutors": len(officers.get(l.pk, {}).get("tutors", []))} for l in levels]}


register(Widget("class_lists", "Classes, reps and tutors", "school", "access/widgets/class_lists.html", "half",
                "accounts.classes_view", "Students per class with the class rep and number of tutors; announce to a class.",
                0, _class_lists))
