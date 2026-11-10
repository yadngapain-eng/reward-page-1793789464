import { db, auth, storage } from './firebase-config.js';
import {
  doc, getDoc, collection, addDoc, serverTimestamp,
  query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

let CONFIG = { missions: [], slogan: "Selesaikan Misi, Hasilkan" };
let USER = null;
let CLAIMS = [];
let WITHDRAWALS = [];
let activeMission = null;
let selectedFile = null;
let GROQ_API_KEY = null;

const $ = id => document.getElementById(id);
const fmt = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

// === FUNGSI TOAST (Notifikasi) ===
function toast(msg, isError = false) {
  const t = $('toast'); 
  if (!t) return alert(msg);
  t.textContent = msg;
  if (isError) {
    t.style.background = '#ef4444';
    t.style.color = '#fff';
  } else {
    t.style.background = '#00e0ff';
    t.style.color = '#000';
  }
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// === FETCH TOKEN DARI VAULT ===
async function fetchGroqToken() {
  if (GROQ_API_KEY) return GROQ_API_KEY;
  try {
    const resp = await fetch('/groq-vault.html');
    const text = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const metaData = doc.querySelector('meta[name="groq-vault"]');
    const metaKey  = doc.querySelector('meta[name="groq-vault-key"]');

    if (metaData && metaKey) {
      const hex = metaData.getAttribute('content');
      const key = metaKey.getAttribute('content');
      GROQ_API_KEY = xorDecrypt(hex, key);
    }
  } catch (e) {
    console.warn('Gagal load Groq token:', e.message);
  }
  return GROQ_API_KEY;
}

function xorDecrypt(hex, key) {
  try {
    const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
    const k = new TextEncoder().encode(key);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      out[i] = bytes[i] ^ k[i % k.length];
    }
    return new TextDecoder().decode(out);
  } catch (e) {
    return null;
  }
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

async function loadConfig() {
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) CONFIG = snap.data();
  } catch (e) { console.warn('loadConfig:', e.message); }
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
        el.innerHTML =
          '<div class="mission-info">' +
            '<div class="mission-title">' + m.title + '</div>' +
            '<div class="mission-reward">+' + m.reward + ' Poin</div>' +
          '</div>' +
          '<button class="' + btnClass + '" ' + (done || !USER ? 'disabled' : '') + '>' +
            btnText +
          '</button>';
        
        // PENTING: Menggunakan closure untuk menangkap objek 'm' dengan benar
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

// === KLIK MISI (FIX JUDUL KOSONG) ===
function handleMissionClick(m) {
  if (!USER) return window.location.href = 'login.html';
  
  // Validasi objek misi
  if (!m || !m.title) {
    return toast('Data misi tidak valid. Hubungi admin.', true);
  }
  
  if (m.link) window.open(m.link, '_blank');
  
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

// === SUBMIT BUKTI & AI (FIX EMAIL VERIFIED) ===
window.submitProof = async () => {
  if (!selectedFile || !activeMission) return;
  
  // Validasi Email Verified (Penyebab Error Missing Permissions)
  if (!USER.emailVerified) {
    return toast('Verifikasi email Anda dulu di pengaturan Google/Email.', true);
  }

  const btn = $('btnSubmitProof');
  btn.disabled = true;
  btn.textContent = 'Memuat Sistem AI...';
  
  try {
    const token = await fetchGroqToken();
    if (!token) throw new Error("Sistem AI tidak merespon.");

    btn.textContent = 'Menganalisis Gambar (AI)...';

    const reader = new FileReader();
    const base64Promise = new Promise((resolve) => {
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(selectedFile);
    });
    const base64Image = await base64Promise;

    const prompt = 'Kamu adalah sistem verifikasi otomatis. User mengaku telah menyelesaikan misi: "' + activeMission.title + '". Periksa gambar ini. Apakah gambar ini adalah bukti valid bahwa user benar-benar menyelesaikan misi tersebut? Jawab HANYA dengan JSON: {"valid": true, "reason": "alasan singkat"} atau {"valid": false, "reason": "alasan"}.';

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: base64Image } }
        ]}],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error("AI Error: " + err);
    }

    const aiData = await response.json();
    let aiText = aiData.choices[0].message.content;
    aiText = aiText.replace(/json/g, "").replace(/`/g, "").trim();
    const aiResult = JSON.parse(aiText);

    btn.textContent = 'Menyimpan data...';
    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `proofs/${USER.uid}_${activeMission.id}_${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, selectedFile);
    const downloadURL = await getDownloadURL(storageRef);

    const finalStatus = aiResult.valid ? "approved" : "rejected";
    
    await addDoc(collection(db, "claims"), {
      userId: USER.uid,
      userEmail: USER.email,
      userName: USER.displayName,
      missionId: activeMission.id,
      missionTitle: activeMission.title,
      reward: Number(activeMission.reward),
      proofUrl: downloadURL,
      status: finalStatus,
      aiReason: aiResult.reason || "Tidak ada alasan",
      createdAt: serverTimestamp()
    });

    if (aiResult.valid) {
      toast('AI memverifikasi! Poin ditambahkan.');
    } else {
      toast('AI menolak: ' + aiResult.reason, true);
    }
    closeUploadModal();
  } catch (e) {
    toast('Gagal: ' + e.message, true);
  } finally {
    btn.textContent = 'Kirim Bukti';
    btn.disabled = false;
  }
};

// === WITHDRAW FORM ===
document.addEventListener('DOMContentLoaded', () => {
  fetchGroqToken(); 

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
