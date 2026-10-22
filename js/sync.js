// sincronização entre aparelhos: mescla, envio/recebimento, Firebase, tela de login e troca de conta
const SK=['events','notes','tasks','links','habits','fin','dia','metas','revm','rev','fm','fpj','goal','focus','cards','frase','frasen','menu','pal','acc','nav','dens','trash','rem','rot','cap','lnk','reads','sp','spsel','wx','seeded'];let CH=IN_CLAUDE?50000:300000;
const pick=()=>{const o={};SK.forEach(k=>{o[k]=S[k]});return o},pickJSON=()=>JSON.stringify(pick());
let FRESH=false;try{FRESH=!localStorage.getItem('hub-v1')}catch(e){}
let SY={};try{SY=JSON.parse(localStorage.getItem('hub-sync')||'{}')}catch(e){}
const hadSY=!!SY.dev;SY.dev=SY.dev||'d'+uid()+uid();if(!hadSY)SY.p=FRESH?pickJSON():'';SY.rev=SY.rev||0;
const saveSY=()=>{try{localStorage.setItem('hub-sync',JSON.stringify(SY))}catch(e){}};saveSY();
let DBr=null,metaRef=null,P='',DEAD=false,pushing=false,again=false,ST=0,ARM=null,chain=Promise.resolve();
let SYS={s:'local',d:'',at:''};
function synText(){return {local:'Somente neste aparelho'+(SYS.d?' ('+SYS.d+')':''),sync:'Sincronizando…',ok:'Sincronizado'+(SYS.at?' às '+SYS.at:''),err:'Falha ao sincronizar'+(SYS.d?' ('+SYS.d+')':'')+'. Tentando de novo.'}[SYS.s]}
function setSt(s,d){SYS.s=s;SYS.d=d||'';if(s==='ok')SYS.at=nowH();const a=$('#syn'),p=$('#synp');if(a)a.innerHTML='<b>'+({local:'☁',sync:'↻',ok:'☁',err:'⚠'}[s])+'</b>'+esc(synText().split('.')[0]);if(p)p.textContent=synText()}
const syncPanel=()=>{
 const head=`<div class="panel" style="margin-top:14px"><h2>Sincronização entre aparelhos</h2><p id="synp" class="empty" role="status" style="padding:0 0 8px">${synText()}</p>`;
 const btns=`<div class="bar"><button class="pill dark" data-a="syncnow">Sincronizar agora</button><button class="pill" data-a="syncup">Enviar este aparelho para a nuvem</button><button class="pill" data-a="syncdown">Trazer os dados da nuvem</button>${IN_CLAUDE?'':'<button class="pill" data-a="fbout">Sair da conta</button>'}</div>`;
 if(IN_CLAUDE)return head+(DBr?btns+`<p class="empty" style="padding:0">Os dados ficam numa área privada da sua conta, que só você lê. Alterações feitas em aparelhos diferentes são mescladas item a item. "Enviar" e "Trazer" substituem o outro lado e pedem um segundo clique para confirmar.</p>`:'<p class="empty" style="padding:0">Para sincronizar, abra o painel pelo link da sua conta Claude em cada aparelho, com a mesma conta. Sem isso, os dados ficam só neste navegador.</p>')+'</div>';
 if(!FB_CONFIG)return head+'<p class="empty" style="padding:0">A sincronização ainda não foi configurada (veja o README do projeto). Os dados ficam só neste navegador.</p></div>';
 if(FB.err)return head+'<p class="empty" style="padding:0">Sem conexão com o servidor. Suas mudanças ficam neste aparelho e são sincronizadas quando você abrir o site de novo com internet.</p></div>';
 if(DBr)return head+btns+`<p class="empty" style="padding:0">Conectado${FB.email?' como <strong>'+esc(FB.email)+'</strong>':''}. Seus dados ficam guardados na sua conta e só você tem acesso. Alterações feitas em aparelhos diferentes são mescladas item a item. "Enviar" e "Trazer" substituem o outro lado e pedem um segundo clique para confirmar.</p></div>`;
 return head+'<div class="bar"><button class="pill dark" data-a="fblogin">Entrar com o Google</button></div><p class="empty" style="padding:0">Sem entrar, os dados ficam só neste navegador. O Backup acima continua funcionando.</p></div>'};
const jeq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function merge3(b,l,r){
 if(jeq(l,r))return l;if(jeq(b,l))return r;if(jeq(b,r))return l;
 if(Array.isArray(l)&&Array.isArray(r)){
  const ided=a=>Array.isArray(a)&&a.every(x=>x&&typeof x==='object'&&x.id!==undefined);
  if(ided(l)&&ided(r)&&(b===undefined||ided(b))){
   const B=new Map((b||[]).map(x=>[x.id,x])),L=new Map(l.map(x=>[x.id,x])),R=new Map(r.map(x=>[x.id,x])),out=[],seen=new Set();
   [...l,...r.filter(x=>!L.has(x.id))].forEach(x=>{const id=x.id;if(seen.has(id))return;seen.add(id);const bi=B.get(id),li=L.get(id),ri=R.get(id);
    if(li&&ri)out.push(merge3(bi,li,ri));else if(li){if(!bi||!jeq(bi,li))out.push(li)}else if(ri){if(!bi||!jeq(bi,ri))out.push(ri)}});
   return out}
  return l}
 if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)){
  const o={};new Set([...Object.keys(l),...Object.keys(r)]).forEach(k=>{const bi=b&&typeof b==='object'?b[k]:undefined,li=l[k],ri=r[k];
   if(!(k in r)){if(!(bi!==undefined&&jeq(bi,li)))o[k]=li}else if(!(k in l)){if(!(bi!==undefined&&jeq(bi,ri)))o[k]=ri}else o[k]=merge3(bi,li,ri)});
  return o}
 return l}
const applyState=o=>{SK.forEach(k=>{if(k in o)S[k]=o[k]});applyTheme()};
function after(){save();if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||document.activeElement.isContentEditable)setTimeout(()=>render(),2500);else render()}
async function readRemote(m){const cs=await Promise.all([...Array(m.n)].map((_,i)=>DBr.doc(P+'hub-'+i).get()));if(cs.some(c=>!c.exists||c.data().rev!==m.rev))return null;const rj=cs.map(c=>c.data().s).join('');return{rj,remote:JSON.parse(rj)}}
async function pullRemote(m,replace){
 const r=await readRemote(m);if(!r)return false;
 const cur=pickJSON(),dirty=cur!==SY.last,fresh=!SY.last&&SY.p&&cur===SY.p;
 if(replace||(dirty&&!fresh))snapPut('Antes de receber dados de outro aparelho',6e4);
 if(replace||fresh||!dirty)applyState(r.remote);
 else{applyState(merge3(SY.last?JSON.parse(SY.last):{},pick(),r.remote));toast('Alterações de outro aparelho foram mescladas. A versão anterior está em Backup.')}
 SY.rev=m.rev;SY.last=r.rj;SY.n=m.n;SY.p='';saveSY();undoReset();after();return true}
// pedaços de até n caracteres sem separar um emoji (par surrogate): metade solta vira "�" no Firestore
const chunks=(s,n)=>{const p=[];for(let i=0;i<s.length;){let e=Math.min(i+n,s.length);if(e<s.length&&e-1>i&&/[\uD800-\uDBFF]/.test(s[e-1]))e--;p.push(s.slice(i,e));i=e}return p.length?p:['']};
async function push(force,skipRec){
 if(!DBr||DEAD)return;
 if(pushing){again=true;return}
 pushing=true;setSt('sync');
 try{
  if(!skipRec){const s=await metaRef.get();if(s.exists&&s.data().rev>SY.rev){const ok=await pullRemote(s.data());if(!ok){setTimeout(syncSoon,3000);return}}}
  const j=pickJSON();if(j===SY.last&&!force){setSt('ok');return}
  const rev=Math.max(Date.now(),SY.rev+1),parts=chunks(j,CH),n=parts.length;
  for(let i=0;i<n;i++)await DBr.doc(P+'hub-'+i).set({rev,i,s:parts[i]});
  await metaRef.set({rev,n,dev:SY.dev,at:new Date().toISOString(),len:j.length,v:1});
  const old=SY.n||0;SY.rev=rev;SY.last=j;SY.n=n;SY.p='';saveSY();setSt('ok');
  for(let i=n;i<old;i++)DBr.doc(P+'hub-'+i).delete().catch(()=>{});
 }catch(e){const c=e&&e.code;if(c==='invalid_argument'&&!SY.last){DEAD=true;setSt('local','sem permissão de gravação')}else{setSt('err',c);setTimeout(syncSoon,c==='quota_exceeded'?3e5:3e4)}}
 finally{pushing=false;if(again){again=false;syncSoon()}}
}
function syncSoon(){if(!DBr||DEAD)return;clearTimeout(ST);ST=setTimeout(()=>push(),2000)}
async function handleMeta(snap){
 if(!snap.exists){if(snap.metadata&&snap.metadata.fromCache)return;const g=await metaRef.get();if(!g.exists)await push(true,true);return}
 const m=snap.data();if(m.rev<=SY.rev)return;
 if(!(await pullRemote(m)))setTimeout(()=>metaRef.get().then(handleMeta).catch(()=>{}),2000);else setSt('ok')}
async function syncAct(a){
 if(!DBr){toast('Sincronização indisponível neste aparelho');return}
 if(a==='syncnow'){await push();toast('Sincronizado');return}
 if(ARM!==a){ARM=a;toast(a==='syncup'?'Clique de novo para substituir a nuvem por este aparelho':'Clique de novo para substituir este aparelho pela nuvem');setTimeout(()=>{if(ARM===a)ARM=null},6000);return}
 ARM=null;
 if(a==='syncup'){await push(true,true);toast('Nuvem atualizada com os dados deste aparelho')}
 else{const s=await metaRef.get();if(!s.exists){toast('Não há dados na nuvem ainda');return}const ok=await pullRemote(s.data(),true);toast(ok?'Dados da nuvem carregados':'Tente de novo em instantes')}}
async function syncInit(){
 try{
  if(typeof claude==='undefined'||!claude.use)return;
  const [d,u]=await Promise.all([claude.use('db'),claude.use('user')]);if(!d||!u)return;
  const id=await u.id();if(!id)return;
  DBr=d;P='data/users/'+id+'/';metaRef=d.doc(P+'hub-meta');setSt('sync');
  metaRef.onSnapshot(s=>{chain=chain.then(()=>handleMeta(s)).catch(e=>setSt('err',e&&e.code))},e=>{if(e&&e.code==='revoked')DEAD=true;setSt('err',e&&e.code)});
 }catch(e){setSt('local')}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)push()});
syncInit();
/* login + sincronização via Firebase (só no site): cada pessoa lê e grava só data/users/<uid>/ */
const FB_CONFIG={apiKey:'AIzaSyDouA0p2KjgWXvS8vnQ5vjn-aZHkRpOIwU',authDomain:'meuhub-48efb.firebaseapp.com',projectId:'meuhub-48efb',storageBucket:'meuhub-48efb.firebasestorage.app',messagingSenderId:'814751686360',appId:'1:814751686360:web:9b630a29ff6ea0807981ad'};// valores públicos; a proteção está nas regras do Firestore
const FBV='10.12.2';
let FB={ready:false,err:false,on:false,email:'',auth:null},fbUnsub=null;
const fbScript=n=>new Promise((res,rej)=>{const t=document.createElement('script');t.src='https://www.gstatic.com/firebasejs/'+FBV+'/firebase-'+n+'-compat.js';t.onload=res;t.onerror=rej;document.head.append(t)});
try{localStorage.removeItem('hub-gd')}catch(e){}// token do antigo login pelo Google Drive
function fbInit(){
 if(IN_CLAUDE||!FB_CONFIG)return;
 fbScript('app').then(()=>Promise.all([fbScript('auth'),fbScript('firestore')])).then(()=>{
  firebase.initializeApp(FB_CONFIG);FB.auth=firebase.auth();
  FB.auth.onAuthStateChanged(u=>{
   if(fbUnsub){fbUnsub();fbUnsub=null}
   if(u&&SY.uid&&SY.uid!==u.uid){acctSwap(SY.uid,u.uid);return}
   if(u&&!SY.uid){SY.uid=u.uid;saveSY()}
   FB.ready=true;FB.on=!!u;FB.email=u&&u.email||'';
   if(u){DBr=firebase.firestore();P='data/users/'+u.uid+'/';metaRef=DBr.doc(P+'hub-meta');DEAD=false;setSt('sync');
    fbUnsub=metaRef.onSnapshot(sn=>{chain=chain.then(()=>handleMeta(sn)).catch(e=>setSt('err',e&&e.code))},e=>setSt('err',e&&e.code))}
   else{DBr=null;setSt('local')}
   render()})
 }).catch(()=>{FB.ready=true;FB.err=true;if(SY.uid)setSt('local','sem conexão');render()})}
function fbLogin(){if(!FB.auth)return;FB.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e=>{if(e&&e.code!=='auth/popup-closed-by-user'&&e.code!=='auth/cancelled-popup-request')toast('Não foi possível entrar. Se a janela de login não abriu, permita pop-ups para este site e tente de novo.')})}
/* outra conta no mesmo aparelho: guarda à parte os dados locais da anterior e traz os da nova, para nenhuma ver nem sobrescrever os da outra */
function acctSwap(from,to){const ls=localStorage,ks=['hub-v1','hub-sync',SNK];
 try{ls.setItem('hub-acct-'+from,JSON.stringify(ks.map(k=>ls.getItem(k))))}catch(e){FB.auth.signOut();toast('Não há espaço neste navegador para trocar de conta. Faça um Backup e tente de novo.');return}
 const b=JSON.parse(ls.getItem('hub-acct-'+to)||'null');ks.forEach((k,i)=>b&&b[i]!=null?ls.setItem(k,b[i]):ls.removeItem(k));ls.removeItem('hub-acct-'+to);location.reload()}
async function fbLogout(){if(!FB.auth)return;try{await push()}catch(e){}FB.auth.signOut().then(()=>toast('Você saiu da conta. Os dados continuam salvos na nuvem.'))}
/* tela de login: o site só abre depois de entrar (sem FB_CONFIG não há login possível, então abre direto) */
// sem internet, quem já entrou neste aparelho usa os dados locais; a sincronização volta no próximo carregamento com conexão
function gateR(){const g=$('#gate'),on=!IN_CLAUDE&&!!FB_CONFIG&&!FB.on&&!(FB.err&&SY.uid);g.hidden=!on;$('.app').inert=on;if(!on){g.innerHTML='';return}
 const body=FB.err?'<p class="empty" style="padding:0 0 16px">Não foi possível conectar. Verifique sua internet.</p><div class="bar"><button class="pill dark" data-a="reload">Tentar de novo</button></div>'
  :!FB.ready?'<p class="empty" style="padding:0">Carregando…</p>'
  :'<p style="margin:0 0 4px;font-size:18px">Bem-vindo!</p><p class="empty" style="padding:0 0 16px">Entre com sua conta Google para começar. Seus dados ficam salvos e aparecem em todos os seus aparelhos.</p><div class="bar"><button class="pill dark" data-a="fblogin">Entrar com o Google</button></div>';
 g.innerHTML=`<div class="gbox" role="dialog" aria-modal="true" aria-label="Entrar"><div class="logo">meu hub<i></i></div>${body}</div>`}
