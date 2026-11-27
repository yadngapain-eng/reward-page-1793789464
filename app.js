let FB=null, state=null, currentUser=null;
async function initFirebase(){
  FB = await window.firebaseReady;
  await new Promise(res=>{
    const unsub = FB.onAuthStateChanged(FB.auth, async u=>{
      if(u){ currentUser=u; await loadUserState(); unsub(); res(); }
      else { unsub(); res(); }
    });
  });
}
async function ensureLogin(){
  if(currentUser) return true;
  try{ const r = await FB.signInWithPopup(FB.auth, FB.provider);
       currentUser=r.user; await loadUserState(); return true; }
  catch(e){ console.error('Login:',e); showLoginPrompt(e.message); return false; }
}
function showLoginPrompt(msg){
  const d=document.createElement('div');
  d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.8);display:grid;place-items:center;z-index:9999;padding:20px';
  d.innerHTML='<div style="background:#182140;padding:32px;border-radius:16px;text-align:center;max-width:400px"><h2 style="margin-bottom:12px">Masuk ke Duniamu</h2><p style="color:#93a0c7;margin-bottom:20px">'+(msg||'Login untuk menyimpan progres')+'</p><button id="btn-g" class="btn primary">🔐 Masuk dengan Google</button></div>';
  document.body.appendChild(d);
  document.getElementById('btn-g').onclick=async()=>{d.remove(); if(await ensureLogin()) location.reload();};
}
function refreshCoinPill(){
  document.querySelectorAll('#coin-pill').forEach(el=>{
    el.textContent = state ? '🪙 '+state.coins : '🔐 Login';
    el.style.cursor='pointer';
    el.onclick = ()=>{ if(!currentUser) ensureLogin().then(()=>location.reload()); else location.href='profile.html'; };
  });
}
async function f(){ return await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'); }
async function loadUserState(){
  const {doc,getDoc,setDoc,serverTimestamp}=await f();
  const ref=doc(FB.db,'users',currentUser.uid);
  const s=await getDoc(ref);
  if(s.exists()){ state=s.data(); state.history=state.history||[]; state.library=state.library||[]; state.readChapters=state.readChapters||[]; state.coins=state.coins||0; }
  else { state={displayName:currentUser.displayName||'Pembaca',email:currentUser.email||'',coins:0,library:[],lastCheckin:null,readChapters:[],history:[],createdAt:new Date().toISOString()};
         await setDoc(ref,{...state,createdAt:serverTimestamp()}); }
  refreshCoinPill();
}
async function saveUserState(patch){
  if(!currentUser) return;
  const {doc,updateDoc}=await f();
  await updateDoc(doc(FB.db,'users',currentUser.uid),patch);
  Object.assign(state,patch); refreshCoinPill();
}
async function fetchNovels(){
  const {collection,getDocs}=await f();
  const s=await getDocs(collection(FB.db,'novels'));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}
async function fetchChapter(nid,ch){
  const {doc,getDoc}=await f();
  const s=await getDoc(doc(FB.db,'novels',nid,'chapters',String(ch)));
  return s.exists()?s.data():null;
}
async function initHome(){
  const grid=document.getElementById('novel-grid'); if(!grid) return;
  const novels=await fetchNovels(); render(novels);
  document.querySelectorAll('#genre-filters .chip').forEach(b=>{
    b.onclick=()=>{document.querySelectorAll('#genre-filters .chip').forEach(x=>x.classList.remove('active')); b.classList.add('active');
      const g=b.dataset.genre; render(g==='all'?novels:novels.filter(n=>n.genre===g));};
  });
  function render(list){
    grid.innerHTML='';
    list.forEach(n=>{
      const c=document.createElement('a'); c.className='novel-card'; c.href='reader.html?id='+n.id;
      c.innerHTML='<img class="novel-cover" src="'+(n.cover||'')+'"/><div class="novel-body"><div class="novel-title">'+n.title+'</div><div class="novel-meta">'+n.author+' · '+n.genre+'</div><div class="novel-rating">⭐ '+n.rating+' · '+n.chapters+' bab</div><span class="novel-badge '+(n.free?'':'paid')+'">'+(n.free?'Gratis':'Berbayar')+'</span></div>';
      grid.appendChild(c);
    });
  }
}
async function initReader(){
  const p=new URLSearchParams(location.search), id=p.get('id')||'n1', ch=parseInt(p.get('ch')||'1',10);
  const novels=await fetchNovels(); const n=novels.find(x=>x.id===id)||novels[0]; if(!n) return;
  document.getElementById('novel-title').textContent=n.title;
  document.getElementById('novel-author').textContent=n.author+' · '+n.genre;
  const nav=document.getElementById('chapter-nav'); nav.innerHTML='';
  for(let i=1;i<=n.chapters;i++){
    const b=document.createElement('button'); b.textContent='Bab '+i; if(i===ch)b.classList.add('active');
    b.onclick=()=>location.href='reader.html?id='+id+'&ch='+i; nav.appendChild(b);
  }
  const chapter=await fetchChapter(id,ch);
  document.getElementById('chapter-content').innerHTML=chapter?chapter.content:'<p>Bab belum tersedia.</p>';
  document.getElementById('chapter-label').textContent='Bab '+ch+' / '+n.chapters;
  const prev=document.getElementById('prev-chapter'), next=document.getElementById('next-chapter');
  prev.disabled=ch<=1; next.disabled=ch>=n.chapters;
  prev.onclick=()=>location.href='reader.html?id='+id+'&ch='+(ch-1);
  next.onclick=()=>location.href='reader.html?id='+id+'&ch='+(ch+1);
  if(currentUser){
    const key=id+'#'+ch;
    if(!state.readChapters.includes(key)){
      await saveUserState({readChapters:[...state.readChapters,key],coins:state.coins+20,history:[{t:'Baca bab',d:n.title+' · Bab '+ch,coin:20,time:new Date().toISOString()},...state.history].slice(0,50)});
    }
  }
}
async function initLibrary(){
  const grid=document.getElementById('library-grid'), empty=document.getElementById('library-empty'); if(!grid) return;
  if(!currentUser){ grid.style.display='none'; empty.innerHTML='<p>Login untuk melihat library.</p><button class="btn primary" id="lib-login">Masuk</button>'; document.getElementById('lib-login').onclick=()=>ensureLogin().then(()=>location.reload()); return; }
  const novels=await fetchNovels(); const list=novels.filter(n=>state.library.includes(n.id));
  if(list.length===0){ grid.style.display='none'; empty.style.display='block'; return; }
  empty.style.display='none';
  list.forEach(n=>{
    const c=document.createElement('a'); c.className='novel-card'; c.href='reader.html?id='+n.id;
    c.innerHTML='<img class="novel-cover" src="'+(n.cover||'')+'"/><div class="novel-body"><div class="novel-title">'+n.title+'</div><div class="novel-meta">'+n.author+'</div></div>';
    grid.appendChild(c);
  });
}
async function initReward(){
  const btn=document.getElementById('btn-checkin'); if(!btn) return;
  if(!currentUser){ btn.disabled=false; btn.textContent='🔐 Login untuk check-in'; btn.onclick=()=>ensureLogin().then(()=>location.reload()); return; }
  const today=new Date().toISOString().slice(0,10);
  function refresh(){ if(state.lastCheckin===today){btn.disabled=true; btn.textContent='✅ Sudah check-in hari ini';} else {btn.disabled=false; btn.textContent='Check-in (+50 🪙)';} }
  refresh();
  btn.onclick=async()=>{ await saveUserState({coins:state.coins+50,lastCheckin:today,history:[{t:'Check-in harian',d:today,coin:50,time:new Date().toISOString()},...state.history].slice(0,50)}); refresh(); };
  document.getElementById('read-status').textContent=state.readChapters.length+' bab dibaca · +'+(state.readChapters.length*20)+' 🪙';
  const {collection,getDocs}=await f();
  const snap=await getDocs(collection(FB.db,'missions'));
  const ul=document.getElementById('mission-list'); ul.innerHTML='';
  snap.forEach(d=>{ const m=d.data(); if(!m.active) return;
    let done=false;
    if(m.type==='checkin') done=state.lastCheckin===today;
    else if(m.type==='read') done=state.readChapters.length>0;
    else if(m.type==='collect') done=state.coins>=100;
    const li=document.createElement('li'); li.className=done?'done':'';
    li.innerHTML='<span>'+m.label+'</span><span>'+(done?'✅':'—')+'</span>'; ul.appendChild(li);
  });
  const redeems=[{emoji:'🎟️',label:'Voucher 5rb',cost:500},{emoji:'☕',label:'Kopi gratis',cost:300},{emoji:'📚',label:'Novel premium',cost:1000},{emoji:'💎',label:'Diamond 10',cost:200}];
  const rg=document.getElementById('redeem-grid'); rg.innerHTML='';
  redeems.forEach(r=>{
    const d=document.createElement('div'); d.className='redeem-item';
    d.innerHTML='<div class="emoji">'+r.emoji+'</div><div>'+r.label+'</div><div class="muted small">'+r.cost+' 🪙</div><button class="btn ghost" '+(state.coins<r.cost?'disabled':'')+'>Tukar</button>';
    d.querySelector('button').onclick=async()=>{ if(state.coins<r.cost) return; await saveUserState({coins:state.coins-r.cost,history:[{t:'Tukar reward',d:r.label,coin:-r.cost,time:new Date().toISOString()},...state.history].slice(0,50)}); alert('Berhasil: '+r.label); location.reload(); };
    rg.appendChild(d);
  });
}
async function initProfile(){
  const name=document.getElementById('profile-name'); if(!name) return;
  const btn=document.getElementById('btn-reset');
  if(!currentUser){
    name.textContent='Belum login';
    document.getElementById('profile-stats').textContent='Masuk dengan Google untuk melihat statistik';
    btn.textContent='🔐 Masuk dengan Google'; btn.onclick=()=>ensureLogin().then(()=>location.reload());
    document.getElementById('history-list').innerHTML='<li><span>Login untuk melihat riwayat.</span></li>';
    return;
  }
  name.textContent=state.displayName||currentUser.displayName||'Pembaca';
  document.getElementById('profile-stats').textContent=(currentUser.email||'')+' · '+state.coins+' koin · '+state.library.length+' novel';
  const list=document.getElementById('history-list');
  if(!state.history||state.history.length===0){ list.innerHTML='<li><span>Belum ada riwayat.</span></li>'; }
  else { list.innerHTML=state.history.slice(0,20).map(h=>'<li><span>'+h.t+' — '+h.d+'</span><span>'+(h.coin>0?'+':'')+h.coin+' 🪙</span></li>').join(''); }
  btn.textContent='Keluar (Logout)';
  btn.onclick=async()=>{ await FB.signOut(FB.auth); location.reload(); };
}
document.addEventListener('DOMContentLoaded',async()=>{
  try{
    await initFirebase();
    const page=location.pathname.split('/').pop()||'index.html';
    if(page==='index.html'||page==='') await initHome();
    else if(page==='reader.html') await initReader();
    else if(page==='library.html') await initLibrary();
    else if(page==='reward.html') await initReward();
    else if(page==='profile.html') await initProfile();
  }catch(e){ console.error('Init:',e); }
});