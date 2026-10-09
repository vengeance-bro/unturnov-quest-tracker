(function airdropApp() {
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const recipes=[
  {key:'globe',name:'Airdrop ISR Globe',ingredients:[
   ['Phased Array Element',8],['Iridium',8],['Military Current Converter',1],['Aramid',12],
   ['Caps',6],['Relay',6],['Wire',16],['Powerline Cables',3],
   ['Insulating Tape',5],['Wires',5],['MRE',6]],tools:['Bort Drill']},
  {key:'frame',name:'Airdrop ISR Frame',ingredients:[
   ['Military Circuit Board',6],['Military Current Converter',4],['Military Battery',2],
   ['Virtex',4],['VPX',4],['SAS Drive',4],['Caps',6],['Relay',4],
   ['Military Board',5],['Powerline Cables',3]],tools:['Bort Drill']},
  {key:'support',name:'Airdrop ISR Support',ingredients:[
   ['Small Metal Plate',16],['Bolts',10],['Screw Nuts',10],['Metal Bar',36]],tools:['Tape']},
  {key:'airdrop',name:'Airdrop ISR',ingredients:[],tools:['Bort Drill'],components:['globe','frame','support']}
 ];
 const materialKey=name=>name.toLowerCase().replace(/\s+/g,'-');
 const requirements=[];
 for(const recipe of recipes)for(const [name,qty] of recipe.ingredients){
  let existing=requirements.find(x=>x.key===materialKey(name));
  if(existing)existing.total+=qty;else requirements.push({key:materialKey(name),name,total:qty});
 }
 const requirementMap=new Map(requirements.map(x=>[x.key,x]));
 const tools=[{key:'bort-drill',name:'Bort Drill'},{key:'tape',name:'Tape'}];
 const stages=recipes.map(x=>({key:x.key,name:x.name}));
 const localKeys={events:'unturnov-airdrop-remote-events-v1',pending:'unturnov-airdrop-pending-events-v1',last:'unturnov-airdrop-last-sync-v1'};
 function fromStorage(key,fallback){try{const x=JSON.parse(localStorage.getItem(key));return x===null?fallback:x}catch{return fallback}}
 let remote=fromStorage(localKeys.events,[]),pending=fromStorage(localKeys.pending,[]);
 if(!Array.isArray(remote))remote=[];if(!Array.isArray(pending))pending=[];
 let eventIds=new Set(remote.map(x=>x.event_id)),maxSeq=Math.max(0,...remote.map(x=>Number(x.seq)||0));
 let lastSynced=Number(localStorage.getItem(localKeys.last)||0)||0;
 let statusError='',syncing=false,model=null;
 let renderVersion=0;
 function persist(){
  try{localStorage.setItem(localKeys.events,JSON.stringify(remote));localStorage.setItem(localKeys.pending,JSON.stringify(pending))}
  catch(e){statusError='Browser storage full. Please free space and avoid clearing site data.'}
 }
 function reduce(){
  const state={materials:{},tools:{},stages:{}};
  for(const item of requirements)state.materials[item.key]=0;
  for(const tool of tools)state.tools[tool.key]=false;
  for(const stage of stages)state.stages[stage.key]=false;
  const events=remote.concat(pending.map((e,i)=>({...e,localOrder:i+1,seq:null})))
   .sort((a,b)=>(a.seq??Number.MAX_SAFE_INTEGER)-(b.seq??Number.MAX_SAFE_INTEGER)||((a.localOrder||0)-(b.localOrder||0)));
  for(const e of events){
   if(e.kind==='material_delta'||e.kind==='material_set'){
    const req=requirementMap.get(e.item_key);if(!req)continue;
    const old=state.materials[e.item_key];
    const n=e.kind==='material_delta'?old+Number(e.payload?.delta||0):Number(e.payload?.count||0);
    state.materials[e.item_key]=Math.max(0,Math.min(req.total,Number.isFinite(n)?Math.round(n):0));
   }else if(e.kind==='tool_set'){
    if(Object.hasOwn(state.tools,e.item_key))state.tools[e.item_key]=e.payload?.owned===true;
   }else if(e.kind==='stage_set'){
    if(Object.hasOwn(state.stages,e.item_key))state.stages[e.item_key]=e.payload?.crafted===true;
   }
  }
  model=state;
 }
 function connection(){
  const conf=fromStorage('unturnov-supabase-public-config-v1',null);
  const session=fromStorage('unturnov-supabase-session-v1',null);
  if(!conf?.url||!conf?.key||!session?.access_token)return null;
  return {url:conf.url.replace(/\/$/,''),key:conf.key,token:session.access_token};
 }
 async function api(path,method='GET',body=null,prefer=''){
  const c=connection();if(!c)throw Error('Sign in under Account & cloud to share your crafting progress.');
  const headers={'apikey':c.key,'Authorization':'Bearer '+c.token};
  if(body!==null){headers['Content-Type']='application/json';if(prefer)headers['Prefer']=prefer}
  return fetch(c.url+path,{method,headers,...(body!==null?{body:JSON.stringify(body)}:{})});
 }
 function formatDate(ms){return ms?new Date(ms).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Not yet'}
 function renderStatus(){
  const ready=!!connection();
  let text=statusError?'⚠ '+statusError:!ready?'Not signed in — changes remain saved on this browser':pending.length?pending.length+' change(s) waiting to sync':syncing?'Syncing crafting progress…':'Shared progress synchronized';
  const x=$('airdropSyncStatus');if(!x)return;
  x.textContent=text;x.className=statusError?'warn':!ready||pending.length?'pending':'good';
  $('airdropLastSynced').textContent='Last sync: '+formatDate(lastSynced);
 }
 function recipeRow(recipe){
  const rows=recipe.ingredients.map(([name,qty])=>{
   const req=requirementMap.get(materialKey(name));
   return `<tr><td>${esc(name)}</td><td>${qty}</td><td>${model.materials[req.key]} / ${req.total}</td></tr>`;
  });
  if(recipe.components)for(const key of recipe.components){
   const component=stages.find(x=>x.key===key);
   rows.push(`<tr><td>${esc(component.name)}</td><td>1</td><td>${model.stages[key]?'✓ Crafted':'Not crafted'}</td></tr>`);
  }
  for(const name of recipe.tools){
   const tool=tools.find(x=>x.name===name);
   rows.push(`<tr><td>${esc(name)} <small>(reusable tool)</small></td><td>1</td><td>${model.tools[tool.key]?'✓ Available':'Not available'}</td></tr>`);
  }
  return rows.join('');
 }
 function renderStages(){
  const container=$('airdropStages');if(!container)return;
  const open=new Set([...container.querySelectorAll('details[data-stage]')].filter(x=>x.open).map(x=>x.dataset.stage));
  const hasRendered=renderVersion>0;
  container.innerHTML=recipes.map((r,i)=>{
   const done=model.stages[r.key],checked=done?'✓ Crafted':'Mark as crafted';
   return `<details class="airdrop-recipe" data-stage="${r.key}" ${(!hasRendered&&i===0)||open.has(r.key)?'open':''}>
    <summary><span><strong>${esc(r.name)}</strong> <small>${i===3?'Final assembly':'Subassembly'} · ${done?'Completed':'Not crafted yet'}</small></span><span class="craft-bubble">${done?'✓':'+'}</span></summary>
    <p class="muted">The team totals shown here are shared across all recipes; materials used by multiple recipes must be collected for each.</p>
    <div class="overflow"><table><thead><tr><th>Required ingredient</th><th>For this part</th><th>Team collected / total</th></tr></thead><tbody>${recipeRow(r)}</tbody></table></div>
    <div class="actions"><button type="button" class="${done?'':'primary'}" data-airdrop-action="stage" data-key="${r.key}" aria-pressed="${done}">${done?'↩ Mark not crafted':'✓ Mark crafted'}</button></div>
    </details>`;
  }).join('');
  renderVersion++;
 }
 function render(){
  reduce();
  const sum=requirements.reduce((n,x)=>n+x.total,0);
  const got=requirements.reduce((n,x)=>n+model.materials[x.key],0);
  const toolsGot=tools.filter(x=>model.tools[x.key]).length;
  const stagesDone=stages.slice(0,3).filter(x=>model.stages[x.key]).length;
  $('airdropSummary').textContent=got+' / '+sum+' materials collected';
  $('airdropMaterialTotal').textContent=got+' / '+sum;
  $('airdropToolTotal').textContent=toolsGot+' / '+tools.length;
  $('airdropStageTotal').textContent=stagesDone+' / 3';
  $('airdropFinalStatus').textContent=model.stages.airdrop?'✓ Crafted':'Not crafted';
  $('airdropProgress').value=got;$('airdropProgress').max=sum;
  const focused=document.activeElement?.matches?.('input[data-airdrop-quantity]');
  if(!focused){
   $('airdropMaterials').innerHTML=requirements.map(req=>{
    const n=model.materials[req.key];
    return `<tr><td>${esc(req.name)}</td><td>${req.total}</td><td><div class="airdrop-counter"><button type="button" data-airdrop-action="delta" data-key="${req.key}" data-delta="-1" aria-label="Remove one ${esc(req.name)}" ${n===0?'disabled':''}>−</button><input type="number" inputmode="numeric" min="0" max="${req.total}" step="1" data-airdrop-quantity="${req.key}" value="${n}" aria-label="${esc(req.name)} collected quantity"><button type="button" data-airdrop-action="delta" data-key="${req.key}" data-delta="1" aria-label="Add one ${esc(req.name)}" ${n===req.total?'disabled':''}>+</button></div></td></tr>`;
   }).join('');
  }
  $('airdropTools').innerHTML=tools.map(tool=>
   `<label class="airdrop-check"><input type="checkbox" data-airdrop-tool="${tool.key}" ${model.tools[tool.key]?'checked':''}><span>${esc(tool.name)}</span><small>Reusable — only one needed</small></label>`
  ).join('');
  renderStages();
  renderStatus();
 }
 function emit(kind,item_key,payload){
  pending.push({event_id:crypto.randomUUID(),kind,item_key,payload,localOrder:Date.now()+pending.length});
  persist();render();void sync();
 }
 async function fetchRemote(){
  let loops=0;
  while(++loops<=100){
   const r=await api('/rest/v1/airdrop_events?seq=gt.'+maxSeq+'&select=seq,event_id,item_key,kind,payload&order=seq.asc&limit=500');
   if(!r.ok)throw Error('Crafting sync read failed ('+r.status+'). Check Supabase connection.');
   const list=await r.json();
   if(!Array.isArray(list))throw Error('Unexpected crafting sync response.');
   for(const e of list){
    if(!eventIds.has(e.event_id)){remote.push(e);eventIds.add(e.event_id)}
    maxSeq=Math.max(maxSeq,Number(e.seq)||0);
   }
   if(list.length<500)break;
  }
 }
 async function pushPending(){
  while(pending.length){
   const e=pending[0];
   const row={event_id:e.event_id,item_key:e.item_key,kind:e.kind,payload:e.payload};
   const r=await api('/rest/v1/airdrop_events?on_conflict=event_id','POST',[row],'resolution=ignore-duplicates,return=representation');
   if(!r.ok)throw Error('Crafting sync write failed ('+r.status+'). Changes remain queued.');
   const saved=await r.json();
   if(saved?.[0]&&!eventIds.has(saved[0].event_id)){
    remote.push(saved[0]);eventIds.add(saved[0].event_id);
    // Cursor advances ONLY on ordered reads to avoid skipping concurrent inserts.
   }
   pending.shift();persist();
  }
 }
 async function sync(){
  if(syncing||!connection()){renderStatus();return}
  syncing=true;statusError='';renderStatus();
  try{
   await fetchRemote();
   await pushPending();
   await fetchRemote();
   persist();lastSynced=Date.now();localStorage.setItem(localKeys.last,String(lastSynced));render();
  }catch(e){statusError=String(e?.message||e);renderStatus()}
  finally{syncing=false;renderStatus()}
 }
 function onClick(e){
  const btn=e.target.closest('button[data-airdrop-action]');
  if(!btn)return;
  const action=btn.dataset.airdropAction,key=btn.dataset.key;
  if(action==='sync'){void sync();return}
  if(action==='delta'){
   if(!requirementMap.has(key))return;
   emit('material_delta',key,{delta:Number(btn.dataset.delta)});
  }else if(action==='stage'&&stages.some(x=>x.key===key)){
   emit('stage_set',key,{crafted:!model.stages[key]});
  }else if(action==='download'){
   const data={app:'Unturnov ISR crafting',version:1,exported:new Date().toISOString(),progress:model,pending};
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download='unturnov-airdrop-isr-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
 }
 function onChange(e){
  const x=e.target;
  if(x.matches('[data-airdrop-quantity]')){
   const req=requirementMap.get(x.dataset.airdropQuantity);if(!req)return;
   const n=Number(x.value);
   if(!Number.isFinite(n)||!Number.isInteger(n)||n<0||n>req.total){alert('Enter a whole number between 0 and '+req.total+'.');x.value=model.materials[req.key];return}
   if(n!==model.materials[req.key])emit('material_set',req.key,{count:n});
  }else if(x.matches('[data-airdrop-tool]')){
   if(tools.some(t=>t.key===x.dataset.airdropTool))emit('tool_set',x.dataset.airdropTool,{owned:x.checked});
  }
 }
 function init(){
  const node=$('airdropSection');if(!node)return;
  node.addEventListener('click',onClick);
  node.addEventListener('change',onChange);
  node.addEventListener('focusout',e=>{if(e.target.matches?.('input[data-airdrop-quantity]'))requestAnimationFrame(()=>render())});
  window.addEventListener('focus',()=>void sync());
  window.addEventListener('online',()=>void sync());
  // The quest tracker handles refreshing the Supabase sign-in. Read its current
  // session afresh on each crafting sync rather than refreshing tokens twice.
  setInterval(()=>void sync(),12000);
  render();void sync();
 }
 init();
})();
