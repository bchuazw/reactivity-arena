import { useState } from 'react';
import { formatEther } from 'viem';
import { useReactiveBetting, type AgentOdds } from '../../hooks/useReactiveBetting';
import type { AgentData } from '../../hooks/useGameServer';

// ─── Archetype display ───────────────────────────────────────────
const ARCHETYPE_EMOJI: Record<string, string> = {
  vanguard: '🗡️',
  sniper: '🎯',
  support: '💚',
  assassin: '🥷',
  tank: '🛡️',
};

interface BettingPanelProps {
  matchId: `0x${string}` | undefined;
  agents: Map<string, AgentData>;
}

export function BettingPanel({ matchId, agents }: BettingPanelProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState('0.001');
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const {
    totalPool,
    matchState,
    winner,
    recentBets,
    isWritePending,
    placeBet,
    formatPool,
  } = useReactiveBetting(matchId);

  const agentArray = Array.from(agents.values());

  const handlePlaceBet = async () => {
    if (!selectedAgent || !betAmount) return;
    try {
      setTxStatus('Submitting transaction...');
      await placeBet(selectedAgent, betAmount);
      setTxStatus('✅ Bet placed!');
      setTimeout(() => setTxStatus(null), 3000);
    } catch (err) {
      setTxStatus(`❌ ${err instanceof Error ? err.message : 'Failed'}`);
      setTimeout(() => setTxStatus(null), 5000);
    }
  };

  const matchStateLabel = ['Pending', 'Active', 'Resolved', 'Cancelled'][matchState] || 'Unknown';

  return (
    <div className="panel betting-panel">
      <h2>💰 Betting Pool</h2>

      {/* Match status */}
      <div className="match-status">
        <span className={`status-badge status-${matchStateLabel.toLowerCase()}`}>
          {matchStateLabel}
        </span>
        <span className="total-pool">
          Pool: <strong>{formatPool} STT</strong>
        </span>
      </div>

      {winner && winner !== '0x0000000000000000000000000000000000000000' && (
        <div className="winner-banner">
          🏆 Winner: {winner.slice(0, 8)}...{winner.slice(-4)}
        </div>
      )}

      {/* Agent betting cards */}
      <div className="agent-bets">
        {agentArray.map((agent) => {
          const isSelected = selectedAgent === agent.walletAddress;
          return (
            <button
              key={agent.id}
              className={`agent-bet-card ${isSelected ? 'selected' : ''} ${!agent.isAlive ? 'dead' : ''}`}
              onClick={() => agent.isAlive && setSelectedAgent(agent.walletAddress)}
              disabled={matchState !== 1 || !agent.isAlive}
            >
              <div className="agent-bet-header">
                <span className="agent-emoji">{ARCHETYPE_EMOJI[agent.archetype] || '⚔️'}</span>
                <span className="agent-name">{agent.name}</span>
              </div>
              <div className="agent-bet-stats">
                <span className="hp">HP: {agent.hp}/{agent.maxHp}</span>
                <span className="kills">K: {agent.kills}</span>
              </div>
              {!agent.isAlive && <span className="dead-label">☠️ ELIMINATED</span>}
            </button>
          );
        })}
      </div>

      {/* Bet input */}
      {matchState === 1 && (
        <div className="bet-controls">
          <div className="bet-input-row">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              min="0.0001"
              step="0.001"
              placeholder="Amount (STT)"
              className="bet-input"
            />
            <span className="bet-currency">STT</span>
          </div>

          <div className="bet-presets">
            {['0.001', '0.005', '0.01', '0.05'].map((preset) => (
              <button
                key={preset}
                className="preset-btn"
                onClick={() => setBetAmount(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            className="place-bet-btn"
            onClick={handlePlaceBet}
            disabled={!selectedAgent || isWritePending || !betAmount}
          >
            {isWritePending ? '⏳ Confirming...' : `Place Bet on ${selectedAgent ? agentArray.find(a => a.walletAddress === selectedAgent)?.name || 'Agent' : '...'}`}
          </button>

          {txStatus && <div className="tx-status">{txStatus}</div>}
        </div>
      )}

      {/* Recent bets feed */}
      {recentBets.length > 0 && (
        <div className="recent-bets">
          <h3>📡 Live Bets</h3>
          {recentBets.slice(0, 5).map((bet, i) => (
            <div key={i} className="bet-entry">
              <span className="bet-user">{bet.user.slice(0, 6)}...{bet.user.slice(-4)}</span>
              <span className="bet-arrow">→</span>
              <span className="bet-agent">{bet.agent.slice(0, 6)}...</span>
              <span className="bet-amount">{bet.amount} STT</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
