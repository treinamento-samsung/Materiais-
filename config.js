// ===== CONFIGURAÇÃO DO WEBAPP — preencha seguindo o GUIA =====
self.CONFIG = {
  // URL do App da Web do Apps Script (termina em /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycbzOrHXSVwH-Kt6L9wU1_loInYHsr8jVNGVcRa8PK5aQLKTm3vPoWopLDe6iygqWZoNA/exec',

  // Firebase (só para notificações). Deixe apiKey vazio para usar sem push.
  FIREBASE: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    messagingSenderId: '',
    appId: '',
  },
  // Cloud Messaging > Certificados push da Web > par de chaves
  VAPID_KEY: '',

  NOME_APP: 'Materiais Samsung',
};
