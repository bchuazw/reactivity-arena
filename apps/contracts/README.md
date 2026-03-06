# Reactivity Arena — Smart Contracts

> Reactive smart contracts for the Reactivity Arena tactical AI combat game on Somnia Testnet.

## Contracts

| Contract | Description |
|----------|-------------|
| **ReactiveBettingPool.sol** | Betting pool with auto-updating odds and instant payout distribution |
| **ReactiveSponsorship.sol** | Item sponsorship system — spectators drop items to agents mid-match |
| **ReactiveMatchTimer.sol** | Cron-based match timer for turn advancement and stale match resolution |

## Prerequisites

- Node.js 18+
- npm or yarn
- Somnia Testnet tokens (get from [Somnia Faucet](https://docs.somnia.network/developer/faucet))

## Setup

```bash
# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your private key and wallet addresses
```

## Configuration

Edit `.env` with your values:

```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
HOUSE_WALLET=0xYOUR_HOUSE_WALLET
GAME_SERVER_ADDRESS=0xYOUR_SERVER_ADDRESS
```

## Compile

```bash
npx hardhat compile
```

## Deploy

### Deploy all contracts at once (recommended):

```bash
npx hardhat run deploy/04_deploy_all.ts --network somniaTestnet
```

This deploys all 3 contracts, links them together, and saves addresses to `deployed-addresses.json`.

### Deploy individually:

```bash
# 1. Betting Pool
npx hardhat run deploy/01_deploy_betting_pool.ts --network somniaTestnet

# 2. Sponsorship (set BETTING_POOL_ADDRESS in .env first)
npx hardhat run deploy/02_deploy_sponsorship.ts --network somniaTestnet

# 3. Match Timer (set BETTING_POOL_ADDRESS in .env first)
npx hardhat run deploy/03_deploy_match_timer.ts --network somniaTestnet
```

### Deploy to local Hardhat network (for testing):

```bash
npx hardhat run deploy/04_deploy_all.ts
```

## Test

```bash
npx hardhat test
```

## Verify on Somnia Explorer

```bash
npx hardhat verify --network somniaTestnet <BETTING_POOL_ADDRESS> <HOUSE_WALLET> 700
npx hardhat verify --network somniaTestnet <SPONSORSHIP_ADDRESS> <HOUSE_WALLET>
npx hardhat verify --network somniaTestnet <MATCH_TIMER_ADDRESS> <BETTING_POOL_ADDRESS>
```

## Network Configuration

| Parameter | Value |
|-----------|-------|
| Network | Somnia Testnet |
| RPC URL | `https://dream-rpc.somnia.network` |
| Chain ID | `50312` |
| Explorer | [Somnia Explorer](https://explorer.somnia.network) |

## Contract Architecture

```
ReactiveBettingPool
├── createMatch() — Register a new match with agents
├── placeBet() — Place bet → auto-emits OddsUpdated for all agents
├── resolveMatch() — Game server resolves → auto-distributes payouts
└── cancelMatch() — Refunds all bets

ReactiveSponsorship
├── registerMatch() — Register agents for a match
├── sponsorAgent() — Pay to drop item → emits ItemSponsored instantly
├── confirmDelivery() — Game server confirms item was delivered
└── setBettingPool() — Link to betting pool for prize pool split

ReactiveMatchTimer
├── createMatch() → startMatch() — Lifecycle management
├── advanceTurn() — Move to next agent's turn
├── checkTurnTimeout() — Cron: auto-force turn if timer expired
├── checkStaleMatch() — Cron: auto-end match if inactive 10min
└── endMatch() — Manual resolution by game server
```

## Reactivity Features

- **OddsUpdated** events emit on every bet → frontend subscribes for instant odds display
- **ItemSponsored** events push to game server → items appear in-game within 1 second
- **TurnAdvanced** events drive real-time turn display without polling
- **MatchAutoResolved** triggers automatic payout — no manual claims needed

## Built for

[Somnia Reactivity Hackathon](https://somnia.network) — March 2026
