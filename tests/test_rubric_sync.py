"""The homepage rubric must describe the rules the scorer actually applies.

`src/lib/criteria.ts` exists so the marketing page can render the rubric without
a network call. This test parses that file and fails if its ids, labels or point
values drift from `api/_criteria.py`, so the site can never advertise a rule the
scorer does not apply.
"""

import os
import re

from _criteria import CRITERIA, MAX_SCORE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUBRIC_TS = os.path.join(ROOT, "src", "lib", "criteria.ts")

_ENTRY = re.compile(
    r"id:\s*\"(?P<id>[^\"]+)\"\s*,\s*"
    r"label:\s*\"(?P<label>[^\"]+)\"\s*,\s*"
    r"points:\s*(?P<points>\d+)\s*,\s*"
    r"description:\s*\"(?P<description>[^\"]*)\"",
    re.DOTALL,
)


def parse_typescript_rubric():
    with open(RUBRIC_TS, encoding="utf-8") as handle:
        source = handle.read()
    return [
        {
            "id": m.group("id"),
            "label": m.group("label"),
            "points": int(m.group("points")),
            "description": m.group("description"),
        }
        for m in _ENTRY.finditer(source)
    ]


def test_rubric_file_exists():
    assert os.path.isfile(RUBRIC_TS), "src/lib/criteria.ts is missing"


def test_rubric_matches_the_python_criteria_exactly():
    parsed = [
        {"id": e["id"], "label": e["label"], "points": e["points"]}
        for e in parse_typescript_rubric()
    ]
    expected = [{"id": c.id, "label": c.label, "points": c.points} for c in CRITERIA]
    assert parsed == expected, (
        "src/lib/criteria.ts is out of sync with api/_criteria.py.\n"
        "TypeScript: {}\nPython:     {}".format(parsed, expected)
    )


def test_rubric_totals_match():
    assert sum(entry["points"] for entry in parse_typescript_rubric()) == MAX_SCORE == 100


def test_every_rubric_entry_has_a_description():
    entries = parse_typescript_rubric()
    assert len(entries) == len(CRITERIA)
    for entry in entries:
        assert entry["description"].strip(), "{} has no description".format(entry["id"])
