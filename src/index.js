'use strict';

const { buildHeadline } = require('./headline');
const { SignatureError, validateSignature } = require('./signature');
const { RpcError, getRpcUrl, hostLabel } = require('./rpc');
const { fetchTransaction } = require('./transaction');
const { formatSummary, summarizeTransaction, toJson } = require('./explain');

/**
 * Fetch a transaction and explain it.
 *
 * Options:
 *   rpcUrl      your RPC endpoint (defaults to SOL_TX_EXPLAIN_RPC, then the public RPC)
 *   env         environment object to read the default RPC from (defaults to process.env)
 *   rpcOptions  { retries, retryDelayMs, timeoutMs } passed to the RPC client
 *
 * Returns null when the RPC does not have the transaction (yet), otherwise:
 *   { signature, host, summary, json, text }
 *
 * Throws SignatureError for a malformed signature and RpcError for RPC problems.
 * Only the RPC hostname is ever included in results, never the full URL.
 */
async function explainTransaction(signature, options = {}) {
  const valid = validateSignature(signature);
  const url = options.rpcUrl || getRpcUrl(options.env || process.env);
  const host = hostLabel(url);

  const result = await fetchTransaction(url, valid, options.rpcOptions);
  if (!result) return null;

  const summary = summarizeTransaction(result);
  return {
    signature: valid,
    host,
    summary,
    json: toJson(summary, { signature: valid, host }),
    text: formatSummary(summary, { signature: valid, host }),
  };
}

module.exports = {
  RpcError,
  SignatureError,
  buildHeadline,
  explainTransaction,
  formatSummary,
  summarizeTransaction,
  toJson,
  validateSignature,
};