# XUNIAverse Planetary Forge

A forkable **multiverse renderer + live geospatial command globe** built as a clean extension of MMGISxunia.

## Run

```bash
cd xuniaverse-forge
npm run validate
npm run dev
```

Open `http://localhost:4173`.

## What ships

- WebGL multiverse with animated star systems, worlds, orbit lines and bloom.
- Cesium Live Earth mode with lighting/atmosphere and public geospatial overlays.
- OSIRIS-inspired HUD: left layer rail, right ontology/intelligence rail, live counters, inspection, timeline, reproducible URL layer state.
- Passive public OSIRIS feed bridge for maritime, satellite, CCTV, news and weather routes.
- Direct keyless USGS earthquake and NASA EONET event/fire feeds.
- Authorized GeoJSON overlay slot for organization-owned/public feeds.
- Palantir-style ontology contract and local snapshot export. Live Palantir writes remain disabled until a deployment supplies server-side auth and explicit approval.
- JSON-defined universes so forks add systems and planets without editing the renderer.

## Share a layer state

```text
http://localhost:4173/?layers=maritime,sat_military,cctv,live_news,earthquakes,fires,weather,global_incidents,day_night,cables,sdk_sea,sdk_air,sdk_naval
```

## Modes

**UNIVERSE** is synthetic/fork-defined spatial content. **LIVE EARTH** is public/authorized real-world geospatial content. Clicking Earth in Universe View opens Live Earth.

## OSIRIS bridge boundary

This project uses OSIRIS as an open-source design/data-surface reference and can relay only selected passive GET feeds. It deliberately does not proxy or expose scanner/recon endpoints. OSIRIS is MIT licensed; retain attribution when reusing OSIRIS-derived code or data contracts. This Forge implementation is independently written.

## Palantir bridge boundary

`.xunia/palantir-platform.json` in the parent repo already marks Palantir connectivity and writes false by default. Planetary Forge preserves that truth boundary. `ontology/palantir-bridge.json` defines object types, links and guarded action shapes; it does not claim a Foundry tenant or entitlement.

## Fork workflow

1. Edit `catalog/universe.json`.
2. Add/edit safe layer adapters in `catalog/layers.json`.
3. Run `npm run validate`.
4. Deploy this folder to a Node 22+ host.
5. If you add private feeds, terminate auth server-side and return normalized GeoJSON to the browser.

See `docs/ADDING-A-WORLD.md`, `docs/LIVE-DATA.md`, and `docs/PALANTIR-BRIDGE.md`.
