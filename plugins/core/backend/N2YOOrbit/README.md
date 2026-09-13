# N2YO Live Orbital Data — XUNIA/MMGIS

Server-side N2YO REST API v1 adapter for live satellite/orbital telemetry.

## Required secret

```bash
N2YO_API_KEY=your_private_key
```

Never expose the key in browser JavaScript, committed files, screenshots, or client-side environment variables.

## Routes

- `GET /api/n2yo/health`
- `GET /api/n2yo/tle/:id`
- `GET /api/n2yo/positions/:id?lat=...&lng=...&alt=0&seconds=300`
- `GET /api/n2yo/positions/:id/geojson?lat=...&lng=...&alt=0&seconds=300`
- `GET /api/n2yo/positions/:id/czml?lat=...&lng=...&alt=0&seconds=300`
- `GET /api/n2yo/visualpasses/:id?lat=...&lng=...&alt=0&days=2&minVisibility=60`
- `GET /api/n2yo/radiopasses/:id?lat=...&lng=...&alt=0&days=2&minElevation=20`
- `GET /api/n2yo/above?lat=...&lng=...&alt=0&radius=90&category=0`
- `GET /api/n2yo/above/geojson?lat=...&lng=...&alt=0&radius=90&category=0`
- `GET /api/n2yo/stream/:id?lat=...&lng=...&alt=0&seconds=300` — Server-Sent Events

Use the numeric NORAD Catalog ID for every object, including catalog IDs over 100000. Do not send Alpha-5 identifiers from TLE text to N2YO.

## Live-data strategy

N2YO returns up to 300 one-second position samples in one request. The adapter fetches a position window once, caches it, and fans those samples out to MMGIS/Cesium clients. The SSE endpoint emits samples at approximately their UTC timestamps. This avoids turning every browser animation tick into an upstream N2YO request.

### Normalized outputs

`/above/geojson` returns satellite footprints as GeoJSON Points with altitude in meters.

`/positions/:id/geojson` returns a GeoJSON LineString with the original N2YO samples attached to feature properties.

`/positions/:id/czml` returns a Cesium CZML document with time-dynamic cartographic coordinates and an orbit path.

The normalized records use:

```json
{
  "provider": "n2yo",
  "domain": "orbital",
  "noradId": 25544
}
```

so the provider can coexist with aircraft ADS-B, maritime AIS, weather, wildfire, seismic, and other LIVE EARTH feeds without pretending satellite data is aircraft telemetry.

## Quota protection

The client uses two independent protections:

1. Endpoint-specific cache TTLs.
2. A local rolling one-hour upstream budget that counts only cache misses.

Defaults intentionally leave headroom below N2YO's published limits:

| Type | Local default budget/hour |
| --- | ---: |
| `tle` | 950 |
| `positions` | 950 |
| `visualpasses` | 90 |
| `radiopasses` | 90 |
| `above` | 90 |

Optional environment variables:

```bash
N2YO_TIMEOUT_MS=10000
N2YO_PROXY_REQUESTS_PER_MINUTE=180
N2YO_STREAM_WINDOW_SECONDS=300

N2YO_TLE_TTL_MS=21600000
N2YO_POSITIONS_TTL_MS=20000
N2YO_VISUALPASSES_TTL_MS=900000
N2YO_RADIOPASSES_TTL_MS=900000
N2YO_ABOVE_TTL_MS=30000

N2YO_TLE_UPSTREAM_BUDGET=950
N2YO_POSITIONS_UPSTREAM_BUDGET=950
N2YO_VISUALPASSES_UPSTREAM_BUDGET=90
N2YO_RADIOPASSES_UPSTREAM_BUDGET=90
N2YO_ABOVE_UPSTREAM_BUDGET=90
```

## Smoke test

With MMGIS running and `N2YO_API_KEY` configured:

```bash
curl "http://localhost:8888/api/n2yo/health"
curl "http://localhost:8888/api/n2yo/positions/25544/geojson?lat=37.54&lng=-77.44&alt=0&seconds=300"
curl -N "http://localhost:8888/api/n2yo/stream/25544?lat=37.54&lng=-77.44&alt=0&seconds=300"
```

The example coordinates are only a smoke-test observer point. Production clients should send their own observer coordinates; do not hard-code a user's precise location into the repository.
