# Soundtrack — four attempts, nothing shipped

Clave ships **no music files**. This document records four attempts to generate an
original two-part instrumental soundtrack ("Cuerpo" for the verse, "Montuno" for the
mambo), the verification they all failed, and the licensing homework, so a fifth attempt
does not start from nothing. Nothing was added to `packages/client/public/audio/`, and
the clients keep the synthesized rhythm cues and the "Open Llorarás in Spotify" link
instead of a house-band toggle.

| Attempt | Date       | Service                         | Generations | Best score | Outcome     |
| ------- | ---------- | ------------------------------- | ----------- | ---------- | ----------- |
| 1       | 2026-10-23 | ElevenLabs Music `music_v2_5`   | 4           | —          | not shipped |
| 2       | 2026-10-24 | Google Lyria 3.5 / Lyria 3 Clip | 7           | 4/10       | not shipped |
| 3       | 2026-10-24 | Mureka `mureka-9.5`             | 2           | 4/10       | not shipped |
| 4       | 2026-10-24 | Suno `V5_5` via APIFRAME        | 5           | 6/10       | not shipped |

All four failed the same way: the takes do not sound like a band playing. Attempt 3 adds
a **listening pack** so a human ear gets a vote, after one AI listener was caught
reporting a glitch that measurement shows is not in the file. Attempt 4 raised the best
score to 6/10, then spent a request proving that score was a lucky draw — and found a
licensing problem that rules the whole service out regardless of how it sounds.

## Attempt 1 — ElevenLabs Music (2026-10-23)

### What was generated

- **Service**: ElevenLabs Music, `POST https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128`,
  `model_id: "music_v2_5"` (the current best music model; `music_v1` is documented as
  outclassed), `force_instrumental: true`, no `composition_plan`.
- **Date**: 2026-10-23. **Plan tier**: Starter (confirmed from `GET /v1/user/subscription`,
  which reports `"tier": "starter"`).
- **Budget**: four generations, all four spent.

| Take      | Requested | Delivered                   | Integrated loudness               | Outcome  |
| --------- | --------- | --------------------------- | --------------------------------- | -------- |
| Cuerpo 1  | 150 s     | 150.0 s, 128 kbps           | −12.3 LUFS, LRA 6.1, TP −0.2 dBFS | dropped  |
| Montuno 1 | 150 s     | 150.0 s, 128 kbps           | −12.1 LUFS, LRA 2.2, TP +0.1 dBFS | dropped  |
| Cuerpo 2  | 125 s     | 124.8 s, 128 kbps           | −13.6 LUFS, LRA 5.1, TP −0.6 dBFS | dropped  |
| Montuno 2 | 125 s     | 12.6 s (truncated response) | not measured                      | unusable |

The prompts asked for an original instrumental in classic 1970s New York salsa-dura
style at a danceable tempo of about 190 BPM: piano montuno/guajeo, bass tumbao,
congas, bongó on martillo, timbales on cáscara and light horn punctuation for Cuerpo;
the campana, fuller horn mambo riffs and more drive for Montuno. Both asked for one
unbroken groove with no intro, no ending and no fade, so the take could loop. The
second round added "recorded live in one room by a real nine-piece band", "acoustic
instruments only", "never quantized", and an explicit ban on synthesizers, MIDI
patches, drum machines and string sections. All four prompts are reproduced verbatim
at the end of this document; no artist, band, album or song name appears in any of
them, which ElevenLabs' music terms require and which also keeps the output away from
imitating a specific recording.

### How each take was verified

1. `ffprobe` for container, duration, bitrate, sample rate and channels.
2. `ffmpeg -af ebur128=peak=true` for integrated loudness, loudness range and true
   peak, then a two-pass `loudnorm` (`I=-16:TP=-1.5:LRA=11`, linear) and an MP3
   re-encode at 128 kbps; the normalized files re-measured at −16.4 LUFS integrated.
3. A per-five-second RMS envelope, to catch silences, dropouts and fades that an
   integrated number hides.
4. An audio-capable model listened to the normalized MP3 (`gemini-3.1-pro-preview`,
   Gemini API `generateContent`, the MP3 sent inline as base64 `audio/mpeg`) and was
   asked for genre, instrumentation, BPM, any vocals or spoken words, audible glitches
   with timestamps, whether the take starts and ends inside the groove, and whether it
   copies any specific well-known recording.

### What the verification found

**Cuerpo 1.** The RMS envelope shows roughly 20 seconds of digital silence (−92 to
−104 dBFS) between about 0:15 and 0:35 and a second dip around 1:10–1:20. Gemini:
"does _not_ sound like authentic 1970s New York salsa dura, nor does it sound like a
real band… a very cheap, quantized MIDI backing track"; no bongó, no timbales, no
campana, no horn section and no clave instrument; 104 BPM, "rigidly and mechanically
steady"; no vocals of any kind; percussion glitches at 1:20 and 2:01, instruments
dropping out at 2:21 and an abrupt cut at 2:27; a 40-second solo-piano intro makes it
unloopable. Verdict: DROP.

**Montuno 1.** Level is even all the way through, which the envelope confirms, and it
starts inside the groove. Gemini: "sounds exactly like a 1990s MIDI file, a preset
rhythm on a consumer arranger keyboard"; a prominent campana but "a single programmed
velocity", synthetic string pads entering around 0:50, a synth brass patch at 1:31
rather than trumpets and a trombone; 96 BPM; no vocals; "a very obvious, jarring audio
stutter right at 2:00"; a final cymbal crash and decay, so the end does not loop.
Verdict: DROP.

**Cuerpo 2.** The rewritten prompt fixed the silence — the envelope is continuous,
with the first 40 seconds about 5 dB quieter than the rest — but not the character.
Gemini: still not salsa dura, "a generic 'Latin' preset… or a very basic
electronic/house track with Latin percussion layered over it"; no horns at all, no
timbales, no cáscara, no campana, no recognizable son or rumba clave, and a bass
playing straight eighth notes instead of a tumbao; 125 BPM, not the ~190 BPM asked
for; no vocals; an abrupt mid-phrase cut at 2:03 that would skip audibly on a loop.
Verdict: DROP.

**Montuno 2.** The API answered `200` with `Content-Type: audio/mpeg` but sent only
201,082 bytes — 12.6 seconds of audio for a 125-second request. A truncated response,
not a take; the generation budget was gone, so it was not retried.

Every take that could be listened to was confirmed free of vocals, hums, chanting and
spoken words, and none of them resembled a specific recording closely enough to be a
copy — the failure is that none of them is convincingly salsa dura, and three of the
four have glitches or ends that cannot loop. Shipping any of them would make the game
sound cheap, so the soundtrack was dropped rather than shipped poor.

### Licensing, for whoever tries again

Checked on 2026-10-23 against ElevenLabs' music terms
(<https://elevenlabs.io/music-terms>) and the Eleven Music capability page
(<https://elevenlabs.io/docs/capabilities/music>):

- Eleven Music is "cleared for nearly all commercial uses"; what each plan may do is
  set out in Exhibit A of the music terms.
- **Starter** (this account's tier): individual use only; "All online and offline
  commercial use permitted, except film, TV, radio, and Studio Games"; no attribution
  required; a 17-minute monthly generation limit and a 30-minute download limit.
- A "Studio Game" is defined as a publicly available game "commercialized by sale,
  advertising, or any other form of monetization, but does not include an Indie Game",
  so a free, non-monetized Clave is on the right side of that line; §4.7 gives 60 days
  to move to a plan that permits Studio Games if a game stops qualifying as indie.
- **Music Streaming Distribution is prohibited** on Starter: the tracks could ship
  inside the game, but not be published as a release on a streaming platform.
- As between the user and ElevenLabs, "you retain any and all rights in and to your
  Input and Output".
- Prompts must not contain any artist's real or stage name or any song or album title,
  and must not be used to mimic a recording artist's voice.

### Next time

Prompt-only control was the weak link: two rounds of increasingly explicit prompts
could not get horns, timbales or a tumbao into the mix, and could not hold the
requested tempo. Before spending more generations, try a `composition_plan` (sections
with explicit durations and instrumentation, which the API supports for structure) or
an audio reference, request a shorter take and loop it in the client, and listen to
every candidate on real speakers as well as through a model.

### The exact prompts

**Cuerpo, take 1 (150 s)**

```
Original instrumental salsa dura in the classic 1970s New York style: a tight nine-piece conjunto playing the verse groove of a dance tune at a danceable medium-up tempo of about 190 BPM in 4/4, locked to son clave the whole way. Acoustic piano plays a repeating two-bar montuno guajeo in the upper middle register; upright bass plays a syncopated tumbao that leans on the and-of-2 and the 4 and leaves the downbeat open; congas hold a steady tumbao with ringing open tones at the end of each bar; bongo plays martillo; timbales ride cascara on the shells with an occasional short abanico; maracas and guiro keep the eighth-note grid moving. A small horn section of two trumpets and one trombone answers the piano with short, punchy, tightly voiced stabs between phrases and then leaves space — no long melodic solos, no improvised blowing, no cadenza. Keep one key, one tempo and one unbroken groove for the whole take, at a constant energy, like a two-minute slice cut out of the middle of a hot live take. Absolutely no vocals: no singing, no coro, no choir, no chanting, no spoken words, no shouts, no vocal samples, no human voice of any kind. No intro, no count-in, no clave count, no fade-in, no build-up, no breakdown, no percussion solo, no ending, no ritardando, no final crash, no fade-out — it must start already in the groove and stop still in the groove so it can loop seamlessly. Warm vintage analog studio mix, dry room, light tape saturation, drums and percussion up front.
```

**Montuno, take 1 (150 s)**

```
Original instrumental salsa dura mambo section in the classic 1970s New York style: the same tight nine-piece conjunto, the same danceable medium-up tempo of about 190 BPM in 4/4 locked to son clave, but hotter and with more drive than the verse. The timbalero has switched off the shells onto a loud mounted campana bell pattern that rides the entire take; the conguero opens up with louder open tones and a few slaps; the bongo player is on the bongo bell. Acoustic piano drives a hard repeating montuno guajeo; upright bass pushes a strong syncopated tumbao. Over them a full horn mambo: two trumpets and one trombone play short interlocking riffs in tight harmony, repeating and answering each other and the bell, horns stacked and punchy — riffs and section writing only, no long improvised solo. Keep one key, one tempo and one unbroken driving groove for the whole take at a high constant energy, like a two-minute slice cut out of the middle of the mambo section of a hot live take. Absolutely no vocals: no singing, no coro, no choir, no chanting, no spoken words, no shouts, no vocal samples, no human voice of any kind. No intro, no count-in, no clave count, no fade-in, no build-up, no breakdown, no percussion solo, no ending, no ritardando, no final crash, no fade-out — it must start already in the groove and stop still in the groove so it can loop seamlessly. Warm vintage analog studio mix, bright punchy brass, light tape saturation, bell and percussion up front.
```

**Cuerpo, take 2 (125 s)**

```
A two-minute excerpt from the middle of one continuous take of hard, gritty 1970s New York salsa dura, played live in one room by a real nine-piece band and cut to analog tape. Acoustic instruments only, played by human beings with sabor and push-and-pull, slightly ahead of and behind the grid, never quantized: real acoustic upright piano hammering a two-bar montuno guajeo, real upright double bass walking a syncopated tumbao that leaves beat 1 open, real hand-played congas with ringing open tones and slaps, real bongo playing martillo, real timbales riding cascara on the metal shells, real maracas and guiro, and a real brass section of two trumpets and one trombone playing short punchy unison stabs between the piano phrases. Fast danceable salsa tempo, about 190 beats per minute in 4/4, locked to son clave. Every single instrument is already playing at full energy on the very first beat of the excerpt and keeps playing without a break until the very last beat: there is never one bar of silence, never a quiet passage, never a solo piano passage, never a breakdown, never a percussion solo, never an instrument dropping out, never a change of section, never a key change, never a tempo change. Mono-ish warm analog mix, drums and percussion up front, tape saturation, room sound, slightly dirty and loud. It must start in the middle of the groove and stop in the middle of the groove so it can be looped forever: no intro, no count-in, no fade-in, no build, no ending, no final chord, no cymbal crash, no fade-out. Absolutely no vocals of any kind: no singing, no coro, no chanting, no shouting, no humming, no talking, no vocal samples. No synthesizers, no MIDI-sounding patches, no electronic drums, no drum machine, no synth strings, no string section, no electric guitar, no flute, no saxophone.
```

**Montuno, take 2 (125 s)**

```
A two-minute excerpt from the middle of the mambo section of one continuous take of hard, gritty 1970s New York salsa dura, played live in one room by a real nine-piece band and cut to analog tape, hotter and louder than the verse. Acoustic instruments only, played by human beings with sabor and push-and-pull, slightly ahead of and behind the grid, never quantized: real timbales player off the shells and onto a loud hand-struck mounted campana bell that rides every beat of the excerpt, real congas opening up with loud open tones and slaps, real bongo player on the bongo bell, real acoustic upright piano driving a hard two-bar montuno guajeo, real upright double bass pushing a strong syncopated tumbao, and a real brass section of two trumpets and one trombone playing loud interlocking mambo riffs in tight harmony, repeating and answering the bell and the piano. Fast danceable salsa tempo, about 190 beats per minute in 4/4, locked to son clave. Every single instrument is already playing at full energy on the very first beat of the excerpt and keeps playing without a break until the very last beat: there is never one bar of silence, never a quiet passage, never a breakdown, never a solo, never an instrument dropping out, never a change of section, never a key change, never a tempo change. Mono-ish warm analog mix, bell and percussion up front, bright blaring brass, tape saturation, room sound, slightly dirty and loud. It must start in the middle of the groove and stop in the middle of the groove so it can be looped forever: no intro, no count-in, no fade-in, no build, no ending, no final chord, no cymbal crash, no fade-out. Absolutely no vocals of any kind: no singing, no coro, no chanting, no shouting, no humming, no talking, no vocal samples. No synthesizers, no MIDI-sounding patches, no electronic drums, no drum machine, no synth strings, no string section, no electric guitar, no flute, no saxophone.
```

## Attempt 2 — Google Lyria 3.5 and Lyria 3 Clip (2026-10-24)

Still nothing shipped. Seven generations on Google's Lyria music models were
mechanically far better than the ElevenLabs round — the requested tempo, the requested
length, one unbroken groove, no truncated responses, no mid-take silences — but not one
take sounds like a real band, and that was the whole point. Two independent listening
passes scored every candidate between 1 and 4 out of 10 against a pass bar of 7, and one
of the seven takes leaked eight seconds of spoken Spanish — with a second drawing a
disputed vocal artifact — despite an explicit instrumental-only instruction.

### The API, as it actually behaves

- **Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/interactions`
  (the Interactions API), `x-goog-api-key` header, body `{"model": …, "input": "<prompt>"}`.
  Audio comes back inline as base64 in a `model_output` step: `steps[].content[]` with
  `"type": "audio"` and `"mime_type": "audio/mpeg"`.
- **The only accepted parameters are `model`, `input` and `response_format`.** Probing
  every plausible name confirmed there is no `negative_prompt`, `duration_seconds`,
  `bpm`, `seed`, `sample_count`, `temperature`, `audio_config` or `config` — each is
  rejected with `Unknown parameter`. Tempo, length, instrumentation and structure all
  have to go in the prompt text, which is exactly the prompt-only control that sank
  attempt 1.
- `response_format: {"type": "audio"}` is documented as the way to ask Lyria 3.5 for
  WAV. It was accepted on every call and every call still returned 192 kbps MP3, so any
  loop editing and normalizing would have started from a lossy file.
- **`lyria-3-pro-preview` is not a separate model on this key.** `ListModels` advertises
  it, but asking for it returns `"model": "lyria-3.5"` through the Interactions API and
  `"modelVersion": "lyria-3.5"` through `models/lyria-3-pro-preview:generateContent`.
  Two of the seven generations were spent finding that out, so this attempt really only
  tested two models: `lyria-3.5` (about two minutes, length steered by the prompt) and
  `lyria-3-clip-preview` (a fixed 30 seconds, which the docs recommend for loops).
- `lyria-realtime-exp` (`bidiGenerateMusic`, with BPM, density and brightness controls)
  was deliberately not tried. It was held in reserve for a failure on tempo or length,
  and tempo and length are the two things these models got right; an experimental
  streaming model was not going to fix timbre.
- Prompts used the documented bracketed time ranges, one `[0:00 - 0:30] Groove: …` line
  per segment. That is what held the two-minute takes to a single continuous groove, and
  it worked: no take has a mid-take silence or a breakdown, which was attempt 1's
  biggest structural failure.
- Every call reports `"service_tier": "standard"`. Usage across the seven generations:
  2,764 input tokens and 6,802 output tokens. No monetary cost is reported by the API.

### What was generated

Four prompt strategies were tried: a long explicit negative list (banning synthesizers,
MIDI patches, drum machines, string sections), a positive-realism rewrite (describing
the 1973 one-room live date, breath before the horn stabs, hands on conga skin, the
piano's wooden action) on the theory that negations summon what they name, a 30-second
loop-oriented variant for the Clip model, and a sparse five-piece descarga with the
horns almost entirely removed, aimed squarely at the two defects the listeners kept
naming (synthetic brass and smeared high percussion).

Tempo below is the onset-autocorrelation estimate in quarter-note BPM, read as an
octave family where the strongest peak was a sub-harmonic (marked `~`). The listeners'
own estimates ran 180–212 BPM and are in the verdicts, not here.

| Take          | Model                                    | Prompt               | Delivered         | Loudness (LUFS / LRA / true peak) | Tempo | Listener A                | Listener B      |
| ------------- | ---------------------------------------- | -------------------- | ----------------- | --------------------------------- | ----- | ------------------------- | --------------- |
| cuerpo 1      | lyria-3.5                                | v1, negative list    | 120.9 s, 192 kbps | −11.4 / 2.3 / +1.1 dBFS           | 180   | 1/10 FAIL                 | 4/10 FAIL       |
| montuno 1     | lyria-3.5                                | v1, negative list    | 120.5 s, 192 kbps | −11.0 / 3.6 / +1.3 dBFS           | ~180  | 2/10 FAIL, **voice**      | voice confirmed |
| cuerpo 2      | lyria-3.5 (asked Pro)                    | v2, positive realism | 116.4 s, 192 kbps | −11.4 / 2.7 / +0.6 dBFS           | 163   | 1/10 FAIL                 | —               |
| cuerpo clip 1 | lyria-3-clip-preview                     | v2, loop variant     | 30.8 s, 194 kbps  | −11.5 / 0.9 / +1.9 dBFS           | ~184  | 2/10 FAIL                 | 4/10 FAIL       |
| cuerpo 3      | lyria-3.5                                | sparse descarga      | 119.8 s, 192 kbps | −11.8 / 5.3 / +1.3 dBFS           | 183   | 2/10 FAIL, voice disputed | 4/10 FAIL       |
| cuerpo clip 2 | lyria-3-clip-preview                     | sparse, loop variant | 30.8 s, 194 kbps  | −12.5 / 1.4 / +0.7 dBFS           | ~180  | 1/10 FAIL                 | 3/10 FAIL       |
| cuerpo 4      | lyria-3.5 (asked Pro, `generateContent`) | v2, positive realism | 122.4 s, 192 kbps | −11.4 / 2.1 / +1.9 dBFS           | ~185  | 2/10 FAIL                 | 3/10 FAIL       |

All seven are 44.1 kHz stereo. Every take overshoots 0 dBFS on decode (+0.6 to
+1.9 dBFS true peak), which a two-pass `loudnorm` to −16 LUFS / −1 dBTP would have
fixed; none of them got that far. No take ships, so no loop points were chosen, no
normalizing was run and no files were written.

### How each take was verified

1. `ffprobe` for container, duration, bitrate, sample rate and channels.
2. `ffmpeg -af ebur128=peak=true` for integrated loudness, loudness range and true peak.
3. A **per-second** RMS envelope in dBFS (attempt 1 used five-second windows, which can
   hide a short dropout), flagging any second below −60 dBFS or more than 12 dB under
   the take's median.
4. Tempo from an onset-strength envelope (spectral flux at about 86 frames per second)
   scored by autocorrelation, plus each listener's own estimate.
5. Two **independent** listening passes per take, one with `gemini-3.1-pro-preview` and
   one with `gemini-2.5-pro` (Gemini API `generateContent`, the MP3 sent inline as
   base64 `audio/mpeg`, `temperature: 0`), against a strict eleven-point rubric: real
   band or MIDI/arranger preset and what gave it away, genre, a per-instrument audible
   checklist, clave and tumbao feel, tempo, any voice at all, every glitch with a
   timestamp, whether it starts and ends inside the groove, resemblance to any specific
   known recording, a 1–10 authenticity score, and a PASS/FAIL. Both passes had to
   return PASS and a score of 7 or better. The plan was then to render any survivor's
   loop twice back to back and have both listeners judge the seam; no take got there.

Two method notes for next time. A phase-locked beat-grid test — scoring a candidate BPM
by how much more onset energy lands on its grid than between its grid points — looks
like the right way to settle tempo, but it is useless on this material: the continuous
maraca and güiro eighth-note layer means the midpoints of the true beat period are
themselves eighth notes, so the true tempo scores _worse_ than a sub-harmonic. Plain
autocorrelation of the onset envelope, read as an octave family (a strong peak at 90
BPM with the music at 180), was more honest. And the listeners' BPM estimates spread
from 180 to 212 on the same file, so treat any single estimate as a range.

### What the verification found

Objectively, these takes are sound. Every one is a continuous groove at a steady tempo,
six of the seven inside the requested 170–200 BPM salsa range (cuerpo 2 measures 163,
the one real tempo miss), with no digital silence, no dropout and no mid-take level
collapse — the loudness range of 0.9 to 5.3 LU says the energy barely
moves, which is what was asked for. The Clip model's 30-second takes are near-perfect
loop material on paper: dead-even envelopes, no intro, no outro, nothing to trim.

Subjectively, they all fail the same way, and the two listeners — different model
families, same conclusion — converged on it independently. `gemini-2.5-pro` on cuerpo 1:

> This is, without a shadow of a doubt, MIDI and high-quality sample libraries. It is
> 100% programmed. … It's perfectly, inhumanly quantized to the grid. There is zero
> push-and-pull … The velocity on almost every instrument is static. … There is no room
> tone, no bleed between microphones, no chair squeaks, no hand-noise on the congas, no
> pedal noise from the piano.

and scored it 4/10: "technically correct but soulless", "the composer clearly did their
homework on how to structure a salsa tune" but "the clean digital production … is the
antithesis of the 1970s Fania sound". `gemini-3.1-pro-preview` was harsher on the same
file, 1/10:

> The giveaway is the horrific "smearing" of transients—real acoustic percussion has
> sharp, distinct attacks, but here the congas and cowbell sound like they are
> underwater. There is zero breath noise or natural phrasing in the horns; they sound
> like cheap synth patches that occasionally melt into digital gargling.

The positive-realism rewrite made it worse in one specific way: asking for tape hiss and
room sound produced a pasted-on noise loop rather than a room. On cuerpo 2,
`gemini-3.1-pro-preview` named "the incredibly obvious, looping fake vinyl crackle
effect pasted over the top to simulate 'room tone' or vintage warmth" and scored it
1/10. Later prompts asked for no vinyl crackle and no tape noise at all.

The sparse-texture hypothesis — strip the horns and the dense high percussion, the two
things the listeners kept calling synthetic — did not work either. On the sparse
five-piece descarga, `gemini-2.5-pro` still heard "high-quality sample libraries and
MIDI programming, not a real band in a room … Every single percussion hit lands
perfectly on the grid", 4/10; on the sparse 30-second clip it went to 3/10, now also
penalizing the missing instruments: "It has the 'recipe' but none of the 'cooking.'"
Removing the offending instruments did not make what remained sound human.

**Two takes leaked a voice.** Montuno 1 carries a man speaking or shouting in Spanish
from about 1:44 to 1:52, which both listeners confirmed on an isolated 21-second
segment (they transcribed it differently — overlapping speech — but neither hesitated
about its presence, and `gemini-3.1-pro-preview` thought the vocal's room tone
"completely mismatches the instrumental, sounding pasted on top", possibly lifted from a
period recording). That is a hard disqualifier on its own. Cuerpo 3 drew a "ghostly
vocal artifact/sigh" at 1:18 from `gemini-3.1-pro-preview` while `gemini-2.5-pro` heard
no voice at all, so that one stands as disputed; it fails on realism from both regardless.

No take resembled a specific known recording — every similarity answer came back
"stylistic only" — so nothing here imitates Llorarás or any particular arrangement. The
failure is realism, not provenance.

Three of the ten budgeted generations were left unspent on purpose. Seven takes across
both reachable models, four prompt strategies and two lengths all landed in the same
place with the same named defect, and the best score of 4/10 is three points short of
the bar. More re-rolls of the same lever would have been buying lottery tickets.

### Licensing, for whoever tries again

Checked on 2026-10-24:

- **Watermarking.** "All generated audio includes a SynthID audio watermark for
  identification", described as imperceptible
  (<https://ai.google.dev/gemini-api/docs/music-generation>). Anything shipped from
  Lyria would carry it. Note that the Generative AI Prohibited Use Policy forbids
  "Circumvention of abuse protections or safety filters" (2.3), so stripping the
  watermark is out.
- **Ownership.** The Gemini API Additional Terms of Service (<https://ai.google.dev/gemini-api/terms>),
  under _Use of Generated Content_: "Google won't claim ownership over that content",
  while reserving the right to generate the same or similar content for others. The same
  section makes you responsible for your use of generated content and notes that
  applicable law "may require the provision of attribution" to users. The terms do not
  separately address commercial use of output.
- **Free vs paid tier matters.** Under _Unpaid Services_, Google uses submitted content
  and responses "to provide, improve, and develop Google products and services", and
  "human reviewers may read, annotate, and process your API input and output". Under
  _Paid Services_, "Google doesn't use your prompts" or responses to improve its
  products. Prompts here contain nothing sensitive, but a third attempt should know
  which tier the key is on.
- **Prohibited uses** (<https://policies.google.com/terms/generative-ai/use-policy>) that
  bear on generated music: content that "Violates the rights of others, including
  privacy and intellectual property rights" (1.6); "Impersonating an individual (living
  or dead) without explicit disclosure, in order to deceive" (4.2); and
  "Misrepresenting the provenance of generated content by claiming it was created solely
  by a human, in order to deceive" (4.5). The last one is why this file exists.
- **Safety filters.** The music docs state that prompts are checked and that requests for
  specific artist voices or copyrighted lyrics are blocked. No prompt in this attempt
  names an artist, band, album or song, and none was blocked.

### Next time

The lesson from attempt 1 was that prompt-only control could not hold tempo, structure
or instrumentation. Lyria fixed all three: the bracketed time-range syntax reliably
produced one continuous two-minute groove at the right tempo with the right instruments
named and audible. What it cannot do is make those instruments sound played. Both
listeners, across every take, described static velocities, grid-locked timing and no
room — and no prompt wording moved that, including one written specifically to attack it.

So a third attempt should stop treating this as a prompting problem:

- **Don't re-roll Lyria 3.5 on prompt variations.** That ground is covered: seven takes,
  four strategies, ceiling 4/10.
- Get a real performance into the loop instead — a human session player, a licensed
  salsa-dura library from a catalogue that permits game use, or a commissioned track.
  Two 30-second loops is a small, cheap commission.
- If a model is used again, prefer one that takes an **audio reference** or a stem-level
  arrangement, so timbre and feel are not being specified in prose.
- Keep the gate exactly as it is. It is working: it caught a spoken vocal that an
  integrated-loudness check and a glance at a waveform would both have missed.
- Listen on real speakers before shipping, whatever a model says. Audio models may well
  be biased toward calling any generated music "MIDI"; the counter-evidence here is that
  both models' checkable claims held up (the voice at 1:44, the abrupt ends, the tempo
  range all matched the measurements), and that no candidate came within three points of
  passing. A single harsh verdict would be worth doubting. Thirteen were not.

### The exact prompts

Reproduced verbatim. No artist, band, album or song name appears in any of them.

**Cuerpo, take 1 — `lyria-3.5`, the negative-list strategy**

```
Original instrumental salsa dura in the hard 1970s New York style, played live in one room by a real nine-piece conjunto and cut to analog tape. Fast dance tempo: 190 BPM in 4/4, locked to son clave, rock steady from the first beat to the last. Instrumental only, no vocals: no singing, no coro, no chanting, no shouts, no spoken words, no human voice anywhere. Acoustic instruments played by human hands, loose and pushing, never programmed and never quantized: acoustic upright piano hammering a repeating two-bar montuno guajeo in the middle register, upright double bass walking a syncopated tumbao that leaves beat one open, congas on tumbao with ringing open tones, bongo on martillo, timbales riding cascara on the metal shells, maracas and guiro keeping the eighth-note grid, and a small brass section of two trumpets and one trombone playing short punchy stabs in tight harmony between the piano phrases. Warm dry vintage room mix, light tape saturation, percussion up front. No synthesizers, no MIDI patches, no drum machine, no electronic drums, no synth strings, no string section, no electric guitar, no saxophone, no flute.

[0:00 - 0:30] Groove: already at full energy on beat one, the whole band playing, no intro, no count-in, no fade-in, no build.
[0:30 - 1:00] Groove: exactly the same unbroken verse groove at the same tempo and the same energy, no breakdown, no solo, no quiet bar.
[1:00 - 1:30] Groove: exactly the same unbroken verse groove, horns answering the piano, no section change, no key change, no tempo change.
[1:30 - 2:00] Groove: exactly the same unbroken verse groove, still at full energy on the very last beat, no ending, no final chord, no cymbal crash, no ritardando, no fade-out.
```

**Montuno, take 1 — `lyria-3.5`, the negative-list strategy (this is the take with the spoken voice at 1:44)**

```
Original instrumental salsa dura mambo section in the hard 1970s New York style, played live in one room by a real nine-piece conjunto and cut to analog tape, hotter and louder than the verse. Fast dance tempo: 190 BPM in 4/4, locked to son clave, rock steady from the first beat to the last. Instrumental only, no vocals: no singing, no coro, no chanting, no shouts, no spoken words, no human voice anywhere. Acoustic instruments played by human hands, loose and pushing, never programmed and never quantized: the timbalero off the shells and onto a loud hand-struck mounted campana cowbell that rides every bar, congas opening up with loud open tones and slaps, bongo player on the bongo bell, acoustic upright piano driving a hard two-bar montuno guajeo, upright double bass pushing a strong syncopated tumbao, and a brass section of two trumpets and one trombone playing loud interlocking mambo riffs in tight harmony, repeating and answering the bell and the piano. Warm vintage room mix, bright blaring brass, light tape saturation, bell and percussion up front. No synthesizers, no MIDI patches, no drum machine, no electronic drums, no synth strings, no string section, no electric guitar, no saxophone, no flute.

[0:00 - 0:30] Mambo: already at full energy on beat one, campana and the whole band playing, no intro, no count-in, no fade-in, no build.
[0:30 - 1:00] Mambo: exactly the same unbroken driving groove at the same tempo and the same energy, horn riffs repeating, no breakdown and no solo.
[1:00 - 1:30] Mambo: exactly the same unbroken driving groove, bell riding, horns stacked and punchy, no section change, no key change, no tempo change.
[1:30 - 2:00] Mambo: exactly the same unbroken driving groove, still at full energy on the very last beat, no ending, no final chord, no cymbal crash, no ritardando, no fade-out.
```

**Cuerpo, takes 2 and 4 — the positive-realism rewrite (take 2 through the Interactions API, take 4 through `generateContent`; both asked for `lyria-3-pro-preview` and both were served by `lyria-3.5`)**

```
Instrumental only, no vocals.

An original hard salsa dura instrumental, the way a nine-piece New York conjunto cut it live to analog tape in 1973: the whole band in one room, tape hiss and microphone bleed, horn players audibly breathing before each stab, hands slapping conga skin, the wooden action and pedal of an old upright piano, timbale shells ringing, the players leaning on each other and pushing the beat rather than sitting on a grid. Sweaty, loud, slightly out of tune, nothing corrected afterwards.

Tempo 190 BPM, 4/4, son clave. Acoustic piano on a repeating two-bar montuno guajeo, double bass on a tumbao that leaves beat one open, congas, bongo on martillo, timbales riding cascara on the shells, maracas and guiro, and two trumpets with one trombone trading short punchy stabs with the piano.

[0:00 - 0:30] Groove: the band is already at full tilt on beat one, no intro and no count-in.
[0:30 - 1:00] Groove: the same groove, same tempo, same key, horns answering the piano.
[1:00 - 1:30] Groove: the same groove, unbroken, nobody drops out and nobody solos.
[1:30 - 2:00] Groove: the same groove, still at full tilt on the final beat, no ending and no fade.

Instrumental only, no vocals: no singing, no coro, no chanting, no shouts, no spoken words, no vocal samples, no human voice of any kind anywhere in the take.
```

**Cuerpo clip, take 1 — `lyria-3-clip-preview`, the loop variant (no time ranges; clip length is fixed at 30 s)**

```
Instrumental only, no vocals.

A loopable thirty-second slice cut from the middle of one original hard salsa dura take, the way a nine-piece New York conjunto cut it live to analog tape in 1973: the whole band in one room, tape hiss and microphone bleed, horn players audibly breathing before each stab, hands slapping conga skin, the wooden action and pedal of an old upright piano, timbale shells ringing, the players leaning on each other and pushing the beat rather than sitting on a grid. Sweaty, loud, slightly out of tune, nothing corrected afterwards.

Tempo 190 BPM, 4/4, son clave. Acoustic piano on a repeating two-bar montuno guajeo, double bass on a tumbao that leaves beat one open, congas, bongo on martillo, timbales riding cascara on the shells, maracas and guiro, and two trumpets with one trombone trading short punchy stabs with the piano.

One unbroken groove at one tempo in one key: the band is already at full tilt on the first beat and still at full tilt on the last beat. No intro, no count-in, no fade-in, no build, no breakdown, no solo, no section change, no ending, no final chord, no cymbal crash, no fade-out, so the slice can be looped forever.

Instrumental only, no vocals: no singing, no coro, no chanting, no shouts, no spoken words, no vocal samples, no human voice of any kind anywhere in the take.
```

**Cuerpo, take 3 — `lyria-3.5`, the sparse five-piece descarga**

```
Instrumental only, no vocals.

Five musicians in a small dry room, close-miked, playing an original salsa descarga groove: an old upright piano on a repeating two-bar montuno guajeo, a double bass on a tumbao that leaves beat one open, congas, bongo on martillo, and timbales riding cascara on the shells with maracas. You can hear the piano's wooden action, the bass strings buzzing against the fingerboard, palms and fingertips on the conga skin, the wood of the bongo, sticks on metal. The five of them push and pull against each other and nobody is exactly on the grid. Mostly dry, almost no reverb, no studio polish, no vinyl crackle and no tape noise, just the room.

Tempo 190 BPM, 4/4, son clave. Leave plenty of space: one trumpet and one trombone sit out almost the whole time and only answer the piano with a single short two-note stab every eight bars, played softly and well behind the rhythm section.

[0:00 - 0:30] Groove: the five of them already locked in on beat one, no intro and no count-in.
[0:30 - 1:00] Groove: the same groove, same tempo, same key, one quiet horn stab.
[1:00 - 1:30] Groove: the same groove, unbroken, nobody drops out and nobody solos.
[1:30 - 2:00] Groove: the same groove, still going on the final beat, no ending, no final chord, no cymbal crash and no fade.

Instrumental only, no vocals: no singing, no coro, no chanting, no shouts, no spoken words, no vocal samples, no human voice of any kind anywhere in the take.
```

**Cuerpo clip, take 2 — `lyria-3-clip-preview`, the sparse loop variant**

The sparse prompt above, with the loop-variant paragraph in place of the time ranges.
Two stray time-range lines (`[1:00 - 1:30]` and `[1:30 - 2:00]`) were left in by mistake
when the ranges were stripped; the Clip model ignores length instructions anyway and
returned its fixed 30 seconds, but the take is recorded as slightly contaminated.

## Attempt 3 — Mureka (2026-10-24)

Still nothing shipped, and for the third time the reason is the same. Mureka's
`mureka-9.5` instrumental model is the best-behaved of the three services by a wide
margin — it hit the requested tempo to within a few BPM, it serves lossless WAV and
FLAC rather than a lossy MP3, it put no voice anywhere in any take, and it needed no
bracketed structure syntax to hold one continuous groove. Six listening passes across
three takes still scored every one of them between 1 and 4 out of 10 against a pass bar
of 7, naming the same defect Lyria and ElevenLabs were named for: the instruments are
sequenced, not played.

This attempt also stopped for a reason the earlier two did not: **the account ran out of
credits, not out of patience.** The budget was eight generation requests; two were spent,
because at `mureka-9.5` prices the balance only covered three instrumentals.

### The API, as it actually behaves

- **Endpoints**: `POST https://api.mureka.ai/v1/instrumental/generate` returns an
  asynchronous task; `GET https://api.mureka.ai/v1/instrumental/query/{task_id}` polls it.
  Auth is `Authorization: Bearer $MUREKA_API_KEY`. Billing is
  `GET https://api.mureka.ai/v1/account/billing`.
- **The full request schema is four fields**: `model` (required; one of `auto`,
  `mureka-7.6`, `mureka-8`, `mureka-9`, `mureka-9.5`), `n` (default 2, maximum 3), `prompt`
  (**maximum 1024 characters**) and `stream`. There is no `duration`, no `bpm`, no `seed`
  and no negative-prompt field, so tempo, length and instrumentation again have to go in
  the prompt — but see below, because this time the prompt actually held them.
- **The 1024-character cap is the real constraint on prompting.** Attempt 1's prompts ran
  to about 1,900 characters and attempt 2's to about 1,500; both had to be cut by roughly
  a third to fit. That is not obviously a loss — the long negative lists were what attempt
  2 suspected of summoning what they named — but it does mean a prompt cannot carry both a
  detailed arrangement and a long ban list.
- `prompt` and `instrumental_id` are mutually exclusive: the docs say each control option
  "does not support combination with other control options". A reference-audio upload
  (`POST /v1/files/upload` with `purpose: instrumental`, which takes a fixed 30-second
  clip) is therefore an _alternative_ to prompting, not an addition to it. No reference
  upload was used here.
- **Output is lossless.** Each choice carries `url` (MP3, 256 kbps), `flac_url` and
  `wav_url` (16-bit 44.1 kHz stereo), all valid for 30 days. This is the one hard technical
  advantage over both earlier services: any loop editing would start from PCM, not from a
  192 kbps MP3.
- **Cost is linear in `n`, and it is the binding budget.** `mureka-9.5` cost **15 credits
  per instrumental**: the `n: 2` request cost 30 and the `n: 1` request cost 15. The
  account started at 51 credits and ended at 6, so no third request was possible. Credits
  are prepaid, non-refundable and valid 12 months from the last recharge.
- `concurrent_request_limit` is **1** on this account, so tasks must be run one at a time.
- Generation took 61 s for the two-choice request and 92 s for the one-choice request.
  Status moved `preparing` → `running` → `succeeded`; no task failed or timed out.

### What was generated

Two requests, three instrumentals, one prompt per cue. No prompt names any artist, band,
album or song, nothing imitates Llorarás or any specific recording, and both prompts ask
for a live band in one room with human timing and real horn breath while explicitly
banning synthesizers, drum machines, quantized MIDI, sampled loops, vinyl crackle and tape
hiss. Both are reproduced verbatim at the end of this section.

| Take         | Task            | Prompt                 | Delivered         | Loudness (LUFS / LRA / true peak) | Tempo  | Listener A (3.1) | Listener B (2.5) |
| ------------ | --------------- | ---------------------- | ----------------- | --------------------------------- | ------ | ---------------- | ---------------- |
| cuerpo-v1-1  | 168127849627650 | `cuerpo-v1`, 1023 ch.  | 212.55 s, WAV+MP3 | −13.1 / 3.1 / +0.3 dBFS           | 193.25 | 2/10 FAIL        | 4/10 FAIL        |
| cuerpo-v1-2  | 168127849627650 | `cuerpo-v1`, 1023 ch.  | 222.75 s, WAV+MP3 | −11.9 / 3.6 / +0.5 dBFS           | 191.5  | 1/10 FAIL        | 4/10 FAIL        |
| montuno-v1-1 | 168128562593794 | `montuno-v1`, 1012 ch. | 243.31 s, WAV+MP3 | −12.3 / 4.1 / +0.5 dBFS           | 198.75 | 1/10 FAIL        | 4/10 FAIL        |

Both takes of `cuerpo-v1` came from the single `n: 2` request. All three are 44.1 kHz
16-bit stereo; delivered sizes were 37.5 MB / 39.3 MB / 42.9 MB as WAV and 6.8 MB / 7.1 MB
/ 7.8 MB as MP3. Tempo is the onset-autocorrelation estimate in quarter-note BPM; the
listeners' own estimates were 190–192, 190–192 and 199–200, which agree with it for the
first time across all three attempts. Every take overshoots 0 dBFS on decode by 0.3 to
0.5 dB, which the two-pass `loudnorm` fixed.

Nothing shipped, so no loop points were chosen and `packages/client/public/audio/` is
still absent.

### How each take was verified

Identical to attempt 2, so the three attempts are comparable:

1. `ffprobe` for container, duration, bitrate, sample rate and channels.
2. `ffmpeg -af ebur128=peak=true` for integrated loudness, loudness range and true peak.
3. A per-second RMS envelope in dBFS, flagging any second below −60 dBFS or more than
   12 dB under the take's median.
4. Tempo from an onset-strength envelope scored by autocorrelation, read as an octave
   family, plus each listener's own estimate.
5. Two independent listening passes per take, `gemini-3.1-pro-preview` and
   `gemini-2.5-pro` (Gemini API `generateContent`, the normalized MP3 sent inline as
   base64 `audio/mpeg`, `temperature: 0`), against the same strict eleven-point rubric:
   real band or MIDI/sample library and what gave it away, genre, a per-instrument audible
   checklist, clave and tumbao feel, tempo, any voice at all, every glitch with a
   timestamp, whether it starts and ends inside the groove, resemblance to any specific
   known recording, a 1–10 authenticity score, and PASS/FAIL. Both passes had to return
   PASS and 7 or better.

One detector was added, because attempt 2's per-second envelope is too coarse to see a
stutter lasting tens of milliseconds. A 10 ms frame analysis now reports both level
dropouts (frames far below a one-second local median) and sample-level discontinuities
(frames whose peak first-difference is an outlier, which is what a splice or a dropped
buffer leaves behind). It earned its place immediately — see below.

### What the verification found

Mechanically these are the best takes any attempt has produced. All three hold a steady
tempo inside the requested 170–200 BPM range, with the loudness range of 3.1 to 4.1 LU
confirming the energy barely moves. There is no digital silence, no dropout and no
mid-take level collapse anywhere inside any take; the only sub-−60 dBFS second in each
file is the short decay after the music stops. **No take contains any voice** — both
listeners confirmed that independently on all three, which is a real improvement on
attempt 2, where Lyria leaked eight seconds of spoken Spanish.

The one structural defect is shared by all three: each take stops abruptly mid-groove
rather than ending. `gemini-2.5-pro` called it "an abrupt, hard digital cut … It sounds
like the DAW transport was simply stopped" and treated it as disqualifying on its own.
That is fair as stated but it is also the cheapest defect here to fix: it sits outside any
loop region and trimming plus a crossfade would remove it.

The failure is realism, and both listeners reached it independently on every take.
`gemini-2.5-pro` on cuerpo-v1-1:

> This sounds like high-quality MIDI sequencing and premium sample libraries, not a real
> band in a room. … The rhythmic precision is inhuman. Every single percussion hit, piano
> chord, and bass note is perfectly locked to a metronomic grid. There is zero "push" or
> "pull" from the rhythm section, which is the lifeblood of salsa. A real band breathes;
> this doesn't. … There is no sense of a shared acoustic space.

It scored that take 4/10 — "a high-quality _imitation_, but it is immediately identifiable
as fake to an expert ear" — which is exactly the ceiling Lyria hit. `gemini-3.1-pro-preview`
was harsher at 2/10, and on the montuno take named the most specific version of the
complaint:

> Severe "machine-gun" digital artifacts on the cowbell and guiro due to identical,
> unvarying MIDI velocities.

Asking for the hotter mambo texture did not help and may have hurt: `gemini-2.5-pro`
called montuno-v1-1 "hyper-dense and somewhat chaotic, throwing every possible salsa
cliché into the mix at once … a 'Salsa Construction Kit'", still 4/10. So the sparse
texture tried in attempt 2 and the dense texture tried here fail the same way, which is
further evidence the defect is not in the arrangement.

**One listener claim was checked and is false.** `gemini-3.1-pro-preview` reported a
"repeating digital stutter/skip artifact that occurs exactly every 10 seconds" on
cuerpo-v1-1 and listed twenty-one timestamps for it. It is not there. The 10 ms analysis
finds **zero** sample-level discontinuities anywhere in the file at an 8-sigma threshold,
and the level dips at those exact timestamps are _shallower_ than the file's own
background: 19% of the claimed points dip more than 15 dB below the local median against
33% of all windows in the take, with a mean percentile of 65. `gemini-2.5-pro` heard
nothing of the kind. The two listeners also contradict each other outright on
instrumentation — `gemini-3.1-pro-preview` says cuerpo-v1-1 has no bongó, no maracas and
no trombone, `gemini-2.5-pro` says all three are plainly audible — and on whether the
montuno bass plays a tumbao at all, which one calls a "cardinal sin" of plodding on beat
one and the other calls "a proper tumbao, correctly anticipating the downbeats".

That matters for how much weight these scores carry. Attempt 2 closed by noting that the
listeners' checkable claims had all held up, and used that to justify trusting them. Here
one did not, and the detail-level disagreement is substantial. What survives is the thing
both models say on every take in words they chose independently — quantized timing, static
velocities, no room — which is also what four passes said in attempt 1 and thirteen in
attempt 2. The harsh end of the range (the 1s and 2s) should be discounted; the 4s should
not.

### The listening pack

Because the AI listeners may be biased against generated music, and because one of them
was caught inventing a defect, this attempt also hands the decision to a human. All three
takes were trimmed of their dead tail, two-pass `loudnorm`ed to −16.2 LUFS integrated with
true peak between −2.6 and −3.6 dBFS, and encoded to 192 kbps 44.1 kHz stereo MP3:

| File                | Take         | Duration | Size    | Scores (3.1 / 2.5) |
| ------------------- | ------------ | -------- | ------- | ------------------ |
| `cuerpo-take1.mp3`  | cuerpo-v1-1  | 211.70 s | 5.08 MB | 2/10 / 4/10        |
| `montuno-take1.mp3` | montuno-v1-1 | 242.80 s | 5.83 MB | 1/10 / 4/10        |
| `cuerpo-take2.mp3`  | cuerpo-v1-2  | 222.10 s | 5.33 MB | 1/10 / 4/10        |

They sit outside the repo, in the attempt's scratch directory under
`music/mureka/listen/`, with a `README.txt` that gives each file's scores, its main
criticism in the listener's own words, and the timestamps to listen at — including the
three places the two listeners flatly disagree, where a dancer's ear settles it faster
than either model.

### Licensing, for whoever tries again

Checked on 2026-10-24 against Mureka's Terms of Service
(<https://www.mureka.ai/terms>, release and effective date 18 October 2024) and the API
FAQ (<https://platform.mureka.ai/docs/en/faq.html>):

- **Ownership turns on whether the account is paid.** Terms §3(e): "If you are a user who
  has purchased gold or subscribed to the paid tier of the Service, the ownership, title
  and interest in and to the AI music content generated by Mureka (the 'Output'),
  including, without limitation, all intellectual property rights (if any) contained
  therein, belong to you." This account is prepaid (1,000 credits recharged, 994 spent),
  so output from it falls on the paid side.
- The free tier is the opposite and would not do for Clave even unmonetized: "Mureka owns
  all rights, title and interest in and to the Output", licensed back "solely for your
  lawful, internal, and non-commercial purposes, provided that you give attribution credit
  to Mureka in each case."
- The API FAQ states it plainly for API calls specifically: "All content generated through
  paid API calls comes with full usage rights and commercial authorization. You are free to
  use it in commercial products, platform distribution, advertisements, videos, and other
  business scenarios." A free, open-source Clave is well inside that.
- **No attribution is required on the paid tier**, and the terms impose no attribution
  obligation there — only the free tier does.
- **Mureka keeps a broad licence back over your output.** §3(e) also grants Mureka "an
  unrestricted, assignable, sublicensable, irrevocable, royalty-free license throughout the
  universe to reproduce, distribute, publicly display, communicate to the public, make
  available, create derivative works from … and otherwise exploit and use … all or any part
  of all your Output … including, without limitation, commercial use." Shipping a track in
  Clave does not stop Mureka or anyone it sublicenses to from using the same track.
- **Two disclaimers worth reading before relying on a generated track.** §3(f): the output
  "may have certain similarities with the other music work created by other users on
  Mureka, i.e., Mureka does not guarantee the uniqueness of the Output". §3(g): "due to the
  particularity and complexity of AIGC and the uncertainty of copyright law, Mureka does
  not guarantee that your Output by using Mureka can be used for copyright registration."
- **No watermark or content ID is documented anywhere.** Neither the Terms of Service nor
  the API reference nor the FAQ mentions a watermark, SynthID-style identifier or content
  ID on generated audio — unlike Lyria, whose docs state every output carries a SynthID
  watermark. Absence from the documentation is not proof of absence in the audio, so treat
  this as undocumented rather than confirmed clean.
- Credits are **non-refundable** and expire 12 months after the last recharge; the website
  membership and the API balance are separate systems.

### Next time

Three services, three ceilings, one defect. The honest summary is that prompt-level text
control over a general-purpose music model does not produce music that sounds played, and
Clave has now spent four, seven and two generations finding that out. What changed this
time is only that the mechanical problems went away: tempo, length, structure, lossless
output and the absence of any voice are all solved, and only timbre and feel are left.

- **Do not spend more on prompt variations of a text-to-music model.** That is now
  fifteen takes across three services and six prompt strategies, with a hard ceiling of
  4/10 from the more forgiving of two listeners.
- **Let Jacob's ears decide whether 4/10 is actually unshippable.** The listening pack
  exists for that. One listener invented a defect in this round, so the scores are
  evidence, not a verdict. If cuerpo-take1 sounds fine in the game at low volume under
  the rhythm cues, the gate was stricter than the product needed.
- If another generation round is funded, the one untried lever on Mureka is
  `instrumental_id`: a 30-second reference clip instead of a prompt, which specifies
  timbre and feel by example rather than in prose. That needs a reference recording whose
  licence permits it — which is a licensing problem, not a prompting one, and it is
  exactly the "audio reference" attempt 2 recommended.
- The cheaper fix remains the one attempt 2 named: a human session player or a licensed
  salsa-dura library. Two 30-second loops is a small commission, and it is the only route
  that attacks the defect every listener has named.
- Keep the gate. It has now caught a truncated response, a spoken vocal, and — new this
  round — a listener confabulating a glitch, because the measurements were run alongside
  the listening rather than instead of it.

### The exact prompts

Reproduced verbatim, as sent. Both are within the API's 1024-character limit. No artist,
band, album or song name appears in either.

**Cuerpo — `mureka-9.5`, `n: 2`, 1023 characters**

```
Original instrumental salsa dura, 1970s New York style, 190 BPM in 4/4 on son clave. One nine-piece band playing live together in one room, close-miked: you hear the room, the players breathing, palms on conga skin, the wooden action of the piano. Human timing - they push and pull, nobody sits exactly on the grid, every stroke a different weight.
Acoustic piano hammers a two-bar montuno guajeo. Upright bass plays a tumbao that leaves beat one open. Congas on tumbao with ringing open tones, bongo on martillo, timbales riding cascara on the shells, maracas and guiro. Two trumpets and a trombone take an audible breath, answer the piano with short punchy stabs, then leave space.
One unbroken verse groove, one tempo, one key, full energy on the first beat and the last: no intro, no count-in, no build, no breakdown, no solo, no ending, no fade.
Instrumental only: no singing, coro, chanting, shouts or spoken words.
No synthesizer, no drum machine, no quantized MIDI, no sampled loops, no vinyl crackle, no tape hiss.
```

**Montuno — `mureka-9.5`, `n: 1`, 1012 characters**

```
Original instrumental salsa dura mambo, 1970s New York style, 190 BPM in 4/4 on son clave, hot and loud. One nine-piece band live in one room, close-miked: you hear the room, the players breathing, palms cracking on conga skin, sticks on metal. Human timing - they push and pull, nobody sits exactly on the grid, every stroke a different weight.
The timbalero is off the shells and onto a loud hand-struck campana bell riding every bar. Congas open up loud, bongo player on the bongo bell, piano driving a hard montuno guajeo, upright bass pushing a strong tumbao. Two trumpets and a trombone blow loud interlocking mambo riffs in tight harmony, breathing between phrases.
One unbroken driving groove, one tempo, one key, full tilt on the first beat and the last: no intro, no count-in, no build, no breakdown, no solo, no ending, no fade.
Instrumental only: no singing, coro, chanting, shouts or spoken words.
No synthesizer, no drum machine, no quantized MIDI, no sampled loops, no vinyl crackle, no tape hiss.
```

## Attempt 4 — Suno via APIFRAME (2026-10-24)

Still nothing shipped, and this time the blocker is not only the sound. Suno `V5_5`
reached through APIFRAME produced the ten most convincing takes any attempt has made:
both listeners agree, on every one of the ten, that there is a real son clave and a real
bass tumbao that anticipates the downbeat — something no earlier attempt achieved on a
single take. No take contains any voice. None contains a dropout or a sample-level
discontinuity. All ten sit inside the requested tempo range. One drew a **6/10**, two
points above the ceiling the three earlier services shared.

Then a request spent re-running that exact setting returned 4/10 and 4/10, so the 6 was a
lucky draw rather than a property of the configuration. And the licensing homework below
is the real verdict: **APIFRAME is not an authorised Suno partner**, Suno has no public
API, and Suno assigns output rights only to its own paying subscribers. Nothing generated
this way can ship in Clave at any quality.

### The API, as it actually behaves

- **Endpoints**: `POST https://api.apiframe.ai/v2/music/generate` returns `202` with a
  `jobId`; `GET https://api.apiframe.ai/v2/jobs/{jobId}` polls it to `COMPLETED`. Auth is
  an `X-API-Key` header. Account and credit balance are
  `GET https://api.apiframe.ai/v2/me`. Model metadata is `GET /v2/models`.
- **APIFRAME does not offer Suno v6.** Suno itself released v6 on 2026-09-09: v6 and
  v6-wild for Pro and Premier subscribers, v6-mini for everyone, with the earlier models
  retired from new generation the same day
  ([Suno](https://about.suno.com/blog/introducing-v6),
  [TechCrunch](https://techcrunch.com/2026/09/09/suno-replaces-its-ai-models-with-a-new-one-trained-on-licensed-music-as-copyright-suits-pile-up/)).
  APIFRAME's `GET /v2/models`, re-checked on 2026-10-24, still lists exactly six values
  for `model_version` — `V4`, `V4_5`, `V4_5ALL`, `V4_5PLUS`, `V5`, `V5_5` — with
  `V4_5PLUS` as the default, and every request below asked for `V5_5`. Since Suno says it
  retired V5.5, which model actually produced these takes cannot be confirmed from the
  outside: one more thing a reseller leaves opaque. APIFRAME exposes Suno as a single
  model id, `"suno"`, with the version as a parameter, not as separate models.
- **The request shape**: top-level `model`, `prompt`, optional `webhookUrl` and
  `webhookEvents`; everything Suno-specific goes in a `sunoParams` object —
  `custom_mode`, `instrumental`, `model_version`, `title` (80 chars), `style`
  (1,000 chars), `negative_tags` (500 chars), `vocal_gender`, `style_weight` (0–1),
  `weirdness_constraint` (0–1) and `auto_lyrics`. Unknown top-level keys are rejected
  with `400`.
- **`custom_mode: true` is the right mode for an instrumental**, and it is what made this
  attempt different. In non-custom mode the prompt is a description capped at 500
  characters — tighter than Mureka's 1,024. In custom mode the prompt is treated as
  lyrics, so the musical description moves into `style` (1,000 characters) and the
  prompt can be the inert placeholder `[Instrumental]`. That buys a **dedicated
  `negative_tags` field**, the first service in four attempts to offer one: the ban list
  no longer has to sit inside the positive prompt, which is what attempt 2 suspected of
  summoning the very things it named.
- **Two numeric knobs no earlier service had**: `style_weight` (how hard the written
  style is held) and `weirdness_constraint` (how far off the safe centre). These are the
  only levers in four attempts that are not prose, and they are what round 2 tested.
- **Each request returns 2 tracks** and costs a flat **11 credits**, about **$0.11**.
  Delivery is 48 kHz stereo MP3 at 194–206 kbps, 172–269 s long; no WAV or FLAC is
  offered, so any loop editing would start from a lossy file — a step back from Mureka.
  Result files stay on the CDN for 90 days.
- Generation took 45–76 s per request. No request failed or timed out.
- **One operational trap.** The edge in front of the API answers `403` with
  `error code: 1010` to a request whose `User-Agent` it does not recognise; Python's
  default `urllib` agent is refused. Any ordinary client string passes, and the rejected
  request costs no credits.

### What was generated

Five requests, ten instrumentals, in three rounds. No prompt names any artist, band,
album or song, nothing imitates Llorarás or any specific recording, and no reference
audio was uploaded. Both prompts ask for a live band in one room with human timing and
real horn breath; the bans on synthesizers, drum machines, quantized MIDI, sampled loops,
vinyl crackle and tape hiss moved out of the prose and into `negative_tags`. All of it is
reproduced verbatim at the end of this section.

- **Round 1** (2 requests): `V5_5`, `custom_mode: true`, `instrumental: true`, the style
  text, the negative tags, and both numeric knobs left unset.
- **Round 2** (2 requests): one change only — `style_weight: 0.8` and
  `weirdness_constraint: 0.85`. Both knobs move together as a single lever ("hold the
  written style harder, push further off the safe centre") because the one thing round 1
  got right was the instrumentation and the clave, and lowering `style_weight` risked
  losing it. Confirmation the lever engaged: round 1's responses came back with Suno's own
  rewritten style tags, round 2's came back with the submitted style text verbatim.
- **Round 3** (1 request): nothing changed at all, re-running round 2's Cuerpo spec, to
  test whether its 6/10 was reproducible. It was not. One request of the six-request
  budget was left unspent; after the reproducibility answer there was nothing left for it
  to buy.

Tempo is the onset-autocorrelation estimate in quarter-note BPM, read as an octave
family. Loudness is measured on the normalized file; every source take overshot 0 dBFS by
up to 0.5 dB on decode, which normalization fixed.

| File                 | Round | Cue     | Delivered | LUFS / LRA / TP    | Tempo | 3.1       | 2.5           |
| -------------------- | ----- | ------- | --------- | ------------------ | ----- | --------- | ------------- |
| `suno-cuerpo-1.mp3`  | 1     | Cuerpo  | 192.81 s  | −16.3 / 3.9 / −1.6 | 195.0 | 3/10 FAIL | 4/10 FAIL     |
| `suno-cuerpo-2.mp3`  | 1     | Cuerpo  | 176.81 s  | −16.3 / 3.4 / −2.6 | 195.0 | 1/10 FAIL | 4/10 FAIL     |
| `suno-montuno-1.mp3` | 1     | Montuno | 172.81 s  | −16.2 / 3.9 / −1.9 | 195.0 | 2/10 FAIL | 3/10 **PASS** |
| `suno-montuno-2.mp3` | 1     | Montuno | 183.21 s  | −16.3 / 4.2 / −1.6 | 191.4 | 1/10 FAIL | 4/10 **PASS** |
| `suno-cuerpo-3.mp3`  | 2     | Cuerpo  | 211.69 s  | −16.3 / 3.4 / −2.9 | 191.4 | 1/10 FAIL | 6/10 **PASS** |
| `suno-cuerpo-4.mp3`  | 2     | Cuerpo  | 207.18 s  | −16.3 / 3.7 / −2.3 | 191.4 | 1/10 FAIL | 3/10 **PASS** |
| `suno-montuno-3.mp3` | 2     | Montuno | 217.98 s  | −16.3 / 4.5 / −4.0 | 195.0 | 1/10 FAIL | 3/10 **PASS** |
| `suno-montuno-4.mp3` | 2     | Montuno | 268.74 s  | −16.3 / 3.7 / −3.2 | 202.7 | 1/10 FAIL | 4/10 **PASS** |
| `suno-cuerpo-5.mp3`  | 3     | Cuerpo  | 197.53 s  | −16.3 / 4.7 / −2.8 | 184.6 | 1/10 FAIL | 4/10 **PASS** |
| `suno-cuerpo-6.mp3`  | 3     | Cuerpo  | 221.70 s  | −16.2 / 6.5 / −2.4 | 191.4 | 1/10 FAIL | 4/10 FAIL     |

Seven of ten takes drew a PASS from `gemini-2.5-pro`, against none in attempt 3 — but all
ten drew a FAIL from `gemini-3.1-pro-preview`, and its score was 1/10 on nine of them. The
two listeners are further apart here than in any previous round, which is the single most
important thing this attempt has to say about its own evidence.

### How each take was verified

Identical to attempts 2 and 3, so all four are comparable:

1. `ffprobe` for container, duration, bitrate, sample rate and channels.
2. `ffmpeg -af ebur128=peak=true` for integrated loudness, loudness range and true peak.
3. A per-second RMS envelope in dBFS, flagging any second below −60 dBFS or more than
   12 dB under the take's median.
4. Tempo from an onset-strength envelope scored by autocorrelation, read as an octave
   family, plus each listener's own estimate.
5. A 10 ms frame pass for level dropouts and sample-level discontinuities (frames whose
   peak first-difference is an outlier, which is what a splice or a dropped buffer
   leaves behind).
6. Two independent listening passes per take, `gemini-3.1-pro-preview` and
   `gemini-2.5-pro` (Gemini API `generateContent`, the normalized MP3 sent inline as
   base64 `audio/mpeg`, `temperature: 0`), against the same eleven-point rubric as
   before.

The gate changed, and this is the important methodological difference. In attempts 2 and
3 the two listeners **were** the gate, with a pass bar of 7/10. Here they only **screen**
— voices, stray instruments, glitches, tempo, instrumentation — and every claim either of
them makes is checked before it is believed. Attempt 3 caught one listener confabulating
a glitch; this round added a second step, **isolating the passage and asking both models
again**, and it changed the answer four times out of five. Jacob's ear decides, on the
listening page.

### What the verification found

Mechanically these are the best takes of the four attempts, and the measurements are
unanimous. All ten hold a steady tempo between 184.6 and 202.7 BPM. Not one second of any
take falls below −60 dBFS, there is not a single level dropout at 10 ms resolution, and
there are **zero sample-level discontinuities** in any of the ten files at an 8-sigma
threshold — the largest first-difference outlier anywhere is 5.9 sigma. Loudness range of
3.4 to 6.5 LU confirms the energy barely moves. **No take contains any voice**, which
both listeners confirmed independently on all ten.

On the musical fundamentals the two listeners agree for the first time. `gemini-2.5-pro`
on `suno-cuerpo-3`:

> Yes, there is a very strong 2-3 Son clave feel that the entire arrangement is built
> around. The bass plays a proper, syncopated tumbao, consistently anticipating the
> downbeat on the "and" of beat two and leading into the one from beat four. It does not
> plod on beat one.

`gemini-3.1-pro-preview`, which scored the same file 1/10, concedes the same point on
every take it damns — "the bass _does_ play a structurally correct tumbao that anticipates
the downbeat (hitting the 4-and), but it executes it with robotic, quantized precision
rather than any actual human groove or pocket". That is a real advance: in attempt 3 the
two listeners could not agree whether the bass played a tumbao at all.

**The high score, and why it does not count.** `gemini-2.5-pro` gave `suno-cuerpo-3`
6/10, two points above every previous ceiling:

> 6/10. The arrangement, instrumentation, and rhythms are all correct and convincing.
> However, the robotic perfection, the sterile quality of the horn samples, and the lack
> of any room ambiance or microphone bleed give it away as a modern, in-the-box
> production. It sounds like a great demo, not a vintage record.

It passed that take for shipping. So round 3 re-ran the identical request — same model
version, same style text, same negative tags, same `style_weight: 0.8` and
`weirdness_constraint: 0.85` — and got 4/10 and 4/10 from the same listener on the two
takes it returned. **The 6 was a draw, not a setting.** This is the one thing a
generation budget can buy that a prompt rewrite cannot, and it is worth spending a
request on before anyone concludes a knob works.

**The realism complaint is unchanged for the fourth time**, and `gemini-3.1-pro-preview`
puts it the same way it did about three other services:

> Programmed, without a doubt. This is a blatantly sequenced MIDI track. The brass section
> is the most obvious giveaway—it sounds like a cheap 1990s sound module or basic
> soundfont, completely lacking human breath, natural vibrato, or realistic attack/decay.
> Furthermore, the piano velocities are rigidly uniform, and the cowbell is the exact same
> static sample triggered repeatedly with zero variation in strike position or dynamics.

and on `suno-montuno-3`, the complaint attempt 3 also recorded: "the 'machine-gun' effect
on the cowbell and conga slaps where the exact same sample is triggered repeatedly without
variation". `gemini-2.5-pro` agrees on the cause while disagreeing on the consequence,
passing seven takes on function: "PASS. Despite its synthetic feel, the track is
rhythmically correct, high-energy, and musically functional for a dance game where a clear,
steady beat is paramount."

**Two takes leaked a synthesizer, and `negative_tags` did not stop it.** "synthesizer" was
the first of 364 characters of negative tags on every request. `suno-cuerpo-1` has a synth
lead from 0:48 with a portamento pitch bend at 1:08, and `suno-cuerpo-4` has one from 1:06.
Neither first pass got this right: on `suno-cuerpo-1`, `gemini-3.1-pro-preview` called it a
flute and `gemini-2.5-pro` reported no extra instrument at all. Isolating the passage and
asking both again settled it — `gemini-2.5-pro`: "The lead melody that begins at 0:06 is
played by a synthesizer, likely using a synth-brass or lead patch"; `gemini-3.1-pro-preview`:
"a **synthesizer** (specifically a synth lead using portamento/glide), not a flute". Both
takes are disqualified as they stand. Note that `suno-cuerpo-3` and `suno-cuerpo-4` came
from the _same request_: the ban holds on some draws and not others.

**All ten compose an ending.** Every prompt said "no ending, no fade"; every take ends
with a composed final phrase and a decay of roughly one to two seconds, and
`suno-cuerpo-1` adds a full stop-time break at 3:08 before its last hits. This replaces
attempt 3's defect (a hard digital cut) with a gentler one, and like that defect it sits
outside any loop region — trimming plus a crossfade would remove it. It is the cheapest
problem here.

**Three listener claims were checked and are false; one was checked and is true.**
This is why the listeners now only screen.

| Claim                                                | By  | Checked how                    | Result                                      |
| ---------------------------------------------------- | --- | ------------------------------ | ------------------------------------------- |
| Flute on `cuerpo-1` at 0:48                          | 3.1 | isolated 0:44–1:15, both asked | **false** — it is a synth lead (worse)      |
| Processed clavinet or synth patch opening `cuerpo-2` | 2.5 | isolated 0:00–0:10             | **false** — acoustic piano, upper register  |
| Baritone saxophone on `montuno-4` at 0:27–0:34       | 2.5 | isolated 0:24–0:40             | **false** — trombones, both agreed          |
| Intro sound effects and synth pads on `cuerpo-6`     | 2.5 | isolated 0:00–0:16             | **false** — piano, bass, percussion only    |
| Synth lead on `cuerpo-4` at 1:06                     | 2.5 | isolated 1:00–1:25             | **true** — both then confirmed a synth lead |

**And one claim needed measurement, because isolation could not settle it.**
`gemini-3.1-pro-preview` reported a voice on `suno-cuerpo-5`:

> Immediately as the final musical chord strikes, a distinct and unmistakable sound effect
> of a live audience begins. It consists of loud cheering, clapping, and prominent
> whistling that continues until the audio cuts out. It is clearly not cymbal decay or
> instrumental reverb.

`gemini-2.5-pro`, on the same isolated eleven seconds, said the opposite:

> The sustained, high-frequency "shhh" sound is entirely instrumental and could be
> misinterpreted as a crowd, but it is the cymbal's decay.

A spectral profile of that tail decides it against the voice claim, on three independent
grounds. Applause is a dense train of impulses: the tail has **6 onsets above 2 sigma in
169 frames**, against 10–11 in the same file's own groove, so it is _less_ impulsive than
the music. Whistling is a strong narrow tone: the tail's peak-to-median ratio across
800–4000 Hz is **23.5 dB**, the _lowest_ of every window measured — the groove sections
run 27–31 dB and the other takes' tails 30–33 dB — so it is _less_ tonal than everything
around it. And its spectral centroid _rises_ 2,148 Hz while its level falls, the signature
of a cymbal whose low end decays first, which two other takes' tails do identically
without anyone calling them a crowd. There is no voice on `suno-cuerpo-5`.

That is the second time in two attempts that `gemini-3.1-pro-preview` has reported
something measurement cannot find, and this one would have been disqualifying. Its 1/10
scores should carry very little weight. `gemini-2.5-pro`'s were the only checkable claims
that survived unchanged — and it still got two instrument calls wrong.

### For Jacob's ears

All ten takes were two-pass loudness-normalized and added as the **first section** of the
listening page, titled "Attempt 4 · Suno (V5_5) via APIFRAME", above the three earlier
attempts and the public-domain candidates. Each entry carries both scores, what to listen
for, and chips that jump to the moments worth hearing — including every place the two
listeners contradict each other and every place measurement overruled one of them.

Normalization is a linear gain to −16 LUFS integrated followed by a true-peak limiter at
−1.5 dBTP, encoded to 192 kbps 44.1 kHz MP3. `loudnorm`'s own `linear=true` was tried
first and rejected: it silently falls back to dynamic-range compression when the required
gain would breach the ceiling, which left the ten files spread over 1.2 LU. All ten now
measure −16.2 or −16.3 LUFS with true peak between −1.6 and −4.0 dBTP, so no take wins by
being louder. The page was verified in headless Chromium (`@playwright/test` resolved from
the repo): all 34 audio elements across all five sections load with real durations, the
chips seek, the ratings export works, and there are no console errors.

**The decision is Jacob's, by ear, on that page** — with one caveat that no amount of
listening changes: even a take he likes cannot ship, for the licensing reasons below.

### Licensing — this is the finding that matters

Checked on 2026-10-24. **A free, open-source, public web game should not bundle and serve
tracks generated this way.** The sound is a side issue; the rights do not work.

The chain has three links and the middle one is missing.

- **Suno has no public API, and APIFRAME is not an authorised partner.** APIFRAME's own
  Suno page states that "Suno does not offer an official public API" and that it provides
  access through its own unified API instead
  (<https://apiframe.ai/models/suno>). Its "Official partner of" logos name BytePlus,
  Alibaba Cloud and MiniMax — not Suno. Suno announced an invite-only developer API
  partner programme in July 2026 and has published no partner terms
  (<https://www.digitalmusicnews.com/2026/07/03/suno-is-opening-an-api-partner-program/>,
  <https://musicbusinessworldwide.com/suno-explores-developer-api-seeking-apps-that-unlock-experiences-generative-music-makes-possible-for-the-first-time>).
  So the Suno account behind these ten takes belongs to APIFRAME or to someone it buys
  from, and nothing identifies whose it is or what tier it is on.
- **Suno assigns output rights only to its own paying subscribers.** Suno's Terms of
  Service (<https://suno.com/terms>, last revised 10 August 2026, effective
  3 September 2026) assign output ownership under "Pro and Premier Accounts": "Suno hereby
  assigns to you all of its right, title and interest in and to any Output owned by Suno."
  The free or basic tier is the opposite — "you covenant and agree that you will only use
  such Outputs for your lawful, personal and non-commercial purposes". The assignment runs
  to the Suno account holder, which is not Jacob. Suno also warns it "makes no
  representation or warranty to you that any copyright will vest in any Output."
- **Suno's terms appear to prohibit the arrangement itself.** Commercial exploitation is
  permitted "solely to the extent it adheres to Suno's Conditions of Access and Use", and
  only for Output "downloaded by you through an approved channel"; "obtaining a copy of an
  Output by any means other than a download channel made available by Suno is prohibited."
  The same terms bar users from "sell[ing], resell[ing], grant[ing] access to, transfer[ring]"
  the Service or Output for commercial purposes, and from "data mining, robots, scraping,
  or similar data gathering" (User Conduct, item 12). A paid reseller of unofficial API
  access sits against all of those.
- **APIFRAME's own terms promise less than its marketing does.** The marketing page says
  "Music generated through Apiframe comes with commercial usage rights". The Terms of
  Service (<https://apiframe.ai/terms>, last updated 8 August 2026) are narrower: §5
  ("Content and Intellectual Property") gives you the outputs only "Subject to these Terms
  and payment of applicable fees" and disclaims exclusivity — "similar outputs may be
  generated for other users, and we make no claims of exclusivity". §8 ("Third-Party
  Services") then routes you straight back to Suno: your use of integrated third-party
  services "is also subject to the terms and policies of those providers", and APIFRAME
  "is not responsible for third-party services or their content". §11 makes _you_ indemnify
  APIFRAME for content you generate. So APIFRAME grants what it can and points at Suno for
  the rest; Suno grants nothing to Jacob, because Jacob is not Suno's customer.
- **The account used here is on APIFRAME's free plan.** `GET /v2/me` reports
  `"plan": "free"` with 100 credits. That is APIFRAME's own tier, not Suno's, but it is one
  more reason not to lean on §5's "payment of applicable fees" condition.

Net: APIFRAME cannot pass through rights it does not hold, Suno's assignment never reaches
Jacob, and the route by which the audio was obtained is one Suno's terms appear to forbid.
Publishing these files in a public repository and serving them from clave.dance would put
the project on the wrong side of that, with Clave carrying the indemnity. Unlike attempt 3,
where Mureka's paid API terms granted commercial rights cleanly, there is no reading of
these documents that makes attempt 4 shippable.

**Legal standing, briefly.** Warner Music Group settled its copyright suit against Suno
(case 1:24-cv-11611) and signed a licensing deal announced 25 November 2025, under which
Suno is to replace its current models with licensed ones during 2026 and apply download
restrictions to free-tier users
(<https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/>,
<https://www.musicweek.com/labels/read/warner-music-group-settles-lawsuit-and-signs-ai-licensing-deal-with-suno/093129>,
<https://digitalpolicyalert.org/event/35757-warner-music-group-reached-settlement-of-litigation-and-formed-licensed-ai-partnership-agreement-with-suno-case-no-124-cv-11611>).
Warner and Universal both settled separately with Udio. Sony Music and Universal are
reported to be in talks with Suno but have settled nothing, and European collecting
societies including Denmark's Koda and Germany's GEMA are still pursuing claims. Two
caveats on this paragraph: it rests on trade press rather than a primary filing or an
official release, and the free-tier download restriction Warner's deal introduces is one
more reason the tier a reseller's Suno account sits on matters. This is unsettled law,
which is a further reason not to build a shipped feature on a reseller's access to it.

### Credits used

Started at 100 credits on the free plan, ended at 45: **five requests at 11 credits each,
55 credits, about $0.55**. Ten tracks, two per request. One request of the six-request
budget was deliberately left unspent. The `403` from the edge cost nothing.

### Next time

Four services, four ceilings, one defect — plus, now, a licensing wall.

- **The defect is confirmed, not suspected.** Twenty-five takes across four services and
  seven prompt strategies, and every listening pass in all four attempts names the same
  three things: quantized timing, static velocities, no room. Attempt 4 added the two
  non-prose levers that existed anywhere (`style_weight`, `weirdness_constraint`) and they
  did not move it; the one high score they produced did not reproduce.
- **Do not use APIFRAME for anything Clave ships.** Not on quality grounds — on the
  licensing chain above. It is fine for a private experiment and this was one.
- **If Suno is still wanted, the only clean route is Suno's own developer API** once it is
  generally available and its partner terms are published, on a Pro or Premier account
  held by Jacob. Until then there is no version of this that produces files the project can
  serve.
- **The remaining untried lever is still the one attempts 2 and 3 both named**: specify
  timbre and feel by example rather than in prose, via an audio reference — which needs a
  reference recording whose licence permits it, so it is a licensing problem, not a
  prompting one.
- **The cheapest honest fix has not changed either**: a human session player or a licensed
  salsa-dura library. Two 30-second loops is a small commission, and the public-domain
  section of the listening page is now the other live option.
- **Keep the screen, and keep checking it.** It has now caught a truncated response, a
  spoken vocal, a confabulated glitch, a confabulated _crowd_, two real synthesizer leaks
  and four false instrument calls. The rule that earned its place this round: isolate the
  passage and ask both models again, and when they still disagree, measure. Isolation
  changed the answer four times out of five.

### The exact prompts

Reproduced verbatim, as sent. Every request used `model: "suno"`, `prompt: "[Instrumental]"`
(inert, because `custom_mode: true` would otherwise treat the prompt as lyrics),
`sunoParams.custom_mode: true`, `sunoParams.instrumental: true`,
`sunoParams.model_version: "V5_5"`, and the `negative_tags` below. Rounds 2 and 3 added
`style_weight: 0.8` and `weirdness_constraint: 0.85` and changed nothing else. No artist,
band, album or song name appears anywhere.

**`negative_tags` — all five requests, 364 characters**

```
synthesizer, synth brass, synth strings, drum machine, electronic drums, quantized MIDI, sequenced MIDI, sample library, sampled loops, vinyl crackle, record crackle, tape hiss, surface noise, lo-fi, vocals, singing, coro, choir, chanting, shouts, spoken word, rap, saxophone, flute, electric guitar, reggaeton, timba, cumbia, pop, EDM, gridlocked, static velocity
```

**Cuerpo — `sunoParams.style`, 928 characters, `title: "Cuerpo"`**

```
Original instrumental salsa dura, 1970s New York style, 190 BPM, 4/4, son clave. One nine-piece band playing live together in one room, close-miked: you hear the room, the players breathing, palms on conga skin, the wooden action of the piano. Human timing - they push and pull, nobody sits exactly on the grid, every stroke a different weight. Acoustic piano hammers a two-bar montuno guajeo. Upright bass plays a tumbao that leaves beat one open. Congas on tumbao with ringing open tones, bongo on martillo, timbales riding cascara on the shells, maracas and guiro. Two trumpets and a trombone take an audible breath, answer the piano with short punchy stabs, then leave space. One unbroken verse groove, one tempo, one key, full energy from the first beat to the last: no intro, no count-in, no build, no breakdown, no solo, no ending, no fade. Instrumental only: no singing, no coro, no chanting, no shouts, no spoken words.
```

**Montuno — `sunoParams.style`, 917 characters, `title: "Montuno"`**

```
Original instrumental salsa dura mambo, 1970s New York style, 190 BPM, 4/4, son clave, hot and loud. One nine-piece band live in one room, close-miked: you hear the room, the players breathing, palms cracking on conga skin, sticks on metal. Human timing - they push and pull, nobody sits exactly on the grid, every stroke a different weight. The timbalero is off the shells and onto a loud hand-struck campana bell riding every bar. Congas open up loud, bongo player on the bongo bell, piano driving a hard montuno guajeo, upright bass pushing a strong tumbao. Two trumpets and a trombone blow loud interlocking mambo riffs in tight harmony, breathing between phrases. One unbroken driving groove, one tempo, one key, full tilt from the first beat to the last: no intro, no count-in, no build, no breakdown, no solo, no ending, no fade. Instrumental only: no singing, no coro, no chanting, no shouts, no spoken words.
```
