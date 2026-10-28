# Included data

## Public catalog snapshot

Latest validated generation fetched from CelesTrak on **2026-10-28 at 18:53 UTC**:

| Group | Records |
|---|---:|
| Active satellites | 16,823 |
| FENGYUN 1C debris | 1,980 |
| COSMOS 2251 debris | 585 |
| IRIDIUM 33 debris | 109 |
| **Unique objects across these groups** | **19,497** |

The JSON files contain original OMM-compatible orbital elements, not manufactured satellite positions. `catalog/manifest.json` records each URL, retrieval time and element-epoch range. Propagation uses satellite.js 6.0.1 (SGP4). The display clock begins at the retrieval timestamp; positions are computed at that reference plus elapsed simulation time. Some elements are substantially older than the reference, and accuracy deteriorates with time. This is not a live service or complete space-debris inventory. Invalid/below-Earth propagated positions are excluded from drawing and their count is shown.

The browser loads all four groups and deduplicates NORAD IDs. The drawing slider changes the evenly selected visual subset, not which source records were downloaded. **Draw the full loaded catalog** requests all selected positions. The snapshot is not fetched from CelesTrak on each visit. A GitHub workflow attempts refresh every six hours and preserves the last good generation on failure. `catalog/manifest.json` is the authoritative list of generation paths. Two raw generations and compact count history are retained in the working tree. `science/catalog-quality.json` records deduplication and epoch-age checks. The hosted API mirrors the published snapshot every six hours while idle. See SCIENCE.md for methods and limits.

## Synthetic teaching data

`ensemble/` contains the earlier 27 partitioned Parquet scenario outputs, totaling **418,500 records**: 500 runs × 31 snapshots × 27 parameter combinations. These are population counts; none is a real orbit observation. `ensemble/_manifest.json` lists each file. The complete dataset is also in the notebook download.

`presets.json` contains summaries and histograms from the same seeded population-model scenarios. It permits the static site to show plots without a server. `teaching-statistics.json` retains the earlier launch-distribution teaching examples.

New scenarios run in a browser worker or the optional Python service. They are separate from the real catalog layer. When catalog counts initialize a simulation, only class counts are used; orbital elements, sizes, masses and spatial densities are not incorporated into the collision model. The resulting output remains an uncalibrated scenario, not a catalog-driven risk forecast.
