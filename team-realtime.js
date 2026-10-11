(function(){
 'use strict';
 // Optional Realtime accelerator. Existing 12-second REST polling remains the
 // authoritative fallback when the WebSocket, auth, or network is unavailable.
 const CONFIG_KEY='unturnov-supabase-public-config-v1',SESSION_KEY='unturnov-supabase-session-v1';
 const tables=['quest_events','airdrop_events','unturnov_sell_overrides','unturnov_item_catalog','unturnov_item_images'];
 const topic='realtime:unturnov-team';
 let socket=null,heartbeat=null,reconnect=null,refreshTimer=null,sequence=0,joinRef='1',connectedToken='',state='Polling';
 const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
 const status=next=>{
  state=next;
  const el=document.getElementById('teamRealtimeState');
  if(el){el.textContent=next;el.title=next==='Live'?'Fast team updates connected. REST polling remains enabled.':'Regular cloud sync checks every 12 seconds.'}
 };
 const session=()=>read(SESSION_KEY),config=()=>read(CONFIG_KEY);
 const send=(event,payload={},target=topic,reference=joinRef)=>{
  if(socket?.readyState!==1)return;
  socket.send(JSON.stringify({topic:target,event,payload,ref:String(++sequence),join_ref:target===topic?reference:null}));
 };
 const notify=()=>{
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>{
   window.dispatchEvent(new Event('unturnov:cloud-update'));
  },450);
 };
 const stop=()=>{
  clearInterval(heartbeat);clearTimeout(reconnect);clearTimeout(refreshTimer);
  heartbeat=reconnect=refreshTimer=null;
  const old=socket;socket=null;connectedToken='';
  if(old){old.onclose=old.onmessage=old.onerror=old.onopen=null;try{old.close()}catch{}}
  status('Polling');
 };
 const retry=()=>{
  clearTimeout(reconnect);
  if(session()?.access_token&&navigator.onLine!==false)
   reconnect=setTimeout(connect,5000);
 };
 function connect(){
  const c=config(),a=session();
  if(!c?.url||!c?.key||!a?.access_token||typeof WebSocket==='undefined'||navigator.onLine===false){stop();return}
  if(socket&&(socket.readyState===0||socket.readyState===1)){
   if(connectedToken!==a.access_token){
    connectedToken=a.access_token;
    send('access_token',{access_token:a.access_token});
   }
   return;
  }
  const url=c.url.replace(/^http/,'ws').replace(/\/$/,'')+'/realtime/v1/websocket?apikey='+encodeURIComponent(c.key)+'&vsn=1.0.0';
  try{
   status('Connecting');
   const ws=new WebSocket(url);socket=ws;connectedToken=a.access_token;
   ws.onopen=()=>{
    if(socket!==ws)return;
    joinRef=String(++sequence);
    send('phx_join',{
     config:{broadcast:{self:false},presence:{enabled:false},postgres_changes:tables.map(table=>({event:'*',schema:'public',table}))},
     access_token:connectedToken
    },topic,joinRef);
    heartbeat=setInterval(()=>send('heartbeat',{},'phoenix',null),25000);
   };
   ws.onmessage=e=>{
    if(socket!==ws)return;
    let msg;try{msg=JSON.parse(e.data)}catch{return}
    if(msg.event==='phx_reply'&&msg.payload?.status==='ok'&&msg.topic===topic){
     status('Live');notify();
    }else if(msg.event==='postgres_changes'){notify()}
    else if(msg.event==='phx_error'||(msg.event==='phx_reply'&&msg.payload?.status==='error')){
     status('Polling');try{ws.close()}catch{}
    }
   };
   ws.onerror=()=>status('Polling');
   ws.onclose=()=>{
    if(socket!==ws)return;
    socket=null;clearInterval(heartbeat);heartbeat=null;status('Polling');retry();
   };
  }catch{socket=null;status('Polling');retry()}
 }
 window.addEventListener('unturnov:auth',()=>{stop();connect()});
 window.addEventListener('online',connect);
 window.addEventListener('offline',stop);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)connect()});
 setInterval(()=>{if(session()?.access_token)connect();else if(socket)stop()},12000);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect);else connect();
 window.unturnovRealtimeDisconnect=stop;
})();
