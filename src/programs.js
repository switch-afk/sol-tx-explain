'use strict';

const { base58Decode } = require('./signature');
const { formatLamports } = require('./format');
const { COMPUTE_BUDGET_ID, KNOWN_MINTS, programLabel } = require('./labels');

const MAX_MEMO = 60;

function shortAddress(address) {
  if (typeof address !== 'string' || address.length <= 10) return String(address);
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function truncate(text) {
  return text.length > MAX_MEMO ? `${text.slice(0, MAX_MEMO - 3)}...` : text;
}

/** "initializeAccount3" -> "initialize account3" */
function humanize(type) {
  return String(type).replace(/([A-Z])/g, ' $1').toLowerCase();
}

function tokenWhat(mint) {
  return KNOWN_MINTS[mint] || `of mint ${shortAddress(mint)}`;
}

/** The jsonParsed RPC leaves compute budget instructions undecoded, so read them here. */
function describeComputeBudget(data) {
  try {
    const bytes = Buffer.from(base58Decode(data));
    switch (bytes[0]) {
      case 1:
        return `request heap frame of ${bytes.readUInt32LE(1)} bytes`;
      case 2:
        return `set compute unit limit to ${bytes.readUInt32LE(1)}`;
      case 3:
        return `set compute unit price to ${bytes.readBigUInt64LE(1)} micro-lamports`;
      case 4:
        return `set loaded accounts data size limit to ${bytes.readUInt32LE(1)} bytes`;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function describeParsed(ix) {
  const { type, info = {} } = ix.parsed;
  const program = ix.program;

  if (program === 'system') {
    if (type === 'transfer') {
      return `transfer ${formatLamports(info.lamports)} SOL from ${shortAddress(info.source)} to ${shortAddress(info.destination)}`;
    }
    if (type === 'createAccount') {
      return `create account ${shortAddress(info.newAccount)} (${info.space} bytes, funded with ${formatLamports(info.lamports)} SOL)`;
    }
  }

  if (program === 'spl-token' || program === 'spl-token-2022') {
    if (type === 'transferChecked' && info.tokenAmount) {
      return `transfer ${info.tokenAmount.uiAmountString} ${tokenWhat(info.mint)} from ${shortAddress(info.source)} to ${shortAddress(info.destination)}`;
    }
    if (type === 'transfer') {
      return `transfer ${info.amount} raw units from ${shortAddress(info.source)} to ${shortAddress(info.destination)}`;
    }
    if (type === 'closeAccount') {
      return `close token account ${shortAddress(info.account)}`;
    }
    if (type === 'syncNative') {
      return `sync wrapped SOL balance of ${shortAddress(info.account)}`;
    }
  }

  if (
    program === 'spl-associated-token-account' &&
    (type === 'create' || type === 'createIdempotent')
  ) {
    return `create token account for ${shortAddress(info.wallet)} (mint ${shortAddress(info.mint)})`;
  }

  return humanize(type);
}

/** One plain-English line for an instruction. Honest when it cannot decode it. */
function describeInstruction(ix) {
  if (typeof ix.parsed === 'string') return `memo "${truncate(ix.parsed)}"`;
  if (ix.parsed && typeof ix.parsed === 'object') return describeParsed(ix);

  if (ix.programId === COMPUTE_BUDGET_ID) {
    const text = describeComputeBudget(ix.data);
    if (text) return text;
  }

  return 'instruction (not decoded)';
}

function programName(ix) {
  return programLabel(ix.programId) || `unknown program ${shortAddress(ix.programId)}`;
}

/**
 * Top-level instructions with a count of the inner calls each made, plus the
 * unique programs involved (top-level first, then inner), in order of appearance.
 */
function summarizeInstructions(result) {
  const top = result.transaction.message.instructions || [];
  const inner = (result.meta && result.meta.innerInstructions) || [];
  const innerCount = new Map(inner.map((group) => [group.index, group.instructions.length]));

  const instructions = top.map((ix, i) => ({
    number: i + 1,
    programId: ix.programId,
    program: programName(ix),
    text: describeInstruction(ix),
    inner: innerCount.get(i) || 0,
  }));

  const seen = new Map();
  const note = (programId) => {
    if (!seen.has(programId)) {
      seen.set(programId, { programId, label: programLabel(programId) });
    }
  };
  top.forEach((ix) => note(ix.programId));
  inner.forEach((group) => group.instructions.forEach((ix) => note(ix.programId)));

  return { instructions, programs: [...seen.values()] };
}

module.exports = {
  describeComputeBudget,
  describeInstruction,
  shortAddress,
  summarizeInstructions,
};