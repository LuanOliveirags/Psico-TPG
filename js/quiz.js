// ===== QUIZ.JS - Quiz de Segurança Digital =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let currentQuestion = 0;
let score = 0;
let answered = false;

// ===== PERGUNTAS =====
const questions = [
  {
    question: "Um colega postou uma foto sua sem sua permissão em uma rede social. O que você faz?",
    options: [
      "Ignora, porque todo mundo faz isso",
      "Pede para a pessoa remover e, se necessário, denuncia",
      "Posta uma foto da pessoa também como vingança",
      "Fica triste mas não faz nada"
    ],
    correct: 1,
    explanation: "Você tem o direito à sua imagem. Peça a remoção educadamente e, se não funcionar, use as ferramentas de denúncia da plataforma. Ninguém pode publicar sua imagem sem consentimento."
  },
  {
    question: "Você recebebeu uma mensagem de alguém desconhecido pedindo suas informações pessoais. O que fazer?",
    options: [
      "Responde com dados falsos, por diversão",
      "Bloqueia e não responde",
      "Envia os dados, parece uma pessoa legal",
      "Pergunta quem é e, se parecer confiável, envia"
    ],
    correct: 1,
    explanation: "Nunca compartilhe informações pessoais com desconhecidos na internet. Bloquear e denunciar é a atitude mais segura. Pessoas mal-intencionadas podem usar seus dados para golpes."
  },
  {
    question: "Qual é o impacto de comparar sua vida com perfis de influenciadores nas redes sociais?",
    options: [
      "É saudável porque motiva a melhorar",
      "Não tem impacto nenhum",
      "Pode gerar ansiedade, baixa autoestima e insatisfação",
      "Só afeta quem é fraco emocionalmente"
    ],
    correct: 2,
    explanation: "Muitos perfis nas redes sociais mostram uma realidade editada e filtrada. A comparação constante pode gerar sentimentos de inadequação. Lembre-se: o que você vê online não é a vida real completa de ninguém."
  },
  {
    question: "O que é cyberbullying?",
    options: [
      "Brincadeira normal entre amigos na internet",
      "Agressão, humilhação ou intimidação repetida por meios digitais",
      "Quando alguém discorda de você na internet",
      "Só é cyberbullying se for presencial também"
    ],
    correct: 1,
    explanation: "Cyberbullying é qualquer forma de agressão, humilhação ou intimidação que acontece no ambiente digital de forma repetida. É um problema sério que pode causar sofrimento real e tem consequências legais."
  },
  {
    question: "Alguém está sofrendo cyberbullying em um grupo do qual você participa. O que fazer?",
    options: [
      "Não se envolve, não é problema seu",
      "Ri junto pra não ser o próximo alvo",
      "Apoia a vítima, denuncia e avisa um adulto de confiança",
      "Sai do grupo silenciosamente"
    ],
    correct: 2,
    explanation: "Ficar em silêncio diante do cyberbullying pode ser tão prejudicial quanto participar. Apoie a vítima, denuncie o comportamento na plataforma e converse com um adulto de confiança."
  },
  {
    question: "Qual a melhor prática para criar senhas seguras?",
    options: [
      "Usar a mesma senha em todos os sites pra não esquecer",
      "Colocar a data de aniversário como senha",
      "Usar combinações longas com letras, números e símbolos",
      "Compartilhar a senha com amigos próximos"
    ],
    correct: 2,
    explanation: "Senhas fortes devem ser únicas para cada site/app, com pelo menos 8 caracteres, misturando maiúsculas, minúsculas, números e símbolos. Nunca compartilhe suas senhas com ninguém."
  },
  {
    question: "Quando é saudável usar o celular ou redes sociais antes de dormir?",
    options: [
      "Sempre, ajuda a relaxar",
      "Nunca, o ideal é evitar telas antes de dormir",
      "Apenas se for ver coisas positivas",
      "Quando não tem nada pra fazer"
    ],
    correct: 1,
    explanation: "A luz azul das telas interfere na produção de melatonina (hormônio do sono). O ideal é parar de usar telas pelo menos 30 minutos antes de dormir para ter uma noite de sono de qualidade."
  },
  {
    question: "Se você envia uma foto íntima para alguém de confiança, quais riscos existem?",
    options: [
      "Nenhum, se confia na pessoa está seguro",
      "A foto pode ser compartilhada, vazada ou usada para chantagem",
      "Só é arriscado se for para desconhecidos",
      "Não existe risco se a pessoa prometer sigilo"
    ],
    correct: 1,
    explanation: "Uma vez enviada, você perde o controle sobre a imagem. Mesmo pessoas de confiança podem ter seus dispositivos hackeados, ou o relacionamento pode mudar. A disseminação de imagens íntimas sem consentimento é crime (Lei 13.718/2018)."
  }
];

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;
  await loadUserInfo(user);
  renderQuestion();
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

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast show ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${msg}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== RENDERIZAR PERGUNTA =====
function renderQuestion() {
  const q = questions[currentQuestion];
  const totalQ = document.getElementById('totalQ');
  const currentQ = document.getElementById('currentQ');
  const progressBar = document.getElementById('progressBar');
  const questionLabel = document.getElementById('questionLabel');
  const questionText = document.getElementById('questionText');
  const optionsContainer = document.getElementById('optionsContainer');
  const explanation = document.getElementById('explanation');
  const btnNext = document.getElementById('btnNext');
  const quizCard = document.getElementById('quizCard');
  const quizResult = document.getElementById('quizResult');

  if (totalQ) totalQ.textContent = questions.length;
  if (currentQ) currentQ.textContent = currentQuestion + 1;
  if (progressBar) progressBar.style.width = `${((currentQuestion) / questions.length) * 100}%`;
  if (questionLabel) questionLabel.textContent = `Pergunta ${currentQuestion + 1}`;
  if (questionText) questionText.textContent = q.question;
  if (explanation) { explanation.style.display = 'none'; explanation.textContent = ''; }
  if (btnNext) btnNext.style.display = 'none';
  if (quizCard) quizCard.style.display = 'block';
  if (quizResult) quizResult.style.display = 'none';

  answered = false;

  optionsContainer.innerHTML = '';
  q.options.forEach((opt, i) => {
    const optDiv = document.createElement('div');
    optDiv.className = 'quiz-option';
    optDiv.innerHTML = `
      <span class="indicator">${String.fromCharCode(65 + i)}</span>
      <span>${opt}</span>
    `;
    optDiv.addEventListener('click', () => selectOption(i));
    optionsContainer.appendChild(optDiv);
  });
}

// ===== SELECIONAR OPÇÃO =====
function selectOption(index) {
  if (answered) return;
  answered = true;

  const q = questions[currentQuestion];
  const options = document.querySelectorAll('.quiz-option');
  const explanation = document.getElementById('explanation');
  const btnNext = document.getElementById('btnNext');
  const progressBar = document.getElementById('progressBar');

  options.forEach((opt, i) => {
    opt.style.pointerEvents = 'none';
    if (i === q.correct) {
      opt.classList.add('correct');
      opt.querySelector('.indicator').textContent = '✓';
    }
    if (i === index && index !== q.correct) {
      opt.classList.add('wrong');
      opt.querySelector('.indicator').textContent = '✗';
    }
  });

  if (index === q.correct) score++;

  if (explanation) {
    explanation.textContent = '💡 ' + q.explanation;
    explanation.style.display = 'block';
  }

  if (progressBar) {
    progressBar.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
  }

  if (btnNext) {
    btnNext.style.display = 'inline-flex';
    btnNext.textContent = currentQuestion === questions.length - 1 ? 'Ver Resultado' : 'Próxima →';
  }
}

// ===== PRÓXIMA / RESULTADO =====
const btnNext = document.getElementById('btnNext');
if (btnNext) {
  btnNext.addEventListener('click', async () => {
    currentQuestion++;
    if (currentQuestion >= questions.length) {
      showResult();
    } else {
      renderQuestion();
    }
  });
}

// ===== MOSTRAR RESULTADO =====
async function showResult() {
  const quizCard = document.getElementById('quizCard');
  const quizResult = document.getElementById('quizResult');
  const scoreCircle = document.getElementById('scoreCircle');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');

  if (quizCard) quizCard.style.display = 'none';
  if (quizResult) quizResult.style.display = 'block';

  const percentage = Math.round((score / questions.length) * 100);
  if (scoreCircle) scoreCircle.textContent = `${percentage}%`;

  if (percentage >= 80) {
    if (resultTitle) resultTitle.textContent = '🏆 Excelente!';
    if (resultText) resultText.textContent = 'Você demonstra ótimo conhecimento sobre segurança digital. Continue assim e compartilhe o que sabe com seus amigos!';
  } else if (percentage >= 50) {
    if (resultTitle) resultTitle.textContent = '👏 Bom trabalho!';
    if (resultText) resultText.textContent = 'Você está no caminho certo! Explore nosso conteúdo educativo para aprender mais sobre segurança digital.';
  } else {
    if (resultTitle) resultTitle.textContent = '📚 Vamos aprender juntos!';
    if (resultText) resultText.textContent = 'Não se preocupe! O importante é aprender. Visite nossa seção de conteúdo para se informar mais sobre segurança e cidadania digital.';
  }

  // Salvar resultado no Firebase
  if (currentUser) {
    try {
      await addDoc(collection(db, 'quiz'), {
        userId: currentUser.uid,
        pontuacao: percentage,
        acertos: score,
        total: questions.length,
        data: serverTimestamp()
      });
    } catch {
      // Silenciar
    }
  }
}

// ===== REINICIAR =====
const btnRestart = document.getElementById('btnRestart');
if (btnRestart) {
  btnRestart.addEventListener('click', () => {
    currentQuestion = 0;
    score = 0;
    answered = false;
    renderQuestion();
  });
}
