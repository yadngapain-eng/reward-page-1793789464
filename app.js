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
let activeMission = null;
let selectedFile = null;

const $ = id => document.getElementById(id);
const fmt = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

// === TOAST ===
function toast(msg, isError = false) {
  const t = $('toast'); 
  if (!t) return alert(msg);
  t.textContent = msg;
  t.style.background = isError ? '#ef4444' : '#00e0ff';
  t.style.color = isError ? '#fff' : '#000';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// === TABS ===
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
  const bar = $('userBar'); 
  if (!bar) return;
  
  if (!u) {
    // Tampilan jika belum login
    bar.innerHTML = '<a href="login.html" class="btn-login">Masuk</a>';
    return;
  }
  
  // Tampilan jika sudah login
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

async function loadConfig() {
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) CONFIG = snap.data();
  } catch (e) { 
    console.warn('loadConfig:', e.message); 
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

function computeEarned() {
  return CLAIMS.filter(c => c.status === 'approved')
               .reduce((s, c) => s + Number(c.reward || 0), 0);
}
function computeWithdrawn() {
  return WITHDRAWALS.filter(w => w.status === 'paid' || w.status === 'approved')
                    .reduce((s, w) => s + Number(w.amount || 0), 0);
}
function computeAvailable() { return Math.max(0, computeEarned() - computeWithdrawn()); }
function getCompletedMissions() {
  const ids = new Set();
  CLAIMS.filter(c => c.status === 'approved' || c.status === 'pending').forEach(c => {
    if(c.missionId) ids.add(c.missionId);
  });
  return ids;
}

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
        const claim = CLAIMS.find(c => c.missionId === m.id);
        
        let btnText = 'Kerjakan';
        let btnClass = 'btn-mission';
        
        if (!USER) {
          btnText = 'Login Dulu';
        } else if (claim) {
          if (claim.status === 'pending') {
            btnText = 'Sedang Dicek...';
            btnClass += ' btn-pending';
          } else if (claim.status === 'approved') {
            btnText = 'Selesai';
            btnClass += ' btn-done';
          } else if (claim.status === 'rejected') {
            btnText = 'Gagal, Coba Lagi';
            btnClass += ' btn-rejected';
          }
        }

        const el = document.createElement('div');
        el.className = 'mission-card' + (done ? ' done' : '');
        // Deteksi judul otomatis (title, judul, atau name)
        const mTitle = m.title || m.judul || m.name || 'Misi Tanpa Judul';
        const mReward = m.reward || m.poin || 0;
        
        el.innerHTML =
          '<div class="mission-info">' +
            '<div class="mission-title">' + mTitle + '</div>' +
            '<div class="mission-reward">+' + mReward + ' Poin</div>' +
          '</div>' +
          '<button class="' + btnClass + '" ' + (done || !USER ? 'disabled' : '') + '>' +
            btnText +
          '</button>';
        
        el.querySelector('button').onclick = () => handleMissionClick({...m, title: mTitle, reward: mReward});
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

function handleMissionClick(m) {
  if (!USER) return window.location.href = 'login.html';
  if (!m || !m.title) return toast('Data misi tidak valid.', true);
  
  if (m.link) {
    // Menggunakan elemen <a> untuk mencegah browser me-refresh halaman saat kembali
    const a = document.createElement('a');
    a.href = m.link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  
  activeMission = m;
  selectedFile = null;
  $('modalTitle').textContent = 'Upload Bukti: ' + m.title;
  $('previewText').style.display = 'block';
  $('previewImg').style.display = 'none';
  $('proofFile').value = '';
  $('btnSubmitProof').disabled = true;
  $('uploadModal').style.display = 'flex';
}

window.closeUploadModal = () => {
  $('uploadModal').style.display = 'none';
  activeMission = null;
};

window.handleFileSelect = (input) => {
  if (input.files && input.files[0]) {
    selectedFile = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      $('previewImg').src = e.target.result;
      $('previewImg').style.display = 'block';
      $('previewText').style.display = 'none';
    };
    reader.readAsDataURL(selectedFile);
    $('btnSubmitProof').disabled = false;
  }
};

window.submitProof = async () => {
  if (!selectedFile || !activeMission) return;
  
  if (!USER.emailVerified) {
    return toast('Verifikasi email Anda dulu di pengaturan Google/Email.', true);
  }

  const btn = $('btnSubmitProof');
  btn.disabled = true;
  btn.textContent = 'Menyimpan data...';
  
  try {
    // Karena fitur Storage mungkin belum aktif, kita simpan sebagai base64 dulu
    // (Hanya untuk testing, atau upload ke Firebase Storage jika sudah aktif)
    const reader = new FileReader();
    const base64Promise = new Promise((resolve) => {
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(selectedFile);
    });
    const base64Image = await base64Promise;

    await addDoc(collection(db, "claims"), {
      userId: USER.uid,
      userEmail: USER.email,
      userName: USER.displayName,
      missionId: activeMission.id,
      missionTitle: activeMission.title,
      reward: Number(activeMission.reward),
      proofUrl: base64Image, // Simpan sementara sebagai base64
      status: "pending",
      aiReason: "Menunggu review admin",
      createdAt: serverTimestamp()
    });

    toast('Bukti terkirim! Menunggu review admin.');
    closeUploadModal();
  } catch (e) {
    toast('Gagal: ' + e.message, true);
  } finally {
    btn.textContent = 'Kirim Bukti';
    btn.disabled = false;
  }
};

// Mencegah refresh tidak sengaja saat kembali dari tab lain
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // Halaman diambil dari cache (BFCache), pastikan modal tetap sesuai state
    if (!activeMission) {
      $('uploadModal').style.display = 'none';
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  if ($('withdrawForm')) $('withdrawForm').onsubmit = async (ev) => {
    ev.preventDefault();
    if (!USER) return window.location.href = 'login.html';
    
    const amount = Number($('wdAmount').value);
    const method = $('wdMethod').value;
    const accName = $('wdName').value.trim();
    const accNum = $('wdNumber').value.trim();
    const available = computeAvailable();
    
    if (amount < 10000) return toast('Minimal penarikan adalah Rp 10.000', true);
    if (amount > available) return toast('Saldo tidak cukup. Tersedia: ' + fmt(available), true);
    if (!accName || !accNum) return toast('Lengkapi data rekening', true);
    
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
      toast('Gagal: ' + e.message, true); 
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kirim Permintaan';
    }
  };
});
