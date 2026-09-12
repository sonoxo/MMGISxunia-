# XUNIA Defensive Awareness OSS Stack

XUNIA / MMGIS is the geospatial and temporal visualization plane for the shared GPT-DOUG / ZYRA defensive-awareness architecture.

## Live upstream status

[![Open MCT](https://img.shields.io/github/last-commit/nasa/openmct?label=Open%20MCT)](https://github.com/nasa/openmct)
[![CesiumJS](https://img.shields.io/github/last-commit/CesiumGS/cesium?label=CesiumJS)](https://github.com/CesiumGS/cesium)
[![Stone Soup](https://img.shields.io/github/last-commit/dstl/Stone-Soup?label=Stone%20Soup)](https://github.com/dstl/Stone-Soup)
[![Tracktable](https://img.shields.io/github/last-commit/sandialabs/tracktable?label=Tracktable)](https://github.com/sandialabs/tracktable)
[![PostGIS](https://img.shields.io/github/last-commit/postgis/postgis?label=PostGIS)](https://github.com/postgis/postgis)
[![MapLibre](https://img.shields.io/github/last-commit/maplibre/maplibre-gl-js?label=MapLibre)](https://github.com/maplibre/maplibre-gl-js)

The badges update automatically from GitHub activity.

## XUNIA role

```text
AUTHORIZED LIVE / HISTORICAL DATA
              |
              v
      PROVENANCE + NORMALIZATION
              |
      +-------+--------+
      |                |
      v                v
 STONE SOUP        TRACKTABLE
 track fusion    anomaly analytics
      |                |
      +-------+--------+
              v
           POSTGIS
              |
      +-------+--------+
      |       |        |
      v       v        v
   CESIUM  MAPLIBRE  OPEN MCT
      \       |       /
       \      |      /
        v     v     v
       XUNIA / MMGIS UI
              |
              v
       ZYRA REVIEW GATE
```

MMGIS already provides Cesium-powered 3D visualization and a PostGIS-backed spatial data layer. This registry formalizes those roles and reserves adapter slots for Open MCT telemetry views, Stone Soup track-fusion services, Tracktable analytics, and MapLibre 2D operational layers.

Registry: [`xunia-defensive-awareness-oss.json`](xunia-defensive-awareness-oss.json)

## Data contract

XUNIA may render authorized live telemetry, real-world geospatial coordinates, safety zones, sensor-health state, anomaly indicators, incident overlays, and historical playback. Derived layers should retain source, timestamp, confidence, and provenance metadata where available.

## Boundary

The XUNIA layer is for visualization, spatial analysis, and operator decision support. It does not provide weapon targeting, aimpoint generation, intercept guidance, fire-control cueing, autonomous engagement, or weapons release.
