// server/index.js

import { createServer } from "http";
import { Server } from "socket.io";
import { performance } from "perf_hooks";
import crypto from "crypto";

import { GameWorld, GAME_STATE } from "./game/GameWorld.js";
import { StageManager } from "./game/StageManager.js";
import { Player } from "./game/entities/Player.js";

/* ================= SERVER SETUP ================= */

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

/* ================= CONFIG ================= */

const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const TICK_INTERVAL = 1000 / TICK_RATE;

const GRACE_TIME = 8000; // ms

/* ================= ROOMS =================
 * uniwersalne pokoje: solo (1) i coop (2)
 */

const rooms = new Map();                 // roomId -> room
const sessionToRoom = new Map();         // sessionId -> roomId (dla reconnectów)

/* ================= ROOM HELPERS ================= */

function createRoom({ mode, maxPlayers, width = 3000, height = 3000 }) {
  const roomId = crypto.randomUUID();

  const world = new GameWorld({ width, height });
  world.mode = mode;                 // "solo" | "coop"
  world.state = GAME_STATE.MENU;     // lobby
  world.isGameOver = false;

  const stageManager = new StageManager(world);

  const room = {
    id: roomId,
    mode,
    maxPlayers,
    world,
    stageManager,
    ready: new Map(),                // sessionId -> bool
    socketIds: new Set(),            // aktualnie podłączone sockety w roomie
    countdownStartAt: null
  };

  rooms.set(roomId, room);
  return room;
}

function findOpenCoopRoom() {
  for (const room of rooms.values()) {
    if (
      room.mode === "coop" &&
      room.world.state === GAME_STATE.MENU &&
      room.world.players.size < room.maxPlayers
    ) {
      return room;
    }
  }
  return null;
}

function resetRoomWorld(room) {
  const w = room.world;

  // core
  w.state = GAME_STATE.MENU;
  w.isGameOver = false;

  // gameplay
  w.score = 0;
  w.level = 1;

  // entities
  w.asteroids = [];
  w.bullets = [];
  w.enemyBullets = [];
  w.powerUps = [];
  w.explosions = [];
  w.dustClouds = [];
  w.boss = null;
  w.isBossFight = false;

  // events
  w.events = [];

  // reset StageManager
  room.stageManager.stageIndex = 0;
  room.stageManager.state = "IDLE";
  room.stageManager.timer = 0;

  // ===== TEAM SPAWN (ważne dla COOP) =====
  // wszyscy gracze startują blisko siebie
  const cx = w.width / 2;
  const cy = w.height / 2;

  const players = [...w.players.values()];
  players.forEach((p, idx) => {
    p.vx = 0;
    p.vy = 0;
    p.a = -Math.PI / 2;

    const ang = (idx / Math.max(1, players.length)) * Math.PI * 2;
    const r = 120;

    p.x = cx + Math.cos(ang) * r;
    p.y = cy + Math.sin(ang) * r;

    // hp/respawn
    p.alive = true;
    p.respawnAt = 0;
    p.shield = p.maxShield ?? 100;

    // heat
    p.heat = 0;
    p.overheated = false;

    // powerups
    if (p.activePowerUps) {
      for (const k of Object.keys(p.activePowerUps)) {
        p.activePowerUps[k] = 0;
      }
    }

    // shooting
    p.lastShotTime = 0;
    p.canShoot = true;
    p.purgeLockTimer = 0;
    p.lastPurgeTime = -Infinity;
  });
}

function startCountdownAndGame(room) {
  if (room.world.state === GAME_STATE.PLAYING) return;
  if (room.countdownStartAt) return;

  const startAt = Date.now() + 3000;
  room.countdownStartAt = startAt;

  io.to(room.id).emit("countdown", { startAt });

  setTimeout(() => {
    resetRoomWorld(room);

    room.world.state = GAME_STATE.PLAYING;
    room.countdownStartAt = null;

    for (const sid of room.ready.keys()) room.ready.set(sid, false);

    io.to(room.id).emit("start");
  }, 3000);
}

/* ================= CLIENTS ================= */

io.on("connection", socket => {
  const { sessionId } = socket.handshake.auth;
  if (!sessionId) {
    socket.disconnect(true);
    return;
  }

  socket.sessionId = sessionId;

  /* ===== JOIN ===== */
  socket.on("join", ({ mode }) => {
    if (mode !== "solo" && mode !== "coop") {
      socket.emit("joinError", "MODE_NOT_SUPPORTED");
      return;
    }

    // jeśli wcześniej był room (np. zmiana trybu), posprzątaj “stary” room
    const existingRoomId = sessionToRoom.get(sessionId);
    const oldRoom = existingRoomId ? rooms.get(existingRoomId) : null;

    if (oldRoom && oldRoom.mode !== mode) {
      oldRoom.world.removePlayer(sessionId);
      oldRoom.ready.delete(sessionId);

      // odłącz socket ze starego pokoju (jeśli był)
      try { socket.leave(oldRoom.id); } catch {}

      if (oldRoom.world.players.size === 0) {
        rooms.delete(oldRoom.id);
      }

      sessionToRoom.delete(sessionId);
    }

    // reconnect do znanego roomu (jeśli nadal istnieje)
    const stillRoomId = sessionToRoom.get(sessionId);
    let room = stillRoomId ? rooms.get(stillRoomId) : null;

    // jeśli nie ma roomu -> utwórz / znajdź
    if (!room) {
      if (mode === "solo") {
        room = createRoom({ mode: "solo", maxPlayers: 1 });
      } else {
        room = findOpenCoopRoom() ?? createRoom({ mode: "coop", maxPlayers: 2 });
      }
      sessionToRoom.set(sessionId, room.id);
    }

    // polityka A: SOLO + F5 w trakcie -> reset do lobby
    if (room.mode === "solo" && (room.world.state === GAME_STATE.PLAYING || room.countdownStartAt)) {
      room.world.state = GAME_STATE.MENU;
      room.countdownStartAt = null;
      resetRoomWorld(room);
    }

    // podepnij socket do roomu
    socket.join(room.id);
    socket.roomId = room.id;
    room.socketIds.add(socket.id);

    // znajdź lub utwórz playera w room.world
    let player = room.world.getPlayer(sessionId);

    if (!player) {
      // jeśli coop i room pełny -> błąd
      if (room.mode === "coop" && room.world.players.size >= room.maxPlayers) {
        socket.emit("joinError", "ROOM_FULL");
        return;
      }

      // ✅ COOP: spawnuj drugiego gracza blisko pierwszego (żeby od razu się widzieli)
      let spawnX, spawnY;
      const existing = [...room.world.players.values()][0] ?? null;

      if (room.mode === "coop" && existing) {
        const ang = Math.random() * Math.PI * 2;
        const r = 140;
        spawnX = Math.max(60, Math.min(room.world.width - 60, existing.x + Math.cos(ang) * r));
        spawnY = Math.max(60, Math.min(room.world.height - 60, existing.y + Math.sin(ang) * r));
      } else {
        spawnX = Math.random() * room.world.width;
        spawnY = Math.random() * room.world.height;
      }

      player = new Player(spawnX, spawnY);
      player.sessionId = sessionId;
      player.id = socket.id;
      player.disconnectedAt = null;
      player.lastProcessedInput = -1;

      room.world.addPlayer(player);

      room.ready.set(sessionId, false);
    } else {
      // reconnect: podmień socket id
      player.id = socket.id;
      player.disconnectedAt = null;
      player.lastProcessedInput = -1;
    }

    // ✅ WAŻNE UX: informacja o lobby do całego pokoju, nie tylko do nowego socketu
    io.to(room.id).emit("joined", {
      roomId: room.id,
      currentPlayers: room.world.players.size,
      maxPlayers: room.maxPlayers
    });
  });

  /* ===== READY ===== */
  socket.on("ready", () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    room.ready.set(sessionId, true);

    const playersCount = room.world.players.size;

    const allReady =
      playersCount === room.maxPlayers &&
      [...room.ready.values()].every(v => v === true);

    if (allReady) {
      startCountdownAndGame(room);
    }
  });

  /* ===== INPUT ===== */
  socket.on("input", input => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    if (room.world.state !== GAME_STATE.PLAYING) return;

    const p = room.world.getPlayerBySocketId(socket.id);
    if (!p) return;

    const nowMs = Date.now();

    const boosted = (p.activePowerUps?.speedBoost ?? 0) > nowMs;
    const accelMult = boosted ? 1.6 : 1.0;

    p.applyInput(input, accelMult);
    p.lastProcessedInput = input.seq;

    if (input.purge) {
      room.world.attemptPurge(p, nowMs);
    }

    if (input.fire) {
      room.world.addBulletFromPlayer(p, nowMs);
    }
  });

  /* ===== DISCONNECT ===== */
  socket.on("disconnect", () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    room.socketIds.delete(socket.id);

    const p = room.world.getPlayerBySocketId(socket.id);
    if (p) p.disconnectedAt = Date.now();

    console.log("🟡 Disconnected (grace):", sessionId);
  });
});

/* ================= GAME LOOP ================= */

setInterval(() => {
  const nowMs = Date.now();

  for (const room of rooms.values()) {
    // cleanup graczy po GRACE_TIME
    for (const p of [...room.world.players.values()]) {
      if (p.disconnectedAt && nowMs - p.disconnectedAt > GRACE_TIME) {
        console.log("❌ Removing player after grace:", p.sessionId);

        room.world.removePlayer(p.sessionId);
        room.ready.delete(p.sessionId);
        sessionToRoom.delete(p.sessionId);
      }
    }

    if (room.world.players.size === 0) {
      rooms.delete(room.id);
      continue;
    }

    // ===== PLAYING =====
    if (room.world.state === GAME_STATE.PLAYING) {
      room.world.update(DT, nowMs);
      room.stageManager.update();

      // TEAM WIPED (COOP) / DESTROYED (SOLO)
      const aliveCount = [...room.world.players.values()].filter(p => p.alive).length;

      if (aliveCount === 0) {
        io.to(room.id).emit("gameOver", {
          score: room.world.score,
          reason: room.mode === "coop" ? "TEAM_WIPED" : "DESTROYED"
        });

        room.world.state = GAME_STATE.MENU;
        room.countdownStartAt = null;

        for (const sid of room.ready.keys()) room.ready.set(sid, false);

        // zabezpieczenie: gracze w lobby jako “żywi”
        for (const p of room.world.players.values()) {
          p.alive = true;
          p.respawnAt = 0;
          p.shield = p.maxShield ?? 100;
          p.heat = 0;
          p.overheated = false;
          p.canShoot = true;
          p.purgeLockTimer = 0;
        }
      }
    }

    // ===== SNAPSHOT per socket =====
    for (const sid of room.socketIds) {
      const sock = io.sockets.sockets.get(sid);
      if (!sock) continue;

      const player = room.world.getPlayerBySocketId(sid);

      sock.emit("state", {
        time: performance.now(),          // OK do interpolacji po stronie klienta
        tick: room.world.tick,
        snapshot: room.world.serialize(),
        lastProcessedInput: player?.lastProcessedInput ?? -1
      });
    }
  }
}, TICK_INTERVAL);

/* ================= START ================= */

httpServer.listen(3001, () => {
  console.log("✅ Server running on http://localhost:3001");
});