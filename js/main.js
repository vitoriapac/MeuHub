// telas (V), render(), listeners centrais de clique/envio e inicialização
/* paginação: listas longas mostram um bloco e o resto sob demanda */
let PG={},PGV='';
const NOTE_DRAFTS={};
const noteDraftKey=f=>f.dataset.shoppingForm?'new:'+f.dataset.shoppingForm:f.dataset.shoppingEdit?'edit:'+f.dataset.shoppingEdit+':'+f.dataset.item:'';
function restoreNoteDrafts(){document.querySelectorAll('#main form[data-shopping-form],#main form[data-shopping-edit]').forEach(f=>{const v=NOTE_DRAFTS[noteDraftKey(f)];if(v){Object.entries(v).forEach(([k,x])=>{if(f.elements[k])f.elements[k].value=x});if(['qty','unit','estimated','actual'].some(k=>v[k])){const d=f.querySelector('.shop-extra');if(d)d.open=true}}})}
const pgN=(k,d)=>PG[k]||d;
const FLK=()=>'fl'+S.fmo+'|'+(S.fcat||'')+'|'+(S.fkd||'')+'|'+FQ+'|'+(S.fac||'')+'|'+(S.ftab||'')+'|'+FTAG;
const pgMore=(k,tot,d)=>{const sh=pgN(k,d);return tot>sh?`<div class="pgm"><button class="pill" data-a="pgmore" data-id="${esc(k)}" data-d="${d}">Mostrar mais ${Math.min(d,tot-sh)}</button><span class="empty" style="padding:0">${sh} de ${tot}</span></div>`:''};
const V={projetos,arquivados,leituras,rotina,lixeira,avisos,dash,agenda,notas,tarefas,links,backup,aparencia,habitos,financas,diario,hoje,etiquetas,metas,menu:menuView};
let LV=null;
function renderKeepDraft(opts){const key=f=>f.id?'id:'+f.id:f.dataset.shoppingForm?'shopping:'+f.dataset.shoppingForm:f.dataset.shoppingEdit?'edit:'+f.dataset.shoppingEdit+':'+f.dataset.item:'';const forms=PGV===S.view?[...document.querySelectorAll('#main form')].map(f=>({key:key(f),values:[...f.elements].filter(x=>x.name&&!/^(checkbox|radio|file|submit|button)$/i.test(x.type||'')&&(x.tagName==='SELECT'?x.value!==(([...x.options].find(o=>o.defaultSelected)||x.options[0])||{}).value:x.value!==x.defaultValue)).map(x=>[x.name,x.value])})).filter(x=>x.key&&x.values.length):[];render(opts);forms.forEach(d=>{const f=[...document.querySelectorAll('#main form')].find(x=>key(x)===d.key);if(f)d.values.forEach(([name,value])=>{const x=f.elements.namedItem(name);if(x)x.value=value})})}
function revealFinanceTab(tabs=$('#main .ftabs')){
 const active=tabs?.querySelector('[aria-pressed="true"]');
 if(!active||tabs.scrollWidth<=tabs.clientWidth)return;
 const rail=tabs.getBoundingClientRect(),button=active.getBoundingClientRect();
 if(button.left<rail.left||button.right>rail.right){
  tabs.scrollLeft+=button.left-rail.left-(rail.width-button.width)/2;
 }
}
window.addEventListener('resize',()=>revealFinanceTab());
function render(opts){
 dayPending=false;remoteRenderPending=false;
 const sameView=PGV===S.view,prevScroll=sameView?window.scrollY:0;
 if(!sameView){PG={};PGV=S.view}
 const openDetailsIds=sameView?[...document.querySelectorAll('#main details[open][id]')].map(d=>d.id):[];
 const FK=focusKey(),reviewOpen=!!document.querySelector('#weekly-review[open]'),guideOpen=!!document.querySelector('[data-review-guide][open]'),noteFiltersOpen=!!document.querySelector('[data-note-filters][open]'),impRestOpen=!!document.querySelector('[data-imp-rest][open]'),txBulkOpen=!!document.querySelector('[data-tx-bulk][open]');
 const oldTx=$('[data-tx-detail]')?.dataset.txDetail;
 const oldTabs=S.view==='financas'&&!Q?$('#main .ftabs'):null;
 const oldTab=oldTabs?.querySelector('[aria-pressed="true"]')?.dataset.id,oldTabScroll=oldTabs?.scrollLeft||0;
 $('#main').innerHTML=Q?busca():V[S.view]();
 const tabs=S.view==='financas'&&!Q?$('#main .ftabs'):null;
 if(tabs&&tabs.scrollWidth>tabs.clientWidth){
  tabs.scrollLeft=oldTabScroll;
  if(oldTab!==tabs.querySelector('[aria-pressed="true"]')?.dataset.id)revealFinanceTab(tabs);
 }
 if(S.view==='notas'&&!Q)restoreNoteDrafts();
 openDetailsIds.forEach(id=>{const d=document.getElementById(id);if(d&&d.tagName==='DETAILS')d.open=true});
 if(reviewOpen&&$('#weekly-review'))$('#weekly-review').open=true;
 if(guideOpen&&$('[data-review-guide]'))$('[data-review-guide]').open=true;
 if(noteFiltersOpen&&$('[data-note-filters]'))$('[data-note-filters]').open=true;
 if(impRestOpen&&$('[data-imp-rest]'))$('[data-imp-rest]').open=true;
 if(txBulkOpen&&$('[data-tx-bulk]'))$('[data-tx-bulk]').open=true;
 renderMenu();document.querySelectorAll('.nav[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===S.view&&!Q));
 pomoDraw();fillTags();updU();trashSweep();a11y(FK);lkDraw();flashEl();
 {const mn=$('#main');if(mn&&LV!==S.view){LV=S.view;mn.classList.remove('vin');void mn.offsetWidth;mn.classList.add('vin')}}
 if(sameView&&prevScroll>0&&Math.abs(window.scrollY-prevScroll)>4)window.scrollTo({top:prevScroll,behavior:'instant'});
 const newTx=$('[data-tx-detail]')?.dataset.txDetail;
 if(newTx&&newTx!==oldTx)$('#tx-detail-title')?.focus();
 else if(sameView&&oldTx&&!newTx){
  const row=[...document.querySelectorAll('#txlist [data-a="edtx"]')].find(b=>b.dataset.id===oldTx);
  (row||$('#tx-list-heading'))?.focus();
 }
 gateR();spSync();if(document.querySelector('[data-card=clima]'))wxEnsure();if(S.view==='financas'&&S.ftab==='inv'&&typeof invEnsureQuotes==='function')invEnsureQuotes();
 if(!opts||opts.save!==false)save();
}
const PAUSE_GUARD=new Set(['plan','review-plan','snooze','focus','fit','fitday','fit-propose','fit-confirm','rtplan','rtdeadline','dash-done']);
function readStepEpisode(r,d){
 r.season=r.season||1;
 r.episode=Math.max(0,(r.episode||0)+d);
 if(r.episodes>0){
  r.p=Math.min(100,Math.round(Math.min(r.episode,r.episodes)/r.episodes*100));
  if(r.episode>=r.episodes&&d>0){r.st='f';r.df=r.df||T;r.p=100;toast('Série concluída!');return}
 }
 toast('Episódio '+r.episode+(r.episodes?' de '+r.episodes:'')+' registrado');
}
function completeTask(t,done){t.done=done;t.dd=done?T:'';if(t.done&&t.rc&&!t.sp){t.sp=true;const nd=nextDue(t);S.tasks.splice(S.tasks.indexOf(t),0,{...t,id:uid(),seriesId:t.seriesId||t.id,bk:null,done:false,dd:'',sp:false,pm:0,due:nd,sub:(t.sub||[]).map(s=>({...s,id:uid(),done:false}))});toast('Próxima ocorrência criada para '+fmt(nd))}}
const TRASH_SNAP=new Set(['delev','delnote','deltk','dellk','clear','deltx','deltxg']);
const FULL_RENDER_ACTIONS=new Set(['ed','edtx','edrec','edbill','fcancel','reccancel','billcancel','cancel']);
function handleBulkClick(a,b,e){
 e.preventDefault();
 const f=b.closest('form'),due=f.id==='bulk-due',preview=a.endsWith('-preview'),date=f.elements.date.value;
 const ids=[...f.querySelectorAll('[name=task]:checked:not(:disabled)')].map(x=>x.value);
 const items=ids.map(x=>S.tasks.find(t=>t.id===x&&!t.done&&!taskPaused(t)&&!t.rc)).filter(Boolean);
 const valid=/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(new Date(date+'T12:00').getTime())&&ds(new Date(date+'T12:00'))===date;
 const snapshot=JSON.stringify({date,items:items.map(t=>({id:t.id,t:t.t,due:t.due||'',hd:t.hd||'',bk:t.bk||null}))});
 const out=f.querySelector('[data-bulk-preview]'),apply=f.querySelector('[data-a$="-apply"]');
 if(preview){
  if(!valid||!items.length||items.length!==ids.length){
   out.textContent='Escolha uma data válida e ao menos uma tarefa disponível.';
   apply.hidden=true;delete f.dataset.preview;return;
  }
  f.dataset.preview=snapshot;
  out.textContent=items.length+(items.length===1?' tarefa para ':' tarefas para ')+fmt(date)+' '+date.slice(0,4)+': '+items.map(t=>t.t+(due?' (prazo anterior: '+(t.due?fmt(t.due)+' '+t.due.slice(0,4):'sem prazo')+')':'')).join('; ')+(due?'. Planejamento e horários serão mantidos.':'. Os prazos e horários agendados serão mantidos.');
  apply.hidden=false;return;
 }
 if(!valid||!ids.length||items.length!==ids.length||f.dataset.preview!==snapshot){
  out.textContent='A seleção mudou. Revise novamente antes de confirmar.';
  b.hidden=true;return;
 }
 track();UTime=0;items.forEach(t=>{if(due)t.due=date;else t.hd=date});
 toast(items.length+(due?' prazo(s) atualizado(s); planejamento mantido.':items.length===1?' tarefa planejada; prazo mantido.':' tarefas planejadas; prazos mantidos.'));
 renderKeepDraft();
}
function handleAttOpen(b,id,e){
 e.preventDefault();
 const kind=b.dataset.kind;
 if(kind==='tk')lkGo('tk:'+id);
 else if(kind==='conflict'){S.view='agenda';S.mode='day';S.dy=mDays(b.dataset.day);Q='';FLASH='ev:'+id}
 else if(kind==='bill'){S.view='financas';S.ftab='contas';S.fvw='mes';BED=id;Q=''}
 else if(kind==='sub'){S.view='financas';S.ftab='contas';S.fvw='mes';RED=id;Q=''}
 else if(kind==='sal'){S.view='financas';S.ftab='analise';S.fvw='mes';S.fmo=0;Q=''}
 render();
 if(S.view==='financas')saveUI();
 if(kind==='sub')document.querySelector('#frec')?.scrollIntoView({block:'center'});
 if(kind==='bill')document.querySelector('#fbill')?.scrollIntoView({block:'center'});
 if(kind==='sal')document.querySelector('#cash-flow-panel')?.scrollIntoView({block:'start'});
}
const CLICK_EARLY={
 'sw-reload':()=>{if(SW_REG&&SW_REG.waiting){SW_RELOADING=true;SW_REG.waiting.postMessage({type:'SKIP_WAITING'})}else location.reload()},
 'att-dismiss':(b,id,e)=>{
  e.preventDefault();
  const key=b.dataset.key,item=attention().find(x=>x.dismissKey===key);
  if(item){
   const existing=(S.rem&&S.rem.dismiss)||{},keep=Object.fromEntries(Object.entries(existing).filter(([,day])=>day===T));
   keep[key]=T;S.rem=Object.assign({},S.rem||{},{dismiss:keep});render();
  }
 },
 'bulk-cancel':(b,id,e)=>{
  e.preventDefault();const f=b.closest('form');
  f.reset();delete f.dataset.preview;f.querySelector('[data-bulk-preview]').textContent='';
  f.querySelector('[data-a$="-apply"]').hidden=true;f.closest('details').open=false;
 },
 'finance-review-open':(b,id,e)=>{
  e.preventDefault();
  const t=finInit().tx.find(x=>x.id===id);
  if(t){ANALYSIS_CUT='';if(b.dataset.keepFinScope===undefined)S.fac='';S.fcat='';S.fkd='';FQ='';FRECON='';FTAG='';S.view='financas';S.ftab='lanc';S.fvw='mes';S.fmo=(+t.d.slice(0,4)-today.getFullYear())*12+(+t.d.slice(5,7)-1-today.getMonth());Q='';$('#q').value='';FED=t.id;saveUI();render();$('#ffin')?.scrollIntoView({block:'center'})}
 },
 'finance-distinct':(b,id,e)=>{
  e.preventDefault();
  const group=shoppingReviewGroups().find(g=>g.key===b.dataset.key);
  if(group){group.tx.forEach(t=>{t.shoppingReviewed=group.key});render();toast('Compras confirmadas como distintas')}
  else{render();toast('A lista mudou. Confira os lançamentos novamente.')}
 },
 'att-open':handleAttOpen,
 fmt:(b)=>{
  const ed=b.closest('.note').querySelector('.rt'),[c,v]=b.dataset.c.split(':');ed.focus();
  if(c==='task'){lineToTask(ed);return}
  c==='chk'?document.execCommand('insertHTML',false,'<div><input type="checkbox">&nbsp;</div>'):document.execCommand(c,false,v||null);
  ed.dispatchEvent(new Event('input',{bubbles:true}));
 },
 more:()=>{$('#mobile-sync').textContent=$('#syn').innerText;$('#mobile-menu').showModal()},
 'close-mobile-menu':()=>$('#mobile-menu').close(),
 'mobile-theme':()=>$('#theme').click(),
 adv:(b)=>{const f=b.closest('form');f.classList.toggle('advo');b.textContent=f.classList.contains('advo')?'Menos opções':'Mais opções'},
 'tx-new':()=>{const d=$('#tx-new');if(d){d.open=true;d.querySelector('[name=t]')?.focus()}},
 'fin-config-open':(b,id,e)=>{
  e.preventDefault();
  const section=document.getElementById(id);
  if(!section||section.tagName!=='DETAILS')return;
  section.open=true;
  (section.querySelector('input,select')||section.querySelector('summary'))?.focus();
 },
 'new-fin-rec':(b,id,e)=>{
  e.preventDefault();S.ftab='contas';RED=null;FED=null;saveUI();render({save:false});
  const section=$('#fin-rec-form');
  if(section){section.open=true;section.querySelector('[name=t]')?.focus()}
 },
 'reserve-confirm':(b,id,e)=>{e.preventDefault();const f=b.form;reviewReserveBatch(f,Object.fromEntries(new FormData(f)),true)},
 focusform:(b,id,e)=>{e.preventDefault();const i=document.querySelector(id+' input');if(i)i.focus()},
 bksnz:()=>{S.bkSnz=T;render()},
 onbx:()=>{S.onb=false;render()},
 pgmore:(b,id)=>{PG[id]=pgN(id,+b.dataset.d)+ +b.dataset.d;render({save:false})},
 qa:(b,id,e,a)=>{e.preventDefault();if(a==='qax')qaClose();else{QSHOP=null;QSHOPSESSION=null;qa(a==='qat'?id:undefined)}},
 'shopping-share':(b,id,e)=>{e.preventDefault();shoppingShare(id)},
 'shopping-expense':(b,id,e)=>{
  e.preventDefault();
  const n=S.notes.find(x=>x.id===id&&x.kind==='shopping');
  if(!n)return;
  QI=null;FED=null;QSHOP=id;QSHOPSESSION='shop_'+uid();qa('dp');
  const i=document.querySelector('#fqa input[name=t]'),f=i.form,done=(n.items||[]).filter(x=>x.done),total=shoppingTotals(done,'actualCents');
  i.value='Compra: '+n.t;
  if(done.length&&!total.missing)f.elements.v.value=total.value.toFixed(2).replace('.',',');
  const hint=document.createElement('p');hint.className='empty';
  hint.textContent='Revise valor, conta, data e categoria. Cada confirmação registra uma compra independente. Lançamentos anteriores: '+(S.fin.tx||[]).filter(t=>t.shopping===id).length+'.';
  f.appendChild(hint);shoppingSessionForm(n,f);shoppingAssociationForm(n,done,total,f);i.focus();
 },
 'shopping-associate':(b,id,e)=>{
  e.preventDefault();
  const f=b.closest('#fqa'),n=S.notes.find(x=>x.id===QSHOP&&x.kind==='shopping'),t=f&&S.fin.tx.find(x=>x.id===f.elements.shoppingAssociation?.value&&x.k==='out'&&!x.shopping);
  if(!n||!t){toast('Escolha uma despesa disponível para associar.');return}
  if(f.elements.shoppingAssociation.selectedOptions[0]?.dataset.transaction!==JSON.stringify(t)){toast('A despesa mudou. Abra novamente para conferi-la.');return}
  const items=shoppingSessionItems(f);if(!items){toast('A lista mudou. Abra novamente para conferir os itens.');return}
  const prior=(S.fin.tx||[]).some(x=>x.shopping===n.id&&(x.shoppingItems||[]).some(xid=>items.some(item=>item.id===xid)));
  if(prior&&!f.elements.shoppingRepeatConfirmed.checked){toast('Confirme que os itens já registrados pertencem a outra compra.');return}
  t.shopping=n.id;t.shoppingItems=items.map(x=>x.id);qaClose();toast('Despesa associada à lista');render();
 },
 inboxconvert:(b,id,e)=>{e.preventDefault();QI=id;qa('tk')},
 gundo:(b,id,e)=>{e.preventDefault();undo()},
 gredo:(b,id,e)=>{e.preventDefault();redo()},
 payfat:(b,id,e)=>{e.preventDefault();S.view='financas';S.fvw='mes';S.ftab='lanc';render();payInv(id,+b.dataset.o)},
 fexp:(b,id,e)=>{e.preventDefault();exportYear()},
 payinv:(b,id,e)=>{e.preventDefault();payInv(id)},
 'rd-cover-find':(b,id,e)=>{e.preventDefault();findCover(id)},
 'rd-autofill':(b,id,e)=>{e.preventDefault();findNewReadMeta()},
 'rd-autofill-use':(b,id,e)=>{
  e.preventDefault();
  const hit=RD.newLookup&&RD.newLookup.results&&RD.newLookup.results[+id];if(!hit)return;
  const f=document.getElementById('frd');
  if(f){
   if(f.elements.t&&hit.title)f.elements.t.value=hit.title;
   if(f.elements.a&&hit.author&&!/^(Autor|Direção) não informad/.test(hit.author))f.elements.a.value=hit.author;
  }
  RD.draftMeta={year:+hit.year||'',pages:+hit.pages||'',mins:+hit.mins||'',cover:+hit.cover||0,coverUrl:hit.poster||''};
  RD.newLookup=null;
  const el=document.getElementById('frd-lookup');if(el)el.outerHTML=renderNewReadLookup();
 },
 'rd-cover-use':(b,id,e)=>{
  e.preventDefault();
  const r=(S.reads||[]).find(x=>x.id===id);if(!r||!RD.lookup||RD.lookup.id!==id)return;
  const cover=+b.dataset.cover,poster=b.dataset.poster||'';
  const hit=RD.lookup.results.find(x=>(cover&&x.cover===cover)||(poster&&x.poster===poster));
  if(!hit)return;
  if(hit.cover&&Number.isSafeInteger(hit.cover)&&hit.cover>0){r.cover=hit.cover;delete r.coverUrl}
  else if(hit.poster&&/^https:\/\//i.test(hit.poster)){r.coverUrl=hit.poster;delete r.cover}
  else return;
  if(hit.year&&!r.year&&Number.isInteger(+hit.year))r.year=+hit.year;
  if(hit.mins&&!r.mins&&Number.isInteger(+hit.mins))r.mins=+hit.mins;
  delete r.coverColor;RD.lookup=null;renderKeepDraft();coverPalette(id,r.cover,r.coverUrl);
 },
 syncnow:(b,id,e,a)=>{e.preventDefault();syncAct(a)},
 bkexp:(b,id,e)=>{e.preventDefault();exportBk()},
 bkshr:(b,id,e)=>{e.preventDefault();shareBk()},
 idbrestore:(b,id,e)=>{e.preventDefault();restoreIdbBk()},
 'profile-switch':(b,id,e)=>{e.preventDefault();try{profileSwitch(id);render();toast('Perfil aplicado')}catch(err){toast(esc(err.message||'Não foi possível aplicar o perfil'))}}
};
CLICK_EARLY['bulk-due-cancel']=CLICK_EARLY['bulk-cancel'];
CLICK_EARLY.qat=CLICK_EARLY.qa;CLICK_EARLY.qax=CLICK_EARLY.qa;
CLICK_EARLY.syncup=CLICK_EARLY.syncnow;CLICK_EARLY.syncdown=CLICK_EARLY.syncnow;CLICK_EARLY.synccancel=CLICK_EARLY.syncnow;
['bulk-preview','bulk-apply','bulk-due-preview','bulk-due-apply'].forEach(k=>{CLICK_EARLY[k]=(b,id,e)=>handleBulkClick(k,b,e)});

const CLICK_ACTIONS={
 'context-pin':(id,b)=>{
  const ref=b.dataset.ref;
  if(lkItem(ref)&&lkItem(id)?.ty==='nt')lkSet(ref,id,true);
 },
 'context-hide':(id,b)=>{hiddenContextNotes.add(contextNoteKey(b.dataset.ref,id))},
 'focus-enter':(id)=>{
  const t=S.tasks.find(t=>t.id===id&&!t.done&&!taskPaused(t));
  if(t)focusTask={id,uid:SY.uid};
 },
 'focus-exit':()=>{focusTask=null},
 'focus-done':(id)=>{
  const t=S.tasks.find(t=>t.id===id&&!t.done&&!taskPaused(t));
  if(t)completeTask(t,true);
  if(S.fk?.id===id)S.fk=null;
  focusTask=null;
 },
 // Agenda & navegação
 nav:(id,b)=>{const n=+b.dataset.n,k={month:'mo',day:'dy'}[S.mode]||'wk';S[k]=n?S[k]+n:0},
 delev:(id)=>{S.events=S.events.filter(x=>x.id!==id)},
 inboxdel:(id)=>{S.inbox=(S.inbox||[]).filter(x=>x.id!==id)},
 ed:(id,b)=>{ED={t:b.dataset.t,id}},
 cancel:()=>{ED=null},
 undo:()=>{
  const tt=$('#toast');if(tt)tt.classList.remove('on');
  if(UN){Object.assign(S,JSON.parse(UN));UN=null}else if(UH.length){undo();return 'stop'}
 },
 pin:(id,b)=>{const x=S[b.dataset.t].find(y=>y.id===id);if(x)x.pin=!x.pin},
 gotoday:(id)=>{S.view='agenda';S.mode='day';S.dy=Math.round((new Date(id+'T00:00')-new Date(T+'T00:00'))/864e5)},
 mode:(id)=>{S.mode=id;ED=null},
 tmode:(id)=>{S.tmode=id;ED=null},
 twk:(id,b)=>{S.wk=b.dataset.n==='0'?0:(S.wk||0)+ +b.dataset.n},
 pick:(id)=>{S.dy=Math.round((new Date(id+'T00:00')-new Date(T+'T00:00'))/864e5);S.mode='day'},
 cap:(id)=>{S.cap=Math.max(1,Math.min(16,(+S.cap||8)+ +id))},
 // Notas & compras
 'shopping-add':()=>{const folder=S.nf||'';noteReset();S.notes.unshift({id:uid(),kind:'shopping',t:'Lista de compras',b:'',f:folder,g:'',c:'g',items:[],updatedAt:Date.now()})},
 'shopping-edit':(id,b)=>{SED=id+':'+b.dataset.item;const n=S.notes.find(x=>x.id===id&&x.kind==='shopping'),item=n&&n.items.find(x=>x.id===b.dataset.item);SEDBASE=item?JSON.stringify(item):null},
 'shopping-cancel':(id,b)=>{delete NOTE_DRAFTS[noteDraftKey(b.closest('form'))];SED=null;SEDBASE=null},
 'shopping-copy':(id)=>{const n=S.notes.find(x=>x.id===id&&x.kind==='shopping');if(n){noteReset();S.notes.unshift({...n,id:uid(),t:n.t+' (cópia)',pin:false,archived:false,revisit:false,reviewDate:'',updatedAt:Date.now(),items:n.items.map(x=>({...x,id:uid(),done:false}))})}},
 'shopping-recover':(id,b)=>{
  const f=b.closest('form'),text=f&&f.elements.t.value.trim(),q=f&&f.elements.q.value.trim(),prices=f&&shoppingPrices(Object.fromEntries(new FormData(f)));
  if(text&&!prices){toast('Confira quantidade e preços.');return 'stop'}
  if(text){
   let n=S.notes.find(x=>x.id===f.dataset.shoppingEdit&&x.kind==='shopping');
   if(!n){const title=f.closest('.note').querySelector('[data-f=t]');n={id:uid(),kind:'shopping',t:title&&title.value||'Lista recuperada',b:'',f:'',g:'',c:'g',items:[]};S.notes.unshift(n)}
   n.items.push({id:uid(),t:text,q,done:false,...prices});noteTouch(n);delete NOTE_DRAFTS[noteDraftKey(f)];SED=null;SEDBASE=null;toast('Edição recuperada como novo item');
  }
 },
 'shopping-item-del':(id,b)=>{const n=S.notes.find(x=>x.id===id&&x.kind==='shopping');if(n){n.items=n.items.filter(x=>x.id!==b.dataset.item);noteTouch(n)}},
 'shopping-clear':(id)=>{const n=S.notes.find(x=>x.id===id&&x.kind==='shopping');if(n){if(SCLEAR===id){n.items=n.items.filter(x=>!x.done);noteTouch(n);SCLEAR=null}else{SCLEAR=id;toast('Clique novamente em Limpar comprados para confirmar');setTimeout(()=>{if(SCLEAR===id)SCLEAR=null},6000)}}},
 addnote:()=>{const folder=S.nf||'';noteReset();S.notes.unshift({id:uid(),t:'',b:'',f:folder,g:'',c:COL[S.notes.length%4],updatedAt:Date.now()})},
 'note-archive':(id)=>{const n=S.notes.find(x=>x.id===id);if(n){n.archived=!n.archived;auditLog(n.archived?'archive':'restore')}},
 'note-revisit':(id)=>{const n=S.notes.find(x=>x.id===id);if(n){n.revisit=!n.revisit;if(!n.revisit)n.reviewDate='';noteTouch(n)}},
 'note-copy':(id)=>{const n=S.notes.find(x=>x.id===id&&x.kind!=='shopping');if(n){noteReset();S.notes.unshift({...n,id:uid(),t:(n.t||'Sem título')+' (cópia)',pin:false,archived:false,revisit:false,reviewDate:'',updatedAt:Date.now()})}},
 delnote:(id)=>{if(S.notes.some(x=>x.id===id))auditLog('noteDelete');S.notes=S.notes.filter(x=>x.id!==id)},
 color:(id)=>{const n=S.notes.find(x=>x.id===id);n.c=COL[(COL.indexOf(n.c)+1)%4]},
 tpl:(id)=>{const t=TPL.find(x=>x.k===id),folder=S.nf||'';noteReset();S.notes.unshift({id:uid(),t:t.t.replace('{d}',dlbl()),b:t.b,f:folder,g:t.g,c:t.c,updatedAt:Date.now()})},
 nf:(id)=>{S.nf=S.nf===id?'':id},
 ng:(id)=>{S.ng=S.ng===id?'':id},
 tgnote:(id)=>{S.view='notas';S.nf='';S.ng=id},
 // Projetos, tarefas & metas
 'project-archive':(id)=>{const project=(S.projects||[]).find(x=>x.id===id);if(project){project.archived=!project.archived;auditLog(project.archived?'projectArchive':'projectRestore');toast(project.archived?'Projeto arquivado; itens vinculados permanecem ativos.':'Projeto restaurado.')}},
 'project-delete':(id)=>{if((S.projects||[]).some(x=>x.id===id)){S.projects=S.projects.filter(x=>x.id!==id);auditLog('projectDelete');toast('Projeto enviado à lixeira; itens vinculados preservados.')}},
 'project-next':(id,b)=>{const project=(S.projects||[]).find(x=>x.id===id&&!x.archived),t=S.tasks.find(x=>x.id===b.dataset.ref);if(project&&t&&!t.done&&!taskPaused(t)&&(project.refs||[]).some(r=>r.id==='tk:'+t.id))project.nextTask=project.nextTask===t.id?'':t.id},
 'project-unlink':(id,b)=>{const project=(S.projects||[]).find(x=>x.id===id&&!x.archived);if(project){project.refs=(project.refs||[]).filter(x=>x.id!==b.dataset.ref);if(b.dataset.ref==='tk:'+project.nextTask)project.nextTask=''}},
 'project-open':(id)=>{const r=lkItem(id);if(r&&r.ty==='tx'){ANALYSIS_CUT='';S.view='financas';S.fvw='mes';S.ftab='lanc';S.fmo=(+r.it.d.slice(0,4)-today.getFullYear())*12+(+r.it.d.slice(5,7)-1-today.getMonth());FQ=r.it.t;Q=''}else if(r)lkGo(id)},
 'task-archive':(id)=>{const t=S.tasks.find(x=>x.id===id);if(t){t.archived=!t.archived;auditLog(t.archived?'taskArchive':'taskRestore');pauseArchivedFocus();toast(t.archived?'Tarefa arquivada; histórico e vínculos preservados.':taskPaused(t)?'Tarefa restaurada, ainda pausada por uma meta arquivada.':'Tarefa restaurada.')}},
 'meta-archive':(id)=>{
  const g=S.metas.find(x=>x.id===id);if(!g)return;
  if(!g.archived){
   const matches=S.tasks.filter(t=>!t.done&&goalTracks(g,t));
   if(matches.some(t=>typeof t.id!=='string'||!t.id)){toast('Não foi possível arquivar: há tarefa vinculada sem identificador.');return 'stop'}
   g.pausedTaskIds=[...new Set(matches.flatMap(t=>[t.id,t.seriesId].filter(Boolean)))];g.archived=true;auditLog('goalArchive');pauseArchivedFocus();toast('Meta arquivada e tarefas acompanhadas pausadas.');
  }else{g.archived=false;auditLog('goalRestore');toast('Meta restaurada; outras pausas foram preservadas.')}
 },
 filter:(id)=>{S.filter=id},
 deltk:(id)=>{if(S.tasks.some(x=>x.id===id))auditLog('taskDelete');S.tasks=S.tasks.filter(x=>x.id!==id)},
 clear:()=>{S.tasks=S.tasks.filter(x=>!x.done||x.archived)},
 dellk:(id)=>{S.links=S.links.filter(x=>x.id!==id)},
 sorttk:()=>{S.tasks.sort(tsort)},
 krm:(id,b)=>{const g=S.metas.find(x=>x.id===id),k=g.kr.find(x=>x.id===b.dataset.k);k.cur=Math.max(0,(+k.cur||0)+ +b.dataset.n)},
 delkr:(id,b)=>{const g=S.metas.find(x=>x.id===id);g.kr=g.kr.filter(x=>x.id!==b.dataset.k)},
 delmeta:(id)=>{S.metas=S.metas.filter(x=>x.id!==id);S.tasks.forEach(t=>{if(t.mt===id)t.mt=''})},
 unmt:(id)=>{const t=S.tasks.find(x=>x.id===id);t.mt=''},
 mrn:(id,b)=>{S.mro=b.dataset.n==='0'?0:S.mro+ +b.dataset.n},
 plan:(id)=>{const t=S.tasks.find(x=>x.id===id);t.hd=t.hd===T?'':T},
 'review-plan':(id,b)=>{const t=S.tasks.find(x=>x.id===id),date=b.dataset.date;if(t&&!t.done&&date&&date>=T&&projectDate(date))t.hd=date},
 'hide-suggestion':(id)=>{dismissedSuggestions.add(T+':'+id)},
 tagv:(id)=>{S.tgsel=id;S.view='etiquetas';Q='';$('#q').value=''},
 snooze:(id)=>{const t=S.tasks.find(x=>x.id===id);t.due=ds(add(today,1));if(t.hd===T)t.hd='';toast('Tarefa adiada para amanhã')},
 tmv:(id,b)=>{const i=S.tasks.findIndex(x=>x.id===id),j=i+ +b.dataset.n;if(j>=0&&j<S.tasks.length)[S.tasks[i],S.tasks[j]]=[S.tasks[j],S.tasks[i]]},
 pf:(id)=>{S.pf=S.pf===id?'':id},
 sdel:(id,b)=>{const t=S.tasks.find(x=>x.id===id);t.sub=t.sub.filter(s=>s.id!==b.dataset.s)},
 sprom:(id,b)=>{const t=S.tasks.find(x=>x.id===id),s=t&&(t.sub||[]).find(x=>x.id===b.dataset.s);if(s){t.sub=t.sub.filter(x=>x.id!==s.id);const nid=uid(),nt={id:nid,t:s.t,done:!!s.done,dd:s.done?T:'',p:t.p||'m',due:t.due||'',pj:t.pj||'',tg:t.tg||'',mt:t.mt||''};S.tasks.splice(S.tasks.indexOf(t)+1,0,nt);lkSet('tk:'+t.id,'tk:'+nid,true);toast('Etapa transformada em tarefa e ligada à original')}},
 focus:(id)=>{S.fk={id,mode:'foco',run:true,end:Date.now()+FOCO*6e4,left:FOCO*6e4};askNotif()},
 pp:()=>{const k=S.fk;if(!k)return 'stop';if(taskPaused(S.tasks.find(t=>t.id===k.id))){toast('A tarefa está pausada.');return 'stop'}if(k.run){k.left=k.end-Date.now();k.run=false}else{k.end=Date.now()+k.left;k.run=true}},
 ps:()=>{S.fk=null},
 lc:(id)=>{S.lc=id},
 goal:(id)=>{S.goal=Math.max(1,Math.min(20,S.goal+ +id))},
 lkopen:(id)=>{LKP={ref:id,q:'',focus:true};LKO=id},
 lkclose:()=>{LKP=null},
 lkadd:(id)=>{if(LKP){lkSet(LKP.ref,id,true);LKP.q='';LKP.focus=true}},
 lkdel:(id)=>{if(LKP)lkSet(LKP.ref,id,false)},
 lkgo:(id)=>{lkGo(id)},
 // Encaixe & disponibilidade
 'fit-propose':(id)=>{const t=S.tasks.find(x=>x.id===id&&!x.done&&!taskPaused(x)),d=ds(add(today,S.dy)),h=t&&autoSlot(d,t.dur||30,t.id);if(h)FIT={id,d,h,dur:t.dur||30,bk:JSON.stringify(t.bk||null)};else{FIT=null;toast('Sem espaço livre nas janelas configuradas')}},
 'fit-cancel':()=>{FIT=null},
 'fit-confirm':(id)=>{const t=S.tasks.find(x=>x.id===id&&!x.done&&!taskPaused(x)),d=ds(add(today,S.dy)),p=FIT;if(t&&p&&p.id===id&&p.d===d&&p.dur===(t.dur||30)&&p.bk===JSON.stringify(t.bk||null)&&autoSlot(d,p.dur,t.id)===p.h){t.bk={d,h:p.h};FIT=null;toast('Tarefa encaixada às '+p.h);warnPlan(d,t.id)}else{FIT=null;toast('A agenda mudou. Solicite uma nova sugestão.')}},
 fit:(id)=>{const t=S.tasks.find(x=>x.id===id),k=ds(add(today,S.dy));if(t){const h=autoSlot(k,t.dur||30,t.id);if(h){t.bk={d:k,h};warnPlan(k,t.id)}else toast('Sem espaço livre nas janelas configuradas')}},
 fitday:(id)=>{const t=S.tasks.find(x=>x.id===id);if(t&&!t.done&&!t.bk){const h=autoSlot(T,t.dur||30,t.id);if(h){t.bk={d:T,h};toast('Tarefa encaixada às '+h+(t.dur?'':' por 30 min'));warnPlan(T,t.id)}else toast('Sem espaço livre hoje nas janelas configuradas')}},
 unbk:(id)=>{const t=S.tasks.find(x=>x.id===id);if(t)t.bk=null},
 'availability-remove':(id,b)=>{const day=String(b.dataset.day),existing=(S.availability||{})[day],wins=Array.isArray(existing)?existing:defaultWindows;S.availability=Object.assign({},S.availability||{},{[day]:wins.filter(w=>w.id!==id)});toast('Janela removida')},
 'availability-reset':(id)=>{S.availability=Object.assign({},S.availability||{});delete S.availability[id];toast('Horário padrão restaurado')},
 // Menu, Início & Aparência
 mcol:(id)=>{const c=new Set(S.mcol||[]);if(c.has(id))c.delete(id);else c.add(id);S.mcol=[...c]},
 mreset:()=>{S.menu=null},
 mgmv:(id,b)=>menuEdit(m=>{const i=m.groups.findIndex(g=>g.id===id),j=i+ +b.dataset.n;if(j>=0&&j<m.groups.length)[m.groups[i],m.groups[j]]=[m.groups[j],m.groups[i]]}),
 mimv:(id,b)=>menuEdit(m=>{const g=m.groups.find(x=>x.items.includes(id));if(!g)return;const i=g.items.indexOf(id),j=i+ +b.dataset.n;if(j>=0&&j<g.items.length)[g.items[i],g.items[j]]=[g.items[j],g.items[i]]}),
 mdelg:(id)=>menuEdit(m=>{const g=m.groups.find(x=>x.id===id);if(g&&!g.items.length&&m.groups.length>1)m.groups=m.groups.filter(x=>x.id!==id)}),
 rw:(id)=>{S.rw=id==='0'?0:S.rw+ +id},
 hw:(id)=>{S.hw=+id},
 cust:()=>{S.cust=!S.cust},
 comp:()=>{const L2=cfg(),on=!['spotify','clima'].every(k=>{const x=L2.find(y=>y.id===k);return x&&x.on}),sp=L2.find(x=>x.id==='spotify'),wx=L2.find(x=>x.id==='clima');sp.on=wx.on=on;if(on){const rest=L2.filter(x=>x.id!=='spotify'&&x.id!=='clima'),li=rest.findIndex(x=>x.id==='linha');rest.splice(li>=0?li+1:0,0,sp,wx);S.cards=rest}else S.cards=L2},
 cmv:(id,b)=>{const L2=cfg(),i=L2.findIndex(y=>y.id===id),j=i+ +b.dataset.n;if(j>=0&&j<L2.length)[L2[i],L2[j]]=[L2[j],L2[i]];S.cards=L2},
 cwide:(id)=>{const L2=cfg(),x=L2.find(y=>y.id===id);if(x){x.wide=!isCardWide(x);S.cards=L2}},
 chide:(id)=>{const L2=cfg(),x=L2.find(y=>y.id===id);if(x){x.on=false;S.cards=L2}},
 'dash-preset':(id)=>{const p=DASH_PRESETS[id];if(!p)return;const set=new Set(p.c),rest=Object.keys(CARDS).filter(k=>!set.has(k));S.cards=[...p.c.map(k=>({id:k,on:true})),...rest.map(k=>({id:k,on:false}))]},
 'clear-old-focus':()=>{S.focus=''},
 'dash-done':(id)=>{const t=S.tasks.find(x=>x.id===id);if(!t||taskPaused(t))return 'stop';completeTask(t,true)},
 'rd-ep-inc':(id)=>{const r=(S.reads||[]).find(x=>x.id===id);if(r)readStepEpisode(r,1)},
 'rd-prog-inc':(id)=>{const r=(S.reads||[]).find(x=>x.id===id);if(r){r.p=Math.min(100,(r.p||0)+10);if(r.pages)r.page=Math.round(r.pages*r.p/100);if(r.p>=100){r.st='f';r.df=r.df||T;toast('Concluído: '+esc(r.t))}else toast('Progresso: '+r.p+'%')}},
 'dash-rd-pick':()=>{const q=(S.reads||[]).filter(r=>r.st==='q');if(q.length){RD.picked=q[Math.floor(Math.random()*q.length)].id;S.view='leituras'}},
 pal:(id)=>{S.pal=id;applyTheme()},
 navstyle:(id)=>{S.nav=id;applyTheme()},
 dens:(id)=>{S.dens=id;applyTheme()},
 acc:(id)=>{S.acc=id;applyTheme()},
 // Finanças
 flm:(id)=>{S.flm=id},
 fcn:(id)=>{S.fcn=+id},
 fcv:()=>{S.fcv=S.fcv===false},
 fyo:(id)=>{S.fyo=id},
 fvw:(id)=>{if(id==='ano'&&S.fvw!=='ano')S.fay=S.fac;S.fvw=id;saveUI()},
 ftab:(id)=>{S.ftab=id;S.fvw='mes';saveUI();TXBULKDEL=false;clearTimeout(TXBULKT)},
 sgo:(id,b)=>{S.view=b.dataset.view;if(b.dataset.tab){S.ftab=b.dataset.tab;if(S.view==='financas')S.fvw='mes'}if(b.dataset.fmo!==undefined){S.fmo=+b.dataset.fmo;S.fvw='mes'}if(b.dataset.ddo!==undefined)S.ddo=Math.min(0,+b.dataset.ddo);saveUI();Q='';$('#q').value=''},
 fwm:(id)=>{S.fwm=id},
 fyn:(id,b)=>{S.fyr=b.dataset.n==='0'?0:S.fyr+ +b.dataset.n},
 fday:(id)=>{S.fday=S.fday===id?'':id},
 redit:(id)=>{FRE=id},
 rcancel:()=>{FRE=null},
 rtog:(id)=>{const r=finInit().rules.find(x=>x.id===id);if(r)r.on=r.on===false},
 rmv:(id,b)=>{const L=finInit().rules,i=L.findIndex(x=>x.id===id),j=i+ +b.dataset.n;if(j>=0&&j<L.length)[L[i],L[j]]=[L[j],L[i]]},
 rapplyall:()=>{if(!RARM){RARM=true;toast('Clique de novo para recategorizar todos os lançamentos (sobrescreve categorias)');setTimeout(()=>{if(RARM){RARM=false;if(S.view==='financas'&&S.ftab==='regras')render({save:false})}},6000)}else{RARM=false;toast(applyRules(true)+' lançamentos atualizados')}},
 rcancelall:()=>{RARM=false},
 fpm:(id)=>{S.fpm=id},
 'overview-category':(id)=>{ANALYSIS_CUT='';S.ftab='lanc';S.fcat=id||'';S.fkd=id?'out':'';FQ='';FRECON='';FTAG='';saveUI()},
 'overview-analysis':()=>{S.ftab='analise';saveUI();render({save:false});$('#finance-category-analysis')?.scrollIntoView({block:'start'});return 'stop'},
 'overview-card':(id,b)=>{S.ftab='contas';S.fmo=+b.dataset.o;FLASH='acc:'+id;saveUI()},
 'analysis-cat':(id)=>{ANALYSIS_CAT=ANALYSIS_CAT===id?'':id},
 'analysis-extract':(id,b)=>{
  const cut=b.dataset.cut;
  if(!cut||!id)return 'stop';
  S.ftab='lanc';S.fcat=id;S.fkd='';FQ='';FRECON='';FTAG='';FED=null;
  ANALYSIS_CUT=cut;saveUI();
 },
 fcat:(id)=>{ANALYSIS_CUT='';S.fcat=S.fcat===id?'':id},
 fn:(id)=>{S.fn=+id},
 edtx:(id)=>{FED=id},
 fcancel:()=>{FED=null},
 deltxg:(id)=>{S.fin.tx=S.fin.tx.filter(x=>!(x.pc&&x.pc.g===id))},
 delacc:(id)=>{finInit();if(S.fin.tx.some(x=>accId(x)===id||x.to===id)||S.fin.rec.some(x=>x.ac===id||(!x.ac&&S.fin.acc[0].id===id))||S.fin.bills.some(x=>x.ac===id)||S.fin.rules.some(x=>x.ac===id)||S.fin.acc.length<2)toast('Não é possível excluir a conta: verifique lançamentos, recorrências, lembretes e regras vinculados');else{S.fin.acc=S.fin.acc.filter(x=>x.id!==id);if(S.fac===id)S.fac='';if(S.fin.primary===id)delete S.fin.primary}},
 primaryacc:(id)=>{const x=finInit().acc.find(a=>a.id===id&&a.ty!=='card');if(x)S.fin.primary=x.id},
 'sub-review':(id)=>{const r=S.fin.rec.find(x=>x.id===id);if(r){r.review=!r.review;auditLog(r.review?'reviewStart':'reviewEnd');toast(r.review?'Revisão marcada':'Revisão concluída')}},
 'sub-task':(id)=>{const r=S.fin.rec.find(x=>x.id===id&&x.review);if(r){S.tasks.unshift({id:uid(),t:'Revisar assinatura: '+r.t,done:false,p:'m',due:''});auditLog('reviewTask');toast('Tarefa criada')}},
 delrec:(id)=>{S.fin.rec=S.fin.rec.filter(x=>x.id!==id);S.fin.bills.forEach(bl=>{if(bl.rec===id)delete bl.rec})},
 delrule:(id)=>{S.fin.rules=S.fin.rules.filter(x=>x.id!==id)},
 rulesapply:()=>{toast(applyRules(false)+' lançamentos atualizados')},
 impgo:()=>{
  if(!IMP)return 'stop';
  const F=finInit();let n=0;const R=impRows().rows,selected=new Set(),keys=new Set(),links=[];
  for(const [index,choice] of Object.entries(IMP.review||{})){
   if(!choice.startsWith('tx:'))continue;
   const row=R.find(r=>r.index===+index),tx=row?.matches.find(x=>'tx:'+x.id===choice);
   if(!tx||selected.has(tx.id)||keys.has(row.statementKey)||F.tx.some(x=>x.statementKey===row.statementKey)){
    toast('Confira as associações. Use cada lançamento e cada linha do extrato uma vez.');
    return 'stop';
   }
   selected.add(tx.id);keys.add(row.statementKey);links.push({row,tx});
  }
  for(const {row,tx} of links)tx.statementKey=row.statementKey;
  if(IMP.setIni&&IMP.meta&&Number.isFinite(IMP.meta.ini)){
   const acc=F.acc.find(a=>a.id===IMP.ac);
   if(acc)acc.ini=Math.round(IMP.meta.ini*100)/100;
  }
  const addedRules=[];
  if(IMP.saveRules!==false&&IMP.cats){
   const origByNorm={};R.forEach(r=>{if(r.rawT)origByNorm[norm(r.rawT)]=r.rawT});
   Object.entries(IMP.cats).forEach(([k,cat])=>{
    if(!cat)return;
    const orig=origByNorm[k]||k,cl=cleanDesc(orig),m=(IMP.clean&&cl.length>=5)?cl:orig;
    if(!F.rules.some(x=>x.ty==='out'&&norm(x.m)===norm(m)&&(x.md||'c')==='c')){
     F.rules.push({id:uid(),on:true,m,md:'c',ty:'out',min:'',max:'',ac:'',cat,sub:dictSub(orig,'out',cat)||'',tg:'',pj:''});
     addedRules.push(m);
    }
   });
  }
  const toSave=R.filter(r=>statementImports(r)&&!keys.has(r.statementKey));
  let resAcc=null,genCount=0;
  if(toSave.some(r=>r.resTr)){
   resAcc=F.acc.find(a=>a.id!==IMP.ac&&(a.ty==='inv'||norm(a.n).includes('reserva')));
   if(!resAcc){resAcc={id:uid(),n:'Reserva',ty:'inv',ini:0};F.acc.push(resAcc)}
  }
  toSave.forEach(r=>{
   const tx=r.resTr?{id:uid(),k:'tr',t:r.t,v:r.v,cat:'Transferência',d:r.d,ac:r.resDir==='out'?IMP.ac:resAcc.id,to:r.resDir==='out'?resAcc.id:IMP.ac,imp:1,sub:r.sub,tg:r.tg,pj:r.pj}:{id:uid(),k:r.k,t:r.t,v:r.v,cat:r.cat,d:r.d,ac:IMP.ac,imp:1,sub:r.sub,tg:r.tg,pj:r.pj};
   tx.statementKey=r.statementKey;
   if(r.ref)tx.ref=r.ref;
   if(r.rb){tx.rb=1;tx.rcat=r.rcat||'Outros'}
   if(r.pc){
    const gid=uid();tx.pc={g:gid,i:r.pc.i,n:r.pc.n};
    if(IMP.genInst!==false&&r.pc.rem>0){
     for(let s=1;s<=r.pc.rem;s++){
      const nd=addM(r.d,s),ni=r.pc.i+s;
      if(!F.tx.some(x=>x.k==='out'&&accId(x)===IMP.ac&&x.d===nd&&Math.abs(x.v-r.v)<.005&&(norm(x.t)===norm(r.t)||(x.pc&&x.pc.i===ni&&x.pc.n===r.pc.n)))){
       F.tx.push({id:uid(),k:'out',t:r.t,v:r.v,cat:r.cat,d:nd,ac:IMP.ac,imp:1,sub:r.sub,tg:r.tg,pj:r.pj,pc:{g:gid,i:ni,n:r.pc.n}});
       genCount++;
      }
     }
    }
   }
   F.tx.unshift(tx);n++;
  });
  const acc=F.acc.find(a=>a.id===IMP.ac);
  if(acc&&acc.ty!=='card'&&IMP.meta&&Number.isFinite(IMP.meta.fin)){
   acc.stmtFin=r2(IMP.meta.fin);
   if(IMP.reconcile)acc.ini=r2((+acc.ini||0)+(acc.stmtFin-bal(acc)));
  }
  toast(n+' lançamentos importados'+(genCount?' · +'+genCount+' parcelas futuras':'')+(links.length?' · '+links.length+' associações':'')+(R.length-n-links.length?' · '+(R.length-n-links.length)+' linhas ignoradas':'')+(addedRules.length?' · '+addedRules.length+(addedRules.length===1?' regra criada':' regras criadas'):''));
  IMP=null;
 },
 impcancel:()=>{IMP=null},
 fmn:(id,b)=>{ANALYSIS_CUT='';S.fmo=b.dataset.n==='0'?0:S.fmo+ +b.dataset.n;saveUI();TXBULKDEL=false;clearTimeout(TXBULKT)},
 deltx:(id)=>{const t=S.fin.tx.find(x=>x.id===id);if(t)auditLog('txDelete');if(t&&t.rc){const r=S.fin.rec.find(x=>x.id===t.rc);if(r)(r.skip=r.skip||[]).push(t.id)}S.fin.tx=S.fin.tx.filter(x=>x.id!==id)},
 delbud:(id)=>{setBudget(id,ds(new Date(today.getFullYear(),today.getMonth()+S.fmo,1)).slice(0,7),null)},
 delbill:(id)=>{const bl=S.fin.bills.find(x=>x.id===id);if(bl)S.events=S.events.filter(ev=>ev.id!==bl.eid);S.fin.bills=S.fin.bills.filter(x=>x.id!==id)},
 delgoal:(id)=>{S.fin.goals=S.fin.goals.filter(x=>x.id!==id)},
 // Diário, hábitos & leituras
 mood:(id,b)=>{const d=b.dataset.d,k=b.dataset.k,e=(S.dia[d]=S.dia[d]||{});e[k]=e[k]===+id?0:+id},
 rtmood:(id,b)=>{const mode=b.dataset.mode,k=b.dataset.k;if(['m','n'].includes(mode)&&['m','e'].includes(k)){const e=(S.dia[T]=S.dia[T]||{}),r=(e.routine=e.routine||{}),v=(r[mode]=r[mode]||{});v[k]=v[k]===+id?0:+id}},
 dnav:(id,b)=>{S.ddo=Math.min(0,b.dataset.n==='0'?0:S.ddo+ +b.dataset.n)},
 dgo:(id)=>{S.ddo=Math.round((new Date(id+'T00:00')-new Date(T+'T00:00'))/864e5)},
 delhb:(id)=>{S.habits=S.habits.filter(x=>x.id!==id)},
 rdr:(id,b)=>{const r=S.reads.find(x=>x.id===id);if(r)r.r=r.r===+b.dataset.n?0:+b.dataset.n},
 'rd-tab':(id)=>{if(['collection','shelf'].includes(id)){RD.tab=id;RD.lookup=null}},
 'rd-shelf-kind':(id)=>{if(['all','books','movies','series'].includes(id)){RD.shelfKind=id;RD.selected=''}},
 'rd-shelf-year':(id)=>{RD.shelfYear=RD.shelfYear===id?'':id},
 'rd-shelf-fav':(id)=>{RD.shelfFav=RD.shelfFav===id?'':id},
 'rd-movie-mode':(id)=>{if(['poster','spine'].includes(id))RD.movieMode=id},
 'rd-pick-random':()=>{const fk=RD.tab==='shelf'?({books:'livro',movies:'filme',series:'série'}[RD.shelfKind]||''):(S.rk||'');const pool=(S.reads||[]).filter(r=>r.st==='q'&&(!fk?(RD.tab==='shelf'?isShelfItem(r):true):(fk==='livro'?isBook(r):r.k===fk)));if(!pool.length){toast('Nenhum item na fila "Quero" para sortear');return}const others=pool.length>1?pool.filter(r=>r.id!==RD.picked):pool;RD.picked=others[Math.floor(Math.random()*others.length)].id},
 'rd-pick-close':()=>{RD.picked=''},
 'rd-start':(id)=>{const r=(S.reads||[]).find(x=>x.id===id);if(r){r.st='a';RD.picked='';toast('Movido para Em andamento')}},
 'rd-finish':(id)=>{const r=(S.reads||[]).find(x=>x.id===id);if(r){r.st='f';r.df=r.df||T;r.p=100;if(r.pages)r.page=r.pages;if(r.k==='série'&&r.episodes)r.episode=r.episodes;toast((RK[r.k]||RK.livro)[0]+' concluído!')}},
 'rd-step':(id,b)=>{const r=(S.reads||[]).find(x=>x.id===id);if(!r)return;const d=+b.dataset.d||1;if(isBook(r)&&r.pages&&d>0){r.page=Math.min(r.pages,(r.page||0)+d);r.p=Math.round(r.page/r.pages*100);if(r.page>=r.pages){r.st='f';r.df=r.df||T;toast('Livro concluído!')}}else if(r.k==='série')readStepEpisode(r,d)},
 'rd-note-create':(id)=>{const r=(S.reads||[]).find(x=>x.id===id);if(!r)return;const nid=uid(),kind=(RK[r.k]||RK.livro)[0],qs=(r.quotes||[]).map(q=>`<p><em>“${esc(q.text)}”</em>${q.ref?' <small>('+esc(q.ref)+')</small>':''}</p>`).join(''),body=[r.a?`<p><strong>${isVisualMedia(r)?'Direção':'Autoria'}:</strong> ${esc(r.a)}</p>`:'',r.n?`<p><em>“${esc(r.n)}”</em></p>`:'',qs].filter(Boolean).join('')||'<p></p>';noteReset();S.notes.unshift({id:nid,t:`Notas: ${r.t}`,b:body,f:kind,g:normTags([kind.toLowerCase(),r.tg||''].filter(Boolean).join(', ')),c:COL[S.notes.length%4],updatedAt:Date.now()});lkSet('rd:'+r.id,'nt:'+nid,true);toast('Nota criada e vinculada a "'+esc(r.t)+'"')},
 'rd-open':(id)=>{RD.selected=id;RD.lookup=null},
 'rd-close':()=>{RD.selected='';RD.lookup=null},
 'rd-edit':(id)=>{lkGo('rd:'+id)},
 'rd-cover-remove':(id)=>{const r=(S.reads||[]).find(x=>x.id===id);if(r){delete r.cover;delete r.coverUrl;delete r.coverColor;RD.lookup=null;toast('Capa removida')}},
 'rd-fav':(id)=>{RD.fav=RD.fav===id?'':id},
 'rd-tag':(id)=>{RD.tag=RD.tag===id?'':id},
 'rd-yr':(id)=>{if(id==='all')RD.yr='all';else if(id==='0')RD.yr=0;else RD.yr=Math.min(0,(typeof RD.yr==='number'?RD.yr:0)+ +id)},
 'rd-reread':(id)=>{const r=(S.reads||[]).find(x=>x.id===id);if(r){r.rereads=(r.rereads||0)+1;toast((isVisualMedia(r)?'Reassistido ':'Relido ')+r.rereads+'×')}},
 'rd-plan-today':(id)=>{const r=(S.reads||[]).find(x=>x.id===id);if(!r)return;const pref=isVisualMedia(r)?'Assistir: ':r.k==='podcast'?'Ouvir: ':'Ler: ',title=pref+r.t;let tk=S.tasks.find(t=>!t.done&&!taskPaused(t)&&(t.t===title||lkOf('rd:'+r.id).includes('tk:'+t.id)));if(tk)tk.hd=T;else{const nid=uid();S.tasks.unshift({id:nid,t:title,done:false,p:'m',due:'',hd:T,dur:30});lkSet('rd:'+r.id,'tk:'+nid,true)}toast('Sessão planejada para hoje')},
 'rd-quote-del':(id,b)=>{const r=(S.reads||[]).find(x=>x.id===id);if(r&&Array.isArray(r.quotes))r.quotes=r.quotes.filter(q=>q.id!==b.dataset.q)},
 delrd:(id)=>{S.reads=S.reads.filter(x=>x.id!==id)},
 rfk:(id)=>{S.rk=id},
 rfs:(id)=>{S.rs=id},
 dvw:(id)=>{S.dvw=id},
 dyn:(id,b)=>{S.dyr=b.dataset.n==='0'?0:Math.min(0,(S.dyr||0)+ +b.dataset.n)},
 // Rotina
 rtn:(id)=>{const steps=rtSteps(RT.mode),pos=steps.indexOf(RT.i);rtStep(RT.mode,steps[Math.max(0,Math.min(steps.length-1,pos+ +id))])},
 rtm:(id)=>{rtOpen(id)},
 rtgo:(id)=>{rtOpen(id);S.view='rotina';Q='';$('#q').value=''},
 rtrestart:()=>{rtStep(RT.mode,rtSteps(RT.mode)[0]);toast('Rotina reiniciada; seus registros foram mantidos')},
 rtd:()=>{S.rot=Object.assign({},S.rot);S.rot[T]=Object.assign({},S.rot[T],{[RT.mode]:1});rtStep(RT.mode,rtSteps(RT.mode)[0]);S.view='dash';toast(RT.mode==='m'?'Bom dia! Rotina concluída.':'Boa noite! Rotina concluída.')},
 rtplan:(id)=>{const t=S.tasks.find(x=>x.id===id);if(t&&!t.done){t.hd=ds(add(today,1));toast('Planejada para amanhã; prazo mantido')}},
 rtdeadline:(id)=>{const t=S.tasks.find(x=>x.id===id);if(t&&!t.done){t.due=ds(add(today,1));toast('Prazo alterado para amanhã')}},
 rtmove:()=>{const tm=ds(add(today,1));S.tasks.forEach(t=>{if(!t.done&&!taskPaused(t)&&(t.hd===T||(t.due&&t.due<=T)))t.hd=tm});toast('Pendências planejadas para amanhã; prazos mantidos')},
 rtadd:()=>{const i=$('#rtnew'),v=i&&i.value.trim();if(v){S.tasks.unshift({id:uid(),t:v,done:false,p:'m',due:'',hd:ds(add(today,1))});if(S.rot[T])S.rot[T].draft='';toast('Tarefa planejada para amanhã')}},
 // Lixeira, PWA & avisos
 trres:(id)=>{trashRestore(id)},
 trdel:(id)=>{S.trash=S.trash.filter(x=>x.b!==id);toast('Excluído de vez')},
 trall:()=>{S.trash=[];toast('Lixeira esvaziada')},
 rperm:()=>{try{Notification.requestPermission().then(()=>render())}catch(e){toast('Este navegador não permite notificações')}return 'stop'},
 pwainst:()=>{pwaInstall();return 'stop'},
 rtest:()=>{notify('Aviso de teste','Os lembretes estão funcionando.')},
 idbsnaps:()=>{restoreIdbSnaps();return 'stop'},
 'dia-archive':(id)=>{if(diaArchiveYear(+id))toast('Diário de '+id+' arquivado.')},
 'dia-unarchive':(id)=>{diaUnarchiveYear(+id);return 'stop'}
};
document.addEventListener('click',e=>{
 const nv=e.target.closest('[data-v]');
 if(nv){if($('#mobile-menu').open)$('#mobile-menu').close();FED=null;S.view=nv.dataset.v;Q='';ED=null;$('#q').value='';saveUI();render({save:false});return}
 if(e.target.closest('#theme')){S.themeMode=isDark()?'light':'dark';applyTheme();save();document.querySelectorAll('[data-theme-choice]').forEach(b=>{const on=b.dataset.themeChoice===S.themeMode;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});return}
 const theme=e.target.closest('[data-theme-choice]');if(theme){S.themeMode=theme.dataset.themeChoice;applyTheme();render();return}
 const b=e.target.closest('[data-a]');if(!b)return;
 const a=b.dataset.a,id=b.dataset.id;
 if(PAUSE_GUARD.has(a)&&taskPaused(S.tasks.find(t=>t.id===id))){toast('Restaure a tarefa ou a meta antes de continuar.');return}
 const early=CLICK_EARLY[a];if(early){early(b,id,e,a);return}
 if(b.tagName==='A'||b.type==='checkbox')return;
 e.preventDefault();
 const TB=trashSnap();
 if(TRASH_SNAP.has(a))snap(a);
 const fn=CLICK_ACTIONS[a];
 if(fn){if(fn(id,b,e)==='stop')return}
 else if(!finActE(a,id,b))return;
 trashFlush(TB);
 if(FULL_RENDER_ACTIONS.has(a))render();else renderKeepDraft();
 if(a==='focus-enter'||a==='focus-exit'||a==='focus-done'){
  $('#focus-title, #today-title')?.focus();
 }
 if(a==='rd-open'){const detail=document.querySelector('#book-detail');if(detail){detail.scrollIntoView({block:'nearest',behavior:SMOOTH()});detail.focus({preventScroll:true})}}
 if(a==='ed'||(a==='edtx'&&!$('[data-tx-detail]'))){window.scrollTo(0,0);const i=document.querySelector('form.bar input');if(i)i.focus()}
 if(a==='edrec'||a==='edbill'){const f=document.querySelector(a==='edrec'?'#frec':'#fbill');if(f){f.scrollIntoView({block:'nearest'});const i=f.querySelector('input');if(i)i.focus()}}
});
function validBackup(d){
 const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),list=x=>Array.isArray(x)&&x.every(obj),optional=(o,k,test)=>o[k]===undefined||test(o[k]),str=x=>typeof x==='string',date=x=>str(x)&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(new Date(x+'T12:00').getTime())&&ds(new Date(x+'T12:00'))===x;
 if(!obj(d)||!list(d.tasks)||!list(d.events))return false;
 if(d.tasks.some(x=>!optional(x,'seriesId',str)||!optional(x,'archived',v=>typeof v==='boolean')||!optional(x,'t',str)||!optional(x,'due',str)||!optional(x,'hd',str)||!optional(x,'dd',str)||!optional(x,'sub',list)))return false;
 if(d.events.some(x=>!str(x.t)||!date(x.d)||!str(x.h)))return false;
 for(const k of ['notes','links','habits','metas','projects','history','inbox','reads','trash','lnk','sp'])if(!optional(d,k,list))return false;
 for(const k of ['fin','dia','fm','rev','revm','fpj','rem','rot','rotPrefs','revprefs'])if(!optional(d,k,obj))return false;
 if(!optional(d,'availability',x=>obj(x)&&Object.entries(x).every(([k,ws])=>/^[0-6]$/.test(k)&&list(ws)&&ws.every(w=>str(w.id)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(w.start)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(w.end)&&w.start<w.end))))return false;
 if(!optional(d,'menu',x=>x===null||obj(x)))return false;
 if(!optional(d,'cards',x=>x===null||list(x)))return false;
 if(d.cards&&d.cards.some(x=>!str(x.id)||!optional(x,'wide',v=>typeof v==='boolean')))return false;
 if(d.menu&&(!optional(d.menu,'groups',list)||!optional(d.menu,'bar',Array.isArray)||!optional(d.menu,'hidden',Array.isArray)||(d.menu.groups&&d.menu.groups.some(g=>!Array.isArray(g.items)))))return false;
 if(d.dia&&Object.values(d.dia).some(x=>!obj(x)))return false;
 for(const k of ['focus','profileName','themeMode','pal','acc','frase','nav','dens','spsel'])if(!optional(d,k,x=>typeof x==='string'))return false;
 if(!optional(d,'frasen',x=>typeof x==='number'&&Number.isFinite(x)))return false;
 if(!optional(d,'cap',x=>typeof x==='number'&&Number.isFinite(x)&&x>=1&&x<=16))return false;
 if(!optional(d,'wx',x=>x===null||obj(x)))return false;
 if(!optional(d,'keys',x=>typeof x==='boolean')||!optional(d,'hc',x=>typeof x==='boolean'))return false;
 if(!optional(d,'rmo',x=>x==='auto'||x==='on'))return false;
 if(d.notes&&d.notes.some(n=>{if(!optional(n,'updatedAt',x=>Number.isFinite(x)&&!Number.isNaN(new Date(x).getTime()))||!optional(n,'archived',x=>typeof x==='boolean')||!optional(n,'revisit',x=>typeof x==='boolean')||!optional(n,'reviewDate',x=>x===''||date(x))||!optional(n,'t',x=>typeof x==='string')||!optional(n,'b',x=>typeof x==='string')||!optional(n,'g',x=>typeof x==='string')||!optional(n,'budget',v=>typeof v==='number'&&Number.isFinite(v)&&v>=0))return true;return n.kind==='shopping'&&(!list(n.items)||n.items.some(x=>typeof x.id!=='string'||typeof x.t!=='string'||!optional(x,'q',v=>typeof v==='string')||typeof x.done!=='boolean'||!optional(x,'qty',v=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=10000000))||!optional(x,'unit',v=>typeof v==='string')||!['estimatedCents','actualCents'].every(k=>optional(x,k,v=>v===null||(Number.isSafeInteger(v)&&v>=0&&v<=1000000000))))) }))return false;
 if(d.inbox&&d.inbox.some(x=>typeof x.id!=='string'||typeof x.t!=='string'))return false;
 if(d.habits&&d.habits.some(x=>!obj(x.log)||!optional(x,'perWeek',v=>Number.isInteger(v)&&v>=1&&v<=7)))return false;
 if(d.history&&d.history.some(x=>!str(x.id)||!x.id||!Object.hasOwn(AUDIT_LABELS,x.type)||!Number.isFinite(x.at)||Math.abs(x.at)>8640000000000000))return false;
 if(d.projects&&d.projects.some(p=>!str(p.id)||!str(p.t)||!['active','done'].includes(p.status)||!optional(p,'archived',v=>typeof v==='boolean')||!optional(p,'budget',v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)||!optional(p,'nextTask',str)||!optional(p,'start',v=>v===''||date(v))||!optional(p,'end',v=>v===''||date(v))||!list(p.refs)||p.refs.some(r=>!str(r.id)||!/^(tk|mt|nt|tx):[^:]+$/.test(r.id))))return false;
 if(d.metas&&d.metas.some(x=>!Array.isArray(x.kr)||!optional(x,'archived',v=>typeof v==='boolean')||!optional(x,'reviewDate',v=>v===''||date(v))||!optional(x,'pausedTaskIds',v=>Array.isArray(v)&&v.every(str))))return false;
 if(d.reads&&d.reads.some(r=>!optional(r,'st',x=>['q','a','f','p'].includes(x))||!optional(r,'cover',x=>Number.isSafeInteger(x)&&x>0)||!optional(r,'coverUrl',x=>typeof x==='string'&&(x===''||/^https:\/\/[^\s"'<>]+$/i.test(x)))||!optional(r,'coverColor',x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x))||!optional(r,'pages',x=>Number.isInteger(x)&&x>=0)||!optional(r,'page',x=>Number.isInteger(x)&&x>=0)||!optional(r,'year',x=>Number.isInteger(x)&&x>=1800&&x<=2100)||!optional(r,'mins',x=>Number.isInteger(x)&&x>=1&&x<=10000)||!optional(r,'season',x=>Number.isInteger(x)&&x>=1&&x<=999)||!optional(r,'episode',x=>Number.isInteger(x)&&x>=0&&x<=9999)||!optional(r,'episodes',x=>Number.isInteger(x)&&x>=1&&x<=9999)||!optional(r,'rereads',x=>Number.isInteger(x)&&x>=0&&x<=1000)||!optional(r,'tg',str)||!optional(r,'quotes',x=>list(x)&&x.every(q=>str(q.id)&&str(q.text)&&optional(q,'ref',str)))||!optional(r,'df',x=>x===''||date(x))))return false;
 if(d.fin){if(!optional(d.fin,'primary',str)||!optional(d.fin,'inv',obj)||!optional(d.fin,'recDismiss',x=>Array.isArray(x)&&x.every(str)))return false;for(const k of ['tx','acc','rec','rules','goals','prules','split','bills'])if(d.fin[k]!=null&&!list(d.fin[k]))return false;if(d.fin.bud!=null&&!obj(d.fin.bud))return false;if(d.fin.budHist!=null&&(!obj(d.fin.budHist)||Object.values(d.fin.budHist).some(c=>!obj(c)||Object.entries(c).some(([m,v])=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)||(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<=0))))))return false;if(d.fin.tx&&d.fin.tx.some(x=>!optional(x,'shoppingReviewed',str)||!optional(x,'rb',v=>v===1||typeof v==='boolean')||!optional(x,'rcat',str)||!optional(x,'ref',str)||!date(x.d)||x.v===null||x.v===''||!Number.isFinite(+x.v)))return false}
 return true}
document.addEventListener('change',e=>{
 if(e.target.id==='profile-name'){S.profileName=e.target.value.trim().slice(0,60);render();return}
 if(e.target.dataset.rtPref){const [mode,n]=e.target.dataset.rtPref.split(':'),i=+n;if(['m','n'].includes(mode)&&Number.isInteger(i)&&i>=0&&i<4){S.rotPrefs=S.rotPrefs||{};S.rotPrefs[mode]=Object.assign({},S.rotPrefs[mode],{[i]:e.target.checked});const steps=rtSteps(mode);if(!steps.includes(RT.i))rtStep(mode,steps[0]);render();const d=document.querySelector('#rt-prefs');if(d)d.open=true}return}
 if(e.target.id==='note-type'||e.target.id==='note-status'){if(e.target.id==='note-type')NTYPE=e.target.value;else NSTATUS=e.target.value;PG.nt=30;renderKeepDraft();return}
 if(e.target.dataset.goalReview){const g=S.metas.find(x=>x.id===e.target.dataset.goalReview&&!x.archived);if(g){g.reviewDate=e.target.value;render()}return}
 if(e.target.dataset.noteReview){const n=S.notes.find(x=>x.id===e.target.dataset.noteReview&&!x.archived);if(n){n.reviewDate=e.target.value;if(n.reviewDate)n.revisit=true;noteTouch(n);renderKeepDraft()}return}
 if(e.target.dataset.noteColor){const n=S.notes.find(x=>x.id===e.target.dataset.noteColor),c=e.target.value,card=e.target.closest('.note');if(n&&card&&NOTE_COLORS.some(x=>x[0]===c)){n.c=c;noteTouch(n);card.classList.remove(...NOTE_COLORS.map(x=>'c-'+x[0]));card.classList.add('c-'+c);save()}return}
 if(e.target.name==='t'&&e.target.form&&e.target.form.dataset.shoppingForm){const f=e.target.form,h=shoppingPriceHistory(e.target.value);if(h&&h.priceCents!=null&&f.elements.estimated&&!f.elements.estimated.value){f.elements.estimated.value=(h.priceCents/100).toFixed(2).replace('.',',');if(f.elements.qty&&!f.elements.qty.value&&h.qty!=null)f.elements.qty.value=String(h.qty);if(f.elements.unit&&!f.elements.unit.value&&h.unit)f.elements.unit.value=h.unit;NOTE_DRAFTS[noteDraftKey(f)]=Object.assign(NOTE_DRAFTS[noteDraftKey(f)]||{},{estimated:f.elements.estimated.value,qty:f.elements.qty?.value||'',unit:f.elements.unit?.value||''});}return}
 if(e.target.dataset.shoppingBudget){const n=S.notes.find(x=>x.id===e.target.dataset.shoppingBudget&&x.kind==='shopping'),v=e.target.value.trim(),amount=num(v);if(n){if(!v)delete n.budget;else if(Number.isFinite(amount)&&amount>=0)n.budget=Math.round(amount*100)/100;else{toast('Informe uma estimativa válida');return}noteTouch(n);renderKeepDraft()}return}
 if(e.target.dataset.shoppingCheck){const n=S.notes.find(x=>x.id===e.target.dataset.shoppingCheck&&x.kind==='shopping'),item=n&&n.items.find(x=>x.id===e.target.dataset.id);if(item){item.done=e.target.checked;noteTouch(n)}renderKeepDraft();return}
 if(e.target.dataset.revshow){S.revprefs=Object.assign({},S.revprefs||{},{[e.target.dataset.revshow]:e.target.checked});render();return}
 if(e.target.id==='bkcheck'){
  const f=e.target.files[0],r=new FileReader(),owner=SY.uid;
  if(!f)return;
  const report=(result,message)=>{
   if(owner!==SY.uid)return;
   SY.backupCheck={at:Date.now(),result};
   saveSY();
   const status=$('[data-backup-check]'),m=$('#bkmsg');
   if(status)status.textContent=backupCheckStatus();
   if(m)m.textContent=message;
  };
  r.onload=()=>{
   try{
    const j=JSON.parse(r.result),d=j.data||j;
    if(!validBackup(d))throw Error('backup');
    report('Estrutura compatível','Arquivo compatível: '+d.tasks.length+' tarefas, '+(d.notes||[]).length+' notas, '+(d.metas||[]).length+' metas e '+(d.projects||[]).length+' projetos. Apenas a estrutura foi conferida. A recuperação depende de um teste de restauração.');
   }catch(x){report('Arquivo incompatível','Arquivo inválido ou incompatível. Nenhum dado foi alterado.')}
  };
  r.onerror=()=>report('Falha na leitura','Não foi possível ler o arquivo. Nenhum dado foi alterado.');
  r.readAsText(f);e.target.value='';return;
 }
 if(e.target.id==='bkmerge'){if(LOCAL_CORRUPT){const m=$('#bkmsg');if(m)m.textContent='Restaure um arquivo ou traga os dados da nuvem antes de mesclar.';e.target.value='';return}const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{let msg;try{const j=JSON.parse(r.result),d=j.data||j;if(!validBackup(d))throw 0;const previous=JSON.stringify(S),wasCorrupt=LOCAL_CORRUPT;if(!snapPut('Antes de importar mesclando')){const m=$('#bkmsg');if(m)m.textContent='Não foi possível guardar a versão atual. Exporte um backup e libere espaço.';return}const inc={};SK.forEach(k=>{if(k in d)inc[k]=d[k]});if(Array.isArray(inc.links))inc.links=inc.links.filter(l=>l&&safeUrl(l.u)!=='#');applyState(merge3(undefined,pick(),inc));S.seeded=true;if(!save()){S=JSON.parse(previous);LOCAL_CORRUPT=wasCorrupt;applyTheme();applyA11y();undoReset();render();const m=$('#bkmsg');if(m)m.textContent='Não foi possível salvar a importação. Os dados anteriores foram mantidos.';return}render();msg='Backup mesclado com os dados deste aparelho. A versão anterior foi guardada em Versões automáticas.'}catch(x){msg='Arquivo inválido. Escolha um backup gerado por este painel.'}const m=$('#bkmsg');if(m)m.textContent=msg};r.readAsText(f);e.target.value='';return}
 if(e.target.id==='bkfile'){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
   let msg;
   try{
    const j=JSON.parse(r.result),d=j.data||j;if(!validBackup(d))throw 0;
    const previous=JSON.stringify(S),wasCorrupt=LOCAL_CORRUPT;
    if(!LOCAL_CORRUPT&&!snapPut('Antes de restaurar um arquivo')){const m=$('#bkmsg');if(m)m.textContent='Não foi possível guardar a versão atual. Exporte um backup e libere espaço.';return}
    const def=DEF_STATE(),prevHistory=Array.isArray(S.history)?S.history:[];
    SK.forEach(k=>{
     const val=d[k];
     if(val===undefined)S[k]=def[k];
     else if(val===null)S[k]=(k==='cards'||k==='menu'||k==='wx')?null:def[k];
     else S[k]=val;
    });
    ['events','notes','tasks','links','inbox','habits','metas','projects','trash','lnk','reads','sp'].forEach(k=>{if(!Array.isArray(S[k]))S[k]=[]});
    S.links=S.links.filter(l=>l&&safeUrl(l.u)!=='#');
    ['dia','fm','rev','revm','fpj','rem','rot','rotPrefs','revprefs','availability'].forEach(k=>{if(!S[k]||typeof S[k]!=='object'||Array.isArray(S[k]))S[k]={}});
    if(!S.fin||typeof S.fin!=='object'||Array.isArray(S.fin))S.fin=def.fin;
    finInit();
    S.seeded=true;S.onb=!!d.onb;
    S.history=auditClean([...prevHistory,...(Array.isArray(d.history)?d.history:[])]);
    auditLog('backupRestore');
    applyTheme();applyA11y();LOCAL_CORRUPT=false;
    if(!save()){S=JSON.parse(previous);LOCAL_CORRUPT=wasCorrupt;applyTheme();applyA11y();undoReset();render();const m=$('#bkmsg');if(m)m.textContent='Não foi possível salvar a restauração. Os dados anteriores foram mantidos.';return}
    render();msg='Backup restaurado.'+(wasCorrupt?'':' A versão anterior foi guardada em Versões automáticas.');
   }catch(x){msg='Arquivo inválido. Escolha um backup gerado por este painel.'}
   const m=$('#bkmsg');if(m)m.textContent=msg;
  };
  r.readAsText(f);return;
 }
 if(e.target.dataset.reviewStep){
  const {wk,reviewStep}=e.target.dataset;
  (S.rev[wk]=S.rev[wk]||{})['step_'+reviewStep]=e.target.checked;
  renderKeepDraft();
  return;
 }
 const cg=e.target.closest('[data-a="ctog"]');if(cg){const L2=cfg();L2.find(y=>y.id===cg.dataset.id).on=cg.checked;S.cards=L2;render();return}
 const c=e.target.closest('[data-a="tog"]');
 if(c){const t=S.tasks.find(x=>x.id===c.dataset.id);if(!t||taskPaused(t)){toast('Restaure a tarefa ou a meta antes de concluí-la.');renderKeepDraft();return}completeTask(t,c.checked);renderKeepDraft()}
});
document.addEventListener('paste',e=>{
 const ed=e.target.closest&&e.target.closest('.rt[contenteditable="true"]');
 if(!ed||!e.clipboardData)return;
 e.preventDefault();
 const html=e.clipboardData.getData('text/html'),txt=e.clipboardData.getData('text/plain');
 const cleaned=html?clean(html):'';
 const safe=cleaned||esc(txt).replace(/\r?\n/g,'<br>');
 if(!document.execCommand('insertHTML',false,safe)){
  const s=getSelection();
  if(s&&s.rangeCount&&ed.contains(s.anchorNode)){
   const r=s.getRangeAt(0);r.deleteContents();
   r.insertNode(r.createContextualFragment(safe));r.collapse(false);
  }
 }
 ed.dispatchEvent(new Event('input',{bubbles:true}));
});
document.addEventListener('input',e=>{
 const t=e.target;
 if(t.form){const k=noteDraftKey(t.form);if(k&&t.name)(NOTE_DRAFTS[k]=NOTE_DRAFTS[k]||{})[t.name]=t.value}
 if(t.id==='note-search'){const pos=t.selectionStart;NQ=t.value;PG.nt=30;renderKeepDraft({save:false});const i=$('#note-search');if(i)i.setSelectionRange(pos,pos);return}
 if(t.dataset.rm){const k=t.dataset.mo;(S.revm[k]=S.revm[k]||{})[t.dataset.rm]=t.value;save();return}
 if(t.dataset.dk){const d=t.dataset.dd;(S.dia[d]=S.dia[d]||{})[t.dataset.dk]=t.value;save();return}
 if(t.dataset.rv){const w=t.dataset.wk;(S.rev[w]=S.rev[w]||{})[t.dataset.rv]=t.value;save();return}
 if(t.id==='acc'){S.acc=t.value;applyTheme();save();return}
 if(t.dataset.rdf){const r=(S.reads||[]).find(x=>x.id===t.dataset.id);if(r){r[t.dataset.rdf]=t.value;save()}return}
 if(t.dataset.rdp){const r=(S.reads||[]).find(x=>x.id===t.dataset.rdp);if(r){r.p=+t.value;if(r.pages)r.page=Math.round(r.pages*r.p/100);if(t.previousElementSibling)t.previousElementSibling.textContent=t.value+'%';save()}return}
 if(t.id==='rd-search'){const pos=t.selectionStart;RD.q=t.value;renderKeepDraft({save:false});const i=$('#rd-search');if(i)i.setSelectionRange(pos,pos);return}
 if(t.id==='fo'){(S.dia[T]=S.dia[T]||{}).focus=t.value;save();return}
 if(t.id==='rtnew'){(S.rot[T]=S.rot[T]||{}).draft=t.value;save();return}
 if(t.id==='archive-search'){const pos=t.selectionStart;archiveQuery=t.value;render({save:false});const i=$('#archive-search');if(i){i.focus();i.setSelectionRange(pos,pos)}return}
 if(t.id==='q'){Q=t.value.trim();render({save:false});return}
 if(t.dataset.n){const n=S.notes.find(x=>x.id===t.dataset.n);if(!n)return;n[t.dataset.f]=t.isContentEditable?clean(t.innerHTML):t.value;noteTouch(n);save();if(/^[fg]$/.test(t.dataset.f)){const el=$('#nfil');if(el)el.innerHTML=nFilters()}}
});
function submitProjectForm(f,v){
 const name=(v.t||'').trim(),start=v.start||'',end=v.end||'',rawBud=String(v.budget||'').trim();
 let bud=null;
 if(rawBud){const bv=num(rawBud);if(!Number.isFinite(bv)||bv<0){toast('Informe um orçamento válido');return 'stop'}bud=Math.round(bv*100)/100}
 const existing=f.dataset.projectEdit&&(S.projects||[]).find(x=>x.id===f.dataset.projectEdit&&!x.archived);
 if(!name||name.length>120||!projectDate(start)||!projectDate(end)||(start&&end&&end<start)||(f.dataset.projectEdit&&(!existing||!['active','done'].includes(v.status)))){
  toast('Confira nome, situação e datas do projeto.');return 'stop';
 }
 if(existing){Object.assign(existing,{t:name,status:v.status,start,end});if(bud!==null)existing.budget=bud;else delete existing.budget}
 else(S.projects||(S.projects=[])).unshift({id:uid()+uid(),t:name,status:'active',start,end,archived:false,refs:[],...(bud!==null?{budget:bud}:{})});
 toast(existing?'Projeto atualizado':'Projeto criado');
}
function submitQa(f,v){
 if(QT==='ib'){const t=v.t.trim();if(t){(S.inbox||(S.inbox=[])).unshift({id:uid(),t});qaClose();toast('Guardado na caixa de entrada')}return}
 if(QT==='dp'||QT==='rc'){
  const shoppingItems=QSHOP?shoppingSessionItems(f):null;
  if(QSHOP&&!shoppingItems){toast('A lista mudou. Abra novamente para conferir os itens.');return 'stop'}
  if(QSHOP&&shoppingSessionUpdate(f,false)&&!f.elements.shoppingRepeatConfirmed.checked){toast('Confira o aviso e confirme se é uma compra diferente ou associe a despesa existente.');return 'stop'}
  if(QSHOPSESSION&&finInit().tx.some(x=>x.id===QSHOPSESSION)){toast('Esta compra já foi registrada.');qaClose();return 'stop'}
  const p=parseFinNL(v.t,v.v,!v.d||v.d===T),n0=finInit().tx.length;
  finSubmit({k:QT==='dp'?'out':'in',t:p.t,v:p.v,cat:QT==='dp'?(v.cat||''):'',d:p.d||v.d||T,ac:v.ac||'',tg:p.tg||'',pc:1});
  if(finInit().tx.length>n0){
   if(QSHOP)Object.assign(finInit().tx[0],{id:QSHOPSESSION,shopping:QSHOP,shoppingItems:shoppingItems.map(x=>x.id)});
   if(QI)S.inbox=(S.inbox||[]).filter(x=>x.id!==QI);
   qaClose();
  }
  return;
 }
 if(QT==='tk'&&v.dest==='scheduled'&&!v.planned){toast('Escolha a data planejada');return 'stop'}
 const t=v.t.trim();let msg={tk:'Tarefa adicionada',nt:'Nota criada',ev:'Evento adicionado'}[QT];
 if(QT==='tk'){
  const n=parseNL(t,{time:false}),dd=v.due||n.d||'';
  S.tasks.unshift({id:uid(),t:n.t,done:false,p:'m',due:dd,hd:v.dest==='today'?T:v.dest==='scheduled'?v.planned||'':''});
  if(!v.due&&n.d)msg+=' para '+fmt(n.d);
 }else if(QT==='nt'){
  const folder=S.nf||'';noteReset();S.notes.unshift({id:uid(),t,b:'',f:folder,g:'',c:COL[S.notes.length%4],updatedAt:Date.now()});
 }else{
  const n=parseNL(t),def=v.d===T&&v.h==='09:00',dd=def&&n.d?n.d:v.d,hh=def&&n.h?n.h:v.h;
  S.events.push({id:uid(),t:n.t,d:dd,h:hh,c:COL[S.events.length%4]});
  if(def&&(n.d||n.h))msg+=': '+fmt(dd)+' às '+hh;
 }
 if(QI)S.inbox=(S.inbox||[]).filter(x=>x.id!==QI);
 qaClose();toast(msg);
}
const SUBMIT_EARLY={
 'profile-create':(f)=>{try{profileCreate(f.elements.name.value);render();toast('Perfil salvo neste navegador')}catch(err){toast(esc(err.message||'Não foi possível salvar o perfil'))}},
 'export-selective':(f)=>{
  const status=f.parentElement.querySelector('[data-export-status]');
  if(LOCAL_CORRUPT){status.textContent='Recupere os dados antes de exportar.';return}
  const areas=[...f.querySelectorAll('[name=area]:checked')].map(x=>x.value).filter(x=>Object.hasOwn(SELECT_AREAS,x));
  if(!areas.length){status.textContent='Selecione ao menos uma área.';return}
  siteSave('meu-hub-selecao-'+stamp()+'.json',selectJSON(areas));
  status.textContent='Áreas exportadas: '+areas.map(x=>SELECT_AREAS[x]).join(', ')+'.';
 },
 'export-table':(f)=>{
  const status=f.parentElement.querySelector('[data-export-status]');
  if(LOCAL_CORRUPT){status.textContent='Recupere os dados antes de exportar.';return}
  const area=f.elements.area.value,csv=selectCSV(area);
  if(csv===null){status.textContent='Escolha uma tabela válida.';return}
  siteSave('meu-hub-'+area+'-'+stamp()+'.csv',csv,'text/csv;charset=utf-8');
  status.textContent='Tabela exportada.';
 },
 'purchase-simulator':(f)=>{
  const v=Object.fromEntries(new FormData(f)),out=f.parentElement.querySelector('[data-simulation-result]');
  try{
   const raw=String(v.amount||'').trim().replace(',','.');
   if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw Error('valor');
   const amount=Math.round(Number(raw)*100),args=[S.fin,v.account,v.date,amount];
   const choice=simulatePurchase(...args,Number(v.parts),Number(v.rate),T,v.card||'');
   const cash=simulatePurchase(...args,1,0,T,'',choice.end);
   const summary=(title,r,card)=>`<section class="panel"><h3>${title}</h3>
   <p>Total da compra: ${BRL(r.total/100)}. Saldo final com compra: ${BRL(r.scenario/100)}. Menor saldo diário: ${BRL(r.minScenario/100)}. Impacto da compra no saldo final: ${BRL((r.scenario-r.base)/100)}.</p>
   ${card?`<details><summary>Parcelas</summary>${r.schedule.map(x=>`<p>${BRL(x.value/100)} vence ${fmt(x.d)} ${x.d.slice(0,4)} (fecha ${fmt(x.closing)})</p>`).join('')}</details>`:''}
   ${simulationBudget(v.category,r.schedule)}</section>`;
   out.innerHTML=`<p>Período: ${fmt(T)} a ${fmt(choice.end)} ${choice.end.slice(0,4)}. Base: saldo final ${BRL(choice.base/100)} e menor saldo diário ${BRL(choice.minBase/100)}.</p>
   ${v.card?'<p>Cartão sem conta de pagamento vinculada: usando a conta escolhida apenas nesta simulação.</p>':''}
   <div class="cards">${summary('À vista em conta',cash,false)}${summary(v.card?'Opção no cartão':'Opção configurada',choice,v.card)}</div>`;
  }catch(err){out.textContent='Confira conta, valor, data, parcelas e juros.'}
 },
 'fcsvpaste':(f)=>{if(prepCSV(f.elements.csv.value,'Extrato colado'))render()},
 'bulk-plan':(f)=>{f.querySelector('[data-a$="-preview"]').click()},
 'bulk-due':(f)=>{f.querySelector('[data-a$="-preview"]').click()}
};
const SUBMIT_BY_ID={
 'day-replan':(f)=>{
  const choices=new FormData(f);
  for(const t of replanTasks()){
   const action=choices.get(t.id);
   if(action!=='tomorrow'&&action!=='remove')continue;
   if(action==='tomorrow')t.hd=ds(add(today,1));
   else if(t.hd===T)t.hd='';
   if(t.bk?.d===T)delete t.bk;
  }
  toast('Plano atualizado');
 },
 'availability-form':(f,v)=>{
  const day=String(v.day),start=v.start,end=v.end,all=S.availability||{},current=Array.isArray(all[day])?all[day]:[];
  const valid=/^[0-6]$/.test(day)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end)&&start<end&&!current.some(w=>start<w.end&&w.start<end);
  if(!valid){toast('Confira os horários: o fim deve ser posterior ao início e as janelas não podem se sobrepor.');return 'stop'}
  S.availability=Object.assign({},all,{[day]:[...current,{id:uid(),start,end}]});toast('Janela adicionada');
 },
 'task-template':(f,v)=>{
  const tpl=TASK_TEMPLATES.find(t=>t.id===v.template);if(!tpl)return 'stop';
  S.tasks.unshift({id:uid(),t:tpl.title,done:false,p:'m',due:v.date||(['1','7','30'].includes(v.offset)?ds(add(today,+v.offset)):''),sub:tpl.items.map(t=>({id:uid(),t,done:false}))});
  toast('Tarefa criada a partir do modelo');
 },
 'project-create':submitProjectForm,
 ffin:(f,v)=>finSubmit(v),
 ftxbulk:(f,v)=>{if(v.cat==='Reserva'){reviewReserveBatch(f,v);return 'stop'}return txBulkApply(v)},
 facc:(f,v)=>{const F=finInit();F.acc.push({id:uid(),n:v.n.trim(),ty:v.ty,ini:num(v.ini)||0,lim:+v.lim||0,close:+v.close||0,due:+v.due||0});toast('Conta adicionada')},
 frec:(f,v)=>{
  if(v.reminder&&v.k!=='out'){toast('O lembrete integrado está disponível para despesas');return 'stop'}
  const F=finInit(),x=num(v.v),day=Math.min(31,Math.max(1,+v.day||1));
  if(x>0){
   const er=RED?F.rec.find(r=>r.id===RED):null,cat=v.k==='in'?'Receita':(v.cat||ruleCat(v.t));
   if(er){
    Object.assign(er,{k:v.k,t:v.t.trim(),v:x,cat,ac:v.ac,day,end:v.end||''});
    const tid='r_'+er.id+'_'+T.slice(0,7),tx0=F.tx.find(t=>t.id===tid);
    if(tx0)Object.assign(tx0,{k:er.k,t:er.t,v:er.v,cat:er.cat,ac:er.ac,d:ds(new Date(today.getFullYear(),today.getMonth(),Math.min(day,dimOf(today.getFullYear(),today.getMonth()))))});
    recReminderUpdate(er);RED=null;toast('Recorrência atualizada');
   }else{
    const r={id:uid(),k:v.k,t:v.t.trim(),v:x,cat,ac:v.ac,day,ini:T,end:v.end||''};F.rec.push(r);
    if(v.reminder)recReminder(r);const n=genRec();toast('Recorrência criada'+(n?' ('+n+' lançamentos gerados)':''));
   }
  }
 },
 frule:(f,v)=>ruleSave(v),
 fbud:(f,v)=>{
  const x=num(v.v),month=v.month||ds(new Date(today.getFullYear(),today.getMonth()+S.fmo,1)).slice(0,7);
  if(!Number.isFinite(x)||x<=0||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){toast('Informe um valor e mês válidos');return 'stop'}
  setBudget(v.cat,month,Math.round(x*100)/100);toast('Orçamento de '+BRL(x)+' válido a partir de '+month);
 },
 fgoal:(f,v)=>{const x=parseFloat(String(v.v).replace(',','.'));if(x>0)S.fin.goals.push({id:uid(),n:v.n.trim(),target:x,saved:0})},
 fbill:(f,v)=>{
  if(v.ac&&!finInit().acc.some(a=>a.id===v.ac&&a.ty!=='card')){toast('Escolha uma conta de pagamento válida');return 'stop'}
  const x=num(v.v),dy=Math.min(31,Math.max(1,+v.day||1));
  if(x>0){
   const eb=BED?S.fin.bills.find(b=>b.id===BED):null;
   if(eb){
    Object.assign(eb,{n:v.n.trim(),v:x,day:dy});if(!eb.rec)eb.ac=v.ac||'';
    const rr=eb.rec&&S.fin.rec.find(r=>r.id===eb.rec);
    if(rr){Object.assign(rr,{t:eb.n,v:x,day:dy});recReminderUpdate(rr);const tx=S.fin.tx.find(t=>t.id==='r_'+rr.id+'_'+T.slice(0,7));if(tx)Object.assign(tx,{t:rr.t,v:rr.v,d:ds(new Date(today.getFullYear(),today.getMonth(),Math.min(dy,dimOf(today.getFullYear(),today.getMonth()))))})}
    const ev=eb.eid&&S.events.find(e=>e.id===eb.eid);
    if(ev){const y=+ev.d.slice(0,4),m=+ev.d.slice(5,7)-1;ev.t='Conta: '+eb.n+' ('+BRL(x)+')';ev.d=ds(new Date(y,m,Math.min(dy,dimOf(y,m))))}
    BED=null;toast('Conta fixa atualizada');
   }else{
    let y=today.getFullYear(),m=today.getMonth();if(dy<today.getDate())m++;
    const dt=new Date(y,m,Math.min(dy,new Date(y,m+1,0).getDate())),eid=uid();
    S.events.push({id:eid,t:'Conta: '+v.n.trim()+' ('+BRL(x)+')',d:ds(dt),h:'09:00',e:'',r:'m',rm:'',c:'p'});
    S.fin.bills.push({id:uid(),n:v.n.trim(),v:x,day:dy,eid,ac:v.ac||''});toast('Conta adicionada e lembrada na agenda todo mês');
   }
  }
 },
 finbox:(f,v)=>{const t=v.t.trim();if(t)(S.inbox||(S.inbox=[])).unshift({id:uid(),t})},
 fhj:(f,v)=>{S.tasks.unshift({id:uid(),t:v.t.trim(),done:false,p:'m',hd:T,due:''})},
 ftodo:(f,v)=>{const t=(v.t||'').trim();if(!t)return 'stop';const n=parseNL(t,{time:false});S.tasks.unshift({id:uid(),t:n.t,done:false,p:'m',due:n.d||'',hd:T});toast('Tarefa adicionada')},
 frtag:(f,v)=>{const nw=normTags(v.nw).split(', ')[0]||'';renameTag(v.old,nw);S.tgsel=nw;toast(nw?'Etiqueta renomeada em tudo':'Etiqueta removida de tudo')},
 fmeta:(f,v)=>{
  const t=(v.t||'').trim(),n=+v.tg;
  if(!t||(v.mode==='number'&&(!Number.isFinite(n)||n<1))){toast('Informe o nome e uma quantidade válida');return 'stop'}
  const kr=v.mode==='number'?[{id:uid(),ty:'man',ref:'',t,tg:n,un:(v.un||'').trim(),cur:0}]:[];
  S.metas.unshift({id:uid(),t,ini:T,fim:v.fim||'',kr});
 },
 fmgrp:(f,v)=>{const n=v.n.trim();if(n)menuEdit(m=>{m.groups.push({id:'g'+uid(),n,items:[]})})},
 frd:(f,v)=>{
  S.reads=S.reads||[];const st=['q','a','f','p'].includes(v.st)?v.st:'q',t=(v.t||'').trim();
  if(!t){toast('Informe o título');return 'stop'}
  const m=RD.draftMeta,item={id:uid(),t,a:(v.a||'').trim(),k:RK[v.k]?v.k:'livro',st,tg:normTags(v.tg||''),u:(v.u||'').trim(),r:0,p:st==='f'?100:0,n:'',da:T,df:st==='f'?(v.df||T):''};
  if(m){
   if(Number.isInteger(m.year)&&m.year>=1800&&m.year<=2100)item.year=m.year;
   if(isBook(item)&&Number.isInteger(m.pages)&&m.pages>=1){item.pages=m.pages;item.page=st==='f'?m.pages:0}
   if(item.k==='filme'&&Number.isInteger(m.mins)&&m.mins>=1&&m.mins<=10000)item.mins=m.mins;
   if(Number.isSafeInteger(m.cover)&&m.cover>0)item.cover=m.cover;
   else if(m.coverUrl&&/^https:\/\//i.test(m.coverUrl))item.coverUrl=m.coverUrl;
  }
  RD.draftMeta=null;RD.newLookup=null;
  S.reads.unshift(item);toast('Adicionado à lista');
  if(item.cover||item.coverUrl)coverPalette(item.id,item.cover,item.coverUrl);
 },
 fhb:(f,v)=>{
  const n=+v.perWeek||0;if(!Number.isInteger(n)||n<0||n>7){toast('Escolha uma frequência válida');return 'stop'}
  S.habits.push({id:uid(),n:v.n.trim(),log:{},...(n?{perWeek:n}:{})});
 },
 fqa:submitQa,
 fev:(f,v)=>{
  const e=cur('ev','events'),o={t:v.t.trim(),d:v.d,h:v.h,e:v.h2&&v.h2>v.h?v.h2:'',r:v.r||'',rm:v.rm||'',tg:normTags(v.tg),c:v.c};let i2;
  if(e){Object.assign(e,o);i2=e.id}else{i2=uid();S.events.push({id:i2,...o})}
  ED=null;if(o.rm)askNotif();if(evOn(v.d).some(x=>x.cf&&x.id===i2))toast('Atenção: conflito de horário com outro evento');
 },
 ftk:(f,v)=>{
  const e=cur('tk','tasks'),nl=(!e&&!v.due)?parseNL(v.t,{time:false}):{t:v.t.trim(),d:null};
  const o={t:nl.t,p:v.p,due:v.due||nl.d||'',dur:+v.dur||0,pj:(v.pj||'').trim(),rc:v.rc||'',tg:normTags(v.tg)};
  if(e)Object.assign(e,o);else S.tasks.unshift({id:uid(),done:false,...o});ED=null;
 },
 flk:(f,v)=>{
  let u=v.u.trim();if(!/^https?:\/\//i.test(u))u='https://'+u;const e=cur('lk','links');
  S.links.forEach(x=>{if(v.k&&x.k===v.k)x.k=''});
  if(e)Object.assign(e,{n:v.n.trim(),u,cat:v.cat,k:v.k,tg:normTags(v.tg)});
  else S.links.push({id:uid(),n:v.n.trim(),u,cat:v.cat,k:v.k,tg:normTags(v.tg),c:COL[S.links.length%4]});
  ED=null;
 }
};
const SUBMIT_BY_DATA=[
 ['rdQuote',(f,v)=>{
  const r=(S.reads||[]).find(x=>x.id===f.dataset.rdQuote),text=(v.text||'').trim(),ref=(v.ref||'').trim();
  if(!r||!text){toast('Informe a citação');return 'stop'}
  (r.quotes||(r.quotes=[])).push({id:uid(),text,ref});toast('Citação salva');
 }],
 ['projectEdit',submitProjectForm],
 ['projectLink',(f,v)=>{
  const project=(S.projects||[]).find(x=>x.id===f.dataset.projectLink&&!x.archived),r=lkItem(v.ref);
  if(!project||!r||!['tk','mt','nt','tx'].includes(r.ty)||(r.ty==='tx'&&r.it.k!=='out')){toast('Escolha um item disponível.');return 'stop'}
  if(!(project.refs||[]).some(x=>x.id===r.ref))(project.refs||(project.refs=[])).push({id:r.ref});toast('Item vinculado ao projeto');
 }],
 ['accEdit',(f,v)=>{
  const F=finInit(),a=F.acc.find(x=>x.id===f.dataset.accEdit),name=(v.n||'').trim();
  if(!a||!name){toast('Informe um nome para a conta');return 'stop'}
  if(a.ty==='card'){
   const lim=+v.lim,close=+v.close,due=+v.due,changed=close!==(a.close||28)||due!==(a.due||10);
   if(!Number.isFinite(lim)||lim<0||!Number.isInteger(close)||close<1||close>31||!Number.isInteger(due)||due<1||due>31){toast('Confira o limite e os dias do cartão');return 'stop'}
   if(changed&&!v.confirm){toast('Confirme o impacto das datas antes de salvar');return 'stop'}
   if(close!==(a.close||28)&&F.tx.some(t=>t.to===a.id&&t.invoice)){toast('O fechamento não pode mudar enquanto houver pagamentos vinculados a faturas');return 'stop'}
   Object.assign(a,{lim,close,due});
  }
  a.n=name;toast('Conta atualizada');
 }],
 ['invoiceLink',(f,v)=>{
  const F=finInit(),a=F.acc.find(x=>x.id===f.dataset.invoiceLink&&x.ty==='card'),t=F.tx.find(x=>x.id===v.tx),end=f.dataset.end;
  const offset=(+end.slice(0,4)-today.getFullYear())*12+(+end.slice(5,7)-1-today.getMonth()),iv=a&&invoice(a,offset);
  if(!v.confirm||!iv||iv.end!==end||!t||t.k!=='tr'||t.to!==a.id||t.invoice||!(t.v>0)||t.v>iv.left+.001){toast('Confira a transferência e o valor restante da fatura');return 'stop'}
  t.invoice=end;toast('Pagamento associado à fatura');
 }],
 ['shoppingEdit',(f,v)=>{
  const n=S.notes.find(x=>x.id===f.dataset.shoppingEdit&&x.kind==='shopping'),item=n&&n.items.find(x=>x.id===f.dataset.item),t=(v.t||'').trim();
  if(t&&(!item||JSON.stringify(item)!==SEDBASE)){
   if(!f.querySelector('[data-a=shopping-recover]')){const d=document.createElement('div');d.setAttribute('role','alert');d.innerHTML='Este item mudou ou foi excluído em outro aparelho. <button type="button" class="pill" data-a="shopping-recover">Salvar como novo item</button> <button type="button" class="pill" data-a="shopping-cancel">Descartar edição</button>';f.appendChild(d)}
   return 'stop';
  }
  if(item&&t){
   const prices=shoppingPrices(v);if(!prices){toast('Confira quantidade e preços: use valores positivos e até duas casas decimais para preços.');return 'stop'}
   Object.assign(item,prices);item.t=t;item.q=(v.q||'').trim();noteTouch(n);delete NOTE_DRAFTS[noteDraftKey(f)];SED=null;SEDBASE=null;
  }
 }],
 ['shoppingForm',(f,v)=>{
  const n=S.notes.find(x=>x.id===f.dataset.shoppingForm&&x.kind==='shopping'),t=(v.t||'').trim();
  if(n&&t){
   const prices=shoppingPrices(v);if(!prices){toast('Confira quantidade e preços: use valores positivos e até duas casas decimais para preços.');return 'stop'}
   if(prices.estimatedCents===null){const h=shoppingPriceHistory(t,n.id);if(h&&h.priceCents!=null){prices.estimatedCents=h.priceCents;if(prices.qty===null&&h.qty!=null)prices.qty=h.qty;if(!prices.unit&&h.unit)prices.unit=h.unit}}
   (n.items||(n.items=[])).push({id:uid(),t,q:(v.q||'').trim(),done:false,...prices});noteTouch(n);delete NOTE_DRAFTS[noteDraftKey(f)];
  }
 }],
 ['metaEdit',(f,v)=>{
  const g=S.metas.find(x=>x.id===f.dataset.metaEdit),t=(v.t||'').trim();
  if(!g||g.archived||!t){toast('A meta não está disponível para edição.');return 'stop'}
  g.t=t;g.fim=v.fim||'';
 }],
 ['krEdit',(f,v)=>{
  const g=S.metas.find(x=>x.id===f.dataset.krEdit),k=g&&g.kr.find(x=>x.id===f.dataset.k&&['man','hb','pc'].includes(x.ty)),t=(v.t||'').trim(),n=+v.tg;
  if(!k||g.archived||!t||!Number.isFinite(n)||n<1||(k.ty!=='man'&&!Number.isInteger(n))||(k.ty==='pc'&&n>6)){toast('Informe um nome e objetivo válido');return 'stop'}
  k.t=t;k.tg=n;if(k.ty==='man')k.un=(v.un||'').trim();
 }],
 ['metaTask',(f,v)=>{
  const g=S.metas.find(x=>x.id===f.dataset.metaTask),t=(v.t||'').trim();
  if(!g||g.archived||!t){toast('A meta não está disponível para novas tarefas.');return 'stop'}
  S.tasks.unshift({id:uid(),t,done:false,p:'m',due:'',mt:g.id});
 }],
 ['kr',(f,v)=>{
  const g=S.metas.find(x=>x.id===f.dataset.kr),p=String(v.src||'').split(':'),ty=p.shift(),ref=p.join(':'),n=+v.tg;
  if(!g||g.archived||!['man','hb','pc','pj','tg','sv'].includes(ty)||(['man','hb','pc'].includes(ty)&&(!Number.isFinite(n)||n<1||((ty==='hb'||ty==='pc')&&!Number.isInteger(n))||(ty==='pc'&&n>6)))){toast('Informe um objetivo válido para o acompanhamento');return 'stop'}
  const hb=S.habits.find(h=>h.id===ref),auto=ty==='hb'?'Praticar "'+(hb?hb.n:'')+'"':ty==='pj'?'Concluir o projeto "'+ref+'"':ty==='tg'?'Concluir tarefas #'+ref:ty==='pc'?'Cumprir "'+((finInit().prules.find(x=>x.id===ref)||{}).k?prName(finInit().prules.find(x=>x.id===ref)):'')+'"':ty==='sv'?'Economizar para "'+((S.fin.goals.find(x=>x.id===ref)||{}).n||'')+'"':'Resultado';
  g.kr.push({id:uid(),ty,ref,t:(v.t||'').trim()||auto,tg:n||1,un:(v.un||'').trim(),cur:0});
 }],
 ['mt',(f,v)=>{
  const t=S.tasks.find(x=>x.id===v.tk),g=S.metas.find(x=>x.id===f.dataset.mt);
  if(!g||g.archived||!t||taskPaused(t)||t.mt||t.done){toast('Esta tarefa ou meta não está disponível para vinculação');return 'stop'}
  t.mt=g.id;
 }]
];
document.addEventListener('submit',e=>{
 e.preventDefault();
 const f=e.target,early=SUBMIT_EARLY[f.id];if(early){early(f);return}
 const v=Object.fromEntries(new FormData(f));
 if(SUBMIT_BY_ID[f.id]&&SUBMIT_BY_ID[f.id](f,v)==='stop')return;
 for(const [key,fn] of SUBMIT_BY_DATA){if(f.dataset[key]&&fn(f,v)==='stop')return}
 finSubE(f,v);
 render();
 if(f.id==='fmeta'){const card=document.querySelector('[data-lid="mt:'+S.metas[0].id+'"]');if(card)(card.querySelector(v.mode==='number'?'[data-krset]':'[data-meta-task] input')||card).focus()}
});
auditMigrate();undoReset();
{const up=new URLSearchParams(location.search),uv=up.get('v'),uqa=up.get('qa');if(uv&&V[uv])S.view=uv;if(uv||uqa)try{history.replaceState(null,'',location.pathname)}catch(e){}render();if(uqa&&/^(tk|nt|ev|dp|rc)$/.test(uqa))qa(uqa)}
fbInit();// por último: as respostas do Firebase chamam render() e o resto do app, que precisam já estar carregados
let SW_REG=null,SW_RELOADING=false;
if('serviceWorker' in navigator&&!window.__noSW){
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(SW_RELOADING){SW_RELOADING=false;location.reload()}});
 navigator.serviceWorker.register('sw.js').then(reg=>{
  SW_REG=reg;
  if(reg.waiting&&navigator.serviceWorker.controller){
   toast('Nova versão disponível.',false,{a:'sw-reload',label:'Atualizar'});
  }
  reg.addEventListener('updatefound',()=>{
   const nw=reg.installing;
   if(!nw)return;
   nw.addEventListener('statechange',()=>{
    if(nw.state==='installed'&&navigator.serviceWorker.controller){
     toast('Nova versão disponível.',false,{a:'sw-reload',label:'Atualizar'});
    }
   });
  });
 }).catch(()=>{});
}
