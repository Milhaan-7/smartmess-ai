export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-IN');

export const fmtKg = (n: number, digits = 1): string =>
  `${n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })} kg`;

export const fmtNum = (n: number, digits = 1): string =>
  n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtPct = (ratio: number | null, digits = 1): string =>
  ratio === null || Number.isNaN(ratio) ? '—' : `${(ratio * 100).toFixed(digits)}%`;

/** Signed integer with a proper minus sign, e.g. +12 / −8 / 0 */
export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export const round1 = (n: number): number => Math.round(n * 10) / 10;
