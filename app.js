// Duniamu — Firestore + Auth anonim
let FB = null;  // { app, auth, db }
let state = null;
let currentUser = null;

async function initFirebase() {
  FB = await window.firebaseReady;
  const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  await new Promise(resolve => {
    const unsub = onAuthStateChanged(FB.auth, async (u) => {
      if (u) { currentUser = u; await loadUserState(); unsub(); resolve(); }
    });
  });
}

async function loadUserState() {
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const ref = doc(FB.db, 'users', currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    state = snap.data();
    if (!state.history) state.history = [];
    if (!state.library) state.library = [];
    if (!state.readChapters) state.readChapters = [];
    if (typeof state.coins !== 'number') state.coins = 0;
  } else {
    state = { coins: 0, library: [], lastCheckin: null, readChapters: [], history: [], createdAt: new Date().toISOString() };
    const { setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await setDoc(ref, { ...state, createdAt: serverTimestamp() });
  }
  refreshCoinPill();
}

async function saveUserState(patch) {
  const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const ref = doc(FB.db, 'users', currentUser.uid);
  await updateDoc(ref, patch);
  Object.assign(state, patch);
  refreshCoinPill();
}

function refreshCoinPill() {
  document.querySelectorAll('#coin-pill').forEach(el => el.textContent = '🪙 ' + (state?.coins || 0));
}

async function fetchNovels() {
  const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDocs(collection(FB.db, 'novels'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchChapter(novelId, ch) {
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDoc(doc(FB.db, 'novels', novelId, 'chapters', String(ch)));
  return snap.exists() ? snap.data() : null;
}

// ---------- HOME ----------
async function initHome() {
  const grid = document.getElementById('novel-grid');
  if (!grid) return;
  const novels = await fetchNovels();
  render(novels);
  document.querySelectorAll('#genre-filters .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#genre-filters .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const g = btn.dataset.genre;
      render(g === 'all' ? novels : novels.filter(n => n.genre === g));
    });
  });
  function render(list) {
    grid.innerHTML = '';
    list.forEach(n => {
      const c = document.createElement('a');
      c.className = 'novel-card';
      c.href = 'reader.html?id=' + n.id;
      c.innerHTML = '<img class="novel-cover" src="' + (n.cover||'') + '" alt="' + n.title + '"/>' +
        '<div class="novel-body"><div class="novel-title">' + n.title + '</div>' +
        '<div class="novel-meta">' + n.author + ' · ' + n.genre + '</div>' +
        '<div class="novel-rating">⭐ ' + n.rating + ' · ' + n.chapters + ' bab</div>' +
        '<span class="novel-badge ' + (n.free?'':'paid') + '">' + (n.free?'Gratis':'Berbayar') + '</span></div>';
      grid.appendChild(c);
    });
  }
}

// ---------- READER ----------
async function initReader() {
  const p = new URLSearchParams(location.search);
  const id = p.get('id') || 'n1';
  const ch = parseInt(p.get('ch') || '1', 10);
  const novels = await fetchNovels();
  const n = novels.find(x => x.id === id) || novels[0];
  if (!n) return;
  document.getElementById('novel-title').textContent = n.title;
  document.getElementById('novel-author').textContent = n.author + ' · ' + n.genre;
  const nav = document.getElementById('chapter-nav');
  nav.innerHTML = '';
  for (let i = 1; i <= n.chapters; i++) {
    const b = document.createElement('button');
    b.textContent = 'Bab ' + i;
    if (i === ch) b.classList.add('active');
    b.onclick = () => location.href = 'reader.html?id=' + id + '&ch=' + i;
    nav.appendChild(b);
  }
  const chapter = await fetchChapter(id, ch);
  document.getElementById('chapter-content').innerHTML = chapter ? chapter.content : '<p>Bab belum tersedia.</p>';
  document.getElementById('chapter-label').textContent = 'Bab ' + ch + ' / ' + n.chapters;
  const prev = document.getElementById('prev-chapter'), next = document.getElementById('next-chapter');
  prev.disabled = ch <= 1; next.disabled = ch >= n.chapters;
  prev.onclick = () => location.href = 'reader.html?id=' + id + '&ch=' + (ch-1);
  next.onclick = () => location.href = 'reader.html?id=' + id + '&ch=' + (ch+1);
  const key = id + '#' + ch;
  if (!state.readChapters.includes(key)) {
    const patch = {
      readChapters: [...state.readChapters, key],
      coins: state.coins + 20,
      history: [{t:'Baca bab', d:n.title+' · Bab '+ch, coin:20, time:new Date().toISOString()}, ...state.history].slice(0,50)
    };
    await saveUserState(patch);
  }
}

// ---------- LIBRARY ----------
async function initLibrary() {
  const grid = document.getElementById('library-grid'), empty = document.getElementById('library-empty');
  if (!grid) return;
  const novels = await fetchNovels();
  const list = novels.filter(n => state.library.includes(n.id));
  if (list.length === 0) { grid.style.display='none'; return; }
  empty.style.display = 'none';
  list.forEach(n => {
    const c = document.createElement('a');
    c.className = 'novel-card';
    c.href = 'reader.html?id=' + n.id;
    c.innerHTML = '<img class="novel-cover" src="' + (n.cover||'') + '"/>' +
      '<div class="novel-body"><div class="novel-title">' + n.title + '</div>' +
      '<div class="novel-meta">' + n.author + '</div></div>';
    grid.appendChild(c);
  });
}

// ---------- REWARD ----------
async function initReward() {
  const btn = document.getElementById('btn-checkin');
  if (!btn) return;
  const today = new Date().toISOString().slice(0,10);
  function refresh() {
    if (state.lastCheckin === today) {
      btn.disabled = true; btn.textContent = '✅ Sudah check-in hari ini';
    } else {
      btn.disabled = false; btn.textContent = 'Check-in (+50 🪙)';
    }
  }
  refresh();
  btn.onclick = async () => {
    await saveUserState({
      coins: state.coins + 50,
      lastCheckin: today,
      history: [{t:'Check-in harian', d:today, coin:50, time:new Date().toISOString()}, ...state.history].slice(0,50)
    });
    refresh();
  };
  document.getElementById('read-status').textContent =
    state.readChapters.length + ' bab dibaca · +' + (state.readChapters.length*20) + ' 🪙';
  // Missions dari Firestore
  const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDocs(collection(FB.db, 'missions'));
  const ul = document.getElementById('mission-list'); ul.innerHTML = '';
  snap.forEach(d => {
    const m = d.data();
    if (!m.active) return;
    let done = false;
    if (m.type === 'checkin') done = state.lastCheckin === today;
    else if (m.type === 'read') done = state.readChapters.length > 0;
    else if (m.type === 'collect') done = state.coins >= 100;
    const li = document.createElement('li');
    li.className = done ? 'done' : '';
    li.innerHTML = '<span>' + m.label + '</span><span>' + (done?'✅':'—') + '</span>';
    ul.appendChild(li);
  });
  // Redeem (hardcoded — bisa dipindah ke Firestore nanti)
  const redeems = [
    {emoji:'🎟️', label:'Voucher 5rb', cost:500},
    {emoji:'☕', label:'Kopi gratis', cost:300},
    {emoji:'📚', label:'Novel premium', cost:1000},
    {emoji:'💎', label:'Diamond 10', cost:200},
  ];
  const rg = document.getElementById('redeem-grid'); rg.innerHTML = '';
  redeems.forEach(r => {
    const div = document.createElement('div');
    div.className = 'redeem-item';
    div.innerHTML = '<div class="emoji">' + r.emoji + '</div><div>' + r.label + '</div>' +
      '<div class="muted small">' + r.cost + ' 🪙</div>' +
      '<button class="btn ghost" ' + (state.coins < r.cost ? 'disabled' : '') + '>Tukar</button>';
    div.querySelector('button').onclick = async () => {
      if (state.coins < r.cost) return;
      await saveUserState({
        coins: state.coins - r.cost,
        history: [{t:'Tukar reward', d:r.label, coin:-r.cost, time:new Date().toISOString()}, ...state.history].slice(0,50)
      });
      alert('Berhasil menukar: ' + r.label);
      location.reload();
    };
    rg.appendChild(div);
  });
}

// ---------- PROFILE ----------
async function initProfile() {
  const name = document.getElementById('profile-name');
  if (!name) return;
  name.textContent = 'Pembaca ' + currentUser.uid.slice(0,6);
  document.getElementById('profile-stats').textContent =
    state.coins + ' koin · ' + state.library.length + ' novel tersimpan';
  const list = document.getElementById('history-list');
  if (!state.history || state.history.length === 0) {
    list.innerHTML = '<li><span>Belum ada riwayat.</span></li>';
  } else {
    list.innerHTML = state.history.slice(0,20).map(h =>
      '<li><span>' + h.t + ' — ' + h.d + '</span><span>' + (h.coin>0?'+':'') + h.coin + ' 🪙</span></li>'
    ).join('');
  }
  document.getElementById('btn-reset').onclick = async () => {
    if (confirm('Reset semua progres?')) {
      await saveUserState({ coins:0, library:[], lastCheckin:null, readChapters:[], history:[] });
      location.reload();
    }
  };
}

// ---------- ROUTER ----------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initFirebase();
    const page = location.pathname.split('/').pop() || 'index.html';
    if (page === 'index.html' || page === '') await initHome();
    else if (page === 'reader.html') await initReader();
    else if (page === 'library.html') await initLibrary();
    else if (page === 'reward.html') await initReward();
    else if (page === 'profile.html') await initProfile();
  } catch (e) {
    console.error('Init error:', e);
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="padding:20px;background:#3a1010;color:#fff;margin:10px;border-radius:10px">⚠️ Firebase error: ' + e.message + '</div>');
  }
});