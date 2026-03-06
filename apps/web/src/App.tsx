import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ArenaScene } from './components/Arena/ArenaScene';
import { BettingPanel } from './components/Betting/BettingPanel';
import { SponsorshipPanel } from './components/Betting/SponsorshipPanel';
import { useGameServer, type AgentData, type ActionLogEntry, type TileData, type ChestData, type DestructibleData } from './hooks/useGameServer';

const baseAgent = (overrides: Partial<AgentData>): AgentData => ({
  id: 'agent-demo',
  name: 'Demo Agent',
  archetype: 'vanguard',
  walletAddress: '0x0000000000000000000000000000000000000000',
  hp: 100,
  maxHp: 100,
  attack: 12,
  defense: 6,
  speed: 5,
  ammo: 20,
  maxAmmo: 20,
  attackRange: 3,
  bonusRange: 0,
  actionsPerTurn: 2,
  temporaryHp: 0,
  position: { x: 0, y: 0 },
  isAlive: true,
  isDefending: false,
  hasShield: false,
  shieldTurns: 0,
  damageBoostTurns: 0,
  damageBoostMultiplier: 1,
  speedBoostTurns: 0,
  revealTurns: 0,
  smokeTurns: 0,
  disabledTurns: 0,
  reviveAvailable: true,
  barrierAvailable: true,
  barrierCooldown: 0,
  inspireTurns: 0,
  protectedByTitanTurns: 0,
  damageDealt: 0,
  damageTaken: 0,
  kills: 0,
  itemsReceived: 0,
  inventory: [],
  statusEffects: [],
  ...overrides,
});

const DEMO_TILES: TileData[] = Array.from({ length: 100 }, (_, index) => {
  const x = index % 10;
  const y = Math.floor(index / 10);
  const terrain = y === 2 && (x === 4 || x === 5)
    ? 'bridge'
    : y >= 3 && y <= 6 && (x === 4 || x === 5)
    ? 'water'
    : x === 1 && y === 5
    ? 'healing'
    : x === 8 && y === 4
    ? 'healing'
    : (x === 2 && y >= 4 && y <= 5) || (x === 7 && y >= 4 && y <= 5)
    ? 'bush'
    : (x <= 1 && y <= 1) || (x >= 8 && y <= 1)
    ? 'elevation'
    : 'road';

  return {
    position: { x, y },
    terrain,
    theme: 'cyber_ruins',
    elevation: terrain === 'elevation' ? 2 : 0,
    blocksMovement: false,
    providesCover: terrain === 'cover',
    concealment: terrain === 'bush',
    movementCost: terrain === 'water' ? 2 : 1,
    vulnerable: terrain === 'water',
    healing: terrain === 'healing',
    chokepoint: terrain === 'bridge',
  };
});

const DEMO_CHESTS: ChestData[] = [
  { id: 'demo-chest-1', position: { x: 3, y: 8 }, opened: false, itemType: 'shield_battery', autoEquip: true },
  { id: 'demo-chest-2', position: { x: 6, y: 1 }, opened: false, itemType: 'recon_drone', autoEquip: true },
  { id: 'demo-chest-3', position: { x: 5, y: 5 }, opened: false, itemType: 'medkit', autoEquip: true },
];

const DEMO_DESTRUCTIBLES: DestructibleData[] = [
  { id: 'demo-barrel-1', type: 'barrel', position: { x: 3, y: 2 }, hp: 18, maxHp: 18, blocksMovement: true, providesCover: true, explosive: true, blastRadius: 1, damage: 16 },
  { id: 'demo-barrier-1', type: 'barrier', position: { x: 1, y: 4 }, hp: 24, maxHp: 24, blocksMovement: true, providesCover: true, explosive: false, blastRadius: 0, damage: 0 },
  { id: 'demo-crate-1', type: 'crate', position: { x: 7, y: 6 }, hp: 20, maxHp: 20, blocksMovement: true, providesCover: true, explosive: false, blastRadius: 0, damage: 0 },
];

const DEMO_ACTION_LOG: ActionLogEntry[] = [
  { turn: 9, agentId: 'agent-ranger', action: 'attack', targetId: 'agent-saboteur', damage: 14, description: '🎯 Skyline takes a rooftop shot into Glitch.', timestamp: Date.now() - 8000 },
  { turn: 8, agentId: 'agent-medic', action: 'ability', targetId: 'agent-vanguard', damage: 0, description: '💚 Patchwire drops heal burst and smoke on the bridge lane.', timestamp: Date.now() - 12000 },
  { turn: 8, agentId: 'agent-saboteur', action: 'open_chest', targetId: 'demo-chest-2', damage: 0, description: '📦 Glitch opens a chest and grabs a Recon Drone.', timestamp: Date.now() - 15000 },
];

const DEMO_AGENTS: Map<string, AgentData> = new Map([
  ['agent-vanguard', baseAgent({ id: 'agent-vanguard', name: 'Aegis Lance', archetype: 'vanguard', hp: 104, maxHp: 120, attack: 14, defense: 8, speed: 5, attackRange: 2, ammo: 18, maxAmmo: 20, position: { x: 2, y: 2 }, damageDealt: 42, damageTaken: 16 })],
  ['agent-ranger', baseAgent({ id: 'agent-ranger', name: 'Skyline', archetype: 'ranger', hp: 70, maxHp: 82, attack: 16, defense: 4, speed: 4, attackRange: 5, ammo: 9, maxAmmo: 14, bonusRange: 1, position: { x: 8, y: 1 }, damageDealt: 61, damageTaken: 12, kills: 1 })],
  ['agent-medic', baseAgent({ id: 'agent-medic', name: 'Patchwire', archetype: 'medic', hp: 88, maxHp: 96, attack: 9, defense: 6, speed: 5, attackRange: 3, ammo: 16, maxAmmo: 18, hasShield: true, shieldTurns: 1, smokeTurns: 1, position: { x: 1, y: 5 }, itemsReceived: 1 })],
  ['agent-saboteur', baseAgent({ id: 'agent-saboteur', name: 'Glitch', archetype: 'saboteur', hp: 74, maxHp: 88, attack: 15, defense: 5, speed: 7, attackRange: 2, ammo: 12, maxAmmo: 18, revealTurns: 2, position: { x: 6, y: 4 }, damageBoostTurns: 1, damageBoostMultiplier: 1.2, inventory: [{ type: 'grenade', consumed: false }], damageDealt: 55, damageTaken: 30, kills: 1 })],
  ['agent-titan', baseAgent({ id: 'agent-titan', name: 'Bulwark', archetype: 'titan', hp: 132, maxHp: 150, attack: 11, defense: 10, speed: 3, attackRange: 2, ammo: 15, maxAmmo: 16, temporaryHp: 18, isDefending: true, position: { x: 3, y: 8 }, damageTaken: 44 })],
]);

function App() {
  const { isConnected } = useAccount();
  const { connected, gameState, error, connect } = useGameServer();
  const [activeTab, setActiveTab] = useState<'bet' | 'sponsor'>('bet');

  const agents = gameState?.agents?.size ? gameState.agents : DEMO_AGENTS;
  const currentAgentId = gameState?.currentAgentId || 'agent-vanguard';
  const phase = gameState?.phase || 'active';
  const matchId = gameState?.matchId as `0x${string}` | undefined;
  const tiles = gameState?.tiles || DEMO_TILES;
  const chests = gameState?.chests || DEMO_CHESTS;
  const destructibles = gameState?.destructibles || DEMO_DESTRUCTIBLES;
  const actionLog = gameState?.actionLog?.length ? gameState.actionLog : DEMO_ACTION_LOG;

  useEffect(() => {
    connect().catch(() => {
      // fallback to demo mode
    });
  }, [connect]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">
            ⚔️ <span className="logo-text">Reactivity Arena</span>
          </h1>
          <span className="tagline">Tactical AI Combat • Terrain Control • On-Chain Betting</span>
        </div>
        <div className="header-center">
          <div className="match-info">
            <span className={`phase-badge phase-${phase}`}>{phase.toUpperCase()}</span>
            {gameState && (
              <>
                <span className="turn-info">Turn {gameState.turnNumber}/{gameState.maxTurns}</span>
                <span className="spectators">👁️ {gameState.spectatorCount}</span>
              </>
            )}
            {!connected && <span className="demo-badge">DEMO MODE</span>}
          </div>
        </div>
        <div className="header-right">
          <ConnectButton showBalance={true} chainStatus="icon" accountStatus="avatar" />
        </div>
      </header>

      <main className="main">
        <section className="arena-section">
          <ArenaScene
            agents={agents}
            currentAgentId={currentAgentId}
            phase={phase}
            tiles={tiles}
            destructibles={destructibles}
            chests={chests}
            mapTheme={gameState?.mapTheme || 'cyber_ruins'}
          />

          {actionLog.length > 0 && (
            <div className="action-log">
              <h3>⚡ Combat Log</h3>
              <div className="log-entries">
                {actionLog.slice(-8).reverse().map((entry, i) => (
                  <div key={i} className="log-entry">
                    <span className="log-turn">T{entry.turn}</span>
                    <span className="log-desc">{entry.description}</span>
                    {entry.damage > 0 && <span className="log-damage">-{entry.damage} HP</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="sidebar">
          <div className="tab-bar">
            <button className={`tab ${activeTab === 'bet' ? 'active' : ''}`} onClick={() => setActiveTab('bet')}>
              💰 Betting
            </button>
            <button className={`tab ${activeTab === 'sponsor' ? 'active' : ''}`} onClick={() => setActiveTab('sponsor')}>
              🎁 Sponsor
            </button>
          </div>

          {activeTab === 'bet' ? (
            <BettingPanel agents={Array.from(agents.values())} matchId={matchId} walletConnected={isConnected} />
          ) : (
            <SponsorshipPanel agents={Array.from(agents.values())} matchId={matchId} walletConnected={isConnected} />
          )}

          <div className="stats-panel">
            <h3>📡 Tactical Snapshot</h3>
            <div className="stat-row"><span>Theme</span><span>Cyber Ruins</span></div>
            <div className="stat-row"><span>Open Chests</span><span>{chests.filter((chest) => !chest.opened).length}</span></div>
            <div className="stat-row"><span>Destructibles Up</span><span>{destructibles.filter((prop) => prop.hp > 0).length}</span></div>
            <div className="stat-row"><span>Error</span><span>{error ? 'Offline server' : 'Nominal'}</span></div>
          </div>

          <div className="agents-panel">
            <h3>🤖 Agents</h3>
            {Array.from(agents.values()).map((agent) => (
              <div key={agent.id} className={`agent-card ${agent.id === currentAgentId ? 'current' : ''} ${!agent.isAlive ? 'dead' : ''}`}>
                <div className="agent-name">{agent.name}</div>
                <div className="agent-meta">{agent.archetype.toUpperCase()}</div>
                <div className="agent-stats">HP {agent.hp + agent.temporaryHp}/{agent.maxHp + Math.max(agent.temporaryHp, 0)}</div>
                <div className="agent-stats">ATK {agent.attack} • DEF {agent.defense} • RNG {agent.attackRange + agent.bonusRange}</div>
                <div className="agent-stats">Inventory {agent.inventory.filter((item) => !item.consumed).length}</div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
