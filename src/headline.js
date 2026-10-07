'use strict';

const { formatUnits } = require('./format');
const { DEX_LABELS } = require('./labels');
const { shortAddress } = require('./programs');

const MAX_LISTED = 3;
const JUPITER = 'Jupiter Aggregator v6';

const absolute = (value) => (value < 0n ? -value : value);

/**
 * What the fee payer gained or lost, with the fee itself taken out.
 * Their SOL change includes the fee, so add it back.
 */
function payerMovements(summary) {
  const moves = [];

  const solChange = summary.solChanges.find((c) => c.address === summary.feePayer);
  const lamports = (solChange ? BigInt(solChange.lamports) : 0n) + BigInt(summary.fee);
  if (lamports !== 0n) {
    moves.push({
      asset: 'SOL',
      delta: lamports,
      text: `${formatUnits(absolute(lamports), 9)} SOL`,
    });
  }

  for (const change of summary.tokenChanges) {
    if (change.owner !== summary.feePayer) continue;
    const delta = BigInt(change.raw);
    const name = change.label || `tokens (mint ${shortAddress(change.mint)})`;
    moves.push({
      asset: 'token',
      delta,
      text: `${formatUnits(absolute(delta), change.decimals)} ${name}`,
    });
  }

  return moves;
}

function list(moves) {
  const shown = moves
    .slice(0, MAX_LISTED)
    .map((move) => move.text)
    .join(', ');
  const extra = moves.length - MAX_LISTED;
  return extra > 0 ? `${shown} and ${extra} more` : shown;
}

/** " via Jupiter Aggregator v6" when a known trading program was involved. */
function via(summary) {
  const names = [
    ...new Set(
      summary.programs.map((p) => p.label).filter((label) => label && DEX_LABELS.has(label))
    ),
  ];
  if (names.length === 0) return '';
  if (names.includes(JUPITER)) return ` via ${JUPITER}`;
  return ` via ${names.slice(0, 2).join(' and ')}`;
}

/**
 * One line describing what happened, from the fee payer's point of view.
 * It is a guess from balance changes, so it always says "Likely".
 */
function buildHeadline(summary) {
  if (summary.status === 'failed') {
    return { kind: 'failed', text: 'Failed on-chain; nothing moved except the fee.' };
  }

  const moves = payerMovements(summary);
  const outgoing = moves.filter((move) => move.delta < 0n);
  const incoming = moves.filter((move) => move.delta > 0n);

  if (outgoing.length > 0 && incoming.length > 0) {
    return {
      kind: 'swap',
      text: `Likely a swap: sent ${list(outgoing)}, received ${list(incoming)}${via(summary)}`,
    };
  }

  if (outgoing.length > 0) {
    const solOnly =
      outgoing.length === 1 && outgoing[0].asset === 'SOL' && summary.tokenChanges.length === 0;
    if (solOnly) {
      const recipients = summary.solChanges.filter(
        (c) => c.address !== summary.feePayer && BigInt(c.lamports) > 0n
      );
      if (recipients.length === 1) {
        return {
          kind: 'transfer',
          text: `Likely a SOL transfer: sent ${outgoing[0].text} to ${shortAddress(recipients[0].address)}`,
        };
      }
    }
    return { kind: 'send', text: `Likely sent ${list(outgoing)}${via(summary)}` };
  }

  if (incoming.length > 0) {
    return { kind: 'receive', text: `Likely received ${list(incoming)}${via(summary)}` };
  }

  const othersMoved =
    summary.solChanges.some((c) => c.address !== summary.feePayer) ||
    summary.tokenChanges.some((c) => c.owner !== summary.feePayer);
  if (othersMoved) {
    return {
      kind: 'relayed',
      text: 'Likely run for someone else: the fee payer only paid the fee, other accounts changed (see below).',
    };
  }

  return { kind: 'fee-only', text: 'No SOL or token balance changes besides the fee.' };
}

module.exports = { buildHeadline };