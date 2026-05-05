// server/index.js

import { createServer } from "http";
import { Server } from "socket.io";

import { GameWorld, GAME_STATE } from "./game/GameWorld.js";
import { StageManager } from "./game/StageManager.js";
import { Player } from "./game/entities/Player.js";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

// ===== ŚWIAT GRY (TYLKO NA SERWERZE) =====
const world = new GameWorld({
  width: 1920,
  height: 1080
});
world.state = GAME_STATE.PLAYING;

const stageManager = new StageManager(world);

// ===== TICK SERWERA =====
const TICK_RATE = 30;
const TICK_INTERVAL = 1000 / TICK_RATE;

// ===== KLIENCI =====
io.on("connection", socket => {
  console.log("🟢 Client connected:", socket.id);

  // 👉 tworzymy gracza NA SERWERZE
  const player = new Player(
    Math.random() * world.width,
    Math.random() * world.height
  );
  player.id = socket.id;
  world.addPlayer(player);

  // 📩 INPUT OD KLIENTA
  socket.on("input", input => {
    const p = world.getPlayer(socket.id);
    if (!p) return;

    // kluczowe: tylko input, zero pozycji
    p.applyInput(input, world);
  });

  // 🔴 ROZŁĄCZENIE
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
    world.removePlayer(socket.id);
  });
});

// ===== GŁÓWNA PĘTLA SERWERA =====
setInterval(() => {
  const now = performance.now();

  world.update(1 / TICK_RATE, now);
  stageManager.update();

  // 🔁 wysyłamy CAŁY snapshot
    io.emit("state", {
    time: Date.now(),           // ✅ czas SERWERA
    snapshot: world.serialize()
  });
}, TICK_INTERVAL);

// ===== START =====
httpServer.listen(3001, () => {
  console.log("✅ Multiplayer server running on http://localhost:3001");
});