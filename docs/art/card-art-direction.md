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

The 22 images were generated on 2026-07-19 with `gpt-image-2`, `quality=high`, and a `1024x1536` source canvas through the repository-independent image-generation CLI bundled with Codex. [open-position-anchor-prompt.txt](open-position-anchor-prompt.txt) is the anchor brief; [card-art-prompts.jsonl](card-art-prompts.jsonl) contains the exact 21-card batch; and [reconnect-retry-prompt.txt](reconnect-retry-prompt.txt) records the successful retry used for `rec_002`.

The full-resolution working renders are intentionally excluded from Git. Delivery derivatives are keyed directly by the data-driven card IDs:

- Web: `packages/client/public/card-art/<card-id>.webp`, 512×768, quality 84.
- Unity: `unity/Clave/Assets/Resources/CardArt/<card-id>.png`, 512×768, loaded with `Resources.Load<Texture2D>`.

Run `npm run check:art` after adding or changing card content. It requires exactly one valid browser and Unity asset for every card definition and rejects missing, unexpected, undersized, or incorrectly dimensioned files.
