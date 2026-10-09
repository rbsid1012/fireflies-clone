import pytest

from app.services.transcript_parser import TranscriptParseError, detect_format, parse_transcript


def spans(result):
    return [(s.speaker, s.start_ms, s.end_ms, s.text) for s in result.segments]


# ---------------------------------------------------------------- txt

def test_txt_bracketed_timestamps():
    r = parse_transcript("[00:00:05] Alice: Hello there.\n[00:00:10] Bob: Hi Alice.\n[01:02:03] Alice: Bye.")
    assert not r.synthesized
    assert [(s.speaker, s.start_ms) for s in r.segments] == [("Alice", 5000), ("Bob", 10000), ("Alice", 3_723_000)]
    # end is the estimated speaking time, clamped to the next start
    assert all(s.end_ms > s.start_ms for s in r.segments)
    assert r.segments[0].end_ms <= 10_000


def test_txt_mm_ss_and_parenthesised_speaker_form():
    r = parse_transcript("Alice (0:05): Hello\nBob (1:09): Hi")
    assert [(s.speaker, s.start_ms) for s in r.segments] == [("Alice", 5000), ("Bob", 69_000)]


def test_txt_leading_timestamp_without_brackets():
    r = parse_transcript("00:00:03 Alice: Hello\n00:00:09 Bob: Hi")
    assert [s.start_ms for s in r.segments] == [3000, 9000]


def test_txt_without_timestamps_synthesizes_150_wpm():
    text = "Alice: " + "word " * 150 + "\nBob: short reply"
    r = parse_transcript(text)
    assert r.synthesized
    first = r.segments[0]
    assert first.end_ms - first.start_ms == 60_000  # 150 words at 150 wpm
    assert r.segments[1].start_ms > first.end_ms


def test_txt_continuation_lines_join_previous_utterance():
    r = parse_transcript("Alice: first line\nsecond line\n\nthird line\nBob: reply")
    assert [s.text for s in r.segments] == ["first line second line third line", "reply"]


def test_txt_colon_inside_a_sentence_is_not_a_speaker():
    r = parse_transcript("Alice Smith: Intro.\nHere's the plan: ship it.\nBob: ok")
    assert [s.speaker for s in r.segments] == ["Alice Smith", "Bob"]
    assert "Here's the plan: ship it." in r.segments[0].text


def test_txt_label_lines_like_note_are_not_speakers():
    r = parse_transcript("Alice: hello\nNote: this is a footnote")
    assert len(r.segments) == 1


def test_txt_timestamp_alone_stamps_next_line():
    r = parse_transcript("[00:00:07]\nAlice: spoken at seven\n[00:00:20] Bob: later")
    assert r.segments[0].start_ms == 7000


def test_txt_mixed_missing_timestamps_are_interpolated():
    r = parse_transcript("[00:00:10] Alice: one two three\nBob: no stamp here\n[00:01:00] Alice: back")
    starts = [s.start_ms for s in r.segments]
    assert starts == sorted(starts) and starts[0] == 10_000 and starts[2] == 60_000
    assert 10_000 < starts[1] < 60_000


def test_unspoken_speaker_defaults_to_speaker_1():
    r = parse_transcript("[00:00:01] just text without a name")
    assert r.segments[0].speaker == "Speaker 1"


# ---------------------------------------------------------------- vtt / srt

VTT = """WEBVTT - demo

NOTE this is a comment

1
00:00:01.000 --> 00:00:03.500 align:start
<v Roger Bingham>We are in New York</v>

00:00:04.000 --> 00:00:06.000
Alice: second &amp; third <i>cue</i>

01:00:00.250 --> 01:00:02.000
no speaker so inherit
"""


def test_vtt_voice_tags_prefixes_entities_and_hours():
    r = parse_transcript(VTT, "talk.vtt")
    assert spans(r) == [
        ("Roger Bingham", 1000, 3500, "We are in New York"),
        ("Alice", 4000, 6000, "second & third cue"),
        ("Alice", 3_600_250, 3_602_000, "no speaker so inherit"),
    ]


def test_srt_comma_milliseconds_and_multiline_cues():
    srt = "1\n00:00:01,000 --> 00:00:04,000\nAlice: Hi\n\n2\n00:00:04,500 --> 00:00:06,000\nline one\nline two\n"
    r = parse_transcript(srt, "x.srt")
    assert spans(r) == [("Alice", 1000, 4000, "Hi"), ("Alice", 4500, 6000, "line one line two")]


def test_cues_are_sorted_by_start_time():
    r = parse_transcript("00:00:09.000 --> 00:00:10.000\nB: later\n\n00:00:01.000 --> 00:00:02.000\nA: earlier", fmt="vtt")
    assert [s.text for s in r.segments] == ["earlier", "later"]


@pytest.mark.parametrize("bad", ["WEBVTT\n\n00:00:01 --> nonsense\nhi", "WEBVTT\n\njust text no cues"])
def test_bad_cues_raise_clear_errors(bad):
    with pytest.raises(TranscriptParseError):
        parse_transcript(bad, "x.vtt")


# ---------------------------------------------------------------- json

def test_json_float_seconds():
    r = parse_transcript('[{"speaker":"A","start":0.5,"end":3.2,"text":"hi"},{"speaker":"B","start":3.5,"end":5,"text":"yo"}]')
    assert [(s.start_ms, s.end_ms) for s in r.segments] == [(500, 3200), (3500, 5000)]


def test_json_integer_seconds_detected_from_utterance_length():
    r = parse_transcript('[{"speaker":"A","start":0,"end":3,"text":"hi"},{"speaker":"B","start":4,"end":9,"text":"yo"}]')
    assert [(s.start_ms, s.end_ms) for s in r.segments] == [(0, 3000), (4000, 9000)]


def test_json_milliseconds_detected():
    r = parse_transcript('{"segments":[{"speaker":"A","start":0,"end":3000,"text":"hi"},{"speaker":"B","start":4000,"end":9000,"text":"yo"}]}')
    assert [(s.start_ms, s.end_ms) for s in r.segments] == [(0, 3000), (4000, 9000)]


def test_json_explicit_ms_keys_are_never_rescaled():
    r = parse_transcript('[{"speaker":"A","start_ms":10,"end_ms":50,"text":"hi"}]')
    assert (r.segments[0].start_ms, r.segments[0].end_ms) == (10, 50)


def test_json_timestamp_strings_and_numeric_speakers_and_alt_keys():
    r = parse_transcript('[{"speaker":2,"start":"00:01:05","end":"00:01:09","content":"hello"}]')
    s = r.segments[0]
    assert (s.speaker, s.start_ms, s.end_ms, s.text) == ("Speaker 2", 65_000, 69_000, "hello")


def test_json_without_times_is_synthesized():
    r = parse_transcript('[{"speaker":"A","text":"one"},{"speaker":"B","text":"two"}]')
    assert r.synthesized and r.segments[1].start_ms > r.segments[0].end_ms


@pytest.mark.parametrize(
    "bad, message",
    [
        ('[{"speaker":"A","start":0}]', "missing a 'text'"),
        ('["just a string"]', "not an object"),
        ('{"nothing": 1}', "non-empty list"),
        ("[]", "non-empty list"),
        ("{not json", "Invalid JSON"),
        ('[{"text":"x","start":"soon"}]', "timestamp"),
    ],
)
def test_json_errors(bad, message):
    with pytest.raises(TranscriptParseError, match=message):
        parse_transcript(bad, "t.json")


# ---------------------------------------------------------------- detection & input validation

def test_format_detection():
    assert detect_format("WEBVTT\n\n", None) == "vtt"
    assert detect_format('[{"text": "x"}]') == "json"
    assert detect_format("1\n00:00:01,000 --> 00:00:02,000\nhi") == "srt"
    assert detect_format("[00:00:01] A: hi") == "txt"  # starts with '[' but is not JSON
    assert detect_format("anything", "notes.TXT") == "txt"
    assert detect_format("anything", "captions.vtt") == "vtt"


def test_pasted_vtt_and_json_are_sniffed_without_a_filename():
    assert parse_transcript(VTT).segments[0].speaker == "Roger Bingham"
    assert parse_transcript('[{"speaker":"A","start":0,"end":2,"text":"x"}]').segments[0].speaker == "A"


@pytest.mark.parametrize("content", ["", "   \n\t "])
def test_empty_input_rejected(content):
    with pytest.raises(TranscriptParseError, match="empty"):
        parse_transcript(content)


def test_unsupported_extension_rejected():
    with pytest.raises(TranscriptParseError, match="Unsupported file type '.pdf'"):
        parse_transcript("hello", "deck.pdf")


def test_non_utf8_bytes_rejected():
    with pytest.raises(TranscriptParseError, match="UTF-8"):
        parse_transcript(b"\xff\xfe\x00bad", "x.txt")


def test_oversized_input_rejected():
    with pytest.raises(TranscriptParseError, match="too large"):
        parse_transcript(b"a" * 5_000_001, "x.txt")


def test_utf8_bom_is_stripped():
    r = parse_transcript("﻿Alice: hello".encode("utf-8"), "x.txt")
    assert r.segments[0].speaker == "Alice"


def test_control_characters_are_removed_so_fts_sentinels_stay_unambiguous():
    r = parse_transcript("Alice: he\x02llo\x03 world")
    assert r.segments[0].text == "hello world"


def test_all_timings_are_ints_and_ordered():
    r = parse_transcript("[00:00:02] A: " + "x " * 40 + "\n[00:00:03] B: y")
    for s in r.segments:
        assert isinstance(s.start_ms, int) and isinstance(s.end_ms, int) and s.end_ms > s.start_ms
    assert r.segments[0].end_ms <= r.segments[1].start_ms  # clamped to the next start
