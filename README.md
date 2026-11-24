# Did the ads bring anyone new? A/B test analysis and uplift modeling on Criteo data

An end-to-end analysis of a randomized **A/B test** on the [Criteo uplift dataset](https://huggingface.co/datasets/criteo/criteo-uplift) (13.98 million users, 85% could be shown ads, 15% held out as a control group). It answers three business questions:

1. **Do the ads cause extra website visits, or would those people have come anyway?**
2. **Who responds to the ads?**
3. **Who should see the ads, and at what price is it worth it?**

The project goes from experiment checks (SRM, covariate balance, power) through causal estimates (ITT, CACE) to uplift models (S/T/X-learners) and an ROI decision. A web dashboard presents the results so that non-technical, business, and technical readers can all follow them.

> **Live dashboard:** https://criteo-uplift-dashboard.onrender.com — see [Web app](#web-app).

---

## Results at a glance

| Question | Answer |
|---|---|
| Did ads increase visits? | **Yes: +1.07 percentage points** (4.89% vs 3.82%), 95% CI [0.98, 1.16], +27.9% relative. About **11 extra visitors per 1,000 people**. |
| After correcting for a small imbalance? | **+0.81 pp** [0.73, 0.89], about 8 per 1,000 (covariate-adjusted, Lin 2013). |
| Purchases? | +0.12 pp (0.32% vs 0.20%), +62.7% relative. |
| How many people actually saw an ad? | Only **3.6%** of the ad group. |
| Effect on people who saw an ad (CACE)? | **+29.6 pp** [27.1, 32.1]. The naive "exposed vs not exposed" comparison says +38.3 pp, overstating it by 8.7 pp (selection bias). |
| Who responds? | The most active 20% of users produce **88% of the extra visits**. |
| Best uplift model | **S-Learner** (LightGBM), Qini 0.091 [0.073, 0.113], ~4–5× better than random targeting. A simple "most active users" rule is almost as good (Qini 0.087). |
| What should the company do? | Buy ads **per impression**. Below ₹0.75 per ad shown, show everyone (₹35.3k profit per 1M users, ROI ~196%). Between ₹0.75 and ₹1.50, target the **top 50%** by uplift. At ₹2 and above, pause. Paying per targeted user is never profitable. |

---

## The business question

A company pays Criteo to show display ads. Visitors who arrive after seeing an ad are not proof that the ad worked: many would have visited anyway. The randomized test lets us measure the **incremental** effect: what changed because of the ads.

Assumptions used for the money side (documented in [`src/data.py`](src/data.py) and stress-tested in Step 9):

- Value of one website visit: **₹5**
- Cost: **₹0.50 per ad shown** (break-even: the ad must raise the visit probability of a person who sees it by more than 10 percentage points)

## Data

- Source: Criteo AI Lab uplift dataset v2.1 (13,979,592 rows; 12 anonymized features; `treatment`, `exposure`, `visit`, `conversion`).
- `sklift.datasets.fetch_criteo()` points to a bucket that now returns 404, so [`src/data.py`](src/data.py) downloads the official file from Criteo's Hugging Face repository and draws a reproducible **10% random sample** (1,397,959 rows, seed 42), stored as float32/int8 parquet (73 MB in memory).
- **Treatment ≠ exposure:** `treatment` is the random assignment (who *could* be shown ads); `exposure` is whether an ad was actually shown. This difference drives Step 4.

## Approach

| Step | Notebook | What it does |
|---|---|---|
| 1–2 | [`01_eda`](notebooks/01_eda.ipynb) | Business framing, rates by group, exposure, feature distributions |
| 3 | [`02_randomization_check`](notebooks/02_randomization_check.ipynb) | SRM test against the designed 85:15 split, covariate balance with SMD (not p-values), classifier balance test |
| 4 | [`03_itt_vs_exposure`](notebooks/03_itt_vs_exposure.ipynb) | ITT vs naive comparison vs CACE (Wald / IV estimator), complier decomposition of the selection bias |
| 5 | [`04_power_analysis`](notebooks/04_power_analysis.ipynb) | MDE with unequal allocation, sample size for rare conversions, simulation check |
| 6 | [`05_ab_test`](notebooks/05_ab_test.ipynb) | Two-proportion z-test, bootstrap CIs, practical significance, covariate-adjusted lift |
| 7 | [`06_segment_analysis`](notebooks/06_segment_analysis.ipynb) | Effects by feature segment and by baseline activity, Cochran's Q, BH-FDR, A/A simulation |
| 8 | [`07_uplift_models`](notebooks/07_uplift_models.ipynb) | S/T/X-learners on LightGBM, Qini / uplift AUC / uplift@k, bootstrap CIs, MLflow tracking |
| 9 | [`08_roi_decision`](notebooks/08_roi_decision.ipynb) | Targeting curves, profit by strategy, two cost models, sensitivity to price and to the adjusted lift |
| 10 | [`app/`](app/) | Web dashboard with the model running in the browser |

Reusable code lives in [`src/`](src/): data loading, statistical tests, uplift learners, evaluation helpers, and the exporters for the app.

## Key findings

### 1. The naive comparison is wrong; random assignment is not

Users who saw an ad were already 3.5× more active (they would have visited 12.2% of the time without the ad, versus 3.5% for users never reached). Comparing exposed with unexposed users therefore inflates the effect from 29.6 to 38.3 points.

![ITT vs CACE vs naive](reports/figures/03_itt_vs_cace.png)

### 2. "Balanced on every feature" is not enough

Every feature passed the |SMD| < 0.1 balance check (max 0.049), yet a prognostic score (a model trained on control users to predict visits) showed the ad group was slightly more active: +0.27 pp in expected visits, z = 10.5. The features predict visits strongly (R² 0.28), so many small imbalances add up. The likely cause is that the dataset pools several separate tests; a hint is that the full data has exactly 85.000% treatment. The lift is therefore reported as a range: **0.81–1.07 pp**.

![Unadjusted vs adjusted lift](reports/figures/05_lift_ci.png)

### 3. The effect is concentrated in active users

Half of the users show essentially zero lift; the top decile by baseline activity shows +5.6 pp. Ads are also shown far more often to active users (15% exposure in the top decile vs 0.1% in the bottom).

![Effect by baseline activity](reports/figures/06_prognostic_deciles.png)

### 4. Uplift models beat random targeting, but barely beat a simple rule

| Model (test set) | Qini AUC [95% CI] | Lift in top 10% | Lift in top 20% |
|---|---|---|---|
| **S-Learner** | **0.091** [0.073, 0.113] | 5.50 pp | 4.07 pp |
| Activity score (baseline) | 0.087 [0.069, 0.109] | 4.99 pp | 4.14 pp |
| X-Learner | 0.084 [0.067, 0.110] | 5.95 pp | 4.12 pp |
| T-Learner | 0.084 [0.068, 0.107] | 5.77 pp | 3.97 pp |
| Random | −0.002 | 1.34 pp | 1.10 pp |

The S-Learner ranks users almost like the activity score (Spearman ρ = 0.96). Its edge is in the top ~10%, which matters most for small budgets. `causalml` does not build on Python 3.13 / Windows, so the three meta-learners are implemented in [`src/uplift_models.py`](src/uplift_models.py).

Only **7 of the 12 features** move the S-Learner's prediction. Setting one feature at a time to its 5th, 15th, …, 95th percentile for 400 sample users and re-scoring them, the average swing in predicted uplift is:

| Feature | f8 | f6 | f2 | f9 | f0 | f3 | f7 | f1, f4, f5, f10, f11 |
|---|---|---|---|---|---|---|---|---|
| Swing (extra visitors per 1,000) | 11.4 | 8.9 | 7.9 | 2.8 | 1.7 | 1.1 | 0.3 | 0 |

The last five never change the prediction: the model does not use them.

![Qini and uplift curves](reports/figures/07_qini_uplift_curves.png)

### 5. The decision depends on how ads are bought

| Cost per ad shown | Decision | Profit per 1M users |
|---|---|---|
| < ₹0.75 | **Show everyone** (targeting lowers profit) | ~₹35.3k at ₹0.50, ROI ~196% |
| ₹0.75 – ₹1.50 | **Target the top 50% by uplift**: 9% less ad spend, 96% of extra visits kept | ~₹18.6k at ₹1.00 (+8% vs everyone); turns a loss into a profit at ₹1.50 |
| ≥ ₹2.00 | **Pause** | every option loses money or breaks even |

If the company paid per *targeted* user instead of per impression, the campaign would lose about ₹4.5 lakh per 1M users. The uplift model's value is not at the assumed ₹0.50 price but as protection when prices rise.

![Profit sensitivity to ad cost](reports/figures/08_sensitivity_cost.png)

## Web app

A dark dashboard in three tabs, written so that business and technical readers can use the same page:

- **Overview:** the headline result (+11 extra visitors per 1,000 people), visit rates with and without ads, how many people actually saw an ad, the effect on those who did (CACE) next to the misleading naive comparison, extra purchases, and the profit and decision at the selected ad price.
- **Targeting & price:** the targeting chart (share of extra visits captured, or profit, by how many people see ads), the ad price picker with the recommendation, return per ₹1 and profit, and a model comparison table (S-Learner vs the "most active users" rule).
- **Try a person:** pick a person or move the feature sliders; the trained S-Learner runs **in the browser** (ONNX via onnxruntime-web) and returns the predicted uplift and a show/skip decision. The five features that move the prediction most are shown first, each with an impact label (High / Medium / Low / Unused) and a tooltip explaining it; the rest sit behind "Show more".
- **Analyst view:** one switch turns every label and number into its statistical form (ITT with z and p, confidence intervals, CACE, Qini, ROI, τ(x)). Plain English is the default.

Numbers count up, the targeting chart draws itself and the background moves slowly; all motion is switched off for visitors whose system asks to reduce motion.

Nothing in the app is hard-coded. [`src/export_app_data.py`](src/export_app_data.py) writes every number from the data and models to `app/public/data/app_data.json`, and [`src/export_onnx.py`](src/export_onnx.py) exports the model to `app/public/model/s_learner.onnx` with a parity check (max difference vs Python: 2e-7). The feature impact ranking in "Try a person" is computed in the browser from the same model ([`app/src/lib/traits.js`](app/src/lib/traits.js)).

Run it locally:

```bash
cd app
npm install      # also copies the onnxruntime-web WebAssembly files into public/ort
npm run dev      # http://localhost:5173
```

## Reproduce the analysis

```bash
pip install -r requirements.txt
# Notebooks in order: 01 → 08 (the first data load downloads ~311 MB and caches parquet files in data/)
python -m src.export_app_data    # refresh the numbers shown in the app
python -m src.export_onnx        # refresh the in-browser model
mlflow ui --backend-store-uri sqlite:///mlflow.db   # browse the 17 tracked model runs
```

## Project structure

```
criteo-uplift-project/
├── notebooks/            01_eda … 08_roi_decision (executed, with outputs)
├── src/
│   ├── data.py           download, 10% sample, dtypes, business assumptions
│   ├── stats_tests.py    SRM, SMD, ITT, CACE, bootstrap, power, segments, regression adjustment
│   ├── uplift_models.py  S/T/X-learners, activity baseline, prognostic score
│   ├── evaluation.py     Qini, uplift@k, bootstrap, targeting curves, profit
│   ├── export_app_data.py
│   └── export_onnx.py
├── app/                  React + Vite dashboard (static site)
├── models/               saved S-Learner and activity baseline (+ local-only score files)
├── reports/figures/      charts used in this README
├── render.yaml           Render deployment
└── requirements.txt
```

## Limitations

- **Anonymized features:** segments can be described only as "default / low / high" values of f0–f11, not as real customer attributes.
- **Assumed money values:** the ₹5 visit value and the ad prices are illustrative. The recommendation is given as a rule by price, and Step 9 shows how it changes.
- **Pooled dataset:** the exact 85.000% split and the prognostic imbalance suggest the data combines several tests. Adjusted and unadjusted estimates are both reported.
- **Exposure is not random:** CACE applies to users the ad system can reach, not to everyone.
- **Small control group in the test set** (~1,600 control visits): uplift metrics and profit curves have wide bootstrap intervals.
- **Rare conversions:** segment-level conversion results are too noisy to act on; decisions use visits.

## How this would run in production

- **Always keep a random holdout** (no ads) when targeting with the model. Without it, the effect of the targeting itself can no longer be measured, and the model cannot be re-evaluated on new data.
- **Monitor uplift drift:** track the realized lift in the holdout vs the model's predicted lift per score decile; alert when the top deciles stop outperforming.
- **Retrain on new experiment data** on a schedule, comparing the new model against the current one and the activity baseline on a fresh holdout before switching.
- **Watch auction effects:** targeting changes who wins impressions, which can shift exposure patterns and the cost per impression; re-run the ROI analysis with real prices.

## Deployment

The dashboard is a static site, because the model runs in the visitor's browser. [`render.yaml`](render.yaml) is a Render Blueprint: in Render, choose **New → Blueprint**, connect this repository, and Render builds `app/` with `npm ci && npm run build` and publishes `app/dist`.

## Tech stack

Python (pandas, NumPy, SciPy, statsmodels, scikit-learn, LightGBM, scikit-uplift, MLflow, ONNX) · React + Vite · onnxruntime-web · Render
