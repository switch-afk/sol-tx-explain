# sol-tx-explain

Paste a Solana transaction signature, get a plain-English summary.

Zero dependencies. Node 18+.

> **Status: early.** v0.1 only validates the signature. Fetching and explaining transactions lands in the next releases.

## Usage

```bash
npx sol-tx-explain <signature>
```

Or from a clone:

```bash
node bin/sol-tx-explain.js <signature>
```

## What it will do

- Say whether the transaction succeeded or failed, and explain the error if it failed
- Show the fee and the fee payer
- Show SOL balance changes and token balance changes with formatted amounts
- List the programs called, with friendly names
- Give a one-line headline

## Honest limits

- The headline is a guess based on balance changes, not a certainty.
- Public RPC endpoints prune old transactions and rate-limit requests, so older transactions may not be found. Use your own RPC if you hit this.

## Development

```bash
npm test
```

## License

MIT