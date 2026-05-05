/* ================= GAME MODE ================= */

const GAME_MODE = {
  SINGLE: "single",
  MULTI: "multi"
};

// 👉 NA RAZIE TESTUJEMY MULTI
const gameMode = GAME_MODE.MULTI;

/* ================= IMPORTS ================= */

import { GameWorld } from "./engine/GameWorld.js";
import { StageManager } from "./engine/StageManager.js";
import { Renderer } from "./engine/Renderer.js";
import { Player } from "./engine/entities/Player.js";
import { InputManager } from "./engine/InputManager.js";
import { FXManager } from "./engine/FXManager.js";
import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

/* ================= CANVAS ================= */

const canvas = document.getElementById("game");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const inputManager = new InputManager(canvas);
const fx = new FXManager();

/* ================= ASSETS ================= */

const assets = {
  playerShip: new Image(),
  bossAlien: new Image(),
  asteroids: {
    1: new Image(),
    2: new Image(),
    3: new Image()
  }
};

assets.playerShip.src = "img/player_ship.png";
assets.bossAlien.src = "img/boss_alien.png";
assets.asteroids[1].src = "img/asteroid_small.png";
assets.asteroids[2].src = "img/asteroid_medium.png";
assets.asteroids[3].src = "img/asteroid_big.png";

/* ================= WORLD ================= */

const world = new GameWorld({
  width: canvas.width,
  height: canvas.height
});

/* ================= SINGLEPLAYER PLAYER ================= */

if (gameMode === GAME_MODE.SINGLE) {
  const player = new Player(canvas.width / 2, canvas.height / 2);
  player.id = "local";
  world.addPlayer(player);
}

/* ================= MULTIPLAYER SOCKET ================= */

let socket = null;

if (gameMode === GAME_MODE.MULTI) {
  socket = io("http://localhost:3001");

  socket.on("connect", () => {
    console.log("🟢 Connected to multiplayer server");
  });

  socket.on("state", msg => {
    stateBuffer.push({
      time: msg.time,        // ✅ czas serwera
      snapshot: msg.snapshot
    });

    if (stateBuffer.length > 20) {
      stateBuffer.shift();
    }
  });

}

/* ================= SYSTEMS ================= */

const stageManager = new StageManager(world);
const renderer = new Renderer(canvas, assets);

// 🔁 BUFFER STANÓW Z SERWERA
const stateBuffer = [];
const BUFFER_TIME = 150; // ms opóźnienia (bezpieczne)


// 🔮 CLIENT‑SIDE PREDICTION (TYLKO STRZAŁY)
const predictedBullets = new Map();
let predictedShotSeq = 0;

// 🔮 CLIENT‑SIDE PREDICTION (RUCH GRACZA)
let predictedPlayer = null;

/* ================= GAME LOOP ================= */

function interpolateWorld(world, prevState, nextState, t) {
  // ----- SCORE / LEVEL -----
  world.score = nextState.score;
  world.level = nextState.level;

  // ----- ASTEROIDS -----
  const prevAsteroids = new Map(
    prevState.asteroids.map(ast => [ast.id, ast])
  );

  world.asteroids = nextState.asteroids.map(next => {
    const prev = prevAsteroids.get(next.id) ?? next;

    return {
      ...next,
      x: lerp(prev.x, next.x, t),
      y: lerp(prev.y, next.y, t)
    };
  });

  // ----- BULLETS -----
  const prevBullets = new Map(
    (prevState.bullets ?? []).map(b => [b.id, b])
  );

  world.bullets = (nextState.bullets ?? []).map(next => {
    const prev = prevBullets.get(next.id) ?? next;

    return {
      ...next,
      x: lerp(prev.x, next.x, t),
      y: lerp(prev.y, next.y, t)
    };
  });

  // ----- PLAYERS (Z PREDICTION) -----
  world.players.clear();

  nextState.players.forEach(p => {
    const isLocal = socket && p.id === socket.id;
    const prev =
      prevState.players.find(pp => pp.id === p.id) ?? p;

    let x, y, a;

    if (isLocal && predictedPlayer) {
      // ✅ render STRICTLY from prediction
      x = predictedPlayer.x;
      y = predictedPlayer.y;
      a = predictedPlayer.a;

      // ✅ soft correction ONLY if prediction exists
      const dx = p.x - predictedPlayer.x;
      const dy = p.y - predictedPlayer.y;
      const da =
        ((p.a - predictedPlayer.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

      if (dx * dx + dy * dy > 36) {
        predictedPlayer.x += dx * 0.1;
        predictedPlayer.y += dy * 0.1;
      }

      if (Math.abs(da) > 0.05) {
        predictedPlayer.a += da * 0.1;
      }

    } else {
      // ✅ fallback WHEN prediction does not exist
      x = lerp(prev.x, p.x, t);
      y = lerp(prev.y, p.y, t);
      a = lerpAngle(prev.a, p.a, t);
    }

    world.players.set(p.id, {
      ...p,
      x,
      y,
      a
    });
  });

  // ----- USUWANIE PREDICTED BULLETS -----
  for (const real of nextState.bullets ?? []) {
    for (const [id, pb] of predictedBullets) {
      const dx = real.x - pb.x;
      const dy = real.y - pb.y;
      if (dx * dx + dy * dy < 400) {
        predictedBullets.delete(id);
      }
    }
  }

// ✅ ENSURE LOCAL PLAYER IS ALWAYS PRESENT (RENDER SAFETY)
if (socket && predictedPlayer) {
  const id = socket.id;

  if (!world.players.has(id)) {
    world.players.set(id, {
      id,
      x: predictedPlayer.x,
      y: predictedPlayer.y,
      a: predictedPlayer.a,
      radius: 15,        // ← taki sam jak Player
      speed: predictedPlayer.speed ?? 0
    });
  }
}


}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  const diff =
    ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

const predState = {
  localPlayerId: socket?.id,
  predictedPlayer
};


function loop() {
  const input = inputManager.getInput();

  /* ================= SINGLEPLAYER ================= */
  if (gameMode === GAME_MODE.SINGLE) {
    const player = world.getPlayer("local");
    if (player) {
      player.applyInput(input, world);
    }

    world.update(1 / 60, performance.now());
    stageManager.update();
  }

/* ================= MULTIPLAYER ================= */
if (gameMode === GAME_MODE.MULTI && socket) {

  // 🔮 LOCAL PLAYER PREDICTION
  const me = world.players.get(socket.id);

  if (me) {
    if (!predictedPlayer) {
      // ✅ inicjalizacja tylko raz, z serwera
      predictedPlayer = {
        x: me.x,
        y: me.y,
        a: me.a,
        vx: 0,
        vy: 0
      };
    }

    /* ---------- OBRÓT (100% CLIENT‑SIDE) ---------- */
    const TURN_SPEED = 0.065;
    predictedPlayer.a +=
      (input.rotateRight ? TURN_SPEED : 0) -
      (input.rotateLeft  ? TURN_SPEED : 0);

    /* ---------- PRZYSPIESZENIE ---------- */
    let accel = 0;
    if (input.thrustForward)  accel = 0.12;
    if (input.thrustBackward) accel = -0.08;

    /* ---------- WEKTOR PRĘDKOŚCI ---------- */
    predictedPlayer.vx += Math.cos(predictedPlayer.a) * accel;
    predictedPlayer.vy += Math.sin(predictedPlayer.a) * accel;

    /* ---------- TŁUMIENIE ---------- */
    predictedPlayer.vx *= 0.985;
    predictedPlayer.vy *= 0.985;

    /* ---------- RUCH ---------- */
    predictedPlayer.x += predictedPlayer.vx;
    predictedPlayer.y += predictedPlayer.vy;
  }

  // 🔫 CLIENT‑SIDE PREDICTION STRZAŁU
if (input.fire &&  predictedPlayer &&  me?.canShoot) {
  const id = `p-${predictedShotSeq++}`;
  const GUN_OFFSET = 18;

  predictedBullets.set(id, {
    id,
    x: predictedPlayer.x + Math.cos(predictedPlayer.a) * GUN_OFFSET,
    y: predictedPlayer.y + Math.sin(predictedPlayer.a) * GUN_OFFSET,
    angle: predictedPlayer.a,
    bornAt: performance.now()
  });
}


  // 🔵 INPUT ZAWSZE IDZIE DO SERWERA
  socket.emit("input", input);

  // 🔁 INTERPOLACJA STANU
  if (stateBuffer.length >= 2) {
    const renderTime = Date.now() - BUFFER_TIME;

    let i = 0;
    while (
      i < stateBuffer.length - 1 &&
      stateBuffer[i + 1].time <= renderTime
    ) {
      i++;
    }

    const s1 = stateBuffer[i];
    const s2 = stateBuffer[i + 1];

    if (s1 && s2) {
      let t =
        (renderTime - s1.time) /
        (s2.time - s1.time || 1);

      t = Math.max(0, Math.min(1, t)); // ✅ clamp

      interpolateWorld(world, s1.snapshot, s2.snapshot, t);
    }
  }
}


  fx.update();

  // 🔮 ruch predicted bullets (tylko wizualnie)
  const now = performance.now();
  for (const b of predictedBullets.values()) {
    const dt = (now - b.bornAt) / 16;
    b.x += Math.cos(b.angle) * 8 * dt;
    b.y += Math.sin(b.angle) * 8 * dt;
  }

// ✅ WORLD TYLKO DO RENDERU

// ===== SKŁADANIE ŚWIATA DO RENDERU =====
const renderWorld = {
  ...world,
  bullets: [
    ...(world.bullets ?? []),
    ...Array.from(predictedBullets.values())
  ]
};

if (predictedPlayer && socket?.id && renderWorld.players.has(socket.id)) {
  const p = renderWorld.players.get(socket.id);

  renderWorld.players.set(socket.id, {
    ...p,
    x: predictedPlayer.x,
    y: predictedPlayer.y,
    a: predictedPlayer.a
  });
}

  

renderer.render(renderWorld, fx, {
  localPlayerId: socket.id,
  predictedPlayer
});



  requestAnimationFrame(loop);
}

loop();