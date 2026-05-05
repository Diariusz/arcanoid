// engine/StageManager.js
import { STAGES } from "./config/stages.js";
import Asteroid from "./entities/Asteroid.js";
import Boss from "./entities/Boss.js";

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

    for (let i = 0; i < count; i++) {
      this.world.addAsteroid(
        new Asteroid(
          Math.random() * this.world.width,
          Math.random() * this.world.height,
          3
        )
      );
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