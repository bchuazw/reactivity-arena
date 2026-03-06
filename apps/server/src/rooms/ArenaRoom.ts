import { Room, Client } from "colyseus";
import { ethers } from "ethers";
import {
  ActionLogEntry,
  ActionType,
  AgentArchetype,
  AgentState,
  ARCHETYPE_STATS,
  ArenaState,
  CHEST_ITEM_LABELS,
  ChestItemType,
  InventoryItem,
  MatchPhase,
  Position,
  PropType,
  SponsorshipEvent,
  TerrainType,
  DestructibleState,
  StatusEffect,
} from "../schema/ArenaState";
import { DecisionEngine, AgentAction } from "../ai/DecisionEngine";
import { MapGenerator } from "../map/MapGenerator";
import {
  SomniaEventListener,
  SponsorshipEventData,
  BetPlacedEventData,
  OddsUpdatedEventData,
} from "../somnia/EventListener";

const MAX_SPECTATORS = parseInt(process.env.MAX_SPECTATORS || "50");
const TURN_TIMEOUT_MS = parseInt(process.env.TURN_TIMEOUT_MS || "30000");
const MAX_TURNS = 100;
const ARENA_SIZE = 10;
const MAX_LOG_ENTRIES = 50;

const AI_AGENTS = [
  {
    id: "agent-vanguard",
    name: "Aegis Lance",
    archetype: AgentArchetype.VANGUARD,
    walletAddress: ethers.Wallet.createRandom().address,
  },
  {
    id: "agent-ranger",
    name: "Skyline",
    archetype: AgentArchetype.RANGER,
    walletAddress: ethers.Wallet.createRandom().address,
  },
  {
    id: "agent-medic",
    name: "Patchwire",
    archetype: AgentArchetype.MEDIC,
    walletAddress: ethers.Wallet.createRandom().address,
  },
  {
    id: "agent-saboteur",
    name: "Glitch",
    archetype: AgentArchetype.SABOTEUR,
    walletAddress: ethers.Wallet.createRandom().address,
  },
  {
    id: "agent-titan",
    name: "Bulwark",
    archetype: AgentArchetype.TITAN,
    walletAddress: ethers.Wallet.createRandom().address,
  },
];

export class ArenaRoom extends Room {
  declare state: ArenaState;
  private decisionEngine: DecisionEngine = new DecisionEngine();
  private eventListener: SomniaEventListener = new SomniaEventListener();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessingTurn: boolean = false;

  onCreate(options: any) {
    this.maxClients = MAX_SPECTATORS;
    this.setState(new ArenaState());

    this.state.bettingPoolAddress = process.env.BETTING_POOL_ADDRESS || "";
    this.state.sponsorshipAddress = process.env.SPONSORSHIP_ADDRESS || "";
    this.state.matchTimerAddress = process.env.MATCH_TIMER_ADDRESS || "";
    this.state.matchId = options.matchId || this.generateMatchId();
    this.state.maxTurns = MAX_TURNS;
    this.state.phase = MatchPhase.LOBBY;
    this.state.width = ARENA_SIZE;
    this.state.height = ARENA_SIZE;

    this.initializeMap();
    this.initializeAgents();
    this.initEventListener();

    this.onMessage("chat", (client, message) => {
      this.broadcast("chat", {
        sender: client.sessionId,
        message: message.text,
        timestamp: Date.now(),
      });
    });

    this.onMessage("startMatch", () => {
      if (this.state.phase === MatchPhase.LOBBY) this.startMatch();
    });

    console.log(`[ArenaRoom] Created room ${this.roomId} | match ${this.state.matchId}`);
  }

  onJoin(client: Client) {
    this.state.spectatorCount = this.clients.length;
    console.log(`[ArenaRoom] Spectator joined: ${client.sessionId} (${this.clients.length}/${MAX_SPECTATORS})`);

    client.send("welcome", {
      matchId: this.state.matchId,
      phase: this.state.phase,
      agents: AI_AGENTS.map((a) => ({ id: a.id, name: a.name, archetype: a.archetype })),
      mapTheme: this.state.mapTheme,
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

  private initializeMap() {
    const generator = new MapGenerator(ARENA_SIZE, ARENA_SIZE);
    const map = generator.generate();
    this.state.mapTheme = map.theme;
    this.state.tiles.push(...map.tiles);
    this.state.destructibles.push(...map.destructibles);
    this.state.chests.push(...map.chests);
  }

  private startMatch() {
    this.state.phase = MatchPhase.ACTIVE;
    this.state.startTime = Date.now();
    this.state.turnNumber = 0;

    const firstAgentId = this.state.turnOrder[0];
    this.state.currentAgentId = firstAgentId;
    this.state.turnDeadline = Date.now() + TURN_TIMEOUT_MS;

    this.addLog(0, "system", ActionType.SKIP, "", 0, "⚔️ MATCH STARTED in the Neon Ruins! Control bridges, rooftops, and loot drops.");
    this.scheduleTurn();
  }

  private async scheduleTurn() {
    if (this.state.phase !== MatchPhase.ACTIVE) return;

    await this.processCurrentTurn();

    const aliveAgents = this.getAliveAgents();
    if (aliveAgents.length <= 1 || this.state.turnNumber >= this.state.maxTurns) {
      this.endMatch(aliveAgents.length === 1 ? aliveAgents[0].id : this.getMostHpAgent());
      return;
    }

    this.advanceTurn();
    this.turnTimer = setTimeout(() => this.scheduleTurn(), 1800);
  }

  private async processCurrentTurn() {
    if (this.isProcessingTurn) return;
    this.isProcessingTurn = true;

    try {
      const agent = this.state.agents.get(this.state.currentAgentId);
      if (!agent || !agent.isAlive) return;

      this.beginTurn(agent);
      const action = await this.decisionEngine.decide(agent, this.state);
      this.executeAction(agent, action);
      this.endTurn(agent);
    } catch (error) {
      console.error(`[ArenaRoom] Error processing turn:`, error);
    } finally {
      this.isProcessingTurn = false;
    }
  }

  private beginTurn(agent: AgentState) {
    agent.isDefending = false;
    agent.actionsPerTurn = 2 + (agent.statusEffects.some((e: StatusEffect) => e.type === ChestItemType.ADRENALINE && e.turnsRemaining > 0) ? 1 : 0);

    const tile = this.getTile(agent.position.x, agent.position.y);
    if (tile?.healing && agent.isAlive) {
      const heal = 10;
      agent.hp = Math.min(agent.maxHp, agent.hp + heal);
      this.addLog(this.state.turnNumber, agent.id, ActionType.ABILITY, agent.id, heal, `🩺 ${agent.name} regenerates ${heal} HP in a med station.`);
    }

    if (tile?.elevation > 0) {
      agent.bonusRange = 1;
    } else {
      agent.bonusRange = 0;
    }
  }

  private endTurn(agent: AgentState) {
    this.tickStatusEffects(agent);
  }

  private executeAction(agent: AgentState, action: AgentAction) {
    switch (action.type) {
      case ActionType.ATTACK:
        this.executeAttack(agent, action);
        break;
      case ActionType.DEFEND:
        this.executeDefend(agent);
        break;
      case ActionType.MOVE:
        this.executeMove(agent, action);
        break;
      case ActionType.ABILITY:
        this.executeAbility(agent, action);
        break;
      case ActionType.OPEN_CHEST:
        this.executeOpenChest(agent, action);
        break;
      case ActionType.USE_ITEM:
        this.executeUseItem(agent, action.itemType);
        break;
      case ActionType.SKIP:
      default:
        this.addLog(this.state.turnNumber, agent.id, ActionType.SKIP, "", 0, `${agent.name} holds position and reassesses.`);
    }
  }

  private executeAttack(agent: AgentState, action: AgentAction) {
    if (!action.targetId) return;
    const target = this.state.agents.get(action.targetId);
    if (!target || !target.isAlive) return;

    const distance = this.distance(agent.position, target.position);
    const range = agent.attackRange + agent.bonusRange;
    if (distance > range) {
      this.addLog(this.state.turnNumber, agent.id, ActionType.SKIP, target.id, 0, `${agent.name} has no clean shot on ${target.name}.`);
      return;
    }

    let baseDamage = agent.attack + Math.floor(Math.random() * 4);
    if (agent.damageBoostTurns > 0) baseDamage = Math.floor(baseDamage * agent.damageBoostMultiplier);

    const attackerTile = this.getTile(agent.position.x, agent.position.y);
    const targetTile = this.getTile(target.position.x, target.position.y);

    if ((attackerTile?.elevation || 0) > (targetTile?.elevation || 0)) baseDamage += 2;
    if (targetTile?.vulnerable) baseDamage += 2;
    if (targetTile?.providesCover || this.hasAdjacentCover(target.position.x, target.position.y)) baseDamage -= 3;
    if (targetTile?.concealment && agent.revealTurns <= 0) baseDamage -= 2;
    if (distance <= 1 && agent.archetype === AgentArchetype.RANGER) baseDamage -= 3;

    let actualDamage = Math.max(1, baseDamage - target.defense);
    if (target.hasShield && target.shieldTurns > 0) actualDamage = Math.floor(actualDamage * 0.65);
    if (target.isDefending) actualDamage = Math.floor(actualDamage * 0.6);
    if (target.protectedByTitanTurns > 0) actualDamage = Math.floor(actualDamage * 0.8);

    if (agent.archetype === AgentArchetype.RANGER) {
      const lineTarget = this.findSecondTargetInLine(agent, target);
      if (lineTarget) {
        this.applyDamage(agent, lineTarget, Math.max(1, Math.floor(actualDamage * 0.6)), `${agent.name}'s piercing shot clips ${lineTarget.name}!`);
      }
    }

    if (this.tryDamageDestructibleAt(target.position.x, target.position.y, actualDamage, agent)) {
      this.addLog(this.state.turnNumber, agent.id, ActionType.ATTACK, target.id, actualDamage, `💥 ${agent.name} blasts through cover near ${target.name}.`);
    }

    const killed = this.applyDamage(agent, target, actualDamage, `⚔️ ${agent.name} hits ${target.name} for ${actualDamage} damage.`);
    if (!killed) {
      this.addLog(this.state.turnNumber, agent.id, ActionType.ATTACK, target.id, actualDamage, `⚔️ ${agent.name} hits ${target.name} for ${actualDamage} damage [${target.hp}/${target.maxHp} HP].`);
    }

    if (agent.ammo > 0) agent.ammo--;
  }

  private executeDefend(agent: AgentState) {
    agent.isDefending = true;
    const healAmount = 8;
    agent.hp = Math.min(agent.maxHp, agent.hp + healAmount);
    agent.hasShield = true;
    agent.shieldTurns = Math.max(agent.shieldTurns, 1);

    this.addLog(this.state.turnNumber, agent.id, ActionType.DEFEND, "", 0, `🛡️ ${agent.name} fortifies, gains guard, and recovers ${healAmount} HP.`);
  }

  private executeMove(agent: AgentState, action: AgentAction) {
    const destination = this.findBestReachableDestination(agent, action.targetX, action.targetY);
    if (!destination) {
      this.addLog(this.state.turnNumber, agent.id, ActionType.SKIP, "", 0, `${agent.name} cannot find a route and steadies up.`);
      return;
    }

    agent.position.x = destination.x;
    agent.position.y = destination.y;

    const tile = this.getTile(destination.x, destination.y);
    const terrainLabel = tile?.terrain ?? TerrainType.GROUND;
    this.addLog(this.state.turnNumber, agent.id, ActionType.MOVE, "", 0, `🏃 ${agent.name} moves to (${destination.x}, ${destination.y}) across ${terrainLabel}.`);
  }

  private executeAbility(agent: AgentState, action: AgentAction) {
    switch (agent.archetype) {
      case AgentArchetype.VANGUARD:
        this.executeVanguardAbility(agent, action);
        break;
      case AgentArchetype.RANGER:
        this.executeRangerAbility(agent, action);
        break;
      case AgentArchetype.MEDIC:
        this.executeMedicAbility(agent, action);
        break;
      case AgentArchetype.SABOTEUR:
        this.executeSaboteurAbility(agent, action);
        break;
      case AgentArchetype.TITAN:
        this.executeTitanAbility(agent);
        break;
      default:
        this.addLog(this.state.turnNumber, agent.id, ActionType.ABILITY, "", 0, `✨ ${agent.name} uses a tactical ability.`);
    }
  }

  private executeVanguardAbility(agent: AgentState, action: AgentAction) {
    if (!action.targetId) return;
    const target = this.state.agents.get(action.targetId);
    if (!target || !target.isAlive) return;

    const adjacent = this.findAdjacentFreeCell(target.position.x, target.position.y);
    if (adjacent) {
      agent.position.x = adjacent.x;
      agent.position.y = adjacent.y;
    }

    const damage = Math.max(8, agent.attack + 2 - target.defense);
    this.applyDamage(agent, target, damage, `⚡ ${agent.name} charges into ${target.name} for ${damage} damage!`);

    [...this.state.agents.values()]
      .filter((ally) => ally.id !== agent.id && ally.isAlive && this.distance(agent.position, ally.position) <= 2)
      .forEach((ally) => {
        ally.damageBoostTurns = Math.max(ally.damageBoostTurns, 1);
        ally.damageBoostMultiplier = Math.max(ally.damageBoostMultiplier, 1.2);
      });

    this.addLog(this.state.turnNumber, agent.id, ActionType.ABILITY, target.id, damage, `⚡ ${agent.name} charges and inspires nearby allies.`);
  }

  private executeRangerAbility(agent: AgentState, action: AgentAction) {
    if (!action.targetId) return;
    const target = this.state.agents.get(action.targetId);
    if (!target || !target.isAlive) return;

    const firstHit = Math.max(8, agent.attack + 4 - target.defense);
    this.applyDamage(agent, target, firstHit, `🎯 ${agent.name} fires a piercing shot into ${target.name}.`);
    const second = this.findSecondTargetInLine(agent, target);
    if (second) {
      const splash = Math.max(6, Math.floor(firstHit * 0.75));
      this.applyDamage(agent, second, splash, `🎯 ${second.name} is pierced through the same lane.`);
      this.addLog(this.state.turnNumber, agent.id, ActionType.ABILITY, second.id, splash, `🎯 ${agent.name}'s piercing shot also hits ${second.name} for ${splash}.`);
    }
  }

  private executeMedicAbility(agent: AgentState, action: AgentAction) {
    const reviveTarget = action.targetId ? this.state.agents.get(action.targetId) : undefined;
    if (reviveTarget && !reviveTarget.isAlive && agent.reviveAvailable && this.distance(agent.position, reviveTarget.position) <= 1) {
      reviveTarget.isAlive = true;
      reviveTarget.hp = Math.floor(reviveTarget.maxHp * 0.4);
      agent.reviveAvailable = false;
      this.addLog(this.state.turnNumber, agent.id, ActionType.ABILITY, reviveTarget.id, 0, `💚 ${agent.name} revives ${reviveTarget.name}!`);
      return;
    }

    [...this.state.agents.values()]
      .filter((ally) => ally.isAlive && this.distance(agent.position, ally.position) <= 2)
      .forEach((ally) => {
        ally.hp = Math.min(ally.maxHp, ally.hp + 16);
        ally.smokeTurns = Math.max(ally.smokeTurns, 1);
      });

    this.addLog(this.state.turnNumber, agent.id, ActionType.ABILITY, action.targetId || "", 16, `💚 ${agent.name} releases a heal burst and smoke cover.`);
  }

  private executeSaboteurAbility(agent: AgentState, action: AgentAction) {
    if (!action.targetId) return;
    const target = this.state.agents.get(action.targetId);
    if (!target || !target.isAlive) return;

    const adjacent = this.findAdjacentFreeCell(target.position.x, target.position.y);
    if (adjacent) {
      agent.position.x = adjacent.x;
      agent.position.y = adjacent.y;
    }

    target.disabledTurns = Math.max(target.disabledTurns, 1);
    this.destroyAdjacentCover(target.position.x, target.position.y, agent);
    const damage = Math.max(8, agent.attack + 1 - target.defense);
    this.applyDamage(agent, target, damage, `🧨 ${agent.name} EMP-blasts ${target.name} for ${damage}.`);
    this.addLog(this.state.turnNumber, agent.id, ActionType.ABILITY, target.id, damage, `🧨 ${agent.name} hacks cover and disables ${target.name}'s abilities.`);
  }

  private executeTitanAbility(agent: AgentState) {
    [...this.state.agents.values()]
      .filter((ally) => ally.id !== agent.id && ally.isAlive && this.distance(agent.position, ally.position) <= 1)
      .forEach((ally) => {
        ally.protectedByTitanTurns = 1;
        ally.hasShield = true;
        ally.shieldTurns = Math.max(ally.shieldTurns, 1);
      });

    if (agent.barrierAvailable) {
      const cell = this.findAdjacentFreeCell(agent.position.x, agent.position.y);
      if (cell) this.spawnBarrier(cell.x, cell.y);
      agent.barrierAvailable = false;
      agent.barrierCooldown = 3;
    }

    this.addLog(this.state.turnNumber, agent.id, ActionType.ABILITY, "", 0, `🧱 ${agent.name} raises a cover barrier and shields nearby allies.`);
  }

  private executeOpenChest(agent: AgentState, action: AgentAction) {
    const chest = [...this.state.chests].find((item) => item.id === action.chestId && !item.opened);
    if (!chest) return;
    if (this.distance(agent.position, chest.position) !== 1) return;

    chest.opened = true;
    agent.itemsReceived++;

    const inventoryItem = new InventoryItem();
    inventoryItem.type = chest.itemType;
    inventoryItem.consumed = false;
    agent.inventory.push(inventoryItem);

    this.addLog(this.state.turnNumber, agent.id, ActionType.OPEN_CHEST, chest.id, 0, `📦 ${agent.name} opens a chest and finds ${CHEST_ITEM_LABELS[chest.itemType]}.`);

    if (chest.autoEquip) {
      this.executeUseItem(agent, chest.itemType, true);
    }
  }

  private executeUseItem(agent: AgentState, itemType?: string, auto: boolean = false) {
    if (!itemType) return;
    const item = [...agent.inventory].find((entry) => entry.type === itemType && !entry.consumed);
    if (!item) return;

    switch (itemType) {
      case ChestItemType.MEDKIT:
        agent.hp = Math.min(agent.maxHp, agent.hp + 30);
        break;
      case ChestItemType.AMMO_CRATE:
        agent.ammo = agent.maxAmmo;
        agent.damageBoostTurns = Math.max(agent.damageBoostTurns, 1);
        agent.damageBoostMultiplier = Math.max(agent.damageBoostMultiplier, 1.35);
        break;
      case ChestItemType.SHIELD_BATTERY:
        agent.temporaryHp += 50;
        agent.hasShield = true;
        agent.shieldTurns = Math.max(agent.shieldTurns, 3);
        break;
      case ChestItemType.GRENADE: {
        const target = this.findClosestEnemy(agent);
        if (target) {
          [...this.state.agents.values()]
            .filter((enemy) => enemy.isAlive && this.distance(enemy.position, target.position) <= 1)
            .forEach((enemy) => this.applyDamage(agent, enemy, 14, `💣 ${agent.name}'s grenade detonates near ${enemy.name}.`));
        }
        break;
      }
      case ChestItemType.SPEED_BOOST:
        agent.speedBoostTurns = Math.max(agent.speedBoostTurns, 2);
        break;
      case ChestItemType.RECON_DRONE:
        agent.revealTurns = Math.max(agent.revealTurns, 2);
        break;
      case ChestItemType.ADRENALINE: {
        const status = agent.statusEffects.find((effect: StatusEffect) => effect.type === ChestItemType.ADRENALINE);
        if (status) {
          status.turnsRemaining = 1;
          status.magnitude = 1;
        } else {
          const adrenaline = new StatusEffect();
          adrenaline.type = ChestItemType.ADRENALINE;
          adrenaline.turnsRemaining = 1;
          adrenaline.magnitude = 1;
          agent.statusEffects.push(adrenaline);
        }
        agent.actionsPerTurn = 3;
        break;
      }
    }

    item.consumed = true;
    this.addLog(this.state.turnNumber, agent.id, ActionType.USE_ITEM, "", 0, `${auto ? "✨" : "🎒"} ${agent.name} uses ${CHEST_ITEM_LABELS[itemType]}.`);
  }

  private advanceTurn() {
    this.state.turnNumber++;
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

    this.addLog(this.state.turnNumber, "system", ActionType.SKIP, winnerId, 0, `🏆 MATCH OVER! ${winnerName} owns the Neon Ruins after ${this.state.turnNumber} turns.`);

    this.broadcast("matchEnd", {
      winnerId,
      winnerName,
      turns: this.state.turnNumber,
      agents: this.getAgentSummary(),
    });
  }

  private initializeAgents() {
    const spawnPoints = [
      { x: 0, y: 0 },
      { x: 9, y: 0 },
      { x: 0, y: 9 },
      { x: 9, y: 9 },
      { x: 2, y: 9 },
    ];

    AI_AGENTS.forEach((agentDef, index) => {
      const agent = new AgentState();
      agent.id = agentDef.id;
      agent.name = agentDef.name;
      agent.archetype = agentDef.archetype;
      agent.walletAddress = agentDef.walletAddress;

      const stats = ARCHETYPE_STATS[agentDef.archetype];
      agent.hp = stats.hp;
      agent.maxHp = stats.hp;
      agent.attack = stats.attack;
      agent.defense = stats.defense;
      agent.speed = stats.speed;
      agent.ammo = stats.ammo;
      agent.maxAmmo = stats.ammo;
      agent.attackRange = stats.attackRange;

      agent.position = new Position();
      agent.position.x = spawnPoints[index].x;
      agent.position.y = spawnPoints[index].y;

      this.state.agents.set(agentDef.id, agent);
      this.state.turnOrder.push(agentDef.id);
    });
  }

  private async initEventListener() {
    this.eventListener.on("itemSponsored", (event: SponsorshipEventData) => {
      this.handleItemSponsored(event);
    });

    this.eventListener.on("betPlaced", (event: BetPlacedEventData) => {
      this.state.totalBets++;
      this.broadcast("betPlaced", {
        user: event.user,
        agent: event.agent,
        amount: event.amount.toString(),
      });
    });

    this.eventListener.on("oddsUpdated", (event: OddsUpdatedEventData) => {
      this.broadcast("oddsUpdated", {
        agent: event.agent,
        newOdds: event.newOdds.toString(),
      });
    });

    try {
      await this.eventListener.start();
    } catch (error) {
      console.error("[ArenaRoom] Failed to start event listener:", error);
    }
  }

  private handleItemSponsored(event: SponsorshipEventData) {
    let targetAgent: AgentState | undefined;
    this.state.agents.forEach((agent: AgentState) => {
      if (agent.walletAddress.toLowerCase() === event.agent.toLowerCase()) targetAgent = agent;
    });

    if (!targetAgent || !targetAgent.isAlive) return;

    switch (event.itemType) {
      case 0:
        targetAgent.hp = Math.min(targetAgent.maxHp, targetAgent.hp + 25);
        break;
      case 1:
        targetAgent.ammo = targetAgent.maxAmmo;
        break;
      case 2:
        targetAgent.hasShield = true;
        targetAgent.shieldTurns = 3;
        break;
      case 3:
        targetAgent.damageBoostTurns = 3;
        targetAgent.damageBoostMultiplier = 1.35;
        break;
    }

    targetAgent.itemsReceived++;

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

  private tickStatusEffects(agent: AgentState) {
    if (agent.shieldTurns > 0) {
      agent.shieldTurns--;
      if (agent.shieldTurns <= 0) agent.hasShield = false;
    }

    if (agent.damageBoostTurns > 0) {
      agent.damageBoostTurns--;
      if (agent.damageBoostTurns <= 0) agent.damageBoostMultiplier = 1;
    }

    if (agent.speedBoostTurns > 0) agent.speedBoostTurns--;
    if (agent.revealTurns > 0) agent.revealTurns--;
    if (agent.smokeTurns > 0) agent.smokeTurns--;
    if (agent.disabledTurns > 0) agent.disabledTurns--;
    if (agent.protectedByTitanTurns > 0) agent.protectedByTitanTurns--;
    if (agent.barrierCooldown > 0) {
      agent.barrierCooldown--;
      if (agent.barrierCooldown <= 0) agent.barrierAvailable = true;
    }

    agent.statusEffects.forEach((effect: StatusEffect) => {
      if (effect.turnsRemaining > 0) effect.turnsRemaining--;
    });
    for (let i = agent.statusEffects.length - 1; i >= 0; i--) {
      if (agent.statusEffects[i].turnsRemaining <= 0) agent.statusEffects.splice(i, 1);
    }

    if (agent.temporaryHp > 0) {
      agent.temporaryHp = Math.max(0, agent.temporaryHp - 17);
    }
  }

  private findBestReachableDestination(agent: AgentState, targetX?: number, targetY?: number) {
    const mobility = Math.max(1, agent.speed + (agent.speedBoostTurns > 0 ? agent.speed : 0));
    if (targetX === undefined || targetY === undefined) return null;

    const dx = targetX - agent.position.x;
    const dy = targetY - agent.position.y;
    const stepCount = Math.min(mobility, Math.abs(dx) + Math.abs(dy));

    let currentX = agent.position.x;
    let currentY = agent.position.y;
    let remaining = stepCount;

    while (remaining > 0) {
      const nextX = currentX + (dx === 0 ? 0 : dx > 0 ? 1 : -1);
      const nextY = currentY + (Math.abs(dx) >= Math.abs(dy) ? 0 : dy > 0 ? 1 : -1);

      const candidate = this.canStand(nextX, nextY) ? { x: nextX, y: nextY } : this.findAdjacentFreeCell(currentX, currentY);
      if (!candidate) break;
      currentX = candidate.x;
      currentY = candidate.y;
      remaining--;
    }

    return { x: currentX, y: currentY };
  }

  private canStand(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.state.width || y >= this.state.height) return false;
    const tile = this.getTile(x, y);
    if (!tile || tile.blocksMovement) return false;
    if ([...this.state.agents.values()].some((agent) => agent.isAlive && agent.position.x === x && agent.position.y === y)) return false;
    if ([...this.state.destructibles].some((prop) => prop.hp > 0 && prop.blocksMovement && prop.position.x === x && prop.position.y === y)) return false;
    return true;
  }

  private getTile(x: number, y: number) {
    return [...this.state.tiles].find((tile) => tile.position.x === x && tile.position.y === y);
  }

  private hasAdjacentCover(x: number, y: number) {
    return [...this.state.tiles].some((tile) => tile.providesCover && this.distance(tile.position, { x, y }) === 1) ||
      [...this.state.destructibles].some((prop) => prop.hp > 0 && prop.providesCover && this.distance(prop.position, { x, y }) === 1);
  }

  private tryDamageDestructibleAt(x: number, y: number, damage: number, source: AgentState) {
    const prop = [...this.state.destructibles].find((item) => item.hp > 0 && this.distance(item.position, { x, y }) <= 1);
    if (!prop) return false;
    prop.hp = Math.max(0, prop.hp - Math.ceil(damage * 0.4));
    if (prop.hp <= 0) this.destroyDestructible(prop, source);
    return true;
  }

  private destroyAdjacentCover(x: number, y: number, source: AgentState) {
    [...this.state.destructibles]
      .filter((prop) => prop.hp > 0 && this.distance(prop.position, { x, y }) <= 1)
      .forEach((prop) => this.destroyDestructible(prop, source));
  }

  private destroyDestructible(prop: DestructibleState, source: AgentState) {
    prop.hp = 0;
    this.addLog(this.state.turnNumber, source.id, ActionType.ABILITY, prop.id, 0, `💥 ${source.name} destroys ${prop.type} at (${prop.position.x}, ${prop.position.y}).`);

    if (prop.explosive) {
      [...this.state.agents.values()]
        .filter((agent) => agent.isAlive && this.distance(agent.position, prop.position) <= prop.blastRadius)
        .forEach((agent) => this.applyDamage(source, agent, prop.damage, `💥 Explosion rocks ${agent.name}!`));
    }
  }

  private spawnBarrier(x: number, y: number) {
    const barrier = new DestructibleState();
    barrier.id = `barrier-${Date.now()}`;
    barrier.type = PropType.BARRIER;
    barrier.position = new Position();
    barrier.position.x = x;
    barrier.position.y = y;
    barrier.hp = 20;
    barrier.maxHp = 20;
    barrier.blocksMovement = true;
    barrier.providesCover = true;
    barrier.explosive = false;
    barrier.blastRadius = 0;
    barrier.damage = 0;
    this.state.destructibles.push(barrier);
  }

  private findSecondTargetInLine(attacker: AgentState, primary: AgentState) {
    const dx = Math.sign(primary.position.x - attacker.position.x);
    const dy = Math.sign(primary.position.y - attacker.position.y);
    return [...this.state.agents.values()].find((agent) => {
      if (!agent.isAlive || agent.id === attacker.id || agent.id === primary.id) return false;
      const relX = agent.position.x - primary.position.x;
      const relY = agent.position.y - primary.position.y;
      return (dx !== 0 && relY === 0 && Math.sign(relX) === dx) || (dy !== 0 && relX === 0 && Math.sign(relY) === dy);
    });
  }

  private applyDamage(source: AgentState, target: AgentState, amount: number, log?: string) {
    let remaining = amount;
    if (target.temporaryHp > 0) {
      const absorbed = Math.min(target.temporaryHp, remaining);
      target.temporaryHp -= absorbed;
      remaining -= absorbed;
    }

    target.hp = Math.max(0, target.hp - remaining);
    target.damageTaken += amount;
    source.damageDealt += amount;

    if (target.hp <= 0 && target.isAlive) {
      target.isAlive = false;
      source.kills++;
      this.addLog(this.state.turnNumber, source.id, ActionType.ATTACK, target.id, amount, `💀 ${source.name} eliminates ${target.name}!`);
      return true;
    }

    if (log) this.addLog(this.state.turnNumber, source.id, ActionType.ATTACK, target.id, amount, log);
    return false;
  }

  private findClosestEnemy(agent: AgentState) {
    return [...this.state.agents.values()]
      .filter((other) => other.id !== agent.id && other.isAlive)
      .sort((a, b) => this.distance(agent.position, a.position) - this.distance(agent.position, b.position))[0];
  }

  private findAdjacentFreeCell(x: number, y: number) {
    const candidates = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
    return candidates.find((cell) => this.canStand(cell.x, cell.y)) || null;
  }

  private getAliveAgents(): AgentState[] {
    const alive: AgentState[] = [];
    this.state.agents.forEach((agent: AgentState) => {
      if (agent.isAlive) alive.push(agent);
    });
    return alive;
  }

  private getMostHpAgent(): string {
    let bestId = "";
    let bestHp = -1;
    this.state.agents.forEach((agent: AgentState) => {
      if (agent.isAlive && agent.hp + agent.temporaryHp > bestHp) {
        bestHp = agent.hp + agent.temporaryHp;
        bestId = agent.id;
      }
    });
    return bestId;
  }

  private addLog(turn: number, agentId: string, action: string, targetId: string, damage: number, description: string) {
    const entry = new ActionLogEntry();
    entry.turn = turn;
    entry.agentId = agentId;
    entry.action = action;
    entry.targetId = targetId;
    entry.damage = damage;
    entry.description = description;
    entry.timestamp = Date.now();

    this.state.actionLog.push(entry);
    while (this.state.actionLog.length > MAX_LOG_ENTRIES) this.state.actionLog.shift();
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
        temporaryHp: agent.temporaryHp,
        isAlive: agent.isAlive,
        kills: agent.kills,
        damageDealt: agent.damageDealt,
        damageTaken: agent.damageTaken,
        itemsReceived: agent.itemsReceived,
      });
    });
    return summary;
  }

  private distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private generateMatchId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `match-${timestamp}-${random}`;
  }
}
