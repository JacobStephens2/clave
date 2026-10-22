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

Run `npm run check:art` after adding or changing card content. It requires exactly one valid browser asset for every card definition and rejects missing, unexpected, undersized, or non-WebP files.
