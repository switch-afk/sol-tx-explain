'use strict';

const http = require('node:http');

/**
 * Tiny local JSON-RPC server for tests.
 * handler(body, requestNumber) returns { status?, json?, raw? }.
 */
async function startMockRpc(handler) {
  const requests = [];

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      requests.push({ url: req.url, body });
      const reply = handler(body, requests.length) || {};
      res.writeHead(reply.status || 200, { 'content-type': 'application/json' });
      if (reply.raw !== undefined) {
        res.end(reply.raw);
      } else {
        res.end(
          JSON.stringify(
            reply.json !== undefined
              ? reply.json
              : { jsonrpc: '2.0', id: body.id, result: null }
          )
        );
      }
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close() {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

/** Start a mock, run fn, always shut the mock down. */
async function withMockRpc(handler, fn) {
  const mock = await startMockRpc(handler);
  try {
    return await fn(mock);
  } finally {
    await mock.close();
  }
}

const rpcResult = (body, result) => ({
  json: { jsonrpc: '2.0', id: body.id, result },
});

module.exports = { startMockRpc, withMockRpc, rpcResult };