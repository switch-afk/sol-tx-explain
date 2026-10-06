'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SignatureError,
  base58Decode,
  validateSignature,
} = require('../src/signature');
const { base58Encode, fakeSignature } = require('./helpers/base58');

test('base58Decode handles single characters', () => {
  assert.deepEqual([...base58Decode('1')], [0]);
  assert.deepEqual([...base58Decode('2')], [1]);
});

test('base58Decode round-trips arbitrary bytes', () => {
  const bytes = Uint8Array.from([0, 0, 7, 255, 128, 3, 99]);
  assert.deepEqual([...base58Decode(base58Encode(bytes))], [...bytes]);
});

test('base58Decode rejects characters outside the alphabet', () => {
  for (const bad of ['0', 'O', 'I', 'l', '+', ' ']) {
    assert.throws(() => base58Decode(`abc${bad}def`), SignatureError);
  }
});

test('validateSignature accepts a 64-byte signature', () => {
  const sig = fakeSignature();
  assert.equal(validateSignature(sig), sig);
});

test('validateSignature accepts 64 leading zero bytes', () => {
  const sig = fakeSignature(() => 0);
  assert.equal(sig, '1'.repeat(64));
  assert.equal(validateSignature(sig), sig);
});

test('validateSignature trims surrounding whitespace', () => {
  const sig = fakeSignature();
  assert.equal(validateSignature(`  ${sig}\n`), sig);
});

test('validateSignature rejects empty input', () => {
  assert.throws(() => validateSignature(''), /No signature/);
  assert.throws(() => validateSignature('   '), /No signature/);
  assert.throws(() => validateSignature(undefined), /No signature/);
});

test('validateSignature rejects a 32-byte value (wallet address length)', () => {
  const address = base58Encode(Uint8Array.from({ length: 32 }, (_, i) => i + 1));
  assert.throws(() => validateSignature(address), /32 bytes/);
});

test('validateSignature rejects a truncated signature', () => {
  const sig = fakeSignature().slice(0, 60);
  assert.throws(() => validateSignature(sig), SignatureError);
});

test('validateSignature names the bad character and position', () => {
  const sig = `0${fakeSignature().slice(1)}`;
  assert.throws(() => validateSignature(sig), /"0" at position 1/);
});