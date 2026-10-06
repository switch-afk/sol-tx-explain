'use strict';

const PAYER = 'FeePayer1111111111111111111111111111111111';

/**
 * A minimal jsonParsed getTransaction result.
 * By default every account holds 1 SOL before, and the fee payer pays the fee.
 */
function makeTx({
  err = null,
  fee = 5000,
  signers = [PAYER],
  others = [],
  slot = 300000000,
  blockTime = 1767225600, // 2026-01-01T00:00:00Z
  version = 0,
  preBalances,
  postBalances,
  preTokenBalances = [],
  postTokenBalances = [],
} = {}) {
  const accountKeys = [
    ...signers.map((pubkey) => ({
      pubkey,
      signer: true,
      writable: true,
      source: 'transaction',
    })),
    ...others.map((pubkey) => ({
      pubkey,
      signer: false,
      writable: true,
      source: 'transaction',
    })),
  ];

  const pre = preBalances || accountKeys.map(() => 1_000_000_000);
  const post = postBalances || pre.map((balance, i) => (i === 0 ? balance - fee : balance));

  return {
    slot,
    blockTime,
    version,
    meta: {
      err,
      fee,
      preBalances: pre,
      postBalances: post,
      preTokenBalances,
      postTokenBalances,
    },
    transaction: { message: { accountKeys }, signatures: [] },
  };
}

/** A token balance entry as the RPC returns it. */
function tokenBalance(accountIndex, owner, mint, amount, decimals) {
  return {
    accountIndex,
    mint,
    owner,
    uiTokenAmount: { amount: String(amount), decimals },
  };
}

module.exports = { PAYER, makeTx, tokenBalance };