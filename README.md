# ⚔️ Reactivity Arena

**Tactical AI Combat with Reactive On-Chain Betting**

Built for the [Somnia Reactivity Hackathon](https://www.somnia.network/) — a fully reactive, event-driven spectator game where 5 AI agents battle in a tactical arena while spectators place bets and sponsor power-ups in real time.

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Somnia Testnet (Chain ID: 50312), Hardhat, Solidity ^0.8.19 |
| **Reactivity** | Somnia Reactivity SDK — event subscriptions, cron triggers |
| **Game Server** | Colyseus (real-time multiplayer framework), TypeScript |
| **Frontend** | React, Three.js (React Three Fiber), Vite |
| **Wallet** | RainbowKit, wagmi, viem |

## 📊 Current Progress

- ✅ Map redesigned with tactical terrain
- ✅ 5 character classes simplified to uniform agents
- ✅ Chest/item system added
- ✅ Graphics redesigned (Metal Slug Tactics style)
- ✅ Deployed on Render

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ DEPLOYED & VERIFIED | Smart Contracts on Somnia Testnet |
| **Phase 2** | ✅ BUILT & COMPILES | Colyseus Game Server |
| **Phase 3** | ✅ BUILT | React + Three.js Frontend |
| **Phase 4** | ✅ COMPLETE | Integration & Demo |

### 🎉 Project Complete!

All phases are now complete. The full stack is ready for testing and demo.

### ✅ Phase 1: Smart Contracts

All three contracts deployed and verified on [Somnia Explorer](https://shannon.somnia.network/):

| Contract | Address |
|----------|---------|
| **ReactiveBettingPool** | [`0x19Dd500B5950BB9A20A3Bf8DA54F41f6D004A375`](https://shannon.somnia.network/address/0x19Dd500B5950BB9A20A3Bf8DA54F41f6D004A375) |
| **ReactiveSponsorship** | [`0xAf189D6bD0Ee1d4724847367A9a25a69f9834B6c`](https://shannon.somnia.network/address/0xAf189D6bD0Ee1d4724847367A9a25a69f9834B6c) |
| **ReactiveMatchTimer** | [`0xEAB3270FC17A4df2d174D5e8bE8C14344880c509`](https://shannon.somnia.network/address/0xEAB3270FC17A4df2d174D5e8bE8C14344880c509) |

**Key features:**
- **ReactiveBettingPool** — Parimutuel betting with auto-updating odds (emits `OddsUpdated` on every bet) and automatic payout distribution on match resolution
- **ReactiveSponsorship** — Spectators sponsor items (Health Pack, Ammo Crate, Shield Bubble, Damage Boost) for agents; `ItemSponsored` events trigger instant in-game delivery
- **ReactiveMatchTimer** — Cron-based turn advancement and stale match detection; auto-resolves inactive matches

### ✅ Phase 2: Game Server

Colyseus-based real-time game server with:

- **ArenaRoom** — Manages match lifecycle (lobby → active → ended)
- **5 AI Agents** — Uniform loadout, distinguished by color/number:
  - 🤖 **Agent One** — Blue
  - 🤖 **Agent Two** — Red  
  - 🤖 **Agent Three** — Green
  - 🤖 **Agent Four** — Purple
  - 🤖 **Agent Five** — Orange
  
  *All agents: 100 HP, 12 ATK, 8 DEF, 5 SPD*
- **Tactical arena map** — Cover, elevation, destructibles, chests with power-ups
- **Turn-based combat system** with move, attack, defend, and skip actions
- **Decision engine** for AI agent behavior
- **Blockchain event listener** for sponsorship delivery
- TypeScript, compiles cleanly

### ⏳ Phase 3: Frontend

React + Three.js spectator interface with:
- 3D arena visualization with agent models
- RainbowKit wallet connection for Somnia Testnet
- Real-time betting panel with live odds
- Item sponsorship UI
- Colyseus real-time game state sync

### ⏳ Phase 4: Integration & Demo

- End-to-end integration testing
- Somnia Reactivity SDK subscription wiring
- Live demo deployment

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)

### 1. Start Game Server
```bash
cd apps/server
pnpm install
pnpm build
pnpm start
# Server runs on ws://localhost:2567
```

### 2. Start Frontend
```bash
cd apps/web
pnpm install
pnpm dev
# Opens on http://localhost:5173
```

### 3. Connect Wallet
- Wallet must have Somnia Testnet configured
- Get test tokens from [Somnia Faucet](https://docs.somnia.network/developer/faucet)
- Network: RPC `https://dream-rpc.somnia.network`, Chain ID `50312`

### Contract Addresses (Somnia Testnet — Chain ID: 50312)

```
ReactiveBettingPool: 0x19Dd500B5950BB9A20A3Bf8DA54F41f6D004A375
ReactiveSponsorship: 0xAf189D6bD0Ee1d4724847367A9a25a69f9834B6c
ReactiveMatchTimer:  0xEAB3270FC17A4df2d174D5e8bE8C14344880c509
Deployer:            0x63f151A67dFd6508fCBfb242555AaC3F61E544e4
```

## 📁 Project Structure

```
reactivity-arena/
├── README.md
├── apps/
│   ├── contracts/               # Solidity smart contracts (Hardhat)
│   │   ├── contracts/
│   │   │   ├── ReactiveBettingPool.sol
│   │   │   ├── ReactiveSponsorship.sol
│   │   │   └── ReactiveMatchTimer.sol
│   │   ├── deploy/              # Deployment scripts
│   │   ├── artifacts/           # Compiled ABIs
│   │   ├── typechain-types/     # TypeScript bindings
│   │   ├── deployed-addresses.json
│   │   └── hardhat.config.ts
│   ├── server/                  # Colyseus game server
│   │   ├── src/
│   │   │   ├── index.ts         # Server entry point
│   │   │   ├── rooms/
│   │   │   │   └── ArenaRoom.ts # Main game room
│   │   │   ├── ai/
│   │   │   │   └── DecisionEngine.ts
│   │   │   ├── schema/
│   │   │   │   └── ArenaState.ts # Game state schema
│   │   │   └── somnia/
│   │   │       └── EventListener.ts
│   │   └── package.json
│   └── web/                     # React + Three.js frontend (Vite)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── wagmi.ts
│       │   ├── providers/
│       │   ├── components/
│       │   │   ├── Arena/
│       │   │   └── Betting/
│       │   └── hooks/
│       ├── index.html
│       └── package.json
└── packages/
    └── shared/                  # Shared types and utilities
```

## 🎮 How It Works

1. **Match Created** → `ReactiveMatchTimer` creates a match, `ReactiveBettingPool` opens betting
2. **Spectators Bet** → Place bets on agents via `ReactiveBettingPool`; odds auto-update reactively
3. **AI Agents Fight** → Colyseus server runs turn-based combat; state synced to spectators in real-time
4. **Sponsor Power-Ups** → Spectators send items via `ReactiveSponsorship`; delivered instantly via reactive events
5. **Match Resolves** → Winner determined, `ReactiveBettingPool` auto-distributes payouts

## 📦 Build for Production

```bash
cd apps/web
pnpm build
```

Output in `dist/` folder (6.6MB).

## 📖 Demo Guide

See [DEMO.md](DEMO.md) for full demo script and testing checklist.

## Test Checklist

### Visual
- [ ] 3D arena loads with Metal Slug Tactics-inspired visuals
- [ ] Environment has props (crates, vehicles, debris)
- [ ] 5 distinct character models visible
- [ ] Health bars above agents
- [ ] Terrain looks varied (not flat colors)

### Wallet & Network
- [ ] Connect wallet button works
- [ ] Somnia Testnet added (Chain ID: 50312, RPC: https://dream-rpc.somnia.network)
- [ ] Test STT tokens received from faucet

### Game Flow
- [ ] Place bet on agent
- [ ] Watch agents move and fight
- [ ] Sponsor item to agent
- [ ] Combat log shows actions
- [ ] Match resolves with winner

### Blockchain
- [ ] Betting transaction confirms
- [ ] Sponsorship transaction confirms
- [ ] Events received from contracts

## Known Issues / TODO
- [ ] Sound effects for combat
- [ ] More character animations
- [ ] Mobile responsiveness
- [ ] Advanced AI behaviors
- [ ] Tournament bracket system

## 📜 License

MIT
