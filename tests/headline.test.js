'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { summarizeTransaction } = require('../src/explain');
const { shortAddress } = require('../src/programs');
const { PAYER, makeTx, tokenBalance } = require('./helpers/fixtures');

const MINT = 'MintAAAAbbbbCCCCddddEEEEffffGGGGhhhhIIIIjjjj';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BOB = 'Bob1111111111111111111111111111111111111111';
const JUPITER = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const RAYDIUM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';

const raw = (programId) => ({ programId, accounts: [], data: '' });
const headline = (tx) => summarizeTransaction(tx).headline;

// The payer swaps tokens for 0.029596831 SOL (fee is 5000 lamports, taken out of the summary).
const swapTx = (extra = {}) =>
  makeTx({
    others: ['TokenAcc1'],
    preBalances: [1_000_000_000, 1_000_000_000],
    postBalances: [1_000_000_000 + 29_596_831 - 5000, 1_000_000_000],
    preTokenBalances: [tokenBalance(1, PAYER, MINT, 17_960_851_474, 6)],
    postTokenBalances: [tokenBalance(1, PAYER, MINT, 0, 6)],
    ...extra,
  });

test('a swap is described from the fee payer side, with the fee taken out', () => {
  const result = headline(swapTx());
  assert.equal(result.kind, 'swap');
  assert.equal(
    result.text,
    `Likely a swap: sent 17960.851474 tokens (mint ${shortAddress(MINT)}), received 0.029596831 SOL`
  );
});

test('a swap names Jupiter when it was involved, even with other DEXes', () => {
  const result = headline(swapTx({ instructions: [raw(RAYDIUM), raw(JUPITER)] }));
  assert.match(result.text, / via Jupiter Aggregator v6$/);
});

test('a swap names the DEX when there is no aggregator', () => {
  const result = headline(swapTx({ instructions: [raw(RAYDIUM)] }));
  assert.match(result.text, / via Raydium AMM v4$/);
});

test('a plain SOL transfer names the recipient', () => {
  const result = headline(
    makeTx({
      others: [BOB],
      preBalances: [5_000_000_000, 1_000_000_000],
      postBalances: [5_000_000_000 - 1_500_000_000 - 5000, 2_500_000_000],
    })
  );
  assert.equal(result.kind, 'transfer');
  assert.equal(result.text, `Likely a SOL transfer: sent 1.5 SOL to ${shortAddress(BOB)}`);
});

test('receiving a known token', () => {
  const result = headline(
    makeTx({
      others: ['TokenAcc1'],
      postTokenBalances: [tokenBalance(1, PAYER, USDC, 10_500_000, 6)],
    })
  );
  assert.equal(result.kind, 'receive');
  assert.equal(result.text, 'Likely received 10.5 USDC');
});

test('sending a known token', () => {
  const result = headline(
    makeTx({
      others: ['TokenAcc1'],
      preTokenBalances: [tokenBalance(1, PAYER, USDC, 10_500_000, 6)],
      postTokenBalances: [tokenBalance(1, PAYER, USDC, 0, 6)],
    })
  );
  assert.equal(result.kind, 'send');
  assert.equal(result.text, 'Likely sent 10.5 USDC');
});

test('long lists are cut with a count', () => {
  const mints = [1, 2, 3, 4].map((i) => `Mint${i}`.padEnd(44, 'x'));
  const result = headline(
    makeTx({
      others: ['A', 'B', 'C', 'D'],
      preTokenBalances: mints.map((mint, i) => tokenBalance(i + 1, PAYER, mint, 1_000_000, 6)),
      postTokenBalances: mints.map((mint, i) => tokenBalance(i + 1, PAYER, mint, 0, 6)),
    })
  );
  assert.equal(result.kind, 'send');
  assert.match(result.text, /and 1 more$/);
});

test('a failed transaction says so', () => {
  const result = headline(makeTx({ err: 'AccountNotFound' }));
  assert.equal(result.kind, 'failed');
  assert.match(result.text, /nothing moved except the fee/);
});

test('a fee-only transaction says so', () => {
  const result = headline(makeTx());
  assert.equal(result.kind, 'fee-only');
  assert.match(result.text, /^No SOL or token balance changes/);
});

test('a transaction where only other accounts changed is called relayed', () => {
  const result = headline(
    makeTx({
      others: [BOB],
      preBalances: [1_000_000_000, 1_000_000_000],
      postBalances: [1_000_000_000 - 5000, 1_000_000_010],
    })
  );
  assert.equal(result.kind, 'relayed');
  assert.match(result.text, /run for someone else/);
});