import Swap from "./Swap.jsx";
import { fmtPrice, fmtRupeesK } from "../lib/metrics.js";
import { useTech } from "../tech.js";
import useAnimatedNumber from "../lib/useAnimatedNumber.js";

const toneClass = { good: "good", warn: "warn-t", bad: "bad" };

export default function Decision({ prices, price, setPrice, pol, result, best, visitValue }) {
  const tech = useTech();
  const x = pol.x;
  const roiRaw = result.spend > 0 ? result.profit / result.spend : null;
  // animate the return and profit too; when ads are paused the return shows "—"
  const roiAnim = useAnimatedNumber(roiRaw ?? 0);
  const roi = roiRaw === null ? null : roiAnim;
  const profit = useAnimatedNumber(result.profit);
  return (
    <section className="card decision" aria-label="Decision">
      <div>
        <Swap as="div" className="title" s="Ad price" t="Cost per impression" />
        <Swap as="div" className="one tight" s="What we pay each time an ad is shown" t={`Visit value assumed ₹${visitValue}`} />
      </div>
      <div className="chips" role="radiogroup" aria-label="Ad price">
        {prices.map((p) => (
          <button key={p} role="radio" aria-checked={p === price} className="chip" onClick={() => setPrice(p)}>
            {fmtPrice(p)}
          </button>
        ))}
      </div>
      <div className="verdict">
        <div className={`vword pop ${toneClass[pol.tone]}`} key={pol.word}>
          <span className="vdot" aria-hidden="true" />
          {pol.word}
        </div>
        <div className="one" key={tech ? "t" : "s"}>
          {tech
            ? `Break-even lift per impression ${((price / visitValue) * 100).toFixed(0)}% · profit-max share ${Math.round(best.x * 100)}%`
            : pol.line}
        </div>
      </div>
      <div className="stats3">
        <div>
          <Swap s="Show ads to" t="Targeted share" />
          <b>{x === null ? (tech ? "0%" : "Nobody") : x === 1 ? (tech ? "100%" : "Everyone") : tech ? "50%" : "Top half"}</b>
        </div>
        <div>
          <Swap s="Return per ₹1" t="ROI" />
          <b>{roi === null ? "—" : tech ? `${Math.round(roi * 100)}%` : `₹${(1 + roi).toFixed(2)}`}</b>
        </div>
        <div>
          <Swap s="Profit / 1M" t="Profit / 1M" />
          <b className="good">{fmtRupeesK(profit)}</b>
        </div>
      </div>
    </section>
  );
}
