# CHRONO BONDS: ORIGIN

A Game Boy-style monster collection RPG built with pure HTML5, CSS, and JavaScript.

## 🎮 Play Now

This game runs directly in your browser with no installation required!

**GitHub Pages URL:** `https://<username>.github.io/chromon/`

## 📖 Story

Welcome to the Kagen Archipelago, a mysterious land where ancient ruins and modern technology coexist. At the center stands the Time-Crossing Great Tree, a mystical entity that connects past and future.

As a young explorer, you'll journey through two timelines, collecting companion creatures, battling wild monsters, and uncovering the secrets of time itself. Your choices in one era may affect the landscape and events of another.

## ✨ Features

### MVP Implementation (v1.0)

- **Field Exploration**: Walk around tile-based maps with collision detection
- **NPC Interaction**: Talk to villagers and characters to learn about the world
- **Random Encounters**: Battle wild creatures in grass areas
- **Turn-Based Combat**: Strategic 1v1 battles with ATTACK/ITEM/RUN options
- **Capture System**: Use Capture Orbs to add creatures to your party (max 3)
- **Timeline Switching**: Experience story events that shift between Ancient and Modern eras
- **Save/Load System**: Progress is saved to your browser's localStorage
- **Original Content**: All creatures, moves, and names are 100% original
- **Mobile-First Design**: Optimized for iPhone with touch controls
- **Game Boy Aesthetic**: Authentic 160x144 resolution with green monochrome palette
- **Generated Sound**: Web Audio API creates all sound effects dynamically

## 🎯 Controls

### Touch Controls (Mobile)
- **D-Pad**: Navigate in four directions
- **A Button**: Confirm, interact, talk to NPCs
- **B Button**: Cancel, go back
- **MENU Button**: Open menu for Save/Load/Settings

### Keyboard Controls (Desktop)
- **Arrow Keys**: Move character
- **Z / Enter**: A button (confirm/interact)
- **X / Escape**: B button (cancel)
- **M**: Open menu

## 🗺️ How to Play

1. **Start Your Journey**
   - Read the intro message
   - Walk north to the Research Lab (the building with a door)
   - Enter by walking onto the door tile

2. **Get Your Starter Creature**
   - Talk to the assistant inside the lab (press A when facing them)
   - Choose one of three starter creatures:
     - **Sproutail** (Nature type) - Balanced stats
     - **Embercub** (Flame type) - High speed and attack
     - **Aquafin** (Aqua type) - High defense

3. **Explore and Battle**
   - Exit the lab and explore the village
   - Walk through grass areas to trigger random encounters
   - Battle wild creatures to gain experience

4. **Capture New Creatures**
   - In battle, select ITEM → CAPTURE ORB
   - Success rate depends on enemy HP (lower is better)
   - Build a party of up to 3 creatures

5. **Experience Timeline Shift**
   - Walk south to find a special event location
   - Interact (press A) to trigger the timeline shift
   - Watch as the world transforms between Ancient and Modern eras
   - Notice how some areas change (fallen trees, blocked paths, etc.)

6. **Save Your Progress**
   - Press MENU button
   - Select SAVE to write progress to localStorage
   - Select LOAD to restore a previous save
   - Use RESET to start over (warning: cannot be undone!)

## 📁 Project Structure

```
/chromon
├── index.html          # Main HTML structure
├── style.css           # Game Boy-style CSS
├── script.js           # Complete game engine
├── data/
│   ├── world.json      # Maps, tiles, NPCs, events
│   ├── creatures.json  # Monster definitions
│   ├── moves.json      # Attack move data
│   ├── dialogue.json   # Conversation text
│   └── save_schema.md  # Save format documentation
└── README.md           # This file
```

## 🎨 Technical Details

### Stack
- **No Dependencies**: Pure HTML/CSS/JavaScript
- **Canvas Rendering**: 2D context with pixel-perfect scaling
- **Web Audio API**: Procedurally generated sound effects
- **localStorage**: Client-side save data persistence

### Compatibility
- **Primary Target**: iPhone Safari (iOS 14+)
- **Also Works On**: Modern desktop browsers (Chrome, Firefox, Safari, Edge)
- **Display**: Portrait orientation recommended
- **Resolution**: 160x144 (Game Boy) scaled to fit screen

### Performance
- Lightweight: ~50KB total uncompressed
- No external assets or network requests after initial load
- Runs at 60 FPS on modern devices

## 🎵 Audio

All sound effects are generated in real-time using Web Audio oscillators:
- **Step**: Walking sound
- **Select**: Menu navigation
- **Encounter**: Battle transition
- **Attack**: Move execution
- **Capture**: Orb throw animation
- **Success**: Capture/victory fanfare
- **Fail**: Missed capture/defeat

Volume and enable/disable controlled via in-game settings menu.

## 🔧 Development

### Local Testing
```bash
# Serve locally (any static server works)
python -m http.server 8000
# or
npx serve
```

### Customization

**Add New Creatures**: Edit `data/creatures.json`
```json
{
  "id": "newmon",
  "name": "NewMon",
  "type": "Element",
  "baseStats": {...},
  "moves": ["move_id"],
  "captureRate": 45
}
```

**Add New Moves**: Edit `data/moves.json`
```json
{
  "id": "move_id",
  "name": "Move Name",
  "power": 50,
  "accuracy": 90,
  "type": "Element"
}
```

**Create New Maps**: Edit `data/world.json`
- Define tile layout
- Set collision layer
- Add NPCs, warps, events
- Configure encounter zones

**Modify Dialogue**: Edit `data/dialogue.json`
- Update existing conversations
- Add new dialogue sequences
- Create branching choices

### Color Palettes

The game uses Game Boy green by default. To change colors, modify CSS variables in `style.css`:

```css
:root {
    --gb-darkest: #0f380f;
    --gb-dark: #306230;
    --gb-light: #8bac0f;
    --gb-lightest: #9bbc0f;
}
```

## 📜 License & Credits

This is an original game created for educational and entertainment purposes.

- **All content is original**: No copyrighted material from existing franchises
- **Game concept**: Inspired by classic monster collection games, reimagined as "Chrono Bonds"
- **Art style**: Game Boy aesthetic (public domain retro style)
- **Code**: Written from scratch with no external libraries

## 🐛 Known Issues & Future Enhancements

### Current Limitations (MVP Scope)
- Party limited to 3 creatures
- Only 5 creature species available
- 7 moves total
- 2 maps (Modern + Ancient versions)
- Simple damage calculation
- No type effectiveness system yet

### Planned Features (Post-MVP)
- Creature evolution system
- More maps and regions
- Type effectiveness in battle
- Stat growth and leveling
- Multiple save slots
- Trading system (local multiplayer)
- More creature species (target: 20+)
- Boss battles
- Quest system

## 🤝 Contributing

This is a learning project, but suggestions are welcome!

1. Test the game on different devices
2. Report bugs via issues
3. Suggest balance changes
4. Propose new creature/move ideas

## 📱 Deployment to GitHub Pages

To publish your own version:

```bash
# Push to GitHub
git add .
git commit -m "Deploy Chrono Bonds"
git push origin main

# Enable GitHub Pages
# Go to Settings → Pages → Source: main branch
```

Your game will be available at: `https://your-username.github.io/chromon/`

---

**Enjoy your journey through time in Chrono Bonds: ORIGIN!**

*Remember: The past and future are connected. Your choices matter.*
