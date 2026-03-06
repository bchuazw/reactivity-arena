import {
  ChestItemType,
  ChestState,
  DestructibleState,
  MapTheme,
  Position,
  PropType,
  TerrainType,
  TileState,
} from "../schema/ArenaState";

export interface GeneratedArenaMap {
  width: number;
  height: number;
  theme: MapTheme;
  spawnPoints: Array<{ x: number; y: number }>;
  tiles: TileState[];
  destructibles: DestructibleState[];
  chests: ChestState[];
}

const CHEST_ITEMS = [
  ChestItemType.MEDKIT,
  ChestItemType.AMMO_CRATE,
  ChestItemType.SHIELD_BATTERY,
  ChestItemType.GRENADE,
  ChestItemType.SPEED_BOOST,
  ChestItemType.RECON_DRONE,
  ChestItemType.ADRENALINE,
];

export class MapGenerator {
  constructor(private readonly width: number = 10, private readonly height: number = 10) {}

  generate(): GeneratedArenaMap {
    const theme = MapTheme.CYBER_RUINS;
    const tiles = this.createBaseTiles(theme);
    const spawnPoints = this.getSpawnPoints();

    // Elevated rooftops / catwalks
    this.applyRect(tiles, 1, 1, 2, 2, { terrain: TerrainType.ELEVATION, elevation: 2 });
    this.applyRect(tiles, 7, 1, 2, 2, { terrain: TerrainType.ELEVATION, elevation: 2 });
    this.applyRect(tiles, 4, 6, 2, 2, { terrain: TerrainType.ELEVATION, elevation: 1 });

    // River + bridges for chokepoints
    for (let y = 0; y < this.height; y++) {
      this.mutateTile(tiles, 4, y, { terrain: TerrainType.WATER, movementCost: 2, vulnerable: true });
      this.mutateTile(tiles, 5, y, { terrain: TerrainType.WATER, movementCost: 2, vulnerable: true });
    }
    this.mutateTile(tiles, 4, 2, { terrain: TerrainType.BRIDGE, movementCost: 1, chokepoint: true, vulnerable: false });
    this.mutateTile(tiles, 5, 2, { terrain: TerrainType.BRIDGE, movementCost: 1, chokepoint: true, vulnerable: false });
    this.mutateTile(tiles, 4, 7, { terrain: TerrainType.BRIDGE, movementCost: 1, chokepoint: true, vulnerable: false });
    this.mutateTile(tiles, 5, 7, { terrain: TerrainType.BRIDGE, movementCost: 1, chokepoint: true, vulnerable: false });

    // Mud pocket around the river bank
    this.mutateTile(tiles, 3, 4, { terrain: TerrainType.MUD, movementCost: 2, vulnerable: true });
    this.mutateTile(tiles, 3, 5, { terrain: TerrainType.MUD, movementCost: 2, vulnerable: true });
    this.mutateTile(tiles, 6, 4, { terrain: TerrainType.MUD, movementCost: 2, vulnerable: true });
    this.mutateTile(tiles, 6, 5, { terrain: TerrainType.MUD, movementCost: 2, vulnerable: true });

    // Bush lanes for concealment
    this.mutateTile(tiles, 2, 4, { terrain: TerrainType.BUSH, concealment: true });
    this.mutateTile(tiles, 2, 5, { terrain: TerrainType.BUSH, concealment: true });
    this.mutateTile(tiles, 7, 4, { terrain: TerrainType.BUSH, concealment: true });
    this.mutateTile(tiles, 7, 5, { terrain: TerrainType.BUSH, concealment: true });
    this.mutateTile(tiles, 5, 4, { terrain: TerrainType.BUSH, concealment: true });

    // Med stations
    this.mutateTile(tiles, 0, 5, { terrain: TerrainType.HEALING, healing: true, movementCost: 1 });
    this.mutateTile(tiles, 9, 4, { terrain: TerrainType.HEALING, healing: true, movementCost: 1 });

    // Cover pockets/buildings
    this.applyRect(tiles, 2, 7, 2, 2, {
      terrain: TerrainType.COVER,
      providesCover: true,
      blocksMovement: false,
      movementCost: 1,
    });
    this.applyRect(tiles, 6, 2, 2, 2, {
      terrain: TerrainType.COVER,
      providesCover: true,
      blocksMovement: false,
      movementCost: 1,
    });

    spawnPoints.forEach((point) => {
      this.mutateTile(tiles, point.x, point.y, {
        terrain: TerrainType.SPAWN,
        movementCost: 1,
      });
    });

    const destructibles = this.createDestructibles();
    const chests = this.createChests(spawnPoints, destructibles);

    return {
      width: this.width,
      height: this.height,
      theme,
      spawnPoints,
      tiles,
      destructibles,
      chests,
    };
  }

  private createBaseTiles(theme: MapTheme): TileState[] {
    const tiles: TileState[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = new TileState();
        tile.position = this.makePosition(x, y);
        tile.terrain = TerrainType.ROAD;
        tile.theme = theme;
        tile.elevation = 0;
        tile.blocksMovement = false;
        tile.providesCover = false;
        tile.concealment = false;
        tile.movementCost = 1;
        tile.vulnerable = false;
        tile.healing = false;
        tile.chokepoint = false;
        tiles.push(tile);
      }
    }
    return tiles;
  }

  private createDestructibles(): DestructibleState[] {
    const defs = [
      { id: "barrel-1", type: PropType.BARREL, x: 3, y: 2, hp: 18, explosive: true, blastRadius: 1, damage: 16 },
      { id: "barrel-2", type: PropType.BARREL, x: 6, y: 7, hp: 18, explosive: true, blastRadius: 1, damage: 16 },
      { id: "crate-1", type: PropType.CRATE, x: 2, y: 3, hp: 20, explosive: false, blastRadius: 0, damage: 0 },
      { id: "crate-2", type: PropType.CRATE, x: 7, y: 6, hp: 20, explosive: false, blastRadius: 0, damage: 0 },
      { id: "barrier-1", type: PropType.BARRIER, x: 1, y: 4, hp: 24, explosive: false, blastRadius: 0, damage: 0 },
      { id: "barrier-2", type: PropType.BARRIER, x: 8, y: 5, hp: 24, explosive: false, blastRadius: 0, damage: 0 },
    ];

    return defs.map((def) => {
      const item = new DestructibleState();
      item.id = def.id;
      item.type = def.type;
      item.position = this.makePosition(def.x, def.y);
      item.hp = def.hp;
      item.maxHp = def.hp;
      item.blocksMovement = true;
      item.providesCover = true;
      item.explosive = def.explosive;
      item.blastRadius = def.blastRadius;
      item.damage = def.damage;
      return item;
    });
  }

  private createChests(
    spawnPoints: Array<{ x: number; y: number }>,
    destructibles: DestructibleState[]
  ): ChestState[] {
    const blocked = new Set<string>([
      ...spawnPoints.map((point) => `${point.x},${point.y}`),
      ...destructibles.map((prop) => `${prop.position.x},${prop.position.y}`),
    ]);

    const preferredSpots = [
      { x: 1, y: 5 },
      { x: 8, y: 4 },
      { x: 3, y: 8 },
      { x: 6, y: 1 },
      { x: 5, y: 5 },
      { x: 4, y: 7 },
    ].filter((spot) => !blocked.has(`${spot.x},${spot.y}`));

    const count = 3 + Math.floor(Math.random() * 3);
    const chests: ChestState[] = [];
    const used = new Set<string>();

    for (let i = 0; i < count; i++) {
      const spot = preferredSpots[i % preferredSpots.length];
      if (!spot || used.has(`${spot.x},${spot.y}`)) continue;
      used.add(`${spot.x},${spot.y}`);

      const chest = new ChestState();
      chest.id = `chest-${i + 1}`;
      chest.position = this.makePosition(spot.x, spot.y);
      chest.opened = false;
      chest.autoEquip = true;
      chest.itemType = CHEST_ITEMS[Math.floor(Math.random() * CHEST_ITEMS.length)];
      chests.push(chest);
    }

    return chests;
  }

  private getSpawnPoints() {
    return [
      { x: 0, y: 0 },
      { x: 9, y: 0 },
      { x: 0, y: 9 },
      { x: 9, y: 9 },
      { x: 2, y: 9 },
    ];
  }

  private applyRect(
    tiles: TileState[],
    startX: number,
    startY: number,
    width: number,
    height: number,
    patch: Partial<Pick<TileState, "terrain" | "elevation" | "blocksMovement" | "providesCover" | "movementCost" | "concealment" | "vulnerable" | "healing" | "chokepoint">>
  ) {
    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
        this.mutateTile(tiles, x, y, patch);
      }
    }
  }

  private mutateTile(
    tiles: TileState[],
    x: number,
    y: number,
    patch: Partial<Pick<TileState, "terrain" | "elevation" | "blocksMovement" | "providesCover" | "movementCost" | "concealment" | "vulnerable" | "healing" | "chokepoint">>
  ) {
    const tile = tiles[y * this.width + x];
    if (!tile) return;
    if (patch.terrain !== undefined) tile.terrain = patch.terrain;
    if (patch.elevation !== undefined) tile.elevation = patch.elevation;
    if (patch.blocksMovement !== undefined) tile.blocksMovement = patch.blocksMovement;
    if (patch.providesCover !== undefined) tile.providesCover = patch.providesCover;
    if (patch.movementCost !== undefined) tile.movementCost = patch.movementCost;
    if (patch.concealment !== undefined) tile.concealment = patch.concealment;
    if (patch.vulnerable !== undefined) tile.vulnerable = patch.vulnerable;
    if (patch.healing !== undefined) tile.healing = patch.healing;
    if (patch.chokepoint !== undefined) tile.chokepoint = patch.chokepoint;
  }

  private makePosition(x: number, y: number) {
    const position = new Position();
    position.x = x;
    position.y = y;
    return position;
  }
}
