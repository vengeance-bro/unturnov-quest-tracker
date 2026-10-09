(function airdropApp() {
 'use strict';
 const $=id=>document.getElementById(id);
 const isViewer=()=>{try{return String(JSON.parse(localStorage.getItem('unturnov-supabase-session-v1'))?.email||'').toLowerCase()==='yoshiseggs911@gmail.com'}catch{return false}};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const recipes=[
  {key:'globe',name:'Airdrop ISR Globe',ingredients:[
   ['Phased Array Element',8],['Iridium',8],['Military Current Converter',1],['Aramid',12],
   ['Caps',6],['Relay',6],['Wire',16],['Powerline Cables',3],
   ['Insulating Tape',5],['Wires',5],['MRE',6],['Bort Drill',1]]},
  {key:'frame',name:'Airdrop ISR Frame',ingredients:[
   ['Military Circuit Board',6],['Military Current Converter',4],['Military Battery',2],
   ['Virtex',4],['VPX',4],['SAS Drive',4],['Caps',6],['Relay',4],
   ['Military Board',5],['Powerline Cables',3],['Bort Drill',1]]},
  {key:'support',name:'Airdrop ISR Support',ingredients:[
   ['Small Metal Plate',16],['Bolts',10],['Screw Nuts',10],['Metal Bar',36],['Tape',1]]},
  {key:'airdrop',name:'Airdrop ISR',ingredients:[['Bort Drill',1]],components:['globe','frame','support']}
 ];
 const materialKey=name=>name.toLowerCase().replace(/\s+/g,'-');
 const requirements=recipes.flatMap(recipe=>recipe.ingredients.map(([name,total])=>({
  key:recipe.key+':'+materialKey(name),recipe:recipe.key,name,total
 })));
 const requirementMap=new Map(requirements.map(x=>[x.key,x]));
 // Backward compatibility: any old global material entries are allocated to the
 // section recipes in order, without deleting previous offline progress.
 const legacyRequirements=new Map();
 for(const req of requirements){
  const k=materialKey(req.name),old=legacyRequirements.get(k)||{total:0,parts:[]};
  old.total+=req.total;old.parts.push(req);legacyRequirements.set(k,old);
 }
 const consumedToolNames=new Set(['Bort Drill','Tape']);
 const consumedToolRequirements=requirements.filter(x=>consumedToolNames.has(x.name));
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
  const state={materials:{},stages:{}};
  for(const item of requirements)state.materials[item.key]=0;
  for(const stage of stages)state.stages[stage.key]=false;
  const legacyCounts={};
  const events=remote.concat(pending.map((e,i)=>({...e,localOrder:i+1,seq:null})))
   .sort((a,b)=>(a.seq??Number.MAX_SAFE_INTEGER)-(b.seq??Number.MAX_SAFE_INTEGER)||((a.localOrder||0)-(b.localOrder||0)));
  for(const e of events){
   if(e.kind==='build_reset'){
    for(const item of requirements)state.materials[item.key]=0;
    for(const stage of stages)state.stages[stage.key]=false;
    for(const key of Object.keys(legacyCounts))delete legacyCounts[key];
   }else if(e.kind==='material_delta'||e.kind==='material_set'){
    const scoped=requirementMap.get(e.item_key);
    const legacy=legacyRequirements.get(e.item_key);
    if(scoped){
     const old=state.materials[e.item_key],num=e.kind==='material_delta'?old+Number(e.payload?.delta||0):Number(e.payload?.count||0);
     state.materials[e.item_key]=Math.max(0,Math.min(scoped.total,Number.isFinite(num)?Math.round(num):0));
    }else if(legacy){
     const old=legacyCounts[e.item_key]||0;
     const num=e.kind==='material_delta'?old+Number(e.payload?.delta||0):Number(e.payload?.count||0);
     let remaining=Math.max(0,Math.min(legacy.total,Number.isFinite(num)?Math.round(num):0));
     legacyCounts[e.item_key]=remaining;
     for(const part of legacy.parts){
      state.materials[part.key]=Math.min(part.total,remaining);
      remaining-=state.materials[part.key];
     }
    }
   }else if(e.kind==='tool_set'){
    // Old checkbox meant "I have at least one". Retain that one collected item in
    // the first applicable recipe, without pretending it covers every use.
    const oldKey=e.item_key==='bort-drill'?'globe:bort-drill':e.item_key==='tape'?'support:tape':null;
    if(oldKey)state.materials[oldKey]=e.payload?.owned===true?1:0;
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
 function renderStages(){
 const container=$('airdropStages');if(!container)return;
 // Background refresh must not replace an input while someone is typing.
 if(document.activeElement?.matches?.('input[data-airdrop-quantity]'))return;
 container.innerHTML=recipes.map((recipe,index)=>{
  const done=model.stages[recipe.key];
  const refs=recipe.ingredients.map(([name,qty])=>({name,qty,req:requirementMap.get(recipe.key+':'+materialKey(name))}));
  const collected=refs.reduce((n,x)=>n+model.materials[x.req.key],0);
  const required=refs.reduce((n,x)=>n+x.qty,0);
  const heading=index===3?'Final Assembly':index===0?'1 · Globe':index===1?'2 · Frame':'3 · Support';
  const rows=refs.map(({name,qty,req})=>{
   const count=model.materials[req.key];
   return `<tr><td>${esc(name)}</td><td>${qty}</td><td>
    <div class="airdrop-counter">
     <button type="button" data-airdrop-action="delta" data-key="${req.key}" data-delta="-1" aria-label="Remove one ${esc(name)} from ${esc(recipe.name)}" ${count===0?'disabled':''}>−</button>
     <input type="number" inputmode="numeric" min="0" max="${qty}" step="1" data-airdrop-quantity="${req.key}" value="${count}" aria-label="${esc(recipe.name)} ${esc(name)} collected">
     <button type="button" data-airdrop-action="delta" data-key="${req.key}" data-delta="1" aria-label="Add one ${esc(name)} to ${esc(recipe.name)}" ${count>=qty?'disabled':''}>+</button>
    </div></td></tr>`;
  });
  if(recipe.components)for(const key of recipe.components){
   const component=stages.find(x=>x.key===key);
   rows.push(`<tr><td>${esc(component.name)}</td><td>1</td><td>${model.stages[key]?'✓ Crafted':'Not crafted'}</td></tr>`);
  }
  return `<section class="airdrop-recipe" id="airdrop-${recipe.key}" data-stage="${recipe.key}">
   <div class="row"><div><small class="muted">${heading}</small><h3>${esc(recipe.name)}</h3></div>
    <span class="airdrop-stage-status ${done?'good':'muted'}">${done?'✓ Crafted':index===3?'Final build not crafted':`${collected} / ${required} collected`}</span></div>
   <div class="overflow"><table><thead><tr><th>${index===3?'Subassembly':'Material'}</th><th>Needed</th><th>${index===3?'Status':'Collected'}</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table></div>
   <div class="actions"><button type="button" class="${done?'':'primary'}" data-airdrop-action="stage" data-key="${recipe.key}" aria-pressed="${done}">
    ${done?'↩ Mark not crafted':'✓ Mark '+esc(recipe.name)+' crafted'}</button></div>
  </section>`;
 }).join('');
 renderVersion++;
}
 function render(){
 reduce();
 const sum=requirements.reduce((n,x)=>n+x.total,0);
 const got=requirements.reduce((n,x)=>n+model.materials[x.key],0);
 const toolsGot=consumedToolRequirements.reduce((n,x)=>n+model.materials[x.key],0);
 const stagesDone=stages.slice(0,3).filter(x=>model.stages[x.key]).length;
 $('airdropSummary').textContent=got+' / '+sum+' materials collected';
 $('airdropMaterialTotal').textContent=got+' / '+sum;
 $('airdropToolTotal').textContent=toolsGot+' / '+consumedToolRequirements.length;
 $('airdropStageTotal').textContent=stagesDone+' / 3';
 $('airdropFinalStatus').textContent=model.stages.airdrop?'✓ Crafted':'Not crafted';
 $('airdropProgress').value=got;$('airdropProgress').max=sum;
 renderStages();
 if(isViewer())document.querySelectorAll('#airdropSection input[data-airdrop-quantity],#airdropSection button[data-airdrop-action="delta"],#airdropSection button[data-airdrop-action="stage"],#airdropSection button[data-airdrop-action="reset"]').forEach(el=>el.disabled=true);
 renderStatus();
}
 function emit(kind,item_key,payload){
  if(isViewer()){alert('This account can view crafting progress but cannot edit it.');return}
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
  if(isViewer()&&!['sync','download'].includes(action)){alert('This account has view-only access.');return}
  if(action==='sync'){void sync();return}
  if(action==='reset'){
   if(!confirm('RESET ALL SHARED AIRDROP ISR PROGRESS for everyone? This clears all material counts (including consumed Tape and Bort Drills) and the 4 crafted stages. The quest tracker is not affected.'))return;
   emit('build_reset','all',{});return;
  }
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
  if(isViewer()){alert('This account has view-only access.');render();return}
  if(x.matches('[data-airdrop-quantity]')){
   const req=requirementMap.get(x.dataset.airdropQuantity);if(!req)return;
   const n=Number(x.value);
   if(!Number.isFinite(n)||!Number.isInteger(n)||n<0||n>req.total){alert('Enter a whole number between 0 and '+req.total+'.');x.value=model.materials[req.key];return}
   if(n!==model.materials[req.key])emit('material_set',req.key,{count:n});
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
