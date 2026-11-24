// "Who to target" chart with two views:
//  - Extra visits: share of all extra visits captured when the most responsive people see ads first
//  - Profit: profit per 1M people for each targeting share at the selected ad price (moves with the price)
import { useEffect, useRef, useState } from "react";
import Swap from "./Swap.jsx";
import { capturedShare, fmtPrice, fmtRupeesK, profitAt } from "../lib/metrics.js";
import { useTech } from "../tech.js";

const N = 100;

/** A round tick spacing (1, 2 or 5 × 10^k) that gives about three grid lines, never below ₹1k. */
function niceStep(span) {
  const raw = span / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return Math.max(1000, (norm > 5 ? 10 : norm > 2 ? 5 : norm > 1 ? 2 : 1) * mag);
}

export default function TargetChart({ curves, models, selX, price, assumptions }) {
  const tech = useTech();
  const [view, setView] = useState("visits");
  const ref = useRef(null);
  const state = useRef({ hov: null, dp: 0, selX, tech, view, price, disp: null, range: null });
  const S0 = state.current;
  if (S0.view !== view) { S0.dp = 0; S0.disp = null; S0.range = null; }
  S0.selX = selX; S0.tech = tech; S0.view = view; S0.price = price;

  useEffect(() => {
    const c = ref.current, g = c.getContext("2d");
    const D = Math.min(window.devicePixelRatio || 1, 2);
    const S = state.current;
    const visitsModel = (x) => capturedShare(curves.s_learner, x);
    const visitsAct = (x) => capturedShare(curves.activity, x);
    const at20 = Math.round(visitsModel(0.2) * 100);
    let raf;
    const fit = () => { const r = c.getBoundingClientRect(); c.width = r.width * D; c.height = r.height * D; };
    const ro = new ResizeObserver(fit); ro.observe(c); fit();
    const move = (e) => { const r = c.getBoundingClientRect(); S.hov = Math.max(0, Math.min(1, (e.clientX - r.left - 46) / (r.width - 58))); };
    const leave = () => { S.hov = null; };
    c.addEventListener("pointermove", move); c.addEventListener("pointerleave", leave);

    // target values for the profit view at the current price
    const profitTargets = () => {
      const model = [0], rand = [0];
      const all = profitAt(curves.s_learner, 1, S.price, assumptions).profit;
      for (let i = 1; i <= N; i++) {
        model.push(profitAt(curves.s_learner, i / N, S.price, assumptions).profit);
        rand.push(all * (i / N));
      }
      return { model, rand };
    };

    const line = (pts, color, width, dash) => {
      g.setLineDash(dash || []); g.strokeStyle = color; g.lineWidth = width * D;
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
    };
    const tooltip = (x, txt, L, R, T, w) => {
      g.font = `500 ${11.5 * D}px Manrope, sans-serif`;
      const tw = g.measureText(txt).width + 14 * D, x0 = Math.min(Math.max(x - tw / 2, L), w - R - tw);
      g.fillStyle = "#f4f6fa"; g.strokeStyle = "#f4f6fa"; g.beginPath(); g.roundRect(x0, T, tw, 22 * D, 6 * D); g.fill(); g.stroke();
      g.fillStyle = "#0a0c10"; g.textAlign = "left"; g.fillText(txt, x0 + 7 * D, T + 15 * D);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // soft expanding ring that marks the share chosen for the current price
    const ring = (x, y) => {
      if (reduce) return;
      const k = (performance.now() % 1800) / 1800;
      g.strokeStyle = `rgba(251,191,36,${0.8 * (1 - k)})`; g.lineWidth = 2 * D;
      g.beginPath(); g.arc(x, y, (5 + 12 * k) * D, 0, 7); g.stroke(); g.lineWidth = D;
    };
    const draw = () => {
      const w = c.width, h = c.height, L = 46 * D, R = 12 * D, T = 10 * D, B = 22 * D;
      const sx = (v) => L + v * (w - L - R);
      g.clearRect(0, 0, w, h);
      S.dp = Math.min(1, S.dp + 0.025);
      const n = Math.max(1, Math.floor(N * S.dp));
      g.font = `${10.5 * D}px Manrope, sans-serif`; g.lineWidth = D;
      // x axis labels
      g.fillStyle = "#8a93a3";
      [0, 0.5, 1].forEach((v) => { g.textAlign = v === 0 ? "left" : v === 1 ? "right" : "center"; g.fillText(`${v * 100}%${v === 1 ? " of people" : ""}`, sx(v), h - 5 * D); });

      if (S.view === "visits") {
        const sy = (v) => T + (1 - v) * (h - T - B);
        [0, 0.5, 1].forEach((v) => {
          g.strokeStyle = "#1c212b"; g.beginPath(); g.moveTo(L, sy(v)); g.lineTo(w - R, sy(v)); g.stroke();
          g.fillStyle = "#8a93a3"; g.textAlign = "right"; g.fillText(`${v * 100}%`, L - 6 * D, sy(v) + 3.5 * D);
        });
        const pts = (f) => { const a = [[sx(0), sy(0)]]; for (let i = 1; i <= n; i++) a.push([sx(i / N), sy(f(i / N))]); return a; };
        const mp = pts(visitsModel);
        const gr = g.createLinearGradient(0, T, 0, h - B);
        gr.addColorStop(0, "rgba(45,212,191,.28)"); gr.addColorStop(1, "rgba(45,212,191,0)");
        g.fillStyle = gr; g.beginPath(); mp.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.lineTo(sx(n / N), sy(0)); g.closePath(); g.fill();
        line([[sx(0), sy(0)], [sx(S.dp), sy(S.dp)]], "#3a4150", 1.2, [4 * D, 4 * D]);
        line(pts(visitsAct), "#5b6474", 1.3);
        line(mp, "#2dd4bf", 2.2);
        if (S.dp >= 1) {
          g.textAlign = "left"; g.font = `${10.5 * D}px Manrope, sans-serif`;
          g.fillStyle = "#2dd4bf"; g.fillText(S.tech ? "S-Learner" : "Our model", sx(0.55), sy(visitsModel(0.55)) + 15 * D);
          g.fillStyle = "#8a93a3"; g.fillText("Random", sx(0.7), sy(0.7) + 14 * D);
          g.fillStyle = "#f4f6fa"; g.beginPath(); g.arc(sx(0.2), sy(visitsModel(0.2)), 3.5 * D, 0, 7); g.fill();
          g.font = `500 ${11 * D}px Manrope, sans-serif`;
          g.fillText(S.tech ? `uplift share ${at20}% @ 20%` : `Top 20% → ${at20}% of extra visits`, sx(0.2) + 8 * D, sy(visitsModel(0.2)) + 4 * D);
          if (S.selX !== null) { ring(sx(S.selX), sy(visitsModel(S.selX))); g.fillStyle = "#fbbf24"; g.beginPath(); g.arc(sx(S.selX), sy(visitsModel(S.selX)), 4.5 * D, 0, 7); g.fill(); }
        }
        if (S.hov !== null) {
          const v = Math.max(0.01, S.hov);
          g.strokeStyle = "#3a4150"; g.beginPath(); g.moveTo(sx(v), T); g.lineTo(sx(v), h - B); g.stroke();
          g.fillStyle = "#2dd4bf"; g.beginPath(); g.arc(sx(v), sy(visitsModel(v)), 4 * D, 0, 7); g.fill();
          tooltip(sx(v), `Top ${Math.round(v * 100)}% → ${Math.round(visitsModel(v) * 100)}%`, L, R, T, w);
        }
      } else {
        // profit view: lines glide to the new shape when the price changes
        const tgt = profitTargets();
        if (!S.disp) S.disp = { model: tgt.model.slice(), rand: tgt.rand.slice() };
        for (let i = 0; i <= N; i++) {
          S.disp.model[i] += (tgt.model[i] - S.disp.model[i]) * 0.12;
          S.disp.rand[i] += (tgt.rand[i] - S.disp.rand[i]) * 0.12;
        }
        const vals = [...tgt.model, ...tgt.rand, 0];
        const pad = (Math.max(...vals) - Math.min(...vals)) * 0.08 || 1000;
        const tRange = [Math.min(...vals) - pad, Math.max(...vals) + pad];
        if (!S.range) S.range = tRange.slice();
        S.range[0] += (tRange[0] - S.range[0]) * 0.12; S.range[1] += (tRange[1] - S.range[1]) * 0.12;
        const [lo, hi] = S.range;
        const sy = (v) => T + (1 - (v - lo) / (hi - lo)) * (h - T - B);
        // grid: three nice ticks
        const step = niceStep(hi - lo);
        for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
          g.strokeStyle = "#1c212b"; g.beginPath(); g.moveTo(L, sy(v)); g.lineTo(w - R, sy(v)); g.stroke();
          g.fillStyle = "#8a93a3"; g.textAlign = "right"; g.fillText(fmtRupeesK(v), L - 6 * D, sy(v) + 3.5 * D);
        }
        // break-even line
        g.strokeStyle = "#8a93a3"; g.lineWidth = 1.2 * D; g.beginPath(); g.moveTo(L, sy(0)); g.lineTo(w - R, sy(0)); g.stroke();
        g.fillStyle = "#9aa3b2"; g.textAlign = "right"; g.font = `${10.5 * D}px Manrope, sans-serif`;
        g.fillText(S.tech ? "break-even (profit = 0)" : "break-even", w - R, sy(0) - 5 * D);
        const pts = (arr) => { const a = []; for (let i = 0; i <= n; i++) a.push([sx(i / N), sy(arr[i])]); return a; };
        const mp = pts(S.disp.model);
        const gr = g.createLinearGradient(0, T, 0, h - B);
        gr.addColorStop(0, "rgba(45,212,191,.22)"); gr.addColorStop(1, "rgba(45,212,191,0)");
        g.fillStyle = gr; g.beginPath(); mp.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.lineTo(sx(n / N), sy(0)); g.lineTo(sx(0), sy(0)); g.closePath(); g.fill();
        line(pts(S.disp.rand), "#3a4150", 1.2, [4 * D, 4 * D]);
        line(mp, "#2dd4bf", 2.2);
        if (S.dp >= 1) {
          let bi = 1;
          for (let i = 1; i <= N; i++) if (tgt.model[i] > tgt.model[bi]) bi = i;
          // If the recommended share earns within 2% (or ₹500) of the curve's peak, call it the best:
          // the peak is noisy, and the decision rule (Step 9 bootstrap) prefers the recommendation.
          const pi = S.selX === null ? null : Math.round(S.selX * N);
          const tol = Math.max(0.02 * Math.abs(tgt.model[bi]), 500);
          const nearTie = pi !== null && tgt.model[bi] - tgt.model[pi] <= tol;
          if (nearTie) bi = pi;
          const bx = bi / N, by = S.disp.model[bi];
          g.font = `500 ${11 * D}px Manrope, sans-serif`;
          if (tgt.model[bi] > 0) {
            g.fillStyle = "#34d399"; g.beginPath(); g.arc(sx(bx), sy(by), 4.5 * D, 0, 7); g.fill();
            g.textAlign = bx > 0.75 ? "right" : "left";
            const simple = bi === N ? "Best: show everyone" : `Best: top ${bi}%`;
            g.fillText(S.tech ? `${nearTie ? "≈ argmax" : "argmax"} ${bi}%: ${fmtRupeesK(tgt.model[bi])}` : simple, sx(bx) + (bx > 0.75 ? -8 : 8) * D, sy(by) - 8 * D);
          } else {
            g.fillStyle = "#f87171"; g.textAlign = "center";
            g.fillText(S.tech ? "max profit < 0 at every share" : "No share is profitable", (L + w - R) / 2, sy(0) + 18 * D);
          }
          if (S.selX !== null) {
            const si = Math.round(S.selX * N);
            ring(sx(S.selX), sy(S.disp.model[si]));
            g.fillStyle = "#fbbf24"; g.beginPath(); g.arc(sx(S.selX), sy(S.disp.model[si]), 4 * D, 0, 7); g.fill();
          }
          g.textAlign = "left"; g.font = `${10.5 * D}px Manrope, sans-serif`;
          g.fillStyle = "#8a93a3"; g.fillText("Random", sx(0.62), sy(S.disp.rand[62]) + 14 * D);
        }
        if (S.hov !== null) {
          const v = Math.max(0.01, S.hov), i = Math.round(v * N);
          g.strokeStyle = "#3a4150"; g.lineWidth = D; g.beginPath(); g.moveTo(sx(v), T); g.lineTo(sx(v), h - B); g.stroke();
          g.fillStyle = "#2dd4bf"; g.beginPath(); g.arc(sx(i / N), sy(S.disp.model[i]), 4 * D, 0, 7); g.fill();
          tooltip(sx(v), `Top ${i}% → ${fmtRupeesK(tgt.model[i])}`, L, R, T, w);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); c.removeEventListener("pointermove", move); c.removeEventListener("pointerleave", leave); };
  }, [curves, assumptions]);

  const m = models.s_learner, b = models.activity;
  return (
    <section className="card" aria-label="Who to target">
      <div className="chart-head">
        <div>
          {view === "visits" ? (
            <>
              <Swap as="div" className="title" s="Who to target" t="Qini curve (test set)" />
              <Swap as="div" className="one tight" s="Show ads to the most responsive people first"
                t={`S-Learner ${m.qini.toFixed(3)} [${m.qini_ci[0].toFixed(3)}, ${m.qini_ci[1].toFixed(3)}] · activity ${b.qini.toFixed(3)}`} />
            </>
          ) : (
            <>
              <Swap as="div" className="title" s="Profit by how many see ads" t={`Profit curve at CPM ${fmtPrice(price)}`} />
              <div className="one tight" key={`p${tech}${price}`}>
                {tech ? `Profit per ${(assumptions.population / 1e6).toFixed(0)}M users · S-Learner ranking · visit value ₹${assumptions.visit_value}` : `Per 1M people, at ${fmtPrice(price)} per ad`}
              </div>
            </>
          )}
        </div>
        <div className="seg" role="tablist" aria-label="Chart view">
          <button role="tab" aria-selected={view === "visits"} className={view === "visits" ? "on" : ""} onClick={() => setView("visits")}>Extra visits</button>
          <button role="tab" aria-selected={view === "profit"} className={view === "profit" ? "on" : ""} onClick={() => setView("profit")}>Profit</button>
        </div>
      </div>
      <div className="chart-box"><canvas ref={ref} role="img" aria-label={view === "visits" ? "Share of extra visits captured by targeting share" : "Profit by targeting share at the selected ad price"} /></div>
      <div className="legend" aria-hidden="true">
        <span><i style={{ background: "#2dd4bf" }} />{tech ? "S-Learner" : "Our model"}</span>
        {view === "visits" && <span><i style={{ background: "#5b6474" }} />{tech ? "Activity score" : "“Most active” rule"}</span>}
        <span><i style={{ background: "repeating-linear-gradient(90deg, #5b6474 0 4px, transparent 4px 8px)" }} />Random</span>
        <span><i style={{ background: "#fbbf24", width: 8, height: 8, borderRadius: "50%" }} />{tech ? `Policy share at CPM ${fmtPrice(price)}` : `Our choice at ${fmtPrice(price)} per ad`}</span>
      </div>
    </section>
  );
}
