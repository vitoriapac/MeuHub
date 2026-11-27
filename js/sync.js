// sincronização entre aparelhos: mescla, envio/recebimento, Firebase, tela de login e troca de conta
const SK=['events','notes','tasks','links','inbox','habits','fin','dia','diaArchives','metas','projects','history','revm','rev','revprefs','fm','fpj','goal','focus','cards','frase','frasen','menu','pal','acc','themeMode','profileName','nav','dens','trash','rem','rot','rotPrefs','cap','availability','lnk','reads','sp','spsel','wx','keys','hc','rmo','seeded'];let CH=300000;
const DOMS={
 core:['events','tasks','inbox','habits','metas','projects','history','rot','rotPrefs','cap','availability','lnk','fm','goal','focus','rem','rev','revm','revprefs'],
 notes:['notes','links','dia','diaArchives','reads'],
 fin:['fin','fpj'],
 prefs:['cards','frase','frasen','menu','pal','acc','themeMode','profileName','nav','dens','trash','sp','spsel','wx','keys','hc','rmo','seeded']
};
const pick=()=>{const o={};SK.forEach(k=>{o[k]=S[k]});return o},pickJSON=()=>JSON.stringify(pick());
const pickDom=d=>{const o={};DOMS[d].forEach(k=>{o[k]=S[k]});return o},pickDomJSON=d=>JSON.stringify(pickDom(d));
let FRESH=false;try{FRESH=!localStorage.getItem('hub-v1')}catch(e){}
let SY={};try{SY=JSON.parse(localStorage.getItem('hub-sync')||'{}')}catch(e){}
const hadSY=!!SY.dev,hadLegacyBase=!!(SY.last||SY.domLast);SY.dev=SY.dev||'d'+uid()+uid();if(!hadSY)SY.p=FRESH?pickJSON():'';SY.rev=SY.rev||0;
let SY_BASE_LOADING=null;
const syncBaseSave=()=>{if(typeof idbPut!=='function')return Promise.resolve(false);return idbPut('hub-sync-base',JSON.stringify({last:SY.last||'',domLast:SY.domLast||null}))};
const syncBaseLoad=()=>{
 if(SY.last||!SY.hasBase||typeof idbGet!=='function')return Promise.resolve();
 if(!SY_BASE_LOADING)SY_BASE_LOADING=idbGet('hub-sync-base').then(raw=>{
  if(raw&&typeof raw==='string'){try{const b=JSON.parse(raw);if(b&&typeof b==='object'){if(typeof b.last==='string'&&!SY.last)SY.last=b.last;if(b.domLast&&!SY.domLast)SY.domLast=b.domLast}}catch(e){}}
 }).finally(()=>{SY_BASE_LOADING=null});
 return SY_BASE_LOADING;
};
const saveSY=(withBase)=>{try{const {last,domLast,...meta}=SY;meta.hasBase=!!(last||domLast||SY.hasBase);SY.hasBase=meta.hasBase;localStorage.setItem('hub-sync',JSON.stringify(meta));if(withBase)syncBaseSave()}catch(e){}};
saveSY(hadLegacyBase);
if(SY.hasBase&&!SY.last)setTimeout(()=>{syncBaseLoad()},0);
let DBr=null,metaRef=null,P='',DEAD=false,pushing=false,again=false,ST=0,ARM=null,chain=Promise.resolve();
let SYS={s:'local',d:'',at:''};
function synText(){return {local:'Somente neste aparelho'+(SYS.d?' ('+SYS.d+')':''),sync:'Sincronizando…',ok:'Sincronizado'+(SYS.at?' às '+SYS.at:''),err:'Falha ao sincronizar'+(SYS.d?' ('+SYS.d+')':'')+'. Tentando de novo.'}[SYS.s]}
function setSt(s,d){
 SYS.s=s;SYS.d=d||'';
 if(s==='ok'){SYS.at=nowH();SY.lastAt=new Date().toISOString();saveSY()}
 const a=$('#syn'),p=$('#synp'),ma=$('#mobile-sync-alert');
 if(a){a.dataset.st=s;a.innerHTML='<b>'+({local:'☁',sync:'↻',ok:'☁',err:'⚠'}[s])+'</b>'+esc(synText().split('.')[0])}
 if(p)p.textContent=synText();
 if(ma){
  const show=s==='err'||(s==='local'&&FB.err&&!!SY.uid);
  ma.hidden=!show;
  ma.innerHTML=show?`<span>${esc(synText())}</span><button class="pill" data-v="backup">Abrir Backup</button>`:'';
 }
 const summary=document.querySelector('[data-safety-summary]');if(summary)summary.querySelector('p').innerHTML=safetyText();
}
const syncPanel=()=>{
 const last=SY.lastAt?new Date(SY.lastAt).toLocaleString('pt-BR'):'ainda não confirmada',pending=LOCAL_CORRUPT?'indisponíveis até recuperar os dados':!SY.last||pickJSON()!==SY.last?'há alterações locais pendentes':'nenhuma alteração pendente';
 const head=`<div class="panel" style="margin-top:var(--space-4)"><h2>Sincronização entre aparelhos</h2><p id="synp" class="empty" role="status" style="padding:0 0 var(--space-2)">${esc(synText())}</p><p class="empty">Última sincronização: ${esc(last)}. Estado das alterações: ${pending}.</p>`+conflictPanel();
 const btns=`<div class="bar"><button class="pill dark" data-a="syncnow">Sincronizar agora</button><button class="pill${ARM==='syncup'?' dark':''}" data-a="syncup">${ARM==='syncup'?'Confirmar: enviar para a nuvem':'Enviar este aparelho para a nuvem'}</button><button class="pill${ARM==='syncdown'?' dark':''}" data-a="syncdown">${ARM==='syncdown'?'Confirmar: trazer da nuvem':'Trazer os dados da nuvem'}</button>${ARM?'<button class="pill" data-a="synccancel">Cancelar</button>':''}<button class="pill" data-a="fbout">Sair da conta</button></div>`;
 if(!FB_CONFIG)return head+'<p class="empty" style="padding:0">A sincronização ainda não foi configurada (veja o README do projeto). Os dados ficam só neste navegador.</p></div>';
 if(FB.err)return head+'<p class="empty" style="padding:0">Sem conexão com o servidor. Suas mudanças ficam neste aparelho e são sincronizadas quando você abrir o site de novo com internet.</p></div>';
 if(DBr)return head+btns+`<p class="empty" style="padding:0">Conectado${FB.email?' como <strong>'+esc(FB.email)+'</strong>':''}. Seus dados ficam guardados na sua conta e só você tem acesso. Alterações feitas em aparelhos diferentes são mescladas item a item. "Enviar" e "Trazer" substituem o outro lado e pedem um segundo clique para confirmar.</p></div>`;
 return head+'<div class="bar"><button class="pill dark" data-a="fblogin">Entrar com o Google</button></div><p class="empty" style="padding:0">Sem entrar, os dados ficam só neste navegador. O Backup acima continua funcionando.</p></div>'};
const jeq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function merge3(b,l,r,conflicts,path=[]){
 if(jeq(l,r))return l;if(jeq(b,l))return r;if(jeq(b,r))return l;
 if(Array.isArray(l)&&Array.isArray(r)){
  const ided=a=>Array.isArray(a)&&a.every(x=>x&&typeof x==='object'&&x.id!==undefined);
  if(ided(l)&&ided(r)&&(b===undefined||ided(b))){
   const B=new Map((b||[]).map(x=>[x.id,x])),L=new Map(l.map(x=>[x.id,x])),R=new Map(r.map(x=>[x.id,x])),out=[],seen=new Set();
   [...l,...r.filter(x=>!L.has(x.id))].forEach(x=>{const id=x.id;if(seen.has(id))return;seen.add(id);const bi=B.get(id),li=L.get(id),ri=R.get(id);
    if(li&&ri)out.push(merge3(bi,li,ri,conflicts,[...path,{id}]));else if(li){if(!bi||!jeq(bi,li))out.push(li)}else if(ri){if(!bi||!jeq(bi,ri))out.push(ri)}});
   return out}
  if(conflicts)conflicts.push({path,local:l,remote:r});return l}
 if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)){
  const o={};new Set([...Object.keys(l),...Object.keys(r)]).forEach(k=>{const bi=b&&typeof b==='object'?b[k]:undefined,li=l[k],ri=r[k];
   if(!(k in r)){if(!(bi!==undefined&&jeq(bi,li)))o[k]=li}else if(!(k in l)){if(!(bi!==undefined&&jeq(bi,ri)))o[k]=ri}else if(k==='updatedAt'&&l.id===r.id&&typeof l.b==='string'&&typeof r.b==='string'&&Number.isFinite(li)&&Number.isFinite(ri))o[k]=Math.max(li,ri);else o[k]=merge3(bi,li,ri,conflicts,[...path,k])});
  return o}
 if(conflicts)conflicts.push({path,local:l,remote:r});return l}
function conflictTarget(path){
 let parent=S;
 for(const part of path.slice(0,-1)){
  parent=part&&typeof part==='object'?(Array.isArray(parent)?parent.find(x=>x.id===part.id):undefined):(parent&&Object.hasOwn(parent,part)?parent[part]:undefined);
  if(!parent||typeof parent!=='object')return null;
 }
 const key=path.at(-1);return parent&&typeof key==='string'&&Object.hasOwn(parent,key)?{parent,key}:null;
}
function conflictStore(items){
 const before=SY.conflicts;SY.conflicts=JSON.parse(JSON.stringify(items));
 try{const {last,domLast,...meta}=SY;localStorage.setItem('hub-sync',JSON.stringify(meta));return true}catch(e){SY.conflicts=before;return false}
}
function conflictResolve(id,remote){
 const items=SY.conflicts||[],c=items.find(x=>x.id===id);if(!c)return;
 const target=conflictTarget(c.path);
 if(remote&&(!target||!jeq(target.parent[target.key],c.local))){toast('O campo mudou desde o conflito. Confira o item atual antes de escolher.');return}
 if(!snapPut('Antes de resolver conflito')){toast('Não foi possível guardar uma versão. Exporte um backup e libere espaço.');return}
 const previous=target&&target.parent[target.key];
 if(remote){target.parent[target.key]=JSON.parse(JSON.stringify(c.remote));if(!save()){target.parent[target.key]=previous;toast('Não foi possível salvar a escolha. O conflito foi mantido.');return}}
 if(!conflictStore(items.filter(x=>x.id!==id))){toast('Não foi possível encerrar a conferência. O registro foi mantido.');return}
 render();toast(remote?'Versão recebida aplicada.':'Valor atual mantido.');
}
function conflictPanel(){
 const items=SY.conflicts||[];if(!items.length)return '';
 return '<section><h3>Alterações para conferir ('+items.length+')</h3><p>O mesmo campo mudou em dois aparelhos. O valor local foi mantido na mesclagem. As versões completas estão em Backup; esta conferência fica neste aparelho.</p>'+items.map(c=>{
  const target=conflictTarget(c.path),changed=!target||!jeq(target.parent[target.key],c.local),labels={tasks:'Tarefas',notes:'Notas',fin:'Finanças',tx:'Lançamentos',t:'Título',b:'Texto',v:'Valor',focus:'Foco do dia',events:'Agenda',due:'Prazo',hd:'Data planejada',done:'Concluído'},label=c.path.map(p=>typeof p==='object'?'Item '+p.id:(labels[p]||p)).join(' → '),show=v=>PRIV?'Conteúdo oculto':esc(typeof v==='string'?v:JSON.stringify(v));
  return '<details><summary>'+esc(label)+'</summary><p data-priv-text><strong>Local no conflito:</strong> '+show(c.local)+'</p><p data-priv-text><strong>Recebido:</strong> '+show(c.remote)+'</p>'+(changed?'<p>O campo mudou ou o item foi removido. Abra a área de origem para conferir o valor atual.</p>':'')+'<div class="bar"><button class="pill" data-a="conflict-local" data-id="'+esc(c.id)+'">Manter valor atual</button><button class="pill" data-a="conflict-remote" data-id="'+esc(c.id)+'" '+(changed?'disabled':'')+'>Usar valor recebido</button></div></details>';
 }).join('')+'</section>';
}
const applyState=o=>{SK.forEach(k=>{if(k in o)S[k]=o[k]});S.history=auditClean(S.history);applyTheme();if(typeof applyA11y==='function')applyA11y()};
let remoteRenderPending=false;
function remoteFormDirty(){return [...document.querySelectorAll('#main form:not(#ftk)')].some(f=>[...f.elements].some(x=>{if(x.tagName==='SELECT'){const d=[...x.options].find(o=>o.defaultSelected)||x.options[0];return !!d&&x.value!==d.value}if(/^(checkbox|radio)$/.test(x.type))return x.checked!==x.defaultChecked;return /^(text|search|number|date|time|url|textarea)$/i.test(x.type||'')&&x.value!==x.defaultValue}))}
function remoteEditing(){const a=document.activeElement;return !!(a.closest&&a.closest('#main')&&(/INPUT|TEXTAREA|SELECT/.test(a.tagName)||a.isContentEditable))}
function after(){save();if(remoteEditing()||remoteFormDirty())remoteRenderPending=true;else render()}
document.addEventListener('focusout',()=>{if(remoteRenderPending)setTimeout(()=>{if(remoteRenderPending&&!remoteEditing()&&!remoteFormDirty())render()},0)});
async function readRemote(m){
 if(m&&m.v===2&&m.doms){
  const remote={},domRevs={},domLast={},domN={};
  for(const d of Object.keys(DOMS)){
   const dm=m.doms[d];if(!dm)continue;
   if(SY.domRevs&&SY.domRevs[d]===dm.rev&&SY.domLast&&SY.domLast[d]){
    Object.assign(remote,JSON.parse(SY.domLast[d]));
    domRevs[d]=dm.rev;domLast[d]=SY.domLast[d];domN[d]=dm.n;
   }else{
    const cs=await Promise.all([...Array(dm.n)].map((_,i)=>DBr.doc(P+'hub-d-'+d+'-'+i).get()));
    if(cs.some(c=>!c.exists||c.data().rev!==dm.rev))return null;
    const dj=cs.map(c=>c.data().s).join('');
    Object.assign(remote,JSON.parse(dj));
    domRevs[d]=dm.rev;domLast[d]=dj;domN[d]=dm.n;
   }
  }
  const ordered={};SK.forEach(k=>{if(k in remote)ordered[k]=remote[k]});
  return{rj:JSON.stringify(ordered),remote:ordered,domRevs,domLast,domN};
 }
 const cs=await Promise.all([...Array(m.n)].map((_,i)=>DBr.doc(P+'hub-'+i).get()));if(cs.some(c=>!c.exists||c.data().rev!==m.rev))return null;const rj=cs.map(c=>c.data().s).join('');return{rj,remote:JSON.parse(rj)}}
async function pullRemote(m,replace){
 await syncBaseLoad();
 const r=await readRemote(m);if(!r)return false;
 const cur=pickJSON(),dirty=cur!==SY.last,fresh=!SY.last&&SY.p&&cur===SY.p;
 if(!LOCAL_CORRUPT&&(replace||(dirty&&!fresh))&&!snapPut('Antes de receber dados de outro aparelho')){setSt('err','não foi possível criar uma versão local');toast('Não foi possível guardar a versão atual. Exporte um backup e libere espaço.');return false}
 if(replace||fresh||!dirty){applyState(r.remote);if(replace)LOCAL_CORRUPT=false;}
 else{const conflicts=[],merged=merge3(SY.last?JSON.parse(SY.last):{},pick(),r.remote,conflicts);if(conflicts.length&&!snapPut('Versão recebida com conflito',0,r.remote)){setSt('err','não foi possível guardar a versão recebida');toast('Não foi possível guardar a versão recebida. Exporte um backup e libere espaço.');return false}if(conflicts.length&&!conflictStore([...(SY.conflicts||[]),...conflicts.map(c=>({...c,id:uid(),at:Date.now()}))])){setSt('err','não foi possível guardar a conferência');return false}applyState(merged);toast(conflicts.length?'O mesmo campo mudou em dois aparelhos. Mantivemos o valor local; confira as versões em Backup → Sincronização.':'Alterações de outro aparelho foram mescladas. A versão anterior está em Backup.')}
 SY.rev=m.rev;SY.last=r.rj;SY.n=m.n||0;SY.domRevs=r.domRevs||null;SY.domLast=r.domLast||null;SY.domN=r.domN||null;SY.p='';saveSY(true);undoReset();after();return true}
// pedaços de até n caracteres sem separar um emoji (par surrogate): metade solta vira "�" no Firestore
const chunks=(s,n)=>{const p=[];for(let i=0;i<s.length;){let e=Math.min(i+n,s.length);if(e<s.length&&e-1>i&&/[\uD800-\uDBFF]/.test(s[e-1]))e--;p.push(s.slice(i,e));i=e}return p.length?p:['']};
async function push(force,skipRec){
 if(!DBr||DEAD||LOCAL_CORRUPT)return false;
 if(pushing){again=true;return false}
 pushing=true;setSt('sync');
 try{
  await syncBaseLoad();
  let expected=SY.rev;if(!skipRec){const s=await metaRef.get();expected=s.exists?s.data().rev:0;if(s.exists&&s.data().rev>SY.rev){const ok=await pullRemote(s.data());if(!ok){setTimeout(syncSoon,3000);return false}}}
  const j=pickJSON();if(j===SY.last&&!force&&SY.domRevs){setSt('ok');return true}
  const rev=Math.max(Date.now(),SY.rev+1),doms={},nextRevs={},nextLast={},nextN={},writes=[];
  for(const d of Object.keys(DOMS)){
   const dj=pickDomJSON(d),unchanged=!force&&SY.domRevs&&SY.domRevs[d]&&SY.domLast&&SY.domLast[d]===dj;
   if(unchanged){
    doms[d]={rev:SY.domRevs[d],n:SY.domN[d],len:dj.length};
    nextRevs[d]=SY.domRevs[d];nextLast[d]=dj;nextN[d]=SY.domN[d];
   }else{
    const parts=chunks(dj,CH),dn=parts.length;
    doms[d]={rev,n:dn,len:dj.length};
    nextRevs[d]=rev;nextLast[d]=dj;nextN[d]=dn;
    for(let i=0;i<dn;i++)writes.push([DBr.doc(P+'hub-d-'+d+'-'+i),{rev,i,s:parts[i]}]);
   }
  }
  const prevN=SY.n||0,prevDomN=SY.domN?{...SY.domN}:{};
  await DBr.runTransaction(async tx=>{const current=await tx.get(metaRef);if(!skipRec&&(current.exists?current.data().rev:0)!==expected){const e=new Error('revisão mudou');e.code='hub-conflict';throw e}
   writes.forEach(([ref,doc])=>tx.set(ref,doc));
   tx.set(metaRef,{rev,v:2,dev:SY.dev,at:new Date().toISOString(),len:j.length,doms})});
  SY.rev=rev;SY.last=j;SY.n=0;SY.domRevs=nextRevs;SY.domLast=nextLast;SY.domN=nextN;SY.p='';saveSY(true);setSt(pickJSON()===j?'ok':'sync');
  for(let i=0;i<prevN;i++)DBr.doc(P+'hub-'+i).delete().catch(()=>{});
  for(const d of Object.keys(DOMS))for(let i=nextN[d];i<(prevDomN[d]||0);i++)DBr.doc(P+'hub-d-'+d+'-'+i).delete().catch(()=>{});
  return true;
 }catch(e){const c=e&&e.code;if(c==='hub-conflict'){setSt('sync');setTimeout(syncSoon,0);return false}if(c==='invalid_argument'&&!SY.last){DEAD=true;setSt('local','sem permissão de gravação')}else{setSt('err',c);setTimeout(syncSoon,c==='quota_exceeded'?3e5:3e4)}return false}
 finally{pushing=false;if(again){again=false;syncSoon()}}
}
function syncSoon(){if(!DBr||DEAD)return;clearTimeout(ST);ST=setTimeout(()=>push(),2000)}
async function handleMeta(snap){
 if(LOCAL_CORRUPT){setSt('err','dados locais corrompidos');return}
 if(!snap.exists){if(snap.metadata&&snap.metadata.fromCache)return;const g=await metaRef.get();if(!g.exists)await push(true);return}
 const m=snap.data();if(m.rev<=SY.rev){if(m.rev===SY.rev&&pickJSON()===SY.last)setSt('ok');else syncSoon();return}
 if(!(await pullRemote(m)))setTimeout(()=>metaRef.get().then(handleMeta).catch(()=>{}),2000);else setSt(pickJSON()===SY.last?'ok':'sync')}
async function syncAct(a){
 if(a==='synccancel'){ARM=null;if(S.view==='backup')render({save:false});return}
 if(!DBr){toast('Sincronização indisponível neste aparelho');return}
 if(a==='syncnow'){toast(await push()?'Sincronizado':'Não foi possível sincronizar. Tente novamente.');return}
 if(ARM!==a){ARM=a;toast(a==='syncup'?'Clique de novo para substituir a nuvem por este aparelho':'Clique de novo para substituir este aparelho pela nuvem');if(S.view==='backup')render({save:false});setTimeout(()=>{if(ARM===a){ARM=null;if(S.view==='backup')render({save:false})}},6000);return}
 ARM=null;if(S.view==='backup')render({save:false});
 if(a==='syncup'){toast(await push(true,true)?'Nuvem atualizada com os dados deste aparelho':'Não foi possível atualizar a nuvem. Tente novamente.')}
 else{const s=await metaRef.get();if(!s.exists){toast('Não há dados na nuvem ainda');return}const ok=await pullRemote(s.data(),true);toast(ok?'Dados da nuvem carregados':'Tente de novo em instantes')}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)push()});
/* login + sincronização via Firebase (só no site): cada pessoa lê e grava só data/users/<uid>/ */
const FB_CONFIG={apiKey:'AIzaSyDouA0p2KjgWXvS8vnQ5vjn-aZHkRpOIwU',authDomain:'meuhub-48efb.firebaseapp.com',projectId:'meuhub-48efb',storageBucket:'meuhub-48efb.firebasestorage.app',messagingSenderId:'814751686360',appId:'1:814751686360:web:9b630a29ff6ea0807981ad'};// valores públicos; a proteção está nas regras do Firestore
const FBV='10.12.2';
let FB={ready:false,err:false,on:false,email:'',auth:null},fbUnsub=null;
const FB_SRI={app:'sha384-AQ3POAMqIhwS81FrUH95ekxqBZHeP5tG2JfEL3+7GuTtfRLWnrRh32UxwzM+//A9',auth:'sha384-TnlRYaR4JYz/lpaGuaiU61PjNberSA4vjLjtF+oRC/IkohkJqnWxw5EmDSOt1vA1',firestore:'sha384-qn4Jh88HhJA8dplNQyGjOh9OGI4izVhrfj/qIFgaKcdgOE06pXqIKGlsCILZcLAC'};
const fbScript=n=>new Promise((res,rej)=>{const t=document.createElement('script');t.src='https://www.gstatic.com/firebasejs/'+FBV+'/firebase-'+n+'-compat.js';if(FB_SRI[n])t.integrity=FB_SRI[n];t.crossOrigin='anonymous';t.referrerPolicy='no-referrer';t.onload=res;t.onerror=e=>{t.remove();rej(e)};document.head.append(t)});
try{localStorage.removeItem('hub-gd')}catch(e){}// token do antigo login pelo Google Drive
function fbInit(){
 if(!FB_CONFIG)return;
 fbScript('app').then(()=>Promise.all([fbScript('auth'),fbScript('firestore')])).then(()=>{
  if(!firebase.apps||!firebase.apps.length)firebase.initializeApp(FB_CONFIG);FB.auth=firebase.auth();FB.err=false;
  FB.auth.onAuthStateChanged(u=>{
   if(fbUnsub){fbUnsub();fbUnsub=null}
   if(u&&SY.uid&&SY.uid!==u.uid){acctSwap(SY.uid,u.uid);return}
   if(u&&!SY.uid){SY.uid=u.uid;saveSY()}
   FB.ready=true;FB.on=!!u;FB.email=u&&u.email||'';
   if(u){DBr=firebase.firestore();P='data/users/'+u.uid+'/';metaRef=DBr.doc(P+'hub-meta');DEAD=false;setSt('sync');
    if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
    fbUnsub=metaRef.onSnapshot(sn=>{chain=chain.then(()=>syncBaseLoad()).then(()=>handleMeta(sn)).catch(e=>setSt('err',e&&e.code))},e=>setSt('err',e&&e.code))}
   else{DBr=null;setSt('local')}
   render()})
 }).catch(()=>{FB.ready=true;FB.err=true;if(SY.uid)setSt('local','sem conexão');render()})}
window.addEventListener('online',()=>{if(FB.err){FB.err=false;fbInit()}else if(DBr)syncSoon()});
function fbLogin(){if(!FB.auth)return;FB.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e=>{if(e&&e.code!=='auth/popup-closed-by-user'&&e.code!=='auth/cancelled-popup-request')toast('Não foi possível entrar. Se a janela de login não abriu, permita pop-ups para este site e tente de novo.')})}
/* outra conta no mesmo aparelho: guarda à parte os dados locais da anterior (sem os snapshots locais) e traz os da nova, para nenhuma ver nem sobrescrever os da outra */
async function acctSwap(from,to){
 const ls=localStorage,ks=['hub-v1','hub-sync',AUDIT_KEY,PROFILE_KEY];
 const oldSnaps=ls.getItem(SNK),pack={};
 ks.forEach(k=>{const v=ls.getItem(k);if(v!==null)pack[k]=v});
 ls.removeItem(SNK);
 const packStr=JSON.stringify(pack);
 let saved=false;
 try{ls.setItem('hub-acct-'+from,packStr);saved=true}catch(e){}
 if(!saved&&typeof idbPut==='function'){saved=await idbPut('acct-'+from,packStr,true)}
 if(!saved){if(oldSnaps!==null)try{ls.setItem(SNK,oldSnaps)}catch(x){}FB.auth.signOut();toast('Não há espaço neste navegador para trocar de conta. Faça um Backup e tente de novo.');return}
 let b=null,fromIdb=false;
 try{b=JSON.parse(ls.getItem('hub-acct-'+to)||'null')}catch(e){}
 if(!b&&typeof idbGet==='function'){
  const rawIdb=await idbGet('acct-'+to,true);
  if(rawIdb&&typeof rawIdb==='string')try{b=JSON.parse(rawIdb);fromIdb=true}catch(e){}
 }
 if(Array.isArray(b)){
  const legacy=['hub-v1','hub-sync',SNK,AUDIT_KEY,PROFILE_KEY];
  legacy.forEach((k,i)=>{if(k===SNK)return;if(b[i]!=null)ls.setItem(k,b[i]);else ls.removeItem(k)});
 }else if(b&&typeof b==='object'){
  ks.forEach(k=>{if(b[k]!=null)ls.setItem(k,b[k]);else ls.removeItem(k)});
 }else{
  ks.forEach(k=>ls.removeItem(k));
 }
 ls.removeItem(SNK);ls.removeItem('hub-ui');ls.removeItem('hub-acct-'+to);if(fromIdb&&typeof idbDel==='function')await idbDel('acct-'+to,true);location.reload();
}
async function fbLogout(){if(!FB.auth)return;if(!(await push())){toast('Não foi possível sincronizar. Você continua na conta; tente novamente.');return}try{await FB.auth.signOut();toast('Você saiu da conta. Os dados continuam salvos na nuvem.')}catch(e){toast('Não foi possível sair da conta. Tente novamente.')}}
/* tela de login: o site só abre depois de entrar (sem FB_CONFIG não há login possível, então abre direto) */
// sem internet, quem já entrou neste aparelho usa os dados locais; a sincronização volta no próximo carregamento com conexão
function gateR(){const g=$('#gate'),on=!!FB_CONFIG&&!FB.on&&!(FB.err&&SY.uid);g.hidden=!on;$('.app').inert=on;if(!on){g.innerHTML='';return}
 const body=FB.err?'<p class="empty" style="padding:0 0 var(--space-4)">Não foi possível conectar. Verifique sua internet.</p><div class="bar"><button class="pill dark" data-a="reload">Tentar de novo</button></div>'
  :!FB.ready?'<p class="empty" style="padding:0">Carregando…</p>'
  :'<p style="margin:0 0 var(--space-1);font-size:var(--type-title)">Bem-vindo!</p><p class="empty" style="padding:0 0 var(--space-4)">Entre com sua conta Google para começar. Seus dados ficam salvos e aparecem em todos os seus aparelhos.</p><div class="bar"><button class="pill dark" data-a="fblogin">Entrar com o Google</button></div>';
 g.innerHTML=`<div class="gbox" role="dialog" aria-modal="true" aria-label="Entrar"><div class="logo">meu hub<i></i></div>${body}</div>`}
