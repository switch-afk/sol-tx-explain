'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { run } = require('../src/cli');
const pkg = require('../package.json');
const { fakeSignature } = require('./helpers/base58');

function sink() {
  let text = '';
  return {
    write(chunk) {
      text += chunk;
      return true;
    },
    get text() {
      return text;
    },
  };
}

function runCli(argv) {
  const stdout = sink();
  const stderr = sink();
  const code = run(argv, { stdout, stderr });
  return { code, out: stdout.text, err: stderr.text };
}

test('--help prints usage and exits 0', () => {
  const { code, out } = runCli(['--help']);
  assert.equal(code, 0);
  assert.match(out, /Usage:/);
});

test('--version prints the package version', () => {
  const { code, out } = runCli(['--version']);
  assert.equal(code, 0);
  assert.equal(out.trim(), pkg.version);
});

test('no arguments is a usage error', () => {
  const { code, err } = runCli([]);
  assert.equal(code, 2);
  assert.match(err, /Expected exactly one signature/);
});

test('unknown option is a usage error', () => {
  const { code, err } = runCli(['--nope']);
  assert.equal(code, 2);
  assert.match(err, /Unknown option: --nope/);
});

test('a valid signature exits 0', () => {
  const sig = fakeSignature();
  const { code, out } = runCli([sig]);
  assert.equal(code, 0);
  assert.match(out, /Signature looks valid/);
});

test('an invalid signature exits 1 with a clear message', () => {
  const { code, err } = runCli(['not-a-signature']);
  assert.equal(code, 1);
  assert.match(err, /Not a valid signature/);
});

test('the real executable runs end to end', () => {
  const bin = path.join(__dirname, '..', 'bin', 'sol-tx-explain.js');
  const result = spawnSync(process.execPath, [bin, '--version'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), pkg.version);
});