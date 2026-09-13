const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const client = require("../services/n2yoClient");

router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.N2YO_PROXY_REQUESTS_PER_MINUTE || 180),
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

function sendError(res, error) {
  const status = error.statusCode || 500;
  if (error.retryAfter) res.setHeader("Retry-After", String(error.retryAfter));
  res.status(status).send({
    status: "failure",
    message: error.message || "N2YO integration error",
  });
}

function query(req, extras = {}) {
  return {
    lat: req.query.lat,
    lng: req.query.lng,
    alt: req.query.alt ?? 0,
    seconds: req.query.seconds,
    days: req.query.days,
    minVisibility: req.query.minVisibility,
    minElevation: req.query.minElevation,
    radius: req.query.radius,
    category: req.query.category,
    ...extras,
  };
}

router.get("/health", (req, res) => {
  res.send({
    status: "success",
    body: {
      provider: "n2yo",
      domain: "orbital",
      ...client.stats(),
    },
  });
});

router.get("/tle/:id", async (req, res) => {
  try {
    res.send({ status: "success", body: await client.getTle(req.params.id) });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/positions/:id", async (req, res) => {
  try {
    res.send({
      status: "success",
      body: await client.getPositions(req.params.id, query(req)),
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/positions/:id/geojson", async (req, res) => {
  try {
    const data = await client.getPositions(req.params.id, query(req));
    res.send(client.positionsToGeoJSON(data));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/positions/:id/czml", async (req, res) => {
  try {
    const data = await client.getPositions(req.params.id, query(req));
    res.send(client.positionsToCzml(data));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/visualpasses/:id", async (req, res) => {
  try {
    res.send({
      status: "success",
      body: await client.getVisualPasses(req.params.id, query(req)),
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/radiopasses/:id", async (req, res) => {
  try {
    res.send({
      status: "success",
      body: await client.getRadioPasses(req.params.id, query(req)),
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/above", async (req, res) => {
  try {
    res.send({ status: "success", body: await client.getAbove(query(req)) });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/above/geojson", async (req, res) => {
  try {
    const data = await client.getAbove(query(req));
    res.send(client.aboveToGeoJSON(data));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/stream/:id", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const heartbeat = setInterval(() => {
    if (!closed) res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15000);

  try {
    while (!closed) {
      const seconds = Math.min(
        300,
        Math.max(30, Number(req.query.seconds || process.env.N2YO_STREAM_WINDOW_SECONDS || 300)),
      );
      const data = await client.getPositions(
        req.params.id,
        query(req, { seconds }),
      );
      const positions = data.positions || [];

      for (const position of positions) {
        if (closed) break;
        const targetTime = position.timestamp * 1000;
        while (!closed && targetTime > Date.now()) {
          const remaining = targetTime - Date.now();
          await new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 1000)));
        }
        if (closed) break;
        if (targetTime < Date.now() - 5000) continue;
        res.write(
          `event: position\ndata: ${JSON.stringify({
            provider: "n2yo",
            domain: "orbital",
            noradId: data.info?.satid,
            name: data.info?.satname,
            ...position,
          })}\n\n`,
        );
      }
    }
  } catch (error) {
    if (!closed) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`,
      );
    }
  } finally {
    clearInterval(heartbeat);
    if (!closed) res.end();
  }
});

module.exports = router;
