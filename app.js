/* Materiais Samsung — webapp (instrutores + admin). Sem build: HTML/JS puro. */
(function () {
  'use strict';
  const C = self.CONFIG;
  const $app = document.getElementById('app');
  const K = { token: 'm_token', user: 'm_user', dados: 'm_dados', fila: 'm_fila', push: 'm_push' };

  // ---------- utilidades ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ler = (k, padrao = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } };
  const gravar = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* armazenamento indisponível */ } };
  const fam = (f) => String(f || '').replace(/_/g, ' ');
  const tam = (b) => b >= 1 << 30 ? (b / (1 << 30)).toFixed(1) + ' GB' : b >= 1 << 20 ? Math.round(b / (1 << 20)) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const data = (iso) => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  let toastTimer;
  function toast(msg, ms = 3500) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------- API ----------
  async function api(acao, dados = {}) {
    if (!C.API_URL || C.API_URL.indexOf('http') !== 0) throw new Error('Configure API_URL em config.js.');
    const r = await fetch(C.API_URL, {
      method: 'POST',
      // text/plain evita a checagem CORS extra que o Apps Script não responde
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao, dados, token: ler(K.token) }),
    });
    const j = await r.json();
    if (!j.ok) {
      if (j.erro === 'SESSAO_INVALIDA') { sair(true); throw new Error('Sua sessão expirou. Entre de novo.'); }
      throw new Error(j.erro);
    }
    return j.dados;
  }

  // ---------- fila offline de registros de download ----------
  async function esvaziarFila() {
    const fila = ler(K.fila, []);
    if (!fila.length || !navigator.onLine) return;
    const resto = [];
    for (const item of fila) {
      try { await api('registrarDownload', item); } catch { resto.push(item); }
    }
    gravar(K.fila, resto);
  }
  window.addEventListener('online', () => { atualizarFaixa(); esvaziarFila(); });
  window.addEventListener('offline', atualizarFaixa);
  function atualizarFaixa() { document.getElementById('faixa-offline').hidden = navigator.onLine; }

  // ---------- sessão ----------
  function sair(silencioso) {
    const tok = ler(K.push);
    if (tok && ler(K.token)) api('removerToken', { token: tok }).catch(() => {});
    [K.token, K.user, K.dados, K.push].forEach((k) => gravar(k, null));
    if (!silencioso) toast('Você saiu.');
    navegar('#/');
  }

  // Muda de tela sem renderizar duas vezes (o hashchange já chama render).
  function navegar(h) {
    if ((location.hash || '#/') === h) render(); else location.hash = h;
  }

  function cabecalho(user) {
    const h = document.getElementById('topo');
    h.hidden = !user;
    if (!user) return;
    document.getElementById('quem').textContent = user.nome + (user.bu ? ' · ' + user.bu : ' · Admin');
    document.getElementById('lnk-admin').hidden = !user.admin;
  }

  // ---------- telas ----------
  function telaLogin() {
    cabecalho(null);
    $app.innerHTML = `
      <div class="tela-login"><form class="login" id="f">
        <div class="marca-login">Materiais</div>
        <h1>Entrar</h1>
        <p class="sub" style="text-align:center">Use o e-mail e a senha que você recebeu.</p>
        <div class="campo"><label for="email">E-mail</label><input id="email" type="email" autocomplete="username" required></div>
        <div class="campo"><label for="senha">Senha</label><input id="senha" type="password" autocomplete="current-password" required></div>
        <div class="erro" id="erro" hidden></div>
        <button class="cheio" id="btn">Entrar</button>
        <p class="sub" style="text-align:center;margin-top:16px">Esqueceu a senha? Peça ao administrador.</p>
      </form></div>`;
    document.getElementById('f').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn'), erro = document.getElementById('erro');
      btn.disabled = true; btn.textContent = 'Entrando…'; erro.hidden = true;
      try {
        const r = await api('login', { email: document.getElementById('email').value, senha: document.getElementById('senha').value });
        gravar(K.token, r.token); gravar(K.user, r.usuario);
        navegar(r.usuario.admin ? '#/admin' : '#/');
      } catch (err) {
        erro.textContent = navigator.onLine ? err.message : 'Sem internet. O login precisa de conexão.';
        erro.hidden = false; btn.disabled = false; btn.textContent = 'Entrar';
      }
    };
  }

  async function carregarDados(forcar) {
    const cache = ler(K.dados);
    if (cache && !forcar && !navigator.onLine) return cache;
    try {
      const d = await api('listar');
      gravar(K.dados, d); gravar(K.user, d.usuario);
      return d;
    } catch (e) {
      if (cache) { toast('Não foi possível atualizar. Mostrando a última lista salva.'); return cache; }
      throw e;
    }
  }

  function progresso(r) {
    const feitos = r.arquivos.filter((a) => a.baixadoEm).length;
    return { feitos, total: r.arquivos.length, pct: r.arquivos.length ? Math.round((feitos / r.arquivos.length) * 100) : 0 };
  }

  // Cada família ganha um degradê azul próprio (ou a imagem "capa" da pasta, se houver).
  const PALETA = [
    ['#0A1A6B', '#2F6BFF'], ['#061A3A', '#22C3FF'], ['#1B0F5E', '#4C7DFF'],
    ['#03263F', '#1FA2E0'], ['#0C1450', '#5B5BFF'], ['#04203A', '#2BD4E8'],
  ];
  function corFamilia(f) {
    let h = 0;
    for (const ch of String(f)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETA[h % PALETA.length];
  }
  function fundo(r) {
    const [a, b] = corFamilia(r.familia);
    const grad = `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
    return r.capa ? `background-image:url('${esc(r.capa)}'), ${grad}` : `background-image:${grad}`;
  }
  const sigla = (f) => fam(f).split(/\s+/).map((p) => p[0]).join('').slice(0, 3).toUpperCase();

  function tile(r) {
    const p = progresso(r);
    const canto = r.concluida ? '<span class="tag ok">✓ Feito</span>'
      : r.obrigatorio ? '<span class="tag pend">Obrigatório</span>' : '';
    return `<a class="tile" href="#/r/${encodeURIComponent(r.id)}" style="${fundo(r)}" aria-label="${esc(fam(r.familia))} ${esc(r.week)}">
      ${r.capa ? '' : `<span class="marca-d-agua">${esc(sigla(r.familia))}</span>`}
      <span class="canto">${canto}</span>
      <span class="nome">${esc(fam(r.familia))}<small>${esc(r.week)} · v${esc(r.versao)} · ${p.feitos}/${p.total}</small></span>
      <span class="progresso"><i style="width:${p.pct}%"></i></span>
    </a>`;
  }

  function fileira(titulo, lista, extra) {
    if (!lista.length) return '';
    return `<section class="fileira"><h3>${esc(titulo)}${extra ? ` <small>${esc(extra)}</small>` : ''}</h3>
      <div class="trilho">${lista.map(tile).join('')}</div></section>`;
  }

  async function telaInicio() {
    const d = await carregarDados();
    cabecalho(d.usuario);
    const rels = d.releases.filter((r) => r.arquivos.length);
    const pend = rels.filter((r) => r.obrigatorio && !r.concluida);
    const recentes = [...rels].sort((a, b) => String(b.publicadoEm || '').localeCompare(String(a.publicadoEm || ''))).slice(0, 10);
    const feitos = rels.filter((r) => r.concluida);
    const destaque = pend[0] || recentes[0];

    let html = '';
    if (destaque) {
      const p = progresso(destaque);
      html += `<section class="hero" style="${fundo(destaque)}">
        <div class="conteudo">
          <span class="selo">${pend[0] ? 'Obrigatório · pendente' : 'Novo material'}</span>
          <h1>${esc(fam(destaque.familia))}</h1>
          <div class="meta">${esc(destaque.week)} · v${esc(destaque.versao)} · ${p.total} arquivo(s) · ${p.feitos} baixado(s)</div>
          <div class="barra"><i style="width:${p.pct}%"></i></div>
          <div class="botoes">
            <a class="botao branco" href="#/r/${encodeURIComponent(destaque.id)}">▶ Ver material</a>
            ${pend.length > 1 ? `<span class="botao sec">${pend.length} pendentes</span>` : ''}
          </div>
        </div>
      </section>`;
    } else {
      html += `<div class="pagina"><h1>Olá, ${esc(d.usuario.nome.split(' ')[0])}</h1><div class="vazio">Nenhum material publicado ainda.</div></div>`;
    }
    html += avisoPush() + avisoInstalar();
    html += `<div class="saudacao" style="padding:0 4vw;margin:4px 0 14px;position:relative;z-index:2"><h1 style="font-size:20px;margin:0">Olá, ${esc(d.usuario.nome.split(' ')[0])}</h1>
      <div class="sub" style="margin:2px 0 0">${pend.length ? `Você tem ${pend.length} material(is) obrigatório(s) para baixar.` : 'Tudo em dia com os obrigatórios. 👏'}</div></div>`;
    html += fileira('Obrigatórios pendentes', pend);
    html += fileira('Lançados recentemente', recentes);
    const familias = {};
    rels.forEach((r) => { (familias[r.familia] ||= []).push(r); });
    Object.keys(familias).sort().forEach((f) => { html += fileira(fam(f), familias[f], familias[f].length + ' versão(ões)'); });
    html += fileira('Concluídos', feitos);
    html += '<div class="rodape"><button class="sec pequeno" id="recarregar">Atualizar lista</button></div>';
    $app.innerHTML = html;
    document.getElementById('recarregar').onclick = async () => { await carregarDados(true); render(); };
    ligarAvisos();
  }

  async function telaRelease(id) {
    const d = await carregarDados();
    cabecalho(d.usuario);
    const r = d.releases.find((x) => x.id === id);
    if (!r) { $app.innerHTML = '<div class="pagina vazio">Material não encontrado. <a href="#/">Voltar</a></div>'; return; }
    const p = progresso(r);
    const [, cor] = corFamilia(r.familia);
    $app.innerHTML = `
      <section class="hero curto" style="${fundo(r)}">
        <div class="conteudo">
          <a href="#/" style="color:#D4DAE8;text-decoration:none;font-size:14px">← Voltar</a>
          <h1>${esc(fam(r.familia))}</h1>
          <div class="meta">${esc(r.week)} · v${esc(r.versao)} · ${r.obrigatorio ? 'Obrigatório' : 'Opcional'} · ${p.feitos}/${p.total} baixados</div>
          <div class="barra"><i style="width:${p.pct}%"></i></div>
        </div>
      </section>
      <div class="pagina" style="padding-top:0">
        <h2>Arquivos</h2>
        ${r.arquivos.length ? '' : '<div class="vazio">Sem arquivos nesta versão.</div>'}
        ${r.arquivos.map((a, i) => {
          const ico = a.tipo === 'video' ? '▶' : a.tipo === 'pdf' ? 'PDF' : '⬇';
          const grande = a.tamanho > 100 * 1024 * 1024;
          return `<div class="episodio">
            <div class="num">${i + 1}</div>
            <div class="mini" style="background:linear-gradient(135deg, #0A1A6B, ${cor});font-size:${a.tipo === 'pdf' ? 15 : 26}px;font-weight:900">${ico}${a.baixadoEm ? '<span class="ok">✓</span>' : ''}</div>
            <div>
              <div class="nome">${esc(a.nome)}</div>
              <div class="meta">${tam(a.tamanho)} · ${a.baixadoEm ? 'Baixado em ' + data(a.baixadoEm) : 'Pendente'}${grande ? ' · prefira Wi-Fi' : ''}</div>
              <div class="botoes">
                <a class="botao branco pequeno" target="_blank" rel="noopener" data-arq="${esc(a.id)}" href="${esc(a.abrir)}">${a.tipo === 'video' ? '▶ Assistir' : 'Abrir'}</a>
                <a class="botao sec pequeno" target="_blank" rel="noopener" data-arq="${esc(a.id)}" href="${esc(a.baixar)}">⬇ Baixar</a>
              </div>
            </div>
          </div>`;
        }).join('')}
        <p class="sub" style="margin-top:18px">Arquivos grandes: o Google Drive pode avisar que "não foi possível verificar vírus". Toque em <b>Fazer o download assim mesmo</b>.</p>
      </div>`;

    // O link abre direto (sem bloqueio de pop-up); o registro vai em paralelo.
    $app.querySelectorAll('a[data-arq]').forEach((el) => {
      el.addEventListener('click', () => registrar(r.id, el.dataset.arq));
    });
  }

  function registrar(releaseId, arquivoId) {
    // atualiza a tela na hora
    const d = ler(K.dados);
    const r = d && d.releases.find((x) => x.id === releaseId);
    const a = r && r.arquivos.find((x) => x.id === arquivoId);
    if (a && !a.baixadoEm) {
      a.baixadoEm = new Date().toISOString();
      r.concluida = r.arquivos.length > 0 && r.arquivos.every((x) => x.baixadoEm);
      gravar(K.dados, d);
      setTimeout(render, 400);
    }
    const item = { releaseId, arquivoId };
    if (!navigator.onLine) { gravar(K.fila, [...ler(K.fila, []), item]); return; }
    api('registrarDownload', item).catch(() => gravar(K.fila, [...ler(K.fila, []), item]));
  }

  function telaConta() {
    const u = ler(K.user);
    cabecalho(u);
    $app.innerHTML = `<div class="pagina">
      <h1>Minha conta</h1>
      <p class="sub">${esc(u.nome)} · ${esc(u.email)}${u.bu ? ' · BU ' + esc(u.bu) : ''}</p>
      ${avisoPush(true)}
      <h2>Trocar senha</h2>
      <form id="f" class="card">
        <div class="campo"><label>Senha atual</label><input type="password" id="atual" required autocomplete="current-password"></div>
        <div class="campo"><label>Nova senha (mín. 8)</label><input type="password" id="nova" minlength="8" required autocomplete="new-password"></div>
        <button>Salvar nova senha</button>
      </form>
      <h2>Sessão</h2>
      <button class="sec cheio" id="sair">Sair deste aparelho</button></div>`;
    document.getElementById('f').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('trocarSenha', { atual: document.getElementById('atual').value, nova: document.getElementById('nova').value });
        toast('Senha alterada.'); e.target.reset();
      } catch (err) { toast(err.message); }
    };
    document.getElementById('sair').onclick = () => sair();
    ligarAvisos();
  }

  // ---------- notificações ----------
  const pushConfigurado = () => !!(C.FIREBASE && C.FIREBASE.apiKey && C.VAPID_KEY);
  const pushSuportado = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  function avisoPush(sempre) {
    if (!pushConfigurado() || !pushSuportado()) return sempre ? '<p class="sub">Notificações indisponíveis neste aparelho/navegador.</p>' : '';
    if (Notification.permission === 'granted' && ler(K.push)) return sempre ? '<div class="aviso">Notificações ativadas neste aparelho.</div>' : '';
    if (Notification.permission === 'denied') return sempre ? '<div class="aviso">Notificações bloqueadas. Libere nas configurações do navegador para este site.</div>' : '';
    return '<div class="aviso"><span>Ative as notificações para saber quando sair material novo.</span><button class="pequeno" data-acao="push">Ativar</button></div>';
  }

  let eventoInstalar = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; if (location.hash === '' || location.hash === '#/') render(); });
  function avisoInstalar() {
    return eventoInstalar ? '<div class="aviso"><span>Instale o app na tela inicial para abrir com um toque.</span><button class="pequeno" data-acao="instalar">Instalar</button></div>' : '';
  }

  function ligarAvisos() {
    $app.querySelectorAll('[data-acao="push"]').forEach((b) => { b.onclick = () => ativarPush().then(render); });
    $app.querySelectorAll('[data-acao="instalar"]').forEach((b) => {
      b.onclick = async () => { eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; render(); };
    });
  }

  let firebasePronto = null;
  function carregarScript(src) {
    return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
  }
  function iniciarFirebase() {
    if (!firebasePronto) {
      firebasePronto = carregarScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
        .then(() => carregarScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js'))
        .then(() => {
          firebase.initializeApp(C.FIREBASE);
          const m = firebase.messaging();
          m.onMessage((p) => { const n = p.notification || {}; toast((n.title || '') + '\n' + (n.body || ''), 7000); });
          return m;
        });
    }
    return firebasePronto;
  }

  async function ativarPush() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast('Notificações não autorizadas.'); return; }
      const m = await iniciarFirebase();
      const reg = await navigator.serviceWorker.ready;
      const token = await m.getToken({ vapidKey: C.VAPID_KEY, serviceWorkerRegistration: reg });
      await api('registrarToken', { token });
      gravar(K.push, token);
      toast('Notificações ativadas.');
    } catch (e) {
      toast('Não foi possível ativar: ' + e.message);
    }
  }

  // Se já autorizou antes, renova o token em silêncio (ele muda de tempos em tempos).
  async function renovarPush() {
    if (!pushConfigurado() || !pushSuportado() || Notification.permission !== 'granted' || !ler(K.token)) return;
    try {
      const m = await iniciarFirebase();
      const reg = await navigator.serviceWorker.ready;
      const token = await m.getToken({ vapidKey: C.VAPID_KEY, serviceWorkerRegistration: reg });
      if (token && token !== ler(K.push)) { await api('registrarToken', { token }); gravar(K.push, token); }
      else if (token) gravar(K.push, token);
    } catch { /* tenta de novo na próxima abertura */ }
  }

  // ---------- ADMIN ----------
  const ABAS_ADM = [['pendencias', 'Quem falta'], ['releases', 'Releases'], ['usuarios', 'Usuários'], ['push', 'Notificar'], ['relatorio', 'Relatório']];

  async function telaAdmin(aba) {
    const u = ler(K.user);
    cabecalho(u);
    if (!u || !u.admin) return navegar('#/');
    aba = aba || 'pendencias';
    $app.innerHTML = `<div class="pagina"><div class="abas">${ABAS_ADM.map(([k, n]) => `<a href="#/admin/${k}" class="${k === aba ? 'ativa' : ''}">${n}</a>`).join('')}</div><div id="adm"><div class="carregando">Carregando…</div></div></div>`;
    const alvo = document.getElementById('adm');
    const fn = { pendencias: admPendencias, releases: admReleases, usuarios: admUsuarios, push: admPush, relatorio: admRelatorio }[aba];
    try { await fn(alvo); } catch (e) { alvo.innerHTML = `<div class="erro">${esc(e.message)}</div>`; }
  }

  function baixarCsv(nome, linhas) {
    const csv = '﻿' + linhas.map((l) => l.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function admPendencias(el) {
    const lista = await api('adm_pendencias');
    const com = lista.filter((l) => l.pendentes > 0);
    el.innerHTML = `
      <div class="numeros">
        <div><b>${lista.length - com.length}</b><span>em dia</span></div>
        <div><b>${com.length}</b><span>com pendência</span></div>
      </div>
      <div class="linha-acoes" style="margin-bottom:12px"><button class="sec pequeno" id="csv">Baixar planilha (CSV)</button></div>
      ${lista.length ? '' : '<div class="vazio">Nenhum instrutor cadastrado.</div>'}
      ${lista.map((l) => `<div class="card">
        <div class="linha1"><span class="titulo">${esc(l.nome)}</span>${l.pendentes ? `<span class="tag pend">Falta ${l.pendentes}</span>` : '<span class="tag ok">Em dia</span>'}</div>
        <div class="meta">${esc(l.bu)} · ${esc(l.email)}${l.quais.length ? '<br>' + l.quais.map(esc).join('<br>') : ''}</div>
      </div>`).join('')}`;
    document.getElementById('csv').onclick = () => baixarCsv('pendencias.csv',
      [['Nome', 'E-mail', 'BU', 'Obrigatórias', 'Pendentes', 'Quais']].concat(lista.map((l) => [l.nome, l.email, l.bu, l.obrigatorias, l.pendentes, l.quais.join(' | ')])));
  }

  async function admReleases(el) {
    const rels = await api('adm_releases');
    el.innerHTML = `
      <div class="linha-acoes" style="margin-bottom:12px">
        <button id="sync">Sincronizar com o Drive</button>
        <span class="sub" style="margin:0">Roda sozinho a cada hora.</span>
      </div>
      ${rels.length ? '' : '<div class="vazio">Nenhuma release ainda. Organize o Drive e clique em Sincronizar.</div>'}
      ${rels.map((r) => `<div class="card" data-id="${esc(r.id)}">
        <div class="linha1"><span class="titulo">${esc(r.titulo)}</span>
          ${r.status === 'publicada' ? '<span class="tag ok">Publicada</span>' : '<span class="tag neutra">Rascunho</span>'}</div>
        <div class="meta">${r.arquivos} arquivo(s)${r.publicadoEm ? ' · publicada em ' + data(r.publicadoEm) : ''}</div>
        <div class="linha-acoes">
          <div class="chips">${['CE', 'MX'].map((b) => `<button class="chip ${r.bus.includes(b) ? 'on' : ''}" data-bu="${b}">${b}</button>`).join('')}</div>
          <label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-obr ${r.obrigatorio ? 'checked' : ''} style="width:auto"> Obrigatório</label>
          ${r.status === 'publicada' ? '<button class="sec pequeno" data-st="rascunho">Despublicar</button>' : '<button class="pequeno" data-st="publicada">Publicar</button>'}
        </div>
      </div>`).join('')}`;

    document.getElementById('sync').onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = 'Sincronizando…';
      try {
        const s = await api('adm_sincronizar');
        toast(`Releases novas: ${s.releasesNovas}\nArquivos novos: ${s.arquivosNovos}` + (s.ignorados.length ? `\nIgnorados:\n• ${s.ignorados.join('\n• ')}` : ''), 9000);
      } catch (err) { toast(err.message); }
      telaAdmin('releases');
    };
    el.querySelectorAll('.card[data-id]').forEach((card) => {
      const id = card.dataset.id;
      const r = rels.find((x) => x.id === id);
      const salvar = async (patch, msg) => {
        try { await api('adm_atualizarRelease', { id, ...patch }); if (msg) toast(msg); } catch (err) { toast(err.message); }
        telaAdmin('releases');
      };
      card.querySelectorAll('[data-bu]').forEach((b) => {
        b.onclick = () => {
          const bus = new Set(r.bus);
          bus.has(b.dataset.bu) ? bus.delete(b.dataset.bu) : bus.add(b.dataset.bu);
          salvar({ bus: [...bus] });
        };
      });
      card.querySelector('[data-obr]').onchange = (e) => salvar({ obrigatorio: e.target.checked });
      card.querySelector('[data-st]').onclick = (e) => salvar({ status: e.target.dataset.st },
        e.target.dataset.st === 'publicada' ? 'Publicada! Lembre de notificar a BU.' : 'Release despublicada.');
    });
  }

  async function admUsuarios(el) {
    const us = await api('adm_usuarios');
    const ce = us.filter((u) => u.bu === 'CE').length, mx = us.filter((u) => u.bu === 'MX').length;
    el.innerHTML = `
      <div class="numeros"><div><b>${ce}</b><span>CE</span></div><div><b>${mx}</b><span>MX</span></div><div><b>${us.filter((u) => !u.ativo).length}</b><span>inativos</span></div></div>
      <button class="cheio" id="novo">+ Novo usuário</button>
      <div id="form"></div>
      <h2>Cadastrados</h2>
      ${us.map((u) => `<a class="card" href="javascript:void 0" data-id="${esc(u.id)}">
        <div class="linha1"><span class="titulo">${esc(u.nome)}</span>
          ${u.admin ? '<span class="tag neutra">Admin</span>' : `<span class="tag neutra">${esc(u.bu)}</span>`}</div>
        <div class="meta">${esc(u.email)}${u.ativo ? '' : ' · <b>INATIVO</b>'}</div></a>`).join('')}`;
    const abrir = (u) => {
      const novo = !u;
      u = u || { nome: '', email: '', bu: 'CE', ativo: true, admin: false };
      const f = document.getElementById('form');
      f.innerHTML = `<form class="card" id="fu" style="margin-top:12px">
        <h2 style="margin-top:0">${novo ? 'Novo usuário' : 'Editar ' + esc(u.nome)}</h2>
        <div class="campo"><label>Nome</label><input id="u-nome" value="${esc(u.nome)}" required></div>
        <div class="campo"><label>E-mail</label><input id="u-email" type="email" value="${esc(u.email)}" ${novo ? 'required' : 'disabled'}></div>
        ${u.admin ? '' : `<div class="campo"><label>BU</label><select id="u-bu"><option ${u.bu === 'CE' ? 'selected' : ''}>CE</option><option ${u.bu === 'MX' ? 'selected' : ''}>MX</option></select></div>`}
        <div class="campo"><label>${novo ? 'Senha inicial (mín. 8)' : 'Nova senha (deixe vazio para manter)'}</label><input id="u-senha" ${novo ? 'required' : ''} minlength="8"></div>
        ${novo ? '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="u-admin" style="width:auto"> É administrador</label>'
               : `<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="u-ativo" style="width:auto" ${u.ativo ? 'checked' : ''}> Ativo</label>`}
        <div class="linha-acoes"><button>Salvar</button><button type="button" class="sec" id="cancelar">Cancelar</button></div>
      </form>`;
      f.scrollIntoView({ behavior: 'smooth' });
      document.getElementById('cancelar').onclick = () => { f.innerHTML = ''; };
      document.getElementById('fu').onsubmit = async (e) => {
        e.preventDefault();
        const val = (id) => { const x = document.getElementById(id); return x ? x.value : undefined; };
        const dados = { nome: val('u-nome') };
        if (val('u-bu') !== undefined) dados.bu = val('u-bu');
        if (val('u-senha')) dados.senha = val('u-senha');
        if (novo) { dados.email = val('u-email'); dados.admin = document.getElementById('u-admin').checked; if (dados.admin) delete dados.bu; } else { dados.id = u.id; dados.ativo = document.getElementById('u-ativo').checked; }
        try {
          await api('adm_salvarUsuario', dados);
          toast(novo ? 'Usuário criado. Envie e-mail e senha ao instrutor por mensagem privada.' : 'Usuário atualizado.', 5000);
          telaAdmin('usuarios');
        } catch (err) { toast(err.message); }
      };
    };
    document.getElementById('novo').onclick = () => abrir(null);
    el.querySelectorAll('.card[data-id]').forEach((c) => { c.onclick = () => abrir(us.find((x) => x.id === c.dataset.id)); });
  }

  async function admPush(el) {
    const hist = await api('adm_historicoPush');
    let alvo = 'TODOS';
    el.innerHTML = `
      ${pushConfigurado() ? '' : '<div class="aviso">Notificações ainda não configuradas (veja o guia, etapa Firebase).</div>'}
      <form class="card" id="fp">
        <div class="campo"><label>Para quem</label>
          <div class="seg">${[['TODOS', 'Todos'], ['CE', 'Só CE'], ['MX', 'Só MX']].map(([v, n]) => `<button type="button" data-alvo="${v}" class="${v === alvo ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="campo"><label>Título</label><input id="p-titulo" maxlength="120" required placeholder="Novo material disponível"></div>
        <div class="campo"><label>Mensagem</label><textarea id="p-msg" maxlength="500" required placeholder="Galaxy A55 · W21 já está no app. Prazo: sexta."></textarea></div>
        <button class="cheio">Enviar notificação</button>
      </form>
      <h2>Últimas enviadas</h2>
      ${hist.length ? '' : '<div class="vazio">Nenhuma ainda.</div>'}
      ${hist.map((h) => `<div class="card"><div class="linha1"><span class="titulo">${esc(h.titulo)}</span><span class="tag neutra">${esc(h.alvo)}</span></div>
        <div class="meta">${esc(h.mensagem)}<br>${data(h.enviado_em)} · ${esc(h.enviado_por)} · ${h.entregues} aparelho(s)${h.falhas ? ' · ' + h.falhas + ' falha(s)' : ''}</div></div>`).join('')}`;
    el.querySelectorAll('[data-alvo]').forEach((b) => {
      b.onclick = () => { alvo = b.dataset.alvo; el.querySelectorAll('[data-alvo]').forEach((x) => x.classList.toggle('on', x === b)); };
    });
    document.getElementById('fp').onsubmit = async (e) => {
      e.preventDefault();
      const nome = { TODOS: 'TODOS', CE: 'CE', MX: 'MX' }[alvo];
      if (!confirm('Enviar para ' + nome + '?')) return;
      try {
        const r = await api('adm_push', { alvo, titulo: document.getElementById('p-titulo').value, mensagem: document.getElementById('p-msg').value });
        toast(`Enviada para ${r.entregues} aparelho(s).` + (r.aparelhos === 0 ? '\nNinguém dessa BU ativou notificações ainda.' : ''), 5000);
        telaAdmin('push');
      } catch (err) { toast(err.message); }
    };
  }

  async function admRelatorio(el) {
    const rels = (await api('adm_releases')).filter((r) => r.status === 'publicada');
    el.innerHTML = `
      <div class="campo"><label>Release</label><select id="rel"><option value="">Escolha…</option>
        ${rels.map((r) => `<option value="${esc(r.id)}">${esc(r.titulo)} [${r.bus.join('+')}]</option>`).join('')}</select></div>
      <div id="res"></div>`;
    document.getElementById('rel').onchange = async (e) => {
      const res = document.getElementById('res');
      if (!e.target.value) { res.innerHTML = ''; return; }
      res.innerHTML = '<div class="carregando">Carregando…</div>';
      try {
        const r = await api('adm_relatorio', { releaseId: e.target.value });
        res.innerHTML = `
          <div class="numeros"><div><b>${r.fizeram}</b><span>fizeram</span></div><div><b>${r.faltam}</b><span>faltam</span></div><div><b>${r.total}</b><span>arquivos</span></div></div>
          <div class="linha-acoes" style="margin-bottom:12px"><button class="sec pequeno" id="csv">Baixar planilha (CSV)</button></div>
          <div class="tabela-wrap"><table><thead><tr><th>Nome</th><th>BU</th><th>Baixados</th><th>Status</th><th>Último</th></tr></thead><tbody>
          ${r.linhas.map((l) => `<tr><td>${esc(l.nome)}</td><td>${esc(l.bu)}</td><td>${l.baixados}/${l.total}</td>
            <td>${l.fez ? '<span class="tag ok">FEZ</span>' : '<span class="tag pend">FALTA</span>'}</td><td>${data(l.ultima)}</td></tr>`).join('')}
          </tbody></table></div>`;
        document.getElementById('csv').onclick = () => baixarCsv('relatorio.csv',
          [['Nome', 'E-mail', 'BU', 'Baixados', 'Total', 'Status', 'Último']].concat(r.linhas.map((l) => [l.nome, l.email, l.bu, l.baixados, l.total, l.fez ? 'FEZ' : 'FALTA', data(l.ultima)])));
      } catch (err) { res.innerHTML = `<div class="erro">${esc(err.message)}</div>`; }
    };
  }

  // ---------- roteador ----------
  async function render() {
    atualizarFaixa();
    if (!ler(K.token)) return telaLogin();
    const partes = (location.hash || '#/').slice(2).split('/');
    try {
      if (partes[0] === 'r' && partes[1]) await telaRelease(decodeURIComponent(partes[1]));
      else if (partes[0] === 'admin') await telaAdmin(partes[1]);
      else if (partes[0] === 'conta') telaConta();
      else await telaInicio();
    } catch (e) {
      if (!ler(K.token)) return telaLogin();
      $app.innerHTML = `<div class="pagina vazio"><p class="erro">${esc(e.message)}</p><button id="tentar">Tentar de novo</button></div>`;
      document.getElementById('tentar').onclick = render;
    }
  }

  window.addEventListener('scroll', () => {
    document.getElementById('topo').classList.toggle('solido', window.scrollY > 40);
  }, { passive: true });
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
  esvaziarFila();
  renovarPush();
})();
