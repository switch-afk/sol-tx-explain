'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  describeError,
  formatLamports,
  formatSummary,
  summarizeTransaction,
} = require('../src/explain');
const { PAYER, makeTx } = require('./helpers/fixtures');

test('formatLamports is exact and trims zeros', () => {
  assert.equal(formatLamports(0), '0');
  assert.equal(formatLamports(5000), '0.000005');
  assert.equal(formatLamports(1_000_000_000), '1');
  assert.equal(formatLamports(1_500_000_000), '1.5');
  assert.equal(formatLamports(-2_500_000_000), '-2.5');
});

test('describeError handles strings, custom codes and instruction errors', () => {
  assert.equal(describeError(null), null);
  assert.equal(describeError('AccountNotFound'), 'AccountNotFound');
  assert.equal(
    describeError({ InstructionError: [1, { Custom: 6001 }] }),
    'Instruction #2 failed: custom program error 6001 (0x1771)'
  );
  assert.equal(
    describeError({ InstructionError: [0, 'InsufficientFunds'] }),
    'Instruction #1 failed: InsufficientFunds'
  );
});

test('summarizeTransaction reads status, fee, payer and signers', () => {
  const summary = summarizeTransaction(makeTx());
  assert.equal(summary.status, 'success');
  assert.equal(summary.error, null);
  assert.equal(summary.fee, 5000);
  assert.equal(summary.feePayer, PAYER);
  assert.deepEqual(summary.signers, [PAYER]);
  assert.equal(summary.time, '2026-01-01T00:00:00Z');
  assert.equal(summary.version, '0');
});

test('summarizeTransaction lists every signer and ignores non-signers', () => {
  const summary = summarizeTransaction(
    makeTx({ signers: [PAYER, 'Cosigner11111111111111111111111111111111111'], others: ['Other1'] })
  );
  assert.equal(summary.signers.length, 2);
  assert.equal(summary.feePayer, PAYER);
});

test('summarizeTransaction marks a failed transaction', () => {
  const summary = summarizeTransaction(
    makeTx({ err: { InstructionError: [1, { Custom: 6001 }] } })
  );
  assert.equal(summary.status, 'failed');
  assert.match(summary.error, /custom program error 6001/);
});

test('summarizeTransaction reports legacy transactions', () => {
  const tx = makeTx();
  delete tx.version;
  assert.equal(summarizeTransaction(tx).version, 'legacy');
});

test('formatSummary shows the key facts', () => {
  const text = formatSummary(summarizeTransaction(makeTx()), {
    signature: 'SIG',
    host: 'rpc.example.com',
  });
  assert.match(text, /Status\s+Success/);
  assert.match(text, /0\.000005 SOL \(5000 lamports\)/);
  assert.match(text, /Fee payer\s+FeePayer/);
  assert.match(text, /RPC\s+rpc\.example\.com/);
});

test('formatSummary shows the error line for a failed transaction', () => {
  const text = formatSummary(
    summarizeTransaction(makeTx({ err: 'AccountNotFound' })),
    { signature: 'SIG', host: 'h' }
  );
  assert.match(text, /Status\s+Failed/);
  assert.match(text, /Error\s+AccountNotFound/);
});