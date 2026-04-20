// ===== ATENDENTE.JS - Painel do Atendente =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, getDocs, addDoc, updateDoc, collection,
  query, where, orderBy, onSnapshot, serverTimestamp
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

// ===== TROCAR SALA EXIBIDA =====
function switchToRoom(roomId) {
  displayedRoomId = roomId;
  const entry = openRooms.get(roomId);
  if (!entry) return;

  const data = entry.data;
  const isGroup = data.type === 'group';
  chatPlaceholder.style.display = 'none';
  atendenteChat.style.display = 'flex';
  chatUserName.textContent = isGroup ? (data.groupName || 'Grupo') : (data.userName || 'Usuário');
  chatRoomStatus.textContent = isGroup ? 'Sala de Grupo' : 'Ativo';
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
