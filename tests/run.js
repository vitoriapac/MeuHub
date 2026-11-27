// Testes ponta a ponta do Meu Hub: Firebase simulado + Chrome/Edge headless via DevTools Protocol.
// Uso: node tests/run.js   (Node 24+, sem dependências; navegador por CHROME_PATH ou caminho padrão)
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), assert = require('assert');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const sleep = t => new Promise(r => setTimeout(r, t));

// Firebase simulado: "nuvem" e sessão ficam no localStorage para sobreviver a reloads.
// Fica numa closure para não colidir com os nomes globais do app.
const MOCK = `(()=>{window.__noSW=1;const ld=k=>JSON.parse(localStorage.getItem(k)||'null'),st=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const cloud=()=>ld('__cloud')||{},L={};window.__cloud=cloud;
const snap=p=>{const c=cloud();return{exists:p in c,data:()=>c[p],metadata:{fromCache:false}}};
const MA={cb:null,onAuthStateChanged(cb){this.cb=cb;setTimeout(()=>cb(ld('__sess')),20)},
 signInWithPopup(){const u={uid:window.__next,email:window.__next+'@teste.com'};st('__sess',u);this.cb(u);return Promise.resolve()},
 signOut(){st('__sess',null);this.cb(null);return Promise.resolve()}};
const MDB={runTransaction:async fn=>{const writes=[],tx={get:async ref=>snap(ref.path),set:(ref,v)=>writes.push([ref.path,v])};await fn(tx);for(const [p,v] of writes){const c=cloud();c[p]=JSON.parse(JSON.stringify(v));st('__cloud',c)}for(const [p] of writes)(L[p]||[]).forEach(f=>f(snap(p)))},doc(p){return{path:p,get:async()=>snap(p),
 set:async v=>{const c=cloud();c[p]=JSON.parse(JSON.stringify(v));st('__cloud',c);(L[p]||[]).forEach(f=>f(snap(p)))},
 delete:async()=>{const c=cloud();delete c[p];st('__cloud',c)},
 onSnapshot(cb){(L[p]=L[p]||[]).push(cb);setTimeout(()=>cb(snap(p)));return()=>{L[p]=L[p].filter(x=>x!==cb)}}}}};
window.firebase={initializeApp(){},auth:Object.assign(()=>MA,{GoogleAuthProvider:function(){}}),firestore:()=>MDB};})();`;

// Lê o site (index.html + css/ + js/ + img/ + PWA) e aplica o Firebase simulado: o mock entra no <body> do
// index.html e a config/carregador de teste entram no arquivo que tiver FB_CONFIG, seja qual for.
function sitePages() {
  const roots = ['index.html', 'manifest.webmanifest', 'sw.js'].filter(f => fs.existsSync(path.join(ROOT, f)));
  const files = [...roots, ...['css', 'js', 'img', 'fonts'].flatMap(d => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).map(f => d + '/' + f) : [])];
  const site = Object.fromEntries(files.map(f => ['/' + f, /\.(jpe?g|png|webp|woff2)$/.test(f) ? fs.readFileSync(path.join(ROOT, f)) : fs.readFileSync(path.join(ROOT, f), 'utf8')]));
  const swap = (file, from, to) => {
    const next = site[file].replace(from, to);
    if (next === site[file]) throw new Error(file + ' mudou: não achei ' + from);
    site[file] = next;
  };
  site['/mock.js'] = MOCK;
  swap('/index.html', '<body>\n', '<body>\n<script src="mock.js"></script>\n');
  const cfg = Object.keys(site).filter(f => typeof site[f] === 'string' && site[f].includes('const FB_CONFIG='));
  if (cfg.length !== 1) throw new Error('esperava FB_CONFIG em 1 arquivo, achei em: ' + (cfg.join(', ') || 'nenhum'));
  swap(cfg[0], /const FB_CONFIG=(null|\{[^\n]*?\});/, 'const FB_CONFIG={projectId:"teste"};');
  // localStorage.__offline simula os scripts do Firebase sem baixar (sem internet)
  swap(cfg[0], /const fbScript=n=>[^\n]*\n/, 'const fbScript=n=>localStorage.getItem("__offline")?Promise.reject(new Error("offline")):Promise.resolve();\n');
  site['/'] = site['/index.html'];
  return site;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
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
  const proc = spawn(findBrowser(), ['--headless=new', '--disable-gpu', '--no-first-run', ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox'] : []), '--remote-debugging-port=0', '--user-data-dir=' + dir, 'about:blank']);
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
  const open = async () => { await b.send('Page.navigate', { url }); await sleep(200); await waitFor('typeof FB==="object"&&FB.ready', 'Firebase simulado pronto', srv.slow ? 15000 : 8000) };
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
    if(m.v===2&&m.doms){const dm=m.doms.core;if(!dm)return null;let s="";for(let i=0;i<dm.n;i++){const d=c["data/users/${uid}/hub-d-core-"+i];if(!d||d.rev!==dm.rev)return null;s+=d.s}return JSON.parse(s).tasks.map(t=>t.t).filter(t=>t.startsWith("t-"))}
    let s="";for(let i=0;i<m.n;i++){const d=c["data/users/${uid}/hub-"+i];if(!d||d.rev!==m.rev)return null;s+=d.s}
    return JSON.parse(s).tasks.map(t=>t.t).filter(t=>t.startsWith("t-"))})()`;
  const cloudTasks = uid => ev(cloudTasksExpr(uid));
  const waitCloud = (uid, t) => waitFor(`(${cloudTasksExpr(uid)}||[]).includes(${JSON.stringify(t)})`, `"${t}" na nuvem de ${uid}`);

  const backupDecision = `(async()=>{const end=Date.now()+3000;let button;while(!(button=document.querySelector('[data-a=backup-apply]'))&&Date.now()<end)await new Promise(r=>setTimeout(r,25));if(!button)throw Error('Confirmação do backup ausente: '+document.querySelector('#bkmsg')?.textContent);button.click()})()`;
  const scenarios = [
    ['conferência guiada avisa falha de posição e preserva marcação quando salvar falha', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const F=finInit(),ac=F.acc[0].id;F.tx=[{id:'a',t:'Mercado',d:T,k:'out',v:10,ac}];S.view='financas';S.ftab='lanc';S.fvw='mes';S.fac='';S.fmo=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.includes('finance-review')||k==='hub-v1')throw new Error('sem espaço');return original.call(this,k,v)};try{financeReviewStart(T.slice(0,7),'');render({save:false});const warning=document.querySelector('[data-finance-review-session]').textContent.includes('somente enquanto esta página');document.querySelector('[data-a=finance-review-check]').click();return {warning,checked:!!F.tx[0].checked,pending:financeReviewRows(financeReviewState()).length}}finally{Storage.prototype.setItem=original}})()`);assert.deepEqual(r,{warning:true,checked:false,pending:1});
    }],
    ['espera futura não alerta e impede encaixe iniciado antes de esperar', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'w',t:'Esperar retorno',done:false,p:'m',due:T,wait:true,waitReviewDate:ds(add(today,1))}];S.rem={on:true,tk:true,fat:false,hab:false};S.view='agenda';S.mode='week';render();const hidden=waitingTasks(true).length===0&&!attention().some(x=>x.id==='w');DR={k:'tp',id:'w'};document.querySelector('[data-day]').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true}));const notPlanned=!S.tasks[0].bk;S.tasks[0].waitReviewDate=T;return {hidden,notPlanned,due:waitingTasks(true).length===1}})()`);assert.ok(Object.values(r).every(Boolean),JSON.stringify(r));
    }],

    ['espera e conferência guiada cabem no celular e respeitam privacidade', async () => {
      await fresh();await login('A');await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:812,deviceScaleFactor:1,mobile:true});
      try{
        const r=await ev(`(()=>{document.documentElement.style.fontSize='200%';S.view='hoje';S.tasks=[{id:'w',t:'Retorno do orçamento para a reforma do apartamento',done:false,p:'m',wait:true,waitFor:'Fornecedor de materiais para revisão da cozinha e do escritório',waitReviewDate:T}];render();const waitOverflow=document.documentElement.scrollWidth>innerWidth+1;const F=finInit(),ac=F.acc[0].id;F.tx=[{id:'a',t:'Descrição'.repeat(20),d:T,k:'out',v:987.65,ac}];S.view='financas';S.ftab='lanc';S.fvw='mes';S.fmo=0;S.fac='';financeReviewStart(T.slice(0,7),'');render();const financeOverflow=document.documentElement.scrollWidth>innerWidth+1;PRIV=true;setPriv();render();const panel=document.querySelector('[data-finance-review-session]');const masked=!panel.textContent.includes('987,65')&&getComputedStyle(panel.querySelector('[data-priv-text]')).filter!=='none';PRIV=false;setPriv();return {waitOverflow,financeOverflow,masked}})()`);assert.deepEqual(r,{waitOverflow:false,financeOverflow:false,masked:true});
        if(process.env.NEXT_CAPTURE){
          await ev(`document.documentElement.style.fontSize='100%';S.view='hoje';render();document.querySelector('[data-waiting-tasks]').scrollIntoView()`);await sleep(250);const wait=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.NEXT_CAPTURE+'-espera.png',Buffer.from(wait.result.data,'base64'));
          await ev(`S.view='financas';render();document.querySelector('[data-finance-review-session]').scrollIntoView()`);await sleep(250);const review=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.NEXT_CAPTURE+'-conferencia.png',Buffer.from(review.result.data,'base64'));
        }
      }finally{await ev(`document.documentElement.style.fontSize='';PRIV=false;setPriv()`);await b.send('Emulation.clearDeviceMetricsOverride')}
    }],

    ['Aguardando preserva prazo e plano, sai da execução e retorna na revisão', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'w',t:'Retorno do orçamento',done:false,p:'m',due:T,hd:T,bk:{d:T,h:'10:00'},dur:30}];S.view='tarefas';S.filter='all';ED={t:'tk',id:'w'};render();const f=document.querySelector('#ftk-edit');f.elements.wait.value='yes';f.elements.waitFor.value='Fornecedor';f.elements.waitReviewDate.value=T;submitTask(f,true);const t=S.tasks[0],load=dayLoad(T);S.view='hoje';render();const visible=!!document.querySelector('[data-waiting-tasks]'),priority=document.querySelector('[data-today-priority]').textContent.includes(t.t);S.rem={tk:true,on:true,fat:false,hab:false};const alerts=attention().filter(a=>a.id==='w');S.view='tarefas';S.filter='waiting';render();return {preserved:t.due===T&&t.hd===T&&t.bk.h==='10:00',load:load.tot,visible,priority,alerts:alerts.length,wait:alerts[0]?.s,listed:!!document.querySelector('[data-lid="tk:w"]'),valid:validBackup(pick())}})()`);assert.ok(r.preserved&&r.visible&&r.listed&&r.valid);assert.strictEqual(r.load,0);assert.strictEqual(r.priority,false);assert.strictEqual(r.alerts,1);assert.match(r.wait,/Revisar espera/);
      await b.send('Page.reload');await sleep(800);const resumed=await ev(`(()=>{S.view='hoje';render();const before=S.tasks[0].wait;document.querySelector('[data-a=task-resume]').click();return {before,wait:S.tasks[0].wait,ready:taskReady(S.tasks[0]),due:S.tasks[0].due===T,load:dayLoad(T).tot}})()`);assert.ok(resumed.before&&resumed.ready&&resumed.due);assert.strictEqual(resumed.wait,false);assert.strictEqual(resumed.load,30);
    }],
    ['Aguardando exige revisão, preserva rascunho e não contamina próxima recorrência', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.view='tarefas';render();let f=document.querySelector('#ftk');f.elements.t.value='Esperar retorno';f.elements.wait.value='yes';f.elements.waitFor.value='Maria';captureTaskDraft(f);submitTask(f,false);const rejected=!S.tasks.some(t=>t.t==='Esperar retorno');render();f=document.querySelector('#ftk');const draft=f.elements.wait.value==='yes'&&f.elements.waitFor.value==='Maria';f.elements.waitReviewDate.value=T;submitTask(f,false);const t=S.tasks.find(t=>t.t==='Esperar retorno');t.rc='w';t.due=T;completeTask(t,true);const next=S.tasks.find(x=>x.id!==t.id&&x.seriesId===t.id);return {rejected,draft,valid:validBackup(pick()),nextReady:taskReady(next),nextWait:next.wait,bad:validBackup({...pick(),tasks:[{...t,waitReviewDate:'2026-02-31'}]})}})()`);assert.ok(r.rejected&&r.draft&&r.valid&&r.nextReady);assert.strictEqual(r.nextWait,false);assert.strictEqual(r.bad,false);
    }],
    ['conferência guiada retoma após recarga, preserva saldo e rejeita valor alterado', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const F=finInit(),ac=F.acc[0].id;F.tx=[{id:'a',t:'Mercado',d:T,k:'out',ac,v:10},{id:'b',t:'Farmácia',d:T,k:'out',ac,v:20},{id:'future',t:'Agendado',d:ds(add(today,1)),k:'out',ac,v:50}];S.view='financas';S.ftab='lanc';S.fvw='mes';S.fmo=0;S.fac='';render();document.querySelector('[data-a=finance-review-start]').click();const first=document.querySelector('[data-a=finance-review-check]');F.tx[0].v=11;first.click();const protectedValue=!F.tx[0].checked;document.querySelector('[data-a=finance-review-check]').click();const checked=F.tx[0].checked;document.querySelector('[data-a=finance-review-pause]').click();return {protectedValue,checked,paused:financeReviewState().paused,cursor:financeReviewState().cursor,total:F.tx.reduce((s,t)=>s+t.v,0)}})()`);assert.ok(r.protectedValue&&r.checked&&r.paused);assert.strictEqual(r.cursor,'b');assert.strictEqual(r.total,81);
      await b.send('Page.reload');await sleep(800);const r2=await ev(`(()=>{S.view='financas';S.ftab='lanc';S.fmo=0;S.fac='';render();const retained=financeReviewState().cursor==='b';document.querySelector('[data-a=finance-review-start]').click();const next=document.querySelector('[data-a=finance-review-check]').dataset.id;document.querySelector('[data-a=finance-review-check]').click();return {retained,next,done:document.querySelector('[data-finance-review-session]').textContent.includes('Nenhum lançamento'),future:!!finInit().tx.find(t=>t.id==='future').checked,total:finInit().tx.reduce((s,t)=>s+t.v,0)}})()`);assert.ok(r2.retained&&r2.done);assert.strictEqual(r2.next,'b');assert.strictEqual(r2.future,false);assert.strictEqual(r2.total,81);
    }],
    ['conferência guiada separa contas de acesso e mantém itens para depois', async () => {
      await fresh();await login('A');await ev(`(()=>{const F=finInit(),ac=F.acc[0].id;F.tx=[{id:'a',t:'Um',d:T,k:'out',v:1,ac},{id:'b',t:'Dois',d:T,k:'out',v:2,ac}];S.view='financas';S.ftab='lanc';S.fvw='mes';S.fac='';S.fmo=0;financeReviewStart(T.slice(0,7),'');render();document.querySelector('[data-a=finance-review-skip]').click();save()})()`);assert.strictEqual(await ev('financeReviewState().cursor'),'b');assert.ok(await ev('finInit().tx.every(t=>!t.checked)'));
      await ev('fbLogout()');await waitFor('!FB.on','sair A');await login('B');assert.strictEqual(await ev('financeReviewState()'),null);await ev('fbLogout()');await waitFor('!FB.on','sair B');await login('A');assert.strictEqual(await ev('financeReviewState().cursor'),'b');
    }],

    ["Hoje mostra próximos passos ativos uma única vez e preserva o prazo", async () => {
      await fresh(); await login('A');
const result=await ev(`(()=>{S.tasks=[{id:'t',t:'Revisar orçamento',p:'m',due:ds(add(today,3))},{id:'paused',t:'Pausada',archived:true}];S.projects=[{id:'p',t:'Reforma',status:'active',nextTask:'t',refs:[{id:'tk:t'}]},{id:'q',t:'Arquivo',status:'active',nextTask:'paused',refs:[{id:'tk:paused'}]}];S.tasks.unshift(...Array.from({length:61},(_,i)=>({id:'outro'+i,t:'Outra '+i,done:false})));S.view='hoje';render();const section=document.querySelector('[data-project-steps]');if(!section)return null;section.querySelector('[data-a=lkgo]').click();const opened=!!document.querySelector('[data-lid="tk:t"]');S.view='hoje';render();document.querySelector('[data-project-steps] [data-a=plan]').click();const task=S.tasks.find(t=>t.id==='t');return {opened,before:section.innerText,after:document.querySelector('.hero').innerText,due:task.due,expected:ds(add(today,3)),planned:task.hd===T,remaining:!!document.querySelector('[data-project-steps]')}})()`);
assert.ok(result);assert.ok(result.opened);assert.match(result.before,/Reforma/);assert.doesNotMatch(result.before,/Arquivo/);assert.match(result.after,/Reforma/);assert.strictEqual(result.after.match(/Revisar orçamento/g).length,1);assert.strictEqual(result.due,result.expected);assert.ok(result.planned&&!result.remaining);
    }],
    ["Atenção compara compras mescladas e mantém lançamentos ao confirmar", async () => {
      await fresh(); await login('A');
const result=await ev(`(()=>{const F=finInit(),ac=F.acc[0].id,tx=id=>({id,t:'Compra '+id,k:'out',d:T,v:45,ac,shopping:'lista'}),base={fin:{tx:[]}};F.tx=merge3(base,{fin:{tx:[tx('a')]}},{fin:{tx:[tx('b')]}},[]).fin.tx;F.bills=[{id:'c',n:'Internet',day:10,v:20}];S.view='avisos';render();const queue=document.querySelector('#finance-review');if(!queue)return null;queue.querySelector('summary').click();const before=queue.innerText;queue.querySelector('[data-a=finance-review-open]').click();const edit=document.querySelector('#ffin [name=t]')?.value;S.view='avisos';render();document.querySelector('#finance-review summary').click();document.querySelector('[data-a=finance-distinct]').click();const after=document.querySelector('#finance-review').innerText;F.tx.push(tx('c'));render();document.querySelector('#finance-review summary').click();return {before,after,edit,newText:document.querySelector('#finance-review').innerText,values:F.tx.map(t=>t.v),valid:validBackup(pick())}})()`);
assert.ok(result);assert.match(result.before,/Compra a/);assert.match(result.before,/Compra b/);assert.match(result.before,/Internet/);assert.strictEqual(result.edit,'Compra a');assert.doesNotMatch(result.after,/Compra a/);assert.match(result.newText,/Compra c/);assert.deepStrictEqual(result.values,[45,45,45]);assert.ok(result.valid);
    }],
    ['ensaio de recuperação restaura vínculos e saldo após mesclagem', async () => {
      await fresh(); await login('Recovery');
      const file=await ev(`(()=>{const F=finInit(),task={id:'ensaio-task',t:'Revisar orçamento',p:'m'},goal={id:'ensaio-goal',t:'Reforma',ini:T,kr:[]},project={id:'ensaio-project',t:'Reforma',status:'active',nextTask:task.id,refs:[{id:'tk:'+task.id}]},account={id:'ensaio-account',n:'Conta de teste',ty:'cc',ini:100},base={...pick(),tasks:[],metas:[goal],projects:[],fin:{...F,tx:[],acc:[account],rec:[]}};const a={...base,tasks:[{...task,mt:goal.id}],projects:[project]},b={...base,fin:{...base.fin,tx:[{id:'ensaio-expense',k:'out',t:'Material',v:30,d:T,ac:account.id,cat:'Outros'}]}};return JSON.stringify(merge3(base,a,b,[]))})()`);
      await fresh(); await login('Restore');
      const result=await ev(`(async()=>{S.view='backup';render();const input=document.querySelector('#bkfile'),files=new DataTransfer();files.items.add(new File([${JSON.stringify(file)}],'ensaio.json',{type:'application/json'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));await ${backupDecision};return {status:document.querySelector('#bkmsg').textContent,steps:hoje(),task:S.tasks.find(t=>t.id==='ensaio-task')?.mt,goal:S.metas.find(g=>g.id==='ensaio-goal')?.id,balance:bal(finInit().acc[0])}})()`);
      assert.match(result.status,/Backup restaurado/);assert.match(result.steps,/Revisar orçamento/);assert.strictEqual(result.task,result.goal);assert.strictEqual(result.balance,70);
    }],
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
      const r=await ev(`(async()=>{S.reads=[{id:'antigo',t:'Anterior',k:'livro',st:'q'}];S.view='backup';render();const f=document.querySelector('#bkfile'),d=new DataTransfer(),data={tasks:[],events:[],reads:[{id:'book',t:'Livro',k:'livro',st:'f',df:T,cover:240727,coverColor:'#325a72'}]};d.items.add(new File([JSON.stringify(data)],'backup.json',{type:'application/json'}));f.files=d.files;f.dispatchEvent(new Event('change',{bubbles:true}));await ${backupDecision};return {reads:S.reads,ok:validBackup(data)}})()`);
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
      const r=await ev(`(async()=>{S.rot={[T]:{m:1,progress:{n:3}}};S.rotPrefs={n:{1:false}};S.dia={[T]:{focus:'Estudar',routine:{m:{m:4},n:{m:5}}}};const data=JSON.parse(JSON.stringify(pick()));S.rot={};S.rotPrefs={};S.dia={};S.view='backup';render();const f=document.querySelector('#bkfile'),files=new DataTransfer();files.items.add(new File([JSON.stringify(data)],'backup.json',{type:'application/json'}));f.files=files.files;f.dispatchEvent(new Event('change',{bubbles:true}));await ${backupDecision};return {rot:S.rot[T],prefs:S.rotPrefs,day:S.dia[T],msg:document.querySelector('#bkmsg').textContent}})()`);
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
      await fresh();await login('A');const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[{id:'i',t:'Arroz',q:'',qty:2,unit:'kg',estimatedCents:1800,actualCents:1700,done:true}]}];S.fin.tx=[];S.view='notas';render();document.querySelector('[data-a=shopping-expense]').click();let f=document.querySelector('#fqa');const initial=f.elements.v.value;f.requestSubmit();const first=S.fin.tx[0];document.querySelector('[data-a=shopping-expense]').click();f=document.querySelector('#fqa');f.elements.shoppingRepeatConfirmed.checked=true;f.requestSubmit();return {initial,tx:S.fin.tx,firstId:first.id}})()`);assert.strictEqual(r.initial,'34,00');assert.strictEqual(r.tx.length,2);assert.notStrictEqual(r.tx[0].id,r.firstId);assert.deepStrictEqual(r.tx[0].shoppingItems,['i']);
    }],
    ['evolução MeuHub: replaneja sem alterar prazo e conclui tarefa no modo foco', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{
        S.tasks=[{id:'a',t:'Mover',hd:T,due:T,bk:{d:T,h:'15:00'}},{id:'b',t:'Concluir',bk:{d:T,h:'16:00'}}];
        S.view='hoje';render();
        const f=document.querySelector('#day-replan');f.elements.a.value='tomorrow';f.requestSubmit();
        const a=S.tasks.find(t=>t.id==='a'),expected=ds(add(today,1));
        document.querySelector('[data-a=focus-enter][data-id=b]').click();
        const focused=document.querySelector('h1').textContent==='Modo foco'&&!S.fk;
        document.querySelector('[data-a=focus-done]').click();
        return {a,expected,today:T,focused,done:S.tasks.find(t=>t.id==='b').done,view:document.querySelector('h1').textContent};
      })()`);
      assert.equal(r.a.due,r.today);assert.equal(r.a.hd,r.expected);assert.equal(r.a.bk,undefined);
      assert.ok(r.focused&&r.done);assert.match(r.view,/Hoje/);
    }],
    ['evolução MeuHub: retoma revisão e fixa nota na tarefa', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{
        S.tasks=[{id:'a',t:'Pesquisar',hd:T,tg:'viagem'}];
        S.notes=[{id:'n',t:'Roteiro',g:'viagem',reviewDate:T},{id:'old',t:'Arquivada',g:'viagem',archived:true}];
        S.view='hoje';render();
        const checkbox=document.querySelector('[data-review-step=tasks]');checkbox.click();
        const week=checkbox.dataset.wk;
        const progress=document.querySelector('[data-review-guide] summary').textContent;
        const context=document.querySelector('[id^=context-]');
        const visible=context.textContent.includes('Roteiro')&&!context.textContent.includes('Arquivada');
        context.querySelector('[data-a=context-pin]').click();
        return {visible,linked:lkOf('tk:a'),saved:S.rev[week].step_tasks===true,progress};
      })()`);
      assert.ok(r.visible&&r.saved);assert.deepEqual(r.linked,['nt:n']);assert.match(r.progress,/1 de 5/);
    }],
    ['evolução MeuHub: confirma associação do extrato e preserva a despesa', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{
        const acc=finInit().acc[0].id;
        S.fin.tx=[{id:'old',t:'Mercado',k:'out',cat:'Alimentação',ac:acc,d:T,v:42,shopping:'lista'}];
        const source=['Data;Descrição;Valor',T+';COMPRA TESTE;-42'].join(String.fromCharCode(10));
        const prepared=prepCSV(source,'Teste');S.view='financas';S.ftab='regras';render();
        const select=document.querySelector('[data-imp-review]');
        if(!select)return {prepared,tab:S.ftab,rows:impRows().rows};
        select.value='tx:old';select.dispatchEvent(new Event('change',{bubbles:true}));
        document.querySelector('[data-a=impgo]').click();
        prepCSV(source,'Teste novamente');
        return {tx:S.fin.tx,dup:impRows().rows[0].dup};
      })()`);
      assert.ok(r.dup,JSON.stringify(r));assert.equal(r.tx.length,1);
      assert.equal(r.tx[0].v,42);assert.equal(r.tx[0].cat,'Alimentação');assert.equal(r.tx[0].shopping,'lista');
    }],
    ['evolução MeuHub: compara orçamento e saldo com horizonte comum', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{
        S.fin.acc=[{id:'a',n:'Conta',ty:'cc',ini:200}];S.fin.bud={Compras:100};S.fin.tx=[];
        S.view='financas';S.ftab='analise';render();
        const f=document.querySelector('#purchase-simulator');
        f.elements.amount.value='120';f.elements.parts.value='2';f.elements.category.value='Compras';
        const before=JSON.stringify(S.fin);f.requestSubmit();
        const output=document.querySelector('[data-simulation-result]');
        return {options:[...output.querySelectorAll('section')].map(x=>x.textContent),same:before===JSON.stringify(S.fin)};
      })()`);
      assert.ok(r.same);assert.equal(r.options.length,2);assert.match(r.options[0],/À vista em conta/);
      assert.match(r.options[0],/120,00 de/);assert.match(r.options[1],/60,00 de/);
      assert.ok(r.options.every(x=>/80,00/.test(x)));
    }],
    ['F5 Contas e Orçamentos mostram consulta e mantêm as ações', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{
        today=new Date(2026,10,12,12);T=ds(today);
        const F=finInit();F.acc=[{id:'a',n:'Conta corrente',ty:'cc',ini:500},{id:'c',n:'Cartão pessoal',ty:'card',close:15,due:25,lim:1000}];
        F.tx=[{id:'buy',t:'Mercado',k:'out',cat:'Alimentação',d:T,v:130,ac:'c'},{id:'past',t:'Despesa',k:'out',cat:'Moradia',d:'2026-10-10',v:100,ac:'a'}];
        F.bud={Alimentação:100};F.goals=[{id:'reserve',n:'Reserva',res:true,target:300,saved:200,rm:3}];
        F.rec=[{id:'sub',t:'Streaming',k:'out',cat:'Assinaturas',ac:'a',day:20,v:30,ini:T}];
        F.bills=[{id:'bill',n:'Internet',day:16,ac:'a',v:70}];
        const before=(a,b)=>!!($(a).compareDocumentPosition($(b))&Node.DOCUMENT_POSITION_FOLLOWING);
        S.view='financas';S.ftab='contas';render();
        const order=before('#fin-accounts','#fin-cards')&&before('#fin-cards','.fin-card-workspace .finance-dues')&&before('#fin-fixed','#fin-account-form');
        const subscriptions=$('#fin-recurring').textContent,upcoming=$('.fin-card-workspace .finance-dues').textContent;
        const bill=$('#fin-fixed').textContent,pays=!!$('#fin-cards [data-a=payinv]');
        $('[data-a=edbill][data-id=bill]').click();
        const opens=$('#fin-bill-form').open&&$('#fbill [name=n]').value==='Internet';
        S.ftab='orc';render();
        const budget=$('.gg').textContent,reserve=$('.reserve-coverage').textContent,setup=before('.reserve-coverage','#fin-budget-form');
        $('[data-a=fin-config-open][data-id=fin-budget-form]').click();
        return {order,subscriptions,upcoming,bill,pays,opens,budget,reserve,setup,config:$('#fin-budget-form').open};
      })()`);
      assert.ok(r.order&&r.pays&&r.opens&&r.setup&&r.config);
      assert.match(r.subscriptions,/30,00 por mês/);assert.match(r.subscriptions,/360,00 por ano/);
      assert.match(r.upcoming,/Conta corrente/);assert.match(r.bill,/16 nov/);
      assert.match(r.budget,/Excedeu em R\$\s*30,00/);assert.match(r.reserve,/2,0 meses/);
    }],
    ['F5 Investimentos e Importação colocam ferramentas abaixo da consulta', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{
        const before=(a,b)=>!!($(a).compareDocumentPosition($(b))&Node.DOCUMENT_POSITION_FOLLOWING);
        finInit();S.view='financas';S.ftab='inv';render();
        const investments=before('#finvdiv','#fin-asset-form')&&before('#fin-asset-form','#fin-invest-settings');
        $('[data-a=fin-config-open][data-id=fin-asset-form]').click();
        const add=$('#fin-asset-form').open&&document.activeElement.name==='ticker',refresh=!!$('[data-a=inv-refresh]');
        S.ftab='analise';render();const analysis=!!$('#purchase-simulator')&&!$('[data-fin-tools]');
        S.ftab='geral';render();const overview=!$('[data-fin-tools]')&&!$('#purchase-simulator');
        prepCSV(['Data;Descrição;Valor',T+';Mercado;-52'].join(String.fromCharCode(10)),'Extrato');
        S.ftab='regras';render();
        return {investments,add,refresh,analysis,overview,preview:$('#fin-import').textContent,
          options:before('#fin-import .item','#statement-options'),order:before('#fin-import','#fin-rules')&&before('#fin-rules','[data-fin-tools]')};
      })()`);
      assert.ok(r.investments&&r.add&&r.refresh&&r.analysis&&r.overview&&r.options&&r.order);
      assert.match(r.preview,/Conta de destino:/);assert.match(r.preview,/Mercado/);
    }],
    ['F4 Análises compara dias equivalentes e abre os registros do ranking', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{
        today=new Date(2026,2,30,12);T=ds(today);
        const F=finInit();
        F.acc=[{id:'main',n:'Conta principal',ty:'cc',ini:0},{id:'other',n:'Outra',ty:'cc',ini:0}];
        const tx=(id,d,k,v,cat,extra={})=>({id,t:id,d,k,v,cat,ac:'main',...extra});
        F.tx=[
          tx('compra','2026-03-22','out',80,'Alimentação'),
          tx('estorno','2026-03-23','in',20,'Receita',{rb:1,rcat:'Alimentação'}),
          tx('agendado','2026-03-31','out',900,'Alimentação'),
          tx('transferencia','2026-03-21','tr',200,'Transferência',{to:'other'}),
          tx('novo','2026-03-29','out',25,'Reserva'),
          tx('outra conta','2026-03-23','out',300,'Alimentação',{ac:'other'}),
          tx('base','2026-02-28','out',30,'Alimentação'),
          tx('base anterior','2026-02-20','out',50,'Serviços')
        ];
        S.view='financas';S.ftab='analise';S.fac='main';S.fmo=0;render();
        const model=analysisExpenses();
        $('.analysis-slice[data-id=Alimentação]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
        const selected=$('.analysis-category-row[data-id=Alimentação]').getAttribute('aria-pressed');
        const selectedChart=$('.analysis-donut-value').textContent;
        const delta=$('.analysis-category-row[data-id=Alimentação]').textContent;
        const noBase=$('.analysis-category-row[data-id=Reserva]').textContent;
        $('[data-a=analysis-extract]').click();
        const rows=[...document.querySelectorAll('#txlist [data-tx-row]')].map(x=>x.dataset.txRow);
        const net=$('#txlist').textContent;
        return {before:model.previousLabel,period:model.currentLabel,current:model.now.out,previous:model.before.out,selected,selectedChart,delta,noBase,rows,net,fac:S.fac,tab:S.ftab};
      })()`);
      assert.match(r.before,/28 fev/);assert.match(r.period,/30 mar/);
      assert.equal(r.current,85);assert.equal(r.previous,80);assert.equal(r.selected,'true');
      assert.match(r.selectedChart,/60,00/);assert.match(r.delta,/30,00.*100%/s);assert.match(r.noBase,/sem base percentual/);
      assert.deepEqual(r.rows,['estorno','compra']);assert.match(r.net,/Despesas líquidas: R\$\s*60,00/);
      assert.deepEqual([r.fac,r.tab],['main','lanc']);
    }],
    ['F4 Relatório anual preserva filtro, totais líquidos e CSV com estornos', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{
        today=new Date(2026,10,15,12);T=ds(today);
        const F=finInit();
        F.acc=[{id:'main',n:'Conta principal',ty:'cc',ini:0},{id:'other',n:'Outra',ty:'cc',ini:0}];
        const tx=(id,k,v,cat,extra={})=>({id,t:id,d:T,k,v,cat,ac:'main',...extra});
        F.tx=[tx('fixo','out',100,'Serviços',{pc:{g:'g',i:1,n:2}}),tx('estorno','in',80,'Receita',{rb:1,rcat:'Serviços'}),tx('despesa outra','out',700,'Outros',{ac:'other'}),tx('transferencia','tr',40,'Transferência',{to:'other'})];
        S.view='financas';S.fvw='ano';S.fay='main';render();
        let csv='';const original=siteSave;siteSave=(name,data)=>{csv=data};
        try{$('[data-a=fexp]').click()}finally{siteSave=original}
        const fixed=[...document.querySelectorAll('h2')].find(h=>h.textContent==='Fixo e variável').parentElement.textContent;
        return {csv,fixed,shown:$('#main .rv4').textContent};
      })()`);
      assert.match(r.shown,/20,00/);assert.doesNotMatch(r.shown,/700,00/);
      assert.match(r.fixed,/100%/);assert.doesNotMatch(r.fixed,/500%|−80,00/);
      assert.match(r.csv,/"Total";"0,00";"20,00";"-20,00"/);
      assert.match(r.csv,/"Serviços";"20,00"/);
    }],
    ['F3 Visão geral distingue caixa, fatura e escopos e preserva o mês nos atalhos', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{
        const base=new Date(2026,10,12,12);today=base;T=ds(base);
        const F=finInit();
        F.acc=[{id:'a',n:'Conta cotidiana',ty:'cc',ini:1000},{id:'b',n:'Conta salário',ty:'cc',ini:400},{id:'card',n:'Cartão teste',ty:'card',close:15,due:24}];
        F.primary='b';F.rec=[];F.bills=[];
        F.tx=[
          {id:'cash',t:'Mercado',d:'2026-11-10',k:'out',cat:'Alimentação',ac:'a',v:100},
          {id:'credit',t:'Compra no cartão',d:'2026-11-10',k:'out',cat:'Compras',ac:'card',v:150},
          {id:'part',t:'Pagamento parcial',d:'2026-11-24',k:'tr',ac:'a',to:'card',invoice:'2026-11-15',v:50},
          {id:'salary',t:'Salário',d:'2026-11-25',k:'in',ac:'b',v:200}
        ];
        S.view='financas';S.ftab='geral';S.fmo=0;S.fac='';render();
        const general=$('.finance-month-flow').textContent,dues=$('.finance-dues').textContent,total=$('.finance-balance-main').textContent;
        const dashed=$('.finance-month-flow polyline[stroke-dasharray]')!==null;
        S.fac='a';render();
        const scoped=$('.finance-month-flow').textContent,next=$('#main').textContent.includes('em Conta salário');
        $('[data-a=overview-category][data-id=Alimentação]').click();
        return {general,dues,total,dashed,scoped,next,tab:S.ftab,category:S.fcat,account:S.fac,month:S.fmo};
      })()`);
      assert.match(r.total,/1\.300,00/);
      assert.match(r.general,/1\.350,00/);
      assert.match(r.dues,/Saldo da fatura a pagar/);assert.match(r.dues,/Pagamento de fatura agendado/);
      assert.doesNotMatch(r.dues,/Compra no cartão/);
      assert.match(r.scoped,/850,00/);assert.ok(r.dashed&&r.next);
      assert.deepEqual([r.tab,r.category,r.account,r.month],['lanc','Alimentação','a',0]);
    }],
    ['F3 Visão geral informa falta de dados e mantém vencimentos antes do gráfico no celular', async () => {
      await fresh();await login('A');
      await b.send('Emulation.setDeviceMetricsOverride',{width:375,height:850,deviceScaleFactor:1,mobile:true});
      try{
        const r=await ev(`(()=>{
          S.view='financas';S.ftab='geral';render();
          const dues=$('.finance-dues'),flow=$('.finance-month-flow');
          return {message:flow.textContent,order:dues.getBoundingClientRect().top<flow.getBoundingClientRect().top,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
        })()`);
        assert.match(r.message,/Sem saldo inicial ou movimentações/);assert.ok(r.order);assert.equal(r.overflow,0);
      }finally{await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['contas fixas respeitam o término na agenda, lista e projeção', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{
        today=new Date(2026,0,29,12);T=ds(today);const F=finInit();S.view='financas';S.ftab='contas';render();
        $('#fin-bill-form').open=true;const form=$('#fbill');
        for(const [k,v] of Object.entries({n:'Contrato',v:'45',day:31,end:'2026-02-28',ac:F.acc[0].id})){if(form.elements[k])form.elements[k].value=v}
        form.requestSubmit();const bill=F.bills[0],event=S.events.find(e=>e.id===bill.eid);
        return {end:bill.end,agenda:[hit(event,'2026-02-28'),hit(event,'2026-03-31')],due:dues(90).filter(d=>d.id===bill.id).map(d=>d.d),cash:cashFlow({days:90}).evs.filter(d=>d.t==='Contrato').map(d=>d.d)};
      })()`);
      assert.deepEqual(result,{end:'2026-02-28',agenda:[true,false],due:['2026-01-31','2026-02-28'],cash:['2026-01-31','2026-02-28']});
    }],
    ['editar apenas o término da recorrência preserva lançamentos e limita o lembrete', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{
        today=new Date(2026,0,29,12);T=ds(today);const F=finInit();
        F.rec=[{id:'rec',k:'out',t:'Assinatura',v:30,cat:'Assinaturas',ac:F.acc[0].id,day:15,ini:'2026-01-01'}];
        F.tx=[{id:'r_rec_2026-01',t:'Assinatura conferida',k:'out',v:29,d:'2026-01-15',cat:'Assinaturas',ac:F.acc[0].id,rc:'rec',checked:true}];
        recReminder(F.rec[0]);S.view='financas';S.ftab='contas';render();
        $('[data-a=edrec][data-id=rec]').click();const form=$('#frec');
        form.elements.end.value='2026-02-20';form.requestSubmit();
        const reminder=S.events.find(e=>e.id===F.bills[0].eid);
        return {preserved:F.tx[0].t,checked:F.tx[0].checked,value:F.tx[0].v,billEnd:F.bills[0].end,
          dates:dues(90).filter(d=>d.rec==='rec').map(d=>d.d),agenda:[hit(reminder,'2026-02-15'),hit(reminder,'2026-03-15')]};
      })()`);
      assert.deepEqual(result,{preserved:'Assinatura conferida',checked:true,value:29,billEnd:'2026-02-20',dates:['2026-02-15'],agenda:[true,false]});
    }],
    ['parcelar despesa em Contas mostra prévia e gera um grupo no extrato', async () => {
      await fresh(); await login('A');
      const result=await ev(`(()=>{
        today=new Date(2026,0,29,12);T=ds(today);const F=finInit();S.view='financas';S.ftab='contas';render();
        const shortcut=$('[data-id=fin-installment-form]');if(!shortcut)return null;shortcut.click();
        const form=$('#fin-installment-form form');
        for(const [k,v] of Object.entries({t:'Compra dividida',v:'100',d:'2026-01-31',pc:3,ac:F.acc[0].id}))form.elements[k].value=v;
        form.elements.pc.dispatchEvent(new Event('input',{bubbles:true}));
        const preview=form.querySelector('output').textContent;
        form.requestSubmit();
        const rows=F.tx.filter(t=>t.t==='Compra dividida').sort((a,b)=>a.pc.i-b.pc.i);
        return {preview,dates:rows.map(t=>t.d),values:rows.map(t=>t.v),groups:new Set(rows.map(t=>t.pc.g)).size,listed:$('#main').textContent.includes('0 de 3 parcelas registradas')};
      })()`);
      assert.ok(result);assert.match(result.preview,/33,34/);assert.deepEqual(result.dates,['2026-01-31','2026-02-28','2026-03-31']);
      assert.deepEqual(result.values,[33.33,33.33,33.34]);assert.equal(result.groups,1);assert.ok(result.listed);
    }],
    ['A1 fechamento limita destinações, preserva legados e estorna em parcelas', async () => {
      await fresh();await login('A');
      const result=await ev(`(()=>{
        const F=finInit(),ac=F.acc[0].id;F.acc.push({id:'other',n:'Outra',ty:'cc',ini:0});
        F.acc[0].ini=300;F.goals=[{id:'viagem',n:'Viagem',saved:50,target:10000}];invInit(F).cfg.cash=75;
        F.tx=[{id:'a1-in',t:'Receita',k:'in',v:3000,d:T,cat:'Receita',ac},{id:'a1-out',t:'Despesa',k:'out',v:1000,d:T,cat:'Serviços',ac:'other'}];
        const prior=JSON.parse(JSON.stringify(pick()));S.view='financas';S.ftab='orc';S.fmo=0;S.fac=ac;render();
        const recap=()=>({goal:typeof closingGoalBalance==='function'?closingGoalBalance(F.goals[0]):F.goals[0].saved,cash:invCompute(F.inv).cash,count:F.tx.length,balance:bal(F.acc[0])});
        const form=$('#fclosemonth');form.elements.v.value='1200,00';form.elements.goal.value='viagem';form.requestSubmit();
        if(SUBMIT_BY_ID.fclosemonth)SUBMIT_BY_ID.fclosemonth(form,{v:'1200,00',goal:'viagem'});
        const first=recap();S.fac='other';render();
        const rest=$('#fclosemonth');rest.elements.v.value='800,00';rest.elements.goal.value='__inv_cash';rest.requestSubmit();
        const full=recap(),exhausted=!$('#fclosemonth');
        const reverse=$('[data-close-reverse]');if(reverse)reverse.requestSubmit();
        return {first,full,exhausted,final:recap(),legacy:validBackup(prior),valid:validBackup(pick())};
      })()`);
      assert.deepEqual(result,{first:{goal:1250,cash:75,count:2,balance:3300},full:{goal:1250,cash:875,count:2,balance:3300},exhausted:true,final:{goal:50,cash:875,count:2,balance:3300},legacy:true,valid:true});
    }],
    ['A1 mescla destinações offline sem exceder a sobra nem aprovar o conflito após estorno', async () => {
      await fresh();await login('A');
      const result=await ev(`(()=>{
        const F=finInit(),ac=F.acc[0].id,month=T.slice(0,7);
        F.tx=[{id:'a1-sal',t:'Receita',k:'in',v:2000,d:T,ac}];
        F.goals=[{id:'viagem',n:'Viagem',saved:100,target:10000}];invInit(F).cfg.cash=25;
        const base=JSON.parse(JSON.stringify(F));
        const make=(id,goal,cents)=>({...base,closings:[{id,month,scope:'all',goal,label:id,cents,limit:200000,at:1000}]});
        const l=make('a','viagem',120000),r=make('b','__inv_cash',100000),merged=merge3(base,l,r),opposite=merge3(base,r,l);
        const snapshot=F=>{const p=closingProjection(F);return {goal:closingGoalBalance(F.goals[0],p),cash:closingCashBalance(F.inv,p),status:[...p.status],used:p.months.get(month).used}};
        S.fin=merged;S.view='financas';S.ftab='orc';S.fmo=0;render({save:false});
        const conflict=$('#main').textContent.includes('Não aplicada');
        const both=[snapshot(merged),snapshot(opposite)];closeMonthReverse('a');
        return {both,conflict,after:snapshot(merged),valid:validBackup(pick())};
      })()`);
      const expected={goal:1300,cash:25,status:[['a','accepted'],['b','conflict']],used:120000};
      assert.deepEqual(result,{both:[expected,expected],conflict:true,after:{goal:100,cash:25,status:[['a','reversed'],['b','conflict']],used:0},valid:true});
    }],
    ['A1 falha de armazenamento preserva sobra e saldo da meta', async () => {
      await fresh();await login('A');
      const result=await ev(`(()=>{
        const F=finInit(),ac=F.acc[0].id;F.tx=[{id:'a1-in',t:'Receita',k:'in',v:2000,d:T,ac}];
        F.goals=[{id:'g',n:'Meta',saved:50,target:5000}];S.view='financas';S.ftab='orc';S.fmo=0;render();
        const start=Storage.prototype.setItem,form=$('#fclosemonth');
        try{Storage.prototype.setItem=function(k,v){if(k==='hub-v1')throw Error('indisponível');return start.call(this,k,v)};form.requestSubmit()}finally{Storage.prototype.setItem=start}
        const after={entries:F.closings.length,saved:closingGoalBalance(F.goals[0]),present:form.isConnected};
        form.requestSubmit();return {after,retry:closingGoalBalance(F.goals[0]),entries:F.closings.length};
      })()`);
      assert.deepEqual(result,{after:{entries:0,saved:50,present:true},retry:2050,entries:1});
    }],
    ['A2 privacidade mascara valores de fechamento, cartão e parcela fora de foco', async () => {
      await fresh();await login('A');await b.send('Emulation.setFocusEmulationEnabled',{enabled:true});
      const result=await ev(`(()=>{
        const F=finInit(),ac=F.acc[0].id;F.acc.push({id:'card-a2',n:'Cartão A2',ty:'card',close:15,due:22,lim:7000});
        F.tx=[{id:'a2-in',t:'Receita',k:'in',v:2000,d:T,ac},{id:'a2-part',t:'Compra',k:'out',v:100,d:ds(add(today,1)),ac:'card-a2',pc:{g:'a2g',i:1,n:2}}];
        S.view='financas';S.ftab='orc';S.fmo=0;render();$('#pv').click();
        const inClose=$('#fclosemonth input[name=v]'),masked=el=>getComputedStyle(el).webkitTextSecurity;
        const blur=masked(inClose);inClose.focus();const focus=masked(inClose);inClose.blur();
        S.ftab='contas';render();const limit=$('[data-acc-edit="card-a2"] [name=lim]');const amount=$('[data-part-adjust="a2-part"] [name=v]');
        for(const input of [limit,amount]){let el=input;while(el){if(el.tagName==='DETAILS')el.open=true;el=el.parentElement}}
        const held=[masked(limit),masked(amount)],values=[limit.value,amount.value];$('#pv').click();
        return {blur,focus,held,values,restored:masked($('[data-acc-edit="card-a2"] [name=lim]'))};
      })()`);
      assert.deepEqual(result,{blur:'disc',focus:'none',held:['disc','disc'],values:['7000','100,00'],restored:'none'});
    }],
    ['Finanças gerencia parcelas e pausa recorrência sem apagar o histórico', async () => {
      await fresh();await login('A');
      const result=await ev(`(()=>{
        today=new Date(2026,0,12,12);T=ds(today);const F=finInit();
        const ac=F.acc[0].id,card={id:'card',n:'Cartão',ty:'card',close:10,due:20};F.acc.push(card);
        F.rec=[{id:'rec',k:'out',t:'Internet',v:70,cat:'Serviços',ac,day:20,ini:'2025-12-01'}];
        F.tx=[{id:'old',t:'Compra',k:'out',v:40,d:'2026-01-02',cat:'Compras',ac:'card',pc:{g:'buy',i:1,n:3}},{id:'next',t:'Compra',k:'out',v:40,d:'2026-02-02',cat:'Compras',ac:'card',pc:{g:'buy',i:2,n:3}},{id:'last',t:'Compra',k:'out',v:40,d:'2026-03-02',cat:'Compras',ac:'card',pc:{g:'buy',i:3,n:3}},{id:'paid',t:'Pagamento',k:'tr',v:40,d:'2026-01-11',ac,to:'card',invoice:'2026-01-10'}];
        recReminder(F.rec[0]);S.view='financas';S.ftab='contas';render();
        const submit=(sel,values)=>{const form=$(sel);for(const [key,value] of Object.entries(values)){form.elements[key].value=value;form.elements[key].dispatchEvent(new Event('input',{bubbles:true}))}form.requestSubmit()};
        submit('[data-rec-schedule=rec]',{action:'skip'});
        submit('[data-rec-schedule=rec]',{action:'pause',until:'2026-02-24'});
        const r=F.rec[0],reminder=S.events.find(e=>e.finRec==='rec'),next=nextRecurringDate(r),dates=dues(90).filter(x=>x.rec==='rec').map(x=>x.d);
        const agenda=[hit(reminder,'2026-01-20'),hit(reminder,'2026-02-20'),hit(reminder,'2026-03-20')];
        submit('[data-part-adjust=next]',{v:'45',d:'2026-02-03'});
        submit('[data-part-refund=old]',{v:'15',d:'2026-01-05'});
        const amount=invoice(card,1).tot,old=F.tx.find(t=>t.id==='old').v;
        const cancel=$('[data-part-cancel=buy]');cancel.querySelector('[type=checkbox]').checked=true;cancel.requestSubmit();
        return {next,dates,agenda,amount,old,future:F.tx.filter(t=>t.pc?.g==='buy'&&t.d>T).length,refund:F.tx.find(t=>t.refundOf==='old')?.v};
      })()`);
      assert.deepEqual(result,{next:'2026-03-20',dates:['2026-03-20'],agenda:[false,false,true],amount:30,old:40,future:0,refund:15});
    }],
    ['Finanças concilia parcela deslocada e pagamento de fatura sem criar novos registros', async () => {
      await fresh();await login('A');
      const result=await ev(`(()=>{
        today=new Date(2026,0,12,12);T=ds(today);const F=finInit();const ac=F.acc[0].id;F.acc.push({id:'card',n:'Cartão',ty:'card'});
        F.tx=[{id:'part',t:'Curso de idiomas',k:'out',v:40,d:'2026-01-03',cat:'Educação',ac:'card',pc:{g:'g',i:1,n:3}},{id:'payment',t:'Pagamento da fatura',k:'tr',v:100,d:'2026-01-10',ac,to:'card',invoice:'2025-12-28'}];
        S.view='financas';S.ftab='regras';S.fac='card';
        const csv=['Data;Descrição;Valor','04/01/2026;Curso de idiomas Parcela 01/03;-40','10/01/2026;Pagamento da fatura;100'].join(String.fromCharCode(10));
        prepCSV(csv,'fatura.csv');render();
        const rows=impRows().rows,held=rows.every(row=>!statementImports(row)),compare=document.querySelectorAll('.imp-compare').length;
        IMP.review=Object.fromEntries(rows.map(row=>[row.index,'tx:'+row.matches[0]?.id]));render();$('[data-a=impgo]').click();
        const stored=F.tx.map(t=>[t.id,t.checked,t.statementDate]);
        prepCSV(csv,'fatura.csv');const replay=impRows().rows.filter(statementImports).length;
        S.fac=ac;const bank=['Data;Descrição;Valor','10/01/2026;Pagamento da fatura;-100'].join(String.fromCharCode(10));
        prepCSV(bank,'conta.csv');const debit=impRows().rows[0];
        IMP.review={[debit.index]:'tx:payment'};render();$('[data-a=impgo]').click();
        prepCSV(bank,'conta.csv');const secondReplay=impRows().rows.filter(statementImports).length;
        return {held,compare,stored,replay,secondReplay,refs:F.tx.find(t=>t.id==='payment').statementRefs.length,total:F.tx.length};
      })()`);
      assert.deepEqual(result,{held:true,compare:2,stored:[['part',true,'2026-01-04'],['payment',true,'2026-01-10']],replay:0,secondReplay:0,refs:1,total:2});
    }],
    ['Finanças separa compromissos previstos, orçamento realizado e revisão do mês', async () => {
      await fresh();await login('A');
      const result=await ev(`(()=>{
        today=new Date(2026,0,12,12);T=ds(today);const F=finInit(),ac=F.acc[0].id;
        F.tx=[{id:'a',k:'out',t:'Mercado',v:50,cat:'Alimentação',ac,d:T},{id:'b',k:'out',t:'Mercado',v:50,cat:'Alimentação',ac,d:T},{id:'r',k:'out',t:'Aporte',v:30,cat:'Reserva',ac,d:T},{id:'f',k:'out',t:'Compra prevista',v:25,cat:'Alimentação',ac,d:'2026-01-22'}];
        F.rec=[{id:'rec',k:'out',t:'Feira',v:20,cat:'Alimentação',ac,day:25,ini:T}];
        F.bills=[{id:'bill',n:'Internet',v:15,day:28}];setBudget('Alimentação','2026-01',200);
        S.view='financas';S.ftab='geral';render();const overview=$('#finance-commitments').textContent;
        S.ftab='orc';render();const budget=$('.gg').textContent,closing=$('.fin-month-check').textContent;
        $('[data-a=closing-pending]').click();return {overview,budget,closing,rows:[...document.querySelectorAll('[data-tx-row]')].map(x=>x.dataset.txRow)};
      })()`);
      assert.match(result.overview,/60,00.*sem conta vinculada/s);assert.match(result.budget,/100,00 gastos.*45,00.*55,00/s);
      assert.match(result.closing,/3 lançamentos a conferir.*1 grupo.*30,00/s);assert.deepEqual(result.rows.sort(),['a','b','r']);
    }],
    ['F6 Finanças cabe nas larguras, temas e densidades e mantém a seção ativa visível', async () => {
      await fresh(); await login('A');
      const widths=[1440,320,375,430,860,1024,1280];
      const problems=[];
      try {
        await ev(`S.view='financas';S.ftab='lanc';S.fin.tx=[{id:'large',t:'Farmácia '+('DescriçãoLonga'.repeat(10)),v:12345678.9,k:'out',d:T,cat:'Saúde',ac:'main'}];render()`);
        for(const width of widths){
          await b.send('Emulation.setDeviceMetricsOverride',{width,height:810,deviceScaleFactor:1,mobile:width<=860});
          await ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
          for(const theme of ['light','dark']) for(const density of ['conf','comp']){
            const bad=await ev(`(()=>{
              S.themeMode='${theme}';S.dens='${density}';applyTheme();applyA11y();render({save:false});
              const bad=[];
              const check=tab=>{
                const rail=$('#main .ftabs'),active=rail.querySelector('[aria-pressed=true]');
                const frame=rail.getBoundingClientRect(),button=active.getBoundingClientRect();
                if(button.left<frame.left-1||button.right>frame.right+1)bad.push(tab+' oculto');
                const overflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;
                if(overflow>1)bad.push(tab+' excede a página em '+overflow+' px');
              };
              const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
              const context=canvas.getContext('2d',{willReadFrequently:true});
              const luminance=color=>{
                context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);
                const rgb=context.getImageData(0,0,1,1).data;
                return [0.2126,0.7152,0.0722].reduce((n,weight,i)=>{const v=rgb[i]/255;return n+weight*(v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4)},0);
              };
              const contrast=(text,background)=>{
                const a=luminance(getComputedStyle($(text)).color),b=luminance(getComputedStyle($(background)).backgroundColor);
                const ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
                if(ratio<4.5)bad.push(text+' contraste '+ratio.toFixed(2));
              };
              check(S.ftab);
              for(const [tab] of FTABS){
                $('.ftabs [data-id='+tab+']').click();check(tab);
                if(tab==='geral'){
                  contrast('.finance-balance h2','.finance-balance');
                  contrast('.finance-balance .neg','.finance-balance');
                }
                if(tab==='lanc'){
                  contrast('.tx-open','.tx-row');
                  contrast('.tx-amount strong','.tx-row');
                }
              }
              $('.ftabs [data-id=lanc]').click();
              return bad;
            })()`);
            problems.push(...bad.map(issue=>[width,theme,density,issue]));
          }
        }
        assert.deepEqual(problems,[]);
        await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:810,deviceScaleFactor:1,mobile:true});
        const enlarged=await ev(`(()=>{
          document.documentElement.style.fontSize='200%';
          return FTABS.map(([tab])=>{
            $('.ftabs [data-id='+tab+']').click();
            const rail=$('.ftabs'),active=$('.ftabs [aria-pressed=true]');
            const frame=rail.getBoundingClientRect(),button=active.getBoundingClientRect();
            return {tab,hidden:button.left<frame.left-1||button.right>frame.right+1,
              overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
          }).filter(({hidden,overflow})=>hidden||overflow>1);
        })()`);
        assert.deepEqual(enlarged,[]);
      } finally {
        await ev("document.documentElement.style.fontSize=''");
        await b.send('Emulation.clearDeviceMetricsOverride');
      }
    }],
    ['F6 extrato valida lista longa, filtros, teclado, privacidade e leitura local', async () => {
      await fresh(); await login('A');
      await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:830,deviceScaleFactor:1,mobile:true});
      try {
        const empty=await ev(`(()=>{S.view='financas';S.ftab='lanc';render();return $('#txlist').textContent})()`);
        assert.match(empty,/Nenhum lançamento neste mês/);
        const list=await ev(`(()=>{
          const F=finInit();F.tx=Array.from({length:96},(_,i)=>({id:'f6-'+i,t:i?'Despesa local '+i:'Farmácia '+('DescriçãoLonga'.repeat(10)),k:'out',v:i?10:12345678.9,d:T,cat:'Saúde',ac:F.acc[0].id}));render();
          const rows=()=>document.querySelectorAll('[data-tx-row]').length;
          const pageSize=rows();$('#txlist [data-a=pgmore]').click();const expanded=rows();
          $('#fq').value='sem correspondência';$('#fq').dispatchEvent(new Event('input',{bubbles:true}));
          const noResults=$('#txlist').textContent;
          $('#txlist [data-a=fclr]').click();
          $('[data-tx-bulk] > summary').click();
          const bulk=$('[data-tx-bulk-submit]').textContent;
          $('[data-tx-bulk] > summary').click();
          $('#pv').click();
          const hidden=$('#txlist').textContent;
          $('[data-a=edtx][data-id=f6-0]').focus();
          return {pageSize,expanded,noResults,bulk,hidden:hidden.includes('•••••')&&!hidden.includes('12.345.678,90')};
        })()`);
        assert.equal(list.pageSize,80); assert.equal(list.expanded,96);
        assert.match(list.noResults,/Nenhum lançamento combina com os filtros/);
        assert.match(list.bulk,/96 listados/); assert.ok(list.hidden);
        const enter=async()=>{for(const type of ['keyDown','keyUp'])await b.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r',unmodifiedText:'\r'}:{})})};
        await enter();
        const detail=await ev(`(()=>{
          document.documentElement.style.fontSize='200%';
          const input=$('#ffin [name=v]');
          return {focus:document.activeElement.id,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,masked:getComputedStyle(input).webkitTextSecurity};
        })()`);
        assert.deepEqual(detail,{focus:'tx-detail-title',overflow:0,masked:'disc'});
        await ev(`$('.tx-detail [data-a=fcancel]').focus()`); await enter();
        assert.equal(await ev('document.activeElement.dataset.id'),'f6-0');
        await ev(`document.documentElement.style.fontSize='';$('.ftabs [data-id=geral]').focus()`); await enter();
        assert.ok(await ev(`!!$('.finance-balance-main')&&!!$('.finance-dues')&&!!$('.finance-month-flow')`));
        await ev(`$('.ftabs [data-id=lanc]').focus()`); await enter();
        await ev(`localStorage.setItem('__offline','1')`); await open();
        assert.ok(await ev(`S.view='financas'; render({save:false}); $('#gate').hidden&&S.ftab==='lanc'&&!!$('[data-tx-row=f6-0]')&&PRIV`));
        assert.match(await ev('synText()'),/sem conexão/);
      } finally {
        await ev(`document.documentElement.style.fontSize='';localStorage.removeItem('__offline');if(PRIV)$('#pv').click()`);
        await b.send('Emulation.clearDeviceMetricsOverride');
      }
    }],
    ['F2 extrato preserva consulta, foco e edição responsiva', async () => {
      await fresh();await login('A');
      try{
        for(const width of [375,1440]){
          await b.send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:width===375});
          const r=await ev(`(()=>{
            S.fin.tx=[{id:'f2-a',t:'Mercado',v:60,k:'out',d:T,cat:'Alimentação',ac:'main',tg:'casa'},{id:'f2-b',t:'Taxi',v:20,k:'out',d:T,cat:'Transporte',ac:'main',tg:'rua'}];
            S.view='financas';S.ftab='lanc';render();
            const tags=$('[data-fin-tag]');tags.value='casa';tags.dispatchEvent(new Event('change',{bubbles:true}));
            const rows=document.querySelectorAll('tr[data-tx-row]').length,button=$('[data-a=edtx][data-id=f2-a]');button.click();
            const detail=$('[data-tx-detail=f2-a]'),focused=document.activeElement.id;
            const widthUsed=$('.tx-workspace').clientWidth/$('.tx-workspace').parentElement.clientWidth;
            const ledgerVisible=getComputedStyle($('.tx-ledger')).display!=='none';
            const form=$('#ffin');form.elements.v.value='64,00';form.requestSubmit();
            return {rows,hasTable:!!$('.tx-table thead'),focused,ledgerVisible,hadDetail:!!detail,tag:$('[data-fin-tag]').value,returned:document.activeElement.dataset.id,value:S.fin.tx[0].v,fullWidth:widthUsed>0.98,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
          })()`);
          assert.deepEqual(r,{rows:1,hasTable:true,focused:'tx-detail-title',ledgerVisible:width===1440,hadDetail:true,tag:'casa',returned:'f2-a',value:64,fullWidth:true,overflow:0});
        }
      }finally{await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['F2.1 Reserva confirma só os aportes selecionados e mantém os saldos', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{
        finInit();
        const tx=(id,t,k,v,cat,extra={})=>({id,t,k,v,cat,d:T,ac:'main',...extra});
        S.fin.tx=[tx('r1','Aplicação para reserva','out',80,'Outros',{tg:'pessoal',shopping:'lista'}),tx('r2','Outra despesa','out',20,'Outros'),tx('r3','Transferência para reserva','tr',15,'Transferência',{to:'other'})];
        S.view='financas';S.ftab='lanc';render();
        const before=finMonth().out,balBefore=bal(S.fin.acc[0]),f=$('#ftxbulk');
        f.elements.cat.value='Reserva';f.requestSubmit();
        const staged=[...document.querySelectorAll('input[name=reservePick]')].map(i=>i.value),untouched=S.fin.tx[0].cat;
        f.querySelector('[value=r1]').checked=true;f.querySelector('[data-a=reserve-confirm]').click();
        const unchangedTotals=before===finMonth().out&&balBefore===bal(S.fin.acc[0]);
        const source=['Data;Descrição;Valor',T+';Aporte para a reserva;-42',T+';Resgate da reserva;25',T+';Dinheiro reservado;-15',T+';Depósito para reserva de hotel;-70'].join(String.fromCharCode(10));
        prepCSV(source,'Extrato');IMP.trRes=true;
        const imported=impRows().rows.map(x=>x.cat);
        const lastMonth=ds(new Date(today.getFullYear(),today.getMonth()-1,10));
        S.fin.tx.push({...tx('old-spend','Mercado','out',200,'Alimentação'),d:lastMonth},{...tx('old-reserve','Aporte','out',100,'Reserva'),d:lastMonth});
        return {average:avgOut3(),staged,untouched,cats:S.fin.tx.slice(0,3).map(t=>t.cat),value:S.fin.tx[0].v,link:S.fin.tx[0].shopping,unchangedTotals,imported};
      })()`);
      assert.deepEqual(r,{average:200,staged:['r1','r2'],untouched:'Outros',cats:['Reserva','Outros','Transferência'],value:80,link:'lista',unchangedTotals:true,imported:['Reserva','Receita','Transferência','Férias']});
    }],
    ['F1 Finanças abre no extrato, guarda a aba e restaura o contexto mensal', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>{
        S.fin.acc=[{id:'main',n:'Principal',ty:'cc',ini:1000},{id:'second',n:'Segunda',ty:'cc',ini:50}];
        document.querySelector('#side [data-v=financas]').click();
        const initial=S.ftab, startsWithList=!!$('#txlist')&&!$('#finance-balance-title');
        $('[data-a=ftab][data-id=geral]').click();
        const navBeforeSummary=!!($('.ftabs').compareDocumentPosition($('#finance-balance-title'))&Node.DOCUMENT_POSITION_FOLLOWING);
        $('[data-a=ftab][data-id=contas]').click();
        const month=$('[data-a=fmn][data-n="-1"]');month.click();
        const account=$('[data-fac]');account.value='second';account.dispatchEvent(new Event('change',{bubbles:true}));
        $('[data-a=fvw][data-id=ano]').click();
        const yearAccount=$('[data-fac-year]');if(yearAccount){yearAccount.value='main';yearAccount.dispatchEvent(new Event('change',{bubbles:true}))}
        $('[data-a=fvw][data-id=mes]').click();
        return {initial,startsWithList,navBeforeSummary,hasYearAccount:!!yearAccount,tab:S.ftab,month:S.fmo,account:$('[data-fac]').value,persisted:JSON.parse(localStorage.getItem('hub-ui')).ftab};
      })()`);
      assert.deepEqual(r,{initial:'lanc',startsWithList:true,navBeforeSummary:true,hasYearAccount:true,tab:'contas',month:-1,account:'second',persisted:'contas'});
      await open();await waitFor("document.querySelector('.ftabs [aria-pressed=true]')?.dataset.id==='contas'",'subaba de Finanças restaurada');
      assert.deepEqual(await ev("({month:S.fmo,account:document.querySelector('[data-fac]').value})"),{month:-1,account:'second'});
      const linked=await ev(`(()=>{
        S.fin.tx.unshift({id:'f1-search',t:'Despesa única F1',k:'out',v:84,cat:'Serviços',d:T,ac:'main'});
        $('[data-a=fvw][data-id=ano]').click();
        const q=$('#q');q.value='Despesa única F1';q.dispatchEvent(new Event('input',{bubbles:true}));
        $('[data-a=finance-review-open][data-id=f1-search]').click();
        return {tab:S.ftab,period:S.fvw,title:$('#ffin [name=t]').value,selected:FED};
      })()`);
      assert.deepEqual(linked,{tab:'lanc',period:'mes',title:'Despesa única F1',selected:'f1-search'});
      await b.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
      try{
        assert.ok(await ev(`(()=>{
          S.view='dash';render({save:false});S.view='financas';render({save:false});
          const rail=$('.ftabs').getBoundingClientRect(),active=$('.ftabs [aria-pressed=true]').getBoundingClientRect();
          return active.left>=rail.left-1&&active.right<=rail.right+1;
        })()`),'aba ativa deve ficar visível na faixa de navegação móvel');
      }finally{await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['simulador pela interface não salva nem sincroniza', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.view='financas';S.ftab='analise';render();const f=document.querySelector('#purchase-simulator');f.elements.amount.value='120,00';f.elements.parts.value='2';const before=JSON.stringify(S.fin),local=localStorage.getItem('hub-v1'),sync=localStorage.getItem('hub-sync');f.requestSubmit();return {unchanged:before===JSON.stringify(S.fin),local:local===localStorage.getItem('hub-v1'),sync:sync===localStorage.getItem('hub-sync'),text:document.querySelector('[data-simulation-result]').textContent}})()`);assert.ok(r.unchanged&&r.local&&r.sync);assert.match(r.text,/Base: saldo final/);
    }],
    ['revisão de assinaturas sinaliza atenção e não cria cobranças', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.fin.rec=[{id:'r',t:'Serviço',k:'out',cat:'Assinaturas',v:20,day:1,ini:T,ac:S.fin.acc[0].id}];S.view='financas';S.ftab='contas';S.fvw='mes';render();const count=S.fin.tx.length;document.querySelector('[data-a=sub-review]').click();const flagged=attention().some(x=>x.k==='sub'&&x.id==='r');document.querySelector('[data-a=sub-task]').click();const task=S.tasks.some(x=>x.t==='Revisar assinatura: Serviço');document.querySelector('[data-a=sub-review]').click();return {flagged,task,pending:S.fin.rec[0].review,count,balance:S.fin.tx.length,text:document.querySelector('#main').innerText}})()`);assert.ok(r.flagged&&r.task&&!r.pending);assert.strictEqual(r.balance,r.count);assert.match(r.text,/por ano/);
    }],
    ['visão de projetos usa vínculos e despesas existentes', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Tarefa',done:false,pj:'Casa',mt:'g'}];S.notes=[{id:'n',t:'Nota',b:'',c:'g'}];S.metas=[{id:'g',t:'Meta',kr:[]}];S.fin.tx=[{id:'x',k:'out',v:42,d:T,pj:'Casa',ac:S.fin.acc[0].id}];S.lnk=[];lkSet('tk:t','nt:n',true);S.view='tarefas';render();const text=document.querySelector('#main').innerText;return {text,notes:S.notes.length,tx:S.fin.tx.length,html:document.querySelector('#main').innerHTML}})()`);assert.match(r.text,/Casa/);assert.match(r.html,/42,00/);assert.match(r.html,/Nota/);assert.strictEqual(r.notes,1);assert.strictEqual(r.tx,1);
    }],
    ['histórico sincronizado limita registros e não guarda nomes ou valores', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.history=[];for(let i=0;i<102;i++)auditLog('reviewStart');const all=auditRead(),html=auditPanel();return {n:all.length,keys:Object.keys(all[0]).sort(),html}})()`);assert.strictEqual(r.n,100);assert.deepStrictEqual(r.keys,['at','id','type']);assert.match(r.html,/sincronizado/);
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
    ['alteração de prazo em lote exige prévia e mantém planejamento', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'a',t:'Tarefa',done:false,due:'2030-01-01',hd:'2030-01-02',bk:{d:'2030-01-02',h:'10:00'}},{id:'r',t:'Recorrente',done:false,rc:'w',due:'2030-01-01'}];S.view='tarefas';render();let f=document.querySelector('#bulk-due');f.querySelector('[name=task][value=a]').checked=true;f.elements.date.value='2030-03-01';f.querySelector('[data-a=bulk-due-preview]').click();const preview=f.querySelector('[data-bulk-preview]').textContent,disabled=f.querySelector('[value=r]').disabled,before=S.tasks[0].due;f.querySelector('[data-a=bulk-due-apply]').click();return {preview,disabled,before,task:S.tasks[0],rec:S.tasks[1]}})()`);assert.strictEqual(r.before,'2030-01-01');assert.ok(r.disabled);assert.match(r.preview,/prazo anterior/);assert.strictEqual(r.task.due,'2030-03-01');assert.strictEqual(r.task.hd,'2030-01-02');assert.strictEqual(r.task.bk.h,'10:00');assert.strictEqual(r.rec.due,'2030-01-01');
    }],
    ['encaixe da agenda exige confirmação e invalida sugestão alterada', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Tarefa',done:false,dur:30}];S.events=[];S.view='agenda';S.mode='day';S.dy=1;render();document.querySelector('[data-a=fit-propose]').click();const before=!!S.tasks[0].bk,h=FIT.h;S.events.push({id:'e',t:'Conflito',d:FIT.d,h:FIT.h,e:hm(mm(FIT.h)+30),c:'g'});document.querySelector('[data-a=fit-confirm]').click();const invalid=!S.tasks[0].bk;document.querySelector('[data-a=fit-propose]').click();const next=FIT.h;document.querySelector('[data-a=fit-confirm]').click();return {before,invalid,h,next,bk:S.tasks[0].bk}})()`);assert.ok(!r.before&&r.invalid);assert.notStrictEqual(r.h,r.next);assert.strictEqual(r.bk.h,r.next);
    }],
    ['modelo de tarefa criado offline sobrevive à recarga e reconexão', async () => {
      await fresh();await login('A');await ev('localStorage.setItem("__offline","1")');await open();const made=await ev(`(()=>{S.view='tarefas';render();const f=document.querySelector('#task-template');f.elements.template.value='viagem';f.requestSubmit();const t=S.tasks.find(t=>t.t==='Planejar viagem');return {id:t.id,sub:t.sub.map(x=>x.id),valid:validBackup(pick())}})()`);await open();const local=await ev(`S.tasks.find(t=>t.id===${JSON.stringify(made.id)})`);assert.ok(made.valid&&local);assert.deepStrictEqual(local.sub.map(x=>x.id),made.sub);await ev('localStorage.removeItem("__offline")');await open();await waitFor('FB.on&&SYS.s==="ok"','reconexão do modelo');assert.ok(await ev(`S.tasks.some(t=>t.id===${JSON.stringify(made.id)})`));
    }],
    ['compra associa despesa existente sem alterar valor ou duplicar', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[{id:'i',t:'Arroz',q:'',qty:2,actualCents:1700,done:true}]}];S.fin.tx=[{id:'old',k:'out',t:'Mercado',v:34,d:T,ac:S.fin.acc[0].id,cat:'Alimentação'}];S.view='notas';render();document.querySelector('[data-a=shopping-expense]').click();const f=document.querySelector('#fqa'),options=[...f.elements.shoppingAssociation.options].map(x=>x.textContent).join(' ');f.elements.shoppingAssociation.value='old';f.querySelector('[data-a=shopping-associate]').click();return {options,tx:S.fin.tx,notes:S.notes.length}})()`);assert.match(r.options,/Possível duplicata/);assert.strictEqual(r.tx.length,1);assert.strictEqual(r.tx[0].v,34);assert.strictEqual(r.tx[0].cat,'Alimentação');assert.strictEqual(r.tx[0].shopping,'l');assert.deepStrictEqual(r.tx[0].shoppingItems,['i']);
    }],
    ['compras parciais selecionam itens e pedem confirmação ao repetir', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[{id:'a',t:'Arroz',q:'',qty:2,actualCents:500,done:true},{id:'b',t:'Leite',q:'',qty:1,actualCents:300,done:true}]}];S.fin.tx=[];S.view='notas';render();document.querySelector('[data-a=shopping-expense]').click();let f=document.querySelector('#fqa'),checks=f.querySelectorAll('[name=shoppingItem]');checks[1].checked=false;checks[1].dispatchEvent(new Event('change',{bubbles:true}));const value=f.elements.v.value;f.requestSubmit();const first=S.fin.tx[0];document.querySelector('[data-a=shopping-expense]').click();f=document.querySelector('#fqa');f.requestSubmit();const blocked=S.fin.tx.length,warning=!f.querySelector('[data-shopping-repeat]').hidden;f.elements.shoppingRepeatConfirmed.checked=true;f.requestSubmit();return {value,first,blocked,warning,second:S.fin.tx[0],count:S.fin.tx.length}})()`);assert.strictEqual(r.value,'10,00');assert.deepStrictEqual(r.first.shoppingItems,['a']);assert.strictEqual(r.blocked,1);assert.ok(r.warning);assert.strictEqual(r.count,2);assert.deepStrictEqual(r.second.shoppingItems,['a','b']);
    }],
    ['compra rejeita itens alterados enquanto a confirmação está aberta', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[{id:'a',t:'Arroz',q:'',qty:2,actualCents:500,done:true}]}];S.fin.tx=[];S.view='notas';render();document.querySelector('[data-a=shopping-expense]').click();const f=document.querySelector('#fqa');S.notes[0].items[0].actualCents=900;f.requestSubmit();return {count:S.fin.tx.length,open:!document.querySelector('#qa').classList.contains('hide')}})()`);assert.strictEqual(r.count,0);assert.ok(r.open);
    }],
    ['compra avisa sobre despesa semelhante sem impedir nova compra legítima', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[{id:'a',t:'Arroz',q:'',qty:2,actualCents:500,done:true}]}];S.fin.tx=[{id:'old',k:'out',t:'Mercado',v:10,d:T,ac:S.fin.acc[0].id,cat:'Alimentação'}];S.view='notas';render();document.querySelector('[data-a=shopping-expense]').click();const f=document.querySelector('#fqa'),warn=f.querySelector('[data-shopping-repeat]').textContent;f.requestSubmit();const before=S.fin.tx.length;f.elements.shoppingRepeatConfirmed.checked=true;f.requestSubmit();return {warn,before,after:S.fin.tx.length,old:S.fin.tx.find(x=>x.id==='old')}})()`);assert.match(r.warn,/mesmo valor/);assert.strictEqual(r.before,1);assert.strictEqual(r.after,2);assert.strictEqual(r.old.shopping,undefined);
    }],
    ['associação rejeita lançamento alterado após abertura', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[]}];S.fin.tx=[{id:'old',k:'out',t:'Mercado',v:10,d:T,ac:S.fin.acc[0].id,cat:'Alimentação'}];S.view='notas';render();document.querySelector('[data-a=shopping-expense]').click();const f=document.querySelector('#fqa');f.elements.shoppingAssociation.value='old';S.fin.tx[0].v=25;f.querySelector('[data-a=shopping-associate]').click();return {tx:S.fin.tx[0],open:!document.querySelector('#qa').classList.contains('hide')}})()`);assert.strictEqual(r.tx.v,25);assert.strictEqual(r.tx.shopping,undefined);assert.ok(r.open);
    }],
    ['compra parcial offline preserva sessão e itens ao reconectar', async () => {
      await fresh();await login('A');await ev('localStorage.setItem("__offline","1")');await open();const made=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[{id:'a',t:'Arroz',q:'',qty:2,actualCents:500,done:true},{id:'b',t:'Leite',q:'',qty:1,actualCents:300,done:true}]}];S.fin.tx=[];S.view='notas';render();document.querySelector('[data-a=shopping-expense]').click();const f=document.querySelector('#fqa'),c=f.querySelector('[name=shoppingItem][value=b]');c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));f.requestSubmit();return {id:S.fin.tx[0].id,items:S.fin.tx[0].shoppingItems,valid:validBackup(pick())}})()`);await open();assert.ok(await ev(`S.fin.tx.some(t=>t.id===${JSON.stringify(made.id)})`));await ev('localStorage.removeItem("__offline")');await open();await waitFor('FB.on&&SYS.s==="ok"','reconexão de compra');const r=await ev(`S.fin.tx.filter(t=>t.id===${JSON.stringify(made.id)})`);assert.ok(made.valid);assert.deepStrictEqual(made.items,['a']);assert.strictEqual(r.length,1);assert.deepStrictEqual(r[0].shoppingItems,['a']);
    }],
    ['campo de valor da compra pode ser apagado e editado', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[{id:'a',t:'Arroz',q:'',qty:2,actualCents:500,done:true}]}];S.view='notas';render();document.querySelector('[data-a=shopping-expense]').click();const f=document.querySelector('#fqa'),v=f.elements.v;v.value='';v.dispatchEvent(new Event('input',{bubbles:true}));return v.value})()`);assert.strictEqual(r,'');
    }],
    ['arquivar meta pausa tarefas acompanhadas e respeita outras pausas', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'d',t:'Direta',done:false,mt:'g1',due:T,hd:T,bk:{d:T,h:'10:00'}},{id:'p',t:'Projeto',done:false,pj:'Casa',due:T},{id:'tag',t:'Etiqueta',done:false,tg:'foco',due:T},{id:'link',t:'Ligação',done:false,due:T},{id:'own',t:'Individual',done:false,mt:'g1',archived:true},{id:'finished',t:'Histórico',done:true,mt:'g1',dd:T}];S.metas=[{id:'g1',t:'Meta 1',ini:T,kr:[{id:'k1',ty:'pj',ref:'Casa'},{id:'k2',ty:'tg',ref:'foco'}]},{id:'g2',t:'Meta 2',ini:T,kr:[{id:'k3',ty:'pj',ref:'Casa'}]}];S.lnk=[];lkSet('mt:g1','tk:link',true);S.view='metas';render();document.querySelector('[data-a=meta-archive][data-id=g1]').click();document.querySelector('[data-a=meta-archive][data-id=g2]').click();const paused=S.tasks.map(t=>[t.id,taskPaused(t)]),blocks=blocksOn(T).length,alerts=attention().filter(x=>x.k==='tk').map(x=>x.id),valid=validBackup(pick());S.view='arquivados';render();document.querySelector('[data-a=meta-archive][data-id=g1]').click();const middle=S.tasks.map(t=>[t.id,taskPaused(t)]);document.querySelector('[data-a=meta-archive][data-id=g2]').click();return {paused,blocks,alerts,valid,middle,after:S.tasks.map(t=>[t.id,taskPaused(t)]),link:lkOf('mt:g1').includes('tk:link'),history:S.tasks.find(t=>t.id==='finished').done}})()`);assert.deepStrictEqual(r.paused,[['d',true],['p',true],['tag',true],['link',true],['own',true],['finished',false]]);assert.strictEqual(r.blocks,0);assert.deepStrictEqual(r.alerts,[]);assert.ok(r.valid&&r.link&&r.history);assert.deepStrictEqual(r.middle,[['d',false],['p',true],['tag',false],['link',false],['own',true],['finished',false]]);assert.ok(r.after.find(x=>x[0]==='own')[1]);assert.ok(!r.after.find(x=>x[0]==='p')[1]);
    }],
    ['arquivar recorrente preserva histórico e impede gerar ocorrência pausada', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'r',t:'Recorrente',p:'m',done:false,rc:'w',due:T},{id:'old',t:'Anterior',p:'m',done:true,dd:T,rc:'w',sp:true}];S.view='tarefas';render();document.querySelector('[data-a=task-archive][data-id=r]').click();const x=document.createElement('input');x.type='checkbox';x.checked=true;x.dataset.a='tog';x.dataset.id='r';document.body.append(x);x.dispatchEvent(new Event('change',{bubbles:true}));x.remove();const pausedCount=S.tasks.length,done=S.tasks[0].done;S.view='arquivados';render();document.querySelector('[data-a=task-archive][data-id=r]').click();S.view='tarefas';render();const c=document.querySelector('[data-a=tog][data-id=r]');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));return {pausedCount,done,after:S.tasks.length,history:S.tasks.find(t=>t.id==='old').done}})()`);assert.strictEqual(r.pausedCount,2);assert.strictEqual(r.done,false);assert.strictEqual(r.after,3);assert.ok(r.history);
    }],
    ['backup e mesclagem preservam pausa de meta e alterações independentes', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Tarefa',done:false,mt:'g',due:T}];S.metas=[{id:'g',t:'Meta',kr:[],ini:T}];S.notes=[{id:'n',t:'Nota',b:'',c:'g'}];S.view='metas';render();const base=JSON.parse(JSON.stringify(pick()));document.querySelector('[data-a=meta-archive][data-id=g]').click();const local=JSON.parse(JSON.stringify(pick())),remote=JSON.parse(JSON.stringify(base));remote.notes[0].t='Nota alterada';const merged=merge3(base,local,remote,[]);return {valid:validBackup(merged),goal:merged.metas[0],note:merged.notes[0],task:merged.tasks[0]}})()`);assert.ok(r.valid&&r.goal.archived);assert.deepStrictEqual(r.goal.pausedTaskIds,['t']);assert.strictEqual(r.note.t,'Nota alterada');assert.strictEqual(r.task.id,'t');
    }],
    ['limpar concluídas mantém tarefas arquivadas e histórico', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'a',t:'Concluída arquivada',p:'m',done:true,archived:true,dd:T},{id:'b',t:'Concluída visível',p:'m',done:true,dd:T}];S.view='tarefas';render();document.querySelector('[data-a=clear]').click();return S.tasks.map(t=>t.id)})()`);assert.deepStrictEqual(r,['a']);
    }],
    ['mesclagem pausa próxima recorrência criada em outro aparelho', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const t={id:'r',t:'Recorrente',p:'m',done:false,rc:'w',due:T},base={tasks:[t],metas:[{id:'g',t:'Meta',ini:T,kr:[]}],lnk:[]},l=JSON.parse(JSON.stringify(base)),remote=JSON.parse(JSON.stringify(base));l.tasks[0].archived=true;remote.tasks[0].done=true;remote.tasks[0].sp=true;remote.tasks.push({...remote.tasks[0],id:'new',seriesId:'r',done:false,sp:false});const merged=merge3(base,l,remote,[]);S.tasks=merged.tasks;S.metas=merged.metas;const paused=taskPaused(S.tasks.find(t=>t.id==='new'));S.tasks.find(t=>t.id==='r').archived=false;return {paused,resumed:!taskPaused(S.tasks.find(t=>t.id==='new')),valid:validBackup({...pick(),tasks:S.tasks,events:[]})}})()`);assert.ok(r.paused&&r.resumed&&r.valid);
    }],
    ['restauração de backup preserva meta arquivada e pausa', async () => {
      await fresh();await login('A');await ev(`(()=>{S.tasks=[{id:'t',t:'Tarefa',p:'m',done:false,mt:'g'}];S.metas=[{id:'g',t:'Meta',ini:T,kr:[],archived:true,pausedTaskIds:['t']}];const data=JSON.stringify(pick());S.tasks=[];S.metas=[];S.view='backup';render();const f=document.querySelector('#bkfile'),dt=new DataTransfer();dt.items.add(new File([data],'backup.json',{type:'application/json'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await ev(backupDecision);
      await waitFor("document.querySelector('#bkmsg')?.textContent.trim()", 'resultado da restauração');
      const r=await ev(`({paused:taskPaused(S.tasks.find(t=>t.id==='t')),archived:S.metas[0]?.archived,msg:document.querySelector('#bkmsg').textContent})`);
      assert.ok(r.paused&&r.archived);assert.match(r.msg,/restaurado/i);
    }],
    ['compras preservam sessão ao arquivar e restaurar lista e backup', async () => {
      await fresh();await login('A');const r=await ev(`(async()=>{S.notes=[{id:'l',kind:'shopping',t:'Mercado',b:'',c:'g',items:[{id:'i',t:'Arroz',q:'',done:true}]}];S.fin.tx=[{id:'shop_s',k:'out',t:'Compra',v:12,d:T,ac:S.fin.acc[0].id,cat:'Alimentação',shopping:'l',shoppingItems:['i']}];S.view='notas';render();document.querySelector('[data-a=note-archive][data-id=l]').click();const archived=S.notes[0].archived,count=S.fin.tx.length;S.view='arquivados';render();document.querySelector('[data-a=note-archive][data-id=l]').click();const data=JSON.stringify(pick());S.notes=[];S.fin.tx=[];S.view='backup';render();const f=document.querySelector('#bkfile'),dt=new DataTransfer();dt.items.add(new File([data],'backup.json',{type:'application/json'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));await ${backupDecision};return {archived,count,note:S.notes[0],tx:S.fin.tx,msg:document.querySelector('#bkmsg').textContent}})()`);assert.ok(r.archived&&!r.note.archived);assert.strictEqual(r.count,1);assert.strictEqual(r.tx.length,1);assert.strictEqual(r.tx[0].shopping,'l');assert.deepStrictEqual(r.tx[0].shoppingItems,['i']);assert.match(r.msg,/restaurado/i);
    }],
    ['mesclagem deduplica mesma sessão sem descartar compras independentes', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const tx={id:'shop_same',k:'out',t:'Compra',v:12,d:T,ac:'main',shopping:'l',shoppingItems:['i']},base={tx:[]},local={tx:[tx,{...tx,id:'shop_a'}]},remote={tx:[tx,{...tx,id:'shop_b'}]},m=merge3(base,local,remote,[]);return m.tx.map(t=>t.id).sort()})()`);assert.deepStrictEqual(r,['shop_a','shop_b','shop_same']);
    }],
    ['meta arquivada mantém pausa em recorrência já iniciada', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'current',seriesId:'root',t:'Recorrente',p:'m',done:false,rc:'w',mt:'g',due:T}];S.metas=[{id:'g',t:'Meta',ini:T,kr:[]}];S.view='metas';render();document.querySelector('[data-a=meta-archive][data-id=g]').click();S.tasks[0].done=true;S.tasks.push({id:'next',seriesId:'root',t:'Recorrente',p:'m',done:false,rc:'w',mt:'g',due:T});const paused=taskPaused(S.tasks[1]),ids=S.metas[0].pausedTaskIds;S.view='arquivados';render();document.querySelector('[data-a=meta-archive][data-id=g]').click();return {paused,ids,resumed:!taskPaused(S.tasks[1])}})()`);assert.ok(r.paused&&r.resumed);assert.ok(r.ids.includes('root'));
    }],
    ['edição antiga não cria tarefa em meta arquivada remotamente', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[];S.metas=[{id:'g',t:'Meta',ini:T,kr:[]}];S.view='metas';render();const f=document.querySelector('[data-meta-task="g"]');f.elements.t.value='Nova tarefa';S.metas[0].archived=true;S.metas[0].pausedTaskIds=[];f.requestSubmit();return {tasks:S.tasks.length,goal:S.metas[0].archived}})()`);assert.strictEqual(r.tasks,0);assert.ok(r.goal);
    }],
    ['simulação de cartão respeita fechamento, vencimento e pagamentos já lançados', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const fin={acc:[{id:'a',ty:'cc',ini:1000},{id:'card',ty:'card',close:20,due:10}],tx:[{id:'pay',k:'tr',ac:'a',to:'card',v:100,d:'2030-03-10',invoice:'2030-02-20'},{id:'other',k:'out',ac:'a',v:950,d:'2030-04-01'}]},before=JSON.stringify(fin),out=simulatePurchase(fin,'a','2030-01-31',30000,2,0,'2030-01-01','card'),leap=simulatedCardCycle('2028-02-29',{close:31,due:10});return {out,leap,same:before===JSON.stringify(fin)}})()`);assert.ok(r.same);assert.deepStrictEqual(r.out.schedule.map(x=>x.closing),['2030-02-20','2030-03-20']);assert.deepStrictEqual(r.out.schedule.map(x=>x.d),['2030-03-10','2030-04-10']);assert.strictEqual(r.out.base,-5000);assert.strictEqual(r.out.scenario,-35000);assert.strictEqual(r.out.minScenario,-35000);assert.deepStrictEqual(r.leap,{closing:'2028-02-29',payment:'2028-03-10'});
    }],
    ['simulador de cartão alerta sobre conta sem vínculo e não salva', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.fin.acc=[{id:'a',n:'Conta',ty:'cc',ini:1000},{id:'card',n:'Cartão',ty:'card',close:20,due:10}];S.view='financas';S.ftab='analise';render();const f=document.querySelector('#purchase-simulator');f.elements.amount.value='120,00';f.elements.parts.value='2';f.elements.card.value='card';const before=JSON.stringify(S.fin),local=localStorage.getItem('hub-v1');f.requestSubmit();return {text:document.querySelector('[data-simulation-result]').textContent,same:before===JSON.stringify(S.fin)&&local===localStorage.getItem('hub-v1')}})()`);assert.ok(r.same);assert.match(r.text,/sem conta de pagamento vinculada/i);assert.match(r.text,/fecha/);
    }],
    ['conferir backup valida sem alterar os dados', async () => {
      await fresh();await login('A');const r=await ev(`(async()=>{S.focus='Preservar';save();S.view='backup';render();const before=JSON.stringify(pick()),stored=localStorage.getItem('hub-v1');async function check(data){const f=document.querySelector('#bkcheck'),dt=new DataTransfer();dt.items.add(new File([data],'backup.json',{type:'application/json'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));return document.querySelector('#bkmsg').textContent}const valid=await check(JSON.stringify(pick())),invalid=await check('{');return {valid,invalid,same:before===JSON.stringify(pick()),stored:stored===localStorage.getItem('hub-v1')}})()`);assert.match(r.valid,/compatível/i);assert.match(r.invalid,/inválido/i);assert.ok(r.same&&r.stored);
    }],
    ['próximo passo do projeto e revisão de nota entram no planejamento', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Ligar',done:false,p:'m'}];S.projects=[{id:'p',t:'Casa',status:'active',refs:[{id:'tk:t'},{id:'nt:n'}]}];S.notes=[{id:'n',t:'Ideia',b:'',c:'p'}];S.view='projetos';render();document.querySelector('[data-a=project-next]').click();S.view='notas';render();const input=document.querySelector('[data-note-review=n]');input.value=T;input.dispatchEvent(new Event('change',{bubbles:true}));const guide=reviewGuide(),valid=validBackup(pick());S.tasks[0].done=true;const done=reviewGuide();return {guide,valid,done,date:S.notes[0].reviewDate,next:S.projects[0].nextTask}})()`);assert.match(r.guide,/Próximo: Ligar/);assert.match(r.guide,/Projeto: Casa/);assert.match(r.guide,/Reagendar/);assert.match(r.done,/Próximo passo indisponível/);assert.ok(r.valid&&r.date);assert.strictEqual(r.next,'t');
    }],
    ['revisão adia projeto sem modificar os dados', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.projects=[{id:'p',t:'Reforma',status:'active',refs:[]}];S.view='hoje';render();const b=document.querySelector('[data-a=review-project-later]');b.click();return {hidden:!reviewGuide().includes('Reforma'),project:S.projects[0],differentWeek:reviewGuide(ds(add(today,14))).includes('Reforma')}})()`);assert.ok(r.hidden&&r.differentWeek);assert.strictEqual(r.project.t,'Reforma');assert.deepStrictEqual(r.project.refs,[]);
    }],
    ['Hoje abre com tarefas no modo somente local sem foco ativo', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const uid=SY.uid;SY.uid=undefined;focusTask=null;S.tasks=[{id:'local',t:'Tarefa local',done:false,p:'m',hd:T}];const html=hoje();SY.uid=uid;return html})()`);assert.match(r,/Tarefa local/);
    }],
    ['previsão identifica conta sem vínculo dentro do período', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{today=new Date(2026,0,12,12);T=ds(today);const F=finInit();F.acc=[{id:'a',n:'Principal',ty:'cc',ini:1000}];F.primary='a';F.rec=[];F.tx=[{id:'sal',t:'Salário',k:'in',v:100,d:'2026-01-25',ac:'a'}];F.bills=[{id:'b',n:'Água',v:30,day:20,ac:''},{id:'c',n:'Internet',v:30,day:28,ac:''}];return {html:nextIncomePanel(),panel:financeReviewPanel()}})()`);assert.match(r.html,/1 conta fixa sem conta de pagamento fica fora/);assert.match(r.html,/Conferir vínculos/);assert.match(r.panel,/Água/);assert.match(r.panel,/Vincular conta/);
    }],
    ['conferência financeira abre lançamentos não conferidos do mês', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.fin.tx=[{id:'x',t:'Mercado',k:'out',v:10,d:T,ac:S.fin.acc[0].id},{id:'y',t:'Conferido',k:'out',v:5,d:T,ac:S.fin.acc[0].id,checked:true}];S.view='avisos';render();const text=document.querySelector('#finance-review').innerText;document.querySelector('[data-a=finance-review-pending]').click();return {text,view:S.view,tab:S.ftab,filter:FRECON,month:S.fmo,transactions:S.fin.tx.length}})()`);assert.match(r.text,/1 lançamento não conferido/);assert.strictEqual(r.view,'financas');assert.strictEqual(r.tab,'lanc');assert.strictEqual(r.filter,'pending');assert.strictEqual(r.month,0);assert.strictEqual(r.transactions,2);
    }],
    ['ensaio de backup registra apenas confirmação local por conta', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.view='backup';render();const before=backupDrillStatus();document.querySelector('[data-a=backup-drill]').click();const after=backupDrillStatus(),exported=JSON.stringify(pick());const uid=SY.uid;SY.uid='outra-conta';const other=backupDrillStatus();SY.uid=uid;return {before,after,other,exported}})()`);assert.match(r.before,/Nenhum ensaio/);assert.match(r.after,/Ensaio registrado/);assert.match(r.other,/Nenhum ensaio/);assert.doesNotMatch(r.exported,/hub-backup-drill/);
    }],
    ['projetos independentes vinculam referências sem duplicar despesas', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.projects=[];S.tasks=[{id:'t',t:'Tarefa',done:false,p:'m'}];S.notes=[{id:'n',t:'Nota',b:'',c:'p'}];S.metas=[{id:'g',t:'Meta',ini:T,kr:[]}];S.fin.tx=[{id:'x',k:'out',t:'Despesa',v:12,d:T,ac:S.fin.acc[0].id}];S.view='projetos';render();let f=document.querySelector('#project-create');f.elements.t.value='Casa';f.requestSubmit();f=document.querySelector('#project-create');f.elements.t.value='Casa';f.requestSubmit();const id=S.projects[0].id;for(const ref of ['tk:t','nt:n','mt:g','tx:x']){f=document.querySelector('[data-project-link="'+id+'"]');f.elements.ref.value=ref;f.requestSubmit()}S.projects[0].refs.push({id:'tx:x'});render();return {ids:S.projects.map(x=>x.id),refs:S.projects[0].refs,text:document.querySelector('[data-project="'+id+'"]').innerText,valid:validBackup(pick()),exported:JSON.parse(selectJSON(['projects'])).areas.projects.length}})()`);assert.notStrictEqual(r.ids[0],r.ids[1]);assert.ok(r.valid);assert.strictEqual(r.exported,2);assert.match(r.text,/12,00/);assert.doesNotMatch(r.text,/24,00/);assert.strictEqual(r.refs.length,5);
    }],
    ['arquivar ou excluir projeto preserva itens e permite recuperar', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Tarefa',done:false,p:'m'}];S.projects=[{id:'p',t:'Projeto',status:'active',start:'',end:'',refs:[{id:'tk:t'}]}];S.view='projetos';render();document.querySelector('[data-a=project-archive]').click();const archived=S.projects[0].archived,task=S.tasks[0].id;S.view='arquivados';render();document.querySelector('[data-a=project-archive][data-id=p]').click();S.view='projetos';render();document.querySelector('[data-a=project-delete][data-id=p]').click();const gone=!S.projects.length,bin=S.trash.find(x=>x.id==='prj:p');trashRestore(bin.b);return {archived,task,gone,restored:S.projects[0],tasks:S.tasks.length}})()`);assert.ok(r.archived&&r.gone);assert.strictEqual(r.task,'t');assert.strictEqual(r.tasks,1);assert.deepStrictEqual(r.restored.refs,[{id:'tk:t'}]);
    }],
    ['referências de projeto indisponíveis são preservadas e mescladas', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const base={projects:[{id:'p',t:'Projeto',status:'active',start:'',end:'',refs:[]}]},a=JSON.parse(JSON.stringify(base)),b=JSON.parse(JSON.stringify(base));a.projects[0].refs.push({id:'tk:missing'});b.projects[0].refs.push({id:'nt:other'});const m=merge3(base,a,b,[]);S.projects=m.projects;S.tasks=[];S.notes=[];S.view='projetos';render();return {refs:S.projects[0].refs.map(x=>x.id).sort(),text:document.querySelector('[data-project=p]').innerText,old:validBackup({tasks:[],events:[]}),valid:validBackup(pick())}})()`);assert.deepStrictEqual(r.refs,['nt:other','tk:missing']);assert.match(r.text,/Item indisponível/);assert.ok(r.old&&r.valid);
    }],
    ['histórico migra registros locais sem duplicar e mescla aparelhos', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{const now=Date.now();S.history=[];localStorage.setItem(AUDIT_KEY,JSON.stringify([{type:'reviewStart',at:now},{type:'reviewStart',at:now},{type:'reviewStart',at:now-91*864e5}]));auditMigrate();auditMigrate();const migrated=JSON.parse(JSON.stringify(S.history)),base={history:[]},local={history:[...migrated,{id:'device-a',type:'archive',at:now}]},remote={history:[migrated[0],{id:'device-b',type:'restore',at:now}]},merged=merge3(base,local,remote,[]);return {migrated: migrated.length,legacy:JSON.parse(localStorage.getItem(AUDIT_KEY)).length,ids:auditClean(merged.history).map(x=>x.id),valid:validBackup({...pick(),history:merged.history})}})()`);assert.strictEqual(r.migrated,2);assert.strictEqual(r.legacy,2);assert.strictEqual(new Set(r.ids).size,4);assert.ok(r.valid);
    }],
    ['desfazer preserva histórico e registra a reversão', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.history=[];S.tasks=[{id:'t',t:'Tarefa',done:false,p:'m'}];S.view='tarefas';render();undoReset();document.querySelector('[data-a=task-archive][data-id=t]').click();undo();return {archived:!!S.tasks[0].archived,types:auditRead().map(x=>x.type)}})()`);assert.ok(!r.archived);assert.ok(r.types.includes('taskArchive')&&r.types.includes('undo'));
    }],
    ['restaurar backup preserva histórico atual e registra restauração', async () => {
      await fresh();await login('A');const r=await ev(`(async()=>{S.history=[];auditLog('reviewStart');const old=JSON.parse(JSON.stringify(pick()));S.history=[];auditLog('reviewEnd');S.view='backup';render();const f=document.querySelector('#bkfile'),dt=new DataTransfer();dt.items.add(new File([JSON.stringify(old)],'backup.json',{type:'application/json'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));await ${backupDecision};return {types:auditRead().map(x=>x.type),msg:document.querySelector('#bkmsg').textContent}})()`);assert.ok(r.types.includes('reviewStart')&&r.types.includes('reviewEnd')&&r.types.includes('backupRestore'));assert.match(r.msg,/restaurado/i);
    }],
    ['histórico sincroniza evento recebido de outro aparelho', async () => {
      await fresh();await login('A');await ev(`(()=>{S.history=[];auditLog('reviewStart');save()})()`);await waitFor(`(()=>{const c=__cloud(),d=c['data/users/A/hub-d-core-0'];return d&&JSON.parse(d.s).history?.some(x=>x.type==='reviewStart')})()`,'histórico local na nuvem');await ev(`(async()=>{const db=firebase.firestore(),c=__cloud(),m=c['data/users/A/hub-meta'],st=JSON.parse(c['data/users/A/hub-d-core-0'].s);st.history.push({id:'remote-event',type:'reviewEnd',at:Date.now()});const j=JSON.stringify(st),rev=m.rev+1;await db.doc('data/users/A/hub-d-core-0').set({rev,i:0,s:j});await db.doc('data/users/A/hub-meta').set({...m,rev,dev:'outro',doms:{...m.doms,core:{rev,n:1,len:j.length}}})})()`);await waitFor(`S.history.some(x=>x.id==='remote-event')`,'evento remoto');const r=await ev(`({types:S.history.map(x=>x.type),remote:S.history.filter(x=>x.id==='remote-event').length})`);assert.ok(r.types.includes('reviewStart')&&r.types.includes('reviewEnd'));assert.strictEqual(r.remote,1);
    }],
    ['histórico criado offline mantém identidade após reconexão simulada', async () => {
      await fresh();await login('A');await ev('localStorage.setItem("__offline","1")');await open();const id=await ev(`(()=>{auditLog('reviewStart');save();return S.history.find(x=>x.type==='reviewStart').id})()`);await open();assert.strictEqual(await ev(`S.history.filter(x=>x.id===${JSON.stringify(id)}).length`),1);await ev('localStorage.removeItem("__offline")');await open();await waitFor('FB.on&&SYS.s==="ok"','reconexão do histórico');await waitFor(`(()=>{const d=__cloud()['data/users/A/hub-d-core-0'];return d&&JSON.parse(d.s).history?.some(x=>x.id===${JSON.stringify(id)})})()`,'histórico remoto');assert.strictEqual(await ev(`S.history.filter(x=>x.id===${JSON.stringify(id)}).length`),1);
    }],
    ['restauração pela lixeira é registrada sem conteúdo pessoal', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.history=[];S.tasks=[{id:'t',t:'Nome privado',done:false,p:'m'}];S.view='tarefas';render();document.querySelector('[data-a=deltk][data-id=t]').click();const bin=S.trash.find(x=>x.id==='tk:t');trashRestore(bin.b);return {tasks:S.tasks.length,events:auditRead()}})()`);assert.strictEqual(r.tasks,1);assert.ok(r.events.some(x=>x.type==='trashRestore'));assert.ok(!JSON.stringify(r.events).includes('Nome privado'));
    }],
    ['backup restaura projetos e arquivo antigo não mantém projetos anteriores', async () => {
      await fresh();await login('A');const r=await ev(`(async()=>{S.projects=[{id:'p',t:'Projeto',status:'active',start:'',end:'',archived:false,refs:[{id:'tk:t'}]}];S.tasks=[{id:'t',t:'Tarefa',done:false,p:'m'}];const data=JSON.stringify(pick());S.projects=[];S.view='backup';render();async function restore(text){const f=document.querySelector('#bkfile'),dt=new DataTransfer();dt.items.add(new File([text],'backup.json',{type:'application/json'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));await ${backupDecision}}await restore(data);const saved=JSON.parse(JSON.stringify(S.projects));await restore(JSON.stringify({tasks:[],events:[]}));return {saved,after:S.projects,msg:document.querySelector('#bkmsg').textContent}})()`);assert.strictEqual(r.saved[0].id,'p');assert.deepStrictEqual(r.saved[0].refs,[{id:'tk:t'}]);assert.deepStrictEqual(r.after,[]);assert.match(r.msg,/restaurado/i);
    }],
    ['backup restaura instâncias de modelos de tarefa independentes', async () => {
      await fresh();await login('A');const r=await ev(`(async()=>{S.tasks=[];S.view='tarefas';render();document.querySelector('#task-template').requestSubmit();document.querySelector('#task-template').requestSubmit();const expected=S.tasks.map(t=>({id:t.id,sub:t.sub.map(x=>x.id)})),data=JSON.stringify(pick());S.tasks=[];S.view='backup';render();const f=document.querySelector('#bkfile'),dt=new DataTransfer();dt.items.add(new File([data],'backup.json',{type:'application/json'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));await ${backupDecision};return {expected,actual:S.tasks.map(t=>({id:t.id,sub:t.sub.map(x=>x.id)})),msg:document.querySelector('#bkmsg').textContent}})()`);assert.deepStrictEqual(r.actual,r.expected);assert.notStrictEqual(r.actual[0].id,r.actual[1].id);assert.notStrictEqual(r.actual[0].sub[0],r.actual[1].sub[0]);assert.match(r.msg,/restaurado/i);
    }],
    ['troca de conta isola projetos e histórico sincronizável', async () => {
      await fresh();await login('A');await ev(`(()=>{S.projects=[{id:'a',t:'Projeto A',status:'active',start:'',end:'',archived:false,refs:[]}];S.history=[];auditLog('goalArchive');save()})()`);await waitFor(`(()=>{const d=__cloud()['data/users/A/hub-d-core-0'];return d&&JSON.parse(d.s).projects?.some(p=>p.id==='a')})()`,'projeto A na nuvem');await ev('fbLogout()');await waitFor('!FB.on','sair A');await login('B');const b=await ev(`({projects:S.projects,history:S.history})`);assert.ok(!b.projects.some(x=>x.id==='a'));assert.ok(!b.history.some(x=>x.type==='goalArchive'));await ev('fbLogout()');await waitFor('!FB.on','sair B');await login('A');const a=await ev(`({projects:S.projects,history:S.history})`);assert.ok(a.projects.some(x=>x.id==='a'));assert.ok(a.history.some(x=>x.type==='goalArchive'));
    }],
    ['meta arquivada pausa tarefa vinculada recebida depois da mesclagem', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.metas=[{id:'g',t:'Meta',ini:T,kr:[],archived:true,pausedTaskIds:[]}];S.tasks=[{id:'remote',t:'Tarefa criada offline',done:false,p:'m',mt:'g',due:T}];const paused=taskPaused(S.tasks[0]),alert=attention().some(x=>x.id==='remote');S.metas[0].archived=false;return {paused,alert,resumed:!taskPaused(S.tasks[0])}})()`);assert.ok(r.paused&&!r.alert&&r.resumed);
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
      const r=await ev(`(()=>{noteReset();S.notes=[{id:'old',t:'Antiga',b:'',c:'p'},{id:'new',t:'Nova',b:'',c:'p',updatedAt:1000}];S.view='notas';render();const order=nList().map(n=>n.id),card=document.querySelector('[data-lid="nt:old"]');card.querySelector('details.note-tools').open=true;const text=card.innerText;card.querySelector('[data-a=note-edit]').click();const form=document.querySelector('[data-note-edit]');form.elements.t.value='Editada';form.requestSubmit();return {order,text,updated:S.notes[0].updatedAt,now:nList()[0].id}})()`);
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
      const r=await ev(`(()=>{S.fin.acc=[{id:'a',n:'Conta A',ty:'cc',ini:100},{id:'b',n:'Conta B',ty:'cc',ini:100},{id:'c',n:'Cartão',ty:'card',close:28,due:10,ini:0}];S.fin.rec=[];S.fin.bills=[{id:'bill',n:'Sem conta',v:20,day:Math.min(28,today.getDate()+1)}];const tomorrow=ds(add(today,1)),iv=invoice(S.fin.acc[2]);S.fin.tx=[{id:'future',k:'in',t:'Salário',v:1000,cat:'Receita',d:tomorrow,ac:'a'},{id:'buy',k:'out',t:'Compra',v:50,cat:'Outros',d:iv.end,ac:'c'}];S.view='financas';S.ftab='geral';S.fvw='mes';S.fmo=0;S.fac='a';render();const text=document.querySelector('#main').innerText,c=cashFlow({days:90,fac:'a',vary:false});return {text,events:c.evs}})()`);
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
    ['configurações ficam após tarefas e conteúdo do menu', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Tarefa de exemplo',done:false,p:'m'}];S.view='tarefas';render();const card=document.querySelector('[data-lid="tk:t"]'),settings=document.querySelector('[data-task-settings]'),form=document.querySelector('#ftk');const taskAfter=!!(card.compareDocumentPosition(settings)&Node.DOCUMENT_POSITION_FOLLOWING),formBefore=!!(form.compareDocumentPosition(card)&Node.DOCUMENT_POSITION_FOLLOWING),tools=!!settings.querySelector('#bulk-plan')&&!!settings.querySelector('#bulk-due')&&!!settings.querySelector('#task-template');S.view='menu';render();const menu=document.querySelector('#fmgrp'),profile=document.querySelector('#profile-create');return {taskAfter,formBefore,tools,profileAfter:!!(menu.compareDocumentPosition(profile)&Node.DOCUMENT_POSITION_FOLLOWING)}})()`);assert.ok(r.taskAfter&&r.formBefore&&r.tools&&r.profileAfter);
    }],
    ['componentes móveis mantêm campos legíveis e controles acessíveis', async () => {
      await fresh();await login('A');await b.send('Emulation.setDeviceMetricsOverride',{width:375,height:720,deviceScaleFactor:1,mobile:true});try{const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Organizar tarefas',done:false,p:'m'}];S.notes=[{id:'n',t:'Nota',b:'',c:'p'},{id:'l',kind:'shopping',t:'Compras',b:'',c:'g',items:[]}];S.view='tarefas';render();const task=document.querySelector('#ftk [name=t]'),form=document.querySelector('#ftk'),width=task.getBoundingClientRect().width/form.getBoundingClientRect().width;S.view='notas';render();document.querySelector('[data-a=note-edit]').click();const tool=document.querySelector('.tb .x').getBoundingClientRect(),input=document.querySelector('[data-shopping-form] input.in'),cs=getComputedStyle(input);return {width,tool:{w:tool.width,h:tool.height},border:cs.borderTopStyle,background:cs.backgroundColor,overflow:document.documentElement.scrollWidth<=innerWidth}})()`);assert.ok(r.width>.95);assert.ok(r.tool.w>=40&&r.tool.h>=40);assert.strictEqual(r.border,'solid');assert.notStrictEqual(r.background,'rgba(0, 0, 0, 0)');assert.ok(r.overflow)}finally{await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['campo de data da agenda tem espaço para texto ampliado', async () => {
      await fresh();await login('A');await b.send('Emulation.setDeviceMetricsOverride',{width:375,height:720,deviceScaleFactor:1,mobile:true});
      try{const r=await ev(`(()=>{document.documentElement.style.fontSize='200%';S.view='agenda';render();const f=document.querySelector('#fev input[type=date]');return {width:f.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}})()`);assert.ok(r.width>=280,JSON.stringify(r));assert.strictEqual(r.overflow,0)}finally{await ev("document.documentElement.style.fontSize=''");await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['A3 atalhos cabem com fonte ampliada e resumo permanece no conteúdo', async () => {
      await fresh();await login('A');await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});
      try{
        const r=await ev(`(()=>{
          tourClose();document.documentElement.style.fontSize='200%';S.menu=menuDef();S.view='agenda';S.mode='day';S.dy=0;
          S.tasks=[{id:'a3',t:'Tarefa do dia',p:'m',due:T,done:false}];S.rem={on:true,tk:true,hh:'00:00'};render();
          localStorage.removeItem('hub-rem-last');digest();
          const bar=$('#mobile-bar'),visible=[...bar.querySelectorAll('[data-v]')].filter(e=>e.getClientRects().length),
            hidden=[...bar.querySelectorAll('[data-v]')].filter(e=>!e.getClientRects().length),
            split=visible.flatMap(e=>{const text=e.querySelector('span').firstChild;return [...text.data.matchAll(/\\S+/g)].filter(m=>{
              const range=document.createRange();range.setStart(text,m.index);range.setEnd(text,m.index+m[0].length);return range.getClientRects().length>1;
            }).map(m=>m[0])});
          const drawer=hidden.every(e=>!!$('#mobile-menu [data-v='+e.dataset.v+']:not([hidden])'));
          const overlay=$('#toast')?.classList.contains('on')&&$('#toast').textContent.includes('Resumo do dia');
          S.view='hoje';render({save:false});const inline=$('#daily-summary')?.textContent.includes('1 tarefa vence hoje')&&!!$('#daily-summary [data-v=avisos]');
          $('[data-a=dismiss-digest]')?.click();const dismissed=$('#daily-summary')?.hidden;
          return {split,hidden:hidden.length,drawer,overlay:!!overlay,inline:!!inline,dismissed:!!dismissed};
        })()`);
        assert.deepEqual(r.split,[]);assert.ok(r.hidden>0&&r.drawer&&r.inline&&r.dismissed);assert.equal(r.overlay,false);
      }finally{await ev("document.documentElement.style.fontSize=''");await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['A3 gaveta abre por teclado e permite acessar atalho deslocado por toque', async () => {
      await fresh();await login('A');
      await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});
      await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
      await b.send('Emulation.setFocusEmulationEnabled',{enabled:true});
      try{
        const displaced=await ev(`(()=>{tourClose();document.documentElement.style.fontSize='200%';S.menu=menuDef();S.view='hoje';render({save:false});
          const bar=$('#mobile-bar'),list=[...bar.querySelectorAll('[data-v][hidden]')].map(e=>e.dataset.v);bar.querySelector('.more').focus();return list})()`);
        assert.ok(displaced.length);
        for(const type of ['keyDown','keyUp'])await b.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r',unmodifiedText:'\r'}:{})});
        assert.ok(await ev(`$('#mobile-menu').open&&$('#mobile-menu').contains(document.activeElement)`));
        const target=displaced[0];
        const point=await ev(`(()=>{const el=$('#mobile-menu [data-v=${target}]');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),w:r.width,h:r.height}})()`);
        assert.ok(point.w>=44&&point.h>=44);
        await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});
        await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await waitFor(`S.view===${JSON.stringify(target)}&&!$('#mobile-menu').open`,'navegar pelo atalho deslocado');
        for(const width of [375,430]){
          await b.send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});
          const reachable=await ev(`(()=>{document.documentElement.style.fontSize='';render({save:false});
            return menuCfg().bar.every(v=>[...document.querySelectorAll('#mobile-bar [data-v='+v+'],#mobile-menu [data-v='+v+']')].some(el=>!el.hidden))})()`);assert.ok(reachable);
        }
      }finally{
        await ev("document.documentElement.style.fontSize=''");
        await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});
        await b.send('Emulation.setFocusEmulationEnabled',{enabled:false});
        await b.send('Emulation.clearDeviceMetricsOverride');
      }
    }],
    ['A4 contraste e estrutura dos formulários funcionam em Céu e Safira', async () => {
      await fresh();await login('A');
      const result=await ev(`(()=>{
        tourClose();S.tasks=Array.from({length:3},(_,i)=>({id:'a4-'+i,t:'Tarefa '+i,p:'m',due:T,done:false}));
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const c=canvas.getContext('2d',{willReadFrequently:true});
        const l=value=>{c.clearRect(0,0,1,1);c.fillStyle=value;c.fillRect(0,0,1,1);return [0.2126,0.7152,0.0722].reduce((n,w,i)=>{const v=c.getImageData(0,0,1,1).data[i]/255;return n+w*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)},0)};
        const failures=[];
        for(const pal of ['ceu','safira'])for(const theme of ['light','dark']){
          S.pal=pal;S.themeMode=theme;applyTheme();
          for(const [view,selector] of [['agenda','.now-time'],['hoje','.now'],['hoje','.gh:not(.late)'],['tarefas','.gh:not(.late)']]){
            S.view=view;S.mode='day';S.dy=0;render({save:false});
            const el=$(selector);if(!el){failures.push([pal,theme,view,selector,'ausente']);continue}
            const bg=[el,...(function*(node){while(node.parentElement){node=node.parentElement;yield node}})(el)].map(e=>getComputedStyle(e).backgroundColor).find(color=>color!=='rgba(0, 0, 0, 0)');
            const a=l(getComputedStyle(el).color),b=l(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
            if(ratio<4.5)failures.push([pal,theme,view,selector,ratio.toFixed(2)]);
          }
        }
        const structure=[];for(const view of ['agenda','tarefas']){S.view=view;S.mode='week';S.tmode='week';render({save:false});const section=$('.week')?.closest('section[aria-labelledby]');structure.push(!!section?.querySelector('h2')&&!!section.querySelector('.day h3'))}
        const labels=[];for(const [view,id,names] of [['agenda','fev',['t','d','h']],['tarefas','ftk',['t','due','tg','pj']],['hoje','fhj',['t']],['financas','ffin',['t','v']]]){
          S.view=view;S.ftab='lanc';S.fvw='mes';render({save:false});const form=$('#'+id);if(form?.closest('details'))form.closest('details').open=true;
          if(id==='ftk')form.querySelector('details').open=true;
          for(const name of names){const label=form?.elements[name]?.labels?.[0];if(!label||!label.textContent.trim()||!label.getClientRects().length)labels.push(view+':'+name)}
        }
        return {failures,structure,labels};
      })()`);
      assert.deepEqual(result,{failures:[],structure:[true,true],labels:[]});
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
    ['espaçamento de seções e ações funciona em celular e desktop amplo', async () => {
      await fresh(); await login('A');
      try {
        for(const width of [320,1920]){
          await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===320});
          const r=await ev(`(()=>{
            S.projects=[{id:'p',t:'Projeto',status:'active',refs:[{id:'tk:t'}]}];
            S.tasks=[{id:'t',t:'Tarefa vinculada'}];
            S.notes=[{id:'n',t:'Nota'}];S.view='projetos';render({save:false});
            const panel=document.querySelector('[data-project]'),form=document.querySelector('#project-create');
            const gap=form.getBoundingClientRect().top-panel.getBoundingClientRect().bottom;
            const overflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;
            S.view='financas';S.fvw='mes';S.ftab='contas';render({save:false});
            const tabs=[...document.querySelectorAll('.ftabs button')];
            return {gap,overflow,width:document.querySelector('.app').clientWidth,
              rows:new Set(tabs.map(t=>Math.round(t.getBoundingClientRect().top))).size,tabCount:tabs.length};
          })()`);
          assert.ok(r.gap>=12);assert.equal(r.overflow,0);assert.ok(r.tabCount>=6);
          if(width===1920){assert.equal(r.width,1440);assert.equal(r.rows,1)}
          else assert.equal(r.width,320);
        }
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
      const r=await ev(`(()=>{const F=finInit(),d1=ds(add(today,1)),d2=ds(add(today,2));F.acc=[{id:'a',n:'Principal',ty:'cc',ini:1000},{id:'b',n:'Outra',ty:'cc',ini:500}];F.primary='a';F.rec=[];F.bills=[];F.tx=[{id:'salary',t:'Salário',k:'in',v:2000,d:d2,ac:'a'},{id:'rent',t:'Conta',k:'out',v:200,d:d1,ac:'a'},{id:'bill',t:'Despesa',k:'out',v:100,d:d2,ac:'a'},{id:'other',t:'Outra conta',k:'out',v:900,d:d1,ac:'b'}];S.view='financas';S.ftab='geral';render();const text=document.querySelector('#main').innerText;return {text,d2,html:nextIncomePanel()}})()`);
      assert.match(r.text,/até o próximo recebimento/i);assert.match(r.text,/700,00/);assert.match(r.text,/não inclui faturas/i);assert.match(r.html,/Como esta previsão foi calculada/);assert.match(r.html,/Saldo de partida/);assert.match(r.html,/Despesa/);
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
      await fresh();await login('A');const r=await ev(`(()=>{noteReset();S.notes=[{id:'p',t:'Fixada',b:'',c:'g',pin:true,updatedAt:1},{id:'r',t:'Rever',b:'',c:'p',revisit:true,updatedAt:2}];S.view='notas';render();const el=document.querySelector('[data-notes-highlights]');el.open=true;return {text:el.innerText,filters:!!document.querySelector('details[data-note-filters] #note-type')&&!!document.querySelector('details[data-note-filters] #nfil')}})()`);assert.ok(r.filters);assert.match(r.text,/Fixada/);assert.match(r.text,/Rever/);
    }],
    ['início apresenta situação de sincronização e backup', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.onb=false;S.lastBk=T;S.view='dash';render();const absent=!document.querySelector('[data-safety-summary]');S.view='backup';render();const el=document.querySelector('[data-safety-summary]'),initial=el&&el.innerText;document.querySelector('[data-a=bkexp]').focus();setSt('err','teste');return {absent,focus:document.activeElement===document.querySelector('[data-a=bkexp]'),initial,updated:document.querySelector('[data-safety-summary]').innerText}})()`);assert.ok(r.absent&&r.focus);assert.match(r.initial,/sincroniza/i);assert.match(r.initial,/backup/i);assert.match(r.updated,/falha ao sincronizar/i);
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
      await ev(`(()=>{const get=metaRef.get.bind(metaRef);let once=true;metaRef.get=async()=>{const old=await get();if(once){once=false;const c=__cloud(),m=c['data/users/A/hub-meta'],data=JSON.parse(c['data/users/A/hub-d-core-0'].s);data.tasks.push({id:'t-outro',t:'t-outro',done:false});const j=JSON.stringify(data),rev=m.rev+1;c['data/users/A/hub-d-core-0']={rev,i:0,s:j};c['data/users/A/hub-meta']={...m,rev,doms:{...m.doms,core:{rev,n:1,len:j.length}}};localStorage.setItem('__cloud',JSON.stringify(c))}return old};S.tasks.push({id:'t-aqui',t:'t-aqui',done:false});push()})()`);
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
      await ev(`(()=>{S.inbox=[{id:'ok',t:'Manter'}];S.view='backup';render();const f=document.querySelector('#bkmerge'),d=new DataTransfer();d.items.add(new File([JSON.stringify({tasks:[],events:[],inbox:'inválida'})],'backup.json',{type:'application/json'}));f.files=d.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await waitFor(`/inválido/i.test($('#bkmsg').textContent)`,'rejeição do backup inválido');
      assert.deepStrictEqual(await ev('S.inbox'),[{id:'ok',t:'Manter'}]);
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
    ['conferência de conflito aplica campo, preserva versão e bloqueia item alterado', async () => {
      await fresh();await login('A');
      const r=await ev(`(()=>{S.tasks=[{id:'t',t:'Local',done:false}];const c={id:'c1',path:['tasks',{id:'t'},'t'],local:'Local',remote:'Recebido'};conflictStore([c]);S.view='backup';render();const shown=!!document.querySelector('[data-a="conflict-remote"]');document.querySelector('[data-a="conflict-remote"]').click();const applied=S.tasks[0].t==='Recebido'&&!SY.conflicts.length;const kept=snaps().some(x=>JSON.parse(x.j).tasks.some(t=>t.id==='t'&&t.t==='Local'));conflictStore([{...c,id:'c2'}]);S.tasks[0].t='Editada depois';render();const blocked=document.querySelector('[data-a="conflict-remote"]').disabled;conflictResolve('c2',true);const untouched=S.tasks[0].t==='Editada depois'&&SY.conflicts.length===1;conflictResolve('c2',false);return {shown,applied,kept,blocked,untouched,cleared:!SY.conflicts.length}})()`);
      assert.ok(Object.values(r).every(Boolean),JSON.stringify(r));
      if(process.env.CONFLICT_CAPTURE){
        await ev(`(()=>{S.tasks=[{id:'t',t:'Local',done:false}];conflictStore([{id:'visual',path:['tasks',{id:'t'},'t'],local:'Organizar documentos para a revisão do projeto',remote:'Conferir documentos e comprovantes antes da revisão semanal'}]);S.view='backup';render();document.querySelector('[data-a="conflict-remote"]').closest('details').open=true;document.querySelector('[data-a="conflict-remote"]').closest('section').scrollIntoView()})()`);
        await b.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
        await ev(`document.querySelector('[data-a="conflict-remote"]').closest('section').scrollIntoView()`);await sleep(200);
        const shot=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.CONFLICT_CAPTURE,Buffer.from(shot.result.data,'base64'));
        await b.send('Emulation.clearDeviceMetricsOverride');
      }
    }],
    ['conferência de conflito persiste e fica separada por conta', async () => {
      await fresh();await login('A');
      await ev(`(()=>{S.focus='Local';conflictStore([{id:'persist',path:['focus'],local:'Local',remote:'Texto privado recebido'}]);save();})()`);
      await b.send('Page.reload');await sleep(800);
      const r=await ev(`(()=>{S.view='backup';render();const restored=SY.conflicts.some(c=>c.id==='persist');PRIV=true;render();const hidden=!document.querySelector('#main').textContent.includes('Texto privado recebido');PRIV=false;return {restored,hidden}})()`);assert.ok(r.restored&&r.hidden);
      await ev('fbLogout()');await waitFor('!FB.on','sair de A');await login('B');assert.strictEqual(await ev(`(SY.conflicts||[]).length`),0);
      await ev('fbLogout()');await waitFor('!FB.on','sair de B');await login('A');assert.ok(await ev(`(SY.conflicts||[]).some(c=>c.id==='persist')`));
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
      const r=await ev(`({raw:localStorage.getItem('hub-v1'),message:document.body.innerText,cloud:__cloud()['data/users/A/hub-d-core-0'].s})`);
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
      await fresh();await login('A');const data=fs.readFileSync(path.join(ROOT,'tests','fixtures','backup-antigo-minimo.json'),'utf8');const r=await ev(`(async()=>{S.view='backup';render();const f=document.querySelector('#bkfile'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(data)}],'antigo.json',{type:'application/json'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));await ${backupDecision};return {task:S.tasks.find(t=>t.id==='t-antiga'),note:S.notes.find(n=>n.id==='n-antiga'),habit:S.habits.find(h=>h.id==='h-antigo'),message:document.querySelector('#bkmsg').textContent}})()`);assert.match(r.message,/restaurado/i);assert.strictEqual(r.task.due,'2030-01-20');assert.match(r.note.b,/Conteúdo/);assert.strictEqual(r.habit.perWeek,undefined);assert.strictEqual(r.habit.log['2026-11-17'],1);
    }],
    ['backup válido atual e mínimo continua aceito', async () => {
      await fresh(); await login('A');
      const r=await ev(`(()=>({current:validBackup(JSON.parse(JSON.stringify(S))),minimal:validBackup({tasks:[],events:[]}),legacy:validBackup({tasks:[],events:[],fin:{tx:null,acc:null}}),nullFinance:validBackup({tasks:[],events:[],fin:null})}))()`);
      assert.ok(r.current);assert.ok(r.minimal);assert.ok(r.legacy);assert.strictEqual(r.nullFinance,false);
    }],
    ['restauração que não consegue salvar mantém estado anterior', async () => {
      await fresh(); await login('A');
      const r=await ev(`(async()=>{S.focus='Anterior';save();S.view='backup';render();const f=document.querySelector('#bkfile'),d=new DataTransfer();d.items.add(new File([JSON.stringify({tasks:[],events:[],focus:'Novo'})],'backup.json'));f.files=d.files;const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='hub-v1')throw new DOMException('quota','QuotaExceededError');return orig.call(this,k,v)};f.dispatchEvent(new Event('change',{bubbles:true}));await ${backupDecision};Storage.prototype.setItem=orig;return {focus:S.focus,saved:JSON.parse(localStorage.getItem('hub-v1')).focus,msg:document.querySelector('#bkmsg').textContent}})()`);
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
    ['A9 Início usa arte responsiva e decodifica os três turnos', async()=>{
      await fresh();await login('A');
      try{for(const width of [375,1440]){
        await b.send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:width===375});
        for(const [hour,period] of [[8,'manha'],[14,'tarde'],[21,'noite']]){
          const result=await ev(`(async()=>{const OriginalDate=Date;try{window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[2026,10,26,${hour}]))}};S.view='dash';render({save:false});const img=$('.hero2-img');await img.decode();return {path:new URL(img.currentSrc).pathname,width:img.naturalWidth,period:img.parentElement.dataset.period}}finally{window.Date=OriginalDate}})()`);
          assert.strictEqual(result.period,period);assert.match(result.path,new RegExp('hero-'+period+'-(720|1440)\\.webp$'));assert.ok(result.width>0);
        }
      }}finally{await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['A9 extrato preserva ordem, filtros e edições ao pesquisar em histórico longo', async()=>{
      await fresh();await login('A');
      const result=await ev(`(()=>{
        today=new Date(2026,10,26,12);T=ds(today);const f=finInit(),day=ds(add(today,-1));f.acc=[{id:'main',n:'Conta do banco',ty:'cc',ini:0},{id:'c',n:'Crédito',ty:'card',ini:0}];
        f.tx=[{id:'first',t:'Café da tarde',cat:'Outros',d:T,v:49.9,ac:'main',k:'out'},{id:'next',t:'Mercado',cat:'Alimentação',d:day,v:49.9,ac:'main',k:'out',tg:'Feira'},{id:'other',t:'Compra cartão',cat:'Outros',d:T,v:49.9,ac:'c',k:'out'}];
        for(let i=0;i<5000;i++)f.tx.push({id:'past'+i,t:'Histórico '+i,d:'2021-01-15',v:1,ac:'main',k:'out'});
        S.view='financas';S.fvw='mes';S.ftab='lanc';S.fmo=0;S.fac='main';S.fcat='';S.fkd='';FQ='';render({save:false});
        const search=value=>{const i=$('#fq');i.value=value;i.dispatchEvent(new Event('input',{bubbles:true}));return [...document.querySelectorAll('[data-tx-row]')].map(e=>e.dataset.txRow)};
        const amount=search('49,9'),accent=search('cafe'),tag=search('feira'),account=search('banco');f.tx[0].t='Café atualizado';const edited=search('atualizado');
        return {amount,accent,tag,account,edited};})()`);
      assert.deepStrictEqual(result,{amount:['first','next'],accent:['first'],tag:['next'],account:['first','next'],edited:['first']});
    }],
    ['A9 service worker instala, atualiza e abre os três turnos sem rede', async()=>{
      const pages=sitePages(),latest=pages['/sw.js'].match(/const VER='([^']+)'/)[1],previous='a9previous';
      const current={
        html:pages['/index.html'],
        worker:pages['/sw.js'].replace('const ASSETS=[','const ASSETS=[\n "./mock.js",'),
      };
      const serveVersion=(version)=>{
        pages['/']=pages['/index.html']=current.html.replaceAll(latest,version);
        pages['/sw.js']=current.worker.replaceAll(latest,version);
      };
      pages['/mock.js']=pages['/mock.js'].replace('__noSW=1','__noSW=0');serveVersion(previous);
      const pwa=await serve(pages),client=await launch();
      try{
        await client.send('Network.enable');
        await client.send('Page.navigate',{url:'http://127.0.0.1:'+pwa.address().port+'/'});
        await client.waitFor(`typeof FB==='object'&&FB.ready&&navigator.serviceWorker.controller`,'primeira instalação');
        await client.ev(`window.__next='pwa';fbLogin()`);await client.waitFor(`FB.on`,'entrar no aparelho');
        await client.ev(`S.tasks=[{id:'kept',t:'Tarefa disponível offline'}];save();push()`);
        serveVersion(latest);
        await client.ev(`navigator.serviceWorker.getRegistration().then(r=>r.update())`);
        await client.waitFor(`!!SW_REG?.waiting&&!!$('[data-a=sw-reload]')`,'atualização em espera');
        await client.ev(`$('[data-a=sw-reload]').click()`);
        await client.waitFor(`typeof FB==='object'&&FB.ready&&document.querySelector('script[src*="main.js"]').src.endsWith('v=${latest}')`,'carregar versão nova');
        await client.waitFor(`caches.keys().then(list=>list.includes('meuhub-v${latest}')&&!list.includes('meuhub-v${previous}'))`,'substituir cache antigo');
        await client.ev(`localStorage.setItem('__offline','1')`);
        await client.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
        await client.send('Page.reload',{});
        await client.waitFor(`typeof FB==='object'&&FB.ready&&$('#gate').hidden`,'reabrir sem rede');
        for(const [hour,period,greeting] of [[8,'manha','Bom dia'],[14,'tarde','Boa tarde'],[21,'noite','Boa noite']]){
          const art=await client.ev(`(async()=>{const Clock=Date;try{window.Date=class extends Clock{constructor(...args){super(...(args.length?args:[2026,10,26,${hour}]))}};syncHeroClock();const image=$('.hero2-img');await image.decode();return {decoded:image.naturalWidth>0&&image.currentSrc.includes('hero-${period}-'),heading:$('.hero2 h1').textContent}}finally{window.Date=Clock}})()`);
          assert.ok(art.decoded,'banner offline de '+period);assert.ok(art.heading.startsWith(greeting),art.heading);
        }
        assert.ok(await client.ev(`S.tasks.some(t=>t.id==='kept')`));
      }finally{client.close();pwa.close()}
    }],
    ['A7 cartões e vencimentos se reorganizam conforme espaço e quantidade', async()=>{
      await fresh();await login('A');
      try{for(const width of [375,1024,1440]){
        await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===375});
        const result=await ev(`(()=>[0,1,4].map(count=>{
          const F=finInit();F.acc=[{id:'main',ty:'cc',n:'Conta',ini:0},...Array.from({length:count},(_,i)=>({id:'card'+i,ty:'card',n:'Cartão '+i,lim:20000,close:28,due:10}))];
          F.tx=[];F.bills=[{id:'due',n:'Internet',v:95,day:15,ac:'main'}];S.view='financas';S.fvw='mes';S.ftab='contas';S.fmo=0;render({save:false});
          const cards=$('#fin-cards'),dues=$('.finance-dues'),a=cards.getBoundingClientRect(),d=dues.getBoundingClientRect(),tiles=[...cards.querySelectorAll('.cc-card')];
          return {count,tiles:tiles.length,side:Math.abs(a.top-d.top)<2&&d.left>a.right,order:!!(cards.compareDocumentPosition(dues)&Node.DOCUMENT_POSITION_FOLLOWING),noOverflow:document.documentElement.scrollWidth<=innerWidth&&tiles.every(t=>t.scrollWidth<=t.clientWidth+1),visible:dues.textContent.includes('Internet')};
        }))()`);
        for(const row of result){assert.ok(row.order&&row.noOverflow&&row.visible&&row.tiles===row.count,JSON.stringify(row));assert.strictEqual(row.side,width>=1024&&row.count<=1,JSON.stringify({width,...row}));}
      }}finally{await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['A8 nota abre em leitura e recupera rascunho local sem sobrescrever outra versão', async()=>{
      await fresh();await login('A');
      await ev(`(()=>{S.notes=[{id:'a8',t:'Nota existente',b:'<p><strong>Texto</strong> longo.</p>',c:'p',g:'referência'}];go('notas')})()`);
      assert.ok(await ev(`$('#main [data-note-reading] strong').textContent==='Texto'&&!$('#main [data-note-edit]')&&!$('.note .tb')`));
      await ev(`(()=>{$('[data-a=note-edit]').click();const f=$('[data-note-edit]'),body=f.querySelector('[contenteditable]');f.elements.t.value='Rascunho de título';f.elements.t.dispatchEvent(new Event('input',{bubbles:true}));body.innerHTML='<p>Rascunho <b>formatado</b></p>';body.dispatchEvent(new Event('input',{bubbles:true}));go('agenda');go('notas')})()`);
      await open();await ev(`go('notas');$('[data-a=note-edit]').click()`);
      assert.ok(await ev(`(()=>{const f=$('[data-note-edit]');return f.elements.t.value==='Rascunho de título'&&f.querySelector('.rt b')?.textContent==='formatado'&&S.notes[0].t==='Nota existente'})()`));
      await ev(`S.notes[0].t='Título remoto';$('[data-note-edit]').requestSubmit()`);
      assert.strictEqual(await ev(`S.notes[0].t`),'Título remoto');assert.ok(await ev(`!!$('[data-a=note-save-copy]')`));
      await ev(`$('[data-a=note-save-copy]').click()`);
      assert.ok(await ev(`S.notes.some(n=>n.t==='Título remoto')&&S.notes.some(n=>n.id!=='a8'&&n.t.startsWith('Rascunho de título')&&n.b.includes('formatado'))`));
      await ev(`(()=>{const b=[...document.querySelectorAll('[data-a=note-edit]')].find(button=>button.dataset.id==='a8');b.click();const body=$('[data-note-edit] .rt');body.textContent='Texto ainda em rascunho';body.dispatchEvent(new Event('input',{bubbles:true}));S.notes=S.notes.filter(n=>n.id!=='a8');render()})()`);
      assert.ok(await ev(`$('[data-note-edit] .rt')?.textContent==='Texto ainda em rascunho'`));
      await open();await ev(`go('notas');$('[data-note-orphans] [data-a=note-edit]').click()`);
      assert.ok(await ev(`$('[data-note-edit] .rt').textContent==='Texto ainda em rascunho'`));
      await ev(`$('[data-note-edit]').requestSubmit();$('[data-a=note-save-copy]').click()`);
      assert.ok(await ev(`S.notes.some(n=>n.b==='Texto ainda em rascunho')&&!$('[data-note-orphans]')`));
    }],
    ['A8 backup separa etapas e exige confirmar antes de mesclar ou restaurar', async()=>{
      await fresh();await login('A');
      await ev(`S.tasks=[{id:'old',t:'Tarefa local'}];go('backup')`);
      assert.deepStrictEqual(await ev(`[...document.querySelectorAll('[data-backup-step] > h2')].map(x=>x.textContent)`),['Fazer cópia','Conferir','Recuperar ou restaurar']);
      assert.match(await ev(`(()=>{const original=siteSave;try{siteSave=()=>{};$('[data-a=bkexp]').click();render({save:false});return $('#bkmsg').textContent}finally{siteSave=original}})()`),/backup baixado/i);
      for(const [id,action] of [['bkmerge','Mesclar'],['bkfile','Restaurar']]){
        await ev(`(()=>{const f=$('#'+${JSON.stringify(id)}),dt=new DataTransfer();dt.items.add(new File([JSON.stringify({tasks:[{id:'new',t:'Tarefa do arquivo'}],events:[]})],'copia.json'));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}))})()`);
        await waitFor(`!!$('[data-a=backup-apply]')`,'confirmação após ler o arquivo');
        assert.ok(await ev(`S.tasks.some(t=>t.id==='old')&&!S.tasks.some(t=>t.id==='new')`));
        assert.match(await ev(`$('[data-a=backup-apply]').textContent`),new RegExp(action,'i'));
        await ev(`$('[data-a=backup-apply]').click()`);
        assert.deepStrictEqual(await ev(`S.tasks.map(t=>t.id)`),id==='bkmerge'?['old','new']:['new']);
        await ev(`S.tasks=[{id:'old',t:'Tarefa local'}];render()`);
      }
    }],
    ['A5: rascunho de tarefa local sobrevive à navegação, atualização e troca de conta', async () => {
      await fresh();await login('A');await addTask('t-existente');await waitCloud('A','t-existente');
      await ev(`(()=>{go('tarefas');const f=$('#ftk');f.querySelector('summary')?.click();for(const [name,value] of Object.entries({t:'t-Rascunho A',p:'a',due:'2026-12-04',dur:'45',pj:'Viagem',rc:'w',tg:'casa'})){const i=f.elements[name];i.value=value;i.dispatchEvent(new Event('change',{bubbles:true}))}go('agenda');go('tarefas')})()`);
      const fields=()=>ev(`Object.fromEntries(new FormData($('#ftk')))`);
      assert.deepStrictEqual(await fields(),{t:'t-Rascunho A',p:'a',due:'2026-12-04',dur:'45',pj:'Viagem',rc:'w',tg:'casa',wait:'',waitFor:'',waitReviewDate:''});
      await open();await ev("go('tarefas')");assert.strictEqual((await fields()).t,'t-Rascunho A');
      await ev(`(async()=>{const d=firebase.firestore(),c=__cloud(),m=c["data/users/A/hub-meta"],st=JSON.parse(c["data/users/A/hub-d-core-0"].s);
        st.tasks.push({id:'remote-a5',t:'Tarefa remota',done:false});const s=JSON.stringify(st),rev=m.rev+1;
        await d.doc("data/users/A/hub-d-core-0").set({rev,i:0,s});await d.doc("data/users/A/hub-meta").set({...m,rev,dev:"A5-remoto",doms:{...m.doms,core:{rev,n:1,len:s.length}}})})()`);
      await waitFor(`!!document.querySelector('[data-lid="tk:remote-a5"]')`,'lista atualizada com tarefa remota');
      assert.strictEqual((await fields()).t,'t-Rascunho A');
      assert.ok(!(await cloudTasks('A')).includes('t-Rascunho A'));
      const edited=await ev(`(()=>{
        const card=$('[data-lid="tk:t-existente"]');
        card.querySelector('summary').click();card.querySelector('[data-a="ed"]').click();
        const form=$('#ftk-edit'),placed=card.isConnected?card.nextElementSibling===form:$('[data-lid="tk:t-existente"]').nextElementSibling===form;
        const focused=document.activeElement===form.elements.t;
        form.elements.t.value='t-existente editada';form.requestSubmit();
        return placed&&focused&&S.tasks.find(t=>t.id==='t-existente').t==='t-existente editada';
      })()`);
      assert.ok(edited);
      assert.strictEqual((await fields()).t,'t-Rascunho A');
      await ev('fbLogout()');await waitFor('!FB.on','sair de A');await login('B');await ev("go('tarefas')");
      assert.strictEqual((await fields()).t,'');
      await ev('fbLogout()');await waitFor('!FB.on','sair de B');await login('A');await ev("go('tarefas')");
      assert.strictEqual((await fields()).t,'t-Rascunho A');
      await ev(`(()=>{const f=$('#ftk'),set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='hub-v1')throw new DOMException('quota','QuotaExceededError');return set.call(this,k,v)};try{f.requestSubmit()}finally{Storage.prototype.setItem=set}})()`);
      assert.strictEqual((await fields()).t,'t-Rascunho A');assert.ok(!(await localTasks()).includes('t-Rascunho A'));
      const editPreserved=await ev(`(()=>{
        const card=$('[data-lid="tk:t-existente"]');
        card.querySelector('summary').click();card.querySelector('[data-a="ed"]').click();
        $('#ftk-edit').elements.t.value='Alteração ainda em edição';
        $('#ftk').requestSubmit();
        return $('#ftk-edit')?.elements.t.value;
      })()`);
      assert.strictEqual(editPreserved,'Alteração ainda em edição');
      await ev("go('agenda');go('tarefas')");
      assert.strictEqual((await fields()).t,'');assert.ok((await localTasks()).includes('t-Rascunho A'));
      await ev(`(()=>{const i=$('#ftk').elements.t;i.value='Descartar após editar';i.dispatchEvent(new Event('input',{bubbles:true}));$('[data-a="task-draft-discard"]').click();go('agenda');go('tarefas')})()`);
      assert.strictEqual((await fields()).t,'');
    }],
    ['revisão escolhe próximo passo sem sair e oferece apenas tarefas disponíveis', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.tasks=[{id:'a',t:'Pedir orçamento',p:'m',done:false,due:T},{id:'b',t:'Concluída',p:'m',done:true},{id:'c',t:'Pausada',p:'m',archived:true},{id:'d',t:'Sem vínculo',p:'m',done:false}];S.projects=[{id:'p',t:'Reforma',status:'active',refs:[{id:'tk:a'},{id:'tk:b'},{id:'tk:c'}]}];S.view='hoje';render();const detail=document.querySelector('#review-project-p');document.querySelector('#weekly-review').open=true;detail.closest('[data-review-guide]').open=true;detail.open=true;const choices=[...detail.querySelectorAll('[data-a=project-next]')].map(b=>b.dataset.ref);detail.querySelector('[data-ref=a]').click();const result={choices,next:S.projects[0].nextTask,view:S.view,due:S.tasks[0].due,open:document.querySelector('#review-project-p').open};return result})()`);assert.deepEqual(r.choices,['a']);assert.strictEqual(r.next,'a');assert.strictEqual(r.view,'hoje');assert.ok(r.open);assert.ok(r.due);
      if(process.env.REVIEW_CAPTURE){
        await b.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});await ev(`document.querySelector('#review-project-p').scrollIntoView()`);await sleep(250);const shot=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.REVIEW_CAPTURE,Buffer.from(shot.result.data,'base64'));await b.send('Emulation.clearDeviceMetricsOverride');
      }
    }],
    ['controles recolhidos preservam filtro, atalho e edição da Agenda', async () => {
      await fresh();await login('A');const r=await ev(`(()=>{S.view='tarefas';S.tmode='list';S.filter='all';S.tasks=[];render();const filters=document.querySelector('#task-filters');filters.open=true;filters.querySelector('[data-a=filter][data-id=open]').click();const filterKept=document.querySelector('#task-filters').open&&document.querySelector('#task-filters summary').textContent.includes('Pendentes');focusForm('agenda','#fev');const focused=document.querySelector('#agenda-create').open&&document.activeElement===document.querySelector('#fev input');S.events=[{id:'edit-event',t:'Reunião',d:T,h:'10:00',c:'p'}];ED={t:'ev',id:'edit-event'};render();const editing=document.querySelector('#agenda-create').open&&document.querySelector('#fev').elements.t.value==='Reunião';return {filterKept,focused,editing}})()`);assert.ok(Object.values(r).every(Boolean),JSON.stringify(r));
    }],
    ['conteúdo de Tarefas e Agenda com texto ampliado', async () => {
      await fresh();await login('A');await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:812,deviceScaleFactor:1,mobile:true});
      try{
        const r=await ev(`(()=>{document.documentElement.style.fontSize='200%';S.onb=false;S.tasks=[{id:'mobile',t:'Tarefa para conferir',p:'m',done:false}];S.view='tarefas';S.tmode='list';S.filter='all';render();window.scrollTo(0,0);const task=document.querySelector('[data-lid="tk:mobile"]').getBoundingClientRect().top;S.view='agenda';S.mode='week';render();window.scrollTo(0,0);return {task,agenda:document.querySelector('#agenda-week').getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth+1}})()`);console.log('  conteúdo ampliado:',r);assert.ok(r.task<812&&r.agenda<812,JSON.stringify(r));assert.ok(!r.overflow);
        if(process.env.MOBILE_CAPTURE){
          await sleep(250);const shot=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.MOBILE_CAPTURE,Buffer.from(shot.result.data,'base64'));await ev(`S.view='tarefas';render();window.scrollTo(0,0)`);await sleep(250);const tasksShot=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.MOBILE_CAPTURE+'.tarefas.png',Buffer.from(tasksShot.result.data,'base64'));
        }
      }finally{await ev("document.documentElement.style.fontSize=''");await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['A6: conteúdo diário e filtros do extrato cabem cedo na tela móvel', async () => {
      await fresh();await login('A');await b.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
      try{
        const r=await ev(`(()=>{
          S.tasks=[{id:'priority',t:'Tarefa urgente',done:false,p:'a',hd:T}];S.events=[{id:'later',t:'Próximo compromisso',d:T,h:'23:59',c:'g'}];
          S.onb=false;S.rem={on:true};S.view='hoje';render({save:false});
          const order=!!$('[data-today-priority]')?.textContent.includes('Tarefa urgente')&&!!$('[data-today-appointment]')?.textContent.includes('Próximo compromisso')&&!!($('[data-today-priority]').compareDocumentPosition($('.rv4'))&Node.DOCUMENT_POSITION_FOLLOWING);
          S.view='tarefas';S.tmode='list';render({save:false});const task=$('[data-lid="tk:priority"]').getBoundingClientRect().top;const adv=$('#ftk details');const compact=adv&&!adv.open&&adv.contains($('#ftk').elements.rc);
          S.view='financas';S.fvw='mes';S.ftab='lanc';S.fmo=0;S.fac='';S.fcat='Outros';S.fkd='out';FQ='';FTAG='';FRECON='';
          finInit().tx=[{id:'a6-tx',t:'Despesa de teste',k:'out',cat:'Outros',v:20,d:T,ac:'main'}];render({save:false});window.scrollTo(0,0);
          const filters=$('#tx-filters'),row=$('#txlist .tx-row');
          return {order,compact,task,tx:row?.getBoundingClientRect().top,filters:!filters.open&&filters.contains($('[data-fcat]'))&&$('[data-tx-scope]').textContent.includes('Despesas')&&$('[data-tx-scope]').textContent.includes('Outros'),overflow:document.documentElement.scrollWidth>innerWidth};
        })()`);
        assert.ok(r.order&&r.compact&&r.filters&&!r.overflow,JSON.stringify(r));assert.ok(r.task<620&&r.tx<640,JSON.stringify(r));
        const scoped=await ev(`(()=>{
          finInit().acc.push({id:'a6-empty',n:'Conta sem lançamentos',ty:'cc',ini:0});
          S.fcat='';S.fkd='';S.fac='a6-empty';render({save:false});
          const empty=$('#txlist').textContent,scope=$('[data-tx-scope]').textContent;
          $('#txlist [data-a="fclr"]')?.click();
          return {empty,scope,account:S.fac,rows:document.querySelectorAll('#txlist .tx-row').length};
        })()`);
        assert.match(scoped.empty,/Nenhum lançamento combina/);assert.match(scoped.scope,/Conta sem lançamentos/);
        assert.strictEqual(scoped.account,'');assert.strictEqual(scoped.rows,1);
      }finally{await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['A6: agenda semanal enquadra a data e preserva posição e foco', async () => {
      await fresh();await login('A');await b.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
      try{
        const r=await ev(`(()=>{
          const dow=(today.getDay()+6)%7, date=ds(add(today,-dow+4));
          S.view='hoje';render({save:false});S.mode='week';S.wk=0;go('agenda');
          const rail=()=>$('#agenda-week-heading').nextElementSibling;
          const visible=d=>{const lane=rail().querySelector('[data-day="'+d+'"]')?.getBoundingClientRect(),box=rail().getBoundingClientRect();return !!lane&&Math.min(lane.right,box.right)-Math.max(lane.left,box.left)>=lane.width-1};
          const todayVisible=visible(T);
          $('[data-a="mode"][data-id="month"]').click();$('[data-a="pick"][data-id="'+date+'"]')?.click();$('[data-a="mode"][data-id="week"]').click();const dayVisible=visible(date);
          document.querySelector('#agenda-display').open=true;rail().scrollLeft=140;const before=rail().scrollLeft,button=$('[data-a="mode"][data-id="week"]');button.focus();renderKeepDraft({save:false});
          const preserved=rail().scrollLeft===before&&document.activeElement===$('[data-a="mode"][data-id="week"]');
          $('[data-a="nav"][data-n="1"]').click();const next=!rail().querySelector('[data-day="'+date+'"]')&&rail().scrollLeft===0;
          const nextStart=rail().dataset.start;
          $('[data-a="mode"][data-id="day"]').click();
          const dayInWeek=ds(add(today,S.dy))===nextStart;
          $('[data-a="mode"][data-id="week"]').click();
          $('[data-a="nav"][data-n="0"]').click();
          return {todayVisible,dayVisible,preserved,next,dayInWeek,reset:visible(T)};
        })()`);
        assert.deepStrictEqual(r,{todayVisible:true,dayVisible:true,preserved:true,next:true,dayInWeek:true,reset:true});
      }finally{await b.send('Emulation.clearDeviceMetricsOverride')}
    }],
    ['1. sem login, o hub fica bloqueado', async () => {
      await fresh();
      assert.strictEqual(await ev('$("#gate").hidden'), false, 'tela de login deveria aparecer');
      assert.strictEqual(await ev('$(".app").inert'), true, 'hub deveria estar bloqueado');
      assert.ok(await ev('!!document.querySelector("#gate [data-a=fblogin]")'), 'falta o botão Entrar com o Google');
    }],
    ['2. login libera o hub e grava hub-meta e domínios na nuvem', async () => {
      await fresh(); await login('A');
      assert.strictEqual(await ev('$("#gate").hidden'), true);
      assert.strictEqual(await ev('$(".app").inert'), false);
      await addTask('t-um'); await waitCloud('A', 't-um');
      const keys = await ev('Object.keys(__cloud())');
      assert.ok(keys.includes('data/users/A/hub-meta') && keys.includes('data/users/A/hub-d-core-0'), 'documentos: ' + keys);
    }],
    ['3. mudança de outro aparelho é mesclada', async () => {
      await fresh(); await login('A'); await addTask('t-local'); await waitCloud('A', 't-local');
      await ev(`(async()=>{const d=firebase.firestore(),c=__cloud(),m=c["data/users/A/hub-meta"],st=JSON.parse(c["data/users/A/hub-d-core-0"].s);
        st.tasks.push({id:"t-remoto",t:"t-remoto",d:false});const s=JSON.stringify(st),rev=m.rev+1;
        await d.doc("data/users/A/hub-d-core-0").set({rev,i:0,s});await d.doc("data/users/A/hub-meta").set({...m,rev,dev:"outro",doms:{...m.doms,core:{rev,n:1,len:s.length}}})})()`);
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
        assert.strictEqual(await ev('getComputedStyle($("#mobile-bar")).position'), 'fixed', 'barra inferior deve ser fixa em 375 px');
        assert.ok(await ev('$("#q").getBoundingClientRect().width >= 200'), 'campo de busca deve ter pelo menos 200 px em 375 px');
        assert.strictEqual(await ev('getComputedStyle($(".ftabs")).flexWrap'), 'nowrap', 'abas das Finanças devem rolar numa linha só no celular');
      } finally {
        await b.send('Emulation.clearDeviceMetricsOverride');
      }
    }],
    ['backup completo restaura todas as chaves sincronizáveis e limpa campos omitidos no mínimo', async () => {
      await fresh(); await login('A');
      const r = await ev(`(async()=>{
        S.tasks=[{id:'t1',t:'T1',done:false,p:'m'}];
        S.notes=[{id:'n1',t:'N1',b:'',c:'p',updatedAt:Date.now()}];
        S.lnk=[{a:'tk:t1',b:'nt:n1'}];
        S.sp=[{id:'sp1',n:'Foco',u:'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'}];
        S.spsel='sp1';
        S.wx={city:'Curitiba',lat:-25.43,lon:-49.27};
        S.rem={on:1};S.cap=6;
        S.trash=[{b:'x1',ty:'nt',it:{id:'n0',t:'Lixo'},at:Date.now()}];
        S.frase='Calma';S.frasen=1;S.nav='topo';S.dens='comp';
        S.keys=false;S.hc=true;S.rmo='on';
        S.projects=[{id:'p1',t:'Proj',status:'active',archived:false,refs:[]}];
        S.history=[];auditLog('reviewStart');
        const full=JSON.stringify(pick());
        S.tasks=[];S.notes=[];S.lnk=[];S.sp=[];S.spsel='';S.wx=null;S.rem={};S.cap=8;S.trash=[];
        S.frase='';S.frasen=0;S.nav='suave';S.dens='conf';S.keys=true;S.hc=false;S.rmo='auto';S.projects=[];
        S.view='backup';render();
        const restore=async txt=>{const f=document.querySelector('#bkfile'),dt=new DataTransfer();dt.items.add(new File([txt],'backup.json',{type:'application/json'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));await ${backupDecision}};
        await restore(full);
        const snap={lnk:S.lnk.length,sp:S.sp.length,spsel:S.spsel,wx:S.wx&&S.wx.city,rem:S.rem.on,cap:S.cap,trash:S.trash.length,frase:S.frase,frasen:S.frasen,nav:S.nav,dens:S.dens,keys:S.keys,hc:S.hc,rmo:S.rmo,projects:S.projects.length,dsHc:document.documentElement.dataset.hc,dsRmo:document.documentElement.dataset.rmo,histReview:S.history.some(e=>e.type==='reviewStart'),histRestore:S.history.some(e=>e.type==='backupRestore')};
        await restore(JSON.stringify({tasks:[],events:[]}));
        return {snap,min:{lnk:S.lnk.length,sp:S.sp.length,trash:S.trash.length,projects:S.projects.length,wx:S.wx,cap:S.cap,keys:S.keys,hc:S.hc,rmo:S.rmo}};
      })()`);
      assert.deepStrictEqual(r.snap, {lnk:1,sp:1,spsel:'sp1',wx:'Curitiba',rem:1,cap:6,trash:1,frase:'Calma',frasen:1,nav:'topo',dens:'comp',keys:false,hc:true,rmo:'on',projects:1,dsHc:'1',dsRmo:'1',histReview:true,histRestore:true});
      assert.deepStrictEqual(r.min, {lnk:0,sp:0,trash:0,projects:0,wx:null,cap:8,keys:true,hc:false,rmo:'auto'});
    }],
    ['campos de data brasileiros aceitam digitação direta e atualizam texto em Agenda, PayInv e Captura rápida', async () => {
      await fresh(); await login('A');
      const r = await ev(`(async()=>{
        const wait=(ms=50)=>new Promise(x=>setTimeout(x,ms));
        S.notes=[{id:'n1',t:'Nota',b:'',c:'p',updatedAt:Date.now()}];
        S.metas=[{id:'g1',t:'Meta',ini:T,kr:[]}];
        S.reads=[{id:'r1',t:'Livro',k:'livro',st:'f',p:100,df:''}];
        S.view='notas';render();await wait();
        let d=document.querySelector('[data-note-review="n1"]').closest('.dtw').querySelector('.dtt');
        d.value='25/12/2026';d.dispatchEvent(new Event('input',{bubbles:true}));d.dispatchEvent(new Event('blur',{bubbles:true}));
        S.view='metas';render();await wait();
        d=document.querySelector('[data-goal-review="g1"]').closest('.dtw').querySelector('.dtt');
        d.value='26/12/2026';d.dispatchEvent(new Event('input',{bubbles:true}));d.dispatchEvent(new Event('blur',{bubbles:true}));
        S.view='leituras';RD.tab='collection';render();await wait();
        d=document.querySelector('[data-rd-date="r1"]').closest('.dtw').querySelector('.dtt');
        d.value='27/12/2026';d.dispatchEvent(new Event('input',{bubbles:true}));d.dispatchEvent(new Event('blur',{bubbles:true}));
        S.view='agenda';S.mode='day';render();await wait();
        const hr=document.querySelector('.hr[data-day]');hr?.click();
        const agDay=hr?.dataset.day;
        const agText=document.querySelector('#fev [name="d"]').closest('.dtw').querySelector('.dtt').value;
        S.fin.acc=[{id:'bk',n:'Banco',ty:'bank',ini:1000},{id:'cc',n:'Cartão',ty:'card',ini:0,lim:1000,close:10,due:20}];
        S.fin.tx=[{id:'tcc',k:'out',t:'Compra',v:100,d:T,ac:'cc',cat:'Outros'}];
        S.view='financas';S.fvw='mes';S.ftab='lanc';render();await wait();
        payInv('cc',0);await wait();
        const invText=document.querySelector('#ffin [name="d"]').closest('.dtw').querySelector('.dtt').value;
        qa('tk');await wait();
        const f=document.querySelector('#fqa');f.elements.dest.value='scheduled';f.elements.dest.dispatchEvent(new Event('change',{bubbles:true}));
        const pDtt=f.elements.planned.closest('.dtw').querySelector('.dtt');
        const invalidEmpty=pDtt.required&&!pDtt.checkValidity();
        pDtt.value='28/12/2026';pDtt.dispatchEvent(new Event('input',{bubbles:true}));pDtt.dispatchEvent(new Event('blur',{bubbles:true}));
        const validFilled=pDtt.checkValidity();
        qaClose();
        return {note:S.notes[0].reviewDate,goal:S.metas[0].reviewDate,read:S.reads[0].df,agOk:agText===dtBR(agDay),invOk:invText===dtBR(T),invalidEmpty,validFilled};
      })()`);
      assert.deepStrictEqual(r, {note:'2026-12-25',goal:'2026-12-26',read:'2026-12-27',agOk:true,invOk:true,invalidEmpty:true,validFilled:true});
    }],
    ['desfazer na toast de snapRestore reverte a restauração sem disparar UN antigo', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        S.tasks=[{id:'t1',t:'Original',done:false,p:'m'}];save();
        snapPut('Base');const t1=snaps()[0].t;
        S.view='tarefas';render();
        document.querySelector('[data-a="deltk"][data-id="t1"]').click();
        S.tasks.push({id:'t2',t:'Depois',done:false,p:'m'});save();
        snapRestore(t1);
        const restoredOk=S.tasks.some(x=>x.id==='t1')&&!S.tasks.some(x=>x.id==='t2');
        document.querySelector('#toast [data-a="undo"]').click();
        return {restoredOk,hasT2:S.tasks.some(x=>x.id==='t2'),hasT1:S.tasks.some(x=>x.id==='t1')};
      })()`);
      assert.deepStrictEqual(r, {restoredOk:true,hasT2:true,hasT1:false});
    }],
    ['acctSwap exclui hub-snaps e preserva compatibilidade com formato legado em array', async () => {
      await fresh(); await login('A');
      await ev('localStorage.setItem("hub-snaps",JSON.stringify([{t:1,n:"snap",j:"{}"}]))');
      await ev('fbLogout()'); await waitFor('!FB.on', 'sair de A');
      await login('B');
      const aPack = await ev('({raw:localStorage.getItem("hub-acct-A"),snaps:localStorage.getItem("hub-snaps")})');
      const parsedA = JSON.parse(aPack.raw);
      assert.ok(!Array.isArray(parsedA) && typeof parsedA === 'object');
      assert.strictEqual(parsedA['hub-snaps'], undefined);
      assert.ok(typeof parsedA['hub-v1'] === 'string');
      assert.strictEqual(aPack.snaps, null);
      await ev('fbLogout()'); await waitFor('!FB.on', 'sair de B');
      await ev(`localStorage.setItem("hub-acct-C",JSON.stringify([JSON.stringify({tasks:[{id:"leg1",t:"t-legado",done:false,p:"m"}],events:[],notes:[],links:[]}),JSON.stringify({uid:"C",rev:0,dev:"legacy"}),JSON.stringify([{t:9,n:"velho",j:"{}"}]),"[]","{}"]))`);
      await login('C');
      assert.deepStrictEqual(await ev('S.tasks.map(t=>t.t)'), ['t-legado']);
      assert.strictEqual(await ev('localStorage.getItem("hub-snaps")'), null);
    }],
    ['segurança: toast escapa nomes dinâmicos e colagem em .rt remove markup inseguro', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        window.__xss=undefined;
        S.metas=[{id:'m1',t:'<img src=x onerror="window.__xss=1">',ini:T,kr:[]}];
        S.fin={...finInit(),goals:[{id:'g1',n:'Meta segura',target:100,saved:0}],rules:[{id:'r1',m:'cafe',k:'out',cat:'<img src=x onerror="window.__xss=1">',sub:'<b>Café</b>',on:true}]};
        S.view='financas';S.fvw='mes';S.ftab='orc';render();
        const gf=document.querySelector('[data-gl="g1"]');
        gf.elements.m.value='m1';gf.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const goalToastImg=!!document.querySelector('#toast img');
        S.ftab='lanc';render();
        finSubmit({k:'out',t:'Compra cafe',v:'15',cat:'',d:T,ac:finInit().acc[0].id});
        const ruleToastImg=!!document.querySelector('#toast img');
        S.notes=[{id:'n1',t:'Nota',b:'',c:'p',updatedAt:Date.now()}];S.view='notas';render();
        document.querySelector('[data-a=note-edit]').click();const rt=document.querySelector('.note .rt');rt.focus();
        const dt=new DataTransfer();dt.setData('text/html','<img src=x onerror="window.__xss=1"><b>ok</b>');dt.setData('text/plain','ok');
        const pe=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt});
        rt.dispatchEvent(pe);
        return {xss:window.__xss,goalToastImg,ruleToastImg,rtImg:!!rt.querySelector('img'),rtHtml:rt.innerHTML};
      })()`);
      assert.strictEqual(r.xss, undefined);
      assert.strictEqual(r.goalToastImg, false);
      assert.strictEqual(r.ruleToastImg, false);
      assert.strictEqual(r.rtImg, false);
      assert.match(r.rtHtml, /ok/);
    }],
    ['modo privacidade oculta miniaturas de notas, busca, revisão anual do diário e Ctrl+K', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        S.notes=[{id:'n1',t:'Segredo',b:'Conteúdo privado da nota',c:'p',updatedAt:Date.now()}];
        S.dia={[T]:{m:5,a:'Texto íntimo segredo',b:'Vitória privada'}};
        if(!PRIV)togglePriv();
        S.cards=cfg().map(c=>c.id==='notas'?{...c,on:true}:c);S.view='dash';render();
        const tileBlur=getComputedStyle(document.querySelector('[data-card="notas"] .ntile span')).filter.includes('blur');
        Q='segredo';render();
        const searchBlurs=[...document.querySelectorAll('#main [data-priv-text]')].map(el=>getComputedStyle(el).filter);
        Q='';S.view='diario';S.dvw='ano';render();
        const yearBlurs=[...document.querySelectorAll('#main [data-priv-text]')].map(el=>getComputedStyle(el).filter);
        const ckDia=ckItems('segredo').find(x=>x.l.startsWith('Diário '));
        togglePriv();
        return {tileBlur,searchCount:searchBlurs.length,searchBlurAll:searchBlurs.every(f=>f.includes('blur')),yearCount:yearBlurs.length,yearBlurAll:yearBlurs.every(f=>f.includes('blur')),ckMasked:!!ckDia&&ckDia.l.includes('•••••')&&!ckDia.l.includes('Texto íntimo')};
      })()`);
      assert.deepStrictEqual(r, {tileBlur:true,searchCount:2,searchBlurAll:true,yearCount:2,yearBlurAll:true,ckMasked:true});
    }],
    ['alerta mobile de sincronização aparece em falha no celular e some ao sincronizar', async () => {
      await fresh(); await login('A');
      await b.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
      try {
        const errState = await ev('(()=>{setSt("err","sem conexão");const el=$("#mobile-sync-alert");return {hidden:el.hidden,display:getComputedStyle(el).display,text:el.textContent}})()');
        assert.strictEqual(errState.hidden, false);
        assert.notStrictEqual(errState.display, 'none');
        assert.match(errState.text, /sem conexão/i);
        const okState = await ev('(()=>{setSt("ok","salvo");return $("#mobile-sync-alert").hidden})()');
        assert.strictEqual(okState, true);
      } finally {
        await b.send('Emulation.clearDeviceMetricsOverride');
      }
    }],
    ['ux e acessibilidade: ordem da rotina, cards de links sem botões aninhados, projetos e Spotify flutuante', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        S.view='rotina';render();
        const rts=document.querySelector('ol.rts'),tools=document.querySelector('[data-rotina-tools]');
        const rotOrder=!!(rts&&tools&&(rts.compareDocumentPosition(tools)&Node.DOCUMENT_POSITION_FOLLOWING));
        S.links=[{id:'l1',n:'Meu link',u:'https://example.com',cat:'Trabalho',k:'1',tg:'dev',c:'p'}];
        S.view='links';render();
        const nestedBtns=document.querySelectorAll('.link a button').length;
        const linkBtns=[...document.querySelectorAll('.link .x')].map(el=>{const box=el.getBoundingClientRect();return {w:Math.round(box.width),h:Math.round(box.height)}});
        S.projects=[{id:'prj1',t:'Mudança casa',status:'active',archived:false,refs:[]}];
        Q='Mudança';render();const searchHasPrj=document.querySelector('#main').textContent.includes('Mudança casa');Q='';
        const ckHasPrj=ckItems('Mudança').some(x=>x.l.includes('Mudança casa'));
        const ckArch=ckItems('arquivados').find(x=>x.g==='Ir para'&&x.l.includes('Arquivados'));
        S.sp=[{id:'sp1',n:'Mix',u:'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'}];S.spsel='sp1';
        S.cards=cfg().map(c=>c.id==='spotify'?{...c,on:true}:c);
        S.view='dash';render();
        document.querySelector('[data-a="spload"]').click();
        const fr0=document.querySelector('#spwrap iframe'),noFloatDash=!!fr0&&!document.querySelector('#spwrap').classList.contains('sp-float');
        S.view='tarefas';render();
        const floatOk=document.querySelector('#spwrap').classList.contains('sp-float')&&document.querySelector('#spwrap iframe')===fr0;
        document.querySelector('[data-a="spmin"]').click();
        const minOk=document.querySelector('#spwrap').classList.contains('sp-min')&&document.querySelector('#spwrap iframe')===fr0;
        document.querySelector('[data-a="spstop"]').click();
        const stoppedOk=!document.querySelector('#spwrap');
        return {rotOrder,nestedBtns,linkBtnOk:linkBtns.length>0&&linkBtns.every(x=>x.w>=44&&x.h>=44),searchHasPrj,ckHasPrj,archIco:!!(ckArch&&ckArch.ico),noFloatDash,floatOk,minOk,stoppedOk};
      })()`);
      assert.deepStrictEqual(r, {rotOrder:true,nestedBtns:0,linkBtnOk:true,searchHasPrj:true,ckHasPrj:true,archIco:true,noFloatDash:true,floatOk:true,minOk:true,stoppedOk:true});
    }],
    ['desempenho: render preguiçoso no Início, nas Finanças e render({save:false})', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        let finCalls=0,yoyCalls=0,txCalls=0,saveHubV1Calls=0;
        const origFinCard=finCard;window.finCard=(...a)=>{finCalls++;return origFinCard(...a)};
        S.cards=cfg().map(c=>c.id==='fin'?{...c,on:false}:c);
        S.view='dash';render();
        const finOffCalls=finCalls;
        S.cards=cfg().map(c=>c.id==='fin'?{...c,on:true}:c);
        render();
        const finOnCalls=finCalls-finOffCalls;
        window.finCard=origFinCard;
        const origYoy=yoyPanel,origTx=txListHtml;
        window.yoyPanel=(...a)=>{yoyCalls++;return origYoy(...a)};
        window.txListHtml=(...a)=>{txCalls++;return origTx(...a)};
        S.view='financas';S.fvw='mes';S.ftab='contas';render();
        const contasYoy=yoyCalls,contasTx=txCalls;
        S.ftab='lanc';render();
        const lancTx=txCalls-contasTx;
        window.yoyPanel=origYoy;window.txListHtml=origTx;
        const origSet=Storage.prototype.setItem;
        Storage.prototype.setItem=function(k,v){if(k==='hub-v1')saveHubV1Calls++;return origSet.call(this,k,v)};
        render({save:false});
        Storage.prototype.setItem=origSet;
        return {finOffCalls,finOnCalls,contasYoy,contasTx,lancTx,saveHubV1Calls};
      })()`);
      assert.deepStrictEqual(r, {finOffCalls:0,finOnCalls:1,contasYoy:0,contasTx:0,lancTx:1,saveHubV1Calls:0});
    }],
    ['prateleira de filmes e séries exibe pôster ou lombada, busca iTunes e persiste ficha no backup', async () => {
      await fresh(); await login('A');
      const r = await ev(`(async()=>{
        RD.tab='shelf';RD.shelfKind='all';RD.shelfYear='';RD.shelfFav='';RD.movieMode='poster';RD.selected='';
        S.reads=[
          {id:'b1',t:'Dom Casmurro',a:'Machado de Assis',k:'livro',st:'f',df:T,r:4},
          {id:'m1',t:'Central do Brasil',a:'Walter Salles',k:'filme',st:'f',df:T,r:5,year:1998,mins:113,n:'Clássico nacional'},
          {id:'s1',t:'Série Teste',a:'Criadora',k:'série',st:'f',df:T,season:2,episode:8}
        ];
        S.view='leituras';render();
        const bookCount=document.querySelectorAll('.bookshelf .book-spine').length;
        const posterCount=document.querySelectorAll('.movieshelf .movie-poster').length;
        document.querySelector('[data-a="rd-movie-mode"][data-id="spine"]').click();
        const spineCount=document.querySelectorAll('.movieshelf .movie-spine').length;
        document.querySelector('[data-a="rd-open"][data-id="m1"]').click();
        const detailText=document.querySelector('#book-detail').innerText;
        const oldFetch=window.fetch,OldImage=window.Image,oldContext=HTMLCanvasElement.prototype.getContext;
        window.fetch=async()=>({ok:true,json:async()=>({results:[{artworkUrl100:'https://is1-ssl.mzstatic.com/image/thumb/Video/v4/p/100x100bb.jpg',trackName:'Central do Brasil',artistName:'Walter Salles',releaseDate:'1998-04-03T00:00:00Z',trackTimeMillis:6780000}]})});
        window.Image=class{set src(v){queueMicrotask(()=>this.onload())}};
        HTMLCanvasElement.prototype.getContext=function(){return {drawImage(){},getImageData(){return {data:new Uint8ClampedArray([30,90,150,255,30,90,150,255])}}}};
        await findCover('m1');
        document.querySelector('[data-a="rd-cover-use"]').click();
        await new Promise(x=>setTimeout(x,30));
        window.fetch=oldFetch;window.Image=OldImage;HTMLCanvasElement.prototype.getContext=oldContext;
        const m1={...S.reads.find(x=>x.id==='m1')},okBackup=validBackup(pick()),data=JSON.stringify(pick());
        S.reads=[];S.view='backup';render();
        const f=document.querySelector('#bkfile'),dt=new DataTransfer();
        dt.items.add(new File([data],'backup.json',{type:'application/json'}));
        f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));
        await ${backupDecision};
        return {bookCount,posterCount,spineCount,hasDuration:/113 min/.test(detailText),hasQuote:/Clássico nacional/.test(detailText),coverUrl:m1.coverUrl,color:m1.coverColor,okBackup,restoredSeason:S.reads.find(x=>x.id==='s1')?.season,restoredEp:S.reads.find(x=>x.id==='s1')?.episode};
      })()`);
      assert.strictEqual(r.bookCount, 1);
      assert.strictEqual(r.posterCount, 2);
      assert.strictEqual(r.spineCount, 2);
      assert.ok(r.hasDuration && r.hasQuote && r.okBackup);
      assert.match(r.coverUrl, /300x450bb\.jpg/);
      assert.strictEqual(r.color, '#1e5a96');
      assert.strictEqual(r.restoredSeason, 2);
      assert.strictEqual(r.restoredEp, 8);
    }],
    ['estante ajusta largura por páginas, destaca favoritos, permite cor e URL manual e agrupa por ano', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        RD.tab='shelf';RD.shelfKind='books';RD.shelfYear='';RD.shelfFav='';RD.selected='';
        S.reads=[
          {id:'b_thin',t:'Contos',a:'Autor A',k:'livro',st:'f',df:'2026-06-01',r:5,pages:90},
          {id:'b_thick',t:'Calhamaço',a:'Autor B',k:'livro',st:'f',df:'2025-05-01',r:3,pages:700}
        ];
        S.view='leituras';render();
        const thinW=parseFloat(document.querySelector('#spine-b_thin').style.getPropertyValue('--book-w'));
        const thickW=parseFloat(document.querySelector('#spine-b_thick').style.getPropertyValue('--book-w'));
        const favAttr=document.querySelector('#spine-b_thin').dataset.fav;
        document.querySelector('[data-a="rd-shelf-fav"][data-id="5"]').click();
        const afterFavCount=document.querySelectorAll('.bookshelf .book-spine').length;
        document.querySelector('[data-a="rd-shelf-fav"][data-id="5"]').click();
        document.querySelector('[data-a="rd-shelf-year"][data-id="by-year"]').click();
        const badges=[...document.querySelectorAll('.shelf-badge')].map(el=>el.textContent.trim());
        document.querySelector('[data-a="rd-open"][data-id="b_thin"]').click();
        let cIn=document.querySelector('[data-rd-color="b_thin"]');
        cIn.value='#336699';cIn.dispatchEvent(new Event('change',{bubbles:true}));
        const uIn=document.querySelector('[data-rd-cover-url="b_thin"]');
        uIn.value='https://example.com/capa.jpg';uIn.dispatchEvent(new Event('change',{bubbles:true}));
        cIn=document.querySelector('[data-rd-color="b_thin"]');
        cIn.value='#336699';cIn.dispatchEvent(new Event('change',{bubbles:true}));
        return {thinW,thickW,favAttr,afterFavCount,badges,item:S.reads[0]};
      })()`);
      assert.ok(r.thickW > r.thinW);
      assert.strictEqual(r.favAttr, '1');
      assert.strictEqual(r.afterFavCount, 1);
      assert.deepStrictEqual(r.badges, ['2026', '2025']);
      assert.strictEqual(r.item.coverUrl, 'https://example.com/capa.jpg');
      assert.strictEqual(r.item.coverColor, '#336699');
    }],
    ['cabeceira em andamento, sorteador da fila, soma anual e nota vinculada', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        RD.tab='collection';RD.picked='';S.rk='';S.rs='';
        S.notes=[];S.lnk=[];
        S.reads=[
          {id:'q1',t:'Filme na fila',a:'Dir.',k:'filme',st:'q'},
          {id:'a1',t:'Livro atual',a:'Autora',k:'livro',st:'a',pages:100,page:95,p:95,n:'Trecho favorito'},
          {id:'f1',t:'Livro ano',k:'livro',st:'f',df:T,pages:240,r:5},
          {id:'m1',t:'Filme ano',k:'filme',st:'f',df:T,mins:130,r:4}
        ];
        S.view='leituras';render();
        const summary=document.querySelector('#main .panel').innerText;
        document.querySelector('[data-a="rd-pick-random"]').click();
        const pickedOk=!!document.querySelector('[data-rd-picked]');
        document.querySelector('[data-a="rd-start"][data-id="q1"]').click();
        const startedSt=S.reads.find(x=>x.id==='q1').st;
        document.querySelector('[data-a="rd-tab"][data-id="shelf"]').click();
        const nowCount=document.querySelectorAll('.shelf-now .now-card').length;
        document.querySelector('[data-a="rd-step"][data-id="a1"]').click();
        const doneBook=S.reads.find(x=>x.id==='a1');
        document.querySelector('[data-a="rd-open"][data-id="a1"]').click();
        document.querySelector('[data-a="rd-note-create"][data-id="a1"]').click();
        return {summary,pickedOk,startedSt,nowCount,doneSt:doneBook.st,doneP:doneBook.p,notes:S.notes.length,noteBody:S.notes[0]?.b,links:lkOf('rd:a1')};
      })()`);
      assert.match(r.summary, /240.*páginas/);
      assert.match(r.summary, /2h 10min de filmes/);
      assert.ok(r.pickedOk);
      assert.strictEqual(r.startedSt, 'a');
      assert.strictEqual(r.nowCount, 2);
      assert.strictEqual(r.doneSt, 'f');
      assert.strictEqual(r.doneP, 100);
      assert.strictEqual(r.notes, 1);
      assert.match(r.noteBody, /Trecho favorito/);
      assert.strictEqual(r.links.length, 1);
      assert.match(r.links[0], /^nt:/);
    }],
    ['service worker também guarda pôsteres do catálogo iTunes para uso offline', async () => {
      const vm=require('vm'),handlers={},store=new Map();let online=true,network=0;
      const cache={match:async req=>store.get(req.url),put:async(req,res)=>store.set(req.url,res),keys:async()=>[...store.keys()].map(url=>({url})),delete:async req=>store.delete(req.url)};
      const context={URL,self:{location:{origin:'https://app.example'},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>cache},fetch:async()=>{network++;if(!online)throw Error('offline');return {ok:true,type:'cors',clone(){return this}}}};
      vm.runInNewContext(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),context);
      const request={method:'GET',url:'https://is1-ssl.mzstatic.com/image/thumb/Video116/v4/poster/300x450bb.jpg'};
      let response;const event={request,respondWith:p=>{response=p}};
      handlers.fetch(event);assert.strictEqual((await response).ok,true);
      online=false;handlers.fetch(event);assert.strictEqual((await response).ok,true);
      assert.strictEqual(network,1);
      const wReq={method:'GET',url:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Poster.jpg'};
      online=true;handlers.fetch({request:wReq,respondWith:p=>{response=p}});assert.strictEqual((await response).ok,true);
      online=false;handlers.fetch({request:wReq,respondWith:p=>{response=p}});assert.strictEqual((await response).ok,true);
      assert.strictEqual(network,2);
    }],
    ['filtros separados de filmes e séries, sorteio direto na Estante, concluir da cabeceira, fallback Wikipédia e barra de meta', async () => {
      await fresh(); await login('A');
      const r = await ev(`(async()=>{
        RD.tab='shelf';RD.shelfKind='all';RD.shelfYear='';RD.shelfFav='';RD.picked='';RD.selected='';
        S.metas=[{id:'g1',t:'Ler 10 livros neste ano',ini:T,kr:[{id:'k1',ty:'man',ref:'',t:'Livros',tg:10,un:'livros',cur:4}]}];
        S.reads=[
          {id:'fq',t:'Filme na fila',a:'Dir',k:'filme',st:'q'},
          {id:'sq',t:'Série na fila',k:'série',st:'q'},
          {id:'ma',t:'Filme em andamento',k:'filme',st:'a',p:40},
          {id:'mf',t:'Filme visto',k:'filme',st:'f',df:T,r:5},
          {id:'sf',t:'Série vista',k:'série',st:'f',df:T,r:4}
        ];
        S.view='leituras';render();
        document.querySelector('[data-a="rd-shelf-kind"][data-id="movies"]').click();
        const onlyFilms=document.querySelectorAll('.movieshelf .movie-item').length;
        document.querySelector('[data-a="rd-pick-random"]').click();
        const pickedOnShelf=document.querySelector('[data-rd-picked]')?.textContent||'';
        document.querySelector('[data-a="rd-shelf-kind"][data-id="series"]').click();
        const onlySeries=document.querySelectorAll('.movieshelf .movie-item').length;
        document.querySelector('[data-a="rd-finish"][data-id="ma"]').click();
        const maDone=S.reads.find(x=>x.id==='ma');
        document.querySelector('[data-a="rd-shelf-kind"][data-id="movies"]').click();
        document.querySelector('[data-a="rd-open"][data-id="mf"]').click();
        const oldFetch=window.fetch;
        window.fetch=async u=>{
          if(String(u).includes('itunes.apple.com'))return {ok:true,json:async()=>({results:[]})};
          if(String(u).includes('pt.wikipedia.org'))return {ok:true,json:async()=>({query:{pages:{'1':{title:'Filme Wiki',description:'filme brasileiro',thumbnail:{source:'https://upload.wikimedia.org/wikipedia/commons/p/poster.jpg'}}}}})};
          return {ok:true,json:async()=>({})};
        };
        await findCover('mf');
        window.fetch=oldFetch;
        const wikiCount=document.querySelectorAll('#cover-results-mf .cover-result').length;
        const wikiText=document.querySelector('#cover-results-mf')?.textContent||'';
        document.querySelector('[data-a="rd-tab"][data-id="collection"]').click();
        const hasGoalBar=!!document.querySelector('#main .panel .prog');
        return {onlyFilms,pickedOnShelf,onlySeries,maSt:maDone.st,maP:maDone.p,wikiCount,wikiText,hasGoalBar};
      })()`);
      assert.strictEqual(r.onlyFilms, 1);
      assert.match(r.pickedOnShelf, /Filme na fila/);
      assert.strictEqual(r.onlySeries, 1);
      assert.strictEqual(r.maSt, 'f');
      assert.strictEqual(r.maP, 100);
      assert.strictEqual(r.wikiCount, 1);
      assert.match(r.wikiText, /Filme Wiki/);
      assert.ok(r.hasGoalBar);
    }],
    ['tema escuro mantém contraste legível em controles de notas, listas, chips, eventos e destaques', async () => {
      await fresh(); await login('A');
      const r = await ev(`(async()=>{
        const tick=()=>new Promise(x=>setTimeout(x,0));
        const parse=c=>{const m=String(c||'').match(/[\\d.]+/g);if(!m)return [0,0,0,0];return [Number(m[0]),Number(m[1]),Number(m[2]),m.length>3?Number(m[3]):1]};
        const over=(fg,bg)=>{const a=fg[3];return [fg[0]*a+bg[0]*(1-a),fg[1]*a+bg[1]*(1-a),fg[2]*a+bg[2]*(1-a)]};
        const lum=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
        const effBg=el=>{const layers=[];for(let p=el;p&&p.nodeType===1;p=p.parentElement){const bg=parse(getComputedStyle(p).backgroundColor);if(bg[3]>0)layers.unshift(bg)}return layers.reduce((acc,cur)=>over(cur,acc),[31,27,36])};
        const contrast=(el,useAlphaFg)=>{const bg=effBg(el),cs=getComputedStyle(el),c0=parse(cs.color),op=Number(cs.opacity===''?1:cs.opacity),fg=useAlphaFg?over([c0[0],c0[1],c0[2],c0[3]*op],bg):c0.slice(0,3),l1=lum(bg),l2=lum(fg);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};
        const bad=[],chk=(label,el,min=4.5)=>{if(!el){bad.push({label,missing:true});return}const c=contrast(el,true);if(c<min)bad.push({label,ratio:+c.toFixed(2),fg:getComputedStyle(el).color,bg:effBg(el).map(Math.round)})};

        S.themeMode='dark';S.acc='';S.nav='suave';
        S.tasks=[{id:'t1',t:'Tarefa sem hora',done:false,hd:T,p:'m'},{id:'t2',t:'Bloqueio',done:false,dur:60,bk:{d:T,h:'10:00'}}];
        S.events=[{id:'e1',t:'Reunião',d:T,h:'09:00',e:'10:00',c:'b'}];
        S.notes=[
          {id:'n1',t:'Nota normal',b:'Corpo',f:'Trab',g:'tag',c:'p',reviewDate:T},
          {id:'s1',kind:'shopping',t:'Mercado',f:'',g:'',c:'g',items:[{id:'i1',t:'Café',q:'1 pct',done:false}],budget:50}
        ];
        S.projects=[{id:'p1',t:'Projeto X',status:'active',archived:false,refs:[]}];
        S.fin.prules=[{id:'r1',k:'save',pc:20}];
        S.reads=[{id:'b1',t:'Livro Ativo',a:'Autor',k:'livro',st:'a',pages:100,page:20,p:20}];

        for(const pal of Object.keys(PAL)){
          S.pal=pal;applyTheme();
          S.view='dash';render();await tick();
          chk(pal+':dash-tl-ev',document.querySelector('.tl:not(.blk)'));
          chk(pal+':dash-tl-blk',document.querySelector('.tl.blk'));
          chk(pal+':dash-tlf-chip',document.querySelector('.tlf .chip'));
          chk(pal+':dash-focus-in',document.querySelector('.hero2 .focus input'));

          S.view='notas';render();await tick();
          chk(pal+':note-select-color',document.querySelector('[data-note-color=n1]'));
          chk(pal+':note-review-dtt',document.querySelector('.note .dtt'));
          chk(pal+':note-review-btn',document.querySelector('.note .dtw .dtb'));
          chk(pal+':note-lb',document.querySelector('.note .lb'));
          chk(pal+':note-empty-p',document.querySelector('#main .note .empty'));
          chk(pal+':shop-item',document.querySelector('.note .item'));
          chk(pal+':shop-input',document.querySelector('[data-shopping-form] .in'));
          chk(pal+':shop-pill',document.querySelector('[data-a="shopping-share"]'));
          chk(pal+':shop-pill-dark',document.querySelector('[data-shopping-form] .pill.dark'));

          RD.tab='shelf';RD.selected='b1';S.view='leituras';render();await tick();
          chk(pal+':now-card-chip',document.querySelector('.now-card .chip'));
          chk(pal+':book-detail-link',document.querySelector('#book-detail a'));
          RD.tab='collection';render();await tick();
          chk(pal+':read-select-st',document.querySelector('[data-rds=b1]'));
          chk(pal+':read-search-cover',document.querySelector('[data-a="rd-cover-find"]'));
          chk(pal+':read-cover-link',document.querySelector('.note a'));

          S.view='projetos';render();await tick();
          chk(pal+':project-chip',document.querySelector('[data-project=p1] .chip'));

          S.view='agenda';S.mode='week';render();await tick();
          chk(pal+':agenda-today-h3',document.querySelector('.day.today h3'));
          chk(pal+':agenda-today-small',document.querySelector('.day.today h3 small'));
          chk(pal+':agenda-blk-x',document.querySelector('.ev.blk .x'));
          S.mode='month';render();await tick();
          chk(pal+':agenda-month-ev',document.querySelector('.mev'));

          S.view='financas';S.fvw='mes';S.ftab='orc';S.fin.tx=[];render();await tick();
          chk(pal+':fin-prule-empty-chip',document.querySelector('.item .chip'));
        }
        S.pal='ceu';applyTheme();

        S.view='aparencia';render();await tick();
        const defSwc=getComputedStyle(document.querySelector('[data-a="acc"][data-id=""]')).backgroundColor;
        const accVal=document.querySelector('#acc').value;
        S.acc='#1f3a5f';applyTheme();render();await tick();
        chk('side-nav-on-custom',document.querySelector('.side .nav.on'));
        S.acc='';applyTheme();
        return {bad,defSwc,accVal};
      })()`);
      assert.deepStrictEqual(r.bad, [], JSON.stringify(r.bad));
      assert.notStrictEqual(r.defSwc, 'rgb(18, 18, 18)');
      assert.notStrictEqual(r.accVal, '#121212');
    }],
    ['importação de extrato com resumo (Mercado Pago), categorização automática, edição na prévia e detecção por ID', async () => {
      await fresh(); await login('A');
      const csv = [
        'INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE',
        '559,05;1.246,26;-674,26;1.131,05',
        '',
        'RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE',
        '22-10-2026;Rendimentos ;1751973950668;0,23;559,28',
        '23-10-2026;Pagamento DIA;185741202268;-4,48;506,54',
        '27-10-2026;Pagamento com Pix 99 TECNOLOGIA LTDA;185393267235;-20,62;313,97',
        '29-10-2026;Pagamento ;186727431602;-39,86;250,60',
        '29-10-2026;Reembolso de pagamento ;186727431602;39,86;261,27',
        '04-11-2026;Pix automático Ebanx;186617785871;-16,79;181,66',
        '04-11-2026;Pagamento iFood;186752429457;-49,10;679,56',
        '05-11-2026;Pagamento Kalunga sant*kalunga 0;187948983462;-99,50;512,55',
        '06-11-2026;Transferência recebida VITORIA CRISTINA PACHECO DE JESUS;187006854523;1.156,17;1.524,66',
        '06-11-2026;Reserva por gasto Emergências;188085990522;-2,00;1.494,67',
        '06-11-2026;Reserva por gasto Emergências;188154756920;-2,00;1.480,81',
        '09-11-2026;Pagamento com Pix CLARO NXT TELECOMUNICACOES SA;188616751014;-224,70;630,52',
        '09-11-2026;Pagamento Uber;188757434166;-15,87;561,16',
        '10-11-2026;Pagamento Restauranteelanch;188865040222;-43,00;397,02',
        '12-11-2026;Pagamento Av santa catarina;189255754288;-6,00;258,66',
        '17-11-2026;Dinheiro retirado Emergências;190138051780;50,00;64,45',
        '20-11-2026;Pagamento Anthropic* claude sub;189593632315;-113,85;808,56',
        '20-11-2026;Pagamento OXXO;190785071546;-19,59;727,94',
        '23-10-2026;Pagamento GOOGLE BRASIL PAGAMENTOS LTDA.;184789336743;-16,90;480,58'
      ].join('\n');
      const r = await ev(`(()=>{
        S.fin={tx:[],acc:[{id:'main',n:'Conta principal',ty:'cc',ini:0}],rec:[],rules:[],bud:{},goals:[],prules:[],split:[],bills:[]};
        S.view='financas';S.fvw='mes';S.ftab='regras';render();
        const pf=document.querySelector('#fcsvpaste');
        pf.elements.csv.value=${JSON.stringify(csv)};
        pf.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const previewBefore={...impRows(),meta:IMP.meta};
        const rest=document.querySelector('[data-imp-rest]');if(rest)rest.open=true;
        const avSel=document.querySelector('[data-imp-cat="pagamento av santa catarina"]');
        avSel.value='Alimentação';avSel.dispatchEvent(new Event('change',{bubbles:true}));
        const restStayedOpen=!!document.querySelector('[data-imp-rest][open]');
        document.querySelector('[data-a="impgo"]').click();
        const tx=S.fin.tx.slice();
        const byDesc=d=>tx.find(x=>x.t.includes(d));
        const balance=+bal(S.fin.acc[0]).toFixed(2);
        const valid=validBackup(pick());
        const pf2=document.querySelector('#fcsvpaste');
        pf2.elements.csv.value=${JSON.stringify(csv)};
        pf2.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const reimport=impRows();
        IMP=null;
        S.fin.tx.push({id:'legacy-outros',k:'out',t:'Pagamento OXXO',v:10,cat:'Outros',d:T,ac:'main'});
        const applied=applyRules(false);
        const legacy=S.fin.tx.find(x=>x.id==='legacy-outros');
        return {
          meta:previewBefore.meta,
          resTotal:previewBefore.resTotal,
          bad:previewBefore.bad,
          dupBefore:previewBefore.rows.filter(x=>x.dup).length,
          restStayedOpen,
          count:tx.length,
          balance,
          valid,
          rules:S.fin.rules.length,
          dia:byDesc('Pagamento DIA'),
          oxxo:byDesc('Pagamento OXXO'),
          rest:byDesc('Restauranteelanch'),
          ifood:byDesc('iFood'),
          uber:byDesc('Uber'),
          p99:byDesc('99 TECNOLOGIA'),
          claro:byDesc('CLARO NXT'),
          google:byDesc('GOOGLE BRASIL'),
          ebanx:byDesc('Ebanx'),
          claude:byDesc('Anthropic'),
          kalunga:byDesc('Kalunga'),
          rend:byDesc('Rendimentos'),
          reemb:byDesc('Reembolso de pagamento'),
          resgate:byDesc('Dinheiro retirado'),
          av:byDesc('Av santa catarina'),
          reservas:tx.filter(x=>x.t==='Reserva por gasto Emergências').length,
          reimportAllDup:reimport.rows.every(x=>x.dup),
          applied,
          legacyCat:legacy.cat,
          legacySub:legacy.sub,
          aluguelDia:dictCat('Aluguel dia 5')
        };
      })()`);
      assert.strictEqual(r.meta.ini, 559.05);
      assert.strictEqual(r.resTotal, 3);
      assert.deepStrictEqual(r.bad, []);
      assert.strictEqual(r.dupBefore, 0);
      assert.ok(r.restStayedOpen);
      assert.strictEqual(r.count, 19);
      assert.strictEqual(r.reservas, 2);
      assert.strictEqual(r.balance, 1131.05);
      assert.ok(r.valid);
      assert.strictEqual(r.rules, 1);
      assert.strictEqual(r.dia.cat, 'Alimentação'); assert.strictEqual(r.dia.sub, 'Mercado');
      assert.strictEqual(r.oxxo.cat, 'Alimentação'); assert.strictEqual(r.oxxo.sub, 'Mercado');
      assert.strictEqual(r.rest.cat, 'Alimentação'); assert.strictEqual(r.rest.sub, 'Restaurante');
      assert.strictEqual(r.ifood.cat, 'Alimentação'); assert.strictEqual(r.ifood.sub, 'Delivery');
      assert.strictEqual(r.uber.cat, 'Transporte'); assert.strictEqual(r.uber.sub, 'App');
      assert.strictEqual(r.p99.cat, 'Transporte'); assert.strictEqual(r.p99.sub, 'App');
      assert.strictEqual(r.claro.cat, 'Moradia'); assert.strictEqual(r.claro.sub, 'Internet e telefone');
      assert.strictEqual(r.google.cat, 'Assinaturas'); assert.strictEqual(r.google.sub, 'Serviços digitais');
      assert.strictEqual(r.ebanx.cat, 'Assinaturas');
      assert.strictEqual(r.claude.cat, 'Assinaturas'); assert.strictEqual(r.claude.sub, 'IA e software');
      assert.strictEqual(r.kalunga.cat, 'Educação');
      assert.strictEqual(r.rend.cat, 'Receita'); assert.strictEqual(r.rend.sub, 'Rendimentos');
      assert.strictEqual(r.reemb.k, 'in'); assert.strictEqual(r.reemb.sub, 'Reembolso');
      assert.strictEqual(r.resgate.k, 'in'); assert.strictEqual(r.resgate.sub, 'Resgate de reserva');
      assert.strictEqual(r.av.cat, 'Alimentação');
      assert.ok(r.reimportAllDup);
      assert.strictEqual(r.applied, 1);
      assert.strictEqual(r.legacyCat, 'Alimentação');
      assert.strictEqual(r.legacySub, 'Mercado');
      assert.strictEqual(r.aluguelDia, 'Moradia');
    }],
    ['limpar lançamentos e zerar finanças exigem confirmação, salvam versão e permitem desfazer', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        localStorage.removeItem(SNK);
        S.events=[{id:'ev_bill',t:'Conta: Aluguel',d:T,h:'09:00',r:'m',c:'p'},{id:'ev_other',t:'Reunião',d:T,h:'10:00',c:'b'}];
        S.fin={
          tx:[{id:'t1',k:'out',t:'Mercado',v:50,cat:'Alimentação',d:T,ac:'main'},{id:'r_rec1_'+T.slice(0,7),k:'out',t:'Academia',v:100,cat:'Saúde',d:T,ac:'main',rc:'rec1'}],
          acc:[{id:'main',n:'Conta principal',ty:'cc',ini:500},{id:'c1',n:'Cartão',ty:'card',ini:0,lim:1000,close:28,due:10}],
          rec:[{id:'rec1',k:'out',t:'Academia',v:100,cat:'Saúde',ac:'main',day:+T.slice(8),ini:T}],
          rules:[{id:'rl1',m:'uber',md:'c',ty:'out',cat:'Transporte',on:true}],
          bud:{Alimentação:600},
          goals:[{id:'g1',n:'Viagem',target:1000,saved:200}],
          prules:[],split:[],
          bills:[{id:'b1',n:'Aluguel',v:1200,day:5,eid:'ev_bill',ac:'main'}]
        };
        S.view='financas';S.fvw='mes';S.ftab='regras';render();
        const cards=document.querySelector('#main .cards'),tools=document.querySelector('[data-fin-tools]');
        const toolsAfter=!!(cards&&tools&&(cards.compareDocumentPosition(tools)&Node.DOCUMENT_POSITION_FOLLOWING));
        document.querySelector('[data-a="fincleartx"]').click();
        const armTxText=document.querySelector('[data-a="fincleartx"]').textContent;
        const stillBeforeConfirm=S.fin.tx.length===2&&S.fin.acc[0].ini===500;
        document.querySelector('[data-a="fincleartx"]').click();
        genRec();
        const afterClearTx={txLen:S.fin.tx.length,ini:S.fin.acc[0].ini,rulesLen:S.fin.rules.length,recLen:S.fin.rec.length,snaps:snaps().length,snapWhy:snaps()[0]?.why};
        document.querySelector('#toast [data-a="undo"]').click();
        const afterUndoTx={txLen:S.fin.tx.length,ini:S.fin.acc[0].ini};
        localStorage.removeItem(SNK);
        document.querySelector('[data-a="finclearall"]').click();
        const armAllText=document.querySelector('[data-a="finclearall"]').textContent;
        document.querySelector('[data-a="finclearall"]').click();
        const afterClearAll={txLen:S.fin.tx.length,accLen:S.fin.acc.length,ini:S.fin.acc[0].ini,rulesLen:S.fin.rules.length,recLen:S.fin.rec.length,billsLen:S.fin.bills.length,goalsLen:S.fin.goals.length,events:S.events.map(e=>e.id),snaps:snaps().length,snapWhy:snaps()[0]?.why,valid:validBackup(pick())};
        document.querySelector('#toast [data-a="undo"]').click();
        const afterUndoAll={txLen:S.fin.tx.length,accLen:S.fin.acc.length,rulesLen:S.fin.rules.length,billsLen:S.fin.bills.length,events:S.events.map(e=>e.id)};
        return {toolsAfter,armTxText,stillBeforeConfirm,afterClearTx,afterUndoTx,armAllText,afterClearAll,afterUndoAll};
      })()`);
      assert.ok(r.toolsAfter);
      assert.match(r.armTxText, /Confirmar/);
      assert.ok(r.stillBeforeConfirm);
      assert.deepStrictEqual(r.afterClearTx, {txLen:0, ini:0, rulesLen:1, recLen:1, snaps:1, snapWhy:'Antes de limpar lançamentos das Finanças'});
      assert.deepStrictEqual(r.afterUndoTx, {txLen:2, ini:500});
      assert.match(r.armAllText, /Confirmar/);
      assert.strictEqual(r.afterClearAll.txLen, 0);
      assert.strictEqual(r.afterClearAll.accLen, 1);
      assert.strictEqual(r.afterClearAll.ini, 0);
      assert.strictEqual(r.afterClearAll.rulesLen, 0);
      assert.strictEqual(r.afterClearAll.recLen, 0);
      assert.strictEqual(r.afterClearAll.billsLen, 0);
      assert.strictEqual(r.afterClearAll.goalsLen, 0);
      assert.deepStrictEqual(r.afterClearAll.events, ['ev_other']);
      assert.strictEqual(r.afterClearAll.snaps, 1);
      assert.strictEqual(r.afterClearAll.snapWhy, 'Antes de zerar Finanças');
      assert.ok(r.afterClearAll.valid);
      assert.strictEqual(r.afterUndoAll.txLen, 2);
      assert.strictEqual(r.afterUndoAll.accLen, 2);
      assert.strictEqual(r.afterUndoAll.rulesLen, 1);
      assert.strictEqual(r.afterUndoAll.billsLen, 1);
      assert.deepStrictEqual(r.afterUndoAll.events, ['ev_bill', 'ev_other']);
    }],
    ['importação avançada: cofrinhos como transferência, abatimento de estornos, OFX e fatura de cartão', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        S.fin={tx:[],acc:[{id:'main',n:'Conta principal',ty:'cc',ini:0},{id:'card1',n:'Cartão',ty:'card',ini:0,lim:2000,close:28,due:10}],rec:[],recDismiss:[],rules:[],bud:{},budHist:{},goals:[],prules:[],split:[],bills:[]};
        S.view='financas';S.fvw='mes';S.ftab='regras';S.fmo=0;S.fac='';render();
        const pm=addM(T,-1).slice(0,7), dmy=(dd)=>dd+'-'+pm.slice(5,7)+'-'+pm.slice(0,4);
        const csv=[
          'INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE',
          '500,00;35,00;-142,00;393,00',
          '',
          'RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE',
          dmy('05')+';Pagamento iFood;r_ifood;-100,00;400,00',
          dmy('06')+';Pagamento Loja X;r_loja;-30,00;370,00',
          dmy('06')+';Reembolso de pagamento ;r_loja;30,00;400,00',
          dmy('07')+';Reserva por gasto Emergências;r_res1;-2,00;398,00',
          dmy('08')+';Reserva programada Emergências;r_res2;-10,00;388,00',
          dmy('09')+';Dinheiro retirado Emergências;r_res3;5,00;393,00'
        ].join('\\n');
        const pf=document.querySelector('#fcsvpaste');
        pf.elements.csv.value=csv;
        pf.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const trChk=document.querySelector('[data-imp="trRes"]');
        trChk.checked=true;trChk.dispatchEvent(new Event('change',{bubbles:true}));
        const trPrev=impRows();
        document.querySelector('[data-a="impgo"]').click();
        const resAcc=S.fin.acc.find(a=>a.ty==='inv');
        const mainBal=r2(bal(S.fin.acc.find(a=>a.id==='main')));
        const resBal=r2(bal(resAcc));
        const pmSummary=finMonth(-1,true);
        const trList=S.fin.tx.filter(t=>t.k==='tr');
        const rbTx=S.fin.tx.find(t=>t.rb);

        const dtOfx=pm.replace('-','')+'12';
        const cardOfx='<OFX><CREDITCARDMSGSRSV1><CCSTMTRNRS><CCSTMTRS><BANKTRANLIST>'
          +'<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>'+dtOfx+'<TRNAMT>150.00<FITID>cc1<NAME>UBER *TRIP</STMTTRN>'
          +'<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>'+dtOfx+'<TRNAMT>49.90<FITID>cc2<MEMO>SPOTIFY</STMTTRN>'
          +'<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>'+dtOfx+'<TRNAMT>-200.00<FITID>cc3<MEMO>Pagamento de fatura</STMTTRN>'
          +'</BANKTRANLIST></CCSTMTRS></CCSTMTRNRS></CREDITCARDMSGSRSV1></OFX>';
        const pf2=document.querySelector('#fcsvpaste');
        pf2.elements.csv.value=cardOfx;
        pf2.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const ofxCardFlags={isCard:IMP.isCard,inv:IMP.inv,skipCardPay:IMP.skipCardPay,ac:IMP.ac};
        const cardPrev=impRows();
        document.querySelector('[data-a="impgo"]').click();

        const bankOfx='<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>'
          +'<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>'+dtOfx+'<TRNAMT>-100.00<FITID>bk1<MEMO>Mercado</STMTTRN>'
          +'<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>'+dtOfx+'<TRNAMT>200.00<FITID>bk2<MEMO>Pix recebido</STMTTRN>'
          +'</BANKTRANLIST><LEDGERBAL><BALAMT>850.00</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>';
        const pf3=document.querySelector('#fcsvpaste');
        pf3.elements.csv.value=bankOfx;
        pf3.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const bankMeta=IMP.meta;
        IMP=null;

        return {
          trResLabels:trPrev.rows.filter(x=>x.resTr).length,
          resAccName:resAcc&&resAcc.n,
          mainBal,resBal,
          trCount:trList.length,
          pmOut:pmSummary.out,pmInc:pmSummary.inc,pmBy:pmSummary.by,
          rb:rbTx&&{rb:rbTx.rb,rcat:rbTx.rcat},
          ofxCardFlags,
          cardPayTotal:cardPrev.cardPayTotal,
          cardRows:cardPrev.rows.length,
          cardBal:r2(bal(S.fin.acc.find(a=>a.id==='card1'))),
          bankMeta,
          valid:validBackup(pick())
        };
      })()`);
      assert.strictEqual(r.trResLabels, 3);
      assert.strictEqual(r.resAccName, 'Reserva');
      assert.strictEqual(r.trCount, 3);
      assert.strictEqual(r.mainBal, 393);
      assert.strictEqual(r.resBal, 7);
      assert.strictEqual(r.pmOut, 100);
      assert.strictEqual(r.pmInc, 0);
      assert.deepStrictEqual(r.pmBy, { Alimentação: 100 });
      assert.deepStrictEqual(r.rb, { rb: 1, rcat: 'Compras' });
      assert.deepStrictEqual(r.ofxCardFlags, { isCard: true, inv: true, skipCardPay: true, ac: 'card1' });
      assert.strictEqual(r.cardPayTotal, 1);
      assert.strictEqual(r.cardRows, 2);
      assert.strictEqual(r.cardBal, -199.9);
      assert.strictEqual(r.bankMeta.fin, 850);
      assert.strictEqual(r.bankMeta.ini, 750);
      assert.ok(r.valid);
    }],
    ['lote em lançamentos, ranking de estabelecimentos, detecção de assinaturas e sugestão de orçamento', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        const m1=addM(T,-1),m2=addM(T,-2);
        S.fin={
          tx:[
            {id:'u1',k:'out',t:'Uber',v:20,cat:'Outros',d:T,ac:'main'},
            {id:'u2',k:'out',t:'Pagamento Uber',v:30,cat:'Outros',d:T,ac:'main'},
            {id:'px1',k:'out',t:'Pagamento com Pix Joao Silva',v:80,cat:'Outros',d:T,ac:'main',sub:'Pix'},
            {id:'sp1',k:'out',t:'Spotify',v:21.9,cat:'Assinaturas',d:T,ac:'main',sub:'Serviços digitais'},
            {id:'in1',k:'out',t:'Internet Fibra',v:100,cat:'Moradia',d:m1,ac:'main',sub:'Internet e telefone'},
            {id:'in2',k:'out',t:'Internet Fibra',v:100,cat:'Moradia',d:m2,ac:'main',sub:'Internet e telefone'},
            {id:'f1',k:'out',t:'Mercado',v:600,cat:'Alimentação',d:m1,ac:'main'},
            {id:'t1',k:'out',t:'Posto',v:200,cat:'Transporte',d:m1,ac:'main'},
            {id:'f2',k:'out',t:'Mercado',v:400,cat:'Alimentação',d:m2,ac:'main'},
            {id:'t2',k:'out',t:'Posto',v:100,cat:'Transporte',d:m2,ac:'main'}
          ],
          acc:[{id:'main',n:'Conta principal',ty:'cc',ini:2000}],
          rec:[],recDismiss:[],rules:[],bud:{},budHist:{},goals:[],prules:[],split:[],bills:[]
        };
        S.view='financas';S.fvw='mes';S.ftab='lanc';S.fmo=0;S.fac='';render();

        document.querySelector('[data-a="edtx"][data-id="u1"]').click();
        const f=document.querySelector('#ffin');
        f.elements.cat.value='Transporte';
        f.elements.sub.value='App';
        f.elements.applySame.checked=true;
        f.requestSubmit();
        const afterApplySame={
          u1Cat:S.fin.tx.find(x=>x.id==='u1').cat,
          u2Cat:S.fin.tx.find(x=>x.id==='u2').cat,
          u2Sub:S.fin.tx.find(x=>x.id==='u2').sub,
          rules:S.fin.rules.length
        };

        const fq=document.querySelector('#fq');
        fq.value='uber';fq.dispatchEvent(new Event('input',{bubbles:true}));
        document.querySelector('[data-tx-bulk]').open=true;
        const bf=document.querySelector('#ftxbulk');
        bf.elements.sub.value='Corrida';
        bf.elements.tg.value='trabalho';
        bf.requestSubmit();
        const afterBulk={
          u1Sub:S.fin.tx.find(x=>x.id==='u1').sub,
          u2Tg:S.fin.tx.find(x=>x.id==='u2').tg,
          pxTg:S.fin.tx.find(x=>x.id==='px1').tg||''
        };

        document.querySelector('[data-a="txbulkdel"]').click();
        document.querySelector('[data-a="txbulkdel"]').click();
        const afterBulkDel=S.fin.tx.filter(x=>x.id==='u1'||x.id==='u2').length;
        document.querySelector('#toast [data-a="undo"]').click();
        const afterBulkUndo=S.fin.tx.filter(x=>x.id==='u1'||x.id==='u2').length;

        document.querySelector('[data-a="fclr"]').click();
        document.querySelector('[data-a="ftab"][data-id="analise"]').click();
        const merchTxt=()=>( [...document.querySelectorAll('#main .panel')].find(p=>(p.querySelector('h2')?.textContent||'').includes('Maiores estabelecimentos'))?.innerText||'' );
        const merchText=merchTxt();
        document.querySelector('[data-a="fmpix"]').click();
        const pixOnlyText=merchTxt();
        document.querySelector('[data-a="fmpix"]').click();
        document.querySelector('[data-a="fmerch"][data-id="Uber"]').click();
        const merchJump={tab:S.ftab,fq:FQ};
        FQ='';S.fkd='';

        document.querySelector('[data-a="ftab"][data-id="contas"]').click();
        const detBefore=detectRecurring().map(x=>x.key);
        const spKey=detBefore.find(k=>k.includes('spotify'));
        const inKey=detBefore.find(k=>k.includes('internet'));
        document.querySelector('[data-a="recadd-det"][data-id="'+spKey+'"]').click();
        document.querySelector('[data-a="recdismiss-det"][data-id="'+inKey+'"]').click();
        const detAfter={
          recCount:S.fin.rec.length,
          spLinked:!!S.fin.tx.find(x=>x.id==='sp1').rc,
          spNotDuplicated:S.fin.tx.filter(x=>norm(x.t).includes('spotify')).length===1,
          dismissedCount:S.fin.recDismiss.length
        };

        document.querySelector('[data-a="ftab"][data-id="orc"]').click();
        document.querySelector('[data-a="budsuggest"]').click();
        const curBud=budgetsAt(T.slice(0,7));

        return {
          afterApplySame,afterBulk,afterBulkDel,afterBulkUndo,
          hasPixMerch:merchText.includes('Joao Silva')&&merchText.includes('Uber'),
          pixFilteredOutUber:!pixOnlyText.includes('Uber')&&pixOnlyText.includes('Joao Silva'),
          merchJump,detBefore,detAfter,curBud,
          valid:validBackup(pick())
        };
      })()`);
      assert.strictEqual(r.afterApplySame.u1Cat, 'Transporte');
      assert.strictEqual(r.afterApplySame.u2Cat, 'Transporte');
      assert.strictEqual(r.afterApplySame.u2Sub, 'App');
      assert.strictEqual(r.afterApplySame.rules, 1);
      assert.strictEqual(r.afterBulk.u1Sub, 'Corrida');
      assert.strictEqual(r.afterBulk.u2Tg, 'trabalho');
      assert.strictEqual(r.afterBulk.pxTg, '');
      assert.strictEqual(r.afterBulkDel, 0);
      assert.strictEqual(r.afterBulkUndo, 2);
      assert.ok(r.hasPixMerch);
      assert.ok(r.pixFilteredOutUber);
      assert.strictEqual(r.merchJump.tab, 'lanc');
      assert.strictEqual(r.merchJump.fq, 'Uber');
      assert.ok(r.detBefore.some(k=>k.includes('spotify'))&&r.detBefore.some(k=>k.includes('internet')));
      assert.strictEqual(r.detAfter.recCount, 1);
      assert.ok(r.detAfter.spLinked);
      assert.ok(r.detAfter.spNotDuplicated);
      assert.strictEqual(r.detAfter.dismissedCount, 1);
      assert.strictEqual(r.curBud.Alimentação, 500);
      assert.strictEqual(r.curBud.Transporte, 150);
      assert.strictEqual(r.curBud.Moradia, 100);
      assert.ok(r.valid);
    }],
    ['finanças avançadas: reconciliação de saldo, parcelas futuras na importação, alerta de preço e fechamento mensal', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        S.fin={
          tx:[{id:'old',k:'out',t:'Compra antiga',v:50,cat:'Outros',d:T,ac:'main'}],
          acc:[{id:'main',n:'Conta principal',ty:'cc',ini:100},{id:'card1',n:'Cartão',ty:'card',ini:0,lim:3000,close:28,due:10}],
          rec:[{id:'r1',k:'out',t:'Spotify',v:21.9,cat:'Assinaturas',ac:'main',day:+T.slice(8),ini:T,skip:['r_r1_'+T.slice(0,7)]}],
          recDismiss:[],rules:[],bud:{Alimentação:1000},budHist:{},
          goals:[{id:'res1',n:'Reserva de emergência',target:6000,saved:1000,res:1,rm:6}],
          prules:[],split:[],bills:[]
        };
        S.view='financas';S.fvw='mes';S.ftab='regras';S.fmo=0;S.fac='';render();

        const dmy=T.slice(8,10)+'-'+T.slice(5,7)+'-'+T.slice(0,4);
        const csvBank=[
          'RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE',
          dmy+';Spotify;sp1;-27,90;700,00',
          dmy+';Salário;sal1;5000,00;727,94'
        ].join('\\n');
        let pf=document.querySelector('#fcsvpaste');
        pf.elements.csv.value=csvBank;
        pf.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const metaBank={...IMP.meta};
        const hasRecOpt=!!document.querySelector('[data-imp="reconcile"]');
        document.querySelector('[data-a="impgo"]').click();

        S.ftab='contas';render();
        const hasAccRecBtn=!!document.querySelector('[data-a="reconcile-acc"][data-id="main"]');
        const balBeforeRec=r2(bal(S.fin.acc[0]));
        document.querySelector('[data-a="reconcile-acc"][data-id="main"]').click();
        const balAfterRec=r2(bal(S.fin.acc[0]));

        const subAtt=attention().find(x=>x.k==='sub'&&x.id==='r1');
        const subTextBefore=document.querySelector('#main').innerText;
        document.querySelector('[data-a="rec-upd-val"][data-id="r1"]').click();
        const updatedRecVal=S.fin.rec[0].v;

        S.ftab='regras';S.fac='card1';render();
        const csvCard=[
          'Data;Descrição;Valor',
          dmy+';Kabum Parcela 02/04;-250,00'
        ].join('\\n');
        pf=document.querySelector('#fcsvpaste');
        pf.elements.csv.value=csvCard;
        pf.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        const instPrev=impRows();
        document.querySelector('[data-a="impgo"]').click();
        const kabumInst=S.fin.tx.filter(t=>t.t.includes('Kabum')).sort((a,b)=>a.d.localeCompare(b.d));

        S.fac='';S.ftab='orc';render();
        const cf=document.querySelector('#fclosemonth');
        const suggestedSurplus=cf&&cf.elements.v.value;
        cf.requestSubmit();
        const resSaved=closingGoalBalance(S.fin.goals[0]);

        return {
          metaBank,hasRecOpt,hasAccRecBtn,balBeforeRec,balAfterRec,
          subAttTitle:subAtt&&subAtt.t,subHadChip:subTextBefore.includes('subiu +'),updatedRecVal,
          instCount:instPrev.instCount,instRem:instPrev.instRem,
          kabumCount:kabumInst.length,
          kabumNums:kabumInst.map(x=>x.pc.i+'/'+x.pc.n),
          kabumSameGroup:new Set(kabumInst.map(x=>x.pc.g)).size===1,
          kabumDatesOk:kabumInst[1]?.d===addM(T,1)&&kabumInst[2]?.d===addM(T,2),
          suggestedSurplus,resSaved,valid:validBackup(pick())
        };
      })()`);
      assert.strictEqual(r.metaBank.fin, 727.94);
      assert.ok(r.hasRecOpt);
      assert.ok(r.hasAccRecBtn);
      assert.notStrictEqual(r.balBeforeRec, 727.94);
      assert.strictEqual(r.balAfterRec, 727.94);
      assert.strictEqual(r.subAttTitle, 'Subiu: Spotify');
      assert.ok(r.subHadChip);
      assert.strictEqual(r.updatedRecVal, 27.9);
      assert.strictEqual(r.instCount, 1);
      assert.strictEqual(r.instRem, 2);
      assert.strictEqual(r.kabumCount, 3);
      assert.deepStrictEqual(r.kabumNums, ['2/4', '3/4', '4/4']);
      assert.ok(r.kabumSameGroup);
      assert.ok(r.kabumDatesOk);
      assert.ok(+String(r.suggestedSurplus).replace(',','.') > 0);
      assert.ok(r.resSaved > 1000);
      assert.ok(r.valid);
    }],
    ['compras com histórico de preços, orçamento em projetos, autocomplete em leituras e pomodoro na agenda', async () => {
      await fresh(); await login('A');
      const r = await ev(`(async ()=>{
        S.notes=[
          {id:'l1',kind:'shopping',t:'Compra passada',b:'',c:'g',updatedAt:100,items:[{id:'i1',t:'Arroz',q:'1 pct',qty:2,unit:'kg',estimatedCents:1700,actualCents:1800,done:true}]},
          {id:'l2',kind:'shopping',t:'Compra nova',b:'',c:'g',updatedAt:200,items:[]}
        ];
        S.view='notas';render();
        const sf=document.querySelector('[data-shopping-edit],[data-lid="nt:l2"] [data-shopping-form]');
        sf.elements.t.value='Arroz';
        sf.elements.t.dispatchEvent(new Event('change',{bubbles:true}));
        const prefillEst=sf.elements.estimated.value;
        sf.elements.actual.value='19,80';
        sf.requestSubmit();
        const newItem=S.notes.find(n=>n.id==='l2').items[0];
        const shopCardText=document.querySelector('[data-lid="nt:l2"]').innerText;

        S.projects=[];S.fin.tx=[
          {id:'txp1',k:'out',t:'Tinta',v:600,cat:'Moradia',d:T,ac:'main'},
          {id:'txp2',k:'out',t:'Pincel',v:300,cat:'Moradia',d:T,ac:'main',pj:'Reforma'}
        ];
        S.tasks=[{id:'tkp1',t:'Pintar sala',done:true,dd:T,p:'m'}];
        S.view='projetos';render();
        const pf=document.querySelector('#project-create');
        pf.elements.t.value='Reforma';
        pf.elements.budget.value='1.500,00';
        pf.requestSubmit();
        const prj=S.projects[0];
        let lf=document.querySelector('[data-project-link="'+prj.id+'"]');
        lf.elements.ref.value='tx:txp1';lf.requestSubmit();
        lf=document.querySelector('[data-project-link="'+prj.id+'"]');
        lf.elements.ref.value='tk:tkp1';lf.requestSubmit();
        const prjText=document.querySelector('[data-project="'+prj.id+'"]').innerText;

        S.tasks.push({id:'tkfoco',t:'Escolher piso',done:false,p:'m'});render();
        const lkf=document.querySelector('[data-project-link="'+prj.id+'"]');
        lkf.elements.ref.value='tk:tkfoco';lkf.requestSubmit();
        S.fk={id:'tkfoco',mode:'foco',run:true,end:Date.now(),left:0};
        pdone();
        const focusedTask=S.tasks.find(x=>x.id==='tkfoco');
        const focoProjectMin=(S.fpj['Reforma']||{})[T]||0;
        const timelineBlocks=blocksOn(T).map(b=>b.t);
        S.cards=[{id:'linha',on:true}];S.view='dash';render();
        const dashDayText=document.querySelector('[data-card="linha"]').innerText;

        const origFetch=window.fetch;
        window.fetch=async (u)=>({ok:true,json:async()=>({docs:[{title:'Dom Casmurro',author_name:['Machado de Assis'],first_publish_year:1899,number_of_pages_median:256,cover_i:98765}]})});
        let bookItem=null,lookupText='';
        try{
          S.reads=[];S.view='leituras';render();
          const rf=document.querySelector('#frd');
          rf.elements.t.value='Dom Casmurro';
          await findNewReadMeta();
          lookupText=document.querySelector('#frd-lookup').innerText;
          document.querySelector('[data-a="rd-autofill-use"]').click();
          rf.requestSubmit();
          bookItem=S.reads[0];
        }finally{window.fetch=origFetch}

        return {
          prefillEst,newItem,
          hasTrend:shopCardText.includes('+10%'),
          prjBudget:prj.budget,
          prjText,
          hasTaskBk:!!(focusedTask.bk&&focusedTask.bk.d===T&&focusedTask.dur===25),
          focoProjectMin,timelineBlocks,dashDayText,
          lookupText,bookItem,
          valid:validBackup(pick())
        };
      })()`);
      assert.strictEqual(r.prefillEst, '18,00');
      assert.strictEqual(r.newItem.estimatedCents, 1800);
      assert.strictEqual(r.newItem.actualCents, 1980);
      assert.strictEqual(r.newItem.qty, 2);
      assert.strictEqual(r.newItem.unit, 'kg');
      assert.ok(r.hasTrend);
      assert.strictEqual(r.prjBudget, 1500);
      assert.match(r.prjText, /900,00 de R\$\s*1\.500,00 \(60%\)/);
      assert.match(r.prjText, /1\/2 concluídas|1\/1 concluídas/);
      assert.ok(r.hasTaskBk);
      assert.strictEqual(r.focoProjectMin, 25);
      assert.ok(r.timelineBlocks.includes('Escolher piso'));
      assert.match(r.dashDayText, /Escolher piso/);
      assert.match(r.lookupText, /Machado de Assis/);
      assert.strictEqual(r.bookItem.t, 'Dom Casmurro');
      assert.strictEqual(r.bookItem.a, 'Machado de Assis');
      assert.strictEqual(r.bookItem.year, 1899);
      assert.strictEqual(r.bookItem.pages, 256);
      assert.strictEqual(r.bookItem.cover, 98765);
      assert.ok(r.valid);
    }],
    ['início interativo: remove foco anterior e integra ações rápidas, cards de leituras/projetos e personalização', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        S.focus = 'Foco antigo';
        S.dia = { [T]: { focus: 'Dia produtivo' } };
        const tmr = ds(add(today, 1));
        S.tasks = [
          { id: 'tk1', t: 'Tarefa topo', done: false, p: 'a', hd: T },
          { id: 'tk2', t: 'Sem horario', done: false, p: 'm', hd: T },
          { id: 'tkp', t: 'Etapa projeto', done: false, p: 'm' }
        ];
        S.events = [];
        S.notes = [
          { id: 'n1', t: 'Nota direta', b: 'Conteúdo', c: 'p', updatedAt: Date.now() },
          { id: 'shop1', kind: 'shopping', t: 'Feira', c: 'g', items: [{ id: 'it1', t: 'Maçã', q: '1 kg', done: false }], updatedAt: Date.now() }
        ];
        S.projects = [
          { id: 'pr1', t: 'App', status: 'active', archived: false, budget: 500, nextTask: 'tkp', refs: [{ id: 'tk:tkp' }] }
        ];
        S.reads = [
          { id: 'sr1', t: 'Série Top', k: 'série', st: 'a', season: 2, episode: 3, p: 40 },
          { id: 'bk1', t: 'Livro Base', k: 'livro', st: 'a', pages: 100, page: 20, p: 20 }
        ];
        S.fin.bills = [{ id: 'b1', n: 'Internet', v: 120, day: +tmr.slice(8), ac: S.fin.acc[0]?.id || 'main' }];
        S.fin.tx = [{ id: 'tx1', k: 'out', t: 'Domínio', v: 100, cat: 'Assinaturas', d: T, ac: S.fin.acc[0]?.id || 'main', pj: 'App' }];
        S.cards = null;
        S.view = 'dash';
        render();

        const dashHasOldFocus = /Foco anterior/i.test(document.querySelector('.hero2 .focus').innerText);
        S.view = 'hoje'; render();
        const hojeHasOldFocus = /Foco anterior/i.test(document.querySelector('.focus').innerText);
        document.querySelector('[data-a="clear-old-focus"]').click();
        const clearedFocus = S.focus;

        S.view = 'dash'; render();
        document.querySelector('[data-a="cust"]').click();
        document.querySelector('[data-a="dash-preset"][data-id="completo"]').click();

        const heroDoneBtn = document.querySelector('.hero2 [data-a="dash-done"][data-id="tk1"]');
        const heroFocusBtn = document.querySelector('.hero2 [data-a="focus"][data-id="tk1"]');
        if (heroFocusBtn) heroFocusBtn.click();
        const pomoStarted = !!(S.fk && S.fk.id === 'tk1');
        S.fk = null;
        if (document.querySelector('.hero2 [data-a="dash-done"][data-id="tk1"]')) {
          document.querySelector('.hero2 [data-a="dash-done"][data-id="tk1"]').click();
        }
        const tk1Done = !!S.tasks.find(x => x.id === 'tk1').done;

        const prevAutoSlot = autoSlot;
        autoSlot = () => '14:00';
        const fitBtn = document.querySelector('[data-card="linha"] .tlf [data-a="fitday"][data-id="tk2"]');
        if (fitBtn) fitBtn.click();
        autoSlot = prevAutoSlot;
        const tk2Bk = S.tasks.find(x => x.id === 'tk2').bk;

        const ft = document.querySelector('#ftodo');
        ft.elements.t.value = 'Comprar filtro amanhã';
        ft.requestSubmit();
        const addedTodo = S.tasks.find(x => x.t === 'Comprar filtro');

        const shopChk = document.querySelector('[data-card="compras"] [data-shopping-check="shop1"]');
        shopChk.checked = true;
        shopChk.dispatchEvent(new Event('change', { bubbles: true }));
        const sf = document.querySelector('[data-card="compras"] [data-shopping-form="shop1"]');
        sf.elements.t.value = 'Banana';
        sf.elements.q.value = '6 un';
        sf.requestSubmit();

        document.querySelector('[data-card="leituras"] [data-a="rd-ep-inc"][data-id="sr1"]').click();
        document.querySelector('[data-card="leituras"] [data-a="rd-prog-inc"][data-id="bk1"]').click();

        const projText = document.querySelector('[data-card="projetos"]').innerText;
        const finText = document.querySelector('[data-card="fin"]').innerText;
        const finHasQuickBtns = !!document.querySelector('[data-card="fin"] [data-a="qat"][data-id="dp"]');

        document.querySelector('[data-card="todo"] [data-card-tools="todo"] [data-a="cwide"]').click();
        const todoWideAfter = document.querySelector('[data-card="todo"]').classList.contains('wide');
        document.querySelector('[data-card="prod"] [data-card-tools="prod"] [data-a="chide"]').click();
        const prodHidden = !document.querySelector('[data-card="prod"]');

        document.querySelector('[data-a="dash-preset"][data-id="foco"]').click();
        const focoPresetCards = [...document.querySelectorAll('#main [data-card]')].map(x => x.dataset.card);

        document.querySelector('[data-a="dash-preset"][data-id="completo"]').click();
        document.querySelector('[data-card="notas"] .ntile[data-id="nt:n1"]').click();
        const openedNoteView = S.view;

        return {
          dashHasOldFocus, hojeHasOldFocus, clearedFocus,
          pomoStarted, tk1Done, tk2Bk, addedTodo, tmr,
          shopItems: S.notes.find(x => x.id === 'shop1').items,
          ep: S.reads.find(x => x.id === 'sr1').episode,
          bk: S.reads.find(x => x.id === 'bk1'),
          projText, finText, finHasQuickBtns,
          todoWideAfter, prodHidden, focoPresetCards, openedNoteView,
          valid: validBackup(pick())
        };
      })()`);
      assert.strictEqual(r.dashHasOldFocus, false, 'Início não deve mostrar Foco anterior');
      assert.strictEqual(r.hojeHasOldFocus, true, 'Hoje continua podendo mostrar Foco anterior');
      assert.strictEqual(r.clearedFocus, '', 'Botão limpa Foco anterior');
      assert.ok(r.pomoStarted && r.tk1Done, 'Ações diretas da próxima tarefa funcionam no topo do Início');
      assert.strictEqual(r.tk2Bk && r.tk2Bk.h, '14:00', 'Chip sem horário em Seu dia permite encaixar na agenda');
      assert.ok(r.addedTodo && r.addedTodo.due === r.tmr, 'Para fazer cria tarefa rápida com data reconhecida');
      assert.strictEqual(r.shopItems.find(x => x.id === 'it1').done, true, 'Lista de compras marca item no Início');
      assert.ok(r.shopItems.some(x => x.t === 'Banana' && x.q === '6 un'), 'Lista de compras adiciona item no Início');
      assert.strictEqual(r.ep, 4, 'Card Leituras incrementa episódio de série');
      assert.strictEqual(r.bk.p, 30);
      assert.strictEqual(r.bk.page, 30);
      assert.match(r.projText, /100,00 \/ R\$\s*500,00 \(20%\)/);
      assert.match(r.finText, /Vencimentos \(7 dias\)/);
      assert.ok(r.finHasQuickBtns);
      assert.ok(r.todoWideAfter && r.prodHidden);
      assert.deepStrictEqual(r.focoPresetCards, ['linha', 'todo', 'projetos', 'metas', 'prod']);
      assert.strictEqual(r.openedNoteView, 'notas');
      assert.ok(r.valid);
    }],
    ['leituras avançadas: capa na coleção, episódios totais, etiquetas, ritmo, citações, pausado, releituras e resumo anual', async () => {
      await fresh(); await login('A');
      const r = await ev(`(()=>{
        RD.tab='collection';RD.q='';RD.sort='recent';RD.fav='';RD.tag='';RD.yr=0;RD.selected='';
        S.rk='';S.rs='';S.notes=[];S.tasks=[];S.lnk=[];
        const tenDaysAgo = ds(add(today, -9));
        const curY = today.getFullYear(), prevY = curY - 1;
        S.reads = [
          { id: 'b1', t: 'Duna', a: 'Frank Herbert', k: 'livro', st: 'a', pages: 400, page: 100, p: 25, da: tenDaysAgo, year: 1965, cover: 12345, tg: 'ficcao, scifi' },
          { id: 's1', t: 'Série Top', a: 'Criador', k: 'série', st: 'a', season: 1, episode: 8, episodes: 10, p: 80, da: T, year: 2022, r: 4 },
          { id: 'p1', t: 'Livro Pausado', a: 'Autor P', k: 'livro', st: 'p', pages: 300, page: 150, p: 50, da: T, year: 2010 },
          { id: 'f1', t: 'Obras-primas', a: 'Frank Herbert', k: 'livro', st: 'f', df: curY + '-02-10', pages: 320, r: 5, tg: 'scifi', year: 1970 },
          { id: 'f2', t: 'Clássico Antigo', a: 'Frank Herbert', k: 'filme', st: 'f', df: prevY + '-06-15', mins: 120, r: 5, year: 1999 }
        ];
        S.view = 'leituras'; render();

        const thumbSrc = document.querySelector('[data-lid="rd:b1"] img')?.getAttribute('src') || '';
        const b1Text = document.querySelector('[data-lid="rd:b1"]').innerText;

        let srt = document.querySelector('#rd-sort');
        srt.value = 'rating'; srt.dispatchEvent(new Event('change', { bubbles: true }));
        const sortedByRating = [...document.querySelectorAll('#main .note')].map(x => x.dataset.lid);

        document.querySelector('[data-a="rd-fav"][data-id="5"]').click();
        const fav5Ids = [...document.querySelectorAll('#main .note')].map(x => x.dataset.lid);
        document.querySelector('[data-a="rd-fav"][data-id="5"]').click();

        document.querySelector('[data-a="rd-tag"][data-id="ficcao"]').click();
        const ficcaoIds = [...document.querySelectorAll('#main .note')].map(x => x.dataset.lid);
        document.querySelector('[data-a="rd-tag"][data-id=""]').click();

        document.querySelector('[data-a="rd-plan-today"][data-id="b1"]').click();
        const plannedTask = S.tasks.find(t => t.t === 'Ler: Duna' && t.hd === T);

        const qf = document.querySelector('[data-rd-quote="b1"]');
        qf.elements.text.value = 'O medo mata a mente.';
        qf.elements.ref.value = 'pág. 12';
        qf.requestSubmit();
        document.querySelector('[data-lid="rd:b1"] [data-a="rd-note-create"]').click();
        const createdNote = S.notes[0];

        document.querySelector('[data-lid="rd:s1"] [data-a="rd-step"][data-d="1"]').click();
        const s1Ep9 = { p: S.reads.find(x => x.id === 's1').p, st: S.reads.find(x => x.id === 's1').st };
        document.querySelector('[data-lid="rd:s1"] [data-a="rd-step"][data-d="1"]').click();
        const s1Ep10 = S.reads.find(x => x.id === 's1');

        document.querySelector('[data-lid="rd:f1"] [data-a="rd-reread"]').click();
        const f1Rereads = S.reads.find(x => x.id === 'f1').rereads;

        const yearChartPresent = !!document.querySelector('[role="img"][aria-label*="Conclusões por mês"]');
        document.querySelector('[data-a="rd-yr"][data-id="-1"]').click();
        const prevYearText = document.querySelector('#main .panel').innerText;
        document.querySelector('[data-a="rd-yr"][data-id="all"]').click();
        const allYearText = document.querySelector('#main .panel').innerText;

        document.querySelector('[data-a="rd-tab"][data-id="shelf"]').click();
        const nowTitles = [...document.querySelectorAll('.now-card')].map(x => x.innerText);

        S.view = 'etiquetas'; S.tgsel = 'scifi'; render();
        const tagsPageText = document.querySelector('#main').innerText;

        return {
          thumbSrc, b1Text, sortedByRating, fav5Ids, ficcaoIds, plannedTask, rdLinks: lkOf('rd:b1'),
          createdNote, s1Ep9, s1Ep10, f1Rereads, yearChartPresent,
          prevYearText, allYearText, nowTitles, tagsPageText,
          prevY, curY, valid: validBackup(pick())
        };
      })()`);
      assert.match(r.thumbSrc, /covers\.openlibrary\.org\/b\/id\/12345-S\.jpg/);
      assert.match(r.b1Text, /Faltam 300 pág\./);
      assert.match(r.b1Text, /~10 pág\.\/dia/);
      assert.strictEqual(r.sortedByRating[0], 'rd:f2');
      assert.deepStrictEqual(r.fav5Ids, ['rd:f2', 'rd:f1']);
      assert.deepStrictEqual(r.ficcaoIds, ['rd:b1']);
      assert.ok(r.plannedTask && r.rdLinks.includes('tk:' + r.plannedTask.id));
      assert.match(r.createdNote.b, /O medo mata a mente\./);
      assert.match(r.createdNote.b, /pág\. 12/);
      assert.strictEqual(r.s1Ep9.p, 90);
      assert.strictEqual(r.s1Ep9.st, 'a');
      assert.strictEqual(r.s1Ep10.p, 100);
      assert.strictEqual(r.s1Ep10.st, 'f');
      assert.strictEqual(r.f1Rereads, 1);
      assert.ok(r.yearChartPresent);
      assert.match(r.prevYearText, /Clássico Antigo/);
      assert.match(r.allYearText, /Frank Herbert \(2\)/);
      assert.ok(r.nowTitles.every(t => !/Livro Pausado/.test(t)), 'Item Pausado não deve ocupar Na cabeceira agora');
      assert.match(r.tagsPageText, /Duna/);
      assert.ok(r.valid);
    }],
    ['finanças: módulo Investimentos (planilha Rumo aos 100k, cotações ao vivo, balanceamento, proventos, valuation e simulador)', async () => {
      await fresh(); await login('A');
      const r = await ev(`(async () => {
        const origFetch = window.fetch;
        const mockCsv = [
          'Ativo,Cotação,Qtd',
          'BBAS3,"15,40",12',
          'MXRF11,"9,10",10',
          'Ativo,Ticket,dólar',
          'Globais,VT,"145,00"',
          'AÇÃO,PREÇO,DIV,LPA,LPA,VPA',
          'VLID3,"15,20","1,85",0,"3,90","22,10"'
        ].join('\\n');
        window.fetch = async (url) => {
          const u = String(url);
          if (u.includes('awesomeapi.com.br')) return new Response(JSON.stringify({ USDBRL: { bid: '6.05' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          if (u.includes('docs.google.com/spreadsheets')) return new Response(mockCsv, { status: 200, headers: { 'Content-Type': 'text/csv' } });
          return origFetch(url);
        };
        try {
          S.view = 'financas'; S.ftab = 'inv'; render();
          const hasPresetBtn = !!document.querySelector('[data-a="inv-preset"]');
          document.querySelector('[data-a="inv-preset"]').click();
          const afterPreset = {
            assets: S.fin.inv.assets.length,
            divs: S.fin.inv.divs.length,
            miles: S.fin.inv.milestones.length,
            computed: invCompute(S.fin.inv)
          };
          const mainText0 = document.querySelector('#main').textContent;
          const main = document.querySelector('#main');
          const settings = main.querySelector('#fin-invest-settings');
          const rebalance = [...main.querySelectorAll('h2')].find(h => h.textContent === 'Rebalanceamento Macro');
          const orderOk = Boolean(settings && rebalance &&
            (rebalance.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING));

          while (INV_BUSY) await new Promise(res => setTimeout(res, 20));
          await invSyncQuotes(true);
          const bbas = S.fin.inv.assets.find(a => a.ticker === 'BBAS3');
          const mxrf = S.fin.inv.assets.find(a => a.ticker === 'MXRF11');
          const vt = S.fin.inv.assets.find(a => a.ticker === 'VT');
          const synced = { usd: S.fin.inv.cfg.usd, bbas: bbas.price, mxrf: mxrf.price, vt: vt.price };

          // + Aportar inline em BBAS3
          document.querySelector('[data-a="inv-buy"][data-id="' + bbas.id + '"]').click();
          const fbuy = document.querySelector('#finvbuy');
          fbuy.elements.qty.value = '3';
          fbuy.elements.price.value = '15,40';
          fbuy.elements.useCash.checked = true;
          fbuy.elements.ac.value = S.fin.acc[0].id;
          fbuy.requestSubmit();
          const bbasQtyAfterBuy = S.fin.inv.assets.find(a => a.id === bbas.id).qty;
          const buyTx = S.fin.tx.find(t => t.t === 'Aporte BBAS3');

          // Provento + filtro anual + Mapa de Proventos
          const fdiv = document.querySelector('#finvdiv');
          fdiv.elements.ym.value = '2025-07';
          fdiv.elements.v.value = '21,50';
          fdiv.elements.addCash.checked = true;
          fdiv.requestSubmit();
          document.querySelector('[data-a="inv-yr"][data-id="2025"]').click();
          const provText2025 = document.querySelector('#main').innerText;
          document.querySelector('[data-a="inv-paymonth"][data-id="' + bbas.id + '"][data-m="4"]').click();
          const bbasPayMonths = S.fin.inv.assets.find(a => a.id === bbas.id).payMonths;

          // Simulador de juros compostos
          const fsim = document.querySelector('#finvsim');
          fsim.elements.initial.value = '2000';
          fsim.elements.monthly.value = '500';
          fsim.elements.rate.value = '12';
          fsim.elements.years.value = '10';
          fsim.elements.goal.value = '2000';
          fsim.requestSubmit();
          const simText = document.querySelector('[data-inv-sim-result]')?.innerText || '';

          // Vínculo com meta
          const F = finInit();
          F.goals.push({ id: 'g_res', n: 'Reserva', target: 5000, saved: 0 });
          render();
          const gSel = document.querySelector('[data-inv-goal="' + mxrf.id + '"]');
          gSel.value = 'g_res';
          gSel.dispatchEvent(new Event('change', { bubbles: true }));
          const goalSaved = F.goals.find(g => g.id === 'g_res').saved;

          // Fechamento do mês -> Caixa de Investimentos (__inv_cash)
          const cashBeforeClose = closingCashBalance(S.fin.inv);
          S.fin.tx.push({ id: 'inc1', k: 'in', t: 'Salário', v: 2000, d: T, cat: 'Receita', ac: F.acc[0].id });
          S.ftab = 'orc'; S.fvw = 'mes'; S.fmo = 0; render();
          const fclose = document.querySelector('#fclosemonth');
          fclose.elements.goal.value = '__inv_cash';
          fclose.elements.v.value = '250,00';
          fclose.requestSubmit();
          const cashAfterClose = closingCashBalance(S.fin.inv);

          return {
            hasPresetBtn, afterPreset, mainText0, orderOk, synced,
            bbasQtyAfterBuy, buyTx, provText2025, bbasPayMonths,
            simText, goalSaved, cashBeforeClose, cashAfterClose,
            valid: validBackup(pick())
          };
        } finally {
          window.fetch = origFetch;
        }
      })()`);
      assert.ok(r.hasPresetBtn);
      assert.strictEqual(r.afterPreset.assets, 47);
      assert.strictEqual(r.afterPreset.divs, 7);
      assert.strictEqual(r.afterPreset.miles, 8);
      assert.strictEqual(r.afterPreset.computed.cost, 2272.14);
      assert.strictEqual(r.afterPreset.computed.divTotal, 92.4);
      assert.strictEqual(r.afterPreset.computed.aporte, 300);
      assert.strictEqual(r.afterPreset.computed.usd, 5.94);
      assert.strictEqual(r.afterPreset.computed.cash, 9.85);
      assert.ok(r.afterPreset.computed.gross > 1900);
      assert.strictEqual(r.afterPreset.computed.clsRows.length, 6);
      assert.ok(r.orderOk, 'Conteúdo principal da carteira deve vir antes das configurações');
      assert.match(r.mainText0, /R\$\s*22,25/);
      assert.match(r.mainText0, /R\$\s*42,43/);
      assert.strictEqual(r.synced.usd, 6.05);
      assert.strictEqual(r.synced.bbas, 15.4);
      assert.strictEqual(r.synced.mxrf, 9.1);
      assert.strictEqual(r.synced.vt, 145);
      assert.strictEqual(r.bbasQtyAfterBuy, 15);
      assert.ok(r.buyTx && Math.abs(r.buyTx.v - 46.2) < 0.01);
      assert.match(r.provText2025, /\+\s*R\$\s*3,93/);
      assert.match(r.provText2025, /\+22,4%/);
      assert.ok(r.bbasPayMonths.includes(4));
      assert.match(r.simText, /Em 10 anos/);
      assert.match(r.simText, /Juros compostos/);
      assert.strictEqual(r.goalSaved, 91);
      assert.strictEqual(Math.round((r.cashAfterClose - r.cashBeforeClose) * 100) / 100, 250);
      assert.ok(r.valid);
    }],
    ['finanças: todas as sub-abas preenchem a grade desktop sem espaços vazios nem transbordamento', async () => {
      await fresh(); await login('A');
      await ev(`(()=>{exLoad();invLoadPreset();S.fin.inv.cfg.sheetId='';S.fin.inv.cfg.brapiToken='';})()`);
      try {
        await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        const gaps = await ev(`(() => {
          const check = (label) => {
            const g = document.querySelector('#main .cards');
            const gr = g.getBoundingClientRect();
            const rows = {};
            [...g.children].forEach(el => {
              const r = el.getBoundingClientRect();
              if (!r.width || !r.height) return;
              const k = Math.round(r.top);
              (rows[k] = rows[k] || []).push(r);
            });
            const bad = [];
            Object.entries(rows).forEach(([top, list]) => {
              const minL = Math.min(...list.map(r => r.left));
              const maxR = Math.max(...list.map(r => r.right));
              if (minL - gr.left > 4 || gr.right - maxR > 4) bad.push({ label, top, gapRight: Math.round(gr.right - maxR), gapLeft: Math.round(minL - gr.left) });
            });
            const ov = document.documentElement.scrollWidth - document.documentElement.clientWidth;
            if (ov > 1) bad.push({ label, overflow1280: ov });
            return bad;
          };
          const out = [];
          S.view = 'financas'; S.fvw = 'mes';
          for (const [t] of FTABS) { S.ftab = t; render({ save: false }); out.push(...check('mes/' + t)); }
          S.fvw = 'ano'; render({ save: false }); out.push(...check('ano'));
          return out;
        })()`);
        assert.deepStrictEqual(gaps, [], 'Nenhuma linha de cards em Finanças deve deixar colunas vazias no desktop');

        await b.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 800, deviceScaleFactor: 1, mobile: true });
        const mobOv = await ev(`(() => {
          const bad = [];
          S.view = 'financas'; S.fvw = 'mes';
          for (const [t] of FTABS) {
            S.ftab = t; render({ save: false });
            const ov = document.documentElement.scrollWidth - document.documentElement.clientWidth;
            if (ov > 1) bad.push({ tab: t, ov });
          }
          S.fvw = 'ano'; render({ save: false });
          const ovA = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          if (ovA > 1) bad.push({ tab: 'ano', ov: ovA });
          return bad;
        })()`);
        assert.deepStrictEqual(mobOv, [], 'Sub-abas de Finanças não devem transbordar em 320px');
      } finally {
        await b.send('Emulation.clearDeviceMetricsOverride');
      }
    }],
  ];

  const filterArg = process.argv.find(a => a.startsWith('--filter='))?.slice(9) || process.env.TEST_FILTER || '';
  const list = filterArg ? scenarios.filter(([name]) => name.toLowerCase().includes(filterArg.toLowerCase())) : scenarios;
  if (filterArg && !list.length) { b.close(); srv.close(); console.error(`Nenhum cenário corresponde ao filtro: ${filterArg}`); process.exit(1); }

  let failed = 0;
  for (const [name, fn] of list) {
    b.errors.length = 0; srv.missing.length = 0;
    try {
      await fn();
      if (b.errors.length) throw new Error('erro de JS na página: ' + b.errors.join(' | '));
      if (srv.missing.length) throw new Error('arquivos não encontrados: ' + [...new Set(srv.missing)].join(', '));
      console.log('✓ ' + name);
    } catch (e) { failed++; console.log('✗ ' + name + '\n    ' + e.message.split('\n').join('\n    ')) }
  }
  b.close(); srv.close();
  console.log(failed ? `\n${failed} de ${list.length} falharam` : `\n${list.length} cenários passaram`);
  process.exit(failed ? 1 : 0);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) });
module.exports = { sitePages, serve, launch };
