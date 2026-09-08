import { readFile } from 'node:fs/promises';
const universe=JSON.parse(await readFile(new URL('./catalog/universe.json',import.meta.url),'utf8'));
const layers=JSON.parse(await readFile(new URL('./catalog/layers.json',import.meta.url),'utf8'));
const errors=[];const ids=new Set();
if(!universe.id||!universe.name||!Array.isArray(universe.systems)||!universe.systems.length)errors.push('universe requires id, name and systems');
for(const system of universe.systems||[]){if(ids.has(system.id))errors.push(`duplicate id ${system.id}`);ids.add(system.id);if(!system.star||!Array.isArray(system.worlds))errors.push(`system ${system.id} missing star/worlds`);for(const world of system.worlds||[]){if(ids.has(world.id))errors.push(`duplicate id ${world.id}`);ids.add(world.id);for(const n of ['radius','orbitRadius'])if(!Number.isFinite(world[n])||world[n]<=0)errors.push(`${world.id}.${n} must be > 0`)}}
const layerIds=new Set();for(const layer of layers.layers||[]){if(layerIds.has(layer.id))errors.push(`duplicate layer ${layer.id}`);layerIds.add(layer.id);if(!layer.label||!layer.mode)errors.push(`layer ${layer.id} missing label/mode`)}
if(errors.length){console.error(errors.map(e=>`ERROR: ${e}`).join('\n'));process.exit(1)}console.log(`OK: ${universe.systems.length} systems, ${[...ids].length-universe.systems.length} worlds, ${layerIds.size} layers`);
