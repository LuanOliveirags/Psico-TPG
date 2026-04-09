// ===== ADMIN.JS - Painel de Administração Completo =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, getDocs, updateDoc, deleteDoc, collection
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// E-mail do superadmin (não pode ser removido)
const SUPER_ADMIN_EMAIL = 'luanoliveirags@gmail.com';

let currentUser = null;
let allUsers = [];
let activeFilter = 'todos';

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  currentUser = user;

  const isAdmin = await checkIsAdmin(user);
  if (!isAdmin) {
    document.querySelector('main.container').innerHTML = `
      <div class="card" style="text-align:center; padding:48px; margin-top:40px;">
        <span style="font-size:3rem;">🚫</span>
        <h3 style="margin:16px 0 8px;">Acesso Restrito</h3>
        <p style="color:var(--text-light);">Apenas administradores podem acessar esta página.</p>
        <a href="dashboard.html" class="btn btn-primary" style="margin-top:20px;">Voltar ao Início</a>
      </div>
    `;
    return;
  }

  await loadUserInfo(user);
  await loadAllUsers();
  setupFilters();
});

async function checkIsAdmin(user) {
  if (user.email === SUPER_ADMIN_EMAIL) return true;
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    return userDoc.exists() && userDoc.data().role === 'admin';
  } catch {
    return false;
  }
}

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
      const data = userDoc.data();
      if (userAvatar) userAvatar.textContent = data.nome.charAt(0).toUpperCase();
    }
  } catch {
    if (userAvatar) userAvatar.textContent = 'A';
  }
}

// ===== CARREGAR TODOS OS USUÁRIOS =====
async function loadAllUsers() {
  const usersList = document.getElementById('usersList');

  try {
    const snapshot = await getDocs(collection(db, 'users'));
    allUsers = [];
    snapshot.forEach(docSnap => {
      allUsers.push({ id: docSnap.id, ...docSnap.data() });
    });

    allUsers.sort((a, b) => {
      const order = { admin: 0, atendente: 1 };
      const aOrder = a.bloqueado ? 3 : (order[a.role] ?? 2);
      const bOrder = b.bloqueado ? 3 : (order[b.role] ?? 2);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.nome || '').localeCompare(b.nome || '');
    });

    updateStats();
    renderUsers(getFilteredUsers());
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
    usersList.innerHTML = `
      <div class="card" style="text-align:center; padding:32px;">
        <p style="color:var(--danger);">Erro ao carregar usuários. Verifique as regras do Firestore.</p>
      </div>
    `;
  }
}

// ===== ATUALIZAR STATS =====
function updateStats() {
  const total = allUsers.length;
  const atendentes = allUsers.filter(u => u.role === 'atendente').length;
  const admins = allUsers.filter(u => u.role === 'admin' || u.email === SUPER_ADMIN_EMAIL).length;
  const bloqueados = allUsers.filter(u => u.bloqueado).length;

  document.getElementById('statTotalUsers').textContent = total;
  document.getElementById('statAtendentes').textContent = atendentes;
  document.getElementById('statAdmins').textContent = admins;
  document.getElementById('statBloqueados').textContent = bloqueados;
}

// ===== FILTROS =====
function setupFilters() {
  document.querySelectorAll('.admin-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderUsers(getFilteredUsers());
    });
  });
}

function getFilteredUsers() {
  const searchTerm = document.getElementById('searchUsers')?.value.toLowerCase().trim() || '';
  let filtered = allUsers;

  if (activeFilter === 'admin') {
    filtered = filtered.filter(u => u.role === 'admin' || u.email === SUPER_ADMIN_EMAIL);
  } else if (activeFilter === 'atendente') {
    filtered = filtered.filter(u => u.role === 'atendente');
  } else if (activeFilter === 'usuario') {
    filtered = filtered.filter(u => (!u.role || u.role === '') && !u.bloqueado && u.email !== SUPER_ADMIN_EMAIL);
  } else if (activeFilter === 'bloqueado') {
    filtered = filtered.filter(u => u.bloqueado);
  }

  if (searchTerm) {
    filtered = filtered.filter(u =>
      (u.nome || '').toLowerCase().includes(searchTerm) ||
      (u.email || '').toLowerCase().includes(searchTerm)
    );
  }

  return filtered;
}

// ===== RENDERIZAR LISTA =====
function renderUsers(users) {
  const usersList = document.getElementById('usersList');
  usersList.innerHTML = '';

  if (users.length === 0) {
    usersList.innerHTML = `
      <div class="card" style="text-align:center; padding:32px;">
        <p style="color:var(--text-light);">Nenhum usuário encontrado.</p>
      </div>
    `;
    return;
  }

  users.forEach(user => {
    const card = document.createElement('div');
    card.className = `admin-user-card card ${user.bloqueado ? 'blocked' : ''}`;
    card.dataset.userId = user.id;

    const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
    const isAdmin = user.role === 'admin' || isSuperAdmin;
    const isAtendente = user.role === 'atendente';
    const isBloqueado = user.bloqueado;

    const roleBadge = isBloqueado
      ? '<span class="role-badge bloqueado">Bloqueado</span>'
      : isSuperAdmin
        ? '<span class="role-badge admin">Super Admin</span>'
        : isAdmin
          ? '<span class="role-badge admin">Admin</span>'
          : isAtendente
            ? '<span class="role-badge atendente">Atendente</span>'
            : '<span class="role-badge usuario">Usuário</span>';

    const criadoEm = user.criadoEm?.toDate
      ? user.criadoEm.toDate().toLocaleDateString('pt-BR')
      : '—';

    const statusDot = isBloqueado
      ? '<span class="status-dot blocked" title="Bloqueado"></span>'
      : '<span class="status-dot online" title="Ativo"></span>';

    card.innerHTML = `
      <div class="admin-user-info">
        <div class="admin-user-avatar ${isBloqueado ? 'avatar-blocked' : ''}">${(user.nome || 'U').charAt(0).toUpperCase()}</div>
        <div class="admin-user-details">
          <div class="admin-user-name">
            ${statusDot}
            <span class="user-name-text">${escapeHtml(user.nome || 'Sem nome')}</span>
            ${roleBadge}
          </div>
          <div class="admin-user-email">${escapeHtml(user.email || '—')}</div>
          <div class="admin-user-meta">
            ${escapeHtml(user.perfil || '—')} · Idade: ${user.idade || '—'} · Desde: ${criadoEm}
          </div>
        </div>
      </div>
      <div class="admin-user-actions">
        <button class="btn-admin-action" data-user-id="${user.id}" title="Gerenciar">
          ⚙️ Gerenciar
        </button>
      </div>
    `;

    usersList.appendChild(card);
  });

  usersList.querySelectorAll('.btn-admin-action').forEach(btn => {
    btn.addEventListener('click', () => openUserModal(btn.dataset.userId));
  });
}

// ===== MODAL DE GERENCIAMENTO =====
function openUserModal(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  const modal = document.getElementById('userModal');
  const header = document.getElementById('modalHeader');
  const body = document.getElementById('modalBody');
  const actions = document.getElementById('modalActions');

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  const isAdmin = user.role === 'admin' || isSuperAdmin;
  const isAtendente = user.role === 'atendente';
  const isBloqueado = user.bloqueado;

  const criadoEm = user.criadoEm?.toDate
    ? user.criadoEm.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  header.innerHTML = `
    <div class="modal-user-avatar ${isBloqueado ? 'avatar-blocked' : ''}">${(user.nome || 'U').charAt(0).toUpperCase()}</div>
    <div>
      <h3>${escapeHtml(user.nome || 'Sem nome')}</h3>
      <p>${escapeHtml(user.email || '—')}</p>
    </div>
  `;

  body.innerHTML = `
    <div class="modal-info-grid">
      <div class="modal-info-item">
        <span class="modal-info-label">Nome</span>
        <div class="modal-info-value modal-editable">
          <span>${escapeHtml(user.nome || '—')}</span>
          <button class="btn-inline-edit" data-field="nome" data-user-id="${userId}">✏️</button>
        </div>
      </div>
      <div class="modal-info-item">
        <span class="modal-info-label">E-mail</span>
        <span class="modal-info-value">${escapeHtml(user.email || '—')}</span>
      </div>
      <div class="modal-info-item">
        <span class="modal-info-label">Perfil</span>
        <div class="modal-info-value modal-editable">
          <span>${escapeHtml(user.perfil || '—')}</span>
          <button class="btn-inline-edit" data-field="perfil" data-user-id="${userId}">✏️</button>
        </div>
      </div>
      <div class="modal-info-item">
        <span class="modal-info-label">Idade</span>
        <div class="modal-info-value modal-editable">
          <span>${user.idade || '—'}</span>
          <button class="btn-inline-edit" data-field="idade" data-user-id="${userId}">✏️</button>
        </div>
      </div>
      <div class="modal-info-item">
        <span class="modal-info-label">Cadastro</span>
        <span class="modal-info-value">${criadoEm}</span>
      </div>
      <div class="modal-info-item">
        <span class="modal-info-label">Status</span>
        <span class="modal-info-value">${isBloqueado ? '🚫 Bloqueado' : '✅ Ativo'}</span>
      </div>
    </div>

    <h4 class="modal-section-title">Permissão</h4>
    <div class="modal-role-selector">
      ${isSuperAdmin ? '<p style="color:var(--text-light); font-size:0.85rem;">Super Admin — não pode ser alterado.</p>' : `
        <button class="role-option ${!isAdmin && !isAtendente ? 'active' : ''}" data-role="" data-user-id="${userId}">
          👤 Usuário
        </button>
        <button class="role-option ${isAtendente ? 'active' : ''}" data-role="atendente" data-user-id="${userId}">
          🧑‍💼 Atendente
        </button>
        <button class="role-option ${isAdmin && !isSuperAdmin ? 'active' : ''}" data-role="admin" data-user-id="${userId}">
          🛡️ Admin
        </button>
      `}
    </div>
  `;

  // Ações
  const btns = [];

  btns.push(`<button class="btn btn-outline btn-modal-action" id="btnResetPwd" data-email="${escapeHtml(user.email || '')}">🔑 Enviar Reset de Senha</button>`);

  if (!isSuperAdmin) {
    if (isBloqueado) {
      btns.push(`<button class="btn btn-primary btn-modal-action" id="btnToggleBlock" data-user-id="${userId}" data-action="unblock">✅ Desbloquear</button>`);
    } else {
      btns.push(`<button class="btn btn-modal-action btn-danger-outline" id="btnToggleBlock" data-user-id="${userId}" data-action="block">🚫 Bloquear</button>`);
    }
    btns.push(`<button class="btn btn-modal-action btn-danger" id="btnDeleteUser" data-user-id="${userId}" data-user-name="${escapeHtml(user.nome || '')}">🗑️ Excluir</button>`);
  }

  actions.innerHTML = btns.join('');
  modal.classList.add('show');
  setupModalEvents(userId);
}

function setupModalEvents(userId) {
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('userModal').onclick = (e) => {
    if (e.target.id === 'userModal') closeModal();
  };

  document.querySelectorAll('.btn-inline-edit').forEach(btn => {
    btn.onclick = () => editField(btn.dataset.userId, btn.dataset.field);
  });

  document.querySelectorAll('.role-option').forEach(btn => {
    btn.onclick = () => changeRole(btn.dataset.userId, btn.dataset.role);
  });

  const btnReset = document.getElementById('btnResetPwd');
  if (btnReset) btnReset.onclick = () => resetPassword(btnReset.dataset.email);

  const btnBlock = document.getElementById('btnToggleBlock');
  if (btnBlock) btnBlock.onclick = () => toggleBlock(btnBlock.dataset.userId, btnBlock.dataset.action);

  const btnDel = document.getElementById('btnDeleteUser');
  if (btnDel) btnDel.onclick = () => deleteUser(btnDel.dataset.userId, btnDel.dataset.userName);
}

function closeModal() {
  document.getElementById('userModal').classList.remove('show');
}

// ===== EDITAR CAMPO =====
async function editField(userId, field) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  const labels = { nome: 'Nome', perfil: 'Perfil', idade: 'Idade' };
  const newValue = prompt(`Novo ${labels[field]}:`, user[field] || '');
  if (newValue === null || newValue.trim() === '' || newValue.trim() === String(user[field])) return;

  try {
    const updateData = {};
    updateData[field] = field === 'idade' ? parseInt(newValue.trim()) || 0 : newValue.trim();
    await updateDoc(doc(db, 'users', userId), updateData);
    user[field] = updateData[field];
    showToast(`${labels[field]} atualizado ✅`, 'success');
    renderUsers(getFilteredUsers());
    openUserModal(userId);
  } catch (err) {
    console.error('Erro ao editar campo:', err);
    showToast('Erro ao atualizar', 'error');
  }
}

// ===== ALTERAR ROLE =====
async function changeRole(userId, newRole) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  try {
    await updateDoc(doc(db, 'users', userId), { role: newRole });
    user.role = newRole;
    const roleNames = { admin: 'Admin', atendente: 'Atendente', '': 'Usuário' };
    showToast(`${user.nome} → ${roleNames[newRole] || 'Usuário'} ✅`, 'success');
    updateStats();
    renderUsers(getFilteredUsers());
    openUserModal(userId);
  } catch (err) {
    console.error('Erro ao alterar role:', err);
    showToast('Erro ao alterar permissão', 'error');
  }
}

// ===== RESET DE SENHA =====
async function resetPassword(email) {
  if (!email) return;
  if (!confirm(`Enviar e-mail de redefinição de senha para:\n${email}?`)) return;

  try {
    await sendPasswordResetEmail(auth, email);
    showToast(`Reset de senha enviado para ${email} ✅`, 'success');
  } catch (err) {
    console.error('Erro ao enviar reset:', err);
    showToast('Erro ao enviar reset de senha', 'error');
  }
}

// ===== BLOQUEAR/DESBLOQUEAR =====
async function toggleBlock(userId, action) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  const blocking = action === 'block';
  if (!confirm(blocking
    ? `Bloquear ${user.nome}?\nEle será desconectado e não poderá acessar a plataforma.`
    : `Desbloquear ${user.nome}?`
  )) return;

  try {
    await updateDoc(doc(db, 'users', userId), { bloqueado: blocking });
    user.bloqueado = blocking;
    showToast(blocking ? `${user.nome} bloqueado 🚫` : `${user.nome} desbloqueado ✅`, 'success');
    updateStats();
    renderUsers(getFilteredUsers());
    openUserModal(userId);
  } catch (err) {
    console.error('Erro:', err);
    showToast('Erro ao alterar status', 'error');
  }
}

// ===== EXCLUIR USUÁRIO =====
async function deleteUser(userId, userName) {
  const typed = prompt(`⚠️ IRREVERSÍVEL!\n\nDigite "${userName}" para confirmar a exclusão:`);
  if (typed !== userName) {
    if (typed !== null) showToast('Nome não coincide. Cancelado.', 'error');
    return;
  }

  try {
    await deleteDoc(doc(db, 'users', userId));
    allUsers = allUsers.filter(u => u.id !== userId);
    showToast(`${userName} excluído`, 'success');
    closeModal();
    updateStats();
    renderUsers(getFilteredUsers());
  } catch (err) {
    console.error('Erro ao excluir:', err);
    showToast('Erro ao excluir', 'error');
  }
}

// ===== BUSCA =====
const searchInput = document.getElementById('searchUsers');
if (searchInput) {
  searchInput.addEventListener('input', () => renderUsers(getFilteredUsers()));
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast show ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${msg}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== UTILITÁRIOS =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
