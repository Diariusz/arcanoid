// engine/StageManager.js
import { STAGES } from "./config/stages.js";
import Asteroid from "./entities/Asteroid.js";
import Boss from "./entities/Boss.js";

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function teamCenter(world) {
  const alive = [...world.players.values()].filter(p => p.alive);
  const arr = alive.length ? alive : [...world.players.values()];
  if (!arr.length) return { x: world.width / 2, y: world.height / 2 };

  const sx = arr.reduce((s, p) => s + p.x, 0);
  const sy = arr.reduce((s, p) => s + p.y, 0);
  return { x: sx / arr.length, y: sy / arr.length };
}

function randomPointInRing(cx, cy, rMin, rMax) {
  const ang = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random() * (rMax * rMax - rMin * rMin) + rMin * rMin);
  return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
}

export class StageManager {
  constructor(world) {
    this.world = world;

    this.stageIndex = 0;
    this.state = "IDLE"; // IDLE → STARTING → ACTIVE → COMPLETED
    this.timer = 0;
  }

  get currentStage() {
    return STAGES[this.stageIndex] ?? null;
  }

  

  update() {
    switch (this.state) {

      case "IDLE":
        this.startStage();
        break;

      case "STARTING":
        this.timer--;
        if (this.timer <= 0) {
          this.spawnStage();
        }
        break;

      case "ACTIVE":
        if (this.isStageComplete()) {
          this.completeStage();
        }
        break;

      case "COMPLETED":
        this.timer--;
        if (this.timer <= 0) {
          this.advanceStage();
        }
        break;
    }
  }

  /* ================= STAGES ================= */

  startStage() {
    const stage = this.currentStage;
    if (!stage) return;

    this.state = "STARTING";
    this.timer = 60; // ~1s

    this.world.events.push({
      type: stage.type === "boss"
        ? "BOSS_INCOMING"
        : "STAGE_START",
      stageId: stage.id
    });
  }

  spawnStage() {
    const stage = this.currentStage;

    // reset świata (jak w Twojej grze)
    this.world.asteroids.length = 0;
    this.world.bullets.length = 0;
    this.world.enemyBullets.length = 0;
    this.world.explosions.length = 0;
    this.world.dustClouds.length = 0;

    this.clearModifiers();

    if (stage.type === "boss" && stage.boss) {
      this.spawnBoss(stage.boss.level);
    }

    if (stage.type === "normal" && stage.asteroids) {
      this.spawnAsteroids(stage.asteroids.big);
    }

    this.applyModifiers(stage.modifiers);

    this.state = "ACTIVE";
  }

  isStageComplete() {
    return (
      this.world.asteroids.length === 0 &&
      this.world.boss === null
    );
  }

  completeStage() {
    const stage = this.currentStage;

    this.state = "COMPLETED";
    this.timer = 120;

    this.world.events.push({
      type: "STAGE_COMPLETED",
      stageId: stage.id
    });
  }

  advanceStage() {
    this.clearModifiers();
    this.stageIndex++;
    this.state = "IDLE";
  }

  /* ================= SPAWN ================= */

  spawnAsteroids(count) {
  this.world.isBossFight = false;
  this.world.boss = null;

  const { x: cx, y: cy } = teamCenter(this.world);

  const rMin = 500;   // minimum odległości od graczy (nie spawnuj na nich)
  const rMax = 1200;  // maksimum (żeby nie było “czekania”)

  for (let i = 0; i < count; i++) {
    let pos = null;

    for (let tries = 0; tries < 20; tries++) {
      const p = randomPointInRing(cx, cy, rMin, rMax);

      // clamp do granic świata/sektora
      const x = clamp(p.x, 60, this.world.width - 60);
      const y = clamp(p.y, 60, this.world.height - 60);

      // opcjonalnie: unikaj zbyt bliskich spawnów między asteroidami
      const ok = this.world.asteroids.every(a => Math.hypot(a.x - x, a.y - y) > (a.size + 80));
      if (ok) {
        pos = { x, y };
        break;
      }
    }

    if (!pos) {
      // fallback w pobliżu środka drużyny
      pos = {
        x: clamp(cx + (Math.random() * 200 - 100), 60, this.world.width - 60),
        y: clamp(cy + (Math.random() * 200 - 100), 60, this.world.height - 60)
      };
    }

    this.world.addAsteroid(new Asteroid(pos.x, pos.y, 3));
  }
}

  spawnBoss(level) {
    this.world.isBossFight = true;
    this.world.boss = new Boss(level);

    this.world.events.push({
      type: "BOSS_SPAWNED",
      level
    });
  }

  /* ================= MODIFIERS ================= */

  applyModifiers(modifiers) {
    modifiers.forEach(mod => {
      if (mod === "FAST_FRAGMENTS") {
        Asteroid.globalFragmentSpeedMultiplier = 1.5;
      }
      if (mod === "ERRATIC_MOVEMENT") {
        Asteroid.globalErraticMovement = true;
      }
    });
  }

  clearModifiers() {
    Asteroid.globalFragmentSpeedMultiplier = 1;
    Asteroid.globalErraticMovement = false;
  }
}