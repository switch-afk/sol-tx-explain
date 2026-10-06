'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  KNOWN_MINTS,
  MAX_ROWS,
  describeError,
  formatLamports,
  formatSummary,
  formatUnits,
  summarizeTransaction,
} = require('../src/explain');
const { PAYER, makeTx, tokenBalance } = require('./helpers/fixtures');

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const ALICE = 'Alice11111111111111111111111111111111111111';
const BOB = 'Bob1111111111111111111111111111111111111111';

const render = (tx) =>
  formatSummary(summarizeTransaction(tx), { signature: 'SIG', host: 'rpc.example.com' });

test('formatUnits is exact and trims zeros', () => {
  assert.equal(formatUnits(0, 6), '0');
  assert.equal(formatUnits(12_500_000, 6), '12.5');
  assert.equal(formatUnits(1, 6), '0.000001');
  assert.equal(formatUnits(-10_500_000, 6), '-10.5');
  assert.equal(formatUnits(42, 0), '42');
});

test('formatLamports converts to SOL', () => {
  assert.equal(formatLamports(0), '0');
  assert.equal(formatLamports(5000), '0.000005');
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

test('SOL changes: a transfer shows both sides and skips unchanged accounts', () => {
  const tx = makeTx({
    others: [BOB, 'Untouched1111111111111111111111111111111111'],
    preBalances: [5_000_000_000, 1_000_000_000, 7],
    postBalances: [3_499_995_000, 2_500_000_000, 7],
  });
  const { solChanges } = summarizeTransaction(tx);
  assert.deepEqual(solChanges, [
    { address: PAYER, lamports: '-1500005000', sol: '-1.500005' },
    { address: BOB, lamports: '1500000000', sol: '1.5' },
  ]);
});

test('SOL changes: fee-only transactions show just the fee payer', () => {
  const { solChanges } = summarizeTransaction(makeTx());
  assert.deepEqual(solChanges, [{ address: PAYER, lamports: '-5000', sol: '-0.000005' }]);
});

test('token changes: a transfer nets to a loss and a gain with a known label', () => {
  const tx = makeTx({
    others: ['TokenAcc1', 'TokenAcc2'],
    preTokenBalances: [
      tokenBalance(1, ALICE, USDC, 12_500_000, 6),
      tokenBalance(2, BOB, USDC, 0, 6),
    ],
    postTokenBalances: [
      tokenBalance(1, ALICE, USDC, 2_000_000, 6),
      tokenBalance(2, BOB, USDC, 10_500_000, 6),
    ],
  });
  const { tokenChanges } = summarizeTransaction(tx);
  assert.equal(tokenChanges.length, 2);
  assert.deepEqual(
    tokenChanges.map((c) => [c.owner, c.amount, c.label]),
    [
      [ALICE, '-10.5', 'USDC'],
      [BOB, '10.5', 'USDC'],
    ]
  );
});

test('token changes: new accounts count from zero, closed accounts down to zero', () => {
  const tx = makeTx({
    others: ['TokenAcc1', 'TokenAcc2'],
    preTokenBalances: [tokenBalance(2, BOB, 'ClosedMint1', 3_000_000_000, 9)],
    postTokenBalances: [tokenBalance(1, ALICE, 'NewMint1', 1_000_000_000, 9)],
  });
  const { tokenChanges } = summarizeTransaction(tx);
  assert.deepEqual(
    tokenChanges.map((c) => [c.owner, c.mint, c.amount, c.label]),
    [
      [BOB, 'ClosedMint1', '-3', null],
      [ALICE, 'NewMint1', '1', null],
    ]
  );
});

test('token changes: several accounts of one owner and mint are netted together', () => {
  const tx = makeTx({
    others: ['TokenAcc1', 'TokenAcc2'],
    preTokenBalances: [
      tokenBalance(1, ALICE, USDC, 5_000_000, 6),
      tokenBalance(2, ALICE, USDC, 1_000_000, 6),
    ],
    postTokenBalances: [
      tokenBalance(1, ALICE, USDC, 2_000_000, 6),
      tokenBalance(2, ALICE, USDC, 3_000_000, 6),
    ],
  });
  const { tokenChanges } = summarizeTransaction(tx);
  assert.equal(tokenChanges.length, 1);
  assert.equal(tokenChanges[0].amount, '-1');
});

test('token changes: unchanged balances are left out', () => {
  const same = [tokenBalance(1, ALICE, USDC, 5_000_000, 6)];
  const tx = makeTx({ others: ['TokenAcc1'], preTokenBalances: same, postTokenBalances: same });
  assert.deepEqual(summarizeTransaction(tx).tokenChanges, []);
});

test('token changes: a missing owner falls back to the token account address', () => {
  const entry = tokenBalance(1, undefined, USDC, 1_000_000, 6);
  delete entry.owner;
  const tx = makeTx({ others: ['TokenAcc1'], postTokenBalances: [entry] });
  assert.equal(summarizeTransaction(tx).tokenChanges[0].owner, 'TokenAcc1');
});

test('known mints include USDC', () => {
  assert.equal(KNOWN_MINTS[USDC], 'USDC');
});

test('formatSummary shows the key facts', () => {
  const text = render(makeTx());
  assert.match(text, /Status\s+Success/);
  assert.match(text, /0\.000005 SOL \(5000 lamports\)/);
  assert.match(text, /Fee payer\s+FeePayer/);
  assert.match(text, /RPC\s+rpc\.example\.com/);
});

test('formatSummary shows the error line for a failed transaction', () => {
  const text = render(makeTx({ err: 'AccountNotFound' }));
  assert.match(text, /Status\s+Failed/);
  assert.match(text, /Error\s+AccountNotFound/);
});

test('formatSummary notes that the fee payer change includes the fee', () => {
  const text = render(makeTx());
  assert.match(text, /SOL changes\n\s+FeePayer\S+\s+-0\.000005 SOL \(includes the 0\.000005 SOL fee\)/);
});

test('formatSummary shows signed SOL and token changes', () => {
  const tx = makeTx({
    others: [BOB, 'TokenAcc1', 'TokenAcc2'],
    preBalances: [5_000_000_000, 1_000_000_000, 0, 0],
    postBalances: [3_499_995_000, 2_500_000_000, 0, 0],
    preTokenBalances: [tokenBalance(2, ALICE, USDC, 12_500_000, 6)],
    postTokenBalances: [
      tokenBalance(2, ALICE, USDC, 2_000_000, 6),
      tokenBalance(3, BOB, 'Mint1111', 10_500_000, 6),
    ],
  });
  const text = render(tx);
  assert.match(text, /Bob1\S+\s+\+1\.5 SOL\n/);
  assert.match(text, /Alice\S+\s+-10\.5 USDC/);
  assert.match(text, /Bob1\S+\s+\+10\.5 of mint Mint1111/);
});

test('formatSummary says "none" when there are no token changes', () => {
  assert.match(render(makeTx()), /Token changes\n\s+none/);
});

test('formatSummary caps long lists and says how many were left out', () => {
  const others = Array.from({ length: 20 }, (_, i) => `Other${i}`);
  const pre = Array(21).fill(1_000_000_000);
  const post = pre.map((balance, i) => (i === 0 ? balance - 20 : balance + 1));
  const text = render(makeTx({ others, preBalances: pre, postBalances: post }));
  assert.match(text, new RegExp(`and ${21 - MAX_ROWS} more`));
  assert.doesNotMatch(text, /Other19/);
});