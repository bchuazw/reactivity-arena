import {
  AgentState,
  AgentArchetype,
  ActionType,
  ArenaState,
} from "../schema/ArenaState";

// ─── Types ───────────────────────────────────────────────────────

export interface AgentAction {
  type: ActionType;
  targetId?: string;
  targetX?: number;
  targetY?: number;
  reasoning?: string;
}

interface ThreatAssessment {
  agentId: string;
  distance: number;
  hp: number;
  threat: number; // 0-100
}

// ─── Decision Engine ─────────────────────────────────────────────
// Each archetype has a distinct AI personality that determines
// how they prioritize actions in combat.
//
// Future: Replace heuristic logic with Claude API calls for
// truly autonomous AI agents with personality and memory.

export class DecisionEngine {
  private readonly ARENA_SIZE = 10;

  /**
   * Generate a decision for an AI agent based on their archetype,
   * current game state, and surrounding threats.
   */
  async decide(
    agent: AgentState,
    state: ArenaState
  ): Promise<AgentAction> {
    const enemies = this.getAliveEnemies(agent, state);
    const threats = this.assessThreats(agent, enemies);

    // Apply archetype-specific strategy
    switch (agent.archetype) {
      case AgentArchetype.VANGUARD:
        return this.vanguardStrategy(agent, threats, state);
      case AgentArchetype.SNIPER:
        return this.sniperStrategy(agent, threats, state);
      case AgentArchetype.SUPPORT:
        return this.supportStrategy(agent, threats, state);
      case AgentArchetype.ASSASSIN:
        return this.assassinStrategy(agent, threats, state);
      case AgentArchetype.TANK:
        return this.tankStrategy(agent, threats, state);
      default:
        return this.vanguardStrategy(agent, threats, state);
    }
  }

  // ─── Archetype Strategies ────────────────────────────────────────

  /**
   * Vanguard: Balanced fighter. Attacks nearest enemy, defends when low HP.
   */
  private vanguardStrategy(
    agent: AgentState,
    threats: ThreatAssessment[],
    _state: ArenaState
  ): AgentAction {
    const hpPercent = agent.hp / agent.maxHp;

    // Defend if HP is low
    if (hpPercent < 0.3) {
      return {
        type: ActionType.DEFEND,
        reasoning: "HP critical, defending to survive",
      };
    }

    // Attack nearest threat
    if (threats.length > 0) {
      const nearest = threats[0];
      if (nearest.distance <= 2) {
        return {
          type: ActionType.ATTACK,
          targetId: nearest.agentId,
          reasoning: `Engaging nearest enemy at distance ${nearest.distance}`,
        };
      }

      // Move toward nearest enemy
      return this.moveToward(agent, nearest, "Closing distance to engage");
    }

    return { type: ActionType.SKIP, reasoning: "No targets available" };
  }

  /**
   * Sniper: Stays at range. Attacks from afar, retreats when close.
   */
  private sniperStrategy(
    agent: AgentState,
    threats: ThreatAssessment[],
    _state: ArenaState
  ): AgentAction {
    if (agent.ammo <= 0) {
      return {
        type: ActionType.DEFEND,
        reasoning: "Out of ammo, defending",
      };
    }

    if (threats.length > 0) {
      const nearest = threats[0];

      // If enemy is too close, retreat
      if (nearest.distance <= 1) {
        return this.moveAway(agent, nearest, "Enemy too close, repositioning");
      }

      // Attack from range (snipers can attack at distance 3+)
      if (nearest.distance <= 4) {
        return {
          type: ActionType.ATTACK,
          targetId: nearest.agentId,
          reasoning: `Sniping target at distance ${nearest.distance}`,
        };
      }

      // Move to get in range
      return this.moveToward(agent, nearest, "Moving to sniping range");
    }

    return { type: ActionType.SKIP, reasoning: "No targets in range" };
  }

  /**
   * Support: Prefers to heal allies (simulated). Attacks only when necessary.
   */
  private supportStrategy(
    agent: AgentState,
    threats: ThreatAssessment[],
    _state: ArenaState
  ): AgentAction {
    const hpPercent = agent.hp / agent.maxHp;

    // Self-heal if damaged (ability action)
    if (hpPercent < 0.6) {
      return {
        type: ActionType.ABILITY,
        targetId: agent.id,
        reasoning: "Self-healing to stay in the fight",
      };
    }

    // Keep distance and attack if enemies are close
    if (threats.length > 0) {
      const nearest = threats[0];
      if (nearest.distance <= 1) {
        return this.moveAway(agent, nearest, "Maintaining safe distance");
      }
      if (nearest.distance <= 3) {
        return {
          type: ActionType.ATTACK,
          targetId: nearest.agentId,
          reasoning: "Attacking from safe distance",
        };
      }
    }

    return { type: ActionType.DEFEND, reasoning: "Holding position, conserving energy" };
  }

  /**
   * Assassin: Targets weakest enemy. High risk, high reward.
   */
  private assassinStrategy(
    agent: AgentState,
    threats: ThreatAssessment[],
    _state: ArenaState
  ): AgentAction {
    if (threats.length === 0) {
      return { type: ActionType.SKIP, reasoning: "No targets" };
    }

    // Find weakest enemy
    const weakest = [...threats].sort((a, b) => a.hp - b.hp)[0];

    // If adjacent to weakest, attack
    if (weakest.distance <= 1) {
      return {
        type: ActionType.ATTACK,
        targetId: weakest.agentId,
        reasoning: `Assassinating low-HP target (${weakest.hp} HP)`,
      };
    }

    // Use ability (dash) if close
    if (weakest.distance <= 3) {
      return {
        type: ActionType.ABILITY,
        targetId: weakest.agentId,
        reasoning: `Shadow strike on weakened target at distance ${weakest.distance}`,
      };
    }

    // Move toward weakest
    return this.moveToward(agent, weakest, "Stalking weakened prey");
  }

  /**
   * Tank: Absorbs damage. Defends often, attacks when enemies are adjacent.
   */
  private tankStrategy(
    agent: AgentState,
    threats: ThreatAssessment[],
    _state: ArenaState
  ): AgentAction {
    const hpPercent = agent.hp / agent.maxHp;

    // Defend proactively
    if (hpPercent < 0.5 || threats.filter((t) => t.distance <= 2).length >= 2) {
      return {
        type: ActionType.DEFEND,
        reasoning: "Fortifying position, absorbing pressure",
      };
    }

    if (threats.length > 0) {
      const nearest = threats[0];

      // Attack if adjacent
      if (nearest.distance <= 1) {
        return {
          type: ActionType.ATTACK,
          targetId: nearest.agentId,
          reasoning: "Crushing adjacent enemy",
        };
      }

      // Move toward nearest enemy to engage
      return this.moveToward(agent, nearest, "Advancing to draw aggro");
    }

    return { type: ActionType.DEFEND, reasoning: "Holding the line" };
  }

  // ─── Helper Methods ────────────────────────────────────────────

  private getAliveEnemies(
    agent: AgentState,
    state: ArenaState
  ): AgentState[] {
    const enemies: AgentState[] = [];
    state.agents.forEach((other) => {
      if (other.id !== agent.id && other.isAlive) {
        enemies.push(other);
      }
    });
    return enemies;
  }

  private assessThreats(
    agent: AgentState,
    enemies: AgentState[]
  ): ThreatAssessment[] {
    return enemies
      .map((enemy) => {
        const distance = this.getDistance(agent, enemy);
        const threat =
          (enemy.attack * 3 + (100 - distance * 10)) *
          (enemy.hp / enemy.maxHp);
        return {
          agentId: enemy.id,
          distance,
          hp: enemy.hp,
          threat: Math.min(100, Math.max(0, threat)),
        };
      })
      .sort((a, b) => a.distance - b.distance);
  }

  private getDistance(a: AgentState, b: AgentState): number {
    return (
      Math.abs(a.position.x - b.position.x) +
      Math.abs(a.position.y - b.position.y)
    );
  }

  private moveToward(
    agent: AgentState,
    target: ThreatAssessment,
    reasoning: string
  ): AgentAction {
    // Simple pathfinding: move one step toward target
    const enemies = [target]; // We only need the target for direction
    // Move in the direction of the target
    const targetAgent = { position: { x: 0, y: 0 } }; // Placeholder
    return {
      type: ActionType.MOVE,
      targetId: target.agentId,
      reasoning,
    };
  }

  private moveAway(
    agent: AgentState,
    threat: ThreatAssessment,
    reasoning: string
  ): AgentAction {
    return {
      type: ActionType.MOVE,
      targetId: threat.agentId,
      reasoning,
    };
  }

  // ─── Future: Claude API Integration ────────────────────────────
  //
  // async decideWithClaude(agent: AgentState, state: ArenaState): Promise<AgentAction> {
  //   const prompt = this.buildPrompt(agent, state);
  //   const response = await anthropic.messages.create({
  //     model: "claude-sonnet-4-20250514",
  //     max_tokens: 256,
  //     system: `You are ${agent.name}, a ${agent.archetype} AI fighter in an arena battle.
  //              Respond with a JSON action: { type, targetId?, reasoning }`,
  //     messages: [{ role: "user", content: prompt }],
  //   });
  //   return JSON.parse(response.content[0].text);
  // }
}
