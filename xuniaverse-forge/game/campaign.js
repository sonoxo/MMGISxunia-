import {loadGithubCivilization,renderGithubCivilization} from './github-civilization.js';

const root=document.querySelector('#githubCivilization');
const stateLabel=document.querySelector('#civState');

async function sync(){
  try{
    const state=await loadGithubCivilization();
    renderGithubCivilization(root,state);
    if(stateLabel)stateLabel.textContent=`${state.era} // ${state.totalScore}`;
    window.dispatchEvent(new CustomEvent('xunia:github-civilization',{detail:state}));
  }catch(error){
    if(root)root.innerHTML=`<div class="empty-state"><b>GITHUB SYNC OFFLINE</b><span>${String(error.message||error)}</span></div>`;
    if(stateLabel)stateLabel.textContent='SYNC ERROR';
  }
}

sync();
setInterval(sync,180000);
