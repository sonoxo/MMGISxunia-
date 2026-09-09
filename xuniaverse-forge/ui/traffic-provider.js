const $=s=>document.querySelector(s);
let viewer=window.__XUNIA_VIEWER__||null;
let trafficLayer=null;

function toast(message){const el=$('#supToast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2400)}
function key(){return sessionStorage.getItem('xunia:tomtom-key')||''}
function trafficActive(){return Boolean($('[data-layer="traffic"]')?.classList.contains('active'))}
function removeTraffic(){if(viewer&&trafficLayer){try{viewer.imageryLayers.remove(trafficLayer,true)}catch{}trafficLayer=null}}
function enableTraffic(){
  viewer=viewer||window.__XUNIA_VIEWER__||null;
  if(!viewer)return;
  const k=key();
  if(!k){removeTraffic();toast('TRAFFIC requires a TomTom key — open POWER UP');return}
  removeTraffic();
  try{
    const provider=new Cesium.UrlTemplateImageryProvider({
      url:`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?tileSize=256&key=${encodeURIComponent(k)}`,
      credit:'Traffic © TomTom',
      minimumLevel:0,
      maximumLevel:22,
      tilingScheme:new Cesium.WebMercatorTilingScheme()
    });
    trafficLayer=viewer.imageryLayers.addImageryProvider(provider);
    trafficLayer.alpha=.78;
    trafficLayer.brightness=1.08;
    trafficLayer.contrast=1.12;
    toast('LIVE TRAFFIC FLOW enabled');
  }catch(error){console.warn('[XUNIA] traffic overlay',error);toast(`TRAFFIC unavailable: ${error.message}`)}
}
function syncTraffic(){trafficActive()?enableTraffic():removeTraffic()}
function injectSetting(){
  if($('#supTomTomKey'))return;
  const google=$('#supGoogleKey');if(!google)return;
  const label=document.createElement('label');label.textContent='TomTom Traffic API key';
  const input=document.createElement('input');input.id='supTomTomKey';input.type='password';input.autocomplete='off';input.placeholder='Optional — Live traffic flow tiles';input.value=key();
  google.insertAdjacentElement('afterend',input);input.insertAdjacentElement('beforebegin',label);
}
function saveSetting(){const input=$('#supTomTomKey');if(!input)return;const value=input.value.trim();if(value)sessionStorage.setItem('xunia:tomtom-key',value);else sessionStorage.removeItem('xunia:tomtom-key');if(trafficActive())setTimeout(enableTraffic,50)}

window.addEventListener('xunia:viewer-ready',e=>{viewer=e.detail;setTimeout(syncTraffic,80)});
document.addEventListener('DOMContentLoaded',()=>{injectSetting();$('#supPowerUp')?.addEventListener('click',saveSetting,true);$('#supSettings')?.addEventListener('click',()=>setTimeout(()=>{injectSetting();const i=$('#supTomTomKey');if(i)i.value=key()},0));$('#supBasemap')?.addEventListener('click',()=>setTimeout(syncTraffic,180));});
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-layer="traffic"]');if(!button)return;setTimeout(syncTraffic,80)});
