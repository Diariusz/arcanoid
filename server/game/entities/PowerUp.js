// server/game/entities/PowerUp.js
import crypto from "crypto";

export class PowerUp {
  constructor(x, y, type) {
    this.id = crypto.randomUUID();
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = 14; // dostosuj do wyglądu/kolizji
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      type: this.type,
      radius: this.radius
    };
  }

  static fromState(s) {
    const p = new PowerUp(s.x, s.y, s.type);
    p.id = s.id;
    p.radius = s.radius ?? p.radius;
    return p;
  }
}