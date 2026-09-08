# Palantir-style ontology bridge

Planetary Forge ships an ontology contract at `ontology/palantir-bridge.json` and an export function in the HUD.

```text
Feed -> Observation -> GeoAsset / Incident -> World
```

The bridge deliberately separates **model compatibility** from **live connectivity**.

- `PALANTIR_LIVE=false` by default.
- `PALANTIR_WRITE_ENABLED=false` by default.
- Browser code never stores Palantir credentials.
- Consequential writes require a server-side authenticated adapter plus human approval.

A production Foundry integration should translate the exported object envelope into your tenant's actual object types through supported OSDK/API mechanisms and enforce permissions in Foundry. The Forge does not claim that those tenant objects already exist.
