import json
from datetime import datetime, timezone

from app.services.notes_format import Point, encode, parse, plain
from app.services.summary_heuristic import summarize_heuristic
from app.services.summary_llm import summarize_llm
from app.services.summary_types import SegmentInfo
from tests.fakes import FakeLLM

WHEN = datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc)


def seg(seq, start_s, text, pid=1, speaker="Alice"):
    return SegmentInfo(seq, start_s * 1000, (start_s + 4) * 1000, text, 100 + seq, pid, speaker)


def test_notes_round_trip_with_nested_details_and_moments():
    stored = encode([Point("Beta launch delayed to October 23rd", 45_000, ["Crash rate 0.4%", "Push bug unresolved"]), Point("Fix by Wednesday")])
    assert stored == "- Beta launch delayed to October 23rd {@45000}\n  - Crash rate 0.4%\n  - Push bug unresolved\n- Fix by Wednesday"
    first, second = parse(stored)
    assert (first.text, first.ms, first.subs) == ("Beta launch delayed to October 23rd", 45_000, ["Crash rate 0.4%", "Push bug unresolved"])
    assert (second.text, second.ms, second.subs) == ("Fix by Wednesday", None, [])
    assert "{@" not in plain(stored) and "Crash rate 0.4%" in plain(stored)


def test_old_prose_summaries_still_parse_as_points():
    assert [p.text for p in parse("One thing. Two things!")] == ["One thing.", "Two things!"]
    assert parse(None) == [] and encode([Point("  ")]) is None


def test_the_model_writes_points_with_details_linked_to_real_lines():
    segs = [seg(0, 0, "Welcome."), seg(1, 30, "The crash rate is 0.4 percent."), seg(2, 50, "Beta moves to October 23rd.")]
    reply = {
        "overview": "Beta slipped.", "keywords": [],
        "chapters": [
            {"title": "Status", "start_seq": 0, "points": [
                {"text": "Beta launch delayed to October 23rd", "seq": 2, "details": ["Crash rate 0.4%", 7]},
                {"text": "Bad seq keeps the point, drops the moment", "seq": 99},
                "A bare string is accepted",
            ]},
            {"title": "Old shape", "start_seq": 1, "summary": "Just a sentence."},
        ],
    }
    chapters = summarize_llm(FakeLLM(json.dumps(reply)), segs, WHEN).chapters
    points = parse(chapters[0].summary)
    assert [(p.text, p.ms, p.subs) for p in points] == [
        ("Beta launch delayed to October 23rd", 50_000, ["Crash rate 0.4%"]),
        ("Bad seq keeps the point, drops the moment", None, []),
        ("A bare string is accepted", None, []),
    ]
    assert chapters[1].summary == "Just a sentence."


def test_the_prompt_asks_for_figures_dates_and_names():
    fake = FakeLLM(json.dumps({"overview": "x", "chapters": []}))
    summarize_llm(fake, [seg(0, 0, "Hello there.")], WHEN)
    assert "numbers, percentages" in fake.calls[0][0] and "never invent one" in fake.calls[0][0]


def test_without_a_model_the_notes_prefer_lines_with_figures_and_keep_their_timestamps():
    segs = [
        seg(0, 0, "Thanks everybody for joining the call today folks."),
        seg(1, 10, "The crash rate is down to 0.4 percent across 1200 sessions."),
        seg(2, 20, "We talked a little about various things in general."),
        seg(3, 30, "Submission is due Monday October 19th for review."),
    ]
    chapter = summarize_heuristic(segs, WHEN, style="concise").chapters[0]
    points = parse(chapter.summary)
    assert [(p.ms, "0.4 percent" in p.text or "October 19th" in p.text) for p in points] == [(10_000, True), (30_000, True)]
