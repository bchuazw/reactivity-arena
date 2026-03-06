// Boot diagnostics
console.log("[Boot] Process starting...");
console.log("[Boot] Node version:", process.version);
console.log("[Boot] Platform:", process.platform, process.arch);
console.log("[Boot] PORT:", process.env.PORT);
console.log("[Boot] NODE_ENV:", process.env.NODE_ENV);

import { Server, WebSocketTransport, matchMaker } from "colyseus";
import { createServer } from "http";
import express from "express";
import { ArenaRoom } from "./rooms/ArenaRoom";

console.log("[Boot] All imports loaded OK");

const PORT = parseInt(process.env.PORT || "2567");
const NODE_ENV = process.env.NODE_ENV || "development";

// Catch unhandled errors to prevent silent crashes
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err);
  // Don't exit — keep the server alive
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection:", reason);
  // Don't exit — keep the server alive
});

async function main() {
  console.log("[Boot] Creating express app...");
  const app = express();
  app.use(express.json());

  // Health check endpoint — must respond quickly for Render
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });
  app.get("/", (_req, res) => {
    res.send("Reactivity Arena Server OK");
  });

  console.log("[Boot] Creating HTTP server...");
  const server = createServer(app);

  console.log("[Boot] Creating WebSocketTransport...");
  const transport = new WebSocketTransport({ server });

  console.log("[Boot] Creating Colyseus Server...");
  const gameServer = new Server({ transport });

  console.log("[Boot] Defining arena room...");
  gameServer.define("arena", ArenaRoom as any).filterBy(["matchId"]);

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       ⚔️  REACTIVITY ARENA — GAME SERVER     ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Port:     ${PORT}                              ║`);
  console.log(`║  Env:      ${NODE_ENV.padEnd(33)}║`);
  console.log("║  Network:  Somnia Testnet (50312)            ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║  Rooms:                                      ║");
  console.log("║  • arena — 5 AI agents, 50 spectators max   ║");
  console.log("╚══════════════════════════════════════════════╝");

  console.log("[Boot] Binding to port...");
  await new Promise<void>((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`[Boot] ✅ Server listening on http://0.0.0.0:${PORT}`);
      resolve();
    });
  });

  console.log("[Boot] Waiting for matchMaker...");
  await matchMaker.onReady;
  console.log("[Boot] ✅ MatchMaker ready — server fully operational");
}

main().catch((err) => {
  console.error("[FATAL] Server failed to start:", err);
  process.exit(1);
});
