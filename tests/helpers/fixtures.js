'use strict';

const PAYER = 'FeePayer1111111111111111111111111111111111';

/** A minimal jsonParsed getTransaction result. */
function makeTx({
  err = null,
  fee = 5000,
  signers = [PAYER],
  others = [],
  slot = 300000000,
  blockTime = 1767225600, // 2026-01-01T00:00:00Z
  version = 0,
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

  return {
    slot,
    blockTime,
    version,
    meta: { err, fee },
    transaction: { message: { accountKeys }, signatures: [] },
  };
}

module.exports = { PAYER, makeTx };