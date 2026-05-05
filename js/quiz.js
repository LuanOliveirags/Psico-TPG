// ===== QUIZ.JS - Quiz por Tema =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let currentTopic = null;
let currentQuestion = 0;
let score = 0;
let answered = false;

// ===== PERGUNTAS POR TEMA =====
const allQuestions = {
  cyberbullying: [
    {
      question: "O que caracteriza o cyberbullying?",
      options: [
        "Uma discussão pontual entre amigos nas redes sociais",
        "Agressão, humilhação ou intimidação repetida por meios digitais",
        "Qualquer comentário negativo que alguém faça na internet",
        "Só é cyberbullying se acontecer na escola também"
      ],
      correct: 1,
      explanation: "Cyberbullying é qualquer forma de agressão, humilhação ou intimidação que acontece no ambiente digital de forma repetida. É um problema sério com consequências reais e legais."
    },
    {
      question: "Um colega postou uma foto sua sem sua permissão em uma rede social. O que você faz?",
      options: [
        "Ignora, porque todo mundo faz isso",
        "Pede para a pessoa remover e, se necessário, denuncia na plataforma",
        "Posta uma foto da pessoa também como vingança",
        "Fica triste mas não faz nada"
      ],
      correct: 1,
      explanation: "Você tem o direito à sua imagem. Peça a remoção educadamente e, se não funcionar, use as ferramentas de denúncia da plataforma. Ninguém pode publicar sua imagem sem consentimento."
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
      question: "Qual das alternativas NÃO é uma forma de cyberbullying?",
      options: [
        "Criar perfis falsos para difamar alguém",
        "Enviar mensagens de ameaça repetidamente",
        "Discordar respeitosamente de uma opinião em um comentário",
        "Espalhar boatos e mentiras sobre alguém online"
      ],
      correct: 2,
      explanation: "Discordar respeitosamente faz parte do diálogo saudável. Cyberbullying envolve agressão, intimidação ou humilhação repetida — não toda discordância é bullying."
    }
  ],

  privacidade: [
    {
      question: "Você recebeu uma mensagem de alguém desconhecido pedindo suas informações pessoais. O que fazer?",
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
      question: "Qual é a melhor prática para criar senhas seguras?",
      options: [
        "Usar a mesma senha em todos os sites pra não esquecer",
        "Colocar a data de aniversário como senha",
        "Usar combinações longas com letras, números e símbolos",
        "Compartilhar a senha com amigos próximos"
      ],
      correct: 2,
      explanation: "Senhas fortes devem ser únicas para cada site, com pelo menos 8 caracteres, misturando maiúsculas, minúsculas, números e símbolos. Nunca compartilhe suas senhas."
    },
    {
      question: "O que NÃO deve ser compartilhado nas redes sociais?",
      options: [
        "Sua opinião sobre um filme que assistiu",
        "Fotos de uma viagem (sem mostrar localização em tempo real)",
        "Seu endereço residencial e rotina diária detalhada",
        "Uma música que você está curtindo"
      ],
      correct: 2,
      explanation: "Endereço e rotina detalhada podem ser usados por pessoas mal-intencionadas. Informações de localização em tempo real também são perigosas — mostram onde você está agora."
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
      explanation: "Uma vez enviada, você perde o controle sobre a imagem. A disseminação de imagens íntimas sem consentimento é crime (Lei 13.718/2018). Mesmo dispositivos de pessoas de confiança podem ser hackeados."
    }
  ],

  autoestima: [
    {
      question: "Qual é o impacto de comparar sua vida com perfis de influenciadores nas redes sociais?",
      options: [
        "É saudável porque motiva a melhorar",
        "Não tem impacto nenhum",
        "Pode gerar ansiedade, baixa autoestima e insatisfação",
        "Só afeta quem é fraco emocionalmente"
      ],
      correct: 2,
      explanation: "Muitos perfis mostram uma realidade editada e filtrada. A comparação constante pode gerar sentimentos de inadequação. O que você vê online não é a vida real completa de ninguém."
    },
    {
      question: "Você sente que precisa parecer de um certo jeito nas fotos por causa de pressões das redes. O que é saudável fazer?",
      options: [
        "Seguir os padrões porque todo mundo faz isso",
        "Usar filtros e edições para parecer com as pessoas que admira",
        "Refletir sobre o impacto dessas comparações na sua autoestima e buscar apoio",
        "Parar de usar redes sociais definitivamente"
      ],
      correct: 2,
      explanation: "A pressão estética nas redes pode causar ansiedade e depressão. Reconhecer esse impacto e conversar com alguém de confiança ou um profissional é o caminho mais saudável."
    },
    {
      question: "O que é FOMO?",
      options: [
        "Um tipo de vírus de computador",
        "Medo de ficar por fora do que acontece nas redes, causando ansiedade",
        "Uma rede social popular",
        "Uma técnica de meditação digital"
      ],
      correct: 1,
      explanation: "FOMO (Fear of Missing Out) é o medo de estar perdendo experiências que os outros estão tendo. É alimentado pelo uso excessivo das redes sociais e pode gerar ansiedade significativa."
    },
    {
      question: "Qual dessas atitudes ajuda a proteger sua autoestima no ambiente digital?",
      options: [
        "Checar curtidas e comentários a cada 5 minutos",
        "Seguir o maior número possível de influenciadores",
        "Fazer curadoria do feed: seguir perfis que te fazem bem e silenciar os que não fazem",
        "Postar apenas conteúdo perfeito para conseguir mais likes"
      ],
      correct: 2,
      explanation: "Você tem controle sobre o que consome. Fazer curadoria do feed reduz a exposição a conteúdos que causam comparação negativa e melhora sua relação com as redes sociais."
    }
  ],

  limites: [
    {
      question: "Quando é saudável usar o celular ou redes sociais antes de dormir?",
      options: [
        "Sempre, ajuda a relaxar",
        "Nunca — o ideal é evitar telas pelo menos 30 minutos antes de dormir",
        "Apenas se for ver coisas positivas",
        "Quando não tem nada pra fazer"
      ],
      correct: 1,
      explanation: "A luz azul das telas interfere na produção de melatonina (hormônio do sono). Evitar telas antes de dormir melhora a qualidade do sono e o bem-estar geral."
    },
    {
      question: "Alguém continua te mandando mensagens mesmo depois de você pedir que pare. O que fazer?",
      options: [
        "Continua respondendo para não ser mal-educado(a)",
        "Bloqueia a pessoa — seu limite deve ser respeitado",
        "Apenas ignora, sem bloquear",
        "Pede desculpa e tenta agradar"
      ],
      correct: 1,
      explanation: "Seus limites precisam ser respeitados. Bloquear uma pessoa que não respeita seus pedidos é uma medida saudável e necessária para sua segurança emocional."
    },
    {
      question: "Em qual das situações abaixo você deve dizer NÃO?",
      options: [
        "Quando um amigo te convida para um jogo online",
        "Quando alguém te pressiona para enviar fotos que te deixam desconfortável",
        "Quando alguém compartilha uma notícia interessante",
        "Quando um familiar quer conversar pelo WhatsApp"
      ],
      correct: 1,
      explanation: "'Não' é uma frase completa. Você não é obrigado(a) a enviar nada que te cause desconforto. Pressão para imagens íntimas é manipulação e pode ser crime."
    },
    {
      question: "O que são 'limites digitais'?",
      options: [
        "A velocidade máxima da sua internet",
        "O número máximo de seguidores que uma conta pode ter",
        "Regras pessoais sobre como, quando e com quem você interage online",
        "Filtros de conteúdo definidos pelas plataformas"
      ],
      correct: 2,
      explanation: "Limites digitais são escolhas conscientes sobre tempo de tela, com quem interagir, o que compartilhar e o que consumir. Eles protegem sua saúde mental e privacidade."
    }
  ],

  violencia: [
    {
      question: "O compartilhamento de imagens íntimas sem consentimento no Brasil é:",
      options: [
        "Apenas uma questão moral, sem consequências legais",
        "Crime, previsto na Lei 13.718/2018, com pena de reclusão",
        "Crime apenas se a pessoa for menor de idade",
        "Permitido se a imagem foi enviada voluntariamente antes"
      ],
      correct: 1,
      explanation: "A Lei 13.718/2018 criminaliza a divulgação de imagens íntimas sem consentimento. A pena é de 1 a 5 anos de reclusão. Não importa se a imagem foi enviada antes — a divulgação sem autorização é sempre crime."
    },
    {
      question: "Alguém está te perseguindo online: monitora seus posts, manda mensagens insistentes e te ameaça. Isso se chama:",
      options: [
        "Comportamento normal de quem gosta de você",
        "Cyberstalking, uma forma de violência digital tipificada como crime",
        "Só é problema se a pessoa te conhecer pessoalmente",
        "Situação que se resolve simplesmente ignorando"
      ],
      correct: 1,
      explanation: "Cyberstalking (perseguição online) foi criminalizado no Brasil pela Lei 14.132/2021. Você tem o direito de bloquear, denunciar e buscar proteção policial."
    },
    {
      question: "Se alguém compartilhou imagens suas sem permissão, qual é o primeiro passo correto?",
      options: [
        "Se culpar e tentar esquecer o ocorrido",
        "Apagar tudo das suas redes para que ninguém veja",
        "Documentar as evidências (prints, URLs) antes de denunciar",
        "Confrontar a pessoa publicamente nas redes sociais"
      ],
      correct: 2,
      explanation: "Antes de qualquer ação, salve as evidências: prints das publicações, URLs e perfis envolvidos. Isso é essencial para o registro policial e para solicitar remoção nas plataformas."
    },
    {
      question: "Você está em sofrimento por algo que aconteceu online e sua família não levou a sério. O que fazer?",
      options: [
        "Guardar para si, pois ninguém vai entender mesmo",
        "Buscar outros adultos de confiança: professor, conselheiro, psicólogo ou serviços como este",
        "Resolver sozinho(a), afinal é coisa da internet",
        "Abandonar as redes sociais como solução definitiva"
      ],
      correct: 1,
      explanation: "A falta de suporte familiar é um desafio real. Mas existem profissionais preparados para ajudar. Serviços de saúde mental online existem justamente para ampliar o acesso ao apoio."
    }
  ],

  saudedigital: [
    {
      question: "Qual é o impacto do uso excessivo das redes sociais na saúde mental de adolescentes?",
      options: [
        "Nenhum, se o conteúdo consumido for positivo",
        "Pode aumentar sintomas de ansiedade, depressão e baixa autoestima",
        "Só afeta quem já tinha problemas mentais antes",
        "O impacto é sempre positivo porque mantém conexões sociais"
      ],
      correct: 1,
      explanation: "Pesquisas mostram que o uso excessivo das redes sociais está associado ao aumento de ansiedade, depressão e baixa autoestima em adolescentes, principalmente pela comparação social e pressão estética."
    },
    {
      question: "O que é 'detox digital'?",
      options: [
        "Um aplicativo para limpar vírus do celular",
        "Um período intencional de afastamento das telas para cuidar da saúde mental",
        "Uma dieta especial para quem usa muito o computador",
        "Uma configuração de privacidade nas redes sociais"
      ],
      correct: 1,
      explanation: "Detox digital é uma pausa intencional do uso de dispositivos e redes sociais. Reduzir o uso para menos de 30 minutos por dia pode diminuir significativamente sintomas de ansiedade."
    },
    {
      question: "Qual dos sinais abaixo indica que o uso das redes sociais pode estar afetando sua saúde mental?",
      options: [
        "Você usa as redes por 20 minutos e depois faz outra atividade",
        "Você sente ansiedade quando não pode checar o celular",
        "Você curte posts de amigos de vez em quando",
        "Você usa as redes para se informar sobre notícias"
      ],
      correct: 1,
      explanation: "Sentir ansiedade ao ficar sem o celular é um sinal de dependência digital. Outros sinais são: dormir mal, se sentir mal após usar as redes e preferir o mundo online ao presencial."
    },
    {
      question: "Qual estratégia é mais eficaz para um uso mais saudável das redes sociais?",
      options: [
        "Deletar todas as redes sociais permanentemente",
        "Nunca usar o celular na presença de outras pessoas",
        "Definir horários e limites de tempo de uso e fazer curadoria do feed",
        "Usar as redes apenas para trabalho ou estudos"
      ],
      correct: 2,
      explanation: "Equilíbrio é a chave. Definir limites de tempo, escolher conscientemente o que consumir e fazer pausas regulares são estratégias práticas e sustentáveis para um uso saudável."
    }
  ]
};

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  currentUser = user;
  await loadUserInfo(user);
  await loadScores();
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
if (hamburger && navLinks) hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) btnLogout.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../index.html';
});

// ===== USER INFO =====
async function loadUserInfo(user) {
  const userAvatar = document.getElementById('userAvatar');
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && userAvatar) userAvatar.textContent = userDoc.data().nome.charAt(0).toUpperCase();
  } catch { if (userAvatar) userAvatar.textContent = 'U'; }
}

// ===== CARREGAR SCORES ANTERIORES =====
async function loadScores() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db, 'quizScores', currentUser.uid));
    if (!snap.exists()) return;
    const data = snap.data();
    Object.keys(allQuestions).forEach(topic => {
      if (data[topic] !== undefined) {
        const badge = document.getElementById(`score-${topic}`);
        if (badge) {
          badge.textContent = `${data[topic]}%`;
          badge.style.display = 'inline-block';
          badge.className = 'quiz-score-badge ' + (data[topic] >= 75 ? 'score-good' : 'score-ok');
        }
      }
    });
  } catch { /* silenciar */ }
}

// ===== NAVEGAÇÃO: GRADE → QUIZ =====
document.querySelectorAll('.quiz-topic-card').forEach(card => {
  card.addEventListener('click', () => startQuiz(card.dataset.topic));
});

function startQuiz(topic) {
  currentTopic = topic;
  currentQuestion = 0;
  score = 0;
  answered = false;

  const titles = {
    cyberbullying: '🛡️ Cyberbullying',
    privacidade: '🔒 Privacidade Online',
    autoestima: '💪 Autoestima Digital',
    limites: '⚖️ Limites Digitais',
    violencia: '🚨 Violência Online',
    saudedigital: '🧠 Saúde Mental Digital'
  };

  document.getElementById('quizTopicTitle').textContent = titles[topic] || 'Quiz';
  document.getElementById('viewGrid').style.display = 'none';
  document.getElementById('viewQuiz').style.display = 'block';
  document.getElementById('quizCard').style.display = 'block';
  document.getElementById('quizResult').style.display = 'none';
  renderQuestion();
}

// ===== VOLTAR PARA GRADE =====
document.getElementById('btnBackToGrid')?.addEventListener('click', showGrid);
document.getElementById('btnBackResult')?.addEventListener('click', showGrid);

function showGrid() {
  document.getElementById('viewQuiz').style.display = 'none';
  document.getElementById('viewGrid').style.display = 'block';
  loadScores();
}

// ===== RENDERIZAR PERGUNTA =====
function renderQuestion() {
  const questions = allQuestions[currentTopic];
  const q = questions[currentQuestion];
  const total = questions.length;

  document.getElementById('totalQ').textContent = total;
  document.getElementById('currentQ').textContent = currentQuestion + 1;
  document.getElementById('progressBar').style.width = `${(currentQuestion / total) * 100}%`;
  document.getElementById('questionLabel').textContent = `Pergunta ${currentQuestion + 1}`;
  document.getElementById('questionText').textContent = q.question;

  const explanation = document.getElementById('explanation');
  if (explanation) { explanation.style.display = 'none'; explanation.textContent = ''; }

  const btnNext = document.getElementById('btnNext');
  if (btnNext) btnNext.style.display = 'none';

  answered = false;

  const optionsContainer = document.getElementById('optionsContainer');
  optionsContainer.innerHTML = '';
  q.options.forEach((opt, i) => {
    const optDiv = document.createElement('div');
    optDiv.className = 'quiz-option';
    optDiv.innerHTML = `<span class="indicator">${String.fromCharCode(65 + i)}</span><span>${opt}</span>`;
    optDiv.addEventListener('click', () => selectOption(i));
    optionsContainer.appendChild(optDiv);
  });
}

// ===== SELECIONAR OPÇÃO =====
function selectOption(index) {
  if (answered) return;
  answered = true;

  const q = allQuestions[currentTopic][currentQuestion];
  const options = document.querySelectorAll('.quiz-option');
  const explanation = document.getElementById('explanation');
  const btnNext = document.getElementById('btnNext');
  const progressBar = document.getElementById('progressBar');
  const total = allQuestions[currentTopic].length;

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

  if (progressBar) progressBar.style.width = `${((currentQuestion + 1) / total) * 100}%`;

  if (btnNext) {
    btnNext.style.display = 'inline-flex';
    btnNext.textContent = currentQuestion === total - 1 ? 'Ver Resultado' : 'Próxima →';
  }
}

// ===== PRÓXIMA PERGUNTA =====
document.getElementById('btnNext')?.addEventListener('click', async () => {
  currentQuestion++;
  const total = allQuestions[currentTopic].length;
  if (currentQuestion >= total) {
    await showResult();
  } else {
    renderQuestion();
  }
});

// ===== RESULTADO =====
async function showResult() {
  document.getElementById('quizCard').style.display = 'none';
  document.getElementById('quizResult').style.display = 'block';

  const total = allQuestions[currentTopic].length;
  const percentage = Math.round((score / total) * 100);
  document.getElementById('scoreCircle').textContent = `${percentage}%`;

  let title, text;
  if (percentage >= 75) {
    title = '🏆 Excelente!';
    text = 'Você tem ótimo conhecimento sobre esse tema. Continue aprendendo e compartilhe o que sabe!';
  } else if (percentage >= 50) {
    title = '👏 Bom trabalho!';
    text = 'Você está no caminho certo! Explore o conteúdo educativo deste tema para aprender ainda mais.';
  } else {
    title = '📚 Vamos aprender juntos!';
    text = 'Não se preocupe! Acesse o Conteúdo Educativo para se aprofundar neste tema e tente o quiz novamente.';
  }
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultText').textContent = text;

  // Salvar score por tema
  if (currentUser) {
    try {
      await setDoc(doc(db, 'quizScores', currentUser.uid), {
        [currentTopic]: percentage,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
    } catch { /* silenciar */ }
  }
}

// ===== REINICIAR =====
document.getElementById('btnRestart')?.addEventListener('click', () => {
  startQuiz(currentTopic);
});

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast show ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${msg}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}
