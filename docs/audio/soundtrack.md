# Soundtrack — two attempts, nothing shipped

Clave ships **no music files**. This document records two attempts to generate an
original two-part instrumental soundtrack ("Cuerpo" for the verse, "Montuno" for the
mambo), the verification both failed, and the licensing homework, so a third attempt
does not start from nothing. Nothing was added to `packages/client/public/audio/`, and
the clients keep the synthesized rhythm cues and the "Open Llorarás in Spotify" link
instead of a house-band toggle.

| Attempt | Date       | Service                         | Generations | Best score | Outcome     |
| ------- | ---------- | ------------------------------- | ----------- | ---------- | ----------- |
| 1       | 2026-10-23 | ElevenLabs Music `music_v2_5`   | 4           | —          | not shipped |
| 2       | 2026-10-24 | Google Lyria 3.5 / Lyria 3 Clip | 7           | 4/10       | not shipped |

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
