// ===== APP.JS - Dashboard + Navegação compartilhada =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, collection, query, where, getDocs, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  await initDashboard(user);
});

// ===== THEME =====
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  if (themeToggle) themeToggle.textContent = '☀️';
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      themeToggle.textContent = '🌙';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      themeToggle.textContent = '☀️';
    }
  });
}

// ===== HAMBURGER =====
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

// ===== LOGOUT =====
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// ===== TOAST =====
export function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast show ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${msg}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== DASHBOARD INIT =====
async function initDashboard(user) {
  // Carregar nome do usuário
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const firstName = data.nome.split(' ')[0];
      if (userName) userName.textContent = firstName;
      if (userAvatar) userAvatar.textContent = firstName.charAt(0).toUpperCase();
    } else {
      if (userName) userName.textContent = 'Usuário';
      if (userAvatar) userAvatar.textContent = 'U';
    }
  } catch {
    if (userName) userName.textContent = 'Usuário';
    if (userAvatar) userAvatar.textContent = 'U';
  }

  // Carregar estatísticas
  await loadStats(user.uid);

  // Dica do dia
  loadDailyTip();
}

// ===== ESTATÍSTICAS =====
async function loadStats(uid) {
  const statEmotions = document.getElementById('statEmotions');
  const statQuizzes = document.getElementById('statQuizzes');
  const statMessages = document.getElementById('statMessages');

  if (!statEmotions) return;

  try {
    // Emoções
    const emotionsQuery = query(
      collection(db, 'emocional'),
      where('userId', '==', uid)
    );
    const emotionsSnap = await getDocs(emotionsQuery);
    statEmotions.textContent = emotionsSnap.size;

    // Quizzes
    const quizQuery = query(
      collection(db, 'quiz'),
      where('userId', '==', uid)
    );
    const quizSnap = await getDocs(quizQuery);
    statQuizzes.textContent = quizSnap.size;

    // Mensagens
    const msgQuery = query(
      collection(db, 'mensagens'),
      where('userId', '==', uid)
    );
    const msgSnap = await getDocs(msgQuery);
    statMessages.textContent = msgSnap.size;

  } catch {
    // Silenciar erros de permissão na contagem
  }
}

// ===== DICA DO DIA =====
function loadDailyTip() {
  const tips = [
    "Você não é obrigado(a) a responder todas as mensagens imediatamente. Seu tempo é seu. 💜",
    "Comparar sua vida real com a vida editada dos outros nas redes não é justo com você.",
    "Tá tudo bem não estar bem. O importante é não ficar sozinho(a) nesse momento.",
    "Antes de postar, pense: eu mostraria isso para alguém que amo?",
    "Sua saúde mental vale mais que qualquer like. 🧠",
    "Desconectar por um tempo não é fraqueza — é autocuidado.",
    "Ninguém precisa saber de tudo sobre você online. Privacidade é poder.",
    "Você é muito mais do que um perfil nas redes sociais. Lembre-se disso.",
    "Se algo na internet te fez mal, converse com alguém de confiança.",
    "Cada pessoa tem seu próprio ritmo. Não se compare com filtros e edições."
  ];

  const tipEl = document.getElementById('dailyTip');
  if (tipEl) {
    const dayIndex = new Date().getDate() % tips.length;
    tipEl.textContent = tips[dayIndex];
  }
}
