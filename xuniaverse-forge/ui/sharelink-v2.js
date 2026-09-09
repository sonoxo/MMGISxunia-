const DEFAULT_HASH='v=2&lat=30.2672&lon=-97.7431&alt=600&heading=15&pitch=-30&roll=360&style=normal&bloom=0&sharpen=1&bi=0&bv=2&si=49&hud=tactical&hv=1&dm=DENSE&dd=75&da=elastic&kf=7&ko=1&cr=0&sc=1&scf=11&map=osm&l=&lo=f.e.1&ui=c.c.1_c.p.0_l.c.1_l.p.0_d.c.1_v.c.1_r.c.1_s.c.1_g.c.1_p.c.1_m.c.0';

const SAFE_LAYER_TOKEN_TO_ID=Object.freeze({
  a:'maritime',
  b:'bikeshare',
  c:'cctv',
  d:'datacenters',
  e:'earthquakes',
  f:'flights',
  r:'radio',
  s:'sat_military',
  t:'traffic',
  x:'launches',
});
const SAFE_LAYER_ID_TO_TOKEN=Object.freeze(Object.fromEntries(Object.entries(SAFE_LAYER_TOKEN_TO_ID).map(([k,v])=>[v,k])));
const SENSOR_STYLE=new Set(['normal','crt','nvg','flir','iron','noir','snow']);
const state={viewer:null,params:null,map:'osm',restoring:false,rollRequested:360,timer:null};

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const num=(p,k,f)=>{const n=Number(p.get(k));return Number.isFinite(n)?n:f};
const on=(p,k,f=false)=>p.has(k)?p.get(k)==='1':f;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function installLayoutStyles(){
  if($('#gevV2Styles'))return;
  const style=document.createElement('style');
  style.id='gevV2Styles';
  style.textContent=`
    body.gev-v2-hud .stage{box-shadow:inset 0 0 110px rgba(35,205,255,.08),0 0 90px rgba(0,0,0,.55)}
    body.gev-v2-sharpen #cesium:not(.sup-crt):not(.sup-nvg):not(.sup-flir):not(.sup-iron):not(.sup-noir):not(.sup-snow){filter:contrast(1.08) saturate(1.025)}
    body.gev-v2-ring .stage:before{content:"";position:absolute;z-index:3;left:50%;top:50%;width:min(64vw,720px);aspect-ratio:1;border:1px solid rgba(102,228,255,.24);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 40px rgba(102,228,255,.08)}
    body.gev-v2-panel-l-collapsed .coordinates,body.gev-v2-panel-l-collapsed .timeline{opacity:0;pointer-events:none}
    body.gev-v2-panel-s-collapsed .stage-banner{display:none}
    body.gev-v2-panel-g-collapsed .top-metrics{display:none}
    body.gev-v2-panel-p-collapsed .bottom-command{display:none!important}
    body.gev-v2-panel-m-open .sup-sensor{display:flex!important}
  `;
  document.head.appendChild(style);
}

function parsePanelState(raw){
  const out={};
  for(const item of String(raw||'').split('_')){
    const [token,field,value,...extra]=item.split('.');
    if(extra.length||!token||!field||(value!=='0'&&value!=='1'))continue;
    out[token]??={};out[token][field]=value==='1';
  }
  return out;
}

function applyPanelState(params){
  const panel=parsePanelState(params.get('ui'));
  const app=$('#app');
  const left=panel.c?.c===true;
  const right=panel.d?.c===true;
  $('.rail-left')?.toggleAttribute('hidden',left);
  $('.rail-right')?.toggleAttribute('hidden',right);
  if(app)app.style.gridTemplateColumns=`${left?'0':'292px'} 1fr ${right?'0':'330px'}`;
  document.body.classList.toggle('gev-v2-panel-l-collapsed',panel.l?.c===true);
  document.body.classList.toggle('gev-v2-panel-s-collapsed',panel.s?.c===true);
  document.body.classList.toggle('gev-v2-panel-g-collapsed',panel.g?.c===true);
  document.body.classList.toggle('gev-v2-panel-p-collapsed',panel.p?.c===true);
  document.body.classList.toggle('gev-v2-panel-m-open',panel.m?.c===false);
}

function currentParams(){
  const raw=location.hash.startsWith('#')?location.hash.slice(1):'';
  return new URLSearchParams(raw||DEFAULT_HASH);
}

function normalizeInitialHash(){
  const p=currentParams();
  if(p.get('v')!=='2'||!Number.isFinite(Number(p.get('lat')))||!Number.isFinite(Number(p.get('lon')))){
    history.replaceState(null,'',`${location.pathname}#${DEFAULT_HASH}`);
    return new URLSearchParams(DEFAULT_HASH);
  }
  if(!location.hash)history.replaceState(null,'',`${location.pathname}#${p.toString()}`);
  return p;
}

function applyVisualState(params){
  const style=(params.get('style')||'normal').toLowerCase();
  const sensor=SENSOR_STYLE.has(style)?style:'normal';
  const sensorButton=$(`[data-sensor="${sensor}"]`);
  if(sensorButton&&!sensorButton.classList.contains('active'))sensorButton.click();

  const dense=(params.get('dm')||'OFF').toUpperCase()!=='OFF';
  const detect=$('#supDetect');
  if(detect&&detect.classList.contains('active')!==dense)detect.click();

  const scope=on(params,'sc',true);
  const scopeButton=$('#supScope');
  if(scopeButton&&scopeButton.classList.contains('active')!==scope)scopeButton.click();

  const hudVisible=on(params,'hv',true);
  document.body.classList.toggle('sup-hud-off',!hudVisible);
  document.body.classList.toggle('gev-v2-hud',hudVisible);
  document.body.dataset.hudVariant=params.get('hud')||'tactical';
  document.body.classList.toggle('gev-v2-sharpen',on(params,'sharpen',false));
  document.body.classList.toggle('gev-v2-ring',on(params,'cr',false));
  document.documentElement.style.setProperty('--gev-detection-density',String(clamp(num(params,'dd',50),0,100)));
  document.documentElement.style.setProperty('--gev-scope-feather',`${clamp(num(params,'scf',11),0,100)}%`);
  document.documentElement.style.setProperty('--gev-keyhole-fade',`${clamp(num(params,'kf',7),0,40)}%`);
  document.documentElement.style.setProperty('--gev-outside-opacity',String(clamp(num(params,'ko',1),0,100)/100));
  applyPanelState(params);
}

function applyMapState(params){
  state.map=(params.get('map')||'osm').toLowerCase();
  if(state.map==='osm')return;
  if(state.map==='satellite')$('#supBasemap')?.click();
}

function applySafeLayers(params){
  if(params.get('v')!=='2'||!params.has('l'))return;
  const enabled=new Set(String(params.get('l')||'').split('').filter(t=>SAFE_LAYER_TOKEN_TO_ID[t]));
  for(const [token,id] of Object.entries(SAFE_LAYER_TOKEN_TO_ID)){
    const button=$(`[data-layer="${id}"]`);
    if(!button)continue;
    const should=enabled.has(token);
    const active=button.classList.contains('active');
    if(active!==should)button.click();
  }
  const lo=String(params.get('lo')||'');
  document.body.dataset.layerOptions=lo;
}

function applyCamera(params){
  const v=state.viewer;if(!v)return;
  const lat=num(params,'lat',30.2672),lon=num(params,'lon',-97.7431),alt=Math.max(10,num(params,'alt',600));
  const heading=num(params,'heading',15),pitch=num(params,'pitch',-30),roll=num(params,'roll',360);
  state.rollRequested=roll;
  v.camera.setView({
    destination:Cesium.Cartesian3.fromDegrees(lon,lat,alt),
    orientation:{heading:Cesium.Math.toRadians(heading),pitch:Cesium.Math.toRadians(pitch),roll:Cesium.Math.toRadians(roll)},
  });
  v.scene?.requestRender?.();
}

function enforceDetectionDensity(){
  const layer=$('#supDetection');if(!layer)return;
  const apply=()=>{
    const pct=clamp(num(state.params||currentParams(),'dd',75),0,100);
    const boxes=[...layer.children];
    const max=Math.round(72*pct/100);
    boxes.forEach((box,i)=>{box.style.display=i<max?'':'none'});
  };
  new MutationObserver(apply).observe(layer,{childList:true});
  apply();
}

function cameraSnapshot(params){
  const v=state.viewer;if(!v)return params;
  const c=v.camera.positionCartographic;if(!c)return params;
  const deg=Cesium.Math.toDegrees;
  params.set('lat',deg(c.latitude).toFixed(4));
  params.set('lon',deg(c.longitude).toFixed(4));
  params.set('alt',String(Math.max(0,Math.round(c.height))));
  params.set('heading',String(Math.round(deg(v.camera.heading))));
  params.set('pitch',String(Math.round(deg(v.camera.pitch))));
  let roll=Math.round(deg(v.camera.roll));
  if(Math.abs(roll)<=1&&Math.abs(state.rollRequested-360)<=1)roll=360;
  params.set('roll',String(roll));
  return params;
}

function encodeSafeLayers(params){
  const tokens=[];
  for(const [id,token] of Object.entries(SAFE_LAYER_ID_TO_TOKEN)){
    if($(`[data-layer="${id}"]`)?.classList.contains('active'))tokens.push(token);
  }
  params.set('l',tokens.sort().join(''));
}

function canonicalParams(){
  const base=new URLSearchParams(state.params||DEFAULT_HASH);
  base.set('v','2');
  cameraSnapshot(base);
  const activeSensor=$$('[data-sensor]').find(b=>b.classList.contains('active'))?.dataset.sensor||'normal';
  base.set('style',activeSensor);
  base.set('hv',document.body.classList.contains('sup-hud-off')?'0':'1');
  base.set('dm',$('#supDetect')?.classList.contains('active')?(base.get('dm')||'DENSE'):'OFF');
  base.set('sc',$('#supScope')?.classList.contains('active')?'1':'0');
  base.set('map',state.map||base.get('map')||'osm');
  encodeSafeLayers(base);
  const ordered=['v','lat','lon','alt','heading','pitch','roll','style','bloom','sharpen','bi','bv','si','hud','hv','dm','dd','da','kf','ko','cr','sc','scf','sce','map','l','lo','ui','sp','at'];
  const out=new URLSearchParams();
  for(const key of ordered)if(base.has(key))out.set(key,base.get(key));
  for(const [key,value] of base)if(!out.has(key))out.set(key,value);
  return out;
}

function writeHash(){
  if(state.restoring||!state.viewer)return;
  clearTimeout(state.timer);
  state.timer=setTimeout(()=>{
    const p=canonicalParams();
    state.params=p;
    history.replaceState(null,'',`${location.pathname}#${p.toString()}`);
  },180);
}

async function copyShareLink(){
  const p=canonicalParams();
  p.set('at',String(Math.floor(Date.now()/1000)));
  const url=`${location.origin}${location.pathname}#${p.toString()}`;
  try{await navigator.clipboard.writeText(url);$('#supToast')&&(($('#supToast').textContent='V2 SHARE LINK COPIED'),$('#supToast').classList.add('show'))}catch{prompt('Copy share link',url)}
}

function wireStateChanges(){
  document.addEventListener('click',e=>{
    const target=e.target.closest?.('button,[data-layer],[data-sensor]');if(!target)return;
    if(target.id==='supShare'){
      e.preventDefault();e.stopImmediatePropagation();copyShareLink();return;
    }
    if(target.id==='supBasemap')state.map=state.map==='osm'?'satellite':'osm';
    setTimeout(writeHash,0);
  },true);
  window.addEventListener('keyup',()=>setTimeout(writeHash,0));
  window.addEventListener('hashchange',()=>{
    state.params=currentParams();
    state.restoring=true;
    applyVisualState(state.params);applyPanelState(state.params);applySafeLayers(state.params);applyCamera(state.params);
    setTimeout(()=>{state.restoring=false;writeHash()},50);
  });
}

function attach(viewer){
  if(!viewer||state.viewer===viewer)return;
  state.viewer=viewer;
  state.params=normalizeInitialHash();
  state.restoring=true;
  applyVisualState(state.params);
  applyMapState(state.params);
  applySafeLayers(state.params);
  applyCamera(state.params);
  setTimeout(()=>applySafeLayers(state.params),500);
  setTimeout(()=>applySafeLayers(state.params),1600);
  enforceDetectionDensity();
  viewer.camera.changed.addEventListener(writeHash);
  setTimeout(()=>{
    state.restoring=false;
    const p=canonicalParams();state.params=p;
    history.replaceState(null,'',`${location.pathname}#${p.toString()}`);
  },100);
}

installLayoutStyles();
normalizeInitialHash();
wireStateChanges();
window.addEventListener('xunia:viewer-ready',e=>attach(e.detail));
if(window.__XUNIA_VIEWER__)attach(window.__XUNIA_VIEWER__);
window.__XUNIA_SHARELINK_V2__={defaultHash:DEFAULT_HASH,current:()=>canonicalParams().toString()};
