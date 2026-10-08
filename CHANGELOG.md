# Changelog

## 0.2.1

- Adds a library entry point: `require('sol-tx-explain')` now works, with `explainTransaction(signature, { rpcUrl })` returning the summary, the JSON form and the text form
- `explainTransaction` returns `null` when the RPC does not have the transaction yet, so callers can retry
- Moves transaction fetching (including the transaction version retry) into its own module so the CLI and the library share it
- No change to CLI behaviour or output

## 0.2.0

- Fetches a transaction by signature and shows status, time, fee, fee payer and signers
- Shows SOL and token balance changes, netted per account and per owner and mint
- Names well-known programs and summarises each instruction, including compute budget settings
- Adds a one-line "Likely ..." summary (swap, transfer, send, receive, relayed, fee-only, failed)
- Adds `--json` for machine-readable output
- Explains common failure reasons in plain English
- Supports versioned transactions and retries with the version an RPC asks for
- Retries on rate limits and never prints the RPC URL, only its hostname

## 0.1.0

- Initial scaffold: CLI, base58 signature validation, tests and CI