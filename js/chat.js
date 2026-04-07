// ===== CHAT.JS - Espaço de Escuta com respostas automáticas =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, addDoc, collection, query, where, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;
  await loadUserInfo(user);
  await loadChatHistory(user.uid);
  addBotMessage('Olá! 💜 Eu sou o assistente do Conexão Consciente. Estou aqui pra te ouvir. Como você está se sentindo hoje?');
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
      const data = userDoc.data();
      if (userAvatar) userAvatar.textContent = data.nome.charAt(0).toUpperCase();
    }
  } catch {
    if (userAvatar) userAvatar.textContent = 'U';
  }
}

// ===== ELEMENTOS DO CHAT =====
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const btnSend = document.getElementById('btnSend');

// ===== ADICIONAR MENSAGEM NA TELA =====
function addMessage(text, type = 'bot') {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${type}`;

  const now = new Date();
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  msgDiv.innerHTML = `${text}<span class="time">${time}</span>`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addBotMessage(text) {
  addMessage(text, 'bot');
}

function addUserMessage(text) {
  addMessage(text, 'user');
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

  addUserMessage(text);
  chatInput.value = '';

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

if (btnSend) {
  btnSend.addEventListener('click', sendMessage);
}

if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

// ===== CARREGAR HISTÓRICO =====
async function loadChatHistory(uid) {
  try {
    const q = query(
      collection(db, 'mensagens'),
      where('userId', '==', uid),
      orderBy('data', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const msgs = [];
    snapshot.forEach(docSnap => msgs.push(docSnap.data()));
    msgs.reverse();

    msgs.forEach(msg => {
      addMessage(msg.mensagem, msg.tipo || 'bot');
    });
  } catch {
    // Índice pode não estar criado
  }
}
