// ===== ATENDENTE.JS - Painel do Atendente =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, getDocs, addDoc, updateDoc, setDoc, collection,
  query, where, orderBy, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;

// Mapa de salas abertas: roomId -> { data, unsubMessages, unsubRoom }
const openRooms = new Map();
let displayedRoomId = null; // sala exibida no painel direito
let unsubQueue = null;

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  currentUser = user;
  await loadUserInfo(user);

  if (!currentUserData || currentUserData.role !== 'atendente') {
    document.querySelector('.atendente-layout').innerHTML = `
      <div class="card" style="text-align:center; padding:48px; grid-column:1/-1;">
        <span style="font-size:3rem;">🚫</span>
        <h3 style="margin:16px 0 8px;">Acesso Restrito</h3>
        <p style="color:var(--text-light);">Você não tem permissão de especialista. Entre em contato com o administrador.</p>
        <a href="dashboard.html" class="btn btn-primary" style="margin-top:20px;">Voltar ao Início</a>
      </div>
    `;
    return;
  }

  await loadActiveRooms(user.uid);
  listenToQueue();
  setupGroupModal();
  setupMembersModal();
  setupSessionNotes();
  setupTabs();
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
      currentUserData = userDoc.data();
      if (userAvatar) userAvatar.textContent = currentUserData.nome.charAt(0).toUpperCase();
    }
  } catch {
    if (userAvatar) userAvatar.textContent = 'A';
  }
}

// ===== ELEMENTOS =====
const queueList = document.getElementById('queueList');
const queueEmpty = document.getElementById('queueEmpty');
const atendenteChat = document.getElementById('atendenteChat');
const chatPlaceholder = document.getElementById('chatPlaceholder');
const chatUserName = document.getElementById('chatUserName');
const chatRoomStatus = document.getElementById('chatRoomStatus');
const atendenteChatMessages = document.getElementById('atendenteChatMessages');
const atendenteInput = document.getElementById('atendenteInput');
const btnAtendenteSend = document.getElementById('btnAtendenteSend');
const btnCloseRoom = document.getElementById('btnCloseRoom');
const activeRoomList = document.getElementById('activeRoomList');
const activeCount = document.getElementById('activeCount');

// ===== CARREGAR SALAS ATIVAS EXISTENTES =====
async function loadActiveRooms(uid) {
  try {
    // Salas individuais aceitas pelo atendente
    const q1 = query(
      collection(db, 'chatRooms'),
      where('atendenteId', '==', uid),
      where('status', '==', 'active')
    );
    const snap1 = await getDocs(q1);
    snap1.forEach(roomDoc => registerRoom(roomDoc.id, roomDoc.data()));
  } catch (err) {
    console.error('Erro ao carregar salas individuais:', err);
  }

  try {
    // Salas de grupo criadas pelo atendente (userId == uid = dono do grupo)
    const q2 = query(
      collection(db, 'chatRooms'),
      where('userId', '==', uid),
      where('status', '==', 'active')
    );
    const snap2 = await getDocs(q2);
    snap2.forEach(roomDoc => {
      // Só grupos (evita duplicar salas individuais onde o atendente seja também userId)
      if (roomDoc.data().type === 'group') {
        registerRoom(roomDoc.id, roomDoc.data());
      }
    });
  } catch (err) {
    console.error('Erro ao carregar salas de grupo:', err);
  }
}

// ===== REGISTRAR SALA NO MAPA LOCAL =====
function registerRoom(roomId, roomData) {
  if (openRooms.has(roomId)) return;

  const entry = { data: roomData, unsubMessages: null, unsubRoom: null };
  openRooms.set(roomId, entry);

  entry.unsubRoom = onSnapshot(doc(db, 'chatRooms', roomId), (docSnap) => {
    if (!docSnap.exists() || docSnap.data().status === 'closed') {
      if (displayedRoomId === roomId) addSystemMessage('O usuário encerrou a conversa.');
      removeRoomEntry(roomId);
      renderActiveRoomList();
      return;
    }
    entry.data = docSnap.data();
    renderActiveRoomList();
  });

  renderActiveRoomList();
}

// ===== REMOVER SALA DO MAPA =====
function removeRoomEntry(roomId) {
  const entry = openRooms.get(roomId);
  if (!entry) return;
  if (entry.unsubMessages) entry.unsubMessages();
  if (entry.unsubRoom) entry.unsubRoom();
  openRooms.delete(roomId);

  if (displayedRoomId === roomId) {
    displayedRoomId = null;
    atendenteChat.style.display = 'none';
    chatPlaceholder.style.display = 'flex';
    setChatFullscreen(false);
  }
}

// ===== RENDERIZAR LISTA DE ATIVOS =====
function renderActiveRoomList() {
  if (!activeCount || !activeRoomList) return;

  activeCount.textContent = openRooms.size;

  // Limpar itens anteriores
  activeRoomList.querySelectorAll('.active-room-item').forEach(el => el.remove());

  const emptyEl = activeRoomList.querySelector('.queue-empty');
  if (openRooms.size === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  openRooms.forEach((entry, roomId) => {
    const data = entry.data || {};
    const isGroup = data.type === 'group';
    const label = isGroup ? (data.groupName || 'Grupo') : (data.userName || 'Usuário');
    const icon = isGroup ? '👥' : '💬';
    const isSelected = roomId === displayedRoomId;

    const item = document.createElement('div');
    item.className = 'active-room-item' + (isSelected ? ' active-room-selected' : '');
    item.dataset.roomId = roomId;
    item.innerHTML = `
      <div class="active-room-info">
        <div class="queue-avatar" style="background:${isGroup ? 'var(--primary)' : 'var(--secondary)'}">
          ${icon}
        </div>
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span class="queue-time">${isGroup ? 'Sala de grupo' : 'Atendimento'}</span>
        </div>
      </div>
      <button class="btn-close-active" title="Encerrar">✕</button>
    `;
    item.querySelector('.active-room-info').addEventListener('click', () => switchToRoom(roomId));
    item.querySelector('.btn-close-active').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmCloseRoom(roomId);
    });
    activeRoomList.appendChild(item);
  });
}

// ===== ABAS DO PAINEL =====
function setupTabs() {
  document.querySelectorAll('.painel-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll('.painel-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.painel-tab-content').forEach(c => c.style.display = 'none');

  document.querySelector(`.painel-tab[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)?.style.setProperty('display', 'flex');

  if (tab === 'notas' && displayedRoomId) loadNotes(displayedRoomId);
  if (tab === 'triagem' && displayedRoomId) loadTriagemCompleta(displayedRoomId);
}

// ===== TROCAR SALA EXIBIDA =====
function switchToRoom(roomId) {
  displayedRoomId = roomId;
  const entry = openRooms.get(roomId);
  if (!entry) return;

  const data = entry.data;
  const isGroup = data.type === 'group';
  chatPlaceholder.style.display = 'none';
  atendenteChat.style.display = 'flex';

  const label = isGroup ? (data.groupName || 'Grupo') : (data.userName || 'Usuário');
  chatUserName.textContent = label;
  chatRoomStatus.textContent = isGroup ? 'Sala de Grupo' : 'Ativo';

  // Avatar
  const avatarEl = document.getElementById('chatHeaderAvatar');
  if (avatarEl) avatarEl.textContent = label.charAt(0).toUpperCase();

  // Botão de membros: visível apenas em grupos
  const btnManageMembers = document.getElementById('btnManageMembers');
  const membersCountEl = document.getElementById('membersCount');
  if (btnManageMembers) {
    btnManageMembers.style.display = isGroup ? '' : 'none';
    if (isGroup && membersCountEl) membersCountEl.textContent = (data.members || []).length;
  }

  // Resetar para aba Chat
  switchTab('chat');

  // No mobile: esconde a sidebar e mostra só o chat
  if (window.innerWidth <= 768) {
    document.getElementById('atendenteSidebar')?.style.setProperty('display', 'none');
    const btnVoltar = document.getElementById('btnVoltarSidebar');
    const btnToggle = document.getElementById('btnToggleSidebar');
    const titulo = document.getElementById('especialistaTitulo');
    if (btnVoltar) btnVoltar.style.display = 'flex';
    if (btnToggle) btnToggle.style.display = 'none';
    if (titulo) titulo.style.display = 'none';
  }

  atendenteChatMessages.innerHTML = '';
  const greeting = isGroup
    ? `Sala de grupo: ${escapeHtml(data.groupName || 'Grupo')}`
    : `Você está conversando com ${escapeHtml(data.userName || 'Usuário')}`;
  addSystemMessage(greeting);

  if (entry.unsubMessages) entry.unsubMessages();
  const q = query(collection(db, 'chatRooms', roomId, 'messages'), orderBy('data', 'asc'));
  entry.unsubMessages = onSnapshot(q, (snapshot) => {
    if (displayedRoomId !== roomId) return;
    atendenteChatMessages.innerHTML = '';
    addSystemMessage(greeting);
    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const isOwn = msg.senderId === currentUser.uid;
      const displayText = isGroup && msg.senderName && !isOwn
        ? `[${escapeHtml(msg.senderName)}] ${escapeHtml(msg.mensagem)}`
        : escapeHtml(msg.mensagem);
      addMessage(displayText, isOwn);
    });
  });

  renderActiveRoomList();
}

// ===== CARREGAR TRIAGEM COMPLETA =====
async function loadTriagemCompleta(roomId) {
  const content = document.getElementById('triagemContent');
  const loading = document.getElementById('triagemLoading');
  if (!content || !loading) return;

  content.style.display = 'none';
  loading.style.display = 'flex';

  const entry = openRooms.get(roomId);
  const userId = entry?.data?.userId;

  if (!userId || entry?.data?.type === 'group') {
    loading.style.display = 'none';
    content.style.display = 'block';
    content.innerHTML = `<div class="triagem-empty"><span>👥</span><p>Triagem individual não disponível para salas de grupo.</p></div>`;
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'triagem', userId));
    loading.style.display = 'none';
    content.style.display = 'block';

    if (!snap.exists()) {
      content.innerHTML = `<div class="triagem-empty"><span>📋</span><p>Este usuário ainda não respondeu ao questionário de triagem.</p></div>`;
      return;
    }

    const d = snap.data();
    const prioridade = d.prioridade || 'baixa';
    const prioLabels = { alta: '🔴 Prioridade Alta', media: '🟡 Prioridade Média', baixa: '🟢 Prioridade Baixa' };
    const prioClasses = { alta: 'prioridade-alta', media: 'prioridade-media', baixa: 'prioridade-baixa' };

    const motivoLabels = {
      cyberbullying: 'Cyberbullying', imagem: 'Imagens sem consentimento',
      autoestima: 'Autoestima / comparação nas redes', ansiedade: 'Ansiedade / tristeza digital',
      perseguicao: 'Perseguição online', limites: 'Dificuldade com limites digitais', outro: 'Outro'
    };
    const expectativaLabels = {
      conversar: 'Ser ouvido(a)', informacao: 'Informações sobre direitos digitais',
      grupo: 'Grupos com outros adolescentes', tecnicas: 'Técnicas para ansiedade/autoestima',
      encaminhar: 'Encaminhamento para outros serviços'
    };
    const privacidadeLabels = {
      sim: 'Sim, tem espaço reservado', as_vezes: 'Às vezes', nao: 'Não — espaço compartilhado/barulhento'
    };
    const internetLabels = {
      boa: 'Boa e estável', instavel: 'Instável', dados: 'Só dados móveis', ruim: 'Ruim / sem acesso confiável'
    };
    const familiaLabels = {
      sim_apoia: 'Sim, e apoiam', sim_nao_apoia: 'Sabe, mas não leva a sério',
      nao_sabe: 'Não sabe', nao_quero: 'Prefere que não saiba por enquanto'
    };
    const confiancaLabels = { sim: 'Sim', talvez: 'Talvez, mas é difícil falar', nao: 'Não se sente à vontade' };
    const emocaoLabels = {
      bem: 'Está bem, quer só se informar', oscilando: 'Oscilando — às vezes bem, às vezes mal',
      mal: 'Sentindo-se mal com frequência', muito_mal: 'Sentindo-se muito mal — precisa de apoio urgente'
    };
    const autolesaoLabels = { nao: 'Não', pensamentos: 'Teve pensamentos, mas não agiu', sim: 'Sim' };

    const dataStr = d.data?.toDate ? d.data.toDate().toLocaleDateString('pt-BR') : '—';

    content.innerHTML = `
      <div class="triagem-view-header">
        <span class="notes-prioridade ${prioClasses[prioridade]}">${prioLabels[prioridade]}</span>
        <span class="triagem-data">Respondida em ${dataStr}</span>
      </div>

      <div class="triagem-view-body">
        <div class="triagem-view-section">
          <h4>Motivos da busca</h4>
          <div class="triagem-tags">
            ${(d.motivos || []).map(m => `<span class="triagem-tag">${motivoLabels[m] || m}</span>`).join('') || '<span class="triagem-vazio">Não informado</span>'}
          </div>
        </div>

        <div class="triagem-view-row">
          <div class="triagem-view-item">
            <span class="triagem-item-label">Espaço com privacidade</span>
            <span class="triagem-item-valor ${d.privacidade === 'nao' ? 'valor-alerta' : ''}">${privacidadeLabels[d.privacidade] || '—'}</span>
          </div>
          <div class="triagem-view-item">
            <span class="triagem-item-label">Qualidade da internet</span>
            <span class="triagem-item-valor ${(d.internet === 'ruim' || d.internet === 'dados') ? 'valor-alerta' : ''}">${internetLabels[d.internet] || '—'}</span>
          </div>
        </div>

        <div class="triagem-view-row">
          <div class="triagem-view-item">
            <span class="triagem-item-label">Família sabe do atendimento</span>
            <span class="triagem-item-valor">${familiaLabels[d.familia] || '—'}</span>
          </div>
          <div class="triagem-view-item">
            <span class="triagem-item-label">Pessoa de confiança</span>
            <span class="triagem-item-valor">${confiancaLabels[d.confianca] || '—'}</span>
          </div>
        </div>

        <div class="triagem-view-section">
          <h4>Estado emocional esta semana</h4>
          <span class="triagem-item-valor ${d.emocaoSemana === 'muito_mal' ? 'valor-urgente' : d.emocaoSemana === 'mal' ? 'valor-alerta' : ''}">${emocaoLabels[d.emocaoSemana] || '—'}</span>
        </div>

        <div class="triagem-view-section">
          <h4>Pensamentos de autolesão</h4>
          <span class="triagem-item-valor ${d.autolesao === 'sim' ? 'valor-urgente' : d.autolesao === 'pensamentos' ? 'valor-alerta' : ''}">${autolesaoLabels[d.autolesao] || '—'}</span>
        </div>

        <div class="triagem-view-section">
          <h4>O que espera do serviço</h4>
          <div class="triagem-tags">
            ${(d.expectativas || []).map(e => `<span class="triagem-tag">${expectativaLabels[e] || e}</span>`).join('') || '<span class="triagem-vazio">Não informado</span>'}
          </div>
        </div>

        ${d.comentario ? `
        <div class="triagem-view-section">
          <h4>Comentário livre</h4>
          <p class="triagem-comentario">${escapeHtml(d.comentario)}</p>
        </div>` : ''}
      </div>
    `;
  } catch (err) {
    console.error('Erro ao carregar triagem:', err);
    loading.style.display = 'none';
    content.style.display = 'block';
    content.innerHTML = `<div class="triagem-empty"><span>⚠️</span><p>Erro ao carregar os dados da triagem.</p></div>`;
  }
}

// ===== OUVIR FILA DE ESPERA EM TEMPO REAL =====
function listenToQueue() {
  const q = query(
    collection(db, 'chatRooms'),
    where('status', '==', 'waiting')
  );

  unsubQueue = onSnapshot(q, (snapshot) => {
    // Limpar lista exceto o empty state
    const items = queueList.querySelectorAll('.queue-item');
    items.forEach(item => item.remove());

    if (snapshot.empty) {
      queueEmpty.style.display = 'flex';
      return;
    }

    queueEmpty.style.display = 'none';

    // Ordenar client-side por data de criação
    const docs = snapshot.docs.slice().sort((a, b) => {
      const tA = a.data().criadoEm?.toMillis?.() || 0;
      const tB = b.data().criadoEm?.toMillis?.() || 0;
      return tA - tB;
    });

    docs.forEach(docSnap => {
      const data = docSnap.data();
      const item = document.createElement('div');
      item.className = 'queue-item';

      const time = data.criadoEm?.toDate
        ? data.criadoEm.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '--:--';

      item.innerHTML = `
        <div class="queue-item-info">
          <div class="queue-avatar">${(data.userName || 'U').charAt(0).toUpperCase()}</div>
          <div>
            <strong>${escapeHtml(data.userName || 'Usuário')}</strong>
            <span class="queue-time">Aguardando desde ${time}</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm btn-accept" data-room-id="${docSnap.id}">Aceitar</button>
      `;

      queueList.appendChild(item);
    });

    // Event listeners para aceitar
    queueList.querySelectorAll('.btn-accept').forEach(btn => {
      btn.addEventListener('click', () => acceptRoom(btn.dataset.roomId));
    });
  }, (error) => {
    console.error('Erro ao ouvir fila:', error);
  });
}

// ===== ACEITAR SALA =====
async function acceptRoom(roomId) {
  if (!currentUser || !currentUserData) return;

  try {
    await updateDoc(doc(db, 'chatRooms', roomId), {
      atendenteId: currentUser.uid,
      atendenteName: currentUserData.nome || 'Especialista',
      status: 'active'
    });

    const roomSnap = await getDoc(doc(db, 'chatRooms', roomId));
    if (roomSnap.exists()) {
      registerRoom(roomId, roomSnap.data());
      switchToRoom(roomId);
      showToast(`Atendendo ${roomSnap.data().userName || 'Usuário'}`, 'success');
    }
  } catch (err) {
    console.error('Erro ao aceitar sala:', err);
    showToast('Erro ao aceitar atendimento', 'error');
  }
}

// ===== CONFIRMAR ENCERRAMENTO =====
function confirmCloseRoom(roomId) {
  const entry = openRooms.get(roomId);
  if (!entry) return;
  const label = entry.data.type === 'group'
    ? (entry.data.groupName || 'grupo')
    : (entry.data.userName || 'usuário');
  if (confirm(`Encerrar atendimento com ${label}?`)) {
    closeRoom(roomId);
  }
}

// ===== ENCERRAR ATENDIMENTO =====
async function closeRoom(roomId) {
  const rid = roomId || displayedRoomId;
  if (!rid) return;

  try {
    await addDoc(collection(db, 'chatRooms', rid, 'messages'), {
      senderId: 'system',
      senderName: 'Sistema',
      mensagem: 'O especialista encerrou a conversa. Obrigado pelo contato! 💜',
      data: serverTimestamp()
    });
    await updateDoc(doc(db, 'chatRooms', rid), {
      status: 'closed',
      encerradoEm: serverTimestamp()
    });
  } catch (err) {
    console.error('Erro ao encerrar sala:', err);
  }

  removeRoomEntry(rid);
  renderActiveRoomList();
}

// ===== ENVIAR MENSAGEM =====
async function sendMessage() {
  const text = atendenteInput.value.trim();
  if (!text || !displayedRoomId) return;
  atendenteInput.value = '';

  try {
    await addDoc(collection(db, 'chatRooms', displayedRoomId, 'messages'), {
      senderId: currentUser.uid,
      senderName: currentUserData?.nome || 'Especialista',
      mensagem: text,
      data: serverTimestamp()
    });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
  }
}

// ===== ADICIONAR MENSAGEM NA TELA =====
function addMessage(html, isOwn = false) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${isOwn ? 'user' : 'bot'}`;
  const now = new Date();
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  msgDiv.innerHTML = `${html}<span class="time">${time}</span>`;
  atendenteChatMessages.appendChild(msgDiv);
  atendenteChatMessages.scrollTop = atendenteChatMessages.scrollHeight;
}

function addSystemMessage(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg system';
  msgDiv.textContent = text;
  atendenteChatMessages.appendChild(msgDiv);
  atendenteChatMessages.scrollTop = atendenteChatMessages.scrollHeight;
}

// ===== MODAL: GERENCIAR MEMBROS DO GRUPO =====
let addMembersSelected = new Set();
let managingRoomId = null;

function setupMembersModal() {
  const membersModal = document.getElementById('membersModal');
  const btnCloseMembersModal = document.getElementById('btnCloseMembersModal');
  const btnCancelMembers = document.getElementById('btnCancelMembers');
  const btnConfirmAddMember = document.getElementById('btnConfirmAddMember');
  const addMemberSearch = document.getElementById('addMemberSearch');
  const btnManageMembers = document.getElementById('btnManageMembers');

  if (!membersModal) return;

  btnManageMembers.addEventListener('click', () => openMembersModal(displayedRoomId));
  btnCloseMembersModal.addEventListener('click', closeMembersModal);
  btnCancelMembers.addEventListener('click', closeMembersModal);
  btnConfirmAddMember.addEventListener('click', addSelectedToGroup);
  addMemberSearch.addEventListener('input', () =>
    renderAddMemberList(addMemberSearch.value.trim().toLowerCase())
  );
  membersModal.addEventListener('click', (e) => { if (e.target === membersModal) closeMembersModal(); });
}

async function openMembersModal(roomId) {
  if (!roomId) return;
  managingRoomId = roomId;
  addMembersSelected.clear();
  document.getElementById('addMemberSearch').value = '';
  document.getElementById('addMemberInfo').textContent = 'Nenhum selecionado';
  document.getElementById('membersModal').style.display = 'flex';

  await renderMembersList(roomId);

  try {
    const snap = await getDocs(collection(db, 'users'));
    allUsers = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      allUsers.push({ id: docSnap.id, nome: d.nome || 'Usuário', role: d.role || 'user' });
    });
    renderAddMemberList('');
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
  }
}

function closeMembersModal() {
  document.getElementById('membersModal').style.display = 'none';
  managingRoomId = null;
  addMembersSelected.clear();
}

async function renderMembersList(roomId) {
  const membersList = document.getElementById('membersList');
  if (!membersList) return;
  membersList.innerHTML = '<p style="font-size:0.82rem;color:var(--text-light);">Carregando...</p>';

  const entry = openRooms.get(roomId);
  if (!entry) return;
  const members = entry.data.members || [];

  membersList.innerHTML = '';
  for (const uid of members) {
    let nome = uid;
    let role = 'user';
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        nome = userDoc.data().nome || uid;
        role = userDoc.data().role || 'user';
      }
    } catch {}

    const isCreator = uid === entry.data.userId;
    const isMe = uid === currentUser.uid;
    const roleLabel = role === 'atendente' ? 'Especialista' : (role === 'admin' ? 'Admin' : 'Usuário');
    const avatarColor = role === 'atendente' ? 'var(--primary)' : 'var(--secondary)';

    const item = document.createElement('div');
    item.className = 'member-item';
    item.innerHTML = `
      <div class="queue-avatar" style="width:34px;height:34px;font-size:0.8rem;flex-shrink:0;background:${avatarColor}">
        ${escapeHtml(nome.charAt(0).toUpperCase())}
      </div>
      <div style="flex:1;min-width:0">
        <strong style="font-size:0.85rem;display:block;">${escapeHtml(nome)}</strong>
        <span class="queue-time">${roleLabel}${isCreator ? ' · Criador' : ''}${isMe ? ' · Você' : ''}</span>
      </div>
      ${(!isCreator && !isMe) ? `<button class="btn-remove-member" data-uid="${uid}" title="Remover membro">✕</button>` : ''}
    `;
    if (!isCreator && !isMe) {
      item.querySelector('.btn-remove-member').addEventListener('click', () =>
        removeMemberFromGroup(roomId, uid, nome)
      );
    }
    membersList.appendChild(item);
  }
}

function renderAddMemberList(filter) {
  const entry = openRooms.get(managingRoomId);
  const currentMembers = entry?.data?.members || [];
  const list = document.getElementById('addMemberList');
  if (!list) return;

  const filtered = allUsers.filter(u =>
    !currentMembers.includes(u.id) && (!filter || u.nome.toLowerCase().includes(filter))
  );

  if (filtered.length === 0) {
    list.innerHTML = '<p style="color:var(--text-light);font-size:0.82rem;padding:8px 0;">Nenhum usuário disponível para adicionar.</p>';
    return;
  }

  list.innerHTML = '';
  filtered.forEach(user => {
    const isSelected = addMembersSelected.has(user.id);
    const item = document.createElement('div');
    item.className = `user-select-item${isSelected ? ' selected' : ''}`;
    item.innerHTML = `
      <div class="user-select-check">${isSelected ? '✓' : ''}</div>
      <div class="queue-avatar" style="width:32px;height:32px;font-size:0.8rem;flex-shrink:0;">${escapeHtml(user.nome.charAt(0).toUpperCase())}</div>
      <div>
        <strong style="font-size:0.85rem;">${escapeHtml(user.nome)}</strong>
        <span class="queue-time">${user.role === 'atendente' ? 'Especialista' : 'Usuário'}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      if (addMembersSelected.has(user.id)) {
        addMembersSelected.delete(user.id);
        item.classList.remove('selected');
        item.querySelector('.user-select-check').textContent = '';
      } else {
        addMembersSelected.add(user.id);
        item.classList.add('selected');
        item.querySelector('.user-select-check').textContent = '✓';
      }
      const count = addMembersSelected.size;
      document.getElementById('addMemberInfo').textContent =
        count === 0 ? 'Nenhum selecionado' : `${count} selecionado(s)`;
    });
    list.appendChild(item);
  });
}

async function removeMemberFromGroup(roomId, uid, nome) {
  if (!confirm(`Remover ${nome} do grupo?`)) return;
  try {
    await updateDoc(doc(db, 'chatRooms', roomId), { members: arrayRemove(uid) });
    const entry = openRooms.get(roomId);
    if (entry) {
      entry.data.members = (entry.data.members || []).filter(m => m !== uid);
      const membersCountEl = document.getElementById('membersCount');
      if (membersCountEl) membersCountEl.textContent = entry.data.members.length;
    }
    await renderMembersList(roomId);
    renderAddMemberList(document.getElementById('addMemberSearch').value.trim().toLowerCase());
    showToast(`${nome} removido(a) do grupo`, 'success');
  } catch (err) {
    console.error('Erro ao remover membro:', err);
    showToast('Erro ao remover membro', 'error');
  }
}

async function addSelectedToGroup() {
  if (addMembersSelected.size === 0) { showToast('Selecione ao menos um usuário', 'error'); return; }
  if (!managingRoomId) return;

  const btn = document.getElementById('btnConfirmAddMember');
  try {
    if (btn) btn.disabled = true;
    await updateDoc(doc(db, 'chatRooms', managingRoomId), {
      members: arrayUnion(...addMembersSelected)
    });
    const entry = openRooms.get(managingRoomId);
    if (entry) {
      entry.data.members = [...new Set([...(entry.data.members || []), ...addMembersSelected])];
      const membersCountEl = document.getElementById('membersCount');
      if (membersCountEl) membersCountEl.textContent = entry.data.members.length;
    }
    const count = addMembersSelected.size;
    addMembersSelected.clear();
    await renderMembersList(managingRoomId);
    renderAddMemberList('');
    document.getElementById('addMemberSearch').value = '';
    document.getElementById('addMemberInfo').textContent = 'Nenhum selecionado';
    showToast(`${count} membro(s) adicionado(s)`, 'success');
  } catch (err) {
    console.error('Erro ao adicionar membros:', err);
    showToast('Erro ao adicionar membros', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ===== MODAL: CRIAR SALA DE GRUPO =====
let allUsers = [];
let selectedUserIds = new Set();

function setupGroupModal() {
  const btnCreateGroup = document.getElementById('btnCreateGroup');
  const groupModal = document.getElementById('groupModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelGroup = document.getElementById('btnCancelGroup');
  const btnConfirmGroup = document.getElementById('btnConfirmGroup');
  const userSearch = document.getElementById('userSearch');

  if (!btnCreateGroup) return;

  btnCreateGroup.addEventListener('click', openGroupModal);
  btnCloseModal.addEventListener('click', closeGroupModal);
  btnCancelGroup.addEventListener('click', closeGroupModal);
  btnConfirmGroup.addEventListener('click', createGroupRoom);
  userSearch.addEventListener('input', () => renderUserList(userSearch.value.trim().toLowerCase()));
  groupModal.addEventListener('click', (e) => { if (e.target === groupModal) closeGroupModal(); });
}

async function openGroupModal() {
  selectedUserIds.clear();
  document.getElementById('groupName').value = '';
  document.getElementById('userSearch').value = '';
  document.getElementById('selectedInfo').textContent = 'Nenhum participante selecionado';
  document.getElementById('groupModal').style.display = 'flex';

  try {
    const snap = await getDocs(collection(db, 'users'));
    allUsers = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (docSnap.id !== currentUser.uid) {
        allUsers.push({ id: docSnap.id, nome: data.nome || 'Usuário', role: data.role || 'user' });
      }
    });
    renderUserList('');
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
    document.getElementById('userSelectList').innerHTML =
      '<p style="color:var(--danger);font-size:0.85rem;">Erro ao carregar usuários.</p>';
  }
}

function closeGroupModal() {
  document.getElementById('groupModal').style.display = 'none';
}

function renderUserList(filter) {
  const list = document.getElementById('userSelectList');
  const filtered = filter
    ? allUsers.filter(u => u.nome.toLowerCase().includes(filter))
    : allUsers;

  if (filtered.length === 0) {
    list.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;padding:12px 0;">Nenhum usuário encontrado.</p>';
    return;
  }

  list.innerHTML = '';
  filtered.forEach(user => {
    const isSelected = selectedUserIds.has(user.id);
    const item = document.createElement('div');
    item.className = `user-select-item${isSelected ? ' selected' : ''}`;
    item.innerHTML = `
      <div class="user-select-check">${isSelected ? '✓' : ''}</div>
      <div class="queue-avatar" style="width:32px;height:32px;font-size:0.8rem;">${user.nome.charAt(0).toUpperCase()}</div>
      <div>
        <strong style="font-size:0.85rem;">${escapeHtml(user.nome)}</strong>
        <span class="queue-time">${user.role === 'atendente' ? 'Especialista' : 'Usuário'}</span>
      </div>
    `;
    item.addEventListener('click', () => toggleUserSelect(user.id, item));
    list.appendChild(item);
  });
}

function toggleUserSelect(userId, itemEl) {
  if (selectedUserIds.has(userId)) {
    selectedUserIds.delete(userId);
    itemEl.classList.remove('selected');
    itemEl.querySelector('.user-select-check').textContent = '';
  } else {
    selectedUserIds.add(userId);
    itemEl.classList.add('selected');
    itemEl.querySelector('.user-select-check').textContent = '✓';
  }
  const count = selectedUserIds.size;
  document.getElementById('selectedInfo').textContent =
    count === 0 ? 'Nenhum participante selecionado' : `${count} participante(s) selecionado(s)`;
}

async function createGroupRoom() {
  const groupName = document.getElementById('groupName').value.trim();
  if (!groupName) { showToast('Informe o nome do grupo', 'error'); return; }
  if (selectedUserIds.size === 0) { showToast('Selecione ao menos um participante', 'error'); return; }

  const members = [currentUser.uid, ...selectedUserIds];
  const btnConfirm = document.getElementById('btnConfirmGroup');

  try {
    btnConfirm.disabled = true;

    // Passo 1: criar com status 'waiting' + userId (atende regra original implantada)
    const roomRef = await addDoc(collection(db, 'chatRooms'), {
      type: 'group',
      groupName,
      members,
      userId: currentUser.uid,
      status: 'waiting',
      criadoEm: serverTimestamp()
    });

    // Passo 2: promover para 'active' como atendente (atende regra de update implantada)
    await updateDoc(doc(db, 'chatRooms', roomRef.id), {
      status: 'active',
      atendenteId: currentUser.uid,
      atendenteName: currentUserData?.nome || 'Especialista'
    });

    await addDoc(collection(db, 'chatRooms', roomRef.id, 'messages'), {
      senderId: 'system',
      senderName: 'Sistema',
      mensagem: `Sala de grupo "${groupName}" criada. Bem-vindos! 💜`,
      data: serverTimestamp()
    });

    closeGroupModal();
    const roomSnap = await getDoc(roomRef);
    registerRoom(roomRef.id, roomSnap.data());
    switchToRoom(roomRef.id);
    showToast(`Grupo "${groupName}" criado!`, 'success');
  } catch (err) {
    console.error('Erro ao criar grupo:', err);
    showToast('Erro ao criar grupo. Tente novamente.', 'error');
  } finally {
    if (btnConfirm) btnConfirm.disabled = false;
  }
}

// ===== ANOTAÇÕES DE SESSÃO =====
function setupSessionNotes() {
  const btnSave = document.getElementById('btnSaveNotes');
  if (btnSave) btnSave.addEventListener('click', () => saveNotes(displayedRoomId));
}

async function loadNotes(roomId) {
  if (!roomId) return;
  try {
    const snap = await getDoc(doc(db, 'sessionNotes', roomId));
    if (!snap.exists()) {
      // Carregar prioridade da triagem do usuário
      await loadTriagemPrioridade(roomId);
      return;
    }
    const data = snap.data();
    const presEl = document.getElementById('notesPresenca');
    const condEl = document.getElementById('notesCondicoes');
    const textoEl = document.getElementById('notesTexto');
    const proximaEl = document.getElementById('notesProximaSessao');

    if (presEl) presEl.value = data.presenca || '';
    if (condEl) condEl.value = data.condicoes || '';
    if (textoEl) textoEl.value = data.texto || '';
    if (proximaEl) proximaEl.value = data.proximaSessao || '';

    // Restaurar checkboxes de temas
    const temas = data.temas || [];
    document.querySelectorAll('#notesTemasWrap input[type="checkbox"]').forEach(cb => {
      cb.checked = temas.includes(cb.value);
    });

    await loadTriagemPrioridade(roomId);
  } catch (err) {
    console.error('Erro ao carregar notas:', err);
  }
}

async function loadTriagemPrioridade(roomId) {
  const entry = openRooms.get(roomId);
  if (!entry) return;
  const userId = entry.data?.userId;
  if (!userId) return;
  try {
    const triagemSnap = await getDoc(doc(db, 'triagem', userId));
    const prioEl = document.getElementById('notesPrioridade');
    if (prioEl && triagemSnap.exists()) {
      const prioridade = triagemSnap.data().prioridade || 'baixa';
      const labels = { alta: '🔴 Prioridade Alta', media: '🟡 Prioridade Média', baixa: '🟢 Prioridade Baixa' };
      const classes = { alta: 'prioridade-alta', media: 'prioridade-media', baixa: 'prioridade-baixa' };
      prioEl.textContent = labels[prioridade] || '';
      prioEl.className = `notes-prioridade ${classes[prioridade] || ''}`;
    }
  } catch { /* silenciar */ }
}

async function saveNotes(roomId) {
  if (!roomId) { showToast('Selecione um atendimento primeiro', 'error'); return; }

  const temas = [...document.querySelectorAll('#notesTemasWrap input[type="checkbox"]:checked')].map(cb => cb.value);
  const data = {
    roomId,
    atendenteId: currentUser.uid,
    presenca: document.getElementById('notesPresenca')?.value || '',
    condicoes: document.getElementById('notesCondicoes')?.value || '',
    temas,
    texto: document.getElementById('notesTexto')?.value.trim() || '',
    proximaSessao: document.getElementById('notesProximaSessao')?.value || '',
    atualizadoEm: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'sessionNotes', roomId), data, { merge: true });
    showToast('Anotações salvas!', 'success');
  } catch (err) {
    console.error('Erro ao salvar notas:', err);
    showToast('Erro ao salvar anotações', 'error');
  }
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.className = 'toast', 3000);
}

// ===== UTILITÁRIOS =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== EVENT LISTENERS =====
if (btnAtendenteSend) {
  btnAtendenteSend.addEventListener('click', sendMessage);
}

if (atendenteInput) {
  atendenteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

if (btnCloseRoom) {
  btnCloseRoom.addEventListener('click', () => confirmCloseRoom(displayedRoomId));
}

// ===== TOGGLE SIDEBAR (DESKTOP) =====
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const atendenteSidebar = document.getElementById('atendenteSidebar');
const atendenteLayout = document.getElementById('atendenteLayout');

function syncSidebarToggleLabel() {
  const isHidden = atendenteLayout.classList.contains('sidebar-hidden');
  if (btnToggleSidebar) {
    btnToggleSidebar.textContent = isHidden ? '▶ Expandir' : '◀ Recolher';
    btnToggleSidebar.title = isHidden ? 'Mostrar painel' : 'Recolher painel';
  }
  const btnExpand = document.getElementById('btnExpandChat');
  if (btnExpand) {
    btnExpand.textContent = isHidden ? '⤡' : '⤢';
    btnExpand.title = isHidden ? 'Recolher chat' : 'Expandir chat';
    btnExpand.classList.toggle('expanded', isHidden);
  }
}

if (btnToggleSidebar && atendenteSidebar) {
  btnToggleSidebar.addEventListener('click', () => {
    atendenteLayout.classList.toggle('sidebar-hidden');
    syncSidebarToggleLabel();
  });
}

// ===== EXPANDIR CHAT — MODO TELA CHEIA =====
function setChatFullscreen(on) {
  const chat = document.getElementById('atendenteChat');
  const btn  = document.getElementById('btnExpandChat');
  if (!chat || !btn) return;
  chat.classList.toggle('chat-fullscreen', on);
  btn.textContent = on ? '⤡' : '⤢';
  btn.title = on ? 'Sair da tela cheia' : 'Expandir chat';
  btn.classList.toggle('expanded', on);
  // impede scroll do body enquanto fullscreen
  document.body.style.overflow = on ? 'hidden' : '';
}

document.getElementById('btnExpandChat')?.addEventListener('click', () => {
  const isNowFull = !document.getElementById('atendenteChat').classList.contains('chat-fullscreen');
  setChatFullscreen(isNowFull);
});

// ESC fecha o fullscreen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setChatFullscreen(false);
});

// ===== MOBILE: mostrar/esconder sidebar ao abrir conversa =====
export function showChatMobile() {
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) return;
  document.getElementById('atendenteSidebar')?.style.setProperty('display', 'none');
  document.getElementById('btnVoltarSidebar').style.display = 'flex';
  document.getElementById('btnToggleSidebar').style.display = 'none';
  document.getElementById('especialistaTitulo').style.display = 'none';
}

document.getElementById('btnVoltarSidebar')?.addEventListener('click', () => {
  document.getElementById('atendenteSidebar').style.display = '';
  document.getElementById('atendenteChat').style.display = 'none';
  document.getElementById('chatPlaceholder').style.display = 'flex';
  document.getElementById('btnVoltarSidebar').style.display = 'none';
  document.getElementById('btnToggleSidebar').style.display = '';
  document.getElementById('especialistaTitulo').style.display = '';
  setChatFullscreen(false);
  displayedRoomId = null;
});
