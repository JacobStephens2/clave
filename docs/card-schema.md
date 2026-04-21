# Card Data Schema

## Example
```json
{
  "id": "atk_001",
  "name": "Quick Jab",
  "cost": 1,
  "type": "Attack",
  "rarity": "common",
  "keywords": ["fast"],
  "effects": [
    { "op": "damage", "target": "enemy", "value": 4 }
  ],
  "art": "cards/atk_001.png",
  "sfx": "sfx/jab.wav",
  "flavor": "Quick and cheap.",
  "status": "implemented"
}
```

Note: JSON is shown for illustration; the actual serialization format (JSON, YAML, TOML,
a database, or engine-native asset) depends on the chosen tech stack.

## Effect DSL Ops
| op | params | description |
|---|---|---|
| damage | target, value | deal value to target |
| draw | value | draw N cards |
| heal | target, value | |
| apply_status | target, status, stacks | |

## Naming Conventions
- Card IDs: `<type>_<###>`
- Art: `cards/<id>.<ext>`
- SFX: `sfx/<verb>_<variant>.<ext>`
- Localization keys: `card.<id>.name`, `card.<id>.text`
