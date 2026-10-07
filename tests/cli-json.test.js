'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../src/cli');
const { fakeSignature } = require('./helpers/base58');
const { makeTx } = require('./helpers/fixtures');
const { withMockRpc, rpcResult } = require('./helpers/mock-rpc');

function sink() {
  let text = '';
  return {
    write(chunk) {
      text += chunk;
      return true;
    },
    get text() {
      return text;
    },
  };
}

async function runCli(argv, extra = {}) {
  const stdout = sink();
  const stderr = sink();
  const code = await run(argv, { stdout, stderr, rpcOptions: { retryDelayMs: 0 }, ...extra });
  return { code, out: stdout.text, err: stderr.text };
}

const envFor = (mock) => ({ SOL_TX_EXPLAIN_RPC: `${mock.url}/my-secret-key` });

test('--json prints one parseable JSON document and nothing else', async () => {
  const sig = fakeSignature();
  await withMockRpc(
    (body) => rpcResult(body, makeTx()),
    async (mock) => {
      const { code, out, err } = await runCli(['--json', sig], { env: envFor(mock) });
      assert.equal(code, 0);
      assert.equal(err, '');
      assert.doesNotMatch(out, /my-secret-key/);

      const data = JSON.parse(out);
      assert.equal(data.signature, sig);
      assert.equal(data.rpc, '127.0.0.1');
      assert.equal(data.status, 'success');
      assert.deepEqual(data.fee, { lamports: 5000, sol: '0.000005' });
      assert.equal(data.headline.kind, 'fee-only');
      assert.equal(data.errorHint, null);
      assert.ok(Array.isArray(data.solChanges));
      assert.ok(Array.isArray(data.instructions));
    }
  );
});

test('--json works with the flag after the signature too', async () => {
  await withMockRpc(
    (body) => rpcResult(body, makeTx()),
    async (mock) => {
      const { code, out } = await runCli([fakeSignature(), '--json'], { env: envFor(mock) });
      assert.equal(code, 0);
      assert.equal(JSON.parse(out).status, 'success');
    }
  );
});

test('--json for a failed transaction includes the error and the hint', async () => {
  await withMockRpc(
    (body) => rpcResult(body, makeTx({ err: { InstructionError: [0, 'ComputationalBudgetExceeded'] } })),
    async (mock) => {
      const { code, out } = await runCli(['--json', fakeSignature()], { env: envFor(mock) });
      assert.equal(code, 0);
      const data = JSON.parse(out);
      assert.equal(data.status, 'failed');
      assert.match(data.error, /ComputationalBudgetExceeded/);
      assert.match(data.errorHint, /ran out of compute units/);
    }
  );
});

test('--json with an invalid signature prints nothing on stdout and exits 1', async () => {
  const { code, out, err } = await runCli(['--json', 'not-a-signature']);
  assert.equal(code, 1);
  assert.equal(out, '');
  assert.match(err, /Not a valid signature/);
});

test('--json without a signature is a usage error', async () => {
  const { code, err } = await runCli(['--json']);
  assert.equal(code, 2);
  assert.match(err, /Expected exactly one signature/);
});

test('text output now starts with a Summary line', async () => {
  await withMockRpc(
    (body) => rpcResult(body, makeTx()),
    async (mock) => {
      const { out } = await runCli([fakeSignature()], { env: envFor(mock) });
      assert.match(out, /Summary\s+No SOL or token balance changes/);
    }
  );
});