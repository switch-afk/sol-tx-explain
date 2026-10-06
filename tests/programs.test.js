'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { PROGRAM_LABELS, KNOWN_MINTS, programLabel } = require('../src/labels');
const { base58Decode } = require('../src/signature');
const {
  describeInstruction,
  shortAddress,
  summarizeInstructions,
} = require('../src/programs');
const { formatSummary, summarizeTransaction } = require('../src/explain');
const { base58Encode } = require('./helpers/base58');
const { makeTx } = require('./helpers/fixtures');

const SYSTEM = '11111111111111111111111111111111';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const COMPUTE = 'ComputeBudget111111111111111111111111111111';
const JUPITER = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const RAYDIUM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const UNKNOWN = 'Unknown1111111111111111111111111111111111';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SRC = 'SrcAAAAbbbbCCCCddddEEEEffffGGGGhhhhIIIIjjjj';
const DST = 'DstAAAAbbbbCCCCddddEEEEffffGGGGhhhhIIIIjjjj';

const parsed = (program, programId, type, info) => ({
  program,
  programId,
  parsed: { type, info },
});
const raw = (programId, data = '') => ({ programId, accounts: [], data });
const computeIx = (bytes) => raw(COMPUTE, base58Encode(Uint8Array.from(bytes)));

test('every labelled program and mint is a valid 32-byte address', () => {
  for (const id of [...Object.keys(PROGRAM_LABELS), ...Object.keys(KNOWN_MINTS)]) {
    assert.equal(base58Decode(id).length, 32, id);
  }
});

test('programLabel knows common programs and returns null for others', () => {
  assert.equal(programLabel(SYSTEM), 'System Program');
  assert.equal(programLabel(TOKEN), 'Token Program');
  assert.equal(programLabel(JUPITER), 'Jupiter Aggregator v6');
  assert.equal(programLabel(UNKNOWN), null);
});

test('shortAddress keeps the first and last four characters', () => {
  assert.equal(shortAddress(SRC), 'SrcA...jjjj');
  assert.equal(shortAddress('short'), 'short');
});

test('describes a system transfer', () => {
  const ix = parsed('system', SYSTEM, 'transfer', {
    source: SRC,
    destination: DST,
    lamports: 1_500_000_000,
  });
  assert.equal(
    describeInstruction(ix),
    `transfer 1.5 SOL from ${shortAddress(SRC)} to ${shortAddress(DST)}`
  );
});

test('describes a system createAccount', () => {
  const ix = parsed('system', SYSTEM, 'createAccount', {
    source: SRC,
    newAccount: DST,
    lamports: 2_039_280,
    space: 165,
  });
  assert.match(describeInstruction(ix), /create account DstA\.\.\.jjjj \(165 bytes, funded with 0\.00203928 SOL\)/);
});

test('describes token transfers with known and unknown mints', () => {
  const info = (mint) => ({
    source: SRC,
    destination: DST,
    mint,
    authority: SRC,
    tokenAmount: { amount: '10500000', decimals: 6, uiAmountString: '10.5' },
  });
  assert.match(
    describeInstruction(parsed('spl-token', TOKEN, 'transferChecked', info(USDC))),
    /^transfer 10\.5 USDC from /
  );
  assert.match(
    describeInstruction(parsed('spl-token', TOKEN, 'transferChecked', info(UNKNOWN))),
    /^transfer 10\.5 of mint Unkn\.\.\.1111 from /
  );
});

test('describes an unchecked token transfer in raw units', () => {
  const ix = parsed('spl-token', TOKEN, 'transfer', { source: SRC, destination: DST, amount: '42' });
  assert.match(describeInstruction(ix), /^transfer 42 raw units from /);
});

test('describes closeAccount, syncNative and associated token account creation', () => {
  assert.match(
    describeInstruction(parsed('spl-token', TOKEN, 'closeAccount', { account: SRC })),
    /^close token account SrcA\.\.\.jjjj$/
  );
  assert.match(
    describeInstruction(parsed('spl-token', TOKEN, 'syncNative', { account: SRC })),
    /^sync wrapped SOL balance of SrcA\.\.\.jjjj$/
  );
  assert.match(
    describeInstruction(
      parsed('spl-associated-token-account', 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', 'createIdempotent', {
        wallet: SRC,
        mint: USDC,
      })
    ),
    /^create token account for SrcA\.\.\.jjjj \(mint EPjF\.\.\.t1v\)$|^create token account for SrcA\.\.\.jjjj \(mint EPjF\.\.\.[A-Za-z0-9]{4}\)$/
  );
});

test('falls back to a readable version of the instruction type', () => {
  const ix = parsed('spl-token', TOKEN, 'initializeAccount3', {});
  assert.equal(describeInstruction(ix), 'initialize account3');
});

test('describes a memo and truncates long ones', () => {
  assert.equal(
    describeInstruction({ program: 'spl-memo', programId: 'm', parsed: 'hello' }),
    'memo "hello"'
  );
  const long = describeInstruction({ program: 'spl-memo', programId: 'm', parsed: 'x'.repeat(100) });
  assert.match(long, /^memo "x+\.\.\."$/);
  assert.ok(long.length < 70);
});

test('decodes compute budget instructions', () => {
  assert.equal(
    describeInstruction(computeIx([2, 0x20, 0xa1, 0x07, 0x00])),
    'set compute unit limit to 500000'
  );
  assert.equal(
    describeInstruction(computeIx([3, 0x50, 0xc3, 0, 0, 0, 0, 0, 0])),
    'set compute unit price to 50000 micro-lamports'
  );
});

test('compute budget instructions it cannot decode are reported as not decoded', () => {
  assert.equal(describeInstruction(computeIx([9])), 'instruction (not decoded)');
  assert.equal(describeInstruction(raw(COMPUTE, '0OIl')), 'instruction (not decoded)');
});

test('other undecoded instructions are reported honestly', () => {
  assert.equal(describeInstruction(raw(JUPITER, '3Bxs')), 'instruction (not decoded)');
});

test('summarizeInstructions counts inner calls and lists unique programs in order', () => {
  const result = makeTx({
    instructions: [
      computeIx([2, 0x20, 0xa1, 0x07, 0x00]),
      raw(JUPITER, '3Bxs'),
      parsed('system', SYSTEM, 'transfer', { source: SRC, destination: DST, lamports: 1 }),
    ],
    innerInstructions: [
      {
        index: 1,
        instructions: [
          raw(RAYDIUM),
          parsed('spl-token', TOKEN, 'transfer', { source: SRC, destination: DST, amount: '1' }),
        ],
      },
    ],
  });
  const { instructions, programs } = summarizeInstructions(result);

  assert.deepEqual(
    instructions.map((ix) => [ix.number, ix.program, ix.inner]),
    [
      [1, 'Compute Budget Program', 0],
      [2, 'Jupiter Aggregator v6', 2],
      [3, 'System Program', 0],
    ]
  );
  assert.deepEqual(
    programs.map((p) => p.label),
    ['Compute Budget Program', 'Jupiter Aggregator v6', 'System Program', 'Raydium AMM v4', 'Token Program']
  );
});

test('summarizeTransaction includes programs and instructions', () => {
  const summary = summarizeTransaction(makeTx({ instructions: [raw(UNKNOWN)] }));
  assert.equal(summary.instructions.length, 1);
  assert.equal(summary.programs[0].label, null);
});

test('formatSummary prints the Programs and Instructions sections', () => {
  const tx = makeTx({
    instructions: [computeIx([2, 0x20, 0xa1, 0x07, 0x00]), raw(JUPITER, '3Bxs'), raw(UNKNOWN)],
    innerInstructions: [{ index: 1, instructions: [raw(RAYDIUM), raw(RAYDIUM)] }],
  });
  const text = formatSummary(summarizeTransaction(tx), { signature: 'SIG', host: 'h' });

  assert.match(text, /Programs\n {2}Compute Budget Program\n {2}Jupiter Aggregator v6\n/);
  assert.match(text, new RegExp(`${UNKNOWN} \\(unlabeled\\)`));
  assert.match(text, /Raydium AMM v4/);
  assert.match(text, /1\. Compute Budget Program: set compute unit limit to 500000/);
  assert.match(text, /2\. Jupiter Aggregator v6: instruction \(not decoded\) \(\+2 inner calls\)/);
  assert.match(text, /3\. unknown program Unkn\.\.\.1111: instruction \(not decoded\)/);
});

test('formatSummary says "none" when a transaction has no instructions', () => {
  const text = formatSummary(summarizeTransaction(makeTx()), { signature: 'SIG', host: 'h' });
  assert.match(text, /Programs\n\s+none/);
  assert.match(text, /Instructions\n\s+none/);
});