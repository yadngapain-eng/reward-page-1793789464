import { db } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let CONFIG = null;
const state = { completed: JSON.parse(localStorage.getItem('duniamu_missions') || '[]') };

async function loadConfig() {
  try {
    const docRef = doc(db, "settings", "global");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      CONFIG = docSnap.data();
    } else {
      // Fallback jika Firestore belum diisi admin
      CONFIG = {
        siteName: "Duniamu",
        slogan: "Selesaikan Misi, Hasilkan 💸",
        missions: [
          { id: 1, title: "Star repo GitHub", reward: 10, link: "https://github.com" },
          { id: 2, title: "Fork repo GitHub", reward: 15, link: "https://github.com" }
        ],
        payments: [{ id: "dana", name: "DANA", holder: "Admin", active: true }]
      };
    }
    renderAll();
  } catch (e) {
    document.getElementById('siteSubtitle').textContent = 'Gagal load data: ' + e.message;
  }
}

function renderAll() {
  document.getElementById('siteSubtitle').textContent = CONFIG.slogan || '';
  const listEl = document.getElementById('missionList');
  listEl.innerHTML = '';
  (CONFIG.missions || []).forEach(m => {
    const done = state.completed.includes(m.id);
    const el = document.createElement('div');
    el.className = 'mission' + (done ? ' done' : '');
    el.innerHTML = `<div><div class="mission-title">${m.title}</div><div class="mission-reward">+${m.reward} poin</div></div>
      <button class="btn-do" ${done ? 'disabled' : ''}>${done ? '✅ Selesai' : 'Kerjakan'}</button>`;
    el.querySelector('button').onclick = () => {
      if (m.link) window.open(m.link, '_blank');
      if (!state.completed.includes(m.id)) {
        state.completed.push(m.id);
        localStorage.setItem('duniamu_missions', JSON.stringify(state.completed));
        setTimeout(() => renderAll(), 300);
      }
    };
    listEl.appendChild(el);
  });

  const paySel = document.getElementById('claimPayment');
  paySel.innerHTML = '<option value="">Pilih metode</option>' +
    (CONFIG.payments || []).filter(p => p.active).map(p => `<option value="${p.name}">${p.name}</option>`).join('');

  const totalPoin = state.completed.reduce((s, id) => {
    const m = (CONFIG.missions || []).find(x => x.id === id);
    return s + (m ? m.reward : 0);
  }, 0);
  document.getElementById('totalMissions').textContent = (CONFIG.missions || []).length;
  document.getElementById('doneMissions').textContent = state.completed.length;
  document.getElementById('totalReward').textContent = totalPoin;
  document.getElementById('claimBtn').disabled = state.completed.length !== (CONFIG.missions || []).length || state.completed.length === 0;
}

document.getElementById('claimBtn').onclick = () => {
  document.getElementById('claimForm').style.display = 'flex';
  document.getElementById('claimBtn').style.display = 'none';
};

document.getElementById('submitClaim').onclick = async () => {
  const name = document.getElementById('claimName').value.trim();
  const contact = document.getElementById('claimContact').value.trim();
  const paymentMethod = document.getElementById('claimPayment').value;
  if (!name || !contact || !paymentMethod) return alert('Lengkapi data!');

  const missionsDone = (CONFIG.missions || []).filter(m => state.completed.includes(m.id)).map(m => ({title: m.title, reward: m.reward}));
  const totalPoin = missionsDone.reduce((s, m) => s + m.reward, 0);

  try {
    await addDoc(collection(db, "claims"), {
      name, contact, paymentMethod, missions: missionsDone, totalPoin, status: "pending", createdAt: serverTimestamp()
    });
    alert('✅ Klaim terkirim!');
    localStorage.removeItem('duniamu_missions');
    location.reload();
  } catch (e) { alert('Error: ' + e.message); }
};

loadConfig();
