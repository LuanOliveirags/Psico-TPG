// ===== CONTEUDO.JS - Conteúdo Educativo =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  await loadUserInfo(user);
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

// ===== CONTEÚDOS =====
const contents = {
  cyberbullying: {
    title: '🛡️ Cyberbullying: Entenda e Proteja-se',
    body: `
      <p>O <strong>cyberbullying</strong> é a prática de intimidação, humilhação ou agressão que acontece através de meios digitais — redes sociais, mensagens, jogos online, fóruns, etc.</p>

      <h3>Como identificar?</h3>
      <ul>
        <li>Mensagens ofensivas, ameaçadoras ou humilhantes enviadas repetidamente</li>
        <li>Criação de perfis falsos para difamar alguém</li>
        <li>Compartilhamento de fotos ou informações pessoais sem consentimento</li>
        <li>Exclusão intencional de grupos ou atividades online</li>
        <li>Espalhar boatos ou mentiras sobre alguém na internet</li>
      </ul>

      <h3>O que fazer se você sofrer cyberbullying?</h3>
      <ul>
        <li><strong>Não revide:</strong> Responder com agressão pode piorar a situação</li>
        <li><strong>Salve as provas:</strong> Tire prints das mensagens e comportamentos</li>
        <li><strong>Bloqueie a pessoa:</strong> Use as ferramentas da plataforma</li>
        <li><strong>Denuncie:</strong> Na plataforma e, se necessário, às autoridades</li>
        <li><strong>Converse com alguém:</strong> Pais, professores, psicólogos</li>
      </ul>

      <div class="tip-box">
        <p>💡 Cyberbullying é crime no Brasil! A Lei 13.185/2015 (Lei Antibullying) inclui o cyberbullying e prevê responsabilização dos agressores.</p>
      </div>

      <h3>Como apoiar alguém que sofre cyberbullying?</h3>
      <ul>
        <li>Ouça sem julgar</li>
        <li>Não compartilhe o conteúdo ofensivo</li>
        <li>Ofereça apoio e ajude a denunciar</li>
        <li>Seja uma presença positiva online</li>
      </ul>

      <h3>🎬 Assista: Cyberbullying em foco</h3>
      <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:14px; margin-top:12px;">
        <iframe
          src="https://www.youtube.com/embed/5RlOBrmyzbY"
          title="Cyberbullying - Vídeo educativo"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          style="position:absolute; top:0; left:0; width:100%; height:100%; border-radius:14px;">
        </iframe>
      </div>
    `
  },

  privacidade: {
    title: '🔒 Privacidade Online: Proteja Seus Dados',
    body: `
      <p>No mundo digital, suas <strong>informações pessoais</strong> são valiosas. Saber protegê-las é essencial para sua segurança.</p>

      <h3>O que NÃO compartilhar online?</h3>
      <ul>
        <li>Endereço residencial ou da escola</li>
        <li>Número de telefone</li>
        <li>Documentos pessoais (RG, CPF)</li>
        <li>Senhas e dados bancários</li>
        <li>Localização em tempo real</li>
        <li>Rotina diária detalhada</li>
      </ul>

      <h3>Dicas de proteção:</h3>
      <ul>
        <li><strong>Perfis privados:</strong> Configure suas redes para que apenas amigos vejam suas postagens</li>
        <li><strong>Senhas fortes:</strong> Use combinações de letras, números e símbolos. Nunca repita senhas</li>
        <li><strong>Autenticação em dois fatores:</strong> Ative sempre que possível</li>
        <li><strong>Cuidado com links:</strong> Não clique em links suspeitos ou de desconhecidos</li>
        <li><strong>Revise permissões:</strong> Verifique quais apps têm acesso às suas informações</li>
      </ul>

      <div class="tip-box">
        <p>💡 A Lei Geral de Proteção de Dados (LGPD) protege seus dados pessoais no Brasil. Empresas e plataformas têm obrigação de zelar pela sua privacidade.</p>
      </div>

      <h3>Imagens íntimas</h3>
      <p>A disseminação de imagens íntimas sem consentimento é <strong>crime</strong> (Lei 13.718/2018). Se isso acontecer com você ou alguém que conhece:</p>
      <ul>
        <li>Não se culpe — a responsabilidade é de quem divulgou</li>
        <li>Salve provas e procure ajuda</li>
        <li>Denuncie à polícia e à plataforma</li>
      </ul>
    `
  },

  autoestima: {
    title: '💪 Autoestima Digital: Você é Mais que um Perfil',
    body: `
      <p>As redes sociais podem afetar diretamente como nos vemos. Entender isso é o primeiro passo para se proteger.</p>

      <h3>Como as redes afetam sua autoestima?</h3>
      <ul>
        <li><strong>Comparação social:</strong> Comparar sua vida real com os "melhores momentos" dos outros</li>
        <li><strong>Busca por validação:</strong> Depender de likes e comentários para se sentir bem</li>
        <li><strong>Padrões irreais:</strong> Filtros e edições criam imagens impossíveis de alcançar</li>
        <li><strong>FOMO:</strong> Medo de estar perdendo algo (Fear of Missing Out)</li>
      </ul>

      <h3>O que você pode fazer:</h3>
      <ul>
        <li><strong>Faça pausas:</strong> Defina horários para usar as redes e respire</li>
        <li><strong>Curadoria do feed:</strong> Siga perfis que te fazem bem e silencie os que não fazem</li>
        <li><strong>Lembre-se:</strong> O que vê online é uma versão editada da realidade</li>
        <li><strong>Celebre conquistas reais:</strong> Valorize suas vitórias, mesmo as pequenas</li>
        <li><strong>Seja autêntico(a):</strong> Você não precisa se encaixar em padrões</li>
      </ul>

      <div class="tip-box">
        <p>💡 Seu valor não é medido por seguidores, likes ou comentários. Você é uma pessoa completa e importante, com ou sem redes sociais.</p>
      </div>

      <h3>Exercício prático:</h3>
      <p>Liste 3 coisas sobre você que te fazem único(a) e que nenhum filtro pode criar. Pode ser sua risada, seu jeito de ajudar, sua criatividade... Essas são as coisas que realmente importam.</p>
    `
  },

  limites: {
    title: '⚖️ Limites Digitais: Aprenda a Dizer Não',
    body: `
      <p>Estabelecer <strong>limites saudáveis</strong> no mundo digital é tão importante quanto no presencial. É sobre respeitar seus próprios limites e os dos outros.</p>

      <h3>Tipos de limites digitais:</h3>
      <ul>
        <li><strong>Tempo de tela:</strong> Definir horários para usar e parar de usar o celular</li>
        <li><strong>Conteúdo:</strong> Escolher o que consumir e o que evitar</li>
        <li><strong>Interações:</strong> Decidir com quem e como interagir online</li>
        <li><strong>Privacidade:</strong> Determinar o que compartilhar e o que manter privado</li>
      </ul>

      <h3>Situações em que você pode (e deve) dizer NÃO:</h3>
      <ul>
        <li>Quando pedem para enviar fotos que te deixam desconfortável</li>
        <li>Quando alguém insiste em saber informações pessoais</li>
        <li>Quando te pressionam para participar de algo que não quer</li>
        <li>Quando um grupo se torna tóxico ou agressivo</li>
        <li>Quando usar o celular está atrapalhando seu sono ou estudos</li>
      </ul>

      <div class="tip-box">
        <p>💡 "Não" é uma frase completa. Você não é obrigado(a) a justificar seus limites para ninguém. Cuidar de si mesmo(a) não é egoísmo — é necessidade.</p>
      </div>

      <h3>Dicas práticas:</h3>
      <ul>
        <li>Use o modo "Não Perturbe" quando precisar focar</li>
        <li>Desative notificações de apps que te causam ansiedade</li>
        <li>Defina um horário para parar de usar telas antes de dormir</li>
        <li>Converse abertamente sobre seus limites com amigos e família</li>
        <li>Se algo te incomoda online, se afaste — está tudo bem</li>
      </ul>
    `
  },

  violencia: {
    title: '🚨 Violência Online: Conheça Seus Direitos',
    body: `
      <p>A violência no ambiente digital é real e tem consequências graves. Perseguição online, compartilhamento de imagens íntimas sem consentimento e assédio são crimes no Brasil.</p>

      <h3>O que é considerado violência online?</h3>
      <ul>
        <li><strong>Perseguição online (stalking):</strong> Monitorar, rastrear ou perseguir alguém repetidamente por meios digitais</li>
        <li><strong>Extorsão digital (sextorsão):</strong> Usar imagens íntimas como ameaça para obter dinheiro ou outros favores</li>
        <li><strong>Compartilhamento não consensual de imagens:</strong> Divulgar fotos ou vídeos íntimos sem a permissão da pessoa</li>
        <li><strong>Incitação ao ódio:</strong> Publicações que estimulam discriminação ou violência</li>
        <li><strong>Assédio online:</strong> Mensagens repetidas e indesejadas com caráter sexual ou intimidador</li>
      </ul>

      <div class="tip-box tip-danger">
        <p>⚖️ <strong>Lei 13.718/2018 – Importunação Sexual Digital:</strong> compartilhar, sem consentimento, imagem íntima, foto, vídeo ou áudio de nudez é crime. Pena: reclusão de 1 a 5 anos, mais multa.</p>
      </div>

      <h3>O que fazer se você for vítima?</h3>
      <ul>
        <li><strong>Não se culpe:</strong> A responsabilidade é sempre de quem praticou o ato</li>
        <li><strong>Documente tudo:</strong> Prints, URLs, nomes de perfis — guarde as evidências antes de denunciar</li>
        <li><strong>Solicite a remoção:</strong> Use as ferramentas de denúncia das plataformas (Instagram, WhatsApp, TikTok, etc.)</li>
        <li><strong>Registre boletim de ocorrência:</strong> Procure uma delegacia comum ou Delegacia da Mulher</li>
        <li><strong>Busque apoio:</strong> Converse com alguém de confiança ou acesse este serviço</li>
      </ul>

      <h3>Canais de denúncia e apoio:</h3>
      <ul>
        <li><strong>SaferNet Brasil:</strong> safernet.org.br — denúncia de crimes na internet</li>
        <li><strong>Delegacia Virtual:</strong> disponível em vários estados</li>
        <li><strong>Ligue 180:</strong> Central de Atendimento à Mulher (violência de gênero)</li>
        <li><strong>CVV 188:</strong> apoio emocional em crise, 24 horas</li>
        <li><strong>MMFDH – Ligue 100:</strong> Ministério dos Direitos Humanos</li>
      </ul>

      <div class="tip-box">
        <p>💜 Se você está passando por isso agora, <strong>você não está sozinho(a)</strong>. Converse com um dos especialistas deste serviço pelo Chat.</p>
      </div>
    `
  },

  saudedigital: {
    title: '🧠 Saúde Mental e Redes Sociais',
    body: `
      <p>O ambiente digital faz parte da nossa vida, mas seu uso excessivo ou inadequado pode afetar diretamente nossa <strong>saúde mental</strong>. Entender essa relação é o primeiro passo para um uso mais saudável.</p>

      <h3>Como as redes sociais podem afetar sua saúde mental?</h3>
      <ul>
        <li><strong>Ansiedade social:</strong> Medo constante de não ter curtidas, comentários ou de ser excluído(a)</li>
        <li><strong>Depressão:</strong> Comparação com vidas "perfeitas" cria sensação de inadequação</li>
        <li><strong>Sono prejudicado:</strong> Luz azul das telas e hiperativação mental dificultam adormecer</li>
        <li><strong>FOMO (medo de ficar por fora):</strong> Ansiedade de não estar presente em tudo que acontece online</li>
        <li><strong>Vício em validação:</strong> Dependência de curtidas e comentários para se sentir valorizado(a)</li>
        <li><strong>Exposição a conteúdos prejudiciais:</strong> Algoritmos que amplificam conteúdo negativo ou que reforça inseguranças</li>
      </ul>

      <h3>Pressão estética e padrões irreais:</h3>
      <p>Influenciadores e algoritmos frequentemente promovem padrões de beleza que são <strong>editados, filtrados e impossíveis de alcançar</strong> na vida real. Isso pode causar:</p>
      <ul>
        <li>Insatisfação com o próprio corpo</li>
        <li>Busca por procedimentos estéticos desnecessários</li>
        <li>Transtornos alimentares</li>
        <li>Baixíssima autoestima</li>
      </ul>

      <div class="tip-box">
        <p>💡 Pesquisas mostram que reduzir o uso das redes sociais para menos de 30 minutos por dia pode diminuir significativamente sintomas de ansiedade e depressão em adolescentes.</p>
      </div>

      <h3>Sinais de alerta para buscar ajuda:</h3>
      <ul>
        <li>Você se sente mal após usar as redes sociais com frequência</li>
        <li>Tem dificuldade de parar de usar o celular mesmo quando quer</li>
        <li>Pensamentos sobre aparência ou comparações tomam muito espaço na sua cabeça</li>
        <li>Prefere o mundo online ao mundo real</li>
        <li>Sente ansiedade quando fica sem o celular</li>
      </ul>

      <h3>Estratégias de autocuidado digital:</h3>
      <ul>
        <li><strong>Detox digital:</strong> Um dia por semana longe das redes</li>
        <li><strong>Curadoria do feed:</strong> Siga perfis que te inspiram de forma saudável; deixe de seguir os que causam mal-estar</li>
        <li><strong>Alerta de tempo de uso:</strong> Configure lembretes de limite de tempo nos apps</li>
        <li><strong>Celebre conquistas offline:</strong> Valorize realizações reais, não apenas as que você posta</li>
        <li><strong>Converse sobre isso:</strong> Compartilhar suas experiências com amigos ou profissionais ajuda muito</li>
      </ul>
    `
  }
};

// ===== ABRIR MODAL =====
const contentCards = document.querySelectorAll('.content-card');
const modal = document.getElementById('contentModal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

contentCards.forEach(card => {
  card.addEventListener('click', () => {
    const contentKey = card.dataset.content;
    const content = contents[contentKey];
    if (!content) return;

    modalBody.innerHTML = `<h2>${content.title}</h2>${content.body}`;
    modal.classList.add('show');
  });
});

// ===== FECHAR MODAL =====
if (modalClose) {
  modalClose.addEventListener('click', () => {
    modal.classList.remove('show');
  });
}

if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });
}

// ESC para fechar
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
    modal.classList.remove('show');
  }
});
