// ===== AUTH.JS - Login e Cadastro =====
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Elementos
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegister = document.getElementById('showRegister');
const showLogin = document.getElementById('showLogin');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

// Se já estiver logado, redireciona
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'html/dashboard.html';
  }
});

// Alternar formulários
showRegister.addEventListener('click', () => {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
});

showLogin.addEventListener('click', () => {
  registerForm.style.display = 'none';
  loginForm.style.display = 'block';
});

// Mostrar erro
function showError(element, msg) {
  element.textContent = msg;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 5000);
}

// LOGIN
btnLogin.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showError(loginError, 'Preencha todos os campos.');
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Entrando...';

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = 'html/dashboard.html';
  } catch (error) {
    const msgs = {
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento.'
    };
    showError(loginError, msgs[error.code] || 'Erro ao fazer login. Tente novamente.');
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = 'Entrar';
  }
});

// CADASTRO
btnRegister.addEventListener('click', async () => {
  const name = document.getElementById('regName').value.trim();
  const age = document.getElementById('regAge').value;
  const role = document.getElementById('regRole').value;
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!name || !age || !email || !password) {
    showError(registerError, 'Preencha todos os campos.');
    return;
  }

  if (password.length < 6) {
    showError(registerError, 'A senha deve ter pelo menos 6 caracteres.');
    return;
  }

  btnRegister.disabled = true;
  btnRegister.textContent = 'Criando conta...';

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Salvar dados no Firestore
    await setDoc(doc(db, 'users', user.uid), {
      nome: name,
      idade: parseInt(age),
      perfil: role,
      email: email,
      criadoEm: serverTimestamp()
    });

    window.location.href = 'html/dashboard.html';
  } catch (error) {
    console.error('Erro no cadastro:', error.code, error.message);
    const msgs = {
      'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/weak-password': 'Senha muito fraca.',
      'auth/operation-not-allowed': 'Autenticação por e-mail não está ativada no Firebase. Ative em Authentication > Sign-in method.',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.'
    };
    showError(registerError, msgs[error.code] || `Erro: ${error.code || error.message}`);
  } finally {
    btnRegister.disabled = false;
    btnRegister.textContent = 'Criar Conta';
  }
});

// Enter para enviar
document.getElementById('loginPassword').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btnLogin.click();
});

document.getElementById('regPassword').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btnRegister.click();
});
