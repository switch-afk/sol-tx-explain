'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const lib = require('../src/index');

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString('hex')}`);
  let out = '';
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = `1${out}`;
  }
  return out;
}

const SIGNATURE = base58(crypto.randomBytes(64));
const RPC_URL = 'https://rpc.example.com/?api-key=secret-key';

function stubFetch(result) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({ jsonrpc: '2.0', id: 1, result }),
  });
  return () => {
    globalThis.fetch = original;
  };
}

const FIXTURE = {
  slot: 1,
  blockTime: 0,
  transaction: {
    message: {
      accountKeys: [{ pubkey: 'FeePayer1111111111111111111111111111111111', signer: true }],
      instructions: [],
    },
  },
  meta: {
    err: null,
    fee: 5000,
    preBalances: [10000],
    postBalances: [5000],
    preTokenBalances: [],
    postTokenBalances: [],
    innerInstructions: [],
  },
};

test('index exports the public API', () => {
  for (const name of [
    'explainTransaction',
    'summarizeTransaction',
    'formatSummary',
    'toJson',
    'buildHeadline',
    'validateSignature',
  ]) {
    assert.equal(typeof lib[name], 'function', name);
  }
  assert.equal(typeof lib.SignatureError, 'function');
  assert.equal(typeof lib.RpcError, 'function');
});

test('explainTransaction rejects a malformed signature', async () => {
  await assert.rejects(
    () => lib.explainTransaction('not-a-signature', { rpcUrl: RPC_URL }),
    lib.SignatureError
  );
});

test('explainTransaction returns null when the RPC has no such transaction', async () => {
  const restore = stubFetch(null);
  try {
    const out = await lib.explainTransaction(SIGNATURE, { rpcUrl: RPC_URL });
    assert.equal(out, null);
  } finally {
    restore();
  }
});

test('explainTransaction returns summary, json and text without leaking the RPC key', async () => {
  const restore = stubFetch(FIXTURE);
  try {
    const out = await lib.explainTransaction(SIGNATURE, { rpcUrl: RPC_URL });
    assert.equal(out.signature, SIGNATURE);
    assert.equal(out.host, 'rpc.example.com');
    assert.equal(out.summary.status, 'success');
    assert.equal(out.json.signature, SIGNATURE);
    assert.ok(out.text.includes(SIGNATURE));
    assert.ok(!JSON.stringify(out).includes('secret-key'));
  } finally {
    restore();
  }
});