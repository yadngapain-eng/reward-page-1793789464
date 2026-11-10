// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyALxIyjRR3Sh5_Mt_4X228tzgBkvNoWIsA",
  authDomain: "duniamuu.firebaseapp.com",
  projectId: "duniamuu",
  storageBucket: "duniamuu.firebasestorage.app",
  messagingSenderId: "51369340219",
  appId: "1:51369340219:web:5d7d22085123ca8614db1e",
  measurementId: "G-3N5DWSCFCT"
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
