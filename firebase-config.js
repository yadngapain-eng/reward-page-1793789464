
// Konfigurasi Firebase DUNIAMU
const firebaseConfig = {
  apiKey: "AIzaSyBXqTVX1NzPYCsTc1xALLEK_MOsASJlxzI",
  authDomain: "duniamuu.firebaseapp.com",
  databaseURL: "https://duniamuu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "duniamuu",
  storageBucket: "duniamuu.firebasestorage.app",
  messagingSenderId: "51369340219",
  appId: "1:51369340219:android:75688118ec8626ae14db1e"
};

// Inisialisasi Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { app, auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, increment, collection, query, orderBy, limit, getDocs };
