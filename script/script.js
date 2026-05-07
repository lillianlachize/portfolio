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

}); // FIN DU document.addEventListener('DOMContentLoaded')
