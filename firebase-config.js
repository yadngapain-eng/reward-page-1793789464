// Firebase Web config (PUBLIK — aman di client)
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyALxIyjRR3Sh5_Mt_4X228tzgBkvNoWIsA",
  authDomain: "duniamuu.firebaseapp.com",
  databaseURL: "https://duniamuu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "duniamuu",
  storageBucket: "duniamuu.firebasestorage.app",
  messagingSenderId: "51369340219",
  appId: "1:51369340219:web:5d7d22085123ca8614db1e",
  measurementId: "G-3N5DWSCFCT",
};

// Inisialisasi Firebase v10 modular via CDN (dynamic import)
window.firebaseReady = (async () => {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const { getAnalytics, isSupported } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js");
  const { getAuth, signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const app = initializeApp(window.FIREBASE_CONFIG);
  // Analytics opsional (hanya jalan di HTTPS/localhost, aman di-skip)
  try { if (await isSupported()) getAnalytics(app); } catch (_) {}
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (!auth.currentUser) {
    try { await signInAnonymously(auth); } catch (e) { console.warn("auth anon:", e); }
  }
  return { app, auth, db };
})();
