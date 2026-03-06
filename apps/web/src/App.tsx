import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ArenaScene } from './components/Arena/ArenaScene';
import { BettingPanel } from './components/Betting/BettingPanel';
import { SponsorshipPanel } from './components/Betting/SponsorshipPanel';
import { useGameServer, type AgentData } from './hooks/useGameServer';

// ─── Demo agents for when game server is offline ─────────────────
const DEMO_AGENTS: Map<string, AgentData> = new Map([
  ['agent-1', {
    id: 'agent-1', name: 'Valkyrie', archetype: 'vanguard',
    walletAddress: '0x1111111111111111111111111111111111111111',
    hp: 85, maxHp: 100, attack: 12, defense: 8, speed: 6, ammo: 25, maxAmmo: 30,
    position: { x: 2, y: 2 }, isAlive: true, isDefending: false, hasShield: false,
    shieldTurns: 0, damageBoostTurns: 0, damageBoostMultiplier: 1,
    damageDealt: 45, damageTaken: 15, kills: 0, itemsReceived: 0,
  }],
  ['agent-2', {
    id: 'agent-2', name: 'Hawkeye', archetype: 'sniper',
    walletAddress: '0x2222222222222222222222222222222222222222',
    hp: 55, maxHp: 70, attack: 20, defense: 4, speed: 5, ammo: 10, maxAmmo: 15,
    position: { x: 8, y: 1 }, isAlive: true, isDefending: false, hasShield: false,
    shieldTurns: 0, damageBoostTurns: 0, damageBoostMultiplier: 1,
    damageDealt: 60, damageTaken: 15, kills: 1, itemsReceived: 0,
  }],
  ['agent-3', {
    id: 'agent-3', name: 'Mercy', archetype: 'support',
    walletAddress: '0x3333333333333333333333333333333333333333',
    hp: 90, maxHp: 90, attack: 8, defense: 6, speed: 7, ammo: 20, maxAmmo: 25,
    position: { x: 5, y: 5 }, isAlive: true, isDefending: false, hasShield: true,
    shieldTurns: 2, damageBoostTurns: 0, damageBoostMultiplier: 1,
    damageDealt: 10, damageTaken: 0, kills: 0, itemsReceived: 1,
  }],
  ['agent-4', {
    id: 'agent-4', name: 'Shadow', archetype: 'assassin',
    walletAddress: '0x4444444444444444444444444444444444444444',
    hp: 40, maxHp: 65, attack: 18, defense: 3, speed: 10, ammo: 15, maxAmmo: 20,
    position: { x: 7, y: 7 }, isAlive: true, isDefending: false, hasShield: false,
    shieldTurns: 0, damageBoostTurns: 3, damageBoostMultiplier: 2,
    damageDealt: 80, damageTaken: 25, kills: 1, itemsReceived: 1,
  }],
  ['agent-5', {
    id: 'agent-5', name: 'Ironclad', archetype: 'tank',
    walletAddress: '0x5555555555555555555555555555555555555555',
    hp: 120, maxHp: 150, attack: 7, defense: 15, speed: 3, ammo: 18, maxAmmo: 20,
    position: { x: 3, y: 8 }, isAlive: true, isDefending: true, hasShield: false,
    shieldTurns: 0, damageBoostTurns: 0, damageBoostMultiplier: 1,
    damageDealt: 20, damageTaken: 30, kills: 0, itemsReceived: 0,
  }],
]);

function App() {
  const { isConnected } = useAccount();
  const { connected, gameState, error, connect } = useGameServer();
  const [activeTab, setActiveTab] = useState<'bet' | 'sponsor'>('bet');

  // Use game server state if connected, otherwise demo
  const agents = gameState?.agents?.size ? gameState.agents : DEMO_AGENTS;
  const currentAgentId = gameState?.currentAgentId || 'agent-1';
  const phase = gameState?.phase || 'active';
  const matchId = gameState?.matchId as `0x${string}` | undefined;

  // Try to connect to game server on mount
  useEffect(() => {
    connect().catch(() => {
      // Silently fall back to demo mode
    });
  }, [connect]);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1 className="logo">
            ⚔️ <span className="logo-text">Reactivity Arena</span>
          </h1>
          <span className="tagline">Tactical AI Combat • On-Chain Betting</span>
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
          <ConnectButton
            showBalance={true}
            chainStatus="icon"
            accountStatus="avatar"
          />
        </div>
      </header>

      {/* Main content */}
      <main className="main">
        {/* 3D Arena (left/center) */}
        <section className="arena-section">
          <ArenaScene
            agents={agents}
            currentAgentId={currentAgentId}
            phase={phase}
          />

          {/* Action log */}
          {gameState?.actionLog && gameState.actionLog.length > 0 && (
            <div className="action-log">
              <h3>⚡ Combat Log</h3>
              <div className="log-entries">
                {gameState.actionLog.slice(-8).reverse().map((entry, i) => (
                  <div key={i} className="log-entry">
                    <span className="log-turn">T{entry.turn}</span>
                    <span className="log-desc">{entry.description}</span>
                    {entry.damage > 0 && (
                      <span className="log-damage">-{entry.damage} HP</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Sidebar (right) */}
        <aside className="sidebar">
          {/* Tab switcher */}
          <div className="tab-bar">
            <button
              className={`tab ${activeTab === 'bet' ? 'active' : ''}`}
              onClick={() => setActiveTab('bet')}
            >
              💰 Betting
            </button>
            <button
              className={`tab ${activeTab === 'sponsor' ? 'active' : ''}`}
              onClick={() => setActiveTab('sponsor')}
            >
              🎁 Sponsor
            </button>
          </div>

          {/* Panel content */}
          {activeTab === 'bet' ? (
            <BettingPanel matchId={matchId} agents={agents} />
          ) : (
            <SponsorshipPanel matchId={matchId} agents={agents} />
          )}

          {/* Agent stats */}
          <div className="panel agent-stats-panel">
            <h2>📊 Agent Stats</h2>
            <div className="agent-stats-list">
              {Array.from(agents.values()).map((agent) => (
                <div key={agent.id} className={`agent-stat-row ${!agent.isAlive ? 'dead' : ''}`}>
                  <span className="stat-name">{agent.name}</span>
                  <span className="stat-hp">{agent.hp}/{agent.maxHp}</span>
                  <span className="stat-dmg">⚔️{agent.damageDealt}</span>
                  <span className="stat-kills">💀{agent.kills}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Connection status */}
          {error && (
            <div className="panel error-panel">
              <p>⚠️ {error}</p>
              <button onClick={() => connect()} className="retry-btn">Retry</button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
