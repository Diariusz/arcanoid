// server/game/entities/Player.js
export class Player {
  constructor(x, y) {
    this.id = null;
    this.sessionId = null;
    this.disconnectedAt = null;

    this.x = x;
    this.y = y;

    this.vx = 0;
    this.vy = 0;

    this.a = -Math.PI / 2;
    this.radius = 15;

    // netcode
    this.lastProcessedInput = -1;

    // ===== COOP: per-player HP =====
    this.maxShield = 100;
    this.shield = 100;

    // ===== COOP: per-player heat/overheat =====
    this.maxHeat = 100;
    this.heat = 0;
    this.overheated = false;

    // ===== COOP: per-player power-ups (timery ms) =====
    this.activePowerUps = {
      double: 0,
      triple: 0,
      cooling: 0,
      fastBullets: 0,
      speedBoost: 0
    };

    // ===== COOP: respawn =====
    this.alive = true;
    this.respawnAt = 0; // ms timestamp

    // ===== per-player shooting timers =====
    this.lastShotTime = 0;
    this.lastPurgeTime = -Infinity;
    this.canShoot = true;
    this.purgeLockTimer = 0;
  }

  // accelMult dla SPEED_BOOST
  applyInput(input, accelMult = 1.0) {
    if (!this.alive) return;

    const TURN_SPEED = 0.07;

    // baza wolniejsza (ustaliliśmy B i 14 po stronie bullets; statek też wolniej)
    const ACCEL = 0.09 * accelMult;

    if (input.rotateLeft)  this.a -= TURN_SPEED;
    if (input.rotateRight) this.a += TURN_SPEED;

    let thrust = 0;
    if (input.thrustForward)  thrust = ACCEL;
    if (input.thrustBackward) thrust = -ACCEL * 0.6;

    if (thrust !== 0) {
      this.vx += Math.cos(this.a) * thrust;
      this.vy += Math.sin(this.a) * thrust;
    }
  }

  update(world) {
    if (!this.alive) return;

    const DRAG = 0.985;

    this.x += this.vx;
    this.y += this.vy;

    // SPEED BOOST (B): wyższy max speed
    const now = Date.now();
    const boosted = (this.activePowerUps.speedBoost ?? 0) > now;
    const MAX_SPEED = boosted ? 9.0 : 6.5;

    const sp = Math.hypot(this.vx, this.vy);
    if (sp > MAX_SPEED) {
      const s = MAX_SPEED / sp;
      this.vx *= s;
      this.vy *= s;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;

    // Granice świata (na razie wrap; przy sektorach zrobimy clamp)
    
    // clamp do granic sektora
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x > world.width) { this.x = world.width; this.vx = 0; }
    if (this.y < 0) { this.y = 0; this.vy = 0; }
    if (this.y > world.height) { this.y = world.height; this.vy = 0; }

  }

  serialize() {
    return {
      id: this.id,
      sessionId: this.sessionId, // przydatne do debug/coop (opcjonalnie)
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      a: this.a,
      angle: Math.atan2(this.vy, this.vx),
      radius: this.radius,

      // COOP HUD
      shield: this.shield,
      maxShield: this.maxShield,
      heat: this.heat,
      maxHeat: this.maxHeat,
      overheated: this.overheated,
      activePowerUps: this.activePowerUps,

      alive: this.alive,
      respawnAt: this.respawnAt
    };
  }

  static fromState(state) {
    const p = new Player(state.x, state.y);
    p.id = state.id;
    p.sessionId = state.sessionId ?? null;
    p.vx = state.vx;
    p.vy = state.vy;
    p.a = state.a;
    p.radius = state.radius;

    // COOP
    p.shield = state.shield ?? 100;
    p.maxShield = state.maxShield ?? 100;
    p.heat = state.heat ?? 0;
    p.maxHeat = state.maxHeat ?? 100;
    p.overheated = !!state.overheated;
    p.activePowerUps = state.activePowerUps ?? p.activePowerUps;
    p.alive = state.alive ?? true;
    p.respawnAt = state.respawnAt ?? 0;

    return p;
  }
}