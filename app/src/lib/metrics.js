// Pure helpers that turn the exported experiment data into what the dashboard shows.

export const fmtInt = (v) => Math.round(v).toLocaleString("en-IN");
export const fmtPP = (v, nd = 2) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(nd)} pp`;
export const fmtPct = (v, nd = 2) => `${(v * 100).toFixed(nd)}%`;
export const fmtRupeesK = (v) => (Math.abs(v) < 50 ? "₹0" : `${v < 0 ? "−" : ""}₹${(Math.abs(v) / 1000).toFixed(1)}k`);
export const fmtPrice = (p) => `₹${p % 1 ? p.toFixed(2) : p}`;
export const fmtP = (p) => (p < 1e-10 ? `p < 1e-${Math.floor(-Math.log10(p))}` : `p = ${p.toPrecision(2)}`);

/** Value of a targeting curve at share x (0.01 .. 1.00). */
export function curveAt(curve, x) {
  const i = Math.min(curve.share.length - 1, Math.max(0, Math.round(x * 100) - 1));
  return { itt: curve.itt[i], expo: curve.expo_rate[i] };
}

/** Share of all incremental visits captured by targeting the top x% of a ranking. */
export function capturedShare(curve, x) {
  const all = curveAt(curve, 1).itt;
  return x <= 0 ? 0 : (x * curveAt(curve, x).itt) / all;
}

/** Profit for the population when the top x% see ads and we pay per impression. */
export function profitAt(curve, x, price, a) {
  if (x === null || x <= 0) return { profit: 0, spend: 0, value: 0 };
  const { itt, expo } = curveAt(curve, x);
  const people = a.population * x;
  const value = people * itt * a.visit_value;
  const spend = people * expo * price;
  return { profit: value - spend, spend, value };
}

/** The decision rule from the ROI analysis (Step 9), per price paid for each ad shown. */
export function policy(price) {
  if (price < 0.75) return { x: 1, word: "Show everyone", tone: "good", line: "Every group earns more than its ads cost" };
  if (price <= 1.5) return { x: 0.5, word: "Top 50% only", tone: "warn", line: "The other half costs more than it brings" };
  return { x: null, word: "Pause the ads", tone: "bad", line: "Ads now cost more than they bring" };
}

/** Best targeting share for a price, searched over the measured curve. */
export function bestShare(curve, price, a) {
  let best = { x: 0.01, profit: -Infinity };
  for (let k = 1; k <= 100; k++) {
    const p = profitAt(curve, k / 100, price, a).profit;
    if (p > best.profit) best = { x: k / 100, profit: p };
  }
  return best;
}

/** Linear interpolation helpers between a sorted percentile table (101 values) and percentiles. */
export function valueAtPercentile(table, pct) {
  const p = Math.min(100, Math.max(0, pct));
  const lo = Math.floor(p), hi = Math.ceil(p);
  return lo === hi ? table[lo] : table[lo] + (table[hi] - table[lo]) * (p - lo);
}
/** Share of users (in percentile steps) that have exactly this value, e.g. a default most users share. */
export function sharedShare(table, v) {
  let n = 0;
  for (let i = 0; i <= 100; i++) if (table[i] === v) n++;
  return n;
}

export function percentileOfValue(table, v) {
  // ties (many users share one default value) map to the middle of the tied range;
  // checked first, because the default is often also the smallest or largest value
  let first = -1, last = -1;
  for (let i = 0; i <= 100; i++) if (table[i] === v) { if (first < 0) first = i; last = i; }
  if (first >= 0 && last > first) return (first + last) / 2;
  if (v <= table[0]) return 0;
  if (v >= table[100]) return 100;
  if (first >= 0) return first;
  for (let i = 0; i < 100; i++) {
    if (v >= table[i] && v <= table[i + 1]) return i + (v - table[i]) / (table[i + 1] - table[i] || 1);
  }
  return 50;
}
