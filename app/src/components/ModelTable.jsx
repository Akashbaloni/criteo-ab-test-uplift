// How well each ranking finds the people who respond (test set).
import Swap from "./Swap.jsx";
import { fmtPP } from "../lib/metrics.js";
import { useTech } from "../tech.js";

export default function ModelTable({ models }) {
  const tech = useTech();
  const lift = (v) => (tech ? fmtPP(v) : `+${Math.round(v * 1000)} / 1,000`);
  const rows = [
    { s: "Our model", t: "S-Learner (LightGBM)", m: models.s_learner },
    { s: "“Most active” rule", t: "Activity score baseline", m: models.activity },
  ];
  return (
    <section className="card table-card" aria-label="Model comparison">
      <table>
        <thead>
          <tr>
            <Swap as="th" s="Ranking method" t="Model (test set)" />
            <Swap as="th" s="Ranking score" t="Qini AUC" />
            <Swap as="th" s="Likely range" t="95% CI" />
            <Swap as="th" s="Extra visits, top 10%" t="Uplift @ 10%" />
            <Swap as="th" s="Extra visits, top 20%" t="Uplift @ 20%" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.s}>
              <Swap as="td" s={r.s} t={r.t} />
              <td className="mono">{r.m.qini.toFixed(3)}</td>
              <td className="mono">[{r.m.qini_ci.map((x) => x.toFixed(3)).join(", ")}]</td>
              <td>{lift(r.m.uplift_at_10)}</td>
              <td>{lift(r.m.uplift_at_20)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
