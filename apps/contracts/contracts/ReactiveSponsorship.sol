// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ReactiveSponsorship
 * @notice Instant item delivery to game via reactive events on Somnia
 * @dev Spectators sponsor items for AI agents during live matches.
 *      ItemSponsored events are pushed instantly to the game server
 *      via Somnia Reactivity subscriptions — no polling required.
 *
 * Item Types:
 *   0 = HEALTH_PACK     — Restores agent HP
 *   1 = AMMO_CRATE      — Refills ammunition
 *   2 = SHIELD_BUBBLE   — Temporary damage reduction
 *   3 = DAMAGE_BOOST    — Temporary damage increase
 */
contract ReactiveSponsorship {
    // ─── Types ───────────────────────────────────────────────────────

    enum ItemType {
        HEALTH_PACK,
        AMMO_CRATE,
        SHIELD_BUBBLE,
        DAMAGE_BOOST
    }

    struct Sponsorship {
        address sponsor;
        address agent;
        ItemType item;
        uint256 cost;
        uint256 timestamp;
        bool delivered;
    }

    struct MatchSponsorStats {
        uint256 totalSponsored;
        uint256 totalValue;
        bool active;
    }

    // ─── State ───────────────────────────────────────────────────────

    address public owner;
    address public gameServer;
    address public houseWallet;
    address public bettingPool; // Prize pool receives portion of sponsorship fees

    uint256 public prizePoolShareBps = 7000; // 70% to prize pool
    uint256 public houseShareBps = 3000;     // 30% to house

    mapping(ItemType => uint256) public itemCosts;
    mapping(bytes32 => Sponsorship[]) public matchSponsorships;
    mapping(bytes32 => MatchSponsorStats) public matchStats;
    mapping(bytes32 => mapping(address => bool)) public matchAgentRegistry; // matchId => agent => registered

    uint256 public totalSponsorshipsAllTime;

    // ─── Events (REACTIVE — game server subscribes to these) ─────────

    event ItemSponsored(
        bytes32 indexed matchId,
        address indexed agent,
        ItemType item,
        address indexed sponsor,
        uint256 deliveryId,
        uint256 cost
    );

    event ItemDelivered(
        bytes32 indexed matchId,
        uint256 indexed deliveryId
    );

    event MatchRegistered(bytes32 indexed matchId, address[] agents);
    event MatchDeactivated(bytes32 indexed matchId);
    event ItemCostUpdated(ItemType indexed item, uint256 newCost);

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

    constructor(address _houseWallet) {
        require(_houseWallet != address(0), "Invalid house wallet");

        owner = msg.sender;
        gameServer = msg.sender;
        houseWallet = _houseWallet;

        // Default item costs
        itemCosts[ItemType.HEALTH_PACK] = 0.001 ether;
        itemCosts[ItemType.AMMO_CRATE] = 0.0005 ether;
        itemCosts[ItemType.SHIELD_BUBBLE] = 0.002 ether;
        itemCosts[ItemType.DAMAGE_BOOST] = 0.0015 ether;
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

    function setBettingPool(address _bettingPool) external onlyOwner {
        bettingPool = _bettingPool;
    }

    function setItemCost(ItemType item, uint256 cost) external onlyOwner {
        require(cost > 0, "Cost must be > 0");
        itemCosts[item] = cost;
        emit ItemCostUpdated(item, cost);
    }

    function setShareSplit(uint256 _prizePoolBps, uint256 _houseBps) external onlyOwner {
        require(_prizePoolBps + _houseBps == 10000, "Must total 100%");
        prizePoolShareBps = _prizePoolBps;
        houseShareBps = _houseBps;
    }

    // ─── Match Management ────────────────────────────────────────────

    function registerMatch(bytes32 matchId, address[] calldata agents) external onlyGameServer {
        require(!matchStats[matchId].active, "Match already registered");
        require(agents.length >= 2, "Need at least 2 agents");

        matchStats[matchId] = MatchSponsorStats({
            totalSponsored: 0,
            totalValue: 0,
            active: true
        });

        for (uint256 i = 0; i < agents.length; i++) {
            matchAgentRegistry[matchId][agents[i]] = true;
        }

        emit MatchRegistered(matchId, agents);
    }

    function deactivateMatch(bytes32 matchId) external onlyGameServer {
        matchStats[matchId].active = false;
        emit MatchDeactivated(matchId);
    }

    // ─── Sponsorship (REACTIVE: Instant item delivery) ───────────────

    /**
     * @notice Sponsor an item for an agent in a live match
     * @dev Emits ItemSponsored event which game server subscribes to
     *      for instant in-game item delivery via Somnia Reactivity
     * @param matchId The match to sponsor in
     * @param agent The agent to receive the item
     * @param item The type of item to sponsor
     */
    function sponsorAgent(
        bytes32 matchId,
        address agent,
        ItemType item
    ) external payable {
        require(matchStats[matchId].active, "Match not active");
        require(msg.value >= itemCosts[item], "Insufficient payment");
        require(matchAgentRegistry[matchId][agent], "Agent not in match");

        uint256 deliveryId = matchSponsorships[matchId].length;

        matchSponsorships[matchId].push(
            Sponsorship({
                sponsor: msg.sender,
                agent: agent,
                item: item,
                cost: msg.value,
                timestamp: block.timestamp,
                delivered: false
            })
        );

        matchStats[matchId].totalSponsored++;
        matchStats[matchId].totalValue += msg.value;
        totalSponsorshipsAllTime++;

        // REACTIVE: Game server subscribes to this and delivers item instantly
        emit ItemSponsored(matchId, agent, item, msg.sender, deliveryId, msg.value);

        // Split payment: prize pool + house
        _splitPayment(msg.value);

        // Refund excess
        if (msg.value > itemCosts[item]) {
            uint256 refund = msg.value - itemCosts[item];
            (bool sent, ) = msg.sender.call{value: refund}("");
            require(sent, "Refund failed");
        }
    }

    /**
     * @notice Mark an item as delivered by the game server
     * @param matchId The match ID
     * @param deliveryId The sponsorship delivery ID
     */
    function confirmDelivery(bytes32 matchId, uint256 deliveryId) external onlyGameServer {
        require(deliveryId < matchSponsorships[matchId].length, "Invalid delivery ID");
        matchSponsorships[matchId][deliveryId].delivered = true;
        emit ItemDelivered(matchId, deliveryId);
    }

    // ─── View Functions ──────────────────────────────────────────────

    function getItemCost(ItemType item) external view returns (uint256) {
        return itemCosts[item];
    }

    function getMatchSponsorshipCount(bytes32 matchId) external view returns (uint256) {
        return matchSponsorships[matchId].length;
    }

    function getSponsorship(bytes32 matchId, uint256 index)
        external
        view
        returns (
            address sponsor,
            address agent,
            ItemType item,
            uint256 cost,
            uint256 timestamp,
            bool delivered
        )
    {
        Sponsorship storage s = matchSponsorships[matchId][index];
        return (s.sponsor, s.agent, s.item, s.cost, s.timestamp, s.delivered);
    }

    function getMatchStats(bytes32 matchId)
        external
        view
        returns (uint256 totalSponsored, uint256 totalValue, bool active)
    {
        MatchSponsorStats storage stats = matchStats[matchId];
        return (stats.totalSponsored, stats.totalValue, stats.active);
    }

    function isAgentInMatch(bytes32 matchId, address agent) external view returns (bool) {
        return matchAgentRegistry[matchId][agent];
    }

    // ─── Internal Functions ──────────────────────────────────────────

    function _splitPayment(uint256 amount) internal {
        uint256 toHouse = (amount * houseShareBps) / 10000;
        uint256 toPrizePool = amount - toHouse;

        if (toHouse > 0) {
            (bool houseSent, ) = houseWallet.call{value: toHouse}("");
            require(houseSent, "House payment failed");
        }

        if (toPrizePool > 0 && bettingPool != address(0)) {
            (bool poolSent, ) = bettingPool.call{value: toPrizePool}("");
            require(poolSent, "Prize pool payment failed");
        } else if (toPrizePool > 0) {
            // If no betting pool set, send to house
            (bool fallbackSent, ) = houseWallet.call{value: toPrizePool}("");
            require(fallbackSent, "Fallback payment failed");
        }
    }

    // ─── Receive ─────────────────────────────────────────────────────

    receive() external payable {}
}
