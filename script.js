        document.addEventListener('DOMContentLoaded', function() {
            
            // --- CONFIGURATION GEMINI (API) ---
            // Clé API pour connecter Google Gemini 1.5 Flash
            // --- CONFIGURATION GEMINI (API) ---
            // Clé API masquée pour GitHub (sera remplacée automatiquement)
            const GEMINI_API_KEY = "github-pages"; 
            
            /* =========================================
               0. GESTION DE LA DIFFICULTÉ ET MODES
               ========================================= */
            let niveauDifficulte = 'normal'; // Par défaut
            
            // Sélection des boutons
            const boutonsDifficulte = document.querySelectorAll('.btn-diff');
            boutonsDifficulte.forEach(btn => {
                btn.addEventListener('click', function() {
                    // Retire la classe 'selected' de tous les boutons
                    boutonsDifficulte.forEach(b => b.classList.remove('selected'));
                    // Ajoute la classe 'selected' au bouton cliqué
                    this.classList.add('selected');
                    // Met à jour la variable globale de difficulté
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
                    
                    // Si touche "="
                    if (this.classList.contains('egal')) {
                        try { ecran.innerText = eval(ecran.innerText.replace(/×/g, '*').replace(/÷/g, '/')); } 
                        catch { ecran.innerText = "Erreur"; }
                    } 
                    // Si touche Effacer (Flèche)
                    else if (val === '←') {
                        ecran.innerText = ecran.innerText.slice(0, -1) || '0';
                    } 
                    else if(val == 'c') {
                        ecran.innerText = '0';
                    }
                    // Autres touches (Chiffres/Opérateurs)
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

            // --- Fonctions Utilitaires (Coordonnées) ---
            
            // Retourne X,Y depuis un élément TD
            function getCoords(td) {
                const index = cases.indexOf(td);
                return { x: index % 8, y: Math.floor(index / 8) };
            }

            // Retourne l'élément TD depuis X,Y
            function getCaseAt(x, y) {
                if (x < 0 || x > 7 || y < 0 || y > 7) return null;
                return cases[y * 8 + x];
            }

            // Convertit un index en notation échecs (ex: 0 -> a8, 63 -> h1)
            function getNotation(index) {
                const x = index % 8;
                const y = Math.floor(index / 8);
                const col = String.fromCharCode(97 + x); // a,b,c...
                const row = 8 - y; 
                return col + row;
            }

            // Vérifie si la voie est libre pour les Tours, Fous, Reines
            function checkCheminLibre(pos1, pos2) {
                const stepX = Math.sign(pos2.x - pos1.x);
                const stepY = Math.sign(pos2.y - pos1.y);
                let currentX = pos1.x + stepX;
                let currentY = pos1.y + stepY;
                while (currentX !== pos2.x || currentY !== pos2.y) {
                    if (getCaseAt(currentX, currentY).querySelector('.piece')) return false; 
                    currentX += stepX;
                    currentY += stepY;
                }
                return true;
            }

            // --- GÉNÉRATEUR FEN (VISION POUR L'IA) ---
            // Cette fonction "lit" le tableau HTML et crée une chaine de caractères que l'IA comprend
            // Exemple : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
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
                            // Mapping type -> Lettre
                            switch(type) {
                                case 'tour': char = 'r'; break;
                                case 'cavalier': char = 'n'; break;
                                case 'fou': char = 'b'; break;
                                case 'reine': char = 'q'; break;
                                case 'roi': char = 'k'; break;
                                case 'pion': char = 'p'; break;
                            }
                            // Majuscule = Blanc, Minuscule = Noir
                            if (color === 'blanc') char = char.toUpperCase();
                            fen += char;
                        }
                    }
                    if (emptyCount > 0) fen += emptyCount;
                    if (y < 7) fen += "/";
                }
                // Métadonnées standards (Tour aux noirs, etc)
                fen += " b - - 0 1";
                return fen;
            }

            // --- GESTIONNAIRE DE CLICS (Cœur du jeu) ---
            cases.forEach(td => {
                td.addEventListener('click', function() {
                    // Sécurité : Si le jeu est fini ou si l'IA réfléchit, on bloque tout
                    if (jeuFini || iaReflechit) return;

                    // Sécurité : Si c'est aux Noirs de jouer, on bloque le joueur
                    // SAUF si on est en mode "PvP" (1 vs 1)
                    if (tourActuel === 'noir' && niveauDifficulte !== 'pvp') return;

                    const pieceSurCase = this.querySelector('.piece');
                    
                    // --- CAS 1 : Aucune case n'est sélectionnée ---
                    if (!caseSelectionnee) {
                        // On ne peut sélectionner qu'une pièce de SA couleur
                        if (pieceSurCase && pieceSurCase.getAttribute('data-couleur') === tourActuel) {
                            selectionnerCase(this);
                        }
                    } 
                    // --- CAS 2 : Une case est déjà sélectionnée ---
                    else {
                        // Si on clique sur la même case -> Désélectionner
                        if (caseSelectionnee === this) { resetSelection(); return; }
                        
                        // Si on clique sur une autre pièce amie -> Changer la sélection
                        if (pieceSurCase && pieceSurCase.getAttribute('data-couleur') === tourActuel) {
                            resetSelection();
                            selectionnerCase(this);
                            return;
                        }

                        // Si le coup est valide vers la case cible
                        if (estCoupValide(caseSelectionnee, this)) {
                            effectuerDeplacement(caseSelectionnee, this);
                            
                            if (!jeuFini) {
                                changerTour(); 
                                // IMPORTANT : On ne déclenche l'IA que si on n'est PAS en mode PvP
                                if (niveauDifficulte !== 'pvp') {
                                    setTimeout(jouerIA_Manager, 100); 
                                }
                            }
                        }
                        resetSelection();
                    }
                });
            });

            // Fonctions visuelles de sélection
            function selectionnerCase(td) {
                caseSelectionnee = td;
                td.classList.add('case-selected');
                montrerCoupsPossibles(td);
            }

            function resetSelection() {
                cases.forEach(c => { c.classList.remove('case-selected'); c.classList.remove('coup-possible'); });
                caseSelectionnee = null;
            }

            function montrerCoupsPossibles(depart) {
                cases.forEach(arrivee => {
                    if (arrivee !== depart && estCoupValide(depart, arrivee)) {
                        arrivee.classList.add('coup-possible');
                    }
                });
            }

            // Gestion du changement de tour
            function changerTour() {
                tourActuel = (tourActuel === 'blanc') ? 'noir' : 'blanc';
                indicateurTour.innerText = tourActuel.toUpperCase() + "S";
                indicateurTour.style.color = (tourActuel === 'blanc') ? '#00d4ff' : '#ff0055';
                
                // On affiche "IA Réfléchit" seulement si ce n'est pas du PvP
                if(tourActuel === 'noir' && niveauDifficulte !== 'pvp') {
                    indicateurTour.innerHTML += " <small>(IA Réfléchit...)</small>";
                }
            }

            // Exécution du mouvement physique (DOM)
            function effectuerDeplacement(depart, arrivee) {
                const piece = depart.querySelector('.piece');
                const cible = arrivee.querySelector('.piece');
                
                // Si on mange le Roi -> VICTOIRE
                if (cible && cible.getAttribute('data-type') === 'roi') {
                    declencherVictoire();
                    arrivee.innerHTML = ''; 
                    arrivee.appendChild(piece); 
                    return;
                }

                // Manger une pièce normale
                if (arrivee.firstChild) arrivee.innerHTML = ''; 
                arrivee.appendChild(piece);
                
                // Petite animation CSS
                arrivee.animate([ { transform: 'scale(1.2)' }, { transform: 'scale(1)' } ], { duration: 200 });
            }

            // Affichage Modal Victoire
            function declencherVictoire() {
                jeuFini = true;
                ecranVictoire.style.display = 'flex'; 
                if (tourActuel === 'blanc') {
                    texteVictoire.innerText = "LES BLANCS GAGNENT !";
                    texteVictoire.style.color = "#00d4ff"; 
                } else {
                    texteVictoire.innerText = (niveauDifficulte === 'pvp') ? "LES NOIRS GAGNENT !" : "GEMINI A GAGNÉ !";
                    texteVictoire.style.color = "#ff0055"; 
                }
            }

            // --- RÈGLES DE DÉPLACEMENT ---
            function estCoupValide(depart, arrivee) {
                const pieceDiv = depart.querySelector('.piece');
                if (!pieceDiv) return false;
                
                const type = pieceDiv.getAttribute('data-type');
                const couleur = pieceDiv.getAttribute('data-couleur');
                const pos1 = getCoords(depart);
                const pos2 = getCoords(arrivee);
                const dx = pos2.x - pos1.x; const dy = pos2.y - pos1.y; 
                const absDx = Math.abs(dx); const absDy = Math.abs(dy);
                const ciblePiece = arrivee.querySelector('.piece');

                // Règle de base : On ne mange pas ses amis
                if (ciblePiece && ciblePiece.getAttribute('data-couleur') === couleur) return false;

                // Logique par pièce
                if (type === 'pion') {
                    const dir = (couleur === 'blanc') ? -1 : 1; 
                    const startRow = (couleur === 'blanc') ? 6 : 1;
                    // Avance 1 case
                    if (dx === 0 && dy === dir && !ciblePiece) return true;
                    // Avance 2 cases (si départ)
                    if (dx === 0 && dy === 2 * dir && pos1.y === startRow && !ciblePiece && !getCaseAt(pos1.x, pos1.y + dir).querySelector('.piece')) return true;
                    // Mange en diagonale
                    if (absDx === 1 && dy === dir && ciblePiece) return true;
                    return false;
                }
                if (type === 'tour') return (dx === 0 || dy === 0) && checkCheminLibre(pos1, pos2);
                if (type === 'fou') return (absDx === absDy) && checkCheminLibre(pos1, pos2);
                if (type === 'reine') return ((dx === 0 || dy === 0) || (absDx === absDy)) && checkCheminLibre(pos1, pos2);
                if (type === 'cavalier') return (absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2);
                if (type === 'roi') return absDx <= 1 && absDy <= 1;
                return false;
            }

            /* =========================================
               3. MANAGER D'IA (Le Cerveau)
               ========================================= */

            function jouerIA_Manager() {
                if (jeuFini) return;
                iaReflechit = true;

                // 1. On liste TOUS les coups possibles pour les Noirs
                let tousLesCoups = [];
                
                cases.forEach((tdDepart, indexDepart) => {
                    const piece = tdDepart.querySelector('.piece');
                    if (piece && piece.getAttribute('data-couleur') === 'noir') {
                        cases.forEach((tdArrivee, indexArrivee) => {
                            if (estCoupValide(tdDepart, tdArrivee)) {
                                // Heuristique simple : on note la valeur de la pièce mangée
                                let valeurPrise = 0;
                                const cible = tdArrivee.querySelector('.piece');
                                if (cible) {
                                    const t = cible.getAttribute('data-type');
                                    if (t === 'reine') valeurPrise = 9;
                                    else if (t === 'tour') valeurPrise = 5;
                                    else if (t === 'fou' || t === 'cavalier') valeurPrise = 3;
                                    else if (t === 'pion') valeurPrise = 1;
                                    else if (t === 'roi') valeurPrise = 1000;
                                }
                                tousLesCoups.push({
                                    id: tousLesCoups.length,
                                    departIndex: indexDepart,
                                    arriveeIndex: indexArrivee,
                                    notation: `${getNotation(indexDepart)}${getNotation(indexArrivee)}`, // ex: e7e5
                                    valeur: valeurPrise
                                });
                            }
                        });
                    }
                });

                // Si aucun coup possible -> Pat ou Mat
                if (tousLesCoups.length === 0) {
                    console.log("Aucun coup possible (Pat/Mat)");
                    iaReflechit = false;
                    return;
                }

                // 2. Décision selon le niveau de difficulté
                const fenActuel = genererFEN();

                // MODE FACILE : Hasard total
                if (niveauDifficulte === 'facile') {
                    jouerCoupAuHasard(tousLesCoups);
                } 
                // MODE NORMAL : Hasard + un peu d'intelligence (si prise possible)
                else if (niveauDifficulte === 'normal') {
                    const coupsInteressants = tousLesCoups.filter(c => c.valeur > 0);
                    // 30% de chance de rater une prise évidente (pour rester humain)
                    if (coupsInteressants.length > 0 && Math.random() > 0.3) {
                        coupsInteressants.sort((a,b) => b.valeur - a.valeur);
                        executerCoup(coupsInteressants[0]);
                    } else {
                        jouerCoupAuHasard(tousLesCoups);
                    }
                } 
                // MODE DIFFICILE & EXTREME : Utilisation de Gemini (IA)
                else {
                    jouerIA_Gemini_Pro(tousLesCoups, fenActuel);
                }
            }

            // --- APPEL API GEMINI ---
            async function jouerIA_Gemini_Pro(moves, fen) {
                // Création de la liste lisible pour l'IA
                const moveListString = moves.map((m, i) => `${i}:${m.notation}`).join(", ");
                let promptSystem = "";
                
                // Prompt Différent selon le niveau
                if (niveauDifficulte === 'difficile') {
                    promptSystem = `Tu es un moteur d'échecs intermédiaire. 
                    État du plateau (FEN): ${fen}.
                    Voici les coups légaux possibles (ID:Notation) : [${moveListString}].
                    Joue un coup solide et positionnel. Évite de donner tes pièces gratuitement.
                    IMPORTANT: Réponds UNIQUEMENT par le chiffre de l'ID du coup choisi (ex: 4).`;
                } else {
                    // EXTREME
                    promptSystem = `Tu es STOCKFISH, un moteur d'échecs Grand Maître imbattable. 
                    État du plateau (FEN): ${fen}.
                    Voici les coups légaux possibles (ID:Notation) : [${moveListString}].
                    Ton objectif est d'écraser l'adversaire. Cherche le Mat ou le gain matériel immédiat.
                    IMPORTANT: Réponds UNIQUEMENT par le chiffre de l'ID du coup choisi (ex: 4).`;
                }

                try {
                    // Appel Fetch vers Google
                    const response = await fetch(GEMINI_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contents: [{ parts: [{ text: promptSystem }] }] })
                    });
                    
                    const data = await response.json();
                    let idChoisi = -1;
                    
                    // Parsing de la réponse (recherche d'un chiffre)
                    if (data.candidates && data.candidates[0].content) {
                        const text = data.candidates[0].content.parts[0].text.trim();
                        const match = text.match(/\d+/);
                        if (match) idChoisi = parseInt(match[0]);
                    }

                    // Exécution si ID valide
                    if (idChoisi !== -1 && idChoisi < moves.length) {
                        executerCoup(moves[idChoisi]);
                    } else {
                        console.warn("IA confuse, coup par défaut.");
                        // Fallback : On joue le coup qui mange le plus de points
                        moves.sort((a,b) => b.valeur - a.valeur);
                        executerCoup(moves[0]);
                    }
                } catch (e) {
                    console.error("Erreur API Gemini :", e);
                    jouerCoupAuHasard(moves);
                }
            }

            // Joue un coup au pif
            function jouerCoupAuHasard(coups) {
                const randomCoup = coups[Math.floor(Math.random() * coups.length)];
                executerCoup(randomCoup);
            }

            // Fonction finale qui déplace la pièce pour l'IA
            function executerCoup(coup) {
                const caseD = cases[coup.departIndex];
                const caseA = cases[coup.arriveeIndex];
                
                // Feedback visuel (Case rouge pour montrer ce que l'IA a joué)
                caseD.style.backgroundColor = "rgba(255, 0, 85, 0.6)";
                caseA.style.backgroundColor = "rgba(255, 0, 85, 0.6)";
                
                setTimeout(() => {
                    caseD.style.backgroundColor = "";
                    caseA.style.backgroundColor = "";
                    effectuerDeplacement(caseD, caseA);
                    changerTour();
                    iaReflechit = false;
                }, 600);
            }
        });
/**
 * --- CONFIGURATION & CONSTANTES ---
 */
const TILE_SIZE = 40;
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

const PLAYER_SPEED = 4;
const ZOMBIE_SPEED = 3;
const WEAPON_DURATION_MS = 5000;
const ZOMBIE_RESPAWN_TIME_MS = 20000;

const COLORS = {
    BG: "#051405",
    WALL: "#228b22",
    RATION: "#ffd700",
    HERO: "#c8ff00",
    WEAPON: "#ff4500",
    VULNERABLE: "#1e90ff",
    TEXT: "#f0f0f0",
    LEAF_TONES: ["#32cd32", "#228b22", "#006400", "#556b2f"]
};

const ZOMBIE_TYPES = ["#006400", "#90ee90", "#008080", "#8b4513", "#696969"];

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
    "WWWWWWWWWWWWWWWWWWWW",
];

/**
 * --- MOTEUR DE JEU ---
 */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui-layer');
const uiTitle = document.getElementById('ui-title');
const uiBtn = document.getElementById('ui-btn');

let gameState = 'MENU';
let keys = {};

// Entités
let walls = [];
let rations = [];
let weapons = [];
let zombies = [];
let player = null;

// Entrées Clavier
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Utilitaires
function checkRectCollision(r1, r2) {
    return (
        r1.x < r2.x + r2.w &&
        r1.x + r1.w > r2.x &&
        r1.y < r2.y + r2.h &&
        r1.y + r1.h > r2.y
    );
}

class Entity {
    constructor(x, y, color, sizeOffset = 0) {
        this.w = TILE_SIZE - sizeOffset;
        this.h = TILE_SIZE - sizeOffset;
        this.x = x * TILE_SIZE + sizeOffset / 2;
        this.y = y * TILE_SIZE + sizeOffset / 2;
        this.color = color;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
    }
}

class Wall extends Entity {
    constructor(x, y) {
        super(x, y, COLORS.WALL);
        this.decorations = [];
        for(let i=0; i<5; i++) {
            this.decorations.push({
                x: Math.random() * (this.w - 10),
                y: Math.random() * (this.h - 10),
                s: Math.random() * 8 + 6,
                c: COLORS.LEAF_TONES[Math.floor(Math.random() * COLORS.LEAF_TONES.length)]
            });
        }
    }
    draw() {
        super.draw();
        this.decorations.forEach(d => {
            ctx.fillStyle = d.c;
            ctx.fillRect(this.x + d.x, this.y + d.y, d.s, d.s);
        });
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, COLORS.HERO, 10);
        this.score = 0;
        this.weaponActive = false;
        this.weaponEndTime = 0;
    }

    update() {
        let dx = 0;
        let dy = 0;

        if (keys['ArrowLeft'] || keys['KeyA']) dx = -PLAYER_SPEED;
        if (keys['ArrowRight'] || keys['KeyD']) dx = PLAYER_SPEED;
        if (keys['ArrowUp'] || keys['KeyW']) dy = -PLAYER_SPEED;
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
    constructor(x, y, typeIndex) {
        let color = ZOMBIE_TYPES[typeIndex % ZOMBIE_TYPES.length];
        super(x, y, color, 8);
        this.baseColor = color;
        this.spawnPos = { x: this.x, y: this.y };
        this.dx = 0;
        this.dy = 0;
        this.isDead = false;
        this.deathTime = 0;
        this.pickRandomDirection();
    }

    pickRandomDirection() {
        const dirs = [{x:0, y:1}, {x:0, y:-1}, {x:1, y:0}, {x:-1, y:0}];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        this.dx = dir.x;
        this.dy = dir.y;
    }

    die() {
        this.isDead = true;
        this.deathTime = Date.now();
        this.x = -1000;
    }

    respawn() {
        this.isDead = false;
        this.x = this.spawnPos.x;
        this.y = this.spawnPos.y;
        this.pickRandomDirection();
    }

    update() {
        if (this.isDead) {
            if (Date.now() - this.deathTime > ZOMBIE_RESPAWN_TIME_MS) this.respawn();
            return;
        }

        let speed = player.weaponActive ? 1 : ZOMBIE_SPEED;
        this.color = player.weaponActive ? COLORS.VULNERABLE : this.baseColor;
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
        if (hitWall || Math.random() < 0.02) this.pickRandomDirection();
    }
}

function initGame() {
    walls = []; rations = []; weapons = []; zombies = []; player = null;
    let zCount = 0;

    for (let row = 0; row < LEVEL_MAP.length; row++) {
        for (let col = 0; col < LEVEL_MAP[row].length; col++) {
            let char = LEVEL_MAP[row][col];
            if (char === 'W') walls.push(new Wall(col, row));
            else if (char === '.') rations.push(new Entity(col, row, COLORS.RATION, 30));
            else if (char === 'A') weapons.push(new Entity(col, row, COLORS.WEAPON, 15));
            else if (char === 'P') player = new Player(col, row);
            else if (char === 'Z') { zombies.push(new Zombie(col, row, zCount)); zCount++; }
        }
    }
    if (!player) player = new Player(1, 1);
}

function handleCollisions() {
    for (let i = rations.length - 1; i >= 0; i--) {
        if (checkRectCollision(player, rations[i])) {
            player.score += 10;
            rations.splice(i, 1);
        }
    }
    if (rations.length === 0) setGameOver(true);

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
                setGameOver(false);
            }
        }
    }
}

function setGameOver(victory) {
    gameState = victory ? 'VICTORY' : 'GAMEOVER';
    uiTitle.innerText = victory ? "VICTOIRE !" : "GAME OVER";
    uiTitle.style.color = victory ? "#c8ff00" : "#ff4500";
    uiBtn.innerText = "REJOUER";
    uiLayer.style.display = 'flex';
}

function drawUI() {
    ctx.fillStyle = COLORS.TEXT;
    ctx.font = "24px Arial";
    ctx.fillText("SCORE: " + player.score, 20, 30);

    if (player.weaponActive) {
        let remaining = Math.ceil((player.weaponEndTime - Date.now()) / 1000);
        ctx.fillStyle = COLORS.WEAPON;
        ctx.fillText("POWER: " + remaining + "s", 20, 60);
    }
}

function gameLoop() {
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    if (gameState === 'PLAYING') {
        player.update();
        zombies.forEach(z => z.update());
        handleCollisions();
        walls.forEach(w => w.draw());
        rations.forEach(r => r.draw());
        weapons.forEach(w => w.draw());
        zombies.forEach(z => { if(!z.isDead) z.draw(); });
        player.draw();
        drawUI();
    } else {
        if (walls.length > 0) walls.forEach(w => w.draw());
    }
    requestAnimationFrame(gameLoop);
}

uiBtn.addEventListener('click', () => {
    initGame();
    gameState = 'PLAYING';
    uiLayer.style.display = 'none';
});

// Afficher le menu au départ
uiLayer.style.display = 'flex';
requestAnimationFrame(gameLoop);
/*
