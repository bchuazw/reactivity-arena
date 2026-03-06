import {
  AgentArchetype,
  AgentState,
  ArenaState,
  ChestItemType,
  TerrainType,
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
    const adjacentChest = [...state.chests].find(
      (chest: any) => !chest.opened && this.distancePos(agent.position, chest.position) === 1
    );

    if (adjacentChest && (agent.hp < agent.maxHp * 0.8 || agent.inventory.length === 0)) {
      return {
        type: ActionType.OPEN_CHEST,
        chestId: adjacentChest.id,
        reasoning: `Securing nearby chest for tempo and resources (${adjacentChest.itemType}).`,
      };
    }

    const usableItem = this.chooseUsableItem(agent, threats);
    if (usableItem) return usableItem;

    switch (agent.archetype) {
      case AgentArchetype.RANGER:
        return this.rangerStrategy(agent, state, threats);
      case AgentArchetype.MEDIC:
        return this.medicStrategy(agent, state, threats);
      case AgentArchetype.SABOTEUR:
        return this.saboteurStrategy(agent, state, threats);
      case AgentArchetype.TITAN:
        return this.titanStrategy(agent, state, threats);
      case AgentArchetype.VANGUARD:
      default:
        return this.vanguardStrategy(agent, state, threats);
    }
  }

  private vanguardStrategy(agent: AgentState, state: ArenaState, threats: ThreatAssessment[]): AgentAction {
    const nearest = threats[0];
    if (!nearest) return { type: ActionType.SKIP, reasoning: "No threats left." };

    if (agent.hp < agent.maxHp * 0.35) {
      return { type: ActionType.DEFEND, reasoning: "Low HP, bracing and rallying." };
    }

    if (nearest.distance <= agent.attackRange) {
      if (nearest.distance > 1 && agent.disabledTurns <= 0) {
        return { type: ActionType.ABILITY, targetId: nearest.agentId, reasoning: "Charge through lane and strike first." };
      }
      return { type: ActionType.ATTACK, targetId: nearest.agentId, reasoning: "Pressuring the frontline target." };
    }

    const chestMove = this.tryMoveTowardChest(agent, state, threats, 7);
    if (chestMove) return chestMove;

    return this.moveToBestTile(agent, state, nearest.target, {
      preferCover: true,
      preferElevation: true,
      aggressive: true,
    }, "Advancing into a strong assault position.");
  }

  private rangerStrategy(agent: AgentState, state: ArenaState, threats: ThreatAssessment[]): AgentAction {
    const nearest = threats[0];
    if (!nearest) return { type: ActionType.SKIP, reasoning: "No targets in scope." };

    if (agent.ammo <= 1 || nearest.distance <= 1) {
      return this.moveToBestTile(agent, state, nearest.target, {
        preferCover: true,
        preferElevation: true,
        keepDistance: true,
      }, "Repositioning to maintain a firing lane.");
    }

    if (nearest.distance <= agent.attackRange + agent.bonusRange) {
      return { type: ActionType.ATTACK, targetId: nearest.agentId, reasoning: "Taking a clean ranged shot." };
    }

    const chestMove = this.tryMoveTowardChest(agent, state, threats, 6);
    if (chestMove) return chestMove;

    return this.moveToBestTile(agent, state, nearest.target, {
      preferCover: true,
      preferElevation: true,
      keepDistance: true,
    }, "Seeking rooftop angle with cover.");
  }

  private medicStrategy(agent: AgentState, state: ArenaState, threats: ThreatAssessment[]): AgentAction {
    const reviveTarget = [...state.agents.values()].find(
      (ally) => ally.id !== agent.id && !ally.isAlive && agent.reviveAvailable && this.distancePos(agent.position, ally.position) <= 1
    );
    if (reviveTarget) {
      return { type: ActionType.ABILITY, targetId: reviveTarget.id, reasoning: "Emergency revive on adjacent ally." };
    }

    const lowestAlly = [...state.agents.values()]
      .filter((ally) => ally.id !== agent.id && ally.isAlive)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];

    if (agent.hp < agent.maxHp * 0.55 || (lowestAlly && lowestAlly.hp < lowestAlly.maxHp * 0.55)) {
      return { type: ActionType.ABILITY, targetId: lowestAlly?.id, reasoning: "Deploying heal burst / smoke support." };
    }

    const nearest = threats[0];
    if (nearest && nearest.distance <= agent.attackRange) {
      return { type: ActionType.ATTACK, targetId: nearest.agentId, reasoning: "Taking safe combat shots while supporting." };
    }

    const chestMove = this.tryMoveTowardChest(agent, state, threats, 8);
    if (chestMove) return chestMove;

    return this.moveToBestTile(agent, state, lowestAlly ?? nearest?.target, {
      preferCover: true,
      preferHealing: true,
      keepDistance: true,
    }, "Sliding into support position.");
  }

  private saboteurStrategy(agent: AgentState, state: ArenaState, threats: ThreatAssessment[]): AgentAction {
    const nearest = threats[0];
    const weakest = [...threats].sort((a, b) => a.hp - b.hp)[0];
    if (!weakest) return { type: ActionType.SKIP, reasoning: "No prey located." };

    const target = weakest.target;
    if (!target) return { type: ActionType.SKIP, reasoning: "No prey located." };

    const enemyOnCover = this.getTile(state, target.position.x, target.position.y)?.providesCover;
    if ((enemyOnCover || this.adjacentDestructible(state, target.position.x, target.position.y)) && agent.disabledTurns <= 0) {
      return { type: ActionType.ABILITY, targetId: target.id, reasoning: "Hack cover and EMP the clustered target." };
    }

    if (weakest.distance <= agent.attackRange) {
      return { type: ActionType.ATTACK, targetId: weakest.agentId, reasoning: "Bursting the softened target." };
    }

    const nearbyChest = this.closestChest(agent, state);
    if (nearbyChest && this.distancePos(agent.position, nearbyChest.position) <= 3) {
      return {
        type: ActionType.MOVE,
        targetX: nearbyChest.position.x,
        targetY: nearbyChest.position.y,
        reasoning: "Blinking toward loot to swing momentum.",
      };
    }

    return {
      type: ActionType.ABILITY,
      targetId: target.id,
      reasoning: "Teleporting onto a high-value flank.",
    };
  }

  private titanStrategy(agent: AgentState, state: ArenaState, threats: ThreatAssessment[]): AgentAction {
    const nearbyAllies = [...state.agents.values()].filter(
      (ally) => ally.id !== agent.id && ally.isAlive && this.distancePos(agent.position, ally.position) <= 1
    );
    if (nearbyAllies.some((ally) => ally.hp < ally.maxHp * 0.6) || threats.filter((t) => t.distance <= 2).length >= 2) {
      return { type: ActionType.ABILITY, reasoning: "Deploying barrier and shield wall for adjacent allies." };
    }

    const nearest = threats[0];
    if (!nearest) return { type: ActionType.DEFEND, reasoning: "Holding the objective." };

    if (agent.hp < agent.maxHp * 0.4) {
      return { type: ActionType.DEFEND, reasoning: "Soaking pressure and restoring footing." };
    }

    if (nearest.distance <= agent.attackRange) {
      return { type: ActionType.ATTACK, targetId: nearest.agentId, reasoning: "Punishing anything in melee range." };
    }

    return this.moveToBestTile(agent, state, nearest.target, {
      preferCover: true,
      preferChokepoint: true,
      aggressive: true,
    }, "Marching to lock down a chokepoint.");
  }

  private chooseUsableItem(agent: AgentState, threats: ThreatAssessment[]): AgentAction | null {
    const available = [...agent.inventory].find((item) => !item.consumed);
    if (!available) return null;

    if (available.type === ChestItemType.MEDKIT && agent.hp < agent.maxHp * 0.45) {
      return { type: ActionType.USE_ITEM, itemType: available.type, reasoning: "Emergency medkit to stabilize." };
    }
    if (available.type === ChestItemType.SHIELD_BATTERY && threats.some((t) => t.distance <= 2)) {
      return { type: ActionType.USE_ITEM, itemType: available.type, reasoning: "Activating shield battery before the brawl." };
    }
    if (available.type === ChestItemType.ADRENALINE && threats.some((t) => t.distance <= 2)) {
      return { type: ActionType.USE_ITEM, itemType: available.type, reasoning: "Injecting adrenaline for an explosive turn." };
    }
    if (available.type === ChestItemType.SPEED_BOOST && threats.length > 0 && threats[0].distance > agent.attackRange) {
      return { type: ActionType.USE_ITEM, itemType: available.type, reasoning: "Using speed boost to seize positioning." };
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
    if (threats[0] && threats[0].distance <= 2 && agent.hp > agent.maxHp * 0.6) return null;

    return {
      type: ActionType.MOVE,
      targetX: chest.position.x,
      targetY: chest.position.y,
      chestId: chest.id,
      reasoning: `Rotating toward chest (${chest.itemType}) for tempo advantage.`,
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
      preferChokepoint?: boolean;
      keepDistance?: boolean;
      aggressive?: boolean;
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
      preferChokepoint?: boolean;
      keepDistance?: boolean;
      aggressive?: boolean;
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
      score += 12 + tile.elevation * 4;
      reasons.push("high ground");
    }
    if (tile.healing && prefs.preferHealing && agent.hp < agent.maxHp * 0.8) {
      score += 14;
      reasons.push("healing zone");
    }
    if (tile.chokepoint && prefs.preferChokepoint) {
      score += 8;
      reasons.push("chokepoint control");
    }
    if (tile.concealment) {
      score += 6;
      reasons.push("concealment");
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

  private adjacentDestructible(state: ArenaState, x: number, y: number): boolean {
    return [...state.destructibles].some((prop) => prop.hp > 0 && this.distancePos(prop.position, { x, y }) <= 1);
  }

  private distance(a: AgentState, b: AgentState): number {
    return this.distancePos(a.position, b.position);
  }

  private distancePos(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}
