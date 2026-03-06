import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

// ─── Agent Archetypes ────────────────────────────────────────────
export enum AgentArchetype {
  VANGUARD = "vanguard",   // Balanced fighter, good all-around
  SNIPER = "sniper",       // High damage, low HP, long range
  SUPPORT = "support",     // Healing abilities, moderate stats
  ASSASSIN = "assassin",   // High crit chance, stealth, fragile
  TANK = "tank",           // High HP, high defense, low damage
}

export enum ActionType {
  MOVE = "move",
  ATTACK = "attack",
  DEFEND = "defend",
  ABILITY = "ability",
  SKIP = "skip",
}

export enum MatchPhase {
  LOBBY = "lobby",
  ACTIVE = "active",
  PAUSED = "paused",
  ENDED = "ended",
}

// ─── Position Schema ─────────────────────────────────────────────
export class Position extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

// ─── Status Effect Schema ────────────────────────────────────────
export class StatusEffect extends Schema {
  @type("string") type: string = "";
  @type("number") turnsRemaining: number = 0;
  @type("number") magnitude: number = 0;
}

// ─── Agent Schema ────────────────────────────────────────────────
export class AgentState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") archetype: string = AgentArchetype.VANGUARD;
  @type("string") walletAddress: string = "";

  // Stats
  @type("number") hp: number = 100;
  @type("number") maxHp: number = 100;
  @type("number") attack: number = 10;
  @type("number") defense: number = 5;
  @type("number") speed: number = 5;
  @type("number") ammo: number = 30;
  @type("number") maxAmmo: number = 30;

  // Position on the arena grid (10x10)
  @type(Position) position: Position = new Position();

  // Combat state
  @type("boolean") isAlive: boolean = true;
  @type("boolean") isDefending: boolean = false;
  @type("boolean") hasShield: boolean = false;
  @type("number") shieldTurns: number = 0;
  @type("number") damageBoostTurns: number = 0;
  @type("number") damageBoostMultiplier: number = 1;

  // Stats tracking
  @type("number") damageDealt: number = 0;
  @type("number") damageTaken: number = 0;
  @type("number") kills: number = 0;
  @type("number") itemsReceived: number = 0;

  // Status effects
  @type([StatusEffect]) statusEffects = new ArraySchema<StatusEffect>();
}

// ─── Action Log Entry ────────────────────────────────────────────
export class ActionLogEntry extends Schema {
  @type("number") turn: number = 0;
  @type("string") agentId: string = "";
  @type("string") action: string = "";
  @type("string") targetId: string = "";
  @type("number") damage: number = 0;
  @type("string") description: string = "";
  @type("number") timestamp: number = 0;
}

// ─── Sponsorship Event ───────────────────────────────────────────
export class SponsorshipEvent extends Schema {
  @type("string") matchId: string = "";
  @type("string") agentId: string = "";
  @type("number") itemType: number = 0; // 0=health, 1=ammo, 2=shield, 3=damage
  @type("string") sponsor: string = "";
  @type("number") deliveryId: number = 0;
  @type("number") cost: number = 0;
  @type("boolean") delivered: boolean = false;
}

// ─── Main Arena State ────────────────────────────────────────────
export class ArenaState extends Schema {
  // Match info
  @type("string") matchId: string = "";
  @type("string") phase: string = MatchPhase.LOBBY;
  @type("number") turnNumber: number = 0;
  @type("number") maxTurns: number = 100;
  @type("string") currentAgentId: string = "";
  @type("number") turnDeadline: number = 0;

  // Agents (keyed by agent ID)
  @type({ map: AgentState }) agents = new MapSchema<AgentState>();

  // Turn order (agent IDs in order)
  @type(["string"]) turnOrder = new ArraySchema<string>();

  // Action log (last N actions for display)
  @type([ActionLogEntry]) actionLog = new ArraySchema<ActionLogEntry>();

  // Sponsorship events
  @type([SponsorshipEvent]) sponsorships = new ArraySchema<SponsorshipEvent>();

  // Match stats
  @type("number") spectatorCount: number = 0;
  @type("number") totalBets: number = 0;
  @type("number") startTime: number = 0;
  @type("string") winnerId: string = "";

  // Blockchain sync
  @type("string") bettingPoolAddress: string = "";
  @type("string") sponsorshipAddress: string = "";
  @type("string") matchTimerAddress: string = "";
  @type("number") lastBlockSynced: number = 0;
}

// ─── Agent Base Stats by Archetype ───────────────────────────────
export const ARCHETYPE_STATS: Record<string, {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  ammo: number;
}> = {
  [AgentArchetype.VANGUARD]: {
    hp: 100,
    attack: 12,
    defense: 8,
    speed: 6,
    ammo: 30,
  },
  [AgentArchetype.SNIPER]: {
    hp: 70,
    attack: 20,
    defense: 4,
    speed: 5,
    ammo: 15,
  },
  [AgentArchetype.SUPPORT]: {
    hp: 90,
    attack: 8,
    defense: 6,
    speed: 7,
    ammo: 25,
  },
  [AgentArchetype.ASSASSIN]: {
    hp: 65,
    attack: 18,
    defense: 3,
    speed: 10,
    ammo: 20,
  },
  [AgentArchetype.TANK]: {
    hp: 150,
    attack: 7,
    defense: 15,
    speed: 3,
    ammo: 20,
  },
};
