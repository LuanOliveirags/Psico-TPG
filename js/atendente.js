// ===== ATENDENTE.JS - Painel do Atendente =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, addDoc, updateDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;
let activeRoomId = null;
let unsubQueue = null;
let unsubMessages = null;
let unsubRoom = null;

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  currentUser = user;
  await loadUserInfo(user);

  // Verificar se é atendente
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

  // Verificar se já tem sala ativa
  await checkActiveRoom(user.uid);
  listenToQueue();
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

// ===== VERIFICAR SALA ATIVA EXISTENTE =====
async function checkActiveRoom(uid) {
  try {
    const q = query(
      collection(db, 'chatRooms'),
      where('atendenteId', '==', uid),
      where('status', '==', 'active')
    );
    const snapshot = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(m => m.getDocs(q));
    if (!snapshot.empty) {
      const roomDoc = snapshot.docs[0];
      openChat(roomDoc.id, roomDoc.data());
    }
  } catch {
    // Sem sala ativa
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
      openChat(roomId, roomSnap.data());
    }
  } catch (err) {
    console.error('Erro ao aceitar sala:', err);
    showToast('Erro ao aceitar atendimento', 'error');
  }
}

// ===== ABRIR CHAT =====
function openChat(roomId, roomData) {
  activeRoomId = roomId;
  chatPlaceholder.style.display = 'none';
  atendenteChat.style.display = 'flex';
  chatUserName.textContent = escapeHtml(roomData.userName || 'Usuário');
  chatRoomStatus.textContent = 'Ativo';
  atendenteChatMessages.innerHTML = '';

  addSystemMessage(`Você está conversando com ${escapeHtml(roomData.userName || 'Usuário')}`);

  listenToRoomMessages(roomId);
  listenToRoomStatus(roomId);
}

// ===== OUVIR MENSAGENS EM TEMPO REAL =====
function listenToRoomMessages(roomId) {
  if (unsubMessages) unsubMessages();

  const q = query(
    collection(db, 'chatRooms', roomId, 'messages'),
    orderBy('data', 'asc')
  );

  unsubMessages = onSnapshot(q, (snapshot) => {
    atendenteChatMessages.innerHTML = '';
    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const type = msg.senderId === currentUser.uid ? 'user' : 'bot';
      addMessage(msg.mensagem, type);
    });
  });
}

// ===== OUVIR STATUS DA SALA =====
function listenToRoomStatus(roomId) {
  if (unsubRoom) unsubRoom();

  unsubRoom = onSnapshot(doc(db, 'chatRooms', roomId), (docSnap) => {
    if (!docSnap.exists() || docSnap.data().status === 'closed') {
      addSystemMessage('O usuário encerrou a conversa.');
      closeChat();
    }
  });
}

// ===== ADICIONAR MENSAGEM =====
function addMessage(text, type = 'bot') {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${type}`;

  const now = new Date();
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  msgDiv.innerHTML = `${escapeHtml(text)}<span class="time">${time}</span>`;
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

// ===== ENVIAR MENSAGEM =====
async function sendMessage() {
  const text = atendenteInput.value.trim();
  if (!text || !activeRoomId) return;
  atendenteInput.value = '';

  try {
    await addDoc(collection(db, 'chatRooms', activeRoomId, 'messages'), {
      senderId: currentUser.uid,
      senderName: currentUserData?.nome || 'Especialista',
      mensagem: text,
      data: serverTimestamp()
    });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
  }
}

// ===== ENCERRAR ATENDIMENTO =====
async function closeRoom() {
  if (!activeRoomId) return;

  try {
    // Enviar mensagem de encerramento
    await addDoc(collection(db, 'chatRooms', activeRoomId, 'messages'), {
      senderId: 'system',
      senderName: 'Sistema',
      mensagem: 'O especialista encerrou a conversa. Obrigado pelo contato! 💜',
      data: serverTimestamp()
    });

    await updateDoc(doc(db, 'chatRooms', activeRoomId), {
      status: 'closed',
      encerradoEm: serverTimestamp()
    });
  } catch (err) {
    console.error('Erro ao encerrar sala:', err);
  }

  closeChat();
}

function closeChat() {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  activeRoomId = null;
  atendenteChat.style.display = 'none';
  chatPlaceholder.style.display = 'flex';
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
  btnCloseRoom.addEventListener('click', closeRoom);
}
