        document.addEventListener('DOMContentLoaded', function() {
            
            // --- CONFIGURATION GEMINI (API) ---
            const GEMINI_API_KEY = "CLE_SECCRETE_A_REMPLACER_PAR_GITHUB"; 
            
            /* =========================================
               0. GESTION DE LA DIFFICULTÉ ET MODES
               ========================================= */
            let niveauDifficulte = 'normal';
            
            const boutonsDifficulte = document.querySelectorAll('.btn-diff');
            boutonsDifficulte.forEach(btn => {
                btn.addEventListener('click', function() {
                    boutonsDifficulte.forEach(b => b.classList.remove('selected'));
                    this.classList.add('selected');
                    niveauDifficulte = this.getAttribute('data-level');
                    console.log("Mode choisi : " + niveauDifficulte);
                });
            });

            /* =========================================
               1. LOGIQUE DE LA CALCULATRICE
               ========================================= */
            const ecran = document.querySelector('.ecran');
            document.querySelectorAll('table.calculatrice td').forEach(touche => {
                touche.addEventListener('click', function() {
                    if (this.classList.contains('ecran')) return;
                    const val = this.innerText;
                    
                    if (this.classList.contains('egal')) {
                        try { ecran.innerText = eval(ecran.innerText.replace(/×/g, '*').replace(/÷/g, '/')); } 
                        catch { ecran.innerText = "Erreur"; }
                    } 
                    else if (val === '←') {
                        ecran.innerText = ecran.innerText.slice(0, -1) || '0';
                    } 
                    else if(val == 'c') {
                        ecran.innerText = '0';
                    }
                    else {
                        ecran.innerText = (ecran.innerText === '0' || ecran.innerText === 'Erreur') ? val : ecran.innerText + val;
                    }
                });
            });

            /* =========================================
               2. LOGIQUE JEU D'ÉCHECS (MOTEUR)
               ========================================= */
            
            let tourActuel = 'blanc'; 
            let caseSelectionnee = null;
            let jeuFini = false;
            let iaReflechit = false; 
            
            const indicateurTour = document.getElementById('tour-indicateur');
            const cases = Array.from(document.querySelectorAll('.echiquier td')); 
            const ecranVictoire = document.getElementById('ecran-victoire');
            const texteVictoire = document.getElementById('texte-victoire');

            function getCoords(td) {
                const index = cases.indexOf(td);
                return { x: index % 8, y: Math.floor(index / 8) };
            }

            function getCaseAt(x, y) {
                if (x < 0 || x > 7 || y < 0 || y > 7) return null;
                return cases[y * 8 + x];
            }

            function getNotation(index) {
                const x = index % 8;
                const y = Math.floor(index / 8);
                const col = String.fromCharCode(97 + x);
                const row = 8 - y; 
                return col + row;
            }

            // CORRECTION : Vérifie si le chemin est libre ET si le déplacement est valide
            function checkCheminLibre(pos1, pos2) {
                // Si c'est la même position, invalide
                if (pos1.x === pos2.x && pos1.y === pos2.y) return false;
                
                const stepX = Math.sign(pos2.x - pos1.x);
                const stepY = Math.sign(pos2.y - pos1.y);
                let currentX = pos1.x + stepX;
                let currentY = pos1.y + stepY;
                
                // Vérifie toutes les cases intermédiaires (pas la destination)
                while (currentX !== pos2.x || currentY !== pos2.y) {
                    const caseIntermediaire = getCaseAt(currentX, currentY);
                    if (!caseIntermediaire || caseIntermediaire.querySelector('.piece')) return false; 
                    currentX += stepX;
                    currentY += stepY;
                }
                return true;
            }

            function genererFEN() {
                let fen = "";
                for (let y = 0; y < 8; y++) {
                    let emptyCount = 0;
                    for (let x = 0; x < 8; x++) {
                        const td = getCaseAt(x, y);
                        const piece = td.querySelector('.piece');
                        if (!piece) {
                            emptyCount++;
                        } else {
                            if (emptyCount > 0) { fen += emptyCount; emptyCount = 0; }
                            const type = piece.getAttribute('data-type');
                            const color = piece.getAttribute('data-couleur');
                            let char = '';
                            switch(type) {
                                case 'tour': char = 'r'; break;
                                case 'cavalier': char = 'n'; break;
                                case 'fou': char = 'b'; break;
                                case 'reine': char = 'q'; break;
                                case 'roi': char = 'k'; break;
                                case 'pion': char = 'p'; break;
                            }
                            if (color === 'blanc') char = char.toUpperCase();
                            fen += char;
                        }
                    }
                    if (emptyCount > 0) fen += emptyCount;
                    if (y < 7) fen += "/";
                }
                fen += " b - - 0 1";
                return fen;
            }

            cases.forEach(td => {
                td.addEventListener('click', function() {
                    if (jeuFini || iaReflechit) return;
                    if (tourActuel === 'noir' && niveauDifficulte !== 'pvp') return;

                    const pieceSurCase = this.querySelector('.piece');
                    
                    if (!caseSelectionnee) {
                        if (pieceSurCase && pieceSurCase.getAttribute('data-couleur') === tourActuel) {
                            selectionnerCase(this);
                        }
                    } 
                    else {
                        if (caseSelectionnee === this) { resetSelection(); return; }
                        
                        if (pieceSurCase && pieceSurCase.getAttribute('data-couleur') === tourActuel) {
                            resetSelection();
                            selectionnerCase(this);
                            return;
                        }

                        if (estCoupValide(caseSelectionnee, this)) {
                            effectuerDeplacement(caseSelectionnee, this);
                            
                            if (!jeuFini) {
                                changerTour(); 
                                if (niveauDifficulte !== 'pvp') {
                                    setTimeout(jouerIA_Manager, 100); 
                                }
                            }
                        }
                        resetSelection();
                    }
                });
            });

            function selectionnerCase(td) {
                caseSelectionnee = td;
                td.classList.add('case-selected');
                montrerCoupsPossibles(td);
            }

            function resetSelection() {
                cases.forEach(c => { c.classList.remove('case-selected'); c.classList.remove('coup-possible'); });
                caseSelectionnee = null;
            }

            function montrerCoupsPossibles(td) {
                cases.forEach(cible => {
                    if (estCoupValide(td, cible)) {
                        cible.classList.add('coup-possible');
                    }
                });
            }

            function effectuerDeplacement(caseOrigine, caseDestination) {
                const piece = caseOrigine.querySelector('.piece');
                const pieceCapturee = caseDestination.querySelector('.piece');

                if (pieceCapturee) {
                    const typeCap = pieceCapturee.getAttribute('data-type');
                    if (typeCap === 'roi') {
                        declencherVictoire(tourActuel);
                        return;
                    }
                    pieceCapturee.remove();
                }

                caseDestination.appendChild(piece);
            }

            function changerTour() {
                tourActuel = (tourActuel === 'blanc') ? 'noir' : 'blanc';
                indicateurTour.innerText = (tourActuel === 'blanc') ? 'BLANCS' : 'NOIRS';
            }

            function declencherVictoire(couleur) {
                jeuFini = true;
                const nomVainqueur = couleur.toUpperCase();
                texteVictoire.innerHTML = `🏆 Les ${nomVainqueur} ont gagné !`;
                ecranVictoire.style.display = 'flex';
            }

            // CORRECTION : Logique améliorée pour la validation des coups
            function estCoupValide(caseDepart, caseArrivee) {
                const piece = caseDepart.querySelector('.piece');
                if (!piece) return false;

                const pieceType = piece.getAttribute('data-type');
                const pieceCouleur = piece.getAttribute('data-couleur');
                const pos1 = getCoords(caseDepart);
                const pos2 = getCoords(caseArrivee);
                const dx = Math.abs(pos2.x - pos1.x);
                const dy = Math.abs(pos2.y - pos1.y);

                const pieceDestination = caseArrivee.querySelector('.piece');
                if (pieceDestination && pieceDestination.getAttribute('data-couleur') === pieceCouleur) {
                    return false;
                }

                switch (pieceType) {
                    case 'pion':
                        const direction = (pieceCouleur === 'blanc') ? -1 : 1;
                        const ligneDepart = (pieceCouleur === 'blanc') ? 6 : 1;
                        
                        if (pos2.x === pos1.x && pos2.y === pos1.y + direction && !pieceDestination) {
                            return true;
                        }
                        if (pos2.x === pos1.x && pos1.y === ligneDepart && pos2.y === pos1.y + 2 * direction) {
                            const caseIntermediaire = getCaseAt(pos1.x, pos1.y + direction);
                            if (!pieceDestination && !caseIntermediaire.querySelector('.piece')) {
                                return true;
                            }
                        }
                        if (dx === 1 && pos2.y === pos1.y + direction && pieceDestination) {
                            return true;
                        }
                        return false;

                    case 'tour':
                        // Doit se déplacer en ligne droite (horizontal ou vertical)
                        if (pos1.x !== pos2.x && pos1.y !== pos2.y) return false;
                        return checkCheminLibre(pos1, pos2);

                    case 'cavalier':
                        return (dx === 2 && dy === 1) || (dx === 1 && dy === 2);

                    case 'fou':
                        // Doit se déplacer en diagonale
                        if (dx !== dy) return false;
                        return checkCheminLibre(pos1, pos2);

                    case 'reine':
                        // Peut se déplacer en ligne droite ou en diagonale
                        const estLigneDroite = (pos1.x === pos2.x || pos1.y === pos2.y);
                        const estDiagonale = (dx === dy);
                        if (!estLigneDroite && !estDiagonale) return false;
                        return checkCheminLibre(pos1, pos2);

                    case 'roi':
                        return dx <= 1 && dy <= 1 && (dx > 0 || dy > 0);
                }
                return false;
            }

            async function jouerIA_Manager() {
                if (tourActuel !== 'noir') return;
                if (jeuFini) return;

                iaReflechit = true; 
                indicateurTour.innerText = 'L\'IA RÉFLÉCHIT...';

                if (niveauDifficulte === 'facile') {
                    await jouerIA_Aleatoire();
                } 
                else if (niveauDifficulte === 'normal' || niveauDifficulte === 'difficile' || niveauDifficulte === 'extreme') {
                    await jouerIA_Gemini();
                } 
                else {
                    await jouerIA_Aleatoire();
                }

                iaReflechit = false;
            }

            async function jouerIA_Aleatoire() {
                await new Promise(r => setTimeout(r, 500));

                const piecesNoires = cases.filter(c => {
                    const p = c.querySelector('.piece');
                    return p && p.getAttribute('data-couleur') === 'noir';
                });

                let coupTrouve = false;
                let tentatives = 0;

                while (!coupTrouve && tentatives < 100) {
                    const origine = piecesNoires[Math.floor(Math.random() * piecesNoires.length)];
                    const destination = cases[Math.floor(Math.random() * cases.length)];

                    if (estCoupValide(origine, destination)) {
                        effectuerDeplacement(origine, destination);
                        changerTour();
                        coupTrouve = true;
                    }
                    tentatives++;
                }

                if (!coupTrouve) {
                    console.error("IA : Aucun coup valide trouvé après 100 tentatives.");
                }
            }

            async function jouerIA_Gemini() {
                const fen = genererFEN();
                console.log("FEN envoyé à Gemini:", fen);

                const promptBase = `Tu es un moteur d'échecs expert. 
Voici la position actuelle en notation FEN : ${fen}
C'est aux NOIRS de jouer.
Réponds UNIQUEMENT avec un coup au format : e7e5 (sans espace ni texte supplémentaire).
Choisis le meilleur coup possible.`;

                let prompt = promptBase;

                if (niveauDifficulte === 'difficile') {
                    prompt += "\n⚠️ IMPORTANT : Analyse très attentivement la position. Priorise les captures, les menaces, et la sécurité du roi.";
                } else if (niveauDifficulte === 'extreme') {
                    prompt += "\n⚠️ MODE EXTRÊME : Calcule plusieurs coups à l'avance. Cherche les combinaisons tactiques, les échecs et mats en 2-3 coups.";
                }

                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`Erreur API : ${response.status}`);
                    }

                    const data = await response.json();
                    const texteReponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

                    if (!texteReponse) {
                        throw new Error("Réponse vide de Gemini.");
                    }

                    console.log("Réponse brute Gemini:", texteReponse);
                    const coup = texteReponse.match(/[a-h][1-8][a-h][1-8]/)?.[0];

                    if (!coup) {
                        throw new Error(`Format invalide : ${texteReponse}`);
                    }

                    console.log("Coup détecté:", coup);
                    executerCoup(coup);
                    changerTour();

                } catch (err) {
                    console.error("Erreur IA Gemini:", err);
                    console.warn("→ Basculement sur l'IA aléatoire...");
                    await jouerIA_Aleatoire();
                }
            }

            function executerCoup(coup) {
                const colDepart = coup[0].charCodeAt(0) - 97;
                const ligneDepart = 8 - parseInt(coup[1]);
                const colArrivee = coup[2].charCodeAt(0) - 97;
                const ligneArrivee = 8 - parseInt(coup[3]);

                const caseOrigine = getCaseAt(colDepart, ligneDepart);
                const caseDestination = getCaseAt(colArrivee, ligneArrivee);

                if (caseOrigine && caseDestination && estCoupValide(caseOrigine, caseDestination)) {
                    effectuerDeplacement(caseOrigine, caseDestination);
                } else {
                    console.error("Coup invalide reçu de Gemini:", coup);
                }
            }

/* =========================================
   3. JEU ZOMBIE "FOREST SURVIVAL" - VERSION PYTHON ADAPTÉE
   ========================================= */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui-layer');
const uiTitle = document.getElementById('ui-title');
const uiSubtitle = document.getElementById('ui-subtitle');
const uiBtn = document.getElementById('ui-btn');

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
    {name: "HUNTER", color: "rgb(0, 100, 0)"},      // Traqueur
    {name: "COWARD", color: "rgb(144, 238, 144)"},  // Froussard
    {name: "CAMPER", color: "rgb(0, 128, 128)"},    // Observateur
    {name: "PATROL", color: "rgb(139, 69, 19)"},    // Patrouilleur
    {name: "DRUNK", color: "rgb(105, 105, 105)"}    // Ivre
];

const LEVEL_MAP = [
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

let walls = [], rations = [], weapons = [], zombies = [], player = null;
let gameState = 'MENU';
let gameOver = false;
let victory = false;
let keys = {};

document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

function isWall(col, row) {
    if (row < 0 || row >= LEVEL_MAP.length || col < 0 || col >= LEVEL_MAP[0].length) {
        return true;
    }
    return LEVEL_MAP[row][col] === 'W';
}

function checkRectCollision(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

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

class Wall extends Entity {
    constructor(gridX, gridY) {
        super(gridX, gridY, COLORS.WALL, 0);
        this.texture = generateLeafTexture(TILE_SIZE, COLORS.WALL);
    }
    
    draw() {
        ctx.drawImage(this.texture, this.x, this.y);
    }
}

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

function initGame() {
    walls = [];
    rations = [];
    weapons = [];
    zombies = [];
    player = null;
    gameOver = false;
    victory = false;
    
    let zCount = 0;

    for (let row = 0; row < LEVEL_MAP.length; row++) {
        for (let col = 0; col < LEVEL_MAP[row].length; col++) {
            const char = LEVEL_MAP[row][col];
            
            if (char === 'W') {
                walls.push(new Wall(col, row));
            } else if (char === '.') {
                rations.push(new Entity(col, row, COLORS.RATION, 30));
            } else if (char === 'A') {
                weapons.push(new Entity(col, row, COLORS.WEAPON, 15));
            } else if (char === 'P') {
                player = new Player(col, row);
            } else if (char === 'Z') {
                if (zCount < ZOMBIE_TYPES.length) {
                    zombies.push(new Zombie(col, row, zCount));
                    zCount++;
                }
            }
        }
    }
    
    if (!player) {
        player = new Player(1, 1);
    }
}

function handleCollisions() {
    for (let i = rations.length - 1; i >= 0; i--) {
        if (checkRectCollision(player, rations[i])) {
            player.score += 10;
            rations.splice(i, 1);
        }
    }
    
    if (rations.length === 0) {
        victory = true;
    }

    for (let i = weapons.length - 1; i >= 0; i--) {
        if (checkRectCollision(player, weapons[i])) {
            player.weaponActive = true;
            player.weaponEndTime = Date.now() + WEAPON_DURATION_MS;
            weapons.splice(i, 1);
        }
    }

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

    if (player.weaponActive) {
        const remaining = Math.ceil((player.weaponEndTime - Date.now()) / 1000);
        ctx.fillStyle = COLORS.WEAPON;
        ctx.fillText("POWER: " + remaining + "s", 20, 60);
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
        const retryMsg = "Appuyez sur 'R' pour rejouer";
        const retryWidth = ctx.measureText(retryMsg).width;
        ctx.fillText(retryMsg, (SCREEN_WIDTH - retryWidth) / 2, SCREEN_HEIGHT / 2 + 60);
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

uiBtn.addEventListener('click', () => {
    initGame();
    gameState = 'PLAYING';
    uiLayer.style.display = 'none';
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        if (gameOver || victory) {
            initGame();
        }
    }
});

uiLayer.style.display = 'flex';
requestAnimationFrame(gameLoop);

}); // FIN DU document.addEventListener('DOMContentLoaded')
