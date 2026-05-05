// engine/entities/Asteroid.js

export default class Asteroid {
  constructor(x, y, sizeLevel = 3) {
    this.sizeLevel = sizeLevel;

    // --- WIELKOŚĆ ---
    // Renderer oczekuje `size`
    this.size = sizeLevel * 24;
    this.radius = this.size;

    // --- POZYCJA ---
    this.x = x;
    this.y = y;

    this.id = crypto.randomUUID(); // ✅ STAŁE ID

    // --- RUCH ---
    // Losowość TYLKO tutaj (server-side w MP)
    this.moveAngle = Math.random() * Math.PI * 2;
    this.speed = 1.2 + Math.random() * 1.8;
  }

  /* ================= UPDATE ================= */

  update(worldWidth, worldHeight) {
    this.x += Math.cos(this.moveAngle) * this.speed;
    this.y += Math.sin(this.moveAngle) * this.speed;

    const r = this.radius;

    // klasyczne Asteroids wrap
    if (this.x < -r) this.x = worldWidth + r;
    if (this.x > worldWidth + r) this.x = -r;
    if (this.y < -r) this.y = worldHeight + r;
    if (this.y > worldHeight + r) this.y = -r;
  }

  /* ================= FRAGMENTATION ================= */

  createFragments() {
    // najmniejsza asteroida już się nie dzieli
    if (this.sizeLevel <= 1) return [];

    const newLevel = this.sizeLevel - 1;
    const fragments = [];

    // klasyczne Asteroids: 2 fragmenty
    for (let i = 0; i < 2; i++) {
      const a = new Asteroid(this.x, this.y, newLevel);

      // lekko rozrzucamy kierunek (deterministycznie)
      a.moveAngle =
        this.moveAngle +
        (i === 0 ? -0.5 : 0.5);

      // fragmenty są trochę szybsze
      a.speed = this.speed * 1.2;

      fragments.push(a);
    }

    return fragments;
  }

  /* ================= SERIALIZATION ================= */

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      sizeLevel: this.sizeLevel,
      size: this.size,
      radius: this.radius,
      moveAngle: this.moveAngle,
      speed: this.speed
    };
  }


  static fromState(state) {
    const a = new Asteroid(state.x, state.y, state.sizeLevel);
    a.id = state.id;
    a.size = state.size;
    a.radius = state.radius;
    a.moveAngle = state.moveAngle;
    a.speed = state.speed;
    return a;
  }


}