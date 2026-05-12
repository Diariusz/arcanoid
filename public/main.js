/* ================= IMPORTS ================= */
import { GameWorld } from "./engine/GameWorld.js";
import { Renderer } from "./engine/Renderer.js";
import { Player } from "./engine/entities/Player.js";
import { InputManager } from "./engine/InputManager.js";
import { FXManager } from "./engine/FXManager.js";
import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

/* ================= APP STATE ================= */
const APP_STATE = {
  START: "start",
  LOBBY: "lobby",
  GAME: "game"
};

let appState = APP_STATE.START;
let selectedMode = null;
let lastServerTick = null;
let inputSeq = 0;
const pendingInputs = [];
let countdownStartAt = null;
let countdownTimer = null;



/* ================= SESSION ================= */
let sessionId = localStorage.getItem("sessionId");
if (!sessionId) {
  sessionId = crypto.randomUUID();
  localStorage.setItem("sessionId", sessionId);
}

/* ================= MULTIPLAYER ================= */

let socket = io("http://localhost:3001", {
  auth: {
    sessionId
  }
});

const startScreen = document.getElementById("startScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
const lobbyInfo = document.getElementById("lobbyInfo");
const readyBtn = document.getElementById("readyBtn");

const gameOverScreen = document.getElementById("gameOverScreen");
const finalScoreEl   = document.getElementById("finalScore");
const playAgainBtn   = document.getElementById("playAgainBtn");
const backToMenuBtn  = document.getElementById("backToMenuBtn");

/* ================= CANVAS ================= */

const canvas = document.getElementById("game");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;


const modeButtons = document.querySelectorAll(".modeBtn");

/* ================= GAME MODE ================= */

const GAME_MODE = {
  SINGLE: "single",
  MULTI: "multi"
};

const gameMode = GAME_MODE.MULTI;

// ---- snapshot buffer ----
const stateBuffer = [];
const BUFFER_TIME = 150;

// ---- local prediction ----
let predictedPlayer = null;

// ---- bullets prediction (viz only) ----
const predictedBullets = new Map();
let predictedShotSeq = 0;

canvas.style.display = "none";

modeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    selectedMode = btn.dataset.mode;

    appState = APP_STATE.LOBBY;

    startScreen.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    canvas.style.display = "block";

    lobbyInfo.innerText = "Waiting for player(s)…";

    socket.emit("join", { mode: selectedMode });
  });
});

readyBtn.onclick = () => {
  readyBtn.disabled = true;
  readyBtn.innerText = "WAITING…";
  socket.emit("ready");
};


playAgainBtn.onclick = () => {
  gameOverScreen.classList.add("hidden");

  readyBtn.disabled = false;
  readyBtn.innerText = "READY";

  lobbyScreen.classList.remove("hidden");

  socket.emit("ready");
};

backToMenuBtn.onclick = () => {
  socket.disconnect();
  location.reload();
};


socket.on("start", () => {
  console.log("GAME START");

  startScreen.classList.add("hidden");
  lobbyScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");

  appState = APP_STATE.GAME;

  pendingInputs.length = 0;
  predictedPlayer = null;

  // przygotuj przycisk na następną rundę
  readyBtn.disabled = false;
  readyBtn.innerText = "READY";
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
});


socket.on("joined", data => {
  lobbyInfo.innerText =
    `Players: ${data.currentPlayers} / ${data.maxPlayers}`;
});

socket.on("gameOver", ({ score }) => {
  console.log("GAME OVER");

  appState = APP_STATE.LOBBY;

  finalScoreEl.innerText = `Score: ${score}`;

  lobbyScreen.classList.add("hidden");
  startScreen.classList.add("hidden");
  gameOverScreen.classList.remove("hidden");

  // opcjonalnie: schowaj canvas na ekranie game over
  // canvas.style.display = "none";

  readyBtn.disabled = false;
  readyBtn.innerText = "READY";
});


socket.on("countdown", ({ startAt }) => {
  if (countdownTimer) clearInterval(countdownTimer);

  countdownTimer = setInterval(() => {
    const msLeft = startAt - Date.now();
    const sec = Math.ceil(msLeft / 1000);

    if (sec <= 0) {
      lobbyInfo.innerText = "GO!";
      clearInterval(countdownTimer);
      countdownTimer = null;
      return;
    }
    lobbyInfo.innerText = `Starting in ${sec}…`;
  }, 100);
});


/* ================= IMPORTS ================= */



const inputManager = new InputManager(canvas);
const fx = new FXManager();

/* ================= ASSETS ================= */

const assets = {
  playerShip: new Image(),
  asteroids: {
    1: new Image(),
    2: new Image(),
    3: new Image()
  },
  powerUps: {
    fastBullets: new Image(),
    double: new Image(),
    triple: new Image(),
    cooling: new Image(),
    shield: new Image()
  },
  background: {
  nebula1: new Image(),
  nebula2: new Image(),
  nebula3: new Image()
  }
};

assets.playerShip.src = "img/player_ship.png";
assets.asteroids[1].src = "img/asteroid_small.png";
assets.asteroids[2].src = "img/asteroid_medium.png";
assets.asteroids[3].src = "img/asteroid_big.png";

// ✅ ikonki power-upów
assets.powerUps.fastBullets.src = "img/power_fast.png";
assets.powerUps.double.src      = "img/power_double.png";
assets.powerUps.triple.src      = "img/power_triple.png";
assets.powerUps.cooling.src     = "img/power_cooling.png";
assets.powerUps.shield.src      = "img/power_shield.png";

assets.background.nebula1.src = "img/nebulaAB_A65_1.png";
assets.background.nebula2.src = "img/nebulaAB_A65_2.png";
assets.background.nebula3.src = "img/nebulaAB_A65_3.png";


/* ================= WORLD ================= */

const SERVER_WORLD = { width: 1920, height: 1080 }; // <- jak serwer

const world = new GameWorld({
  width: SERVER_WORLD.width,
  height: SERVER_WORLD.height
});

const renderer = new Renderer(canvas, assets);





socket.on("state", msg => {
  lastServerTick = msg.tick;

  const snap = msg.snapshot ?? {};

  // world size (ważne dla kamery)
  if (snap.width != null) world.width = snap.width;
  if (snap.height != null) world.height = snap.height;

  // global info
  world.score = snap.score ?? world.score;
  world.level = snap.level ?? world.level;

  // entities
  world.asteroids = (snap.asteroids ?? []).map(a => ({ ...a }));
  world.bullets   = (snap.bullets ?? []).map(b => ({ ...b }));
  world.powerUps  = (snap.powerUps ?? []).map(p => ({ ...p }));

  // ===== znajdź lokalnego gracza raz =====
  const playersArr = snap.players ?? [];
  const serverMe = playersArr.find(p => p.id === socket.id) ?? null;

  // ===== COOP HUD z serverMe =====
  if (serverMe) {
    world.shield = serverMe.shield ?? world.shield;
    world.maxShield = serverMe.maxShield ?? world.maxShield;

    world.heat = serverMe.heat ?? world.heat;
    world.maxHeat = serverMe.maxHeat ?? world.maxHeat;
    world.overheated = !!serverMe.overheated;

    world.activePowerUps = serverMe.activePowerUps ?? world.activePowerUps;

    world.alive = serverMe.alive ?? true;
    world.respawnAt = serverMe.respawnAt ?? 0;
  }

  // teammate (do HUD)
  world.mate = playersArr.find(p => p.id !== socket.id) ?? null;

  /* ================= RECONCILIATION (PUNKT C) ================= */
  if (msg.lastProcessedInput != null && predictedPlayer && serverMe) {
    // 1) usuń potwierdzone inputy
    while (pendingInputs.length && pendingInputs[0].seq <= msg.lastProcessedInput) {
      pendingInputs.shift();
    }

    // 2) cofnij predicted do serwera
    predictedPlayer.x  = serverMe.x;
    predictedPlayer.y  = serverMe.y;
    predictedPlayer.vx = serverMe.vx;
    predictedPlayer.vy = serverMe.vy;
    predictedPlayer.a  = serverMe.a;

    // (na razie bez reaplikacji inputów)
  }

  /* ================= SNAPSHOT BUFFER ================= */
  stateBuffer.push({
    time: msg.time,
    snapshot: snap
  });
  if (stateBuffer.length > 20) stateBuffer.shift();
});

/* ================= HELPERS ================= */

function computeCamera(player, world, canvas) {
  if (!player) return { x: 0, y: 0 };

  let camX = player.x - canvas.width / 2;
  let camY = player.y - canvas.height / 2;

  // clamp do granic świata (na razie world.width/height)
  const maxX = Math.max(0, world.width - canvas.width);
  const maxY = Math.max(0, world.height - canvas.height);

  camX = Math.max(0, Math.min(maxX, camX));
  camY = Math.max(0, Math.min(maxY, camY));

  return { x: camX, y: camY };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  const diff =
    ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawHeatBar(ctx, world) {
  const heat = world.heat ?? 0;
  const maxHeat = world.maxHeat ?? 100; // jeśli nie masz maxHeat w snapshot, ustaw stałe 100
  const overheated = !!world.overheated;

  const pct = clamp01(heat / maxHeat);

  const x = 20, y = 20, w = 240, h = 14;

  ctx.save();

  // tło
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, x - 8, y - 8, w + 16, h + 34, 12);
  ctx.fill();

  // ramka
  ctx.strokeStyle = "rgba(0,255,0,0.55)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  // wypełnienie
  const fillW = Math.floor(w * pct);
  const color =
    pct < 0.6 ? "rgba(0,255,0,0.85)" :
    pct < 0.85 ? "rgba(255,200,0,0.9)" :
    "rgba(255,60,60,0.9)";

  ctx.fillStyle = color;
  roundRect(ctx, x, y, fillW, h, 8);
  ctx.fill();

  // tekst
  ctx.font = "12px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`HEAT ${Math.round(heat)}/${maxHeat}`, x, y + 28);

  // OVERHEATED
  if (overheated) {
    const blink = (Math.floor(performance.now() / 250) % 2) === 0;
    if (blink) {
      ctx.font = "bold 18px monospace";
      ctx.fillStyle = "rgba(255,60,60,0.95)";
      ctx.fillText("OVERHEATED!", x, y + 52);
    }
  }

  ctx.restore();
}


function drawActivePowerUps(ctx, world) {
  const ap = world.activePowerUps ?? {};
  const now = Date.now();

  const active = Object.entries(ap)
    .filter(([_, until]) => typeof until === "number" && until > now)
    .map(([key, until]) => ({ key, left: (until - now) / 1000 }))
    .sort((a, b) => b.left - a.left);

  const x = 20;
  let y = 85;

  ctx.save();
  ctx.font = "14px monospace";

  if (!active.length) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("POWERUPS: none", x, y);
    ctx.restore();
    return;
  }

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("POWERUPS:", x, y);
  y += 18;

  for (const p of active) {
    const name =
      p.key === "fastBullets" ? "FAST BULLETS" :
      p.key === "double" ? "DOUBLE" :
      p.key === "triple" ? "TRIPLE" :
      p.key === "cooling" ? "COOLING" :
      p.key.toUpperCase();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`${name} (${p.left.toFixed(1)}s)`, x, y);
    y += 18;
  }

  ctx.restore();
}

function drawPowerUpsDebug(ctx, world) {
  const pus = world.powerUps ?? [];
  if (!pus.length) return;

  ctx.save();
  for (const p of pus) {
    const color =
      p.type === "fastBullets" ? "rgba(255,255,0,0.9)" :
      p.type === "double" ? "rgba(0,200,255,0.9)" :
      p.type === "triple" ? "rgba(255,0,255,0.9)" :
      p.type === "cooling" ? "rgba(0,255,120,0.9)" :
      p.type === "shield" ? "rgba(0,120,255,0.9)" :
      "rgba(255,255,255,0.9)";

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius ?? 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    const letter =
      p.type === "fastBullets" ? "F" :
      p.type === "double" ? "D" :
      p.type === "triple" ? "T" :
      p.type === "cooling" ? "C" :
      p.type === "shield" ? "S" : "?";
    ctx.fillText(letter, p.x - 4, p.y + 4);
  }
  ctx.restore();
}


/* ================= INTERPOLATION ================= */

/* ================= INTERPOLATION (REMOTE PLAYERS ONLY) ================= */

function interpolateWorld(prevState, nextState, t) {
  const renderPlayers = new Map();

  const prevPlayers = prevState.players ?? [];
  const prevById = new Map(prevPlayers.map(p => [p.id, p]));

  nextState.players.forEach(p => {
    if (p.id === socket.id) return;

    const prev = prevById.get(p.id) ?? p;

    renderPlayers.set(p.id, {
      ...p,
      x: lerp(prev.x, p.x, t),
      y: lerp(prev.y, p.y, t),
      a: lerpAngle(prev.a, p.a, t)
    });
  });

  return renderPlayers;
}

function drawOffscreenAsteroidIndicator(ctx, world, camera, canvas) {
  const ast = world.asteroids ?? [];
  if (!ast.length) return;

  // pozycja "gracza na ekranie" (środek viewportu)
  const px = canvas.width / 2;
  const py = canvas.height / 2;

  // znajdź najbliższą asteroidę w świecie (od pozycji gracza w świecie)
  // kamera = player - viewport/2, więc playerWorld = camera + center
  const playerWorldX = camera.x + px;
  const playerWorldY = camera.y + py;

  let best = null;
  let bestD = Infinity;

  for (const a of ast) {
    const dx = a.x - playerWorldX;
    const dy = a.y - playerWorldY;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }

  if (!best) return;

  // pozycja asteroidy na ekranie
  const sx = best.x - camera.x;
  const sy = best.y - camera.y;

  const margin = 26;

  // jeśli jest na ekranie → nie rysujemy wskaźnika
  if (
    sx >= 0 && sx <= canvas.width &&
    sy >= 0 && sy <= canvas.height
  ) {
    return;
  }

  // kierunek
  const dx = sx - px;
  const dy = sy - py;
  const ang = Math.atan2(dy, dx);

  // punkt na krawędzi ekranu (clamp)
  const ex = Math.max(margin, Math.min(canvas.width - margin, px + Math.cos(ang) * 9999));
  const ey = Math.max(margin, Math.min(canvas.height - margin, py + Math.sin(ang) * 9999));

  // rysuj strzałkę
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,165,0,0.9)"; // orange
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawShieldBar(ctx, world) {
  const shield = world.shield ?? 0;
  const maxShield = world.maxShield ?? 100;
  const pct = Math.max(0, Math.min(1, shield / maxShield));

  const x = 20;
  const y = 70;        // pod heat bar
  const w = 240;
  const h = 14;

  ctx.save();
  ctx.globalAlpha = 0.9;

  // tło panelu
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, x - 8, y - 8, w + 16, h + 34, 12);
  ctx.fill();

  // ramka
  ctx.strokeStyle = "rgba(0,255,0,0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  // kolor paska zależnie od hp
  let color = "rgba(0,200,255,0.85)";   // domyślnie cyan
  if (pct < 0.5) color = "rgba(255,200,0,0.9)";
  if (pct < 0.25) color = "rgba(255,60,60,0.95)";

  // wypełnienie
  const fillW = Math.floor(w * pct);
  ctx.fillStyle = color;
  roundRect(ctx, x, y, fillW, h, 8);
  ctx.fill();

  // tekst
  ctx.font = "12px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`SHIELD ${Math.round(shield)}/${maxShield}`, x, y + 28);

  ctx.restore();
}

function drawStageInfo(ctx, world) {
  const lvl = world.level ?? 1;

  ctx.save();
  ctx.font = "16px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`STAGE: ${lvl}`, 20, 135);
  ctx.restore();
}

function drawMateShieldBar(ctx, mate, canvas) {
  if (!mate) return;

  const shield = mate.shield ?? 0;
  const maxShield = mate.maxShield ?? 100;
  const alive = mate.alive ?? true;

  const pct = Math.max(0, Math.min(1, shield / maxShield));

  const w = 200;
  const h = 12;
  const x = canvas.width - w - 20;
  const y = 20;

  ctx.save();
  ctx.globalAlpha = 0.9;

  // tło panelu
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, x - 8, y - 8, w + 16, h + 34, 12);
  ctx.fill();

  // ramka
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  // kolor paska
  let color = "rgba(0,200,255,0.85)";
  if (pct < 0.5) color = "rgba(255,200,0,0.9)";
  if (pct < 0.25) color = "rgba(255,60,60,0.95)";

  // jeśli martwy – przyciemnij
  if (!alive) color = "rgba(140,140,140,0.6)";

  const fillW = Math.floor(w * pct);
  ctx.fillStyle = color;
  roundRect(ctx, x, y, fillW, h, 8);
  ctx.fill();

  // opis
  ctx.font = "12px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(
    `MATE ${alive ? `${Math.round(shield)}/${maxShield}` : "DEAD"}`,
    x,
    y + 26
  );

  ctx.restore();
}

function drawRespawnInfo(ctx, world, canvas) {
  const alive = world.alive ?? true;
  const respawnAt = world.respawnAt ?? 0;
  if (alive) return;
  if (!respawnAt) return;

  const msLeft = respawnAt - Date.now();
  const sec = Math.max(0, msLeft / 1000);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const x = canvas.width / 2;
  const y = canvas.height / 2;

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - 180, y - 35, 360, 70);

  ctx.font = "bold 26px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(`RESPAWN IN ${sec.toFixed(1)}s`, x, y);

  ctx.restore();
}

/* ================= GAME LOOP ================= */

function loop() {
  // Gra renderuje się tylko w stanie GAME
  if (appState !== APP_STATE.GAME) {
    requestAnimationFrame(loop);
    return;
  }

  let input = inputManager.getInput();

// ✅ jeśli lokalny gracz martwy -> nie sterujemy, nie strzelamy, nie purge
if (world.alive === false) {
  input = {
    rotateLeft: false,
    rotateRight: false,
    thrustForward: false,
    thrustBackward: false,
    fire: false,
    purge: false,
    touchAngle: null
  };
}

  // =============================
  // 1) INTERPOLATION (REMOTE ONLY)
  // =============================
  let interpolatedPlayers = new Map();

  if (stateBuffer.length >= 2) {
    const renderTime = performance.now() - BUFFER_TIME;

    let i = 0;
    while (i < stateBuffer.length - 1 && stateBuffer[i + 1].time <= renderTime) {
      i++;
    }

    const s1 = stateBuffer[i];
    const s2 = stateBuffer[i + 1];

    if (s1 && s2) {
      let t = (renderTime - s1.time) / (s2.time - s1.time || 1);
      t = Math.max(0, Math.min(1, t));

      interpolatedPlayers = interpolateWorld(s1.snapshot, s2.snapshot, t);
    }
  }

  // =========================
  // 2) LOCAL PLAYER INIT ONCE
  // =========================
  if (!predictedPlayer) {
    const lastSnap = stateBuffer.length ? stateBuffer[stateBuffer.length - 1].snapshot : null;
    const serverMe = lastSnap?.players?.find(p => p.id === socket.id) ?? null;

    if (serverMe) {
      predictedPlayer = Player.fromState(serverMe);
    }
  }

  // ======================
  // 3) LOCAL PREDICTION
  // ======================
  if (predictedPlayer) {
  predictedPlayer.applyInput(input);
  predictedPlayer.update(world);
}
  // ======================
  // 4) SEND INPUT TO SERVER
  // ======================
  const packet = { ...input, seq: inputSeq++ };
  pendingInputs.push(packet);
  socket.emit("input", packet);

  // ==================================================
  // 5) OPTIONAL: PREDICTED BULLETS (currently disabled)
  // ==================================================
  const ENABLE_PREDICTED_BULLETS = false;

  if (ENABLE_PREDICTED_BULLETS && input.fire && predictedPlayer) {
    const id = `p-${predictedShotSeq++}`;
    const offset = 18;

    predictedBullets.set(id, {
      id,
      x: predictedPlayer.x + Math.cos(predictedPlayer.a) * offset,
      y: predictedPlayer.y + Math.sin(predictedPlayer.a) * offset,
      a: predictedPlayer.a,
      last: performance.now()
    });
  }

  if (ENABLE_PREDICTED_BULLETS) {
    const now = performance.now();
    for (const b of predictedBullets.values()) {
      const dt = (now - b.last) / 16;
      b.last = now;
      b.x += Math.cos(b.a) * 8 * dt;
      b.y += Math.sin(b.a) * 8 * dt;
    }
  }

  // ======================
  // 6) BUILD RENDER WORLD
  // ======================
  const renderWorld = {
    ...world,
    players: interpolatedPlayers,
    bullets: [
      ...(world.bullets ?? []) // tylko serwerowe, bo predicted wyłączone
    ]
  };

  // local player zawsze z prediction
  if (predictedPlayer) {
    renderWorld.players.set(socket.id, predictedPlayer);
  }

  // ==========
  // 7) CAMERA + RENDER
  // ==========
  const camera = computeCamera(predictedPlayer, world, canvas);

  renderer.render(renderWorld, fx, {
    localPlayerId: socket.id,
    predictedPlayer,
    camera
  });

  // ========================
  // 8) HUD / OVERLAY
  // ========================
  const ctx = canvas.getContext("2d");

  drawHeatBar(ctx, world);
  drawActivePowerUps(ctx, world);

  // ✅ TO BYŁO “ZAGUBIONE”: wskaźnik do asteroidy poza ekranem
  // (funkcja drawOffscreenAsteroidIndicator powinna być zdefiniowana POZA loop)
  drawOffscreenAsteroidIndicator(ctx, world, camera, canvas);

  drawShieldBar(ctx, world);
  drawStageInfo(ctx, world);

  drawMateShieldBar(ctx, world.mate, canvas);
drawRespawnInfo(ctx, world, canvas);


  // ==========================
  // 9) DEBUG TEXT (opcjonalny)
  // ==========================
  const ENABLE_DEBUG_TEXT = true;
  const ENABLE_FRAME_LOG = false;

  if (ENABLE_DEBUG_TEXT) {
    ctx.save();
    ctx.font = "12px monospace";

    let y = canvas.height - 60;

    ctx.fillStyle = "yellow";
    ctx.fillText(`serverTick=${lastServerTick}`, 10, y);
    y += 14;

    ctx.fillStyle = "white";
    ctx.fillText(`powerUps=${(world.powerUps ?? []).length}`, 10, y);
    y += 14;

    const fastUntil = world.activePowerUps?.fastBullets ?? 0;
    if (fastUntil > Date.now()) {
      ctx.fillStyle = "yellow";
      ctx.fillText(`FAST BULLETS ${(fastUntil - Date.now()) / 1000 | 0}s`, 10, y);
      y += 14;
    }

    const speedUntil = world.activePowerUps?.speedBoost ?? 0;
    if (speedUntil > Date.now()) {
      ctx.fillStyle = "cyan";
      ctx.fillText(`SPEED BOOST ${(speedUntil - Date.now()) / 1000 | 0}s`, 10, y);
      y += 14;
    }

    ctx.restore();
  }

  if (ENABLE_FRAME_LOG && predictedPlayer) {
    console.log(
      `[FRAME] serverTick=${lastServerTick} pred=(${predictedPlayer.x.toFixed(1)},${predictedPlayer.y.toFixed(1)})`
    );
  }

  requestAnimationFrame(loop);
}

loop();