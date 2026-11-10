import { db, auth } from './firebase-config.js';
import {
  doc, getDoc, collection, addDoc, serverTimestamp,
  query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let CONFIG = { missions: [], slogan: "Selesaikan Misi, Hasilkan" };
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

// === LOAD DATA (Hapus data dummy) ===
async function loadConfig() {
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) {
      CONFIG = snap.data();
    } else {
      // Jika admin belum mengisi, biarkan kosong (tidak ada misi dummy)
      CONFIG = { missions: [], slogan: "Selesaikan Misi, Hasilkan" };
    }
  } catch (e) { 
    console.warn('loadConfig:', e.message);
    CONFIG = { missions: [], slogan: "Selesaikan Misi, Hasilkan" };
  }
  renderAll();
}

function listenUserData() {
  if (!USER) return;
  // Listen klaim misi (untuk hitung saldo)
  onSnapshot(query(collection(db, "claims"), where("userId", "==", USER.uid)),
    snap => { CLAIMS = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); });
  // Listen withdraw
  onSnapshot(query(collection(db, "withdrawals"), where("userId", "==", USER.uid)),
    snap => { WITHDRAWALS = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderWithdrawals(); renderAll(); });
}

// === LOGIC SALDO ===
function computeEarned() {
  return CLAIMS.filter(c => c.status !== 'rejected')
               .reduce((s, c) => s + Number(c.reward || 0), 0);
}
function computeWithdrawn() {
  return WITHDRAWALS.filter(w => w.status === 'paid' || w.status === 'approved')
                    .reduce((s, w) => s + Number(w.amount || 0), 0);
}
function computeAvailable() { return Math.max(0, computeEarned() - computeWithdrawn()); }
function getCompletedMissions() {
  const ids = new Set();
  CLAIMS.filter(c => c.status !== 'rejected').forEach(c => {
    if(c.missionId) ids.add(c.missionId);
  });
  return ids;
}

// === RENDER ===
function renderAll() {
  if (!CONFIG) return;
  if ($('siteSubtitle')) $('siteSubtitle').textContent = CONFIG.slogan || '';
  
  const doneIds = getCompletedMissions();
  const listEl = $('missionList');
  
  if (listEl) {
    listEl.innerHTML = '';
    if (!CONFIG.missions || CONFIG.missions.length === 0) {
      listEl.innerHTML = '<div class="empty-state">Belum ada misi yang tersedia saat ini.</div>';
    } else {
      CONFIG.missions.forEach(m => {
        const done = doneIds.has(m.id);
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
        
        el.querySelector('button').onclick = () => handleMissionClick(m);
        listEl.appendChild(el);
      });
    }
  }

  const totalPoin = computeEarned();
  if ($('totalMissions')) $('totalMissions').textContent = (CONFIG.missions || []).length;
  if ($('doneMissions')) $('doneMissions').textContent = doneIds.size;
  if ($('totalReward')) $('totalReward').textContent = totalPoin;
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
async function handleMissionClick(m) {
  if (!USER) return window.location.href = 'login.html';
  if (m.link) window.open(m.link, '_blank');
  
  // Konfirmasi ke user
  if(!confirm('Selesaikan misi: "' + m.title + '"?\nPastikan kamu sudah melakukannya.')) return;

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    // Otomatis simpan poin ke database
    await addDoc(collection(db, "claims"), {
      userId: USER.uid,
      userEmail: USER.email,
      userName: USER.displayName,
      missionId: m.id,
      missionTitle: m.title,
      reward: Number(m.reward),
      status: "approved", // Otomatis disetujui
      createdAt: serverTimestamp()
    });
    toast('Misi selesai! +' + m.reward + ' Poin masuk.');
  } catch (e) {
    toast('Gagal menyimpan: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Kerjakan';
  }
}

// === WITHDRAW FORM ===
document.addEventListener('DOMContentLoaded', () => {
  if ($('withdrawForm')) $('withdrawForm').onsubmit = async (ev) => {
    ev.preventDefault();
    if (!USER) return window.location.href = 'login.html';
    
    const amount = Number($('wdAmount').value);
    const method = $('wdMethod').value;
    const accName = $('wdName').value.trim();
    const accNum = $('wdNumber').value.trim();
    const available = computeAvailable();
    
    // Validasi Minimal 10.000
    if (amount < 10000) return toast('Minimal penarikan adalah Rp 10.000');
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
