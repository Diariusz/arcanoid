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
  cooling: 12000
};

const MAX_POWERUPS_ON_SCREEN = 2;

/* ================= GAME WORLD ================= */

export class GameWorld {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;

    /* ===== CORE STATE ===== */
    this.state = GAME_STATE.MENU;

    this.players = new Map(); // id -> Player

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
      cooling: 0
    };

    /* ===== SHOOTING ===== */
    this.lastShotTime = 0;
    this.fireCooldown = 250;
    this.maxBullets = 60;

    this.purgeCooldown = 6000;
    this.lastPurgeTime = -Infinity;
    this.canShoot = true;
    this.purgeLockTimer = 0;
    this.PURGE_LOCK_FRAMES = 72;

    /* ===== UTILS ===== */
    this.events = [];
    this.tick = 0;
  }

  /* ================= PLAYERS ================= */

  addPlayer(player) {
    this.players.set(player.id, player);
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  getPlayer(id = "local") {
    return this.players.get(id);
  }

  /* ================= UPDATE LOOP ================= */

  update(dt, now) {
    if (this.state !== GAME_STATE.PLAYING) return;

    this.tick++;

    this.updatePowerUps(now);

    for (const player of this.players.values()) {
      player.update(dt, this);
    }

    this.updateBullets();
    this.updateAsteroids();
    this.updateBoss();
    this.handleCollisions();

    this.updateHeat();
    this.updatePurgeLock();
    
if (this.tick % 60 === 0) {
  console.log(this.serialize().asteroids);
}

  }

  /* ================= SHOOTING ================= */

  addBulletFromPlayer(player, now) {
    if (!this.canShoot) return;
    if (this.overheated) return;
    if (this.bullets.length >= this.maxBullets) return;
    if (now - this.lastShotTime < this.fireCooldown) return;

    this.lastShotTime = now;

    const triple = this.activePowerUps.triple > 0;
    const double = this.activePowerUps.double > 0;

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

    this.heat += 12;

    if (this.heat >= this.maxHeat) {
      this.overheated = true;
      this.events.push({ type: "OVERHEAT" });
    }
  }

  spawnBullet(player, angleOffset = 0) {
    this.bullets.push(
      new Bullet(
        player.x,
        player.y,
        player.a + angleOffset
      )
    );
  }

  attemptPurge(now) {
    if (now - this.lastPurgeTime < this.purgeCooldown) return;

    this.heat = 0;
    this.overheated = false;

    this.canShoot = false;
    this.purgeLockTimer = this.PURGE_LOCK_FRAMES;
    this.lastPurgeTime = now;

    this.events.push({ type: "PURGE" });
  }

  /* ================= SYSTEMS ================= */

  updatePowerUps(now) {
    for (const key in this.activePowerUps) {
      if (this.activePowerUps[key] > 0 && now > this.activePowerUps[key]) {
        this.activePowerUps[key] = 0;
      }
    }
  }

  updateHeat() {
    const cooling = this.activePowerUps.cooling > 0 ? 1.0 : 0.5;

    if (!this.overheated) {
      this.heat = Math.max(0, this.heat - cooling);
    } else {
      this.heat -= cooling * 0.2;
      if (this.heat <= 0) {
        this.heat = 0;
        this.overheated = false;
      }
    }
  }

  updatePurgeLock() {
    if (!this.canShoot) {
      this.purgeLockTimer--;
      if (this.purgeLockTimer <= 0) {
        this.canShoot = true;
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
      for (let i = this.asteroids.length - 1; i >= 0; i--) {
        const a = this.asteroids[i];
        if (Math.hypot(a.x - player.x, a.y - player.y) < a.size + player.radius) {
          this.asteroids.splice(i, 1);
          this.shield -= a.size * 0.8;
          this.events.push({ type: "PLAYER_HIT", playerId: player.id });
        }
      }
    }
  }

  handleEnemyBullets() {
    for (const player of this.players.values()) {
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        if (Math.hypot(b.x - player.x, b.y - player.y) < b.radius + player.radius) {
          this.enemyBullets.splice(i, 1);
          this.shield -= this.boss?.getDamage() ?? 10;
          this.events.push({ type: "PLAYER_HIT", playerId: player.id });
        }
      }
    }
  }

  handlePowerUpPickup() {
    for (const player of this.players.values()) {
      for (let i = this.powerUps.length - 1; i >= 0; i--) {
        const p = this.powerUps[i];
        if (
          Math.hypot(p.x - player.x, p.y - player.y) <
          p.radius + player.radius
        ) {
          this.activatePowerUp(p.type, Date.now());
          this.powerUps.splice(i, 1);
        }
      }
    }
  }

  activatePowerUp(type, now) {
    if (POWERUP_DURATIONS[type]) {
      this.activePowerUps[type] = now + POWERUP_DURATIONS[type];
    }

    if (type === "shield") {
      this.shield = this.maxShield;
    }

    this.events.push({ type: "POWERUP_PICKED", power: type });
  }

  maybeDropPowerUp(x, y) {
    if (this.powerUps.length >= MAX_POWERUPS_ON_SCREEN) return;
    if (Math.random() > 0.12) return;

    const table = [];
    if (this.level >= 2) table.push({ type: "double", weight: 3 });
    if (this.level >= 3) table.push({ type: "cooling", weight: 2 });
    if (this.level >= 4) table.push({ type: "triple", weight: 2 });
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
      players: [...this.players.values()].map(p => p.serialize()),
      asteroids: this.asteroids.map(a => a.serialize()),
      bullets: this.bullets.map(b => b.serialize()),
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

  this.bullets = (snapshot.bullets ?? []).map(b =>
  Bullet.fromState(b)
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