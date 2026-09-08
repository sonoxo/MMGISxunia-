import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const PORT=Number(process.env.PORT||4173);
const OSIRIS_UPSTREAM=(process.env.OSIRIS_UPSTREAM||'https://osirisai.live').replace(/\/$/,'');
const ALLOW_OSIRIS=process.env.ALLOW_OSIRIS_UPSTREAM!=='false';
const GITHUB_OWNER=process.env.GITHUB_OWNER||'sonoxo';
const GITHUB_TOKEN=process.env.GITHUB_TOKEN||'';
const cache=new Map();
const passiveRoutes={maritime:'/api/maritime',satellites:'/api/satellites',cctv:'/api/cctv',news:'/api/news',weather:'/api/weather'};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};

function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));}
function normalizeGeo(raw,feed){
  if(raw?.type==='FeatureCollection'&&Array.isArray(raw.features))return raw;
  let arr=Array.isArray(raw)?raw:raw?.data||raw?.items||raw?.features||raw?.results||raw?.cameras||raw?.vessels||raw?.flights||raw?.satellites||raw?.streams||[];
  if(!Array.isArray(arr))arr=[];
  const features=[];
  for(const item of arr){
    if(item?.type==='Feature'&&item.geometry){features.push(item);continue;}
    const lat=Number(item?.lat??item?.latitude??item?.position?.lat??item?.location?.lat);
    const lon=Number(item?.lon??item?.lng??item?.longitude??item?.position?.lon??item?.position?.lng??item?.location?.lon??item?.location?.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    features.push({type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{...item,_feed:feed}});
  }
  return {type:'FeatureCollection',features};
}
async function cachedFetch(key,url,ttl=60000,headers={}){
  const hit=cache.get(key);if(hit&&Date.now()-hit.at<ttl)return hit.data;
  const r=await fetch(url,{headers:{'user-agent':'XUNIAverse-Planetary-Forge/1.0',accept:'application/vnd.github+json',...headers}});if(!r.ok)throw new Error(`upstream ${r.status}`);
  const data=await r.json();cache.set(key,{at:Date.now(),data});return data;
}
async function feed(req,res,url){
  const id=url.searchParams.get('id');
  try{
    if(id==='earthquakes'){
      const raw=await cachedFetch(id,'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',60000);return json(res,200,raw);
    }
    if(id==='fires'||id==='incidents'){
      const raw=await cachedFetch('eonet','https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200',120000);
      const features=[];for(const e of raw.events||[]){const isFire=(e.categories||[]).some(c=>/wildfire/i.test(c.title));if(id==='fires'&&!isFire)continue;const g=e.geometry?.at(-1);if(!g||g.type!=='Point')continue;features.push({type:'Feature',geometry:g,properties:{title:e.title,category:e.categories?.[0]?.title||'Event',date:g.date,source:e.sources?.[0]?.url||'NASA EONET',severity:isFire?'high':'info',_feed:id}})}
      return json(res,200,{type:'FeatureCollection',features});
    }
    const route=passiveRoutes[id];if(!route)return json(res,404,{error:'unknown feed'});
    if(!ALLOW_OSIRIS)return json(res,503,{error:'OSIRIS passive upstream disabled'});
    const raw=await cachedFetch(`osiris:${id}`,`${OSIRIS_UPSTREAM}${route}`,90000);return json(res,200,normalizeGeo(raw,id));
  }catch(error){return json(res,502,{error:error.message,feed:id});}
}
function githubHeaders(){return GITHUB_TOKEN?{authorization:`Bearer ${GITHUB_TOKEN}`}:{}}
function repoDomain(repo){const n=(repo.name||'').toLowerCase();if(/xunia|zyra|gpt-doug|aip|ontology|agent|llm|ai/.test(n))return'AI & ONTOLOGY';if(/nasa|space|mmgis|earth|vicar|fprime|spacex|godot|god.?s-eye/.test(n))return'SPACE & PLANETARY';if(/cyber|secure|pentest|privacy|ghidra|tracker|gargoyle/.test(n))return'SECURITY';if(/sound|music|almighty|media/.test(n))return'CREATIVE';if(/xrpl|ripple|token|xmr|crypto/.test(n))return'ECONOMY';if(/house|crm|network|cloud|tofu|infra/.test(n))return'INFRASTRUCTURE';return'GENERAL R&D'}
function eraFor(score){if(score>=1200)return'INTERSTELLAR';if(score>=700)return'PLANETARY';if(score>=350)return'NETWORKED';if(score>=150)return'INDUSTRIAL';if(score>=60)return'DIGITAL';return'FOUNDATION'}
async function githubState(res){
  try{
    const headers=githubHeaders();
    let repos=[];
    for(let page=1;page<=4;page++){
      const url=GITHUB_TOKEN?`https://api.github.com/user/repos?affiliation=owner&per_page=100&page=${page}&sort=updated`:`https://api.github.com/users/${encodeURIComponent(GITHUB_OWNER)}/repos?per_page=100&page=${page}&sort=updated`;
      const batch=await cachedFetch(`gh:repos:${page}:${Boolean(GITHUB_TOKEN)}`,url,180000,headers);repos.push(...batch);if(batch.length<100)break;
    }
    repos=repos.filter(r=>r.owner?.login?.toLowerCase()===GITHUB_OWNER.toLowerCase());
    const colonies=repos.map(r=>{const base=20+Math.min(120,Math.round((r.size||0)/5000))+Math.min(80,(r.stargazers_count||0)*4)+Math.min(80,(r.forks_count||0)*3)+(r.fork?4:18)+(r.archived?-10:0);return{id:r.id,name:r.name,fullName:r.full_name,domain:repoDomain(r),visibility:r.private?'private':'public',fork:r.fork,stars:r.stargazers_count||0,forks:r.forks_count||0,size:r.size||0,updatedAt:r.updated_at,url:r.html_url,score:Math.max(1,base)}});
    const totalScore=colonies.reduce((a,c)=>a+c.score,0);const domains={};for(const c of colonies){domains[c.domain]=(domains[c.domain]||0)+c.score}
    const techTree=Object.entries(domains).map(([name,score])=>({name,score,level:Math.max(1,Math.floor(Math.sqrt(score)/4))})).sort((a,b)=>b.score-a.score);
    return json(res,200,{owner:GITHUB_OWNER,generatedAt:new Date().toISOString(),authenticated:Boolean(GITHUB_TOKEN),repositoryCount:colonies.length,totalScore,era:eraFor(totalScore),colonies,techTree,rules:{repoCreated:'+20',ownedOriginalRepo:'+18',forkBase:'+4',size:'up to +120',stars:'+4 each up to +80',forks:'+3 each up to +80',archived:'-10'}});
  }catch(error){return json(res,502,{error:error.message,owner:GITHUB_OWNER});}
}

http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/api/feed')return feed(req,res,url);
  if(req.method==='GET'&&url.pathname==='/api/github/state')return githubState(res);
  if(req.method==='GET'&&url.pathname==='/api/palantir/status')return json(res,200,{live:process.env.PALANTIR_LIVE==='true',writes:process.env.PALANTIR_WRITE_ENABLED==='true',mode:'architecture-and-export-adapter'});
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'read-only server'});
  let path=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);path=normalize(path).replace(/^(\.\.(\/|\\|$))+/, '');
  const file=join(ROOT,path);if(!file.startsWith(ROOT))return json(res,403,{error:'forbidden'});
  try{const s=await stat(file);if(!s.isFile())throw new Error('not-file');const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':extname(file)==='.html'?'no-store':'public, max-age=300','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'});if(req.method==='HEAD')return res.end();res.end(body)}catch{json(res,404,{error:'not found'})}
}).listen(PORT,()=>console.log(`XUNIAverse Planetary Forge -> http://localhost:${PORT}`));
