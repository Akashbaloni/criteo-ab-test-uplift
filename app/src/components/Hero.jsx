// Main result: extra visitors per 1,000 people, with the two group rates as bars.
import Swap from "./Swap.jsx";
import { fmtPP, fmtPct } from "../lib/metrics.js";
import { useTech } from "../tech.js";
import useAnimatedNumber from "../lib/useAnimatedNumber.js";

export default function Hero({ e }) {
  const tech = useTech();
  const v = e.visit;
  const perK = Math.round(v.itt * 1000);
  const count = useAnimatedNumber(perK, 1100, 0);
  const withAds = Math.round(v.rate_t * 1000), noAds = Math.round(v.rate_c * 1000);
  const max = Math.max(withAds, noAds) * 1.02;
  const rows = [
    ["With ads", "Treatment", withAds, v.rate_t, "var(--accent)", null],
    ["Without ads", "Control", noAds, v.rate_c, "#4b5363", "muted"],
  ];
  return (
    <section className="card lift hero" aria-label="Main result">
      <div>
        <Swap as="div" className="lbl" s="Extra visitors per 1,000" t="Lift in visit rate" />
        <div className="hero-num" key={tech ? "t" : "s"}>{tech ? fmtPP(v.itt) : `+${Math.round(count)}`}</div>
        <Swap as="div" className="one" s="caused by the ads"
          t={`95% CI [${(v.ci[0] * 100).toFixed(2)}, ${(v.ci[1] * 100).toFixed(2)}] · adjusted ${fmtPP(v.adjusted)}`} />
      </div>
      <div className="bars">
        {rows.map(([s, t, n, rate, col, cls]) => (
          <div key={s}>
            <div className={`bar-row ${cls || ""}`}>
              <Swap s={s} t={t} />
              <Swap as="b" s={String(n)} t={fmtPct(rate)} />
            </div>
            <div className="track"><div className="fill" style={{ width: `${(n / max) * 100}%`, background: col }} /></div>
          </div>
        ))}
        <Swap as="div" className="one" s="Visitors out of every 1,000 people" t="Visit rate by randomized group" />
      </div>
    </section>
  );
}
