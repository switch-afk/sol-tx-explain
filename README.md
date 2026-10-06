# sol-tx-explain

Paste a Solana transaction signature, get a plain-English summary.

Zero dependencies. Node 18+.

> **Status: early.** It reports status, time, fee, fee payer, signers, balance changes, the programs involved and an instruction summary. A one-line headline is coming next.

## Usage

```bash
npx sol-tx-explain <signature>
```

Or from a clone:

```bash
node bin/sol-tx-explain.js <signature>
```

Example output:

```
Signature  <signature>
Status     Success
Time       2026-01-01T00:00:00Z (slot 300000000)
Fee        0.000115 SOL (115000 lamports)
Fee payer  <address>
Signers    <address>
Version    0
RPC        api.mainnet-beta.solana.com

SOL changes
  <address>  -1.500115 SOL (includes the 0.000115 SOL fee)
  <address>  +1.5 SOL

Token changes
  <address>  -10.5 USDC
  <address>  +10.5 USDC

Programs
  Compute Budget Program
  Jupiter Aggregator v6
  Raydium AMM v4
  Token Program

Instructions
  1. Compute Budget Program: set compute unit limit to 500000
  2. Jupiter Aggregator v6: instruction (not decoded) (+6 inner calls)
```

A transaction that failed on-chain is still explained (exit code 0), with its error shown on an `Error` line.

## Use your own RPC

The public RPC rate-limits and prunes old transactions. Point the tool at your own endpoint:

```bash
export SOL_TX_EXPLAIN_RPC="https://your-rpc-endpoint"
```

Only the RPC hostname is ever printed, never the full URL, so API keys in the path or query string stay out of your terminal output.

## What it will do

- [x] Say whether the transaction succeeded or failed, with the error
- [x] Show the fee and the fee payer
- [x] Show SOL balance changes and token balance changes with formatted amounts
- [x] List the programs called, with friendly names
- [x] Summarise each instruction
- [ ] Give a one-line headline

## Honest limits

- Balance changes are net per account (after minus before). An account's change includes fees and any rent paid or refunded, so a number can differ from what a single instruction moved.
- Token changes are netted per owner and mint. Only wSOL, USDC and USDT get a name; every other token shows its mint address.
- Program names come from a small built-in list. Any program not on it is shown by address as "unlabeled".
- Instructions are decoded only for the System, Token, Token-2022, Associated Token Account, Memo and Compute Budget programs. Everything else (DEX swaps, for example) is shown as "instruction (not decoded)" with the number of inner calls it made, because decoding them needs each program's own interface.
- The Programs list includes programs reached through inner calls, not just the ones the transaction called directly.
- Long lists are cut after 15 rows.
- The headline (coming soon) is a guess based on balance changes, not a certainty.
- Public RPC endpoints prune old transactions and rate-limit requests, so older transactions may not be found.
- Queries mainnet by default. For devnet or testnet, set `SOL_TX_EXPLAIN_RPC` to a matching endpoint.

## Development

```bash
npm test
```

## License

MIT