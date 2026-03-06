import { useState, useEffect, useCallback, useRef } from 'react';
import { Client, Room } from 'colyseus.js';

export interface StatusEffectData {
  type: string;
  turnsRemaining: number;
  magnitude: number;
}

export interface InventoryItemData {
  type: string;
  consumed: boolean;
}

export interface TileData {
  position: { x: number; y: number };
  terrain: string;
  theme: string;
  elevation: number;
  blocksMovement: boolean;
  providesCover: boolean;
  concealment: boolean;
  movementCost: number;
  vulnerable: boolean;
  healing: boolean;
  chokepoint: boolean;
}

export interface DestructibleData {
  id: string;
  type: string;
  position: { x: number; y: number };
  hp: number;
  maxHp: number;
  blocksMovement: boolean;
  providesCover: boolean;
  explosive: boolean;
  blastRadius: number;
  damage: number;
}

export interface ChestData {
  id: string;
  position: { x: number; y: number };
  opened: boolean;
  itemType: string;
  autoEquip: boolean;
}

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
  attackRange: number;
  bonusRange: number;
  actionsPerTurn: number;
  temporaryHp: number;
  position: { x: number; y: number };
  isAlive: boolean;
  isDefending: boolean;
  hasShield: boolean;
  shieldTurns: number;
  damageBoostTurns: number;
  damageBoostMultiplier: number;
  speedBoostTurns: number;
  revealTurns: number;
  smokeTurns: number;
  disabledTurns: number;
  reviveAvailable: boolean;
  barrierAvailable: boolean;
  barrierCooldown: number;
  inspireTurns: number;
  protectedByTitanTurns: number;
  damageDealt: number;
  damageTaken: number;
  kills: number;
  itemsReceived: number;
  inventory: InventoryItemData[];
  statusEffects: StatusEffectData[];
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
  width: number;
  height: number;
  mapTheme: string;
  agents: Map<string, AgentData>;
  tiles: TileData[];
  destructibles: DestructibleData[];
  chests: ChestData[];
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
              attackRange: agent.attackRange,
              bonusRange: agent.bonusRange,
              actionsPerTurn: agent.actionsPerTurn,
              temporaryHp: agent.temporaryHp,
              position: { x: agent.position?.x ?? 0, y: agent.position?.y ?? 0 },
              isAlive: agent.isAlive,
              isDefending: agent.isDefending,
              hasShield: agent.hasShield,
              shieldTurns: agent.shieldTurns,
              damageBoostTurns: agent.damageBoostTurns,
              damageBoostMultiplier: agent.damageBoostMultiplier,
              speedBoostTurns: agent.speedBoostTurns,
              revealTurns: agent.revealTurns,
              smokeTurns: agent.smokeTurns,
              disabledTurns: agent.disabledTurns,
              reviveAvailable: agent.reviveAvailable,
              barrierAvailable: agent.barrierAvailable,
              barrierCooldown: agent.barrierCooldown,
              inspireTurns: agent.inspireTurns,
              protectedByTitanTurns: agent.protectedByTitanTurns,
              damageDealt: agent.damageDealt,
              damageTaken: agent.damageTaken,
              kills: agent.kills,
              itemsReceived: agent.itemsReceived,
              inventory: agent.inventory ? Array.from(agent.inventory).map((item: any) => ({ type: item.type, consumed: item.consumed })) : [],
              statusEffects: agent.statusEffects ? Array.from(agent.statusEffects).map((effect: any) => ({ type: effect.type, turnsRemaining: effect.turnsRemaining, magnitude: effect.magnitude })) : [],
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

        const tiles: TileData[] = state.tiles
          ? Array.from(state.tiles).map((tile: any) => ({
              position: { x: tile.position?.x ?? 0, y: tile.position?.y ?? 0 },
              terrain: tile.terrain,
              theme: tile.theme,
              elevation: tile.elevation,
              blocksMovement: tile.blocksMovement,
              providesCover: tile.providesCover,
              concealment: tile.concealment,
              movementCost: tile.movementCost,
              vulnerable: tile.vulnerable,
              healing: tile.healing,
              chokepoint: tile.chokepoint,
            }))
          : [];

        const destructibles: DestructibleData[] = state.destructibles
          ? Array.from(state.destructibles).map((prop: any) => ({
              id: prop.id,
              type: prop.type,
              position: { x: prop.position?.x ?? 0, y: prop.position?.y ?? 0 },
              hp: prop.hp,
              maxHp: prop.maxHp,
              blocksMovement: prop.blocksMovement,
              providesCover: prop.providesCover,
              explosive: prop.explosive,
              blastRadius: prop.blastRadius,
              damage: prop.damage,
            }))
          : [];

        const chests: ChestData[] = state.chests
          ? Array.from(state.chests).map((chest: any) => ({
              id: chest.id,
              position: { x: chest.position?.x ?? 0, y: chest.position?.y ?? 0 },
              opened: chest.opened,
              itemType: chest.itemType,
              autoEquip: chest.autoEquip,
            }))
          : [];

        setGameState({
          matchId: state.matchId || '',
          phase: state.phase || 'lobby',
          turnNumber: state.turnNumber || 0,
          maxTurns: state.maxTurns || 100,
          currentAgentId: state.currentAgentId || '',
          turnDeadline: state.turnDeadline || 0,
          width: state.width || 10,
          height: state.height || 10,
          mapTheme: state.mapTheme || 'cyber_ruins',
          agents,
          tiles,
          destructibles,
          chests,
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
