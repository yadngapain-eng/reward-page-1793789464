
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXqTVX1NzPYCsTc1xALLEK_MOsASJlxzI",
  authDomain: "duniamuu.firebaseapp.com",
  projectId: "duniamuu",
  storageBucket: "duniamuu.firebasestorage.app",
  messagingSenderId: "51369340219",
  appId: "1:51369340219:android:75688118ec8626ae14db1e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, doc, getDoc, setDoc, updateDoc, increment };
