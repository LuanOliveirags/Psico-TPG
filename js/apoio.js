// ===== APOIO.JS - Registro emocional =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, addDoc, collection, query, where, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let selectedEmotion = null;

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  currentUser = user;
  await loadUserInfo(user);
  await loadHistory(user.uid);
});

// ===== SHARED: Theme, Hamburger, Logout =====
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

const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
}

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '../index.html';
  });
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast show ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${msg}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== CARREGAR INFO DO USUÁRIO =====
async function loadUserInfo(user) {
  const userAvatar = document.getElementById('userAvatar');
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const initial = data.nome.charAt(0).toUpperCase();
      if (userAvatar) userAvatar.textContent = initial;
    }
  } catch {
    if (userAvatar) userAvatar.textContent = 'U';
  }
}

// ===== RESPOSTAS EMOCIONAIS =====
const emotionResponses = {
  feliz: {
    icon: '🌟',
    title: 'Que bom que você está feliz!',
    text: 'Aproveite esse momento! Lembre-se de compartilhar coisas boas com quem você gosta. A felicidade se multiplica quando é dividida. Continue cuidando de você!'
  },
  calmo: {
    icon: '🍃',
    title: 'Calma é poder!',
    text: 'Estar calmo(a) é uma habilidade incrível. Use esse momento para refletir, respirar e se conectar com o que realmente importa pra você. Você merece essa paz.'
  },
  ansioso: {
    icon: '💙',
    title: 'Respira fundo, tá bem?',
    text: 'A ansiedade pode ser intensa, mas ela não te define. Tente respirar devagar: inspire por 4 segundos, segure por 4 e solte por 4. Se precisar, procure alguém de confiança pra conversar. Você não está sozinho(a).'
  },
  triste: {
    icon: '🤗',
    title: 'Tá tudo bem sentir tristeza.',
    text: 'Não precisa ser forte o tempo todo. Permita-se sentir, chorar se precisar. A tristeza também passa. Se sentir que precisa de ajuda, converse com alguém de confiança ou use nosso chat de apoio. 💜'
  },
  irritado: {
    icon: '🌊',
    title: 'A raiva também é válida.',
    text: 'Ser irritado(a) é humano. Tente identificar o que causou essa irritação. Antes de reagir, respire. Se afaste do que te irritou por um momento. Escrever sobre o que sente pode ajudar a organizar os pensamentos.'
  },
  confuso: {
    icon: '🧩',
    title: 'Não precisa ter todas as respostas agora.',
    text: 'A confusão faz parte do processo de crescimento. Não se cobre tanto. Tente listar o que está te confundindo e converse sobre isso. Às vezes, falar em voz alta já ajuda a clarear.'
  },
  motivado: {
    icon: '🚀',
    title: 'Aproveita essa energia!',
    text: 'Motivação é combustível! Use esse momento pra fazer algo que você vem adiando, ou pra cuidar de você. Mas lembre-se: dias sem motivação também são normais. O importante é respeitar seu ritmo.'
  },
  cansado: {
    icon: '🛋️',
    title: 'Descansar também é produtivo.',
    text: 'Se permita descansar sem culpa. O cansaço é um sinal do corpo pedindo pausa. Desligue as notificações, beba água, e faça algo que te relaxe. Amanhã é um novo dia. 🌙'
  }
};

// ===== SELEÇÃO DE EMOÇÃO =====
const emotionGrid = document.getElementById('emotionGrid');
const emotionResponse = document.getElementById('emotionResponse');
const responseIcon = document.getElementById('responseIcon');
const responseTitle = document.getElementById('responseTitle');
const responseText = document.getElementById('responseText');

if (emotionGrid) {
  emotionGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.emotion-btn');
    if (!btn) return;

    // Remover seleção anterior
    document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    selectedEmotion = btn.dataset.emotion;
    const response = emotionResponses[selectedEmotion];

    if (response && emotionResponse) {
      responseIcon.textContent = response.icon;
      responseTitle.textContent = response.title;
      responseText.textContent = response.text;
      emotionResponse.classList.add('show');
    }
  });
}

// ===== SALVAR EMOÇÃO =====
const btnSaveEmotion = document.getElementById('btnSaveEmotion');
if (btnSaveEmotion) {
  btnSaveEmotion.addEventListener('click', async () => {
    if (!selectedEmotion || !currentUser) {
      showToast('Selecione uma emoção primeiro.', 'error');
      return;
    }

    btnSaveEmotion.disabled = true;
    btnSaveEmotion.textContent = 'Salvando...';

    try {
      await addDoc(collection(db, 'emocional'), {
        userId: currentUser.uid,
        emocao: selectedEmotion,
        emoji: emotionResponses[selectedEmotion].icon,
        data: serverTimestamp()
      });

      showToast('Emoção registrada com sucesso!');
      await loadHistory(currentUser.uid);

      // Reset seleção
      document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('selected'));
      emotionResponse.classList.remove('show');
      selectedEmotion = null;
    } catch {
      showToast('Erro ao salvar. Tente novamente.', 'error');
    } finally {
      btnSaveEmotion.disabled = false;
      btnSaveEmotion.textContent = '💾 Salvar registro';
    }
  });
}

// ===== HISTÓRICO =====
async function loadHistory(uid) {
  const historySection = document.getElementById('historySection');
  const historyList = document.getElementById('historyList');
  if (!historySection || !historyList) return;

  try {
    const q = query(
      collection(db, 'emocional'),
      where('userId', '==', uid),
      orderBy('data', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      historySection.style.display = 'none';
      return;
    }

    historySection.style.display = 'block';
    historyList.innerHTML = '';

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const date = data.data?.toDate();
      const dateStr = date
        ? date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'Agora';

      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <span>${data.emoji || '💭'}</span>
        <span>${data.emocao.charAt(0).toUpperCase() + data.emocao.slice(1)}</span>
        <span class="date">${dateStr}</span>
      `;
      historyList.appendChild(item);
    });
  } catch {
    // Índice pode não estar criado ainda
    historySection.style.display = 'none';
  }
}
