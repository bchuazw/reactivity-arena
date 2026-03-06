import {
  AgentState,
  ArenaState,
  ChestItemType,
  ActionType,
} from "../schema/ArenaState";

export interface AgentAction {
  type: ActionType;
  targetId?: string;
  targetX?: number;
  targetY?: number;
  chestId?: string;
  itemType?: string;
  reasoning?: string;
}

interface ThreatAssessment {
  agentId: string;
  distance: number;
  hp: number;
  threat: number;
  target?: AgentState;
}

interface TileScore {
  x: number;
  y: number;
  score: number;
  reasoning: string;
}

export class DecisionEngine {
  async decide(agent: AgentState, state: ArenaState): Promise<AgentAction> {
    const enemies = this.getAliveEnemies(agent, state);
    const threats = this.assessThreats(agent, enemies);
    const nearest = threats[0];
    const adjacentChest = [...state.chests].find(
      (chest: any) => !chest.opened && this.distancePos(agent.position, chest.position) === 1
    );

    if (adjacentChest && (agent.hp < agent.maxHp * 0.85 || agent.inventory.length === 0)) {
      return {
        type: ActionType.OPEN_CHEST,
        chestId: adjacentChest.id,
        reasoning: `Open adjacent chest for item advantage (${adjacentChest.itemType}).`,
      };
    }

    const usableItem = this.chooseUsableItem(agent, threats);
    if (usableItem) return usableItem;

    if (!nearest) {
      return { type: ActionType.SKIP, reasoning: "No enemies remain." };
    }

    if (agent.hp < agent.maxHp * 0.35) {
      return { type: ActionType.DEFEND, reasoning: "Low HP, defending to reduce incoming damage." };
    }

    if (nearest.distance <= agent.attackRange + agent.bonusRange) {
      return { type: ActionType.ATTACK, targetId: nearest.agentId, reasoning: "Enemy in range, taking the shot." };
    }

    const chestMove = this.tryMoveTowardChest(agent, state, threats, 6);
    if (chestMove) return chestMove;

    return this.moveToBestTile(
      agent,
      state,
      nearest.target,
      {
        preferCover: true,
        preferElevation: true,
        preferHealing: agent.hp < agent.maxHp * 0.7,
        aggressive: true,
      },
      "Advancing toward a stronger combat position."
    );
  }

  private chooseUsableItem(agent: AgentState, threats: ThreatAssessment[]): AgentAction | null {
    const available = [...agent.inventory].find((item) => !item.consumed);
    if (!available) return null;

    if (available.type === ChestItemType.MEDKIT && agent.hp < agent.maxHp * 0.5) {
      return { type: ActionType.USE_ITEM, itemType: available.type, reasoning: "Using medkit to stabilize." };
    }
    if (available.type === ChestItemType.SHIELD_BATTERY && threats.some((t) => t.distance <= 2)) {
      return { type: ActionType.USE_ITEM, itemType: available.type, reasoning: "Using shield before close combat." };
    }
    if (available.type === ChestItemType.ADRENALINE && threats.some((t) => t.distance <= 2)) {
      return { type: ActionType.USE_ITEM, itemType: available.type, reasoning: "Using adrenaline for extra tempo." };
    }
    if (available.type === ChestItemType.SPEED_BOOST && threats.length > 0 && threats[0].distance > agent.attackRange) {
      return { type: ActionType.USE_ITEM, itemType: available.type, reasoning: "Using speed boost to close distance." };
    }
    return null;
  }

  private tryMoveTowardChest(
    agent: AgentState,
    state: ArenaState,
    threats: ThreatAssessment[],
    maxDistance: number
  ): AgentAction | null {
    const chest = this.closestChest(agent, state);
    if (!chest) return null;
    const dist = this.distancePos(agent.position, chest.position);
    if (dist > maxDistance) return null;
    if (threats[0] && threats[0].distance <= 2 && agent.hp > agent.maxHp * 0.65) return null;

    return {
      type: ActionType.MOVE,
      targetX: chest.position.x,
      targetY: chest.position.y,
      chestId: chest.id,
      reasoning: `Moving toward chest (${chest.itemType}) for resources.`,
    };
  }

  private moveToBestTile(
    agent: AgentState,
    state: ArenaState,
    target: AgentState | undefined,
    prefs: {
      preferCover?: boolean;
      preferElevation?: boolean;
      preferHealing?: boolean;
      aggressive?: boolean;
      keepDistance?: boolean;
    },
    fallbackReason: string
  ): AgentAction {
    const candidates = this.reachableTiles(agent, state);
    const scored = candidates
      .map((tile) => this.scoreTile(agent, state, tile.x, tile.y, target, prefs))
      .sort((a, b) => b.score - a.score)[0];

    if (!scored) {
      return { type: ActionType.DEFEND, reasoning: "No safe movement options available." };
    }

    return {
      type: ActionType.MOVE,
      targetX: scored.x,
      targetY: scored.y,
      reasoning: scored.reasoning || fallbackReason,
    };
  }

  private scoreTile(
    agent: AgentState,
    state: ArenaState,
    x: number,
    y: number,
    target: AgentState | undefined,
    prefs: {
      preferCover?: boolean;
      preferElevation?: boolean;
      preferHealing?: boolean;
      aggressive?: boolean;
      keepDistance?: boolean;
    }
  ): TileScore {
    const tile = this.getTile(state, x, y);
    if (!tile) return { x, y, score: -999, reasoning: "Invalid tile." };

    let score = 0;
    const reasons: string[] = [];

    if (tile.providesCover && prefs.preferCover) {
      score += 10;
      reasons.push("cover");
    }
    if (tile.elevation > 0 && prefs.preferElevation) {
      score += 10 + tile.elevation * 4;
      reasons.push("high ground");
    }
    if (tile.healing && prefs.preferHealing) {
      score += 14;
      reasons.push("healing zone");
    }
    if (tile.concealment) {
      score += 5;
      reasons.push("concealment");
    }
    if (tile.chokepoint) {
      score += 3;
      reasons.push("chokepoint pressure");
    }
    if (tile.vulnerable) score -= 8;

    if (target) {
      const distance = Math.abs(target.position.x - x) + Math.abs(target.position.y - y);
      if (prefs.keepDistance) {
        score += Math.min(8, distance * 2);
      } else if (prefs.aggressive) {
        score += Math.max(0, 10 - distance * 2);
      }
    }

    return {
      x,
      y,
      score,
      reasoning: reasons.length ? `Repositioning for ${reasons.join(", ")}.` : "Repositioning tactically.",
    };
  }

  private reachableTiles(agent: AgentState, state: ArenaState): Array<{ x: number; y: number }> {
    const radius = Math.max(1, agent.speed + (agent.speedBoostTurns > 0 ? agent.speed : 0));
    const tiles: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const distance = Math.abs(agent.position.x - x) + Math.abs(agent.position.y - y);
        if (distance === 0 || distance > radius) continue;
        const tile = this.getTile(state, x, y);
        if (!tile || tile.blocksMovement || this.isOccupied(state, x, y) || this.hasBlockingProp(state, x, y)) continue;
        if (tile.movementCost > 1 && distance > Math.max(1, radius - 1)) continue;
        tiles.push({ x, y });
      }
    }

    return tiles;
  }

  private closestChest(agent: AgentState, state: ArenaState) {
    return [...state.chests]
      .filter((chest) => !chest.opened)
      .sort((a, b) => this.distancePos(agent.position, a.position) - this.distancePos(agent.position, b.position))[0];
  }

  private assessThreats(agent: AgentState, enemies: AgentState[]): ThreatAssessment[] {
    return enemies
      .map((enemy) => {
        const distance = this.distance(agent, enemy);
        const threat = (enemy.attack * 2 + enemy.speed * 4 + Math.max(0, 10 - distance * 2)) * (enemy.hp / enemy.maxHp);
        return {
          agentId: enemy.id,
          distance,
          hp: enemy.hp,
          threat,
          target: enemy,
        };
      })
      .sort((a, b) => a.distance - b.distance || b.threat - a.threat);
  }

  private getAliveEnemies(agent: AgentState, state: ArenaState): AgentState[] {
    const enemies: AgentState[] = [];
    state.agents.forEach((other: AgentState) => {
      if (other.id !== agent.id && other.isAlive) enemies.push(other);
    });
    return enemies;
  }

  private getTile(state: ArenaState, x: number, y: number) {
    return [...state.tiles].find((tile) => tile.position.x === x && tile.position.y === y);
  }

  private isOccupied(state: ArenaState, x: number, y: number): boolean {
    return [...state.agents.values()].some((agent) => agent.isAlive && agent.position.x === x && agent.position.y === y);
  }

  private hasBlockingProp(state: ArenaState, x: number, y: number): boolean {
    return [...state.destructibles].some((prop) => prop.position.x === x && prop.position.y === y && prop.blocksMovement && prop.hp > 0);
  }

  private distance(a: AgentState, b: AgentState): number {
    return this.distancePos(a.position, b.position);
  }

  private distancePos(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}
