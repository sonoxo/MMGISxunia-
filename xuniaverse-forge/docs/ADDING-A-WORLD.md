# Adding a world

Edit `catalog/universe.json`. Every system owns a star and a list of worlds.

```json
{
  "id":"my-system",
  "name":"MY SYSTEM",
  "position":[45,10,-30],
  "star":{"name":"MY STAR","radius":5,"color":"#88ddff","intensity":5},
  "worlds":[{
    "id":"my-world","name":"MY WORLD","kind":"planet","radius":2.4,"orbitRadius":16,"orbitSpeed":0.03,"color":"#a06cff","atmosphere":"#ddc8ff","description":"A world owned by this fork."
  }]
}
```

Use `renderMode: "cesium-earth"` only for an Earth-like world that should enter the real geospatial globe. Ordinary worlds remain synthetic Three.js planets.

Run `npm run validate` before committing. IDs must be unique across all systems and worlds.
