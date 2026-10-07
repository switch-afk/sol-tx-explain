# sol-tx-explain

Paste a Solana transaction signature, get a plain-English summary.

Zero dependencies. Node 18+.

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
Summary    Likely a swap: sent 17960.851474 tokens (mint 4NdR...oMW2), received 0.029596831 SOL via Meteora DAMM v2
Time       2026-01-01T00:00:00Z (slot 300000000)
Fee        0.000115 SOL (115000 lamports)
Fee payer  <address>
Signers    <address>
Version    0
RPC        api.mainnet-beta.solana.com

SOL changes
  <address>  +0.029481 SOL (includes the 0.000115 SOL fee)

Token changes
  <address>  -17960.851474 of mint <mint>

Programs
  System Program
  Token Program
  Meteora DAMM v2

Instructions
  1. System Program: transfer 0.01 SOL from AbCd...WxYz to EfGh...StUv
```

A transaction that failed on-chain is still explained (exit code 0). Its raw error is shown on an `Error` line, with a plain-English `Why` line when the error is a common one:

```
Status     Failed
Summary    Failed on-chain; nothing moved except the fee.
Error      Instruction #2 failed: ComputationalBudgetExceeded
Why        Instruction #2 (Jupiter Aggregator v6) failed: it ran out of compute units, so the compute unit limit was too low for this work.
```

## JSON output

```bash
npx sol-tx-explain --json <signature>
```

Prints one JSON document with the same information (status, headline, error and hint, fee, fee payer, signers, SOL and token changes, programs, instructions). Amounts are strings so nothing is rounded. Errors still go to stderr as plain text, with the same exit codes.

## Use your own RPC

The public RPC rate-limits and prunes old transactions. Point the tool at your own endpoint:

```bash
export SOL_TX_EXPLAIN_RPC="https://your-rpc-endpoint"
```

Only the RPC hostname is ever printed, never the full URL, so API keys in the path or query string stay out of your terminal output.

## What it does

- [x] Says whether the transaction succeeded or failed, with the error and a plain-English reason
- [x] Shows the fee and the fee payer
- [x] Shows SOL balance changes and token balance changes with formatted amounts
- [x] Lists the programs called, with friendly names
- [x] Summarises each instruction
- [x] Gives a one-line summary
- [x] Machine-readable `--json` output

## Honest limits

- **The Summary line is a guess.** It looks only at what happened to the fee payer's balances (with the fee taken out) and which known trading programs were involved. It can be wrong, for example when the fee payer is a relayer, when a swap is split across several wallets, or when rent paid for new accounts makes a small SOL amount look like part of a trade. That is why it says "Likely". The balance changes below it are the facts.
- **Amounts are what the fee payer netted.** Block explorers often show the gross amounts a pool paid out. When the same transaction also sends a share to another account (a platform fee, for example), this tool's figure for the fee payer is smaller than the explorer's. Both are right; they answer different questions. The full movements are in the changes below the summary.
- Balance changes are net per account (after minus before). An account's change includes fees and any rent paid or refunded, so a number can differ from what a single instruction moved.
- Token changes are netted per owner and mint. Only wSOL, USDC and USDT get a name; every other token shows its mint address.
- Program names come from a small built-in list. Any program not on it is shown by address as "unlabeled".
- Instructions are decoded only for the System, Token, Token-2022, Associated Token Account, Memo and Compute Budget programs. Everything else (DEX swaps, for example) is shown as "instruction (not decoded)" with the number of inner calls it made, because decoding them needs each program's own interface.
- The `Why` line covers common errors only. Custom program error codes are defined by each program, so for most of them the tool can only point you at that program's docs.
- The Programs list includes programs reached through inner calls, not just the ones the transaction called directly.
- Long lists are cut after 15 rows.
- Public RPC endpoints prune old transactions and rate-limit requests, so older transactions may not be found.
- Queries mainnet by default. For devnet or testnet, set `SOL_TX_EXPLAIN_RPC` to a matching endpoint.

## Development

```bash
npm test
```

## License

MIT