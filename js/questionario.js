// ===== QUESTIONARIO.JS =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== DADOS DOS QUESTIONÁRIOS =====
const DADOS = {
  adolescente: {
    badge: '🧑 Para Participantes',
    title: 'O que dificulta sua participação?',
    desc: 'Selecione tudo que se aplica à sua experiência nos encontros de acompanhamento psicológico on-line.',
    opcoes: [
      { id: 'internet',      emoji: '📶', texto: 'Dificuldade de acesso à internet ou problemas de conexão' },
      { id: 'privacidade',   emoji: '🔇', texto: 'Falta de um lugar silencioso ou privado para participar' },
      { id: 'vergonha',      emoji: '😳', texto: 'Vergonha ou desconforto em falar durante os encontros' },
      { id: 'confianca',     emoji: '🤝', texto: 'Dificuldade em confiar ou me sentir à vontade no grupo' },
      { id: 'identificacao', emoji: '🪞', texto: 'Não me identifico com a forma como os encontros acontecem' },
      { id: 'interesse',     emoji: '😴', texto: 'Falta de interesse nos temas discutidos' },
      { id: 'horario',       emoji: '⏰', texto: 'Horário dos encontros dificulta minha participação' },
      { id: 'rotina',        emoji: '🗓️', texto: 'Esqueço os encontros ou tenho dificuldade de manter rotina' },
      { id: 'cansaco',       emoji: '😔', texto: 'Me sinto cansado(a), desanimado(a) ou sem vontade de participar' },
      { id: 'julgamento',    emoji: '😨', texto: 'Tenho medo de ser julgado(a) pelos outros participantes' },
      { id: 'familia',       emoji: '🏠', texto: 'Problemas familiares ou pessoais dificultam minha participação' },
      { id: 'sentimentos',   emoji: '💬', texto: 'Acho difícil falar sobre meus sentimentos no ambiente on-line' },
      { id: 'video',         emoji: '📹', texto: 'Não gosto muito de conversar por vídeo/chamada' },
      { id: 'outro',         emoji: '✏️', texto: 'Outro' },
    ]
  },
  estagiario: {
    badge: '🎓 Para Estagiários',
    title: 'Quais dificuldades você enfrenta?',
    desc: 'Selecione as situações que mais desafiam sua condução dos grupos de adolescentes no formato on-line.',
    opcoes: [
      { id: 'vinculo',        emoji: '🤝', texto: 'Dificuldade em criar vínculo com os adolescentes' },
      { id: 'adesao',         emoji: '🚪', texto: 'Baixa adesão ou faltas frequentes nos encontros' },
      { id: 'silencio',       emoji: '🤫', texto: 'Pouca participação ou silêncio do grupo' },
      { id: 'tecnicas',       emoji: '🔄', texto: 'Dificuldade em adaptar técnicas grupais ao formato on-line' },
      { id: 'tecnologia',     emoji: '💻', texto: 'Barreiras tecnológicas (internet, câmera, áudio, plataforma)' },
      { id: 'linguagem',      emoji: '📱', texto: 'Dificuldade em compreender a linguagem e cultura digital dos adolescentes' },
      { id: 'conflitos',      emoji: '⚡', texto: 'Insegurança no manejo de conflitos ou situações delicadas' },
      { id: 'engajamento',    emoji: '🎯', texto: 'Dificuldade em manter o interesse e engajamento do grupo' },
      { id: 'privacidade',    emoji: '🔒', texto: 'Falta de privacidade dos adolescentes durante os encontros' },
      { id: 'emocoes',        emoji: '👁️', texto: 'Dificuldade em identificar emoções e sinais de sofrimento virtual' },
      { id: 'apoio_familiar', emoji: '👨‍👩‍👧', texto: 'Falta de apoio familiar dos adolescentes no processo terapêutico' },
      { id: 'efetividade',    emoji: '🎭', texto: 'Sensação de pouca efetividade do atendimento on-line' },
      { id: 'interacao',      emoji: '💬', texto: 'Dificuldade em promover interação entre os participantes' },
      { id: 'outro',          emoji: '✏️', texto: 'Outro' },
    ]
  }
};

let currentUser = null;
let tipo = null;
const selecionados = new Set();

// ===== AUTH =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  currentUser = user;

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const data = userDoc.exists() ? userDoc.data() : {};
    const role = data.role || '';

    const avatar = document.getElementById('userAvatar');
    if (avatar && data.nome) avatar.textContent = data.nome.charAt(0).toUpperCase();

    tipo = (role === 'atendente' || role === 'admin') ? 'estagiario' : 'adolescente';

    const existing = await getDoc(doc(db, 'questionarios', user.uid));
    document.getElementById('qLoading').style.display = 'none';

    if (existing.exists()) {
      localStorage.setItem(`pesquisa_ok_${user.uid}`, '1');
      mostrarRespondido(existing.data());
    } else {
      montarQuestionario();
    }
  } catch {
    document.getElementById('qLoading').style.display = 'none';
    tipo = 'adolescente';
    montarQuestionario();
  }
});

// ===== ESTADO: JÁ RESPONDEU =====
function mostrarRespondido(data) {
  const q = DADOS[data.tipo] || DADOS.adolescente;
  document.getElementById('qHeroBadge').textContent = q.badge;
  document.getElementById('qHeroTitle').textContent = 'Pesquisa respondida';
  document.getElementById('qHeroSubtitle').textContent = 'Você já contribuiu com esta pesquisa. Obrigado!';

  const tags = (data.respostas || []).map(id => {
    const op = q.opcoes.find(o => o.id === id);
    if (!op) return '';
    const label = id === 'outro' && data.outro
      ? data.outro.slice(0, 32) + (data.outro.length > 32 ? '…' : '')
      : op.texto.slice(0, 32) + (op.texto.length > 32 ? '…' : '');
    return `<span class="q-done-tag">${op.emoji} ${label}</span>`;
  }).join('');

  document.getElementById('qDoneTags').innerHTML = tags;
  document.getElementById('qDone').style.display = 'flex';
}

// ===== MONTAR QUESTIONÁRIO =====
function montarQuestionario() {
  const q = DADOS[tipo];
  document.getElementById('qHeroBadge').textContent = q.badge;
  document.getElementById('qHeroTitle').textContent = q.title;
  document.getElementById('qHeroSubtitle').textContent = q.desc;
  document.getElementById('qMainTitle').textContent = q.title;
  document.getElementById('qMainDesc').textContent = q.desc;

  const grid = document.getElementById('qGrid');
  q.opcoes.forEach((op, i) => {
    const card = document.createElement('div');
    card.className = 'q-card';
    card.dataset.id = op.id;
    card.style.transitionDelay = `${i * 35}ms`;
    card.innerHTML = `
      <span class="q-card-emoji">${op.emoji}</span>
      <span class="q-card-text">${op.texto}</span>
      <span class="q-card-check" aria-hidden="true">✓</span>
    `;
    card.addEventListener('click', () => toggleCard(card, op.id));
    grid.appendChild(card);
  });

  document.getElementById('qMain').style.display = 'block';

  // Stagger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.q-card').forEach(c => c.classList.add('q-card-in'));
    });
  });
}

// ===== TOGGLE OPÇÃO =====
function toggleCard(card, id) {
  if (selecionados.has(id)) {
    selecionados.delete(id);
    card.classList.remove('selected');
  } else {
    selecionados.add(id);
    card.classList.add('selected');
  }
  document.getElementById('qOutroWrap').style.display = selecionados.has('outro') ? 'block' : 'none';
  atualizarBarra();
}

function atualizarBarra() {
  const n = selecionados.size;
  const bar = document.getElementById('qFooterBar');
  const count = document.getElementById('qFooterCount');
  const btn = document.getElementById('btnSubmitQ');

  if (n === 0) {
    count.textContent = 'Nenhuma opção selecionada';
  } else {
    count.textContent = `${n} opção${n > 1 ? 'ões' : ''} selecionada${n > 1 ? 's' : ''}`;
  }

  bar.classList.toggle('visible', n > 0);
  btn.disabled = n === 0;
}

// ===== SUBMIT =====
document.getElementById('btnSubmitQ').addEventListener('click', async () => {
  if (selecionados.size === 0) return;

  const btn = document.getElementById('btnSubmitQ');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const outro = document.getElementById('qOutroText').value.trim();

  try {
    await setDoc(doc(db, 'questionarios', currentUser.uid), {
      userId: currentUser.uid,
      tipo,
      respostas: [...selecionados],
      outro: selecionados.has('outro') ? (outro || null) : null,
      timestamp: serverTimestamp()
    });

    localStorage.setItem(`pesquisa_ok_${currentUser.uid}`, '1');
    document.getElementById('qMain').style.display = 'none';
    document.getElementById('qFooterBar').classList.remove('visible');
    document.getElementById('qSuccess').style.display = 'flex';
  } catch {
    btn.disabled = false;
    btn.textContent = 'Enviar respostas →';
    showToast('Erro ao enviar. Tente novamente.', 'error');
  }
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
  const backdrop = Object.assign(document.createElement('div'), { className: 'nav-backdrop' });
  document.body.appendChild(backdrop);
  const closeMenu = () => {
    navLinks.classList.remove('open');
    hamburger.classList.remove('open');
    backdrop.classList.remove('active');
    hamburger.textContent = '☰';
  };
  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    backdrop.classList.toggle('active', isOpen);
    hamburger.textContent = isOpen ? '✕' : '☰';
  });
  backdrop.addEventListener('click', closeMenu);
}

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '../index.html';
  });
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast show ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${msg}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}
