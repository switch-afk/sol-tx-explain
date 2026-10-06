'use strict';

const MAX_ROWS = 15;

// A few well-known mints so the output reads nicely. Anything else shows its mint address.
const KNOWN_MINTS = {
  So11111111111111111111111111111111111111112: 'wSOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
};

/** Exact integer-with-decimals formatting (BigInt), trailing zeros trimmed. */
function formatUnits(value, decimals) {
  const v = BigInt(value);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction =
    decimals > 0
      ? (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '')
      : '';
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** Lamports to a SOL string. */
function formatLamports(lamports) {
  return formatUnits(lamports, 9);
}

function withSign(text) {
  return text.startsWith('-') ? text : `+${text}`;
}

function formatTime(blockTime) {
  if (typeof blockTime !== 'number') return 'unknown';
  return new Date(blockTime * 1000).toISOString().replace('.000Z', 'Z');
}

/** Turn the RPC error object into a readable sentence. */
function describeError(err) {
  if (err === null || err === undefined) return null;
  if (typeof err === 'string') return err;

  if (err.InstructionError) {
    const [index, detail] = err.InstructionError;
    const where = `Instruction #${index + 1} failed`;
    if (typeof detail === 'string') return `${where}: ${detail}`;
    if (detail && detail.Custom !== undefined) {
      return `${where}: custom program error ${detail.Custom} (0x${Number(detail.Custom).toString(16)})`;
    }
    return `${where}: ${JSON.stringify(detail)}`;
  }

  return JSON.stringify(err);
}

/** Per-account SOL change (post minus pre), zero changes left out. */
function computeSolChanges(keys, meta) {
  const pre = meta.preBalances || [];
  const post = meta.postBalances || [];
  const changes = [];

  keys.forEach((key, index) => {
    if (pre[index] === undefined || post[index] === undefined) return;
    const delta = BigInt(post[index]) - BigInt(pre[index]);
    if (delta === 0n) return;
    changes.push({
      address: key.pubkey,
      lamports: delta.toString(),
      sol: formatUnits(delta, 9),
    });
  });

  return changes;
}

/**
 * Token changes, netted per owner and mint. A token account that did not exist
 * before counts from zero; one that was closed counts down to zero.
 */
function computeTokenChanges(keys, meta) {
  const totals = new Map();

  const add = (list, sign) => {
    for (const entry of list || []) {
      const owner =
        entry.owner ||
        (keys[entry.accountIndex] && keys[entry.accountIndex].pubkey) ||
        'unknown';
      const id = `${owner}|${entry.mint}`;
      const current = totals.get(id) || {
        owner,
        mint: entry.mint,
        decimals: entry.uiTokenAmount.decimals,
        raw: 0n,
      };
      current.raw += sign * BigInt(entry.uiTokenAmount.amount);
      totals.set(id, current);
    }
  };

  add(meta.preTokenBalances, -1n);
  add(meta.postTokenBalances, 1n);

  return [...totals.values()]
    .filter((t) => t.raw !== 0n)
    .map((t) => ({
      owner: t.owner,
      mint: t.mint,
      label: KNOWN_MINTS[t.mint] || null,
      decimals: t.decimals,
      raw: t.raw.toString(),
      amount: formatUnits(t.raw, t.decimals),
    }));
}

/** Reduce a jsonParsed getTransaction result to the fields we show. */
function summarizeTransaction(result) {
  const keys = result.transaction.message.accountKeys;
  const meta = result.meta || {};
  const error = describeError(meta.err);

  return {
    status: error ? 'failed' : 'success',
    error,
    fee: meta.fee,
    feePayer: keys.length > 0 ? keys[0].pubkey : null,
    signers: keys.filter((key) => key.signer).map((key) => key.pubkey),
    slot: result.slot,
    time: formatTime(result.blockTime),
    version: result.version === undefined ? 'legacy' : String(result.version),
    solChanges: computeSolChanges(keys, meta),
    tokenChanges: computeTokenChanges(keys, meta),
  };
}

function row(label, value) {
  return `${label.padEnd(11)}${value}`;
}

function section(title, rows, emptyText) {
  const lines = ['', title];
  if (rows.length === 0) lines.push(`  ${emptyText}`);
  for (const text of rows.slice(0, MAX_ROWS)) lines.push(`  ${text}`);
  if (rows.length > MAX_ROWS) lines.push(`  ... and ${rows.length - MAX_ROWS} more`);
  return lines;
}

function formatSummary(summary, { signature, host }) {
  const feeSol = formatLamports(summary.fee);

  const lines = [
    row('Signature', signature),
    row('Status', summary.status === 'success' ? 'Success' : 'Failed'),
  ];

  if (summary.error) lines.push(row('Error', summary.error));

  lines.push(
    row('Time', `${summary.time} (slot ${summary.slot})`),
    row('Fee', `${feeSol} SOL (${summary.fee} lamports)`),
    row('Fee payer', summary.feePayer),
    row('Signers', summary.signers[0] || 'none')
  );
  for (const signer of summary.signers.slice(1)) {
    lines.push(`${' '.repeat(11)}${signer}`);
  }
  lines.push(row('Version', summary.version), row('RPC', host));

  const solRows = summary.solChanges.map((change) => {
    const note =
      change.address === summary.feePayer ? ` (includes the ${feeSol} SOL fee)` : '';
    return `${change.address}  ${withSign(change.sol)} SOL${note}`;
  });
  lines.push(...section('SOL changes', solRows, 'none'));

  const tokenRows = summary.tokenChanges.map((change) => {
    const what = change.label ? change.label : `of mint ${change.mint}`;
    return `${change.owner}  ${withSign(change.amount)} ${what}`;
  });
  lines.push(...section('Token changes', tokenRows, 'none'));

  return `${lines.join('\n')}\n`;
}

module.exports = {
  KNOWN_MINTS,
  MAX_ROWS,
  computeSolChanges,
  computeTokenChanges,
  describeError,
  formatLamports,
  formatSummary,
  formatTime,
  formatUnits,
  summarizeTransaction,
};