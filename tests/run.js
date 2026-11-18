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
const MDB={runTransaction:async fn=>{const writes=[],tx={get:async ref=>snap(ref.path),set:(ref,v)=>writes.push([ref.path,v])};await fn(tx);for(const [p,v] of writes){const c=cloud();c[p]=JSON.parse(JSON.stringify(v));st('__cloud',c)}for(const [p] of writes)(L[p]||[]).forEach(f=>f(snap(p)))},doc(p){return{path:p,get:async()=>snap(p),
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
    ['leituras antigas sem tipo mantêm tratamento de livro na estante', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{RD.tab='shelf';RD.selected='';S.reads=[{id:'old',t:'Livro antigo',st:'f'},{id:'film',t:'Filme',k:'filme',st:'f'}];S.view='leituras';render();return [...document.querySelectorAll('.book-spine')].map(x=>x.textContent)})()`);
      assert.strictEqual(r.length,1);assert.match(r[0],/Livro antigo/);
    }],
    ['cor da lombada também acompanha capas predominantemente brancas', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>({color:coverDominant(new Uint8ClampedArray([255,255,255,255,250,250,250,255])),ink:spineInk('#fcfcfc')}))()`);
      assert.strictEqual(r.color,'#fdfdfd');assert.strictEqual(r.ink,'#161616');
    }],
    ['capas já carregadas podem ser recuperadas do cache sem rede', async () => {
      const vm=require('vm'),handlers={},store=new Map();let online=true,network=0;
      const cache={match:async req=>store.get(req.url),put:async(req,res)=>store.set(req.url,res),keys:async()=>[...store.keys()].map(url=>({url})),delete:async req=>store.delete(req.url)};
      const context={URL,self:{location:{origin:'https://app.example'},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>cache},fetch:async()=>{network++;if(!online)throw Error('offline');return {ok:true,type:'cors',clone(){return this}}}};
      vm.runInNewContext(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),context);
      const request={method:'GET',url:'https://covers.openlibrary.org/b/id/123-M.jpg?default=false'};let response;const event={request,respondWith:p=>{response=p}};handlers.fetch(event);assert.strictEqual((await response).ok,true);online=false;handlers.fetch(event);assert.strictEqual((await response).ok,true);assert.strictEqual(network,1);
    }],
    ['busca de capa offline mostra mensagem e preserva a capa atual', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{RD.tab='shelf';RD.selected='b';S.reads=[{id:'b',t:'Livro',k:'livro',st:'f',cover:77,coverColor:'#123456'}];S.view='leituras';render();const old=window.fetch;window.fetch=async()=>{throw Error('offline')};await findCover('b');window.fetch=old;return {error:RD.lookup.error,cover:S.reads[0].cover,color:S.reads[0].coverColor}})()`);
      assert.match(r.error,/conexão/i);assert.strictEqual(r.cover,77);assert.strictEqual(r.color,'#123456');
    }],
    ['páginas e busca da coleção acompanham os dados do livro', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{RD.tab='collection';RD.q='';S.rk='';S.rs='';S.reads=[{id:'b',t:'Livro de aventura',a:'Autora',k:'livro',st:'a',p:0},{id:'c',t:'Outro',k:'filme',st:'q'}];S.view='leituras';render();let i=document.querySelector('[data-rd-pages=b]');i.value='200';i.dispatchEvent(new Event('change',{bubbles:true}));i=document.querySelector('[data-rd-page=b]');i.value='50';i.dispatchEvent(new Event('change',{bubbles:true}));const before={...S.reads[0]},search=document.querySelector('#rd-search');search.value='aventura';search.dispatchEvent(new Event('input',{bubbles:true}));return {before,visible:!!document.querySelector('[data-lid="rd:b"]'),hidden:!document.querySelector('[data-lid="rd:c"]')}})()`);
      assert.strictEqual(r.before.pages,200);assert.strictEqual(r.before.page,50);assert.strictEqual(r.before.p,25);assert.ok(r.visible&&r.hidden);
    }],
    ['backup restaura a coleção e suas capas sem afetar backups antigos', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{S.reads=[{id:'antigo',t:'Anterior',k:'livro',st:'q'}];S.view='backup';render();const f=document.querySelector('#bkfile'),d=new DataTransfer(),data={tasks:[],events:[],reads:[{id:'book',t:'Livro',k:'livro',st:'f',df:T,cover:240727,coverColor:'#325a72'}]};d.items.add(new File([JSON.stringify(data)],'backup.json',{type:'application/json'}));f.files=d.files;f.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(x=>setTimeout(x,150));return {reads:S.reads,ok:validBackup(data)}})()`);
      assert.strictEqual(r.ok,true);assert.strictEqual(r.reads[0].id,'book');assert.strictEqual(r.reads[0].coverColor,'#325a72');
    }],
    ['estante exibe somente livros concluídos e mostra detalhes pela lombada', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{RD.tab='collection';RD.q='';RD.selected='';S.rk='';S.rs='';S.reads=[{id:'b',t:'Livro de teste',a:'Autora',k:'livro',st:'f',df:T,r:4,n:'Gostei',coverColor:'#aabbcc'},{id:'other',t:'Pendente',k:'livro',st:'q'},{id:'film',t:'Filme',k:'filme',st:'f'}];S.view='leituras';render();document.querySelector('[data-a=rd-tab][data-id=shelf]').click();const before=[...document.querySelectorAll('.book-spine')].map(x=>x.textContent);document.querySelector('[data-a=rd-open][data-id=b]').click();return {before,text:document.querySelector('.book-detail').innerText,color:document.querySelector('#spine-b').style.getPropertyValue('--spine')}})()`);
      assert.strictEqual(r.before.length,1);assert.match(r.before[0],/Livro de teste/);assert.match(r.text,/Autora/);assert.match(r.text,/Gostei/);assert.match(r.text,/Capa não selecionada/);assert.strictEqual(r.color,'#aabbcc');
    }],
    ['capa escolhida gera cor pela imagem e persiste na coleção', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{RD.tab='shelf';RD.selected='b';S.reads=[{id:'b',t:'Livro',a:'Autora',k:'livro',st:'f',df:T}];S.view='leituras';render();const oldFetch=window.fetch,OldImage=window.Image,oldContext=HTMLCanvasElement.prototype.getContext;window.fetch=async()=>({ok:true,json:async()=>({docs:[{title:'Livro',author_name:['Autora'],cover_i:12345,first_publish_year:2000}]})});window.Image=class{set src(v){queueMicrotask(()=>this.onload())}};HTMLCanvasElement.prototype.getContext=function(){return {drawImage(){},getImageData(){return {data:new Uint8ClampedArray([30,90,150,255,30,90,150,255,255,255,255,255])}}}};await findCover('b');document.querySelector('[data-a=rd-cover-use]').click();await new Promise(resolve=>setTimeout(resolve,20));window.fetch=oldFetch;window.Image=OldImage;HTMLCanvasElement.prototype.getContext=oldContext;return {cover:S.reads[0].cover,color:S.reads[0].coverColor,spine:document.querySelector('#spine-b').style.getPropertyValue('--spine'),url:coverUrl(S.reads[0].cover)}})()`);
      assert.strictEqual(r.cover,12345);assert.strictEqual(r.color,'#1e5a96');assert.strictEqual(r.spine,r.color);assert.match(r.url,/covers\.openlibrary\.org/);await open();assert.strictEqual(await ev('S.reads[0].coverColor'),'#1e5a96');
    }],
    ['edição de leitura preserva data e mantém progresso coerente', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{RD.tab='collection';RD.q='';S.rk='';S.rs='';S.reads=[{id:'b',t:'Livro',k:'livro',st:'f',df:'2020-01-02',p:100,pages:200,page:200}];S.view='leituras';render();const select=document.querySelector('[data-rds=b]');select.value='a';select.dispatchEvent(new Event('change',{bubbles:true}));return S.reads[0]})()`);
      assert.strictEqual(r.st,'a');assert.strictEqual(r.df,'2020-01-02');assert.strictEqual(r.p,0);assert.strictEqual(r.page,0);
    }],
    ['etapa desativada em outro aparelho não prende a navegação', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.rot={};S.rotPrefs={m:{1:false}};S.view='rotina';RT.date=T;RT.mode='m';RT.i=1;render();const corrected=RT.i;document.querySelector('[data-a=rtn][data-id="1"]').click();return {corrected,next:RT.i}})()`);
      assert.strictEqual(r.corrected,0);assert.strictEqual(r.next,2);
    }],
    ['backup restaura rotina, preferências e registros separados', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{S.rot={[T]:{m:1,progress:{n:3}}};S.rotPrefs={n:{1:false}};S.dia={[T]:{focus:'Estudar',routine:{m:{m:4},n:{m:5}}}};const data=JSON.parse(JSON.stringify(pick()));S.rot={};S.rotPrefs={};S.dia={};S.view='backup';render();const f=document.querySelector('#bkfile'),files=new DataTransfer();files.items.add(new File([JSON.stringify(data)],'backup.json',{type:'application/json'}));f.files=files.files;f.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,150));return {rot:S.rot[T],prefs:S.rotPrefs,day:S.dia[T],msg:document.querySelector('#bkmsg').textContent}})()`);
      assert.strictEqual(r.rot.m,1);assert.strictEqual(r.rot.progress.n,3);assert.strictEqual(r.prefs.n['1'],false);assert.strictEqual(r.day.routine.m.m,4);assert.strictEqual(r.day.routine.n.m,5);assert.match(r.msg,/restaurado/i);
    }],
    ['rascunho da tarefa de amanhã sobrevive ao recarregamento', async () => {
      await fresh(); await login('A');
      await ev(`(()=>{S.rot={};S.view='rotina';RT.date=T;RT.mode='n';rtStep('n',3);render();const i=document.querySelector('#rtnew');i.value='Ligar para o banco';i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
      await open();const r=await ev(`(()=>{rtOpen('n');S.view='rotina';render();return {step:RT.i,draft:document.querySelector('#rtnew').value}})()`);
      assert.strictEqual(r.step,3);assert.strictEqual(r.draft,'Ligar para o banco');
    }],
    ['rotina planeja amanhã preservando prazos individuais e em lote', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.rot={};S.tasks=[{id:'future',t:'Projeto',done:false,hd:T,due:ds(add(today,7))},{id:'late',t:'Atrasada',done:false,due:ds(add(today,-2))}];S.view='rotina';RT.date=T;RT.mode='n';RT.i=0;render();document.querySelector('[data-a=rtmove]').click();const late={...S.tasks[1]};S.tasks[0].hd=T;render();document.querySelector('[data-a=rtplan][data-id=future]').click();const one={...S.tasks[0]};return {one,late,tomorrow:ds(add(today,1)),original:ds(add(today,7)),old:ds(add(today,-2))}})()`);
      assert.strictEqual(r.one.hd,r.tomorrow);assert.strictEqual(r.one.due,r.original);assert.strictEqual(r.late.hd,r.tomorrow);assert.strictEqual(r.late.due,r.old);
    }],
    ['rotina prioriza tarefas planejadas e inclui duração padrão na carga', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.rot={};S.tasks=Array.from({length:10},(_,i)=>({id:'o'+i,t:'Atrasada '+i,done:false,due:ds(add(today,-1))}));S.tasks.push({id:'p',t:'Planejada importante',done:false,hd:T,due:ds(add(today,5)),dur:0});S.events=[];S.view='rotina';RT.date=T;RT.mode='m';RT.i=3;render();return {text:document.querySelector('#main').innerText,load:dayLoad(T)}})()`);
      assert.match(r.text,/Planejada importante/);assert.match(r.text,/Ver outras/);assert.strictEqual(r.load.pl,30);
    }],
    ['humor da manhã e noite permanece separado do diário geral', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.dia={[T]:{m:2,e:3}};S.rot={};S.view='rotina';RT.date=T;RT.mode='m';RT.i=0;render();document.querySelector('[data-a=rtmood][data-mode=m][data-k=m][data-id="4"]').click();RT.mode='n';RT.i=2;render();document.querySelector('[data-a=rtmood][data-mode=n][data-k=m][data-id="5"]').click();S.view='diario';render();return {day:S.dia[T],text:document.querySelector('#main').innerText}})()`);
      assert.strictEqual(r.day.m,2);assert.strictEqual(r.day.routine.m.m,4);assert.strictEqual(r.day.routine.n.m,5);assert.match(r.text,/Manhã: humor Bom/);assert.match(r.text,/Noite: humor Ótimo/);
    }],
    ['rotina retoma etapa e preferências após recarregar', async () => {
      await fresh(); await login('A');
      await ev(`(()=>{S.rot={};S.rotPrefs={};S.view='rotina';rtOpen('m');render();const c=document.querySelector('[data-rt-pref="m:1"]');c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-a=rtn][data-id="1"]').click();return true})()`);
      await open();const r=await ev(`(()=>{rtOpen('m');S.view='rotina';render();return {i:RT.i,pref:S.rotPrefs.m['1'],saved:pick().rotPrefs.m['1'],text:document.querySelector('#main').innerText}})()`);
      assert.strictEqual(r.i,2);assert.strictEqual(r.pref,false);assert.strictEqual(r.saved,false);assert.match(r.text,/Seu dia/);
    }],
    ['foco e planejamento de amanhã preservam dados antigos', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.focus='Foco antigo';S.rot={};S.dia={};const tm=ds(add(today,1));S.tasks=[{id:'p',t:'Planejada amanhã',done:false,hd:tm,due:ds(add(today,4))}];S.view='rotina';RT.date=T;RT.mode='m';RT.i=1;render();const focus=document.querySelector('#fo');const empty=focus.value;focus.value='Estudar';focus.dispatchEvent(new Event('input',{bubbles:true}));RT.mode='n';RT.i=3;render();const text=document.querySelector('#main').innerText;const f=document.querySelector('#rtnew');f.value='Ligar';f.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-a=rtadd]').click();return {old:S.focus,empty,focus:S.dia[T].focus,text,task:S.tasks[0],tm,history:rtHistory()}})()`);
      assert.strictEqual(r.old,'Foco antigo');assert.strictEqual(r.empty,'');assert.strictEqual(r.focus,'Estudar');assert.match(r.text,/Planejada amanhã/);assert.strictEqual(r.task.hd,r.tm);assert.strictEqual(r.task.due,'');assert.match(r.history,/Estudar/);
    }],
    ['edições independentes de uma nota mesclam datas sem conflito falso', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const base={id:'n',t:'Original',b:'Texto',g:'',updatedAt:100},local={...base,t:'Novo título',updatedAt:200},remote={...base,g:'pessoal',updatedAt:300},c=[],result=merge3(base,local,remote,c),same=[];merge3(base,{...local,b:'Versão local'},{...remote,b:'Versão remota'},same);return {result,conflicts:c.length,real:same.length}})()`);
      assert.strictEqual(r.result.t,'Novo título');assert.strictEqual(r.result.g,'pessoal');assert.strictEqual(r.result.updatedAt,300);assert.strictEqual(r.conflicts,0);assert.ok(r.real>0);
    }],
    ['busca e filtros encontram texto e itens de listas preservando rascunhos', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{noteReset();S.notes=[{id:'n',t:'Ideias',b:'Café da manhã',f:'',g:'',c:'p'},{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[{id:'i',t:'Arroz',q:'2 kg',done:false}]}];S.view='notas';render();const item=document.querySelector('[data-shopping-form] [name=t]');item.value='Feijão';item.dispatchEvent(new Event('input',{bubbles:true}));let q=document.querySelector('#note-search');q.value='cafe';q.dispatchEvent(new Event('input',{bubbles:true}));const text=!!document.querySelector('[data-lid="nt:n"]'),hidden=!document.querySelector('[data-lid="nt:l"]');q=document.querySelector('#note-search');q.value='arroz';q.dispatchEvent(new Event('input',{bubbles:true}));const found=!!document.querySelector('[data-lid="nt:l"]'),draft=document.querySelector('[data-shopping-form] [name=t]').value;const type=document.querySelector('#note-type');type.value='note';type.dispatchEvent(new Event('change',{bubbles:true}));return {text,hidden,found,draft,none:!document.querySelector('[data-lid="nt:l"]')}})()`);
      assert.ok(r.text&&r.hidden&&r.found&&r.none);assert.strictEqual(r.draft,'Feijão');
    }],
    ['compras calculam valores decimais sem alterar finanças e preservam backup', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[{id:'old',t:'Antigo',q:'pacote',done:false}]}];S.view='notas';render();const before=JSON.stringify(S.fin.tx),f=document.querySelector('[data-shopping-form]');f.elements.t.value='Arroz';f.elements.qty.value='2';f.elements.unit.value='kg';f.elements.estimated.value='18,00';f.elements.actual.value='17,50';f.requestSubmit();const a=shoppingTotals(S.notes[0].items,'estimatedCents'),b=shoppingTotals([{qty:1.5,actualCents:999}],'actualCents');return {a,b,fin:before===JSON.stringify(S.fin.tx),valid:validBackup(pick()),item:S.notes[0].items[1]}})()`);assert.strictEqual(r.a.value,36);assert.strictEqual(r.a.missing,1);assert.strictEqual(r.b.value,14.99);assert.ok(r.fin&&r.valid);assert.strictEqual(r.item.actualCents,1750);
    }],
    ['simulação financeira compara sem gravar e respeita meses curtos', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const fin={acc:[{id:'a',ty:'cc',ini:1000},{id:'b',ty:'cc',ini:500}],tx:[{id:'x',k:'out',ac:'a',d:'2030-02-15',v:100},{id:'y',k:'out',ac:'b',d:'2030-02-15',v:200}]},before=JSON.stringify(fin),r=simulatePurchase(fin,'a','2030-01-31',30000,2,0,'2030-01-01'),interest=simulatePurchase(fin,'a','2030-01-31',10000,2,10,'2030-01-01');return {r,interest,unchanged:before===JSON.stringify(fin)}})()`);assert.strictEqual(r.r.end,'2030-02-28');assert.strictEqual(r.r.base,90000);assert.strictEqual(r.r.scenario,60000);assert.strictEqual(r.interest.total,12100);assert.ok(r.unchanged);
    }],
    ['sessões de compra preservam itens e permitem compras distintas', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[{id:'i',t:'Arroz',q:'',qty:2,unit:'kg',estimatedCents:1800,actualCents:1700,done:true}]}];S.fin.tx=[];S.view='notas';render();document.querySelector('[data-a=shopping-expense]').click();let f=document.querySelector('#fqa');const initial=f.elements.v.value;f.requestSubmit();const first=S.fin.tx[0];document.querySelector('[data-a=shopping-expense]').click();f=document.querySelector('#fqa');f.requestSubmit();return {initial,tx:S.fin.tx,firstId:first.id}})()`);assert.strictEqual(r.initial,'34,00');assert.strictEqual(r.tx.length,2);assert.notStrictEqual(r.tx[0].id,r.firstId);assert.deepStrictEqual(r.tx[0].shoppingItems,['i']);
    }],
    ['simulador pela interface não salva nem sincroniza', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.view='financas';render();const f=document.querySelector('#purchase-simulator');f.elements.amount.value='120,00';f.elements.parts.value='2';const before=JSON.stringify(S.fin),local=localStorage.getItem('hub-v1'),sync=localStorage.getItem('hub-sync');f.requestSubmit();return {unchanged:before===JSON.stringify(S.fin),local:local===localStorage.getItem('hub-v1'),sync:sync===localStorage.getItem('hub-sync'),text:document.querySelector('[data-simulation-result]').textContent}})()`);assert.ok(r.unchanged&&r.local&&r.sync);assert.match(r.text,/Base: saldo final/);
    }],
    ['revisão de assinaturas sinaliza atenção e não cria cobranças', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.fin.rec=[{id:'r',t:'Serviço',k:'out',cat:'Assinaturas',v:20,day:1,ini:T,ac:S.fin.acc[0].id}];S.view='financas';S.ftab='contas';S.fvw='mes';render();const count=S.fin.tx.length;document.querySelector('[data-a=sub-review]').click();const flagged=attention().some(x=>x.k==='sub'&&x.id==='r');document.querySelector('[data-a=sub-task]').click();const task=S.tasks.some(x=>x.t==='Revisar assinatura: Serviço');document.querySelector('[data-a=sub-review]').click();return {flagged,task,pending:S.fin.rec[0].review,count,balance:S.fin.tx.length,text:document.querySelector('#main').innerText}})()`);assert.ok(r.flagged&&r.task&&!r.pending);assert.strictEqual(r.balance,r.count);assert.match(r.text,/por ano/);
    }],
    ['visão de projetos usa vínculos e despesas existentes', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Tarefa',done:false,pj:'Casa',mt:'g'}];S.notes=[{id:'n',t:'Nota',b:'',c:'g'}];S.metas=[{id:'g',t:'Meta',kr:[]}];S.fin.tx=[{id:'x',k:'out',v:42,d:T,pj:'Casa',ac:S.fin.acc[0].id}];S.lnk=[];lkSet('tk:t','nt:n',true);S.view='tarefas';render();const text=document.querySelector('#main').innerText;return {text,notes:S.notes.length,tx:S.fin.tx.length,html:document.querySelector('#main').innerHTML}})()`);assert.match(r.text,/Casa/);assert.match(r.html,/42,00/);assert.match(r.html,/Nota/);assert.strictEqual(r.notes,1);assert.strictEqual(r.tx,1);
    }],
    ['histórico local limita registros e não guarda nomes ou valores', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{localStorage.removeItem(AUDIT_KEY);for(let i=0;i<102;i++)auditLog('reviewStart');const all=JSON.parse(localStorage.getItem(AUDIT_KEY)),html=auditPanel();return {n:all.length,keys:Object.keys(all[0]).sort(),html}})()`);assert.strictEqual(r.n,100);assert.deepStrictEqual(r.keys,['at','type']);assert.match(r.html,/não sincroniza/);
    }],
    ['exportação seletiva limita áreas e protege texto em CSV', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'t',t:'=1+1',done:false,pj:'Casa'}];S.notes=[{id:'n',t:'Segredo',b:'Texto',c:'g'}];S.fin.tx=[{id:'x',d:T,k:'out',v:30,t:'Compra'}];S.view='backup';render();let result=null;const old=siteSave;siteSave=(name,body,type)=>result={name,body,type};let f=document.querySelector('#export-selective');f.querySelector('[value=tasks]').checked=true;f.requestSubmit();const json=JSON.parse(result.body),oldBackup=result.body;f=document.querySelector('#export-table');f.elements.area.value='tasks';f.requestSubmit();siteSave=old;return {json,csv:result.body,oldBackup}})()`);assert.deepStrictEqual(Object.keys(r.json.areas),['tasks']);assert.ok(!r.oldBackup.includes('Segredo')&&!r.oldBackup.includes('Compra'));assert.match(r.csv,/'=1\+1/);
    }],
    ['perfis preservam configuração anterior e não alteram dados pessoais', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{localStorage.removeItem(PROFILE_KEY);S.cards=[{id:'todo',on:false}];S.menu=null;S.tasks=[{id:'t',t:'Segredo',done:false}];profileCreate('Trabalho');const first=profileRead().active;S.cards=[{id:'todo',on:true}];profileSwitch('default');const standard=S.cards===null;profileSwitch(first);const restored=S.cards[0].on;return {standard,restored,active:profileRead().active,first,tasks:S.tasks,backup:JSON.stringify(pick()).includes('Trabalho')}})()`);assert.ok(r.standard&&r.restored);assert.strictEqual(r.active,r.first);assert.strictEqual(r.tasks[0].t,'Segredo');assert.ok(!r.backup);
    }],
    ['perfis com armazenamento inválido preservam a configuração', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.cards=[{id:'todo',on:false}];localStorage.setItem(PROFILE_KEY,'invalido');const before=JSON.stringify(S.cards);let failed=false;try{profileSwitch('default')}catch(e){failed=true}return {failed,same:JSON.stringify(S.cards)===before,raw:localStorage.getItem(PROFILE_KEY)}})()`);assert.ok(r.failed&&r.same);assert.strictEqual(r.raw,'invalido');
    }],
    ['perfis podem ser salvos e aplicados pela interface', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{localStorage.removeItem(PROFILE_KEY);S.cards=[{id:'todo',on:false}];S.view='menu';render();const f=document.querySelector('#profile-create');f.elements.name.value='Foco';f.requestSubmit();const id=profileRead().active;document.querySelector('[data-a=profile-switch][data-id=default]').click();const reset=S.cards===null;document.querySelector('[data-a=profile-switch][data-id="'+id+'"]').click();return {reset,restored:S.cards[0].on===false,text:document.querySelector('#main').innerText}})()`);assert.ok(r.reset&&r.restored);assert.match(r.text,/Foco/);
    }],
    ['central de arquivados restaura notas sem perder ligações', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.notes=[{id:'n',t:'Decisão',b:'Texto',c:'p',archived:true}];S.tasks=[{id:'t',t:'Tarefa',done:false}];S.lnk=[];lkSet('nt:n','tk:t',true);S.view='arquivados';render();const b=document.querySelector('[data-a=note-archive][data-id=n]');if(!b)return null;const before=document.querySelector('#main').innerText;b.click();return {before,note:S.notes[0],link:lkOf('nt:n').includes('tk:t'),hidden:!document.querySelector('[data-a=note-archive][data-id=n]')}})()`);assert.ok(r);assert.match(r.before,/Decisão/);assert.strictEqual(r.note.archived,false);assert.ok(r.link&&r.hidden);
    }],
    ['janelas por dia limitam encaixe e sobrevivem no backup', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const day=add(today,1),d=ds(day),weekday=day.getDay();S.events=[{id:'e',t:'Evento',d,h:'10:00',e:'10:30',c:'g'}];S.tasks=[];S.view='agenda';S.mode='day';S.dy=1;render();const f=document.querySelector('#availability-form');if(!f)return null;f.elements.day.value=String(weekday);f.elements.start.value='10:00';f.elements.end.value='11:00';f.requestSubmit();const first=autoSlot(d,30),large=autoSlot(d,45),data=pick();return {first,large,windows:data.availability,valid:validBackup({...data,tasks:[],events:[]})}})()`);assert.ok(r);assert.strictEqual(r.first,'10:30');assert.strictEqual(r.large,null);assert.ok(r.valid);assert.ok(r.windows);
    }],
    ['modelo de tarefa gera instâncias e etapas independentes', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[];S.view='tarefas';render();let f=document.querySelector('#task-template');if(!f)return null;f.elements.template.value='viagem';f.elements.date.value='2030-02-20';f.requestSubmit();f=document.querySelector('#task-template');f.elements.template.value='viagem';f.requestSubmit();return S.tasks.map(t=>({id:t.id,due:t.due,sub:t.sub}))})()`);assert.ok(r&&r.length===2);assert.notStrictEqual(r[0].id,r[1].id);assert.ok(r[0].sub.length>0);assert.notStrictEqual(r[0].sub[0].id,r[1].sub[0].id);assert.ok(r.some(t=>t.due==='2030-02-20'));
    }],
    ['disponibilidade valida janelas e preserva mescla e prazo relativo', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.view='agenda';render();let f=document.querySelector('#availability-form');f.elements.day.value='2';f.elements.start.value='09:00';f.elements.end.value='10:00';f.requestSubmit();f=document.querySelector('#availability-form');f.elements.day.value='2';f.elements.start.value='09:30';f.elements.end.value='11:00';f.requestSubmit();const count=S.availability['2'].length;const d={...pick(),availability:{2:[{id:'a',start:'09:00',end:'10:00'},{id:'b',start:'09:30',end:'11:00'}]}};const valid=validBackup(d);S.view='tarefas';render();f=document.querySelector('#task-template');f.elements.offset.value='7';f.requestSubmit();return {count,valid,due:S.tasks[0].due,expected:ds(add(today,7))}})()`);assert.strictEqual(r.count,1);assert.ok(r.valid);assert.strictEqual(r.due,r.expected);
    }],
    ['notas arquivadas mantêm ligações e podem ser abertas diretamente', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{noteReset();S.notes=[{id:'n',t:'Decisão',b:'texto',f:'',g:'',c:'p'}];S.tasks=[{id:'t',t:'Tarefa'}];S.lnk=[];lkSet('tk:t','nt:n',true);S.view='notas';render();document.querySelector('[data-a=note-archive]').click();const hidden=!document.querySelector('[data-lid="nt:n"]'),link=lkOf('tk:t').includes('nt:n');lkGo('nt:n');render();const opened=!!document.querySelector('[data-lid="nt:n"]'),status=document.querySelector('#note-status').value;document.querySelector('[data-a=note-archive]').click();return {hidden,link,opened,status,restored:!S.notes[0].archived}})()`);
      assert.ok(r.hidden&&r.link&&r.opened&&r.restored);assert.strictEqual(r.status,'archived');
    }],
    ['duplicar e revisitar mantêm conteúdo e não copiam ligações', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{noteReset();S.notes=[{id:'n',t:'Plano',b:'<b>Texto</b>',f:'',g:'ideia',c:'p'}];S.tasks=[{id:'t',t:'Tarefa'}];S.lnk=[];lkSet('tk:t','nt:n',true);S.view='notas';render();document.querySelector('[data-a=note-revisit]').click();document.querySelector('[data-a=note-copy]').click();const c=S.notes[0],original=S.notes.find(x=>x.id==='n');c.b='Outro texto';const filter=document.querySelector('#note-status');filter.value='revisit';filter.dispatchEvent(new Event('change',{bubbles:true}));return {original:original.b,marked:original.revisit,copy:c.id,links:lkOf('nt:'+c.id).length,found:!!document.querySelector('[data-lid="nt:n"]'),copyHidden:!document.querySelector('[data-lid="nt:'+c.id+'"]')}})()`);
      assert.strictEqual(r.original,'<b>Texto</b>');assert.ok(r.marked&&r.found&&r.copyHidden);assert.strictEqual(r.links,0);
      await open();assert.strictEqual(await ev("S.notes.find(n=>n.id==='n').revisit"),true);
    }],
    ['ordenação respeita edição e identifica notas antigas sem data', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{noteReset();S.notes=[{id:'old',t:'Antiga',b:'',c:'p'},{id:'new',t:'Nova',b:'',c:'p',updatedAt:1000}];S.view='notas';render();const order=nList().map(n=>n.id),text=document.querySelector('[data-lid="nt:old"]').innerText,i=document.querySelector('[data-n=old][data-f=t]');i.value='Editada';i.dispatchEvent(new Event('input',{bubbles:true}));return {order,text,updated:S.notes[0].updatedAt,now:nList()[0].id}})()`);
      assert.deepStrictEqual(r.order,['new','old']);assert.match(r.text,/Sem data de edição/);assert.ok(r.updated>1000);assert.strictEqual(r.now,'old');
    }],
    ['novas cores de notas mantêm contraste no tema claro e escuro', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'n',t:'Ideia',b:'',f:'',g:'',c:'peach'}];S.view='notas';const out=[];for(const mode of ['light','dark']){S.themeMode=mode;applyTheme();render();for(const color of ['peach','mint','lavender','sand','rose','sky','lemon','sage']){const s=document.querySelector('[data-note-color=n]');s.value=color;s.dispatchEvent(new Event('change',{bubbles:true}));const card=document.querySelector('[data-lid="nt:n"]'),parse=x=>x.match(/\\d+(?:\\.\\d+)?/g).slice(0,3).map(Number),lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0),bg=lum(parse(getComputedStyle(card).backgroundColor)),fg=lum(parse(getComputedStyle(card).color));out.push((Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05))}}return out})()`);
      assert.strictEqual(r.length,16);assert.ok(r.every(x=>x>=4.5),JSON.stringify(r));
    }],
    ['cores de notas e listas são escolhidas e permanecem ao recarregar', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'n',t:'Ideia',b:'Texto',f:'',g:'',c:'p'},{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[]}];S.view='notas';render();const draft=document.querySelector('[data-shopping-form] [name=t]');draft.value='Feijão';let s=document.querySelector('[data-note-color=n]');const options=[...s.options].map(x=>x.value);s.value='peach';s.dispatchEvent(new Event('change',{bubbles:true}));s=document.querySelector('[data-note-color=l]');s.value='mint';s.dispatchEvent(new Event('change',{bubbles:true}));return {options,n:S.notes[0].c,l:S.notes[1].c,draft:draft.value,bg:getComputedStyle(document.querySelector('[data-lid="nt:n"]')).backgroundColor}})()`);
      assert.strictEqual(r.options.length,12);assert.strictEqual(r.n,'peach');assert.strictEqual(r.l,'mint');assert.strictEqual(r.draft,'Feijão');assert.notStrictEqual(r.bg,'rgba(0, 0, 0, 0)');
      await open();const colors=await ev('S.notes.map(n=>n.c)');assert.deepStrictEqual(colors,['peach','mint']);
    }],
    ['orçamentos em reais preservam os meses anteriores', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.bud={Alimentação:500};S.fin.budHist={};S.view='financas';S.fvw='mes';S.ftab='orc';S.fmo=0;render();const f=document.querySelector('#fbud');f.elements.cat.value='Alimentação';f.elements.v.value='1.200,00';f.requestSubmit();const cur=T.slice(0,7),previous=addM(T,-1).slice(0,7),next=addM(T,1).slice(0,7);return {past:budgetsAt(previous).Alimentação,cur:budgetsAt(cur).Alimentação,next:budgetsAt(next).Alimentação,valid:validBackup({tasks:[],events:[],fin:S.fin})}})()`);
      assert.strictEqual(r.past,500);assert.strictEqual(r.cur,1200);assert.strictEqual(r.next,1200);assert.strictEqual(r.valid,true);
    }],
    ['conta vinculada a recorrência não pode ser excluída', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.acc=[{id:'a',n:'A',ty:'cc',ini:0},{id:'b',n:'B',ty:'cc',ini:0}];S.fin.tx=[];S.fin.rec=[{id:'r',t:'Aluguel',k:'out',v:100,day:31,ini:ds(add(today,1)),ac:'b'}];S.view='financas';S.fvw='mes';S.ftab='contas';render();document.querySelector('[data-a=delacc][data-id=b]').click();return S.fin.acc.some(x=>x.id==='b')})()`);
      assert.ok(r);
    }],
    ['duplicatas no mesmo CSV exigem escolha', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.tx=[];IMP={hdr:true,inv:false,ac:'main',df:'dmy',map:{d:0,t:1,v:2},rows:[['data','desc','valor'],[T,'Café','-10'],[T,'Café','-10']]};return impRows().rows.map(x=>x.dup)})()`);
      assert.deepStrictEqual(r,[false,true]);
    }],
    ['conciliação marca e filtra lançamentos sem alterar saldo', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.tx=[{id:'x',k:'out',t:'Mercado',v:20,cat:'Alimentação',d:T,ac:'main'}];S.view='financas';S.fvw='mes';S.ftab='lanc';render();const before=bal(S.fin.acc[0]),c=document.querySelector('[data-tx-checked=x]');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));const f=document.querySelector('[data-reconcile-filter]');f.value='pending';f.dispatchEvent(new Event('change',{bubbles:true}));return {checked:S.fin.tx[0].checked,before,after:bal(S.fin.acc[0]),visible:!!document.querySelector('[data-tx-checked=x]')}})()`);
      assert.strictEqual(r.checked,true);assert.strictEqual(r.before,r.after);assert.strictEqual(r.visible,false);
    }],
    ['associação de transferência antiga não duplica movimento e respeita restante', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.acc=[{id:'a',n:'Conta',ty:'cc',ini:0},{id:'c',n:'Cartão',ty:'card',close:28,due:10,ini:0}];S.fin.tx=[];S.view='financas';S.fvw='mes';S.ftab='contas';S.fmo=0;const iv=invoice(S.fin.acc[1]);S.fin.tx=[{id:'buy',k:'out',t:'Compra',v:100,cat:'Outros',d:iv.end,ac:'c'},{id:'old',k:'tr',t:'Pagamento',v:40,d:T,ac:'a',to:'c'}];render();const f=document.querySelector('[data-invoice-link]');f.elements.confirm.checked=true;f.requestSubmit();return {count:S.fin.tx.length,invoice:S.fin.tx[1].invoice,left:invoice(S.fin.acc[1]).left,end:iv.end}})()`);
      assert.strictEqual(r.count,2);assert.strictEqual(r.invoice,r.end);assert.strictEqual(r.left,60);
    }],
    ['edição de cartão exige confirmação e protege pagamentos vinculados', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.acc=[{id:'main',n:'Conta',ty:'cc',ini:0},{id:'c',n:'Cartão',ty:'card',close:28,due:10,lim:500,ini:0}];S.fin.tx=[{id:'pay',k:'tr',t:'Pagamento',v:20,d:T,ac:'main',to:'c',invoice:T.slice(0,7)+'-28'}];S.view='financas';S.fvw='mes';S.ftab='contas';render();let f=document.querySelector('[data-acc-edit=c]');f.elements.due.value='12';f.requestSubmit();const before=S.fin.acc[1].due;f.elements.confirm.checked=true;f.requestSubmit();const after=S.fin.acc[1].due;f=document.querySelector('[data-acc-edit=c]');f.elements.close.value='20';f.elements.confirm.checked=true;f.requestSubmit();return {before,after,close:S.fin.acc[1].close}})()`);
      assert.strictEqual(r.before,10);assert.strictEqual(r.after,12);assert.strictEqual(r.close,28);
    }],
    ['parcelas futuras e média variável não duplicam gastos do cartão', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.acc=[{id:'main',n:'Conta',ty:'cc',ini:1000},{id:'c',n:'Cartão',ty:'card',close:28,due:10,ini:0}];S.fin.rec=[];S.fin.bills=[];S.fac='';S.fin.tx=[{id:'past',k:'out',t:'Cartão',v:600,cat:'Outros',d:ds(add(today,-1)),ac:'c'},{id:'p',k:'out',t:'Notebook',v:100,cat:'Outros',d:ds(add(today,30)),ac:'c',pc:{g:'p1',i:2,n:3}},{id:'p2',k:'out',t:'Notebook',v:100,cat:'Outros',d:ds(add(today,60)),ac:'c',pc:{g:'p1',i:3,n:3}}];return {avg:cashFlow({days:90,fac:'',vary:true}).avg,html:installmentsPanel()}})()`);
      assert.strictEqual(r.avg,0);assert.match(r.html,/Notebook/);assert.match(r.html,/200,00/);
    }],
    ['relatório anual usa a mesma média mensal da tela', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.acc=[{id:'main',n:'Conta',ty:'cc',ini:0}];S.fac='';S.fyr=0;S.fin.tx=[{id:'x',k:'out',t:'Compra',cat:'Lazer',v:120,d:T,ac:'main'}];S.view='financas';S.fvw='ano';render();let csv='';const old=siteSave;siteSave=(n,c)=>{csv=c};exportYear();siteSave=old;return {csv,text:document.querySelector('#main').innerText}})()`);
      assert.match(r.csv,/"Lazer";"120,00";"120,00"/);assert.match(r.text,/Média por mês com movimento/);
    }],
    ['fatura registra pagamento parcial por ciclo e impede valor maior que o restante', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.acc=[{id:'a',n:'Conta',ty:'cc',ini:500},{id:'c',n:'Cartão',ty:'card',close:28,due:10,ini:0}];S.fin.tx=[];S.fac='';S.fmo=0;S.view='financas';S.fvw='mes';S.ftab='contas';const iv=invoice(S.fin.acc[1]);S.fin.tx.push({id:'buy',k:'out',t:'Compra',v:100,cat:'Outros',d:iv.end,ac:'c'});render();payInv('c');let f=document.querySelector('#ffin');f.elements.v.value='40';f.requestSubmit();let after=invoice(S.fin.acc[1]);render();payInv('c');f=document.querySelector('#ffin');const suggested=f.elements.v.value;f.elements.v.value='70';f.requestSubmit();const rejected=invoice(S.fin.acc[1]).paid;render();payInv('c');f=document.querySelector('#ffin');f.requestSubmit();return {paid:after.paid,left:after.left,suggested,rejected,finished:invoice(S.fin.acc[1]).left,count:S.fin.tx.filter(t=>t.invoice===iv.end).length}})()`);
      assert.strictEqual(r.paid,40);assert.strictEqual(r.left,60);assert.strictEqual(r.suggested,'60.00');assert.strictEqual(r.rejected,40);assert.strictEqual(r.finished,0);assert.strictEqual(r.count,2);
    }],
    ['resumo financeiro distingue futuro e projeção por conta não inclui faturas sem origem', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.acc=[{id:'a',n:'Conta A',ty:'cc',ini:100},{id:'b',n:'Conta B',ty:'cc',ini:100},{id:'c',n:'Cartão',ty:'card',close:28,due:10,ini:0}];S.fin.rec=[];S.fin.bills=[{id:'bill',n:'Sem conta',v:20,day:Math.min(28,today.getDate()+1)}];const tomorrow=ds(add(today,1)),iv=invoice(S.fin.acc[2]);S.fin.tx=[{id:'future',k:'in',t:'Salário',v:1000,cat:'Receita',d:tomorrow,ac:'a'},{id:'buy',k:'out',t:'Compra',v:50,cat:'Outros',d:iv.end,ac:'c'}];S.view='financas';S.fvw='mes';S.fmo=0;S.fac='a';render();const text=document.querySelector('#main').innerText,c=cashFlow({days:90,fac:'a',vary:false});return {text,events:c.evs}})()`);
      assert.match(r.text,/inclui agendadas/);assert.match(r.text,/Até hoje/);assert.ok(!r.events.some(x=>x.k==='card'||x.k==='bill'));
    }],
    ['importação permite revisar cada duplicata e mantém descrições diferentes', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.tx=[{id:'old',k:'out',t:'Mercado compra longa A',v:10,d:T,ac:'main'}];IMP={name:'teste.csv',hdr:true,inv:false,ac:'main',df:'dmy',map:{d:0,t:1,v:2},rows:[['data','descrição','valor'],[T,'Mercado compra longa A','-10'],[T,'Mercado compra longa B','-10'],['inválida','Erro','-1']]};S.view='financas';S.fvw='mes';S.ftab='regras';render();const before=impRows(),c=document.querySelector('[data-imp-include]');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-a=impgo]').click();return {before,count:S.fin.tx.length}})()`);
      assert.strictEqual(r.before.rows[0].dup,true);assert.strictEqual(r.before.rows[1].dup,false);assert.deepStrictEqual(r.before.bad,[4]);assert.strictEqual(r.count,3);
    }],
    ['recorrência cria lembrete ligado sem duplicar previsão', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.rec=[];S.fin.bills=[];S.events=[];S.fin.tx=[];S.fin.acc=[{id:'main',n:'Conta',ty:'cc',ini:0}];S.fac='';S.view='financas';S.fvw='mes';S.ftab='contas';render();const f=document.querySelector('#frec');f.elements.t.value='Internet';f.elements.v.value='50';f.elements.day.value='28';f.elements.reminder.checked=true;f.requestSubmit();const rec=S.fin.rec[0],bill=S.fin.bills[0],ev=S.events.find(x=>x.id===bill.eid),flow=cashFlow({days:90,fac:'',vary:false});return {linked:bill.rec===rec.id,event:!!ev,duplicate:flow.evs.some(x=>x.k==='bill'&&x.t==='Internet')}})()`);
      assert.ok(r.linked);assert.ok(r.event);assert.strictEqual(r.duplicate,false);
    }],
    ['campo de data da agenda tem espaço para texto ampliado', async () => {
      await fresh();await login('A');await b.send('Emulation.setDeviceMetricsOverride',{width:375,height:720,deviceScaleFactor:1,mobile:true});
      try{const r=await ev(`(()=>{document.documentElement.style.fontSize='200%';S.view='agenda';render();const f=document.querySelector('#fev input[type=date]');return {width:f.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}})()`);assert.ok(r.width>=280,JSON.stringify(r));assert.strictEqual(r.overflow,0)}finally{await ev("document.documentElement.style.fontSize=''");await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['rótulos da navegação mobile permanecem legíveis com fonte ampliada', async () => {
      await fresh();await login('A');await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});
      try{const bad=await ev(`(()=>{document.documentElement.style.fontSize='200%';S.menu=menuDef();S.view='hoje';render();return [...document.querySelectorAll('#mobile-bar .nav')].map(b=>{const span=b.querySelector('span');return {name:b.textContent.trim(),missing:!span,wide:span&&span.scrollWidth-span.clientWidth,high:span&&span.scrollHeight-span.clientHeight}}).filter(x=>x.missing||x.wide>1||x.high>1)})()`);assert.deepStrictEqual(bad,[])}finally{await ev("document.documentElement.style.fontSize=''");await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['textos da agenda semanal acompanham ampliação da fonte', async () => {
      await fresh();await login('A');await b.send('Emulation.setDeviceMetricsOverride',{width:375,height:720,deviceScaleFactor:1,mobile:true});
      try{const r=await ev(`(()=>{S.events=[{id:'font-event',t:'Consulta',d:T,h:'10:00',e:'11:00',c:'g'}];S.view='agenda';S.mode='week';S.wk=0;render();const get=()=>({heading:parseFloat(getComputedStyle(document.querySelector('.day.today h3')).fontSize),date:parseFloat(getComputedStyle(document.querySelector('.day.today h3 small')).fontSize),event:parseFloat(getComputedStyle(document.querySelector('.day .ev')).fontSize)});document.documentElement.style.fontSize='100%';const normal=get();document.documentElement.style.fontSize='200%';return {normal,large:get()}})()`);assert.ok(r.normal.heading>=14&&r.normal.date>=14&&r.normal.event>=14);assert.ok(r.large.heading>=r.normal.heading*2&&r.large.date>=r.normal.date*2&&r.large.event>=r.normal.event*2)}finally{await ev("document.documentElement.style.fontSize=''");await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['conteúdo extenso permanece dentro da tela em temas e densidades', async () => {
      await fresh(); await login('A');await ev('exLoad()');
      try {
        for(const width of [320,375]){await b.send('Emulation.setDeviceMetricsOverride',{width,height:720,deviceScaleFactor:1,mobile:true});
          const failures=await ev(`(()=>{const title='Planejamento de documentação e acompanhamento dos compromissos familiares',url='https://servicos.exemplo.com.br/organizacao/documentos-e-acompanhamento-de-compromissos';S.tasks=[{id:'long-task',t:title,done:false,hd:T}];S.links=[{id:'long-link',n:title,u:url,c:'g'}];S.notes=[{id:'long-note',t:title,b:title,c:'g'}];S.metas=[{id:'long-goal',t:title,ini:T,kr:[]}];const bad=[];for(const theme of ['light','dark'])for(const density of ['conf','compacto'])for(const size of ['100%','200%']){document.documentElement.style.fontSize=size;S.themeMode=theme;S.dens=density;applyTheme();for(const view of ['hoje','tarefas','links','notas','metas']){S.view=view;render();const overflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;if(overflow>1)bad.push({view,theme,density,size,overflow})}}return bad})()`);
          assert.deepStrictEqual(failures,[],`transbordamento em ${width}px`);
        }
      } finally {await ev("document.documentElement.style.fontSize=''");await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['telas com exemplos não ultrapassam viewport nas larguras e fontes verificadas', async () => {
      await fresh(); await login('A'); await ev('exLoad()');
      try {
        for(const width of [320,375,430,1280]){
          await b.send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:width<500});
          const bad=await ev(`(()=>{const bad=[];for(const size of ['100%','200%']){document.documentElement.style.fontSize=size;for(const view of Object.keys(V)){S.view=view;render();const overflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;if(overflow>1)bad.push({size,view,overflow})}}return bad})()`);
          assert.deepStrictEqual(bad,[],`transbordamento em ${width}px`);
        }
      } finally {await ev("document.documentElement.style.fontSize=''");await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['formulários permanecem na tela com texto ampliado', async () => {
      await fresh(); await login('A');
      await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
      try {
        const r=await ev(`(()=>{document.documentElement.style.fontSize='200%';S.ftab='contas';const bad=[];for(const view of ['metas','financas','leituras']){S.view=view;render();const overflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;if(overflow>1)bad.push({view,overflow})}return bad})()`);
        assert.deepStrictEqual(r,[]);
      } finally {await ev("document.documentElement.style.fontSize=''");await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['barra mobile com nomes longos não cobre fim da página', async () => {
      await fresh(); await login('A');
      await b.send('Emulation.setDeviceMetricsOverride',{width:304,height:640,deviceScaleFactor:1,mobile:true});
      try {
        for(const size of ['100%','200%']){
          const r=await ev(`(()=>{document.documentElement.style.fontSize='${size}';S.menu=menuDef();S.menu.bar=['avisos','tarefas','leituras','financas','menu'];S.view='hoje';render();window.scrollTo(0,document.documentElement.scrollHeight);const bar=document.querySelector('#mobile-bar').getBoundingClientRect(),main=document.querySelector('#main').getBoundingClientRect();return {bar:bar.top,end:main.bottom}})()`);
          assert.ok(r.end<=r.bar, 'conteúdo final deve ficar acima da barra com fonte '+size);
        }
      } finally {await ev("document.documentElement.style.fontSize=''");await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['agenda diária oferece ações acessíveis para eventos curtos e simultâneos', async () => {
      await fresh(); await login('A');
      await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
      try {
        const r=await ev(`(()=>{S.events=[{id:'short1',t:'Consulta breve',d:T,h:'10:00',e:'10:15',c:'g'},{id:'short2',t:'Ligação',d:T,h:'10:00',e:'10:15',c:'b'}];S.tasks=[{id:'block1',t:'Estudar',done:false,dur:15,bk:{d:T,h:'10:00'}}];S.view='agenda';S.mode='day';S.dy=0;render();const details=document.querySelector('.day-actions');if(!details)return null;details.open=true;const rows=[...details.querySelectorAll('[data-day-action]')].map(row=>({id:row.dataset.dayAction,text:row.innerText,buttons:[...row.querySelectorAll('button')].map(b=>{const x=b.getBoundingClientRect();return {action:b.dataset.a,w:x.width,h:x.height}})}));const overflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;details.querySelector('[data-a=ed][data-id=short1]').click();const edited=ED&&ED.id;S.view='agenda';S.mode='day';render();const list=document.querySelector('.day-actions');list.open=true;list.querySelector('[data-a=unbk][data-id=block1]').click();return {rows,overflow,edited,unbooked:!S.tasks[0].bk}})()`);
        assert.ok(r,'lista de ações ausente');assert.strictEqual(r.edited,'short1');assert.ok(r.unbooked);assert.strictEqual(r.overflow,0);assert.deepStrictEqual(r.rows.map(x=>x.id),['short1','short2','block1']);for(const row of r.rows){for(const b of row.buttons)assert.ok(b.w>=44&&b.h>=44,row.id+' com alvo pequeno');assert.ok(row.buttons.some(b=>b.action===(row.id==='block1'?'unbk':'ed')))}
      } finally {await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['ações de links e eventos semanais têm alvos de toque separados', async () => {
      await fresh(); await login('A');
      await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
      try {
        const r=await ev(`(()=>{S.links=[{id:'link-grid',n:'Link de exemplo',u:'https://example.com',c:'g'}];S.events=[{id:'event-grid',t:'Compromisso',d:T,h:'10:00',e:'11:00',c:'g'}];const out=[];for(const view of ['links','agenda']){S.view=view;S.mode='week';S.wk=0;render();const parent=document.querySelector(view==='links'?'.link':'.day .ev');if(!parent){out.push({view,missing:true});continue}const buttons=[...parent.querySelectorAll('button.x')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});out.push({view,buttons})}return out})()`);
        for(const {view,buttons,missing} of r){assert.ok(!missing,view+' sem cartão');for(const b of buttons){assert.ok(b.w>=44&&b.h>=44,view+' com alvo pequeno');}for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,view+' com ações sobrepostas')}}
      } finally {await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['componentes compartilhados usam espaçamento da grade em celular e desktop', async () => {
      await fresh(); await login('A');
      try {
        for(const width of [375,1280]){
          await b.send('Emulation.setDeviceMetricsOverride',{width,height:812,deviceScaleFactor:1,mobile:width<500});
          const r=await ev(`(()=>{S.tasks=[{id:'grid',t:'Preparar',hd:T,done:false}];S.view='hoje';render();const item=document.querySelector('#main .item'),input=document.querySelector('#finbox input'),panel=document.querySelector('#main .panel');return {gap:getComputedStyle(item).gap,padding:getComputedStyle(panel).paddingTop,inputFont:getComputedStyle(input).fontSize,button:getComputedStyle(document.querySelector('#finbox button')).minHeight}})()`);
          assert.strictEqual(r.gap,'8px');assert.strictEqual(r.padding,'16px');assert.strictEqual(r.inputFont,'16px');assert.ok(parseFloat(r.button)>=44);
        }
      } finally {await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['sequência semanal considera virada e nova frequência sem mudar histórico', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const ot=today,oldT=T;try{today=new Date(2026,10,23,12);T=ds(today);const log={'2026-11-16':1,'2026-11-18':1,'2026-11-20':1,'2026-11-09':1,'2026-11-11':1};const h={n:'Caminhar',perWeek:3,log},before=JSON.stringify(log),three=habitInfo(h);h.perWeek=2;return {three,two:habitInfo(h),same:before===JSON.stringify(log)}}finally{today=ot;T=oldT}})()`);
      assert.match(r.three,/1 semana seguida/);assert.match(r.two,/2 semanas seguidas/);assert.ok(r.same);
    }],
    ['contexto da meta oculta item removido e o recupera sem cópias', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.metas=[{id:'m',t:'Viagem',ini:T,kr:[]}];S.tasks=[];S.notes=[{id:'n',t:'Roteiro',b:'',g:'',c:'p'}];S.lnk=[];lkSet('mt:m','nt:n',true);const note=S.notes[0];S.notes=[];const removed=metaCard(S.metas[0]);S.notes=[note];return {removed,restored:metaCard(S.metas[0]),count:S.notes.length}})()`);
      assert.doesNotMatch(r.removed,/Roteiro/);assert.match(r.restored,/Roteiro/);assert.strictEqual(r.count,1);
    }],
    ['alerta de saldo previsto aparece com poucos lançamentos e informa escopo', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const F=finInit();F.acc=[{id:'a',n:'Principal',ty:'cc',ini:100}];F.tx=[{id:'expense',t:'Conta',k:'out',v:200,d:ds(add(today,1)),ac:'a'}];F.rec=[];F.bills=[];S.rem={on:true,fat:true,tk:false,hab:false};return attention().find(x=>x.k==='sal')||null})()`);
      assert.ok(r,'alerta não deve depender de cinco lançamentos');assert.match(r.t,/previsto/i);assert.match(r.s,/14 dias/i);assert.match(r.s,/todas as contas/i);
    }],
    ['previsão considera transferências e saldo negativo até o recebimento', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const F=finInit(),d1=ds(add(today,1)),d2=ds(add(today,2));F.acc=[{id:'a',n:'Principal',ty:'cc',ini:100},{id:'b',n:'Outra',ty:'cc',ini:500}];F.primary='a';F.rec=[];F.bills=[];F.tx=[{id:'salary',t:'Receita',k:'in',v:500,d:d2,ac:'a'},{id:'transfer',t:'Transferência',k:'tr',v:200,d:d1,ac:'a',to:'b'},{id:'future',t:'Transferência no dia',k:'tr',v:50,d:d2,ac:'b',to:'a'}];return nextIncomePanel()})()`);
      assert.match(r,/-\s*R\$\s*100,00|R\$\s*-\s*100,00/);
    }],
    ['Hoje e Início separam hábitos diários de metas semanais cumpridas', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const previous=today,old=T;try{today=new Date(2026,10,18,12);T=ds(today);S.habits=[{id:'d1',n:'Água',log:{[T]:1}},{id:'d2',n:'Sono',log:{}},{id:'w',n:'Caminhar',perWeek:3,log:{'2026-11-16':1,'2026-11-17':1,[T]:1}}];S.rem={on:true,hh:'00:00',hab:true,tk:false,fat:false};S.view='dash';render();const home=document.querySelector('.hero2').innerText;S.view='hoje';render();return {home,day:document.querySelector('#main').innerText,alerts:attention().filter(x=>x.k==='hb').map(x=>x.t)}}finally{today=previous;T=old}})()`);for(const text of [r.home,r.day]){assert.match(text,/Hábitos diários/i);assert.match(text,/1\s*\/\s*2/);assert.match(text,/1 de 1 meta semanal cumprida/i)}assert.strictEqual(r.alerts.length,1);assert.match(r.alerts[0],/1 hábito/);
    }],
    ['hábitos somente semanais não produzem meta diária fictícia', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.habits=[{id:'w',n:'Caminhar',perWeek:3,log:{}}];S.view='dash';render();const home=document.querySelector('.hero2').innerText;S.view='hoje';render();return {home,day:document.querySelector('#main').innerText}})()`);for(const text of [r.home,r.day]){assert.match(text,/Hábitos diários/i);assert.match(text,/nenhum hábito diário/i);assert.match(text,/0 de 1 meta semanal cumprida/i)}
    }],
    ['atenção deduplica tarefa e abre conflito na data correta', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Pendente',done:false,due:T,hd:T}];const tomorrow=ds(add(today,1));S.events=[{id:'a',t:'Consulta',d:tomorrow,h:'10:00',e:'11:00',c:'g'},{id:'b',t:'Reunião',d:tomorrow,h:'10:30',e:'11:30',c:'b'},{id:'c',t:'Sem término',d:tomorrow,h:'10:45',e:'',c:'p'}];S.rem={on:true,tk:true,fat:false,hab:false};const L=attention();S.view='avisos';render();const btn=document.querySelector('[data-a=att-open][data-id=a]');if(!btn)return {L};btn.click();return {L,view:S.view,mode:S.mode,dy:S.dy}})()`);assert.strictEqual(r.L.filter(x=>x.k==='tk').length,1);assert.strictEqual(r.L.filter(x=>x.k==='conflict').length,1);assert.strictEqual(r.view,'agenda');assert.strictEqual(r.mode,'day');assert.strictEqual(r.dy,1);
    }],
    ['dispensar alerta até amanhã preserva tarefa e reaparece quando prazo muda', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'dismiss',t:'Pendente',done:false,due:T}];S.events=[];S.rem={on:true,tk:true,fat:false,hab:false};S.view='avisos';render();const b=document.querySelector('[data-a=att-dismiss]');if(!b)return null;b.click();const hidden=!attention().some(x=>x.k==='tk'),stored=JSON.parse(localStorage.getItem('hub-v1')).rem;S.tasks[0].due=ds(add(today,-1));return {hidden,stored,again:attention().some(x=>x.k==='tk'),task:S.tasks[0]}})()`);assert.ok(r&&r.hidden&&r.again);assert.ok(r.stored.dismiss);assert.strictEqual(r.task.done,false);
    }],
    ['prévia do lote invalida alterações e permite cancelar sem salvar', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'a',t:'Primeira',done:false},{id:'b',t:'Segunda',done:false}];S.view='tarefas';render();const f=document.querySelector('#bulk-plan');if(!f)return null;f.closest('details').open=true;f.querySelector('[value=a]').checked=true;f.elements.date.value='2030-01-05';f.querySelector('[data-a=bulk-preview]').click();f.querySelector('[value=b]').checked=true;f.querySelector('[data-a=bulk-apply]').click();const blocked=S.tasks.every(t=>!t.hd);f.querySelector('[data-a=bulk-cancel]').click();return {blocked,none:S.tasks.every(t=>!t.hd),closed:!f.closest('details').open}})()`);assert.ok(r&&r.blocked&&r.none&&r.closed);
    }],
    ['dispensa de atenção persiste após recarga e não altera tarefa', async () => {
      await fresh();await login('A');await ev(`(()=>{S.tasks=[{id:'keep',t:'Pendência',done:false,due:T}];S.events=[];S.rem={on:true,tk:true,fat:false,hab:false};S.view='avisos';render();document.querySelector('[data-a=att-dismiss]').click()})()`);await sleep(2300);await open();await waitFor('FB.on&&SYS.s==="ok"','recarga');const r=await ev(`(()=>({hidden:!attention().some(x=>x.k==='tk'),task:S.tasks.find(x=>x.id==='keep')}))()`);assert.ok(r.hidden);assert.strictEqual(r.task.done,false);assert.strictEqual(r.task.due,await ev('T'));
    }],
    ['alerta de conta fixa abre a origem em finanças', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const F=finInit(),d=ds(add(today,1));F.acc=[{id:'a',n:'Principal',ty:'cc',ini:100}];F.tx=[];F.rec=[];F.bills=[{id:'b',n:'Internet',v:10,day:+d.slice(8),ac:'a'}];S.events=[];S.rem={on:true,tk:false,fat:true,hab:false,fd:2};S.view='avisos';render();const b=document.querySelector('[data-a=att-open][data-kind=bill][data-id=b]');if(!b)return null;const text=b.closest('.item').innerText;b.click();return {text,view:S.view,tab:S.ftab,editing:BED}})()`);assert.ok(r);assert.match(r.text,/previsto/i);assert.match(r.text,/Principal/);assert.strictEqual(r.view,'financas');assert.strictEqual(r.tab,'contas');assert.strictEqual(r.editing,'b');
    }],
    ['prévia do lote detecta tarefa alterada antes da confirmação', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'a',t:'Primeira',done:false,due:'2030-01-10'}];S.view='tarefas';render();const f=document.querySelector('#bulk-plan');f.closest('details').open=true;f.querySelector('[value=a]').checked=true;f.elements.date.value='2030-01-05';f.querySelector('[data-a=bulk-preview]').click();S.tasks[0].due='2030-02-10';f.querySelector('[data-a=bulk-apply]').click();return {task:S.tasks[0],text:f.querySelector('[data-bulk-preview]').innerText}})()`);assert.strictEqual(r.task.hd,undefined);assert.strictEqual(r.task.due,'2030-02-10');assert.match(r.text,/revise novamente/i);
    }],
    ['dispensa expira quando o ano do prazo muda', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'d',t:'Pendente',done:false,due:'2024-01-01'}];S.events=[];S.rem={on:true,tk:true,fat:false,hab:false};S.view='avisos';render();document.querySelector('[data-a=att-dismiss]').click();S.tasks[0].due='2025-01-01';return attention().some(x=>x.k==='tk')})()`);assert.ok(r);
    }],
    ['alerta financeiro protege valores no modo privacidade', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const old=PRIV;try{S.fin.acc=[{id:'a',n:'Conta',ty:'cc',ini:-1234}];S.fin.tx=[];S.fin.bills=[];S.fin.rec=[];S.rem={on:true,fat:true,tk:false,hab:false};PRIV=true;const a=attention().find(x=>x.k==='sal');return a&&a.s}finally{PRIV=old}})()`);assert.ok(r);assert.doesNotMatch(r,/1\.234/);assert.match(r,/•••/);
    }],
    ['planejamento em lote exige prévia e desfaz tudo sem alterar prazos', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'a',t:'Primeira',done:false,due:'2030-01-10'},{id:'b',t:'Segunda',done:false,due:'2030-01-11'},{id:'r',t:'Recorrente',done:false,rc:'w'}];S.view='tarefas';render();undoReset();const f=document.querySelector('#bulk-plan');if(!f)return null;f.closest('details').open=true;f.querySelector('[value=a]').checked=true;f.querySelector('[value=b]').checked=true;f.elements.date.value='2030-01-05';f.requestSubmit();const before=S.tasks.map(t=>t.hd||'');const text=f.querySelector('[data-bulk-preview]').innerText,disabled=f.querySelector('[value=r]').disabled;f.querySelector('[data-a=bulk-apply]').click();const after=S.tasks.map(t=>({hd:t.hd||'',due:t.due||''}));undo();return {before,after,restored:S.tasks.map(t=>t.hd||''),text,disabled}})()`);assert.ok(r);assert.deepStrictEqual(r.before,['','','']);assert.match(r.text,/Primeira/);assert.ok(r.disabled);assert.deepStrictEqual(r.after.slice(0,2),[{hd:'2030-01-05',due:'2030-01-10'},{hd:'2030-01-05',due:'2030-01-11'}]);assert.deepStrictEqual(r.restored,['','','']);
    }],
    ['hábito semanal acompanha frequência e preserva registros ao mudar meta', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const week=add(today,-((today.getDay()+6)%7));S.habits=[{id:'h',n:'Caminhar',log:{[ds(week)]:1}}];S.view='habitos';render();let f=document.querySelector('[data-hfreq=h]');if(!f)return null;f.value='3';f.dispatchEvent(new Event('change',{bubbles:true}));const text=document.querySelector('#main').innerText;f=document.querySelector('[data-hfreq=h]');f.value='2';f.dispatchEvent(new Event('change',{bubbles:true}));return {text,habit:S.habits[0],date:ds(week)}})()`);
      assert.ok(r);assert.match(r.text,/1 de 3/);assert.strictEqual(r.habit.perWeek,2);assert.ok(r.habit.log[r.date]);
    }],
    ['hábito semanal concluído não aparece como pendência diária', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const d=ds(add(today,-((today.getDay()+6)%7)));S.habits=[{id:'h',n:'Caminhar',perWeek:1,log:{[d]:1}}];S.rem={on:true,hh:'00:00',hab:true,tk:false,fat:false};return {text:habitInfo(S.habits[0]),alerts:attention().filter(x=>x.k==='hb').length}})()`);
      assert.match(r.text,/1 de 1 nesta semana/);assert.strictEqual(r.alerts,0);
    }],
    ['frequência semanal e marcações sobrevivem à mesclagem e ao backup', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const base={habits:[{id:'h',n:'Caminhar',log:{}}]},local={habits:[{id:'h',n:'Caminhar',log:{},perWeek:3}]},remote={habits:[{id:'h',n:'Caminhar',log:{[T]:1}}]},m=merge3(base,local,remote,[]);return {habit:m.habits[0],valid:validBackup({tasks:[],events:[],habits:m.habits}),today:T}})()`);
      assert.strictEqual(r.habit.perWeek,3);assert.strictEqual(r.habit.log[r.today],1);assert.ok(r.valid);
    }],
    ['conta fixa pode ser vinculada a uma conta de pagamento', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const F=finInit();F.acc=[{id:'a',n:'Principal',ty:'cc',ini:1000}];S.view='financas';S.ftab='contas';render();const f=document.querySelector('#fbill');if(!f.elements.ac)return null;f.elements.n.value='Internet';f.elements.v.value='100';f.elements.day.value='25';f.elements.ac.value='a';f.requestSubmit();return F.bills[0]})()`);
      assert.ok(r);assert.strictEqual(r.ac,'a');
    }],
    ['conta principal é escolhida e mantida após recarregar', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.fin.acc=[{id:'a',n:'Conta A',ty:'cc',ini:0},{id:'b',n:'Conta B',ty:'cc',ini:0}];S.view='financas';S.ftab='contas';render();const b=document.querySelector('[data-a=primaryacc][data-id=b]');if(!b)return null;b.click();return {primary:S.fin.primary,stored:JSON.parse(localStorage.getItem('hub-v1')).fin.primary}})()`);
      assert.ok(r);assert.strictEqual(r.primary,'b');assert.strictEqual(r.stored,'b');await open();assert.strictEqual(await ev('S.fin.primary'),'b');
    }],
    ['previsão até recebimento usa conta principal e despesas até a data', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const F=finInit(),d1=ds(add(today,1)),d2=ds(add(today,2));F.acc=[{id:'a',n:'Principal',ty:'cc',ini:1000},{id:'b',n:'Outra',ty:'cc',ini:500}];F.primary='a';F.rec=[];F.bills=[];F.tx=[{id:'salary',t:'Salário',k:'in',v:2000,d:d2,ac:'a'},{id:'rent',t:'Conta',k:'out',v:200,d:d1,ac:'a'},{id:'bill',t:'Despesa',k:'out',v:100,d:d2,ac:'a'},{id:'other',t:'Outra conta',k:'out',v:900,d:d1,ac:'b'}];S.view='financas';S.ftab='geral';render();const text=document.querySelector('#main').innerText;return {text,d2}})()`);
      assert.match(r.text,/até o próximo recebimento/i);assert.match(r.text,/700,00/);assert.match(r.text,/não inclui faturas/i);
    }],
    ['previsão respeita data alterada de receita recorrente já lançada', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const F=finInit(),month=new Date(today.getFullYear(),today.getMonth()+1,1),p=ds(month).slice(0,7),d=n=>ds(new Date(month.getFullYear(),month.getMonth(),n));F.acc=[{id:'a',n:'Principal',ty:'cc',ini:1000}];F.primary='a';F.rec=[{id:'salary',t:'Salário',k:'in',v:2000,day:5,ini:T,ac:'a'}];F.bills=[];F.tx=[{id:'r_salary_'+p,t:'Salário remarcado',k:'in',v:2000,d:d(10),ac:'a'},{id:'other',t:'Receita antecipada',k:'in',v:500,d:d(8),ac:'a'},{id:'expense',t:'Despesa',k:'out',v:300,d:d(6),ac:'a'}];return {html:nextIncomePanel(),expected:fmt(d(8))}})()`);
      assert.match(r.html,/700,00/);assert.ok(r.html.includes(r.expected));
    }],
    ['previsão encontra próxima receita recorrente ainda não lançada', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const F=finInit();F.acc=[{id:'a',n:'Principal',ty:'cc',ini:1000}];F.primary='a';F.tx=[];F.bills=[];F.rec=[{id:'salary',t:'Salário',k:'in',v:2000,day:today.getDate(),ini:ds(add(today,1)),ac:'a'}];S.view='financas';S.ftab='geral';render();return document.querySelector('#main').innerText})()`);
      assert.match(r,/Estimativa antes de receber/);assert.match(r,/1\.000,00/);
    }],
    ['meta reúne tarefa e nota relacionadas sem duplicar dados', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.metas=[{id:'m',t:'Viagem',ini:T,kr:[]}];S.tasks=[{id:'t',t:'Reservar hotel',mt:'m',done:false}];S.notes=[{id:'n',t:'Roteiro',b:'',g:'',c:'p'}];S.lnk=[];lkSet('mt:m','nt:n',true);const before=metaCard(S.metas[0]);S.notes[0].t='Roteiro atualizado';const after=metaCard(S.metas[0]);lkSet('mt:m','nt:n',false);return {before,after,unlinked:metaCard(S.metas[0]),tasks:S.tasks.length,notes:S.notes.length}})()`);
      assert.match(r.before,/Reservar hotel/);assert.match(r.before,/Roteiro/);assert.match(r.after,/Roteiro atualizado/);assert.doesNotMatch(r.unlinked,/Roteiro atualizado/);assert.strictEqual(r.tasks,1);assert.strictEqual(r.notes,1);
    }],
    ['previsão não duplica recorrência já lançada ou conta vinculada', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const F=finInit(),d1=ds(add(today,2)),d2=ds(add(today,5));F.acc=[{id:'a',n:'Principal',ty:'cc',ini:1000}];F.primary='a';F.tx=[{id:'r_exp_'+d1.slice(0,7),t:'Internet',k:'out',v:100,d:d1,ac:'a'},{id:'salary',t:'Receita',k:'in',v:500,d:d2,ac:'a'}];F.rec=[{id:'exp',t:'Internet',k:'out',v:100,day:+d1.slice(8),ini:T,ac:'a'}];F.bills=[{id:'bill',n:'Internet',v:100,day:+d1.slice(8),ac:'a',rec:'exp'}];return nextIncomePanel()})()`);
      assert.match(r,/900,00/);assert.doesNotMatch(r,/800,00/);
    }],
    ['previsão pede conta e receita quando faltam dados', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const F=finInit();F.acc=[{id:'a',n:'Principal',ty:'cc',ini:0}];F.tx=[];F.rec=[];delete F.primary;const noAccount=nextIncomePanel();F.primary='a';return {noAccount,noIncome:nextIncomePanel()}})()`);
      assert.match(r.noAccount,/Escolha uma conta principal/);assert.match(r.noIncome,/Nenhuma receita futura/);
    }],
    ['saldo interpreta valores numéricos de backups antigos', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const F=finInit();F.acc=[{id:'a',n:'Conta',ty:'cc',ini:100}];F.tx=[{id:'income',t:'Receita',k:'in',v:'50',d:T,ac:'a'}];return bal(F.acc[0])})()`);
      assert.strictEqual(r,150);
    }],
    ['mede persistência ao receber atualização remota e editar offline', async () => {
      await fresh();await login('A');await waitFor('SYS.s==="ok"','sincronização inicial');
      const remote=await ev(`(async()=>{const data=JSON.parse(pickJSON());data.tasks.push({id:'remote-measure',t:'Remota',done:false});const rev=SY.rev+1;await DBr.doc(P+'hub-0').set({rev,i:0,s:JSON.stringify(data)});const set=Storage.prototype.setItem,soon=syncSoon,stringify=JSON.stringify,c={local:0,cloud:0,scheduled:0,serializations:0};Storage.prototype.setItem=function(k,v){if(k==='hub-v1')c.local++;if(k==='__cloud')c.cloud++;return set.call(this,k,v)};syncSoon=function(){c.scheduled++;return soon()};JSON.stringify=function(v,...args){if(v===S)c.serializations++;return stringify.call(this,v,...args)};try{const ok=await pullRemote({rev,n:1},false);await new Promise(r=>setTimeout(r,2300));return {ok,counts:c,received:S.tasks.some(t=>t.id==='remote-measure')}}finally{Storage.prototype.setItem=set;syncSoon=soon;JSON.stringify=stringify}})()`);
      assert.ok(remote.ok&&remote.received);console.log('  medição recebimento: '+JSON.stringify(remote.counts));
      await ev('localStorage.setItem("__offline","1")');await open();
      const offline=await ev(`(()=>{const set=Storage.prototype.setItem,soon=syncSoon,stringify=JSON.stringify,c={local:0,cloud:0,scheduled:0,serializations:0};Storage.prototype.setItem=function(k,v){if(k==='hub-v1')c.local++;if(k==='__cloud')c.cloud++;return set.call(this,k,v)};syncSoon=function(){c.scheduled++;return soon()};JSON.stringify=function(v,...args){if(v===S)c.serializations++;return stringify.call(this,v,...args)};try{S.tasks.push({id:'offline-measure',t:'Local',done:false});render();return c}finally{Storage.prototype.setItem=set;syncSoon=soon;JSON.stringify=stringify}})()`);
      assert.ok(offline.local>0);assert.strictEqual(offline.cloud,0);console.log('  medição offline: '+JSON.stringify(offline));
      await ev('localStorage.removeItem("__offline")');await open();await waitFor('FB.on&&SYS.s==="ok"','reconexão');assert.ok(await ev(`S.tasks.some(t=>t.id==='offline-measure')`));
    }],
    ['mede persistência ao navegar e editar', async () => {
      await fresh(); await login('A'); await waitFor('SYS.s==="ok"','sincronização inicial');
      const r=await ev(`(async()=>{const orig=Storage.prototype.setItem,soon=syncSoon,c={local:0,cloud:0,scheduled:0};Storage.prototype.setItem=function(k,v){if(k==='hub-v1')c.local++;if(k==='__cloud')c.cloud++;return orig.call(this,k,v)};syncSoon=function(){c.scheduled++;return soon()};try{S.view='hoje';render();await new Promise(r=>setTimeout(r,2300));const navigation={...c};S.tasks.push({id:'measure',t:'Teste',done:false});render();await new Promise(r=>setTimeout(r,2300));return {navigation,edit:{local:c.local-navigation.local,cloud:c.cloud-navigation.cloud,scheduled:c.scheduled-navigation.scheduled}}}finally{Storage.prototype.setItem=orig;syncSoon=soon}})()`);
      console.log('  medições de persistência: '+JSON.stringify(r));assert.strictEqual(r.navigation.cloud,0);assert.ok(r.edit.local>0);assert.ok(r.edit.cloud>0);
    }],
    ['captura offline exige data planejada e sobrevive à reconexão', async () => {
      await fresh(); await login('A');await ev('localStorage.setItem("__offline","1")');await open();
      const draft=await ev(`(()=>{qa('tk');const f=document.querySelector('#fqa');f.elements.t.value='Preparar offline';f.elements.dest.value='scheduled';f.elements.dest.dispatchEvent(new Event('change',{bubbles:true}));const missing=!f.checkValidity();f.elements.planned.value='2030-02-10';f.requestSubmit();return {missing,count:S.tasks.filter(x=>x.t==='Preparar offline').length,task:S.tasks.find(x=>x.t==='Preparar offline')}})()`);
      assert.ok(draft.missing);assert.strictEqual(draft.count,1);assert.strictEqual(draft.task.hd,'2030-02-10');await ev('localStorage.removeItem("__offline")');await open();await waitFor('FB.on&&SYS.s==="ok"','reconexão');
      const task=await ev(`S.tasks.find(x=>x.t==='Preparar offline')`);assert.ok(task);assert.strictEqual(task.hd,'2030-02-10');
    }],
    ['encaixe repetido não duplica bloco e usa duração padrão', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.tasks=[{id:'fit',t:'Planejar',hd:T,done:false,due:'2030-03-10'}];S.events=[];S.view='hoje';const original=autoSlot;let duration;autoSlot=(day,dur)=>{duration=dur;return '10:00'};try{render();document.querySelector('[data-a=fitday][data-id=fit]').click();const again=!!document.querySelector('[data-a=fitday][data-id=fit]');return {task:S.tasks[0],count:S.tasks.length,duration,again}}finally{autoSlot=original}})()`);
      assert.strictEqual(r.duration,30);assert.strictEqual(r.count,1);assert.strictEqual(r.task.bk.h,'10:00');assert.strictEqual(r.task.due,'2030-03-10');assert.strictEqual(r.again,false);
    }],
    ['percurso diário preserva captura, conclusão e revisão após recarga', async () => {
      await fresh(); await login('A');
      await ev(`(()=>{S.tasks=[];S.inbox=[];S.events=[];S.view='hoje';render();qa('tk');const f=document.querySelector('#fqa');f.elements.t.value='Preparar documento';f.elements.due.value='2030-01-20';f.elements.dest.value='today';f.requestSubmit();return true})()`);
      const created=await ev(`(()=>{const t=S.tasks.find(x=>x.t==='Preparar documento');return {id:t&&t.id,count:S.tasks.filter(x=>x.t==='Preparar documento').length,hd:t&&t.hd,due:t&&t.due,today:T}})()`);
      assert.strictEqual(created.count,1);assert.strictEqual(created.hd,created.today);assert.strictEqual(created.due,'2030-01-20');
      await ev(`(()=>{document.querySelector('[data-a=tog][data-id="${created.id}"]').click();const f=document.querySelector('#fhj');f.elements.t.value='Adiável';f.requestSubmit();const t=S.tasks.find(x=>x.t==='Adiável');document.querySelector('[data-a=snooze][data-id="'+t.id+'"]').click()})()`);
      await sleep(2300);await open();await waitFor('FB.on&&SYS.s==="ok"','sessão após recarga');
      const result=await ev(`(()=>{S.view='hoje';render();const t=S.tasks.find(x=>x.id===${JSON.stringify(created.id)}),review=revCard(),text=document.querySelector('#main').innerText;return {t,text,review,postponed:S.tasks.find(x=>x.t==='Adiável'),tomorrow:ds(add(today,1))}})()`);
      assert.strictEqual(result.postponed.due,result.tomorrow);assert.ok(result.t.done);assert.strictEqual(result.t.due,'2030-01-20');assert.match(result.text,/Concluídas hoje/);assert.match(result.review,/Concluídas: Preparar documento/);assert.doesNotMatch(result.review,/Pendentes agora: Preparar documento/);
    }],
    ['encaixe evita compromisso e informa quando não há horário', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{const date=ds(add(today,1));S.tasks=[];S.events=[{id:'e',t:'Compromisso',d:date,h:'08:00',e:'09:00',c:'g'}];const free=autoSlot(date,30);S.events[0].e='22:00';return {free,full:autoSlot(date,30)}})()`);
      assert.strictEqual(result.free,'09:00');assert.strictEqual(result.full,null);
    }],
    ['personalização do menu sobrevive à recarga', async () => {
      await fresh(); await login('A');
      const before=await ev(`(()=>{S.menu=menuDef();S.menu.bar=['tarefas','financas','menu'];S.menu.groups[0].n='Meu grupo';save();return JSON.stringify(S.menu)})()`);
      await sleep(2300);await open();await waitFor('FB.on&&SYS.s==="ok"','sessão após recarga');
      assert.strictEqual(await ev('JSON.stringify(S.menu)'),before);
    }],
    ['tarefa atrasada planejada para hoje aparece uma única vez', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.tasks=[{id:'late',t:'Enviar documento',done:false,due:ds(add(today,-1)),hd:T}];S.events=[];S.view='hoje';render();return document.querySelectorAll('#main [data-a=tog][data-id=late]').length})()`);
      assert.strictEqual(r,1);
    }],
    ['sugestões respeitam capacidade restante do dia', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.tasks=[{id:'busy',t:'Dia cheio',hd:T,dur:480,done:false},{id:'s',t:'Estudar',dur:30,done:false}];S.events=[];S.cap=8;S.view='hoje';render();return {shown:!!document.querySelector('[data-a=hide-suggestion][data-id=s]'),text:document.querySelector('#main').innerText}})()`);
      assert.strictEqual(r.shown,false);assert.match(r.text,/sem espaço para novas sugestões/i);
    }],
    ['sugestões podem ser dispensadas sem excluir tarefas', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.tasks=[{id:'s',t:'Estudar',done:false}];S.events=[];S.cap=8;S.view='hoje';const previous=autoSlot;autoSlot=()=> '10:00';try{render();const b=document.querySelector('[data-a=hide-suggestion][data-id=s]');if(!b)return null;b.click();return {exists:S.tasks.some(t=>t.id==='s'),shown:!!document.querySelector('[data-a=hide-suggestion][data-id=s]')}}finally{autoSlot=previous}})()`);
      assert.ok(r);assert.ok(r.exists);assert.strictEqual(r.shown,false);
    }],
    ['revisão informa pendências sem prazo', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.tasks=[{id:'p',t:'Comprar presente',done:false,due:''},{id:'d',t:'Feita',done:true,dd:T}];S.rw=0;S.revprefs={};return revCard()})()`);
      assert.match(r,/Comprar presente/);assert.match(r,/Feita/);assert.doesNotMatch(r,/atrasada/i);
    }],
    ['Hoje encaixa tarefa sem alterar seu prazo', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Preparar',p:'a',hd:T,due:'2030-01-20',done:false}];S.events=[];S.view='hoje';render();const button=document.querySelector('[data-a=fitday][data-id=t]');if(!button)return null;const previous=autoSlot;autoSlot=()=> '10:00';button.click();autoSlot=previous;return S.tasks[0]})()`);
      assert.ok(r,'Hoje deve oferecer encaixe');assert.strictEqual(r.bk.d,await ev('T'));assert.strictEqual(r.bk.h,'10:00');assert.strictEqual(r.due,'2030-01-20');
    }],
    ['resumo destaca próxima tarefa planejada sem alterar cartões escolhidos', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.tasks=[{id:'p',t:'Enviar documento',p:'a',hd:T,done:false},{id:'x',t:'Outra tarefa',p:'b',done:false}];S.cards=['fin'];S.view='dash';render();return {text:document.querySelector('.hero2').innerText,cards:S.cards}})()`);
      assert.match(r.text,/Enviar documento/);assert.deepStrictEqual(r.cards,['fin']);
    }],
    ['nova compra não herda valor de captura anterior', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'s',kind:'shopping',t:'Mercado',items:[],b:'',c:'p'}];S.view='notas';render();qa('dp');document.querySelector('#fqa [name=v]').value='999';document.querySelector('[data-a=shopping-expense][data-id=s]').click();return {value:document.querySelector('#fqa [name=v]').value,title:document.querySelector('#fqa [name=t]').value}})()`);
      assert.strictEqual(r.value,'');assert.match(r.title,/Mercado/);
    }],
    ['captura preserva prazo e data planejada ao alternar tipos', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{qa('tk');let f=document.querySelector('#fqa');f.elements.t.value='Preparar';f.elements.due.value='2030-01-20';f.elements.dest.value='scheduled';f.elements.dest.dispatchEvent(new Event('change',{bubbles:true}));f.elements.planned.value='2030-01-15';qa('nt');qa('tk');f=document.querySelector('#fqa');return {title:f.elements.t.value,due:f.elements.due.value,dest:f.elements.dest.value,planned:f.elements.planned.value,enabled:!f.elements.planned.disabled}})()`);
      assert.deepStrictEqual(r,{title:'Preparar',due:'2030-01-20',dest:'scheduled',planned:'2030-01-15',enabled:true});
    }],
    ['captura rápida planeja ou agenda tarefa sem alterar o prazo', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.tasks=[];S.inbox=[];qa('tk');let f=document.querySelector('#fqa');if(!f.elements.dest)return null;f.elements.t.value='Preparar reunião';f.elements.due.value='2030-01-20';f.elements.dest.value='today';f.requestSubmit();const todayTask=S.tasks[0];qa('tk');f=document.querySelector('#fqa');f.elements.t.value='Organizar viagem';f.elements.dest.value='scheduled';f.elements.dest.dispatchEvent(new Event('change',{bubbles:true}));f.elements.planned.value='2030-01-15';f.requestSubmit();return {todayTask,scheduled:S.tasks[0],today:T}})()`);
      assert.ok(r,'captura deve oferecer destino');
      assert.strictEqual(r.todayTask.hd,r.today);assert.strictEqual(r.todayTask.due,'2030-01-20');assert.strictEqual(r.scheduled.hd,'2030-01-15');assert.strictEqual(r.scheduled.due,'');
    }],
    ['menu mobile mantém sistema acessível e permite fechar o painel', async () => {
      await fresh(); await login('A');
      await b.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      try {
        const r=await ev(`(()=>{S.view='dash';S.mcol=['sis'];render();document.querySelector('[data-a=more]').click();const d=document.querySelector('#mobile-menu'),system=d&&d.querySelector('[data-v=menu]');const open=!!(d&&d.open),visible=!!(system&&system.getClientRects().length);if(d)d.querySelector('[data-a=close-mobile-menu]').click();return {open,visible,closed:!!d&&!d.open}})()`);
        assert.ok(r.open);assert.ok(r.visible);assert.ok(r.closed);
      } finally { await b.send('Emulation.clearDeviceMetricsOverride'); }
    }],
    ['progresso reúne tarefas repetidas em um único acompanhamento', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.tasks=[{id:'a',t:'A',done:true,mt:'g',pj:'P'},{id:'b',t:'B',done:false,pj:'P',tg:'x'}];const g={id:'g',t:'Meta',ini:T,kr:[{id:'n',ty:'man',t:'Número',tg:10,cur:10},{id:'p',ty:'pj',ref:'P',t:'Projeto'},{id:'x',ty:'tg',ref:'x',t:'Etiqueta'}]};S.metas=[g];S.view='metas';render();return {progress:metaProg(g),text:document.querySelector('[data-lid="mt:g"]').innerText}})()`);
      assert.strictEqual(r.progress,0.75);assert.match(r.text,/1 de 2 tarefas/);assert.match(r.text,/sem repetir/);
    }],
    ['revisão guiada planeja pendência para próxima semana sem alterar prazo', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'w',t:'Preparar',done:false,due:'2030-05-20'}];S.metas=[{id:'g',t:'Meta',ini:T,kr:[]}];S.habits=[{id:'h',n:'Ler',log:{},perWeek:3}];S.view='hoje';render();const d=document.querySelector('[data-review-guide]');if(!d)return null;d.open=true;const text=d.textContent;d.querySelector('[data-a=review-plan]').click();return {open:document.querySelector('[data-review-guide]').open,task:S.tasks[0],expected:ds(add(today,7-((today.getDay()+6)%7))),text}})()`);assert.ok(r);assert.ok(r.open);assert.strictEqual(r.task.hd,r.expected);assert.strictEqual(r.task.due,'2030-05-20');assert.match(r.text,/Meta/);assert.match(r.text,/Ler/);
    }],
    ['próximo passo da meta planeja tarefa sem alterar seu prazo', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.metas=[{id:'g',t:'Meta',ini:T,kr:[]}];S.tasks=[{id:'t',t:'Começar',mt:'g',done:false,due:'2030-05-20'}];S.view='metas';render();const b=document.querySelector('[data-next-goal] [data-a=plan]');if(!b)return null;b.click();return S.tasks[0]})()`);assert.ok(r);assert.strictEqual(r.hd,await ev('T'));assert.strictEqual(r.due,'2030-05-20');
    }],
    ['notas destacam fixadas, recentes e para revisitar com filtros recolhíveis', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{noteReset();S.notes=[{id:'p',t:'Fixada',b:'',c:'g',pin:true,updatedAt:1},{id:'r',t:'Rever',b:'',c:'p',revisit:true,updatedAt:2}];S.view='notas';render();const el=document.querySelector('[data-notes-highlights]');return {text:el&&el.innerText,filters:!!document.querySelector('details[data-note-filters] #note-type')&&!!document.querySelector('details[data-note-filters] #nfil')}})()`);assert.ok(r.filters);assert.match(r.text,/Fixada/);assert.match(r.text,/Rever/);
    }],
    ['início apresenta situação de sincronização e backup', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.onb=false;S.lastBk=T;S.view='dash';render();const el=document.querySelector('[data-safety-summary]'),initial=el&&el.innerText;el.querySelector('button').focus();setSt('err','teste');return {focus:document.activeElement===el.querySelector('button'),initial,updated:document.querySelector('[data-safety-summary]').innerText}})()`);assert.ok(r.focus);assert.match(r.initial,/sincroniza/i);assert.match(r.initial,/backup/i);assert.match(r.updated,/falha ao sincronizar/i);
    }],
    ['vencimentos identificam conta vinculada e pendências sem vínculo', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const F=finInit(),date=ds(add(today,1));F.acc=[{id:'a',n:'Principal',ty:'cc',ini:0}];F.tx=[{id:'p',t:'Parcela',k:'out',v:10,d:date,ac:'a',pc:{i:1,n:2,g:'g'}}];F.bills=[{id:'b',n:'Conta sem vínculo',v:20,day:+date.slice(8)}];F.rec=[{id:'sub',t:'Música',k:'out',cat:'Assinaturas',v:15,day:+date.slice(8),ini:T,ac:'a'}];return duesPanel()})()`);assert.match(r,/Principal/);assert.match(r,/conta.*não.*vinculada/i);assert.match(r,/1\/2/);assert.match(r,/Assinatura/);
    }],
    ['metas apresentam conteúdo antes de configurações e criação orientada', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{S.metas=[{id:'m',t:'Ler mais',ini:T,kr:[{id:'k',ty:'man',t:'Livros',tg:12,cur:2,un:'livros'}]}];S.tasks=[{id:'t',t:'Escolher livro',mt:'m',done:false}];S.view='metas';render();const main=document.querySelector('#main'),card=main.querySelector('[data-lid="mt:m"]'),task=card.querySelector('[data-meta-task]'),edit=card.querySelector('[data-meta-edit]'),form=main.querySelector('#fmeta'),mode=form.elements.mode;mode.value='tasks';mode.dispatchEvent(new Event('change',{bubbles:true}));return {formAfter:!!(card.compareDocumentPosition(form)&Node.DOCUMENT_POSITION_FOLLOWING),editAfter:!!(task.compareDocumentPosition(edit)&Node.DOCUMENT_POSITION_FOLLOWING),help:form.querySelector('#meta-mode-help').textContent,heading:form.textContent,numberHidden:getComputedStyle(form.querySelector('[data-meta-number]')).display==='none'}})()`);
      assert.ok(r.formAfter&&r.editAfter);assert.match(r.heading,/1\. O que você quer alcançar/);assert.match(r.heading,/2\. Como você quer acompanhar/);assert.match(r.help,/tarefa/i);assert.ok(r.numberHidden);
    }],
    ['personalização do painel e rotina ficam depois do conteúdo', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{S.view='dash';S.cust=true;render();const main=document.querySelector('#main'),card=main.querySelector('[data-card]'),settings=main.querySelector('[data-a=cust]');const dash=!!(card.compareDocumentPosition(settings)&Node.DOCUMENT_POSITION_FOLLOWING);S.view='rotina';render();const panel=main.querySelector('.rts'),pref=main.querySelector('#rt-prefs');return {dash,routine:!!(panel.compareDocumentPosition(pref)&Node.DOCUMENT_POSITION_FOLLOWING)}})()`);assert.ok(r.dash&&r.routine);
    }],
    ['metas por quantidade preservam progresso ao editar e recarregar', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.metas=[];S.tasks=[];S.view='metas';render();let f=document.querySelector('#fmeta');f.elements.t.value='Ler 12 livros';f.elements.tg.value='12';f.elements.un.value='livros';f.requestSubmit();const g=S.metas[0],k=g.kr[0];k.cur=3;render();f=document.querySelector('[data-meta-edit]');f.elements.t.value='Leitura anual';f.requestSubmit();f=document.querySelector('[data-kr-edit]');f.elements.tg.value='15';f.requestSubmit();return {goal:S.metas[0],text:document.querySelector('#main').innerText,stored:JSON.parse(localStorage.getItem('hub-v1')).metas[0]}})()`);
      assert.strictEqual(r.goal.t,'Leitura anual');assert.strictEqual(r.goal.kr[0].tg,15);assert.strictEqual(r.goal.kr[0].cur,3);assert.match(r.text,/3 de 15 livros/);assert.deepStrictEqual(r.stored,r.goal);
      await open();assert.strictEqual(await ev('S.metas[0].kr[0].cur'),3);
    }],
    ['metas por tarefas orientam e impedem transferência silenciosa', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.metas=[{id:'old',t:'Antiga',ini:T,kr:[]}];S.tasks=[{id:'taken',t:'Em outra meta',done:false,mt:'old'}];S.view='metas';render();let f=document.querySelector('#fmeta');f.elements.t.value='Nova meta';f.elements.mode.value='tasks';f.elements.mode.dispatchEvent(new Event('change',{bubbles:true}));const hidden=getComputedStyle(f.querySelector('[data-meta-number]')).display;f.requestSubmit();const g=S.metas[0],card=document.querySelector('[data-lid="mt:'+g.id+'"]'),empty=card.innerText;let tf=card.querySelector('[data-meta-task]');tf.elements.t.value='Primeira etapa';tf.requestSubmit();const fake=document.createElement('form');fake.dataset.mt=g.id;fake.innerHTML='<input name="tk" value="taken">';document.body.appendChild(fake);fake.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return {hidden,empty,old:S.tasks.find(x=>x.id==='taken').mt,added:S.tasks.find(x=>x.t==='Primeira etapa').mt,id:g.id}})()`);
      assert.strictEqual(r.hidden,'none');assert.match(r.empty,/Adicione uma tarefa/);assert.doesNotMatch(r.empty,/No ritmo|Atrás do ritmo/);assert.strictEqual(r.old,'old');assert.strictEqual(r.added,r.id);
    }],
    ['acompanhamento financeiro aceita no máximo seis meses sem alterar metas existentes', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.metas=[{id:'g',t:'Meta',ini:T,kr:[{id:'k',ty:'pc',ref:'r',t:'Existente',tg:9}]}];S.fin.prules=[{id:'r',k:'out',cat:'Lazer',v:30}];S.view='metas';render();const f=document.querySelector('[data-kr]'),s=f.elements.src;s.value='pc:r';s.dispatchEvent(new Event('change',{bubbles:true}));f.elements.tg.value='7';const valid=f.checkValidity();f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return {valid,count:S.metas[0].kr.length,old:S.metas[0].kr[0].tg,max:f.elements.tg.max}})()`);
      assert.strictEqual(r.valid,false);assert.strictEqual(r.count,1);assert.strictEqual(r.old,9);assert.strictEqual(r.max,'6');
    }],
    ['falhas de sincronização não anunciam sucesso nem encerram a conta', async () => {
      await fresh(); await login('A');
      const result = await ev(`(async()=>{const original=metaRef.get, messages=[];const oldToast=toast;
        toast=m=>messages.push(m);metaRef.get=async()=>{throw new Error('sem rede')};
        S.tasks.push({id:'fail',t:'pendente',done:false});
        await syncAct('syncnow');await fbLogout();metaRef.get=original;toast=oldToast;
        return {messages,on:FB.on}})()`);
      assert.strictEqual(result.on, true, 'não deve sair com alterações pendentes');
      assert.ok(!result.messages.some(m=>/^(Sincronizado|Você saiu)/.test(m)), 'não pode informar sucesso: '+result.messages);
    }],
    ['falha ao salvar localmente fica visível', async () => {
      await fresh(); await login('A');
      const result = await ev(`(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='hub-v1')throw new Error('quota');return original.call(this,k,v)};
        save();const text=document.body.innerText;Storage.prototype.setItem=original;save();return text})()`);
      assert.match(result, /não foi possível salvar/i);
    }],
    ['alteração remota concorrente não é sobrescrita', async () => {
      await fresh(); await login('A'); await addTask('t-base'); await waitCloud('A','t-base');
      await ev(`(()=>{const get=metaRef.get.bind(metaRef);let once=true;metaRef.get=async()=>{const old=await get();if(once){once=false;const c=__cloud(),m=c['data/users/A/hub-meta'],data=JSON.parse(c['data/users/A/hub-0'].s);data.tasks.push({id:'t-outro',t:'t-outro',done:false});const j=JSON.stringify(data),rev=m.rev+1;c['data/users/A/hub-0']={rev,i:0,s:j};c['data/users/A/hub-meta']={...m,rev,len:j.length};localStorage.setItem('__cloud',JSON.stringify(c))}return old};S.tasks.push({id:'t-aqui',t:'t-aqui',done:false});push()})()`);
      await waitCloud('A','t-aqui');
      assert.ok((await cloudTasks('A')).includes('t-outro'),'a alteração concorrente deve sobreviver');
    }],
    ['restauração preserva dados se não puder criar versão local', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{S.tasks=[{id:'anterior',t:'Anterior'}];snapPut('Teste');const t=snaps()[0].t;S.tasks=[{id:'atual',t:'Atual'}];const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='hub-snaps')throw Error('quota');return original.call(this,k,v)};snapRestore(t);Storage.prototype.setItem=original;return S.tasks.map(x=>x.t)})()`);
      assert.deepStrictEqual(result,['Atual']);
    }],
    ['Hoje apresenta o próximo compromisso antes dos indicadores e oferece revisão semanal', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{S.view='hoje';render();const main=document.querySelector('#main');return {text:main.innerText,review:!!main.querySelector('[data-card=rev]')}})()`);
      assert.ok(result.text.indexOf('Nenhum evento hoje.') < result.text.indexOf('Compromissos'));
      assert.ok(result.review,'revisão semanal acessível em Hoje');
    }],
    ['adiar tarefa planejada retira ela de hoje', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{S.tasks=[{id:'adiar',t:'Tarefa',done:false,hd:T,due:''}];S.view='hoje';render();document.querySelector('[data-a=snooze][data-id=adiar]').click();return {hd:S.tasks[0].hd,due:S.tasks[0].due,tomorrow:ds(add(today,1)),still:!!document.querySelector('[data-a=snooze][data-id=adiar]')}})()`);
      assert.strictEqual(result.due,result.tomorrow);assert.notStrictEqual(result.hd,await ev('T'));assert.strictEqual(result.still,false);
    }],
    ['caixa de entrada captura, preserva ao cancelar e converte em tarefa', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{S.view='hoje';render();const f=document.querySelector('#finbox');if(!f)return null;f.querySelector('[name=t]').value='Resolver documento';f.requestSubmit();const it=S.inbox[0];document.querySelector('[data-a=inboxconvert]').click();qaClose();const preserved=S.inbox.length===1;document.querySelector('[data-a=inboxconvert]').click();document.querySelector('#fqa').requestSubmit();return {preserved,left:S.inbox.length,task:S.tasks.some(t=>t.t==='Resolver documento'),sync:pick().inbox,local:JSON.parse(localStorage.getItem('hub-v1')).inbox}})()`);
      assert.ok(result,'caixa de entrada deve aparecer em Hoje');assert.ok(result.preserved);assert.strictEqual(result.left,0);assert.ok(result.task);assert.deepStrictEqual(result.sync,[]);assert.deepStrictEqual(result.local,[]);
    }],
    ['revisão semanal mostra hábitos e despesas do período', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{const monday=add(today,-(today.getDay()+6)%7);S.rw=0;S.habits=[{id:'h',n:'Ler',log:{[ds(monday)]:true}}];S.fin.tx=[{id:'w',k:'out',t:'Mercado',v:42,d:ds(monday)},{id:'old',k:'out',t:'Outro',v:500,d:ds(add(monday,-1))}];return revCard()})()`);
      assert.match(result,/Hábitos registrados/);assert.match(result,/Despesas da semana/);assert.match(result,/42,00/);assert.doesNotMatch(result,/500,00/);
    }],
    ['notas relacionadas mostram motivo e excluem notas sem conexão', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{S.notes=[{id:'a',t:'Origem',g:'projeto',b:'',c:'p'},{id:'b',t:'Relacionada',g:'projeto',b:'',c:'b'},{id:'c',t:'Sem relação',g:'outro',b:'',c:'g'}];return noteRelated(S.notes[0])})()`);
      assert.match(result,/Relacionada/);assert.match(result,/etiqueta/i);assert.doesNotMatch(result,/Sem relação/);
    }],
    ['recorrências mostram próxima cobrança e variação apenas com histórico', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{const r={id:'r',k:'out',t:'Assinatura',day:31,ini:T,v:50};S.fin.rec=[r];S.fin.tx=[{id:'old',rc:'r',k:'out',t:'Assinatura',v:40,d:ds(add(today,-30))}];return recurringInfo(r)})()`);
      assert.match(result,/Próxima/);assert.match(result,/40,00/);assert.match(result,/50,00/);
    }],
    ['meta exibe notas vinculadas para consultar decisões', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{S.notes=[{id:'n1',t:'Decisão do projeto',g:'',b:'',c:'p'}];S.metas=[{id:'m1',t:'Projeto',ini:T,kr:[]}];S.lnk=[];lkSet('mt:m1','nt:n1',true);return metaCard(S.metas[0])})()`);
      assert.match(result,/Decisão do projeto/);assert.match(result,/Notas e decisões/);
    }],
    ['conversão financeira inválida preserva captura e exclusão vai à lixeira', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.view='hoje';S.inbox=[{id:'i',t:'Mercado sem valor'}];render();document.querySelector('[data-a=inboxconvert]').click();document.querySelector('[data-a=qat][data-id=dp]').click();document.querySelector('#fqa').requestSubmit();const kept=S.inbox.length===1;qaClose();document.querySelector('[data-a=inboxdel]').click();return {kept,removed:S.inbox.length===0,trash:S.trash.some(x=>x.ty==='inbox'&&x.it.t==='Mercado sem valor')}})()`);
      assert.ok(r.kept);assert.ok(r.removed);assert.ok(r.trash);
    }],
    ['revisão semanal continua aberta ao trocar de semana', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.view='hoje';render();const d=document.querySelector('#weekly-review');if(!d)return false;d.open=true;d.querySelector('[data-a=rw][data-id="-1"]').click();return document.querySelector('#weekly-review').open})()`);
      assert.ok(r);
    }],
    ['revisão permite ocultar finanças e mantém escolha no estado sincronizado', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.view='hoje';render();const opt=document.querySelector('[data-revshow=finance]');if(!opt)return null;opt.checked=false;opt.dispatchEvent(new Event('change',{bubbles:true}));return {html:revCard(),saved:pick().revprefs,local:JSON.parse(localStorage.getItem('hub-v1')).revprefs}})()`);
      assert.ok(r);assert.doesNotMatch(r.html,/Despesas da semana/);assert.strictEqual(r.saved.finance,false);assert.strictEqual(r.local.finance,false);
    }],
    ['nota vinculada abre mesmo após as primeiras 30 notas', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=Array.from({length:35},(_,i)=>({id:'n'+i,t:'Nota '+i,b:'',g:'',c:'p'}));S.view='metas';render();lkGo('nt:n34');render();return !!document.querySelector('[data-lid="nt:n34"]')})()`);
      assert.ok(r);
    }],
    ['importação rejeita caixa de entrada inválida sem alterar dados', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{S.inbox=[{id:'ok',t:'Manter'}];S.view='backup';render();const f=document.querySelector('#bkmerge'),d=new DataTransfer();d.items.add(new File([JSON.stringify({tasks:[],events:[],inbox:'inválida'})],'backup.json',{type:'application/json'}));f.files=d.files;f.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,150));return {inbox:S.inbox,msg:document.querySelector('#bkmsg').textContent}})()`);
      assert.deepStrictEqual(r.inbox,[{id:'ok',t:'Manter'}]);assert.match(r.msg,/inválido/i);
    }],
    ['captura rápida guarda item na caixa sem escolher categoria', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.view='notas';render();qa();const b=document.querySelector('[data-a=qat][data-id=ib]');if(!b)return null;b.click();const f=document.querySelector('#fqa');f.querySelector('[name=t]').value='Lembrar disto';f.requestSubmit();return {inbox:S.inbox,view:S.view}})()`);
      assert.ok(r);assert.strictEqual(r.inbox[0].t,'Lembrar disto');assert.strictEqual(r.view,'notas');
    }],
    ['tema e nome permanecem no estado após recarregar', async () => {
      await fresh(); await login('A');
      const before=await ev(`(()=>{S.view='aparencia';render();const theme=document.querySelector('[data-theme-choice="dark"]'),name=document.querySelector('#profile-name');if(!theme||!name)return false;theme.click();const updated=document.querySelector('#profile-name');updated.value='Vitória';updated.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
      assert.ok(before);await open();const r=await ev(`(()=>{S.view='dash';render();return {theme:document.documentElement.dataset.theme,heading:document.querySelector('.hero2 h1').textContent,synced:pick().themeMode}})()`);
      assert.strictEqual(r.theme,'dark');assert.match(r.heading,/Vitória/);assert.strictEqual(r.synced,'dark');
    }],
    ['lista de compras guarda itens independentes, quantidades e marcações', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.view='notas';render();const btn=document.querySelector('[data-a=shopping-add]');if(!btn)return null;btn.click();const list=S.notes.find(n=>n.kind==='shopping');const form=document.querySelector('[data-shopping-form]');form.querySelector('[name=t]').value='Arroz';form.querySelector('[name=q]').value='2 kg';form.requestSubmit();const checkbox=document.querySelector('[data-shopping-check]');checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}));return {items:list.items,save:JSON.parse(localStorage.getItem('hub-v1')).notes.find(n=>n.id===list.id).items,html:document.querySelector('#main').innerText}})()`);
      assert.ok(r);assert.strictEqual(r.items[0].t,'Arroz');assert.strictEqual(r.items[0].q,'2 kg');assert.strictEqual(r.items[0].done,true);assert.deepStrictEqual(r.save,r.items);
    }],
    ['mescla de itens da mesma lista preserva edições em aparelhos distintos', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const base={notes:[{id:'l',kind:'shopping',items:[{id:'a',t:'Arroz',done:false},{id:'b',t:'Feijão',done:false}]}]},a=JSON.parse(JSON.stringify(base)),b=JSON.parse(JSON.stringify(base));a.notes[0].items[0].done=true;b.notes[0].items[1].done=true;return merge3(base,a,b).notes[0].items})()`);
      assert.ok(r.every(x=>x.done));
    }],
    ['avisa quando o mesmo campo muda nos dois aparelhos', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const conflicts=[];const result=merge3({t:'original'},{t:'local'},{t:'remoto'},conflicts);return {result,conflicts}})()`);
      assert.strictEqual(r.result.t,'local');assert.ok(r.conflicts.length);
    }],
    ['mudança de dia atualiza a tela após terminar edição', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{S.view='hoje';today=add(new Date(),-1);T=ds(today);render();const input=document.querySelector('#fhj input');window.__blurSeen=0;input.addEventListener('blur',()=>window.__blurSeen++);input.focus();const activeBefore=document.activeElement===input;input.value='Não perder';newDay();const kept=input.isConnected&&input.value==='Não perder';input.value='';input.blur();input.dispatchEvent(new FocusEvent('blur'));await new Promise(r=>setTimeout(r,100));return {kept,activeBefore,blurSeen:window.__blurSeen,pending:dayPending,active:document.activeElement.tagName,current:T,date:document.querySelector('#main').innerText,expected:String(new Date().getDate())+' de '+MESF[new Date().getMonth()]}})()`);
      assert.ok(r.kept);assert.ok(r.date.includes(r.expected), JSON.stringify(r));
    }],
    ['versão remota em conflito pode ser recuperada no backup', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{const base=pick();base.focus='base';S.focus='local';SY.last=JSON.stringify(base);const remote=JSON.parse(JSON.stringify(base));remote.focus='remoto';const rev=SY.rev+1,j=JSON.stringify(remote);await DBr.doc(P+'hub-0').set({rev,i:0,s:j});await pullRemote({rev,n:1},false);return {local:S.focus,remote:snaps().some(x=>JSON.parse(x.j).focus==='remoto')}})()`);
      assert.strictEqual(r.local,'local');assert.ok(r.remote);
    }],
    ['backup com lista inválida não é importado', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{S.view='backup';render();const f=document.querySelector('#bkmerge'),d=new DataTransfer();d.items.add(new File([JSON.stringify({tasks:[],events:[],notes:[{id:'a',kind:'shopping',items:'inválido'}]})],'backup.json',{type:'application/json'}));f.files=d.files;f.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,150));return {notes:S.notes.length,msg:document.querySelector('#bkmsg').textContent}})()`);
      assert.strictEqual(r.notes,0);assert.match(r.msg,/inválido/i);
    }],
    ['alternar tema mantém texto ainda não enviado', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.view='hoje';render();const i=document.querySelector('#fhj input');i.value='Texto em edição';document.querySelector('#theme').click();return {text:document.querySelector('#fhj input').value,mode:pick().themeMode}})()`);
      assert.strictEqual(r.text,'Texto em edição');assert.ok(['dark','light'].includes(r.mode));
    }],
    ['receber dados preserva formulário ainda não enviado', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{S.view='hoje';render();const i=document.querySelector('#fhj input');i.focus();i.value='Texto ainda não enviado';after();await new Promise(r=>setTimeout(r,2700));return document.querySelector('#fhj input').value})()`);
      assert.strictEqual(r,'Texto ainda não enviado');
    }],
    ['versões locais aceitam base maior que limite antigo', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{localStorage.removeItem(SNK);const data=pick();data.notes=[{id:'large',t:'Grande',b:'x'.repeat(1300000)}];return {ok:snapPut('Grande',0,data),stored:snaps().length}})()`);
      assert.ok(r.ok);assert.strictEqual(r.stored,1);
    }],
    ['recorrência continua gerando depois de cinco anos sem duplicar', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{const F=finInit(),start=ds(new Date(today.getFullYear()-6,today.getMonth(),1));F.rec=[{id:'old',ini:start,day:1,k:'out',t:'Conta',v:10}];F.tx=[];genRec0();const first=F.tx.length;genRec0();return {first,after:F.tx.length,current:F.tx.some(x=>x.id==='r_old_'+T.slice(0,7))}})()`);
      assert.ok(r.current);assert.strictEqual(r.first,r.after);
    }],
    ['lista permite editar item e criar cópia sem marcações', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[{id:'i',t:'Arroz',q:'1 kg',done:true}]}];S.view='notas';render();document.querySelector('[data-a=shopping-edit]').click();const f=document.querySelector('[data-shopping-edit]');if(!f)return null;f.querySelector('[name=t]').value='Feijão';f.querySelector('[name=q]').value='2 kg';f.requestSubmit();document.querySelector('[data-a=shopping-copy]').click();return S.notes.map(n=>({id:n.id,t:n.items[0].t,q:n.items[0].q,done:n.items[0].done}))})()`);
      assert.ok(r);assert.strictEqual(r.length,2);assert.strictEqual(r[0].t,'Feijão');assert.strictEqual(r[0].q,'2 kg');assert.strictEqual(r[0].done,false);assert.strictEqual(r[1].done,true);assert.notStrictEqual(r[0].id,r[1].id);
    }],
    ['registrar compra prepara despesa sem criar lançamento', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[]}];S.view='notas';render();const b=document.querySelector('[data-a=shopping-expense]');if(!b)return null;b.click();return {input:document.querySelector('#fqa input[name=t]').value,count:finInit().tx.length,mode:QT}})()`);
      assert.ok(r);assert.match(r.input,/Mercado/);assert.strictEqual(r.count,0);assert.strictEqual(r.mode,'dp');
    }],
    ['busca abre diretamente lista encontrada pelo item', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[{id:'i',t:'Feijão',q:'',done:false}]}];Q='Feijão';render();const b=document.querySelector('[data-a=lkgo][data-id="nt:l"]');if(!b)return false;b.click();return S.view==='notas'&&!!document.querySelector('[data-lid="nt:l"]')})()`);
      assert.ok(r);
    }],
    ['resumo de assinaturas inclui apenas despesas ativas', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.view='financas';S.ftab='contas';const F=finInit();F.rec=[{id:'on',k:'out',t:'Música',v:25,day:20,ini:T,cat:'Assinaturas'},{id:'off',k:'out',t:'Antiga',v:700,day:20,ini:'2020-01-01',end:'2020-12-31',cat:'Assinaturas'}];render();return document.querySelector('#main').innerText})()`);
      assert.match(r,/Assinaturas ativas/);assert.match(r,/25,00/);assert.match(r,/Música/);
    }],
    ['sugestões de compras usam itens já cadastrados', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[{id:'i',t:'Feijão',q:'',done:false}]}];S.view='notas';render();return [...document.querySelectorAll('datalist option')].some(o=>o.value==='Feijão')})()`);
      assert.ok(r);
    }],
    ['conflito não aplica dados se não couberem as duas versões', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{localStorage.removeItem(SNK);const base=pick();base.focus='base';S.focus='local';SY.last=JSON.stringify(base);const remote=JSON.parse(JSON.stringify(base));remote.focus='remoto';const rev=SY.rev+1,j=JSON.stringify(remote);await DBr.doc(P+'hub-0').set({rev,i:0,s:j});const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SNK&&JSON.parse(v).length>1)throw Error('quota');return orig.call(this,k,v)};const ok=await pullRemote({rev,n:1},false);Storage.prototype.setItem=orig;return {ok,focus:S.focus,versions:snaps().map(x=>JSON.parse(x.j).focus)}})()`);
      assert.strictEqual(r.ok,false);assert.strictEqual(r.focus,'local');assert.ok(r.versions.includes('local'));
    }],
    ['receber dados preserva rascunho após sair do campo', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.view='hoje';render();const i=document.querySelector('#fhj input');i.value='Rascunho';document.activeElement.blur();after();return document.querySelector('#fhj input').value})()`);
      assert.strictEqual(r,'Rascunho');
    }],
    ['dados locais corrompidos não são substituídos nem enviados', async () => {
      await fresh(); await login('A'); await addTask('t-segura'); await waitCloud('A','t-segura');
      await ev(`localStorage.setItem('hub-v1','{inválido')`);await open();await sleep(2500);
      const r=await ev(`({raw:localStorage.getItem('hub-v1'),message:document.body.innerText,cloud:__cloud()['data/users/A/hub-0'].s})`);
      assert.strictEqual(r.raw,'{inválido');assert.match(r.message,/dados locais.*corrompid/i);assert.match(r.cloud,/t-segura/);
    }],
    ['salvamento recupera espaço de versões antigas quando necessário', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{snapPut('Teste');const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='hub-v1'&&snaps().length)throw new DOMException('quota','QuotaExceededError');return orig.call(this,k,v)};S.focus='Salvo';save();Storage.prototype.setItem=orig;return {value:JSON.parse(localStorage.getItem('hub-v1')).focus,versions:snaps().length}})()`);
      assert.strictEqual(r.value,'Salvo');assert.strictEqual(r.versions,0);
    }],
    ['marcar item preserva rascunho de outro item', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[{id:'i',t:'Arroz',q:'',done:false}]}];S.view='notas';render();const f=document.querySelector('[data-shopping-form]');f.querySelector('[name=t]').value='Feijão';const c=document.querySelector('[data-shopping-check]');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));return {draft:document.querySelector('[data-shopping-form] [name=t]').value,done:S.notes[0].items[0].done}})()`);
      assert.strictEqual(r.draft,'Feijão');assert.strictEqual(r.done,true);
    }],
    ['lista compartilha texto com quantidades', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{let payload=null;navigator.share=async x=>{payload=x};S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[{id:'i',t:'Arroz',q:'2 kg',done:false}]}];S.view='notas';render();const b=document.querySelector('[data-a=shopping-share]');if(!b)return null;b.click();await new Promise(r=>setTimeout(r,20));return payload})()`);
      assert.ok(r);assert.match(r.text,/Arroz/);assert.match(r.text,/2 kg/);
    }],
    ['card opcional mostra lista fixada e pendências', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',pin:true,items:[{id:'a',t:'Arroz',q:'',done:false}]}];S.cards=[{id:'compras',on:true}];S.view='dash';render();const c=document.querySelector('[data-card=compras]');return c&&c.innerText})()`);
      assert.ok(r);assert.match(r,/Mercado/);assert.match(r,/1 item pendente/);
    }],
    ['compra mostra previsão e valor registrado após confirmação', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[]}];S.view='notas';render();const b=document.querySelector('[data-shopping-budget]');if(!b)return null;b.value='100';b.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-a=shopping-expense]').click();const f=document.querySelector('#fqa');f.querySelector('[name=v]').value='80';f.requestSubmit();return {budget:S.notes[0].budget,linked:finInit().tx[0].shopping,text:document.querySelector('#main').innerText}})()`);
      assert.ok(r);assert.strictEqual(r.budget,100);assert.strictEqual(r.linked,'l');assert.match(r.text,/80,00/);assert.match(r.text,/100,00/);
    }],
    ['backup apresenta estado da sincronização e última cópia', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.view='backup';render();return document.querySelector('#main').innerText})()`);
      assert.match(r,/Última sincronização/);assert.match(r,/backup/i);assert.match(r,/alterações/i);
    }],
    ['recuperação da nuvem substitui estado local corrompido', async () => {
      await fresh(); await login('A'); await addTask('t-recuperar'); await waitCloud('A','t-recuperar');
      await ev(`localStorage.setItem('hub-v1','{inválido')`);await open();
      const r=await ev(`(async()=>{const m=(await metaRef.get()).data(),ok=await pullRemote(m,true);return {ok,corrupt:LOCAL_CORRUPT,tasks:S.tasks.map(x=>x.t),raw:localStorage.getItem('hub-v1')}})()`);
      assert.ok(r.ok);assert.strictEqual(r.corrupt,false);assert.ok(r.tasks.includes('t-recuperar'));assert.doesNotThrow(()=>JSON.parse(r.raw));
    }],
    ['conferência dos próximos 30 dias mostra gastos e explica sobreposição', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.view='hoje';render();return document.querySelector('#main').innerText})()`);
      assert.match(r,/próximos 30 dias/i);assert.match(r,/conta fixa.*recorrente/i);
    }],
    ['estado local válido em JSON mas incompleto é protegido', async () => {
      await fresh(); await login('A'); await addTask('t-segura'); await waitCloud('A','t-segura');
      await ev(`localStorage.setItem('hub-v1','{}')`);await open();const r=await ev(`({raw:localStorage.getItem('hub-v1'),blocked:LOCAL_CORRUPT})`);
      assert.strictEqual(r.raw,'{}');assert.strictEqual(r.blocked,true);
    }],
    ['backup não exporta dados vazios durante recuperação', async () => {
      await fresh(); await login('A'); await ev(`localStorage.setItem('hub-v1','{inválido')`);await open();
      const r=await ev(`(()=>{S.view='backup';render();let called=false;const old=siteSave;siteSave=()=>{called=true};exportBk();siteSave=old;return {called,msg:document.querySelector('#bkmsg').textContent}})()`);
      assert.strictEqual(r.called,false);assert.match(r.msg,/recuper/i);
    }],
    ['concluir tarefa preserva outra tarefa ainda em edição', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Existente',done:false,hd:T,due:''}];S.view='hoje';render();document.querySelector('#fhj input').value='Rascunho';const c=document.querySelector('[data-a=tog][data-id=t]');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));return {draft:document.querySelector('#fhj input').value,done:S.tasks[0].done}})()`);
      assert.strictEqual(r.draft,'Rascunho');assert.strictEqual(r.done,true);
    }],
    ['nova captura rápida não herda vínculo de compra anterior', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[]}];S.view='notas';render();document.querySelector('[data-a=shopping-expense]').click();document.querySelector('[data-a=qa]').click();const f=document.querySelector('#fqa');f.querySelector('[name=t]').value='Outra despesa';f.querySelector('[name=v]').value='50';f.requestSubmit();return finInit().tx[0].shopping||null})()`);
      assert.strictEqual(r,null);
    }],
    ['backup financeiro inválido não altera dados salvos', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{S.focus='Manter';save();S.view='backup';render();const f=document.querySelector('#bkfile'),d=new DataTransfer();d.items.add(new File([JSON.stringify({tasks:[],events:[],fin:'inválido'})],'backup.json'));f.files=d.files;f.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));return {focus:JSON.parse(localStorage.getItem('hub-v1')).focus,fin:JSON.parse(localStorage.getItem('hub-v1')).fin,msg:document.querySelector('#bkmsg').textContent}})()`);
      assert.strictEqual(r.focus,'Manter');assert.ok(r.fin&&typeof r.fin==='object');assert.match(r.msg,/inválido/i);
    }],
    ['versões antigas são preservadas se salvar falhar mesmo após liberar espaço', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{snapPut('Teste');const before=localStorage.getItem(SNK),orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='hub-v1')throw new DOMException('quota','QuotaExceededError');return orig.call(this,k,v)};S.focus='Novo';save();Storage.prototype.setItem=orig;return {same:localStorage.getItem(SNK)===before,warning:!!document.querySelector('#storage-warning')}})()`);
      assert.ok(r.same);assert.ok(r.warning);
    }],
    ['edição de item removido oferece recuperação sem apagar rascunho', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[{id:'i',t:'Arroz',q:'',done:false}]}];S.view='notas';render();document.querySelector('[data-a=shopping-edit]').click();const f=document.querySelector('[data-shopping-edit]');f.querySelector('[name=t]').value='Feijão';S.notes[0].items=[];f.requestSubmit();const b=document.querySelector('[data-a=shopping-recover]');if(!b)return null;b.click();return S.notes[0].items.map(x=>x.t)})()`);
      assert.deepStrictEqual(r,['Feijão']);
    }],
    ['lista apresenta histórico de compras vinculadas', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[]}];S.fin.tx=[{id:'a',shopping:'l',k:'out',t:'Compra A',v:40,d:'2026-01-10'},{id:'b',shopping:'l',k:'out',t:'Compra B',v:80,d:'2026-02-12'}];return shoppingCard(S.notes[0])})()`);
      assert.match(r,/Histórico de compras/);assert.match(r,/40,00/);assert.match(r,/80,00/);
    }],
    ['fixture parcialmente preenchida permanece válida para mesclagem', async () => {
      await fresh();await login('A');const data=JSON.parse(fs.readFileSync(path.join(ROOT,'tests','fixtures','backup-parcial.json'),'utf8'));const r=await ev(`(()=>{const d=${JSON.stringify(data)},merged=merge3({},d,d,[]);return {valid:validBackup(d),task:merged.tasks[0],habit:merged.habits[0],account:merged.fin.acc[0]}})()`);assert.ok(r.valid);assert.strictEqual(r.task.hd,'2030-01-10');assert.strictEqual(r.habit.perWeek,3);assert.strictEqual(r.account.id,'a');
    }],
    ['fixture de backup antigo restaura hábitos diários e preserva conteúdo', async () => {
      await fresh();await login('A');const data=fs.readFileSync(path.join(ROOT,'tests','fixtures','backup-antigo-minimo.json'),'utf8');const r=await ev(`(async()=>{S.view='backup';render();const f=document.querySelector('#bkfile'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(data)}],'antigo.json',{type:'application/json'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));return {task:S.tasks.find(t=>t.id==='t-antiga'),note:S.notes.find(n=>n.id==='n-antiga'),habit:S.habits.find(h=>h.id==='h-antigo'),message:document.querySelector('#bkmsg').textContent}})()`);assert.match(r.message,/restaurado/i);assert.strictEqual(r.task.due,'2030-01-20');assert.match(r.note.b,/Conteúdo/);assert.strictEqual(r.habit.perWeek,undefined);assert.strictEqual(r.habit.log['2026-11-17'],1);
    }],
    ['backup válido atual e mínimo continua aceito', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>({current:validBackup(JSON.parse(JSON.stringify(S))),minimal:validBackup({tasks:[],events:[]}),legacy:validBackup({tasks:[],events:[],fin:{tx:null,acc:null}}),nullFinance:validBackup({tasks:[],events:[],fin:null})}))()`);
      assert.ok(r.current);assert.ok(r.minimal);assert.ok(r.legacy);assert.strictEqual(r.nullFinance,false);
    }],
    ['restauração que não consegue salvar mantém estado anterior', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{S.focus='Anterior';save();S.view='backup';render();const f=document.querySelector('#bkfile'),d=new DataTransfer();d.items.add(new File([JSON.stringify({tasks:[],events:[],focus:'Novo'})],'backup.json'));f.files=d.files;const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='hub-v1')throw new DOMException('quota','QuotaExceededError');return orig.call(this,k,v)};f.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));Storage.prototype.setItem=orig;return {focus:S.focus,saved:JSON.parse(localStorage.getItem('hub-v1')).focus,msg:document.querySelector('#bkmsg').textContent}})()`);
      assert.strictEqual(r.focus,'Anterior');assert.strictEqual(r.saved,'Anterior');assert.match(r.msg,/não foi possível salvar/i);
    }],
    ['edição alterada remotamente oferece salvar como novo item', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[{id:'i',t:'Arroz',q:'',done:false}]}];S.view='notas';render();document.querySelector('[data-a=shopping-edit]').click();const f=document.querySelector('[data-shopping-edit]');f.querySelector('[name=t]').value='Feijão';S.notes[0].items[0].t='Arroz integral';f.requestSubmit();const b=document.querySelector('[data-a=shopping-recover]');if(!b)return null;b.click();return S.notes[0].items.map(x=>x.t)})()`);
      assert.deepStrictEqual(r,['Arroz integral','Feijão']);
    }],
    ['validação rejeita data financeira impossível e tarefa com prazo inválido', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>({date:validBackup({tasks:[],events:[],fin:{tx:[{d:'2026-02-30',v:10}]}}),due:validBackup({tasks:[{id:'x',t:'Tarefa',due:123}],events:[]})}))()`);
      assert.strictEqual(r.date,false);assert.strictEqual(r.due,false);
    }],
    ['validação rejeita evento incompleto e menu inválido', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>({event:validBackup({tasks:[],events:[{d:'2026-01-01',t:'Evento'}]}),menu:validBackup({tasks:[],events:[],menu:{groups:[],bar:'inválido'}})}))()`);
      assert.strictEqual(r.event,false);assert.strictEqual(r.menu,false);
    }],
    ['backup com dados de exemplo completos é aceito', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{exLoad();return validBackup(JSON.parse(JSON.stringify(S)))})()`);
      assert.strictEqual(r,true);
    }],
    ['versão restaurada não substitui estado se armazenamento falhar', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.focus='Antiga';snapPut('Teste');const t=snaps()[0].t;S.focus='Atual';save();const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='hub-v1')throw new DOMException('quota','QuotaExceededError');return orig.call(this,k,v)};snapRestore(t);Storage.prototype.setItem=orig;return {focus:S.focus,saved:JSON.parse(localStorage.getItem('hub-v1')).focus}})()`);
      assert.strictEqual(r.focus,'Atual');assert.strictEqual(r.saved,'Atual');
    }],
    ['edição recupera item quando a lista inteira foi removida', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',f:'',g:'',c:'g',items:[{id:'i',t:'Arroz',q:'',done:false}]}];S.view='notas';render();document.querySelector('[data-a=shopping-edit]').click();const f=document.querySelector('[data-shopping-edit]');f.querySelector('[name=t]').value='Feijão';S.notes=[];f.requestSubmit();const b=document.querySelector('[data-a=shopping-recover]');if(!b)return null;b.click();return {name:S.notes[0].t,items:S.notes[0].items.map(x=>x.t)}})()`);
      assert.ok(r);assert.strictEqual(r.name,'Mercado');assert.deepStrictEqual(r.items,['Feijão']);
    }],
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
      const p1 = await ev(`(async()=>{
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
        S.ftab='contas';render();
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
        // Pacote 3: modo privacidade borra textos do diário/notas e botão Compartilhar cópia no Backup
        S.view='diario';render();togglePriv();
        const blurOn=getComputedStyle(document.querySelector('textarea[data-dk="a"]')).filter.includes('blur');
        togglePriv();
        const blurOff=getComputedStyle(document.querySelector('textarea[data-dk="a"]')).filter==='none';
        let sharedFile=null;navigator.canShare=()=>true;navigator.share=async o=>{sharedFile=o&&o.files&&o.files[0]?o.files[0].name:null};
        S.view='backup';render();await shareBk();
        const okShare=!!sharedFile&&sharedFile.startsWith('meu-hub-backup-')&&S.lastBk===T;
        const okClean=typeof IN_CLAUDE==='undefined'&&typeof DL==='undefined'&&typeof dayViewOld==='undefined';
        return {okNL,okSearch,okRec,okBill,okProm,ckTx,ckDia,blurOn,blurOff,okShare,okClean};
      })()`);
      assert.deepStrictEqual(p1, { okNL: true, okSearch: true, okRec: true, okBill: true, okProm: true, ckTx: true, ckDia: true, blurOn: true, blurOff: true, okShare: true, okClean: true }, 'Pacotes 1, 2, 3 e 4');
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
      await ev('S.themeMode="light";applyTheme()');
      assert.strictEqual(await ev('document.querySelector(\'meta[name="theme-color"]\').content'), '#eef4f8');
      await ev('S.themeMode="dark";applyTheme()');
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
