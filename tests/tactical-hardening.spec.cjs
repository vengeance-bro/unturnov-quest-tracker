const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const SITE=process.env.SITE_URL||'http://127.0.0.1:8000/';
const emails=['nolanrabehl@gmail.com','tv6937069@gmail.com','kalob202608@gmail.com','yoshiseggs911@gmail.com'];
const names=['Nolan','Tyler','Kalob','Dakota'];
const events=names.map((player,i)=>({
 seq:i+1,event_id:'seed-'+i,player,quest_id:'quest-'+i,kind:'quest_created',payload:{quest:{
 id:'quest-'+i,title:'Test '+player+' quest',trader:'Ragman',reward:1,deleted:false,pinned:false,notes:'',
 goals:[{id:'goal-'+i,name:i===0?'AA Battery':'MRE',type:'item',total:5,count:i}]
 }}
}));
async function setup(page,email){
 await page.addInitScript(({email,events})=>{
  localStorage.setItem('unturnov-supabase-session-v1',JSON.stringify({
   access_token:'mock-token',refresh_token:'mock-refresh',expires_at:Date.now()+7200000,email
  }));
  localStorage.setItem('unturnov-v3-events',JSON.stringify(events));
  // No credentials or actual production API requests are used in tests.
  window.WebSocket=undefined;
  window.__iconFileWrites=[];
  const savedFetch=window.fetch.bind(window);
  window.fetch=(input,init={})=>{
   const url=String(input),method=init.method||'GET';
   if(url.includes('.supabase.co')){
    if(url.includes('/storage/v1/object/public/unturnov-item-icons/'))
     return Promise.resolve(new Response(new Uint8Array([137,80,78,71,13,10,26,10]),{
      status:200,headers:{'content-type':'image/png'}}));
    if(url.includes('/storage/v1/object/unturnov-item-icons/')){
     window.__iconFileWrites.push({url,method});
     return Promise.resolve(new Response('{}',{status:200,headers:{'content-type':'application/json'}}));
    }
    if(url.includes('/rest/v1/unturnov_item_images')&&method==='GET'){
     return Promise.resolve(new Response(JSON.stringify([{item_key:'aa battery',object_path:'aa battery'}]),{
      status:200,headers:{'content-type':'application/json'}}));
    }
    if(method!=='GET'&&!url.includes('/rest/v1/unturnov_item_images')){
     return Promise.resolve(new Response('{"error":"offline test"}',{status:503,headers:{'content-type':'application/json'}}));
    }
    return Promise.resolve(new Response('[]',{status:200,headers:{'content-type':'application/json'}}));
   }
   return savedFetch(input,init);
  };
 },{email,events});
 await page.goto(SITE+'index.html');
}
test('all four approved identities display independent quests and team needs',async({browser})=>{
 for(let i=0;i<4;i++){
  const context=await browser.newContext();const page=await context.newPage();
  await setup(page,emails[i]);
  await expect(page.locator('#tacticalAccount')).toContainText(emails[i]);
  await expect(page.locator('#dashboardPlayers .dashboard-player')).toHaveCount(4);
  await page.locator('#mainNav [data-view="quests"]').click();
  for(let j=0;j<4;j++){
   await page.locator('#tabs [data-player="'+names[j]+'"]').click();
   await expect(page.locator('#questList')).toContainText('Test '+names[j]+' quest');
  }
  await page.locator('#mainNav [data-view="team"]').click();
  await expect(page.locator('#teamLoot')).toContainText('Nolan');
  await expect(page.locator('#teamLoot')).toContainText('Dakota');
  await context.close();
 }
});
test('offline quest progress and Keep/Sell choice persist, restore Automatic',async({page})=>{
 await setup(page,emails[0]);
 await page.locator('#mainNav [data-view="quests"]').click();
 await page.locator('#questList [data-action="select"]').first().click();
 await page.locator('#questDetail [data-action="delta"][data-n="1"]').first().click();
 console.log('QUEST DEBUG',JSON.stringify(await page.evaluate(()=>({
  pending:JSON.parse(localStorage.getItem('unturnov-v3-pending')||'[]'),
  remote:JSON.parse(localStorage.getItem('unturnov-v3-events')||'[]').length,
  goal:document.querySelector('#questDetail .count-actions')?.textContent,
  sync:document.querySelector('#syncState')?.textContent,
  selected:document.querySelector('#questDetail h2')?.textContent,
  currentModel:window.unturnovReduce(JSON.parse(localStorage.getItem('unturnov-v3-events')||'[]').concat(JSON.parse(localStorage.getItem('unturnov-v3-pending')||'[]').map((x,i)=>({...x,seq:null,local_order:i+1})))).Nolan[0]?.goals?.[0]?.count,
  noteFocused:document.activeElement?.id
 }))));
 await expect(page.locator('#questDetail .count-actions')).toContainText('2/5');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('unturnov-v3-pending')||'[]').some(x=>x.kind==='goal_delta'))).toBeTruthy();
 await page.locator('#mainNav [data-view="sell"]').click();
 await page.locator('#sellMode').selectOption('all');
 const row=page.locator('#sellList tr').filter({hasText:'AA Battery'}).first();
 await expect(row).toContainText('Keep');
 page.on('dialog',dlg=>dlg.accept());
 await row.locator('[data-sell-override]').selectOption('sell');
 await expect(row).toContainText('Sell - not needed');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('unturnov-sell-manual-pending-v1')||'[]').some(x=>x.decision==='sell'))).toBeTruthy();
 await row.locator('[data-sell-override]').selectOption('auto');
 await expect(row).toContainText('Keep');
});
test('unified full-site backup contains each player and genuine icon bytes',async({page})=>{
 await setup(page,emails[1]);
 await page.locator('#mainNav [data-view="settings"]').click();
 await page.locator('#accountPanel details').filter({hasText:'Backups & restore'}).locator('summary').click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="export"]').click()]);
 const out=JSON.parse(fs.readFileSync(await download.path(),'utf-8'));
 expect(out.version).toBe(5);
 expect(Object.keys(out.profiles)).toEqual(expect.arrayContaining(names));
 expect(out.image_files).toHaveLength(1);
 expect(out.image_files[0].item_key).toBe('aa battery');
 expect(out.image_files[0].bytes_base64).toBe('iVBORw0KGgo=');
 for(const name of ['quest_events','airdrop_events','unturnov_sell_overrides','unturnov_item_catalog','unturnov_item_images'])
  expect(Array.isArray(out.tables[name])).toBe(true);
});
test('Realtime fails gracefully to 12-second polling without a WebSocket',async({page})=>{
 await setup(page,emails[2]);
 await expect(page.locator('#teamRealtimeState')).toHaveText('Polling');
 await expect(page.locator('#dashboardView')).toBeVisible();
});
