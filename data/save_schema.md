# Save Data Schema

The game saves to localStorage under the key `chronobonds_save`.

## Save Structure

```json
{
  "version": "1.0",
  "timestamp": 1234567890,
  "player": {
    "name": "Player",
    "x": 5,
    "y": 5,
    "map": "hometown_modern",
    "timeline": "modern",
    "direction": "down"
  },
  "party": [
    {
      "id": "sproutail",
      "nickname": "",
      "level": 5,
      "exp": 0,
      "currentHp": 45,
      "maxHp": 45,
      "attack": 49,
      "defense": 49,
      "speed": 45,
      "moves": ["vine_strike", "tackle"]
    }
  ],
  "items": {
    "capture_orb": 5,
    "heal_herb": 3
  },
  "flags": {
    "has_starter": false,
    "timeline_switched": false,
    "visited_lab": false
  },
  "settings": {
    "soundEnabled": true,
    "soundVolume": 0.5,
    "palette": "green"
  }
}
```

## Field Descriptions

- **version**: Save format version for compatibility
- **timestamp**: Unix timestamp of save
- **player**: Current player position and state
- **party**: Array of owned creatures (max 3 for MVP)
- **items**: Inventory of usable items
- **flags**: Story progression and event flags
- **settings**: User preferences
