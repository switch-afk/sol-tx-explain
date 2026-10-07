'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { describeErrorHint } = require('../src/errors');
const { formatSummary, summarizeTransaction } = require('../src/explain');
const { makeTx } = require('./helpers/fixtures');

const JUPITER = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const jupiterIx = { number: 1, program: 'Jupiter Aggregator v6', programId: JUPITER };
const tokenIx = { number: 1, program: 'Token Program', programId: TOKEN };

test('no error means no hint', () => {
  assert.equal(describeErrorHint(null), null);
  assert.equal(describeErrorHint(undefined), null);
});

test('transaction-level errors are explained, unknown ones are not', () => {
  assert.match(describeErrorHint('InsufficientFundsForFee'), /afford the fee/);
  assert.equal(describeErrorHint('SomethingBrandNew'), null);
});

test('transaction errors that carry details are still recognised', () => {
  assert.match(describeErrorHint({ InsufficientFundsForRent: { account_index: 2 } }), /rent-exempt/);
});

test('running out of compute is explained and names the program', () => {
  assert.match(
    describeErrorHint({ InstructionError: [0, 'ComputationalBudgetExceeded'] }, [jupiterIx]),
    /^Instruction #1 \(Jupiter Aggregator v6\) failed: it ran out of compute units/
  );
});

test('an unknown instruction error name is passed through', () => {
  assert.equal(
    describeErrorHint({ InstructionError: [0, 'SomethingNew'] }, [jupiterIx]),
    'Instruction #1 (Jupiter Aggregator v6) failed with SomethingNew.'
  );
});

test('custom codes from an unknown program point at its docs', () => {
  const hint = describeErrorHint({ InstructionError: [0, { Custom: 6001 }] }, [jupiterIx]);
  assert.match(hint, /returned custom error code 6001/);
  assert.match(hint, /check its docs or source/);
});

test('common Token program custom codes are translated', () => {
  assert.match(
    describeErrorHint({ InstructionError: [0, { Custom: 1 }] }, [tokenIx]),
    /does not have enough tokens/
  );
});

test('without instruction context the program is simply not named', () => {
  assert.match(
    describeErrorHint({ InstructionError: [3, 'InsufficientFunds'] }),
    /^Instruction #4 failed: an account did not have enough funds\.$/
  );
});

test('a failed transaction gets a Why row and a failed Summary row', () => {
  const tx = makeTx({
    err: { InstructionError: [0, 'ComputationalBudgetExceeded'] },
    instructions: [{ programId: JUPITER, accounts: [], data: '' }],
  });
  const summary = summarizeTransaction(tx);
  assert.match(summary.errorHint, /Jupiter Aggregator v6/);

  const text = formatSummary(summary, { signature: 'SIG', host: 'h' });
  assert.match(text, /Summary\s+Failed on-chain/);
  assert.match(text, /Error\s+Instruction #1 failed: ComputationalBudgetExceeded/);
  assert.match(text, /Why\s+Instruction #1 \(Jupiter Aggregator v6\) failed: it ran out of compute units/);
});

test('a successful transaction has no Why row', () => {
  const text = formatSummary(summarizeTransaction(makeTx()), { signature: 'SIG', host: 'h' });
  assert.doesNotMatch(text, /Why\s/);
});