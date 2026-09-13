const fetch = require("node-fetch");

const BASE_URL = "https://api.n2yo.com/rest/v1/satellite";
const cache = new Map();
const upstreamUsage = new Map();

const DEFAULT_TTLS = {
  tle: 6 * 60 * 60 * 1000,
  positions: 20 * 1000,
  visualpasses: 15 * 60 * 1000,
  radiopasses: 15 * 60 * 1000,
  above: 30 * 1000,
};

const DEFAULT_BUDGETS = {
  tle: 950,
  positions: 950,
  visualpasses: 90,
  radiopasses: 90,
  above: 90,
};

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function requireApiKey() {
  const key = process.env.N2YO_API_KEY;
  if (!key) {
    const error = new Error("N2YO_API_KEY is not configured on the server");
    error.statusCode = 503;
    throw error;
  }
  return key;
}

function assertNumber(name, value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`${name} must be between ${min} and ${max}`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function assertInteger(name, value, min, max) {
  const number = assertNumber(name, value, min, max);
  if (!Number.isInteger(number)) {
    const error = new Error(`${name} must be an integer`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function observer(input = {}) {
  return {
    lat: assertNumber("lat", input.lat, -90, 90),
    lng: assertNumber("lng", input.lng, -180, 180),
    alt: assertNumber("alt", input.alt ?? 0, -500, 100000),
  };
}

function cacheTtl(type) {
  return envNumber(
    `N2YO_${type.toUpperCase()}_TTL_MS`,
    DEFAULT_TTLS[type] || 30000,
  );
}

function budgetLimit(type) {
  return envNumber(
    `N2YO_${type.toUpperCase()}_UPSTREAM_BUDGET`,
    DEFAULT_BUDGETS[type] || 90,
  );
}

function consumeBudget(type) {
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;
  const events = (upstreamUsage.get(type) || []).filter((ts) => ts > cutoff);
  const limit = budgetLimit(type);
  if (events.length >= limit) {
    const error = new Error(
      `Local N2YO ${type} safety budget exhausted; retry after the rolling window clears`,
    );
    error.statusCode = 429;
    error.retryAfter = Math.max(1, Math.ceil((events[0] + 3600000 - now) / 1000));
    throw error;
  }
  events.push(now);
  upstreamUsage.set(type, events);
}

function buildUrl(path) {
  const key = requireApiKey();
  const separator = path.startsWith("tle/") ? "&" : "/&";
  return `${BASE_URL}/${path}${separator}apiKey=${encodeURIComponent(key)}`;
}

async function request(type, path, options = {}) {
  const cacheKey = `${type}:${path}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (!options.bypassCache && cached && cached.expiresAt > now) {
    return { ...cached.value, _xunia: { ...cached.value._xunia, cache: "HIT" } };
  }

  consumeBudget(type);
  const response = await fetch(buildUrl(path), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "XUNIA-MMGIS-N2YO/1.0",
    },
    timeout: envNumber("N2YO_TIMEOUT_MS", 10000),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (error) {
    const parseError = new Error(`N2YO returned non-JSON (${response.status})`);
    parseError.statusCode = 502;
    throw parseError;
  }

  if (!response.ok) {
    const error = new Error(
      body?.error || body?.message || `N2YO request failed (${response.status})`,
    );
    error.statusCode = response.status >= 500 ? 502 : response.status;
    throw error;
  }

  const value = {
    ...body,
    _xunia: {
      provider: "n2yo",
      fetchedAt: new Date().toISOString(),
      cache: "MISS",
      endpoint: type,
    },
  };
  cache.set(cacheKey, { value, expiresAt: now + cacheTtl(type) });
  return value;
}

async function getTle(id) {
  return request("tle", `tle/${assertInteger("id", id, 1, 999999999)}`);
}

async function getPositions(id, input) {
  const o = observer(input);
  const seconds = assertInteger("seconds", input.seconds ?? 300, 1, 300);
  return request(
    "positions",
    `positions/${assertInteger("id", id, 1, 999999999)}/${o.lat}/${o.lng}/${o.alt}/${seconds}`,
  );
}

async function getVisualPasses(id, input) {
  const o = observer(input);
  const days = assertInteger("days", input.days ?? 2, 1, 10);
  const minVisibility = assertInteger(
    "minVisibility",
    input.minVisibility ?? 60,
    0,
    86400,
  );
  return request(
    "visualpasses",
    `visualpasses/${assertInteger("id", id, 1, 999999999)}/${o.lat}/${o.lng}/${o.alt}/${days}/${minVisibility}`,
  );
}

async function getRadioPasses(id, input) {
  const o = observer(input);
  const days = assertInteger("days", input.days ?? 2, 1, 10);
  const minElevation = assertInteger(
    "minElevation",
    input.minElevation ?? 20,
    0,
    90,
  );
  return request(
    "radiopasses",
    `radiopasses/${assertInteger("id", id, 1, 999999999)}/${o.lat}/${o.lng}/${o.alt}/${days}/${minElevation}`,
  );
}

async function getAbove(input) {
  const o = observer(input);
  const radius = assertInteger("radius", input.radius ?? 90, 0, 90);
  const category = assertInteger("category", input.category ?? 0, 0, 9999);
  return request(
    "above",
    `above/${o.lat}/${o.lng}/${o.alt}/${radius}/${category}`,
  );
}

function aboveToGeoJSON(data) {
  return {
    type: "FeatureCollection",
    features: (data.above || []).map((sat) => ({
      type: "Feature",
      id: String(sat.satid),
      geometry: {
        type: "Point",
        coordinates: [sat.satlng, sat.satlat, (sat.satalt || 0) * 1000],
      },
      properties: {
        provider: "n2yo",
        domain: "orbital",
        noradId: sat.satid,
        name: sat.satname,
        internationalDesignator: sat.intDesignator,
        launchDate: sat.launchDate,
        altitudeKm: sat.satalt,
        category: data.info?.category,
        observedAt: data._xunia?.fetchedAt,
      },
    })),
    xunia: data._xunia,
  };
}

function positionsToGeoJSON(data) {
  const positions = data.positions || [];
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: String(data.info?.satid || "satellite"),
        geometry: {
          type: "LineString",
          coordinates: positions.map((p) => [
            p.satlongitude,
            p.satlatitude,
            (p.sataltitude || 0) * 1000,
          ]),
        },
        properties: {
          provider: "n2yo",
          domain: "orbital",
          noradId: data.info?.satid,
          name: data.info?.satname,
          timestamps: positions.map((p) => p.timestamp),
          samples: positions,
        },
      },
    ],
    xunia: data._xunia,
  };
}

function positionsToCzml(data) {
  const positions = data.positions || [];
  if (positions.length === 0) return [{ id: "document", version: "1.0" }];
  const epochSeconds = positions[0].timestamp;
  const epoch = new Date(epochSeconds * 1000).toISOString();
  const cartographicDegrees = [];
  positions.forEach((p) => {
    cartographicDegrees.push(
      p.timestamp - epochSeconds,
      p.satlongitude,
      p.satlatitude,
      (p.sataltitude || 0) * 1000,
    );
  });
  return [
    {
      id: "document",
      name: "XUNIA N2YO Live Orbit",
      version: "1.0",
      clock: {
        interval: `${epoch}/${new Date(positions[positions.length - 1].timestamp * 1000).toISOString()}`,
        currentTime: epoch,
        multiplier: 1,
        range: "CLAMPED",
        step: "SYSTEM_CLOCK_MULTIPLIER",
      },
    },
    {
      id: `n2yo-${data.info?.satid}`,
      name: data.info?.satname || `NORAD ${data.info?.satid}`,
      availability: `${epoch}/${new Date(positions[positions.length - 1].timestamp * 1000).toISOString()}`,
      position: {
        epoch,
        cartographicDegrees,
        interpolationAlgorithm: "LAGRANGE",
        interpolationDegree: 5,
      },
      point: { pixelSize: 9, outlineWidth: 2 },
      path: { show: true, width: 2, leadTime: 300, trailTime: 300 },
      properties: {
        provider: "n2yo",
        domain: "orbital",
        noradId: data.info?.satid,
      },
    },
  ];
}

function stats() {
  const now = Date.now();
  const usage = {};
  for (const type of Object.keys(DEFAULT_BUDGETS)) {
    const events = (upstreamUsage.get(type) || []).filter(
      (ts) => ts > now - 3600000,
    );
    usage[type] = {
      used: events.length,
      localLimit: budgetLimit(type),
      remaining: Math.max(0, budgetLimit(type) - events.length),
    };
  }
  return {
    configured: Boolean(process.env.N2YO_API_KEY),
    cacheEntries: cache.size,
    usage,
  };
}

module.exports = {
  getTle,
  getPositions,
  getVisualPasses,
  getRadioPasses,
  getAbove,
  aboveToGeoJSON,
  positionsToGeoJSON,
  positionsToCzml,
  stats,
};
