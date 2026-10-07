# Changelog

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