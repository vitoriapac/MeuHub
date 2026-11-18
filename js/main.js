// telas (V), render(), listeners centrais de clique/envio e inicialização
/* paginação: listas longas mostram um bloco e o resto sob demanda */
let PG={},PGV='';
const NOTE_DRAFTS={};
const noteDraftKey=f=>f.dataset.shoppingForm?'new:'+f.dataset.shoppingForm:f.dataset.shoppingEdit?'edit:'+f.dataset.shoppingEdit+':'+f.dataset.item:'';
function restoreNoteDrafts(){document.querySelectorAll('#main form[data-shopping-form],#main form[data-shopping-edit]').forEach(f=>{const v=NOTE_DRAFTS[noteDraftKey(f)];if(v)Object.entries(v).forEach(([k,x])=>{if(f.elements[k])f.elements[k].value=x})})}
const pgN=(k,d)=>PG[k]||d;
const FLK=()=>'fl'+S.fmo+'|'+(S.fcat||'')+'|'+(S.fkd||'')+'|'+FQ+'|'+(S.fac||'')+'|'+(S.ftab||'');
const pgMore=(k,tot,d)=>{const sh=pgN(k,d);return tot>sh?`<div class="pgm"><button class="pill" data-a="pgmore" data-id="${esc(k)}" data-d="${d}">Mostrar mais ${Math.min(d,tot-sh)}</button><span class="empty" style="padding:0">${sh} de ${tot}</span></div>`:''};
const V={arquivados,leituras,rotina,lixeira,avisos,dash,agenda,notas,tarefas,links,backup,aparencia,habitos,financas,diario,hoje,etiquetas,metas,menu:menuView};
let LV=null;
function renderKeepDraft(){const key=f=>f.id?'id:'+f.id:f.dataset.shoppingForm?'shopping:'+f.dataset.shoppingForm:f.dataset.shoppingEdit?'edit:'+f.dataset.shoppingEdit+':'+f.dataset.item:'';const forms=PGV===S.view?[...document.querySelectorAll('#main form')].map(f=>({key:key(f),values:[...f.elements].filter(x=>x.name&&!/^(checkbox|radio|file|submit|button)$/i.test(x.type||'')&&(x.tagName==='SELECT'?x.value!==(([...x.options].find(o=>o.defaultSelected)||x.options[0])||{}).value:x.value!==x.defaultValue)).map(x=>[x.name,x.value])})).filter(x=>x.key&&x.values.length):[];render();forms.forEach(d=>{const f=[...document.querySelectorAll('#main form')].find(x=>key(x)===d.key);if(f)d.values.forEach(([name,value])=>{const x=f.elements.namedItem(name);if(x)x.value=value})})}
function render(){
 dayPending=false;remoteRenderPending=false;
 if(PGV!==S.view){PG={};PGV=S.view}
 const FK=focusKey(),reviewOpen=!!document.querySelector('#weekly-review[open]'),guideOpen=!!document.querySelector('[data-review-guide][open]'),noteFiltersOpen=!!document.querySelector('[data-note-filters][open]');$('#main').innerHTML=Q?busca():V[S.view]();if(S.view==='notas'&&!Q)restoreNoteDrafts();if(reviewOpen&&$('#weekly-review'))$('#weekly-review').open=true;if(guideOpen&&$('[data-review-guide]'))$('[data-review-guide]').open=true;if(noteFiltersOpen&&$('[data-note-filters]'))$('[data-note-filters]').open=true;
 renderMenu();document.querySelectorAll('.nav[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===S.view&&!Q));pomoDraw();fillTags();updU();trashSweep();a11y(FK);lkDraw();flashEl();{const mn=$('#main');if(mn&&LV!==S.view){LV=S.view;mn.classList.remove('vin');void mn.offsetWidth;mn.classList.add('vin')}}
 gateR();spSync();if(S.view==='dash'&&document.querySelector('[data-card=clima]'))wxEnsure();
 save();
}
document.addEventListener('click',e=>{
 const nv=e.target.closest('[data-v]');
 if(nv){if($('#mobile-menu').open)$('#mobile-menu').close();FED=null;S.view=nv.dataset.v;Q='';ED=null;$('#q').value='';render();return}
 if(e.target.closest('#theme')){S.themeMode=isDark()?'light':'dark';applyTheme();save();document.querySelectorAll('[data-theme-choice]').forEach(b=>{const on=b.dataset.themeChoice===S.themeMode;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});return}
 const theme=e.target.closest('[data-theme-choice]');if(theme){S.themeMode=theme.dataset.themeChoice;applyTheme();render();return}
 const b=e.target.closest('[data-a]');if(!b)return;
 const a=b.dataset.a,id=b.dataset.id;
 if(a==='att-dismiss'){e.preventDefault();const key=b.dataset.key,item=attention().find(x=>x.dismissKey===key);if(item){const existing=(S.rem&&S.rem.dismiss)||{},keep=Object.fromEntries(Object.entries(existing).filter(([,day])=>day===T));keep[key]=T;S.rem=Object.assign({},S.rem||{},{dismiss:keep});render()}return}
 if(a==='bulk-cancel'){e.preventDefault();const f=b.closest('#bulk-plan');f.reset();delete f.dataset.preview;f.querySelector('[data-bulk-preview]').textContent='';f.querySelector('[data-a=bulk-apply]').hidden=true;f.closest('details').open=false;return}
 if(a==='att-open'){e.preventDefault();if(b.dataset.kind==='tk')lkGo('tk:'+id);else if(b.dataset.kind==='conflict'){S.view='agenda';S.mode='day';S.dy=mDays(b.dataset.day);Q='';FLASH='ev:'+id}else if(b.dataset.kind==='bill'){S.view='financas';S.ftab='contas';S.fvw='mes';BED=id;Q=''}else if(b.dataset.kind==='sub'){S.view='financas';S.ftab='contas';S.fvw='mes';RED=id;Q=''}else if(b.dataset.kind==='sal'){S.view='financas';S.ftab='geral';S.fvw='mes';S.fmo=0;Q=''}render();if(b.dataset.kind==='sub')document.querySelector('#frec')?.scrollIntoView({block:'center'});if(b.dataset.kind==='bill')document.querySelector('#fbill')?.scrollIntoView({block:'center'});if(b.dataset.kind==='sal')document.querySelector('#cash-flow-panel')?.scrollIntoView({block:'start'});return}
 if(a==='bulk-preview'||a==='bulk-apply'){e.preventDefault();const f=b.closest('#bulk-plan'),date=f.elements.date.value,ids=[...f.querySelectorAll('[name=task]:checked:not(:disabled)')].map(x=>x.value),items=ids.map(id=>S.tasks.find(t=>t.id===id&&!t.done&&!t.rc)).filter(Boolean),valid=/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(new Date(date+'T12:00').getTime())&&ds(new Date(date+'T12:00'))===date;if(a==='bulk-preview'){const out=f.querySelector('[data-bulk-preview]'),apply=f.querySelector('[data-a=bulk-apply]');if(!valid||!items.length||items.length!==ids.length){out.textContent='Escolha uma data válida e ao menos uma tarefa disponível.';apply.hidden=true;delete f.dataset.preview;return}f.dataset.preview=JSON.stringify({date,items:items.map(t=>({id:t.id,t:t.t,due:t.due||'',hd:t.hd||'',bk:t.bk||null}))});out.textContent=items.length+(items.length===1?' tarefa para ':' tarefas para ')+fmt(date)+' '+date.slice(0,4)+': '+items.map(t=>t.t).join('; ')+'. Os prazos e horários agendados serão mantidos.';apply.hidden=false;return}if(!valid||!ids.length||items.length!==ids.length||f.dataset.preview!==JSON.stringify({date,items:items.map(t=>({id:t.id,t:t.t,due:t.due||'',hd:t.hd||'',bk:t.bk||null}))})){f.querySelector('[data-bulk-preview]').textContent='A seleção mudou. Revise novamente antes de confirmar.';b.hidden=true;return}track();UTime=0;items.forEach(t=>{t.hd=date});toast(items.length+(items.length===1?' tarefa planejada; prazo mantido.':' tarefas planejadas; prazos mantidos.'));renderKeepDraft();return}
 if(a==='fmt'){const ed=b.closest('.note').querySelector('.rt'),[c,v]=b.dataset.c.split(':');ed.focus();if(c==='task'){lineToTask(ed);return}
 c==='chk'?document.execCommand('insertHTML',false,'<div><input type="checkbox">&nbsp;</div>'):document.execCommand(c,false,v||null);ed.dispatchEvent(new Event('input',{bubbles:true}));return}
 if(a==='more'){const d=$('#mobile-menu');$('#mobile-sync').textContent=$('#syn').innerText;d.showModal();return}
 if(a==='close-mobile-menu'){$('#mobile-menu').close();return}
 if(a==='mobile-theme'){$('#theme').click();return}
 if(a==='adv'){const f=b.closest('form');f.classList.toggle('advo');b.textContent=f.classList.contains('advo')?'Menos opções':'Mais opções';return}
 if(a==='focusform'){e.preventDefault();const i=document.querySelector(id+' input');if(i)i.focus();return}
 if(a==='bksnz'){S.bkSnz=T;render();return}
 if(a==='onbx'){S.onb=false;render();return}
 if(a==='pgmore'){PG[id]=pgN(id,+b.dataset.d)+ +b.dataset.d;render();return}
 if(a==='qa'||a==='qat'||a==='qax'){e.preventDefault();if(a==='qax')qaClose();else{if(a==='qa'||(a==='qat'&&id!=='dp'))QSHOP=null;qa(a==='qat'?id:undefined)}return}
 if(a==='shopping-share'){e.preventDefault();shoppingShare(id);return}
 if(a==='shopping-expense'){e.preventDefault();const n=S.notes.find(x=>x.id===id&&x.kind==='shopping');if(n){QI=null;FED=null;QSHOP=id;QSHOPSESSION='shop_'+uid();qa('dp');const i=document.querySelector('#fqa input[name=t]'),f=i.form,done=(n.items||[]).filter(x=>x.done),total=shoppingTotals(done,'actualCents');i.value='Compra: '+n.t;if(done.length&&!total.missing)f.elements.v.value=total.value.toFixed(2).replace('.',',');const hint=document.createElement('p');hint.className='empty';hint.textContent='Revise valor, conta, data e categoria. Cada confirmação registra uma compra independente. Lançamentos anteriores: '+(S.fin.tx||[]).filter(t=>t.shopping===id).length+'.';f.appendChild(hint);i.focus()}return}
 if(a==='inboxconvert'){e.preventDefault();QI=id;qa('tk');return}
 if(a==='gundo'){e.preventDefault();undo();return}
 if(a==='gredo'){e.preventDefault();redo();return}
 if(a==='payfat'){e.preventDefault();S.view='financas';S.fvw='mes';S.ftab='lanc';render();payInv(id,+b.dataset.o);return}
 if(a==='fexp'){e.preventDefault();exportYear();return}
 if(a==='payinv'){e.preventDefault();payInv(id);return}
 if(a==='rd-cover-find'){e.preventDefault();findCover(id);return}
 if(a==='rd-cover-use'){e.preventDefault();const r=(S.reads||[]).find(x=>x.id===id),cover=+b.dataset.cover,allowed=RD.lookup&&RD.lookup.id===id&&RD.lookup.results.some(x=>x.cover===cover);if(r&&isBook(r)&&allowed&&Number.isSafeInteger(cover)&&cover>0){r.cover=cover;delete r.coverColor;RD.lookup=null;renderKeepDraft();coverPalette(id,cover)}return}
 if(a==='syncnow'||a==='syncup'||a==='syncdown'){e.preventDefault();syncAct(a);return}
 if(a==='bkexp'){e.preventDefault();exportBk();return}
 if(a==='bkshr'){e.preventDefault();shareBk();return}
 if(a==='profile-switch'){e.preventDefault();try{profileSwitch(id);render();toast('Perfil aplicado')}catch(err){toast(err.message||'Não foi possível aplicar o perfil')}return}
 if(b.tagName==='A'||b.type==='checkbox')return;
 e.preventDefault();
 const TB=trashSnap();
 if(/^(delev|delnote|deltk|dellk|clear|deltx|deltxg)$/.test(a))snap(a);
 if(a==='nav'){const n=+b.dataset.n,k={month:'mo',day:'dy'}[S.mode]||'wk';S[k]=n?S[k]+n:0}
 else if(a==='delev')S.events=S.events.filter(x=>x.id!==id);
 else if(a==='inboxdel')S.inbox=(S.inbox||[]).filter(x=>x.id!==id);
 else if(a==='shopping-add'){const folder=S.nf||'';noteReset();S.notes.unshift({id:uid(),kind:'shopping',t:'Lista de compras',b:'',f:folder,g:'',c:'g',items:[],updatedAt:Date.now()})}
 else if(a==='shopping-edit'){SED=id+':'+b.dataset.item;const n=S.notes.find(x=>x.id===id&&x.kind==='shopping'),item=n&&n.items.find(x=>x.id===b.dataset.item);SEDBASE=item?JSON.stringify(item):null}
 else if(a==='shopping-cancel'){delete NOTE_DRAFTS[noteDraftKey(b.closest('form'))];SED=null;SEDBASE=null}
 else if(a==='shopping-copy'){const n=S.notes.find(x=>x.id===id&&x.kind==='shopping');if(n){noteReset();S.notes.unshift({...n,id:uid(),t:n.t+' (cópia)',pin:false,archived:false,revisit:false,updatedAt:Date.now(),items:n.items.map(x=>({...x,id:uid(),done:false}))})}}
 else if(a==='shopping-recover'){const f=b.closest('form'),text=f&&f.elements.t.value.trim(),q=f&&f.elements.q.value.trim(),prices=f&&shoppingPrices(Object.fromEntries(new FormData(f)));if(text&&!prices){toast('Confira quantidade e preços.');return}if(text){let n=S.notes.find(x=>x.id===f.dataset.shoppingEdit&&x.kind==='shopping');if(!n){const title=f.closest('.note').querySelector('[data-f=t]');n={id:uid(),kind:'shopping',t:title&&title.value||'Lista recuperada',b:'',f:'',g:'',c:'g',items:[]};S.notes.unshift(n)}n.items.push({id:uid(),t:text,q,done:false,...prices});noteTouch(n);delete NOTE_DRAFTS[noteDraftKey(f)];SED=null;SEDBASE=null;toast('Edição recuperada como novo item')}}
 else if(a==='shopping-item-del'){const n=S.notes.find(x=>x.id===id&&x.kind==='shopping');if(n){n.items=n.items.filter(x=>x.id!==b.dataset.item);noteTouch(n)}}
 else if(a==='shopping-clear'){const n=S.notes.find(x=>x.id===id&&x.kind==='shopping');if(n){if(SCLEAR===id){n.items=n.items.filter(x=>!x.done);noteTouch(n);SCLEAR=null}else{SCLEAR=id;toast('Clique novamente em Limpar comprados para confirmar');setTimeout(()=>{if(SCLEAR===id)SCLEAR=null},6000)}}}
 else if(a==='addnote'){const folder=S.nf||'';noteReset();S.notes.unshift({id:uid(),t:'',b:'',f:folder,g:'',c:COL[S.notes.length%4],updatedAt:Date.now()})}
 else if(a==='note-archive'){const n=S.notes.find(x=>x.id===id);if(n){n.archived=!n.archived;auditLog(n.archived?'archive':'restore')}}
 else if(a==='note-revisit'){const n=S.notes.find(x=>x.id===id);if(n)n.revisit=!n.revisit}
 else if(a==='note-copy'){const n=S.notes.find(x=>x.id===id&&x.kind!=='shopping');if(n){noteReset();S.notes.unshift({...n,id:uid(),t:(n.t||'Sem título')+' (cópia)',pin:false,archived:false,revisit:false,updatedAt:Date.now()})}}
 else if(a==='delnote'){if(S.notes.some(x=>x.id===id))auditLog('noteDelete');S.notes=S.notes.filter(x=>x.id!==id)}
 else if(a==='color'){const n=S.notes.find(x=>x.id===id);n.c=COL[(COL.indexOf(n.c)+1)%4]}
 else if(a==='filter')S.filter=id;
 else if(a==='deltk'){if(S.tasks.some(x=>x.id===id))auditLog('taskDelete');S.tasks=S.tasks.filter(x=>x.id!==id)}
 else if(a==='clear')S.tasks=S.tasks.filter(x=>!x.done);
 else if(a==='dellk')S.links=S.links.filter(x=>x.id!==id);
 else if(a==='ed')ED={t:b.dataset.t,id};
 else if(a==='cancel')ED=null;
 else if(a==='undo'){if(UN){Object.assign(S,JSON.parse(UN));UN=null}const tt=$('#toast');if(tt)tt.classList.remove('on')}
 else if(a==='pin'){const x=S[b.dataset.t].find(y=>y.id===id);if(x)x.pin=!x.pin}
 else if(a==='sorttk')S.tasks.sort(tsort);
 else if(a==='mcol'){const c=new Set(S.mcol||[]);if(c.has(id))c.delete(id);else c.add(id);S.mcol=[...c]}
 else if(a==='mreset')S.menu=null;
 else if(a==='mgmv')menuEdit(m=>{const i=m.groups.findIndex(g=>g.id===id),j=i+ +b.dataset.n;if(j>=0&&j<m.groups.length)[m.groups[i],m.groups[j]]=[m.groups[j],m.groups[i]]});
 else if(a==='mimv')menuEdit(m=>{const g=m.groups.find(x=>x.items.includes(id));if(!g)return;const i=g.items.indexOf(id),j=i+ +b.dataset.n;if(j>=0&&j<g.items.length)[g.items[i],g.items[j]]=[g.items[j],g.items[i]]});
 else if(a==='mdelg')menuEdit(m=>{const g=m.groups.find(x=>x.id===id);if(g&&!g.items.length&&m.groups.length>1)m.groups=m.groups.filter(x=>x.id!==id)});
 else if(a==='flm')S.flm=id;
 else if(a==='fcn')S.fcn=+id;
 else if(a==='fcv')S.fcv=S.fcv===false;
 else if(a==='fyo')S.fyo=id;
 else if(a==='fvw')S.fvw=id;
 else if(a==='ftab')S.ftab=id;
 else if(a==='sgo'){S.view=b.dataset.view;if(b.dataset.tab)S.ftab=b.dataset.tab;if(b.dataset.fmo!==undefined){S.fmo=+b.dataset.fmo;S.fvw='mes'}if(b.dataset.ddo!==undefined)S.ddo=Math.min(0,+b.dataset.ddo);Q='';$('#q').value=''}
 else if(a==='fwm')S.fwm=id;
 else if(a==='fyn')S.fyr=b.dataset.n==='0'?0:S.fyr+ +b.dataset.n;
 else if(a==='fday')S.fday=S.fday===id?'':id;
 else if(a==='redit')FRE=id;
 else if(a==='rcancel')FRE=null;
 else if(a==='rtog'){const r=finInit().rules.find(x=>x.id===id);if(r)r.on=r.on===false}
 else if(a==='rmv'){const L=finInit().rules,i=L.findIndex(x=>x.id===id),j=i+ +b.dataset.n;if(j>=0&&j<L.length)[L[i],L[j]]=[L[j],L[i]]}
 else if(a==='rapplyall'){if(!RARM){RARM=true;toast('Clique de novo para reaplicar as regras a todos os lançamentos (sobrescreve categorias)');setTimeout(()=>{RARM=false},6000)}else{RARM=false;toast(applyRules(true)+' lançamentos atualizados')}}
 else if(a==='fpm')S.fpm=id;
 else if(a==='fcat')S.fcat=S.fcat===id?'':id;
 else if(a==='fn')S.fn=+id;
 else if(a==='edtx')FED=id;
 else if(a==='fcancel')FED=null;
 else if(a==='deltxg')S.fin.tx=S.fin.tx.filter(x=>!(x.pc&&x.pc.g===id));
 else if(a==='delacc'){finInit();if(S.fin.tx.some(x=>accId(x)===id||x.to===id)||S.fin.rec.some(x=>x.ac===id||(!x.ac&&S.fin.acc[0].id===id))||S.fin.bills.some(x=>x.ac===id)||S.fin.rules.some(x=>x.ac===id)||S.fin.acc.length<2)toast('Não é possível excluir a conta: verifique lançamentos, recorrências, lembretes e regras vinculados');else{S.fin.acc=S.fin.acc.filter(x=>x.id!==id);if(S.fac===id)S.fac='';if(S.fin.primary===id)delete S.fin.primary}}
 else if(a==='primaryacc'){const x=finInit().acc.find(x=>x.id===id&&x.ty!=='card');if(x)S.fin.primary=x.id}
 else if(a==='sub-review'){const r=S.fin.rec.find(x=>x.id===id);if(r){r.review=!r.review;auditLog(r.review?'reviewStart':'reviewEnd');toast(r.review?'Revisão marcada':'Revisão concluída')}}
 else if(a==='sub-task'){const r=S.fin.rec.find(x=>x.id===id&&x.review);if(r){S.tasks.unshift({id:uid(),t:'Revisar assinatura: '+r.t,done:false,p:'m',due:''});auditLog('reviewTask');toast('Tarefa criada')}}
 else if(a==='delrec'){S.fin.rec=S.fin.rec.filter(x=>x.id!==id);S.fin.bills.forEach(b=>{if(b.rec===id)delete b.rec})}
 else if(a==='delrule')S.fin.rules=S.fin.rules.filter(x=>x.id!==id);
 else if(a==='rulesapply')toast(applyRules(false)+' lançamentos atualizados')
 else if(a==='impgo'){const F=finInit();let n=0;const R=impRows().rows;R.forEach(r=>{if(!r.dup||(IMP.include||[]).includes(r.index)){F.tx.unshift({id:uid(),k:r.k,t:r.t,v:r.v,cat:r.cat,d:r.d,ac:IMP.ac,imp:1,sub:r.sub,tg:r.tg,pj:r.pj});n++}});toast(n+' lançamentos importados'+(R.length-n?', '+(R.length-n)+' possíveis duplicatas ignoradas':''));IMP=null}
 else if(a==='impcancel')IMP=null;
 else if(a==='krm'){const g=S.metas.find(x=>x.id===id),k=g.kr.find(x=>x.id===b.dataset.k);k.cur=Math.max(0,(+k.cur||0)+ +b.dataset.n)}
 else if(a==='delkr'){const g=S.metas.find(x=>x.id===id);g.kr=g.kr.filter(x=>x.id!==b.dataset.k)}
 else if(a==='delmeta'){S.metas=S.metas.filter(x=>x.id!==id);S.tasks.forEach(t=>{if(t.mt===id)t.mt=''})}
 else if(a==='unmt'){const t=S.tasks.find(x=>x.id===id);t.mt=''}
 else if(a==='mrn')S.mro=b.dataset.n==='0'?0:S.mro+ +b.dataset.n;
 else if(a==='plan'){const t=S.tasks.find(x=>x.id===id);t.hd=t.hd===T?'':T}
 else if(a==='review-plan'){const t=S.tasks.find(x=>x.id===id);if(t&&!t.done)t.hd=ds(add(today,7-((today.getDay()+6)%7)))}
 else if(a==='hide-suggestion')dismissedSuggestions.add(T+':'+id)
 else if(a==='tagv'){S.tgsel=id;S.view='etiquetas';Q='';$('#q').value=''}
 else if(a==='tgnote'){S.view='notas';S.nf='';S.ng=id}
 else if(a==='fmn')S.fmo=b.dataset.n==='0'?0:S.fmo+ +b.dataset.n;
 else if(a==='deltx'){const t=S.fin.tx.find(x=>x.id===id);if(t)auditLog('txDelete');if(t&&t.rc){const r=S.fin.rec.find(x=>x.id===t.rc);if(r)(r.skip=r.skip||[]).push(t.id)}S.fin.tx=S.fin.tx.filter(x=>x.id!==id)}
 else if(a==='delbud')setBudget(id,ds(new Date(today.getFullYear(),today.getMonth()+S.fmo,1)).slice(0,7),null);
 else if(a==='delbill'){const bl=S.fin.bills.find(x=>x.id===id);if(bl)S.events=S.events.filter(e=>e.id!==bl.eid);S.fin.bills=S.fin.bills.filter(x=>x.id!==id)}
 else if(a==='delgoal')S.fin.goals=S.fin.goals.filter(x=>x.id!==id);
 else if(finActE(a,id)){}
 else if(a==='mood'){const d=b.dataset.d,k=b.dataset.k,e=(S.dia[d]=S.dia[d]||{});e[k]=e[k]===+id?0:+id}
 else if(a==='rtmood'){const mode=b.dataset.mode,k=b.dataset.k;if(['m','n'].includes(mode)&&['m','e'].includes(k)){const e=(S.dia[T]=S.dia[T]||{}),r=(e.routine=e.routine||{}),v=(r[mode]=r[mode]||{});v[k]=v[k]===+id?0:+id}}
 else if(a==='dnav')S.ddo=Math.min(0,b.dataset.n==='0'?0:S.ddo+ +b.dataset.n);
 else if(a==='dgo')S.ddo=Math.round((new Date(id+'T00:00')-new Date(T+'T00:00'))/864e5);
 else if(a==='snooze'){const t=S.tasks.find(x=>x.id===id);t.due=ds(add(today,1));if(t.hd===T)t.hd='';toast('Tarefa adiada para amanhã')}
 else if(a==='tmv'){const i=S.tasks.findIndex(x=>x.id===id),j=i+ +b.dataset.n;if(j>=0&&j<S.tasks.length)[S.tasks[i],S.tasks[j]]=[S.tasks[j],S.tasks[i]]}
 else if(a==='pf')S.pf=S.pf===id?'':id;
 else if(a==='sdel'){const t=S.tasks.find(x=>x.id===id);t.sub=t.sub.filter(s=>s.id!==b.dataset.s)}
 else if(a==='sprom'){const t=S.tasks.find(x=>x.id===id),s=t&&(t.sub||[]).find(x=>x.id===b.dataset.s);if(s){t.sub=t.sub.filter(x=>x.id!==s.id);const nid=uid(),nt={id:nid,t:s.t,done:!!s.done,dd:s.done?T:'',p:t.p||'m',due:t.due||'',pj:t.pj||'',tg:t.tg||'',mt:t.mt||''};S.tasks.splice(S.tasks.indexOf(t)+1,0,nt);lkSet('tk:'+t.id,'tk:'+nid,true);toast('Etapa transformada em tarefa e ligada à original')}}
 else if(a==='focus'){S.fk={id,mode:'foco',run:true,end:Date.now()+FOCO*6e4,left:FOCO*6e4};askNotif()}
 else if(a==='pp'){const k=S.fk;if(k.run){k.left=k.end-Date.now();k.run=false}else{k.end=Date.now()+k.left;k.run=true}}
 else if(a==='ps')S.fk=null;
 else if(a==='delhb')S.habits=S.habits.filter(x=>x.id!==id);
 else if(a==='gotoday'){S.view='agenda';S.mode='day';S.dy=Math.round((new Date(id+'T00:00')-new Date(T+'T00:00'))/864e5)}
 else if(a==='tpl'){const t=TPL.find(x=>x.k===id),folder=S.nf||'';noteReset();S.notes.unshift({id:uid(),t:t.t.replace('{d}',dlbl()),b:t.b,f:folder,g:t.g,c:t.c,updatedAt:Date.now()})}
 else if(a==='rw')S.rw=id==='0'?0:S.rw+ +id;
 else if(a==='hw')S.hw=+id;
 else if(a==='cust')S.cust=!S.cust;
 else if(a==='comp'){const L2=cfg(),on=!['spotify','clima'].every(k=>{const x=L2.find(y=>y.id===k);return x&&x.on}),sp=L2.find(x=>x.id==='spotify'),wx=L2.find(x=>x.id==='clima');sp.on=wx.on=on;if(on){const rest=L2.filter(x=>x.id!=='spotify'&&x.id!=='clima'),li=rest.findIndex(x=>x.id==='linha');rest.splice(li>=0?li+1:0,0,sp,wx);S.cards=rest}else S.cards=L2}
 else if(a==='cmv'){const L2=cfg(),i=L2.findIndex(y=>y.id===id),j=i+ +b.dataset.n;if(j>=0&&j<L2.length)[L2[i],L2[j]]=[L2[j],L2[i]];S.cards=L2}
 else if(a==='pal'){S.pal=id;applyTheme()}
 else if(a==='navstyle'){S.nav=id;applyTheme()}
 else if(a==='dens'){S.dens=id;applyTheme()}
 else if(a==='acc'){S.acc=id;applyTheme()}
 else if(a==='nf')S.nf=S.nf===id?'':id;
 else if(a==='ng')S.ng=S.ng===id?'':id;
 else if(a==='lc')S.lc=id;
 else if(a==='goal')S.goal=Math.max(1,Math.min(20,S.goal+ +id));
 else if(a==='mode'){S.mode=id;ED=null}
 else if(a==='pick'){S.dy=Math.round((new Date(id+'T00:00')-new Date(T+'T00:00'))/864e5);S.mode='day'}
 else if(a==='lkopen'){LKP={ref:id,q:'',focus:true};LKO=id}
 else if(a==='lkclose')LKP=null;
 else if(a==='lkadd'){if(LKP){lkSet(LKP.ref,id,true);LKP.q='';LKP.focus=true}}
 else if(a==='lkdel'){if(LKP)lkSet(LKP.ref,id,false)}
 else if(a==='lkgo')lkGo(id);
 else if(a==='rdr'){const r=S.reads.find(x=>x.id===id);if(r)r.r=r.r===+b.dataset.n?0:+b.dataset.n}
 else if(a==='rd-tab'){if(['collection','shelf'].includes(id)){RD.tab=id;RD.lookup=null}}
 else if(a==='rd-open'){RD.selected=id;RD.lookup=null}
 else if(a==='rd-close'){RD.selected='';RD.lookup=null}
 else if(a==='rd-edit')lkGo('rd:'+id);
 else if(a==='rd-cover-remove'){const r=(S.reads||[]).find(x=>x.id===id);if(r){delete r.cover;delete r.coverColor;RD.lookup=null;toast('Capa removida')}}
 else if(a==='delrd')S.reads=S.reads.filter(x=>x.id!==id);
 else if(a==='rfk')S.rk=id;
 else if(a==='rfs')S.rs=id;
 else if(a==='dvw')S.dvw=id;
 else if(a==='dyn')S.dyr=b.dataset.n==='0'?0:Math.min(0,(S.dyr||0)+ +b.dataset.n);
 else if(a==='fit'){const t=S.tasks.find(x=>x.id===id),k=ds(add(today,S.dy));if(t){const h=autoSlot(k,t.dur||30,t.id);if(h){t.bk={d:k,h};warnPlan(k,t.id)}else toast('Sem espaço livre nas janelas configuradas')}}
 else if(a==='fitday'){const t=S.tasks.find(x=>x.id===id);if(t&&!t.done&&!t.bk){const h=autoSlot(T,t.dur||30,t.id);if(h){t.bk={d:T,h};toast('Tarefa encaixada às '+h+(t.dur?'':' por 30 min'));warnPlan(T,t.id)}else toast('Sem espaço livre hoje nas janelas configuradas')}}
 else if(a==='unbk'){const t=S.tasks.find(x=>x.id===id);if(t)t.bk=null}
 else if(a==='availability-remove'){const day=String(b.dataset.day),existing=(S.availability||{})[day],wins=Array.isArray(existing)?existing:defaultWindows;S.availability=Object.assign({},S.availability||{},{[day]:wins.filter(w=>w.id!==id)});toast('Janela removida')}
 else if(a==='availability-reset'){S.availability=Object.assign({},S.availability||{});delete S.availability[id];toast('Horário padrão restaurado')}
 else if(a==='cap')S.cap=Math.max(1,Math.min(16,(+S.cap||8)+ +id));
 else if(a==='rtn'){const steps=rtSteps(RT.mode),pos=steps.indexOf(RT.i);rtStep(RT.mode,steps[Math.max(0,Math.min(steps.length-1,pos+ +id))])}
 else if(a==='rtm')rtOpen(id);
 else if(a==='rtgo'){rtOpen(id);S.view='rotina';Q='';$('#q').value=''}
 else if(a==='rtrestart'){rtStep(RT.mode,rtSteps(RT.mode)[0]);toast('Rotina reiniciada; seus registros foram mantidos')}
 else if(a==='rtd'){S.rot=Object.assign({},S.rot);S.rot[T]=Object.assign({},S.rot[T],{[RT.mode]:1});rtStep(RT.mode,rtSteps(RT.mode)[0]);S.view='dash';toast(RT.mode==='m'?'Bom dia! Rotina concluída.':'Boa noite! Rotina concluída.')}
 else if(a==='rtplan'){const t=S.tasks.find(x=>x.id===id);if(t&&!t.done){t.hd=ds(add(today,1));toast('Planejada para amanhã; prazo mantido')}}
 else if(a==='rtdeadline'){const t=S.tasks.find(x=>x.id===id);if(t&&!t.done){t.due=ds(add(today,1));toast('Prazo alterado para amanhã')}}
 else if(a==='rtmove'){const tm=ds(add(today,1));S.tasks.forEach(t=>{if(!t.done&&(t.hd===T||(t.due&&t.due<=T)))t.hd=tm});toast('Pendências planejadas para amanhã; prazos mantidos')}
 else if(a==='rtadd'){const i=$('#rtnew'),v=i&&i.value.trim();if(v){S.tasks.unshift({id:uid(),t:v,done:false,p:'m',due:'',hd:ds(add(today,1))});if(S.rot[T])S.rot[T].draft='';toast('Tarefa planejada para amanhã')}}
 else if(a==='trres')trashRestore(id);
 else if(a==='trdel'){S.trash=S.trash.filter(x=>x.b!==id);toast('Excluído de vez')}
 else if(a==='trall'){S.trash=[];toast('Lixeira esvaziada')}
 else if(a==='rperm'){try{Notification.requestPermission().then(()=>render())}catch(e){toast('Este navegador não permite notificações')}return}
 else if(a==='pwainst'){pwaInstall();return}
 else if(a==='rtest')notify('Aviso de teste','Os lembretes estão funcionando.');
 else return;
 trashFlush(TB);
 if(/^(ed|edtx|edrec|edbill|fcancel|reccancel|billcancel|cancel)$/.test(a))render();else renderKeepDraft();
 if(a==='rd-open'){const detail=document.querySelector('#book-detail');if(detail){detail.scrollIntoView({block:'nearest',behavior:SMOOTH()});detail.focus({preventScroll:true})}}
 if(a==='ed'||a==='edtx'){window.scrollTo(0,0);const i=document.querySelector('form.bar input');if(i)i.focus()}
 if(a==='edrec'||a==='edbill'){const f=document.querySelector(a==='edrec'?'#frec':'#fbill');if(f){f.scrollIntoView({block:'nearest'});const i=f.querySelector('input');if(i)i.focus()}}
});
function validBackup(d){
 const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),list=x=>Array.isArray(x)&&x.every(obj),optional=(o,k,test)=>o[k]===undefined||test(o[k]),str=x=>typeof x==='string',date=x=>str(x)&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(new Date(x+'T12:00').getTime())&&ds(new Date(x+'T12:00'))===x;
 if(!obj(d)||!list(d.tasks)||!list(d.events))return false;
 if(d.tasks.some(x=>!optional(x,'t',str)||!optional(x,'due',str)||!optional(x,'hd',str)||!optional(x,'dd',str)||!optional(x,'sub',list)))return false;
 if(d.events.some(x=>!str(x.t)||!date(x.d)||!str(x.h)))return false;
 for(const k of ['notes','links','habits','metas','inbox','reads','trash','lnk','sp'])if(!optional(d,k,list))return false;
 for(const k of ['fin','dia','fm','rev','revm','fpj','rem','rot','rotPrefs','revprefs'])if(!optional(d,k,obj))return false;
 if(!optional(d,'availability',x=>obj(x)&&Object.entries(x).every(([k,ws])=>/^[0-6]$/.test(k)&&list(ws)&&ws.every(w=>str(w.id)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(w.start)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(w.end)&&w.start<w.end))))return false;
 if(!optional(d,'menu',x=>x===null||obj(x)))return false;
 if(!optional(d,'cards',x=>x===null||list(x)))return false;
 if(d.cards&&d.cards.some(x=>!str(x.id)))return false;
 if(d.menu&&(!optional(d.menu,'groups',list)||!optional(d.menu,'bar',Array.isArray)||!optional(d.menu,'hidden',Array.isArray)||(d.menu.groups&&d.menu.groups.some(g=>!Array.isArray(g.items)))))return false;
 if(d.dia&&Object.values(d.dia).some(x=>!obj(x)))return false;
 for(const k of ['focus','profileName','themeMode','pal','acc'])if(!optional(d,k,x=>typeof x==='string'))return false;
 if(d.notes&&d.notes.some(n=>{if(!optional(n,'updatedAt',x=>Number.isFinite(x)&&!Number.isNaN(new Date(x).getTime()))||!optional(n,'archived',x=>typeof x==='boolean')||!optional(n,'revisit',x=>typeof x==='boolean')||!optional(n,'t',x=>typeof x==='string')||!optional(n,'b',x=>typeof x==='string')||!optional(n,'g',x=>typeof x==='string')||!optional(n,'budget',v=>typeof v==='number'&&Number.isFinite(v)&&v>=0))return true;return n.kind==='shopping'&&(!list(n.items)||n.items.some(x=>typeof x.id!=='string'||typeof x.t!=='string'||!optional(x,'q',v=>typeof v==='string')||typeof x.done!=='boolean'||!optional(x,'qty',v=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=10000000))||!optional(x,'unit',v=>typeof v==='string')||!['estimatedCents','actualCents'].every(k=>optional(x,k,v=>v===null||(Number.isSafeInteger(v)&&v>=0&&v<=1000000000))))) }))return false;
 if(d.inbox&&d.inbox.some(x=>typeof x.id!=='string'||typeof x.t!=='string'))return false;
 if(d.habits&&d.habits.some(x=>!obj(x.log)||!optional(x,'perWeek',v=>Number.isInteger(v)&&v>=1&&v<=7)))return false;
 if(d.metas&&d.metas.some(x=>!Array.isArray(x.kr)))return false;
 if(d.reads&&d.reads.some(r=>!optional(r,'cover',x=>Number.isSafeInteger(x)&&x>0)||!optional(r,'coverColor',x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x))||!optional(r,'pages',x=>Number.isInteger(x)&&x>=0)||!optional(r,'page',x=>Number.isInteger(x)&&x>=0)||!optional(r,'df',x=>x===''||date(x))))return false;
 if(d.fin){if(!optional(d.fin,'primary',str))return false;for(const k of ['tx','acc','rec','rules','goals','prules','split','bills'])if(d.fin[k]!=null&&!list(d.fin[k]))return false;if(d.fin.bud!=null&&!obj(d.fin.bud))return false;if(d.fin.budHist!=null&&(!obj(d.fin.budHist)||Object.values(d.fin.budHist).some(c=>!obj(c)||Object.entries(c).some(([m,v])=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)||(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<=0))))))return false;if(d.fin.tx&&d.fin.tx.some(x=>!date(x.d)||x.v===null||x.v===''||!Number.isFinite(+x.v)))return false}
 return true}
document.addEventListener('change',e=>{
 if(e.target.id==='profile-name'){S.profileName=e.target.value.trim().slice(0,60);render();return}
 if(e.target.dataset.rtPref){const [mode,n]=e.target.dataset.rtPref.split(':'),i=+n;if(['m','n'].includes(mode)&&Number.isInteger(i)&&i>=0&&i<4){S.rotPrefs=S.rotPrefs||{};S.rotPrefs[mode]=Object.assign({},S.rotPrefs[mode],{[i]:e.target.checked});const steps=rtSteps(mode);if(!steps.includes(RT.i))rtStep(mode,steps[0]);render();const d=document.querySelector('#rt-prefs');if(d)d.open=true}return}
 if(e.target.id==='note-type'||e.target.id==='note-status'){if(e.target.id==='note-type')NTYPE=e.target.value;else NSTATUS=e.target.value;PG.nt=30;renderKeepDraft();return}
 if(e.target.dataset.noteColor){const n=S.notes.find(x=>x.id===e.target.dataset.noteColor),c=e.target.value,card=e.target.closest('.note');if(n&&card&&NOTE_COLORS.some(x=>x[0]===c)){n.c=c;noteTouch(n);card.classList.remove(...NOTE_COLORS.map(x=>'c-'+x[0]));card.classList.add('c-'+c);save()}return}
 if(e.target.dataset.shoppingBudget){const n=S.notes.find(x=>x.id===e.target.dataset.shoppingBudget&&x.kind==='shopping'),v=e.target.value.trim(),amount=num(v);if(n){if(!v)delete n.budget;else if(Number.isFinite(amount)&&amount>=0)n.budget=Math.round(amount*100)/100;else{toast('Informe uma estimativa válida');return}noteTouch(n);renderKeepDraft()}return}
 if(e.target.dataset.shoppingCheck){const n=S.notes.find(x=>x.id===e.target.dataset.shoppingCheck&&x.kind==='shopping'),item=n&&n.items.find(x=>x.id===e.target.dataset.id);if(item){item.done=e.target.checked;noteTouch(n)}renderKeepDraft();return}
 if(e.target.dataset.revshow){S.revprefs=Object.assign({},S.revprefs||{},{[e.target.dataset.revshow]:e.target.checked});render();return}
 if(e.target.id==='bkmerge'){if(LOCAL_CORRUPT){const m=$('#bkmsg');if(m)m.textContent='Restaure um arquivo ou traga os dados da nuvem antes de mesclar.';e.target.value='';return}const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{let msg;try{const j=JSON.parse(r.result),d=j.data||j;if(!validBackup(d))throw 0;const previous=JSON.stringify(S),wasCorrupt=LOCAL_CORRUPT;if(!snapPut('Antes de importar mesclando')){const m=$('#bkmsg');if(m)m.textContent='Não foi possível guardar a versão atual. Exporte um backup e libere espaço.';return}const inc={};SK.forEach(k=>{if(k in d)inc[k]=d[k]});if(Array.isArray(inc.links))inc.links=inc.links.filter(l=>l&&safeUrl(l.u)!=='#');applyState(merge3(undefined,pick(),inc));S.seeded=true;if(!save()){S=JSON.parse(previous);LOCAL_CORRUPT=wasCorrupt;applyTheme();undoReset();render();const m=$('#bkmsg');if(m)m.textContent='Não foi possível salvar a importação. Os dados anteriores foram mantidos.';return}render();msg='Backup mesclado com os dados deste aparelho. A versão anterior foi guardada em Versões automáticas.'}catch(x){msg='Arquivo inválido. Escolha um backup gerado por este painel.'}const m=$('#bkmsg');if(m)m.textContent=msg};r.readAsText(f);e.target.value='';return}
 if(e.target.id==='bkfile'){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{let msg;try{const j=JSON.parse(r.result),d=j.data||j;if(!validBackup(d))throw 0;const previous=JSON.stringify(S),wasCorrupt=LOCAL_CORRUPT;if(!LOCAL_CORRUPT&&!snapPut('Antes de restaurar um arquivo')){const m=$('#bkmsg');if(m)m.textContent='Não foi possível guardar a versão atual. Exporte um backup e libere espaço.';return}['events','notes','tasks','links','inbox'].forEach(k=>{S[k]=Array.isArray(d[k])?d[k]:[]});S.links=S.links.filter(l=>l&&safeUrl(l.u)!=='#');S.seeded=true;S.availability=d.availability||{};if(d.goal)S.goal=d.goal;if(d.focus!=null)S.focus=d.focus;['pal','acc','themeMode','profileName','cards','menu','rev','revprefs','habits','fm','fpj','fin','dia','metas','revm','rot','rotPrefs','reads'].forEach(k=>{if(d[k]!=null)S[k]=d[k]});applyTheme();LOCAL_CORRUPT=false;if(!save()){S=JSON.parse(previous);LOCAL_CORRUPT=wasCorrupt;applyTheme();undoReset();render();const m=$('#bkmsg');if(m)m.textContent='Não foi possível salvar a restauração. Os dados anteriores foram mantidos.';return}render();msg='Backup restaurado.'+(wasCorrupt?'':' A versão anterior foi guardada em Versões automáticas.')}catch(x){msg='Arquivo inválido. Escolha um backup gerado por este painel.'}const m=$('#bkmsg');if(m)m.textContent=msg};r.readAsText(f);return}
 const cg=e.target.closest('[data-a="ctog"]');if(cg){const L2=cfg();L2.find(y=>y.id===cg.dataset.id).on=cg.checked;S.cards=L2;render();return}
 const c=e.target.closest('[data-a="tog"]');
 if(c){const t=S.tasks.find(x=>x.id===c.dataset.id);t.done=c.checked;t.dd=c.checked?T:'';if(t.done&&t.rc&&!t.sp){t.sp=true;const nd=nextDue(t);S.tasks.splice(S.tasks.indexOf(t),0,{...t,id:uid(),bk:null,done:false,dd:'',sp:false,pm:0,due:nd,sub:(t.sub||[]).map(s=>({...s,id:uid(),done:false}))});toast('Próxima ocorrência criada para '+fmt(nd))}renderKeepDraft()}
});
document.addEventListener('input',e=>{
 const t=e.target;
 if(t.form){const k=noteDraftKey(t.form);if(k&&t.name)(NOTE_DRAFTS[k]=NOTE_DRAFTS[k]||{})[t.name]=t.value}
 if(t.id==='note-search'){const pos=t.selectionStart;NQ=t.value;PG.nt=30;renderKeepDraft();const i=$('#note-search');if(i)i.setSelectionRange(pos,pos);return}
 if(t.dataset.rm){const k=t.dataset.mo;(S.revm[k]=S.revm[k]||{})[t.dataset.rm]=t.value;save();return}
 if(t.dataset.dk){const d=t.dataset.dd;(S.dia[d]=S.dia[d]||{})[t.dataset.dk]=t.value;save();return}
 if(t.dataset.rv){const w=t.dataset.wk;(S.rev[w]=S.rev[w]||{})[t.dataset.rv]=t.value;save();return}
 if(t.id==='acc'){S.acc=t.value;applyTheme();save();return}
 if(t.dataset.rdf){const r=(S.reads||[]).find(x=>x.id===t.dataset.id);if(r){r[t.dataset.rdf]=t.value;save()}return}
 if(t.dataset.rdp){const r=(S.reads||[]).find(x=>x.id===t.dataset.rdp);if(r){r.p=+t.value;if(r.pages)r.page=Math.round(r.pages*r.p/100);if(t.previousElementSibling)t.previousElementSibling.textContent=t.value+'%';save()}return}
 if(t.id==='rd-search'){const pos=t.selectionStart;RD.q=t.value;renderKeepDraft();const i=$('#rd-search');if(i)i.setSelectionRange(pos,pos);return}
 if(t.id==='fo'){(S.dia[T]=S.dia[T]||{}).focus=t.value;save();return}
 if(t.id==='rtnew'){(S.rot[T]=S.rot[T]||{}).draft=t.value;save();return}
 if(t.id==='archive-search'){const pos=t.selectionStart;archiveQuery=t.value;render();const i=$('#archive-search');if(i){i.focus();i.setSelectionRange(pos,pos)}return}
 if(t.id==='q'){Q=t.value.trim();render();return}
 if(t.dataset.n){const n=S.notes.find(x=>x.id===t.dataset.n);if(!n)return;n[t.dataset.f]=t.isContentEditable?clean(t.innerHTML):t.value;noteTouch(n);save();if(/^[fg]$/.test(t.dataset.f)){const el=$('#nfil');if(el)el.innerHTML=nFilters()}}
});
document.addEventListener('submit',e=>{
 e.preventDefault();
 const f=e.target;if(f.id==='profile-create'){try{profileCreate(f.elements.name.value);render();toast('Perfil salvo neste navegador')}catch(err){toast(err.message||'Não foi possível salvar o perfil')}return}if(f.id==='export-selective'||f.id==='export-table'){const status=f.parentElement.querySelector('[data-export-status]');if(LOCAL_CORRUPT){status.textContent='Recupere os dados antes de exportar.';return}if(f.id==='export-selective'){const areas=[...f.querySelectorAll('[name=area]:checked')].map(x=>x.value).filter(x=>Object.hasOwn(SELECT_AREAS,x));if(!areas.length){status.textContent='Selecione ao menos uma área.';return}siteSave('meu-hub-selecao-'+stamp()+'.json',selectJSON(areas));status.textContent='Áreas exportadas: '+areas.map(x=>SELECT_AREAS[x]).join(', ')+'.'}else{const area=f.elements.area.value,csv=selectCSV(area);if(csv===null){status.textContent='Escolha uma tabela válida.';return}siteSave('meu-hub-'+area+'-'+stamp()+'.csv',csv,'text/csv;charset=utf-8');status.textContent='Tabela exportada.'}return}if(f.id==='purchase-simulator'){const v=Object.fromEntries(new FormData(f)),out=f.parentElement.querySelector('[data-simulation-result]');try{const raw=String(v.amount||'').trim().replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw Error('valor');const r=simulatePurchase(S.fin,v.account,v.date,Math.round(Number(raw)*100),Number(v.parts),Number(v.rate),T);out.textContent='Período: '+fmt(r.start)+' a '+fmt(r.end)+'. Total da compra: '+BRL(r.total/100)+'. Base: saldo final '+BRL(r.base/100)+'; menor saldo diário '+BRL(r.minBase/100)+'. Com compra: saldo final '+BRL(r.scenario/100)+'; menor saldo diário '+BRL(r.minScenario/100)+'.';}catch(err){out.textContent='Confira conta, valor, data, parcelas e juros.'}return}if(f.id==='bulk-plan'){f.querySelector('[data-a=bulk-preview]').click();return}const v=Object.fromEntries(new FormData(f));
 if(f.id==='availability-form'){const day=String(v.day),start=v.start,end=v.end,all=S.availability||{},current=Array.isArray(all[day])?all[day]:[],valid=/^[0-6]$/.test(day)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end)&&start<end&&!current.some(w=>start<w.end&&w.start<end);if(!valid){toast('Confira os horários: o fim deve ser posterior ao início e as janelas não podem se sobrepor.');return}S.availability=Object.assign({},all,{[day]:[...current,{id:uid(),start,end}]});toast('Janela adicionada')}
 if(f.id==='task-template'){const tpl=TASK_TEMPLATES.find(t=>t.id===v.template);if(!tpl)return;S.tasks.unshift({id:uid(),t:tpl.title,done:false,p:'m',due:v.date||(['1','7','30'].includes(v.offset)?ds(add(today,+v.offset)):''),sub:tpl.items.map(t=>({id:uid(),t,done:false}))});toast('Tarefa criada a partir do modelo')}
 if(f.id==='ffin')finSubmit(v);
 if(f.id==='facc'){const F=finInit();F.acc.push({id:uid(),n:v.n.trim(),ty:v.ty,ini:num(v.ini)||0,lim:+v.lim||0,close:+v.close||0,due:+v.due||0});toast('Conta adicionada')}
 if(f.dataset.accEdit){const F=finInit(),a=F.acc.find(x=>x.id===f.dataset.accEdit),name=(v.n||'').trim();if(!a||!name){toast('Informe um nome para a conta');return}if(a.ty==='card'){const lim=+v.lim,close=+v.close,due=+v.due,changed=close!==(a.close||28)||due!==(a.due||10);if(!Number.isFinite(lim)||lim<0||!Number.isInteger(close)||close<1||close>31||!Number.isInteger(due)||due<1||due>31){toast('Confira o limite e os dias do cartão');return}if(changed&&!v.confirm){toast('Confirme o impacto das datas antes de salvar');return}if(close!==(a.close||28)&&F.tx.some(t=>t.to===a.id&&t.invoice)){toast('O fechamento não pode mudar enquanto houver pagamentos vinculados a faturas');return}Object.assign(a,{lim,close,due})}a.n=name;toast('Conta atualizada')}
 if(f.id==='frec'){if(v.reminder&&v.k!=='out'){toast('O lembrete integrado está disponível para despesas');return}const F=finInit(),x=num(v.v),day=Math.min(31,Math.max(1,+v.day||1));if(x>0){const er=RED?F.rec.find(r=>r.id===RED):null,cat=v.k==='in'?'Receita':(v.cat||ruleCat(v.t));if(er){Object.assign(er,{k:v.k,t:v.t.trim(),v:x,cat,ac:v.ac,day,end:v.end||''});const tid='r_'+er.id+'_'+T.slice(0,7),tx0=F.tx.find(t=>t.id===tid);if(tx0)Object.assign(tx0,{k:er.k,t:er.t,v:er.v,cat:er.cat,ac:er.ac,d:ds(new Date(today.getFullYear(),today.getMonth(),Math.min(day,dimOf(today.getFullYear(),today.getMonth()))))});recReminderUpdate(er);RED=null;toast('Recorrência atualizada')}else{const r={id:uid(),k:v.k,t:v.t.trim(),v:x,cat,ac:v.ac,day,ini:T,end:v.end||''};F.rec.push(r);if(v.reminder)recReminder(r);const n=genRec();toast('Recorrência criada'+(n?' ('+n+' lançamentos gerados)':''))}}}
 if(f.id==='frule')ruleSave(v);
 if(f.id==='fbud'){const x=num(v.v),month=v.month||ds(new Date(today.getFullYear(),today.getMonth()+S.fmo,1)).slice(0,7);if(!Number.isFinite(x)||x<=0||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){toast('Informe um valor e mês válidos');return}setBudget(v.cat,month,Math.round(x*100)/100);toast('Orçamento de '+BRL(x)+' válido a partir de '+month)}
 if(f.dataset.invoiceLink){const F=finInit(),a=F.acc.find(x=>x.id===f.dataset.invoiceLink&&x.ty==='card'),t=F.tx.find(x=>x.id===v.tx),end=f.dataset.end,offset=(+end.slice(0,4)-today.getFullYear())*12+(+end.slice(5,7)-1-today.getMonth()),iv=a&&invoice(a,offset);if(!v.confirm||!iv||iv.end!==end||!t||t.k!=='tr'||t.to!==a.id||t.invoice||!(t.v>0)||t.v>iv.left+.001){toast('Confira a transferência e o valor restante da fatura');return}t.invoice=end;toast('Pagamento associado à fatura')}
 finSubE(f,v);
 if(f.id==='fgoal'){const x=parseFloat(String(v.v).replace(',','.'));if(x>0)S.fin.goals.push({id:uid(),n:v.n.trim(),target:x,saved:0})}
 if(f.id==='fbill'){if(v.ac&&!finInit().acc.some(a=>a.id===v.ac&&a.ty!=='card')){toast('Escolha uma conta de pagamento válida');return}const x=num(v.v),dy=Math.min(31,Math.max(1,+v.day||1));if(x>0){const eb=BED?S.fin.bills.find(b=>b.id===BED):null;if(eb){Object.assign(eb,{n:v.n.trim(),v:x,day:dy});if(!eb.rec)eb.ac=v.ac||'';const rr=eb.rec&&S.fin.rec.find(r=>r.id===eb.rec);if(rr){Object.assign(rr,{t:eb.n,v:x,day:dy});recReminderUpdate(rr);const tx=S.fin.tx.find(t=>t.id==='r_'+rr.id+'_'+T.slice(0,7));if(tx)Object.assign(tx,{t:rr.t,v:rr.v,d:ds(new Date(today.getFullYear(),today.getMonth(),Math.min(dy,dimOf(today.getFullYear(),today.getMonth()))))})}const ev=eb.eid&&S.events.find(e=>e.id===eb.eid);if(ev){const y=+ev.d.slice(0,4),m=+ev.d.slice(5,7)-1;ev.t='Conta: '+eb.n+' ('+BRL(x)+')';ev.d=ds(new Date(y,m,Math.min(dy,dimOf(y,m))))}BED=null;toast('Conta fixa atualizada')}else{let y=today.getFullYear(),m=today.getMonth();if(dy<today.getDate())m++;const dt=new Date(y,m,Math.min(dy,new Date(y,m+1,0).getDate())),eid=uid();S.events.push({id:eid,t:'Conta: '+v.n.trim()+' ('+BRL(x)+')',d:ds(dt),h:'09:00',e:'',r:'m',rm:'',c:'p'});S.fin.bills.push({id:uid(),n:v.n.trim(),v:x,day:dy,eid,ac:v.ac||''});toast('Conta adicionada e lembrada na agenda todo mês')}}}
 if(f.dataset.shoppingEdit){const n=S.notes.find(x=>x.id===f.dataset.shoppingEdit&&x.kind==='shopping'),item=n&&n.items.find(x=>x.id===f.dataset.item),t=(v.t||'').trim();if(t&&(!item||JSON.stringify(item)!==SEDBASE)){if(!f.querySelector('[data-a=shopping-recover]')){const d=document.createElement('div');d.setAttribute('role','alert');d.innerHTML='Este item mudou ou foi excluído em outro aparelho. <button type="button" class="pill" data-a="shopping-recover">Salvar como novo item</button> <button type="button" class="pill" data-a="shopping-cancel">Descartar edição</button>';f.appendChild(d)}return}if(item&&t){const prices=shoppingPrices(v);if(!prices){toast('Confira quantidade e preços: use valores positivos e até duas casas decimais para preços.');return}Object.assign(item,prices);item.t=t;item.q=(v.q||'').trim();noteTouch(n);delete NOTE_DRAFTS[noteDraftKey(f)];SED=null;SEDBASE=null}}
 if(f.dataset.shoppingForm){const n=S.notes.find(x=>x.id===f.dataset.shoppingForm&&x.kind==='shopping'),t=(v.t||'').trim();if(n&&t){const prices=shoppingPrices(v);if(!prices){toast('Confira quantidade e preços: use valores positivos e até duas casas decimais para preços.');return}(n.items||(n.items=[])).push({id:uid(),t,q:(v.q||'').trim(),done:false,...prices});noteTouch(n);delete NOTE_DRAFTS[noteDraftKey(f)]}}
 if(f.id==='finbox'){const t=v.t.trim();if(t)(S.inbox||(S.inbox=[])).unshift({id:uid(),t})}
 if(f.id==='fhj')S.tasks.unshift({id:uid(),t:v.t.trim(),done:false,p:'m',hd:T,due:''});
 if(f.id==='frtag'){const nw=normTags(v.nw).split(', ')[0]||'';renameTag(v.old,nw);S.tgsel=nw;toast(nw?'Etiqueta renomeada em tudo':'Etiqueta removida de tudo')}
 if(f.id==='fmeta'){const t=(v.t||'').trim(),n=+v.tg;if(!t||(v.mode==='number'&&(!Number.isFinite(n)||n<1))){toast('Informe o nome e uma quantidade válida');return}const kr=v.mode==='number'?[{id:uid(),ty:'man',ref:'',t, tg:n,un:(v.un||'').trim(),cur:0}]:[];S.metas.unshift({id:uid(),t,ini:T,fim:v.fim||'',kr})}
 if(f.dataset.metaEdit){const g=S.metas.find(x=>x.id===f.dataset.metaEdit),t=(v.t||'').trim();if(!g||!t){toast('Informe o nome da meta');return}g.t=t;g.fim=v.fim||''}
 if(f.dataset.krEdit){const g=S.metas.find(x=>x.id===f.dataset.krEdit),k=g&&g.kr.find(x=>x.id===f.dataset.k&&['man','hb','pc'].includes(x.ty)),t=(v.t||'').trim(),n=+v.tg;if(!k||!t||!Number.isFinite(n)||n<1||(k.ty!=='man'&&!Number.isInteger(n))||(k.ty==='pc'&&n>6)){toast('Informe um nome e objetivo válido');return}k.t=t;k.tg=n;if(k.ty==='man')k.un=(v.un||'').trim()}
 if(f.dataset.metaTask){const g=S.metas.find(x=>x.id===f.dataset.metaTask),t=(v.t||'').trim();if(!g||!t){toast('Informe uma tarefa');return}S.tasks.unshift({id:uid(),t,done:false,p:'m',due:'',mt:g.id})}
 if(f.dataset.kr){const g=S.metas.find(x=>x.id===f.dataset.kr),p=String(v.src||'').split(':'),ty=p.shift(),ref=p.join(':'),n=+v.tg;if(!g||!['man','hb','pc','pj','tg','sv'].includes(ty)||(['man','hb','pc'].includes(ty)&&(!Number.isFinite(n)||n<1||((ty==='hb'||ty==='pc')&&!Number.isInteger(n))||(ty==='pc'&&n>6)))){toast('Informe um objetivo válido para o acompanhamento');return}const hb=S.habits.find(h=>h.id===ref),auto=ty==='hb'?'Praticar "'+(hb?hb.n:'')+'"':ty==='pj'?'Concluir o projeto "'+ref+'"':ty==='tg'?'Concluir tarefas #'+ref:ty==='pc'?'Cumprir "'+((finInit().prules.find(x=>x.id===ref)||{}).k?prName(finInit().prules.find(x=>x.id===ref)):'')+'"':ty==='sv'?'Economizar para "'+((S.fin.goals.find(x=>x.id===ref)||{}).n||'')+'"':'Resultado';g.kr.push({id:uid(),ty,ref,t:(v.t||'').trim()||auto,tg:n||1,un:(v.un||'').trim(),cur:0})}
 if(f.dataset.mt){const t=S.tasks.find(x=>x.id===v.tk),g=S.metas.find(x=>x.id===f.dataset.mt);if(!g||!t||t.mt||t.done){toast('Esta tarefa não está disponível para vinculação');return}t.mt=g.id}
 if(f.id==='fmgrp'){const n=v.n.trim();if(n)menuEdit(m=>{m.groups.push({id:'g'+uid(),n,items:[]})})}
 if(f.id==='frd'){S.reads=S.reads||[];const st=['q','a','f'].includes(v.st)?v.st:'q',t=(v.t||'').trim();if(!t){toast('Informe o título');return}S.reads.unshift({id:uid(),t,a:(v.a||'').trim(),k:RK[v.k]?v.k:'livro',st,u:(v.u||'').trim(),r:0,p:st==='f'?100:0,n:'',da:T,df:st==='f'?(v.df||T):''});toast('Adicionado à lista')}
 if(f.id==='fhb'){const n=+v.perWeek||0;if(!Number.isInteger(n)||n<0||n>7){toast('Escolha uma frequência válida');return}S.habits.push({id:uid(),n:v.n.trim(),log:{},...(n?{perWeek:n}:{})})}
 if(f.id==='fqa'&&QT==='ib'){const t=v.t.trim();if(t){(S.inbox||(S.inbox=[])).unshift({id:uid(),t});qaClose();toast('Guardado na caixa de entrada')}}
 if(f.id==='fqa'&&(QT==='dp'||QT==='rc')){if(QSHOPSESSION&&finInit().tx.some(x=>x.id===QSHOPSESSION)){toast('Esta compra já foi registrada.');qaClose();return}const p=parseFinNL(v.t,v.v,!v.d||v.d===T),n0=finInit().tx.length;finSubmit({k:QT==='dp'?'out':'in',t:p.t,v:p.v,cat:QT==='dp'?(v.cat||''):'',d:p.d||v.d||T,ac:v.ac||'',tg:p.tg||'',pc:1});if(finInit().tx.length>n0){if(QSHOP){Object.assign(finInit().tx[0],{id:QSHOPSESSION,shopping:QSHOP,shoppingItems:(S.notes.find(n=>n.id===QSHOP)?.items||[]).filter(x=>x.done).map(x=>x.id)})}if(QI)S.inbox=(S.inbox||[]).filter(x=>x.id!==QI);qaClose()}}
 if(f.id==='fqa'&&QT==='tk'&&v.dest==='scheduled'&&!v.planned){toast('Escolha a data planejada');return}
 if(f.id==='fqa'&&QT!=='ib'&&QT!=='dp'&&QT!=='rc'){const t=v.t.trim();let msg={tk:'Tarefa adicionada',nt:'Nota criada',ev:'Evento adicionado'}[QT];if(QT==='tk'){const n=parseNL(t,{time:false}),dd=v.due||n.d||'';S.tasks.unshift({id:uid(),t:n.t,done:false,p:'m',due:dd,hd:v.dest==='today'?T:v.dest==='scheduled'?v.planned||'':''});if(!v.due&&n.d)msg+=' para '+fmt(n.d)}else if(QT==='nt'){const folder=S.nf||'';noteReset();S.notes.unshift({id:uid(),t,b:'',f:folder,g:'',c:COL[S.notes.length%4],updatedAt:Date.now()})}else{const n=parseNL(t),def=v.d===T&&v.h==='09:00',dd=def&&n.d?n.d:v.d,hh=def&&n.h?n.h:v.h;S.events.push({id:uid(),t:n.t,d:dd,h:hh,c:COL[S.events.length%4]});if(def&&(n.d||n.h))msg+=': '+fmt(dd)+' às '+hh}if(QI)S.inbox=(S.inbox||[]).filter(x=>x.id!==QI);qaClose();toast(msg)}
 if(f.id==='fev'){const e=cur('ev','events'),o={t:v.t.trim(),d:v.d,h:v.h,e:v.h2&&v.h2>v.h?v.h2:'',r:v.r||'',rm:v.rm||'',tg:normTags(v.tg),c:v.c};let i2;if(e){Object.assign(e,o);i2=e.id}else{i2=uid();S.events.push({id:i2,...o})}ED=null;if(o.rm)askNotif();if(evOn(v.d).some(x=>x.cf&&x.id===i2))toast('Atenção: conflito de horário com outro evento')}
 if(f.id==='ftk'){const e=cur('tk','tasks'),nl=(!e&&!v.due)?parseNL(v.t,{time:false}):{t:v.t.trim(),d:null},o={t:nl.t,p:v.p,due:v.due||nl.d||'',dur:+v.dur||0,pj:(v.pj||'').trim(),rc:v.rc||'',tg:normTags(v.tg)};if(e)Object.assign(e,o);else S.tasks.unshift({id:uid(),done:false,...o});ED=null}
 if(f.id==='flk'){let u=v.u.trim();if(!/^https?:\/\//i.test(u))u='https://'+u;const e=cur('lk','links');S.links.forEach(x=>{if(v.k&&x.k===v.k)x.k=''});if(e)Object.assign(e,{n:v.n.trim(),u,cat:v.cat,k:v.k,tg:normTags(v.tg)});else S.links.push({id:uid(),n:v.n.trim(),u,cat:v.cat,k:v.k,tg:normTags(v.tg),c:COL[S.links.length%4]});ED=null}
 render();
 if(f.id==='fmeta'){const card=document.querySelector('[data-lid="mt:'+S.metas[0].id+'"]');if(card)(card.querySelector(v.mode==='number'?'[data-krset]':'[data-meta-task] input')||card).focus()}
});
{const up=new URLSearchParams(location.search),uv=up.get('v'),uqa=up.get('qa');if(uv&&V[uv])S.view=uv;if(uv||uqa)try{history.replaceState(null,'',location.pathname)}catch(e){}render();if(uqa&&/^(tk|nt|ev|dp|rc)$/.test(uqa))qa(uqa)}
fbInit();// por último: as respostas do Firebase chamam render() e o resto do app, que precisam já estar carregados
if('serviceWorker' in navigator&&!window.__noSW)navigator.serviceWorker.register('sw.js').catch(()=>{});
