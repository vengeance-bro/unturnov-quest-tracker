(function unturnovApp(){
 'use strict';
 const players=['Nolan','Tyler','Kalob'], REPO='https://github.com/vengeance-bro/unturnov-quest-tracker';
 const store={cfg:'unturnov-supabase-public-config-v1',session:'unturnov-supabase-session-v1',events:'unturnov-v3-events',pending:'unturnov-v3-pending',profile:'unturnov-active-player-v1',filter:'unturnov-v3-filter',draft:'unturnov-v3-draft'};
 const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key));return v===null?fallback:v}catch{return fallback}};
 let conf=read(store.cfg,null),session=read(store.session,null),remote=read(store.events,[]),pending=read(store.pending,[]);
 if(!Array.isArray(remote))remote=[];if(!Array.isArray(pending))pending=[];
 let profile=players.includes(localStorage.getItem(store.profile))?localStorage.getItem(store.profile):'Nolan';
 let filter=localStorage.getItem(store.filter)||'active',search='',selected=null,edit=null,noteEditing=false,noteDraft='',model={Nolan:[],Tyler:[],Kalob:[]};
 let activeSync=false,lastSync=Number(localStorage.getItem('unturnov-v3-last-sync')||0)||null,serverError='',authEmail=session?.email||'',undoStack=[],editCounter=0;
 let eventIds=new Set(remote.map(e=>e.event_id)), maxSeq=Math.max(0,...remote.map(e=>Number(e.seq)||0));
 function persist(){try{localStorage.setItem(store.events,JSON.stringify(remote));localStorage.setItem(store.pending,JSON.stringify(pending))}catch(e){serverError='Browser storage is full. Download a backup immediately.'}}
 function rebuild(){model=globalThis.unturnovReduce(remote.concat(pending.map((e,i)=>({...e,seq:null,local_order:i+1}))))}
 function current(){return model[profile]||[]}
 function complete(q){return Array.isArray(q.goals)&&q.goals.every(g=>g.count>=g.total)}
 function shownQuests(){let a=current().filter(q=>filter==='deleted'?q.deleted:!q.deleted&&(filter==='all'||(filter==='completed'?complete(q):!complete(q))));const word=search.toLowerCase();if(word)a=a.filter(q=>[q.title,q.trader,...q.goals.map(g=>g.name)].join(' ').toLowerCase().includes(word));return a.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||a.title.localeCompare(b.title))}
 function activeQuest(){return current().find(q=>q.id===selected)}
 function autoSelect(){const visible=shownQuests();if(!visible.some(q=>q.id===selected))selected=visible[0]?.id||null}
 function timeText(t){return t?new Date(t).toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'}):'Never'}
 function ready(){return !!(conf?.url&&conf?.key&&session?.access_token)}
 function renderStatus(){const state=$('syncState');if(!state)return;let msg=serverError?'⚠ '+serverError:(!conf?'Not configured — local draft only':!session?.access_token?'Signed out — local edits queued':pending.length?pending.length+' change(s) waiting to upload':activeSync?'Checking cloud…':'Cloud synchronized');
 state.textContent=msg;state.className=serverError?'warn':pending.length?'pending':ready()?'good':'muted';$('lastSynced').textContent='Last cloud sync: '+timeText(lastSync);$('pendingCount').textContent=String(pending.length);$('accountLabel').textContent=authEmail||'Not signed in';
 }
 function renderTabs(){document.querySelectorAll('[data-player]').forEach(btn=>btn.classList.toggle('active',btn.dataset.player===profile))}
 function renderList(){
 const entries=shownQuests();$('questList').innerHTML=entries.length?entries.map(q=>`<button type="button" data-action="select" data-id="${esc(q.id)}" class="quest-row ${selected===q.id?'active':''}"><span><b>${q.pinned?'📌 ':''}${esc(q.title)}</b><small>${esc(q.trader)}</small></span><small>${q.goals.filter(g=>g.count>=g.total).length}/${q.goals.length} ${complete(q)?'✓':''}</small></button>`).join(''):'<p class="muted">No quests for this filter.</p>';
 const alive=current().filter(q=>!q.deleted), finished=alive.filter(complete).length;
 $('questStats').textContent=finished+' of '+alive.length+' complete';$('filterSelect').value=filter;$('search').value=search;
 }
 function renderDetail(){
 if(edit)return;
 const q=activeQuest();if(!q){$('questDetail').innerHTML='<div class="empty"><h2>Select a quest</h2><p>Choose a quest from the left or add a new one.</p></div>';return}
 if(noteEditing&&document.activeElement?.id==='notesBox')return;
 $('questDetail').innerHTML=`<div class="headline"><div><h2>${esc(q.title)} ${q.pinned?'📌':''}</h2><p>${esc(q.trader)} · ${complete(q)?'Completed':'In progress'} · +${Number(q.reward)||0} reputation</p></div><div class="actions"><button data-action="pin" data-id="${esc(q.id)}">${q.pinned?'Unpin':'📌 Pin'}</button><button data-action="edit" data-id="${esc(q.id)}">Edit</button></div></div>
 ${q.deleted?'<p class="warn">This quest is in Recently deleted.</p>':''}
 <div class="goals">${q.goals.map(g=>`<div class="goal-line"><div><div>${g.count>=g.total?'✅':'◯'} ${esc(g.name)}</div><small>${g.type==='action'?'Action':'Item'}</small></div><div class="count-actions"><button aria-label="Decrease" data-action="delta" data-id="${esc(q.id)}" data-goal="${esc(g.id)}" data-n="-1" ${q.deleted?'disabled':''}>−</button><strong>${g.count}/${g.total}</strong><button aria-label="Increase" data-action="delta" data-id="${esc(q.id)}" data-goal="${esc(g.id)}" data-n="1" ${q.deleted?'disabled':''}>+</button></div></div>`).join('')}</div>
 <div class="actions"><button data-action="complete" data-id="${esc(q.id)}" ${q.deleted?'disabled':''}>Mark completed</button><button data-action="reset" data-id="${esc(q.id)}" ${q.deleted?'disabled':''}>Reset progress</button><button data-action="${q.deleted?'restore':'delete'}" data-id="${esc(q.id)}" class="${q.deleted?'':'danger'}">${q.deleted?'Restore quest':'Move to Recently deleted'}</button></div>
 <h3>Quest notes / location</h3><textarea id="notesBox" placeholder="Where to find items, location details, plans…">${esc(q.notes||'')}</textarea><div class="actions"><button data-action="save-notes" data-id="${esc(q.id)}" class="primary">Save notes</button><small class="muted">Notes are shared across all browsers</small></div>`;
 }
 function canonical(name){const n=String(name).trim().toLowerCase();return /^(dogtag|dogtags|bundle of dogtags)$/i.test(n)?'Dogtags':name.trim()}
 function teamLoot(){
 const items=new Map();
 for(const player of players)for(const q of model[player]||[]){if(q.deleted||complete(q))continue;for(const g of q.goals){if(g.type==='action')continue;const name=canonical(g.name),mult=/^bundle of dogtags$/i.test(g.name)?10:1,needed=Math.max(0,(g.total-g.count)*mult);if(!needed)continue;const key=name.toLowerCase(),item=items.get(key)||{name,total:0,by:{Nolan:0,Tyler:0,Kalob:0}};item.total+=needed;item.by[player]+=needed;items.set(key,item)}}
 return [...items.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
 }
 function renderTeam(){
 const list=teamLoot();$('teamLoot').innerHTML=list.length?list.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.total}</td><td>${players.map(p=>x.by[p]?p+': '+x.by[p]:'').filter(Boolean).join(' · ')}</td></tr>`).join(''):'<tr><td colspan="3" class="muted">Nothing needed right now.</td></tr>';
 }
 function personalLoot(player){
 const items=new Map();
 for(const q of model[player]||[]){
  if(q.deleted||complete(q))continue;
  for(const g of q.goals){
   if(g.type==='action')continue;
   const name=canonical(g.name),mult=/^bundle of dogtags$/i.test(g.name)?10:1;
   const remaining=Math.max(0,(g.total-g.count)*mult);
   if(!remaining)continue;
   const key=name.toLowerCase(),item=items.get(key)||{name,total:0,quests:new Map()};
   item.total+=remaining;
   item.quests.set(q.title,(item.quests.get(q.title)||0)+remaining);
   items.set(key,item);
  }
 }
 return [...items.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
 }
 function renderPersonal(){
 for(const player of players){
  $('personal-'+player.toLowerCase()).hidden=player!==profile;
  if(player!==profile)continue;
  const list=personalLoot(player);
  $('personalLoot'+player).innerHTML=list.length?list.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.total}</td><td>${[...x.quests].map(([name,n])=>esc(name)+' ('+n+')').join(' · ')}</td></tr>`).join(''):'<tr><td colspan="3" class="muted">No remaining items for '+player+'’s unfinished quests.</td></tr>';
 }
 }
 function render(){rebuild();renderTabs();autoSelect();renderList();renderDetail();renderPersonal();renderTeam();renderStatus()}
 function emit(kind,qid,payload,reverse=null){const event={event_id:crypto.randomUUID(),player:profile,quest_id:qid,kind,payload,local_order:Date.now()+editCounter++};pending.push(event);if(reverse)undoStack.push({player:profile,qid,...reverse});persist();render();void sync();return event}
 function confirmEditorSwitch(){if(!edit)return true;if(!confirm('Discard unfinished quest changes?'))return false;edit=null;sessionStorage.removeItem(store.draft);return true}
 function showEditor(q){edit={id:q?.id||null,title:q?.title||'',trader:q?.trader||'',reward:q?.reward??1,goals:q?.goals?.map(g=>({...g}))||[{id:crypto.randomUUID(),name:'',total:1,type:'item',count:0}]};saveDraft();renderEditor()}
 function saveDraft(){if(edit)sessionStorage.setItem(store.draft,JSON.stringify({profile,draft:edit}))}
 function restoreDraft(){try{const d=JSON.parse(sessionStorage.getItem(store.draft));if(d&&d.profile===profile&&d.draft&&Array.isArray(d.draft.goals)){edit=d.draft;return true}}catch{}return false}
 function renderEditor(){if(!edit)return;const d=edit;
 $('questDetail').innerHTML=`<h2>${d.id?'Edit':'Add'} ${esc(profile)}’s Quest</h2>
 <label>Quest name<input id="editTitle" placeholder="e.g. Debut" value="${esc(d.title)}"></label><label>Trader<input id="editTrader" placeholder="e.g. Prapor" value="${esc(d.trader)}"></label><label>Reputation<input id="editReward" type="number" min="0" value="${Number(d.reward)||0}"></label>
 <h3>Items and objectives</h3><div id="goalEditor">${d.goals.map((g,i)=>`<div class="edit-goal" data-i="${i}"><input data-field="name" placeholder="Item or objective" value="${esc(g.name)}"><input data-field="total" type="number" min="1" value="${g.total}"><select data-field="type"><option value="item" ${g.type!=='action'?'selected':''}>Item</option><option value="action" ${g.type==='action'?'selected':''}>Action</option></select><button data-action="remove-goal" data-i="${i}" title="Remove objective">×</button></div>`).join('')}</div>
 <div class="actions"><button data-action="add-goal">+ Add item / objective</button><button data-action="save-quest" class="primary">Save quest</button><button data-action="cancel-edit">Cancel</button></div><p class="muted">Your unfinished form is protected from background updates and stored in this tab.</p>`;
 }
 function recordInputs(){if(!edit)return;const title=$('editTitle'),trader=$('editTrader');if(!title)return;edit.title=title.value;edit.trader=trader.value;edit.reward=Number($('editReward').value)||0;for(const row of document.querySelectorAll('.edit-goal')){const g=edit.goals[Number(row.dataset.i)];if(!g)continue;g.name=row.querySelector('[data-field="name"]').value;g.total=Number(row.querySelector('[data-field="total"]').value)||1;g.type=row.querySelector('[data-field="type"]').value}saveDraft()}
 function saveQuest(){recordInputs();if(!edit)return;const d=edit;if(!d.title.trim()||!d.trader.trim()||!d.goals.length||d.goals.some(g=>!g.name.trim()||!Number.isInteger(g.total)||g.total<1)){alert('Enter a quest name, trader, and valid item/quantity for every objective.');return}
 const qid=d.id||crypto.randomUUID(),before=activeQuest(),goals=d.goals.map(g=>({...g,name:g.name.trim(),total:Number(g.total),count:Number(g.count)||0}));
 const payload=d.id?{title:d.title.trim(),trader:d.trader.trim(),reward:d.reward,goals}:{quest:{id:qid,title:d.title.trim(),trader:d.trader.trim(),reward:d.reward,goals,pinned:false,notes:'',deleted:false}};
 edit=null;sessionStorage.removeItem(store.draft);filter='active';localStorage.setItem(store.filter,filter);selected=qid;emit(d.id?'quest_edited':'quest_created',qid,payload,d.id?{kind:'quest_edited',payload:{title:before?.title,trader:before?.trader,reward:before?.reward,goals:before?.goals}}:{kind:'quest_deleted',payload:{}})}
 function changePlayer(player){if(!players.includes(player)||player===profile)return;if(!confirmEditorSwitch())return;profile=player;localStorage.setItem(store.profile,profile);selected=null;noteEditing=false;render()}
 function undoLast(){const last=undoStack.pop();if(!last){alert('No recent change to undo in this session.');return}const prev=profile;profile=last.player;emit(last.kind,last.qid,last.payload);profile=prev;render()}
 function download(filename,body){const b=new Blob([JSON.stringify(body,null,2)],{type:'application/json'}),a=document.createElement('a'),url=URL.createObjectURL(b);a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
 function exportBackup(){download('unturnov-backup-'+new Date().toISOString().slice(0,10)+'.json',{app:'Unturnov',version:3,exported:new Date().toISOString(),profiles:model,events:remote,pending});}
 async function importBackup(input){const file=input.files?.[0];if(!file)return;try{const d=JSON.parse(await file.text());const profiles=d.profiles||(d.quests?{[profile]:d.quests}:null);if(!profiles||!confirm('Restore quest data from this file by appending updates to shared history? Existing quests with matching IDs will be updated.'))return;for(const player of players){if(!Array.isArray(profiles[player]))continue;const previous=profile;profile=player;const existing=new Map(current().map(q=>[q.id,q]));for(const q of profiles[player]){if(!q.id||!Array.isArray(q.goals))continue;if(existing.has(q.id)){emit('quest_edited',q.id,{title:q.title,trader:q.trader,reward:q.reward,goals:q.goals});for(const g of q.goals)emit('goal_set',q.id,{goal_id:g.id,count:g.count});emit('quest_note',q.id,{notes:q.notes||''});emit('quest_pinned',q.id,{pinned:!!q.pinned});if(q.deleted)emit('quest_deleted',q.id,{})}else emit('quest_created',q.id,{quest:q})}profile=previous}render();alert('Backup queued. Watch the sync status until pending changes reach zero.')}catch(e){alert('Could not load backup: '+e.message)}finally{input.value=''}}
 async function api(path,method='GET',body=null,prefer=''){const headers={'apikey':conf.key,'Authorization':'Bearer '+(session?.access_token||conf.key)};if(body!==null){headers['Content-Type']='application/json';if(prefer)headers['Prefer']=prefer}return fetch(conf.url.replace(/\/$/,'')+path,{method,headers,...(body!==null?{body:JSON.stringify(body)}:{})})}
 async function refreshAuth(){if(!session?.refresh_token)return false;if(Date.now()<Number(session.expires_at||0)-60000)return true;try{const r=await fetch(conf.url.replace(/\/$/,'')+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:conf.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok)throw Error('Please sign in again');const d=await r.json();session={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Date.now()+d.expires_in*1000,email:d.user?.email||authEmail};authEmail=session.email||'';localStorage.setItem(store.session,JSON.stringify(session));return true}catch(e){serverError=String(e.message);renderStatus();return false}}
 async function login(){const email=$('loginEmail').value.trim(),password=$('loginPassword').value;if(!conf?.url||!conf?.key){alert('Enter your Supabase project settings under Connection first.');return}if(!email||!password){alert('Enter email and password.');return}try{const r=await fetch(conf.url.replace(/\/$/,'')+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:conf.key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});if(!r.ok)throw Error('Sign-in failed ('+r.status+'). Check your approved account and password.');const d=await r.json();session={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Date.now()+d.expires_in*1000,email:d.user?.email||email};authEmail=session.email;localStorage.setItem(store.session,JSON.stringify(session));$('loginPassword').value='';serverError='';renderStatus();await sync()}catch(e){serverError=e.message;renderStatus()}}
 function logout(){if(!confirm('Sign out? Unsynced changes remain queued on this browser.'))return;session=null;authEmail='';localStorage.removeItem(store.session);renderStatus()}
 function saveConnection(){const url=$('projectUrl').value.trim().replace(/\/$/,''),key=$('publicKey').value.trim();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!(key.startsWith('sb_publishable_')||key.startsWith('eyJ'))){alert('Enter a Supabase Project URL and publishable (or legacy anon) key. Never use a secret key.');return}conf={url,key};localStorage.setItem(store.cfg,JSON.stringify(conf));serverError='';renderStatus();}
 async function fetchDeltas(){let loops=0;while(loops++<100){const path='/rest/v1/quest_events?seq=gt.'+maxSeq+'&select=seq,event_id,player,quest_id,kind,payload&order=seq.asc&limit=500';const r=await api(path);if(!r.ok){const m=await r.text();throw Error(r.status===404?'Run the v3 Supabase database migration first.':('Cloud read error '+r.status+': '+m.slice(0,120)))}const rows=await r.json();if(!Array.isArray(rows))throw Error('Unexpected cloud response');for(const x of rows){if(!eventIds.has(x.event_id)){remote.push(x);eventIds.add(x.event_id)}maxSeq=Math.max(maxSeq,Number(x.seq)||0)}if(rows.length<500)break}}
 async function uploadPending(){while(pending.length){const e=pending[0];const row={event_id:e.event_id,player:e.player,quest_id:e.quest_id,kind:e.kind,payload:e.payload};const r=await api('/rest/v1/quest_events?on_conflict=event_id','POST',[row],'resolution=ignore-duplicates,return=representation');if(!r.ok){let msg=await r.text();throw Error('Cloud write error '+r.status+': '+msg.slice(0,120))}const inserted=await r.json();if(inserted?.[0]){const x=inserted[0];if(!eventIds.has(x.event_id)){remote.push(x);eventIds.add(x.event_id)}/* Do not advance fetched cursor here: earlier concurrent writes may still be unseen. */}pending.shift();persist();renderStatus()}}
 async function sync(){if(activeSync||!ready())return;activeSync=true;serverError='';renderStatus();try{if(!await refreshAuth())return;await fetchDeltas();await uploadPending();await fetchDeltas();persist();lastSync=Date.now();localStorage.setItem('unturnov-v3-last-sync',String(lastSync));render()}catch(e){serverError=e.message;renderStatus()}finally{activeSync=false;renderStatus()}}
 function handleClick(event){const btn=event.target.closest('button');if(!btn)return;
 const action=btn.dataset.action, id=btn.dataset.id,goal=btn.dataset.goal;const q=current().find(q=>q.id===id);
 if(btn.dataset.player){changePlayer(btn.dataset.player);return}
 if(action==='select'){if(edit&&!confirmEditorSwitch())return;selected=id;noteEditing=false;render();return}
 if(action==='add-quest'){if(!confirmEditorSwitch())return;showEditor();return}
 if(action==='edit'&&q){if(!confirmEditorSwitch())return;showEditor(q);return}
 if(action==='cancel-edit'){edit=null;sessionStorage.removeItem(store.draft);render();return}
 if(action==='add-goal'){recordInputs();edit.goals.push({id:crypto.randomUUID(),name:'',total:1,type:'item',count:0});saveDraft();renderEditor();return}
 if(action==='remove-goal'){recordInputs();edit.goals.splice(Number(btn.dataset.i),1);saveDraft();renderEditor();return}
 if(action==='save-quest'){saveQuest();return}
 if(action==='delta'&&q){const old=q.goals.find(g=>g.id===goal);if(!old)return;emit('goal_delta',q.id,{goal_id:goal,delta:Number(btn.dataset.n)},{kind:'goal_delta',payload:{goal_id:goal,delta:-Number(btn.dataset.n)}});return}
 if(action==='complete'||action==='reset'){if(!q)return;for(const g of q.goals){const n=action==='complete'?g.total:0;emit('goal_set',q.id,{goal_id:g.id,count:n},{kind:'goal_set',payload:{goal_id:g.id,count:g.count}})}return}
 if(action==='pin'&&q){emit('quest_pinned',id,{pinned:!q.pinned},{kind:'quest_pinned',payload:{pinned:q.pinned}});return}
 if(action==='delete'&&q){if(confirm('Move quest to Recently deleted? You can restore it later.')){emit('quest_deleted',id,{}, {kind:'quest_restored',payload:{}});selected=null;render()}return}
 if(action==='restore'&&q){emit('quest_restored',id,{}, {kind:'quest_deleted',payload:{}});return}
 if(action==='save-notes'&&q){noteEditing=false;const notes=$('notesBox').value;emit('quest_note',id,{notes},{kind:'quest_note',payload:{notes:q.notes||''}});return}
 if(action==='undo'){undoLast();return}
 if(action==='export'){exportBackup();return}
 if(action==='login'){void login();return}
 if(action==='logout'){logout();return}
 if(action==='save-config'){saveConnection();return}
 if(action==='sync'){void sync();return}
 }
 function init(){
 $('tabs').innerHTML=players.map(p=>`<button type="button" data-player="${p}" class="tab">${p}’s Quests</button>`).join('');
 $('filterSelect').value=filter;
 $('filterSelect').onchange=e=>{if(!confirmEditorSwitch()){e.target.value=filter;return}filter=e.target.value;localStorage.setItem(store.filter,filter);selected=null;render()};
 $('search').oninput=e=>{search=e.target.value;renderList()};
 $('backupFile').onchange=e=>void importBackup(e.target);
 document.addEventListener('click',handleClick);
 document.addEventListener('input',e=>{if(edit&&$('questDetail').contains(e.target)&&e.target.id!=='notesBox')recordInputs()});
 document.addEventListener('change',e=>{if(edit&&$('questDetail').contains(e.target))recordInputs()});
 document.addEventListener('focusin',e=>{if(e.target?.id==='notesBox')noteEditing=true});
 document.addEventListener('focusout',e=>{if(e.target?.id==='notesBox')noteEditing=false});
 if(conf){$('projectUrl').value=conf.url;$('publicKey').value=conf.key}
 if(restoreDraft())renderEditor();
 render();if(edit)renderEditor();
 setInterval(()=>{void sync()},12000);
 window.addEventListener('focus',()=>void sync());
 window.addEventListener('online',()=>void sync());
 void sync();
 }
 init();
})();
