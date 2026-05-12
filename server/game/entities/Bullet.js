
// server/game/entities/Bullet.js

import crypto from "crypto";

export class Bullet {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;

    this.vx = vx;
    this.vy = vy;

    this.radius = 3;
    this.id = crypto.randomUUID();
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }

  isOutOfBounds(width, height) {
    return (
      this.x < -50 ||
      this.x > width + 50 ||
      this.y < -50 ||
      this.y > height + 50
    );
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      angle: Math.atan2(this.vy, this.vx)
    };
  }

  static fromState(s) {
    const b = new Bullet(s.x, s.y, s.vx, s.vy);
    b.id = s.id;
    return b;
  }
}
