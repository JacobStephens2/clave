# Dance card artwork direction

The v1 dance-card set uses original **Afro-Caribbean figurative expressionism**: body-led silhouettes, emotional distortion, sweeping curves, bold dark outlines, saturated ochre/coral/teal/indigo, rhythmic repetition, slight Cubist syncopation, and tactile gouache/acrylic screenprint texture. This translates the research in [what-art-style-captures-salsa.md](../../research/what-art-style-captures-salsa.md) and [making-afro-caribbean-figurative-expressionist-art.md](../../research/making-afro-caribbean-figurative-expressionist-art.md) into a repeatable production brief.

## Visual system

- The recurring partnership is an Afro-Latino male Lead with deep brown skin, close curls, a deep-teal shirt, and ochre trousers, and an Afro-Caribbean female Follow with warm brown skin, a coiled updo, a coral dress, and practical dance shoes.
- Both partners receive equal visual agency. Holds, weight placement, and the card's defining action must read at thumbnail size.
- Abstract rhythmic floor shapes support the figures without turning the image into a literal nightclub scene.
- The restrained palette is burnt sienna, coral red, golden ochre, deep teal, turquoise, indigo, and warm cream.
- Artwork contains no typography, card frames, UI, logos, signatures, or watermarks. The clients own the accessible name, rules text, and tier/style information.
- Sacred or religious imagery is excluded from this decorative card-art system. Any future use requires specific cultural research and consultation.

## Generation record

The original 22 source images were generated on 2026-07-19 with `gpt-image-2`, `quality=high`, and a `1024x1536` source canvas through the repository-independent image-generation CLI bundled with Codex. [open-position-anchor-prompt.txt](open-position-anchor-prompt.txt) is the anchor brief; [card-art-prompts.jsonl](card-art-prompts.jsonl) contains the exact 21-card batch; and [reconnect-retry-prompt.txt](reconnect-retry-prompt.txt) records the successful retry used for `rec_002`.

The full-resolution working renders are intentionally excluded from Git. Delivery derivatives are keyed directly by the data-driven card IDs:

- Web: `packages/client/public/card-art/<card-id>.webp`, 512×768, quality 84.

On 2026-10-19, issue #20 corrected `pos_002` with the built-in imagegen edit
tool. [closed-position-arm-edit-prompt.txt](closed-position-arm-edit-prompt.txt)
records the exact prompt. The Follow's right elbow now bends into a raised
handhold with the Lead's left hand, replacing the straight downward arm. The
selected 1024×1536 PNG was resized with Pillow's `Image.Resampling.LANCZOS` to
512×768 and saved as WebP at quality 84. Visual inspection at delivery size
confirmed the arm pathway and joined hands, full-body framing, and established
palette and texture; `npm run check:art` validates the delivery asset contract.

The later `mov_013` Closed-entry Cross Body Lead split deliberately reuses the
foundational `mov_005` composition for now: both cards depict the same traveling
figure, while their names and position tags distinguish the starting handhold. The
derivative is duplicated under its own ID so the clients retain data-driven artwork
lookup. A future art pass may replace it with a more visibly framed Closed-position
setup without changing content or rendering code.

### 2026-10-23 repaint with GPT Image 2.5

Every card was repainted with `gpt-image-2.5-sunburst` (`quality=high`,
`1024x1536`) through the OpenAI Images API. The Open Position anchor was rendered
first from the unchanged [anchor brief](open-position-anchor-prompt.txt) on
`images/generations`. Every other card was rendered on `images/edits` with that
anchor attached as a reference image, so the same two dancers, clothes, palette,
outlines, and painted floor carry across the whole set. Each card's prompt keeps the
locked fields from the first batch and adds three rules learned from it: faces stay
apart in a respectful social frame, the Follow wears low practical shoes, and every
joined hand is visibly connected. [card-art-prompts-v2.jsonl](card-art-prompts-v2.jsonl)
records the exact prompt, model, endpoint, and reference for every card.

Two candidates were rendered per card. Each was inspected at full size against the
card's real handhold and defining action (using the veracity audit and the
positions/moves research), its anatomy, and its match to the anchor; failing cards
were re-prompted and re-rendered. `mov_013` now has its own composition that starts
from a visibly Closed frame, replacing the `mov_005` duplicate. Delivery
derivatives use the same pipeline as before: Pillow `LANCZOS` to 512×768, WebP
quality 84.

#### Ponche (`flo_005`)

The Ponche flourish was painted the same way on the same day: `images/edits`,
`gpt-image-2.5-sunburst`, `quality=high`, `1024x1536`, the v2 anchor attached as the
reference, and the record appended to
[card-art-prompts-v2.jsonl](card-art-prompts-v2.jsonl). Its defining action is the
phrase-ending accent dancers mark on beat 8, so the painting had to read as one
stopped instant rather than a travelling step. The first two candidates still read as
a mid-step open break with lifted heels, so the prompt was rewritten to describe a
photograph of a single frozen beat — both partners sunk into a wide planted stance
with every heel down, ribcages in a matching contra-body accent, free arms held and
stopped, and one joined handhold as the horizontal line through the middle — and two
more candidates were rendered. The delivered painting was inspected at full size and
in crops for the shared accent, the interlocked handhold, four flat feet, two arms and
two legs each, faces apart, the Follow's low practical shoes, and its match to the
anchor. Delivery derivative: Pillow `LANCZOS` to 512×768, WebP quality 84.

#### Screen illustrations

Three larger illustrations were generated the same day for the clients, outside the
card set, and live in `packages/client/public/art/` rather than `card-art/` (which
`npm run check:art` polices card-for-card):

- `home-hero.webp`, 1536×1024 — the couple dancing in front of the house band
  (piano, congas, upright bass, timbales with a mounted campana, trumpet, trombone).
- `finale-complete.webp`, 768×1152 — the grounded, arms-up finish at the end of a
  song danced all the way through, with the band celebrating. Its line-up drifts from
  the hero's: the painting put a tres and maracas where the piano and trombone were,
  which is still a plausible conjunto, so it was kept.
- `finale-lost.webp`, 768×1152 — the connection lost: both dancers laughing, hands
  reaching back toward each other across a small gap, one painted rhythm line broken.
  Mistakes are part of the dance, so the piece is warm rather than sad.

They use the same anchor reference, palette, outlines, texture, and the same two
dancers, and they carry no typography. They extend the visual system in one way the
cards do not: the band may appear behind the dancers. Card art stays band-free. Two
candidates were rendered for each illustration and inspected at full size and in
crops; the end-of-song piece was re-prompted once, because both first candidates
interleaved the dancers' legs into an unreadable tangle, in favour of a clean
side-by-side finish with painted floor between them. Delivery derivatives: Pillow
`LANCZOS` where a resize was needed, WebP quality 84.

The exact illustration prompts, in the same twelve-field format as the card records:

```
home-hero (images/edits, gpt-image-2.5-sunburst, quality=high, size=1536x1024, reference pos_001.png)
Use case: stylized-concept
Asset type: wide landscape title illustration for Clave, a cooperative salsa card game
Reference image: the attached painting shows the recurring partnership. Keep these exact two people (faces, hair, skin tones, clothing, shoes) and this exact painted style, palette, dark outlines, texture and abstract rhythmic floor. Change only the pose, hold, motion and surroundings described below.
Primary request: Illustrate the couple dancing one song in front of a small live salsa band. In the foreground the Lead and the Follow dance a connected salsa basic turning into an outside turn: their joined hands — his left to her right — are raised and clearly interlocked at head height, her free left arm curving out with the skirt swinging, his free right arm low and relaxed, both sets of knees soft, all four feet on the floor, both faces lifted and smiling at each other a clear arm's length apart. Behind and above them, smaller and slightly abstracted, plays a six-piece band facing the dancers: a pianist in profile at an upright piano with both hands on the keys, a conguero standing behind two tall congas with palms striking the heads, a bassist with an upright double bass plucking the strings, a timbalero behind two timbales with a mounted campana cowbell above them and two sticks in his hands, a trumpeter with the bell raised, and a trombonist with the slide extended. The band is painted as rhythm and support, each player clearly holding or striking their own instrument.
Scene/backdrop: A warm cream and burnt-sienna painted wall with turquoise and indigo rhythm blocks and sweeping coral arcs rising off the dancers; the abstract rhythmic floor runs under both the couple and the band; a social dance, no literal nightclub interior, no audience, no furniture, no stage lights.
Subject: Recurring Afro-Latino male Lead in deep-teal shirt and ochre trousers and recurring Afro-Caribbean female Follow in coral dress and low practical dance shoes, large in the foreground with equal agency; six Afro-Caribbean band musicians behind them, each smaller, each with plausible hands on a correctly shaped instrument.
Style/medium: Original Afro-Caribbean figurative expressionist salsa painting, bold outlines, elongated limbs, sweeping rhythm, rhythmic repetition, slight Cubist syncopation and hand-painted gouache/acrylic screenprint texture.
Composition/framing: 3:2 landscape; the dancing couple reads first as the large foreground silhouette just right of centre with the band arranged in a shallow arc behind them, every musician and both dancers fully inside the frame; keep the upper-left third calm, flat painted colour so a client can overlay a title there; no typography.
Lighting/mood: Warm, generous, alive — the first bar of a song you already want to dance to.
Color palette: Coral red, gold ochre, deep teal, turquoise, indigo, burnt sienna and cream.
Materials/textures: Layered pigment, dry brush, paper grain and scraped light accents.
Constraints: Exactly two dancers and exactly six musicians, nobody else. No text, letters, numbers, logos, watermark, signage, sacred imagery, extra limbs, broken anatomy, invented or malformed instruments, cropped bodies, photorealism, stage spotlight or ballroom costume. Keep a respectful social-dance frame: faces apart (no kissing, nuzzling or cheek-to-cheek), relaxed smiles. The Follow wears low practical dance shoes with a low heel, never high heels. Each person has exactly two arms, two hands and two legs; every joined hand is clearly connected.
```

```
finale-complete (images/edits, gpt-image-2.5-sunburst, quality=high, size=1024x1536, reference pos_001.png)
Use case: stylized-concept
Asset type: portrait end-of-song illustration for Clave, a cooperative salsa card game
Reference image: the attached painting shows the recurring partnership. Keep these exact two people (faces, hair, skin tones, clothing, shoes) and this exact painted style, palette, dark outlines, texture and abstract rhythmic floor. Change only the pose, hold, motion and surroundings described below.
Primary request: Illustrate the last beat of the song, danced all the way through, as one clean celebratory finishing pose. The couple stands side by side, the Lead on the left and the Follow on the right, both turned slightly toward each other, with a clear strip of painted floor between them: their legs never cross or overlap. Their inside hands are joined and thrown up high between them — his left hand plainly clasping her right hand, fingers interlocked, both arms straight — while their outside arms fly open wide and up, his right and her left, fingers spread. Both of them stand in a wide, proud, planted stance with every foot flat on the floor and the knees softly bent, chests lifted, heads tipped back, both laughing out loud with their faces a clear arm's length apart; her coral skirt is still flying from the final turn. It is the grounded 'that was ours' finish of two social dancers, not an acrobatic trick.
Scene/backdrop: Abstract floor and wall in burnt sienna and cream with a tall coral-and-gold burst opening upward behind the couple, turquoise and indigo rhythm blocks settling at the bottom; no literal nightclub interior, no audience, no furniture, no stage lights.
Subject: Recurring Afro-Latino male Lead in deep-teal shirt and ochre trousers and recurring Afro-Caribbean female Follow in coral dress and low practical dance shoes finishing together with equal agency; six Afro-Caribbean band musicians smaller behind them, each with plausible hands on a correctly shaped instrument.
Style/medium: Original Afro-Caribbean figurative expressionist salsa painting, bold outlines, elongated limbs, sweeping rhythm, slight Cubist syncopation and hand-painted gouache/acrylic screenprint texture.
Composition/framing: 2:3 portrait; the two standing figures and their raised joined hands form a wide, symmetrical, readable silhouette filling the lower two-thirds, the band arcs small across the upper third, both heads, all four hands and all four feet inside the frame, clear painted space between the dancers' legs; no typography.
Lighting/mood: Earned, exuberant, generous — the applause before it arrives.
Color palette: Coral red, gold ochre, deep teal, turquoise, indigo, burnt sienna and cream.
Materials/textures: Layered pigment, dry brush, paper grain and scraped light accents.
Constraints: A grounded standing finish with both of the Follow's feet on the floor — no drop, no lift, nobody airborne. Exactly two dancers and exactly six musicians, nobody else. No text, letters, numbers, logos, watermark, sacred imagery, extra limbs, broken anatomy, invented or malformed instruments, cropped bodies, photorealism, stage spotlight or ballroom costume. Keep a respectful social-dance frame: faces apart (no kissing, nuzzling or cheek-to-cheek), relaxed smiles. The Follow wears low practical dance shoes with a low heel, never high heels. Each person has exactly two arms, two hands and two legs; every joined hand is clearly connected.
```

```
finale-lost (images/edits, gpt-image-2.5-sunburst, quality=high, size=1024x1536, reference pos_001.png)
Use case: stylized-concept
Asset type: portrait end-of-song illustration for Clave, a cooperative salsa card game
Reference image: the attached painting shows the recurring partnership. Keep these exact two people (faces, hair, skin tones, clothing, shoes) and this exact painted style, palette, dark outlines, texture and abstract rhythmic floor. Change only the pose, hold, motion and surroundings described below.
Primary request: Illustrate the warm moment after the connection breaks, when the dance falls apart and the two of them laugh it off. The couple stands a step further apart than usual, the hold momentarily lost: the Lead has one palm turned up and open and his arm extended toward her, the Follow reaches back toward that open hand with her own right hand, their fingertips almost but not quite touching in the middle of the painting, one gap the whole picture is about to close. Both of them are laughing openly, heads tipped back and shoulders loose, her free left hand pressed to her own grin, his free left hand spread in a cheerful "that one was mine" shrug; both have both feet flat on the floor with the weight easy, knees soft, her coral skirt settling. It is affectionate and funny, two friends about to start the dance again — never sad, never an argument, nobody falling, nobody hurt, no blame.
Scene/backdrop: Abstract floor and wall in warm cream and burnt sienna where one coral rhythm line breaks cleanly in two mid-air between the dancers and the turquoise and indigo blocks drift apart and settle; far behind them two small loose silhouettes of band musicians keep playing, a conguero at his congas and a trumpeter with the bell up, painted small and soft; no literal nightclub interior, no audience, no furniture, no stage lights.
Subject: Recurring Afro-Latino male Lead in deep-teal shirt and ochre trousers and recurring Afro-Caribbean female Follow in coral dress and low practical dance shoes, both laughing and reaching to reconnect, equal agency; two small background musicians with plausible hands on correctly shaped instruments.
Style/medium: Original Afro-Caribbean figurative expressionist salsa painting, bold outlines, elongated limbs, sweeping rhythm, slight Cubist syncopation and hand-painted gouache/acrylic screenprint texture.
Composition/framing: 2:3 portrait; the two standing figures balance left and right with the near-touching hands at the optical centre, both heads, all four hands and all four feet inside the frame, the broken rhythm line reading at thumbnail size; no typography.
Lighting/mood: Warm, forgiving, funny — a mistake is part of the dance.
Color palette: Coral red, gold ochre, deep teal, turquoise, indigo, burnt sienna and cream.
Materials/textures: Layered pigment, dry brush, paper grain and scraped light accents.
Constraints: Both dancers upright, grounded, laughing and reaching toward each other with a small visible gap between their fingertips; the only broken thing is the painted rhythm line. Exactly two dancers and exactly two small background musicians, nobody else. No text, letters, numbers, logos, watermark, sacred imagery, extra limbs, broken anatomy, invented or malformed instruments, cropped bodies, photorealism, stage spotlight or ballroom costume. Keep a respectful social-dance frame: faces apart (no kissing, nuzzling or cheek-to-cheek), relaxed smiles. The Follow wears low practical dance shoes with a low heel, never high heels. Each person has exactly two arms, two hands and two legs.
```

Run `npm run check:art` after adding or changing card content. It requires exactly one valid browser asset for every card definition and rejects missing, unexpected, undersized, or non-WebP files.
