// ===== CHAT.JS - Espaço de Escuta com bot + atendente humano =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, getDocs,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;
let chatMode = 'bot'; // 'bot' | 'waiting' | 'human'
let activeRoomId = null;
let unsubMessages = null;
let unsubRoom = null;

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  // Verificar se está bloqueado
  try {
    const blockDoc = await getDoc(doc(db, 'users', user.uid));
    if (blockDoc.exists() && blockDoc.data().bloqueado) {
      await signOut(auth);
      alert('Sua conta foi bloqueada. Entre em contato com o suporte.');
      window.location.href = 'index.html';
      return;
    }
  } catch (e) { /* falha silenciosa */ }

  currentUser = user;
  await loadUserInfo(user);
  await checkExistingRoom(user.uid);
  if (chatMode === 'bot') {
    addBotMessage('Olá! 💜 Eu sou o assistente do Conexão Consciente. Estou aqui pra te ouvir. Como você está se sentindo hoje?');
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
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
}

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// ===== USER INFO =====
async function loadUserInfo(user) {
  const userAvatar = document.getElementById('userAvatar');
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      currentUserData = userDoc.data();
      if (userAvatar) userAvatar.textContent = currentUserData.nome.charAt(0).toUpperCase();
      // Mostrar link do painel de atendente se for atendente
      if (currentUserData.role === 'atendente') {
        showAtendenteLink();
      }
    }
  } catch (err) {
    console.error('Erro ao carregar dados do usuário:', err);
    if (userAvatar) userAvatar.textContent = 'U';
  }

  // Mostrar link do painel admin (usa auth, não depende do Firestore)
  if (user.email === 'luanoliveirags@gmail.com') {
    addNavLink('admin.html', '⚙️ Admin');
  }
}

function addNavLink(href, text) {
  const navLinksEl = document.getElementById('navLinks');
  if (navLinksEl && !navLinksEl.querySelector(`a[href="${href}"]`)) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = text;
    navLinksEl.appendChild(link);
  }
}

function showAtendenteLink() {
  addNavLink('atendente.html', '🧑‍💼 Especialista');
  listenToWaitingRooms();
}

// ===== NOTIFICAÇÃO EM TEMPO REAL PARA ESPECIALISTAS =====
function listenToWaitingRooms() {
  const q = query(
    collection(db, 'chatRooms'),
    where('status', '==', 'waiting')
  );

  onSnapshot(q, (snapshot) => {
    const count = snapshot.size;
    const navLinksEl = document.getElementById('navLinks');
    if (!navLinksEl) return;

    const link = navLinksEl.querySelector('a[href="atendente.html"]');
    if (!link) return;

    const oldBadge = link.querySelector('.nav-badge');
    if (oldBadge) oldBadge.remove();

    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'nav-badge';
      badge.textContent = count;
      link.appendChild(badge);
    }
  });
}

// ===== ELEMENTOS DO CHAT =====
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const btnSend = document.getElementById('btnSend');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const chatStatusEl = document.getElementById('chatStatus');
const btnRequestHuman = document.getElementById('btnRequestHuman');
const btnBackToBot = document.getElementById('btnBackToBot');
const chatWaiting = document.getElementById('chatWaiting');
const btnCancelWait = document.getElementById('btnCancelWait');

// ===== ADICIONAR MENSAGEM NA TELA =====
function addMessage(text, type = 'bot') {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${type}`;

  const now = new Date();
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const sanitized = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  msgDiv.innerHTML = `${sanitized}<span class="time">${time}</span>`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addBotMessage(text) {
  addMessage(text, 'bot');
}

function addUserMessage(text) {
  addMessage(text, 'user');
}

function addSystemMessage(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg system';
  msgDiv.textContent = text;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== ATUALIZAR UI POR MODO =====
function updateUIForMode(mode) {
  chatMode = mode;

  if (mode === 'bot') {
    chatTitle.textContent = '💬 Espaço de Escuta';
    chatSubtitle.textContent = 'Converse com nosso assistente de apoio';
    chatStatusEl.textContent = 'Online';
    chatStatusEl.className = 'status';
    btnRequestHuman.style.display = '';
    btnBackToBot.style.display = 'none';
    chatWaiting.style.display = 'none';
    chatInput.disabled = false;
    btnSend.disabled = false;
  } else if (mode === 'waiting') {
    chatTitle.textContent = '🧑‍💼 Atendimento Humano';
    chatSubtitle.textContent = 'Aguardando um especialista...';
    chatStatusEl.textContent = 'Aguardando';
    chatStatusEl.className = 'status waiting';
    btnRequestHuman.style.display = 'none';
    btnBackToBot.style.display = '';
    chatWaiting.style.display = 'flex';
    chatInput.disabled = true;
    btnSend.disabled = true;
  } else if (mode === 'human') {
    chatTitle.textContent = '🧑‍💼 Atendimento Humano';
    chatSubtitle.textContent = 'Você está conversando com um especialista';
    chatStatusEl.textContent = 'Conectado';
    chatStatusEl.className = 'status';
    btnRequestHuman.style.display = 'none';
    btnBackToBot.style.display = '';
    chatWaiting.style.display = 'none';
    chatInput.disabled = false;
    btnSend.disabled = false;
  }
}

// ===== VERIFICAR SALA EXISTENTE =====
async function checkExistingRoom(uid) {
  try {
    const q = query(
      collection(db, 'chatRooms'),
      where('userId', '==', uid),
      where('status', 'in', ['waiting', 'active'])
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const roomDoc = snapshot.docs[0];
      activeRoomId = roomDoc.id;
      const roomData = roomDoc.data();

      if (roomData.status === 'waiting') {
        updateUIForMode('waiting');
        listenToRoom(activeRoomId);
      } else if (roomData.status === 'active') {
        updateUIForMode('human');
        listenToRoomMessages(activeRoomId);
        listenToRoom(activeRoomId);
      }
    }
  } catch {
    // Sem sala ativa
  }
}

// ===== SOLICITAR ATENDENTE HUMANO =====
async function requestHumanAttendant() {
  if (!currentUser) return;

  try {
    const roomRef = await addDoc(collection(db, 'chatRooms'), {
      userId: currentUser.uid,
      userName: currentUserData?.nome || 'Usuário',
      atendenteId: null,
      atendenteName: null,
      status: 'waiting',
      criadoEm: serverTimestamp()
    });

    activeRoomId = roomRef.id;
    chatMessages.innerHTML = '';
    updateUIForMode('waiting');
    listenToRoom(activeRoomId);
  } catch (err) {
    console.error('Erro ao solicitar especialista:', err);
    addSystemMessage('Erro ao solicitar especialista. Tente novamente.');
  }
}

// ===== OUVIR MUDANÇAS NA SALA =====
function listenToRoom(roomId) {
  if (unsubRoom) unsubRoom();

  unsubRoom = onSnapshot(doc(db, 'chatRooms', roomId), (docSnap) => {
    if (!docSnap.exists()) {
      // Sala foi deletada
      cleanupAndBackToBot();
      addSystemMessage('O atendimento foi encerrado.');
      return;
    }

    const data = docSnap.data();

    if (data.status === 'active' && chatMode !== 'human') {
      updateUIForMode('human');
      chatMessages.innerHTML = '';
      addSystemMessage(`${data.atendenteName || 'Especialista'} entrou na conversa`);
      listenToRoomMessages(roomId);
    }

    if (data.status === 'closed') {
      addSystemMessage('O atendimento foi encerrado pelo especialista.');
      cleanupAndBackToBot();
    }
  });
}

// ===== OUVIR MENSAGENS DA SALA EM TEMPO REAL =====
function listenToRoomMessages(roomId) {
  if (unsubMessages) unsubMessages();

  const q = query(
    collection(db, 'chatRooms', roomId, 'messages'),
    orderBy('data', 'asc')
  );

  unsubMessages = onSnapshot(q, (snapshot) => {
    chatMessages.innerHTML = '';
    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const type = msg.senderId === currentUser.uid ? 'user' : 'bot';
      addMessage(msg.mensagem, type);
    });
  });
}

// ===== ENVIAR MENSAGEM NA SALA HUMANA =====
async function sendHumanMessage(text) {
  if (!activeRoomId || !currentUser) return;

  try {
    await addDoc(collection(db, 'chatRooms', activeRoomId, 'messages'), {
      senderId: currentUser.uid,
      senderName: currentUserData?.nome || 'Usuário',
      mensagem: text,
      data: serverTimestamp()
    });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
  }
}

// ===== VOLTAR AO BOT =====
async function backToBot() {
  if (activeRoomId) {
    try {
      await updateDoc(doc(db, 'chatRooms', activeRoomId), {
        status: 'closed'
      });
    } catch { /* sala pode já ter sido fechada */ }
  }
  cleanupAndBackToBot();
}

function cleanupAndBackToBot() {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  activeRoomId = null;
  chatMessages.innerHTML = '';
  updateUIForMode('bot');
  addBotMessage('Olá! 💜 Eu sou o assistente do Conexão Consciente. Estou aqui pra te ouvir. Como você está se sentindo hoje?');
}

// ===== CANCELAR ESPERA =====
async function cancelWait() {
  if (activeRoomId) {
    try {
      await deleteDoc(doc(db, 'chatRooms', activeRoomId));
    } catch { /* silenciar */ }
  }
  cleanupAndBackToBot();
}

// ===== RESPOSTAS DO BOT =====
const keywords = [
  {
    words: ['triste', 'tristeza', 'chorar', 'chorando', 'mal', 'péssimo', 'péssima', 'horrível'],
    response: 'Sinto muito que esteja se sentindo assim. 💙 A tristeza é uma emoção válida e importante. Você não precisa passar por isso sozinho(a). Se quiser, me conta mais sobre o que está acontecendo.'
  },
  {
    words: ['ansioso', 'ansiosa', 'ansiedade', 'nervoso', 'nervosa', 'agonia', 'pânico'],
    response: 'A ansiedade pode ser muito difícil. 🌊 Tente este exercício: respire fundo por 4 segundos, segure por 4 e solte por 4. Repita 3 vezes. Se a ansiedade persistir, é importante conversar com um profissional.'
  },
  {
    words: ['feliz', 'bem', 'ótimo', 'ótima', 'legal', 'massa', 'top', 'incrível'],
    response: 'Que bom saber disso! 🌟 Aproveite esse momento e lembre-se dele quando os dias forem mais difíceis. Você merece se sentir bem!'
  },
  {
    words: ['bullying', 'cyberbullying', 'zoando', 'humilhando', 'zuando', 'debochando', 'perseguindo'],
    response: 'Cyberbullying é algo muito sério e você não merece passar por isso. 🛡️ Algumas coisas importantes: não responda agressões com agressões, salve provas (prints), bloqueie a pessoa, denuncie na plataforma e conte para um adulto de confiança. Você não está errado(a) em pedir ajuda.'
  },
  {
    words: ['sozinho', 'sozinha', 'solidão', 'ninguém', 'abandonado', 'abandonada', 'isolado'],
    response: 'Eu entendo como a solidão pode pesar. 🤗 Mas saiba que você não está realmente sozinho(a). Procure se conectar com pessoas que te fazem bem, mesmo que seja por uma mensagem. E lembre-se: eu estou aqui pra te ouvir.'
  },
  {
    words: ['raiva', 'irritado', 'irritada', 'bravo', 'brava', 'ódio', 'revolta'],
    response: 'A raiva é uma emoção natural. 🌊 O importante é como a gente lida com ela. Tente se afastar da situação por um momento, respire fundo. Escrever o que sente pode ajudar a organizar os pensamentos. Se quiser desabafar, estou aqui.'
  },
  {
    words: ['foto', 'nudes', 'nude', 'imagem', 'vídeo', 'vazou', 'vazaram', 'exposição'],
    response: '⚠️ Se alguém compartilhou sua imagem íntima sem consentimento, isso é CRIME (Lei 13.718/2018). Passos importantes: 1) Não se culpe — a culpa é de quem divulgou. 2) Salve provas. 3) Conte para um adulto de confiança. 4) Denuncie à polícia e à plataforma. Você tem direitos e não está sozinho(a) nisso.'
  },
  {
    words: ['medo', 'assustado', 'assustada', 'ameaça', 'ameaçando', 'perigo'],
    response: 'Se você está se sentindo em perigo ou sendo ameaçado(a), é muito importante: 1) Não enfrente a situação sozinho(a). 2) Conte para um adulto de confiança AGORA. 3) Se for urgente, ligue 190 (polícia) ou 188 (CVV). Sua segurança vem em primeiro lugar. 🆘'
  },
  {
    words: ['morrer', 'suicídio', 'suicida', 'acabar', 'desistir', 'sem saída'],
    response: '💜 O que você está sentindo é muito importante e eu me preocupo com você. Por favor, ligue AGORA para o CVV: 188 (24h, gratuito). Você também pode acessar cvv.org.br. Você não precisa enfrentar isso sozinho(a). Existem pessoas que querem te ajudar.'
  },
  {
    words: ['escola', 'aula', 'colégio', 'professor', 'professora', 'prova'],
    response: 'A escola pode trazer muitas pressões, né? 📚 Lembre-se que notas não definem quem você é. Se algo te incomoda na escola, tente conversar com um professor ou orientador de confiança. O importante é pedir ajuda quando precisar.'
  },
  {
    words: ['família', 'pai', 'mãe', 'pais', 'casa', 'irmão', 'irmã'],
    response: 'Questões familiares podem ser complicadas. 🏠 Nem sempre a gente consegue resolver sozinho(a). Se você sente que precisa de apoio, tente conversar com alguém de fora da situação — um tio, amigo da família, professor ou psicólogo.'
  },
  {
    words: ['obrigado', 'obrigada', 'valeu', 'agradeço', 'thanks'],
    response: 'De nada! 😊 Estou sempre aqui quando precisar. Lembre-se: pedir ajuda é sinal de coragem, não de fraqueza. Cuide-se! 💜'
  },
  {
    words: ['oi', 'olá', 'ola', 'eae', 'eai', 'hey', 'bom dia', 'boa tarde', 'boa noite'],
    response: 'Olá! 😊 Que bom ter você aqui. Como você está se sentindo? Pode me contar o que quiser — estou aqui pra te ouvir.'
  },
  {
    words: ['ajuda', 'help', 'socorro', 'preciso'],
    response: 'Estou aqui pra te ajudar! 🤝 Me conta o que está acontecendo. Se for uma emergência, ligue 188 (CVV) ou 190 (Polícia). Se quiser conversar sobre sentimentos, segurança digital ou qualquer outra coisa, pode falar.'
  },
  {
    words: ['redes sociais', 'instagram', 'tiktok', 'twitter', 'facebook', 'whatsapp'],
    response: 'As redes sociais podem ser divertidas, mas também cansativas. 📱 Se algo te incomoda online, não hesite em: silenciar conteúdos que te fazem mal, definir limites de tempo de uso, e lembrar que a vida real é muito mais rica do que o que aparece nas telas.'
  }
];

const defaultResponses = [
  'Entendo. Me conta mais sobre isso? Estou aqui pra ouvir. 💭',
  'Obrigado por compartilhar. Como você se sente em relação a isso? 💜',
  'Sei que nem sempre é fácil falar sobre o que sentimos. Vou estar aqui quando precisar. 🤗',
  'Isso que você está dizendo é importante. Quer continuar falando sobre esse assunto?',
  'Eu ouço você. Saiba que seus sentimentos são válidos. 💙',
  'Fico feliz que esteja conversando comigo. Me conta mais? Estou aqui sem julgamentos.'
];

// ===== PROCESSAR RESPOSTA =====
function getBotResponse(userText) {
  const text = userText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const kw of keywords) {
    for (const word of kw.words) {
      const normalizedWord = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (text.includes(normalizedWord)) {
        return kw.response;
      }
    }
  }

  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// ===== ENVIAR MENSAGEM =====
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';

  // Modo humano: enviar para a sala
  if (chatMode === 'human') {
    await sendHumanMessage(text);
    return;
  }

  // Modo bot: resposta automática
  addUserMessage(text);

  // Salvar no Firebase
  if (currentUser) {
    try {
      await addDoc(collection(db, 'mensagens'), {
        userId: currentUser.uid,
        mensagem: text,
        tipo: 'user',
        data: serverTimestamp()
      });
    } catch {
      // Silenciar
    }
  }

  // Simular digitação
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-msg bot';
  typingDiv.innerHTML = '<span class="loading"><span class="spinner"></span> Digitando...</span>';
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  setTimeout(() => {
    chatMessages.removeChild(typingDiv);
    const response = getBotResponse(text);
    addBotMessage(response);

    // Salvar resposta do bot
    if (currentUser) {
      addDoc(collection(db, 'mensagens'), {
        userId: currentUser.uid,
        mensagem: response,
        tipo: 'bot',
        data: serverTimestamp()
      }).catch(() => {});
    }
  }, 1200);
}

// ===== EVENT LISTENERS =====
if (btnSend) {
  btnSend.addEventListener('click', sendMessage);
}

if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

if (btnRequestHuman) {
  btnRequestHuman.addEventListener('click', requestHumanAttendant);
}

if (btnBackToBot) {
  btnBackToBot.addEventListener('click', backToBot);
}

if (btnCancelWait) {
  btnCancelWait.addEventListener('click', cancelWait);
}
