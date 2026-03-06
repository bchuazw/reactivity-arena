// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ReactiveMatchTimer
 * @notice Cron-based match timer using Somnia Reactivity
 * @dev Automates turn advancement and stale match resolution
 *      without external cron jobs or oracles.
 *
 * Somnia Cron Subscriptions:
 *   - Turn timer: auto-advances turns every TURN_TIMEOUT seconds
 *   - Stale check: auto-resolves matches after MATCH_TIMEOUT inactivity
 *
 * This contract manages match lifecycle timing and delegates
 * resolution to the ReactiveBettingPool contract.
 */
contract ReactiveMatchTimer {
    // ─── Types ───────────────────────────────────────────────────────

    enum MatchPhase {
        LOBBY,
        ACTIVE,
        PAUSED,
        ENDED
    }

    struct MatchTimer {
        bytes32 matchId;
        MatchPhase phase;
        uint256 startTime;
        uint256 lastActivity;
        uint256 turnDeadline;
        uint256 currentAgentIndex;
        uint256 turnNumber;
        uint256 maxTurns;
    }

    // ─── Constants ───────────────────────────────────────────────────

    uint256 public constant TURN_TIMEOUT = 30 seconds;
    uint256 public constant MATCH_TIMEOUT = 10 minutes;
    uint256 public constant DEFAULT_MAX_TURNS = 100;
    uint256 public constant LOBBY_TIMEOUT = 5 minutes;

    // ─── State ───────────────────────────────────────────────────────

    address public owner;
    address public gameServer;
    address public bettingPool; // For delegating match resolution

    mapping(bytes32 => MatchTimer) public matchTimers;
    mapping(bytes32 => address[]) public matchAgents;
    mapping(bytes32 => address) public currentAgent; // matchId => current agent

    // ─── Events (REACTIVE — subscribers get real-time updates) ───────

    event MatchCreated(bytes32 indexed matchId, address[] agents, uint256 maxTurns);
    event MatchStarted(bytes32 indexed matchId, uint256 startTime);
    event TurnAdvanced(
        bytes32 indexed matchId,
        address indexed currentAgent,
        uint256 turnNumber,
        uint256 turnDeadline
    );
    event TurnForced(
        bytes32 indexed matchId,
        address indexed agent,
        uint256 turnNumber
    );
    event MatchPhaseChanged(bytes32 indexed matchId, MatchPhase newPhase);
    event StaleMatchDetected(bytes32 indexed matchId, uint256 inactiveDuration);
    event MatchAutoEnded(bytes32 indexed matchId, address indexed lastActiveAgent, string reason);
    event ActivityRecorded(bytes32 indexed matchId, uint256 timestamp);

    // ─── Modifiers ───────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyGameServer() {
        require(msg.sender == gameServer, "Only game server");
        _;
    }

    modifier onlyGameServerOrCron() {
        require(
            msg.sender == gameServer || msg.sender == address(this),
            "Only game server or cron"
        );
        _;
    }

    modifier matchExists(bytes32 matchId) {
        require(matchTimers[matchId].startTime > 0 || matchTimers[matchId].phase == MatchPhase.LOBBY, "Match does not exist");
        _;
    }

    modifier matchActive(bytes32 matchId) {
        require(matchTimers[matchId].phase == MatchPhase.ACTIVE, "Match not active");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────

    constructor(address _bettingPool) {
        owner = msg.sender;
        gameServer = msg.sender;
        bettingPool = _bettingPool;
    }

    // ─── Admin Functions ─────────────────────────────────────────────

    function setGameServer(address _gameServer) external onlyOwner {
        require(_gameServer != address(0), "Invalid address");
        gameServer = _gameServer;
    }

    function setBettingPool(address _bettingPool) external onlyOwner {
        bettingPool = _bettingPool;
    }

    // ─── Match Lifecycle ─────────────────────────────────────────────

    /**
     * @notice Create a new match in lobby phase
     * @param matchId Unique match identifier
     * @param agents Array of agent addresses participating
     * @param maxTurns Maximum turns before auto-resolution
     */
    function createMatch(
        bytes32 matchId,
        address[] calldata agents,
        uint256 maxTurns
    ) external onlyGameServer {
        require(matchTimers[matchId].phase == MatchPhase.LOBBY && matchTimers[matchId].startTime == 0, "Match already exists");
        require(agents.length >= 2 && agents.length <= 10, "Invalid agent count");

        uint256 effectiveMaxTurns = maxTurns > 0 ? maxTurns : DEFAULT_MAX_TURNS;

        matchTimers[matchId] = MatchTimer({
            matchId: matchId,
            phase: MatchPhase.LOBBY,
            startTime: 0,
            lastActivity: block.timestamp,
            turnDeadline: 0,
            currentAgentIndex: 0,
            turnNumber: 0,
            maxTurns: effectiveMaxTurns
        });

        for (uint256 i = 0; i < agents.length; i++) {
            matchAgents[matchId].push(agents[i]);
        }

        emit MatchCreated(matchId, agents, effectiveMaxTurns);
    }

    /**
     * @notice Start the match — transitions from LOBBY to ACTIVE
     * @param matchId The match to start
     */
    function startMatch(bytes32 matchId) external onlyGameServer matchExists(matchId) {
        MatchTimer storage timer = matchTimers[matchId];
        require(timer.phase == MatchPhase.LOBBY, "Not in lobby");

        timer.phase = MatchPhase.ACTIVE;
        timer.startTime = block.timestamp;
        timer.lastActivity = block.timestamp;
        timer.turnDeadline = block.timestamp + TURN_TIMEOUT;
        timer.currentAgentIndex = 0;

        currentAgent[matchId] = matchAgents[matchId][0];

        emit MatchStarted(matchId, block.timestamp);
        emit MatchPhaseChanged(matchId, MatchPhase.ACTIVE);
        emit TurnAdvanced(matchId, currentAgent[matchId], 0, timer.turnDeadline);
    }

    // ─── Turn Management (REACTIVE: Auto-advance via cron) ───────────

    /**
     * @notice Advance to the next turn
     * @dev Called by game server after an agent completes their action,
     *      or auto-called by cron subscription when turn timer expires
     * @param matchId The active match
     */
    function advanceTurn(bytes32 matchId) external onlyGameServerOrCron matchActive(matchId) {
        MatchTimer storage timer = matchTimers[matchId];

        // Check if max turns reached
        if (timer.turnNumber >= timer.maxTurns) {
            _autoEndMatch(matchId, "Max turns reached");
            return;
        }

        timer.turnNumber++;
        timer.currentAgentIndex = (timer.currentAgentIndex + 1) % matchAgents[matchId].length;
        timer.turnDeadline = block.timestamp + TURN_TIMEOUT;
        timer.lastActivity = block.timestamp;

        address nextAgent = matchAgents[matchId][timer.currentAgentIndex];
        currentAgent[matchId] = nextAgent;

        emit TurnAdvanced(matchId, nextAgent, timer.turnNumber, timer.turnDeadline);
        emit ActivityRecorded(matchId, block.timestamp);
    }

    /**
     * @notice Check if the current turn has timed out and force advance
     * @dev Designed to be called by Somnia cron subscription every 30s:
     *      subscribeCron(matchId, "every-30s * * * * *", this.checkTurnTimeout.selector)
     * @param matchId The match to check
     */
    function checkTurnTimeout(bytes32 matchId) external onlyGameServerOrCron {
        MatchTimer storage timer = matchTimers[matchId];

        if (timer.phase != MatchPhase.ACTIVE) return;

        if (block.timestamp > timer.turnDeadline) {
            // Force the current agent's turn (they timed out)
            address timedOutAgent = currentAgent[matchId];
            emit TurnForced(matchId, timedOutAgent, timer.turnNumber);

            // Auto-advance to next agent
            timer.turnNumber++;
            timer.currentAgentIndex = (timer.currentAgentIndex + 1) % matchAgents[matchId].length;
            timer.turnDeadline = block.timestamp + TURN_TIMEOUT;
            timer.lastActivity = block.timestamp;

            address nextAgent = matchAgents[matchId][timer.currentAgentIndex];
            currentAgent[matchId] = nextAgent;

            emit TurnAdvanced(matchId, nextAgent, timer.turnNumber, timer.turnDeadline);
        }
    }

    /**
     * @notice Check for stale/inactive matches and auto-resolve
     * @dev Designed for Somnia cron subscription every 10 minutes:
     *      subscribeCron(matchId, "0 every-10m * * * *", this.checkStaleMatch.selector)
     * @param matchId The match to check
     */
    function checkStaleMatch(bytes32 matchId) external onlyGameServerOrCron {
        MatchTimer storage timer = matchTimers[matchId];

        if (timer.phase != MatchPhase.ACTIVE) return;

        uint256 inactiveDuration = block.timestamp - timer.lastActivity;

        if (inactiveDuration > MATCH_TIMEOUT) {
            emit StaleMatchDetected(matchId, inactiveDuration);
            _autoEndMatch(matchId, "Stale - inactivity timeout");
        }
    }

    // ─── Activity Recording ──────────────────────────────────────────

    /**
     * @notice Record activity to prevent stale match detection
     * @param matchId The active match
     */
    function recordActivity(bytes32 matchId) external onlyGameServer matchActive(matchId) {
        matchTimers[matchId].lastActivity = block.timestamp;
        emit ActivityRecorded(matchId, block.timestamp);
    }

    /**
     * @notice Pause a match (e.g. for dispute resolution)
     * @param matchId The match to pause
     */
    function pauseMatch(bytes32 matchId) external onlyGameServer matchActive(matchId) {
        matchTimers[matchId].phase = MatchPhase.PAUSED;
        emit MatchPhaseChanged(matchId, MatchPhase.PAUSED);
    }

    /**
     * @notice Resume a paused match
     * @param matchId The match to resume
     */
    function resumeMatch(bytes32 matchId) external onlyGameServer matchExists(matchId) {
        require(matchTimers[matchId].phase == MatchPhase.PAUSED, "Not paused");
        matchTimers[matchId].phase = MatchPhase.ACTIVE;
        matchTimers[matchId].lastActivity = block.timestamp;
        matchTimers[matchId].turnDeadline = block.timestamp + TURN_TIMEOUT;
        emit MatchPhaseChanged(matchId, MatchPhase.ACTIVE);
    }

    /**
     * @notice Manually end a match (game server determined a winner)
     * @param matchId The match to end
     * @param winner The winning agent
     */
    function endMatch(bytes32 matchId, address winner) external onlyGameServer {
        MatchTimer storage timer = matchTimers[matchId];
        require(timer.phase == MatchPhase.ACTIVE || timer.phase == MatchPhase.PAUSED, "Not active/paused");

        timer.phase = MatchPhase.ENDED;
        emit MatchPhaseChanged(matchId, MatchPhase.ENDED);
        emit MatchAutoEnded(matchId, winner, "Game server resolved");
    }

    // ─── View Functions ──────────────────────────────────────────────

    function getMatchTimer(bytes32 matchId)
        external
        view
        returns (
            MatchPhase phase,
            uint256 startTime,
            uint256 lastActivity,
            uint256 turnDeadline,
            uint256 turnNumber,
            uint256 maxTurns,
            address activeAgent
        )
    {
        MatchTimer storage timer = matchTimers[matchId];
        return (
            timer.phase,
            timer.startTime,
            timer.lastActivity,
            timer.turnDeadline,
            timer.turnNumber,
            timer.maxTurns,
            currentAgent[matchId]
        );
    }

    function getMatchAgents(bytes32 matchId) external view returns (address[] memory) {
        return matchAgents[matchId];
    }

    function getCurrentAgent(bytes32 matchId) external view returns (address) {
        return currentAgent[matchId];
    }

    function isTurnExpired(bytes32 matchId) external view returns (bool) {
        return block.timestamp > matchTimers[matchId].turnDeadline;
    }

    function isMatchStale(bytes32 matchId) external view returns (bool) {
        return (block.timestamp - matchTimers[matchId].lastActivity) > MATCH_TIMEOUT;
    }

    function getTimeUntilTurnExpiry(bytes32 matchId) external view returns (uint256) {
        uint256 deadline = matchTimers[matchId].turnDeadline;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    // ─── Internal Functions ──────────────────────────────────────────

    function _autoEndMatch(bytes32 matchId, string memory reason) internal {
        MatchTimer storage timer = matchTimers[matchId];
        timer.phase = MatchPhase.ENDED;

        address lastAgent = currentAgent[matchId];

        emit MatchPhaseChanged(matchId, MatchPhase.ENDED);
        emit MatchAutoEnded(matchId, lastAgent, reason);
    }
}
