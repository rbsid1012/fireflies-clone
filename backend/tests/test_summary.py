import json
from datetime import date, datetime, timezone

import pytest

from app.models import SummarySource
from app.services.llm_client import LLMError
from app.services.summary_dates import parse_due_date
from app.services.summary_heuristic import summarize_heuristic
from app.services.summary_llm import summarize_llm
from app.services.summary_service import generate_summary
from app.services.summary_types import SegmentInfo
from app.services.text_stats import tokenize, top_terms
from tests.fakes import FakeLLM

MONDAY = datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc)


def seg(seq, start_s, text, pid=1, speaker="Alice", end_s=None):
    return SegmentInfo(seq, start_s * 1000, (end_s or start_s + 4) * 1000, text, 100 + seq, pid, speaker)


# ---------------------------------------------------------------- due dates

@pytest.mark.parametrize(
    "phrase, expected",
    [
        ("send it by Friday", date(2026, 10, 9)),
        ("done before next Monday", date(2026, 10, 12)),  # never "today"
        ("let's do it on Tuesday", date(2026, 10, 6)),
        ("I'll do it tomorrow", date(2026, 10, 6)),
        ("by end of the week", date(2026, 10, 9)),
        ("by EOD", date(2026, 10, 5)),
        ("by the end of month", date(2026, 10, 31)),
        ("sometime next week", date(2026, 10, 12)),
        ("no date mentioned here", None),
    ],
)
def test_parse_due_date(phrase, expected):
    assert parse_due_date(phrase, MONDAY.date()) == expected


# ---------------------------------------------------------------- tokenizing / tf-idf

def test_tokenize_drops_stopwords_and_short_words():
    assert tokenize("The team's deployment is on Friday, okay?") == ["team", "deployment", "friday"]


def test_top_terms_prefers_distinctive_words_and_is_deterministic():
    docs = [tokenize("kafka kafka partitions common common"), tokenize("redis redis limiter common common"), tokenize("common common")]
    assert top_terms(docs, docs[0], k=2) == ["kafka", "partitions"]
    assert top_terms(docs, k=3) == top_terms(docs, k=3)
    assert "common" not in top_terms(docs, k=2)


# ---------------------------------------------------------------- heuristic summarizer

def _meeting():
    segs = []
    t = 0
    topics = ["kafka partitions consumer offsets replay", "redis limiter bucket tokens", "migration index locked writes"]
    for window, topic in enumerate(topics):
        for i in range(4):
            segs.append(seg(len(segs), window * 120 + i * 20, f"We spent a while discussing {topic} in detail today.", speaker="Alice" if i % 2 else "Bob", pid=1 + i % 2))
    return segs


def test_chapters_are_ordered_start_at_zero_ish_and_titled_by_topic():
    d = summarize_heuristic(_meeting(), MONDAY)
    starts = [c.start_ms for c in d.chapters]
    assert starts == sorted(starts) and len(set(starts)) == len(starts)
    assert starts[0] == 0
    assert len(d.chapters) >= 3
    titles = " ".join(c.title.lower() for c in d.chapters)
    assert "kafka" in titles and "redis" in titles
    assert d.generated_by == SummarySource.heuristic


def test_overview_uses_sentences_from_the_transcript_and_keywords_exclude_speakers():
    d = summarize_heuristic(_meeting(), MONDAY)
    assert d.overview and "discussing" in d.overview
    assert "alice" not in d.keywords and "bob" not in d.keywords
    assert 1 <= len(d.keywords) <= 8


def test_action_items_detect_commitments_requests_and_deadlines():
    segs = [
        seg(0, 0, "Thanks for joining everyone.", pid=1, speaker="Alice"),
        seg(1, 5, "I'll send the contract by Friday. Also the weather is nice.", pid=1, speaker="Alice"),
        seg(2, 12, "Bob, can you review the budget numbers? We need to finalize the plan by tomorrow.", pid=1, speaker="Alice"),
        seg(3, 20, "Sure, happy to look at those.", pid=2, speaker="Bob"),
        seg(4, 26, "Action item: update the roadmap document.", pid=2, speaker="Bob"),
        seg(5, 30, "Can you tell us about your background?", pid=1, speaker="Alice"),
        seg(6, 34, "Do we need to change the schema?", pid=2, speaker="Bob"),
        seg(7, 40, "Ok.", pid=2, speaker="Bob"),
    ]
    items = {i.text: i for i in summarize_heuristic(segs, MONDAY).action_items}
    contract = items["I'll send the contract by Friday."]
    assert contract.assignee_participant_id == 1 and contract.due_date == date(2026, 10, 9)
    assert contract.segment_id == 101
    review = items["Bob, can you review the budget numbers?"]
    assert review.assignee_participant_id == 2  # the next speaker is the one being asked
    plan = items["We need to finalize the plan by tomorrow."]
    assert plan.due_date == date(2026, 10, 6) and plan.assignee_participant_id is None
    assert "Action item: update the roadmap document." in items
    assert not any("tell us" in t or "Do we need" in t or t == "Ok." for t in items)  # questions/pleasantries ignored


def test_action_items_are_deduplicated_and_capped():
    segs = [seg(i, i * 5, "I'll update the status page.") for i in range(30)]
    assert len(summarize_heuristic(segs, MONDAY).action_items) == 1
    many = [seg(i, i * 5, f"I'll handle task number {i} for the release.") for i in range(30)]
    assert len(summarize_heuristic(many, MONDAY).action_items) == 10


def test_heuristic_handles_degenerate_input():
    assert summarize_heuristic([], MONDAY).overview == ""
    one = summarize_heuristic([seg(0, 0, "Hello.")], MONDAY)
    assert len(one.chapters) == 1 and one.chapters[0].start_ms == 0
    assert summarize_heuristic([seg(0, 0, "ok yeah sure right")], MONDAY).keywords == []


def test_long_meeting_gets_a_bounded_number_of_chapters():
    segs = [seg(i, i * 30, f"Topic {i // 20} discussion point number {i} about subject{i // 20}.", end_s=i * 30 + 25) for i in range(240)]
    d = summarize_heuristic(segs, MONDAY)  # two hours
    assert 6 <= len(d.chapters) <= 20


# ---------------------------------------------------------------- LLM summarizer

LLM_JSON = {
    "overview": "The team agreed to ship Friday.",
    "keywords": ["shipping", "friday", 7, ""],
    "chapters": [
        {"title": "Wrap up", "start_seq": 2, "summary": "closing"},
        {"title": "Kickoff", "start_seq": 0, "summary": "opening"},
        {"title": "Bad seq", "start_seq": 99},
    ],
    "action_items": [
        {"text": "Send the report", "seq": 1, "assignee": "bob", "due": "2026-10-09"},
        {"text": "Unknown person", "seq": 0, "assignee": "Zed", "due": "garbage"},
        {"text": "   "},
        "not an object",
    ],
}
SEGS = [seg(0, 0, "Hi all.", 1, "Alice"), seg(1, 5, "I'll send the report.", 2, "Bob"), seg(2, 10, "Thanks.", 1, "Alice")]


def test_llm_summary_is_parsed_validated_and_mapped_to_ids():
    fake = FakeLLM("```json\n" + json.dumps(LLM_JSON) + "\n```")
    d = summarize_llm(fake, SEGS, MONDAY)
    assert d.generated_by == SummarySource.llm and d.overview == "The team agreed to ship Friday."
    assert d.keywords == ["shipping", "friday"]
    assert [(c.title, c.start_ms) for c in d.chapters] == [("Kickoff", 0), ("Wrap up", 10_000)]  # sorted, bad seq dropped
    send, unknown = d.action_items
    assert (send.assignee_participant_id, send.segment_id, send.due_date) == (2, 101, date(2026, 10, 9))
    assert unknown.assignee_participant_id is None and unknown.due_date is None
    system, user = fake.calls[0]
    assert "[1] Bob: I'll send the report." in user and "2026-10-05" in user


@pytest.mark.parametrize("reply", ["no json at all", "{broken", "[1, 2]", json.dumps({"keywords": []}), json.dumps({"overview": "  "})])
def test_llm_bad_replies_raise_llm_error(reply):
    with pytest.raises(LLMError):
        summarize_llm(FakeLLM(reply), SEGS, MONDAY)


def test_llm_refuses_transcripts_that_are_too_long():
    huge = [seg(0, 0, "x" * 500_000)]
    with pytest.raises(LLMError, match="too long"):
        summarize_llm(FakeLLM("{}"), huge, MONDAY)


def test_generate_summary_uses_llm_when_available():
    d = generate_summary(SEGS, MONDAY, FakeLLM(json.dumps(LLM_JSON)))
    assert d.generated_by == SummarySource.llm


def test_generate_summary_falls_back_to_heuristic_on_any_llm_failure():
    for llm in (FakeLLM(error="rate limited"), FakeLLM("garbage")):
        assert generate_summary(SEGS, MONDAY, llm).generated_by == SummarySource.heuristic
    assert generate_summary(SEGS, MONDAY, None).generated_by == SummarySource.heuristic


def test_get_llm_client_is_none_without_a_key(monkeypatch):
    from app.config import settings
    from app.services.llm_client import get_llm_client

    monkeypatch.setattr(settings, "llm_api_key", None)
    assert get_llm_client() is None
    monkeypatch.setattr(settings, "llm_api_key", "sk-test")
    monkeypatch.setattr(settings, "llm_base_url", "https://api.example.test/v1")
    monkeypatch.setattr(settings, "llm_model", "some-model")
    client = get_llm_client()
    assert client is not None and client.model == "some-model"


def test_the_language_preference_reaches_the_summary_prompt():
    fake = FakeLLM('{"overview": "ok", "keywords": [], "chapters": [], "action_items": []}')
    summarize_llm(fake, SEGS, MONDAY, None, "fr")
    assert "in French" in fake.calls[0][0]
    english = FakeLLM('{"overview": "ok", "keywords": [], "chapters": [], "action_items": []}')
    summarize_llm(english, SEGS, MONDAY, None, "en")
    assert "Write the summary" not in english.calls[0][0]
