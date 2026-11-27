// Firebase Web config (PUBLIK)
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyALxIyjRR3Sh5_Mt_4X228tzgBkvNoWIsA",
  authDomain: "duniamuu.firebaseapp.com",
  projectId: "duniamuu",
  storageBucket: "duniamuu.firebasestorage.app",
  messagingSenderId: "51369340219",
  appId: "1:51369340219:web:5d7d22085123ca8614db1e",
  measurementId: "G-3N5DWSCFCT",
};
window.firebaseReady = (async () => {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const { getAnalytics, isSupported } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js");
  const A = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const app = initializeApp(window.FIREBASE_CONFIG);
  try { if (await isSupported()) getAnalytics(app); } catch(_) {}
  const auth = A.getAuth(app);
  await A.setPersistence(auth, A.browserLocalPersistence);
  const db = getFirestore(app);
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return { app, auth, db, provider,
           signInWithPopup: A.signInWithPopup, signOut: A.signOut,
           onAuthStateChanged: A.onAuthStateChanged };
})();
