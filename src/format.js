'use strict';

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

module.exports = { formatLamports, formatUnits, withSign };