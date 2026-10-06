'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { RpcError, getRpcUrl, hostLabel, rpcCall, DEFAULT_RPC } = require('../src/rpc');
const { withMockRpc, rpcResult } = require('./helpers/mock-rpc');

const fast = { retryDelayMs: 0 };

test('hostLabel keeps only the hostname', () => {
  assert.equal(
    hostLabel('https://mainnet.helius-rpc.com/?api-key=SECRET'),
    'mainnet.helius-rpc.com'
  );
  assert.equal(hostLabel('garbage'), 'the RPC endpoint');
});

test('getRpcUrl prefers the environment variable', () => {
  assert.equal(getRpcUrl({}), DEFAULT_RPC);
  assert.equal(getRpcUrl({ SOL_TX_EXPLAIN_RPC: 'https://x.test' }), 'https://x.test');
});

test('rpcCall returns the result and sends a JSON-RPC body', async () => {
  await withMockRpc(
    (body) => rpcResult(body, { ok: true }),
    async (mock) => {
      const result = await rpcCall(mock.url, 'getHealth', ['a'], fast);
      assert.deepEqual(result, { ok: true });
      assert.equal(mock.requests[0].body.method, 'getHealth');
      assert.deepEqual(mock.requests[0].body.params, ['a']);
    }
  );
});

test('rpcCall retries a 429 and then succeeds', async () => {
  await withMockRpc(
    (body, n) => (n < 3 ? { status: 429, json: {} } : rpcResult(body, 'fine')),
    async (mock) => {
      const result = await rpcCall(mock.url, 'getHealth', [], fast);
      assert.equal(result, 'fine');
      assert.equal(mock.requests.length, 3);
    }
  );
});

test('rpcCall gives up on a persistent 429 and hints at your own RPC', async () => {
  await withMockRpc(
    () => ({ status: 429, json: {} }),
    async (mock) => {
      await assert.rejects(rpcCall(mock.url, 'getHealth', [], fast), (error) => {
        assert.ok(error instanceof RpcError);
        assert.match(error.message, /rate-limiting/);
        assert.match(error.message, /SOL_TX_EXPLAIN_RPC/);
        return true;
      });
      assert.equal(mock.requests.length, 3);
    }
  );
});

test('rpcCall reports other HTTP errors', async () => {
  await withMockRpc(
    () => ({ status: 500, json: {} }),
    async (mock) => {
      await assert.rejects(rpcCall(mock.url, 'getHealth', [], fast), /HTTP 500/);
    }
  );
});

test('rpcCall reports a non-JSON response', async () => {
  await withMockRpc(
    () => ({ raw: 'nope' }),
    async (mock) => {
      await assert.rejects(rpcCall(mock.url, 'getHealth', [], fast), /not valid JSON/);
    }
  );
});

test('rpcCall surfaces a JSON-RPC error message', async () => {
  await withMockRpc(
    (body) => ({ json: { jsonrpc: '2.0', id: body.id, error: { code: -32602, message: 'bad params' } } }),
    async (mock) => {
      await assert.rejects(rpcCall(mock.url, 'getHealth', [], fast), /bad params/);
    }
  );
});

test('rpcCall never leaks the URL path when the host is unreachable', async () => {
  await assert.rejects(
    rpcCall('http://127.0.0.1:1/secret-key', 'getHealth', [], fast),
    (error) => {
      assert.ok(error instanceof RpcError);
      assert.match(error.message, /Could not reach 127\.0\.0\.1/);
      assert.doesNotMatch(error.message, /secret-key/);
      return true;
    }
  );
});