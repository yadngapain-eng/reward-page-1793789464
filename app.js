const MISSIONS = [
  { id: 1, title: "⭐ Star repo GitHub", reward: 10, link: "https://github.com" },
  { id: 2, title: "🍴 Fork repo GitHub", reward: 15, link: "https://github.com" },
  { id: 3, title: "👀 Follow pemilik repo", reward: 10, link: "https://github.com" },
  { id: 4, title: "📝 Buat issue di repo", reward: 20, link: "https://github.com" },
  { id: 5, title: "📢 Share project ini", reward: 25, link: "" },
];

const STORAGE_KEY = "duniamu_missions_simple";

function getState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch (e) { return []; }
}

function setState(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function render() {
  const done = getState();
  const listEl = document.getElementById("missionList");
  listEl.innerHTML = "";

  MISSIONS.forEach(m => {
    const isDone = done.includes(m.id);
    const el = document.createElement("div");
    el.className = "mission" + (isDone ? " done" : "");
    el.innerHTML =
      '<div class="mission-info">' +
        '<div class="mission-title">' + m.title + '</div>' +
        '<div class="mission-reward">+' + m.reward + ' poin</div>' +
      '</div>' +
      '<button class="btn-do" ' + (isDone ? 'disabled' : '') + '>' +
        (isDone ? '✅ Selesai' : (m.link ? 'Kerjakan →' : 'Kerjakan')) +
      '</button>';

    const btn = el.querySelector("button");
    btn.onclick = () => {
      if (m.link) window.open(m.link, "_blank");
      complete(m.id);
    };
    listEl.appendChild(el);
  });

  updateStats(done);
}

function complete(id) {
  const done = getState();
  if (done.includes(id)) return;
  done.push(id);
  setState(done);
  showToast("🎉 Misi selesai!");
  render();
}

function updateStats(done) {
  const totalPoin = done.reduce((s, id) => {
    const m = MISSIONS.find(x => x.id === id);
    return s + (m ? m.reward : 0);
  }, 0);

  document.getElementById("totalMissions").textContent = MISSIONS.length;
  document.getElementById("doneMissions").textContent = done.length;
  document.getElementById("totalReward").textContent = totalPoin;

  const allDone = done.length === MISSIONS.length;
  document.getElementById("claimBox").style.display = allDone ? "block" : "none";
  document.getElementById("finalReward").textContent = totalPoin;
}

function resetMissions() {
  if (!confirm("Yakin ulangi dari awal? Progress akan hilang.")) return;
  setState([]);
  showToast("🔄 Progress direset");
  render();
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

render();
