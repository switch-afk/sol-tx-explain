'use strict';

const { RpcError, rpcCall } = require('./rpc');

const DEFAULT_MAX_VERSION = 1;
const MAX_VERSION_RETRIES = 3;

/**
 * Fetch a transaction. Asks for the newest transaction version we know about,
 * and if the RPC says it needs a higher maxSupportedTransactionVersion,
 * reads the number from its error and tries again.
 */
async function fetchTransaction(url, signature, rpcOptions) {
  let maxVersion = DEFAULT_MAX_VERSION;

  for (let attempt = 0; ; attempt++) {
    try {
      return await rpcCall(
        url,
        'getTransaction',
        [
          signature,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: maxVersion,
            commitment: 'confirmed',
          },
        ],
        rpcOptions
      );
    } catch (error) {
      const match =
        error instanceof RpcError &&
        /"maxSupportedTransactionVersion":\s*(\d+)/.exec(error.message);
      const needed = match ? Number(match[1]) : 0;

      if (needed > maxVersion && attempt < MAX_VERSION_RETRIES) {
        maxVersion = needed;
        continue;
      }
      throw error;
    }
  }
}

module.exports = { DEFAULT_MAX_VERSION, MAX_VERSION_RETRIES, fetchTransaction };