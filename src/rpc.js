'use strict';

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
const ENV_VAR = 'SOL_TX_EXPLAIN_RPC';

class RpcError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RpcError';
  }
}

/**
 * Only the hostname is ever printed. RPC URLs often carry an API key
 * in the path or query string, so the full URL never reaches the output.
 */
function hostLabel(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'the RPC endpoint';
  }
}

function getRpcUrl(env = process.env) {
  return env[ENV_VAR] || DEFAULT_RPC;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function rpcCall(url, method, params, options = {}) {
  const { retries = 2, retryDelayMs = 600, timeoutMs = 15000 } = options;
  const host = hostLabel(url);
  const hint = `Public RPCs rate-limit heavily. Set ${ENV_VAR} to your own RPC endpoint.`;

  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const reason = error && error.name === 'TimeoutError' ? ' (timed out)' : '';
      throw new RpcError(`Could not reach ${host}${reason}.`);
    }

    if (response.status === 429) {
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      throw new RpcError(`${host} is rate-limiting requests (HTTP 429). ${hint}`);
    }

    if (!response.ok) {
      throw new RpcError(`${host} returned HTTP ${response.status}.`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new RpcError(`${host} sent a response that is not valid JSON.`);
    }

    if (payload.error) {
      throw new RpcError(
        `${host} returned an error: ${payload.error.message || 'unknown error'}`
      );
    }

    return payload.result;
  }
}

module.exports = { DEFAULT_RPC, ENV_VAR, RpcError, getRpcUrl, hostLabel, rpcCall };