import config, { listen } from "@colyseus/tools";
import { Server } from "colyseus";
import dotenv from "dotenv";
import { ArenaRoom } from "./rooms/ArenaRoom";

dotenv.config();

const PORT = parseInt(process.env.PORT || "2567");
const NODE_ENV = process.env.NODE_ENV || "development";

const appConfig = config({
  displayLogs: false,

  initializeGameServer: (gameServer: Server) => {
    // ─── Register Rooms ──────────────────────────────────────────
    gameServer.define("arena", ArenaRoom as any)
      .filterBy(["matchId"]);
  },

  beforeListen: () => {
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
  },
});

listen(appConfig, PORT).then(() => {
  console.log(`\n✅ Reactivity Arena server listening on http://localhost:${PORT}`);
}).catch((err: Error) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
