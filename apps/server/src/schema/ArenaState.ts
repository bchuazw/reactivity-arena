import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export enum ActionType {
  MOVE = "move",
  ATTACK = "attack",
  DEFEND = "defend",
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

export const UNIFORM_AGENT_STATS = {
  hp: 100,
  attack: 12,
  defense: 8,
  speed: 5,
  ammo: 20,
  attackRange: 2,
  actionsPerTurn: 2,
  description: "Uniform arena combatant with move, attack, defend, and item usage.",
} as const;

export class Position extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

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

export class AgentState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") walletAddress: string = "";

  @type("number") hp: number = UNIFORM_AGENT_STATS.hp;
  @type("number") maxHp: number = UNIFORM_AGENT_STATS.hp;
  @type("number") attack: number = UNIFORM_AGENT_STATS.attack;
  @type("number") defense: number = UNIFORM_AGENT_STATS.defense;
  @type("number") speed: number = UNIFORM_AGENT_STATS.speed;
  @type("number") ammo: number = UNIFORM_AGENT_STATS.ammo;
  @type("number") maxAmmo: number = UNIFORM_AGENT_STATS.ammo;
  @type("number") attackRange: number = UNIFORM_AGENT_STATS.attackRange;
  @type("number") bonusRange: number = 0;
  @type("number") actionsPerTurn: number = UNIFORM_AGENT_STATS.actionsPerTurn;
  @type("number") temporaryHp: number = 0;

  @type(Position) position: Position = new Position();

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

  @type("number") damageDealt: number = 0;
  @type("number") damageTaken: number = 0;
  @type("number") kills: number = 0;
  @type("number") itemsReceived: number = 0;

  @type([StatusEffect]) statusEffects = new ArraySchema<StatusEffect>();
  @type([InventoryItem]) inventory = new ArraySchema<InventoryItem>();
}

export class ActionLogEntry extends Schema {
  @type("number") turn: number = 0;
  @type("string") agentId: string = "";
  @type("string") action: string = "";
  @type("string") targetId: string = "";
  @type("number") damage: number = 0;
  @type("string") description: string = "";
  @type("number") timestamp: number = 0;
}

export class SponsorshipEvent extends Schema {
  @type("string") matchId: string = "";
  @type("string") agentId: string = "";
  @type("number") itemType: number = 0;
  @type("string") sponsor: string = "";
  @type("number") deliveryId: number = 0;
  @type("number") cost: number = 0;
  @type("boolean") delivered: boolean = false;
}

export class ArenaState extends Schema {
  @type("string") matchId: string = "";
  @type("string") phase: string = MatchPhase.LOBBY;
  @type("number") turnNumber: number = 0;
  @type("number") maxTurns: number = 100;
  @type("string") currentAgentId: string = "";
  @type("number") turnDeadline: number = 0;
  @type("number") width: number = 10;
  @type("number") height: number = 10;
  @type("string") mapTheme: string = MapTheme.CYBER_RUINS;

  @type({ map: AgentState }) agents = new MapSchema<AgentState>();
  @type([TileState]) tiles = new ArraySchema<TileState>();
  @type([DestructibleState]) destructibles = new ArraySchema<DestructibleState>();
  @type([ChestState]) chests = new ArraySchema<ChestState>();
  @type(["string"]) turnOrder = new ArraySchema<string>();
  @type([ActionLogEntry]) actionLog = new ArraySchema<ActionLogEntry>();
  @type([SponsorshipEvent]) sponsorships = new ArraySchema<SponsorshipEvent>();

  @type("number") spectatorCount: number = 0;
  @type("number") totalBets: number = 0;
  @type("number") startTime: number = 0;
  @type("string") winnerId: string = "";

  @type("string") bettingPoolAddress: string = "";
  @type("string") sponsorshipAddress: string = "";
  @type("string") matchTimerAddress: string = "";
  @type("number") lastBlockSynced: number = 0;
}

export const CHEST_ITEM_LABELS: Record<string, string> = {
  [ChestItemType.MEDKIT]: "Medkit",
  [ChestItemType.AMMO_CRATE]: "Ammo Crate",
  [ChestItemType.SHIELD_BATTERY]: "Shield Battery",
  [ChestItemType.GRENADE]: "Grenade",
  [ChestItemType.SPEED_BOOST]: "Speed Boost",
  [ChestItemType.RECON_DRONE]: "Recon Drone",
  [ChestItemType.ADRENALINE]: "Adrenaline",
};
