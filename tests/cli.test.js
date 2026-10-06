'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { run } = require('../src/cli');
const pkg = require('../package.json');
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
  const code = await run(argv, {
    stdout,
    stderr,
    rpcOptions: { retryDelayMs: 0 },
    ...extra,
  });
  return { code, out: stdout.text, err: stderr.text };
}

const envFor = (mock) => ({ SOL_TX_EXPLAIN_RPC: `${mock.url}/my-secret-key` });

test('--help prints usage and exits 0', async () => {
  const { code, out } = await runCli(['--help']);
  assert.equal(code, 0);
  assert.match(out, /Usage:/);
  assert.match(out, /SOL_TX_EXPLAIN_RPC/);
});

test('--version prints the package version', async () => {
  const { code, out } = await runCli(['--version']);
  assert.equal(code, 0);
  assert.equal(out.trim(), pkg.version);
});

test('no arguments is a usage error', async () => {
  const { code, err } = await runCli([]);
  assert.equal(code, 2);
  assert.match(err, /Expected exactly one signature/);
});

test('unknown option is a usage error', async () => {
  const { code, err } = await runCli(['--nope']);
  assert.equal(code, 2);
  assert.match(err, /Unknown option: --nope/);
});

test('an invalid signature exits 1 and never touches the network', async () => {
  await withMockRpc(
    (body) => rpcResult(body, null),
    async (mock) => {
      const { code, err } = await runCli(['not-a-signature'], { env: envFor(mock) });
      assert.equal(code, 1);
      assert.match(err, /Not a valid signature/);
      assert.equal(mock.requests.length, 0);
    }
  );
});

test('a successful transaction is fetched and explained', async () => {
  const sig = fakeSignature();
  await withMockRpc(
    (body) => rpcResult(body, makeTx()),
    async (mock) => {
      const { code, out } = await runCli([sig], { env: envFor(mock) });
      assert.equal(code, 0);
      assert.match(out, /Status\s+Success/);
      assert.match(out, /127\.0\.0\.1/);
      assert.doesNotMatch(out, /my-secret-key/);

      const [{ body }] = mock.requests;
      assert.equal(body.method, 'getTransaction');
      assert.equal(body.params[0], sig);
      assert.deepEqual(body.params[1], {
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 1,
        commitment: 'confirmed',
      });
    }
  );
});

test('a higher required transaction version is read from the error and retried', async () => {
  const versionError = (body) => ({
    json: {
      jsonrpc: '2.0',
      id: body.id,
      error: {
        code: -32015,
        message:
          'Transaction version (2) is not supported by the requesting client. ' +
          'Please try the request again with the following configuration parameter: "maxSupportedTransactionVersion": 2',
      },
    },
  });

  await withMockRpc(
    (body) =>
      body.params[1].maxSupportedTransactionVersion < 2
        ? versionError(body)
        : rpcResult(body, makeTx({ version: 2 })),
    async (mock) => {
      const { code, out } = await runCli([fakeSignature()], { env: envFor(mock) });
      assert.equal(code, 0);
      assert.match(out, /Version\s+2/);
      assert.equal(mock.requests.length, 2);
      assert.equal(mock.requests[1].body.params[1].maxSupportedTransactionVersion, 2);
    }
  );
});

test('a failed transaction is explained and still exits 0', async () => {
  await withMockRpc(
    (body) => rpcResult(body, makeTx({ err: { InstructionError: [0, { Custom: 6001 }] } })),
    async (mock) => {
      const { code, out } = await runCli([fakeSignature()], { env: envFor(mock) });
      assert.equal(code, 0);
      assert.match(out, /Status\s+Failed/);
      assert.match(out, /custom program error 6001/);
    }
  );
});

test('a missing transaction exits 1 with a helpful message', async () => {
  await withMockRpc(
    (body) => rpcResult(body, null),
    async (mock) => {
      const { code, err } = await runCli([fakeSignature()], { env: envFor(mock) });
      assert.equal(code, 1);
      assert.match(err, /not found/i);
      assert.match(err, /SOL_TX_EXPLAIN_RPC/);
      assert.doesNotMatch(err, /my-secret-key/);
    }
  );
});

test('a rate-limited RPC exits 1 with the own-RPC hint', async () => {
  await withMockRpc(
    () => ({ status: 429, json: {} }),
    async (mock) => {
      const { code, err } = await runCli([fakeSignature()], { env: envFor(mock) });
      assert.equal(code, 1);
      assert.match(err, /rate-limiting/);
    }
  );
});

test('the real executable runs end to end', () => {
  const bin = path.join(__dirname, '..', 'bin', 'sol-tx-explain.js');
  const result = spawnSync(process.execPath, [bin, '--version'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), pkg.version);
});