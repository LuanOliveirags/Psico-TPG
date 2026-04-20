# 🧠 Conexão Consciente

Plataforma web de apoio à saúde mental voltada para adolescentes e estagiários de psicologia. Oferece suporte emocional, conteúdo educativo sobre segurança digital e atendimento humanizado em tempo real.

---

## 📋 Funcionalidades

| Módulo | Descrição |
|---|---|
| **Login / Cadastro** | Autenticação por e-mail e senha via Firebase Auth |
| **Dashboard** | Estatísticas pessoais, dica do dia e navegação geral |
| **Apoio Emocional** | Registro de emoções com histórico salvo no Firestore |
| **Chat** | Assistente automático com opção de solicitar atendimento humano |
| **Quiz Digital** | Perguntas sobre segurança e cidadania digital com pontuação |
| **Conteúdo Educativo** | Artigos sobre cyberbullying, privacidade, autoestima e limites digitais |
| **Painel do Especialista** | Fila de atendimento em tempo real e chat com usuários |
| **Painel Admin** | Gestão de usuários, atribuição de roles e bloqueio de contas |

---

## 🚀 Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript (ES Modules)
- **Backend / BaaS:** [Firebase](https://firebase.google.com/) v10.12.0
  - Firebase Authentication (e-mail/senha)
  - Cloud Firestore (banco de dados em tempo real)
- **PWA:** `manifest.json` + Service Worker (`sw.js`)
- **Fonte:** [Poppins](https://fonts.google.com/specimen/Poppins) — Google Fonts

---

## 📁 Estrutura do Projeto

```
Psico-TPG/
├── index.html            # Página de login/cadastro
├── manifest.json         # Manifesto PWA
├── sw.js                 # Service Worker
├── firestore.rules       # Regras de segurança do Firestore
├── css/
│   └── style.css         # Estilos globais + tema claro/escuro
├── html/
│   ├── dashboard.html    # Dashboard principal
│   ├── apoio.html        # Registro emocional
│   ├── chat.html         # Chat com assistente/especialista
│   ├── quiz.html         # Quiz de cidadania digital
│   ├── conteudo.html     # Conteúdo educativo
│   ├── atendente.html    # Painel do especialista
│   └── admin.html        # Painel de administração
├── js/
│   ├── firebase-config.js  # Inicialização do Firebase
│   ├── auth.js             # Login e cadastro
│   ├── app.js              # Lógica do dashboard e navbar
│   ├── apoio.js            # Módulo de apoio emocional
│   ├── chat.js             # Módulo de chat
│   ├── quiz.js             # Módulo de quiz
│   ├── conteudo.js         # Módulo de conteúdo educativo
│   ├── atendente.js        # Módulo do painel do especialista
│   └── admin.js            # Módulo do painel admin
└── icons/                  # Ícones do PWA
```

---

## ⚙️ Configuração e Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/psico-tpg.git
cd psico-tpg
```

### 2. Configure o Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Crie um projeto (ou use o existente **psico-tpg**)
3. Ative **Authentication** com o provedor **E-mail/senha**
4. Crie o banco de dados **Firestore**
5. Copie as credenciais do SDK e substitua os valores em `js/firebase-config.js`:

```js
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.firebasestorage.app",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

### 3. Publique as regras do Firestore

```bash
firebase deploy --only firestore:rules
```

### 4. Execute localmente

Abra `index.html` em um servidor local (necessário por usar ES Modules):

```bash
# Com o VS Code, use a extensão Live Server
# Ou com Python:
python -m http.server 8080
```

Acesse `http://localhost:8080`.

---

## 👥 Perfis de Usuário

| Perfil | Acesso |
|---|---|
| **Adolescente** | Dashboard, Apoio, Chat, Quiz, Conteúdo |
| **Estagiário de Psicologia** | Mesmos do adolescente + Painel do Especialista (via role `atendente`) |
| **Admin** | Todos os módulos + Painel de Administração |

> O perfil de **Admin** é concedido por e-mail específico definido no código. O perfil de **Atendente** é atribuído pelo admin via painel.

---

## 🔒 Segurança

- Regras de acesso definidas em `firestore.rules`
- Senhas gerenciadas exclusivamente pelo Firebase Authentication
- Dados de usuários armazenados no Firestore com validação de campos
- Contas podem ser bloqueadas pelo admin; usuários bloqueados são deslogados automaticamente

---

## 📱 PWA

O projeto funciona como Progressive Web App:

- Instalável em dispositivos móveis e desktops
- Ícone e splash screen configurados via `manifest.json`
- Cache via Service Worker (`sw.js`)
- Suporte a tema de cor (`#6C63FF`) na barra de status

---

## 📄 Licença

Este projeto é de uso acadêmico/educacional. Consulte o autor para outros usos.
