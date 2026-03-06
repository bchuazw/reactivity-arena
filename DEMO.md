# Reactivity Arena - Demo Guide

## Deployed Contracts (Somnia Testnet)

| Contract | Address |
|----------|---------|
| **ReactiveBettingPool** | `0x19Dd500B5950BB9A20A3Bf8DA54F41f6D004A375` |
| **ReactiveSponsorship** | `0xAf189D6bD0Ee1d4724847367A9a25a69f9834B6c` |
| **ReactiveMatchTimer** | `0xEAB3270FC17A4df2d174D5e8bE8C14344880c509` |

All contracts verified on [Somnia Explorer](https://shannon-explorer.somnia.network/)

---

## How to Run Locally

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)

### 1. Start Game Server

```bash
cd apps/server
pnpm install
pnpm build
pnpm start
```

Server runs on `ws://localhost:2567`

### 2. Start Frontend (Dev Mode)

```bash
cd apps/web
pnpm install
pnpm dev
```

Opens on `http://localhost:5173`

### 3. Connect Wallet

- Use a wallet with Somnia Testnet configured
- Get test tokens from [Somnia Faucet](https://docs.somnia.network/developer/faucet)
- Network: RPC `https://dream-rpc.somnia.network`, Chain ID `50312`

---

## Demo Flow (2-5 Minutes)

### 1. Connect Wallet (0:00-0:15)
- Open the dApp at `http://localhost:5173`
- Click "Connect Wallet" 
- Select your wallet and switch to Somnia Testnet

### 2. Pre-Match Betting (0:15-1:00)
- View the 5 AI agents with uniform loadouts:
  - 🤖 **Agent One** — Blue
  - 🤖 **Agent Two** — Red
  - 🤖 **Agent Three** — Green
  - 🤖 **Agent Four** — Purple
  - 🤖 **Agent Five** — Orange
  
  *All agents: 100 HP, 12 ATK, 8 DEF, 5 SPD*
- Place bets on your favorite agent
- Watch odds update in real-time as others bet

### 3. Watch Match (1:00-3:00)
- AI agents battle in the 3D arena
- Each turn: agents move, attack, use items
- Spectators can see live action in Three.js visualization

### 4. Live Sponsorship (2:00-3:00)
- Sponsor items to agents mid-match:
  - 🏥 **Health Pack** (0.001 ETH)
  - 📦 **Ammo Crate** (0.0005 ETH)
  - 🛡️ **Shield Bubble** (0.002 ETH)
  - ⚔️ **Damage Boost** (0.0015 ETH)
- Items appear instantly in the arena via reactive events

### 5. Match Resolution (3:00-3:30)
- Last agent standing wins
- Smart contract auto-distributes payouts
- Winners receive pro-rata share of betting pool

### 6. Reactivity Features (3:30-4:00)
- Explain: No polling, instant updates
- Show: Odds update in <1s when bets placed
- Show: Items delivered instantly on sponsorship
- Show: Auto-payout on match end

---

## Key Features to Showcase

### Somnia Reactivity Integration
- ✅ **ReactiveBettingPool** - Auto-updating odds, instant payouts
- ✅ **ReactiveSponsorship** - Real-time item delivery
- ✅ **ReactiveMatchTimer** - Cron-based turn advancement

### AI Agent System
- 5 uniform agents with identical stats
- Tactical arena with cover, elevation, chests
- Turn-based combat with items and abilities

### Web3 Features
- Wallet connection via RainbowKit
- Betting with real testnet tokens
- Automatic payout distribution

### 3D Visualization
- React Three Fiber arena
- Agent models and animations
- Real-time state sync

---

## Testing Checklist

- [ ] Wallet connects to Somnia Testnet
- [ ] Can place bet on agent
- [ ] Odds update after bet placed
- [ ] 3D arena renders with agents
- [ ] Can sponsor item to agent
- [ ] Item appears in game
- [ ] Match progresses through turns
- [ ] Match ends with winner
- [ ] Payouts distributed correctly

---

## Deployment

### Build for Production
```bash
cd apps/web
pnpm build
```

Output in `dist/` folder.

### Deploy to Vercel
```bash
npm i -g vercel
vercel --prod
```

### Deploy to IPFS
```bash
npm i -g ipfs-deploy
ipfs-deploy dist/
```

---

## Troubleshooting

### Game server won't start
- Check port 2567 is free
- Verify `.env` has correct contract addresses

### Frontend build fails
- Use pnpm instead of npm
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096"`

### Wallet won't connect
- Add Somnia Testnet to wallet manually
- RPC: `https://dream-rpc.somnia.network`
- Chain ID: `50312`

---

## Built For

**Somnia Reactivity Hackathon - March 2026**

Tech Stack:
- Somnia Testnet (Reactivity SDK)
- Hardhat + Solidity
- Colyseus (Game Server)
- React + Three.js (Frontend)
- RainbowKit + wagmi (Wallet)
