import { useMemo } from 'react';
import type { AgentData, ChestData, DestructibleData, TileData } from './useGameServer';

export interface TacticalTile extends TileData {
  heightTier: 0 | 1 | 2 | 3;
  structureType?: 'ground' | 'road' | 'ruin' | 'roof' | 'watchtower' | 'ramp' | 'stairs' | 'crater';
  interactive?: 'door' | 'ladder' | 'zipline' | 'supply';
  walkable: boolean;
  visible?: boolean;
  explored?: boolean;
}

export interface TacticalAgent extends AgentData {
  sightRange: number;
  ap: number;
  maxAp: number;
  overwatch: boolean;
  roleKey: 'leader' | 'heavy' | 'scout' | 'medic' | 'demo';
  plannedAction?: 'move' | 'shoot' | 'item' | 'overwatch' | 'idle';
  visibleEnemies?: string[];
}

export interface FogCell {
  x: number;
  y: number;
  visible: boolean;
  explored: boolean;
  blocked: boolean;
}

export interface TacticalGameState {
  width: number;
  height: number;
  tiles: TacticalTile[];
  agents: Map<string, TacticalAgent>;
  currentAgentId: string;
  phase: string;
  destructibles: DestructibleData[];
  chests: ChestData[];
  fog: FogCell[];
  weather: 'clear' | 'dust';
  mapTheme: string;
}

const WIDTH = 50;
const HEIGHT = 50;

const AGENT_BLUEPRINTS: Array<{
  id: string;
  name: string;
  roleKey: TacticalAgent['roleKey'];
  position: { x: number; y: number };
  colorStats: Partial<TacticalAgent>;
}> = [
  { id: 'agent-1', name: 'Mara', roleKey: 'leader', position: { x: 8, y: 38 }, colorStats: { attack: 24, defense: 14, speed: 6, attackRange: 8, sightRange: 10, hp: 110, maxHp: 110, ammo: 6, maxAmmo: 6 } },
  { id: 'agent-2', name: 'Brutus', roleKey: 'heavy', position: { x: 11, y: 35 }, colorStats: { attack: 34, defense: 18, speed: 4, attackRange: 7, sightRange: 8, hp: 150, maxHp: 150, ammo: 4, maxAmmo: 4 } },
  { id: 'agent-3', name: 'Shade', roleKey: 'scout', position: { x: 15, y: 40 }, colorStats: { attack: 28, defense: 10, speed: 8, attackRange: 14, sightRange: 13, hp: 84, maxHp: 84, ammo: 5, maxAmmo: 5 } },
  { id: 'agent-4', name: 'Halo', roleKey: 'medic', position: { x: 6, y: 33 }, colorStats: { attack: 18, defense: 12, speed: 6, attackRange: 7, sightRange: 9, hp: 92, maxHp: 92, ammo: 6, maxAmmo: 6 } },
  { id: 'agent-5', name: 'Fuse', roleKey: 'demo', position: { x: 13, y: 31 }, colorStats: { attack: 30, defense: 11, speed: 5, attackRange: 9, sightRange: 9, hp: 98, maxHp: 98, ammo: 5, maxAmmo: 5 } },
];

function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
}

function createTile(x: number, y: number): TacticalTile {
  const roadBand = Math.abs(y - 25) <= 2 || Math.abs(x - 24) <= 1;
  const plaza = x > 18 && x < 31 && y > 18 && y < 31;
  const westRuin = x > 4 && x < 17 && y > 8 && y < 20;
  const eastRuin = x > 32 && x < 46 && y > 9 && y < 22;
  const southComplex = x > 8 && x < 25 && y > 31 && y < 46;
  const northRoof = x > 20 && x < 33 && y > 4 && y < 13;
  const craterField = x > 28 && x < 45 && y > 28 && y < 46;
  const watchtower = (x > 39 && x < 44 && y > 4 && y < 10) || (x > 4 && x < 9 && y > 41 && y < 46);
  const rampLine = (x >= 16 && x <= 20 && y >= 35 && y <= 39) || (x >= 28 && x <= 31 && y >= 10 && y <= 14);
  const stairLine = (x === 23 && y >= 10 && y <= 14) || (y === 36 && x >= 20 && x <= 24);

  let terrain = 'ground';
  let structureType: TacticalTile['structureType'] = 'ground';
  let heightTier: TacticalTile['heightTier'] = 0;
  let blocksMovement = false;
  let providesCover = false;
  let concealment = false;
  let vulnerable = false;
  let healing = false;
  let interactive: TacticalTile['interactive'];

  if (roadBand || plaza) {
    terrain = 'road';
    structureType = 'road';
  }
  if (westRuin || eastRuin || southComplex) {
    terrain = 'cover';
    structureType = 'ruin';
    heightTier = southComplex ? 2 : 1;
    providesCover = true;
  }
  if (northRoof) {
    terrain = 'elevation';
    structureType = 'roof';
    heightTier = 3;
    providesCover = true;
  }
  if (watchtower) {
    terrain = 'elevation';
    structureType = 'watchtower';
    heightTier = 3;
    providesCover = true;
  }
  if (craterField && (x + y) % 3 === 0) {
    terrain = 'mud';
    structureType = 'crater';
    vulnerable = true;
  }
  if (rampLine) {
    terrain = 'bridge';
    structureType = 'ramp';
    heightTier = x + y > 50 ? 2 : 1;
  }
  if (stairLine) {
    terrain = 'bridge';
    structureType = 'stairs';
    heightTier = y > 20 ? 2 : 3;
  }

  if ((x > 2 && x < 9 && y > 22 && y < 29) || (x > 35 && x < 43 && y > 23 && y < 29)) {
    terrain = 'bush';
    concealment = true;
  }

  if ((x === 10 && y === 39) || (x === 38 && y === 11)) {
    terrain = 'healing';
    healing = true;
    interactive = 'supply';
  }

  if ((x === 15 && y === 36) || (x === 30 && y === 12)) {
    interactive = 'ladder';
  }

  if ((x === 12 && y === 33) || (x === 36 && y === 15)) {
    interactive = 'door';
  }

  if ((x === 19 && y === 38) || (x === 29 && y === 9)) {
    interactive = 'zipline';
  }

  if ((westRuin || eastRuin || southComplex || northRoof) && (x + y) % 5 === 0) {
    blocksMovement = true;
  }

  return {
    position: { x, y },
    terrain,
    theme: 'warzone_outskirts',
    elevation: heightTier,
    heightTier,
    blocksMovement,
    providesCover,
    concealment,
    movementCost: terrain === 'mud' ? 2 : heightTier >= 2 ? 2 : 1,
    vulnerable,
    healing,
    chokepoint: roadBand || structureType === 'ramp' || structureType === 'stairs',
    structureType,
    interactive,
    walkable: !blocksMovement,
  };
}

function lineOfSight(ax: number, ay: number, bx: number, by: number, blocked: Set<string>) {
  const dx = bx - ax;
  const dy = by - ay;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 1; i < steps; i += 1) {
    const x = Math.round(ax + (dx * i) / steps);
    const y = Math.round(ay + (dy * i) / steps);
    if (blocked.has(`${x},${y}`)) return false;
  }
  return true;
}

function buildAgents(): Map<string, TacticalAgent> {
  return new Map(
    AGENT_BLUEPRINTS.map((blueprint, index) => [
      blueprint.id,
      {
        id: blueprint.id,
        name: blueprint.name,
        walletAddress: '0x0000000000000000000000000000000000000000',
        hp: 100,
        maxHp: 100,
        attack: 20,
        defense: 10,
        speed: 5,
        ammo: 6,
        maxAmmo: 6,
        attackRange: 8,
        bonusRange: 0,
        actionsPerTurn: 2,
        temporaryHp: index === 3 ? 10 : 0,
        position: blueprint.position,
        isAlive: true,
        isDefending: blueprint.roleKey === 'heavy',
        hasShield: blueprint.roleKey === 'medic',
        shieldTurns: blueprint.roleKey === 'medic' ? 1 : 0,
        damageBoostTurns: blueprint.roleKey === 'leader' ? 1 : 0,
        damageBoostMultiplier: blueprint.roleKey === 'leader' ? 1.25 : 1,
        speedBoostTurns: blueprint.roleKey === 'scout' ? 1 : 0,
        revealTurns: blueprint.roleKey === 'scout' ? 1 : 0,
        smokeTurns: blueprint.roleKey === 'demo' ? 1 : 0,
        disabledTurns: 0,
        damageDealt: 0,
        damageTaken: 0,
        kills: 0,
        itemsReceived: blueprint.roleKey === 'medic' ? 1 : 0,
        inventory: [],
        statusEffects: [],
        sightRange: 9,
        ap: 2,
        maxAp: 2,
        overwatch: blueprint.roleKey === 'scout',
        roleKey: blueprint.roleKey,
        plannedAction: blueprint.roleKey === 'heavy' ? 'overwatch' : blueprint.roleKey === 'demo' ? 'item' : 'move',
        visibleEnemies: [],
        ...blueprint.colorStats,
      } satisfies TacticalAgent,
    ])
  );
}

function buildDestructibles(): DestructibleData[] {
  const props: DestructibleData[] = [];
  const entries = [
    ['barrel-1', 'barrel', 21, 26, true, 2, 22],
    ['barrel-2', 'barrel', 33, 24, true, 2, 22],
    ['crate-1', 'crate', 14, 37, false, 0, 0],
    ['crate-2', 'crate', 39, 14, false, 0, 0],
    ['barrier-1', 'barrier', 17, 24, false, 0, 0],
    ['barrier-2', 'barrier', 28, 24, false, 0, 0],
    ['truck-husk', 'vehicle', 9, 26, false, 0, 0],
    ['tank-husk', 'vehicle', 34, 25, false, 0, 0],
    ['barbed-1', 'wire', 24, 18, false, 0, 0],
    ['barbed-2', 'wire', 24, 31, false, 0, 0],
  ] as const;

  for (const [id, type, x, y, explosive, blastRadius, damage] of entries) {
    props.push({
      id,
      type,
      position: { x, y },
      hp: type === 'vehicle' ? 50 : type === 'wire' ? 12 : 24,
      maxHp: type === 'vehicle' ? 50 : type === 'wire' ? 12 : 24,
      blocksMovement: type !== 'barrier',
      providesCover: type !== 'barrel' && type !== 'wire',
      explosive,
      blastRadius,
      damage,
    });
  }

  return props;
}

function buildChests(): ChestData[] {
  return [
    { id: 'supply-1', position: { x: 10, y: 39 }, opened: false, itemType: 'medkit', autoEquip: true },
    { id: 'supply-2', position: { x: 38, y: 11 }, opened: false, itemType: 'targeting_chip', autoEquip: true },
    { id: 'supply-3', position: { x: 25, y: 25 }, opened: false, itemType: 'ammo_crate', autoEquip: true },
  ];
}

export function useGameState() {
  return useMemo<TacticalGameState>(() => {
    const tiles = Array.from({ length: WIDTH * HEIGHT }, (_, i) => createTile(i % WIDTH, Math.floor(i / WIDTH)));
    const agents = buildAgents();
    const destructibles = buildDestructibles();
    const chests = buildChests();

    const blocked = new Set<string>();
    for (const tile of tiles) {
      if (tile.blocksMovement || tile.structureType === 'watchtower' || tile.structureType === 'roof') {
        blocked.add(`${tile.position.x},${tile.position.y}`);
      }
    }
    for (const prop of destructibles) {
      if (prop.hp > 0 && (prop.blocksMovement || prop.providesCover)) {
        blocked.add(`${prop.position.x},${prop.position.y}`);
      }
    }

    const fog = tiles.map<FogCell>((tile) => ({
      x: tile.position.x,
      y: tile.position.y,
      visible: false,
      explored: false,
      blocked: blocked.has(`${tile.position.x},${tile.position.y}`),
    }));

    const fogLookup = new Map(fog.map((cell) => [`${cell.x},${cell.y}`, cell]));

    for (const agent of agents.values()) {
      for (let dx = -agent.sightRange; dx <= agent.sightRange; dx += 1) {
        for (let dy = -agent.sightRange; dy <= agent.sightRange; dy += 1) {
          const tx = agent.position.x + dx;
          const ty = agent.position.y + dy;
          if (!inBounds(tx, ty)) continue;
          const distance = Math.hypot(dx, dy);
          if (distance > agent.sightRange) continue;
          if (!lineOfSight(agent.position.x, agent.position.y, tx, ty, blocked)) continue;
          const cell = fogLookup.get(`${tx},${ty}`);
          if (cell) {
            cell.visible = true;
            cell.explored = true;
          }
        }
      }
    }

    const playerIds = new Set(Array.from(agents.keys()));
    for (const agent of agents.values()) {
      const visibleEnemies: string[] = [];
      for (const other of agents.values()) {
        if (other.id === agent.id || !playerIds.has(other.id)) continue;
        const cell = fogLookup.get(`${other.position.x},${other.position.y}`);
        if (cell?.visible) visibleEnemies.push(other.id);
      }
      agent.visibleEnemies = visibleEnemies;
    }

    for (const tile of tiles) {
      const cell = fogLookup.get(`${tile.position.x},${tile.position.y}`);
      tile.visible = Boolean(cell?.visible);
      tile.explored = Boolean(cell?.explored);
    }

    return {
      width: WIDTH,
      height: HEIGHT,
      tiles,
      agents,
      currentAgentId: 'agent-1',
      phase: 'active',
      destructibles,
      chests,
      fog,
      weather: 'dust',
      mapTheme: 'warzone_outskirts',
    };
  }, []);
}
