import { db, auth } from './firebase-config.js';
import {
  doc, getDoc, collection, addDoc, serverTimestamp,
  query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let CONFIG = null;
let USER = null;
let CLAIMS = [];
let WITHDRAWALS = [];
const $ = id => document.getElementById(id);
const fmt = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

function toast(msg) {
  const t = $('toast'); if (!t) return alert(msg);
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// === TABS LOGIC ===
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
  };
});

// === AUTH ===
onAuthStateChanged(auth, u => {
  USER = u;
  if (u) {
    renderUserBar(u);
    loadConfig();
    listenUserData();
  } else {
    renderUserBar(null);
    CLAIMS = []; WITHDRAWALS = [];
    renderAll();
    renderWithdrawals();
  }
});

window.handleLogout = async () => {
  if (!confirm('Keluar dari akun?')) return;
  await signOut(auth);
  toast('Berhasil keluar');
};

function renderUserBar(u) {
  const bar = $('userBar'); if (!bar) return;
  if (!u) {
    bar.innerHTML = '<a href="login.html" class="btn-login">Masuk</a>';
    return;
  }
  const initial = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
  const avatar = u.photoURL 
    ? '<img src="' + u.photoURL + '" class="nav-avatar" alt="User"/>'
    : '<div class="nav-avatar-placeholder">' + initial + '</div>';
  bar.innerHTML = 
    '<div class="nav-user">' +
      avatar +
      '<span class="nav-name">' + (u.displayName || u.email.split('@')[0]) + '</span>' +
      '<button onclick="handleLogout()" class="btn-logout-icon" title="Keluar">✕</button>' +
    '</div>';
}

// === LOAD DATA ===
async function loadConfig() {
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) CONFIG = snap.data();
  } catch (e) { console.warn('loadConfig:', e.message); }
  if (!CONFIG) {
    CONFIG = {
      siteName: "Duniamu",
      slogan: "Selesaikan Misi, Hasilkan",
      missions: [
        { id: 1, title: "Star repo GitHub", reward: 10, link: "https://github.com" },
        { id: 2, title: "Fork repo GitHub", reward: 15, link: "https://github.com" }
      ],
      payments: [{ id: "dana", name: "DANA", holder: "Admin", active: true }]
    };
  }
  renderAll();
}

function listenUserData() {
  if (!USER) return;
  onSnapshot(query(collection(db, "claims"), where("userId", "==", USER.uid)),
    snap => { CLAIMS = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
  onSnapshot(query(collection(db, "withdrawals"), where("userId", "==", USER.uid)),
    snap => { WITHDRAWALS = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderWithdrawals(); renderAll(); });
}

// === LOGIC ===
function computeEarned() {
  return CLAIMS.filter(c => c.status !== 'rejected')
               .reduce((s, c) => s + Number(c.totalPoin || 0), 0);
}
function computeWithdrawn() {
  return WITHDRAWALS.filter(w => w.status === 'paid' || w.status === 'approved')
                    .reduce((s, w) => s + Number(w.amount || 0), 0);
}
function computeAvailable() { return Math.max(0, computeEarned() - computeWithdrawn()); }
function missionsClaimedIds() {
  const ids = new Set();
  CLAIMS.filter(c => c.status !== 'rejected').forEach(c => {
    (c.missions || []).forEach(m => ids.add(m.title));
  });
  return ids;
}

// === RENDER ===
function renderAll() {
  if (!CONFIG) return;
  if ($('siteSubtitle')) $('siteSubtitle').textContent = CONFIG.slogan || '';
  
  const doneTitles = missionsClaimedIds();
  const listEl = $('missionList');
  
  if (listEl) {
    listEl.innerHTML = '';
    (CONFIG.missions || []).forEach(m => {
      const done = doneTitles.has(m.title);
      const el = document.createElement('div');
      el.className = 'mission-card' + (done ? ' done' : '');
      el.innerHTML =
        '<div class="mission-info">' +
          '<div class="mission-title">' + m.title + '</div>' +
          '<div class="mission-reward">+' + m.reward + ' Poin</div>' +
        '</div>' +
        '<button class="btn-mission ' + (done ? 'btn-done' : '') + '" ' + (done || !USER ? 'disabled' : '') + '>' +
          (!USER ? 'Login Dulu' : (done ? 'Selesai' : 'Kerjakan')) +
        '</button>';
      
      el.querySelector('button').onclick = () => {
        if (!USER) return window.location.href = 'login.html';
        if (m.link) window.open(m.link, '_blank');
        toast('Misi ditandai selesai. Silakan klik Klaim Reward.');
        if ($('claimBtn')) {
          $('claimBtn').disabled = false;
          $('claimBtn').style.animation = 'pulse 1.5s infinite';
        }
      };
      listEl.appendChild(el);
    });
  }

  if ($('claimPayment')) {
    $('claimPayment').innerHTML = '<option value="">Pilih metode pembayaran</option>' +
      (CONFIG.payments || []).filter(p => p.active)
        .map(p => '<option value="' + p.name + '">' + p.name + '</option>').join('');
  }

  const totalPoin = computeEarned();
  if ($('totalMissions')) $('totalMissions').textContent = (CONFIG.missions || []).length;
  if ($('doneMissions')) $('doneMissions').textContent = doneTitles.size;
  if ($('totalReward')) $('totalReward').textContent = totalPoin;
  if ($('claimBtn')) {
    $('claimBtn').disabled = !USER || doneTitles.size === 0;
    $('claimBtn').style.animation = 'none';
  }
  if ($('withdrawAvailable')) $('withdrawAvailable').textContent = fmt(computeAvailable());
}

function renderWithdrawals() {
  const box = $('withdrawHistory'); if (!box) return;
  if (!WITHDRAWALS.length) {
    box.innerHTML = '<div class="empty-state">Belum ada riwayat penarikan.</div>'; 
    return;
  }
  box.innerHTML = WITHDRAWALS
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .map(w =>
      '<div class="history-item">' +
        '<div class="history-info">' +
          '<div class="history-amount">' + fmt(w.amount) + '</div>' +
          '<div class="history-method">' + (w.method === 'bank' ? 'Transfer Bank' : 'E-Wallet') + '</div>' +
        '</div>' +
        '<span class="badge ' + w.status + '">' + w.status + '</span>' +
      '</div>'
    ).join('');
}

// === ACTIONS ===
document.addEventListener('DOMContentLoaded', () => {
  if ($('claimBtn')) $('claimBtn').onclick = () => {
    if (!USER) return window.location.href = 'login.html';
    $('claimForm').style.display = 'flex';
    $('claimBtn').style.display = 'none';
  };

  if ($('submitClaim')) $('submitClaim').onclick = async () => {
    if (!USER) return toast('Masuk dulu');
    const name = $('claimName').value.trim();
    const contact = $('claimContact').value.trim();
    const paymentMethod = $('claimPayment').value;
    if (!name || !contact || !paymentMethod) return toast('Lengkapi data!');
    
    const doneTitles = missionsClaimedIds();
    const pending = (CONFIG.missions || []).filter(m => !doneTitles.has(m.title));
    if (!pending.length) return toast('Tidak ada misi baru untuk diklaim');
    
    const payloadMissions = pending.map(m => ({ title: m.title, reward: m.reward }));
    const totalPoin = payloadMissions.reduce((s, m) => s + Number(m.reward || 0), 0);
    
    $('submitClaim').disabled = true;
    try {
      await addDoc(collection(db, "claims"), {
        userId: USER.uid,
        userEmail: USER.email,
        userPhoto: USER.photoURL,
        userName: USER.displayName,
        name, contact, paymentMethod,
        missions: payloadMissions, totalPoin,
        status: "pending", createdAt: serverTimestamp()
      });
      toast('Klaim berhasil dikirim!');
      $('claimForm').style.display = 'none';
      $('claimBtn').style.display = 'block';
      $('submitClaim').disabled = false;
    } catch (e) { 
      toast('Gagal: ' + e.message); 
      $('submitClaim').disabled = false;
    }
  };

  if ($('withdrawForm')) $('withdrawForm').onsubmit = async (ev) => {
    ev.preventDefault();
    if (!USER) return window.location.href = 'login.html';
    
    const amount = Number($('wdAmount').value);
    const method = $('wdMethod').value;
    const accName = $('wdName').value.trim();
    const accNum = $('wdNumber').value.trim();
    const available = computeAvailable();
    
    if (!amount || amount <= 0) return toast('Jumlah tidak valid');
    if (amount > available) return toast('Saldo tidak cukup. Tersedia: ' + fmt(available));
    if (!accName || !accNum) return toast('Lengkapi data rekening');
    
    const btn = ev.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
    
    try {
      await addDoc(collection(db, "withdrawals"), {
        userId: USER.uid,
        userEmail: USER.email,
        userName: USER.displayName,
        amount, method,
        accountName: accName, accountNumber: accNum,
        status: 'pending', createdAt: serverTimestamp(),
        processedAt: null, adminNote: null
      });
      ev.target.reset();
      toast('Permintaan withdraw berhasil dikirim!');
    } catch (e) { 
      toast('Gagal: ' + e.message); 
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kirim Permintaan';
    }
  };
});
