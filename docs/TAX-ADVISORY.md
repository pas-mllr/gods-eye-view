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
| TP Radar ⊞ | `local-tp-radar` | `p` | Transfer-pricing documentation obligations per jurisdiction: master file / local file / CbCR requirements and the EUR 750m threshold, filing deadlines, penalty exposure, APA availability (unilateral/bilateral), MAP availability, OECD alignment, headline CIT rate — plus dated policy states (Pillar Two status, safe-harbour end, e-invoicing mandate phase and go-live, next GIR deadline) rendered as deadline urgency (overdue red / imminent orange / upcoming yellow stems) |
| Tax Disputes & M&A ⚖ | `local-tax-disputes` | `j` | Dispute and structuring posture per jurisdiction: MAP TP caseload approximations (inventory, new cases, average months), an editorial audit-intensity rating with typical audit focus, treaty network size, MLI signature, arbitration availability, domestic (non-treaty) withholding rates on dividends/interest/royalties, participation exemption |
| Tax Events ◍ | `tax-events` | `k` | **Live** geocoded tax news: GDELT DOC 2.0 polled every 10 minutes on a tax query, aggregated per jurisdiction (pin size = article volume, opacity = freshness over a 72h window), clickable to the underlying articles |
| Entity Footprint ⬢ | `entity-footprint` | `n` | The **configured group's** legal entities (env-pointed pack; the committed default is a clearly FICTIONAL demo group), jurisdiction-enriched and colored by **PREDICTED** audit-risk band |
| Intercompany Flows ⇌ | `tax-flows` | `v` | The same pack's intercompany flows as lifted great-circle arcs, colored by type (goods, royalty, service fee, financing, dividend, cost share), clickable for pricing method and value |

**Live overlay:** both jurisdiction layers merge live figures from the OECD
SDMX API through `/api/oecd-tax` (six-hourly): statutory CIT rates onto TP
Radar, MAP TP caseloads onto Disputes. Merged records carry provenance
(`citRateSource`/`mapStatsSource`: `oecd-live` vs `bundled`), the layer chip
flips to `OECD SDMX · LIVE + BUNDLED …` only after a successful merge, and a
lapsed overlay reports STALE while the intact bundled snapshot keeps
working. The dataflow ids are env-tunable (`OECD_*` in `.env.example`).

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

## The entity-footprint pack

The Entity Footprint and Intercompany Flows layers read one JSON pack through
`/api/entity-footprint` (the CCTV source-pack pattern: operator-trusted,
env-pointed, never fetched from client-supplied URLs). Ship your own with
`ENTITY_FOOTPRINT_FILE=/path/to/pack.json` (or inline via
`ENTITY_FOOTPRINT_JSON`); **never commit a real group's pack**. The committed
default, `config/entity_footprint.example.json`, is the entirely fictional
"Aurora Consumer Group" so the demo works out of the box.

```jsonc
{
  "disclaimer": "…", "group": "…", "asOf": "YYYY-MM",
  "entities": [{
    "id": "unique-id",                  // required
    "name": "Legal name",
    "lei": "20-char LEI or null",       // validated /^[A-Z0-9]{18}[0-9]{2}$/
    "jurisdiction": "DE",               // iso2; joins the radar datasets
    "lat": 50.1, "lon": 8.7,            // required anchor
    "role": "parent|holding|ip-owner|principal|distributor|manufacturer|finance|shared-services|rnd|other",
    "parentId": "id or null",           // dangling/cyclic links repaired loudly
    "ipOwner": false, "financing": false,
    "headcount": 100, "functionsNote": "…"
  }],
  "flows": [{
    "id": "unique-id", "from": "entity-id", "to": "entity-id",
    "type": "royalty|service-fee|goods|financing|dividend|cost-share|other",
    "annualValueEur": 1000000, "pricingMethod": "…", "note": "…"
    // direction = delivery of the goods / service / licence / funds
  }]
}
```

The proxy normalizes and validates server-side (bad records are dropped
**with warnings in the payload and server log**, never silently), joins each
entity to its jurisdiction's radar attributes, and stamps the risk score.

## PREDICTED audit risk

`src/data/entityRisk.js` — deterministic, inspectable, and labeled. This is
an **editorial weighting**, not a statistical model, and every surface that
renders it says PREDICTED:

```
riskScore = clamp(round(0.35·audit + 0.20·map + 0.20·safeHarbour + 0.25·role), 0, 100)
  audit        low 10 · moderate 40 · high 70 · very-high 95 · unknown 35
  map          min(100, mapAvgMonthsTp × 2) · unknown 30
  safeHarbour  expired 80 · ≤180d 65 · ≤365d 45 · >365d 20 · non-GloBE 50
  role         20 base · +30 ipOwner · +25 financing · +15 principal/ip-owner · cap 100
bands: <25 low · <50 moderate · <75 high · ≥75 very-high
```

`explainRisk()` returns the four component scores so a reviewer can see why
an entity scored what it did. Voice queries can filter and sort on
`riskScore`/`riskBand` — the agent is instructed to always call it predicted.

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
`LAYER_STATE_REGISTRY` token, and an `ANALYST_LAYERS` entry. Landed since
the first iteration: Pillar Two + e-invoicing state machines (on TP Radar),
the OECD live overlay, the live tax-events layer, the entity-footprint
source pack, intercompany flow arcs, and the PREDICTED risk overlay.
Natural candidates for the next ones:

- **Indirect tax depth**: standard VAT/GST rates and digital services taxes
  as first-class fields (the e-invoicing state machine already landed).
- **Public CbCR peer layer**: EU registers + ATO publications become a
  scrapable per-country corpus from end-2026.
- **A GloBE scenario engine**: what-if top-up tax per jurisdiction over the
  footprint pack, built on the OECD GIR XML schema.
- **Licensed live feeds**: any commercial tax feed rides the same
  proxy-hardening pattern as the existing `/api/*` middlewares.

## Honesty rules for refreshes

Keep the repo's provenance ethos: bump `asOf` on every touched record, keep
the `BUNDLED <date>` layer source strings in `taxLayers.js` current, never
present the snapshot as live, and keep editorial fields (`auditIntensity`)
labeled as editorial in the dataset README.
