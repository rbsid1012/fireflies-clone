"""Generate spoken recordings for the seed meetings (macOS only: uses `say` and `afconvert`).

    python -m app.seed.make_audio            # writes app/seed/media/<seed file name>.m4a

Each line is spoken by a different system voice per participant, at a rate chosen so it fits the line's seeded
time slot, and placed at its exact start time, so the transcript, the seek bar and the audio all agree. The output
is committed; running this is only needed after editing a seed transcript.
"""
import array
import subprocess
import tempfile
import wave
from pathlib import Path

from app.seed.loader import DATA_DIR, load_seed_meetings
from app.services.timing import estimate_duration_ms, estimate_timings

OUT_DIR = Path(__file__).parent / "media"
VOICES = ["Samantha", "Daniel", "Karen", "Moira", "Rishi", "Tessa"]
SAMPLE_RATE = 22_050
MIN_RATE, MAX_RATE = 120, 330


def _speak(text: str, voice: str, rate: int, path: Path) -> list[int]:
    subprocess.run(
        ["say", "-v", voice, "-r", str(rate), "--data-format=LEI16@22050", "-o", str(path), text],
        check=True, capture_output=True,
    )
    with wave.open(str(path)) as w:
        samples = array.array("h")
        samples.frombytes(w.readframes(w.getnframes()))
    return list(samples)


def _fit(text: str, voice: str, slot_ms: int, scratch: Path) -> list[int]:
    """Speak `text` so it lasts no longer than its slot: raise the rate until it fits (or the cap is hit)."""
    rate = 165
    while True:
        samples = _speak(text, voice, rate, scratch)
        ms = len(samples) * 1000 // SAMPLE_RATE
        if ms <= slot_ms or rate >= MAX_RATE:
            return samples[: slot_ms * SAMPLE_RATE // 1000]
        rate = min(MAX_RATE, max(rate + 10, int(rate * ms / slot_ms * 1.02)))


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    seed_files = sorted(DATA_DIR.glob("*.json"))
    for file, data in zip(seed_files, load_seed_meetings()):
        timings = estimate_timings([text for _, text in data.segments])
        total = estimate_duration_ms(timings) * SAMPLE_RATE // 1000
        track = array.array("h", bytes(total * 2))
        voice_of = {p.label: VOICES[i % len(VOICES)] for i, p in enumerate(data.participants)}
        with tempfile.TemporaryDirectory() as tmp:
            scratch = Path(tmp) / "line.wav"
            for (speaker, text), (start, end) in zip(data.segments, timings):
                samples = _fit(text, voice_of[speaker], end - start, scratch)
                at = start * SAMPLE_RATE // 1000
                track[at:at + len(samples)] = array.array("h", samples)
            wav = Path(tmp) / "meeting.wav"
            with wave.open(str(wav), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(SAMPLE_RATE)
                w.writeframes(track.tobytes())
            out = OUT_DIR / f"{file.stem}.m4a"
            subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "24000", str(wav), str(out)], check=True)
        print(f"{out.name}: {len(track) / SAMPLE_RATE:.0f}s, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
