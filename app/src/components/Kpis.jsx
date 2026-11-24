// Overview tiles next to the hero, plus the profit / decision strip under them.
import Swap from "./Swap.jsx";
import { fmtPP, fmtPct, fmtRupeesK, fmtPrice } from "../lib/metrics.js";
import { useTech } from "../tech.js";
import useAnimatedNumber from "../lib/useAnimatedNumber.js";

/** Counts up from 0 on first show (plain view); the technical view shows the exact figure. */
function Value({ to, plain, tech }) {
  const isTech = useTech();
  const v = useAnimatedNumber(to, 1100, 0);
  return <div className="big" key={isTech ? "t" : "s"}>{isTech ? tech : plain(Math.round(v))}</div>;
}

function Tile({ tone, label, value, line }) {
  return (
    <div className={`card lift kpi ${tone || ""}`}>
      <Swap as="div" className="lbl" {...label} />
      {value}
      <Swap as="div" className="one" {...line} />
    </div>
  );
}

export default function Kpis({ e }) {
  const c = e.cace, cv = e.conversion;
  return (
    <>
      <Tile label={{ s: "Saw an ad", t: "Exposure rate" }}
        value={<Value to={e.exposure_rate * 1000} plain={(n) => `${n} / 1,000`} tech={fmtPct(e.exposure_rate)} />}
        line={{ s: "Most people picked never saw one", t: "P(exposed | treatment); 0% in control" }} />
      <Tile label={{ s: "Effect if seen", t: "CACE (Wald / IV)" }}
        value={<Value to={c.estimate * 100} plain={(n) => `+${n} / 100`} tech={fmtPP(c.estimate, 1)} />}
        line={{ s: "Extra visitors among those who saw it", t: `95% CI [${(c.ci[0] * 100).toFixed(1)}, ${(c.ci[1] * 100).toFixed(1)}] · first-stage F ${Math.round(c.first_stage_f / 1000)}k` }} />
      <Tile tone="warn" label={{ s: "Wrong method says", t: "Naive exposed vs not" }}
        value={<Value to={e.naive * 100} plain={(n) => `+${n} / 100`} tech={fmtPP(e.naive, 1)} />}
        line={{ s: "Too high: they were already active", t: `Selection bias = ${(e.selection_bias * 100).toFixed(1)} pp` }} />
      <Tile label={{ s: "Extra purchases", t: "Conversion ITT" }}
        value={<Value to={cv.rel * 100} plain={(n) => `+${n}%`} tech={fmtPP(cv.itt)} />}
        line={{ s: `${fmtPct(cv.rate_t)} bought with ads vs ${fmtPct(cv.rate_c)} without`, t: `95% CI [${(cv.ci[0] * 100).toFixed(2)}, ${(cv.ci[1] * 100).toFixed(2)}] · relative +${(cv.rel * 100).toFixed(1)}%` }} />
    </>
  );
}

const toneClass = { good: "good", warn: "warn-t", bad: "bad" };

export function Summary({ profit, price, pol, onNext }) {
  const tech = useTech();
  const shown = useAnimatedNumber(profit, 900, 0);
  return (
    <section className="card summary" aria-label="Profit and decision">
      <div className="summary-stats">
        <div>
          <div className="lbl" key={tech ? "t" : "s"}>{tech ? `Profit per 1M users · CPM ${fmtPrice(price)}` : `Profit per 1M people · ${fmtPrice(price)} per ad`}</div>
          <div className="big good">{fmtRupeesK(shown)}</div>
        </div>
        <div>
          <div className="lbl">Decision</div>
          <div className={`big pop ${toneClass[pol.tone]}`} key={pol.word}>{pol.word}</div>
        </div>
      </div>
      <button className="cta" onClick={onNext}>
        See who to target
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </section>
  );
}
