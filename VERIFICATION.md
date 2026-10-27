# Verification

Updated locally on 2026-10-27.

- 11 JavaScript tests pass: circular orbit geometry, period and speed, launch-plane/site intersection, reachable inclination limits, import validation, reproducible random streams, distribution sample means, zero/probability edge cases, quantiles.
- Five Python tests pass: reproducibility, zero source/sink case, abstract breakup counts, empirical distribution means/variances, API validation and hidden-path rejection.
- Local batch runner tested with two batches of 50 outcomes, written to Parquet.
- Browser checks pass with no JavaScript errors or failed asset requests: all 19,495 catalog records load; full-catalog drawing; four charts; 5× scale; Python calculation; browser Lognormal preview; abstract breakup event; cinematic rocket staging and deployment; 390px and 320px layouts without horizontal overflow.
- Real catalog and synthetic model data are labeled separately. Catalog is a fixed snapshot of selected groups, not a complete inventory or live feed.
- Rocket ascent, decorative breakup particle motion, and numerical population model are not calibrated physical predictions. Browser large-count distributions use approximations, labeled in the interface.
- Docker recipe and Spark cluster extension are supplied but were not executed. The Python service was tested locally; no hosted backend was provisioned.

## Readability / probability update

- 17 JavaScript tests and eight Python tests pass. Added exact constant-hazard checks, delayed exposure until deployment, zero-risk edge case, bounded/monotonic cumulative probabilities, marker-size independence, replay of the counterfactual baseline, and absence of secondary collision fragments when the coefficient is zero.
- Tooltips support hover, keyboard focus, tap-to-pin, Escape, and dismissal on outside interaction.
- Probability is explicitly a hypothetical population proxy and is independent of visible marker size and mission orbital geometry.
- Abstract breakup comparisons use two conditional ensembles and subtract the primary event fragments from the later-fragment difference.
- End-to-end browser checks passed without JavaScript or failed-request errors: tooltip hover/focus/tap/Escape; marker size; automatic probability analysis after direct placement and a complete launch; six plots for a breakup; 390px and 320px layouts without horizontal overflow.

- A no-satellite breakup is a true no-op in both engines: it consumes no extra random draws and cannot invent feedback.
