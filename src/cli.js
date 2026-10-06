'use strict';

const pkg = require('../package.json');
const { SignatureError, validateSignature } = require('./signature');
const { ENV_VAR, RpcError, getRpcUrl, hostLabel, rpcCall } = require('./rpc');
const { formatSummary, summarizeTransaction } = require('./explain');

const DEFAULT_MAX_VERSION = 1;
const MAX_VERSION_RETRIES = 3;

const HELP = `sol-tx-explain v${pkg.version}

Paste a Solana transaction signature, get a plain-English summary.

Usage:
  sol-tx-explain <signature>

Options:
  -h, --help       Show this help
  -v, --version    Show the version

Environment:
  ${ENV_VAR}   Your own RPC endpoint (recommended; the public
                         RPC rate-limits and prunes old transactions)

Exit codes:
  0  the transaction was fetched and explained (even if it failed on-chain)
  1  invalid signature, transaction not found, or RPC problem
  2  bad usage
`;

/**
 * Fetch a transaction. Asks for the newest transaction version we know about,
 * and if the RPC says it needs a higher maxSupportedTransactionVersion,
 * reads the number from its error and tries again.
 */
async function fetchTransaction(url, signature, rpcOptions) {
  let maxVersion = DEFAULT_MAX_VERSION;

  for (let attempt = 0; ; attempt++) {
    try {
      return await rpcCall(
        url,
        'getTransaction',
        [
          signature,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: maxVersion,
            commitment: 'confirmed',
          },
        ],
        rpcOptions
      );
    } catch (error) {
      const match =
        error instanceof RpcError &&
        /"maxSupportedTransactionVersion":\s*(\d+)/.exec(error.message);
      const needed = match ? Number(match[1]) : 0;

      if (needed > maxVersion && attempt < MAX_VERSION_RETRIES) {
        maxVersion = needed;
        continue;
      }
      throw error;
    }
  }
}

/**
 * Run the CLI. Returns an exit code instead of exiting,
 * so it can be tested without spawning a process.
 */
async function run(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const env = io.env || process.env;

  if (argv.includes('-h') || argv.includes('--help')) {
    stdout.write(HELP);
    return 0;
  }

  if (argv.includes('-v') || argv.includes('--version')) {
    stdout.write(`${pkg.version}\n`);
    return 0;
  }

  const unknown = argv.find((arg) => arg.startsWith('-'));
  if (unknown) {
    stderr.write(`Unknown option: ${unknown}\n\n${HELP}`);
    return 2;
  }

  if (argv.length !== 1) {
    stderr.write(`Expected exactly one signature.\n\n${HELP}`);
    return 2;
  }

  try {
    const signature = validateSignature(argv[0]);
    const url = getRpcUrl(env);
    const host = hostLabel(url);

    const result = await fetchTransaction(url, signature, io.rpcOptions);

    if (!result) {
      stderr.write(
        `Transaction not found on ${host}.\n` +
          'It may be too old (public RPCs prune history), not confirmed yet, or on a different network.\n' +
          `Try your own RPC by setting ${ENV_VAR}.\n`
      );
      return 1;
    }

    stdout.write(formatSummary(summarizeTransaction(result), { signature, host }));
    return 0;
  } catch (error) {
    if (error instanceof SignatureError) {
      stderr.write(`Not a valid signature: ${error.message}\n`);
      return 1;
    }
    if (error instanceof RpcError) {
      stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

module.exports = { run, HELP };