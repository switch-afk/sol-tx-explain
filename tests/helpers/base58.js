'use strict';

const { ALPHABET } = require('../../src/signature');

/** Test-only base58 encoder, used to build signatures of known byte length. */
function base58Encode(bytes) {
  const digits = [];

  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let out = '';
  for (const byte of bytes) {
    if (byte === 0) out += '1';
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    out += ALPHABET[digits[i]];
  }
  return out;
}

/** A well-formed fake signature: 64 bytes, base58-encoded. */
function fakeSignature(fill = (_, i) => i + 1) {
  return base58Encode(Uint8Array.from({ length: 64 }, fill));
}

module.exports = { base58Encode, fakeSignature };