// "Should this person see the ad?" — scores one user with the S-Learner running in the browser.
// The five traits that move the prediction most are shown first; the rest sit behind "Show more".
import { useEffect, useMemo, useState } from "react";
import Swap from "./Swap.jsx";
import { scoreUsers } from "../lib/scorer.js";
import { traitImpact, impactLevel } from "../lib/traits.js";
import { fmtPP, fmtPrice, percentileOfValue, valueAtPercentile } from "../lib/metrics.js";
import { useTech } from "../tech.js";

const TOP = 5;
const LEVEL_TEXT = { high: "High", medium: "Medium", low: "Low", unused: "Unused", wait: "…" };

const perThousand = (u) => {
  const v = u * 1000;
  if (Math.abs(v) < 0.05) return "≈ 0 / 1,000";
  const txt = Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : Math.round(Math.abs(v)).toString();
  return `${v < 0 ? "−" : "+"}${txt} / 1,000`;
};

function Trait({ index, feature, value, pct, impact, rank, onChange }) {
  const tech = useTech();
  const level = impactLevel(impact);
  const name = tech ? feature : `Trait ${index + 1}`;
  const id = `trait-${feature}`, tipId = `tip-${feature}`;
  const p = Math.round(pct);
  const where = p <= 1 ? "This person is at the very bottom for this trait."
    : p >= 99 ? "This person is at the very top for this trait."
    : `This person is higher than ${p}% of users.`;
  const effect = impact == null ? "Measuring how much it moves the prediction…"
    : level === "unused" ? "The model does not use it, so moving this slider changes nothing."
    : `Moving it from low to high shifts the prediction by about ${impact >= 10 ? Math.round(impact) : impact.toFixed(1)} extra visitors per 1,000 on average.`;
  const head = tech ? `${feature}${rank ? ` · sensitivity rank ${rank} / 12` : ""}` : `Trait ${index + 1} = hidden feature ${feature}`;
  const body = tech
    ? `Value ${value.toFixed(3)} at percentile ${p}.${impact == null ? "" : ` Mean |Δτ| from p5 to p95: ${impact.toFixed(2)} per 1,000${level === "unused" ? " (unused by the model)" : ""}.`}`
    : `Criteo anonymized what it measures. ${where} ${effect}`;
  return (
    <div className={`trait ${level === "unused" ? "unused" : ""}`}>
      <div className="trait-head">
        <span className="trait-name">
          <label htmlFor={id}>{name}</label>
          <span className="tip">
            <button type="button" className="info" aria-label={`About ${name}`} aria-describedby={tipId}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <path d="M12 11v7" /><path d="M12 6.5v.5" />
              </svg>
            </button>
            <span className="tipbox" role="tooltip" id={tipId}><b>{head}</b>{body}</span>
          </span>
        </span>
        <span className="trait-val">
          <span className={`pill ${level}`}>{LEVEL_TEXT[level]}</span>
          <span className="mono">{tech ? value.toFixed(3) : `p${p}`}</span>
        </span>
      </div>
      <input id={id} type="range" min="0" max="100" step="1" value={p} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

export default function Scorer({ scorer, pol, price }) {
  const tech = useTech();
  const { features, feature_percentiles: fq, score_percentiles: sq, sample_users: sample } = scorer;
  const [values, setValues] = useState(sample[0]);
  const [res, setRes] = useState(null);
  const [presets, setPresets] = useState(null);
  const [impact, setImpact] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState(null);
  // which button is highlighted; null once the user moves a slider (a custom person)
  const [active, setActive] = useState(null);

  // Score the sample once to build presets at low / middle / high uplift, then measure trait impact.
  useEffect(() => {
    let live = true;
    scoreUsers(sample)
      .then((scores) => {
        if (!live) return;
        const order = scores.map((s, i) => [s.uplift, i]).sort((a, b) => a[0] - b[0]);
        const pick = (q) => sample[order[Math.min(order.length - 1, Math.floor(q * order.length))][1]];
        const p = { "Rarely responds": pick(0.1), Typical: pick(0.5), "Very responsive": pick(0.97) };
        setPresets(p);
        setValues(p.Typical);
        setActive("Typical");
        return traitImpact(sample, features, fq);
      })
      .then((imp) => live && imp && setImpact(imp))
      .catch((e) => live && setError(String(e)));
    return () => { live = false; };
  }, [sample, features, fq]);

  useEffect(() => {
    let live = true;
    scoreUsers([values]).then(([r]) => live && setRes(r)).catch((e) => setError(String(e)));
    return () => { live = false; };
  }, [values]);

  const pct = res ? percentileOfValue(sq, res.uplift) : null;
  const top = pct === null ? null : Math.max(1, Math.round(100 - pct));
  const show = res && (pol.x === 1 || (pol.x === 0.5 && pct >= 50));
  const rule = pol.x === 1 ? "we show everyone" : pol.x === 0.5 ? "we show the top half" : "we show nobody";
  const featPct = useMemo(() => values.map((v, i) => percentileOfValue(fq[features[i]], v)), [values, fq, features]);

  // most influential first (original order until the impact is measured)
  const order = useMemo(() => {
    const idx = features.map((_, i) => i);
    return impact ? idx.sort((a, b) => impact[b] - impact[a]) : idx;
  }, [features, impact]);
  const rest = order.slice(TOP);
  const restLevels = rest.map((i) => impactLevel(impact?.[i]));
  const count = (l) => restLevels.filter((x) => x === l).length;
  const restNote = impact
    ? ` (${[["high", "high"], ["medium", "medium"], ["low", "low impact"], ["unused", "unused"]]
        .filter(([l]) => count(l)).map(([l, w]) => `${count(l)} ${w}`).join(", ")})`
    : "";

  const setTrait = (i) => (p) => {
    const next = values.slice();
    next[i] = valueAtPercentile(fq[features[i]], p);
    setValues(next);
    setActive(null);
  };
  const renderTrait = (i) => (
    <Trait key={features[i]} index={i} feature={features[i]} value={values[i]} pct={featPct[i]}
      impact={impact ? impact[i] : null} rank={impact ? order.indexOf(i) + 1 : null} onChange={setTrait(i)} />
  );

  const people = presets ? [["Random person", null], ...Object.entries(presets)] : [["Random person", null]];

  return (
    <div className="scorer stagger">
      <section className="card scorer-main" aria-label="Should this person see the ad">
        <div>
          <Swap as="div" className="title" s="Should this person see the ad?" t="Individual uplift · S-Learner (ONNX, in browser)" />
          <Swap as="div" className="one tight" s="Pick a person or move the sliders" t="τ(x) = P(visit | x, ad) − P(visit | x, no ad)" />
        </div>
        <div className="btns">
          {people.map(([k, v]) => (
            <button key={k} className="chip" aria-pressed={active === k}
              onClick={() => { setValues(v || sample[Math.floor(Math.random() * sample.length)]); setActive(k); }}>
              {k}
            </button>
          ))}
        </div>
        <div className="traits-head">
          <div className="eyebrow">{impact ? "Most influential traits" : "Traits"}</div>
          <Swap as="div" className="one tight" s="Hover ⓘ to see what a trait is · the pill shows its impact" t="Ranked by mean |Δτ| over p5–p95 on the sample users" />
        </div>
        <div className="traits">{order.slice(0, TOP).map(renderTrait)}</div>
        <button type="button" className="more" aria-expanded={showMore} aria-controls="more-traits" onClick={() => setShowMore((s) => !s)}>
          {showMore ? "Hide other traits" : `Show ${rest.length} more traits${restNote}`}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {showMore && <div id="more-traits" className="traits stagger">{rest.map(renderTrait)}</div>}
        <Swap as="div" className="one" s="Traits are anonymized, so each slider is a percentile" t="Slider = feature percentile; value interpolated from the 10% sample" />
      </section>

      <section className="card result" aria-label="Prediction" aria-live="polite">
        {error ? <div className="one">Model failed to load: {error}</div> : !res ? <div className="one">Loading model…</div> : (
          <>
            <Swap as="div" className="lbl" s="Extra visitors per 1,000 like them" t="Predicted uplift τ(x)" />
            <div className="res-num pop" key={`${tech}-${active}`}>
              {tech ? fmtPP(res.uplift, 3) : perThousand(res.uplift)}
            </div>
            <div className="one tight" key={`r${tech}`}>
              {tech ? `p(ad) ${res.pAd.toFixed(3)} · p(no ad) ${res.pNoAd.toFixed(3)} · percentile ${pct.toFixed(0)}` : `More responsive than ${Math.round(pct)}% of people`}
            </div>
            <div className="pct-track" aria-hidden="true">
              {pol.x === 0.5 && <span className="pct-cut" style={{ left: "50%" }} />}
              <span className="pct-pin" style={{ left: `${pct}%` }} />
            </div>
            <div className="pct-ends" aria-hidden="true"><span>Least responsive</span><span>Most responsive</span></div>
            <div className="verdict">
              <div className={`vword pop ${show ? "good" : "bad"}`} key={show ? "y" : "n"}>
                <span className="vdot" aria-hidden="true" />
                {show ? "Show the ad" : "Skip this person"}
              </div>
              <div className="one" key={`d${tech}`}>
                {tech ? `Rule at CPM ${fmtPrice(price)}: target share ${pol.x === null ? 0 : pol.x * 100}% · rank top ${top}%` : `At ${fmtPrice(price)} per ad, ${rule}`}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
