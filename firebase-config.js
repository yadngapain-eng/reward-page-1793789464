// Firebase Web config (PUBLIK — aman di client)
// Ambil dari: Firebase Console → Project Settings → General → Your apps
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",                 // ← ganti dengan Web API key
  authDomain: "duniamuu.firebaseapp.com",
  projectId: "duniamuu",
  storageBucket: "duniamuu.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxx"
};

// Inisialisasi (pakai Firebase v10 modular via CDN)
window.firebaseReady = (async () => {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const { getAuth, signInAnonymously, onAuthStateChanged } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  const app = initializeApp(window.FIREBASE_CONFIG);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // User anonim (otomatis login)
  if (!auth.currentUser) {
    try { await signInAnonymously(auth); } catch (e) { console.warn("auth anon:", e); }
  }
  return { app, auth, db };
})();
