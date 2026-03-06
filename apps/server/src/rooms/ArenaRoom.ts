import { Room, Client } from "colyseus";
import { ethers } from "ethers";
import {
  ArenaState,
  AgentState,
  Position,
  ActionLogEntry,
  SponsorshipEvent,
  AgentArchetype,
  ActionType,
  MatchPhase,
  ARCHETYPE_STATS,
} from "../schema/ArenaState";
import { DecisionEngine, AgentAction } from "../ai/DecisionEngine";
import {
  SomniaEventListener,
  SponsorshipEventData,
  BetPlacedEventData,
  OddsUpdatedEventData,
} from "../somnia/EventListener";

// ─── Constants ───────────────────────────────────────────────────

const MAX_SPECTATORS = parseInt(process.env.MAX_SPECTATORS || "50");
const TURN_TIMEOUT_MS = parseInt(process.env.TURN_TIMEOUT_MS || "30000");
const MAX_TURNS = 100;
const ARENA_SIZE = 10;
const MAX_LOG_ENTRIES = 50;

// ─── Agent Definitions ──────────────────────────────────────────

const AI_AGENTS = [
  {
    id: "agent-vanguard",
    name: "Blade Runner",
    archetype: AgentArchetype.VANGUARD,
    walletAddress: ethers.Wallet.createRandom().address,
  },
  {
    id: "agent-sniper",
    name: "Hawk Eye",
    archetype: AgentArchetype.SNIPER,
    walletAddress: ethers.Wallet.createRandom().address,
  },
  {
    id: "agent-support",
    name: "Mercy Unit",
    archetype: AgentArchetype.SUPPORT,
    walletAddress: ethers.Wallet.createRandom().address,
  },
  {
    id: "agent-assassin",
    name: "Shadow",
    archetype: AgentArchetype.ASSASSIN,
    walletAddress: ethers.Wallet.createRandom().address,
  },
  {
    id: "agent-tank",
    name: "Iron Wall",
    archetype: AgentArchetype.TANK,
    walletAddress: ethers.Wallet.createRandom().address,
  },
];

// ─── Arena Room ──────────────────────────────────────────────────

export class ArenaRoom extends Room {
  declare state: ArenaState;
  private decisionEngine: DecisionEngine = new DecisionEngine();
  private eventListener: SomniaEventListener = new SomniaEventListener();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessingTurn: boolean = false;

  // ─── Room Lifecycle ────────────────────────────────────────────

  onCreate(options: any) {
    this.maxClients = MAX_SPECTATORS;
    this.setState(new ArenaState());

    // Set contract addresses
    this.state.bettingPoolAddress = process.env.BETTING_POOL_ADDRESS || "";
    this.state.sponsorshipAddress = process.env.SPONSORSHIP_ADDRESS || "";
    this.state.matchTimerAddress = process.env.MATCH_TIMER_ADDRESS || "";

    // Initialize match
    this.state.matchId = options.matchId || this.generateMatchId();
    this.state.maxTurns = MAX_TURNS;
    this.state.phase = MatchPhase.LOBBY;

    // Initialize AI agents
    this.initializeAgents();

    // Set up blockchain event listener
    this.initEventListener();

    // Handle client messages
    this.onMessage("chat", (client, message) => {
      this.broadcast("chat", {
        sender: client.sessionId,
        message: message.text,
        timestamp: Date.now(),
      });
    });

    this.onMessage("startMatch", (_client, _message) => {
      if (this.state.phase === MatchPhase.LOBBY) {
        this.startMatch();
      }
    });

    console.log(`[ArenaRoom] Created room ${this.roomId} | match ${this.state.matchId}`);
  }

  onJoin(client: Client, options: any) {
    this.state.spectatorCount = this.clients.length;
    console.log(`[ArenaRoom] Spectator joined: ${client.sessionId} (${this.clients.length}/${MAX_SPECTATORS})`);

    // Send welcome message
    client.send("welcome", {
      matchId: this.state.matchId,
      phase: this.state.phase,
      agents: AI_AGENTS.map((a) => ({ id: a.id, name: a.name, archetype: a.archetype })),
    });
  }

  onLeave(client: Client, code?: number) {
    this.state.spectatorCount = this.clients.length;
    console.log(`[ArenaRoom] Spectator left: ${client.sessionId} (code: ${code})`);
  }

  async onDispose() {
    console.log(`[ArenaRoom] Disposing room ${this.roomId}`);
    if (this.turnTimer) clearTimeout(this.turnTimer);
    await this.eventListener.stop();
  }

  // ─── Match Control ─────────────────────────────────────────────

  private startMatch() {
    this.state.phase = MatchPhase.ACTIVE;
    this.state.startTime = Date.now();
    this.state.turnNumber = 0;

    // Set first agent's turn
    const firstAgentId = this.state.turnOrder[0];
    this.state.currentAgentId = firstAgentId;
    this.state.turnDeadline = Date.now() + TURN_TIMEOUT_MS;

    this.addLog(0, "system", ActionType.SKIP, "", 0, "⚔️ MATCH STARTED! Let the battle begin!");

    console.log(`[ArenaRoom] Match started: ${this.state.matchId}`);

    // Start the turn loop
    this.scheduleTurn();
  }

  private async scheduleTurn() {
    if (this.state.phase !== MatchPhase.ACTIVE) return;

    // Process current agent's turn
    await this.processCurrentTurn();

    // Check win condition
    const aliveAgents = this.getAliveAgents();
    if (aliveAgents.length <= 1 || this.state.turnNumber >= this.state.maxTurns) {
      this.endMatch(aliveAgents.length === 1 ? aliveAgents[0].id : this.getMostHpAgent());
      return;
    }

    // Advance to next agent
    this.advanceTurn();

    // Schedule next turn with delay for spectator viewing
    this.turnTimer = setTimeout(() => this.scheduleTurn(), 2000);
  }

  private async processCurrentTurn() {
    if (this.isProcessingTurn) return;
    this.isProcessingTurn = true;

    try {
      const agent = this.state.agents.get(this.state.currentAgentId);
      if (!agent || !agent.isAlive) {
        this.isProcessingTurn = false;
        return;
      }

      // Get AI decision
      const action = await this.decisionEngine.decide(agent, this.state);

      // Execute the action
      this.executeAction(agent, action);

      // Update status effects
      this.tickStatusEffects(agent);

    } catch (error) {
      console.error(`[ArenaRoom] Error processing turn:`, error);
    } finally {
      this.isProcessingTurn = false;
    }
  }

  private executeAction(agent: AgentState, action: AgentAction) {
    switch (action.type) {
      case ActionType.ATTACK:
        this.executeAttack(agent, action);
        break;
      case ActionType.DEFEND:
        this.executeDefend(agent, action);
        break;
      case ActionType.MOVE:
        this.executeMove(agent, action);
        break;
      case ActionType.ABILITY:
        this.executeAbility(agent, action);
        break;
      case ActionType.SKIP:
      default:
        this.addLog(
          this.state.turnNumber,
          agent.id,
          ActionType.SKIP,
          "",
          0,
          `${agent.name} waits and observes...`
        );
        break;
    }

    // Reset defending status at start of each turn
    agent.isDefending = false;
  }

  // ─── Action Execution ──────────────────────────────────────────

  private executeAttack(agent: AgentState, action: AgentAction) {
    if (!action.targetId) return;
    const target = this.state.agents.get(action.targetId);
    if (!target || !target.isAlive) return;

    // Calculate damage
    let baseDamage = agent.attack + Math.floor(Math.random() * 5);

    // Apply damage boost
    if (agent.damageBoostTurns > 0) {
      baseDamage = Math.floor(baseDamage * agent.damageBoostMultiplier);
    }

    // Apply defense reduction
    let actualDamage = Math.max(1, baseDamage - target.defense);

    // Shield reduces damage by 50%
    if (target.hasShield && target.shieldTurns > 0) {
      actualDamage = Math.floor(actualDamage * 0.5);
    }

    // Defending reduces damage by 50%
    if (target.isDefending) {
      actualDamage = Math.floor(actualDamage * 0.5);
    }

    // Assassin crit chance (25%)
    let isCrit = false;
    if (agent.archetype === AgentArchetype.ASSASSIN && Math.random() < 0.25) {
      actualDamage = Math.floor(actualDamage * 2);
      isCrit = true;
    }

    // Apply damage
    target.hp = Math.max(0, target.hp - actualDamage);
    target.damageTaken += actualDamage;
    agent.damageDealt += actualDamage;

    // Consume ammo
    if (agent.ammo > 0) agent.ammo--;

    // Check kill
    if (target.hp <= 0) {
      target.isAlive = false;
      agent.kills++;
      this.addLog(
        this.state.turnNumber,
        agent.id,
        ActionType.ATTACK,
        target.id,
        actualDamage,
        `💀 ${agent.name} ELIMINATED ${target.name}! (${actualDamage} damage${isCrit ? " CRIT!" : ""})`
      );
    } else {
      this.addLog(
        this.state.turnNumber,
        agent.id,
        ActionType.ATTACK,
        target.id,
        actualDamage,
        `⚔️ ${agent.name} attacks ${target.name} for ${actualDamage} damage${isCrit ? " (CRIT!)" : ""} [${target.hp}/${target.maxHp} HP]`
      );
    }
  }

  private executeDefend(agent: AgentState, _action: AgentAction) {
    agent.isDefending = true;
    // Defending also restores a small amount of HP
    const healAmount = Math.floor(agent.maxHp * 0.05);
    agent.hp = Math.min(agent.maxHp, agent.hp + healAmount);

    this.addLog(
      this.state.turnNumber,
      agent.id,
      ActionType.DEFEND,
      "",
      0,
      `🛡️ ${agent.name} takes a defensive stance (+${healAmount} HP) [${agent.hp}/${agent.maxHp}]`
    );
  }

  private executeMove(agent: AgentState, action: AgentAction) {
    // Simple movement: move 1-2 cells in a random direction
    const dx = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    const dy = Math.floor(Math.random() * 3) - 1;

    const newX = Math.max(0, Math.min(ARENA_SIZE - 1, agent.position.x + dx));
    const newY = Math.max(0, Math.min(ARENA_SIZE - 1, agent.position.y + dy));

    agent.position.x = newX;
    agent.position.y = newY;

    this.addLog(
      this.state.turnNumber,
      agent.id,
      ActionType.MOVE,
      "",
      0,
      `🏃 ${agent.name} moves to (${newX}, ${newY})`
    );
  }

  private executeAbility(agent: AgentState, action: AgentAction) {
    switch (agent.archetype) {
      case AgentArchetype.SUPPORT:
        // Self-heal
        const healAmount = Math.floor(agent.maxHp * 0.2);
        agent.hp = Math.min(agent.maxHp, agent.hp + healAmount);
        this.addLog(
          this.state.turnNumber,
          agent.id,
          ActionType.ABILITY,
          agent.id,
          healAmount,
          `💚 ${agent.name} heals for ${healAmount} HP [${agent.hp}/${agent.maxHp}]`
        );
        break;

      case AgentArchetype.ASSASSIN:
        // Shadow strike — teleport and attack
        if (action.targetId) {
          const target = this.state.agents.get(action.targetId);
          if (target && target.isAlive) {
            // Teleport adjacent
            agent.position.x = Math.max(0, Math.min(ARENA_SIZE - 1, target.position.x + 1));
            agent.position.y = target.position.y;

            // Deal bonus damage
            const damage = Math.floor(agent.attack * 1.5);
            target.hp = Math.max(0, target.hp - damage);
            target.damageTaken += damage;
            agent.damageDealt += damage;

            if (target.hp <= 0) {
              target.isAlive = false;
              agent.kills++;
            }

            this.addLog(
              this.state.turnNumber,
              agent.id,
              ActionType.ABILITY,
              target.id,
              damage,
              `🗡️ ${agent.name} shadow strikes ${target.name} for ${damage} damage!`
            );
          }
        }
        break;

      default:
        // Generic ability: small AOE damage or buff
        this.addLog(
          this.state.turnNumber,
          agent.id,
          ActionType.ABILITY,
          "",
          0,
          `✨ ${agent.name} uses a special ability!`
        );
        break;
    }
  }

  // ─── Turn Management ───────────────────────────────────────────

  private advanceTurn() {
    this.state.turnNumber++;

    // Find next alive agent
    let nextIndex = -1;
    const turnOrder = this.state.turnOrder.toArray();
    const currentIndex = turnOrder.indexOf(this.state.currentAgentId);

    for (let i = 1; i <= turnOrder.length; i++) {
      const candidateIndex = (currentIndex + i) % turnOrder.length;
      const candidateId = turnOrder[candidateIndex];
      const candidate = this.state.agents.get(candidateId);
      if (candidate && candidate.isAlive) {
        nextIndex = candidateIndex;
        break;
      }
    }

    if (nextIndex >= 0) {
      this.state.currentAgentId = turnOrder[nextIndex];
      this.state.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
    }
  }

  private endMatch(winnerId: string) {
    this.state.phase = MatchPhase.ENDED;
    this.state.winnerId = winnerId;

    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    const winner = this.state.agents.get(winnerId);
    const winnerName = winner ? winner.name : "Unknown";

    this.addLog(
      this.state.turnNumber,
      "system",
      ActionType.SKIP,
      winnerId,
      0,
      `🏆 MATCH OVER! ${winnerName} wins after ${this.state.turnNumber} turns!`
    );

    console.log(`[ArenaRoom] Match ended: winner=${winnerName}, turns=${this.state.turnNumber}`);

    // Broadcast final results
    this.broadcast("matchEnd", {
      winnerId,
      winnerName,
      turns: this.state.turnNumber,
      agents: this.getAgentSummary(),
    });
  }

  // ─── Agent Initialization ──────────────────────────────────────

  private initializeAgents() {
    AI_AGENTS.forEach((agentDef, index) => {
      const agent = new AgentState();
      agent.id = agentDef.id;
      agent.name = agentDef.name;
      agent.archetype = agentDef.archetype;
      agent.walletAddress = agentDef.walletAddress;

      // Set stats from archetype
      const stats = ARCHETYPE_STATS[agentDef.archetype];
      agent.hp = stats.hp;
      agent.maxHp = stats.hp;
      agent.attack = stats.attack;
      agent.defense = stats.defense;
      agent.speed = stats.speed;
      agent.ammo = stats.ammo;
      agent.maxAmmo = stats.ammo;

      // Place agents in starting positions (spread around arena)
      const positions = [
        { x: 1, y: 1 },
        { x: 8, y: 1 },
        { x: 5, y: 5 },
        { x: 1, y: 8 },
        { x: 8, y: 8 },
      ];
      agent.position = new Position();
      agent.position.x = positions[index].x;
      agent.position.y = positions[index].y;

      this.state.agents.set(agentDef.id, agent);
      this.state.turnOrder.push(agentDef.id);
    });
  }

  // ─── Blockchain Event Handling ─────────────────────────────────

  private async initEventListener() {
    // Listen for sponsored items
    this.eventListener.on("itemSponsored", (event: SponsorshipEventData) => {
      this.handleItemSponsored(event);
    });

    // Listen for bets
    this.eventListener.on("betPlaced", (event: BetPlacedEventData) => {
      this.state.totalBets++;
      this.broadcast("betPlaced", {
        user: event.user,
        agent: event.agent,
        amount: event.amount.toString(),
      });
    });

    // Listen for odds updates
    this.eventListener.on("oddsUpdated", (event: OddsUpdatedEventData) => {
      this.broadcast("oddsUpdated", {
        agent: event.agent,
        newOdds: event.newOdds.toString(),
      });
    });

    // Start listening
    try {
      await this.eventListener.start();
    } catch (error) {
      console.error("[ArenaRoom] Failed to start event listener:", error);
    }
  }

  private handleItemSponsored(event: SponsorshipEventData) {
    // Find the agent by wallet address
    let targetAgent: AgentState | undefined;
    this.state.agents.forEach((agent) => {
      if (agent.walletAddress.toLowerCase() === event.agent.toLowerCase()) {
        targetAgent = agent;
      }
    });

    if (!targetAgent || !targetAgent.isAlive) {
      console.log(`[ArenaRoom] Sponsored item for dead/unknown agent: ${event.agent}`);
      return;
    }

    // Apply item effect
    switch (event.itemType) {
      case 0: // HEALTH_PACK
        const healAmount = Math.floor(targetAgent.maxHp * 0.3);
        targetAgent.hp = Math.min(targetAgent.maxHp, targetAgent.hp + healAmount);
        this.addLog(
          this.state.turnNumber,
          targetAgent.id,
          ActionType.ABILITY,
          "",
          healAmount,
          `🎁 ${targetAgent.name} received a HEALTH PACK from spectator! (+${healAmount} HP)`
        );
        break;

      case 1: // AMMO_CRATE
        const ammoRefill = Math.floor(targetAgent.maxAmmo * 0.5);
        targetAgent.ammo = Math.min(targetAgent.maxAmmo, targetAgent.ammo + ammoRefill);
        this.addLog(
          this.state.turnNumber,
          targetAgent.id,
          ActionType.ABILITY,
          "",
          0,
          `🎁 ${targetAgent.name} received an AMMO CRATE from spectator! (+${ammoRefill} ammo)`
        );
        break;

      case 2: // SHIELD_BUBBLE
        targetAgent.hasShield = true;
        targetAgent.shieldTurns = 5;
        this.addLog(
          this.state.turnNumber,
          targetAgent.id,
          ActionType.ABILITY,
          "",
          0,
          `🎁 ${targetAgent.name} received a SHIELD BUBBLE from spectator! (5 turns)`
        );
        break;

      case 3: // DAMAGE_BOOST
        targetAgent.damageBoostTurns = 5;
        targetAgent.damageBoostMultiplier = 1.5;
        this.addLog(
          this.state.turnNumber,
          targetAgent.id,
          ActionType.ABILITY,
          "",
          0,
          `🎁 ${targetAgent.name} received a DAMAGE BOOST from spectator! (1.5x for 5 turns)`
        );
        break;
    }

    targetAgent.itemsReceived++;

    // Record sponsorship in state
    const sponsorship = new SponsorshipEvent();
    sponsorship.matchId = this.state.matchId;
    sponsorship.agentId = targetAgent.id;
    sponsorship.itemType = event.itemType;
    sponsorship.sponsor = event.sponsor;
    sponsorship.deliveryId = event.deliveryId;
    sponsorship.cost = Number(event.cost);
    sponsorship.delivered = true;
    this.state.sponsorships.push(sponsorship);
  }

  // ─── Utility Methods ───────────────────────────────────────────

  private tickStatusEffects(agent: AgentState) {
    // Tick shield
    if (agent.shieldTurns > 0) {
      agent.shieldTurns--;
      if (agent.shieldTurns <= 0) {
        agent.hasShield = false;
      }
    }

    // Tick damage boost
    if (agent.damageBoostTurns > 0) {
      agent.damageBoostTurns--;
      if (agent.damageBoostTurns <= 0) {
        agent.damageBoostMultiplier = 1;
      }
    }
  }

  private getAliveAgents(): AgentState[] {
    const alive: AgentState[] = [];
    this.state.agents.forEach((agent) => {
      if (agent.isAlive) alive.push(agent);
    });
    return alive;
  }

  private getMostHpAgent(): string {
    let bestId = "";
    let bestHp = -1;
    this.state.agents.forEach((agent) => {
      if (agent.isAlive && agent.hp > bestHp) {
        bestHp = agent.hp;
        bestId = agent.id;
      }
    });
    return bestId;
  }

  private addLog(
    turn: number,
    agentId: string,
    action: string,
    targetId: string,
    damage: number,
    description: string
  ) {
    const entry = new ActionLogEntry();
    entry.turn = turn;
    entry.agentId = agentId;
    entry.action = action;
    entry.targetId = targetId;
    entry.damage = damage;
    entry.description = description;
    entry.timestamp = Date.now();

    this.state.actionLog.push(entry);

    // Keep log bounded
    while (this.state.actionLog.length > MAX_LOG_ENTRIES) {
      this.state.actionLog.shift();
    }
  }

  private getAgentSummary() {
    const summary: any[] = [];
    this.state.agents.forEach((agent) => {
      summary.push({
        id: agent.id,
        name: agent.name,
        archetype: agent.archetype,
        hp: agent.hp,
        maxHp: agent.maxHp,
        isAlive: agent.isAlive,
        kills: agent.kills,
        damageDealt: agent.damageDealt,
        damageTaken: agent.damageTaken,
        itemsReceived: agent.itemsReceived,
      });
    });
    return summary;
  }

  private generateMatchId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `match-${timestamp}-${random}`;
  }
}
