# Sample meeting

A spoken 1 min 50 s meeting ("Beta launch readiness review") with three speakers: Priya, Daniel and Karen. It has a decision, six action items, a risk and an open question, so every feature has something to show.

| File | Use it for |
|---|---|
| `beta-launch-review.m4a` | **Fireflies.ai**: Uploads → Browse Files. It transcribes the audio itself. **This app**: drop it in the same way: it is transcribed with Whisper (needs the Groq key in `backend/.env`). Or pair it with the `.vtt` below to get the speaker names. |
| `beta-launch-review.vtt` | **This app**: the transcript, with exact timings and speaker names that line up with the audio. |
| `beta-launch-review.txt` | Same transcript as plain `[hh:mm:ss] Name: text` lines (also accepted by this app, or paste it into "Paste text"). |

Uploading only the `.m4a` to this app works and gives real timings, but every line is labelled "Speaker". Add the `.vtt` as well to keep Priya, Daniel and Karen.

The audio is synthetic (macOS text-to-speech), generated for testing.
