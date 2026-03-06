// Minimal ABIs for the contracts we interact with from the frontend

export const ReactiveBettingPoolABI = [
  {
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'agent', type: 'address' },
    ],
    name: 'placeBet',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'agent', type: 'address' },
    ],
    name: 'calculateOdds',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    name: 'getMatchInfo',
    outputs: [
      { name: 'totalPool', type: 'uint256' },
      { name: 'state', type: 'uint8' },
      { name: 'winner', type: 'address' },
      { name: 'startTime', type: 'uint256' },
      { name: 'agentCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    name: 'getMatchAgents',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'user', type: 'address' },
      { name: 'agent', type: 'address' },
    ],
    name: 'getUserBet',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: '', type: 'bytes32' },
      { name: '', type: 'address' },
    ],
    name: 'agentPools',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: true, name: 'agent', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'BetPlaced',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: true, name: 'agent', type: 'address' },
      { indexed: false, name: 'newOdds', type: 'uint256' },
    ],
    name: 'OddsUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: true, name: 'winner', type: 'address' },
      { indexed: false, name: 'totalPool', type: 'uint256' },
    ],
    name: 'MatchAutoResolved',
    type: 'event',
  },
] as const;

export const ReactiveSponsorshipABI = [
  {
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'agent', type: 'address' },
      { name: 'item', type: 'uint8' },
    ],
    name: 'sponsorAgent',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint8' }],
    name: 'itemCosts',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'item', type: 'uint8' }],
    name: 'getItemCost',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    name: 'getMatchStats',
    outputs: [
      { name: 'totalSponsored', type: 'uint256' },
      { name: 'totalValue', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: true, name: 'agent', type: 'address' },
      { indexed: false, name: 'item', type: 'uint8' },
      { indexed: true, name: 'sponsor', type: 'address' },
      { indexed: false, name: 'deliveryId', type: 'uint256' },
      { indexed: false, name: 'cost', type: 'uint256' },
    ],
    name: 'ItemSponsored',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: true, name: 'deliveryId', type: 'uint256' },
    ],
    name: 'ItemDelivered',
    type: 'event',
  },
] as const;
