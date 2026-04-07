// ===== FIREBASE CONFIG =====
// Projeto: Psico-TPG
// IMPORTANTE: Substitua os valores abaixo pelas credenciais do seu projeto Firebase.
// Acesse: https://console.firebase.google.com > Psico-TPG > Configurações > Configuração do SDK

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAyRJ5XM8qjIKCMfXE7cxErCYj-FC61ddw",
  authDomain: "psico-tpg.firebaseapp.com",
  projectId: "psico-tpg",
  storageBucket: "psico-tpg.firebasestorage.app",
  messagingSenderId: "941874940910",
  appId: "1:941874940910:web:e6ef69fe7eb9b2ca39dcff",
  measurementId: "G-8FN6EH7V38"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
