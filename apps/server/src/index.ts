import { Server, WebSocketTransport, matchMaker } from "colyseus";
import { createServer } from "http";
import express from "express";
import dotenv from "dotenv";
import { ArenaRoom } from "./rooms/ArenaRoom";

dotenv.config();

const PORT = parseInt(process.env.PORT || "2567");
const NODE_ENV = process.env.NODE_ENV || "development";

async function main() {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
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

  await matchMaker.onReady;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n✅ Reactivity Arena server listening on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
