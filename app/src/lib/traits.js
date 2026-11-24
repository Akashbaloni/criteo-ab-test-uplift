// How much each feature moves the model's prediction.
// For every sample user, one feature at a time is set to its 5th, 15th, ..., 95th percentile
// and the user is re-scored; the impact is the average gap between the highest and lowest
// predicted uplift. A feature gets 0 when the prediction does not change between p5 and p95:
// either the model never splits on it (f1), or almost every user shares one default value and
// the model only splits on its rare extreme values (f4, f5, f10, f11).
import { scoreUsers } from "./scorer.js";
import { valueAtPercentile } from "./metrics.js";

const GRID = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95];
let cached = null;

/** Mean uplift swing per feature, in extra visitors per 1,000 people. Computed once per page load. */
export function traitImpact(users, features, featurePercentiles) {
  if (!cached) {
    cached = compute(users, features, featurePercentiles).catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

async function compute(users, features, fq) {
  const n = users.length, out = [];
  for (let j = 0; j < features.length; j++) {
    const batch = [];
    for (const q of GRID) {
      const v = valueAtPercentile(fq[features[j]], q);
      for (const u of users) {
        const row = u.slice();
        row[j] = v;
        batch.push(row);
      }
    }
    const scores = await scoreUsers(batch);
    let total = 0;
    for (let i = 0; i < n; i++) {
      let lo = Infinity, hi = -Infinity;
      for (let g = 0; g < GRID.length; g++) {
        const x = scores[g * n + i].uplift;
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
      total += hi - lo;
    }
    out.push((total / n) * 1000);
  }
  return out;
}

/** Impact label used in the UI. */
export function impactLevel(perThousand) {
  if (perThousand == null) return "wait";
  if (perThousand >= 5) return "high";
  if (perThousand >= 1.5) return "medium";
  if (perThousand > 0.01) return "low";
  return "unused";
}
