'use strict';

const pkg = require('../package.json');
const { SignatureError, validateSignature } = require('./signature');
const { ENV_VAR, RpcError, getRpcUrl, hostLabel } = require('./rpc');
const { fetchTransaction } = require('./transaction');
const { formatSummary, summarizeTransaction, toJson } = require('./explain');

const KNOWN_FLAGS = new Set(['--json']);

const HELP = `sol-tx-explain v${pkg.version}

Paste a Solana transaction signature, get a plain-English summary.

Usage:
  sol-tx-explain [--json] <signature>

Options:
  --json           Print machine-readable JSON instead of text
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

  const flags = argv.filter((arg) => arg.startsWith('-'));
  const positional = argv.filter((arg) => !arg.startsWith('-'));

  const unknown = flags.find((flag) => !KNOWN_FLAGS.has(flag));
  if (unknown) {
    stderr.write(`Unknown option: ${unknown}\n\n${HELP}`);
    return 2;
  }

  if (positional.length !== 1) {
    stderr.write(`Expected exactly one signature.\n\n${HELP}`);
    return 2;
  }

  const json = flags.includes('--json');

  try {
    const signature = validateSignature(positional[0]);
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

    const summary = summarizeTransaction(result);
    if (json) {
      stdout.write(`${JSON.stringify(toJson(summary, { signature, host }), null, 2)}\n`);
    } else {
      stdout.write(formatSummary(summary, { signature, host }));
    }
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