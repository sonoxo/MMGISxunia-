import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const state={universe:null,layers:[],active:new Set(),mode:'universe',viewer:null,scene:null,camera:null,renderer:null,composer:null,controls:null,objects:[],worldMeshes:[],feedEntities:new Map(),observations:[],selected:null,paused:false,max:true,frames:0,lastFps:performance.now(),layerUpdatedAt:new Map(),layerAttemptAt:new Map(),refreshInFlight:new Set(),realtimeTimer:null,realtimeHudTimer:null};
const ui={boot:$('#boot'),app:$('#app'),universe:$('#universeCanvas'),cesium:$('#cesium'),systems:$('#systemList'),layers:$('#layerList'),inspector:$('#inspector'),feed:$('#intelFeed'),objectCount:$('#objectCount'),eventCount:$('#eventCount'),layerCount:$('#layerCount'),status:$('#statusText'),source:$('#sourceStatus'),fps:$('#fps'),clock:$('#clock'),title:$('#worldTitle'),kicker:$('#worldKicker'),meta:$('#worldMeta'),mode:$('#modeLabel'),lat:$('#lat'),lon:$('#lon'),alt:$('#alt'),utc:$('#utc'),timeline:$('#timelineNow'),palantir:$('#palantirState')};
const layerColors={earthquakes:'#ffb34d',fires:'#ff5b64',global_incidents:'#d871ff',maritime:'#4fd7ff',sat_military:'#e8c36b',cctv:'#81f2c0',live_news:'#ef70a6',weather:'#74a7ff',cables:'#57b9cc',sdk_sea:'#2ce5c2',sdk_air:'#98d7ff',sdk_naval:'#8d91ff'};

const realtimeCadence={
  flights:30000,
  earthquakes:60000,
  live_news:90000,
  weather:90000,
  fires:120000,
  global_incidents:120000,
  launches:300000,
  radio:300000,
  bikeshare:600000,
  datacenters:900000
};

const realtimeEligible=new Set(Object.keys(realtimeCadence));

function syncPrimaryNav(mode){
  const wanted=mode==='earth'?'LIVE EARTH':'MULTIVERSE';

  $$('.xunia-nav button[data-tab]').forEach(button=>{
    if(
      button.dataset.tab==='LIVE EARTH' ||
      button.dataset.tab==='MULTIVERSE'
    ){
      button.classList.toggle(
        'active',
        button.dataset.tab===wanted
      );
    }
  });
}

function ensureRealityHud(){
  let hud=$('#xunia-reality-hud');
  if(hud)return hud;

  const style=document.createElement('style');
  style.id='xunia-reality-style';

  style.textContent=`
    #xunia-reality-hud{
      position:absolute;
      z-index:44;
      left:14px;
      top:96px;
      min-width:320px;
      padding:9px 11px;
      box-sizing:border-box;
      border:1px solid rgba(80,215,255,.48);
      border-radius:7px;
      background:rgba(1,10,18,.92);
      box-shadow:0 0 26px rgba(54,204,255,.13);
      backdrop-filter:blur(12px);
      pointer-events:none;
      font-family:ui-monospace,SFMono-Regular,Menlo,monospace
    }

    #xunia-reality-hud .xr-mode{
      font-size:9px;
      font-weight:900;
      letter-spacing:.12em
    }

    #xunia-reality-hud .xr-detail{
      margin-top:4px;
      color:#789dad;
      font-size:7px;
      line-height:1.55
    }

    #xunia-reality-hud.synthetic{
      border-color:rgba(174,109,255,.6)
    }

    #xunia-reality-hud.synthetic .xr-mode{
      color:#c598ff
    }

    #xunia-reality-hud.earth .xr-mode{
      color:#57f1a8
    }

    #xunia-reality-hud.stale .xr-mode{
      color:#ffbf67
    }
  `;

  document.head.appendChild(style);

  hud=document.createElement('div');
  hud.id='xunia-reality-hud';

  $('.stage')?.appendChild(hud);

  return hud;
}

function formatAge(ms){
  const sec=Math.floor(ms/1000);

  if(sec<2)return 'NOW';
  if(sec<60)return `${sec}s AGO`;

  const min=Math.floor(sec/60);

  if(min<60)return `${min}m AGO`;

  return `${Math.floor(min/60)}h AGO`;
}

function updateRealityHud(){
  const hud=ensureRealityHud();

  if(!hud)return;

  hud.className='';

  if(state.mode!=='earth'){
    hud.classList.add('synthetic');

    hud.innerHTML=`
      <div class="xr-mode">
        SIMULATED MULTIVERSE
      </div>

      <div class="xr-detail">
        THREE.JS SYNTHETIC PLANETS<br>
        NOT REAL ASTRONOMICAL TELEMETRY<br>
        ORBIT MOTION = LOCAL SIMULATION
      </div>
    `;

    return;
  }

  hud.classList.add('earth');

  const feeds=[...state.active]
    .filter(id=>realtimeEligible.has(id));

  const successes=feeds
    .map(id=>state.layerUpdatedAt.get(id))
    .filter(Boolean);

  const latest=successes.length
    ? Math.max(...successes)
    : null;

  let next=null;

  for(const id of feeds){
    const base=
      state.layerUpdatedAt.get(id) ||
      state.layerAttemptAt.get(id);

    const remaining=!base
      ? 0
      : Math.max(
          0,
          realtimeCadence[id]-(Date.now()-base)
        );

    next=next===null
      ? remaining
      : Math.min(next,remaining);
  }

  const stale=
    latest &&
    Date.now()-latest > 20*60*1000;

  if(stale){
    hud.classList.add('stale');
  }

  hud.innerHTML=`
    <div class="xr-mode">
      ${stale?'EARTH DATA STALE':'EARTH AUTO-REFRESH ACTIVE'}
    </div>

    <div class="xr-detail">
      REAL-WORLD PUBLIC / AUTHORIZED SOURCES<br>
      AUTO-REFRESH FEEDS: ${feeds.length}<br>
      LAST SUCCESS: ${latest?formatAge(Date.now()-latest):'WAITING'}<br>
      NEXT POLL: ${next===null?'N/A':Math.ceil(next/1000)+'s'}
    </div>
  `;
}

function stopRealtimePolling(){
  if(state.realtimeTimer){
    clearInterval(state.realtimeTimer);
    state.realtimeTimer=null;
  }

  if(state.realtimeHudTimer){
    clearInterval(state.realtimeHudTimer);
    state.realtimeHudTimer=null;
  }
}

function startRealtimePolling(){
  stopRealtimePolling();

  updateRealityHud();

  state.realtimeHudTimer=setInterval(
    updateRealityHud,
    1000
  );

  state.realtimeTimer=setInterval(()=>{
    if(
      state.mode!=='earth' ||
      document.hidden
    ){
      return;
    }

    const now=Date.now();

    for(const id of state.active){
      if(!realtimeEligible.has(id)){
        continue;
      }

      const last=
        state.layerUpdatedAt.get(id) ||
        state.layerAttemptAt.get(id) ||
        0;

      if(
        now-last >= realtimeCadence[id]
      ){
        loadLayer(id,true);
      }
    }
  },5000);
}

const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const formatNum=n=>String(n).padStart(4,'0');

async function boot(){
  const [universe,layers]=await Promise.all([fetch('./catalog/universe.json').then(r=>r.json()),fetch('./catalog/layers.json').then(r=>r.json())]);state.universe=universe;state.layers=layers.layers;
  const qs=new URLSearchParams(location.search);const requested=(qs.get('layers')||'').split(',').filter(Boolean);for(const l of state.layers)if(requested.length?requested.includes(l.id):l.default)state.active.add(l.id);
  renderSystems();renderLayerControls();initUniverse();wire();syncPrimaryNav('universe');ensureRealityHud();updateRealityHud();tickClock();setInterval(tickClock,1000);setTimeout(()=>ui.boot.classList.add('off'),650);
  const earthRequested=qs.get('view')==='earth';if(earthRequested)enterEarth();
}

function renderSystems(){ui.systems.innerHTML=state.universe.systems.map((s,i)=>`<div class="system-card ${i===0?'active':''}" data-system="${escapeHtml(s.id)}"><b>${escapeHtml(s.name)}</b><span>${s.worlds.length} WORLDS // ${escapeHtml(s.star.name)}</span></div>`).join('');}
function renderLayerControls(){ui.layers.innerHTML=state.layers.map(l=>`<button class="layer-chip ${state.active.has(l.id)?'active':''}" data-layer="${escapeHtml(l.id)}"><b>${escapeHtml(l.label)}</b><span>${escapeHtml(l.mode)}</span></button>`).join('');updateLayerCount();}
function updateLayerCount(){ui.layerCount.textContent=`${state.active.size}/${state.layers.length}`;syncUrl();}
function syncUrl(){const q=new URLSearchParams(location.search);if(state.active.size)q.set('layers',[...state.active].join(','));else q.delete('layers');if(state.mode==='earth')q.set('view','earth');else q.delete('view');history.replaceState(null,'',`${location.pathname}?${q.toString()}`);}

function initUniverse(){
  const scene=state.scene=new THREE.Scene();scene.background=new THREE.Color(0x01040a);scene.fog=new THREE.FogExp2(0x01040a,.0016);
  const camera=state.camera=new THREE.PerspectiveCamera(52,ui.universe.clientWidth/ui.universe.clientHeight,.1,1800);camera.position.set(0,34,66);
  const renderer=state.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setSize(ui.universe.clientWidth,ui.universe.clientHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;ui.universe.appendChild(renderer.domElement);
  const controls=state.controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.045;controls.minDistance=8;controls.maxDistance=520;
  scene.add(new THREE.AmbientLight(0x5a81a0,.18));
  const composer=state.composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(ui.universe.clientWidth,ui.universe.clientHeight),1.25,.7,.18);composer.addPass(bloom);
  addStarField(scene,10000,720);
  for(const system of state.universe.systems)addSystem(system);
  renderer.domElement.addEventListener('click',pickWorld);window.addEventListener('resize',resize);
  animate();
}
function addStarField(scene,count,radius){const geo=new THREE.BufferGeometry();const a=new Float32Array(count*3);for(let i=0;i<count;i++){const r=40+Math.random()*radius;const t=Math.random()*Math.PI*2;const p=Math.acos(2*Math.random()-1);a[i*3]=r*Math.sin(p)*Math.cos(t);a[i*3+1]=r*Math.cos(p);a[i*3+2]=r*Math.sin(p)*Math.sin(t)}geo.setAttribute('position',new THREE.BufferAttribute(a,3));const mat=new THREE.PointsMaterial({color:0xa8e8ff,size:.22,sizeAttenuation:true,transparent:true,opacity:.72});scene.add(new THREE.Points(geo,mat));}
function glowMesh(radius,color){const geo=new THREE.SphereGeometry(radius,64,64);const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.09,side:THREE.BackSide,blending:THREE.AdditiveBlending});const m=new THREE.Mesh(geo,mat);m.scale.setScalar(1.2);return m;}
function addSystem(system){
  const group=new THREE.Group();group.position.fromArray(system.position||[0,0,0]);group.userData={system};state.scene.add(group);
  const star=new THREE.Mesh(new THREE.SphereGeometry(system.star.radius,64,64),new THREE.MeshStandardMaterial({color:system.star.color,emissive:system.star.color,emissiveIntensity:3,roughness:.85}));group.add(star);group.add(glowMesh(system.star.radius*1.8,system.star.color));const light=new THREE.PointLight(system.star.color,system.star.intensity||4,180,1.2);group.add(light);
  system.worlds.forEach((world,idx)=>{const orbit=new THREE.Mesh(new THREE.RingGeometry(world.orbitRadius-.02,world.orbitRadius+.02,256),new THREE.MeshBasicMaterial({color:0x2d758a,transparent:true,opacity:.28,side:THREE.DoubleSide}));orbit.rotation.x=Math.PI/2;group.add(orbit);const mat=new THREE.MeshStandardMaterial({color:world.color,roughness:.74,metalness:.08,emissive:new THREE.Color(world.color).multiplyScalar(.08)});const mesh=new THREE.Mesh(new THREE.SphereGeometry(world.radius,64,64),mat);mesh.userData={world,system,phase:idx*2.2};group.add(mesh);if(world.atmosphere)mesh.add(glowMesh(world.radius,world.atmosphere));state.worldMeshes.push(mesh);state.objects.push(mesh)});
}
function animate(){requestAnimationFrame(animate);if(!state.paused&&state.mode==='universe'){const t=performance.now()/1000;for(const m of state.worldMeshes){const w=m.userData.world,s=m.userData.system;const a=t*(w.orbitSpeed||.02)+m.userData.phase;m.position.set(Math.cos(a)*w.orbitRadius,Math.sin(a*.31)*1.4,Math.sin(a)*w.orbitRadius);m.rotation.y=t*.12}state.controls.update();state.composer.render()}fpsTick();}
function fpsTick(){state.frames++;const now=performance.now();if(now-state.lastFps>1000){ui.fps.textContent=Math.round(state.frames*1000/(now-state.lastFps));state.frames=0;state.lastFps=now;}}
function resize(){if(state.camera&&state.renderer){state.camera.aspect=ui.universe.clientWidth/ui.universe.clientHeight;state.camera.updateProjectionMatrix();state.renderer.setSize(ui.universe.clientWidth,ui.universe.clientHeight);state.composer.setSize(ui.universe.clientWidth,ui.universe.clientHeight)}if(state.viewer)state.viewer.resize();}
function pickWorld(e){if(state.mode!=='universe')return;const rect=state.renderer.domElement.getBoundingClientRect();const mouse=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(mouse,state.camera);const hit=ray.intersectObjects(state.worldMeshes,false)[0];if(!hit)return;const {world,system}=hit.object.userData;selectWorld(world,system);if(world.renderMode==='cesium-earth')setTimeout(enterEarth,320);}
function selectWorld(world,system){state.selected={type:'World',...world,systemId:system.id};ui.kicker.textContent=`SYSTEM // ${system.name}`;ui.title.textContent=world.name;ui.meta.textContent=(world.description||'').toUpperCase();inspect(state.selected);}

async function enterEarth(){
  if(state.mode==='earth'){
    syncPrimaryNav('earth');
    startRealtimePolling();
    updateRealityHud();
    return;
  }

  state.mode='earth';

  ui.app.classList.remove('is-universe');
  ui.universe.classList.add('hidden');
  ui.cesium.classList.remove('hidden');

  ui.mode.textContent='LIVE EARTH';
  ui.kicker.textContent='XUNIA // LIVE PLANET';
  ui.title.textContent='EARTH // REAL-WORLD DATA';
  ui.meta.textContent='PUBLIC + AUTHORIZED DATA // AUTO-REFRESHED SOURCE SNAPSHOTS';

  $('#earthBtn').classList.add('active');
  $('#universeBtn').classList.remove('active');

  syncPrimaryNav('earth');
  syncUrl();

  if(!state.viewer){
    initCesium();
  }

  await refreshActiveLayers();

  startRealtimePolling();
  updateRealityHud();
}

function enterUniverse(){
  state.mode='universe';

  stopRealtimePolling();

  ui.cesium.classList.add('hidden');
  ui.universe.classList.remove('hidden');

  ui.mode.textContent='MULTIVERSE';
  ui.kicker.textContent='SYSTEM // XUNIA PRIME';
  ui.title.textContent='XUNIA PRIME';
  ui.meta.textContent='SYNTHETIC MULTIVERSE // SIMULATED ORBITS // NOT REAL TELEMETRY';

  $('#universeBtn').classList.add('active');
  $('#earthBtn').classList.remove('active');

  syncPrimaryNav('universe');
  syncUrl();
  updateRealityHud();
}

function initCesium(){
  Cesium.Ion.defaultAccessToken='';const viewer=state.viewer=new Cesium.Viewer('cesium',{baseLayer:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,vrButton:false,selectionIndicator:true,infoBox:false,shouldAnimate:true,terrainProvider:new Cesium.EllipsoidTerrainProvider()});window.__XUNIA_VIEWER__=viewer;window.__XUNIA_VIEWER_READY__=true;window.dispatchEvent(new CustomEvent('xunia:viewer-ready',{detail:viewer}));
  viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',credit:'© OpenStreetMap contributors',maximumLevel:19}));viewer.scene.globe.enableLighting=true;viewer.scene.globe.showGroundAtmosphere=true;viewer.scene.highDynamicRange=true;viewer.scene.postProcessStages.fxaa.enabled=true;viewer.resolutionScale=Math.min(devicePixelRatio,1.75);viewer.scene.skyAtmosphere.show=true;viewer.camera.flyHome(0);
  const handler=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);handler.setInputAction(click=>{const picked=viewer.scene.pick(click.position);if(picked?.id?.properties){const p={};for(const k of picked.id.properties.propertyNames||[])p[k]=picked.id.properties[k].getValue(Cesium.JulianDate.now());inspect({type:'Observation',...p});}const cart=viewer.camera.pickEllipsoid(click.position,viewer.scene.globe.ellipsoid);if(cart){const c=Cesium.Cartographic.fromCartesian(cart);ui.lat.textContent=Cesium.Math.toDegrees(c.latitude).toFixed(4);ui.lon.textContent=Cesium.Math.toDegrees(c.longitude).toFixed(4)}},Cesium.ScreenSpaceEventType.LEFT_CLICK);
  viewer.camera.changed.addEventListener(()=>{const c=viewer.camera.positionCartographic;ui.alt.textContent=`${Math.round(c.height/1000)} km`;ui.lat.textContent=Cesium.Math.toDegrees(c.latitude).toFixed(4);ui.lon.textContent=Cesium.Math.toDegrees(c.longitude).toFixed(4)});viewer.camera.percentageChanged=.02;
}

async function refreshActiveLayers(){for(const id of state.active)await loadLayer(id);refreshCounts();}
async function loadLayer(id,force=false){
  if(id==='day_night'){
    if(state.viewer){
      state.viewer.scene.globe.enableLighting=true;
    }

    return;
  }

  if(
    ['cables','sdk_sea','sdk_air','sdk_naval']
      .includes(id)
  ){
    setSource(
      `ADAPTER ${id.toUpperCase()} READY`
    );

    return;
  }

  if(state.refreshInFlight.has(id)){
    return;
  }

  if(
    state.feedEntities.has(id) &&
    !force
  ){
    return;
  }

  const chip=
    $(`[data-layer="${id}"]`);

  state.refreshInFlight.add(id);
  state.layerAttemptAt.set(id,Date.now());

  try{
    chip?.classList.remove('error');

    setSource(
      `${force?'REFRESHING':'LOADING'} ${id.toUpperCase()}`
    );

    const response=await fetch(
      `/api/feed?id=${encodeURIComponent(id)}&t=${Date.now()}`,
      {
        cache:'no-store'
      }
    );

    if(!response.ok){
      let reason=`HTTP ${response.status}`;

      try{
        reason=
          (await response.json()).error ||
          reason;
      }catch(_){}

      throw new Error(reason);
    }

    const geo=
      await response.json();

    const features=
      (geo.features||[])
      .filter(
        f=>
          f.geometry?.type==='Point'
      );

    const oldEntities=
      state.feedEntities.get(id) ||
      [];

    /*
      New upstream response is already valid here.
      Only now replace the previous good snapshot.
    */
    for(const entity of oldEntities){
      state.viewer?.entities.remove(entity);
    }

    state.feedEntities.delete(id);

    state.observations=
      state.observations.filter(
        observation=>
          observation.layerId!==id
      );

    const group=[];
    const observations=[];

    for(const feature of features){
      const [lon,lat]=
        feature.geometry.coordinates;

      const props=
        feature.properties || {};

      const title=
        props.title ||
        props.name ||
        props.callsign ||
        props.id ||
        props._feed ||
        id;

      const severity=
        String(
          props.severity ||
          props.mag ||
          'info'
        );

      const color=
        Cesium.Color.fromCssColorString(
          layerColors[id] ||
          '#66e4ff'
        );

      const entity=
        state.viewer.entities.add({
          position:
            Cesium.Cartesian3.fromDegrees(
              Number(lon),
              Number(lat),
              1000
            ),

          point:{
            pixelSize:
              id==='earthquakes'
                ? Math.min(
                    18,
                    7+
                    Number(props.mag||0)*1.7
                  )
                : 8,

            color,
            outlineColor:
              Cesium.Color.BLACK,
            outlineWidth:1,
            disableDepthTestDistance:
              5e7
          },

          properties:{
            ...props,
            layerId:id,
            source:
              props.source || id,
            title,
            latitude:lat,
            longitude:lon,
            severity
          }
        });

      group.push(entity);

      observations.push({
        observationId:
          `${id}:${props.id || props.eventId || `${lat}:${lon}:${title}`}`,

        type:'Observation',
        layerId:id,
        title:String(title),
        latitude:Number(lat),
        longitude:Number(lon),
        severity:String(severity),

        observedAt:
          props.date ||
          props.time ||
          props.updated ||
          new Date().toISOString(),

        source:
          props.source || id,

        provenance:
          props.url ||
          props.link ||
          'public-feed'
      });
    }

    state.feedEntities.set(id,group);

    state.observations.unshift(
      ...observations
    );

    if(state.observations.length>500){
      state.observations.length=500;
    }

    const refreshedAt=
      Date.now();

    state.layerUpdatedAt.set(
      id,
      refreshedAt
    );

    refreshFeed();
    refreshCounts();
    updateRealityHud();

    setSource(
      `${id.toUpperCase()} ${group.length} OBJECTS · REFRESH ${new Date(refreshedAt).toLocaleTimeString()}`
    );

    window.dispatchEvent(
      new CustomEvent(
        'xunia:feed-refreshed',
        {
          detail:{
            id,
            count:group.length,
            refreshedAt:
              new Date(refreshedAt)
              .toISOString()
          }
        }
      )
    );

  }catch(error){
    chip?.classList.add('error');

    setSource(
      `${id.toUpperCase()} REFRESH FAILED · LAST GOOD SNAPSHOT RETAINED`
    );

    console.warn(
      '[XUNIA FEED]',
      id,
      error
    );

  }finally{
    state.refreshInFlight.delete(id);
    updateRealityHud();
  }
}

function unloadLayer(id){for(const e of state.feedEntities.get(id)||[])state.viewer?.entities.remove(e);state.feedEntities.delete(id);state.layerUpdatedAt.delete(id);state.layerAttemptAt.delete(id);state.observations=state.observations.filter(o=>o.layerId!==id);refreshFeed();refreshCounts();updateRealityHud();if(id==='day_night'&&state.viewer)state.viewer.scene.globe.enableLighting=false;}
function pushObservation(layerId,title,lat,lon,severity,props){const o={observationId:`${layerId}:${props.id||props.eventId||crypto.randomUUID()}`,type:'Observation',layerId,title:String(title),latitude:Number(lat),longitude:Number(lon),severity:String(severity),observedAt:props.date||props.time||props.updated||new Date().toISOString(),source:props.source||layerId,provenance:props.url||props.link||'public-feed'};state.observations.unshift(o);if(state.observations.length>500)state.observations.length=500;refreshFeed();}
function refreshFeed(){ui.feed.innerHTML=state.observations.slice(0,24).map((o,i)=>`<div class="intel-item ${/high|critical|severe|5|6|7/.test(o.severity)?'severe':''}" data-observation="${i}"><b>${escapeHtml(o.title)}</b><span>${escapeHtml(o.layerId.toUpperCase())} // ${Number(o.latitude).toFixed(2)}, ${Number(o.longitude).toFixed(2)} // ${escapeHtml(o.observedAt)}</span></div>`).join('')||'<div class="empty-state"><b>NO LIVE EVENTS</b><span>Activate Earth layers.</span></div>';ui.eventCount.textContent=`${state.observations.length} EVENTS`;}
function refreshCounts(){let n=state.mode==='universe'?state.worldMeshes.length:[...state.feedEntities.values()].reduce((a,b)=>a+b.length,0);ui.objectCount.textContent=formatNum(n);}
function inspect(obj){state.selected=obj;const entries=Object.entries(obj).filter(([k,v])=>!['type'].includes(k)&&v!=null&&typeof v!=='object').slice(0,16);ui.inspector.innerHTML=`<div class="object-type">${escapeHtml(obj.type||'OBJECT')}</div><div class="object-name">${escapeHtml(obj.name||obj.title||obj.id||'OBJECT')}</div>${entries.map(([k,v])=>`<div class="kv"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}`;}
function setSource(t){ui.source.textContent=t;}

function wire(){
  $('#earthBtn').onclick=enterEarth;$('#universeBtn').onclick=enterUniverse;$('#maxBtn').onclick=()=>{state.max=!state.max;ui.app.classList.toggle('max-render',state.max);if(state.renderer)state.renderer.setPixelRatio(Math.min(devicePixelRatio,state.max?2:1.25));if(state.viewer)state.viewer.resolutionScale=Math.min(devicePixelRatio,state.max?1.75:1)};
  ui.layers.addEventListener('click',async e=>{const b=e.target.closest('[data-layer]');if(!b)return;const id=b.dataset.layer;if(state.active.has(id)){state.active.delete(id);b.classList.remove('active');unloadLayer(id)}else{state.active.add(id);b.classList.add('active');if(state.mode==='earth')await loadLayer(id)}updateLayerCount();});
  ui.systems.addEventListener('click',e=>{const c=e.target.closest('[data-system]');if(!c)return;$$('.system-card').forEach(x=>x.classList.remove('active'));c.classList.add('active');const s=state.universe.systems.find(x=>x.id===c.dataset.system);const g=state.scene.children.find(x=>x.userData?.system?.id===s.id);if(g){const p=g.position;state.controls.target.copy(p);state.camera.position.set(p.x+34,p.y+25,p.z+48)}});
  ui.feed.addEventListener('click',e=>{const item=e.target.closest('[data-observation]');if(!item)return;const o=state.observations[Number(item.dataset.observation)];if(o){inspect(o);state.viewer?.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(o.longitude,o.latitude,2200000)})}});
  $('#pauseBtn').onclick=()=>{state.paused=!state.paused;$('#pauseBtn').textContent=state.paused?'▶':'Ⅱ';if(state.viewer)state.viewer.clock.shouldAnimate=!state.paused};$('#homeBtn').onclick=()=>state.mode==='earth'?state.viewer?.camera.flyHome(1.2):(state.controls.target.set(0,0,0),state.camera.position.set(0,34,66));
  $('#overlayBtn').onclick=loadAuthorizedOverlay;$('#exportBtn').onclick=exportOntology;
  window.addEventListener('keydown',e=>{if(e.key==='Escape')enterUniverse();if(e.key.toLowerCase()==='e'){const b=$('[data-layer="earthquakes"]');b?.click()}if(e.key.toLowerCase()==='d'){const b=$('[data-layer="day_night"]');b?.click()}});
}
async function loadAuthorizedOverlay(){const url=$('#overlayUrl').value.trim();if(!url)return;try{const r=await fetch(url);if(!r.ok)throw new Error(`HTTP ${r.status}`);const geo=await r.json();const ds=await Cesium.GeoJsonDataSource.load(geo,{stroke:Cesium.Color.CYAN,fill:Cesium.Color.CYAN.withAlpha(.18),markerColor:Cesium.Color.CYAN,clampToGround:true});state.viewer.dataSources.add(ds);setSource(`AUTHORIZED OVERLAY ${ds.entities.values.length} OBJECTS`)}catch(e){setSource(`OVERLAY ERROR: ${e.message}`)}}
function exportOntology(){const payload={schema:'xuniaverse-ontology-snapshot-v1',exportedAt:new Date().toISOString(),mode:state.mode,world:state.selected?.type==='World'?state.selected:null,feeds:state.layers.map(l=>({feedId:l.id,label:l.label,mode:l.mode,active:state.active.has(l.id),count:state.feedEntities.get(l.id)?.length||0})),observations:state.observations};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`xuniaverse-ontology-${Date.now()}.json`;a.click();URL.revokeObjectURL(a.href);}
function tickClock(){const d=new Date();ui.clock.textContent=d.toISOString().slice(11,19)+'Z';ui.utc.textContent=d.toISOString().slice(11,19);ui.timeline.textContent=d.toISOString().replace('T',' ').slice(0,19)+'Z';}
boot().catch(e=>{console.error(e);ui.status.textContent='BOOT ERROR';setSource(e.message);ui.boot.classList.add('off')});
