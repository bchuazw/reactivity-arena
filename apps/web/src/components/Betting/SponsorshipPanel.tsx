import { useState } from 'react';
import { useReactiveBetting, ItemType, ITEM_NAMES, ITEM_COSTS } from '../../hooks/useReactiveBetting';
import type { AgentData } from '../../hooks/useGameServer';

const ARCHETYPE_EMOJI: Record<string, string> = {
  vanguard: '🗡️',
  sniper: '🎯',
  support: '💚',
  assassin: '🥷',
  tank: '🛡️',
};

interface SponsorshipPanelProps {
  matchId: `0x${string}` | undefined;
  agents: Map<string, AgentData>;
}

export function SponsorshipPanel({ matchId, agents }: SponsorshipPanelProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const {
    matchState,
    recentSponsorships,
    isWritePending,
    sponsorItem,
  } = useReactiveBetting(matchId);

  const agentArray = Array.from(agents.values());

  const handleSponsor = async (itemType: ItemType) => {
    if (!selectedAgent) return;
    try {
      setTxStatus('Sending item...');
      await sponsorItem(selectedAgent, itemType);
      setTxStatus('✅ Item sponsored!');
      setTimeout(() => setTxStatus(null), 3000);
    } catch (err) {
      setTxStatus(`❌ ${err instanceof Error ? err.message : 'Failed'}`);
      setTimeout(() => setTxStatus(null), 5000);
    }
  };

  const selectedAgentData = agentArray.find(a => a.walletAddress === selectedAgent);

  return (
    <div className="panel sponsorship-panel">
      <h2>🎁 Sponsor Power-Ups</h2>
      <p className="panel-description">Send items to your favorite agent in real-time!</p>

      {/* Agent selector */}
      <div className="agent-selector">
        {agentArray.filter(a => a.isAlive).map((agent) => (
          <button
            key={agent.id}
            className={`agent-select-btn ${selectedAgent === agent.walletAddress ? 'selected' : ''}`}
            onClick={() => setSelectedAgent(agent.walletAddress)}
            disabled={matchState !== 1}
          >
            <span>{ARCHETYPE_EMOJI[agent.archetype] || '⚔️'}</span>
            <span>{agent.name}</span>
          </button>
        ))}
      </div>

      {/* Item buttons */}
      {selectedAgent && matchState === 1 && (
        <div className="item-grid">
          {(Object.values(ItemType).filter(v => typeof v === 'number') as ItemType[]).map((itemType) => (
            <button
              key={itemType}
              className="item-btn"
              onClick={() => handleSponsor(itemType)}
              disabled={isWritePending}
            >
              <span className="item-name">{ITEM_NAMES[itemType]}</span>
              <span className="item-cost">{ITEM_COSTS[itemType]} STT</span>
              <span className="item-target">
                → {selectedAgentData?.name || 'Agent'}
              </span>
            </button>
          ))}
        </div>
      )}

      {!selectedAgent && matchState === 1 && (
        <div className="select-prompt">👆 Select an agent to sponsor</div>
      )}

      {txStatus && <div className="tx-status">{txStatus}</div>}

      {/* Recent sponsorships feed */}
      {recentSponsorships.length > 0 && (
        <div className="recent-sponsorships">
          <h3>📡 Live Sponsorships</h3>
          {recentSponsorships.slice(0, 5).map((s, i) => (
            <div key={i} className="sponsorship-entry">
              <span>{s.sponsor.slice(0, 6)}...</span>
              <span>→</span>
              <span>{ITEM_NAMES[s.item as ItemType] || 'Item'}</span>
              <span>→ {s.agent.slice(0, 6)}...</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
