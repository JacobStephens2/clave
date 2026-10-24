# Soundtrack — attempted 2026-10-23, not shipped

Clave ships **no music files**. This document records the attempt to generate an
original two-part instrumental soundtrack ("Cuerpo" for the verse, "Montuno" for the
mambo), the verification it failed, and the licensing homework, so the next attempt
does not start from nothing. Nothing was added to `packages/client/public/audio/`, and
the clients keep the synthesized rhythm cues and the "Open Llorarás in Spotify" link
instead of a house-band toggle.

## What was generated

- **Service**: ElevenLabs Music, `POST https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128`,
  `model_id: "music_v2_5"` (the current best music model; `music_v1` is documented as
  outclassed), `force_instrumental: true`, no `composition_plan`.
- **Date**: 2026-10-23. **Plan tier**: Starter (confirmed from `GET /v1/user/subscription`,
  which reports `"tier": "starter"`).
- **Budget**: four generations, all four spent.

| Take | Requested | Delivered | Integrated loudness | Outcome |
| --- | --- | --- | --- | --- |
| Cuerpo 1 | 150 s | 150.0 s, 128 kbps | −12.3 LUFS, LRA 6.1, TP −0.2 dBFS | dropped |
| Montuno 1 | 150 s | 150.0 s, 128 kbps | −12.1 LUFS, LRA 2.2, TP +0.1 dBFS | dropped |
| Cuerpo 2 | 125 s | 124.8 s, 128 kbps | −13.6 LUFS, LRA 5.1, TP −0.6 dBFS | dropped |
| Montuno 2 | 125 s | 12.6 s (truncated response) | not measured | unusable |

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

## How each take was verified

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

## What the verification found

**Cuerpo 1.** The RMS envelope shows roughly 20 seconds of digital silence (−92 to
−104 dBFS) between about 0:15 and 0:35 and a second dip around 1:10–1:20. Gemini:
"does *not* sound like authentic 1970s New York salsa dura, nor does it sound like a
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

## Licensing, for whoever tries again

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

## Next time

Prompt-only control was the weak link: two rounds of increasingly explicit prompts
could not get horns, timbales or a tumbao into the mix, and could not hold the
requested tempo. Before spending more generations, try a `composition_plan` (sections
with explicit durations and instrumentation, which the API supports for structure) or
an audio reference, request a shorter take and loop it in the client, and listen to
every candidate on real speakers as well as through a model.

## The exact prompts

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
