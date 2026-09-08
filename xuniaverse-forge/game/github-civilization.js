export async function loadGithubCivilization(){
  const response=await fetch('/api/github/state');
  if(!response.ok)throw new Error(`GitHub state ${response.status}`);
  return response.json();
}

export function renderGithubCivilization(root,state){
  if(!root||!state)return;
  const top=state.techTree?.slice(0,6)||[];
  const colonies=state.colonies?.slice().sort((a,b)=>b.score-a.score).slice(0,12)||[];
  root.innerHTML=`
    <div class="civ-summary">
      <div><span>ERA</span><b>${state.era}</b></div>
      <div><span>CIV SCORE</span><b>${state.totalScore}</b></div>
      <div><span>COLONIES</span><b>${state.repositoryCount}</b></div>
      <div><span>SOURCE</span><b>${state.authenticated?'PRIVATE+PUBLIC':'PUBLIC'}</b></div>
    </div>
    <div class="section-title"><span>TECH TREE</span><b>GITHUB POWER</b></div>
    <div class="tech-tree">${top.map(t=>`<div class="tech-node"><span>${t.name}</span><b>LV ${t.level}</b><i style="width:${Math.min(100,Math.round(t.score/Math.max(1,top[0]?.score||1)*100))}%"></i></div>`).join('')}</div>
    <div class="section-title"><span>TOP COLONIES</span><b>REPOSITORIES</b></div>
    <div class="colonies">${colonies.map(c=>`<button class="colony" data-repo="${c.fullName}"><span>${c.domain}</span><b>${c.name}</b><small>POWER ${c.score} // ★ ${c.stars} // FORKS ${c.forks}</small></button>`).join('')}</div>
  `;
}

export function civilizationToWorlds(state){
  const domains=new Map();
  for(const c of state.colonies||[]){
    if(!domains.has(c.domain))domains.set(c.domain,[]);
    domains.get(c.domain).push(c);
  }
  return [...domains.entries()].map(([domain,repos],i)=>({
    id:`github-${domain.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
    name:domain,
    kind:'github-civilization',
    radius:1.4+Math.min(2,repos.length/18),
    orbitRadius:38+i*8,
    orbitSpeed:.006+i*.001,
    color:['#66e4ff','#8c5cff','#23d7b2','#e8c36b','#ff6e9f','#77a9ff','#d48cff'][i%7],
    description:`${repos.length} GitHub repositories in the ${domain} civilization domain.`,
    github:{repositories:repos.length,power:repos.reduce((a,r)=>a+r.score,0)}
  }));
}
