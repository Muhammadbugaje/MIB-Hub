# Freshers School Life — trailer voiceover

The trailer has music only. Record these lines yourself and save the recording as
`docs/trailer/voiceover.wav` (16-bit WAV, starting at 0:00 of the trailer). Running the
build again mixes it in and lowers the music under your voice.

Voice: warm, confident, unhurried. Like a senior student showing a fresher round on the
first day. Smile on the first line; let the last line land and then stop.

| Time | On screen | Line | Tone |
|---|---|---|---|
| 0:01 | Main Gate at dawn | "Every legend on this campus started the same way." | Low, calm, a little proud |
| 0:05 | Sprint down the boulevard | "As a fresher." | Short. Small smile |
| 0:09 | Fountain, FSLG letters | "One school. A thousand stories. Which one is yours?" | Open, inviting |
| 0:16 | Fight, bike, okada, car | "Thirty-six missions. Ride it. Drive it." | Picks up pace with the beat |
| 0:25 | Plane takes off | "Fly it." | One beat of space before it |
| 0:32 | Security chase, friends | "Dodge security. Bring your guys." | Playful, cheeky |
| 0:40 | Sunset at the lake, night lights | "And when the sun goes down, the music changes." | Slower, softer |
| 0:51 | Logo | "Freshers School Life. Welcome to school." | Firm. Full stop |

About 45 words. Leave 0:46–0:50 (the build-up into the logo) free of speech.

To rebuild after recording:

```
sh docs/trailer/pipeline/capture.sh        # only if you want fresh footage (about 12 minutes)
<python with numpy, pillow, imageio-ffmpeg> docs/trailer/pipeline/build.py
```
