import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

// ─── Agent Archetypes ────────────────────────────────────────────
export enum AgentArchetype {
  VANGUARD = "vanguard",
  RANGER = "ranger",
  MEDIC = "medic",
  SABOTEUR = "saboteur",
  TITAN = "titan",
}

export enum ActionType {
  MOVE = "move",
  ATTACK = "attack",
  DEFEND = "defend",
  ABILITY = "ability",
  SKIP = "skip",
  OPEN_CHEST = "open_chest",
  USE_ITEM = "use_item",
}

export enum MatchPhase {
  LOBBY = "lobby",
  ACTIVE = "active",
  PAUSED = "paused",
  ENDED = "ended",
}

export enum TerrainType {
  GROUND = "ground",
  ROAD = "road",
  COVER = "cover",
  ELEVATION = "elevation",
  WATER = "water",
  MUD = "mud",
  BUSH = "bush",
  BRIDGE = "bridge",
  HEALING = "healing",
  SPAWN = "spawn",
}

export enum PropType {
  BARREL = "barrel",
  CRATE = "crate",
  BARRIER = "barrier",
}

export enum ChestItemType {
  MEDKIT = "medkit",
  AMMO_CRATE = "ammo_crate",
  SHIELD_BATTERY = "shield_battery",
  GRENADE = "grenade",
  SPEED_BOOST = "speed_boost",
  RECON_DRONE = "recon_drone",
  ADRENALINE = "adrenaline",
}

export enum MapTheme {
  CYBER_RUINS = "cyber_ruins",
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

export class InventoryItem extends Schema {
  @type("string") type: string = ChestItemType.MEDKIT;
  @type("boolean") consumed: boolean = false;
}

export class TileState extends Schema {
  @type(Position) position: Position = new Position();
  @type("string") terrain: string = TerrainType.GROUND;
  @type("string") theme: string = MapTheme.CYBER_RUINS;
  @type("number") elevation: number = 0;
  @type("boolean") blocksMovement: boolean = false;
  @type("boolean") providesCover: boolean = false;
  @type("boolean") concealment: boolean = false;
  @type("number") movementCost: number = 1;
  @type("boolean") vulnerable: boolean = false;
  @type("boolean") healing: boolean = false;
  @type("boolean") chokepoint: boolean = false;
}

export class DestructibleState extends Schema {
  @type("string") id: string = "";
  @type("string") type: string = PropType.BARREL;
  @type(Position) position: Position = new Position();
  @type("number") hp: number = 0;
  @type("number") maxHp: number = 0;
  @type("boolean") blocksMovement: boolean = true;
  @type("boolean") providesCover: boolean = true;
  @type("boolean") explosive: boolean = false;
  @type("number") blastRadius: number = 0;
  @type("number") damage: number = 0;
}

export class ChestState extends Schema {
  @type("string") id: string = "";
  @type(Position) position: Position = new Position();
  @type("boolean") opened: boolean = false;
  @type("string") itemType: string = ChestItemType.MEDKIT;
  @type("boolean") autoEquip: boolean = true;
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
  @type("number") attackRange: number = 3;
  @type("number") bonusRange: number = 0;
  @type("number") actionsPerTurn: number = 2;
  @type("number") temporaryHp: number = 0;

  // Position on the arena grid
  @type(Position) position: Position = new Position();

  // Combat state
  @type("boolean") isAlive: boolean = true;
  @type("boolean") isDefending: boolean = false;
  @type("boolean") hasShield: boolean = false;
  @type("number") shieldTurns: number = 0;
  @type("number") damageBoostTurns: number = 0;
  @type("number") damageBoostMultiplier: number = 1;
  @type("number") speedBoostTurns: number = 0;
  @type("number") revealTurns: number = 0;
  @type("number") smokeTurns: number = 0;
  @type("number") disabledTurns: number = 0;
  @type("boolean") reviveAvailable: boolean = true;
  @type("boolean") barrierAvailable: boolean = true;
  @type("number") barrierCooldown: number = 0;
  @type("number") inspireTurns: number = 0;
  @type("number") protectedByTitanTurns: number = 0;

  // Stats tracking
  @type("number") damageDealt: number = 0;
  @type("number") damageTaken: number = 0;
  @type("number") kills: number = 0;
  @type("number") itemsReceived: number = 0;

  // Status effects & inventory
  @type([StatusEffect]) statusEffects = new ArraySchema<StatusEffect>();
  @type([InventoryItem]) inventory = new ArraySchema<InventoryItem>();
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
  @type("number") itemType: number = 0;
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
  @type("number") width: number = 10;
  @type("number") height: number = 10;
  @type("string") mapTheme: string = MapTheme.CYBER_RUINS;

  // Arena state
  @type({ map: AgentState }) agents = new MapSchema<AgentState>();
  @type([TileState]) tiles = new ArraySchema<TileState>();
  @type([DestructibleState]) destructibles = new ArraySchema<DestructibleState>();
  @type([ChestState]) chests = new ArraySchema<ChestState>();

  // Turn order
  @type(["string"]) turnOrder = new ArraySchema<string>();

  // Action log
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
  attackRange: number;
  description: string;
}> = {
  [AgentArchetype.VANGUARD]: {
    hp: 120,
    attack: 14,
    defense: 8,
    speed: 5,
    ammo: 20,
    attackRange: 2,
    description: "Balanced frontline bruiser with charge and inspire.",
  },
  [AgentArchetype.RANGER]: {
    hp: 82,
    attack: 16,
    defense: 4,
    speed: 4,
    ammo: 14,
    attackRange: 5,
    description: "Long-range specialist with piercing shots and elevation scaling.",
  },
  [AgentArchetype.MEDIC]: {
    hp: 96,
    attack: 9,
    defense: 6,
    speed: 5,
    ammo: 18,
    attackRange: 3,
    description: "Field healer with smoke cover and clutch revive.",
  },
  [AgentArchetype.SABOTEUR]: {
    hp: 88,
    attack: 15,
    defense: 5,
    speed: 7,
    ammo: 18,
    attackRange: 2,
    description: "Mobile disruptor with teleport, EMP, and cover-breaking tools.",
  },
  [AgentArchetype.TITAN]: {
    hp: 150,
    attack: 11,
    defense: 10,
    speed: 3,
    ammo: 16,
    attackRange: 2,
    description: "Heavy anchor that shields allies and deploys temporary cover.",
  },
};

export const CHEST_ITEM_LABELS: Record<string, string> = {
  [ChestItemType.MEDKIT]: "Medkit",
  [ChestItemType.AMMO_CRATE]: "Ammo Crate",
  [ChestItemType.SHIELD_BATTERY]: "Shield Battery",
  [ChestItemType.GRENADE]: "Grenade",
  [ChestItemType.SPEED_BOOST]: "Speed Boost",
  [ChestItemType.RECON_DRONE]: "Recon Drone",
  [ChestItemType.ADRENALINE]: "Adrenaline",
};
