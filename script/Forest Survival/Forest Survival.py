import pygame
import sys
import random
import math
from enum import Enum, auto
from typing import List, Tuple, Optional, Dict, Set

# ==============================================================================
# --- 1. CONSTANTES & ENUMS ---
# ==============================================================================

class ZombieType(Enum):
    HUNTER = 0      # Traqueur
    COWARD = 1      # Froussard
    CAMPER = 2      # Observateur
    PATROL = 3      # Patrouilleur
    DRUNK = 4       # Ivre

class GameState(Enum):
    MENU = auto()
    PLAYING = auto()

# Configuration de l'affichage
SCREEN_WIDTH: int = 800
SCREEN_HEIGHT: int = 600
TILE_SIZE: int = 40
FPS: int = 60

# Gameplay
PLAYER_SPEED: int = 4
ZOMBIE_SPEED: int = 3
ZOMBIE_CHASE_SPEED: int = 3
WEAPON_DURATION_MS: int = 5000
ZOMBIE_RESPAWN_TIME_MS: int = 20000

# Palette de couleurs (RGB)
COLORS = {
    "BG": (5, 20, 5),
    "WALL": (34, 139, 34),
    "RATION": (255, 215, 0),
    "HERO": (200, 255, 0),
    "WEAPON": (255, 69, 0),
    "VULNERABLE": (30, 144, 255),
    "TEXT": (240, 240, 240),
    "UI_OVERLAY_LOSS": (50, 0, 0),
    "UI_OVERLAY_WIN": (0, 50, 0),
    "BTN_NORMAL": (40, 80, 40),
    "BTN_HOVER": (60, 120, 60)
}

ZOMBIE_COLORS = {
    ZombieType.HUNTER: (0, 100, 0),
    ZombieType.COWARD: (144, 238, 144),
    ZombieType.CAMPER: (0, 128, 128),
    ZombieType.PATROL: (139, 69, 19),
    ZombieType.DRUNK: (105, 105, 105)
}

LEVEL_MAP: List[str] = [
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
]

# ==============================================================================
# --- 2. SERVICES & UTILITAIRES ---
# ==============================================================================

class Utils:
    @staticmethod
    def get_grid_pos(x: float, y: float) -> Tuple[int, int]:
        return int(x // TILE_SIZE), int(y // TILE_SIZE)

    @staticmethod
    def is_wall(col: int, row: int) -> bool:
        if not (0 <= row < len(LEVEL_MAP)) or not (0 <= col < len(LEVEL_MAP[0])):
            return True
        return LEVEL_MAP[row][col] == 'W'

    @staticmethod
    def generate_leaf_texture(size: int, base_color: Tuple[int, int, int]) -> pygame.Surface:
        surface = pygame.Surface((size, size))
        surface.fill(base_color)
        leaf_tones = [(50, 205, 50), (34, 139, 34), (0, 100, 0), (85, 107, 47)]
        for _ in range(30): 
            patch_size = random.randint(6, 14)
            pos = (random.randint(0, size - patch_size), random.randint(0, size - patch_size))
            pygame.draw.rect(surface, random.choice(leaf_tones), (*pos, patch_size, patch_size))
        return surface

class Pathfinder:
    @staticmethod
    def get_next_move(start: Tuple[int, int], target: Tuple[int, int]) -> Tuple[int, int]:
        queue = [(start, [])]
        visited = {start}
        while queue:
            current, path = queue.pop(0)
            if current == target:
                return path[0] if path else (0, 0)
            directions = [(0, -1), (0, 1), (-1, 0), (1, 0)]
            random.shuffle(directions)
            for dx, dy in directions:
                next_pos = (current[0] + dx, current[1] + dy)
                if next_pos not in visited and not Utils.is_wall(*next_pos):
                    visited.add(next_pos)
                    new_path = list(path)
                    if not new_path: new_path.append((dx, dy))
                    queue.append((next_pos, new_path))
        return (0, 0)

# ==============================================================================
# --- 3. UI : CLASSE BOUTON ---
# ==============================================================================

class Button:
    def __init__(self, x, y, w, h, text, font):
        self.rect = pygame.Rect(x - w//2, y - h//2, w, h)
        self.text = text
        self.font = font
        self.is_hovered = False

    def draw(self, screen):
        color = COLORS["BTN_HOVER"] if self.is_hovered else COLORS["BTN_NORMAL"]
        pygame.draw.rect(screen, color, self.rect, border_radius=8)
        pygame.draw.rect(screen, COLORS["TEXT"], self.rect, 2, border_radius=8)
        
        txt_surf = self.font.render(self.text, True, COLORS["TEXT"])
        txt_rect = txt_surf.get_rect(center=self.rect.center)
        screen.blit(txt_surf, txt_rect)

    def check_hover(self, mouse_pos):
        self.is_hovered = self.rect.collidepoint(mouse_pos)
        return self.is_hovered

# ==============================================================================
# --- 4. ENTITÉS DU JEU ---
# ==============================================================================

class Entity(pygame.sprite.Sprite):
    def __init__(self, grid_x: int, grid_y: int, color: Tuple[int, ...], size_offset: int = 0):
        super().__init__()
        size = TILE_SIZE - size_offset
        self.image = pygame.Surface((size, size))
        self.image.fill(color)
        self.rect = self.image.get_rect()
        self.rect.topleft = (grid_x * TILE_SIZE + size_offset // 2, grid_y * TILE_SIZE + size_offset // 2)

class Wall(Entity):
    def __init__(self, x: int, y: int):
        super().__init__(x, y, COLORS["WALL"])
        self.image = Utils.generate_leaf_texture(TILE_SIZE, COLORS["WALL"])

class Collectible(Entity):
    def __init__(self, x: int, y: int, color: Tuple[int, ...], offset: int):
        super().__init__(x, y, color, size_offset=offset)

class Player(Entity):
    def __init__(self, x: int, y: int):
        super().__init__(x, y, COLORS["HERO"], size_offset=10)
        self.velocity = pygame.math.Vector2(0, 0)
        self.score = 0
        self.weapon_active = False
        self.weapon_end_time = 0

    def update(self, walls: pygame.sprite.Group):
        keys = pygame.key.get_pressed()
        self.velocity.update(0, 0)
        if keys[pygame.K_LEFT]:  self.velocity.x = -PLAYER_SPEED
        elif keys[pygame.K_RIGHT]: self.velocity.x = PLAYER_SPEED
        if keys[pygame.K_UP]:    self.velocity.y = -PLAYER_SPEED
        elif keys[pygame.K_DOWN]:  self.velocity.y = PLAYER_SPEED

        self.rect.x += int(self.velocity.x)
        for wall in pygame.sprite.spritecollide(self, walls, False):
            if self.velocity.x > 0: self.rect.right = wall.rect.left
            elif self.velocity.x < 0: self.rect.left = wall.rect.right
        
        self.rect.y += int(self.velocity.y)
        for wall in pygame.sprite.spritecollide(self, walls, False):
            if self.velocity.y > 0: self.rect.bottom = wall.rect.top
            elif self.velocity.y < 0: self.rect.top = wall.rect.bottom

        if self.weapon_active and pygame.time.get_ticks() > self.weapon_end_time:
            self.weapon_active = False

class Zombie(Entity):
    def __init__(self, x: int, y: int, z_type: ZombieType):
        color = ZOMBIE_COLORS.get(z_type, (255, 255, 255))
        super().__init__(x, y, color, size_offset=8)
        self.z_type, self.base_color = z_type, color
        self.direction = pygame.math.Vector2(0, 0)
        self.spawn_pos = (self.rect.x, self.rect.y)
        self.is_dead = False
        self.start_delay = random.randint(0, 60)

    def die(self):
        self.is_dead = True
        self.death_timestamp = pygame.time.get_ticks()
        self.rect.topleft = (-1000, -1000)

    def respawn(self):
        self.is_dead = False
        self.rect.topleft = self.spawn_pos
        self.image.fill(self.base_color)
        self.start_delay = 60

    def _get_random_dir(self):
        opts = [(0, 1), (0, -1), (1, 0), (-1, 0)]
        random.shuffle(opts)
        gp = Utils.get_grid_pos(self.rect.centerx, self.rect.centery)
        for dx, dy in opts:
            if not Utils.is_wall(gp[0] + dx, gp[1] + dy): return pygame.math.Vector2(dx, dy)
        return pygame.math.Vector2(0,0)

    def update(self, walls, player):
        if self.is_dead:
            if pygame.time.get_ticks() - self.death_timestamp > ZOMBIE_RESPAWN_TIME_MS: self.respawn()
            return
        if self.start_delay > 0:
            self.start_delay -= 1
            return

        speed = 1 if player.weapon_active else ZOMBIE_SPEED
        self.image.fill(COLORS["VULNERABLE"] if player.weapon_active else self.base_color)
        
        if self.direction.length() == 0: self.direction = self._get_random_dir()
        
        self.rect.x += int(self.direction.x * speed)
        self.rect.y += int(self.direction.y * speed)
        
        if pygame.sprite.spritecollide(self, walls, False):
            self.rect.x -= int(self.direction.x * speed)
            self.rect.y -= int(self.direction.y * speed)
            self.direction = self._get_random_dir()

# ==============================================================================
# --- 5. MOTEUR DE JEU (CORE LOOP) ---
# ==============================================================================

class GameEngine:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("FOREST SURVIVAL")
        self.clock = pygame.time.Clock()
        self.font_lg = pygame.font.Font(None, 64)
        self.font_md = pygame.font.Font(None, 48)
        self.font_sm = pygame.font.Font(None, 24)
        
        self.state = GameState.MENU
        self.play_button = Button(SCREEN_WIDTH//2, SCREEN_HEIGHT//2 + 50, 200, 60, "PLAY", self.font_md)
        
        self.running = True
        self.game_over = False
        self.victory = False
        self._init_sprites()

    def _init_sprites(self):
        self.sprites, self.walls, self.rations = pygame.sprite.Group(), pygame.sprite.Group(), pygame.sprite.Group()
        self.weapons, self.zombies = pygame.sprite.Group(), pygame.sprite.Group()
        z_count = 0
        for r, row in enumerate(LEVEL_MAP):
            for c, tile in enumerate(row):
                if tile == "W":
                    w = Wall(c, r)
                    self.walls.add(w); self.sprites.add(w)
                elif tile == ".":
                    item = Collectible(c, r, COLORS["RATION"], 30)
                    self.rations.add(item); self.sprites.add(item)
                elif tile == "A":
                    item = Collectible(c, r, COLORS["WEAPON"], 15)
                    self.weapons.add(item); self.sprites.add(item)
                elif tile == "P":
                    self.player = Player(c, r)
                    self.sprites.add(self.player)
                elif tile == "Z":
                    if z_count < len(ZombieType):
                        z = Zombie(c, r, ZombieType(z_count))
                        self.zombies.add(z); self.sprites.add(z); z_count += 1

    def _handle_collisions(self):
        if pygame.sprite.spritecollide(self.player, self.rations, True):
            self.player.score += 10
            if not self.rations: self.victory = True
        if pygame.sprite.spritecollide(self.player, self.weapons, True):
            self.player.weapon_active = True
            self.player.weapon_end_time = pygame.time.get_ticks() + WEAPON_DURATION_MS
        for z in pygame.sprite.spritecollide(self.player, self.zombies, False):
            if not z.is_dead:
                if self.player.weapon_active: z.die(); self.player.score += 50
                else: self.game_over = True

    def _draw_menu(self):
        self.screen.fill(COLORS["BG"])
        title = self.font_lg.render("FOREST SURVIVAL", True, COLORS["HERO"])
        self.screen.blit(title, title.get_rect(center=(SCREEN_WIDTH//2, SCREEN_HEIGHT//2 - 50)))
        self.play_button.check_hover(pygame.mouse.get_pos())
        self.play_button.draw(self.screen)

    def _draw_ui(self):
        score_txt = self.font_sm.render(f"SCORE: {self.player.score}", True, COLORS["TEXT"])
        self.screen.blit(score_txt, (20, 20))
        if self.player.weapon_active:
            timer = max(0, (self.player.weapon_end_time - pygame.time.get_ticks()) // 1000)
            pwr_txt = self.font_sm.render(f"POWER: {timer}s", True, COLORS["WEAPON"])
            self.screen.blit(pwr_txt, (20, 50))

        if self.game_over or self.victory:
            overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
            overlay.fill((0,0,0,180))
            self.screen.blit(overlay, (0,0))
            msg = "VICTORY!" if self.victory else "GAME OVER"
            color = COLORS["UI_OVERLAY_WIN"] if self.victory else COLORS["UI_OVERLAY_LOSS"]
            txt = self.font_lg.render(msg, True, COLORS["TEXT"])
            self.screen.blit(txt, txt.get_rect(center=(SCREEN_WIDTH//2, SCREEN_HEIGHT//2)))
            retry = self.font_sm.render("Press 'R' to Restart", True, COLORS["TEXT"])
            self.screen.blit(retry, retry.get_rect(center=(SCREEN_WIDTH//2, SCREEN_HEIGHT//2 + 60)))

    def run(self):
        while self.running:
            m_pos = pygame.mouse.get_pos()
            for event in pygame.event.get():
                if event.type == pygame.QUIT: self.running = False
                if event.type == pygame.MOUSEBUTTONDOWN and self.state == GameState.MENU:
                    if self.play_button.check_hover(m_pos): self.state = GameState.PLAYING
                if event.type == pygame.KEYDOWN and (self.game_over or self.victory):
                    if event.key == pygame.K_r: 
                        self._init_sprites(); self.game_over = self.victory = False

            if self.state == GameState.MENU:
                self._draw_menu()
            else:
                if not self.game_over and not self.victory:
                    self.player.update(self.walls)
                    self.zombies.update(self.walls, self.player)
                    self._handle_collisions()
                self.screen.fill(COLORS["BG"])
                self.sprites.draw(self.screen)
                self._draw_ui()
            
            pygame.display.flip()
            self.clock.tick(FPS)

if __name__ == "__main__":
    game = GameEngine()
    game.run()
    pygame.quit()
    sys.exit()