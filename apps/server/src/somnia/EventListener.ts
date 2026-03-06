import { ethers } from "ethers";
import { EventEmitter } from "events";
import dotenv from "dotenv";

dotenv.config();

// ─── Contract ABIs (event signatures only) ───────────────────────

const SPONSORSHIP_ABI = [
  "event ItemSponsored(bytes32 indexed matchId, address indexed agent, uint8 item, address indexed sponsor, uint256 deliveryId, uint256 cost)",
  "event ItemDelivered(bytes32 indexed matchId, uint256 indexed deliveryId)",
  "event MatchRegistered(bytes32 indexed matchId, address[] agents)",
  "event MatchDeactivated(bytes32 indexed matchId)",
];

const BETTING_POOL_ABI = [
  "event BetPlaced(bytes32 indexed matchId, address indexed user, address indexed agent, uint256 amount)",
  "event OddsUpdated(bytes32 indexed matchId, address indexed agent, uint256 newOdds)",
  "event MatchAutoResolved(bytes32 indexed matchId, address indexed winner, uint256 totalPool)",
  "event PayoutDistributed(bytes32 indexed matchId, address indexed bettor, uint256 amount)",
  "event MatchCancelled(bytes32 indexed matchId)",
];

const MATCH_TIMER_ABI = [
  "event TurnAdvanced(bytes32 indexed matchId, address indexed currentAgent, uint256 turnNumber, uint256 turnDeadline)",
  "event TurnForced(bytes32 indexed matchId, address indexed agent, uint256 turnNumber)",
  "event StaleMatchDetected(bytes32 indexed matchId, uint256 inactiveDuration)",
  "event MatchAutoEnded(bytes32 indexed matchId, address indexed lastActiveAgent, string reason)",
];

// ─── Event Types ─────────────────────────────────────────────────

export interface SponsorshipEventData {
  matchId: string;
  agent: string;
  itemType: number;
  sponsor: string;
  deliveryId: number;
  cost: bigint;
}

export interface BetPlacedEventData {
  matchId: string;
  user: string;
  agent: string;
  amount: bigint;
}

export interface OddsUpdatedEventData {
  matchId: string;
  agent: string;
  newOdds: bigint;
}

// ─── Somnia Event Listener ───────────────────────────────────────

export class SomniaEventListener extends EventEmitter {
  private provider: ethers.JsonRpcProvider | ethers.WebSocketProvider | null = null;
  private sponsorshipContract: ethers.Contract | null = null;
  private bettingPoolContract: ethers.Contract | null = null;
  private matchTimerContract: ethers.Contract | null = null;
  private isListening: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly rpcUrl: string;
  private readonly wsUrl: string;
  private readonly sponsorshipAddress: string;
  private readonly bettingPoolAddress: string;
  private readonly matchTimerAddress: string;

  constructor() {
    super();
    this.rpcUrl = process.env.SOMNIA_RPC_URL || "https://dream-rpc.somnia.network";
    this.wsUrl = process.env.SOMNIA_WS_URL || "";
    this.sponsorshipAddress = process.env.SPONSORSHIP_ADDRESS || "";
    this.bettingPoolAddress = process.env.BETTING_POOL_ADDRESS || "";
    this.matchTimerAddress = process.env.MATCH_TIMER_ADDRESS || "";
  }

  /**
   * Start listening for blockchain events.
   * Uses WebSocket if available for real-time reactivity,
   * falls back to HTTP polling.
   */
  async start(): Promise<void> {
    if (this.isListening) {
      console.log("[EventListener] Already listening");
      return;
    }

    try {
      // Prefer WebSocket for real-time Somnia Reactivity
      if (this.wsUrl) {
        console.log(`[EventListener] Connecting via WebSocket: ${this.wsUrl}`);
        this.provider = new ethers.WebSocketProvider(this.wsUrl);
      } else {
        console.log(`[EventListener] Connecting via HTTP: ${this.rpcUrl}`);
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      }

      // Verify connection
      const network = await this.provider.getNetwork();
      console.log(`[EventListener] Connected to chain ${network.chainId}`);

      // Initialize contracts
      this.initContracts();

      // Subscribe to events
      this.subscribeToEvents();

      this.isListening = true;
      console.log("[EventListener] ✅ Listening for blockchain events");
    } catch (error) {
      console.error("[EventListener] ❌ Failed to connect:", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Stop listening and clean up
   */
  async stop(): Promise<void> {
    this.isListening = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.sponsorshipContract) {
      this.sponsorshipContract.removeAllListeners();
    }
    if (this.bettingPoolContract) {
      this.bettingPoolContract.removeAllListeners();
    }
    if (this.matchTimerContract) {
      this.matchTimerContract.removeAllListeners();
    }

    if (this.provider && this.provider instanceof ethers.WebSocketProvider) {
      await this.provider.destroy();
    }

    this.provider = null;
    console.log("[EventListener] Stopped");
  }

  // ─── Private Methods ───────────────────────────────────────────

  private initContracts(): void {
    if (!this.provider) return;

    if (this.sponsorshipAddress) {
      this.sponsorshipContract = new ethers.Contract(
        this.sponsorshipAddress,
        SPONSORSHIP_ABI,
        this.provider
      );
    }

    if (this.bettingPoolAddress) {
      this.bettingPoolContract = new ethers.Contract(
        this.bettingPoolAddress,
        BETTING_POOL_ABI,
        this.provider
      );
    }

    if (this.matchTimerAddress) {
      this.matchTimerContract = new ethers.Contract(
        this.matchTimerAddress,
        MATCH_TIMER_ABI,
        this.provider
      );
    }
  }

  private subscribeToEvents(): void {
    // ── Sponsorship Events ──────────────────────────────────────
    if (this.sponsorshipContract) {
      this.sponsorshipContract.on(
        "ItemSponsored",
        (matchId: string, agent: string, item: number, sponsor: string, deliveryId: bigint, cost: bigint) => {
          const event: SponsorshipEventData = {
            matchId,
            agent,
            itemType: item,
            sponsor,
            deliveryId: Number(deliveryId),
            cost,
          };
          console.log(`[EventListener] 🎁 ItemSponsored: agent=${agent}, item=${item}`);
          this.emit("itemSponsored", event);
        }
      );
    }

    // ── Betting Pool Events ─────────────────────────────────────
    if (this.bettingPoolContract) {
      this.bettingPoolContract.on(
        "BetPlaced",
        (matchId: string, user: string, agent: string, amount: bigint) => {
          const event: BetPlacedEventData = { matchId, user, agent, amount };
          console.log(`[EventListener] 💰 BetPlaced: user=${user}, agent=${agent}, amount=${ethers.formatEther(amount)} STT`);
          this.emit("betPlaced", event);
        }
      );

      this.bettingPoolContract.on(
        "OddsUpdated",
        (matchId: string, agent: string, newOdds: bigint) => {
          const event: OddsUpdatedEventData = { matchId, agent, newOdds };
          console.log(`[EventListener] 📊 OddsUpdated: agent=${agent}, odds=${newOdds.toString()}`);
          this.emit("oddsUpdated", event);
        }
      );

      this.bettingPoolContract.on(
        "MatchAutoResolved",
        (matchId: string, winner: string, totalPool: bigint) => {
          console.log(`[EventListener] 🏆 MatchAutoResolved: winner=${winner}, pool=${ethers.formatEther(totalPool)} STT`);
          this.emit("matchResolved", { matchId, winner, totalPool });
        }
      );
    }

    // ── Match Timer Events ──────────────────────────────────────
    if (this.matchTimerContract) {
      this.matchTimerContract.on(
        "TurnForced",
        (matchId: string, agent: string, turnNumber: bigint) => {
          console.log(`[EventListener] ⏰ TurnForced: agent=${agent}, turn=${turnNumber}`);
          this.emit("turnForced", { matchId, agent, turnNumber: Number(turnNumber) });
        }
      );

      this.matchTimerContract.on(
        "StaleMatchDetected",
        (matchId: string, inactiveDuration: bigint) => {
          console.log(`[EventListener] 🔴 StaleMatchDetected: inactive for ${inactiveDuration}s`);
          this.emit("staleMatch", { matchId, inactiveDuration: Number(inactiveDuration) });
        }
      );

      this.matchTimerContract.on(
        "MatchAutoEnded",
        (matchId: string, lastActiveAgent: string, reason: string) => {
          console.log(`[EventListener] 🛑 MatchAutoEnded: reason=${reason}`);
          this.emit("matchAutoEnded", { matchId, lastActiveAgent, reason });
        }
      );
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    console.log("[EventListener] Reconnecting in 5s...");
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.start();
    }, 5000);
  }
}
