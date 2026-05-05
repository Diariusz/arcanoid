// engine/entities/Player.js
export class Player {
  constructor(x, y) {
    this.id = "local"; // ✅ WAŻNE
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.a = -Math.PI / 2;

    this.radius = 15;
    this.speed = 0;
  }

  applyInput(input, world) {
    // OBRÓT
    if (input.rotateLeft) this.a -= 0.07;
    if (input.rotateRight) this.a += 0.07;

    // GAZ
    if (input.thrustForward) {
      this.speed = Math.min(this.speed + 0.52, 4);
    }

    if (input.thrustBackward) {
      this.speed = Math.max(this.speed - 0.12, -2);
    }

    // TAP = obrót w stronę punktu
    if (input.touchAngle) {
      const target = Math.atan2(
        input.touchAngle.y - this.y,
        input.touchAngle.x - this.x
      );
      const diff =
        ((target - this.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.a += diff * 0.25;
    }

    if (input.fire) {
      world.addBulletFromPlayer(this);
    }

    if (input.purge) {
      world.attemptPurge();
    }
  }

  update(dt, world) {

this.x += Math.sin(this.a) * this.speed;
this.y -= Math.cos(this.a) * this.speed;


    this.speed *= 0.98;

    // wrap
    if (this.x < 0) this.x += world.width;
    if (this.x > world.width) this.x -= world.width;
    if (this.y < 0) this.y += world.height;
    if (this.y > world.height) this.y -= world.height;
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      a: this.a,
      speed: this.speed,
      radius: this.radius
    };
  }

static fromState(state) {
    const p = new Player(state.x, state.y);
    p.id = state.id;
    p.a = state.a;
    p.speed = state.speed;
    p.radius = state.radius;
    return p;
  }

}