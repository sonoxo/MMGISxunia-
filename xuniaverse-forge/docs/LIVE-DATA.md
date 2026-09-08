# Live data adapters

Planetary Forge normalizes map feeds to GeoJSON before rendering them.

## Built in

- `earthquakes` — USGS M2.5+ past-day GeoJSON.
- `fires` — NASA EONET open wildfire events.
- `global_incidents` — NASA EONET open events.
- `maritime`, `sat_military`, `cctv`, `live_news`, `weather` — passive OSIRIS API bridge when the upstream route is available.
- `day_night` — computed locally by Cesium lighting.
- `cables`, `sdk_sea`, `sdk_air`, `sdk_naval` — authorized adapter slots. These do not invent data when no endpoint is configured.

## Overlay contract

The UI's overlay URL should return a GeoJSON `FeatureCollection`. Point, line and polygon features are supported by Cesium's GeoJSON loader.

Do not place API tokens in browser URLs. For authenticated feeds, create a server route that authenticates upstream and returns only the data the signed-in operator is allowed to see.

## Privacy and provenance

Each rendered live object is converted to a local ontology observation with its layer, source, coordinates and time. A feed is not evidence of identity or intent. Preserve source attribution and provider terms.
