// FOREST SURVIVAL - Zombie Game
// Version JavaScript modulaire avec 3 niveaux

const TILE_SIZE = 40;
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const FPS = 60;

const PLAYER_SPEED = 4;
const ZOMBIE_SPEED = 3;
const WEAPON_DURATION_MS = 5000;
const ZOMBIE_RESPAWN_TIME_MS = 20000;

const COLORS = {
    BG: "rgb(5, 20, 5)",
    WALL: "rgb(34, 139, 34)",
    RATION: "rgb(255, 215, 0)",
    HERO: "rgb(200, 255, 0)",
    WEAPON: "rgb(255, 69, 0)",
    VULNERABLE: "rgb(30, 144, 255)",
    TEXT: "rgb(240, 240, 240)"
};

const ZOMBIE_TYPES = [
    {name: "HUNTER", color: "rgb(0, 100, 0)"},
    {name: "COWARD", color: "rgb(144, 238, 144)"},
    {name: "CAMPER", color: "rgb(0, 128, 128)"},
    {name: "PATROL", color: "rgb(139, 69, 19)"},
    {name: "DRUNK", color: "rgb(105, 105, 105)"}
];

// NIVEAU 1: Labyrinthe modéré
const LEVEL_MAP_1 = [
    "WWWWWWWWWWWWWWWWWWWW",
    "WP.................W",
    "W.WW.WWWW..WWWW.WW.W",
    "W.W..............W.W",
    "W.W.WW.WW..WW.WW.W.W",
    "W.A....W....W....A.W",
    "W.WWWW.W.ZZ.W.WWWW.W",
    "W.......ZZZ........W",
    "W.WW.WWWW.WWWWW.WW.W",
    "W..................W",
    "W.WW.WW.WWWW.WW.WW.W",
    "W....A..........A..W",
    "WWWWWWWWWWWWWWWWWWWW"
];

// NIVEAU 2: Labyrinthe complexe avec plus de zombies
const LEVEL_MAP_2 = [
    "WWWWWWWWWWWWWWWWWWWW",
    "WP..A...Z..Z.......W",
    "W.WWWWW.W.W.WWWWWW.W",
    "W.W....Z..Z.....A..W",
    "W.W.ZWW.WWWWWW.WWW.W",
    "W.W.Z.W.....Z...Z..W",
    "W.WAW.WWWWW.WWWWW..W",
    "W...Z.Z.....Z.W....W",
    "W.WWWWW.WWWWW.WW...W",
    "W.A...Z.......ZW...W",
    "W.WWWW.WWWWWWWWW..AW",
    "W...........Z.....ZW",
    "W.............A....W",
    "WWWWWWWWWWWWWWWWWWWW"
];

// NIVEAU 3: Tête de mort (Skull) - L'APOCALYPSE
const LEVEL_MAP_3 = [
    "WWWWWWWWWWWWWWWWWWWW",
    "WP..A...Z..Z...Z...W",
    "W.WWWWW.W.W.WWWWWW.W",
    "W.W....Z..Z.....A..W",
    "W.W.ZWW.WWWWWW.WWW.W",
    "WZW.Z.W.....Z...Z..W",
    "W.WAW.WWWWW.WWWWW..W",
    "W...Z.Z..A..Z.W....W",
    "W.WWWWW.WWWWW.WW...W",
    "W.A...Z.......ZW...W",
    "W.WWWW.WW.WWWWWW..AW",
    "W......W..W.Z.....ZW",
    "W....WWW..W...A....W",
    "W.....Z.....Z....Z.W",
    "WWWWWWWWWWWWWWWWWWWW"
];

const LEVELS = [
    { map: LEVEL_MAP_1, name: "NIVEAU 1: LES DÉBUTS", desc: "5 zombies - Facile" },
    { map: LEVEL_MAP_2, name: "NIVEAU 2: LE CIMETIÈRE", desc: "10 zombies - Difficile" },
    { map: LEVEL_MAP_3, name: "NIVEAU 3: LE CRÂNE MAUDIT", desc: "20 zombies - Apocalypse!" }
];

// Variables globales
let canvas, ctx;
let uiLayer, uiTitle, uiSubtitle, uiBtn, uiDesc;
let walls = [], rations = [], weapons = [], zombies = [], player = null;
let currentLevel = 0;
let gameState = 'MENU';
let gameOver = false;
let victory = false;
let keys = {};

// Classe Entity - Entité de base
class Entity {
    constructor(gridX, gridY, color, sizeOffset = 0) {
        const size = TILE_SIZE - sizeOffset;
        this.w = size;
        this.h = size;
        this.x = gridX * TILE_SIZE + sizeOffset / 2;
        this.y = gridY * TILE_SIZE + sizeOffset / 2;
        this.color = color;
    }
    
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
    }
}

// Classe Wall - Murs avec texture
class Wall extends Entity {
    constructor(gridX, gridY) {
        super(gridX, gridY, COLORS.WALL, 0);
        this.texture = generateLeafTexture(TILE_SIZE, COLORS.WALL);
    }
    
    draw() {
        ctx.drawImage(this.texture, this.x, this.y);
    }
}

// Classe Player - Joueur
class Player extends Entity {
    constructor(gridX, gridY) {
        super(gridX, gridY, COLORS.HERO, 10);
        this.score = 0;
        this.weaponActive = false;
        this.weaponEndTime = 0;
    }

    update() {
        let dx = 0;
        let dy = 0;

        if (keys['ArrowLeft'] || keys['KeyA'] || keys['KeyQ']) dx = -PLAYER_SPEED;
        if (keys['ArrowRight'] || keys['KeyD']) dx = PLAYER_SPEED;
        if (keys['ArrowUp'] || keys['KeyW'] || keys['KeyZ']) dy = -PLAYER_SPEED;
        if (keys['ArrowDown'] || keys['KeyS']) dy = PLAYER_SPEED;

        this.x += dx;
        for (let w of walls) {
            if (checkRectCollision(this, w)) {
                if (dx > 0) this.x = w.x - this.w;
                else if (dx < 0) this.x = w.x + w.w;
            }
        }

        this.y += dy;
        for (let w of walls) {
            if (checkRectCollision(this, w)) {
                if (dy > 0) this.y = w.y - this.h;
                else if (dy < 0) this.y = w.y + w.h;
            }
        }

        if (this.weaponActive && Date.now() > this.weaponEndTime) {
            this.weaponActive = false;
        }
    }
}

// Classe Zombie - Ennemis zombies
class Zombie extends Entity {
    constructor(gridX, gridY, typeIndex) {
        const type = ZOMBIE_TYPES[typeIndex % ZOMBIE_TYPES.length];
        super(gridX, gridY, type.color, 8);
        this.baseColor = type.color;
        this.typeName = type.name;
        this.spawnPos = { x: this.x, y: this.y };
        this.dx = 0;
        this.dy = 0;
        this.isDead = false;
        this.deathTime = 0;
        this.startDelay = Math.floor(Math.random() * 60);
        this.pickRandomDirection();
    }

    getGridPos() {
        return {
            col: Math.floor(this.x / TILE_SIZE),
            row: Math.floor(this.y / TILE_SIZE)
        };
    }

    pickRandomDirection() {
        const dirs = [{x:0, y:1}, {x:0, y:-1}, {x:1, y:0}, {x:-1, y:0}];
        const shuffled = dirs.sort(() => Math.random() - 0.5);
        const gridPos = this.getGridPos();
        
        for (let dir of shuffled) {
            if (!isWall(gridPos.col + dir.x, gridPos.row + dir.y)) {
                this.dx = dir.x;
                this.dy = dir.y;
                return;
            }
        }
        this.dx = 0;
        this.dy = 0;
    }

    die() {
        this.isDead = true;
        this.deathTime = Date.now();
        this.x = -1000;
        this.y = -1000;
    }

    respawn() {
        this.isDead = false;
        this.x = this.spawnPos.x;
        this.y = this.spawnPos.y;
        this.color = this.baseColor;
        this.startDelay = 60;
        this.pickRandomDirection();
    }

    update() {
        if (this.isDead) {
            if (Date.now() - this.deathTime > ZOMBIE_RESPAWN_TIME_MS) {
                this.respawn();
            }
            return;
        }

        if (this.startDelay > 0) {
            this.startDelay--;
            return;
        }

        const speed = player.weaponActive ? 1 : ZOMBIE_SPEED;
        this.color = player.weaponActive ? COLORS.VULNERABLE : this.baseColor;

        if (this.dx === 0 && this.dy === 0) {
            this.pickRandomDirection();
        }

        this.x += this.dx * speed;
        this.y += this.dy * speed;

        let hitWall = false;
        for (let w of walls) {
            if (checkRectCollision(this, w)) {
                hitWall = true;
                this.x -= this.dx * speed;
                this.y -= this.dy * speed;
                break;
            }
        }

        if (hitWall || Math.random() < 0.02) {
            this.pickRandomDirection();
        }
    }
}

// Fonctions utilitaires
function generateLeafTexture(size, baseColor) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.fillStyle = baseColor;
    tempCtx.fillRect(0, 0, size, size);
    
    const leafTones = [
        "rgb(50, 205, 50)",
        "rgb(34, 139, 34)",
        "rgb(0, 100, 0)",
        "rgb(85, 107, 47)"
    ];
    
    for (let i = 0; i < 30; i++) {
        const patchSize = 6 + Math.random() * 8;
        const x = Math.random() * (size - patchSize);
        const y = Math.random() * (size - patchSize);
        tempCtx.fillStyle = leafTones[Math.floor(Math.random() * leafTones.length)];
        tempCtx.fillRect(x, y, patchSize, patchSize);
    }
    
    return tempCanvas;
}

function isWall(col, row) {
    const map = LEVELS[currentLevel].map;
    if (row < 0 || row >= map.length || col < 0 || col >= map[0].length) {
        return true;
    }
    return map[row][col] === 'W';
}

function checkRectCollision(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function selectLevel(levelIndex) {
    currentLevel = levelIndex;
    const level = LEVELS[levelIndex];
    uiTitle.textContent = level.name;
    uiSubtitle.textContent = level.desc;
}

function initGame() {
    walls = [];
    rations = [];
    weapons = [];
    zombies = [];
    player = null;
    gameOver = false;
    victory = false;
    
    const map = LEVELS[currentLevel].map;
    let zCount = 0;

    for (let row = 0; row < map.length; row++) {
        for (let col = 0; col < map[row].length; col++) {
            const char = map[row][col];
            
            if (char === 'W') {
                walls.push(new Wall(col, row));
            } else if (char === '.') {
                rations.push(new Entity(col, row, COLORS.RATION, 30));
            } else if (char === 'A') {
                weapons.push(new Entity(col, row, COLORS.WEAPON, 15));
            } else if (char === 'P') {
                player = new Player(col, row);
            } else if (char === 'Z') {
                zombies.push(new Zombie(col, row, zCount));
                zCount++;
            }
        }
    }
    
    if (!player) {
        player = new Player(1, 1);
    }
}

function handleCollisions() {
    // Collecte des rations
    for (let i = rations.length - 1; i >= 0; i--) {
        if (checkRectCollision(player, rations[i])) {
            player.score += 10;
            rations.splice(i, 1);
        }
    }
    
    if (rations.length === 0) {
        victory = true;
    }

    // Collecte des armes
    for (let i = weapons.length - 1; i >= 0; i--) {
        if (checkRectCollision(player, weapons[i])) {
            player.weaponActive = true;
            player.weaponEndTime = Date.now() + WEAPON_DURATION_MS;
            weapons.splice(i, 1);
        }
    }

    // Collision avec zombies
    for (let z of zombies) {
        if (!z.isDead && checkRectCollision(player, z)) {
            if (player.weaponActive) {
                z.die();
                player.score += 50;
            } else {
                gameOver = true;
            }
        }
    }
}

function drawUI() {
    ctx.fillStyle = COLORS.TEXT;
    ctx.font = "24px Arial";
    ctx.fillText("SCORE: " + player.score, 20, 30);
    ctx.fillText("RATIONS: " + rations.length, 20, 60);
    ctx.fillText("NIVEAU: " + (currentLevel + 1), SCREEN_WIDTH - 200, 30);

    if (player.weaponActive) {
        const remaining = Math.ceil((player.weaponEndTime - Date.now()) / 1000);
        ctx.fillStyle = COLORS.WEAPON;
        ctx.fillText("ARME ACTIVE: " + remaining + "s", 20, 90);
    }

    if (gameOver || victory) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        
        ctx.font = "64px Arial";
        ctx.fillStyle = victory ? "rgb(200, 255, 0)" : "rgb(255, 69, 0)";
        const msg = victory ? "VICTOIRE !" : "GAME OVER";
        const textWidth = ctx.measureText(msg).width;
        ctx.fillText(msg, (SCREEN_WIDTH - textWidth) / 2, SCREEN_HEIGHT / 2);
        
        ctx.font = "24px Arial";
        ctx.fillStyle = COLORS.TEXT;
        
        if (victory && currentLevel < LEVELS.length - 1) {
            const nextMsg = "Prêt pour le niveau " + (currentLevel + 2) + "? Appuyez sur 'N'";
            const nextWidth = ctx.measureText(nextMsg).width;
            ctx.fillText(nextMsg, (SCREEN_WIDTH - nextWidth) / 2, SCREEN_HEIGHT / 2 + 60);
            
            const retryMsg = "Ou appuyez sur 'R' pour rejouer ce niveau";
            const retryWidth = ctx.measureText(retryMsg).width;
            ctx.fillText(retryMsg, (SCREEN_WIDTH - retryWidth) / 2, SCREEN_HEIGHT / 2 + 100);
        } else {
            const retryMsg = "Appuyez sur 'R' pour rejouer";
            const retryWidth = ctx.measureText(retryMsg).width;
            ctx.fillText(retryMsg, (SCREEN_WIDTH - retryWidth) / 2, SCREEN_HEIGHT / 2 + 60);
            
            if (victory) {
                const endMsg = "Vous avez complété tous les niveaux!";
                const endWidth = ctx.measureText(endMsg).width;
                ctx.fillText(endMsg, (SCREEN_WIDTH - endWidth) / 2, SCREEN_HEIGHT / 2 + 100);
            }
        }
    }
}

function gameLoop() {
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    if (gameState === 'PLAYING') {
        if (!gameOver && !victory) {
            player.update();
            zombies.forEach(z => z.update());
            handleCollisions();
        }
        
        walls.forEach(w => w.draw());
        rations.forEach(r => r.draw());
        weapons.forEach(w => w.draw());
        zombies.forEach(z => { if (!z.isDead) z.draw(); });
        player.draw();
        drawUI();
    }
    
    requestAnimationFrame(gameLoop);
}

// Événements clavier
function setupKeyboardEvents() {
    document.addEventListener('keydown', e => keys[e.code] = true);
    document.addEventListener('keyup', e => keys[e.code] = false);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') {
            if (gameOver || victory) {
                initGame();
                gameState = 'PLAYING';
            }
        }
        if (e.key === 'n' || e.key === 'N') {
            if (victory && currentLevel < LEVELS.length - 1) {
                currentLevel++;
                const level = LEVELS[currentLevel];
                uiTitle.textContent = level.name;
                uiSubtitle.textContent = level.desc;
                initGame();
                gameState = 'PLAYING';
            }
        }
    });
}

// Événements UI
function setupUIEvents() {
    document.getElementById('levelBtn1').addEventListener('click', () => selectLevel(0));
    document.getElementById('levelBtn2').addEventListener('click', () => selectLevel(1));
    document.getElementById('levelBtn3').addEventListener('click', () => selectLevel(2));

    uiBtn.addEventListener('click', () => {
        initGame();
        gameState = 'PLAYING';
        uiLayer.style.display = 'none';
    });
}

// Initialisation
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    uiLayer = document.getElementById('ui-layer');
    uiTitle = document.getElementById('ui-title');
    uiSubtitle = document.getElementById('ui-subtitle');
    uiBtn = document.getElementById('ui-btn');
    
    // Ajout de uiDesc ici, en toute sécurité, après le chargement du DOM
    uiDesc = document.getElementById('ui-desc');

    setupKeyboardEvents();
    setupUIEvents();

    selectLevel(0);
    uiLayer.style.display = 'flex';
    requestAnimationFrame(gameLoop);
}

// Démarrer quand le DOM est prêt
document.addEventListener('DOMContentLoaded', init);