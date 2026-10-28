# Orbit Lab: methods and evidence

Orbit Lab combines three separate layers. Catalog positions describe tracked objects using public orbital elements. Population ensembles illustrate conditional futures. Fragment and encounter experiments demonstrate numerical methods. Outputs from one layer do not automatically calibrate another.

## Executed work

- **Catalog:** four CelesTrak groups, deduplicated by NORAD ID. `data/catalog/manifest.json` records source URLs, retrieval dates, element epochs, hashes and counts. This is a selected catalog, not all debris. The quality report is `data/science/catalog-quality.json`.
- **Data engineering:** `python -m backend.catalog_pipeline` verifies raw checksums, deduplicates and writes immutable date/snapshot/class-partitioned Parquet plus quality metrics. Reprocessing an existing snapshot returns its cached report.
- **Refresh:** the GitHub workflow refreshes every six hours, publishes a complete generation atomically, retains two raw generations and preserves the last good snapshot on failure. It stops after the first fetch error and does not refetch data younger than two hours. The backend mirrors published snapshots every six hours while idle; it does not independently hammer CelesTrak. Browser sessions load the snapshot when opened and do not hot-swap it mid-animation. Git history can grow even though the working tree retains only two generations; move long-term archives to dedicated storage if the project grows.
- **Population ensemble:** NumPy count simulations and the browser approximation remain uncalibrated homogeneous-mixing teaching models. Deployment graphs are population exposure proxies, not orbit-specific risk.
- **Fragment trajectories:** browser worker integrates two-body gravity using RK4, with assumed isotropic Gaussian velocity offsets. No drag, J2, impact energy, masses or size-frequency breakup model is inferred. The 3D sample is capped independently of simulated fragment counts. Energy conservation, circular-orbit closure and reproducibility are tested. Playback ends after two simulated hours; running the experiment again starts a fresh playback.
- **Sampled near approaches:** Python SGP4 propagates up to 200 evenly sampled debris objects for the public preview, every 120 seconds for two hours. The fictional comparison orbit has a chosen altitude/inclination and fixed example plane/phase, unrelated to deployed missions. The scene-to-TEME approximation matches the website frame convention. No interpolation/minimum search or precision Earth-orientation model is used. Sampling can miss closer encounters. Public mean elements do not supply covariance; these results are not operational conjunction assessments.
- **Gaussian probability:** numerical integration of an assumed 2D encounter-plane Gaussian over a hard-body disk. The isotropic centered case is checked against `1-exp(-R²/(2σ²))`. The example accepts assumptions supplied by the user, not uncertainty inferred from catalog elements. It is not a full CDM analysis or mission-risk product. See NASA's [Spaceflight Safety Handbook](https://www.nasa.gov/wp-content/uploads/2020/03/spaceflight_safety_handbook_for_operators_v1.5_aug201.pdf).

## MOCAT-pySSEM numerical reference

A full integration of [ARCLab-MIT/pyssem](https://github.com/ARCLab-MIT/pyssem) was executed at commit `21763efaafcd191942e2ae84db9ec86ae3b392e6`. The reproducible fixture contains 100 active satellites and 300 fragments with assumed masses/areas and uniformly sampled initial altitudes. The upstream three-species configuration was adapted to six shells, ten model years and no launches. Fragment spreading and parallel processing are disabled. Full configuration, species assumptions and outputs are in `data/science/mocat-reference.json`.

This proves that the model imports, initializes and numerically integrates this fixture with finite nonnegative outputs. It does **not** establish historical accuracy, calibrate the CelesTrak catalog, or connect this reference integration to the website's count-model sliders. pySSEM stays off the VPS; the site displays its cached result.

To reproduce in a separate local science environment:

```sh
git clone https://github.com/ARCLab-MIT/pyssem ../pyssem
git -C ../pyssem checkout 21763efaafcd191942e2ae84db9ec86ae3b392e6
python -m pip install -e ../pyssem
python scripts/run_mocat_reference.py --source ../pyssem --output .science/mocat-reference
```

The source code's integration time is in years; the stored configuration records this explicitly.

## Spark execution evidence

`data/science/spark-benchmark.json` contains four executed cold-job measurements. Spark reports version 4.2.0 in that execution environment. The optional requirements file specifies PySpark 4.0.1; it is not a claim that the stored benchmark used that version. Configure Java 17+ and consistent Python dependencies across workers.

| Independent runs | local[1] compute + write + read | local[2] compute + write + read |
|---|---:|---:|
| 10,000 | 5.98 s | 5.00 s |
| 100,000 | 10.44 s | 7.89 s |

Separate Python worker processes ran seeded batches and wrote partitioned Parquet. Only compact summaries were collected. The two configurations produce identical mean/quantile summaries for each run count (standard deviation differs at floating-point rounding). Startup is recorded separately. Each configuration was measured once on **one physical machine**. This is neither a repeated statistical performance study nor a multi-host scalability claim. There is no Spark installation or JVM on the VPS.

```sh
python -m pip install -r backend/requirements-science.txt
python scripts/benchmark_spark.py --help
```

To run across machines, provide a Spark cluster and shared storage, match dependencies and repeat the benchmark under controlled conditions. The batch workflow is intended to scale beyond the interactive API; the interactive site itself does not require big-data processing.

## Historical validation: still pending

`backend/hindcast.py` compares supplied prediction and observation CSV files with matched date, object group and minimum fragment size. It reports MAE, RMSE, bias and optional interval coverage, rejecting missing provenance and fewer than three matches. `validation/historical_observations_template.csv` is intentionally empty. Unit-test fixtures are synthetic and are not empirical validation.

Real calibration needs physical object inputs (mass, area, size classes), documented population coverage and observations from multiple historical dates/events. Changes in public catalog counts can reflect tracking/catalog practices as well as physical evolution. They should not be treated as direct measurements of fragmentation/decay rates without accounting for those effects.

## Resource boundaries

Hosted API: 256 MiB hard container memory, no additional swap, 0.25 CPU, one shared compute lock, one queue worker, no host port replacement. Public preview: at most 500 runs × 30 years, six compute attempts/minute globally; screening at most 200 objects × two hours. Larger private jobs need a token and are bounded at 2,000 runs / 100,000 run-years per arm. Generic-breakup comparisons execute two arms sequentially. Completed jobs retain only the latest 100 entries when new work arrives; Docker logs retain at most two 5 MB files. Disk use must still be monitored; the memory/CPU limits are not disk quotas.
