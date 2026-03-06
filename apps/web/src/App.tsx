import { useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ArenaScene } from './components/Arena/ArenaScene';
import { BettingPanel } from './components/Betting/BettingPanel';
import { SponsorshipPanel } from './components/Betting/SponsorshipPanel';
import { useGameState, type TacticalAgent } from './hooks/useGameState';

const ROLE_LABELS: Record<TacticalAgent['roleKey'], string> = {
  leader: 'Leader',
  heavy: 'Heavy',
  scout: 'Scout',
  medic: 'Medic',
  demo: 'Demo',
};

const TEAM_COLORS: Record<TacticalAgent['roleKey'], string> = {
  leader: '#7ec8ff',
  heavy: '#ff8b78',
  scout: '#98ed8f',
  medic: '#d7adff',
  demo: '#ffbe73',
};

function MiniMap({ agents, currentAgentId, width, height }: { agents: Map<string, TacticalAgent>; currentAgentId: string; width: number; height: number }) {
  return (
    <div className="minimap">
      <div className="minimap-title">War map</div>
      <div className="minimap-grid" style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}>
        {Array.from({ length: width * height }, (_, idx) => {
          const x = idx % width;
          const y = Math.floor(idx / width);
          const occupant = Array.from(agents.values()).find((agent) => agent.position.x === x && agent.position.y === y && agent.isAlive);
          return (
            <div key={`${x}-${y}`} className={`minimap-cell ${occupant ? 'occupied' : ''} ${occupant?.id === currentAgentId ? 'active' : ''}`}>
              {occupant && <span style={{ backgroundColor: TEAM_COLORS[occupant.roleKey] }} className="minimap-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentStatusCards({ agents, currentAgentId }: { agents: Map<string, TacticalAgent>; currentAgentId: string }) {
  return (
    <div className="status-strip">
      {Array.from(agents.values()).map((agent) => {
        const totalHp = agent.hp + agent.temporaryHp;
        const maxHp = agent.maxHp + Math.max(agent.temporaryHp, 0);
        const hpPct = Math.max(0, Math.min(100, (totalHp / maxHp) * 100));
        return (
          <div key={agent.id} className={`status-card ${agent.id === currentAgentId ? 'active' : ''} ${!agent.isAlive ? 'dead' : ''}`}>
            <div className="status-card-top">
              <span className="status-swatch" style={{ backgroundColor: TEAM_COLORS[agent.roleKey] }} />
              <div>
                <div className="status-name">{agent.name}</div>
                <div className="status-role">{ROLE_LABELS[agent.roleKey]}</div>
              </div>
            </div>
            <div className="status-hp-bar">
              <div className="status-hp-fill" style={{ width: `${hpPct}%` }} />
            </div>
            <div className="status-metrics">
              <span>HP {totalHp}/{maxHp}</span>
              <span>AP {agent.ap}/{agent.maxAp}</span>
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
  const [activeTab, setActiveTab] = useState<'bet' | 'sponsor'>('bet');
  const [showGrid, setShowGrid] = useState(true);
  const gameState = useGameState();

  const { agents, currentAgentId, phase, tiles, destructibles, chests, fog, width, height, mapTheme } = gameState;

  const currentAgent = useMemo(
    () => Array.from(agents.values()).find((agent) => agent.id === currentAgentId) || Array.from(agents.values())[0],
    [agents, currentAgentId]
  );

  const actionLog = [
    'Leader advances to high ground and marks targets.',
    'Heavy enters overwatch near the plaza wreck.',
    'Scout reveals rooftop lane through fog of war.',
    'Medic opens a supply crate and reinforces the squad.',
    'Demo primes barrels for a chain-reaction flank.',
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">
            ⚔️ <span className="logo-text">Reactivity Arena</span>
          </h1>
          <span className="tagline">Metal Slug Tactics swagger, but now with an actual battlefield</span>
        </div>
        <div className="header-center">
          <div className="match-info">
            <span className={`phase-badge phase-${phase}`}>{phase.toUpperCase()}</span>
            <span className="turn-info">50×50 tactical warzone</span>
            <span className="spectators">👁️ Fog active</span>
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
            fog={fog}
            width={width}
            height={height}
            mapTheme={mapTheme}
            showGrid={showGrid}
          />

          <div className="arena-overlay top-left">
            <button className={`grid-toggle ${showGrid ? 'enabled' : ''}`} onClick={() => setShowGrid((value) => !value)}>
              {showGrid ? '▣ Tactical Grid On' : '□ Tactical Grid Off'}
            </button>
            <div className="current-turn-card">
              <div className="eyebrow">Current Turn</div>
              <div className="current-turn-name">{currentAgent?.name || 'Awaiting agent'}</div>
              <div className="current-turn-role">{currentAgent ? ROLE_LABELS[currentAgent.roleKey] : 'Standby'}</div>
            </div>
          </div>

          <div className="arena-overlay top-right">
            <MiniMap agents={agents} currentAgentId={currentAgentId} width={width} height={height} />
          </div>

          <div className="arena-overlay bottom-left full-width">
            <AgentStatusCards agents={agents} currentAgentId={currentAgentId} />
          </div>

          <div className="action-log tactical-log">
            <h3>⚡ Combat Log</h3>
            <div className="log-entries">
              {actionLog.map((entry, i) => (
                <div key={i} className="log-entry tactical-entry">
                  <span className="log-turn">T{i + 11}</span>
                  <span className="log-desc">{entry}</span>
                </div>
              ))}
            </div>
          </div>
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
            <BettingPanel agents={agents} matchId="0x0000000000000000000000000000000000000001" />
          ) : (
            <SponsorshipPanel agents={agents} matchId="0x0000000000000000000000000000000000000001" />
          )}

          <div className="stats-panel">
            <h3>📡 Tactical Snapshot</h3>
            <div className="stat-row"><span>Theme</span><span>Rusted Frontline</span></div>
            <div className="stat-row"><span>Elevation</span><span>4 tiers</span></div>
            <div className="stat-row"><span>Cover types</span><span>Full / half / destructible</span></div>
            <div className="stat-row"><span>Interactive props</span><span>Doors, ladders, ziplines</span></div>
            <div className="stat-row"><span>Hazards</span><span>Explosive barrels, fire lanes</span></div>
            <div className="stat-row"><span>Wallet</span><span>{isConnected ? 'Ready' : 'Spectator mode'}</span></div>
          </div>

          <div className="agents-panel">
            <h3>🦖 Strike Team</h3>
            {Array.from(agents.values()).map((agent) => (
              <div key={agent.id} className={`agent-card ${agent.id === currentAgentId ? 'current' : ''} ${!agent.isAlive ? 'dead' : ''}`}>
                <div className="agent-card-header">
                  <span className="status-swatch" style={{ backgroundColor: TEAM_COLORS[agent.roleKey] }} />
                  <div>
                    <div className="agent-name">{agent.name}</div>
                    <div className="agent-meta">{ROLE_LABELS[agent.roleKey]}</div>
                  </div>
                </div>
                <div className="agent-stats">HP {agent.hp + agent.temporaryHp}/{agent.maxHp + Math.max(agent.temporaryHp, 0)}</div>
                <div className="agent-stats">ATK {agent.attack} • DEF {agent.defense} • VIS {agent.sightRange}</div>
                <div className="agent-stats">AP {agent.ap}/{agent.maxAp} • Range {agent.attackRange + agent.bonusRange} • Ammo {agent.ammo}</div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
