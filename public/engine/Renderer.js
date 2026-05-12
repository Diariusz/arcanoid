// engine/Renderer.js
export class Renderer {
  constructor(canvas, assets = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.assets = assets;
  }

  clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

render(world, fx, net = null) {
  this.clear();
  this.drawBackground(net?.camera);

  // ===== WORLD SPACE (kamera) =====
  const cam = net?.camera ?? { x: 0, y: 0 };

  this.ctx.save();
  this.ctx.translate(-cam.x, -cam.y);

  // wszystko co jest w świecie rysujemy w space świata
  this.drawAsteroids(world.asteroids ?? []);
  this.drawPowerUps?.(world.powerUps ?? []);
  this.drawBullets(world.bullets ?? []);
  this.drawEnemyBullets(world.enemyBullets ?? []);
  this.drawBoss(world.boss);

  for (const player of world.players.values()) {
    // jeśli nadal chcesz specjalnie local predicted – możesz zostawić, ale u Ciebie
    // i tak doklejasz predictedPlayer do renderWorld.players, więc to może być zbędne.
    this.drawPlayer(player);
  }

  this.ctx.restore();

  // ===== UI SPACE (bez kamery) =====
  this.drawUI(world);
}



  /* ================= BACKGROUND ================= */

drawParallaxLayer(img, camera, factor = 0.1, alpha = 0.25) {
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const ctx = this.ctx;
  const cw = this.canvas.width;
  const ch = this.canvas.height;

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  // przesunięcie wynikające z kamery (paralaksa)
  // mniejszy factor = warstwa “dalsza”
  const ox = -((camera?.x ?? 0) * factor) % iw;
  const oy = -((camera?.y ?? 0) * factor) % ih;

  ctx.save();
  ctx.globalAlpha = alpha;

  // tile (kafelkujemy, aby nie było pustych krawędzi)
  for (let x = ox - iw; x < cw + iw; x += iw) {
    for (let y = oy - ih; y < ch + ih; y += ih) {
      ctx.drawImage(img, x, y);
    }
  }

  ctx.restore();
}

drawBackground(camera = { x: 0, y: 0 }) {
  const ctx = this.ctx;

  // baza: czarne tło
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

  // warstwy mgławic (paralaksa)
  const bg = this.assets.background ?? {};
  this.drawParallaxLayer(bg.nebula1, camera, 0.08, 0.22);
  this.drawParallaxLayer(bg.nebula2, camera, 0.14, 0.28);
  this.drawParallaxLayer(bg.nebula3, camera, 0.22, 0.20);

  // delikatny “film grain” / przyciemnienie (opcjonalnie)
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  ctx.restore();
}

  /* ================= PLAYER ================= */

  drawPlayer(player) {
    if (!player) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.a + Math.PI / 2);
    
    const size = player.radius * 2.4;

    if (this.assets.playerShip?.complete) {
      ctx.drawImage(
        this.assets.playerShip,
        -size / 2,
        -size / 2,
        size,
        size
      );
    } else {
      // fallback
      ctx.strokeStyle = "white";
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, size / 2);
      ctx.lineTo(-size / 2, size / 2);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ================= ASTEROIDS ================= */

  drawAsteroids(asteroids) {
    for (const a of asteroids) {
      this.drawAsteroid(a);
    }
  }

  drawAsteroid(a) {
    const ctx = this.ctx;

    const img =
      this.assets.asteroids?.[a.sizeLevel] ?? null;

    const size = a.size * 2;

    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.moveAngle ?? 0);

    if (img?.complete) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.strokeStyle = "#888";
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ================= BULLETS ================= */

  drawBullets(bullets) {
    const ctx = this.ctx;
    ctx.fillStyle = "yellow";
    for (const b of bullets) {
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    }
  }

  drawEnemyBullets(bullets) {
    const ctx = this.ctx;
    ctx.fillStyle = "red";
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius ?? 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ================= BOSS ================= */

  drawBoss(boss) {
    if (!boss) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(boss.angle + Math.PI / 2);

    const size = boss.radius * 2;

    if (this.assets.bossAlien?.complete) {
      ctx.drawImage(
        this.assets.bossAlien,
        -size / 2,
        -size / 2,
        size,
        size
      );
    } else {
      ctx.strokeStyle = "red";
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ================= UI ================= */

  drawUI(world) {
    const ctx = this.ctx;
    ctx.fillStyle = "white";
    ctx.font = "18px Consolas";
    //ctx.fillText(`Wynik: ${world.score}`, 20, 30);

    // boss HP
    if (world.isBossFight && world.boss) {
      this.drawBossHP(world.boss);
    }
  }

  drawBossHP(boss) {
    const ctx = this.ctx;
    const barW = this.canvas.width * 0.6;
    const barH = 16;
    const x = (this.canvas.width - barW) / 2;
    const y = 20;

    const hp = boss.health / boss.maxHealth;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, y, barW, barH);

    let color = "lime";
    if (hp < 0.5) color = "orange";
    if (hp < 0.25) color = "red";

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW * hp, barH);

    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, barW, barH);
  }

    /* ================= POWER-UPS ================= */

drawPowerUps(powerUps = []) {
  const ctx = this.ctx;
  if (!powerUps || powerUps.length === 0) return;

  for (const p of powerUps) {
    const r = p.radius ?? 14;
    const size = r * 2;

    // assets.powerUps[type]
    const img = this.assets?.powerUps?.[p.type] ?? null;

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, p.x - r, p.y - r, size, size);
    } else {
      // fallback: kółko + literka, jeśli obrazek się nie załadował
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.font = "12px monospace";

      const letter =
        p.type === "fastBullets" ? "F" :
        p.type === "double" ? "D" :
        p.type === "triple" ? "T" :
        p.type === "cooling" ? "C" :
        p.type === "shield" ? "S" : "?";

      ctx.fillText(letter, p.x - 4, p.y + 4);
      ctx.restore();
    }
  }
}

}