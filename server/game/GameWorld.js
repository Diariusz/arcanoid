// engine/GameWorld.js

import { Bullet } from "./entities/Bullet.js";
import { PowerUp } from "./entities/PowerUp.js";

import { Player } from "./entities/Player.js";
import Asteroid from "./entities/Asteroid.js";
import Boss from "./entities/Boss.js";


/* ================= CONSTANTS ================= */

export const GAME_STATE = {
  MENU: "menu",
  PLAYING: "playing",
  GAME_OVER: "game_over"
};


const POWERUP_DURATIONS = {
  double: 10000,
  triple: 8000,
  cooling: 12000,
  fastBullets: 10000,
  speedBoost: 10000 // ✅ NOWE
};


const MAX_POWERUPS_ON_SCREEN = 2;

/* ================= GAME WORLD ================= */

export class GameWorld {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;

    /* ===== CORE STATE ===== */
    this.state = GAME_STATE.MENU;

    this.players = new Map(); // sessionId -> Player

    this.asteroids = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.powerUps = [];
    this.explosions = [];
    this.dustClouds = [];

    this.boss = null;
    this.isBossFight = false;

    /* ===== GAME SYSTEMS ===== */
    this.score = 0;
    this.level = 1;
    this.nextLevelScore = 10;

    this.shield = 100;
    this.maxShield = 100;

    this.heat = 0;
    this.maxHeat = 100;
    this.overheated = false;

    
  this.activePowerUps = {
    double: 0,
    triple: 0,
    cooling: 0,
    fastBullets: 0,
    speedBoost: 0 // ✅ NOWE
  };


    /* ===== SHOOTING ===== */
    this.lastShotTime = 0;
    this.fireCooldown = 150;
    this.maxBullets = 60;

    this.purgeCooldown = 6000;
    this.lastPurgeTime = -Infinity;
    this.canShoot = true;
    this.purgeLockTimer = 0;
    this.PURGE_LOCK_FRAMES = 72;

    /* ===== UTILS ===== */
    this.events = [];
    this.tick = 0;

   /* ===== GAME MODE / FLOW ===== */
    this.mode = "solo";      // "solo" | "coop" | "pvp"
    this.isGameOver = false; // sygnał końca gry

  }

  /* ================= PLAYERS ================= */

  addPlayer(player) {
    this.players.set(player.sessionId, player);
  }

  removePlayer(sessionId) {
    this.players.delete(sessionId);
  }

  getPlayer(sessionId) {
    return this.players.get(sessionId);
  }

  getPlayerBySocketId(socketId) {
  for (const player of this.players.values()) {
    if (player.id === socketId) {
      return player;
    }
  }
  return null;
}


  /* ================= UPDATE LOOP ================= */

  update(dt, now) {
    if (this.state !== GAME_STATE.PLAYING) return;

    this.tick++;

// respawn tick
for (const p of this.players.values()) {
  if (!p.alive && p.respawnAt && Date.now() >= p.respawnAt) {
    this.respawnPlayer(p);
    this.events.push({ type: "PLAYER_RESPAWN", playerId: p.id });
  }
}

    this.updatePowerUps(now);

    for (const player of this.players.values()) {
      player.update(this);
    }

    this.updateBullets();
    this.updateAsteroids();
    this.updateBoss();
    this.handleCollisions();

    this.updateHeat(now);
    this.updatePurgeLock();
    

if (this.tick % 60 === 0) {
  console.log("===== SERVER DEBUG TICK", this.tick, "=====");

  console.log("PLAYERS:");
  for (const player of this.players.values()) {
    console.log({
      sessionId: player.sessionId,
      socketId: player.id,
      x: Number(player.x.toFixed(1)),
      y: Number(player.y.toFixed(1)),
      vx: Number(player.vx.toFixed(2)),
      vy: Number(player.vy.toFixed(2)),
      a: Number(player.a.toFixed(2)),
      disconnectedAt: player.disconnectedAt
    });
  }

  console.log("ASTEROIDS:");
  console.log(
    this.asteroids.map(a => ({
      id: a.id,
      x: Number(a.x.toFixed(1)),
      y: Number(a.y.toFixed(1)),
      size: a.size,
      speed: Number(a.speed.toFixed(2))
    }))
  );
}


  }

  /* ================= SHOOTING ================= */

addBulletFromPlayer(player, now) {
  if (!player.alive) return;
  if (!player.canShoot) return;
  if (player.overheated) return;
  if (this.bullets.length >= this.maxBullets) return; // limit globalny może zostać na start

  const fast = (player.activePowerUps.fastBullets ?? 0) > now;

  const baseCooldown = this.fireCooldown;
  const effectiveCooldown = fast ? Math.max(80, baseCooldown * 0.65) : baseCooldown;

  if (now - player.lastShotTime < effectiveCooldown) return;
  player.lastShotTime = now;

  const triple = (player.activePowerUps.triple ?? 0) > now;
  const double = (player.activePowerUps.double ?? 0) > now;

  if (triple) {
    this.spawnBullet(player, 0);
    this.spawnBullet(player, 0.2);
    this.spawnBullet(player, -0.2);
  } else if (double) {
    this.spawnBullet(player, 0.1);
    this.spawnBullet(player, -0.1);
  } else {
    this.spawnBullet(player, 0);
  }

  player.heat += fast ? 6 : 4;

  if (player.heat >= player.maxHeat) {
    player.overheated = true;
    this.events.push({ type: "OVERHEAT", playerId: player.id });
  }
}

spawnBullet(player, angleOffset = 0) {
  const a = player.a + angleOffset;

  const now = Date.now();
  const fast = (player.activePowerUps.fastBullets ?? 0) > now;

  const BASE_BULLET_SPEED = 14;
  const mult = fast ? 1.8 : 1.0;
  const bulletSpeed = BASE_BULLET_SPEED * mult;

  const vx = player.vx + Math.cos(a) * bulletSpeed;
  const vy = player.vy + Math.sin(a) * bulletSpeed;

  this.bullets.push(new Bullet(player.x, player.y, vx, vy));
}



attemptPurge(player, now) {
  if (!player.alive) return;

  // cooldown purge per-player
  if (now - player.lastPurgeTime < this.purgeCooldown) return;

  // reset heat/overheat tylko tego gracza
  player.heat = 0;
  player.overheated = false;

  // lock shooting tylko dla tego gracza
  player.canShoot = false;
  player.purgeLockTimer = this.PURGE_LOCK_FRAMES;
  player.lastPurgeTime = now;

  this.events.push({ type: "PURGE", playerId: player.id });
}


  /* ================= SYSTEMS ================= */



  
updatePowerUps(now) {
  for (const p of this.players.values()) {
    for (const key in p.activePowerUps) {
      if (p.activePowerUps[key] > 0 && now > p.activePowerUps[key]) {
        p.activePowerUps[key] = 0;
      }
    }
  }
}

updateHeat(now) {
  for (const p of this.players.values()) {
    const coolingActive = (p.activePowerUps.cooling ?? 0) > now;
    const cooling = coolingActive ? 1.0 : 0.5;

    if (!p.overheated) {
      p.heat = Math.max(0, p.heat - cooling);
    } else {
      p.heat -= cooling * 0.2;
      if (p.heat <= 0) {
        p.heat = 0;
        p.overheated = false;
      }
    }
  }
}

updatePurgeLock() {
  for (const p of this.players.values()) {
    if (!p.canShoot) {
      p.purgeLockTimer--;
      if (p.purgeLockTimer <= 0) {
        p.canShoot = true;
        p.purgeLockTimer = 0;
      }
    }
  }
}

  updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update();
      if (b.isOutOfBounds(this.width, this.height)) {
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.update();
      if (b.isOutOfBounds(this.width, this.height)) {
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  updateAsteroids() {
    for (const a of this.asteroids) {
      a.update(this.width, this.height);
    }
  }

  updateBoss() {
    if (this.isBossFight && this.boss) {
      this.boss.update(this);
    }
  }

  /* ================= COLLISIONS ================= */

  handleCollisions() {
    this.handleBulletAsteroid();
    this.handlePlayerAsteroid();
    this.handleEnemyBullets();
    this.handlePowerUpPickup();
  }

respawnPlayer(player) {
  // respawn w bezpiecznym miejscu (proste podejście)
  for (let tries = 0; tries < 20; tries++) {
    const x = Math.random() * this.width;
    const y = Math.random() * this.height;

    // unikaj respawnu w asteroidzie
    const safe = (this.asteroids ?? []).every(a => Math.hypot(a.x - x, a.y - y) > (a.size + player.radius + 40));
    if (!safe) continue;

    player.x = x;
    player.y = y;
    player.vx = 0;
    player.vy = 0;
    player.a = -Math.PI / 2;

    player.alive = true;
    player.respawnAt = 0;

    // wraca z częścią tarczy
    player.shield = Math.max(30, Math.floor(player.maxShield * 0.5));

    return;
  }

  // fallback jeśli nie znaleziono safe spot
  player.x = this.width / 2;
  player.y = this.height / 2;
  player.vx = player.vy = 0;
  player.a = -Math.PI / 2;
  player.alive = true;
  player.respawnAt = 0;
  player.shield = Math.max(30, Math.floor(player.maxShield * 0.5));
}

  handleBulletAsteroid() {
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const a = this.asteroids[i];
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.size) {
          this.destroyAsteroid(i, j);
          break;
        }
      }
    }
  }

  destroyAsteroid(ai, bi) {
    const a = this.asteroids[ai];

    this.asteroids.splice(ai, 1);
    this.bullets.splice(bi, 1);

    this.score++;
    this.events.push({ type: "ASTEROID_DESTROYED", x: a.x, y: a.y });

    if (a.sizeLevel > 1) {
      this.asteroids.push(...a.createFragments());
    }

    this.maybeDropPowerUp(a.x, a.y);
  }

handlePlayerAsteroid() {
  for (const player of this.players.values()) {
    if (!player.alive) continue;

    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const a = this.asteroids[i];

      if (Math.hypot(a.x - player.x, a.y - player.y) < a.size + player.radius) {
        this.asteroids.splice(i, 1);

        // ✅ per-player dmg
        player.shield -= a.size * 0.8;

        this.events.push({ type: "PLAYER_HIT", playerId: player.id });

        if (player.shield <= 0) {
          player.alive = false;
          player.respawnAt = Date.now() + 3000; // ✅ A: respawn po 3s
          this.events.push({ type: "PLAYER_DEAD", playerId: player.id });
        }
      }
    }
  }
}

handleEnemyBullets() {
  for (const player of this.players.values()) {
    if (!player.alive) continue;

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];

      if (Math.hypot(b.x - player.x, b.y - player.y) < (b.radius ?? 4) + player.radius) {
        this.enemyBullets.splice(i, 1);

        player.shield -= this.boss?.getDamage() ?? 10;
        this.events.push({ type: "PLAYER_HIT", playerId: player.id });

        if (player.shield <= 0) {
          player.alive = false;
          player.respawnAt = Date.now() + 3000;
          this.events.push({ type: "PLAYER_DEAD", playerId: player.id });
        }
      }
    }
  }
}


handlePowerUpPickup() {
  for (const player of this.players.values()) {
    if (!player.alive) continue;

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      if (Math.hypot(p.x - player.x, p.y - player.y) < p.radius + player.radius) {
        this.activatePowerUp(player, p.type, Date.now());
        this.powerUps.splice(i, 1);
      }
    }
  }
}

  activatePowerUp(player, type, now) {
  // durations masz w GameWorld (OK)
  if (POWERUP_DURATIONS[type]) {
    player.activePowerUps[type] = now + POWERUP_DURATIONS[type];
  }

  if (type === "shield") {
    player.shield = player.maxShield;
  }

  this.events.push({ type: "POWERUP_PICKED", power: type, playerId: player.id });
}

maybeDropPowerUp(x, y) {
  if (this.powerUps.length >= MAX_POWERUPS_ON_SCREEN) return;

  // Drop chance (test: 0.60, docelowo np. 0.20)
  const DROP_CHANCE = 0.60;
  if (Math.random() > DROP_CHANCE) return;

  const table = [];

  // Level 1+
  if (this.level >= 1) table.push({ type: "fastBullets", weight: 3 });
  if (this.level >= 1) table.push({ type: "speedBoost", weight: 3 });

  // Level 2+
  if (this.level >= 2) table.push({ type: "double", weight: 2 });

  // Level 3+
  if (this.level >= 3) table.push({ type: "cooling", weight: 2 });

  // Level 4+
  if (this.level >= 4) table.push({ type: "triple", weight: 1 });

  // Level 5+
  if (this.level >= 5) table.push({ type: "shield", weight: 1 });

  if (!table.length) return;

  let roll = Math.random() * table.reduce((s, e) => s + e.weight, 0);

  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) {
      this.powerUps.push(new PowerUp(x, y, entry.type));
      return;
    }
  }
}


  /* ================= HELPERS ================= */

  addAsteroid(asteroid) {
    this.asteroids.push(asteroid);
  }


  /* ================= SERIALIZATION ================= */

serialize() {
  return {
    state: this.state,
    score: this.score,
    level: this.level,

    
// ✅ ważne dla kamery na kliencie
    width: this.width,
    height: this.height,


    players: [...this.players.values()].map(p => p.serialize()),
    asteroids: this.asteroids.map(a => a.serialize()),
    bullets: this.bullets.map(b => b.serialize()),
    powerUps: this.powerUps.map(p => p.serialize()),
    boss: this.boss?.serialize() ?? null
  };
}

applyState(snapshot) {
  // ----- CORE -----
  this.state = snapshot.state;
  this.score = snapshot.score;
  this.level = snapshot.level;

  // ----- ASTEROIDY -----
  this.asteroids = snapshot.asteroids.map(a =>
    Asteroid.fromState(a)
  );

  // ----- PLAYERS -----
  this.players.clear();
  for (const pState of snapshot.players) {
    const p = Player.fromState(pState);
    this.players.set(p.id, p);
  }

  // ----- BOSS -----
  this.boss = snapshot.boss
    ? Boss.fromState(snapshot.boss)
    : null;
}

}