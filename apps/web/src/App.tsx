import { useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ArenaScene } from './components/Arena/ArenaScene';
import { BettingPanel } from './components/Betting/BettingPanel';
import { SponsorshipPanel } from './components/Betting/SponsorshipPanel';
import { useGameServer, type AgentData, type ActionLogEntry, type TileData, type ChestData, type DestructibleData } from './hooks/useGameServer';

const ROLE_LABELS: Record<string, string> = {
  'agent-1': 'Soldier',
  'agent-2': 'Heavy',
  'agent-3': 'Scout',
  'agent-4': 'Medic',
  'agent-5': 'Demo',
};

const TEAM_COLORS: Record<string, string> = {
  'agent-1': '#7ec8ff',
  'agent-2': '#ff8b78',
  'agent-3': '#98ed8f',
  'agent-4': '#d7adff',
  'agent-5': '#ffbe73',
};

const baseAgent = (overrides: Partial<AgentData>): AgentData => ({
  id: 'agent-demo',
  name: 'Demo Agent',
  walletAddress: '0x0000000000000000000000000000000000000000',
  hp: 100,
  maxHp: 100,
  attack: 12,
  defense: 8,
  speed: 5,
  ammo: 20,
  maxAmmo: 20,
  attackRange: 2,
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
    : (y === 8 && x >= 2 && x <= 4) || (y === 1 && x >= 6 && x <= 8)
    ? 'ground'
    : 'road';

  return {
    position: { x, y },
    terrain,
    theme: 'warzone_outskirts',
    elevation: terrain === 'elevation' ? 2 : 0,
    blocksMovement: false,
    providesCover: x === 1 || x === 8,
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
  { turn: 9, agentId: 'agent-2', action: 'attack', targetId: 'agent-4', damage: 14, description: '⚔️ Heavy agent suppresses Agent Four from the bridge lane.', timestamp: Date.now() - 8000 },
  { turn: 8, agentId: 'agent-3', action: 'open_chest', targetId: 'demo-chest-2', damage: 0, description: '📦 Scout opens a chest and grabs a Recon Drone.', timestamp: Date.now() - 12000 },
  { turn: 8, agentId: 'agent-5', action: 'defend', targetId: '', damage: 0, description: '🛡️ Demo agent braces behind sandbags.', timestamp: Date.now() - 15000 },
  { turn: 7, agentId: 'agent-1', action: 'move', targetId: '', damage: 0, description: '🎯 Soldier advances through the ruined street.', timestamp: Date.now() - 20000 },
];

const DEMO_AGENTS: Map<string, AgentData> = new Map([
  ['agent-1', baseAgent({ id: 'agent-1', name: 'Agent One', hp: 100, position: { x: 2, y: 2 }, damageDealt: 24, damageTaken: 12 })],
  ['agent-2', baseAgent({ id: 'agent-2', name: 'Agent Two', hp: 84, ammo: 17, position: { x: 8, y: 1 }, damageDealt: 38, damageTaken: 18, kills: 1, bonusRange: 1 })],
  ['agent-3', baseAgent({ id: 'agent-3', name: 'Agent Three', hp: 91, hasShield: true, shieldTurns: 1, position: { x: 1, y: 5 }, itemsReceived: 1 })],
  ['agent-4', baseAgent({ id: 'agent-4', name: 'Agent Four', hp: 67, position: { x: 6, y: 4 }, damageDealt: 31, damageTaken: 33, inventory: [{ type: 'grenade', consumed: false }] })],
  ['agent-5', baseAgent({ id: 'agent-5', name: 'Agent Five', hp: 72, temporaryHp: 12, isDefending: true, position: { x: 3, y: 8 }, damageTaken: 28 })],
]);

function MiniMap({ agents, currentAgentId }: { agents: Map<string, AgentData>; currentAgentId: string }) {
  return (
    <div className="minimap">
      <div className="minimap-title">Mini-map</div>
      <div className="minimap-grid">
        {Array.from({ length: 100 }, (_, idx) => {
          const x = idx % 10;
          const y = Math.floor(idx / 10);
          const occupant = Array.from(agents.values()).find((agent) => agent.position.x === x && agent.position.y === y && agent.isAlive);
          return (
            <div key={`${x}-${y}`} className={`minimap-cell ${occupant ? 'occupied' : ''} ${occupant?.id === currentAgentId ? 'active' : ''}`}>
              {occupant && (
                <span style={{ backgroundColor: TEAM_COLORS[occupant.id] || '#ddd' }} className="minimap-dot" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentStatusCards({ agents, currentAgentId }: { agents: Map<string, AgentData>; currentAgentId: string }) {
  return (
    <div className="status-strip">
      {Array.from(agents.values()).map((agent) => {
        const totalHp = agent.hp + agent.temporaryHp;
        const maxHp = agent.maxHp + Math.max(agent.temporaryHp, 0);
        const hpPct = Math.max(0, Math.min(100, (totalHp / maxHp) * 100));
        return (
          <div key={agent.id} className={`status-card ${agent.id === currentAgentId ? 'active' : ''} ${!agent.isAlive ? 'dead' : ''}`}>
            <div className="status-card-top">
              <span className="status-swatch" style={{ backgroundColor: TEAM_COLORS[agent.id] || '#aaa' }} />
              <div>
                <div className="status-name">{agent.name}</div>
                <div className="status-role">{ROLE_LABELS[agent.id] || 'Operative'}</div>
              </div>
            </div>
            <div className="status-hp-bar">
              <div className="status-hp-fill" style={{ width: `${hpPct}%` }} />
            </div>
            <div className="status-metrics">
              <span>HP {totalHp}/{maxHp}</span>
              <span>Kills {agent.kills}</span>
              <span>Ammo {agent.ammo}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const { isConnected } = useAccount();
  const { connected, gameState, error, connect } = useGameServer();
  const [activeTab, setActiveTab] = useState<'bet' | 'sponsor'>('bet');
  const [showGrid, setShowGrid] = useState(true);

  const agents = gameState?.agents?.size ? gameState.agents : DEMO_AGENTS;
  const currentAgentId = gameState?.currentAgentId || 'agent-1';
  const phase = gameState?.phase || 'active';
  const matchId = gameState?.matchId as `0x${string}` | undefined;
  const tiles = gameState?.tiles || DEMO_TILES;
  const chests = gameState?.chests || DEMO_CHESTS;
  const destructibles = gameState?.destructibles || DEMO_DESTRUCTIBLES;
  const actionLog = gameState?.actionLog?.length ? gameState.actionLog : DEMO_ACTION_LOG;

  const currentAgent = useMemo(
    () => Array.from(agents.values()).find((agent) => agent.id === currentAgentId) || Array.from(agents.values())[0],
    [agents, currentAgentId]
  );

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
          <span className="tagline">Metal Slug Tactics energy, but with wallets and chaos</span>
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
            mapTheme={gameState?.mapTheme || 'warzone_outskirts'}
            showGrid={showGrid}
          />

          <div className="arena-overlay top-left">
            <button className={`grid-toggle ${showGrid ? 'enabled' : ''}`} onClick={() => setShowGrid((value) => !value)}>
              {showGrid ? '▣ Tactical Grid On' : '□ Tactical Grid Off'}
            </button>
            <div className="current-turn-card">
              <div className="eyebrow">Current Turn</div>
              <div className="current-turn-name">{currentAgent?.name || 'Awaiting agent'}</div>
              <div className="current-turn-role">{currentAgent ? ROLE_LABELS[currentAgent.id] || 'Operative' : 'Standby'}</div>
            </div>
          </div>

          <div className="arena-overlay top-right">
            <MiniMap agents={agents} currentAgentId={currentAgentId} />
          </div>

          <div className="arena-overlay bottom-left full-width">
            <AgentStatusCards agents={agents} currentAgentId={currentAgentId} />
          </div>

          {actionLog.length > 0 && (
            <div className="action-log tactical-log">
              <h3>⚡ Combat Log</h3>
              <div className="log-entries">
                {actionLog.slice(-8).reverse().map((entry, i) => (
                  <div key={i} className="log-entry tactical-entry">
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
            <BettingPanel agents={agents} matchId={matchId} />
          ) : (
            <SponsorshipPanel agents={agents} matchId={matchId} />
          )}

          <div className="stats-panel">
            <h3>📡 Tactical Snapshot</h3>
            <div className="stat-row"><span>Theme</span><span>Warzone Outskirts</span></div>
            <div className="stat-row"><span>Open Chests</span><span>{chests.filter((chest) => !chest.opened).length}</span></div>
            <div className="stat-row"><span>Props Intact</span><span>{destructibles.filter((prop) => prop.hp > 0).length}</span></div>
            <div className="stat-row"><span>Network</span><span>{isConnected ? 'Wallet ready' : 'Spectator mode'}</span></div>
            <div className="stat-row"><span>Server</span><span>{error ? 'Offline server' : 'Nominal'}</span></div>
          </div>

          <div className="agents-panel">
            <h3>🪖 Agent Status Cards</h3>
            {Array.from(agents.values()).map((agent) => (
              <div key={agent.id} className={`agent-card ${agent.id === currentAgentId ? 'current' : ''} ${!agent.isAlive ? 'dead' : ''}`}>
                <div className="agent-card-header">
                  <span className="status-swatch" style={{ backgroundColor: TEAM_COLORS[agent.id] || '#aaa' }} />
                  <div>
                    <div className="agent-name">{agent.name}</div>
                    <div className="agent-meta">{ROLE_LABELS[agent.id] || 'Operative'}</div>
                  </div>
                </div>
                <div className="agent-stats">HP {agent.hp + agent.temporaryHp}/{agent.maxHp + Math.max(agent.temporaryHp, 0)}</div>
                <div className="agent-stats">ATK {agent.attack} • DEF {agent.defense} • RNG {agent.attackRange + agent.bonusRange}</div>
                <div className="agent-stats">Inventory {agent.inventory.filter((item) => !item.consumed).length} • Items {agent.itemsReceived}</div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
