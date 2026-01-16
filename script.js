// ===== CHRONO BONDS: ORIGIN - Main Game Script =====
// Game Boy-style Monster Collection RPG
// No external dependencies - Pure HTML5/Canvas/WebAudio

// ===== CONSTANTS =====
const TILE_SIZE = 16;
const SCREEN_WIDTH = 160;
const SCREEN_HEIGHT = 144;
const ANIM_SPEED = 8; // frames per step

// ===== GLOBAL STATE =====
const GameState = {
    mode: 'loading', // loading, field, dialogue, battle, menu
    data: {
        world: null,
        creatures: null,
        moves: null,
        dialogue: null
    },
    player: {
        x: 9,
        y: 7,
        direction: 'down',
        moving: false,
        animFrame: 0,
        map: 'hometown_modern',
        timeline: 'modern'
    },
    party: [],
    items: {
        capture_orb: 5,
        heal_herb: 3
    },
    flags: {
        has_starter: false,
        timeline_switched: false
    },
    settings: {
        soundEnabled: true,
        soundVolume: 0.5
    },
    camera: { x: 0, y: 0 },
    input: {
        up: false, down: false, left: false, right: false,
        a: false, b: false, menu: false,
        lastPressed: {}
    },
    dialogue: {
        active: false,
        lines: [],
        currentLine: 0,
        choices: null,
        callback: null
    },
    battle: {
        active: false,
        enemy: null,
        playerCreature: null,
        turn: 'player',
        menuState: 'main', // main, moves, items
        selectedIndex: 0,
        message: '',
        animating: false
    },
    menu: {
        active: false,
        items: [],
        selectedIndex: 0
    },
    encounterSteps: 0
};

// ===== CANVAS SETUP =====
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ===== AUDIO SYSTEM =====
class SoundGenerator {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.init();
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.updateVolume();
        } catch (e) {
            console.warn('Web Audio not supported');
        }
    }

    updateVolume() {
        if (this.masterGain) {
            this.masterGain.gain.value = GameState.settings.soundEnabled ?
                GameState.settings.soundVolume : 0;
        }
    }

    play(type) {
        if (!this.audioContext || !GameState.settings.soundEnabled) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        switch(type) {
            case 'step':
                osc.frequency.value = 200;
                gain.gain.value = 0.05;
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            case 'select':
                osc.frequency.value = 400;
                gain.gain.value = 0.1;
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'cancel':
                osc.frequency.value = 200;
                gain.gain.value = 0.1;
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            case 'encounter':
                osc.type = 'square';
                osc.frequency.value = 150;
                gain.gain.value = 0.15;
                osc.start(now);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
                osc.stop(now + 0.3);
                break;
            case 'attack':
                osc.type = 'sawtooth';
                osc.frequency.value = 300;
                gain.gain.value = 0.2;
                osc.start(now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                osc.stop(now + 0.2);
                break;
            case 'capture':
                osc.type = 'sine';
                osc.frequency.value = 400;
                gain.gain.value = 0.15;
                osc.start(now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.5);
                osc.stop(now + 0.5);
                break;
            case 'success':
                osc.frequency.value = 523;
                gain.gain.value = 0.15;
                osc.start(now);
                osc.stop(now + 0.1);

                const osc2 = this.audioContext.createOscillator();
                const gain2 = this.audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(this.masterGain);
                osc2.frequency.value = 659;
                gain2.gain.value = 0.15;
                osc2.start(now + 0.1);
                osc2.stop(now + 0.2);
                break;
            case 'fail':
                osc.frequency.value = 200;
                gain.gain.value = 0.15;
                osc.start(now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
                osc.stop(now + 0.3);
                break;
        }
    }
}

const Sound = new SoundGenerator();

// ===== DATA LOADING =====
async function loadGameData() {
    try {
        const [world, creatures, moves, dialogue] = await Promise.all([
            fetch('data/world.json').then(r => r.json()),
            fetch('data/creatures.json').then(r => r.json()),
            fetch('data/moves.json').then(r => r.json()),
            fetch('data/dialogue.json').then(r => r.json())
        ]);

        GameState.data.world = world;
        GameState.data.creatures = creatures;
        GameState.data.moves = moves;
        GameState.data.dialogue = dialogue;

        console.log('Game data loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load game data:', error);
        return false;
    }
}

// ===== SAVE/LOAD SYSTEM =====
function saveGame() {
    const saveData = {
        version: '1.0',
        timestamp: Date.now(),
        player: { ...GameState.player },
        party: GameState.party.map(c => ({...c})),
        items: { ...GameState.items },
        flags: { ...GameState.flags },
        settings: { ...GameState.settings }
    };

    try {
        localStorage.setItem('chronobonds_save', JSON.stringify(saveData));
        showMessage('Game saved!');
        Sound.play('success');
        return true;
    } catch (error) {
        console.error('Save failed:', error);
        showMessage('Save failed!');
        return false;
    }
}

function loadGame() {
    try {
        const saveData = localStorage.getItem('chronobonds_save');
        if (!saveData) {
            showMessage('No save data found!');
            return false;
        }

        const data = JSON.parse(saveData);
        GameState.player = data.player;
        GameState.party = data.party;
        GameState.items = data.items;
        GameState.flags = data.flags;
        GameState.settings = data.settings;

        Sound.updateVolume();
        showMessage('Game loaded!');
        Sound.play('success');
        return true;
    } catch (error) {
        console.error('Load failed:', error);
        showMessage('Load failed!');
        return false;
    }
}

function resetGame() {
    if (confirm('Reset all progress? This cannot be undone!')) {
        localStorage.removeItem('chronobonds_save');
        location.reload();
    }
}

// ===== UTILITY FUNCTIONS =====
function getCurrentMap() {
    return GameState.data.world.maps[GameState.player.map];
}

function getTileAt(x, y) {
    const map = getCurrentMap();
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
    return map.tiles[y][x];
}

function isCollision(x, y) {
    const map = getCurrentMap();
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
    return map.collisionLayer[y][x] === 1;
}

function checkWarp(x, y) {
    const map = getCurrentMap();
    return map.warps.find(w => w.x === x && w.y === y);
}

function checkNPC(x, y) {
    const map = getCurrentMap();
    return map.npcs.find(npc => npc.x === x && npc.y === y);
}

function checkEvent(x, y) {
    const map = getCurrentMap();
    return map.events.find(evt => evt.x === x && evt.y === y);
}

function getCreatureData(id) {
    return GameState.data.creatures.creatures.find(c => c.id === id);
}

function getMoveData(id) {
    return GameState.data.moves.moves.find(m => m.id === id);
}

function createCreature(creatureId, level) {
    const data = getCreatureData(creatureId);
    if (!data) return null;

    const creature = {
        id: data.id,
        name: data.name,
        type: data.type,
        level: level,
        exp: 0,
        currentHp: Math.floor(data.baseStats.hp * (1 + level * 0.1)),
        maxHp: Math.floor(data.baseStats.hp * (1 + level * 0.1)),
        attack: Math.floor(data.baseStats.attack * (1 + level * 0.1)),
        defense: Math.floor(data.baseStats.defense * (1 + level * 0.1)),
        speed: Math.floor(data.baseStats.speed * (1 + level * 0.1)),
        moves: [...data.moves]
    };

    return creature;
}

// ===== FIELD MODE =====
function updateField() {
    handleFieldInput();
    updateCamera();

    // Check for random encounters
    if (!GameState.player.moving) {
        const tile = getTileAt(GameState.player.x, GameState.player.y);
        const map = getCurrentMap();
        const zone = map.encounterZones.find(z => z.tiles.includes(tile));

        if (zone && Math.random() * 100 < zone.rate) {
            GameState.encounterSteps++;
            if (GameState.encounterSteps > 5) {
                triggerEncounter(zone);
                GameState.encounterSteps = 0;
            }
        }
    }
}

function handleFieldInput() {
    if (GameState.player.moving) {
        GameState.player.animFrame++;
        if (GameState.player.animFrame >= ANIM_SPEED) {
            GameState.player.moving = false;
            GameState.player.animFrame = 0;
        }
        return;
    }

    // Check A button (interact)
    if (wasPressed('a')) {
        Sound.play('select');
        const dx = GameState.player.direction === 'left' ? -1 :
                   GameState.player.direction === 'right' ? 1 : 0;
        const dy = GameState.player.direction === 'up' ? -1 :
                   GameState.player.direction === 'down' ? 1 : 0;

        const targetX = GameState.player.x + dx;
        const targetY = GameState.player.y + dy;

        // Check NPC
        const npc = checkNPC(targetX, targetY);
        if (npc) {
            interactWithNPC(npc);
            return;
        }

        // Check event
        const event = checkEvent(GameState.player.x, GameState.player.y);
        if (event) {
            triggerEvent(event);
            return;
        }
    }

    // Movement
    if (GameState.input.up && canMove('up')) {
        movePlayer(0, -1, 'up');
    } else if (GameState.input.down && canMove('down')) {
        movePlayer(0, 1, 'down');
    } else if (GameState.input.left && canMove('left')) {
        movePlayer(-1, 0, 'left');
    } else if (GameState.input.right && canMove('right')) {
        movePlayer(1, 0, 'right');
    }
}

function canMove(direction) {
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    return !isCollision(GameState.player.x + dx, GameState.player.y + dy);
}

function movePlayer(dx, dy, direction) {
    GameState.player.direction = direction;
    GameState.player.x += dx;
    GameState.player.y += dy;
    GameState.player.moving = true;
    GameState.player.animFrame = 0;
    GameState.encounterSteps++;
    Sound.play('step');

    // Check warp
    const warp = checkWarp(GameState.player.x, GameState.player.y);
    if (warp) {
        GameState.player.map = warp.toMap;
        GameState.player.x = warp.toX;
        GameState.player.y = warp.toY;
    }
}

function updateCamera() {
    const map = getCurrentMap();
    const playerScreenX = GameState.player.x * TILE_SIZE;
    const playerScreenY = GameState.player.y * TILE_SIZE;

    GameState.camera.x = Math.max(0, Math.min(
        playerScreenX - SCREEN_WIDTH / 2,
        map.width * TILE_SIZE - SCREEN_WIDTH
    ));
    GameState.camera.y = Math.max(0, Math.min(
        playerScreenY - SCREEN_HEIGHT / 2,
        map.height * TILE_SIZE - SCREEN_HEIGHT
    ));
}

// ===== NPC & DIALOGUE =====
function interactWithNPC(npc) {
    const dialogueData = GameState.data.dialogue.dialogues[npc.dialogue];
    if (!dialogueData) return;

    if (npc.givesStarter && !GameState.flags.has_starter) {
        showDialogue(dialogueData.text, dialogueData.choices, (choice) => {
            giveStarterCreature(choice);
        });
    } else {
        showDialogue(dialogueData.text);
    }
}

function giveStarterCreature(choice) {
    const starters = ['sproutail', 'embercub', 'aquafin'];
    const chosen = starters[choice];
    const creature = createCreature(chosen, 5);

    GameState.party.push(creature);
    GameState.flags.has_starter = true;

    showMessage(`You received ${creature.name}!`);
    Sound.play('success');
}

function triggerEvent(event) {
    const dialogueData = GameState.data.dialogue.dialogues[event.dialogue];
    if (!dialogueData) return;

    showDialogue(dialogueData.text, null, () => {
        if (dialogueData.triggersTimeline && !GameState.flags.timeline_switched) {
            switchTimeline();
        }
    });
}

function switchTimeline() {
    const newTimeline = GameState.player.timeline === 'modern' ? 'ancient' : 'modern';
    const newMap = GameState.player.timeline === 'modern' ?
        'hometown_ancient' : 'hometown_modern';

    GameState.player.timeline = newTimeline;
    GameState.player.map = newMap;
    GameState.flags.timeline_switched = true;

    showMessage(`Time shifted to ${newTimeline} era!`);
    Sound.play('success');
}

function showDialogue(lines, choices = null, callback = null) {
    GameState.mode = 'dialogue';
    GameState.dialogue.active = true;
    GameState.dialogue.lines = lines;
    GameState.dialogue.currentLine = 0;
    GameState.dialogue.choices = choices;
    GameState.dialogue.callback = callback;

    updateDialogueDisplay();
}

function updateDialogue() {
    if (wasPressed('a')) {
        Sound.play('select');

        if (GameState.dialogue.choices) {
            // Handle choice selection
            const choice = GameState.dialogue.choices[GameState.dialogue.selectedIndex || 0];
            closeDialogue();
            if (GameState.dialogue.callback) {
                GameState.dialogue.callback(GameState.dialogue.selectedIndex || 0);
            }
        } else if (GameState.dialogue.currentLine < GameState.dialogue.lines.length - 1) {
            GameState.dialogue.currentLine++;
            updateDialogueDisplay();
        } else {
            closeDialogue();
            if (GameState.dialogue.callback) {
                GameState.dialogue.callback();
            }
        }
    }

    if (wasPressed('b')) {
        Sound.play('cancel');
        closeDialogue();
    }
}

function updateDialogueDisplay() {
    const textBox = document.getElementById('text-box');
    const textContent = document.getElementById('text-content');

    textBox.classList.remove('hidden');
    textContent.textContent = GameState.dialogue.lines[GameState.dialogue.currentLine];
}

function closeDialogue() {
    GameState.dialogue.active = false;
    document.getElementById('text-box').classList.add('hidden');
    GameState.mode = 'field';
}

// ===== BATTLE SYSTEM =====
function triggerEncounter(zone) {
    if (GameState.party.length === 0) return; // No creatures to battle with

    const creatureId = zone.creatures[Math.floor(Math.random() * zone.creatures.length)];
    const creatureData = getCreatureData(creatureId);
    const level = creatureData.wildLevel[0] +
        Math.floor(Math.random() * (creatureData.wildLevel[1] - creatureData.wildLevel[0] + 1));

    const enemy = createCreature(creatureId, level);

    GameState.battle.enemy = enemy;
    GameState.battle.playerCreature = GameState.party[0];
    GameState.battle.menuState = 'main';
    GameState.battle.selectedIndex = 0;
    GameState.battle.message = `Wild ${enemy.name} appeared!`;
    GameState.battle.active = true;
    GameState.mode = 'battle';

    Sound.play('encounter');
    showBattleUI();
}

function updateBattle() {
    if (GameState.battle.animating) return;

    if (wasPressed('a')) {
        handleBattleSelect();
    }

    if (wasPressed('b')) {
        Sound.play('cancel');
        if (GameState.battle.menuState !== 'main') {
            GameState.battle.menuState = 'main';
            GameState.battle.selectedIndex = 0;
            updateBattleMenu();
        }
    }

    // Navigation
    if (wasPressed('up')) {
        Sound.play('select');
        GameState.battle.selectedIndex = Math.max(0, GameState.battle.selectedIndex - 1);
        updateBattleMenu();
    }
    if (wasPressed('down')) {
        Sound.play('select');
        const maxIndex = getBattleMenuItemCount() - 1;
        GameState.battle.selectedIndex = Math.min(maxIndex, GameState.battle.selectedIndex + 1);
        updateBattleMenu();
    }
}

function handleBattleSelect() {
    Sound.play('select');

    switch(GameState.battle.menuState) {
        case 'main':
            const actions = ['ATTACK', 'ITEM', 'RUN'];
            const action = actions[GameState.battle.selectedIndex];

            if (action === 'ATTACK') {
                GameState.battle.menuState = 'moves';
                GameState.battle.selectedIndex = 0;
                updateBattleMenu();
            } else if (action === 'ITEM') {
                GameState.battle.menuState = 'items';
                GameState.battle.selectedIndex = 0;
                updateBattleMenu();
            } else if (action === 'RUN') {
                attemptRun();
            }
            break;

        case 'moves':
            const move = GameState.battle.playerCreature.moves[GameState.battle.selectedIndex];
            executeMove(move);
            break;

        case 'items':
            const items = Object.keys(GameState.items).filter(k => GameState.items[k] > 0);
            const item = items[GameState.battle.selectedIndex];
            useItem(item);
            break;
    }
}

function executeMove(moveId) {
    const moveData = getMoveData(moveId);
    const player = GameState.battle.playerCreature;
    const enemy = GameState.battle.enemy;

    GameState.battle.animating = true;
    Sound.play('attack');

    // Calculate damage
    const damage = calculateDamage(player, enemy, moveData);
    enemy.currentHp = Math.max(0, enemy.currentHp - damage);

    GameState.battle.message = `${player.name} used ${moveData.name}!`;
    updateBattleDisplay();

    setTimeout(() => {
        if (enemy.currentHp === 0) {
            winBattle();
        } else {
            enemyTurn();
        }
    }, 1000);
}

function enemyTurn() {
    const enemy = GameState.battle.enemy;
    const player = GameState.battle.playerCreature;
    const moveId = enemy.moves[Math.floor(Math.random() * enemy.moves.length)];
    const moveData = getMoveData(moveId);

    Sound.play('attack');

    const damage = calculateDamage(enemy, player, moveData);
    player.currentHp = Math.max(0, player.currentHp - damage);

    GameState.battle.message = `Enemy ${enemy.name} used ${moveData.name}!`;
    updateBattleDisplay();

    setTimeout(() => {
        if (player.currentHp === 0) {
            loseBattle();
        } else {
            GameState.battle.animating = false;
            GameState.battle.menuState = 'main';
            GameState.battle.selectedIndex = 0;
            updateBattleMenu();
        }
    }, 1000);
}

function calculateDamage(attacker, defender, move) {
    const baseDamage = move.power;
    const attackStat = attacker.attack;
    const defenseStat = defender.defense;
    const random = 0.85 + Math.random() * 0.15;

    return Math.max(1, Math.floor(
        (baseDamage * attackStat / defenseStat * 0.4 + 2) * random
    ));
}

function useItem(itemId) {
    if (itemId === 'capture_orb') {
        attemptCapture();
    } else if (itemId === 'heal_herb') {
        const player = GameState.battle.playerCreature;
        const healAmount = Math.floor(player.maxHp * 0.5);
        player.currentHp = Math.min(player.maxHp, player.currentHp + healAmount);
        GameState.items.heal_herb--;

        GameState.battle.message = `${player.name} was healed!`;
        updateBattleDisplay();

        setTimeout(() => {
            enemyTurn();
        }, 1000);
    }
}

function attemptCapture() {
    if (GameState.items.capture_orb === 0) {
        GameState.battle.message = 'No Capture Orbs left!';
        GameState.battle.animating = false;
        return;
    }

    if (GameState.party.length >= 3) {
        GameState.battle.message = 'Party is full!';
        GameState.battle.animating = false;
        return;
    }

    GameState.items.capture_orb--;
    GameState.battle.animating = true;
    Sound.play('capture');

    const enemy = GameState.battle.enemy;
    const creatureData = getCreatureData(enemy.id);
    const hpRatio = enemy.currentHp / enemy.maxHp;
    const catchRate = creatureData.captureRate * (1 - hpRatio * 0.5);

    GameState.battle.message = 'Capture Orb thrown!';
    updateBattleDisplay();

    // Simulate shakes
    setTimeout(() => {
        const roll = Math.random() * 100;
        if (roll < catchRate) {
            captureSuccess(enemy);
        } else {
            captureFail();
        }
    }, 1500);
}

function captureSuccess(creature) {
    Sound.play('success');
    GameState.party.push(creature);
    GameState.battle.message = `${creature.name} was captured!`;
    updateBattleDisplay();

    setTimeout(() => {
        endBattle();
    }, 1500);
}

function captureFail() {
    Sound.play('fail');
    GameState.battle.message = 'The creature broke free!';
    updateBattleDisplay();

    setTimeout(() => {
        enemyTurn();
    }, 1000);
}

function attemptRun() {
    const runChance = 50 + (GameState.battle.playerCreature.speed - GameState.battle.enemy.speed);

    if (Math.random() * 100 < runChance) {
        GameState.battle.message = 'Got away safely!';
        updateBattleDisplay();
        Sound.play('success');

        setTimeout(() => {
            endBattle();
        }, 1000);
    } else {
        GameState.battle.message = "Can't escape!";
        updateBattleDisplay();
        Sound.play('fail');

        setTimeout(() => {
            enemyTurn();
        }, 1000);
    }
}

function winBattle() {
    Sound.play('success');
    GameState.battle.message = `Wild ${GameState.battle.enemy.name} fainted!`;
    updateBattleDisplay();

    setTimeout(() => {
        endBattle();
    }, 1500);
}

function loseBattle() {
    Sound.play('fail');
    GameState.battle.message = `${GameState.battle.playerCreature.name} fainted!`;
    updateBattleDisplay();

    setTimeout(() => {
        // Heal party and return to safe location
        GameState.party.forEach(c => c.currentHp = c.maxHp);
        endBattle();
    }, 1500);
}

function endBattle() {
    GameState.battle.active = false;
    GameState.mode = 'field';
    hideBattleUI();
}

// ===== MENU SYSTEM =====
function showMenu() {
    GameState.menu.active = true;
    GameState.menu.selectedIndex = 0;
    GameState.menu.items = [
        { label: 'PARTY', action: () => showPartyMenu() },
        { label: 'ITEMS', action: () => showItemsMenu() },
        { label: 'SAVE', action: () => { saveGame(); closeMenu(); } },
        { label: 'LOAD', action: () => { loadGame(); closeMenu(); } },
        { label: 'SETTINGS', action: () => showSettingsMenu() },
        { label: 'CLOSE', action: () => closeMenu() }
    ];
    GameState.mode = 'menu';
    updateMenuDisplay();
}

function updateMenu() {
    if (wasPressed('up')) {
        Sound.play('select');
        GameState.menu.selectedIndex = Math.max(0, GameState.menu.selectedIndex - 1);
        updateMenuDisplay();
    }
    if (wasPressed('down')) {
        Sound.play('select');
        GameState.menu.selectedIndex = Math.min(
            GameState.menu.items.length - 1,
            GameState.menu.selectedIndex + 1
        );
        updateMenuDisplay();
    }
    if (wasPressed('a')) {
        Sound.play('select');
        GameState.menu.items[GameState.menu.selectedIndex].action();
    }
    if (wasPressed('b')) {
        Sound.play('cancel');
        closeMenu();
    }
}

function closeMenu() {
    GameState.menu.active = false;
    GameState.mode = 'field';
    document.getElementById('menu-overlay').classList.add('hidden');
}

function showPartyMenu() {
    let partyText = 'PARTY:\n\n';
    GameState.party.forEach((c, i) => {
        partyText += `${i + 1}. ${c.name} Lv${c.level}\n`;
        partyText += `   HP: ${c.currentHp}/${c.maxHp}\n`;
    });
    showMessage(partyText || 'No creatures in party!');
}

function showItemsMenu() {
    let itemsText = 'ITEMS:\n\n';
    Object.entries(GameState.items).forEach(([key, value]) => {
        const name = key.replace('_', ' ').toUpperCase();
        itemsText += `${name}: ${value}\n`;
    });
    showMessage(itemsText);
}

function showSettingsMenu() {
    GameState.menu.items = [
        {
            label: `SOUND: ${GameState.settings.soundEnabled ? 'ON' : 'OFF'}`,
            action: () => {
                GameState.settings.soundEnabled = !GameState.settings.soundEnabled;
                Sound.updateVolume();
                showSettingsMenu();
            }
        },
        { label: 'BACK', action: () => showMenu() }
    ];
    updateMenuDisplay();
}

function updateMenuDisplay() {
    const menuOverlay = document.getElementById('menu-overlay');
    const menuItems = document.getElementById('menu-items');

    menuOverlay.classList.remove('hidden');
    menuItems.innerHTML = '';

    GameState.menu.items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        if (index === GameState.menu.selectedIndex) {
            div.classList.add('selected');
        }
        div.textContent = item.label;
        menuItems.appendChild(div);
    });
}

function showMessage(text) {
    showDialogue([text]);
}

// ===== BATTLE UI UPDATES =====
function showBattleUI() {
    const battleUI = document.getElementById('battle-ui');
    battleUI.classList.remove('hidden');
    updateBattleDisplay();
    updateBattleMenu();
}

function hideBattleUI() {
    document.getElementById('battle-ui').classList.add('hidden');
}

function updateBattleDisplay() {
    const { enemy, playerCreature } = GameState.battle;

    document.getElementById('enemy-name').textContent = `${enemy.name} Lv${enemy.level}`;
    document.getElementById('player-creature-name').textContent =
        `${playerCreature.name} Lv${playerCreature.level}`;

    const enemyHpPercent = (enemy.currentHp / enemy.maxHp) * 100;
    const playerHpPercent = (playerCreature.currentHp / playerCreature.maxHp) * 100;

    document.getElementById('enemy-hp-fill').style.width = `${enemyHpPercent}%`;
    document.getElementById('player-hp-fill').style.width = `${playerHpPercent}%`;
    document.getElementById('player-hp-text').textContent =
        `${playerCreature.currentHp}/${playerCreature.maxHp}`;
}

function updateBattleMenu() {
    const menuItems = document.getElementById('battle-menu-items');
    menuItems.innerHTML = '';

    let items = [];

    if (GameState.battle.menuState === 'main') {
        items = ['ATTACK', 'ITEM', 'RUN'];
    } else if (GameState.battle.menuState === 'moves') {
        items = GameState.battle.playerCreature.moves.map(moveId => {
            const moveData = getMoveData(moveId);
            return moveData ? moveData.name : moveId;
        });
    } else if (GameState.battle.menuState === 'items') {
        items = Object.keys(GameState.items)
            .filter(k => GameState.items[k] > 0)
            .map(k => `${k.replace('_', ' ').toUpperCase()} x${GameState.items[k]}`);

        if (items.length === 0) {
            items = ['NO ITEMS'];
        }
    }

    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'battle-menu-item';
        if (index === GameState.battle.selectedIndex) {
            div.classList.add('selected');
        }
        div.textContent = item;
        menuItems.appendChild(div);
    });
}

function getBattleMenuItemCount() {
    if (GameState.battle.menuState === 'main') return 3;
    if (GameState.battle.menuState === 'moves') return GameState.battle.playerCreature.moves.length;
    if (GameState.battle.menuState === 'items') {
        const count = Object.keys(GameState.items).filter(k => GameState.items[k] > 0).length;
        return Math.max(1, count);
    }
    return 1;
}

// ===== RENDERING =====
function render() {
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    if (GameState.mode === 'field' || GameState.mode === 'dialogue' || GameState.mode === 'battle') {
        renderField();
    }
}

function renderField() {
    const map = getCurrentMap();
    const tileset = GameState.data.world.tileset;

    // Calculate visible tile range
    const startX = Math.floor(GameState.camera.x / TILE_SIZE);
    const startY = Math.floor(GameState.camera.y / TILE_SIZE);
    const endX = Math.min(map.width, startX + Math.ceil(SCREEN_WIDTH / TILE_SIZE) + 1);
    const endY = Math.min(map.height, startY + Math.ceil(SCREEN_HEIGHT / TILE_SIZE) + 1);

    // Render tiles
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const tileId = map.tiles[y][x];
            const tile = tileset[tileId];

            if (tile) {
                ctx.fillStyle = tile.color;
                ctx.fillRect(
                    x * TILE_SIZE - GameState.camera.x,
                    y * TILE_SIZE - GameState.camera.y,
                    TILE_SIZE,
                    TILE_SIZE
                );
            }
        }
    }

    // Render NPCs
    map.npcs.forEach(npc => {
        ctx.fillStyle = '#306230';
        ctx.fillRect(
            npc.x * TILE_SIZE - GameState.camera.x + 4,
            npc.y * TILE_SIZE - GameState.camera.y + 2,
            8,
            12
        );
    });

    // Render player
    const playerX = GameState.player.x * TILE_SIZE - GameState.camera.x;
    const playerY = GameState.player.y * TILE_SIZE - GameState.camera.y;

    ctx.fillStyle = '#0f380f';
    ctx.fillRect(playerX + 4, playerY + 2, 8, 12);

    // Draw direction indicator
    ctx.fillStyle = '#8bac0f';
    if (GameState.player.direction === 'up') {
        ctx.fillRect(playerX + 6, playerY + 2, 4, 2);
    } else if (GameState.player.direction === 'down') {
        ctx.fillRect(playerX + 6, playerY + 12, 4, 2);
    } else if (GameState.player.direction === 'left') {
        ctx.fillRect(playerX + 4, playerY + 6, 2, 4);
    } else if (GameState.player.direction === 'right') {
        ctx.fillRect(playerX + 10, playerY + 6, 2, 4);
    }

    // In battle mode, draw creatures
    if (GameState.mode === 'battle') {
        renderBattleCreatures();
    }
}

function renderBattleCreatures() {
    // Enemy creature (top right)
    ctx.fillStyle = '#306230';
    ctx.fillRect(100, 30, 24, 24);
    ctx.fillStyle = '#0f380f';
    ctx.fillRect(104, 34, 16, 16);

    // Player creature (bottom left)
    ctx.fillStyle = '#8bac0f';
    ctx.fillRect(30, 80, 24, 24);
    ctx.fillStyle = '#0f380f';
    ctx.fillRect(34, 84, 16, 16);
}

// ===== INPUT HANDLING =====
function wasPressed(key) {
    const pressed = GameState.input[key] && !GameState.input.lastPressed[key];
    GameState.input.lastPressed[key] = GameState.input[key];
    return pressed;
}

function setupControls() {
    // Touch controls
    const buttons = document.querySelectorAll('[data-key]');
    buttons.forEach(btn => {
        const key = btn.dataset.key;

        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            GameState.input[key] = true;

            // Special handling for menu button
            if (key === 'menu' && GameState.mode === 'field') {
                Sound.play('select');
                showMenu();
            }
        });

        btn.addEventListener('pointerup', (e) => {
            e.preventDefault();
            GameState.input[key] = false;
        });

        btn.addEventListener('pointerleave', (e) => {
            GameState.input[key] = false;
        });
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowUp': GameState.input.up = true; e.preventDefault(); break;
            case 'ArrowDown': GameState.input.down = true; e.preventDefault(); break;
            case 'ArrowLeft': GameState.input.left = true; e.preventDefault(); break;
            case 'ArrowRight': GameState.input.right = true; e.preventDefault(); break;
            case 'z': case 'Enter': GameState.input.a = true; e.preventDefault(); break;
            case 'x': case 'Escape': GameState.input.b = true; e.preventDefault(); break;
            case 'm': GameState.input.menu = true; e.preventDefault(); break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.key) {
            case 'ArrowUp': GameState.input.up = false; break;
            case 'ArrowDown': GameState.input.down = false; break;
            case 'ArrowLeft': GameState.input.left = false; break;
            case 'ArrowRight': GameState.input.right = false; break;
            case 'z': case 'Enter': GameState.input.a = false; break;
            case 'x': case 'Escape': GameState.input.b = false; break;
            case 'm': GameState.input.menu = false; break;
        }
    });
}

// ===== GAME LOOP =====
function gameLoop() {
    // Update
    switch(GameState.mode) {
        case 'field':
            updateField();
            break;
        case 'dialogue':
            updateDialogue();
            break;
        case 'battle':
            updateBattle();
            break;
        case 'menu':
            updateMenu();
            break;
    }

    // Render
    render();

    requestAnimationFrame(gameLoop);
}

// ===== INITIALIZATION =====
async function init() {
    console.log('Chrono Bonds: ORIGIN - Loading...');

    const loaded = await loadGameData();
    if (!loaded) {
        alert('Failed to load game data. Please refresh the page.');
        return;
    }

    setupControls();

    GameState.mode = 'field';

    // Show intro message
    showDialogue([
        'Welcome to CHRONO BONDS!',
        '',
        'Use the D-Pad to move.',
        'Press A to interact.',
        'Press MENU to save/load.',
        '',
        'Visit the lab to get your',
        'first creature companion!'
    ]);

    gameLoop();
    console.log('Game started!');
}

// Start the game when page loads
window.addEventListener('load', init);
