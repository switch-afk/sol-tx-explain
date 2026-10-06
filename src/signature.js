'use strict';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ALPHABET_MAP = new Map([...ALPHABET].map((char, index) => [char, index]));

const SIGNATURE_BYTES = 64;

class SignatureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SignatureError';
  }
}

/**
 * Decode a base58 string into bytes.
 * Throws SignatureError on any character outside the base58 alphabet.
 */
function base58Decode(input) {
  const bytes = [];

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const value = ALPHABET_MAP.get(char);
    if (value === undefined) {
      const lookalike = '0OIl'.includes(char)
        ? ' (base58 leaves out 0, O, I and l because they look alike)'
        : '';
      throw new SignatureError(
        `Invalid character "${char}" at position ${i + 1}${lookalike}.`
      );
    }

    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Each leading "1" is a leading zero byte.
  for (let k = 0; k < input.length && input[k] === '1'; k++) {
    bytes.push(0);
  }

  return Uint8Array.from(bytes.reverse());
}

/**
 * Check that the input is a well-formed Solana transaction signature:
 * valid base58 that decodes to exactly 64 bytes.
 * Returns the trimmed signature, or throws SignatureError.
 */
function validateSignature(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new SignatureError('No signature given.');
  }

  const signature = input.trim();
  const bytes = base58Decode(signature);

  if (bytes.length !== SIGNATURE_BYTES) {
    throw new SignatureError(
      `That decodes to ${bytes.length} bytes, but a transaction signature is ${SIGNATURE_BYTES} bytes. ` +
        'Did you paste a wallet address or a truncated signature?'
    );
  }

  return signature;
}

module.exports = {
  ALPHABET,
  SIGNATURE_BYTES,
  SignatureError,
  base58Decode,
  validateSignature,
};