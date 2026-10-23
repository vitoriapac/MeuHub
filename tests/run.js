// Testes ponta a ponta do Meu Hub: Firebase simulado + Chrome/Edge headless via DevTools Protocol.
// Uso: node tests/run.js   (Node 24+, sem dependências; navegador por CHROME_PATH ou caminho padrão)
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), assert = require('assert');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const sleep = t => new Promise(r => setTimeout(r, t));

// Firebase simulado: "nuvem" e sessão ficam no localStorage para sobreviver a reloads.
// Fica numa closure para não colidir com os nomes globais do app.
const MOCK = `<script>
(()=>{window.__noSW=1;const ld=k=>JSON.parse(localStorage.getItem(k)||'null'),st=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const cloud=()=>ld('__cloud')||{},L={};window.__cloud=cloud;
const snap=p=>{const c=cloud();return{exists:p in c,data:()=>c[p],metadata:{fromCache:false}}};
const MA={cb:null,onAuthStateChanged(cb){this.cb=cb;setTimeout(()=>cb(ld('__sess')),20)},
 signInWithPopup(){const u={uid:window.__next,email:window.__next+'@teste.com'};st('__sess',u);this.cb(u);return Promise.resolve()},
 signOut(){st('__sess',null);this.cb(null);return Promise.resolve()}};
const MDB={doc(p){return{get:async()=>snap(p),
 set:async v=>{const c=cloud();c[p]=JSON.parse(JSON.stringify(v));st('__cloud',c);(L[p]||[]).forEach(f=>f(snap(p)))},
 delete:async()=>{const c=cloud();delete c[p];st('__cloud',c)},
 onSnapshot(cb){(L[p]=L[p]||[]).push(cb);setTimeout(()=>cb(snap(p)));return()=>{L[p]=L[p].filter(x=>x!==cb)}}}}};
window.firebase={initializeApp(){},auth:Object.assign(()=>MA,{GoogleAuthProvider:function(){}}),firestore:()=>MDB};})();
</script>`;

// Lê o site (index.html + css/ + js/ + img/ + PWA) e aplica o Firebase simulado: o mock entra no <body> do
// index.html e a config/carregador de teste entram no arquivo que tiver FB_CONFIG, seja qual for.
function sitePages() {
  const roots = ['index.html', 'manifest.webmanifest', 'sw.js'].filter(f => fs.existsSync(path.join(ROOT, f)));
  const files = [...roots, ...['css', 'js', 'img'].flatMap(d => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).map(f => d + '/' + f) : [])];
  const site = Object.fromEntries(files.map(f => ['/' + f, f.endsWith('.png') ? fs.readFileSync(path.join(ROOT, f)) : fs.readFileSync(path.join(ROOT, f), 'utf8')]));
  const swap = (file, from, to) => {
    const next = site[file].replace(from, to);
    if (next === site[file]) throw new Error(file + ' mudou: não achei ' + from);
    site[file] = next;
  };
  swap('/index.html', '<body>\n', '<body>\n' + MOCK + '\n');
  const cfg = Object.keys(site).filter(f => typeof site[f] === 'string' && site[f].includes('const FB_CONFIG='));
  if (cfg.length !== 1) throw new Error('esperava FB_CONFIG em 1 arquivo, achei em: ' + (cfg.join(', ') || 'nenhum'));
  swap(cfg[0], /const FB_CONFIG=(null|\{[^\n]*?\});/, 'const FB_CONFIG={projectId:"teste"};');
  // localStorage.__offline simula os scripts do Firebase sem baixar (sem internet)
  swap(cfg[0], /const fbScript=n=>[^\n]*\n/, 'const fbScript=n=>localStorage.getItem("__offline")?Promise.reject(new Error("offline")):Promise.resolve();\n');
  site['/'] = site['/index.html'];
  return site;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml; charset=utf-8', '.png': 'image/png' };
function serve(site) {
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    // mesma origem, sem o app rodando: limpa o armazenamento sem um timer do app regravar no meio
    if (p === '/limpar') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<script>localStorage.clear();document.title="limpo"</script>') }
    if (p in site) {
      const send = () => { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || TYPES['.html'] }); res.end(site[p]) };
      // srv.slow: cada .js chega mais tarde que o anterior, como numa rede lenta, para timers e promessas
      // de um arquivo dispararem antes de o próximo carregar
      const pos = srv.slow && p.endsWith('.js') ? site['/index.html'].indexOf('"' + p.slice(1)) : -1;
      return pos >= 0 ? setTimeout(send, srv.slow * (site['/index.html'].slice(0, pos).split('<script src=').length)) : send();
    }
    if (p !== '/favicon.ico') srv.missing.push(p); // arquivo do site que não existe (ex.: link errado depois de dividir)
    res.writeHead(404); res.end();
  });
  srv.missing = []; srv.slow = 0;
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

function findBrowser() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  const hit = c.find(p => fs.existsSync(p));
  if (!hit) throw new Error('Chrome/Edge não encontrado. Defina CHROME_PATH.');
  return hit;
}

async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meuhub-test-'));
  const proc = spawn(findBrowser(), ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + dir, 'about:blank']);
  let port;
  for (let i = 0; i < 100 && !port; i++) { try { port = fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0] } catch (e) { await sleep(100) } }
  if (!port) throw new Error('o navegador não abriu a porta de depuração');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j });
  let id = 0; const pend = {}, errors = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id] }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })) });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) throw new Error(expr + ' → ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
    return r.result.result.value;
  };
  const waitFor = async (expr, what, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { try { if (await ev(expr)) return } catch (e) {} await sleep(100) }
    throw new Error('tempo esgotado esperando: ' + what);
  };
  await send('Runtime.enable'); await send('Page.enable');
  const close = () => { try { ws.close() } catch (e) {} proc.kill(); try { fs.rmSync(dir, { recursive: true, force: true }) } catch (e) {} };
  return { send, ev, waitFor, errors, close };
}

async function main() {
  const srv = await serve(sitePages()), url = `http://127.0.0.1:${srv.address().port}/`;
  const b = await launch(), { ev, waitFor } = b;

  // cada cenário começa num aparelho "limpo": sem dados locais, nuvem vazia, sem sessão
  const open = async () => { await b.send('Page.navigate', { url }); await sleep(200); await waitFor('typeof FB==="object"&&FB.ready', 'Firebase simulado pronto') };
  const fresh = async (offline = false) => {
    await b.send('Page.navigate', { url: url + 'limpar' }); await waitFor('document.title==="limpo"', 'limpar armazenamento');
    if (offline) await ev('localStorage.setItem("__offline","1")');
    await open();
  };
  const login = async u => {
    await ev(`window.__next=${JSON.stringify(u)};document.querySelector('[data-a=fblogin]').click()`);
    // a troca de conta recarrega a página, então espera o estado final e não o clique
    await waitFor(`typeof FB==="object"&&FB.on&&FB.email===${JSON.stringify(u + '@teste.com')}&&SYS.s==="ok"`, 'login de ' + u);
  };
  const addTask = t => ev(`S.tasks.push({id:${JSON.stringify(t)},t:${JSON.stringify(t)},d:false});save()`);
  const localTasks = () => ev('S.tasks.map(t=>t.t).filter(t=>t.startsWith("t-"))');
  // junta os pedaços como o app faz; null se a nuvem ainda não tem uma versão completa
  const cloudTasksExpr = uid => `(()=>{const c=__cloud(),m=c["data/users/${uid}/hub-meta"];if(!m)return null;
    let s="";for(let i=0;i<m.n;i++){const d=c["data/users/${uid}/hub-"+i];if(!d||d.rev!==m.rev)return null;s+=d.s}
    return JSON.parse(s).tasks.map(t=>t.t).filter(t=>t.startsWith("t-"))})()`;
  const cloudTasks = uid => ev(cloudTasksExpr(uid));
  const waitCloud = (uid, t) => waitFor(`(${cloudTasksExpr(uid)}||[]).includes(${JSON.stringify(t)})`, `"${t}" na nuvem de ${uid}`);

  const scenarios = [
    ['1. sem login, o hub fica bloqueado', async () => {
      await fresh();
      assert.strictEqual(await ev('$("#gate").hidden'), false, 'tela de login deveria aparecer');
      assert.strictEqual(await ev('$(".app").inert'), true, 'hub deveria estar bloqueado');
      assert.ok(await ev('!!document.querySelector("#gate [data-a=fblogin]")'), 'falta o botão Entrar com o Google');
    }],
    ['2. login libera o hub e grava hub-meta e hub-0', async () => {
      await fresh(); await login('A');
      assert.strictEqual(await ev('$("#gate").hidden'), true);
      assert.strictEqual(await ev('$(".app").inert'), false);
      await addTask('t-um'); await waitCloud('A', 't-um');
      const keys = await ev('Object.keys(__cloud())');
      assert.ok(keys.includes('data/users/A/hub-meta') && keys.includes('data/users/A/hub-0'), 'documentos: ' + keys);
    }],
    ['3. mudança de outro aparelho é mesclada', async () => {
      await fresh(); await login('A'); await addTask('t-local'); await waitCloud('A', 't-local');
      await ev(`(async()=>{const d=firebase.firestore(),c=__cloud(),m=c["data/users/A/hub-meta"],st=JSON.parse(c["data/users/A/hub-0"].s);
        st.tasks.push({id:"t-remoto",t:"t-remoto",d:false});const s=JSON.stringify(st),rev=m.rev+1;
        await d.doc("data/users/A/hub-0").set({rev,i:0,s});await d.doc("data/users/A/hub-meta").set({rev,n:1,dev:"outro",at:"",len:s.length,v:1})})()`);
      await waitFor('S.tasks.some(t=>t.t==="t-remoto")', 'tarefa remota chegar');
      assert.deepStrictEqual((await localTasks()).sort(), ['t-local', 't-remoto']);
    }],
    ['4. troca de conta A → B → A não mistura dados', async () => {
      await fresh(); await login('A'); await addTask('t-de-A'); await waitCloud('A', 't-de-A');
      await ev('fbLogout()'); await waitFor('!FB.on', 'sair de A');
      await login('B');
      assert.deepStrictEqual(await localTasks(), [], 'B não pode ver as tarefas de A');
      await addTask('t-de-B'); await waitCloud('B', 't-de-B');
      assert.deepStrictEqual(await cloudTasks('B'), ['t-de-B'], 'nuvem de B');
      assert.deepStrictEqual(await cloudTasks('A'), ['t-de-A'], 'nuvem de A');
      await ev('fbLogout()'); await waitFor('!FB.on', 'sair de B');
      await login('A');
      assert.deepStrictEqual(await localTasks(), ['t-de-A'], 'A deve recuperar só as próprias tarefas');
    }],
    ['5. sair envia as últimas mudanças antes de desconectar', async () => {
      await fresh(); await login('A');
      await addTask('t-ultima'); await ev('fbLogout()'); // antes dos 2 s do envio automático
      await waitFor('!FB.on', 'sair');
      assert.ok((await cloudTasks('A') || []).includes('t-ultima'), 'a última tarefa não foi para a nuvem');
    }],
    ['6. sem internet: abre só local se já houve login, senão pede para tentar de novo', async () => {
      await fresh(); await login('A'); await addTask('t-offline'); await waitCloud('A', 't-offline');
      await ev('localStorage.setItem("__offline","1")'); await open();
      assert.strictEqual(await ev('$("#gate").hidden'), true, 'com login anterior, o hub deveria abrir');
      assert.strictEqual(await ev('$(".app").inert'), false);
      assert.deepStrictEqual(await localTasks(), ['t-offline'], 'dados locais');
      assert.match(await ev('synText()'), /sem conexão/, 'status deveria avisar que está sem conexão');
      await addTask('t-feita-offline'); await sleep(300);
      await ev('localStorage.removeItem("__offline")'); await open();
      await waitCloud('A', 't-feita-offline');
      await fresh(true);
      assert.strictEqual(await ev('$("#gate").hidden'), false, 'sem login anterior, a tela de login fica');
      assert.match(await ev('$("#gate").innerText'), /Tentar de novo/);
      assert.ok(await ev('!!document.querySelector("#gate [data-a=reload]")'), '"Tentar de novo" deve usar data-a="reload"');
    }],
    ['7. divisão em pedaços não corta emoji ao meio', async () => {
      await fresh();
      const r = await ev(`(()=>{const s="abcd😀ef😀g"+"😀".repeat(9);const out=[];
        for(let n=2;n<8;n++){const p=chunks(s,n);out.push({n,ok:p.join("")===s&&p.every(x=>x.length&&!/[\\uD800-\\uDBFF]$/.test(x)&&!/^[\\uDC00-\\uDFFF]/.test(x))})}
        return out.filter(x=>!x.ok)})()`);
      assert.deepStrictEqual(r, [], 'tamanhos de pedaço que cortaram um emoji');
      await login('A'); await ev('CH=5');
      await addTask('t-emoji 😀🎉'); await waitCloud('A', 't-emoji 😀🎉');
      assert.ok((await cloudTasks('A')).includes('t-emoji 😀🎉'), 'tarefa com emoji deve voltar inteira da nuvem');
    }],
    ['8. remove o token do login antigo (hub-gd)', async () => {
      await b.send('Page.navigate', { url: url + 'limpar' }); await waitFor('document.title==="limpo"', 'limpar');
      await ev('localStorage.setItem("hub-gd","{\\"tok\\":\\"x\\"}")'); await open();
      assert.strictEqual(await ev('localStorage.getItem("hub-gd")'), null);
    }],
    ['9. todas as telas abrem sem erro (menu, abas das Finanças, Início com todos os cards, busca)', async () => {
      await fresh(); await login('A');
      // cada tela é desenhada de verdade; uma função "perdida" vira erro de JS e falha aqui
      const vazias = await ev(`(()=>{const out=[],chk=n=>{render();if($('#main').innerHTML.trim().length<50)out.push(n)};
        S.cards=cfg().map(c=>({...c,on:true}));
        for(const k of Object.keys(NAV)){Q='';S.view=k;chk(k)}
        S.view='financas';for(const [t] of FTABS)for(const v of ['mes','ano']){S.ftab=t;S.fvw=v;chk('financas/'+t+'/'+v)}
        S.view='dash';Q='a';chk('busca');Q='';S.view='dash';render();return out})()`);
      assert.deepStrictEqual(vazias, [], 'telas vazias');
      // Pacote 1: captura rápida com valor/data/etiqueta na mesma frase, filtros em Lançamentos e edição de recorrentes/contas fixas
      const p1 = await ev(`(()=>{
        qa('dp');const fq=$('#fqa');fq.querySelector('[name=t]').value='mercado 85,90 ontem #casa';
        fq.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const tx=S.fin.tx[0];
        const okNL=tx&&tx.t==='mercado'&&tx.v===85.9&&tx.d===ds(add(today,-1))&&tx.tg==='casa'&&tx.cat==='Alimentação';
        S.view='financas';S.fvw='mes';S.ftab='lanc';render();
        const qEl=$('#fq');qEl.value='mercado';qEl.dispatchEvent(new Event('input',{bubbles:true}));
        const okSearch=$('#txlist').textContent.includes('Mostrando 1 de')&&$('#txlist').textContent.includes('mercado');
        document.querySelector('[data-a="fclr"]').click();
        S.ftab='contas';render();
        const fr=$('#frec');fr.querySelector('[name=t]').value='Academia';fr.querySelector('[name=v]').value='120';fr.querySelector('[name=day]').value='5';
        fr.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const rid=S.fin.rec[0].id;document.querySelector('[data-a="edrec"][data-id="'+rid+'"]').click();
        const fr2=$('#frec');fr2.querySelector('[name=v]').value='150';fr2.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const okRec=S.fin.rec[0].v===150&&RED===null;
        S.ftab='orc';render();
        const fb=$('#fbill');fb.querySelector('[name=n]').value='Internet';fb.querySelector('[name=v]').value='99';fb.querySelector('[name=day]').value='10';
        fb.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const bid=S.fin.bills[0].id;document.querySelector('[data-a="edbill"][data-id="'+bid+'"]').click();
        const fb2=$('#fbill');fb2.querySelector('[name=v]').value='115';fb2.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const okBill=S.fin.bills[0].v===115&&BED===null&&S.events.some(e=>e.id===S.fin.bills[0].eid&&e.t.includes('115'));
        // Pacote 2: promover subtarefa a tarefa ligada, busca de lançamentos e diário no Ctrl+K e som do Pomodoro
        S.tasks.unshift({id:'t_parent',t:' Reforma ',done:false,p:'a',pj:'Casa',tg:'obra',sub:[{id:'s_1',t:'Comprar tinta',done:false}]});
        S.view='tarefas';render();
        document.querySelector('[data-a="sprom"][data-id="t_parent"][data-s="s_1"]').click();
        const prom=S.tasks.find(x=>x.t==='Comprar tinta');
        const okProm=!!prom&&prom.pj==='Casa'&&prom.tg==='obra'&&S.tasks.find(x=>x.id==='t_parent').sub.length===0&&lkOf('tk:t_parent').includes('tk:'+prom.id);
        S.dia[T]={m:5,a:'Dia excelente no parque'};
        const ckTx=ckItems('mercado').some(x=>x.g==='Itens'&&x.l.includes('mercado'));
        const ckDia=ckItems('parque').some(x=>x.g==='Itens'&&x.l.includes('Diário'));
        chime(1);
        return {okNL,okSearch,okRec,okBill,okProm,ckTx,ckDia};
      })()`);
      assert.deepStrictEqual(p1, { okNL: true, okSearch: true, okRec: true, okBill: true, okProm: true, ckTx: true, ckDia: true }, 'Pacotes 1 e 2');
      await sleep(500); // erros assíncronos de desenho (timers, cards do Início)
    }],
    ['11. rede lenta: arquivos chegando com atraso não quebram a abertura (com e sem login, com e sem internet)', async () => {
      srv.slow = 700;
      try {
        await fresh(); await sleep(3000);                       // sem login
        await login('A'); await addTask('t-lento'); await waitCloud('A', 't-lento');
        await open(); await waitFor('FB.on&&SYS.s==="ok"', 'reabrir logado'); await sleep(3000);
        assert.deepStrictEqual(await localTasks(), ['t-lento']);
        await ev('localStorage.setItem("__offline","1")'); await open(); await sleep(3000); // sem internet
        assert.strictEqual(await ev('$("#gate").hidden'), true, 'sem internet, com login anterior, o hub abre');
      } finally { srv.slow = 0 }
    }],
    ['10. todos os arquivos locais têm a mesma ?v= (cache do GitHub Pages não mistura versões)', async () => {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const links = [...html.matchAll(/(?:src|href)="((?:css|js)\/[^"]+)"/g)].map(m => m[1]);
      assert.ok(links.length, 'nenhum arquivo local linkado');
      const sem = links.filter(l => !/\?v=\w+$/.test(l));
      assert.deepStrictEqual(sem, [], 'links sem ?v=');
      const versoes = [...new Set(links.map(l => l.split('?v=')[1]))];
      assert.strictEqual(versoes.length, 1, 'versões diferentes: ' + versoes.join(', '));
      const soltos = ['css', 'js'].flatMap(d => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).map(f => d + '/' + f) : [])
        .filter(f => !links.some(l => l.startsWith(f + '?')));
      assert.deepStrictEqual(soltos, [], 'arquivos em css/ ou js/ que o index.html não carrega');
    }],
    ['12. PWA: manifesto, ícones, sw.js sincronizado com ?v=, theme-color dinâmico e atalhos de URL', async () => {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const ver = html.match(/\?v=(\w+)/)[1];
      const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
      assert.strictEqual(mf.display, 'standalone');
      assert.ok(mf.icons.length >= 3, 'manifesto precisa de ícones');
      mf.icons.forEach(i => assert.ok(fs.existsSync(path.join(ROOT, i.src)), 'ícone ausente: ' + i.src));
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
      assert.ok(sw.includes(`VER='${ver}'`), 'sw.js deve ter a mesma versão VER de ?v= (' + ver + ')');
      ['css', 'js'].flatMap(d => fs.readdirSync(path.join(ROOT, d)).map(f => d + '/' + f)).forEach(f => {
        assert.ok(sw.includes(f), 'sw.js não faz cache de ' + f);
      });
      await fresh(); await login('A');
      await ev('document.documentElement.dataset.theme="light";applyTheme()');
      assert.strictEqual(await ev('document.querySelector(\'meta[name="theme-color"]\').content'), '#eef4f8');
      await ev('document.documentElement.dataset.theme="dark";applyTheme()');
      assert.strictEqual(await ev('document.querySelector(\'meta[name="theme-color"]\').content'), '#1f1b24');
      await ev('S.pal="ametista";applyTheme()');
      assert.strictEqual(await ev('document.querySelector(\'meta[name="theme-color"]\').content'), '#1a0d3f');
      await b.send('Page.navigate', { url: url + '?v=hoje&qa=dp' });
      await waitFor('typeof FB==="object"&&FB.ready&&S.view==="hoje"', 'atalho ?v=hoje');
      assert.strictEqual(await ev('location.search'), '', 'URL deve limpar os parâmetros de atalho');
      assert.strictEqual(await ev('!$("#qa").classList.contains("hide")&&QT==="dp"&&!!$("#fqa input[name=d]")'), true, 'atalho ?qa=dp deve abrir captura de despesa com data');
      await ev('S.view="dash";S.cards=null;render()');
      assert.deepStrictEqual(await ev('[...document.querySelectorAll("#main [data-card]")].map(x=>x.dataset.card)'), ['linha', 'todo', 'agenda', 'habs', 'fin'], 'cards padrão do Início');
      await ev('document.querySelector("[data-a=comp]").click()');
      assert.strictEqual(await ev('!!document.querySelector("[data-card=spotify]")&&!!document.querySelector("[data-card=clima]")'), true, 'modo Companhia liga Spotify e Clima');
      // reconexão automática ao voltar a internet (evento online) sem recarregar a página
      await ev('localStorage.setItem("__offline","1")'); await open();
      assert.strictEqual(await ev('FB.err'), true);
      await addTask('t-auto-online');
      await ev('localStorage.removeItem("__offline");window.dispatchEvent(new Event("online"))');
      await waitCloud('A', 't-auto-online');
      // layout mobile 375 px: barra inferior fixa, busca espaçosa e abas em linha única
      await b.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
      try {
        await ev('S.view="financas";S.fvw="mes";render()');
        assert.strictEqual(await ev('getComputedStyle($("#side")).position'), 'fixed', 'barra inferior deve ser fixa em 375 px');
        assert.ok(await ev('$("#q").getBoundingClientRect().width >= 200'), 'campo de busca deve ter pelo menos 200 px em 375 px');
        assert.strictEqual(await ev('getComputedStyle($(".ftabs")).flexWrap'), 'nowrap', 'abas das Finanças devem rolar numa linha só no celular');
      } finally {
        await b.send('Emulation.clearDeviceMetricsOverride');
      }
    }],
  ];

  let failed = 0;
  for (const [name, fn] of scenarios) {
    b.errors.length = 0; srv.missing.length = 0;
    try {
      await fn();
      if (b.errors.length) throw new Error('erro de JS na página: ' + b.errors.join(' | '));
      if (srv.missing.length) throw new Error('arquivos não encontrados: ' + [...new Set(srv.missing)].join(', '));
      console.log('✓ ' + name);
    } catch (e) { failed++; console.log('✗ ' + name + '\n    ' + e.message.split('\n').join('\n    ')) }
  }
  b.close(); srv.close();
  console.log(failed ? `\n${failed} de ${scenarios.length} falharam` : `\n${scenarios.length} cenários passaram`);
  process.exit(failed ? 1 : 0);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) });
module.exports = { sitePages, serve, launch };
