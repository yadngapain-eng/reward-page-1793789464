
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAWjB5Db2FVIYlnRnd5ykVoNAfZoboCKl4",
  authDomain: "duniaku.firebaseapp.com",
  databaseURL: "https://duniaku-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "duniaku",
  storageBucket: "duniaku.firebasestorage.app",
  messagingSenderId: "1070116102039",
  appId: "1:1070116102039:web:2269553c0d27b2c64b6ed2",
  measurementId: "G-47FGDHJVL5"
};

// Inisialisasi Firebase di sini agar bisa di-export
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, firebaseConfig };
