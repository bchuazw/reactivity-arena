// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ReactiveBettingPool
 * @notice Betting pool with reactive odds updates for Reactivity Arena
 * @dev Auto-updates betting odds and triggers payouts on Somnia Testnet
 *
 * Reactivity Features:
 * - OddsUpdated event emitted on every bet → subscribers see instant odds
 * - MatchAutoResolved event triggers automatic payout distribution
 * - No polling, no oracles — pure reactive event-driven architecture
 */
contract ReactiveBettingPool {
    // ─── Types ───────────────────────────────────────────────────────

    enum MatchState {
        PENDING,
        ACTIVE,
        RESOLVED,
        CANCELLED
    }

    struct MatchInfo {
        bytes32 matchId;
        uint256 totalPool;
        uint256 houseFeeBps; // basis points, e.g. 700 = 7%
        MatchState state;
        address winner;
        uint256 startTime;
        uint256 turnDeadline;
        uint256 agentCount;
    }

    // ─── Constants ───────────────────────────────────────────────────

    uint256 public constant MIN_BET = 0.0001 ether;
    uint256 public constant MAX_AGENTS_PER_MATCH = 10;

    // ─── State ───────────────────────────────────────────────────────

    address public owner;
    address public gameServer;
    address public houseWallet;

    mapping(bytes32 => MatchInfo) public matches;
    mapping(bytes32 => address[]) public matchAgents;
    mapping(bytes32 => mapping(address => uint256)) public agentPools; // matchId => agent => total bets
    mapping(bytes32 => mapping(address => mapping(address => uint256))) public userBets; // matchId => user => agent => amount
    mapping(bytes32 => mapping(address => address[])) internal agentBettors; // matchId => agent => bettor[]
    mapping(bytes32 => mapping(address => mapping(address => bool))) internal hasBet; // matchId => agent => bettor => bool

    // ─── Events (REACTIVE — subscribers receive these instantly) ─────

    event MatchCreated(bytes32 indexed matchId, address[] agents, uint256 houseFeeBps);
    event BetPlaced(bytes32 indexed matchId, address indexed user, address indexed agent, uint256 amount);
    event OddsUpdated(bytes32 indexed matchId, address indexed agent, uint256 newOdds);
    event MatchStarted(bytes32 indexed matchId, uint256 startTime);
    event MatchAutoResolved(bytes32 indexed matchId, address indexed winner, uint256 totalPool);
    event PayoutDistributed(bytes32 indexed matchId, address indexed bettor, uint256 amount);
    event MatchCancelled(bytes32 indexed matchId);

    // ─── Modifiers ───────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyGameServer() {
        require(msg.sender == gameServer, "Only game server");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────

    constructor(address _houseWallet, uint256 _defaultHouseFeeBps) {
        require(_houseWallet != address(0), "Invalid house wallet");
        require(_defaultHouseFeeBps <= 1000, "Fee too high"); // Max 10%
        owner = msg.sender;
        gameServer = msg.sender; // Initially owner is game server
        houseWallet = _houseWallet;
    }

    // ─── Admin Functions ─────────────────────────────────────────────

    function setGameServer(address _gameServer) external onlyOwner {
        require(_gameServer != address(0), "Invalid address");
        gameServer = _gameServer;
    }

    function setHouseWallet(address _houseWallet) external onlyOwner {
        require(_houseWallet != address(0), "Invalid address");
        houseWallet = _houseWallet;
    }

    // ─── Match Management ────────────────────────────────────────────

    function createMatch(
        bytes32 matchId,
        address[] calldata agents,
        uint256 houseFeeBps
    ) external onlyGameServer {
        require(matches[matchId].state == MatchState.PENDING, "Match already exists");
        require(agents.length >= 2 && agents.length <= MAX_AGENTS_PER_MATCH, "Invalid agent count");
        require(houseFeeBps <= 1000, "Fee too high");

        matches[matchId] = MatchInfo({
            matchId: matchId,
            totalPool: 0,
            houseFeeBps: houseFeeBps,
            state: MatchState.ACTIVE,
            winner: address(0),
            startTime: block.timestamp,
            turnDeadline: block.timestamp + 30,
            agentCount: agents.length
        });

        for (uint256 i = 0; i < agents.length; i++) {
            matchAgents[matchId].push(agents[i]);
        }

        emit MatchCreated(matchId, agents, houseFeeBps);
        emit MatchStarted(matchId, block.timestamp);
    }

    // ─── Betting (REACTIVE: Auto-updates odds on every bet) ─────────

    function placeBet(bytes32 matchId, address agent) external payable {
        MatchInfo storage m = matches[matchId];
        require(m.state == MatchState.ACTIVE, "Match not active");
        require(msg.value >= MIN_BET, "Bet too small");
        require(_isAgentInMatch(matchId, agent), "Agent not in match");

        m.totalPool += msg.value;
        agentPools[matchId][agent] += msg.value;
        userBets[matchId][msg.sender][agent] += msg.value;

        // Track unique bettors for payout distribution
        if (!hasBet[matchId][agent][msg.sender]) {
            hasBet[matchId][agent][msg.sender] = true;
            agentBettors[matchId][agent].push(msg.sender);
        }

        emit BetPlaced(matchId, msg.sender, agent, msg.value);

        // REACTIVE: Auto-calculate and emit new odds for ALL agents
        _updateAllOdds(matchId);
    }

    // ─── Match Resolution (REACTIVE: Auto-distributes payouts) ───────

    function resolveMatch(bytes32 matchId, address winner) external onlyGameServer {
        MatchInfo storage m = matches[matchId];
        require(m.state == MatchState.ACTIVE, "Not active");
        require(_isAgentInMatch(matchId, winner), "Winner not in match");

        m.winner = winner;
        m.state = MatchState.RESOLVED;

        // REACTIVE: Auto-distribute payouts to all winning bettors
        _autoDistributePayouts(matchId, winner);

        emit MatchAutoResolved(matchId, winner, m.totalPool);
    }

    function cancelMatch(bytes32 matchId) external onlyGameServer {
        MatchInfo storage m = matches[matchId];
        require(m.state == MatchState.ACTIVE, "Not active");

        m.state = MatchState.CANCELLED;

        // Refund all bets
        address[] memory agents = matchAgents[matchId];
        for (uint256 i = 0; i < agents.length; i++) {
            address agent = agents[i];
            address[] memory bettors = agentBettors[matchId][agent];
            for (uint256 j = 0; j < bettors.length; j++) {
                address bettor = bettors[j];
                uint256 amount = userBets[matchId][bettor][agent];
                if (amount > 0) {
                    userBets[matchId][bettor][agent] = 0;
                    (bool sent, ) = bettor.call{value: amount}("");
                    require(sent, "Refund failed");
                }
            }
        }

        emit MatchCancelled(matchId);
    }

    // ─── View Functions ──────────────────────────────────────────────

    function calculateOdds(bytes32 matchId, address agent) public view returns (uint256) {
        uint256 totalPool = matches[matchId].totalPool;
        if (totalPool == 0) return 100; // 1:1 baseline (100 = 1.00x)

        uint256 pool = agentPools[matchId][agent];
        if (pool == 0) return 1000; // 10:1 odds for zero bets

        // Odds = (totalPool / agentPool) * 100
        return (totalPool * 100) / pool;
    }

    function getMatchAgents(bytes32 matchId) external view returns (address[] memory) {
        return matchAgents[matchId];
    }

    function getAgentBettors(bytes32 matchId, address agent) external view returns (address[] memory) {
        return agentBettors[matchId][agent];
    }

    function getUserBet(bytes32 matchId, address user, address agent) external view returns (uint256) {
        return userBets[matchId][user][agent];
    }

    function getMatchInfo(bytes32 matchId)
        external
        view
        returns (
            uint256 totalPool,
            MatchState state,
            address winner,
            uint256 startTime,
            uint256 agentCount
        )
    {
        MatchInfo storage m = matches[matchId];
        return (m.totalPool, m.state, m.winner, m.startTime, m.agentCount);
    }

    // ─── Internal Functions ──────────────────────────────────────────

    function _updateAllOdds(bytes32 matchId) internal {
        address[] memory agents = matchAgents[matchId];
        for (uint256 i = 0; i < agents.length; i++) {
            uint256 odds = calculateOdds(matchId, agents[i]);
            // REACTIVE: Subscribers receive this event instantly
            emit OddsUpdated(matchId, agents[i], odds);
        }
    }

    function _autoDistributePayouts(bytes32 matchId, address winner) internal {
        MatchInfo storage m = matches[matchId];
        uint256 totalPool = m.totalPool;

        if (totalPool == 0) return;

        uint256 houseFee = (totalPool * m.houseFeeBps) / 10000;
        uint256 prizePool = totalPool - houseFee;

        // Transfer house fee
        if (houseFee > 0) {
            (bool feeSuccess, ) = houseWallet.call{value: houseFee}("");
            require(feeSuccess, "House fee transfer failed");
        }

        // Distribute winnings proportionally to winning bettors
        uint256 winningPool = agentPools[matchId][winner];
        if (winningPool == 0) {
            // No one bet on the winner — house keeps the pool
            (bool houseSuccess, ) = houseWallet.call{value: prizePool}("");
            require(houseSuccess, "House transfer failed");
            return;
        }

        address[] memory winners = agentBettors[matchId][winner];
        for (uint256 i = 0; i < winners.length; i++) {
            address bettor = winners[i];
            uint256 betAmount = userBets[matchId][bettor][winner];
            if (betAmount == 0) continue;

            uint256 winnings = (betAmount * prizePool) / winningPool;

            // Instant payout — no claim needed!
            (bool sent, ) = bettor.call{value: winnings}("");
            require(sent, "Payout failed");

            emit PayoutDistributed(matchId, bettor, winnings);
        }
    }

    function _isAgentInMatch(bytes32 matchId, address agent) internal view returns (bool) {
        address[] memory agents = matchAgents[matchId];
        for (uint256 i = 0; i < agents.length; i++) {
            if (agents[i] == agent) return true;
        }
        return false;
    }

    // ─── Receive ─────────────────────────────────────────────────────

    receive() external payable {}
}
