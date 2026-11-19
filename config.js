// ===== CONFIGURAÇÃO DO WEBAPP — preencha seguindo o GUIA =====
self.CONFIG = {
  // URL do App da Web do Apps Script (termina em /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycbzOrHXSVwH-Kt6L9wU1_loInYHsr8jVNGVcRa8PK5aQLKTm3vPoWopLDe6iygqWZoNA/exec',

  // Firebase (só para notificações). Deixe apiKey vazio para usar sem push.
  FIREBASE: {
    apiKey: 'AIzaSyCfao4BgNX-Gd8mHfxk1jwrZqsxiyf5pEI',
    authDomain: 'materiais-samsung-8b334.firebaseapp.com',
    projectId: 'materiais-samsung-8b334',
    messagingSenderId: '902449703932',
    appId: '1:902449703932:web:a46066eb14f71dc3a1e079',
  },
  // Cloud Messaging > Certificados push da Web > par de chaves
  VAPID_KEY: 'BJd31v4lN4i9nzFEn_tUJeCCsDeEbvkp0DeAa0Wks9ADaTrFKOoUh9adeK8_7f70s9ric1vbfiPh6D9mY-2_D3Y',

  // Chave da Google Drive API (Google Cloud > Credenciais). Permite baixar DENTRO do app
  // e confirmar que o arquivo chegou inteiro. Vazio = baixa pelo Drive sem confirmação.
  DRIVE_API_KEY: '',

  NOME_APP: 'Materiais Samsung',
};
