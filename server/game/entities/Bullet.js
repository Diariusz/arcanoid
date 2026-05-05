// server/game/entities/Bullet.js

export class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 8;
    this.radius = 3;
    this.id = crypto.randomUUID();
  }

  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
  }

  isOutOfBounds(width, height) {
    return (
      this.x < -50 ||
      this.x > width + 50 ||
      this.y < -50 ||
      this.y > height + 50
    );
  }

  // ✅ KLUCZOWA METODA – SERWER MUSI JĄ MIEĆ
  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      angle: this.angle
    };
  }

  static fromState(s) {
    const b = new Bullet(s.x, s.y, s.angle);
    b.id = s.id;
    return b;
  }

}
