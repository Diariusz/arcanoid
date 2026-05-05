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
  // angle = 0 -> w górę
  this.x += Math.sin(this.angle) * this.speed;
  this.y -= Math.cos(this.angle) * this.speed;
}


  isOutOfBounds(width, height) {
    return (
      this.x < -50 ||
      this.x > width + 50 ||
      this.y < -50 ||
      this.y > height + 50
    );
  }

  /* ✅ SERIALIZE */
  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      angle: this.angle
    };
  }

  /* ✅ FROM STATE */
  static fromState(s) {
    const b = new Bullet(s.x, s.y, s.angle);
    b.id = s.id;
    return b;
  }

}
