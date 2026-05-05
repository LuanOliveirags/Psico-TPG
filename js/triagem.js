// ===== TRIAGEM.JS - Questionário de Acolhimento Inicial =====
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let currentStep = 1;
const totalSteps = 5;

// ===== AUTH CHECK =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  currentUser = user;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (userDoc.exists()) {
    const data = userDoc.data();
    // Estagiários e admins não preenchem triagem — vão direto ao dashboard
    if (data.role === 'atendente' || data.role === 'admin') {
      window.location.href = 'dashboard.html';
      return;
    }
    // Adolescente já fez triagem — vai ao dashboard
    if (data.triagemCompleta) {
      window.location.href = 'dashboard.html';
      return;
    }
  }
});

// ===== NAVEGAÇÃO =====
const btnNext = document.getElementById('btnTriagemNext');
const btnBack = document.getElementById('btnTriagemBack');

btnNext.addEventListener('click', () => {
  if (!validateStep(currentStep)) return;
  if (currentStep < totalSteps) {
    goToStep(currentStep + 1);
  } else {
    submitTriagem();
  }
});

btnBack.addEventListener('click', () => {
  if (currentStep > 1) goToStep(currentStep - 1);
});

function goToStep(step) {
  document.getElementById(`step${currentStep}`).classList.remove('active');
  currentStep = step;
  document.getElementById(`step${currentStep}`).classList.add('active');

  const pct = ((currentStep - 1) / totalSteps) * 100;
  document.getElementById('triagemProgressBar').style.width = `${pct}%`;
  document.getElementById('triagemStepLabel').textContent = `Etapa ${currentStep} de ${totalSteps}`;

  btnBack.style.display = currentStep > 1 ? 'inline-flex' : 'none';
  btnNext.textContent = currentStep === totalSteps ? 'Concluir e Entrar' : 'Continuar →';
}

// ===== VALIDAÇÃO POR ETAPA =====
function validateStep(step) {
  if (step === 1) {
    const checked = document.querySelectorAll('input[name="motivo"]:checked');
    if (checked.length === 0) { showToast('Selecione ao menos um motivo', 'error'); return false; }
  }
  if (step === 2) {
    if (!document.querySelector('input[name="privacidade"]:checked')) {
      showToast('Responda sobre seu espaço de privacidade', 'error'); return false;
    }
    if (!document.querySelector('input[name="internet"]:checked')) {
      showToast('Responda sobre sua conexão com a internet', 'error'); return false;
    }
  }
  if (step === 3) {
    if (!document.querySelector('input[name="familia"]:checked')) {
      showToast('Responda sobre o conhecimento da sua família', 'error'); return false;
    }
  }
  if (step === 4) {
    if (!document.querySelector('input[name="emocaoSemana"]:checked')) {
      showToast('Responda como está se sentindo esta semana', 'error'); return false;
    }
    if (!document.querySelector('input[name="autolesao"]:checked')) {
      showToast('Responda a última pergunta desta etapa', 'error'); return false;
    }
  }
  if (step === 5) {
    const checked = document.querySelectorAll('input[name="expectativa"]:checked');
    if (checked.length === 0) { showToast('Selecione ao menos uma expectativa', 'error'); return false; }
  }
  return true;
}

// Mostrar alerta de crise quando "Sim" é selecionado na pergunta de autolesão
document.querySelectorAll('input[name="autolesao"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const val = document.querySelector('input[name="autolesao"]:checked')?.value;
    const alerta = document.getElementById('alertaCrise');
    if (alerta) alerta.style.display = (val === 'sim' || val === 'pensamentos') ? 'block' : 'none';
  });
});

// ===== COLETAR DADOS =====
function collectData() {
  const motivos = [...document.querySelectorAll('input[name="motivo"]:checked')].map(el => el.value);
  const expectativas = [...document.querySelectorAll('input[name="expectativa"]:checked')].map(el => el.value);

  return {
    motivos,
    privacidade: document.querySelector('input[name="privacidade"]:checked')?.value || '',
    internet: document.querySelector('input[name="internet"]:checked')?.value || '',
    familia: document.querySelector('input[name="familia"]:checked')?.value || '',
    confianca: document.querySelector('input[name="confianca"]:checked')?.value || '',
    emocaoSemana: document.querySelector('input[name="emocaoSemana"]:checked')?.value || '',
    autolesao: document.querySelector('input[name="autolesao"]:checked')?.value || '',
    expectativas,
    comentario: document.getElementById('comentarioLivre')?.value.trim() || '',
  };
}

// ===== SUBMETER =====
async function submitTriagem() {
  if (!validateStep(totalSteps)) return;

  btnNext.disabled = true;
  btnNext.textContent = 'Salvando...';

  const dados = collectData();
  const prioridade = calcularPrioridade(dados);

  try {
    await setDoc(doc(db, 'triagem', currentUser.uid), {
      userId: currentUser.uid,
      ...dados,
      prioridade,
      data: serverTimestamp()
    });

    // Marcar triagem como completa no perfil do usuário
    await setDoc(doc(db, 'users', currentUser.uid), {
      triagemCompleta: true,
      triagemPrioridade: prioridade
    }, { merge: true });

    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Erro ao salvar triagem:', err);
    showToast('Erro ao salvar. Tente novamente.', 'error');
    btnNext.disabled = false;
    btnNext.textContent = 'Concluir e Entrar';
  }
}

// ===== CÁLCULO DE PRIORIDADE PARA OS ESTAGIÁRIOS =====
function calcularPrioridade(dados) {
  if (dados.autolesao === 'sim' || dados.emocaoSemana === 'muito_mal') return 'alta';
  if (
    dados.autolesao === 'pensamentos' ||
    dados.emocaoSemana === 'mal' ||
    dados.motivos.includes('imagem') ||
    dados.motivos.includes('perseguicao')
  ) return 'media';
  return 'baixa';
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast show ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${msg}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}
