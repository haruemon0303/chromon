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
        timeline_switched: false,
        ancient_tree_removed: false
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
        showMessage('セーブしました！');
        Sound.play('success');
        return true;
    } catch (error) {
        console.error('Save failed:', error);
        showMessage('セーブに失敗しました！');
        return false;
    }
}

function loadGame() {
    try {
        const saveData = localStorage.getItem('chronobonds_save');
        if (!saveData) {
            showMessage('セーブデータがありません！');
            return false;
        }

        const data = JSON.parse(saveData);
        GameState.player = data.player;
        GameState.party = data.party;
        GameState.items = data.items;
        GameState.flags = data.flags;
        GameState.settings = data.settings;

        Sound.updateVolume();
        showMessage('ロードしました！');
        Sound.play('success');
        return true;
    } catch (error) {
        console.error('Load failed:', error);
        showMessage('ロードに失敗しました！');
        return false;
    }
}

function resetGame() {
    if (confirm('全てのデータをリセットしますか？この操作は取り消せません！')) {
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
    updateStatusBar();

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
    } else if (dialogueData.triggersChoice && !GameState.flags.ancient_tree_removed && npc.id === 'ancient_guide') {
        showDialogue(dialogueData.text, dialogueData.choices, (choice) => {
            handleAncientChoice(choice);
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

    showMessage(`${creature.name}を仲間にした！`);
    Sound.play('success');
}

function handleAncientChoice(choice) {
    if (choice === 0) {
        // 倒木をどける
        GameState.flags.ancient_tree_removed = true;
        showDialogue(GameState.data.dialogue.dialogues.tree_removed.text);
        Sound.play('success');
    } else {
        // そのままにする
        GameState.flags.ancient_tree_removed = false;
        showDialogue(GameState.data.dialogue.dialogues.tree_kept.text);
        Sound.play('select');
    }
}

function triggerEvent(event) {
    const dialogueData = GameState.data.dialogue.dialogues[event.dialogue];
    if (!dialogueData) return;

    // 時代切替イベントの処理
    if (dialogueData.triggersTimeline) {
        if (!GameState.flags.timeline_switched) {
            // 初回：イベント演出を見せてから切替
            showDialogue(dialogueData.text, null, () => {
                switchTimeline();
            });
        } else {
            // 2回目以降：すぐに切替
            switchTimeline();
        }
    } else {
        // 通常の会話
        showDialogue(dialogueData.text);
    }
}

function switchTimeline() {
    const newTimeline = GameState.player.timeline === 'modern' ? 'ancient' : 'modern';
    const newMap = GameState.player.timeline === 'modern' ?
        'hometown_ancient' : 'hometown_modern';
    const timelineName = newTimeline === 'modern' ? '現代' : '古代';

    GameState.player.timeline = newTimeline;
    GameState.player.map = newMap;
    GameState.flags.timeline_switched = true;

    // 現代に戻る時、選択に応じてマップを変更
    if (newTimeline === 'modern') {
        applyTimelineChanges();
    }

    showMessage(`${timelineName}に時間が移動した！`);
    Sound.play('success');
    updateTimelineDisplay();
}

function applyTimelineChanges() {
    // 古代での選択によって現代マップを変更
    const modernMap = GameState.data.world.maps.hometown_modern;

    if (GameState.flags.ancient_tree_removed) {
        // 倒木をどけた場合：y=9-10, x=8-10の障害物を通行可能にする
        // 衝突レイヤーを変更（1を0に）
        modernMap.collisionLayer[9][8] = 0;
        modernMap.collisionLayer[9][9] = 0;
        modernMap.collisionLayer[9][10] = 0;
        modernMap.collisionLayer[10][8] = 0;
        modernMap.collisionLayer[10][9] = 0;
        modernMap.collisionLayer[10][10] = 0;

        // タイルも通行可能なものに変更（草タイル6に）
        modernMap.tiles[9][8] = 6;
        modernMap.tiles[9][9] = 6;
        modernMap.tiles[9][10] = 6;
        modernMap.tiles[10][8] = 6;
        modernMap.tiles[10][9] = 6;
        modernMap.tiles[10][10] = 6;
    } else {
        // そのままにした場合：障害物を配置（復元）
        modernMap.collisionLayer[9][8] = 1;
        modernMap.collisionLayer[9][9] = 1;
        modernMap.collisionLayer[9][10] = 1;
        modernMap.collisionLayer[10][8] = 1;
        modernMap.collisionLayer[10][9] = 1;
        modernMap.collisionLayer[10][10] = 1;

        modernMap.tiles[9][8] = 1;
        modernMap.tiles[9][9] = 1;
        modernMap.tiles[9][10] = 1;
        modernMap.tiles[10][8] = 1;
        modernMap.tiles[10][9] = 1;
        modernMap.tiles[10][10] = 1;
    }
}

function updateTimelineDisplay() {
    updateStatusBar();
}

function updateStatusBar() {
    const timelineEl = document.getElementById('status-timeline');
    const locationEl = document.getElementById('status-location');
    const orbsEl = document.getElementById('status-orbs');

    if (timelineEl) {
        const timelineName = GameState.player.timeline === 'modern' ? '現代' : '古代';
        timelineEl.textContent = timelineName;
    }

    if (locationEl) {
        const map = getCurrentMap();
        const locationName = map ? map.name.replace(/（現代）|（古代）/g, '').trim() : 'カゲン村';
        locationEl.textContent = locationName;
    }

    if (orbsEl) {
        orbsEl.textContent = GameState.items.capture_orb || 0;
    }
}

function showDialogue(lines, choices = null, callback = null) {
    GameState.mode = 'dialogue';
    GameState.dialogue.active = true;
    GameState.dialogue.lines = lines;
    GameState.dialogue.currentLine = 0;
    GameState.dialogue.choices = choices;
    GameState.dialogue.selectedIndex = 0;  // 選択肢のインデックスを初期化
    GameState.dialogue.callback = callback;

    updateDialogueDisplay();
}

function updateDialogue() {
    // 選択肢がある場合、上下キーで選択可能
    if (GameState.dialogue.choices && GameState.dialogue.currentLine === GameState.dialogue.lines.length - 1) {
        if (wasPressed('up')) {
            Sound.play('select');
            GameState.dialogue.selectedIndex = Math.max(0, GameState.dialogue.selectedIndex - 1);
            updateDialogueDisplay();
            return;
        }
        if (wasPressed('down')) {
            Sound.play('select');
            GameState.dialogue.selectedIndex = Math.min(
                GameState.dialogue.choices.length - 1,
                GameState.dialogue.selectedIndex + 1
            );
            updateDialogueDisplay();
            return;
        }
    }

    if (wasPressed('a')) {
        Sound.play('select');

        if (GameState.dialogue.choices && GameState.dialogue.currentLine === GameState.dialogue.lines.length - 1) {
            // Handle choice selection
            const choiceIndex = GameState.dialogue.selectedIndex || 0;
            closeDialogue();
            if (GameState.dialogue.callback) {
                GameState.dialogue.callback(choiceIndex);
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

    let displayText = GameState.dialogue.lines[GameState.dialogue.currentLine];

    // 最後の行で選択肢がある場合、選択肢を表示
    if (GameState.dialogue.choices && GameState.dialogue.currentLine === GameState.dialogue.lines.length - 1) {
        displayText += '\n\n';
        GameState.dialogue.choices.forEach((choice, index) => {
            const marker = index === GameState.dialogue.selectedIndex ? '▶ ' : '  ';
            displayText += marker + choice + '\n';
        });
    }

    textContent.textContent = displayText;
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
    GameState.battle.animating = false;  // 戦闘開始時にリセット
    GameState.battle.message = `野生の${enemy.name}が現れた！`;
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

    GameState.battle.message = `${player.name}の ${moveData.name}！`;
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

    GameState.battle.message = `敵の${enemy.name}の ${moveData.name}！`;
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
    const levelMod = 1 + (attacker.level / 50); // レベル補正
    const random = 0.85 + Math.random() * 0.15;

    // ダメージ計算式を調整（0.35倍に下方修正で序盤を安定化）
    return Math.max(1, Math.floor(
        (baseDamage * attackStat / defenseStat * levelMod * 0.35 + 2) * random
    ));
}

function useItem(itemId) {
    if (itemId === 'capture_orb') {
        attemptCapture();
    } else if (itemId === 'heal_herb') {
        const player = GameState.battle.playerCreature;
        // 回復量を60%に増加（序盤の生存性向上）
        const healAmount = Math.floor(player.maxHp * 0.6);
        player.currentHp = Math.min(player.maxHp, player.currentHp + healAmount);
        GameState.items.heal_herb--;

        GameState.battle.message = `${player.name}のHPが回復した！`;
        updateBattleDisplay();
        updateStatusBar();

        setTimeout(() => {
            enemyTurn();
        }, 1000);
    }
}

function attemptCapture() {
    if (GameState.items.capture_orb === 0) {
        GameState.battle.message = '捕獲オーブがない！';
        GameState.battle.animating = false;
        return;
    }

    if (GameState.party.length >= 3) {
        GameState.battle.message = 'パーティがいっぱいだ！';
        GameState.battle.animating = false;
        return;
    }

    GameState.items.capture_orb--;
    GameState.battle.animating = true;
    Sound.play('capture');

    const enemy = GameState.battle.enemy;
    const creatureData = getCreatureData(enemy.id);
    const hpRatio = enemy.currentHp / enemy.maxHp;
    // 捕獲率計算を改善：HPが低いほど成功率大幅アップ
    // HP100% → base%, HP50% → base*1.5%, HP25% → base*2%, HP1% → base*3%
    const catchRate = creatureData.captureRate * (1 + (1 - hpRatio) * 2);

    GameState.battle.message = '捕獲オーブを投げた！';
    updateBattleDisplay();
    updateStatusBar();

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
    GameState.battle.message = `${creature.name}を捕まえた！`;
    updateBattleDisplay();

    setTimeout(() => {
        endBattle();
    }, 1500);
}

function captureFail() {
    Sound.play('fail');
    GameState.battle.message = '逃げられてしまった！';
    updateBattleDisplay();

    setTimeout(() => {
        enemyTurn();
    }, 1000);
}

function attemptRun() {
    // 逃走基本確率を70%に上昇（序盤の理不尽回避）
    const runChance = 70 + (GameState.battle.playerCreature.speed - GameState.battle.enemy.speed);

    if (Math.random() * 100 < runChance) {
        GameState.battle.message = 'うまく逃げ切れた！';
        updateBattleDisplay();
        Sound.play('success');

        setTimeout(() => {
            endBattle();
        }, 1000);
    } else {
        GameState.battle.message = '逃げられなかった！';
        updateBattleDisplay();
        Sound.play('fail');

        setTimeout(() => {
            enemyTurn();
        }, 1000);
    }
}

function winBattle() {
    Sound.play('success');
    GameState.battle.message = `野生の${GameState.battle.enemy.name}を倒した！`;
    updateBattleDisplay();

    setTimeout(() => {
        endBattle();
    }, 1500);
}

function loseBattle() {
    Sound.play('fail');
    GameState.battle.message = `${GameState.battle.playerCreature.name}は倒れた！`;
    updateBattleDisplay();

    setTimeout(() => {
        // Heal party and return to safe location
        GameState.party.forEach(c => c.currentHp = c.maxHp);
        endBattle();
    }, 1500);
}

function endBattle() {
    GameState.battle.active = false;
    GameState.battle.animating = false;  // フラグをリセット
    GameState.battle.menuState = 'main';  // メニュー状態をリセット
    GameState.mode = 'field';
    hideBattleUI();
}

// ===== MENU SYSTEM =====
function showMenu() {
    GameState.menu.active = true;
    GameState.menu.selectedIndex = 0;
    GameState.menu.items = [
        { label: 'パーティ', action: () => showPartyMenu() },
        { label: 'どうぐ', action: () => showItemsMenu() },
        { label: 'セーブ', action: () => { saveGame(); closeMenu(); } },
        { label: 'ロード', action: () => { loadGame(); closeMenu(); } },
        { label: '設定', action: () => showSettingsMenu() },
        { label: '閉じる', action: () => closeMenu() }
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
    let partyText = 'パーティ:\n\n';
    GameState.party.forEach((c, i) => {
        partyText += `${i + 1}. ${c.name} Lv${c.level}\n`;
        partyText += `   HP: ${c.currentHp}/${c.maxHp}\n`;
    });
    showMessage(partyText || 'パーティにいません！');
}

function showItemsMenu() {
    let itemsText = 'どうぐ:\n\n';
    const itemNames = {
        'capture_orb': '捕獲オーブ',
        'heal_herb': '回復草'
    };
    Object.entries(GameState.items).forEach(([key, value]) => {
        const name = itemNames[key] || key;
        itemsText += `${name}: ${value}\n`;
    });
    showMessage(itemsText);
}

function showSettingsMenu() {
    GameState.menu.items = [
        {
            label: `サウンド: ${GameState.settings.soundEnabled ? 'ON' : 'OFF'}`,
            action: () => {
                GameState.settings.soundEnabled = !GameState.settings.soundEnabled;
                Sound.updateVolume();
                showSettingsMenu();
            }
        },
        { label: '戻る', action: () => showMenu() }
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
    const { enemy, playerCreature, message } = GameState.battle;

    document.getElementById('enemy-name').textContent = `${enemy.name} Lv${enemy.level}`;
    document.getElementById('player-creature-name').textContent =
        `${playerCreature.name} Lv${playerCreature.level}`;

    const enemyHpPercent = (enemy.currentHp / enemy.maxHp) * 100;
    const playerHpPercent = (playerCreature.currentHp / playerCreature.maxHp) * 100;

    document.getElementById('enemy-hp-fill').style.width = `${enemyHpPercent}%`;
    document.getElementById('player-hp-fill').style.width = `${playerHpPercent}%`;
    document.getElementById('player-hp-text').textContent =
        `${playerCreature.currentHp}/${playerCreature.maxHp}`;
    document.getElementById('enemy-hp-text').textContent =
        `${enemy.currentHp}/${enemy.maxHp}`;

    // Update battle log
    if (message) {
        const logEl = document.getElementById('battle-log-text');
        if (logEl) {
            logEl.textContent = message;
        }
    }
}

function updateBattleMenu() {
    const menuItems = document.getElementById('battle-menu-items');
    menuItems.innerHTML = '';

    let items = [];

    if (GameState.battle.menuState === 'main') {
        items = ['たたかう', 'どうぐ', 'にげる'];
    } else if (GameState.battle.menuState === 'moves') {
        items = GameState.battle.playerCreature.moves.map(moveId => {
            const moveData = getMoveData(moveId);
            return moveData ? moveData.name : moveId;
        });
    } else if (GameState.battle.menuState === 'items') {
        const itemNames = {
            'capture_orb': '捕獲オーブ',
            'heal_herb': '回復草'
        };
        items = Object.keys(GameState.items)
            .filter(k => GameState.items[k] > 0)
            .map(k => `${itemNames[k] || k} x${GameState.items[k]}`);

        if (items.length === 0) {
            items = ['どうぐがない'];
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

// ===== SPRITE DRAWING HELPERS =====
const Colors = {
    darkest: '#0f380f',
    dark: '#306230',
    light: '#8bac0f',
    lightest: '#9bbc0f'
};

function drawPlayer(ctx, x, y, direction) {
    // 主人公: 16x16のシンプルなキャラクター
    // ボディ（濃い緑）
    ctx.fillStyle = Colors.darkest;
    ctx.fillRect(x + 5, y + 4, 6, 8);  // 体

    // 頭（明るい緑）
    ctx.fillStyle = Colors.light;
    ctx.fillRect(x + 4, y + 2, 8, 4);  // 頭

    // 目（方向で変化）
    ctx.fillStyle = Colors.darkest;
    if (direction === 'up') {
        ctx.fillRect(x + 5, y + 2, 2, 1);
        ctx.fillRect(x + 9, y + 2, 2, 1);
    } else if (direction === 'down') {
        ctx.fillRect(x + 5, y + 4, 2, 1);
        ctx.fillRect(x + 9, y + 4, 2, 1);
    } else if (direction === 'left') {
        ctx.fillRect(x + 5, y + 3, 2, 1);
        ctx.fillRect(x + 8, y + 3, 2, 1);
    } else {  // right
        ctx.fillRect(x + 6, y + 3, 2, 1);
        ctx.fillRect(x + 10, y + 3, 2, 1);
    }

    // 脚
    ctx.fillStyle = Colors.dark;
    ctx.fillRect(x + 5, y + 12, 2, 2);
    ctx.fillRect(x + 9, y + 12, 2, 2);
}

function drawNPC(ctx, x, y, id = 'generic') {
    // NPC: IDに応じて異なるシルエットを描画

    // 足元の影（話しかけ可能NPC用）
    ctx.fillStyle = Colors.darkest;
    ctx.fillRect(x + 6, y + 14, 4, 1);  // 影

    switch(id) {
        case 'professor':
            // 博士: 帽子付き、白衣
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(x + 3, y + 1, 10, 2);  // 帽子
            ctx.fillStyle = Colors.light;
            ctx.fillRect(x + 4, y + 3, 8, 4);   // 頭
            ctx.fillStyle = Colors.lightest;
            ctx.fillRect(x + 5, y + 7, 6, 7);   // 白衣
            // 目
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(x + 5, y + 4, 2, 1);
            ctx.fillRect(x + 9, y + 4, 2, 1);
            // 白衣のポケット
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(x + 6, y + 9, 2, 2);
            break;

        case 'assistant':
            // 助手: 短髪、眼鏡風、白衣
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(x + 4, y + 2, 8, 3);   // 髪
            ctx.fillStyle = Colors.light;
            ctx.fillRect(x + 4, y + 4, 8, 3);   // 顔
            ctx.fillStyle = Colors.lightest;
            ctx.fillRect(x + 5, y + 7, 6, 7);   // 白衣
            // 眼鏡風
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(x + 5, y + 5, 2, 1);
            ctx.fillRect(x + 9, y + 5, 2, 1);
            ctx.fillRect(x + 7, y + 5, 2, 1);   // ブリッジ
            break;

        case 'rival':
            // ライバル: スパイキーな髪、元気な服
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(x + 5, y + 1, 2, 2);   // 髪の毛（左）
            ctx.fillRect(x + 9, y + 1, 2, 2);   // 髪の毛（右）
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(x + 4, y + 2, 8, 3);   // 髪
            ctx.fillStyle = Colors.light;
            ctx.fillRect(x + 4, y + 4, 8, 3);   // 顔
            ctx.fillStyle = Colors.light;
            ctx.fillRect(x + 5, y + 7, 6, 7);   // 服
            // 目
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(x + 5, y + 5, 2, 1);
            ctx.fillRect(x + 9, y + 5, 2, 1);
            // 服のライン
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(x + 8, y + 8, 1, 5);
            break;

        case 'elder':
            // 長老: 長い髭、暗いローブ
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(x + 4, y + 2, 8, 3);   // 髪（少なめ）
            ctx.fillStyle = Colors.light;
            ctx.fillRect(x + 4, y + 4, 8, 3);   // 顔
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(x + 4, y + 7, 8, 7);   // 暗いローブ
            // 目
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(x + 5, y + 5, 2, 1);
            ctx.fillRect(x + 9, y + 5, 2, 1);
            // 長い髭
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(x + 5, y + 6, 6, 1);
            ctx.fillRect(x + 5, y + 7, 2, 2);
            ctx.fillRect(x + 9, y + 7, 2, 2);
            break;

        case 'ancient_guide':
            // 古代の案内人: 頭飾り（バンダナ）、シンプルな服
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(x + 4, y + 2, 8, 1);   // 頭飾り
            ctx.fillStyle = Colors.light;
            ctx.fillRect(x + 4, y + 3, 8, 4);   // 顔
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(x + 5, y + 7, 6, 7);   // 服
            // 目
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(x + 5, y + 4, 2, 1);
            ctx.fillRect(x + 9, y + 4, 2, 1);
            // 頭飾りの結び目
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(x + 11, y + 2, 2, 2);
            break;

        default:
            // 一般村人（デフォルト）
            ctx.fillStyle = Colors.light;
            ctx.fillRect(x + 4, y + 2, 8, 4);   // 頭
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(x + 5, y + 6, 6, 8);   // 体
            // 目
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(x + 5, y + 3, 2, 1);
            ctx.fillRect(x + 9, y + 3, 2, 1);
    }
}

function drawCreature(ctx, x, y, creatureId, scale = 1) {
    // モンスター: IDに応じて異なる見た目
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    switch(creatureId) {
        case 'sproutail':  // メビー（草）
            ctx.fillStyle = Colors.light;
            ctx.fillRect(2, 4, 12, 8);  // 体
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(6, 2, 4, 4);   // 芽
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(5, 6, 2, 2);   // 目
            ctx.fillRect(9, 6, 2, 2);
            ctx.fillStyle = Colors.light;
            ctx.fillRect(4, 12, 3, 3);  // 尻尾（芽）
            break;

        case 'embercub':  // ヒコ（炎）
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(3, 4, 10, 7);  // 体
            ctx.fillStyle = Colors.light;
            ctx.fillRect(4, 2, 8, 4);   // 頭
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(5, 3, 2, 2);   // 目
            ctx.fillRect(9, 3, 2, 2);
            // 炎マーク
            ctx.fillStyle = Colors.light;
            ctx.fillRect(7, 1, 2, 2);
            break;

        case 'aquafin':  // スイヒレ（水）
            ctx.fillStyle = Colors.light;
            ctx.fillRect(4, 5, 8, 6);   // 体
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(2, 7, 4, 2);   // 左ヒレ
            ctx.fillRect(10, 7, 4, 2);  // 右ヒレ
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(6, 6, 1, 2);   // 目
            ctx.fillRect(9, 6, 1, 2);
            break;

        case 'windling':  // フウヨク（風）
            ctx.fillStyle = Colors.light;
            ctx.fillRect(5, 5, 6, 5);   // 体
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(3, 4, 3, 2);   // 左翼
            ctx.fillRect(10, 4, 3, 2);  // 右翼
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(6, 6, 1, 1);   // 目
            ctx.fillRect(9, 6, 1, 1);
            break;

        case 'rockhorn':  // ガンカク（岩）
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(3, 6, 10, 7);  // 体
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(5, 3, 6, 4);   // 角
            ctx.fillStyle = Colors.light;
            ctx.fillRect(5, 8, 2, 2);   // 目
            ctx.fillRect(9, 8, 2, 2);
            break;

        default:
            // デフォルト
            ctx.fillStyle = Colors.dark;
            ctx.fillRect(4, 4, 8, 8);
            ctx.fillStyle = Colors.darkest;
            ctx.fillRect(6, 6, 2, 2);
            ctx.fillRect(10, 6, 2, 2);
    }

    ctx.restore();
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
        const npcX = npc.x * TILE_SIZE - GameState.camera.x;
        const npcY = npc.y * TILE_SIZE - GameState.camera.y;
        drawNPC(ctx, npcX, npcY, npc.id);
    });

    // Render player
    const playerX = GameState.player.x * TILE_SIZE - GameState.camera.x;
    const playerY = GameState.player.y * TILE_SIZE - GameState.camera.y;
    drawPlayer(ctx, playerX, playerY, GameState.player.direction);

    // In battle mode, draw creatures
    if (GameState.mode === 'battle') {
        renderBattleCreatures();
    }
}

function renderBattleCreatures() {
    const { enemy, playerCreature } = GameState.battle;

    // Enemy creature (top right) - larger scale
    if (enemy) {
        drawCreature(ctx, 100, 20, enemy.id, 2.0);
    }

    // Player creature (bottom left) - larger scale, flipped
    if (playerCreature) {
        ctx.save();
        ctx.translate(50, 90);
        ctx.scale(-1.5, 1.5);  // 左右反転 + 拡大
        drawCreature(ctx, -16, 0, playerCreature.id, 1);
        ctx.restore();
    }
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
    console.log('時の絆：起源 - 読み込み中...');

    const loaded = await loadGameData();
    if (!loaded) {
        alert('ゲームデータの読み込みに失敗しました。ページを更新してください。');
        return;
    }

    setupControls();

    GameState.mode = 'field';

    // Show intro message
    showDialogue([
        '時の絆へようこそ！',
        '',
        '十字キーで移動します。',
        'Aボタンで調べる/話す。',
        'メニューでセーブ/ロード。',
        '',
        '研究所で最初のパートナーを',
        '受け取りましょう！'
    ]);

    gameLoop();
    updateStatusBar();
    console.log('ゲーム開始！');
}

// Start the game when page loads
window.addEventListener('load', init);
