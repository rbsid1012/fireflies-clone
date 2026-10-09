import pytest

from app.schemas.transcript import MatchSpan
from app.services.search_service import CLOSE, OPEN, build_fts_query, offsets_from_marked, split_marked


# ---------------------------------------------------------------- query building

@pytest.mark.parametrize(
    "raw, expected",
    [
        ("kafka", '"kafka"*'),
        ("rate limiter", '"rate" "limiter"*'),
        ('"fail open" redis', '"fail open" "redis"*'),
        ('redis "fail open"', '"redis" "fail open"'),
        ("AND OR NOT NEAR", '"AND" "OR" "NOT" "NEAR"*'),  # operators become plain words
        ("c++ -foo (bar)", '"c" "foo" "bar"*'),
        ('unbalanced "quote', '"unbalanced" "quote"*'),
    ],
)
def test_build_fts_query(raw, expected):
    assert build_fts_query(raw) == expected


@pytest.mark.parametrize("raw", ["", "   ", "!!!", '""', "()-*"])
def test_unsearchable_input_returns_none(raw):
    assert build_fts_query(raw) is None


def test_term_count_is_capped():
    assert build_fts_query(" ".join(f"w{i}" for i in range(50))).count('"w') == 12


def test_split_marked_and_offsets_roundtrip():
    marked = f"we are {OPEN}deploying{CLOSE} the {OPEN}service{CLOSE} now"
    parts = split_marked(marked)
    assert [(p.text, p.match) for p in parts] == [
        ("we are ", False), ("deploying", True), (" the ", False), ("service", True), (" now", False),
    ]
    text, spans = offsets_from_marked(marked)
    assert text == "we are deploying the service now"
    assert [text[s.start:s.end] for s in spans] == ["deploying", "service"]
    assert spans[0] == MatchSpan(start=7, end=16)


def test_snippet_without_marks_is_one_plain_part():
    assert [(p.text, p.match) for p in split_marked("plain")] == [("plain", False)]


# ---------------------------------------------------------------- global search

def test_global_search_finds_ranks_and_highlights(seeded):
    res = seeded.get("/api/search?q=kafka").json()
    assert res["total"] >= 2 and res["query"] == "kafka"
    top = res["hits"][0]
    assert top["meeting_title"] == "Senior Backend Engineer Interview - Ravi Shankar"
    assert top["speaker_name"] and top["start_ms"] >= 0 and top["segment_id"] and top["meeting_started_at"].endswith("Z")
    matched = [p["text"] for p in top["snippet"] if p["match"]]
    assert matched and all(m.lower() == "kafka" for m in matched)
    assert "".join(p["text"] for p in top["snippet"])  # snippet text is non-empty


def test_global_search_stems_and_prefix_matches(seeded):
    assert seeded.get("/api/search?q=deploy").json()["total"] == seeded.get("/api/search?q=deployed").json()["total"]
    assert seeded.get("/api/search?q=kafk").json()["total"] >= 2  # prefix on the last word
    assert seeded.get("/api/search?q=KAFKA").json()["total"] == seeded.get("/api/search?q=kafka").json()["total"]


def test_global_search_phrase_and_multiple_terms(seeded):
    phrase = seeded.get("/api/search", params={"q": '"fail open"'}).json()
    assert phrase["total"] == 1 and phrase["hits"][0]["meeting_title"].startswith("Senior Backend")
    assert seeded.get("/api/search?q=staging+credentials").json()["total"] >= 1
    assert seeded.get("/api/search?q=kafka+zebra").json()["total"] == 0  # implicit AND


def test_global_search_is_paginated_without_overlap(seeded):
    full = seeded.get("/api/search?q=customer&limit=50").json()
    assert full["total"] > 4
    seen = []
    for page in (1, 2, 3):
        res = seeded.get(f"/api/search?q=customer&limit=3&page={page}").json()
        assert res["total"] == full["total"] and len(res["hits"]) <= 3
        seen += [h["segment_id"] for h in res["hits"]]
    assert len(seen) == len(set(seen))
    assert seen == [h["segment_id"] for h in full["hits"]][: len(seen)]  # same ranking across pages


def test_global_search_validation_and_hostile_input(seeded):
    assert seeded.get("/api/search").status_code == 422
    assert seeded.get("/api/search?q=").status_code == 422
    assert seeded.get("/api/search?q=x&limit=51").status_code == 422
    for q in ['"', "AND", "NEAR(", "*", "-", "a OR", "'; DROP TABLE x;--", "\x02"]:
        res = seeded.get("/api/search", params={"q": q})
        assert res.status_code == 200, q
    assert seeded.get("/api/search?q=!!!").json() == {"query": "!!!", "total": 0, "page": 1, "limit": 20, "hits": []}


def test_global_search_empty_database(client):
    assert client.get("/api/search?q=anything").json()["total"] == 0


# ---------------------------------------------------------------- search within a meeting

def _interview_id(c):
    return c.get("/api/meetings?q=interview").json()["items"][0]["id"]


def test_transcript_search_returns_segment_ids_and_exact_offsets(seeded):
    mid = _interview_id(seeded)
    res = seeded.get(f"/api/meetings/{mid}/transcript/search?q=kafka").json()
    assert res["total_matches"] == sum(len(s["matches"]) for s in res["segments"]) >= 2
    texts = {s["id"]: s["text"] for s in seeded.get(f"/api/meetings/{mid}/transcript").json()["segments"]}
    for seg in res["segments"]:
        for span in seg["matches"]:
            assert texts[seg["segment_id"]][span["start"]:span["end"]].lower() == "kafka"
    assert [s["seq"] for s in res["segments"]] == sorted(s["seq"] for s in res["segments"])


def test_transcript_search_offsets_cover_the_stemmed_word(seeded):
    mid = _interview_id(seeded)
    res = seeded.get(f"/api/meetings/{mid}/transcript/search?q=fail").json()
    texts = {s["id"]: s["text"] for s in seeded.get(f"/api/meetings/{mid}/transcript").json()["segments"]}
    found = {texts[s["segment_id"]][m["start"]:m["end"]].lower() for s in res["segments"] for m in s["matches"]}
    assert "fail" in found


def test_transcript_search_is_scoped_to_one_meeting(seeded):
    standup = seeded.get("/api/meetings?q=standup").json()["items"][0]["id"]
    assert seeded.get(f"/api/meetings/{standup}/transcript/search?q=kafka").json()["total_matches"] == 0
    assert seeded.get(f"/api/meetings/{standup}/transcript/search?q=freeze").json()["total_matches"] >= 2


def test_transcript_search_edge_cases(seeded):
    mid = _interview_id(seeded)
    assert seeded.get(f"/api/meetings/{mid}/transcript/search?q=!!!").json()["segments"] == []
    assert seeded.get(f"/api/meetings/{mid}/transcript/search").status_code == 422
    assert seeded.get("/api/meetings/999/transcript/search?q=x").status_code == 404


# ---------------------------------------------------------------- transcript endpoint

def test_transcript_is_ordered_with_speaker_info(seeded):
    mid = _interview_id(seeded)
    t = seeded.get(f"/api/meetings/{mid}/transcript").json()
    segs = t["segments"]
    assert t["meeting_id"] == mid and len(segs) == 44 and t["duration_ms"] > segs[-1]["end_ms"]
    assert [s["seq"] for s in segs] == list(range(44))
    assert all(a["end_ms"] <= b["start_ms"] for a, b in zip(segs, segs[1:]))
    assert all(isinstance(s["start_ms"], int) and isinstance(s["end_ms"], int) for s in segs)
    assert segs[0]["speaker_name"] == "Alex Morgan" and segs[0]["speaker_label"] == "Alex" and segs[0]["color_index"] == 0
    assert {s["color_index"] for s in segs} == {0, 1, 2}
