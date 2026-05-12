// server/index.js

import { createServer } from "http";
import { Server } from "socket.io";
import { performance } from "perf_hooks";

import { GameWorld, GAME_STATE } from "./game/GameWorld.js";
import { StageManager } from "./game/StageManager.js";
import { Player } from "./game/entities/Player.js";


/* ================= SERVER SETUP ================= */

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

/* ================= GAME WORLD ================= */

const world = new GameWorld({
  width: 1920,
  height: 1080
});

world.state = GAME_STATE.PLAYING;

const stageManager = new StageManager(world);

/* ================= TICK ================= */

const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const TICK_INTERVAL = 1000 / TICK_RATE;

/* ================= CLIENTS ================= */

io.on("connection", socket => {
  const { sessionId } = socket.handshake.auth;
  if (!sessionId) {
    socket.disconnect(true);
    return;
  }

  let player = world.getPlayer(sessionId);

  if (player) {
    // ✅ RECONNECT
    console.log("🔁 Reconnected", sessionId);
    player.id = socket.id;
    player.disconnectedAt = null;
  } else {
    // ✅ NOWY GRACZ
    const spawnX = Math.random() * world.width;
    const spawnY = Math.random() * world.height;

    player = new Player(spawnX, spawnY);
    player.id = socket.id;
    player.sessionId = sessionId;
    player.disconnectedAt = null;

    world.addPlayer(player);
  }

  socket.on("input", input => {
    const p = world.getPlayerBySocketId(socket.id);
    if (!p) return;

    p.applyInput(input);
    p.lastProcessedInput = input.seq;
  });

  socket.on("disconnect", () => {
    const p = world.getPlayerBySocketId(socket.id);
    if (!p) return;

    console.log("🟡 Disconnected (grace):", sessionId);
    p.disconnectedAt = Date.now();
  });
});


/* ================= GAME LOOP ================= */

const GRACE_TIME = 8000; // ms (8 sekund)

setInterval(() => {
  const now = performance.now();

  // --- simulate world ---
  for (const player of world.players.values()) {
    player.update(world);
  }

  // --- update other systems ---
  world.update(DT, now);
  stageManager.update();

/* ================= A.4 CLEANUP (GRACE PERIOD) ================= */

  for (const p of [...world.players.values()]) {
    if (
      p.disconnectedAt &&
      Date.now() - p.disconnectedAt > GRACE_TIME
    ) {
      console.log("❌ Removing player after grace:", p.sessionId);

      // usuwamy po id socketu (które było przypisane)
      world.removePlayer(p.sessionId);
    }
  }

  /* ================= SNAPSHOT ================= */

  for (const socket of io.sockets.sockets.values()) {
    //const player = world.getPlayer(socket.id);
    const player = world.getPlayerBySocketId(socket.id);

    socket.emit("state", {
      time: performance.now(),
      tick: world.tick,
      snapshot: world.serialize(),
      lastProcessedInput: player?.lastProcessedInput ?? -1
    });
  }

  if (room.world.isGameOver) {
  io.to(room.id).emit("gameOver", {
    score: room.world.score,
    reason: "DESTROYED"
  });

  room.world.isGameOver = false;
  room.world.state = GAME_STATE.LOBBY;
  return;
}

}, TICK_INTERVAL);


/* ================= START ================= */

httpServer.listen(3001, () => {
  console.log("✅ Multiplayer server running on http://localhost:3001");
});