import { Server, WebSocketTransport, matchMaker } from "colyseus";
import { createServer } from "http";
import express from "express";
import { ArenaRoom } from "./rooms/ArenaRoom";

const PORT = parseInt(process.env.PORT || "2567");
const NODE_ENV = process.env.NODE_ENV || "development";

// Catch unhandled errors to prevent silent crashes
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

async function main() {
  console.log(`[Boot] Starting server on port ${PORT}...`);

  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Root endpoint for Render health check
  app.get("/", (_req, res) => {
    res.send("Reactivity Arena Server OK");
  });

  const server = createServer(app);

  const gameServer = new Server({
    transport: new WebSocketTransport({ server }),
  });

  // Register Rooms
  gameServer.define("arena", ArenaRoom as any)
    .filterBy(["matchId"]);

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       ⚔️  REACTIVITY ARENA — GAME SERVER     ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Port:     ${PORT}                              ║`);
  console.log(`║  Env:      ${NODE_ENV.padEnd(33)}║`);
  console.log("║  Network:  Somnia Testnet (50312)            ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║  Contracts:                                  ║");
  console.log(`║  BettingPool:   ${(process.env.BETTING_POOL_ADDRESS || "").substring(0, 10)}...  ║`);
  console.log(`║  Sponsorship:   ${(process.env.SPONSORSHIP_ADDRESS || "").substring(0, 10)}...  ║`);
  console.log(`║  MatchTimer:    ${(process.env.MATCH_TIMER_ADDRESS || "").substring(0, 10)}...  ║`);
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║  Rooms:                                      ║");
  console.log("║  • arena — 5 AI agents, 50 spectators max   ║");
  console.log("╚══════════════════════════════════════════════╝");

  // Listen on the port first (so Render's health check passes)
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n✅ Reactivity Arena server listening on http://0.0.0.0:${PORT}`);
  });

  // Then wait for matchMaker (this can happen after binding)
  await matchMaker.onReady;
  console.log("[Boot] MatchMaker ready");
}

main().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
