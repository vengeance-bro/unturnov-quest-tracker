globalThis.unturnovReduce=function unturnovReduce(inputEvents){
 const profiles={Nolan:[],Tyler:[],Kalob:[]};
 const events=[...inputEvents].sort((a,b)=>(a.seq??Number.MAX_SAFE_INTEGER)-(b.seq??Number.MAX_SAFE_INTEGER)||(a.local_order||0)-(b.local_order||0));
 for(const e of events){
  const list=profiles[e.player];if(!list)continue;
  const payload=e.payload||{};
  let q=list.find(q=>q.id===e.quest_id);
  if(e.kind==='quest_created'){
   const source=payload.quest;
   if(!source||!source.id||q)continue;
   list.push({...source,pinned:!!source.pinned,notes:source.notes||'',deleted:!!source.deleted,
      goals:Array.isArray(source.goals)?source.goals.map(g=>({...g,count:Math.min(Math.max(Number(g.count)||0,0),Math.max(Number(g.total)||1,1))})):[]});
   continue;
  }
  if(!q)continue;
  if(e.kind==='quest_edited'){
   for(const key of ['title','trader','reward'])if(payload[key]!==undefined)q[key]=payload[key];
   if(Array.isArray(payload.goals))q.goals=payload.goals.map(g=>{
    const old=q.goals.find(x=>x.id===g.id);
    return {...g,count:Math.min(Math.max(old?.count??g.count??0,0),Math.max(g.total,1))}
   });
  }
  else if(e.kind==='quest_deleted')q.deleted=true;
  else if(e.kind==='quest_restored')q.deleted=false;
  else if(e.kind==='quest_pinned')q.pinned=!!payload.pinned;
  else if(e.kind==='quest_note')q.notes=String(payload.notes||'');
  else if(e.kind==='goal_delta'||e.kind==='goal_set'){
   const g=q.goals.find(g=>g.id===payload.goal_id);if(!g)continue;
   const desired=e.kind==='goal_delta'?g.count+Number(payload.delta||0):Number(payload.count||0);
   g.count=Math.min(Math.max(desired,0),g.total);
  }
 }
 return profiles;
};
