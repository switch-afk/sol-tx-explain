'use strict';

const LAMPORTS_PER_SOL = 1_000_000_000n;

/** Lamports to a SOL string, exact (BigInt), trailing zeros trimmed. */
function formatLamports(lamports) {
  const value = BigInt(lamports);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / LAMPORTS_PER_SOL;
  const fraction = (abs % LAMPORTS_PER_SOL)
    .toString()
    .padStart(9, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
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
  };
}

function row(label, value) {
  return `${label.padEnd(11)}${value}`;
}

function formatSummary(summary, { signature, host }) {
  const lines = [
    row('Signature', signature),
    row('Status', summary.status === 'success' ? 'Success' : 'Failed'),
  ];

  if (summary.error) lines.push(row('Error', summary.error));

  lines.push(
    row('Time', `${summary.time} (slot ${summary.slot})`),
    row('Fee', `${formatLamports(summary.fee)} SOL (${summary.fee} lamports)`),
    row('Fee payer', summary.feePayer),
    row('Signers', summary.signers[0] || 'none')
  );
  for (const signer of summary.signers.slice(1)) {
    lines.push(`${' '.repeat(11)}${signer}`);
  }

  lines.push(row('Version', summary.version), row('RPC', host));
  return `${lines.join('\n')}\n`;
}

module.exports = {
  describeError,
  formatLamports,
  formatSummary,
  formatTime,
  summarizeTransaction,
};