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

    this.drawBackground();

    
for (const player of world.players.values()) {
  if (
    net &&
    net.localPlayerId === player.id &&
    net.predictedPlayer
  ) {
    this.drawPlayer({
      ...player,
      x: net.predictedPlayer.x,
      y: net.predictedPlayer.y,
      a: net.predictedPlayer.a
    });
  } else {
    this.drawPlayer(player);
  }
}



    this.drawAsteroids(world.asteroids);
    this.drawBullets(world.bullets);
    this.drawEnemyBullets(world.enemyBullets);
    this.drawBoss(world.boss);
    this.drawUI(world);


  }

  /* ================= BACKGROUND ================= */

  drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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
    ctx.fillText(`Wynik: ${world.score}`, 20, 30);

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
}