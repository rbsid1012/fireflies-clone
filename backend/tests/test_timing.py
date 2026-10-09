from app.services.timing import (
    GAP_MS, LEAD_IN_MS, MIN_SEGMENT_MS, MS_PER_WORD, TAIL_MS, estimate_duration_ms, estimate_timings,
)


def test_timings_are_ints_ordered_and_non_overlapping():
    timings = estimate_timings(["one two three " * 10, "short", "a b c d e f g h i j k l"])
    assert all(isinstance(v, int) for pair in timings for v in pair)
    assert timings[0][0] == LEAD_IN_MS
    for (s1, e1), (s2, _) in zip(timings, timings[1:]):
        assert s1 < e1 and e1 + GAP_MS == s2


def test_speaking_rate_is_about_150_wpm():
    (start, end), = estimate_timings(["word " * 150])
    assert end - start == 150 * MS_PER_WORD == 60_000


def test_very_short_text_gets_minimum_duration():
    (start, end), = estimate_timings(["Hi."])
    assert end - start == MIN_SEGMENT_MS


def test_duration_includes_tail_and_handles_empty():
    timings = estimate_timings(["hello there"])
    assert estimate_duration_ms(timings) == timings[-1][1] + TAIL_MS
    assert estimate_duration_ms([]) == TAIL_MS
