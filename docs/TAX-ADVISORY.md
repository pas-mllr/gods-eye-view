# Tax Advisory Radar

Mission control for global tax. This document explains how God's Eye View
serves global tax advisory teams in multinational groups — corporate tax,
transfer pricing, indirect tax, tax M&A, audits, structuring, and disputes —
what the two bundled tax layers contain, and how to extend them.

**Nothing here is tax advice.** The layers are situational-awareness surfaces
built from hand-curated summaries of public materials; every figure carries a
per-record `asOf` date and must be verified against primary sources before
professional reliance.

## The layers

| Layer | Id | Share token | What it shows |
|-------|----|-------------|---------------|
| TP Radar ⊞ | `local-tp-radar` | `p` | Transfer-pricing documentation obligations per jurisdiction: master file / local file / CbCR requirements and the EUR 750m threshold, filing deadlines, penalty exposure, APA availability (unilateral/bilateral), MAP availability, OECD alignment, headline CIT rate |
| Tax Disputes & M&A ⚖ | `local-tax-disputes` | `j` | Dispute and structuring posture per jurisdiction: MAP TP caseload approximations (inventory, new cases, average months), an editorial audit-intensity rating with typical audit focus, treaty network size, MLI signature, arbitration availability, domestic (non-treaty) withholding rates on dividends/interest/royalties, participation exemption |

Both are **BUNDLED snapshots**, not live feeds — the layer `source` strings say
so, and the provenance README
(`src/data/local_data/tax_advisory/README.md`) carries the honesty caveats:
MAP figures are rounded approximations of the OECD MAP statistics,
`auditIntensity` is editorial, WHT rates are headline domestic rates.
51 jurisdictions, one point per jurisdiction anchored at a representative
city; the disputes anchors sit +0.35° longitude east so both stems stay
clickable when the layers run together.

## What a tax team does with it

- **TP compliance radar.** Toggle TP Radar, sweep the group's footprint, click
  a jurisdiction stem for its documentation regime; the ambient card compresses
  it to `CbCR ✓ · MF/LF ✓ · APA bilateral`.
- **Audit & dispute heat.** Toggle Tax Disputes & M&A and read audit intensity
  and MAP congestion across a region before deciding where an APA or MAP filing
  is the better route.
- **Treaty/WHT structuring scan.** Ask the analyst engine for withholding
  outliers along a holding chain ("royalty withholding above 15 percent
  anywhere", "which jurisdictions have no participation exemption?").
- **Tax-flavored regional briefing.** While a tax layer is enabled, the cockpit
  regional news strip re-scopes its place query to tax coverage (tax authority,
  transfer pricing, OECD, tax audit terms) via the server-whitelisted
  `topic=tax` parameter on `/api/regional-brief`.
- **Voice.** "Tax radar" / "the tax view" enables both layers over the globe.
  Analytical questions route through `analyst_query`:
  - "Which jurisdictions in Europe require CbCR?"
  - "Highest MAP inventory over the EU?"
  - "Where is audit intensity very high in Asia?"
  - "Which jurisdictions have bilateral APAs and arbitration?"

## Field dictionary

`tp_radar.geojsonl` properties (per jurisdiction):

| Field | Type | Meaning |
|-------|------|---------|
| `name`, `iso2`, `iso3` | text | Jurisdiction identity |
| `tpDocRequired` | flag | Any statutory TP documentation obligation |
| `masterFileRequired`, `localFileRequired`, `cbcrRequired` | flag | BEPS Action 13 three-tier obligations |
| `cbcrThresholdEur` | number | CbCR consolidated-revenue threshold (OECD-standard EUR 750m; local-currency equivalents exist) |
| `tpDeadline` | text | Preparation/submission timing in one line |
| `tpPenaltyNote` | text | Penalty exposure in one line |
| `apa` | text | `none` / `unilateral` / `unilateral+bilateral` |
| `apaBilateral`, `mapAvailable` | flag | Derived convenience flags |
| `oecdAlignment` | text | Relationship to the OECD TP Guidelines |
| `citRate` | number | Headline corporate income tax rate (%) |
| `asOf`, `sourceNote` | text | Curation date and underlying sources |

`tax_disputes.geojsonl` properties:

| Field | Type | Meaning |
|-------|------|---------|
| `mapInventoryTp`, `mapNewCasesTp` | number | MAP TP case inventory / new cases (rounded approximations; `null` = no reliable public figure) |
| `mapAvgMonthsTp`, `mapAvgMonthsOther` | number | Average months to close MAP cases (TP / other) |
| `auditIntensity` | text | **Editorial** rating: `low` / `moderate` / `high` / `very-high` |
| `auditFocus` | text | Commonly reported audit themes |
| `arbitrationAvailable` | flag | MAP arbitration reachable (EU directive / MLI Part VI / treaty) |
| `icapMember` | flag | ICAP-participating tax administration |
| `mliSigned` | flag | BEPS MLI signature |
| `treatyCount` | number | Approximate in-force treaty network size |
| `whtDividendPct`, `whtInterestPct`, `whtRoyaltyPct` | number | Headline domestic (non-treaty) withholding rates (%) |
| `participationExemption` | flag | Domestic participation exemption available |

## How it is wired (for extension)

The tax layers ride the repo's standard bundled-layer seam end to end:

1. **Data**: JSONL + provenance README in `src/data/local_data/tax_advisory/`.
2. **Layer**: `createLocalGeoJsonLayer` in `src/data/taxLayers.js`, exported
   through `src/data/localLayers.js` (auto-registered by `main.js`).
3. **Persistence**: `LAYER_STATE_REGISTRY` rows in `src/data/layerState.js`
   (tokens `p`/`j` in share links).
4. **Analyst queries**: the layers pass the factory's opt-in `analystRecord`
   mapper (pure functions in `taxLayers.js`), and `ANALYST_LAYERS` in
   `src/data/analystEngine.js` declares the queryable fields.
5. **Voice**: layer aliases + compact-payload fields in
   `src/voice/gevActions.js`; tool enums + one persona line in
   `vite.config.js`.
6. **News topic**: `setRegionalBriefTopicSource` in
   `src/data/regionalBrief.js` (called from the layers' enable/disable), and
   the `regionalNewsQuery` helper + `topic` whitelist in `vite.config.js`.
7. **Launcher**: the TAX RADAR mission in `src/firstRunExperience.js` +
   `index.html`.

### Adding a jurisdiction

Add one line to each JSONL (keep both files' jurisdiction sets identical —
`src/data/taxLayers.test.mjs` enforces it), fill every field or use `null`,
set `asOf`, and update the counts in the dataset README and
`DATA_SOURCES.md`.

### Adding a new tax layer (e.g. indirect tax / e-invoicing, Pillar Two)

Follow the seven-step wiring above with a new dataset file, a new
`createLocalGeoJsonLayer` call in `taxLayers.js`, a fresh
`LAYER_STATE_REGISTRY` token, and an `ANALYST_LAYERS` entry. Natural
candidates for later iterations:

- **Indirect tax**: standard VAT/GST rate, e-invoicing mandate status and
  go-live dates, digital services taxes.
- **Pillar Two**: IIR/UTPR/QDMTT status and effective dates per jurisdiction.
- **Deadline calendar**: per-entity filing deadlines for a configured group
  footprint (would suit a CCTV-style env-pointed source pack instead of a
  committed dataset, since footprints are company-specific).
- **Live sources**: a licensed feed would ride the same proxy-hardening
  pattern as the existing `/api/*` middlewares in `vite.config.js`.

## Honesty rules for refreshes

Keep the repo's provenance ethos: bump `asOf` on every touched record, keep
the `BUNDLED <date>` layer source strings in `taxLayers.js` current, never
present the snapshot as live, and keep editorial fields (`auditIntensity`)
labeled as editorial in the dataset README.
