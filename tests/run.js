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
