'use strict';

const pkg = require('../package.json');
const { SignatureError, validateSignature } = require('./signature');

const HELP = `sol-tx-explain v${pkg.version}

Paste a Solana transaction signature, get a plain-English summary.

Usage:
  sol-tx-explain <signature>

Options:
  -h, --help       Show this help
  -v, --version    Show the version

Exit codes:
  0  ok
  1  the signature is not valid
  2  bad usage
`;

/**
 * Run the CLI. Returns an exit code instead of exiting,
 * so it can be tested without spawning a process.
 */
function run(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;

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
    stdout.write(`Signature looks valid: ${signature}\n`);
    stdout.write('Fetching and explaining transactions arrives in the next release.\n');
    return 0;
  } catch (error) {
    if (error instanceof SignatureError) {
      stderr.write(`Not a valid signature: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

module.exports = { run, HELP };