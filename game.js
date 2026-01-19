class GeometriDash {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Ajuster la taille du canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Joueur
        this.player = {
            x: 100,
            y: 0,
            width: 40,
            height: 40,
            velocityY: 0,
            color: '#00ff88',
            jumpCount: 0,
            maxJumps: 2,
            jumpPressTime: 0,
            isJumping: false
        };

        // Jeu
        this.gameRunning = false;
        this.gamePaused = false;
        this.score = 0;
        this.bestScore = localStorage.getItem('bestScore') || 0;
        this.level = 1;
        this.gravity = 0.05;
        this.jumpPower = 15;
        this.scrollSpeed = 8;
        this.gameTime = 0;
        this.startDelay = 5; // 5 secondes avant les obstacles
        this.playerName = 'Joueur'; // Nom du joueur

        // Obstacles et éléments
        this.obstacles = [];
        this.stars = [];
        this.platformWidth = 0;

        // Contrôles
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false
        };

        // Event listeners
        this.setupEventListeners();
        this.updateUI();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = Math.min(800, container.clientWidth - 40);
        this.canvas.height = 400;
        this.platformWidth = this.canvas.width;
    }

    setupEventListeners() {
        // Clavier
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Boutons
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        
        // Boutons de classement
        if (document.getElementById('leaderboardBtn')) {
            document.getElementById('leaderboardBtn').addEventListener('click', () => this.showLeaderboard());
        }
        if (document.getElementById('closeLeaderboardBtn')) {
            document.getElementById('closeLeaderboardBtn').addEventListener('click', () => this.hideLeaderboard());
        }
    }

    handleKeyDown(e) {
        const key = e.key.toUpperCase();
        if (key === 'ARROWUP' || key === 'W') {
            if (!this.keys.up) {
                this.player.jumpPressTime = 0;
                this.keys.up = true;
            }
        }
        if (key === 'ARROWDOWN' || key === 'S') this.keys.down = true;
        if (key === 'ARROWLEFT' || key === 'A') this.keys.left = true;
        if (key === 'ARROWRIGHT' || key === 'D') this.keys.right = true;
        if (key === ' ') {
            e.preventDefault();
            if (!this.keys.up) {
                this.player.jumpPressTime = 0;
                this.keys.up = true;
            }
        }
    }

    handleKeyUp(e) {
        const key = e.key.toUpperCase();
        if (key === 'ARROWUP' || key === 'W' || key === ' ') {
            this.keys.up = false;
            this.player.jumpPressTime = 0;
        }
        if (key === 'ARROWDOWN' || key === 'S') this.keys.down = false;
        if (key === 'ARROWLEFT' || key === 'A') this.keys.left = false;
        if (key === 'ARROWRIGHT' || key === 'D') this.keys.right = false;
    }

    start() {
        if (!this.gameRunning) {
            this.gameRunning = true;
            this.gamePaused = false;
            document.getElementById('startBtn').disabled = true;
            document.getElementById('pauseBtn').disabled = false;
            document.getElementById('gameOverScreen').classList.add('hidden');
            this.gameLoop();
        }
    }

    togglePause() {
        if (this.gameRunning) {
            this.gamePaused = !this.gamePaused;
            document.getElementById('pauseBtn').textContent = this.gamePaused ? 'Reprendre' : 'Pause';
            if (!this.gamePaused) {
                this.gameLoop();
            }
        }
    }

    reset() {
        this.gameRunning = false;
        this.gamePaused = false;
        this.score = 0;
        this.level = 1;
        this.scrollSpeed = 8;
        this.gameTime = 0;
        this.player.velocityY = 0;
        this.player.x = 100;
        this.player.y = this.canvas.height - 100;
        this.player.jumpCount = 0;
        this.player.jumpPressTime = 0;
        this.player.isJumping = false;
        this.obstacles = [];
        this.stars = [];
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('pauseBtn').textContent = 'Pause';
        document.getElementById('gameOverScreen').classList.add('hidden');
        this.updateUI();
        this.draw();
    }

    restart() {
        this.reset();
        this.start();
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('bestScore').textContent = this.bestScore;
        document.getElementById('level').textContent = this.level;
    }

    // Gestion du classement
    saveScore(score) {
        let scores = JSON.parse(localStorage.getItem('leaderboard')) || [];
        scores.push({
            name: this.playerName,
            score: score,
            level: this.level,
            date: new Date().toLocaleDateString('fr-FR')
        });
        
        // Trier par score décroissant et garder les top 10
        scores.sort((a, b) => b.score - a.score);
        scores = scores.slice(0, 10);
        
        localStorage.setItem('leaderboard', JSON.stringify(scores));
        return scores;
    }

    getLeaderboard() {
        return JSON.parse(localStorage.getItem('leaderboard')) || [];
    }

    showLeaderboard() {
        const leaderboard = this.getLeaderboard();
        const leaderboardScreen = document.getElementById('leaderboardScreen');
        const leaderboardList = document.getElementById('leaderboardList');
        
        leaderboardList.innerHTML = '';
        
        if (leaderboard.length === 0) {
            leaderboardList.innerHTML = '<tr><td colspan="4">Pas de scores enregistrés</td></tr>';
        } else {
            leaderboard.forEach((entry, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="rank">#${index + 1}</td>
                    <td class="name">${entry.name}</td>
                    <td class="score">${entry.score}</td>
                    <td class="level">Niveau ${entry.level}</td>
                `;
                leaderboardList.appendChild(row);
            });
        }
        
        leaderboardScreen.classList.remove('hidden');
    }

    hideLeaderboard() {
        const leaderboardScreen = document.getElementById('leaderboardScreen');
        leaderboardScreen.classList.add('hidden');
    }

    generateObstacles() {
        const lastObstacle = this.obstacles.length > 0 
            ? this.obstacles[this.obstacles.length - 1] 
            : { x: 0 };

        // Vérifier si le délai de démarrage est passé
        const timeInSeconds = this.gameTime / 60;
        if (timeInSeconds < this.startDelay) {
            return; // Ne pas générer d'obstacles pendant le délai
        }

        if (lastObstacle.x < this.canvas.width + 500) {
            const x = lastObstacle.x + Math.random() * 0 + 500;
            
            // Obstacle avec gap au milieu (style Flappy Bird)
            const gapSize = 210;
            const topHeight = Math.random() * 150 + 20;
            const bottomHeight = Math.random() * 150 + 20;

            // Tuyau du haut
            this.obstacles.push({
                x: x,
                y: 0,
                width: 80,
                height: topHeight,
                color: '#2ecc71',
                type: 'pipe'
            });

            // Tuyau du bas
            this.obstacles.push({
                x: x,
                y: topHeight + gapSize,
                width: 80,
                height: this.canvas.height - (topHeight + gapSize),
                color: '#2ecc71',
                type: 'pipe'
            });

            // Occasionnellement générer une étoile
            if (Math.random() < 0.35) {
                this.stars.push({
                    x: x + 40,
                    y: topHeight + gapSize / 2,
                    radius: 6,
                    color: '#f1c40f',
                    collected: false
                });
            }
        }
    }

    updatePlayer() {
        // Mouvements horizontaux
        if (this.keys.left && this.player.x > 0) {
            this.player.x -= 7;
        }
        if (this.keys.right && this.player.x + this.player.width < this.canvas.width) {
            this.player.x += 7;
        }

        // Augmenter le temps d'appui de la touche
        if (this.keys.up && this.player.isJumping) {
            this.player.jumpPressTime = Math.min(this.player.jumpPressTime + 1, 20);
        }

        // Gravité et saut
        this.player.velocityY += this.gravity;
        
        // Si on maintient la touche en l'air, on peut continuer à monter
        if (this.keys.up && this.player.velocityY > -5 && this.player.y + this.player.height < this.canvas.height) {
            this.player.velocityY = -6; // Force ascendante douce
        }
        
        this.player.y += this.player.velocityY;

        // Collision avec le sol
        if (this.player.y + this.player.height >= this.canvas.height) {
            this.player.y = this.canvas.height - this.player.height;
            this.player.velocityY = 0;
            this.player.jumpCount = 0; // Réinitialiser les sauts
            this.player.isJumping = false;

            if (this.keys.up && !this.player.isJumping) {
                // Calculer la puissance du saut basée sur le temps d'appui
                const jumpForce = this.jumpPower + (this.player.jumpPressTime / 20) * 8;
                this.player.velocityY = -jumpForce;
                this.player.jumpCount = 1;
                this.player.isJumping = true;
            }
        } else if (this.keys.up && this.player.jumpCount < this.player.maxJumps && !this.player.isJumping) {
            // Double jump - même mécanique de charge
            const jumpForce = this.jumpPower + (this.player.jumpPressTime / 20) * 8;
            this.player.velocityY = -jumpForce;
            this.player.jumpCount++;
            this.player.isJumping = true;
        } else if (!this.keys.up) {
            this.player.isJumping = false;
        }

        // Limiter le plafond pour ne pas sortir de l'écran (sans tuer le joueur)
        if (this.player.y < 0) {
            this.player.y = 0;
            this.player.velocityY = 0;
        }

        // Limiter les bordures latérales (sans tuer le joueur)
        if (this.player.x < 0) {
            this.player.x = 0;
        }
        if (this.player.x + this.player.width > this.canvas.width) {
            this.player.x = this.canvas.width - this.player.width;
        }

        // Collision avec les obstacles
        for (let obstacle of this.obstacles) {
            if (this.checkCollision(this.player, obstacle)) {
                this.gameOver();
                return;
            }
        }

        // Collecte des étoiles
        for (let star of this.stars) {
            if (!star.collected && this.checkStarCollision(this.player, star)) {
                star.collected = true;
                this.score += 50;
            }
        }
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    checkStarCollision(rect, star) {
        const starX = star.x;
        const starY = star.y;
        const distance = Math.hypot(
            rect.x + rect.width / 2 - starX,
            rect.y + rect.height / 2 - starY
        );
        return distance < rect.width / 2 + star.radius;
    }

    update() {
        // Augmenter le temps du jeu
        this.gameTime++;

        // Augmenter la vitesse du jeu (seulement après le délai)
        const timeInSeconds = this.gameTime / 60;
        if (timeInSeconds >= this.startDelay) {
            this.score++;
            if (this.score % 500 === 0) {
                this.level++;
                this.scrollSpeed += 0.5;
            }
        }

        this.generateObstacles();

        // Défilement et mise à jour des obstacles
        for (let obstacle of this.obstacles) {
            obstacle.x -= this.scrollSpeed;
            
            // Animation pour les obstacles spiky
            if (obstacle.type === 'spiky') {
                obstacle.time += 0.02;
            }
        }
        
        for (let star of this.stars) {
            star.x -= this.scrollSpeed;
        }

        // Nettoyage des éléments hors écran
        this.obstacles = this.obstacles.filter(o => o.x + o.width > 0);
        this.stars = this.stars.filter(s => s.x > 0);

        this.updatePlayer();
    }

    draw() {
        // Fond
        this.ctx.fillStyle = '#0f3460';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Ligne de sol
        this.ctx.strokeStyle = '#1e90ff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height);
        this.ctx.lineTo(this.canvas.width, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Joueur - Cercle simple (oiseau Flappy Bird style)
        this.ctx.fillStyle = this.player.color;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = this.player.color;
        this.ctx.beginPath();
        this.ctx.arc(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            this.player.width / 2,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Obstacles
        for (let obstacle of this.obstacles) {
            this.ctx.fillStyle = obstacle.color;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            
            if (obstacle.type === 'pipe') {
                // Tuyau style Flappy Bird
                const cornerRadius = 6;
                this.ctx.beginPath();
                this.ctx.moveTo(obstacle.x + cornerRadius, obstacle.y);
                this.ctx.lineTo(obstacle.x + obstacle.width - cornerRadius, obstacle.y);
                this.ctx.quadraticCurveTo(obstacle.x + obstacle.width, obstacle.y, obstacle.x + obstacle.width, obstacle.y + cornerRadius);
                this.ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height - cornerRadius);
                this.ctx.quadraticCurveTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height, obstacle.x + obstacle.width - cornerRadius, obstacle.y + obstacle.height);
                this.ctx.lineTo(obstacle.x + cornerRadius, obstacle.y + obstacle.height);
                this.ctx.quadraticCurveTo(obstacle.x, obstacle.y + obstacle.height, obstacle.x, obstacle.y + obstacle.height - cornerRadius);
                this.ctx.lineTo(obstacle.x, obstacle.y + cornerRadius);
                this.ctx.quadraticCurveTo(obstacle.x, obstacle.y, obstacle.x + cornerRadius, obstacle.y);
                this.ctx.closePath();
                this.ctx.fill();
                
                // Bordure
                this.ctx.strokeStyle = '#27ae60';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
            
            this.ctx.shadowBlur = 0;
        }

        // Étoiles
        for (let star of this.stars) {
            if (!star.collected) {
                this.drawStar(star.x, star.y, star.radius, star.color);
            }
        }

        // Info de pause
        if (this.gamePaused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('EN PAUSE', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    drawStar(x, y, radius, color) {
        this.ctx.save();
        this.ctx.fillStyle = color;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = color;
        
        // Dessiner une pièce/coin simple
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    drawSpikyObstacle(obstacle) {
        // Non utilisé en style Flappy Bird
    }

    gameOver() {
        this.gameRunning = false;
        
        // Sauvegarder le score
        this.saveScore(this.score);
        
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bestScore', this.bestScore);
        }

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalLevel').textContent = this.level;
        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
    }

    gameLoop() {
        if (!this.gamePaused) {
            this.update();
            this.updateUI();
        }
        this.draw();

        if (this.gameRunning) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

// Initialiser le jeu au chargement
document.addEventListener('DOMContentLoaded', () => {
    const game = new GeometriDash('gameCanvas');
});
