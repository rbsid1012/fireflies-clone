"""Synthesize transcript timings for text that has none (seed data, plain .txt uploads)."""

WORDS_PER_MINUTE = 150
MS_PER_WORD = 60_000 // WORDS_PER_MINUTE  # 400
LEAD_IN_MS = 1_000
GAP_MS = 600
MIN_SEGMENT_MS = 1_500
TAIL_MS = 2_000


def estimate_timings(texts: list[str]) -> list[tuple[int, int]]:
    """Return (start_ms, end_ms) per text, assuming ~150 words/min and a short pause between turns."""
    out: list[tuple[int, int]] = []
    cursor = LEAD_IN_MS
    for text in texts:
        length = max(MIN_SEGMENT_MS, len(text.split()) * MS_PER_WORD)
        out.append((cursor, cursor + length))
        cursor += length + GAP_MS
    return out


def estimate_duration_ms(timings: list[tuple[int, int]]) -> int:
    return (timings[-1][1] if timings else 0) + TAIL_MS
