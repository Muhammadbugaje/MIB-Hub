"""Turn sample registration numbers into a regular expression, and back into words.

    pattern_from_samples(["U21EE1031"])               -> ^U\\d{2}EE\\d{4}$
    pattern_from_samples(["U21EE1031", "U20PR1099"])  -> ^U\\d{2}[A-Z]{2}\\d{4}$
    pattern_from_samples(["U21EE1031", "PGS/2024/0012"]) -> ^(?:U\\d{2}EE\\d{4}|PGS/\\d{4}/\\d{4})$

Rules: letter runs that are identical in every sample stay literal; runs that
differ become [A-Z]{n}. Digit runs become \\d{n} (or \\d{min,max} when the
samples differ in length). Separators (/ - . space) stay literal. Samples with
different shapes become alternatives.
"""
import re

_TOKEN = re.compile(r"[A-Za-z]+|\d+|.")


def _tokens(sample):
    out = []
    for t in _TOKEN.findall(sample.strip().upper()):
        kind = "A" if t.isalpha() else "D" if t.isdigit() else "S"
        out.append((kind, t))
    return out


def _shape(tokens):
    return tuple(k if k != "S" else f"S{t}" for k, t in tokens)


def _quant(lengths):
    lo, hi = min(lengths), max(lengths)
    return f"{{{lo}}}" if lo == hi else f"{{{lo},{hi}}}"


def _pattern_for_group(token_lists):
    parts = []
    for i in range(len(token_lists[0])):
        column = [tl[i] for tl in token_lists]
        kind = column[0][0]
        values = [t for _k, t in column]
        if kind == "S":
            parts.append(re.escape(values[0]))
        elif kind == "D":
            parts.append(r"\d" + _quant([len(v) for v in values]))
        else:  # letters
            if len(set(values)) == 1:
                parts.append(re.escape(values[0]))
            else:
                parts.append("[A-Z]" + _quant([len(v) for v in values]))
    return "".join(parts)


def pattern_from_samples(samples):
    samples = [s for s in (x.strip() for x in samples) if s]
    if not samples:
        return ""
    groups = {}
    for s in samples:
        toks = _tokens(s)
        groups.setdefault(_shape(toks), []).append(toks)
    bodies = [_pattern_for_group(g) for g in groups.values()]
    if len(bodies) == 1:
        return f"^{bodies[0]}$"
    return "^(?:" + "|".join(bodies) + ")$"


def explain(pattern):
    """Plain-English reading of a generated pattern (best effort)."""
    p = (pattern or "").strip()
    if not p:
        return ""
    p = p.strip("^$")
    if p.startswith("(?:") and p.endswith(")"):
        alts = p[3:-1].split("|")
        return " or ".join(explain(a) for a in alts)
    words = []
    for m in re.finditer(r"\\d\{(\d+)(?:,(\d+))?\}|\[A-Z\]\{(\d+)(?:,(\d+))?\}|\\(.)|([A-Za-z0-9]+)|(.)", p):
        d_lo, d_hi, a_lo, a_hi, esc, lit, other = m.groups()
        if d_lo:
            words.append(f"{d_lo}{'-' + d_hi if d_hi else ''} digits")
        elif a_lo:
            words.append(f"{a_lo}{'-' + a_hi if a_hi else ''} letters")
        elif esc:
            words.append(f'"{esc}"')
        elif lit:
            words.append(f'"{lit}"')
        elif other:
            words.append(f'"{other}"')
    return ", then ".join(words)


def example_for(pattern):
    """A synthetic example that matches a generated pattern."""
    p = (pattern or "").strip("^$")
    if p.startswith("(?:"):
        p = p[3:-1].split("|")[0]
    out = []
    for m in re.finditer(r"\\d\{(\d+)(?:,\d+)?\}|\[A-Z\]\{(\d+)(?:,\d+)?\}|\\(.)|(.)", p):
        d, a, esc, ch = m.groups()
        if d:
            out.append("1234567890"[: int(d)] if int(d) <= 10 else "1" * int(d))
        elif a:
            out.append("ABCDEFGHIJ"[: int(a)])
        else:
            out.append(esc or ch)
    return "".join(out)


def categorise(value, profile_kind=None):
    """Return the first active RegNumberCategory the value matches, or None."""
    from .models import RegNumberCategory
    qs = RegNumberCategory.objects.filter(is_active=True)
    if profile_kind:
        qs = qs.filter(profile_kind=profile_kind)
    for cat in qs.order_by("priority", "name"):
        if cat.matches(value):
            return cat
    return None
