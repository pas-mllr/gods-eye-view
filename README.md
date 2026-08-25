<div align="center">

# 🌐 God's Eye View — Global Tax Radar

### Mission control for global tax. A photorealistic 3D globe where a multinational's jurisdictions, obligations, audit exposure, and treaty positions live on the map — built on the open-source God's Eye View intelligence console.

*Every jurisdiction in view.*

</div>

---

<div align="center">

**[Why](#-why-this-exists) · [The Tax Radar](#-the-tax-radar) · [First Five Minutes](#-the-first-five-minutes) · [Talk to It](#-talk-to-it) · [Also on the Globe](#-also-on-the-globe) · [Quick Start](#-quick-start) · [Extending](#-extending-it) · [Honest & Open](#-honest--open) · [Built On](#-built-on)**

</div>

---

## 🌍 Why This Exists

Global tax work in a multinational group *is* a world map. Transfer-pricing documentation obligations, CbCR thresholds, APA availability, MAP queues, audit posture, treaty networks, and withholding rates are all questions about **jurisdictions** — but the answers usually live in a pile of PDFs, country guides, and spreadsheets. The signals are abundant; the *interface* is the bottleneck.

This tool turns those signals into a **place**. It takes the God's Eye View console — a real-time geospatial intelligence client on a photorealistic 3D Earth, with click-to-select context, an analyst query engine, and hands-free voice control — and points it at the questions tax advisory teams actually work: corporate tax, transfer pricing, tax audits and disputes, treaty-driven structuring and M&A.

> Half the magic is that it looks like a mission-control room. The other half is that every figure on the globe carries its source and as-of date.

The console's provenance ethos carries over unchanged: every layer states its source and freshness, curated figures are labeled **BUNDLED** snapshots with per-record `asOf` dates, editorial ratings are labeled editorial — and none of it is tax advice.

---

## ⚖️ The Tax Radar

Two curated jurisdiction layers, 51 jurisdictions each, one clickable stem per jurisdiction:

| Layer | Id / share token | What it shows |
|-------|------------------|---------------|
| **TP Radar** ⊞ | `local-tp-radar` / `p` | Transfer-pricing documentation obligations: master file / local file / CbCR requirements and the EUR 750m threshold, filing deadlines, penalty exposure, APA availability (unilateral/bilateral), MAP availability, OECD alignment, headline CIT rate |
| **Tax Disputes & M&A** ⚖ | `local-tax-disputes` / `j` | Dispute and structuring posture: MAP TP caseload approximations (inventory, new cases, average months), an **editorial** audit-intensity rating with typical audit focus, treaty network size, MLI signature, arbitration availability, domestic (non-treaty) withholding rates on dividends/interest/royalties, participation exemption |

Data is hand-curated from **OECD TP Country Profiles**, **OECD MAP Statistics**, and public national law — sources, curation dates, and every honesty caveat live in the [dataset README](src/data/local_data/tax_advisory/README.md).

**What a tax team does with it:**

- **🗂️ TP compliance radar.** Sweep the group's footprint; click a jurisdiction for its documentation regime — the ambient card compresses it to `CbCR ✓ · MF/LF ✓ · APA bilateral`.
- **🔥 Audit & dispute heat.** Read audit intensity and MAP congestion across a region before deciding where an APA or MAP filing is the better route.
- **🌐 Treaty/WHT structuring scan.** Query withholding outliers along a holding chain, or which jurisdictions combine bilateral APAs with arbitration.
- **📰 Tax-flavored briefings.** While a tax layer is on, the cockpit's regional headline strip re-scopes to tax coverage (tax authority, transfer pricing, OECD, tax audit) for wherever you're looking.
- **🔗 Shareable views.** Camera, layers, and selection serialize into a URL — a jurisdiction review you can hand to a colleague.

Use cases, the full field dictionary, and the extension guide: **[docs/TAX-ADVISORY.md](docs/TAX-ADVISORY.md)**.

---

## 🕐 The First Five Minutes

No account, no signup. The first-run card offers to stage a mission — take **TAX RADAR**, or run this yourself:

1. **Light up the tax world.** Pick the **TAX RADAR** mission tile (or toggle **TP Radar** and **Tax Disputes & M&A** in the layer tray). Both layers rise from the globe — amber TP stems, red dispute stems, side by side per jurisdiction.
2. **Click a jurisdiction.** The camera dives to its stem and the context card opens: documentation regime, deadlines, penalties, APA posture on one; MAP caseload, audit intensity, treaty and withholding posture on the other.
3. **Interrogate it** *(voice, needs an OpenAI key)*: *"Which jurisdictions in Europe require CbCR?"* · *"Highest MAP inventory over the EU?"* · *"Where is audit intensity very high in Asia?"* · *"Royalty withholding above fifteen percent anywhere?"*
4. **Say "tax radar."** The named voice view enables both layers and pulls back to the globe in one sentence.
5. **Switch the optics.** Tap `1`–`7` — CRT, NVG, FLIR — the ops-room look is inherited from the console and works on tax data too.
6. **Cross the streams.** The rest of the console is still live: flights, ships, satellites, earthquakes, cameras. Situational awareness for a supply-chain review or a site visit sits one toggle away.

**Keyboard:** `1`–`7` visual styles · `H` HUD · `D` detection · `Esc` out.

---

## 🎙️ Talk to It

> Voice needs an **OpenAI key**. Without one the entire app still runs — the mic button just reports voice is unavailable.

Click **GEV MIC**, grant the microphone, and just talk. The agent pulls live scene context before answering, answers entity questions from the selected jurisdiction's own record, and only confirms actions that succeeded.

**🔎 Interrogate it** — analyst queries against the tax layers:
> 🗣️ *"Which jurisdictions require a master file?"* · *"Sort jurisdictions by MAP inventory."* · *"Which jurisdictions have bilateral APAs and arbitration?"* · *"Where is the corporate rate below fifteen percent?"*

**🎛️ Operate it** — the whole console, hands-free:
> 🗣️ *"Tax radar."* · *"Turn on tax disputes."* · *"Take me to Singapore."* · *"Switch to night vision."* · *"What's turned on right now?"*

**🖊️ Annotate it** — a whiteboard over the real world:
> 🗣️ *"Outline Germany."* · *"Draw an arrow from Amsterdam to Dublin."* — real boundaries and connectors that persist until you say *"clear the map."*

Asked how current the tax data is, the agent says what is true: it's a bundled snapshot with per-record as-of dates, not a live feed.

---

## 🛰️ Also on the Globe

The full God's Eye View console remains intact underneath — thirteen live OSINT layers, most needing no key at all (🟢 nothing · 🟡 free key · 🔴 metered):

| Layer | Source | Auth |
|-------|--------|------|
| ✈️ Live Flights (+ 🎖️ military) | OpenSky + adsb.lol | 🟢 |
| 🚢 Live Vessels | AISStream | 🟡 |
| 🛰️ Satellites | CelesTrak | 🟢 |
| 🌍 Earthquakes | USGS | 🟢 |
| 🔥 Active Fires | NASA FIRMS | 🟡 |
| 🚗 Traffic | TomTom + OSM | 🟢 (🟡 for real flow) |
| 📹 CCTV Mesh (Austin · CA · London) | City APIs | 🟢 |
| 📻 Radio · 🚲 Bikeshare · 🚀 Space Missions · 🎖️ Mapped Installations | various | 🟢 |
| **⊞ TP Radar · ⚖ Tax Disputes & M&A** | **curated OECD/public snapshots** | **🟢 bundled** |
| ▣ Datacenters · ▰ Dams · ◠ Submarine Cables | bundled snapshots | 🟢 |

Plus the console features the layers ride on: click-to-track anything, cockpit mode, detection overlay, military-style HUD, GLSL sensor styles, cinematic scene director, and share links. The archived upstream README documents all of it in full: **[docs/UPSTREAM-README.md](docs/UPSTREAM-README.md)**.

---

## ⚡ Quick Start

Requires Node.js 24.14.x or 26.x (enforced by `package.json`).

1. Copy `.env.example` → `.env` and set `GOOGLE_MAPS_API_KEY`.
2. Install and run:

```bash
npm install
npm run dev -- --host localhost --port 4173
```

3. Open **`http://localhost:4173`** and pick the **TAX RADAR** mission on the first-run card.

**That one key is the whole entry fee.** Google Maps (🔴 metered — restrict the key, set quotas) buys the photorealistic planet; both tax layers are bundled and need nothing. An **OpenAI key** (🔴 metered, with a live in-app session estimate and a $5 session cap) adds voice. The optional 🟡 free keys (AISStream, FIRMS, TomTom, Cesium ion, OpenSky, Launch Library 2) light up the rest of the OSINT console — the full key matrix, cost reality, and Keychain shortcuts are in the [archived upstream README](docs/UPSTREAM-README.md#-api-keys).

The dev server binds to **localhost** — your keys stay on your machine. LAN sharing is an explicit opt-in with real key-exposure consequences: read [SECURITY.md](SECURITY.md) first.

**macOS shortcut:** `./scripts/dev-fresh.sh` clears the Vite cache and pulls your keys straight from the Keychain.

---

## 🧩 Extending It

The tax layers ride the repo's standard bundled-layer seam end to end — dataset → layer factory → registry → analyst engine → voice → docs — and that seam is open for the next practice area. Natural next layers, sketched in [docs/TAX-ADVISORY.md](docs/TAX-ADVISORY.md):

- **Indirect tax**: VAT/GST rates, e-invoicing mandates and go-live dates, digital services taxes.
- **Pillar Two**: IIR/UTPR/QDMTT status and effective dates per jurisdiction.
- **Deadline calendar**: filing deadlines for a configured group footprint (an env-pointed source pack, since footprints are company-specific).
- **Licensed live feeds**: any commercial tax-data feed can ride the same hardened proxy pattern the OSINT feeds use.

Adding a jurisdiction is one line per dataset file plus a bumped `asOf` — the test suite enforces the contract. General contribution rules: [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📋 Honest & Open

This project runs on **public data, clear sources, and local-first execution** — the visual grammar of an ops room, built entirely from open signals and inspectable code.

**The tax line.** The tax layers are **situational awareness, not advice**. Figures are hand-curated summaries of public materials: MAP caseloads are rounded approximations of the OECD MAP statistics, `auditIntensity` is an editorial rating, withholding rates are headline domestic rates that treaties usually lower. Every record carries an `asOf` date and a source note. Verify against primary sources — and against your advisors — before professional reliance.

**The people line.** Inherited from upstream and unchanged: this project models **events, assets, infrastructure, systems, and jurisdictions** — never people. No named-person search, no face recognition, no tracking individuals; pull requests that cross that line won't be merged.

**Status:** An evolving open-source client for exploration and learning, not a hardened production service. Code is **[MIT](LICENSE)**; bundled and live datasets carry their own terms — see **[DATA_SOURCES.md](DATA_SOURCES.md)**. Security model: **[SECURITY.md](SECURITY.md)**. Authoritative runtime reference: **[docs/CURRENT-STATE.md](docs/CURRENT-STATE.md)**.

> [!IMPORTANT]
> This is an exploratory visualization of public and third-party data. Data may
> be delayed, incomplete, modeled, inferred, or wrong. Do not use it for tax,
> legal, or investment decisions, flight or maritime navigation, emergency
> response, or other safety-critical or operational purposes without verifying
> against authoritative sources and qualified professionals. Nothing in this
> tool is tax advice.

---

## 🙏 Built On

This is an adaptation of **[God's Eye View](https://github.com/bilawalsidhu/gods-eye-view)** by **Bilawal Sidhu** — the open-source spy-satellite console from the [viral video series](https://youtube.com/playlist?list=PL6qSg2I-7_koPbDnSMo0QeeHX_RknA2uv&si=nBGYMoHWQw41v93Q). The globe, the layers, the voice agent, the cockpit, and the honesty ethos are his project's; this repository points that console at global tax advisory. The original README — including the full feature tour, field missions, and capture media — is preserved at [docs/UPSTREAM-README.md](docs/UPSTREAM-README.md).

---

<div align="center">

**🌐 God's Eye View — Global Tax Radar. Every jurisdiction in view.**

</div>
