(() => {
  'use strict';
  const C=window.Cesium,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const state={viewer:null,commands:0,pane:null};

  function emit(viewer){
    if(!viewer)return;
    state.viewer=viewer;
    window.__XUNIA_VIEWER__=viewer;
    window.__XUNIA_VIEWER_READY__=true;
    window.dispatchEvent(new CustomEvent('xunia:viewer-ready',{detail:viewer}));
  }

  if(C?.Viewer&&!window.__XUNIA_VIEWER_BRIDGE__){
    const Original=C.Viewer;
    function BridgedViewer(...args){const viewer=new Original(...args);queueMicrotask(()=>emit(viewer));return viewer}
    Object.setPrototypeOf(BridgedViewer,Original);BridgedViewer.prototype=Original.prototype;
    try{C.Viewer=BridgedViewer;window.__XUNIA_VIEWER_BRIDGE__=true}catch(error){console.warn('[XUNIA] Viewer bridge unavailable',error)}
  }

  function injectStyle(){
    if($('#xunia-ui-recovery-style'))return;
    const s=document.createElement('style');s.id='xunia-ui-recovery-style';s.textContent=`
      .sup-toolbar,.sup-toolbar button,.sup-sensor,.sup-sensor button,.xunia-nav button,.layer-chip,.timeline button{pointer-events:auto!important}
      #xunia-ui-health{position:fixed;z-index:5000;right:12px;bottom:34px;padding:8px 10px;border:1px solid rgba(94,220,255,.45);background:rgba(2,11,19,.94);color:#8fbbcb;font:700 7px/1.4 ui-monospace,monospace;pointer-events:auto}#xunia-ui-health b{color:#5ff3a7}#xunia-ui-health.error b{color:#ff6b73}#xunia-ui-health button{margin-left:7px;border:1px solid #226985;background:#052033;color:#aeeeff;padding:4px 6px;cursor:pointer}
      #xunia-module-pane{position:absolute;z-index:45;inset:10px;display:none;overflow:auto;border:1px solid rgba(90,220,255,.38);background:rgba(1,9,16,.97);padding:18px;color:#dff7ff;font-family:ui-monospace,monospace}#xunia-module-pane.open{display:block}#xunia-module-pane header{display:flex;justify-content:space-between;border-bottom:1px solid rgba(80,200,235,.2);padding-bottom:12px;margin-bottom:12px}#xunia-module-pane h2{margin:0;color:#66dfff;font-size:17px}#xunia-module-pane button{border:1px solid #236987;background:#052033;color:#aeeeff;padding:7px 9px;cursor:pointer}.xm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.xm-card{border:1px solid rgba(82,196,231,.18);background:rgba(4,18,29,.78);padding:10px}.xm-card b,.xm-card span{display:block}.xm-card span{margin-top:5px;color:#789cac;font-size:8px}
    `;document.head.appendChild(s);
  }

  function health(){
    let el=$('#xunia-ui-health');if(!el){el=document.createElement('div');el.id='xunia-ui-health';el.innerHTML='<span>UI <b>STARTING</b></span><button>RECOVER</button>';document.body.appendChild(el);el.querySelector('button').onclick=recover}return el;
  }

  function updateHealth(){
    const el=health(),earth=!$('#cesium')?.classList.contains('hidden'),viewer=window.__XUNIA_VIEWER__||state.viewer;el.classList.remove('error');
    if(earth&&!viewer){el.classList.add('error');el.querySelector('span').innerHTML='UI <b>EARTH VIEWER NOT READY</b> · press RECOVER';return}
    el.querySelector('span').innerHTML=viewer?`UI <b>INTERACTIVE</b> · CESIUM READY · ${state.commands} commands`:'UI <b>INTERACTIVE</b> · MULTIVERSE READY';
  }

  function recover(){
    $$('.sup-toolbar button,.sup-sensor button,.xunia-nav button,.layer-chip,.timeline button').forEach(el=>{el.disabled=false;el.style.pointerEvents='auto'});
    const viewer=window.__XUNIA_VIEWER__||state.viewer;if(viewer)emit(viewer);
    if(!viewer&&!$('#cesium')?.classList.contains('hidden')){$('#universeBtn')?.click();setTimeout(()=>$('#earthBtn')?.click(),100)}
    updateHealth();
  }

  function pane(){
    if(state.pane)return state.pane;const host=$('.stage');if(!host)return null;state.pane=document.createElement('section');state.pane.id='xunia-module-pane';host.appendChild(state.pane);return state.pane;
  }

  async function getJson(url){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}catch(error){return{error:error.message}}}
  const card=(title,value,sub='')=>`<div class="xm-card"><b>${title}</b><span>${value}</span><span>${sub}</span></div>`;

  async function openModule(name){
    const p=pane();if(!p)return;p.classList.add('open');p.innerHTML=`<header><div><h2>${name}</h2><small>LOADING MODULE</small></div><button data-close>CLOSE</button></header>`;p.querySelector('[data-close]').onclick=()=>p.classList.remove('open');
    if(name==='CIVILIZATIONS'||name==='MARKET'){
      const gh=await getJson('/api/github/state');p.innerHTML=`<header><div><h2>${name}</h2><small>LIVE REPOSITORY STATE</small></div><button data-close>CLOSE</button></header><div class="xm-grid">${gh.error?card('GITHUB','ERROR',gh.error):card('ERA',gh.era||'FOUNDATION','Civilization maturity')+card('REPOSITORIES',gh.repositoryCount||0,'GitHub colonies')+card('CIV SCORE',gh.totalScore||0,'Repository-derived score')}</div>`;
    }else if(name==='BUILD'){
      p.innerHTML=`<header><div><h2>BUILD</h2><small>ACTIVE DEVELOPMENT SURFACES</small></div><button data-close>CLOSE</button></header><div class="xm-grid">${card('PLANET FORGE','READY','Create local worlds')}${card('MULTIVERSE','READY','Three.js renderer')}${card('LIVE EARTH','READY','Cesium globe')}</div><p><button data-create>CREATE PLANET</button> <button data-earth>OPEN LIVE EARTH</button></p>`;
    }else if(name==='DAO'){
      const pal=await getJson('/api/palantir/status');p.innerHTML=`<header><div><h2>DAO / GOVERNANCE</h2><small>ONTOLOGY DATA PLANE</small></div><button data-close>CLOSE</button></header><div class="xm-grid">${card('FOUNDRY',pal.error?'ERROR':(pal.live?'LIVE':'ADAPTER'),pal.error||'Connection mode')}${card('WRITES',pal.writes?'ENABLED':'LOCKED','Governed remote actions')}${card('ONTOLOGY',$('#palantirState')?.textContent||'LOCAL','Current state')}</div>`;
    }else if(name==='RESEARCH'){
      const active=$$('.layer-chip.active').map(b=>b.dataset.layer||b.textContent.trim());p.innerHTML=`<header><div><h2>RESEARCH</h2><small>PUBLIC / AUTHORIZED DATA</small></div><button data-close>CLOSE</button></header><div class="xm-grid">${card('ACTIVE LAYERS',active.length,active.join(', ')||'None')}${card('OBJECTS',$('#objectCount')?.textContent||0,'Rendered')}${card('EVENTS',$('#eventCount')?.textContent||0,'Live feed')}</div><p><button data-context>LOAD GLOBAL CONTEXT</button></p>`;
    }else if(name==='ABOUT'){
      p.innerHTML=`<header><div><h2>ABOUT XUNIAVERSE</h2><small>INTERACTIVE PLANETARY FORGE</small></div><button data-close>CLOSE</button></header><div class="xm-grid">${card('THREE.JS','MULTIVERSE')}${card('CESIUM','LIVE EARTH')}${card('ONTOLOGY','ACTIVE')}${card('GITHUB','CIVILIZATION')}</div>`;
    }
    p.querySelector('[data-close]')?.addEventListener('click',()=>p.classList.remove('open'));p.querySelector('[data-create]')?.addEventListener('click',()=>{$('#planetModal')?.classList.add('open');p.classList.remove('open')});p.querySelector('[data-earth]')?.addEventListener('click',()=>{$('#earthBtn')?.click();p.classList.remove('open')});p.querySelector('[data-context]')?.addEventListener('click',()=>{$('#supContext')?.click();p.classList.remove('open')});
  }

  function boot(){
    injectStyle();health();
    $$('.xunia-nav button[data-tab]').forEach(button=>{const name=button.dataset.tab;if(['LIVE EARTH','MULTIVERSE'].includes(name))return;button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();$$('.xunia-nav button').forEach(b=>b.classList.toggle('active',b===button));openModule(name)},true)});
    document.addEventListener('click',event=>{const command=event.target.closest('.sup-toolbar button,.sup-sensor button,.timeline button,.layer-chip');if(!command)return;state.commands++;const needsEarth=command.closest('.sup-toolbar,.sup-sensor')||command.classList.contains('layer-chip');if(needsEarth&&$('#cesium')?.classList.contains('hidden'))$('#earthBtn')?.click();setTimeout(updateHealth,120)},true);
    window.addEventListener('error',()=>{health().classList.add('error')});setInterval(updateHealth,1000);setTimeout(recover,500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
