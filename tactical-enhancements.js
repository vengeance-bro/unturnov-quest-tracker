(function tacticalInterface(){
'use strict';
const $=id=>document.getElementById(id);
const $all=sel=>[...document.querySelectorAll(sel)];
const pnames=['Nolan','Tyler','Kalob','Dakota'];
const secs=['dashboard','quests','team','airdrop','sell','activity','settings'];
const idNames=['dashboardView','questDetail','teamSection','airdropSection','sellSection','activitySection','accountPanel'];
let view=localStorage.getItem('unturnov-tactical-view')||'dashboard';
if(!secs.includes(view))view='dashboard';
let imageMap=new Map(),activityData=[],memberMap={},currentUploadKey='',imageNonce=0,activityFilter='all';
const auth=()=>{try{return JSON.parse(localStorage.getItem('unturnov-supabase-session-v1')||'null')}catch{return null}};
const cfg=()=>{try{return JSON.parse(localStorage.getItem('unturnov-supabase-public-config-v1')||'null')}catch{return null}};
const signedIn=()=>!!auth()?.access_token;
const data=()=>{try{const quests=JSON.parse(localStorage.getItem('unturnov-v3-events')||'[]'),pending=JSON.parse(localStorage.getItem('unturnov-v3-pending')||'[]');return window.unturnovReduce?.(quests.concat(pending.map((e,i)=>({...e,seq:null,local_order:i+1}))))||{};}catch{return {}}};
const complete=q=>!!q?.goals?.length&&q.goals.every(g=>g.count>=g.total);
const keyOf=name=>{
 let n=String(name||'').trim().toLowerCase().replace(/\s+/g,' ');
 const aliases={'propane':'propa','dogtag':'dogtags','bundle of dogtags':'dogtags','stack of dogtags':'dogtags','water filters':'water filter','damaged power supply units':'damaged power supply unit','fp100 air filter':'fp-100 air filter','air filter':'fp-100 air filter','stack of wires (5x)':'wires'};
 return aliases[n]||n;
};
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function go(section){
 if(!secs.includes(section))return;
 view=section;localStorage.setItem('unturnov-tactical-view',section);
 document.body.dataset.view=section;
 $all('#mainNav button[data-view]').forEach(b=>{const a=b.dataset.view===section;b.classList.toggle('active',a);b.setAttribute('aria-current',a?'page':'false');});
 if(section==='activity')void syncActivity();
 if(section==='dashboard')renderDashboard();
 window.scrollTo?.({top:0,behavior:'instant'});
}
function showAuth(){
 const yes=signedIn();document.body.classList.toggle('auth-locked',!yes);
 const account=$('accountPanel'),authHost=$('authPanelMount'),sidebarHost=$('accountSidebarMount');
 if(account&&authHost&&sidebarHost){
  if(!yes&&account.parentNode!==authHost)authHost.append(account);
  if(yes&&account.parentNode!==sidebarHost)sidebarHost.append(account);
 }
 const who=$('tacticalAccount');if(who)who.textContent=yes?(auth().email||'Team member'):'Not signed in';
 const sign=$('tacticalAuthStatus');if(sign)sign.textContent=yes?'PRIVATE TEAM ACCESS':'SIGN IN REQUIRED';
 document.body.classList.add('auth-evaluated');
}
function renderDashboard(){
 if(!$('dashboardView')||!signedIn())return;
 const state=data(),all=pnames.flatMap(player=>(state[player]||[]).map(q=>({...q,player})).filter(q=>!q.deleted));
 const finished=all.filter(complete).length,active=all.length-finished;
 const goals=all.filter(q=>!complete(q)).flatMap(q=>q.goals.filter(g=>g.count<g.total));
 const sellRows=document.querySelectorAll('#sellList tr').length;
 const cells=[
  [String(all.length),'Tracked quests',active+' active across the team'],
  [String(finished),'Completed quests',all.length?(Math.round(finished/all.length*100)+'% completion'):'No quests yet'],
  [String(goals.length),'Outstanding objectives','Items and actions remaining'],
  [String(Math.max(0,sellRows)),'Catalog entries shown','Keep / Sell comparison']
 ];
 $('dashboardStats').innerHTML=cells.map(([n,label,sub])=>`<div class="dashboard-stat"><span class="stat-label">${esc(label)}</span><strong class="stat-number">${n}</strong><span class="stat-sub">${esc(sub)}</span></div>`).join('');
 $('dashboardPlayers').innerHTML=pnames.map(name=>{
  const quests=(state[name]||[]).filter(q=>!q.deleted),done=quests.filter(complete).length;
  const pct=quests.length?Math.round(done/quests.length*100):0;
  return `<section class="dashboard-player"><div class="row"><h3>${name}</h3><strong>${pct}%</strong></div><div class="player-progress" role="progressbar" aria-label="${name} quest completion" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><p class="player-meta">${done} / ${quests.length} quests completed · ${quests.length-done} active</p></section>`;
 }).join('');
 const status=$('dashboardUpdated');if(status)status.textContent='Updates automatically with cloud sync · '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
}
function rowsMobile(){
 const configs={teamLoot:['Item','Needed','Who needs it'],teamActions:['Action','Remaining','Who needs it'],sellList:['Item','Category','Status','Move to','Needed for']};
 for(const [id,names] of Object.entries(configs)){
  const body=$(id);if(!body)continue;body.closest('table')?.classList.add('mobile-cards');
  $all('#'+id+' > tr').forEach(row=>row.querySelectorAll(':scope > td').forEach((td,i)=>td.dataset.label=names[i]||''));
 }
 const recipes=$('airdropStages');
 if(recipes)recipes.querySelectorAll('table').forEach(t=>{
  t.classList.add('mobile-cards');
  t.querySelectorAll('tbody > tr').forEach(row=>row.querySelectorAll(':scope > td').forEach((td,i)=>td.dataset.label=['Material / component','Quantity','Collected / status'][i]||''));
 });
 for(const player of pnames){
  for(const [prefix,names] of [['personalLoot',['Item','Still need','Needed for']],['personalActions',['Action','Still need','Needed for']]]){
   const body=$(prefix+player);if(!body)continue;
   body.closest('table')?.classList.add('mobile-cards');
   $all('#'+prefix+player+' > tr').forEach(row=>row.querySelectorAll(':scope > td').forEach((td,i)=>td.dataset.label=names[i]));
  }
 }
}
function iconAddress(objectPath){const c=cfg();if(!c?.url)return '';return c.url.replace(/\/$/,'')+'/storage/v1/object/public/unturnov-item-icons/'+encodeURIComponent(objectPath)+'?v='+imageNonce}
function uploadButton(name){
 const b=document.createElement('button');b.type='button';b.className='item-photo-link';b.textContent='Add icon';b.title='Upload the real in-game inventory icon for '+name;
 b.dataset.iconItem=name;return b;
}
function thumbFor(name){
 const key=keyOf(name),thumb=document.createElement('div');thumb.className='item-thumb fallback';thumb.setAttribute('aria-hidden','true');
 const symbol=document.createElement('span');symbol.className='item-symbol';symbol.textContent='◇';thumb.append(symbol);
 const objectPath=imageMap.get(key);
 if(objectPath){const img=document.createElement('img');img.className='item-thumb';img.alt='';img.loading='lazy';img.src=iconAddress(objectPath);img.addEventListener('load',()=>{thumb.replaceWith(img)});img.addEventListener('error',()=>{img.remove()});}
 return thumb;
}
function decorateRow(row){
 if(row.dataset.iconified)return;
 const section=row.closest('tbody')?.id||'';
 const td=row.querySelector(':scope > td');if(!td||td.colSpan)return;
 let name=td.textContent.trim().replace(/\s*\(consumed\)\s*/i,'').trim();
 if(!name||/^no (remaining|matching)/i.test(name))return;
 // Keep exact in-game item names; never substitute an approximate image.
 row.dataset.iconified='yes';
 const cell=document.createElement('span');cell.className='image-cell';
 const badge=thumbFor(name),body=document.createElement('span'),label=document.createElement('span');label.className='item-name';label.textContent=name;
 body.append(label);const br=document.createElement('br'),button=uploadButton(name);body.append(br,button);cell.append(badge,body);
 td.textContent='';td.append(cell);
}
function decorateIcons(){
 if(!signedIn())return;
 for(const id of ['sellList','teamLoot',...pnames.map(p=>'personalLoot'+p)]){
  const t=$(id);if(!t)continue;
  t.querySelectorAll(':scope > tr').forEach(decorateRow);
 }
 // ISR recipe has four ingredient lists inside the stage container.
 const craft=$('airdropStages');
 if(craft)craft.querySelectorAll('tbody > tr').forEach(decorateRow);
}
async function api(path,method='GET',body=null,headersExtra={}){
 const conf=cfg(),session=auth();
 if(!conf?.url||!conf?.key||!session?.access_token)throw Error('Sign in before managing team data.');
 const headers={'apikey':conf.key,'Authorization':'Bearer '+session.access_token,...headersExtra};
 if(body!==null&&!(body instanceof Blob))headers['Content-Type']='application/json';
 const r=await fetch(conf.url.replace(/\/$/,'')+path,{method,headers,...(body!==null?{body:body instanceof Blob?body:JSON.stringify(body)}:{})});
 if(!r.ok){const message=await r.text().catch(()=>('HTTP '+r.status));throw Error(message.slice(0,160)||('HTTP '+r.status))}
 return r;
}
async function refreshImages(){
 if(!signedIn())return;
 try{
  const rows=await (await api('/rest/v1/unturnov_item_images?select=item_key,object_path&limit=3000')).json();
  const next=new Map(rows.map(x=>[x.item_key,x.object_path]));
  if(JSON.stringify([...next])!==JSON.stringify([...imageMap])){
   imageMap=next;document.querySelectorAll('[data-iconified]').forEach(r=>{delete r.dataset.iconified;const el=r.querySelector('.image-cell');if(el)el.replaceWith(document.createTextNode(el.querySelector('.item-name')?.textContent||''));});decorateIcons();
  }
 }catch(e){console.warn('Item icon lookup:',e.message)}
}
function openUpload(name){
 if(!signedIn()){toast('Sign in to upload item icons','error');return}
 currentUploadKey=keyOf(name);
 $('itemImageTitle').textContent='Inventory icon · '+name;
 $('itemImageFile').value='';$('itemImageStatus').textContent='Upload the actual in-game PNG, JPG, or WEBP icon (max 2 MB).';
 $('itemImageDialog').showModal();
}
function knownIconItems(){
 const found=new Map();
 const add=name=>{
  if(!name)return;const k=keyOf(name);
  if(!k||!found.has(k))found.set(k,String(name));
 };
 for(const x of window.unturnovSellCatalog||[])add(x.name);
 for(const q of Object.values(data()).flat())for(const g of q.goals||[])if(g.type!=='action')add(g.name);
 for(const x of window.unturnovAirdropNeeds?.()||[])add(x.name);
 return found;
}
async function sendBulkIcons(){
 const files=[...($('iconBulkFiles')?.files||[])];
 if(!signedIn()){toast('Sign in before uploading icons.','error');return}
 if(!files.length){toast('Choose actual exported game item icons.','error');return}
 const known=knownIconItems(),match=[],unmatched=[],unique=new Set();
 for(const file of files){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){unmatched.push(file.name);continue}
  const stem=file.name.replace(/\.(png|jpg|jpeg|webp)$/i,'').replace(/_\d+$/,'').replace(/_/g,' ').trim();
  const canonical=keyOf(stem);
  if(known.has(canonical)&&!unique.has(canonical)){unique.add(canonical);match.push({file,key:canonical})}
  else unmatched.push(file.name);
 }
 if(!match.length){toast('No exact filename matches. Upload icons individually or export matching game item names.','error');return}
 if(!confirm('Found '+match.length+' exact item-name image matches. '+unmatched.length+' files will be skipped (no guessing). Upload matching images to the shared site?'))return;
 const btn=$('iconBulkUpload');btn.disabled=true;
 let saved=0,failed=0,next=0;
 const status=$('iconBulkStatus');
 const update=()=>{if(status)status.textContent='Saved '+saved+' of '+match.length+' verified icons · '+failed+' errors · '+unmatched.length+' unmatched names skipped'};
 async function worker(){
  while(next<match.length){
   const item=match[next++];
   try{
    await api('/storage/v1/object/unturnov-item-icons/'+encodeURIComponent(item.key),'POST',item.file,{'Content-Type':item.file.type,'x-upsert':'true'});
    await api('/rest/v1/unturnov_item_images?on_conflict=item_key','POST',
     [{item_key:item.key,object_path:item.key,updated_at:new Date().toISOString()}],
     {'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'});
    saved++;
   }catch(e){failed++;console.warn('Image upload',item.file.name,e.message)}
   update();
  }
 }
 update();await Promise.all(Array.from({length:Math.min(3,match.length)},()=>worker()));
 btn.disabled=false;imageNonce++;await refreshImages();
 toast(saved+' game item icons added. '+unmatched.length+' unmatched names skipped.',failed?'error':'good');
}
async function sendIcon(){
 const file=$('itemImageFile').files?.[0];
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){toast('Choose a PNG, JPG or WEBP under 2 MB.','error');return}
 const button=$('itemImageUpload');button.disabled=true;
 try{
  // Object key uses canonical in-game item name so aliases share the exact icon.
  const path=currentUploadKey;
  await api('/storage/v1/object/unturnov-item-icons/'+encodeURIComponent(path),'POST',file,{'Content-Type':file.type,'x-upsert':'true'});
  await api('/rest/v1/unturnov_item_images?on_conflict=item_key','POST',
   [{item_key:currentUploadKey,object_path:path,updated_at:new Date().toISOString()}],
   {'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'});
  imageNonce++;
  $('itemImageDialog').close();
  await refreshImages();
  toast('Authentic game icon saved for your team.');
 }catch(e){$('itemImageStatus').textContent='Upload failed: '+e.message}
 finally{button.disabled=false}
}
function toast(message,kind='good'){
 const el=$('tacticalToast');if(!el)return;
 el.textContent=message;el.className='tactical-toast '+kind;el.hidden=false;
 clearTimeout(toast._timer);toast._timer=setTimeout(()=>el.hidden=true,4500);
}
async function syncActivity(){
 if(!signedIn()||!$('activityList'))return;
 try{
  const [quests,craft,decisions,members]=await Promise.all([
   api('/rest/v1/quest_events?select=event_id,player,quest_id,kind,created_at,author_uid,payload&order=seq.desc&limit=65').then(r=>r.json()),
   api('/rest/v1/airdrop_events?select=event_id,item_key,kind,created_at,author_uid,payload&order=seq.desc&limit=65').then(r=>r.json()),
   api('/rest/v1/unturnov_sell_overrides?select=item_key,decision,updated_at,author_uid&order=updated_at.desc&limit=35').then(r=>r.json()),
   api('/rest/v1/rpc/unturnov_member_names','POST',{}).then(r=>r.json())
  ]);
  memberMap=Object.fromEntries(members.map(x=>[x.user_id,x.display_name]));
  activityData=[
   ...quests.map(x=>({...x,category:'quest',stamp:x.created_at})),
   ...craft.map(x=>({...x,category:'craft',stamp:x.created_at})),
   ...decisions.map(x=>({...x,category:'sell',stamp:x.updated_at,kind:'decision'}))
  ].sort((a,b)=>new Date(b.stamp)-new Date(a.stamp)).slice(0,100);
  renderActivity();
 }catch(e){$('activityList').textContent='Could not load activity: '+e.message}
}
const activityName=x=>{
 const act=x.kind.replaceAll('_',' ');
 if(x.category==='sell')return 'Updated '+x.item_key+' to '+x.decision.toUpperCase();
 if(x.category==='craft')return act+' · '+(x.item_key||'Airdrop ISR');
 const q=(data()[x.player]||[]).find(z=>z.id===x.quest_id);
 return x.player+' · '+(q?.title||'Quest')+' · '+act;
};
function renderActivity(){
 const list=$('activityList');if(!list)return;
 const displayed=activityData.filter(x=>activityFilter==='all'||x.category===activityFilter).slice(0,50);
 list.innerHTML=displayed.map(x=>{
  const author=memberMap[x.author_uid]||'Earlier team change';
  const dt=new Date(x.stamp);const time=Number.isFinite(dt.getTime())?dt.toLocaleString():'Unknown time';
  return `<div class="activity-entry"><span class="activity-symbol" aria-hidden="true">${x.category==='quest'?'◈':x.category==='craft'?'▣':'↔'}</span><div><strong>${esc(activityName(x))}</strong><p>By ${esc(author)}</p></div><time class="activity-time">${esc(time)}</time></div>`;
 }).join('')||'<p class="muted">No activity yet.</p>';
}
window.unturnovToast=toast;
function boot(){
 const navigation=$('mainNav');if(navigation)navigation.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)go(b.dataset.view)});
 $all('[data-go-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goView)));
 $('activityScope')?.addEventListener('change',e=>{activityFilter=e.target.value;renderActivity()});
 $('itemImageUpload')?.addEventListener('click',()=>void sendIcon());
 $('iconBulkUpload')?.addEventListener('click',()=>void sendBulkIcons());
 $('itemImageCancel')?.addEventListener('click',()=>$('itemImageDialog')?.close());
 document.addEventListener('click',e=>{const b=e.target.closest('[data-icon-item]');if(b)openUpload(b.dataset.iconItem)});
 $('itemImageDialog')?.addEventListener('click',e=>{if(e.target===$('itemImageDialog'))$('itemImageDialog').close()});
 // Distinguish the sign-in view from synchronized private data at first paint.
 showAuth();go(view);renderDashboard();rowsMobile();decorateIcons();
 const observe=new MutationObserver(()=>{rowsMobile();decorateIcons();renderDashboard()});
 for(const id of ['sellList','teamLoot','airdropStages',...pnames.map(p=>'personalLoot'+p),...pnames.map(p=>'personalActions'+p)]){
  const target=$(id);if(target)observe.observe(target,{childList:true});
 }
 // The old tracker refreshes both quest and crafting views every 12 seconds.
 // Recompute derived dashboard and art once after those syncs.
 setInterval(()=>{showAuth();renderDashboard();void refreshImages();if(view==='activity')void syncActivity();},15000);
 window.addEventListener('focus',()=>{showAuth();renderDashboard()});
 window.addEventListener('unturnov:auth',()=>{showAuth();renderDashboard();if(signedIn())void refreshImages()});
 if(signedIn()){void refreshImages();void syncActivity()}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
