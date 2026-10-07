'use strict';

// Friendly names for well-known programs. Anything not listed is shown by address.
const PROGRAM_LABELS = {
  '11111111111111111111111111111111': 'System Program',
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'Token Program',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022 Program',
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: 'Associated Token Account Program',
  ComputeBudget111111111111111111111111111111: 'Compute Budget Program',
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: 'Memo Program',
  Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo: 'Memo Program (v1)',
  Stake11111111111111111111111111111111111111: 'Stake Program',
  Vote111111111111111111111111111111111111111: 'Vote Program',
  BPFLoaderUpgradeab1e11111111111111111111111: 'BPF Loader (Upgradeable)',
  AddressLookupTab1e1111111111111111111111111: 'Address Lookup Table Program',
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s: 'Metaplex Token Metadata',
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: 'Jupiter Aggregator v6',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM v4',
  CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C: 'Raydium CPMM',
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: 'Raydium CLMM',
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: 'Orca Whirlpools',
  LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: 'Meteora DLMM',
  Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB: 'Meteora DAMM v1',
  cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG: 'Meteora DAMM v2',
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun',
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: 'PumpSwap',
  pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ: 'Pump Fees',
};

// Labels of programs that trade tokens, used to say "via ..." in the summary line.
const DEX_LABELS = new Set([
  'Jupiter Aggregator v6',
  'Raydium AMM v4',
  'Raydium CPMM',
  'Raydium CLMM',
  'Orca Whirlpools',
  'Meteora DLMM',
  'Meteora DAMM v1',
  'Meteora DAMM v2',
  'Pump.fun',
  'PumpSwap',
]);

// A few well-known mints so the output reads nicely. Anything else shows its mint address.
const KNOWN_MINTS = {
  So11111111111111111111111111111111111111112: 'wSOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
};

const COMPUTE_BUDGET_ID = 'ComputeBudget111111111111111111111111111111';

function programLabel(programId) {
  return PROGRAM_LABELS[programId] || null;
}

module.exports = {
  COMPUTE_BUDGET_ID,
  DEX_LABELS,
  KNOWN_MINTS,
  PROGRAM_LABELS,
  programLabel,
};