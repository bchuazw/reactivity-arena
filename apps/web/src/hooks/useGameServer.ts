import { useState, useEffect, useCallback, useRef } from 'react';
import { Client, Room } from 'colyseus.js';

// ─── Types matching the server's ArenaState schema ───────────────
export interface AgentData {
  id: string;
  name: string;
  archetype: string;
  walletAddress: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  ammo: number;
  maxAmmo: number;
  position: { x: number; y: number };
  isAlive: boolean;
  isDefending: boolean;
  hasShield: boolean;
  shieldTurns: number;
  damageBoostTurns: number;
  damageBoostMultiplier: number;
  damageDealt: number;
  damageTaken: number;
  kills: number;
  itemsReceived: number;
}

export interface ActionLogEntry {
  turn: number;
  agentId: string;
  action: string;
  targetId: string;
  damage: number;
  description: string;
  timestamp: number;
}

export interface GameState {
  matchId: string;
  phase: string;
  turnNumber: number;
  maxTurns: number;
  currentAgentId: string;
  turnDeadline: number;
  agents: Map<string, AgentData>;
  turnOrder: string[];
  actionLog: ActionLogEntry[];
  spectatorCount: number;
  totalBets: number;
  startTime: number;
  winnerId: string;
}

const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || 'ws://localhost:2567';

export function useGameServer() {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<Client | null>(null);
  const roomRef = useRef<Room | null>(null);

  const connect = useCallback(async (roomName = 'arena') => {
    try {
      setError(null);
      const client = new Client(GAME_SERVER_URL);
      clientRef.current = client;

      const room = await client.joinOrCreate(roomName);
      roomRef.current = room;
      setConnected(true);

      // Listen to state changes
      room.onStateChange((state: any) => {
        const agents = new Map<string, AgentData>();
        if (state.agents) {
          state.agents.forEach((agent: any, key: string) => {
            agents.set(key, {
              id: agent.id,
              name: agent.name,
              archetype: agent.archetype,
              walletAddress: agent.walletAddress,
              hp: agent.hp,
              maxHp: agent.maxHp,
              attack: agent.attack,
              defense: agent.defense,
              speed: agent.speed,
              ammo: agent.ammo,
              maxAmmo: agent.maxAmmo,
              position: { x: agent.position?.x ?? 0, y: agent.position?.y ?? 0 },
              isAlive: agent.isAlive,
              isDefending: agent.isDefending,
              hasShield: agent.hasShield,
              shieldTurns: agent.shieldTurns,
              damageBoostTurns: agent.damageBoostTurns,
              damageBoostMultiplier: agent.damageBoostMultiplier,
              damageDealt: agent.damageDealt,
              damageTaken: agent.damageTaken,
              kills: agent.kills,
              itemsReceived: agent.itemsReceived,
            });
          });
        }

        const actionLog: ActionLogEntry[] = [];
        if (state.actionLog) {
          state.actionLog.forEach((entry: any) => {
            actionLog.push({
              turn: entry.turn,
              agentId: entry.agentId,
              action: entry.action,
              targetId: entry.targetId,
              damage: entry.damage,
              description: entry.description,
              timestamp: entry.timestamp,
            });
          });
        }

        const turnOrder: string[] = [];
        if (state.turnOrder) {
          state.turnOrder.forEach((id: string) => turnOrder.push(id));
        }

        setGameState({
          matchId: state.matchId || '',
          phase: state.phase || 'lobby',
          turnNumber: state.turnNumber || 0,
          maxTurns: state.maxTurns || 100,
          currentAgentId: state.currentAgentId || '',
          turnDeadline: state.turnDeadline || 0,
          agents,
          turnOrder,
          actionLog,
          spectatorCount: state.spectatorCount || 0,
          totalBets: state.totalBets || 0,
          startTime: state.startTime || 0,
          winnerId: state.winnerId || '',
        });
      });

      room.onError((code: number, message?: string) => {
        setError(`Room error (${code}): ${message}`);
      });

      room.onLeave((code: number) => {
        setConnected(false);
        if (code !== 1000) {
          setError(`Disconnected unexpectedly (code: ${code})`);
        }
      });
    } catch (err) {
      setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
      setConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    roomRef.current?.leave();
    roomRef.current = null;
    clientRef.current = null;
    setConnected(false);
    setGameState(null);
  }, []);

  useEffect(() => {
    return () => {
      roomRef.current?.leave();
    };
  }, []);

  return {
    connected,
    gameState,
    error,
    connect,
    disconnect,
    room: roomRef.current,
  };
}
