// engine/entities/Player.js

export class Player {
  constructor(x, y) {
    this.id = null;

    // --- transform ---
    this.x = x;
    this.y = y;

    // --- velocity (WEKTOR, NIE speed) ---
    this.vx = 0;
    this.vy = 0;

    // --- angle ---
    this.a = -Math.PI / 2;

    this.radius = 15;
  }

  /* ================= INPUT ================= */
  applyInput(input) {
    const TURN_SPEED = 0.07;
    const ACCEL = 0.09;

    // ----- ROTATION -----
    if (input.rotateLeft)  this.a -= TURN_SPEED;
    if (input.rotateRight) this.a += TURN_SPEED;

    // ----- THRUST -----
    let thrust = 0;

    if (input.thrustForward)  thrust = ACCEL;
    if (input.thrustBackward) thrust = -ACCEL * 0.6;

    if (thrust !== 0) {
      this.vx += Math.cos(this.a) * thrust;
      this.vy += Math.sin(this.a) * thrust;
    }
  }

  /* ================= UPDATE ================= */
  update(world) {
    const DRAG = 0.985;

    // ----- MOVE -----
    this.x += this.vx;
    this.y += this.vy;

    // ----- DAMPING -----
    this.vx *= DRAG;
    this.vy *= DRAG;

    // ----- WORLD WRAP -----
    if (this.x < 0) this.x += world.width;
    if (this.x > world.width) this.x -= world.width;
    if (this.y < 0) this.y += world.height;
    if (this.y > world.height) this.y -= world.height;
  }

  /* ================= SERIALIZATION ================= */
  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      a: this.a,
      radius: this.radius
    };
  }

  static fromState(state) {
    const p = new Player(state.x, state.y);
    p.id = state.id;
    p.vx = state.vx;
    p.vy = state.vy;
    p.a  = state.a;
    p.radius = state.radius;
    return p;
  }
}