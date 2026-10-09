# Format tests

One 54-second meeting ("Weekly order review", two speakers: Maya and Leo, with figures and dates) in every format the app accepts. Upload any of them on the Upload page. The audio is synthetic speech made for testing.

## Transcripts (upload on their own)

| File | Notes |
|---|---|
| `weekly-order-review.vtt` | WebVTT with `<v Speaker>` tags and exact timings |
| `weekly-order-review.srt` | SubRip, `Speaker: text` lines |
| `weekly-order-review.json` | `{"segments": [{speaker, start, end, text}]}` (seconds or ms) |
| `weekly-order-review.txt` | `[hh:mm:ss] Speaker: text` lines. Plain text with no times also works; times are estimated |

## Recordings

| Format | Upload with a transcript (attach) | Upload alone (auto-transcribe) |
|---|---|---|
| `.mp3` `.m4a` `.wav` `.flac` `.ogg` `.opus` `.webm` `.mp4` | Yes | Yes (needs the speech key; 25 MB limit; speakers are not told apart) |
| `.aac` `.mov` `.mkv` (also `.wma` `.avi` `.3gp` `.mpeg` `.m4v`) | Yes | No: a clear message asks you to convert or add a transcript |

Quick checks to try:

1. **vtt + any recording**: drag both files in together. The meeting gets Maya and Leo, the timings, and a working player.
2. **`.m4a` alone**: it is transcribed; lines are labelled "Speaker". Then use **Identify speakers** on the meeting page.
3. **`.mkv` alone**: you should see the "can't be transcribed automatically" message, not a crash.

Last verified on a brand-new empty database: all 4 transcript formats and all 11 recording formats upload with a transcript and stream back with HTTP Range; 8 recording formats transcribe on their own.
