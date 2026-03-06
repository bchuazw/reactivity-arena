import { useState, useCallback } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';
import { ReactiveBettingPoolABI, ReactiveSponsorshipABI } from '../contracts/abis';

// ─── Types ───────────────────────────────────────────────────────
export interface AgentOdds {
  agent: string;
  odds: number; // e.g. 250 = 2.50x
  pool: bigint;
}

export interface BettingState {
  totalPool: bigint;
  matchState: number; // 0=PENDING, 1=ACTIVE, 2=RESOLVED, 3=CANCELLED
  winner: string;
  agentOdds: AgentOdds[];
}

export enum ItemType {
  HEALTH_PACK = 0,
  AMMO_CRATE = 1,
  SHIELD_BUBBLE = 2,
  DAMAGE_BOOST = 3,
}

export const ITEM_NAMES: Record<ItemType, string> = {
  [ItemType.HEALTH_PACK]: '❤️ Health Pack',
  [ItemType.AMMO_CRATE]: '🔫 Ammo Crate',
  [ItemType.SHIELD_BUBBLE]: '🛡️ Shield Bubble',
  [ItemType.DAMAGE_BOOST]: '⚡ Damage Boost',
};

export const ITEM_COSTS: Record<ItemType, string> = {
  [ItemType.HEALTH_PACK]: '0.001',
  [ItemType.AMMO_CRATE]: '0.0005',
  [ItemType.SHIELD_BUBBLE]: '0.002',
  [ItemType.DAMAGE_BOOST]: '0.0015',
};

// ─── Hook ────────────────────────────────────────────────────────
export function useReactiveBetting(matchId: `0x${string}` | undefined) {
  const { address } = useAccount();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const [recentBets, setRecentBets] = useState<Array<{ user: string; agent: string; amount: string }>>([]);
  const [recentSponsorships, setRecentSponsorships] = useState<Array<{ sponsor: string; agent: string; item: number }>>([]);

  // ─── Read match info ────────────────────────────────────────
  const { data: matchInfo } = useReadContract({
    address: CONTRACT_ADDRESSES.ReactiveBettingPool,
    abi: ReactiveBettingPoolABI,
    functionName: 'getMatchInfo',
    args: matchId ? [matchId] : undefined,
    query: { enabled: !!matchId, refetchInterval: 5000 },
  });

  // ─── Read match agents ──────────────────────────────────────
  const { data: matchAgents } = useReadContract({
    address: CONTRACT_ADDRESSES.ReactiveBettingPool,
    abi: ReactiveBettingPoolABI,
    functionName: 'getMatchAgents',
    args: matchId ? [matchId] : undefined,
    query: { enabled: !!matchId },
  });

  // ─── Watch for bet events (reactive) ───────────────────────
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.ReactiveBettingPool,
    abi: ReactiveBettingPoolABI,
    eventName: 'BetPlaced',
    onLogs(logs) {
      const newBets = logs.map((log) => ({
        user: (log.args as any).user as string,
        agent: (log.args as any).agent as string,
        amount: formatEther((log.args as any).amount as bigint),
      }));
      setRecentBets((prev) => [...newBets, ...prev].slice(0, 20));
    },
  });

  // ─── Watch for sponsorship events ──────────────────────────
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.ReactiveSponsorship,
    abi: ReactiveSponsorshipABI,
    eventName: 'ItemSponsored',
    onLogs(logs) {
      const newItems = logs.map((log) => ({
        sponsor: (log.args as any).sponsor as string,
        agent: (log.args as any).agent as string,
        item: Number((log.args as any).item),
      }));
      setRecentSponsorships((prev) => [...newItems, ...prev].slice(0, 20));
    },
  });

  // ─── Place bet ──────────────────────────────────────────────
  const placeBet = useCallback(
    async (agent: string, amountEth: string) => {
      if (!matchId) throw new Error('No match ID');
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.ReactiveBettingPool,
        abi: ReactiveBettingPoolABI,
        functionName: 'placeBet',
        args: [matchId, agent as `0x${string}`],
        value: parseEther(amountEth),
      });
      return tx;
    },
    [matchId, writeContractAsync],
  );

  // ─── Sponsor item ──────────────────────────────────────────
  const sponsorItem = useCallback(
    async (agent: string, itemType: ItemType) => {
      if (!matchId) throw new Error('No match ID');
      const cost = ITEM_COSTS[itemType];
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.ReactiveSponsorship,
        abi: ReactiveSponsorshipABI,
        functionName: 'sponsorAgent',
        args: [matchId, agent as `0x${string}`, itemType],
        value: parseEther(cost),
      });
      return tx;
    },
    [matchId, writeContractAsync],
  );

  // ─── Parse match info ──────────────────────────────────────
  const totalPool = matchInfo ? (matchInfo as any)[0] as bigint : 0n;
  const matchState = matchInfo ? Number((matchInfo as any)[1]) : 0;
  const winner = matchInfo ? (matchInfo as any)[2] as string : '';
  const agents = (matchAgents as string[]) || [];

  return {
    // State
    totalPool,
    matchState,
    winner,
    agents,
    recentBets,
    recentSponsorships,
    isWritePending,
    userAddress: address,

    // Actions
    placeBet,
    sponsorItem,

    // Helpers
    formatPool: formatEther(totalPool),
  };
}
