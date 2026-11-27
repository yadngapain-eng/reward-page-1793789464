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

function refreshCoinPill() {
  const loginBtn = document.getElementById('btn-user-status');
  if (state && currentUser) {
    // Sudah login: Tampilkan nama user & koin
    if (loginBtn) {
      loginBtn.innerHTML = '👤 ' + (state.displayName ? state.displayName.split(' ')[0] : 'User');
      loginBtn.href = 'profile.html';
    }
  } else {
    // Belum login
    if (loginBtn) {
      loginBtn.innerHTML = '🔐 Login';
      loginBtn.href = 'profile.html';
    }
  }
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
    startReadTimer(id, ch, n.title);
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
    name.innerHTML='🔐 Belum Login';
    document.getElementById('history-list').innerHTML='<li><span>Login untuk melihat riwayat.</span></li>';
    const btn = document.getElementById('btn-reset');
    btn.textContent = '🔐 Masuk dengan Google';
    btn.className = 'btn primary'; // Tombol jadi warna oranye
    btn.onclick = () => ensureLogin().then(()=>location.reload());
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
  btn.className = 'btn ghost';
  btn.onclick=async()=>{ await FB.signOut(FB.auth); location.reload(); };
}

const AD_COIN_MIN = 10;
const AD_COIN_MAX = 100;
const AD_DAILY_LIMIT = 20;

function randomCoinReward() {
  return Math.floor(Math.random() * (AD_COIN_MAX - AD_COIN_MIN + 1)) + AD_COIN_MIN;
}
function todayStr() { return new Date().toISOString().slice(0,10); }
async function canClickAd() {
  if (!currentUser) return false;
  const today = todayStr();
  if (state.adClicksDate !== today) {
    await saveUserState({ adClicksDate: today, adClicksToday: 0 });
    return true;
  }
  return (state.adClicksToday || 0) < AD_DAILY_LIMIT;
}
async function rewardAdClick(source) {
  if (!currentUser) { _toast('Login dulu untuk dapat koin'); return 0; }
  if (!(await canClickAd())) {
    _toast('Batas klik iklan hari ini (' + AD_DAILY_LIMIT + 'x). Kembali besok.');
    return 0;
  }
  const reward = randomCoinReward();
  await saveUserState({
    coins: state.coins + reward,
    adClicksToday: (state.adClicksToday || 0) + 1,
    adClicksDate: todayStr(),
    adClickTotal: (state.adClickTotal || 0) + 1,
    history: [{t:'Klik iklan', d: source + ' · +' + reward + ' 🪙',
               coin: reward, time: new Date().toISOString()}, ...state.history].slice(0,100)
  });
  _toast('🎉 +' + reward + ' koin dari klik iklan!');
  return reward;
}
function _toast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
    'background:#182140;color:#fff;padding:12px 20px;border-radius:10px;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.4);z-index:9999;font-weight:600';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
function bindSmartlinkClicks() {
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-ad-link]');
    if (!a) return;
    setTimeout(() => rewardAdClick('Smartlink'), 500);
  });
}


// ============ REWARD BACA BAB (1 MENIT) ============
const READ_MIN_MS = 60 * 1000;   // 1 menit
let _readTimer = null;
let _readElapsed = 0;
let _readVisHandler = null;

function _readProgressBar(show) {
  let bar = document.getElementById('read-progress-bar');
  if (!bar && show) {
    bar = document.createElement('div');
    bar.id = 'read-progress-bar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:6px;' +
      'background:rgba(255,255,255,0.08);z-index:9999';
    bar.innerHTML = '<div id="read-progress-fill" ' +
      'style="height:100%;width:0;background:linear-gradient(90deg,#ff7a45,#ffb347);' +
      'transition:width 1s linear"></div>';
    document.body.appendChild(bar);
  } else if (bar && !show) {
    bar.remove();
  }
}

function _readUpdateProgress() {
  const fill = document.getElementById('read-progress-fill');
  if (!fill) return;
  const pct = Math.min(100, (_readElapsed / READ_MIN_MS) * 100);
  fill.style.width = pct + '%';
}

async function startReadTimer(novelId, chapter, novelTitle) {
  if (!currentUser) return;
  const key = novelId + '#' + chapter;
  if (state.readChapters.includes(key)) {
    // Sudah pernah dibaca → hanya catat kunjungan, tidak reward
    return;
  }
  _readElapsed = 0;
  _readProgressBar(true);
  _readUpdateProgress();

  // Timer hanya jalan saat tab aktif (anti-cheat)
  _readTimer = setInterval(() => {
    if (document.hidden) return;   // pause saat tab tidak aktif
    _readElapsed += 1000;
    _readUpdateProgress();
    if (_readElapsed >= READ_MIN_MS) {
      clearInterval(_readTimer);
      _readTimer = null;
      _readProgressBar(false);
      _grantReadReward(novelId, chapter, novelTitle);
    }
  }, 1000);

  // Handle tab disembunyikan/ditampilkan
  _readVisHandler = () => {
    if (document.hidden) return;
    _readUpdateProgress();
  };
  document.addEventListener('visibilitychange', _readVisHandler);
}

async function _grantReadReward(novelId, chapter, novelTitle) {
  const key = novelId + '#' + chapter;
  if (state.readChapters.includes(key)) return;
  const reward = randomCoinReward();   // pakai fungsi dari klik iklan (10-100)
  await saveUserState({
    coins: state.coins + reward,
    readChapters: [...state.readChapters, key],
    history: [{t:'Baca bab 1 menit', d: novelTitle + ' · Bab ' + chapter + ' · +' + reward + ' 🪙',
               coin: reward, time: new Date().toISOString()}, ...state.history].slice(0,100)
  });
  _toast('📖 +' + reward + ' koin — selesai baca Bab ' + chapter + '!');
}

function stopReadTimer() {
  if (_readTimer) { clearInterval(_readTimer); _readTimer = null; }
  if (_readVisHandler) {
    document.removeEventListener('visibilitychange', _readVisHandler);
    _readVisHandler = null;
  }
  _readProgressBar(false);
}

document.addEventListener('DOMContentLoaded',async()=>{
  try{
    await initFirebase();
    bindSmartlinkClicks();
    const page=location.pathname.split('/').pop()||'index.html';
    if(page==='index.html'||page==='') await initHome();
    else if(page==='reader.html') await initReader();
    window.addEventListener('beforeunload', stopReadTimer);
    else if(page==='library.html') await initLibrary();
    else if(page==='reward.html') await initReward();
    else if(page==='profile.html') await initProfile();
  }catch(e){ console.error('Init:',e); }
});