# Tax Advisory (bundled snapshot)

Hand-curated per-jurisdiction tax summaries bundled for the TP Radar and
Tax Disputes & M&A layers. This is a **BUNDLED SNAPSHOT**, not a live feed:
the figures describe the rules and published statistics as summarized at
curation time and change only when these files are refreshed.

- Sources (facts summarized, no database redistributed):
  - OECD Transfer Pricing Country Profiles (oecd.org)
  - OECD Mutual Agreement Procedure (MAP) Statistics, 2023 reporting period
  - Published national law and public treaty/withholding-rate summaries
- Curated: 2026-08 (per-record `asOf`)
- Feature count: 51 jurisdictions per file
- Runtime files: `tp_radar.geojsonl`, `tax_disputes.geojsonl`

## Honesty notes — read before relying on a value

- **Curated approximations, not advice.** Values were hand-summarized from
  public materials for a situational-awareness map. MAP caseload figures
  (`mapInventoryTp`, `mapNewCasesTp`, `mapAvgMonthsTp`, `mapAvgMonthsOther`)
  are rounded approximations of the OECD MAP statistics; verify against the
  OECD MAP statistics database before professional reliance. Nothing in these
  files is tax advice.
- **`auditIntensity` is an editorial rating** (`low|moderate|high|very-high`)
  reflecting commonly reported enforcement posture, not a measured statistic.
- **`cbcrThresholdEur`** is the OECD-standard EUR 750m consolidated-revenue
  threshold; several jurisdictions define a local-currency equivalent
  (e.g. USD 850m in the US, AUD 1bn in Australia).
- **`whtDividendPct`/`whtInterestPct`/`whtRoyaltyPct`** are headline domestic
  (non-treaty) withholding rates; treaty rates are usually lower and several
  jurisdictions apply the rate only to specific payment classes.
- **`citRate`** is the headline corporate income tax rate (combined
  central+sub-central where that is the usual quoted figure).
- `null` means no reliable public figure was available at curation time.

## Geometry

One Point per jurisdiction, anchored at a representative city (capital or
principal business city). The disputes file offsets each anchor **+0.35°
longitude** so both layers' stems stay individually clickable when enabled
together.

## Refreshing

Update the values from the sources above, bump every touched record's
`asOf`, keep the jurisdiction sets of the two files identical (enforced by
`src/data/taxLayers.test.mjs`), and update the layer `source` strings in
`src/data/taxLayers.js` plus `DATA_SOURCES.md` with the new snapshot date.
