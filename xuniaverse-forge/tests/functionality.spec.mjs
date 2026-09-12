import { test, expect } from '@playwright/test';

const githubState={
  owner:'sonoxo',generatedAt:new Date().toISOString(),authenticated:false,repositoryCount:3,totalScore:1200,era:'INTERSTELLAR',
  colonies:[
    {id:1,name:'MMGISxunia-',fullName:'sonoxo/MMGISxunia-',domain:'SPACE & PLANETARY',visibility:'public',stars:12,forks:4,score:420,updatedAt:new Date().toISOString(),url:'https://github.com/sonoxo/MMGISxunia-'},
    {id:2,name:'zyra',fullName:'sonoxo/zyra',domain:'AI & ONTOLOGY',visibility:'public',stars:9,forks:3,score:390,updatedAt:new Date().toISOString(),url:'https://github.com/sonoxo/zyra'},
    {id:3,name:'CyberStrikeZYRA',fullName:'sonoxo/CyberStrikeZYRA',domain:'SECURITY',visibility:'public',stars:4,forks:2,score:390,updatedAt:new Date().toISOString(),url:'https://github.com/sonoxo/CyberStrikeZYRA'}
  ],
  techTree:[
    {name:'SPACE & PLANETARY',score:420,level:5},
    {name:'AI & ONTOLOGY',score:390,level:4},
    {name:'SECURITY',score:390,level:4}
  ]
};

const githubEvents=[
  {type:'PushEvent',created_at:new Date().toISOString(),repo:{name:'sonoxo/MMGISxunia-'},payload:{commits:[{sha:'1'},{sha:'2'}]}},
  {type:'PullRequestEvent',created_at:new Date().toISOString(),repo:{name:'sonoxo/zyra'},payload:{number:8,pull_request:{merged_at:new Date().toISOString(),html_url:'https://github.com/sonoxo/zyra/pull/8'}}}
];

async function mockFunctionalApis(page){
  await page.route('**/api/github/state',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(githubState)}));
  await page.route('https://api.github.com/users/sonoxo/events/public?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(githubEvents)}));
  await page.route('https://api.github.com/repos/**/issues?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{number:41,title:'Finish functionality pass',html_url:'https://github.com/sonoxo/MMGISxunia-/issues/41',updated_at:new Date().toISOString(),comments:2}])}));
  await page.route('**/api/geocode?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{display_name:'Richmond, Virginia, United States',lat:37.5407,lon:-77.436,type:'city',category:'place'}])}));
  await page.route('**/api/feed?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',features:[]})}));
}

const nav=(page,name)=>page.locator(`.xunia-nav button[data-tab="${name}"]`);

async function boot(page){
  await mockFunctionalApis(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/XUNIAverse/);
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('.boot')).toHaveClass(/off/,{timeout:5000});
  await expect(page.locator('#repoCount')).toHaveText('3',{timeout:8000});
}

test('civilization build and market mechanics are operational',async({page})=>{
  await boot(page);
  await nav(page,'CIVILIZATIONS').click();
  await expect(page.locator('#xuniaModuleSurface h2')).toHaveText('CIVILIZATIONS');
  await expect(page.locator('#xuniaModuleSurface')).toContainText('INTERSTELLAR');
  await page.getByRole('button',{name:'ALLOCATE 100',exact:true}).first().click();
  await expect(page.locator('#xuniaModuleSurface')).toContainText('research +100');

  await nav(page,'BUILD').click();
  await expect(page.locator('#xuniaModuleSurface h2')).toHaveText('BUILD');
  await page.getByRole('button',{name:'QUEUE',exact:true}).first().click();
  await expect(page.locator('#xuniaModuleSurface')).toContainText('REMOVE QUEUE');
  await expect(page.locator('#xuniaModuleSurface')).toContainText('Finish functionality pass');

  await nav(page,'MARKET').click();
  await expect(page.locator('#xuniaModuleSurface h2')).toHaveText('MARKET');
  await page.getByRole('button',{name:'INVEST 250',exact:true}).first().click();
  await expect(page.locator('#xuniaModuleSurface')).toContainText('domain-investment');
});

test('DAO research and adapter-health controls persist real state',async({page})=>{
  await boot(page);
  await nav(page,'DAO').click();
  await page.locator('#daoTitle').fill('Ship functionality gate');
  await page.locator('#daoTag').fill('ENGINEERING');
  await page.locator('#daoBody').fill('Require real browser verification before completion.');
  await page.locator('#daoCreate').click();
  await expect(page.locator('#xuniaModuleSurface')).toContainText('Ship functionality gate');
  await page.getByRole('button',{name:'YES',exact:true}).click();
  await expect(page.locator('#xuniaModuleSurface')).toContainText('YES 1');

  await nav(page,'RESEARCH').click();
  await page.locator('#researchTitle').fill('Adapter reliability');
  await page.locator('#researchTag').fill('QA');
  await page.locator('#researchBody').fill('Verify public data sources and fallback behavior.');
  await page.locator('#researchSave').click();
  await expect(page.locator('#xuniaModuleSurface')).toContainText('Adapter reliability');

  await nav(page,'ABOUT').click();
  await expect(page.locator('#xuniaModuleSurface h2')).toContainText('SYSTEM HEALTH');
  await page.locator('#runHealth').click();
  await expect(page.locator('#xuniaModuleSurface')).toContainText('ms',{timeout:15000});
});

test('federated search and custom planet creation work end-to-end',async({page})=>{
  await boot(page);
  await page.locator('#globalSearch').fill('Richmond');
  await page.locator('#globalSearch').press('Enter');
  await expect(page.locator('#xuniaModuleSurface h2')).toContainText('SEARCH // Richmond');
  await expect(page.locator('#xuniaModuleSurface')).toContainText('Richmond, Virginia');
  await page.locator('[data-place="0"]').click();
  await expect(page.locator('#xuniaModuleSurface')).not.toHaveClass(/open/);

  await page.locator('#createPlanetBtn').click();
  await expect(page.locator('#planetModal')).toHaveClass(/open/);
  await page.locator('#planetName').fill('QA-12');
  await page.locator('#planetRole').fill('Verification');
  await page.getByRole('button',{name:'CREATE',exact:true}).click();
  await expect(page.locator('#planetStrip')).toContainText('QA-12');
});

test('representative public adapters answer through the server',async({request})=>{
  const github=await request.get('/api/github/state');
  expect(github.status()).toBe(200);
  const githubBody=await github.json();
  expect(githubBody.repositoryCount).toBeGreaterThan(0);

  const seismic=await request.get('/api/feed?id=earthquakes');
  expect(seismic.status()).toBe(200);
  expect((await seismic.json()).type).toBe('FeatureCollection');

  const fires=await request.get('/api/feed?id=fires');
  expect(fires.status()).toBe(200);
  expect((await fires.json()).type).toBe('FeatureCollection');

  const geocode=await request.get('/api/geocode?q=Richmond%20Virginia');
  expect(geocode.status()).toBe(200);
  expect(Array.isArray(await geocode.json())).toBeTruthy();
});