// recursos: abas das finanças, busca, desfazer, menu lateral, acessibilidade, lixeira, lembretes, rotina, leituras, paleta de comandos, privacidade, versões, datas
/* ===== Abas das Finanças, despesa na captura rápida, busca ampliada, vencimentos e desfazer geral ===== */
const FTABS=[['geral','Visão geral'],['analise','Análises'],['lanc','Lançamentos'],['orc','Orçamentos e metas'],['contas','Contas e recorrentes'],['regras','Regras e importação']];
function financas(){
 if(S.fvw==='ano')return relAnual();
 const tab=FTABS.some(x=>x[0]===S.ftab)?S.ftab:'geral';
 return financasMes(tab)+(tab==='geral'||tab==='analise'?simulationPanel():'');
}
/* captura rápida com despesa e receita */
function qa(t){
 const old=$('#fqa input[name=t]'),same=old&&old.form.dataset.qi===(QI||'')&&old.form.dataset.qshop===(QSHOP||''),draft=same?old.value:'';if(same)QD[QT]=Object.fromEntries(new FormData(old.form));else QD={};if(t)QT=t;const el=$('#qa'),F=finInit();el.classList.remove('hide');
 const pb=(k,l)=>`<button type="button" class="pill ${QT===k?'on':''}" data-a="qat" data-id="${k}">${l}</button>`,money=QT==='dp'||QT==='rc';
 el.innerHTML=`<form class="panel bar" id="fqa"><div class="bar" style="width:100%;margin:0">${QI?'':pb('ib','Guardar para depois')}${pb('tk','Tarefa')}${pb('nt','Nota')}${pb('ev','Evento')}${pb('dp','Despesa')}${pb('rc','Receita')}<button type="button" class="x" data-a="qax" aria-label="Fechar" style="margin-left:auto">×</button></div><input class="in grow" name="t" placeholder="${{ib:'O que você quer lembrar?',tk:'Nova tarefa',nt:'Título da nota',ev:'Novo evento',dp:'Descrição (ex.: mercado 85,90 ontem)',rc:'Descrição (ex.: freela 500 hoje)'}[QT]}" required>${money?`<input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor (ou na descrição)" aria-label="Valor" style="width:140px"><input class="in" type="date" name="d" value="${T}" required aria-label="Data">${QT==='dp'?`<select class="in" name="cat" aria-label="Categoria">${catOpts('')}</select>`:''}${F.acc.length>1?`<select class="in" name="ac" aria-label="Conta ou cartão">${accOpts('')}</select>`:''}`:''}${QT==='ev'?`<input class="in" type="date" name="d" value="${T}" required aria-label="Data"><input class="in" type="time" name="h" value="09:00" required aria-label="Hora">`:''}${QT==='tk'?'<label class="lb">Prazo (opcional) <input class="in" type="date" name="due" aria-label="Prazo"></label>':''}<button class="pill dark">Adicionar</button></form>`;
 if(QT==='tk'){const f=el.querySelector('form'),submit=f.querySelector('button.pill.dark');submit.insertAdjacentHTML('beforebegin','<label class="lb">Planejar para <select class="in" name="dest"><option value="later">Sem data planejada</option><option value="today">Hoje</option><option value="scheduled">Outra data</option></select></label><label class="lb" data-qa-planned hidden>Data planejada <input class="in" type="date" name="planned" disabled></label>')}
 const input=el.querySelector('input[name=t]'),item=(S.inbox||[]).find(x=>x.id===QI),f=input.form;f.dataset.qi=QI||'';f.dataset.qshop=QSHOP||'';Object.entries(QD[QT]||{}).forEach(([k,v])=>{if(k!=='t'&&f.elements[k])f.elements[k].value=v});if(f.elements.dest)f.elements.dest.dispatchEvent(new Event('change',{bubbles:true}));if(QD[QT]&&QD[QT].planned)f.elements.planned.value=QD[QT].planned;input.value=same?draft:item?item.t:'';input.focus()}
document.addEventListener('change',e=>{const i=e.target;if(i.name!=='dest'||!i.form||i.form.id!=='fqa')return;const on=i.value==='scheduled',f=i.form,pl=f.elements.planned;if(pl._dtText){pl.disabled=!on;pl.dataset.req=on?'1':'0';pl.required=false;pl._dtSync()}else{pl.disabled=!on;pl.required=on}f.querySelector('[data-qa-planned]').hidden=!on});
function inboxPanel(){const L=S.inbox||[];return `<div class="panel" style="margin-top:var(--space-3)"><h2>Caixa de entrada</h2><p class="empty" style="padding:0 0 var(--space-2)">Guarde uma ideia agora e escolha depois o que fazer com ela.</p><form class="bar" id="finbox"><input class="in grow" name="t" aria-label="Captura para a caixa de entrada" placeholder="O que você quer lembrar?" required><button class="pill dark">Capturar</button></form>${L.map(x=>`<div class="item"><div class="t">${esc(x.t)}</div><button class="pill" data-a="inboxconvert" data-id="${esc(x.id)}">Organizar</button><button class="x" data-a="inboxdel" data-id="${esc(x.id)}" aria-label="Excluir ${esc(x.t)}">×</button></div>`).join('')||'<p class="empty">Nenhuma captura pendente.</p>'}</div>`}
function shoppingSessionItems(form){const n=S.notes.find(x=>x.id===form.dataset.qshop&&x.kind==='shopping');if(!n||!form.dataset.shoppingSnapshot)return null;let snapshot;try{snapshot=JSON.parse(form.dataset.shoppingSnapshot)}catch(e){return null}const selected=[...form.querySelectorAll('[name=shoppingItem]:checked')].map(x=>x.value),items=selected.map(id=>(n.items||[]).find(x=>x.id===id));if(new Set(selected).size!==selected.length||items.some((x,i)=>!x||!snapshot.some(s=>s.id===selected[i]&&s.value===JSON.stringify(x))))return null;return items}
function shoppingSessionUpdate(form,updatePrice=true){const items=shoppingSessionItems(form);if(!items)return;const total=shoppingTotals(items,'actualCents'),value=items.length&&!total.missing?total.value.toFixed(2).replace('.',','):'';if(updatePrice&&(!form.elements.v.value||form.elements.v.value===form.dataset.autoPrice))form.elements.v.value=value;if(updatePrice)form.dataset.autoPrice=value;const ids=new Set(items.map(x=>x.id)),repeated=(S.fin.tx||[]).filter(t=>t.shopping===form.dataset.qshop&&(t.shoppingItems||[]).some(id=>ids.has(id)));const ac=form.elements.ac?.value||S.fin.acc[0]?.id,amount=num(form.elements.v.value),date=form.elements.d.value,similar=(S.fin.tx||[]).filter(t=>t.k==='out'&&!t.shopping&&t.d===date&&(t.ac||S.fin.acc[0]?.id)===ac&&amount>0&&Math.abs((+t.v||0)-amount)<.005),warning=form.querySelector('[data-shopping-repeat]');if(warning){const key=JSON.stringify([repeated.map(x=>x.id).sort(),similar.map(x=>x.id).sort(),items.map(x=>x.id).sort(),amount,date,ac]);if(warning.dataset.key!==key)warning.querySelector('input').checked=false;warning.dataset.key=key;warning.hidden=!(repeated.length||similar.length);warning.querySelector('span').textContent=(repeated.length?'Há itens já associados a '+repeated.length+' compra(s). ':'')+(similar.length?'Há '+similar.length+' despesa(s) sem associação com mesmo valor, data e conta; você pode associar uma delas. ':'')+'Confirmo que esta é uma compra diferente.'}return repeated.length+similar.length}
function shoppingSessionForm(n,form){const items=n.items||[],box=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Itens desta compra';box.append(legend);form.dataset.shoppingSnapshot=JSON.stringify(items.map(x=>({id:x.id,value:JSON.stringify(x)})));items.forEach(x=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name='shoppingItem';input.value=x.id;input.checked=!!x.done;label.className='item';label.append(input,document.createTextNode(' '+x.t));box.append(label)});if(!items.length){const p=document.createElement('p');p.className='empty';p.textContent='Lista sem itens: informe o valor da compra.';box.append(p)}const warning=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');warning.dataset.shoppingRepeat='';warning.hidden=true;check.type='checkbox';check.name='shoppingRepeatConfirmed';warning.append(check,document.createTextNode(' '),text);form.append(box,warning);form.dataset.autoPrice=form.elements.v.value;shoppingSessionUpdate(form)}
document.addEventListener('change',e=>{if(['shoppingItem','d','ac','v'].includes(e.target.name)&&e.target.form?.id==='fqa'&&QSHOP)shoppingSessionUpdate(e.target.form,e.target.name==='shoppingItem')});
document.addEventListener('input',e=>{if(e.target.name==='v'&&e.target.form?.id==='fqa'&&QSHOP)shoppingSessionUpdate(e.target.form,false)});
function shoppingAssociationForm(n,done,total,form){const candidates=(S.fin.tx||[]).filter(t=>t.k==='out'&&!t.shopping&&t.id).sort((a,b)=>b.d.localeCompare(a.d));if(!candidates.length)return;const box=document.createElement('details'),summary=document.createElement('summary'),info=document.createElement('p'),label=document.createElement('label'),select=document.createElement('select'),button=document.createElement('button');summary.textContent='Associar a uma despesa existente';info.className='empty';info.textContent='Confira os dados e confirme. A associação preserva o valor, data, conta e categoria do lançamento. Um valor igual pode ser uma compra diferente.';label.className='lb';label.append('Despesa ');select.className='in';select.name='shoppingAssociation';const empty=document.createElement('option');empty.value='';empty.textContent='Escolha um lançamento';select.append(empty);candidates.forEach(t=>{const o=document.createElement('option'),possible=done.length&&!total.missing&&Math.abs((+t.v||0)-total.value)<.005;o.value=t.id;o.dataset.transaction=JSON.stringify(t);o.textContent=(possible?'Possível duplicata · ':'')+t.d+' · '+t.t+' · '+BRL(t.v)+' · '+accName(t.ac||S.fin.acc[0].id)+' · '+(t.cat||'Sem categoria');select.append(o)});label.append(select);button.type='button';button.className='pill';button.dataset.a='shopping-associate';button.textContent='Confirmar associação';box.append(summary,info,label,button);form.append(box)}
async function shoppingShare(id){const n=S.notes.find(x=>x.id===id&&x.kind==='shopping');if(!n)return;const text=n.t+'\n'+(n.items||[]).map(x=>(x.done?'☑ ':'☐ ')+x.t+(x.q?' · '+x.q:'')).join('\n');try{if(navigator.share)await navigator.share({title:n.t,text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);toast('Lista copiada para a área de transferência')}else toast('Compartilhamento indisponível neste navegador')}catch(e){if(e.name!=='AbortError')toast('Não foi possível compartilhar a lista')}}
/* vencimentos na tela Hoje */
function dues(n){
 const F=finInit(),out=[],end=ds(add(today,n)),push=(d,t,v,k,x)=>out.push({d,t,v,k,...(x||{})});
 F.bills.filter(b=>!b.rec||!F.rec.some(r=>r.id===b.rec)).forEach(b=>{for(let i=0;i<=n;i++){const d=add(today,i),dd=Math.min(+b.day||1,dimOf(d.getFullYear(),d.getMonth()));if(d.getDate()===dd)push(ds(d),b.n,b.v,'bill',{id:b.id,account:b.ac?accName(b.ac):'Conta não vinculada'})}});
 F.acc.filter(a=>a.ty==='card').forEach(a=>[-1,0,1].forEach(o=>{const iv=invoice(a,o);if(iv.left>0&&iv.due>=T&&iv.due<=end)push(iv.due,'Fatura '+a.n,iv.left,'card',{id:a.id,o,account:'Conta de pagamento não vinculada'})}));
 F.tx.forEach(t=>{if(t.k==='tr'||t.d<=T||t.d>end)return;const a=F.acc.find(x=>x.id===accId(t));if(a&&a.ty==='card')return;push(t.d,t.t,t.v,t.k==='in'?'in':'sched',{account:t.ac?accName(t.ac):'Conta não vinculada',subscription:t.k==='out'&&t.cat==='Assinaturas'&&!!t.rc,installment:t.pc?t.pc.i+'/'+t.pc.n:''})});
 F.rec.forEach(r=>{for(let i=1;i<=n;i++){const d=add(today,i),iso=ds(d),dd=Math.min(+r.day||1,dimOf(d.getFullYear(),d.getMonth())),id='r_'+r.id+'_'+iso.slice(0,7);if(d.getDate()===dd&&(r.ini||T)<=iso&&(!r.end||iso<=r.end)&&!F.tx.some(t=>t.id===id)&&!(r.skip||[]).includes(id))push(iso,r.t,r.v,r.k==='in'?'in':'sched',{account:r.ac?accName(r.ac):'Conta não vinculada',subscription:r.k==='out'&&r.cat==='Assinaturas'})}});
 return out.sort((a,b)=>a.d.localeCompare(b.d))}
function duesPanel(){
 const L=dues(7),td=L.filter(x=>x.d===T),wk=L.filter(x=>x.d>T),month=dues(30).filter(x=>x.k!=='in'),tot=a=>a.filter(x=>x.k!=='in').reduce((s,x)=>s+x.v,0);
 const row=x=>{const dd=mDays(x.d),when=dd===0?'hoje':dd===1?'amanhã':DIA[new Date(x.d+'T00:00').getDay()]+', '+fmt(x.d);
  return `<div class="item"><span class="chip c-${x.k==='card'?'b':x.k==='bill'?'y':x.k==='in'?'g':'p'}">${when}</span><div class="t">${esc(x.t)}<small>${x.subscription?'Assinatura':{card:'Vencimento de fatura',bill:'Conta fixa',sched:'Despesa agendada',in:'Receita prevista'}[x.k]}${x.installment?' · Parcela '+esc(x.installment):''} · ${esc(x.account||'Conta não vinculada')}</small></div><strong class="${x.k==='in'?'pos':''}">${x.k==='in'?'+ ':''}${BRL(x.v)}</strong>${x.k==='card'?`<button class="pill" data-a="payfat" data-id="${x.id}" data-o="${x.o}">Pagar</button>`:''}</div>`};
 return `<div class="panel"><h2>Contas e vencimentos</h2>${L.length?`<p class="empty" style="padding:0 0 var(--space-2)">${td.length?'Hoje: <strong>'+BRL(tot(td))+'</strong> a pagar. ':'Nada vence hoje. '}Próximos 7 dias: <strong>${BRL(tot(wk))}</strong>.</p>${L.map(row).join('')}`:'<p class="empty">Nada a pagar ou receber nos próximos 7 dias. Cadastre contas fixas, recorrentes e cartões em Finanças.</p>'}<p class="empty">Próximos 30 dias: <strong>${BRL(tot(month))}</strong> em valores previstos. Uma conta fixa e uma recorrente podem representar a mesma despesa; confira antes de somar. Lançamentos comuns de hoje não entram nesta previsão.</p>${month.length?`<details><summary>Ver valores previstos</summary>${month.map(row).join('')}</details>`:''}</div>`}
function payInv(id,o){if(!$('#ffin')){S.fvw='mes';S.ftab='lanc';render()}const a=S.fin.acc.find(x=>x.id===id),f=$('#ffin');if(!a||!f)return;const iv=invoice(a,o);if(!iv.left){toast('Esta fatura já foi paga ou agendada');return}f.className='bar ktr advo';const s=(n,v)=>{const el=f.querySelector('[name='+n+']');if(n==='d')dtSet(el,v);else if(el)el.value=v};s('k','tr');s('t','Pagamento da fatura: '+a.n);s('v',iv.left.toFixed(2));s('d',iv.due);s('to',a.id);let marker=f.querySelector('[name=invoice]');if(!marker){marker=document.createElement('input');marker.type='hidden';marker.name='invoice';f.appendChild(marker)}marker.value=iv.end;const x=S.fin.acc.find(y=>y.id!==a.id&&y.ty!=='card');if(x)s('ac',x.id);trValid(f);f.querySelector('[name=t]').focus();window.scrollTo({top:0,behavior:SMOOTH()});toast(iv.legacy?'Há transferência antiga para este cartão; confira antes de lançar.':'Confira a conta e o valor antes de lançar')}
/* busca global ampliada */
function busca(){
 const q=norm(Q),h=x=>norm(x).includes(q),F=finInit(),v=n=>`data-v="${n}"`;
 const sec=(ti,arr,fn,go)=>{if(!arr.length)return '';const sh=arr.slice(0,15);return `<h2>${ti} (${arr.length})</h2>`+sh.map(x=>`<button class="item" style="width:100%;border:0;text-align:left;cursor:pointer;color:inherit" ${go(x)}><div class="t">${fn(x)}</div></button>`).join('')+(arr.length>sh.length?`<p class="empty" style="padding:var(--space-1) 0 var(--space-2)">Mais ${arr.length-sh.length} resultados. Refine a busca.</p>`:'')};
 const fm=t=>(+t.d.slice(0,4)-today.getFullYear())*12+ +t.d.slice(5,7)-1-today.getMonth();
 const out=sec('Caixa de entrada',(S.inbox||[]).filter(x=>h(x.t)),x=>esc(x.t),()=>v('hoje'))
 +sec('Tarefas',S.tasks.filter(t=>!taskPaused(t)&&(h(t.t)||h(t.tg)||h(t.pj))),t=>`${esc(t.t)}<small>${t.done?'Concluída':'Pendente'}${t.due?', prazo '+fmt(t.due):''}</small>`,()=>v('tarefas'))
 +sec('Eventos',S.events.filter(e=>h(e.t)||h(e.d)||h(e.tg)),e=>`${esc(e.t)}<small>${fmt(e.d)} às ${e.h}</small>`,()=>v('agenda'))
 +sec('Notas',S.notes.filter(n=>h(n.t)||h(plain(n.b))||h(n.f)||h(n.g)||(n.items||[]).some(x=>h(x.t))),n=>`${esc(n.t||'Sem título')}<small data-priv-text>${esc(plain(n.b).slice(0,90))}</small>`,n=>`data-a="lkgo" data-id="nt:${esc(n.id)}"`)
 +sec('Links',S.links.filter(l=>h(l.n)||h(l.u)||h(l.tg)||h(l.cat)),l=>`${esc(l.n)}<small>${esc(l.u)}</small>`,()=>v('links'))
 +sec('Lançamentos',F.tx.filter(t=>h(t.t)||h(t.cat)||h(t.sub)||h(t.tg)||h(t.pj)||h(t.d)||h(String(t.v))||h(String(t.v).replace('.',','))).sort((a,b)=>b.d.localeCompare(a.d)),t=>`${esc(t.t)}<small>${fmt(t.d)} · ${t.k==='tr'?'Transferência':esc(t.cat)+(t.sub?' › '+esc(t.sub):'')} · ${t.k==='in'?'+':t.k==='tr'?'':'−'} ${BRL(t.v)}</small>`,t=>`data-a="sgo" data-view="financas" data-tab="lanc" data-fmo="${fm(t)}"`)
 +sec('Metas',S.metas.filter(g=>!g.archived&&(h(g.t)||g.kr.some(k=>h(k.t)))),g=>`${esc(g.t)}<small>${Math.round(metaProg(g)*100)}% concluída</small>`,()=>v('metas'))
 +sec('Projetos',(S.projects||[]).filter(p=>!p.archived&&h(p.t)),p=>`${esc(p.t)}<small>${p.status==='done'?'Concluído':'Em andamento'}</small>`,p=>`data-a="lkgo" data-id="prj:${esc(p.id)}"`)
 +sec('Leituras',(S.reads||[]).filter(r=>h(r.t)||h(r.a)||h(r.n)),r=>`${esc(r.t)}<small>${esc(RK[r.k]?RK[r.k][0]:'')}${r.a?' · '+esc(r.a):''}</small>`,r=>`data-a="lkgo" data-id="rd:${esc(r.id)}"`)
 +sec('Hábitos',S.habits.filter(x=>h(x.n)),x=>`${esc(x.n)}<small>${habitInfo(x)}</small>`,()=>v('habitos'))
 +sec('Diário',Object.keys(S.dia).filter(d=>{const e=S.dia[d];return h(e.a)||h(e.b)||h(e.c)||h(d)}).sort().reverse(),d=>`${fmt(d)}<small data-priv-text>${esc(plain(S.dia[d].a||S.dia[d].b||S.dia[d].c||'').slice(0,90))}</small>`,d=>`data-a="sgo" data-view="diario" data-ddo="${mDays(d)}"`);
 return `<div class="top"><h1>Resultados</h1></div><p class="vh" role="status">${(n=>n+(n===1?' resultado exibido':' resultados exibidos'))((out.match(/class="item"/g)||[]).length)}</p><div class="res">${out||`<div class="empty">Nada encontrado para “${esc(Q)}”.</div>`}</div>`}
/* desfazer e refazer gerais */
let UH=[],UR=[],ULast=null,UTime=0;
function updU(){const a=$('#ub'),b=$('#rb');if(a)a.disabled=!UH.length;if(b)b.disabled=!UR.length}
function undoReset(){UH=[];UR=[];ULast=pickJSON();UTime=0;updU()}
function track(){if(ULast===null)return;const cur=pickJSON();if(cur===ULast)return;const now=Date.now();
 if(now-UTime>900||!UH.length){UH.push(ULast);let tot=UH.reduce((a,s)=>a+s.length,0);while(UH.length>40||tot>12e6)tot-=UH.shift().length}
 UTime=now;ULast=cur;UR=[];updU()}
function undo(){if(!UH.length){toast('Nada para desfazer');return}const prev=UH.pop();UR.push(ULast);const history=S.history;applyState(JSON.parse(prev));S.history=history;auditLog('undo');ULast=pickJSON();UTime=0;toast('Desfeito. Ctrl+Shift+Z refaz.');render()}
function redo(){if(!UR.length){toast('Nada para refazer');return}const nx=UR.pop();UH.push(ULast);const history=S.history;applyState(JSON.parse(nx));S.history=history;auditLog('redo');ULast=pickJSON();UTime=0;toast('Refeito.');render()}
function genRec(){const clean=pickJSON()===ULast,n=genRec0();if(n&&clean)ULast=pickJSON();return n}
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey)return;const k=e.key.toLowerCase();if(k!=='z'&&k!=='y')return;const t=e.target;if(/INPUT|TEXTAREA|SELECT/.test(t.tagName)||t.isContentEditable)return;e.preventDefault();if(k==='y'||e.shiftKey)redo();else undo()});
undoReset();

/* ===== Menu lateral agrupado e personalizável ===== */
const ICO={"home": "<path d=\"M3 11.5L12 4l9 7.5\"/><path d=\"M5.5 10v10h13V10\"/>", "today": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"3.5\"/>", "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6\"/>", "bell": "<path d=\"M6 9a6 6 0 0112 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9\"/><path d=\"M10 20.5a2.2 2.2 0 004 0\"/>", "cal": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15.5\" rx=\"3\"/><path d=\"M3.5 10h17M8 3v4M16 3v4\"/>", "check": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12.5l3 3 5-6\"/>", "flag": "<path d=\"M5.5 21V4\"/><path d=\"M5.5 4.5h12l-2.2 4 2.2 4h-12\"/>", "repeat": "<path d=\"M17 3l4 4-4 4\"/><path d=\"M3 11V9.5A2.5 2.5 0 015.5 7H21\"/><path d=\"M7 21l-4-4 4-4\"/><path d=\"M21 13v1.5a2.5 2.5 0 01-2.5 2.5H3\"/>", "note": "<path d=\"M6 3h8.5L19 7.5V21H6z\"/><path d=\"M14 3v5h5M9 13h6M9 17h6\"/>", "book": "<path d=\"M3 5.5c3-1.2 6-.8 9 1.3 3-2.1 6-2.5 9-1.3v13c-3-1.2-6-.8-9 1.3-3-2.1-6-2.5-9-1.3z\"/><path d=\"M12 6.8v13\"/>", "smile": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8.2 14.2s1.5 2.3 3.8 2.3 3.8-2.3 3.8-2.3\"/><path d=\"M9 9.7h.01M15 9.7h.01\"/>", "link": "<path d=\"M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1\"/>", "tag": "<path d=\"M3 12.5V4h8.5L21 13.5 13.5 21z\"/><circle cx=\"7.5\" cy=\"8.5\" r=\"1.2\"/>", "wallet": "<rect x=\"3\" y=\"6\" width=\"18\" height=\"14\" rx=\"3\"/><path d=\"M3 10.5h18M16.5 15h1.5\"/><path d=\"M6 6V5a2 2 0 012-2h8\"/>", "spark": "<path d=\"M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z\"/><path d=\"M18.5 16.5v4M16.5 18.5h4\"/>", "save": "<path d=\"M12 3.5v11\"/><path d=\"M7.5 10.5l4.5 4.5 4.5-4.5\"/><path d=\"M4.5 19.5h15\"/>", "trash": "<path d=\"M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13\"/>", "sliders": "<path d=\"M4 7h9M17 7h3M4 17h3M11 17h9\"/><circle cx=\"15\" cy=\"7\" r=\"2\"/><circle cx=\"9\" cy=\"17\" r=\"2\"/>", "star": "<path d=\"M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z\"/>", "starfill": "<path fill=\"currentColor\" d=\"M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z\"/>", "dots": "<circle cx=\"5.5\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/><circle cx=\"18.5\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/>", "skip": "<path d=\"M4 12h11M11 7l5 5-5 5M20 5v14\"/>", "play": "<path d=\"M8 5.5l11 6.5-11 6.5z\"/>", "edit": "<path d=\"M4 20l4.2-1L19.5 7.7a2 2 0 000-2.8l-.4-.4a2 2 0 00-2.8 0L5 15.8z\"/>", "up": "<path d=\"M6 14l6-6 6 6\"/>", "down": "<path d=\"M6 10l6 6 6-6\"/>"};
const ic=(n,z)=>`<svg class="ic" viewBox="0 0 24 24" width="${z||18}" height="${z||18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]||''}</svg>`;
const NAV={dash:{n:'Início',i:'⌂'},hoje:{n:'Hoje',i:'◎'},rotina:{n:'Rotina',i:'☀'},avisos:{n:'Lembretes',i:'◷'},agenda:{n:'Agenda',i:'▦'},tarefas:{n:'Tarefas',i:'✓'},projetos:{n:'Projetos',i:'◆'},metas:{n:'Metas',i:'◆'},habitos:{n:'Hábitos',i:'◉'},notas:{n:'Notas',i:'✎'},diario:{n:'Diário',i:'✿'},links:{n:'Links',i:'↗'},etiquetas:{n:'Etiquetas',i:'#'},financas:{n:'Finanças',i:'$'},aparencia:{n:'Aparência',i:'✦'},backup:{n:'Backup',i:'⇅'},lixeira:{n:'Lixeira',i:'⌫'},arquivados:{n:'Arquivados',i:'▤'},leituras:{n:'Leituras',i:'▤'},menu:{n:'Personalizar menu',i:'⚙'}};
for(const k in {"dash": "home", "hoje": "today", "rotina": "sun", "avisos": "bell", "agenda": "cal", "tarefas": "check", "projetos": "flag", "metas": "flag", "habitos": "repeat", "notas": "note", "diario": "smile", "links": "link", "etiquetas": "tag", "financas": "wallet", "aparencia": "spark", "backup": "save", "lixeira": "trash", "arquivados": "note", "leituras": "book", "menu": "sliders"})NAV[k].i=ic(({dash:'home',hoje:'today',rotina:'sun',avisos:'bell',agenda:'cal',tarefas:'check',projetos:'flag',metas:'flag',habitos:'repeat',notas:'note',diario:'smile',links:'link',etiquetas:'tag',financas:'wallet',aparencia:'spark',backup:'save',lixeira:'trash',arquivados:'note',leituras:'book',menu:'sliders'})[k],20);
const LOCK=['dash','menu'],BARMAX=5;
const menuDef=()=>({groups:[{id:'plan',n:'Planejar',items:['dash','hoje','rotina','avisos','agenda','tarefas','projetos','metas','habitos']},{id:'reg',n:'Registrar',items:['notas','arquivados','leituras','diario','links','etiquetas']},{id:'din',n:'Dinheiro',items:['financas']},{id:'sis',n:'Sistema',items:['aparencia','backup','lixeira','menu']}],hidden:[],bar:['dash','hoje','agenda','notas','tarefas']});
function menuCfg(){const m=S.menu&&Array.isArray(S.menu.groups)?JSON.parse(JSON.stringify(S.menu)):menuDef();m.hidden=(m.hidden||[]).filter(k=>NAV[k]&&!LOCK.includes(k));m.bar=(m.bar||[]).filter(k=>NAV[k]).slice(0,BARMAX);
 m.groups.forEach(g=>{g.items=g.items.filter(k=>NAV[k])});const all=new Set(m.groups.flatMap(g=>g.items)),miss=Object.keys(NAV).filter(k=>!all.has(k));
 if(miss.includes('projetos')){(m.groups.find(g=>g.id==='plan')||m.groups[m.groups.length-1]).items.push('projetos');miss.splice(miss.indexOf('projetos'),1)}if(miss.length)(m.groups.find(g=>g.id==='sis')||m.groups[m.groups.length-1]).items.push(...miss);return m}
function menuEdit(fn){const m=menuCfg();fn(m);S.menu=m}
function renderMenu(){
 const m=menuCfg(),hid=new Set(m.hidden),bar=new Set(m.bar),col=new Set(S.mcol||[]);
 const html=m.groups.map(g=>{const items=g.items.filter(k=>!hid.has(k));if(!items.length)return '';const c=col.has(g.id);
  return `<div class="mg"><button class="mgh" data-a="mcol" data-id="${g.id}" aria-expanded="${!c}"><span>${esc(g.n)}</span><i>${c?'▸':'▾'}</i></button>${items.filter(k=>!c||k===S.view).map(k=>`<button class="nav${bar.has(k)?'':' sec'}" data-v="${k}"><b>${NAV[k].i}</b>${NAV[k].n}</button>`).join('')}</div>`}).join('');
 const nv=$('#nv');if(nv&&nv.dataset.sig!==html){nv.innerHTML=html;nv.dataset.sig=html}
 const button=k=>`<button class="nav${S.view===k?' on':''}" data-v="${k}"${S.view===k?' aria-current="page"':''}><b>${NAV[k].i}</b><span>${NAV[k].n}</span></button>`;
 const mb=$('#mobile-bar'),barHtml=m.groups.flatMap(g=>g.items).filter(k=>bar.has(k)&&!hid.has(k)).map(button).join('')+'<button class="nav more" data-a="more" aria-haspopup="dialog" aria-controls="mobile-menu"><b>⋯</b><span>Mais</span></button>';
 if(mb&&mb.dataset.sig!==barHtml){mb.innerHTML=barHtml;mb.dataset.sig=barHtml}
 const content=$('#mobile-menu-content'),mobileHtml=m.groups.map(g=>{const items=g.items.filter(k=>!hid.has(k)&&!bar.has(k));return items.length?`<section><h3>${esc(g.n)}</h3><div class="mobile-menu-items">${items.map(button).join('')}</div></section>`:''}).join('')+'<section><h3>Preferências</h3><button class="nav" data-a="mobile-theme"><b>◐</b>Tema</button><p class="empty" id="mobile-sync"></p></section>';
 if(content&&content.dataset.sig!==mobileHtml){content.innerHTML=mobileHtml;content.dataset.sig=mobileHtml}}
const PROFILE_KEY='hub-view-profiles';
const profileCopy=x=>JSON.parse(JSON.stringify(x));
function profileRead(){const raw=localStorage.getItem(PROFILE_KEY),v=raw?JSON.parse(raw):{active:'',items:[]};if(!v||!Array.isArray(v.items)||v.items.length>40||typeof v.active!=='string'||v.items.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'||!(p.cards===null||Array.isArray(p.cards)&&p.cards.every(c=>c&&typeof c.id==='string'))||!(p.menu===null||p.menu&&Array.isArray(p.menu.groups)&&p.menu.groups.every(g=>g&&Array.isArray(g.items)))))throw Error('Perfis inválidos');return v}
const profileCurrent=()=>profileCopy({cards:S.cards||null,menu:S.menu||null});
function profileSaveCurrent(v){const p=v.items.find(x=>x.id===v.active);if(p)Object.assign(p,profileCurrent());else if(S.cards||S.menu){if(v.items.length>=40)throw Error('Limite de perfis');v.items.push({id:'p'+uid()+uid(),name:'Configuração anterior',...profileCurrent()})}}
function profileCreate(name){if(LOCAL_CORRUPT)throw Error('Recupere os dados antes de alterar perfis');name=String(name||'').trim();if(!name||name.length>60)throw Error('Informe um nome de até 60 caracteres');const v=profileRead();if(v.items.length>=40)throw Error('Limite de 40 perfis');if(v.active){const p=v.items.find(x=>x.id===v.active);if(p)Object.assign(p,profileCurrent())}const p={id:'p'+uid()+uid(),name,...profileCurrent()};v.items.push(p);v.active=p.id;localStorage.setItem(PROFILE_KEY,JSON.stringify(v))}
function profileSwitch(id){if(LOCAL_CORRUPT)throw Error('Recupere os dados antes de alterar perfis');const old=localStorage.getItem(PROFILE_KEY),v=profileRead(),target=id==='default'?{cards:null,menu:null}:v.items.find(x=>x.id===id);if(!target)throw Error('Perfil não encontrado');if(id===v.active)return;const copy=profileCopy(target);profileSaveCurrent(v);v.active=id==='default'?'':id;localStorage.setItem(PROFILE_KEY,JSON.stringify(v));const before=profileCurrent();S.cards=copy.cards;S.menu=copy.menu;if(!save()){S.cards=before.cards;S.menu=before.menu;try{if(old===null)localStorage.removeItem(PROFILE_KEY);else localStorage.setItem(PROFILE_KEY,old)}catch(e){}throw Error('Não foi possível salvar a troca de perfil')}}
function profilePanel(){let v;try{v=profileRead()}catch(e){return '<div class="panel"><h2>Perfis de visualização</h2><p role="alert">Não foi possível ler os perfis locais. A configuração atual foi mantida.</p></div>'}return `<div class="panel"><h2>Perfis de visualização</h2><p class="empty">Salvos neste navegador e separados por conta; não entram no backup. O perfil ativo é atualizado ao trocar. Aplicar um perfil altera cards e menu, que continuam sincronizados com sua conta. A troca é sempre manual.</p><p>Perfil: <strong>${esc((v.items.find(x=>x.id===v.active)||{}).name||'Padrão ou configuração atual')}</strong></p><div class="bar"><button class="pill" data-a="profile-switch" data-id="default">Usar padrão do MeuHub</button>${v.items.map(p=>`<button class="pill ${p.id===v.active?'on':''}" data-a="profile-switch" data-id="${esc(p.id)}" aria-pressed="${p.id===v.active}">${esc(p.name)}</button>`).join('')}</div><form class="bar" id="profile-create"><label class="lb">Salvar configuração atual como perfil<input class="in" name="name" maxlength="60" required></label><button class="pill">Salvar perfil</button></form></div>`}
function menuView(){
 const m=menuCfg(),hid=new Set(m.hidden),bar=new Set(m.bar);
 return `<div class="top"><h1>Personalizar menu</h1><button class="pill" data-a="mreset">Restaurar padrão</button></div>
 <p class="empty" style="padding:0 0 var(--space-2)">Escolha o que aparece no menu lateral, a ordem e os grupos. No celular, a barra inferior mostra até ${BARMAX} itens (${bar.size} escolhidos) e o resto fica em "Mais". Início e esta tela não podem ser escondidos.</p>
 <div class="panel mobile-shortcuts"><h2>Atalhos da barra</h2><p>Escolha até ${BARMAX} atalhos. Os demais ficam em Mais.</p><div class="mobile-shortcut-list">${m.groups.flatMap(g=>g.items).filter(k=>!hid.has(k)).map(k=>`<label><input type="checkbox" data-a="mbar" data-id="${k}" ${bar.has(k)?'checked':''}> ${NAV[k].n}</label>`).join('')}</div></div>
 <div class="cards">${m.groups.map((g,gi)=>`<div class="panel wide"><div class="top" style="margin:0 0 var(--space-2)"><input class="in" data-gname="${g.id}" value="${esc(g.n)}" aria-label="Nome do grupo" style="font-weight:600;max-width:60%"><span style="display:flex;gap:var(--space-1)"><button class="x" data-a="mgmv" data-id="${g.id}" data-n="-1" ${gi?'':'disabled'} aria-label="Subir grupo">▲</button><button class="x" data-a="mgmv" data-id="${g.id}" data-n="1" ${gi<m.groups.length-1?'':'disabled'} aria-label="Descer grupo">▼</button><button class="x" data-a="mdelg" data-id="${g.id}" ${g.items.length||m.groups.length<2?'disabled':''} aria-label="Excluir grupo vazio" title="Só grupos vazios podem ser excluídos">×</button></span></div>${g.items.map((k,i)=>`<div class="item"><input type="checkbox" class="chk" data-a="mshow" data-id="${k}" ${hid.has(k)?'':'checked'} ${LOCK.includes(k)?'disabled':''} aria-label="Mostrar ${NAV[k].n} no menu"><div class="t"><b>${NAV[k].i}</b> ${NAV[k].n}</div><label class="lb" style="margin:0;white-space:nowrap"><input type="checkbox" data-a="mbar" data-id="${k}" ${bar.has(k)?'checked':''}> barra inferior</label><select class="in" data-mmv="${k}" aria-label="Mover ${NAV[k].n} para o grupo" style="max-width:130px">${m.groups.map(x=>`<option value="${x.id}" ${x.id===g.id?'selected':''}>${esc(x.n)}</option>`).join('')}</select><button class="x" data-a="mimv" data-id="${k}" data-n="-1" ${i?'':'disabled'} aria-label="Subir">▲</button><button class="x" data-a="mimv" data-id="${k}" data-n="1" ${i<g.items.length-1?'':'disabled'} aria-label="Descer">▼</button></div>`).join('')||'<p class="empty">Grupo vazio. Use "Mover" num item de outro grupo para trazê-lo para cá.</p>'}</div>`).join('')}
 <div class="panel wide"><form class="bar" id="fmgrp" style="margin:0"><input class="in grow" name="n" placeholder="Nome de um novo grupo" required><button class="pill">Criar grupo</button></form></div></div>${profilePanel()}`}
document.addEventListener('change',e=>{const i=e.target;if(!i||!i.dataset)return;
 if(i.dataset.a==='mshow'){menuEdit(m=>{const s=new Set(m.hidden);if(i.checked)s.delete(i.dataset.id);else s.add(i.dataset.id);m.hidden=[...s]});render();return}
 if(i.dataset.a==='mbar'){const m0=menuCfg();if(i.checked&&m0.bar.length>=BARMAX&&!m0.bar.includes(i.dataset.id)){i.checked=false;toast('A barra inferior comporta até '+BARMAX+' itens. Desmarque outro primeiro.');return}menuEdit(m=>{const s=m.bar.filter(k=>k!==i.dataset.id);if(i.checked)s.push(i.dataset.id);m.bar=s});render();return}
 if(i.dataset.mmv){menuEdit(m=>{m.groups.forEach(g=>{g.items=g.items.filter(k=>k!==i.dataset.mmv)});const t=m.groups.find(g=>g.id===i.value);if(t)t.items.push(i.dataset.mmv)});render();return}
 if(i.dataset.gname){const n=i.value.trim();if(n)menuEdit(m=>{const g=m.groups.find(x=>x.id===i.dataset.gname);if(g)g.n=n});render()}});

document.addEventListener('click',e=>{document.querySelectorAll('details.mnu[open]').forEach(d=>{if(!d.contains(e.target)||e.target.closest('.mm .mi'))d.removeAttribute('open')})},true);
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const d=document.querySelector('details.mnu[open]');if(d){d.removeAttribute('open');const sm=d.querySelector('summary');if(sm)sm.focus();e.stopPropagation()}},true);
/* ===== Acessibilidade: nomes, foco, teclado, contraste e preferências ===== */
const SMOOTH=()=>S.rmo==='on'||matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
const A11Y={d:'Data',h:'Horário de início',h2:'Horário de término',c:'Cor',r:'Repetição',rm:'Lembrete',t:'Título',v:'Valor',due:'Prazo',p:'Prioridade',pj:'Projeto',rc:'Repetição',tg:'Etiquetas',k:'Atalho de teclado',cat:'Categoria',src:'Origem do progresso',un:'Unidade',fim:'Prazo',n:'Nome',u:'Endereço do link',day:'Dia do mês',ty:'Tipo',md:'Condição',min:'Valor mínimo',max:'Valor máximo',ac:'Conta',to:'Conta de destino',sub:'Subcategoria',nw:'Novo nome',m:'Texto',tk:'Tarefa',end:'Termina em',pc:'Parcelas',ini:'Saldo inicial'};
function toast(m,u){let t=$('#toast');
 if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.appendChild(t);
  const hold=()=>clearTimeout(UT),rel=()=>{clearTimeout(UT);UT=setTimeout(()=>t.classList.remove('on'),4000)};
  t.addEventListener('mouseenter',hold);t.addEventListener('focusin',hold);t.addEventListener('mouseleave',rel);t.addEventListener('focusout',rel)}
 t.innerHTML=`<span>${m}</span>${u?'<button data-a="undo">Desfazer</button>':''}`;t.classList.add('on');clearTimeout(UT);UT=setTimeout(()=>t.classList.remove('on'),u?10000:6000)}
function focusKey(){const a=document.activeElement;if(!a||!a.closest||!a.closest('#main')||a===$('#main'))return null;const d=a.dataset||{};
 return{tag:a.tagName,id:a.id||'',name:a.name||'',a:d.a||'',did:d.id||'',s:d.s||'',n:d.n||'',k:d.k||'',dd:d.d||'',lab:a.getAttribute('aria-label')||'',txt:a.tagName==='BUTTON'?(a.textContent||'').trim().slice(0,30):'',idx:[...document.querySelectorAll('#main '+a.tagName.toLowerCase())].indexOf(a)}}
function focusRestore(k,exact){const q=[...document.querySelectorAll('#main '+k.tag.toLowerCase())];
 let el=q.find(e=>{const d=e.dataset||{};return(!k.id||e.id===k.id)&&(!k.name||e.name===k.name)&&(d.a||'')===k.a&&(d.id||'')===k.did&&(d.s||'')===k.s&&(d.n||'')===k.n&&(d.k||'')===k.k&&(d.d||'')===k.dd&&(e.getAttribute('aria-label')||'')===k.lab&&(k.tag!=='BUTTON'||(e.textContent||'').trim().slice(0,30)===k.txt)});
 if(!el&&!exact)el=q[Math.min(k.idx,q.length-1)];if(!el)return false;if(el!==document.activeElement)el.focus({preventScroll:true});return true}
let lastVK=null;
const VK=()=>[S.view,S.fvw,S.ftab,S.mode,S.fyr,Q?'q':''].join('|');
function a11y(fk){
 const nm=e=>(e.getAttribute('aria-label')||(e.labels&&e.labels.length&&e.labels[0].textContent.trim())||((e.tagName==='BUTTON'||e.tagName==='A')&&e.textContent.trim())||e.title||'').trim();
 document.querySelectorAll('#main input:not([type=hidden]),#main select,#main textarea,#main button,#side button').forEach(e=>{if(nm(e))return;const l=e.placeholder||e.title||A11Y[e.name];if(l)e.setAttribute('aria-label',l)});
 document.querySelectorAll('#main .pill.on').forEach(on=>[...on.parentElement.children].filter(x=>x.classList.contains('pill')).forEach(x=>x.setAttribute('aria-pressed',x.classList.contains('on'))));
 document.querySelectorAll('#main .fb').forEach(e=>e.setAttribute('aria-hidden','true'));
 document.querySelectorAll('#main th:not([scope])').forEach(e=>e.setAttribute('scope','col'));
 document.querySelectorAll('#main .mood').forEach(g=>{const bs=[...g.querySelectorAll('button')],cur=bs.find(x=>x.classList.contains('on'))||bs[0];bs.forEach(x=>x.tabIndex=x===cur?0:-1);const b=g.querySelector('[data-k]');g.setAttribute('role','group');g.setAttribute('aria-label',b&&b.dataset.k==='e'?'Energia, de 1 a 5':'Humor, de 1 a 5')});
 document.querySelectorAll('.nav[data-v]').forEach(b=>{if(b.classList.contains('on'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 document.title=(Q?'Busca':NAV[S.view]?NAV[S.view].n:'')+' · Meu Hub';
 const vk=VK(),first=lastVK===null,changed=!first&&vk!==lastVK;lastVK=vk;
 if(fk&&focusRestore(fk,changed))return;
 if(changed&&!Q){const a=document.activeElement;if(a===document.body||(a.closest&&a.closest('#side'))){const h=$('#main h1');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}}}}
function applyA11y(){const r=document.documentElement;r.dataset.hc=S.hc?'1':'0';r.dataset.rmo=S.rmo==='on'?'1':'0'}
document.addEventListener('change',e=>{const i=e.target;if(!i||!i.dataset||!i.dataset.opt)return;const k=i.dataset.opt;
 if(k==='keys')S.keys=i.checked;else if(k==='hc')S.hc=i.checked;else S.rmo=i.checked?'on':'auto';applyA11y();save();toast(k==='keys'?(i.checked?'Atalhos de uma tecla ligados':'Atalhos de uma tecla desligados'):k==='hc'?(i.checked?'Alto contraste ligado':'Alto contraste desligado'):(i.checked?'Animações reduzidas':'Animações seguem o sistema'))});
const a11yPanel=()=>`<div class="panel" style="margin-top:var(--space-3)"><h2>Acessibilidade</h2>
 <label class="item"><input type="checkbox" class="chk" data-opt="keys" ${S.keys!==false?'checked':''}><div class="t">Atalhos de uma tecla<small>N, T, E, D, C, / e os números dos links. Desligue se usa ditado ou leitor de voz, para não acionar sem querer. Atalhos com Ctrl continuam funcionando.</small></div></label>
 <label class="item"><input type="checkbox" class="chk" data-opt="hc" ${S.hc?'checked':''}><div class="t">Alto contraste<small>Escurece o texto secundário e reforça as bordas.</small></div></label>
 <label class="item"><input type="checkbox" class="chk" data-opt="rmo" ${S.rmo==='on'?'checked':''}><div class="t">Reduzir animações<small>Também segue a preferência do seu sistema.</small></div></label>
 <p class="empty" style="padding:var(--space-2) 0 0">Teclado: Tab navega, Enter e Espaço ativam, Esc fecha a captura rápida e Ctrl+Z desfaz. Ctrl+K (ou Cmd+K) abre a paleta de comandos. O zoom do navegador funciona até 400%.</p></div>`;
applyA11y();
/* aplicativo (PWA): instalação na tela inicial ou área de trabalho */
let PWA_P=null;
const isPWA=()=>matchMedia('(display-mode: standalone)').matches||!!navigator.standalone;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();PWA_P=e;if(S.view==='aparencia'||S.view==='backup')render()});
window.addEventListener('appinstalled',()=>{PWA_P=null;toast('Aplicativo instalado!');if(S.view==='aparencia'||S.view==='backup')render()});
function pwaInstall(){
 if(isPWA()){toast('O Meu Hub já está aberto como aplicativo.');return}
 if(!PWA_P){toast('No iPhone/iPad (Safari): Compartilhar → Adicionar à Tela de Início. No computador ou Android: use o ícone de instalar na barra de endereço.');return}
 PWA_P.prompt();PWA_P.userChoice.then(()=>{PWA_P=null;render()}).catch(()=>{})}
const pwaPanel=()=>`<div class="panel" style="margin-top:var(--space-3)"><h2>Aplicativo</h2>${isPWA()?'<p class="empty" style="padding:0">Instalado neste aparelho. O Meu Hub abre em janela própria e funciona mesmo sem internet.</p>':PWA_P?'<p class="empty" style="padding:0 0 var(--space-2)">Instale o Meu Hub para abrir direto da tela inicial ou área de trabalho, em janela própria e com acesso mesmo sem internet.</p><div class="bar" style="margin:0"><button class="pill dark" data-a="pwainst">Instalar aplicativo</button></div>':'<p class="empty" style="padding:0">Para instalar como aplicativo: no <strong>iPhone/iPad (Safari)</strong>, toque em Compartilhar e em <em>Adicionar à Tela de Início</em>. No <strong>computador ou Android (Chrome/Edge)</strong>, use o ícone de instalar na barra de endereço ou o menu do navegador.</p>'}</div>`;

/* ===== Pacote A: lixeira e lembretes ===== */
const TRD=30*864e5;
const TRC={prj:{n:'Projeto',g:()=>S.projects||(S.projects=[]),l:x=>x.t},inbox:{n:'Captura',g:()=>S.inbox||(S.inbox=[]),l:x=>x.t},ev:{n:'Evento',g:()=>S.events,l:x=>x.t},nt:{n:'Nota',g:()=>S.notes,l:x=>x.t||'Nota sem título'},tk:{n:'Tarefa',g:()=>S.tasks,l:x=>x.t},lk:{n:'Link',g:()=>S.links,l:x=>x.n},hb:{n:'Hábito',g:()=>S.habits,l:x=>x.n},mt:{n:'Meta',g:()=>S.metas,l:x=>x.t},tx:{n:'Lançamento',g:()=>finInit().tx,l:x=>x.t+' · '+BRL(x.v)},bl:{n:'Conta fixa',g:()=>finInit().bills,l:x=>x.n},gl:{n:'Meta de economia',g:()=>finInit().goals,l:x=>x.n},rc:{n:'Recorrente',g:()=>finInit().rec,l:x=>x.t},rl:{n:'Regra',g:()=>finInit().rules,l:x=>x.m||'Regra'},sp:{n:'Divisão',g:()=>finInit().split,l:x=>x.p+' · '+x.t},pr:{n:'Meta de renda',g:()=>finInit().prules,l:x=>prName(x)},rd:{n:'Leitura',g:()=>S.reads||(S.reads=[]),l:x=>x.t}};
function trashSnap(){const o={};for(const k in TRC)o[k]=new Map((TRC[k].g()||[]).map(x=>[x.id,x]));return o}
function trashFlush(B){
 if(!B)return;const b=uid(),now=Date.now(),add2=[];
 for(const k in TRC){const cur=new Set((TRC[k].g()||[]).map(x=>x.id));B[k].forEach((it,id)=>{if(!cur.has(id))add2.push({id:k+':'+id,ty:k,it:JSON.parse(JSON.stringify(it)),at:now,b,lb:String(TRC[k].l(it)||'').slice(0,80)})})}
 if(!add2.length)return;const ids=new Set(add2.map(x=>x.id));
 S.trash=[...add2,...(S.trash||[]).filter(x=>!ids.has(x.id))].slice(0,400)}
function trashSweep(){
 if(!Array.isArray(S.trash)){S.trash=[];return}
 const now=Date.now(),keep=S.trash.filter(e=>e&&e.it&&now-e.at<TRD&&TRC[e.ty]&&!(TRC[e.ty].g()||[]).some(x=>x.id===e.it.id));
 if(keep.length!==S.trash.length)S.trash=keep;lkPrune()}
function trashRestore(bid){
 const L=(S.trash||[]).filter(x=>x.b===bid);if(!L.length)return;let restored=0;
 L.forEach(e=>{const arr=TRC[e.ty].g();if(!arr.some(x=>x.id===e.it.id)){arr.push(e.it);restored++;if(e.ty==='tx'&&e.it.rc){const r=finInit().rec.find(x=>x.id===e.it.rc);if(r&&r.skip)r.skip=r.skip.filter(i=>i!==e.it.id)}}});
 S.trash=S.trash.filter(x=>x.b!==bid);if(restored)auditLog('trashRestore');toast('Restaurado: '+esc(L[0].lb)+(L.length>1?' e mais '+(L.length-1):''))}
function lixeira(){
 trashSweep();const bs=[];(S.trash||[]).forEach(e=>{let g=bs.find(x=>x.b===e.b);if(!g){g={b:e.b,at:e.at,L:[]};bs.push(g)}g.L.push(e)});
 const row=g=>{const f=g.L[0],d=Math.floor((Date.now()-g.at)/864e5),left=Math.max(0,30-d),same=g.L.every(x=>x.ty===f.ty),ty=g.L.length>1?(same?g.L.length+' '+TRC[f.ty].n.toLowerCase()+'s':g.L.length+' itens'):TRC[f.ty].n;
  return `<div class="item"><span class="chip c-b">${esc(ty)}</span><div class="t">${esc(f.lb)}${g.L.length>1?' e mais '+(g.L.length-1):''}<small>Excluído ${d===0?'hoje':d===1?'ontem':'há '+d+' dias'} · some em ${left} ${left===1?'dia':'dias'}</small></div><button class="pill" data-a="trres" data-id="${g.b}">Restaurar</button><button class="x" data-a="trdel" data-id="${g.b}" aria-label="Excluir de vez" title="Excluir de vez">×</button></div>`};
 return `<div class="top"><h1>Lixeira</h1>${bs.length?'<button class="pill" data-a="trall">Esvaziar lixeira</button>':''}</div><p class="empty" style="padding:0 0 var(--space-2)">Tarefas, eventos, notas, links, hábitos, metas e lançamentos excluídos ficam aqui por 30 dias. Depois somem sozinhos.</p><div class="panel">${bs.map(row).join('')||'<p class="empty">A lixeira está vazia.</p>'}</div>`}
const remCfg=()=>Object.assign({on:true,tk:true,fat:true,hab:true,fd:2,hh:'09:00'},S.rem||{});
function attention(){
 const R=remCfg(),o=[],tm=ds(add(today,1));
 if(R.tk){S.tasks.filter(t=>!t.done&&!taskPaused(t)&&t.due&&t.due<=tm).sort((a,b)=>a.due.localeCompare(b.due)).forEach(t=>o.push({k:'tk',u:t.due<T?0:t.due===T?1:2,t:t.t,id:t.id,d:t.due,s:t.due<T?'Atrasada desde '+fmt(t.due):t.due===T?'Vence hoje':'Vence amanhã',v:'tarefas'}))}
 const conflicts=[T,tm].flatMap(d=>{const events=evOn(d).filter(e=>e.e&&mm(e.e)>mm(e.h)&&(d!==T||mm(e.e)>mm(nowH()))),pairs=[];events.forEach((a,i)=>events.slice(i+1).forEach(b=>{if(mm(a.h)<mm(b.e)&&mm(b.h)<mm(a.e))pairs.push({k:'conflict',u:1,id:a.id,d,t:a.t,s:'Conflito em '+fmt(d)+': '+a.h+'–'+a.e+' com '+b.t+' ('+b.h+'–'+b.e+')',sig:[a.id,a.h,a.e,b.id,b.h,b.e].join('|'),v:'agenda'})}));return pairs});o.push(...conflicts);
 if(R.fat){const cf=cashFlow({days:14,fac:'',vary:false});if(cf&&cf.firstNeg)o.push({k:'sal',u:1,t:cf.firstNeg.d===T?'Saldo negativo hoje':'Saldo previsto fica negativo',s:(cf.firstNeg.d===T?'Hoje':'Em '+fmt(cf.firstNeg.d))+' ('+BRL(cf.firstNeg.v)+'). Estimativa para 14 dias, para todas as contas não cartão, com lançamentos previstos, contas fixas e faturas; confira possíveis duplicidades e gastos não cadastrados.',v:'financas'})}
 if(R.fat){dues(+R.fd).filter(x=>x.k==='card'||x.k==='bill').forEach(x=>{const dd=mDays(x.d);o.push({k:x.k,u:dd<=0?1:2,t:(x.k==='card'?'':'Conta: ')+x.t,id:x.id,s:(dd===0?'Vence hoje':dd===1?'Vence amanhã':'Vence em '+dd+' dias')+' · '+BRL(x.v)+' previsto · '+(x.account||'Conta de pagamento não informada'),card:x.k==='card'?x:null,v:'financas'})})}
 if(R.fat){const old=finInit().split.filter(e=>!e.st&&e.dir==='recv'&&e.d<=ds(add(today,-30)));if(old.length)o.push({k:'sal',u:2,t:'Dívidas a receber há mais de 30 dias',s:[...new Set(old.map(e=>e.p))].slice(0,3).join(', ')+' · '+BRL(old.reduce((t,e)=>t+e.v,0)),v:'financas'})}
 if(R.fat){finInit().rec.filter(r=>r.review&&r.k==='out'&&r.cat==='Assinaturas').forEach(r=>o.push({k:'sub',u:3,t:'Revisar assinatura: '+r.t,id:r.id,s:'Marcada por você para revisão.',v:'financas'}))}
 if(R.hab&&nowH()>=R.hh){const p=S.habits.filter(h=>!h.perWeek&&!h.log[T]);if(p.length)o.push({k:'hb',u:3,t:p.length+(p.length===1?' hábito de hoje pendente':' hábitos de hoje pendentes'),s:p.slice(0,3).map(h=>h.n).join(', ')+(p.length>3?'…':''),v:'habitos'})}
 return o.map(x=>{if(x.id&&(x.k==='tk'||x.k==='conflict'))x.dismissKey=[x.k,x.id,x.d||'',x.sig||x.s].join('|');return x}).filter(x=>!x.dismissKey||!R.dismiss||R.dismiss[x.dismissKey]!==T).sort((a,b)=>a.u-b.u)}
const attRow=x=>`<div class="item"><span class="chip c-${x.u===0?'p':x.u===1?'y':'b'}">${{tk:'Tarefa',card:'Fatura',bill:'Conta',hb:'Hábitos',sal:'Saldo',conflict:'Agenda',sub:'Assinatura'}[x.k]}</span><div class="t">${esc(x.t)}<small class="${x.u===0?'late':''}">${esc(x.s)}</small></div>${((x.k==='tk'||x.k==='conflict'||x.k==='bill'||x.k==='sub')&&x.id)||(x.k==='sal'&&x.t!=='Dívidas a receber há mais de 30 dias')?`<button class="pill" data-a="att-open" data-id="${esc(x.id)}" data-kind="${x.k}" data-day="${esc(x.d||'')}">Abrir</button>${x.dismissKey?`<button class="pill" data-a="att-dismiss" data-key="${esc(x.dismissKey)}" aria-label="Ocultar ${esc(x.t)} até amanhã">Ocultar até amanhã</button>`:''}`:x.card?`<button class="pill" data-a="payfat" data-id="${x.card.id}" data-o="${x.card.o}">Pagar</button>`:`<button class="pill" data-v="${x.v}">Abrir</button>`}</div>`;
function attBox(){
 if(S.onb||!remCfg().on)return '';const L=attention(),finance=shoppingReviewGroups().length;if(!L.length&&!finance)return '';
 return `<div class="panel" id="attb" role="region" aria-label="Precisa de atenção"><h2>Precisa de atenção</h2>${L.slice(0,4).map(attRow).join('')}${finance?'<button class="pill" data-v="avisos">Conferir possíveis compras duplicadas</button>':''}${L.length>4?`<button class="pill" data-v="avisos">Ver todos (${L.length})</button>`:''}</div>`}
function shoppingReviewGroups(){
 const groups=new Map();
 for(const t of finInit().tx){
  if(t.k!=='out'||!t.shopping||!t.ac||!t.id||!(+t.v>0))continue;
  const key=JSON.stringify([t.shopping,t.d,t.ac,Math.round(t.v*100)]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(t);
 }
 return [...groups].filter(([,tx])=>tx.length>1).map(([key,tx])=>({tx,key:JSON.stringify([key,tx.map(t=>t.id).sort()])}))
  .filter(({tx,key})=>tx.some(t=>t.shoppingReviewed!==key)).sort((a,b)=>b.tx[0].d.localeCompare(a.tx[0].d));
}
function financeReviewPanel(){
 const F=finInit(),accounts=new Set(F.acc.filter(a=>a.ty!=='card').map(a=>a.id));
 const bills=F.bills.filter(b=>!accounts.has(b.ac)&&(!b.rec||!F.rec.some(r=>r.id===b.rec)));
 const groups=shoppingReviewGroups();
 if(!bills.length&&!groups.length)return '';
 const billRows=bills.slice(0,pgN('frb',15)).map(b=>`<div class="item"><div class="t">${esc(b.n)}<small>Conta fixa sem conta de pagamento vinculada</small></div><button class="pill" data-a="att-open" data-kind="bill" data-id="${esc(b.id)}">Vincular conta</button></div>`).join('');
 const groupRows=groups.slice(0,pgN('frs',10)).map(({key,tx})=>`<details><summary>Possível compra duplicada em ${fmt(tx[0].d)} · ${BRL(tx[0].v)} (${tx.length} lançamentos)</summary>
 ${tx.map(t=>`<div class="item"><div class="t">${esc(t.t)}<small>${esc(accName(t.ac))} · ${esc(t.cat||'Sem categoria')} · ${BRL(t.v)}</small></div><button class="pill" data-a="finance-review-open" data-id="${esc(t.id)}" aria-label="Conferir ${esc(t.t)}">Conferir</button></div>`).join('')}
 <button class="pill" data-a="finance-distinct" data-key="${esc(key)}">Confirmar compras distintas</button></details>`).join('');
 return `<section class="panel" id="finance-review"><h2>Conferência financeira</h2>${billRows}${pgMore('frb',bills.length,15)}${groupRows}${pgMore('frs',groups.length,10)}</section>`;
}
function avisos(){
 const R=remCfg(),L=R.on?attention():[],np=('Notification' in window)?Notification.permission:'unsupported';
 const sw=(k,l,d)=>`<label class="item"><input type="checkbox" class="chk" data-rem="${k}" ${R[k]?'checked':''}><div class="t">${l}<small>${d}</small></div></label>`;
 return `<div class="top"><h1>Lembretes</h1></div>
 <div class="panel"><h2>Precisa de atenção agora</h2>${L.slice(0,pgN('av',40)).map(attRow).join('')}${pgMore('av',L.length,40)}${L.length?'':`<p class="empty">${R.on?'Nada pendente por enquanto.':'Os lembretes estão desligados.'}</p>`}</div>
 ${financeReviewPanel()}
 <div class="panel" style="margin-top:var(--space-3)"><h2>Configurar avisos</h2>
 ${sw('on','Avisos ligados','Mostra o painel no Início e envia um resumo diário.')}
 ${sw('tk','Tarefas atrasadas e com prazo próximo','Atrasadas, de hoje e de amanhã.')}
 ${sw('fat','Faturas e contas fixas','Vencimentos nos próximos dias.')}
 ${sw('hab','Hábitos do dia pendentes','Só depois do horário do resumo.')}
 <div class="bar" style="margin:var(--space-2) 0 0"><label class="lb" style="margin:0">Antecedência dos vencimentos <select class="in" data-rem="fd">${[1,2,3,5,7].map(n=>`<option value="${n}" ${+R.fd===n?'selected':''}>${n} ${n===1?'dia':'dias'}</option>`).join('')}</select></label><label class="lb" style="margin:0">Horário do resumo diário <input class="in" type="time" data-rem="hh" value="${R.hh}"></label></div></div>
 <div class="panel" style="margin-top:var(--space-3)"><h2>Notificações do navegador</h2><p class="empty" style="padding:0 0 var(--space-2)">${np==='granted'?'Ativadas. Elas aparecem enquanto o hub estiver aberto em alguma aba.':np==='denied'?'Bloqueadas pelo navegador. Libere nas configurações do site para receber.':np==='unsupported'?'Este navegador não oferece notificações. Os avisos aparecem dentro do hub.':'Ainda não ativadas. Sem elas, os avisos aparecem só dentro do hub.'} O hub não consegue avisar com a página totalmente fechada.</p><div class="bar" style="margin:0">${np==='default'?'<button class="pill dark" data-a="rperm">Ativar notificações</button>':''}<button class="pill" data-a="rtest">Enviar aviso de teste</button></div></div>`}
document.addEventListener('change',e=>{const i=e.target;if(!i||!i.dataset||!i.dataset.rem)return;const k=i.dataset.rem;S.rem=Object.assign({},S.rem||{},{[k]:i.type==='checkbox'?i.checked:k==='fd'?+i.value:i.value||'09:00'});save();if(k==='on'||k==='hh'||k==='fd'||k==='tk'||k==='fat'||k==='hab')render()});
function digest(){
 const R=remCfg();if(!R.on||nowH()<R.hh)return;let last='';try{last=localStorage.getItem('hub-rem-last')||''}catch(e){}if(last===T)return;
 try{localStorage.setItem('hub-rem-last',T)}catch(e){}
 const L=attention();if(!L.length)return;
 const n=(k,u)=>L.filter(x=>x.k===k&&(u===undefined||x.u===u)).length,p=[],pl=(c,s,pp)=>c+' '+(c===1?s:pp);
 if(n('tk',0))p.push(pl(n('tk',0),'tarefa atrasada','tarefas atrasadas'));if(n('tk',1))p.push(pl(n('tk',1),'tarefa vence hoje','tarefas vencem hoje'));
 L.filter(x=>x.k==='card'||x.k==='bill').slice(0,2).forEach(x=>p.push(x.t+': '+x.s.split(' · ')[0].toLowerCase()));
 if(n('hb'))p.push(L.find(x=>x.k==='hb').t.toLowerCase());
 notify('Resumo do dia',p.join('; ')||(L.length+' itens pedem atenção'))}
setInterval(digest,60000);setTimeout(digest,3000);
/* ===== Pacote B: planejar o dia e rotina ===== */
const fdur=m=>m<60?m+' min':(m%60?Math.floor(m/60)+'h'+String(m%60).padStart(2,'0'):Math.floor(m/60)+'h');
const capM=()=>Math.round((+S.cap||8)*60);
const blkEnd=t=>hm(Math.min(1439,mm(t.bk.h)+(t.dur||30)));
const blocksOn=k=>S.tasks.filter(t=>!taskPaused(t)&&t.bk&&t.bk.d===k).map(t=>({id:t.id,t:t.t,h:t.bk.h,e:blkEnd(t),blk:1,done:t.done}));
function dayLoad(k){
 const iv=[...evOn(k),...blocksOn(k)].map(sp).sort((a,b)=>a[0]-b[0]);let tot=0,c=null;
 iv.forEach(([s,f])=>{if(c&&s<=c[1])c[1]=Math.max(c[1],f);else{if(c)tot+=c[1]-c[0];c=[s,f]}});if(c)tot+=c[1]-c[0];
 const pl=S.tasks.filter(t=>!t.done&&!taskPaused(t)&&!(t.bk&&t.bk.d===k)&&t.hd===k).reduce((a,t)=>a+(t.dur||30),0);
 return{tot:tot+pl,pl,cap:capM()}}
const defaultWindows=[{id:'default',start:'08:00',end:'22:00'}];
function windowsFor(k){const day=new Date(k+'T12:00').getDay(),all=S.availability||{};return Array.isArray(all[day])?all[day]:defaultWindows}
function availabilityPanel(){const all=S.availability||{};return `<details class="panel"><summary>Janelas de horário por dia</summary><p class="empty">Defina um ou mais intervalos por dia. Sem configuração, usamos 8h–22h. A primeira janela adicionada substitui esse padrão. Remover todos os intervalos de um dia deixa esse dia indisponível. A capacidade diária é um limite separado.</p>${DIAF.map((name,i)=>`<div class="item"><div class="t">${name}<small>${(all[i]||defaultWindows).map(w=>w.start+'–'+w.end).join(' · ')||'Indisponível'}</small></div>${(all[i]||defaultWindows).map(w=>`<button class="x" data-a="availability-remove" data-day="${i}" data-id="${esc(w.id)}" aria-label="Remover janela de ${name} ${w.start} a ${w.end}">×</button>`).join('')}${Array.isArray(all[i])?`<button class="pill" data-a="availability-reset" data-id="${i}">Usar padrão</button>`:''}</div>`).join('')}<form class="bar" id="availability-form"><label class="lb">Dia<select class="in" name="day">${DIAF.map((n,i)=>`<option value="${i}">${n}</option>`).join('')}</select></label><label class="lb">De<input class="in" type="time" name="start" required></label><label class="lb">Até<input class="in" type="time" name="end" required></label><button class="pill">Adicionar janela</button></form></details>`}
function autoSlot(k,dur,skip){
 const iv=[...evOn(k).map(sp),...blocksOn(k).filter(b=>b.id!==skip).map(sp)],now=new Date(),min=k===T?Math.ceil((now.getHours()*60+now.getMinutes())/15)*15:0;
 for(const w of [...windowsFor(k)].sort((a,b)=>a.start.localeCompare(b.start))){const first=Math.max(min,Math.ceil(mm(w.start)/15)*15),end=mm(w.end);for(let s=first;s+dur<=end;s+=15)if(!iv.some(([a,b])=>s<b&&a<s+dur))return hm(s)}return null}
function warnPlan(k,id){
 const t=S.tasks.find(x=>x.id===id);if(!t||!t.bk)return;const me=sp({h:t.bk.h,e:blkEnd(t)}),c=evOn(k).find(e=>{const[s,f]=sp(e);return s<me[1]&&me[0]<f});
 if(c){toast('Atenção: conflita com “'+esc(c.t)+'” ('+c.h+')');return}
 const l=dayLoad(k);if(l.tot>l.cap)toast('Atenção: este dia passou da sua capacidade de '+fdur(l.cap))}
let FIT=null;
function planPanel(k){
 const L=S.tasks.filter(t=>!t.done&&!taskPaused(t)&&!(t.bk&&t.bk.d===k)).sort((a,b)=>(b.hd===k)-(a.hd===k)||(a.due||'9999').localeCompare(b.due||'9999')).slice(0,12),ld=dayLoad(k),pc=Math.round(ld.tot/ld.cap*100),over=ld.tot>ld.cap;
 return `<aside class="panel plp" aria-label="Planejar o dia"><h2>Carga do dia</h2><div class="fb ${over?'o':pc>85?'w':''}" aria-hidden="true"><i style="width:${Math.min(100,pc)}%"></i></div><p class="empty" style="padding:var(--space-2) 0 0"><strong>${ld.tot?fdur(ld.tot):'0 min'}</strong> de ${fdur(ld.cap)} (${pc}%)${ld.pl?'. Inclui '+fdur(ld.pl)+' de tarefas planejadas sem horário (30 min quando não há duração).':''}</p>${over?`<p class="late" role="alert" style="margin:var(--space-1) 0">Dia sobrecarregado: passa ${fdur(ld.tot-ld.cap)} da sua capacidade. Mova algo para outro dia.</p>`:''}<div class="bar" style="margin:var(--space-2) 0 0;align-items:center"><span class="empty" style="padding:0">Capacidade: ${fdur(ld.cap)}</span><span class="gctl"><button class="x" data-a="cap" data-id="-1" aria-label="Diminuir capacidade em 1 hora">−</button><button class="x" data-a="cap" data-id="1" aria-label="Aumentar capacidade em 1 hora">+</button></span></div>
 <h2 style="margin-top:var(--space-4)">Encaixar tarefas</h2><p class="empty" style="padding:0 0 var(--space-2)">Arraste para um horário ou peça uma sugestão e confirme o encaixe. Sem duração, conta 30 min.</p><div class="pll">${L.map(t=>`<div class="item plt" draggable="true" data-dtp="${t.id}"><div class="t">${esc(t.t)}<small>${t.hd===k?'★ planejada · ':''}${t.due?'prazo '+fmt(t.due):'sem prazo'}</small></div><select class="in" data-dur="${t.id}" aria-label="Duração de ${esc(t.t)}"><option value="">?</option>${[15,30,45,60,90,120,180].map(m=>`<option value="${m}" ${t.dur===m?'selected':''}>${fdur(m)}</option>`).join('')}</select>${FIT&&FIT.id===t.id&&FIT.d===k?`<span class="empty">Sugestão: ${FIT.h}</span><button class="pill dark" data-a="fit-confirm" data-id="${t.id}">Confirmar ${FIT.h}</button><button class="pill" data-a="fit-cancel">Cancelar</button>`:`<button class="pill" data-a="fit-propose" data-id="${t.id}">Sugerir horário</button>`}</div>`).join('')||'<p class="empty">Nenhuma tarefa pendente para encaixar.</p>'}</div></aside>`}
document.addEventListener('change',e=>{const i=e.target;if(!i||!i.dataset||i.dataset.dur===undefined)return;const t=S.tasks.find(x=>x.id===i.dataset.dur);if(t){t.dur=+i.value||0;save();render()}});
/* rotina */
let RT={mode:null,i:0,date:''};
const RTS={m:['Como você está','Foco do dia','Seu dia','Tarefas de hoje','Pronto'],n:['Revisão do dia','Hábitos','Como foi o dia','Amanhã','Pronto']};
const rtSteps=mode=>RTS[mode].map((_,i)=>i).filter(i=>i===4||!S.rotPrefs||!S.rotPrefs[mode]||S.rotPrefs[mode][i]!==false);
function rtStep(mode,i){const d=(S.rot[T]=S.rot[T]||{});d.progress=Object.assign({},d.progress,{[mode]:i});RT.i=i;RT.date=T}
function rtOpen(mode){if(RT.date!==T){RT.date=T;RT.mode=null;RT.i=0}RT.mode=mode;const steps=rtSteps(mode),saved=(((S.rot||{})[T]||{}).progress||{})[mode];RT.i=steps.includes(saved)?saved:steps[0]}
const rtFeel=(d,mode,k)=>((((S.dia[d]||{}).routine||{})[mode]||{})[k]||0);
const rtMoodBtns=(mode,k)=>`<div class="mood">${[1,2,3,4,5].map(n=>`<button class="mb${rtFeel(T,mode,k)===n?' on':''}" style="background:${MC[n-1]}" data-a="rtmood" data-id="${n}" data-k="${k}" data-mode="${mode}" aria-pressed="${rtFeel(T,mode,k)===n}">${n}<small>${(k==='m'?MN:EN)[n-1]}</small></button>`).join('')}</div>`;
function rtPrefs(mode){const on=rtSteps(mode);return `<details id="rt-prefs"><summary>Personalizar etapas</summary><p class="empty">Escolha as etapas que deseja ver na rotina ${mode==='m'?'da manhã':'da noite'}. O resumo final permanece disponível.</p>${RTS[mode].slice(0,4).map((s,i)=>`<label style="display:block"><input type="checkbox" data-rt-pref="${mode}:${i}" ${on.includes(i)?'checked':''}> ${esc(s)}</label>`).join('')}</details>`}
function rtHistory(){const L=[...new Set([...Object.keys(S.rot||{}),...Object.keys(S.dia||{})])].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&((S.rot[d]||{}).m||(S.rot[d]||{}).n||(S.dia[d]||{}).focus)).sort().reverse().slice(0,14);return `<details><summary>Histórico de rotinas e focos</summary>${L.map(d=>{const r=S.rot[d]||{},focus=(S.dia[d]||{}).focus,labels=[r.m?'Manhã concluída':'',r.n?'Noite concluída':'',focus?'Foco: '+esc(focus):''].filter(Boolean);return `<div class="item"><div class="t">${fmt(d)} ${esc(d.slice(0,4))}<small>${labels.join(' · ')}</small></div></div>`}).join('')||'<p class="empty">Nenhuma rotina concluída ou foco registrado ainda.</p>'}</details>`}
function rtStreak(){const ok=d=>{const r=(S.rot||{})[d];return r&&(r.m||r.n)};let n=0,i=ok(T)?0:1;while(i<400&&ok(ds(add(today,-i)))){n++;i++}return n}
function rotina(){
 if(!RT.mode||RT.date!==T)rtOpen(today.getHours()<14?'m':'n');const md=RT.mode,st=RTS[md],steps=rtSteps(md);if(!steps.includes(RT.i))RT.i=steps[0];const i=RT.i,tm=ds(add(today,1)),done=(S.rot||{})[T]||{};
 const ta=(k,l,ph)=>`<label class="lb">${l}<textarea class="in ta" data-dk="${k}" data-dd="${T}" placeholder="${ph}">${esc((S.dia[T]||{})[k]||'')}</textarea></label>`;
 const pend=S.tasks.filter(t=>!t.done&&!taskPaused(t)).sort((a,b)=>(b.hd===T)-(a.hd===T)||grp(a)-grp(b)),ev=evOn(T),hj=S.tasks.filter(t=>!t.done&&!taskPaused(t)&&t.hd===T);
 const ld=dayLoad(T),evRow=(e)=>`<div class="item"><span class="chip c-${e.c}">${e.h}</span><div class="t">${esc(e.t)}</div></div>`;
 const tk=t=>`<div class="item"><div class="t">${esc(t.t)}<small>${t.due?(t.due<T?'Atrasada, ':'prazo ')+fmt(t.due):'sem prazo'}${t.dur?' · '+fdur(t.dur):''}</small></div><button class="pill ${t.hd===T?'on':''}" data-a="plan" data-id="${t.id}" aria-pressed="${t.hd===T}">${t.hd===T?'★ Planejada':'☆ Planejar'}</button></div>`;
 let body='';
 if(md==='m'){
  if(i===0)body=`<h2>Como você acordou?</h2><p class="empty">Este registro da manhã fica separado do da noite e do registro geral do Diário.</p><div class="lb" style="margin-top:0">Humor</div>${rtMoodBtns('m','m')}<div class="lb">Energia</div>${rtMoodBtns('m','e')}`;
  else if(i===1)body=`<h2>Qual é o foco de hoje?</h2><p class="empty" style="padding:0 0 var(--space-2)">Uma coisa que, se feita, deixa o dia bom.</p><input id="fo" class="in" style="width:100%" value="${esc((S.dia[T]||{}).focus||'')}" placeholder="Meu foco de hoje" maxlength="140" aria-label="Foco do dia">${S.focus?`<p class="empty">Foco anterior: ${esc(S.focus)}</p>`:''}`;
  else if(i===2){const A=attention();body=`<h2>Seu dia</h2><p class="empty" style="padding:0 0 var(--space-2)">${ev.length?ev.length+(ev.length===1?' compromisso':' compromissos'):'Nenhum compromisso'} · carga ${fdur(ld.tot)} de ${fdur(ld.cap)}${ld.tot>ld.cap?' (sobrecarregado)':''}</p>${ev.map(evRow).join('')}${A.length?`<h2 style="margin-top:var(--space-3)">Precisa de atenção</h2>${A.map(attRow).join('')}`:''}`}
  else if(i===3){const planned=pend.filter(t=>t.hd===T),other=pend.filter(t=>t.hd!==T);body=`<h2>Escolha o que fazer hoje</h2><p class="empty" style="padding:0 0 var(--space-2)">Planejadas: ${hj.length}. Escolha o que cabe no seu dia.</p>${planned.length?`<h3>Planejadas para hoje</h3>${planned.map(tk).join('')}`:''}${other.length?`<h3>Outras pendências</h3>${other.slice(0,8).map(tk).join('')}${other.length>8?`<details><summary>Ver outras ${other.length-8} tarefas</summary>${other.slice(8).map(tk).join('')}</details>`:''}`:!planned.length?'<p class="empty">Nenhuma tarefa pendente.</p>':''}<div class="bar" style="margin:var(--space-2) 0 0"><button class="pill" data-a="gotoday" data-id="${T}">Encaixar na agenda</button></div>`}
  else{const hv=rtFeel(T,'m','m');body=`<h2>Tudo pronto</h2><div class="item"><div class="t">Foco<small>${esc((S.dia[T]||{}).focus||'não definido')}</small></div></div><div class="item"><div class="t">Humor da manhã<small>${hv?MN[hv-1]:'não registrado'}</small></div></div><div class="item"><div class="t">Tarefas planejadas<small>${hj.length?hj.map(t=>esc(t.t)).join(' · '):'Nenhuma'}</small></div></div><div class="item"><div class="t">Compromissos<small>${ev.length}</small></div></div><div class="bar"><button class="pill" data-v="hoje">Abrir Hoje</button><button class="pill" data-a="gotoday" data-id="${T}">Abrir agenda</button></div>`}
 }else{
  const dn=S.tasks.filter(t=>t.done&&t.dd===T),op=pend.filter(t=>t.hd===T||(t.due&&t.due<=T)),hb=S.habits;
  if(i===0)body=`<h2>Como foi o dia</h2><p class="empty" style="padding:0 0 var(--space-2)">${dn.length} ${dn.length===1?'tarefa concluída':'tarefas concluídas'} hoje. Planejar para amanhã mantém o prazo original e horários já registrados.</p>${op.map(t=>`<div class="item"><input type="checkbox" class="chk" data-a="tog" data-id="${t.id}" aria-label="Concluir ${esc(t.t)}"><div class="t">${esc(t.t)}<small>${t.due&&t.due<T?'Atrasada, '+fmt(t.due):t.due===T?'prazo hoje':'planejada para hoje'}</small></div><button class="pill" data-a="rtplan" data-id="${t.id}">Planejar amanhã</button><button class="pill" data-a="rtdeadline" data-id="${t.id}">Alterar prazo para amanhã</button></div>`).join('')||'<p class="empty">Nada pendente de hoje. Bom trabalho!</p>'}${op.length>1?'<div class="bar" style="margin:var(--space-2) 0 0"><button class="pill" data-a="rtmove">Planejar todas para amanhã</button></div>':''}`;
  else if(i===1)body=`<h2>Hábitos de hoje</h2>${hb.map(h=>`<div class="item"><input type="checkbox" class="chk" data-a="htog" data-id="${h.id}" data-d="${T}" ${h.log[T]?'checked':''} aria-label="${esc(h.n)}"><div class="t">${esc(h.n)}<small>${habitInfo(h)}</small></div></div>`).join('')||'<p class="empty">Nenhum hábito cadastrado.</p>'}`;
  else if(i===2)body=`<h2>Como foi o dia?</h2><p class="empty">Este registro da noite fica separado do da manhã e do registro geral do Diário.</p><div class="lb" style="margin-top:0">Humor</div>${rtMoodBtns('n','m')}<div class="lb">Energia</div>${rtMoodBtns('n','e')}${ta('b','Três vitórias','Pequenas ou grandes…')}${ta('c','Gratidão','Pelo que você é grato hoje?')}`;
  else if(i===3){const e2=evOn(tm),due=S.tasks.filter(t=>!t.done&&!taskPaused(t)&&(t.due===tm||t.hd===tm||(t.bk&&t.bk.d===tm)));body=`<h2>Amanhã</h2><p class="empty" style="padding:0 0 var(--space-2)">${e2.length} ${e2.length===1?'compromisso':'compromissos'} · ${due.length} ${due.length===1?'tarefa relevante':'tarefas relevantes'} · carga ${fdur(dayLoad(tm).tot)}</p>${e2.map(evRow).join('')}${due.map(t=>`<div class="item"><div class="t">${esc(t.t)}<small>${t.due===tm?'Prazo amanhã':'Planejada para amanhã'}${t.due&&t.due!==tm?' · prazo '+fmt(t.due):''}</small></div></div>`).join('')}<label class="lb">A primeira coisa de amanhã<input id="rtnew" class="in" style="width:100%" value="${esc(done.draft||'')}" placeholder="Ex.: ligar para o banco" maxlength="120"></label><div class="bar" style="margin:var(--space-2) 0 0"><button class="pill" data-a="rtadd">Adicionar para amanhã</button></div>`}
  else body=`<h2>Dia encerrado</h2><div class="item"><div class="t">Concluídas hoje<small>${dn.length}</small></div></div><div class="item"><div class="t">Hábitos feitos<small>${hb.filter(h=>h.log[T]).length} de ${hb.length}</small></div></div><div class="item"><div class="t">Humor da noite<small>${rtFeel(T,'n','m')?MN[rtFeel(T,'n','m')-1]:'não registrado'}</small></div></div><div class="bar"><button class="pill" data-v="hoje">Abrir Hoje</button><button class="pill" data-a="gotoday" data-id="${tm}">Abrir agenda de amanhã</button></div>`;
 }
 const pos=steps.indexOf(i),last=pos===steps.length-1,fin=done[md],sk=rtStreak();
 return `<div class="top"><h1>Rotina ${md==='m'?'da manhã':'da noite'}</h1><div style="display:flex;gap:var(--space-2);flex-wrap:wrap"><button class="pill ${md==='m'?'on':''}" data-a="rtm" data-id="m" aria-pressed="${md==='m'}">Manhã</button><button class="pill ${md==='n'?'on':''}" data-a="rtm" data-id="n" aria-pressed="${md==='n'}">Noite</button></div></div>
 <p class="empty" style="padding:0 0 var(--space-2)">Cerca de 2 minutos.${sk?` Pelo menos uma rotina concluída em ${sk} ${sk===1?'dia seguido':'dias seguidos'}.`:''}${fin?' Hoje já concluída.':''}</p>
 <ol class="rts" aria-label="Etapas">${steps.map((j,n)=>`<li class="${j===i?'on':''}" ${j===i?'aria-current="step"':''}>${n+1}. ${st[j]}</li>`).join('')}</ol>
 <div class="panel" style="margin-top:var(--space-2)">${body}</div>
 <div class="bar" style="margin-top:var(--space-3)">${pos>0?'<button class="pill" data-a="rtn" data-id="-1">‹ Voltar</button>':''}${last?`<button class="pill dark" data-a="rtd">Concluir rotina</button>`:'<button class="pill dark" data-a="rtn" data-id="1">Próximo ›</button>'}</div>
 <section class="panel" data-rotina-tools style="margin-top:var(--space-4)"><h2>Configurações e histórico</h2><div class="bar"><button class="pill" data-a="rtrestart">Recomeçar esta rotina</button></div>${rtPrefs(md)}${rtHistory()}</section>`}
function routBox(){
 if(S.onb)return '';const h=today.getHours(),r=(S.rot||{})[T]||{};
 const m=h<12&&!r.m,n=h>=18&&!r.n;if(!m&&!n)return '';
 return `<div class="panel" id="rtb" role="region" aria-label="Rotina"><h2>${m?'Bom dia! Comece pela rotina da manhã':'Feche o dia com a rotina da noite'}</h2><p class="empty" style="padding:0 0 var(--space-2)">${m?'Humor, foco e as tarefas de hoje, em 2 minutos.':'Revise o dia, marque os hábitos e prepare amanhã.'}</p><button class="pill dark" data-a="rtgo" data-id="${m?'m':'n'}">Começar</button></div>`}
/* ===== Pacote C: ligações, leituras e revisão anual ===== */
const LKT=['tk','nt','ev','mt','rd','lk'],LKV={tk:'tarefas',nt:'notas',ev:'agenda',mt:'metas',rd:'leituras',lk:'links',prj:'projetos'};
const lkAll=()=>(S.lnk=Array.isArray(S.lnk)?S.lnk:[]);
const lkOf=ref=>lkAll().filter(l=>l.a===ref||l.b===ref).map(l=>l.a===ref?l.b:l.a);
const lkLabel=(ty,it)=>ty==='ev'?it.t+' · '+fmt(it.d):String(TRC[ty].l(it)||'');
function lkItem(ref){const[ty,id]=String(ref).split(':'),c=TRC[ty];if(!c)return null;const it=(c.g()||[]).find(x=>x.id===id);return it?{ty,id,ref,it,lb:lkLabel(ty,it)}:null}
function lkSet(a,b,on){const k=[a,b].sort().join('|'),L=lkAll(),i=L.findIndex(x=>x.id===k);if(on&&i<0)L.push({id:k,a,b,at:Date.now()});if(!on&&i>=0)L.splice(i,1)}
const lkBtn=(ty,id,cls)=>{const n=lkOf(ty+':'+id).filter(r=>lkItem(r)).length;return `<button class="x ${cls||''}" data-a="lkopen" data-id="${ty}:${id}" aria-label="Ligações${n?' ('+n+')':''}" title="Ligações com outros itens">↔${n?' '+n:''}</button>`};
let LKP=null,FLASH=null,LKO=null;
function lkResHtml(){
 const q=norm(LKP.q||''),have=new Set(lkOf(LKP.ref));if(!q)return '<p class="empty">Digite para buscar tarefas, notas, eventos, metas, leituras e links.</p>';
 const res=[];LKT.forEach(ty=>(TRC[ty].g()||[]).forEach(it=>{const ref=ty+':'+it.id,lb=lkLabel(ty,it);if(ref!==LKP.ref&&!have.has(ref)&&norm(lb).includes(q))res.push({ref,ty,lb})}));
 return res.slice(0,8).map(r=>`<button class="item lkres" data-a="lkadd" data-id="${r.ref}"><span class="chip c-g">${TRC[r.ty].n}</span><div class="t">${esc(r.lb)}</div></button>`).join('')||'<p class="empty">Nada encontrado.</p>'}
function lkDraw(){
 let el=$('#lkp');if(!LKP){if(el){el.remove();const o=LKO&&document.querySelector('[data-a="lkopen"][data-id="'+LKO+'"]');if(o)o.focus()}LKO=null;return}
 const cur=lkItem(LKP.ref);if(!cur){LKP=null;if(el)el.remove();return}
 if(!el){el=document.createElement('div');el.id='lkp';document.body.appendChild(el)}
 const rel=lkOf(LKP.ref).map(lkItem).filter(Boolean);
 el.innerHTML=`<div class="lk-back" data-a="lkclose"></div><div class="lkd" role="dialog" aria-modal="true" aria-label="Ligações de ${esc(cur.lb)}"><div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Ligações</h2><button class="x" data-a="lkclose" aria-label="Fechar">×</button></div><p class="empty" style="padding:0 0 var(--space-2)"><strong>${TRC[cur.ty].n}:</strong> ${esc(cur.lb)}</p>${rel.map(r=>`<div class="item"><span class="chip c-b">${TRC[r.ty].n}</span><button class="lkg" data-a="lkgo" data-id="${r.ref}">${esc(r.lb)}</button><button class="x" data-a="lkdel" data-id="${r.ref}" aria-label="Remover ligação com ${esc(r.lb)}">×</button></div>`).join('')||'<p class="empty">Nada ligado ainda.</p>'}<label class="lb">Ligar a…<input id="lkq" class="in" style="width:100%" placeholder="Buscar item para ligar" value="${esc(LKP.q||'')}" autocomplete="off"></label><div id="lkres">${lkResHtml()}</div></div>`;
 if(LKP.focus){LKP.focus=false;const i=$('#lkq');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}}}
function flashEl(){if(!FLASH)return;const el=document.querySelector('[data-lid="'+FLASH+'"]');FLASH=null;if(el){el.scrollIntoView({block:'center'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),2400)}}
document.addEventListener('input',e=>{if(e.target.id==='lkq'&&LKP){LKP.q=e.target.value;const r=$('#lkres');if(r)r.innerHTML=lkResHtml()}});
function lkGo(ref){
 const r=lkItem(ref);if(!r)return;LKP=null;if((r.ty==='tk'&&taskPaused(r.it))||(r.ty==='mt'&&r.it.archived)||(r.ty==='prj'&&r.it.archived)){archiveQuery='';S.view='arquivados';Q='';ED=null;$('#q').value='';return}S.view=LKV[r.ty];Q='';ED=null;$('#q').value='';FLASH=ref;
 if(r.ty==='ev'){S.mode='day';S.dy=mDays(r.it.d)}else if(r.ty==='nt'){noteReset();if(r.it.archived)NSTATUS='archived';PG={nt:Math.max(30,S.notes.length)};PGV='notas'}else if(r.ty==='tk'){S.filter='all';S.pf='';if(PGV!=='tarefas'){PG={};PGV='tarefas'}const index=taskList().findIndex(t=>t.id===r.id);if(index>=pgN('tk',60))PG.tk=Math.ceil((index+1)/60)*60}else if(r.ty==='lk')S.lc='';else if(r.ty==='rd'){S.rk='';S.rs='';RD.tab='collection';RD.q=''}}
/* leituras e filmes */
const RK={livro:['Livro','y',['Quero ler','Lendo','Lido']],filme:['Filme','p',['Quero ver','Assistindo','Visto']],série:['Série','g',['Quero ver','Assistindo','Visto']],artigo:['Artigo','b',['Quero ler','Lendo','Lido']],podcast:['Podcast','b',['Quero ouvir','Ouvindo','Ouvido']]},RS=['q','a','f'];
const rdLab=r=>(RK[r.k]||RK.livro)[2][RS.indexOf(r.st)];
const isBook=r=>!r||!r.k||r.k==='livro';
const isVisualMedia=r=>!!(r&&(r.k==='filme'||r.k==='série'));
const isShelfItem=r=>isBook(r)||isVisualMedia(r);
let RD={tab:'collection',q:'',sort:'recent',selected:'',lookup:null,seq:0,shelfKind:'all',shelfYear:'',shelfFav:'',movieMode:'poster',picked:''};
const coverUrl=(id,size='M')=>Number.isSafeInteger(id)&&id>0?`https://covers.openlibrary.org/b/id/${id}-${size}.jpg?default=false`:'';
const validCoverUrl=u=>typeof u==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(u.trim())?u.trim():'';
const mediaImgUrl=(r,size='M')=>(r&&validCoverUrl(r.coverUrl))||(r&&coverUrl(r.cover,size))||'';
const spineWidth=r=>r&&Number.isInteger(r.pages)&&r.pages>0?Math.max(34,Math.min(58,32+Math.round(r.pages/18))):42;
function spineColor(hex){return /^#[0-9a-f]{6}$/i.test(hex||'')?hex:'#74667a'}
function spineInk(hex){const rgb=spineColor(hex).slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4),l=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;return l>.179?'#161616':'#ffffff'}
function coverDominant(data){const bins=new Map();for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;const rgb=[data[i],data[i+1],data[i+2]],max=Math.max(...rgb),min=Math.min(...rgb);if(max>242&&min>225)continue;const key=rgb.map(x=>Math.floor(x/32)).join(',');const b=bins.get(key)||{n:0,sum:[0,0,0]};b.n++;rgb.forEach((x,j)=>b.sum[j]+=x);bins.set(key,b)}let best=null;for(const b of bins.values())if(!best||b.n>best.n)best=b;if(!best){const sum=[0,0,0];let n=0;for(let i=0;i<data.length;i+=4)if(data[i+3]>=128){for(let j=0;j<3;j++)sum[j]+=data[i+j];n++}if(n)best={sum,n}}return best?'#'+best.sum.map(x=>Math.round(x/best.n).toString(16).padStart(2,'0')).join(''):null}
function coverPalette(id,cover,customUrl){
 const src=validCoverUrl(customUrl)||coverUrl(cover);if(!src)return;
 const img=new Image();img.crossOrigin='anonymous';
 img.onload=()=>{
  try{
   const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,24,24);
   const color=coverDominant(ctx.getImageData(0,0,24,24).data),r=(S.reads||[]).find(x=>x.id===id);
   if(r&&(r.cover===cover||(customUrl&&r.coverUrl===customUrl))&&color){
    r.coverColor=color;save();
    const el=document.getElementById('spine-'+id);
    if(el){el.style.setProperty('--spine',color);el.style.setProperty('--spine-ink',spineInk(color))}
   }
  }catch(e){toast('Capa salva; não foi possível extrair a cor neste navegador')}
 };
 img.onerror=()=>toast('Capa salva, mas não foi possível carregar sua imagem agora');
 img.src=src;
}
function coverResults(r){
 const state=RD.lookup;if(!state||state.id!==r.id)return '';
 if(state.loading)return '<p role="status">Buscando imagens…</p>';
 if(state.error)return `<p role="status">${esc(state.error)}</p>`;
 if(!state.results.length)return '<p role="status">Nenhum resultado encontrado. Tente outro termo ou cole uma URL.</p>';
 return `<p>Escolha a edição correspondente:</p><div class="cover-results">${state.results.map(x=>{
  const thumb=x.posterThumb||coverUrl(x.cover,'S');
  const attrs=`${x.cover?` data-cover="${x.cover}"`:''}${x.poster?` data-poster="${esc(x.poster)}"`:''}${x.year?` data-year="${esc(String(x.year))}"`:''}${x.mins?` data-mins="${esc(String(x.mins))}"`:''}`;
  return `<button type="button" class="cover-result" data-a="rd-cover-use" data-id="${esc(r.id)}"${attrs}><img src="${esc(thumb)}" alt="" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer"><span>${esc(x.title)}<small>${esc(x.author)}${x.year?' · '+esc(String(x.year)):''}${x.mins?' · '+esc(String(x.mins))+' min':''}</small></span></button>`;
 }).join('')}</div>`;
}
function coverEditor(r){
 if(!isShelfItem(r))return '';
 const label=isVisualMedia(r)?'pôster':'capa',hasImg=!!mediaImgUrl(r);
 const query=RD.lookup&&RD.lookup.id===r.id?RD.lookup.q:[r.t,r.a].filter(Boolean).join(' ');
 const srcNote=isVisualMedia(r)?'Pôsteres: catálogo público iTunes / Apple Media.':'Capas: <a href="https://openlibrary.org/" target="_blank" rel="noopener">Open Library</a>.';
 return `<details><summary>${hasImg?'Trocar '+label:'Buscar '+label+' ou cor'}</summary>
  <p class="empty">${isVisualMedia(r)?'A busca consulta o catálogo público da Apple (iTunes) para encontrar pôster e ficha.':'A busca envia o texto à Open Library. Confira a edição antes de escolher.'}</p>
  <div class="bar"><input class="in grow" id="cover-query-${esc(r.id)}" value="${esc(query)}" placeholder="${isVisualMedia(r)?'Título ou direção':'Título, autor ou ISBN'}" aria-label="Buscar ${label} de ${esc(r.t)}"><button type="button" class="pill" data-a="rd-cover-find" data-id="${esc(r.id)}">Buscar ${label}</button></div>
  <div id="cover-results-${esc(r.id)}">${coverResults(r)}</div>
  <div class="bar" style="margin-top:var(--space-2)">
   <label class="lb" style="color:inherit">Cor na estante <input type="color" class="in" style="width:52px;height:40px;padding:2px" data-rd-color="${esc(r.id)}" value="${spineColor(r.coverColor)}" aria-label="Cor na estante de ${esc(r.t)}"></label>
   <label class="lb grow" style="color:inherit">URL de imagem (opcional) <input class="in" type="url" data-rd-cover-url="${esc(r.id)}" value="${esc(r.coverUrl||'')}" placeholder="https://..." aria-label="URL da imagem de ${esc(r.t)}"></label>
   ${hasImg?`<button type="button" class="pill" data-a="rd-cover-remove" data-id="${esc(r.id)}">Remover ${label}</button>`:''}
  </div>
  <p class="empty">${srcNote}</p>
 </details>`;
}
async function wikiCoverSearch(q,lang,signal){
 const p=new URLSearchParams({action:'query',generator:'search',gsrsearch:q,gsrlimit:'6',prop:'pageimages|description',piprop:'thumbnail',pithumbsize:'400',format:'json',origin:'*'});
 const res=await fetch('https://'+lang+'.wikipedia.org/w/api.php?'+p,{signal});
 if(!res.ok)return [];
 const data=await res.json(),pages=Object.values((data&&data.query&&data.query.pages)||{});
 return pages.filter(x=>x&&x.thumbnail&&typeof x.thumbnail.source==='string'&&/^https:\/\//i.test(x.thumbnail.source)).slice(0,6).map(x=>({
  poster:x.thumbnail.source,
  posterThumb:x.thumbnail.source,
  title:String(x.title||'Sem título'),
  author:String(x.description||'Wikipédia'),
  year:'',
  mins:''
 }));
}
async function findCover(id){
 const r=(S.reads||[]).find(x=>x.id===id),input=document.getElementById('cover-query-'+id);if(!r||!input)return;
 const q=input.value.trim();if(!q){toast('Informe um título para buscar');return}
 const seq=++RD.seq;RD.lookup={id,q,seq,loading:true,results:[]};
 let el=document.getElementById('cover-results-'+id);if(el)el.innerHTML=coverResults(r);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  if(isVisualMedia(r)){
   const media=r.k==='série'?'tvShow':'movie',entity=r.k==='série'?'tvSeason':'movie';
   const p=new URLSearchParams({term:q,country:'BR',media,entity,limit:'8'});
   const res=await fetch('https://itunes.apple.com/search?'+p,{signal:controller.signal});
   if(!res.ok)throw Error('rede');const data=await res.json();
   if(!RD.lookup||RD.lookup.seq!==seq)return;
   let results=(Array.isArray(data.results)?data.results:[]).filter(x=>typeof x.artworkUrl100==='string'&&/^https:\/\//i.test(x.artworkUrl100)).slice(0,8).map(x=>({
    poster:x.artworkUrl100.replace(/\/100x100bb\.(jpg|png)$/i,'/300x450bb.$1'),
    posterThumb:x.artworkUrl100,
    title:String(x.trackName||x.collectionName||'Sem título'),
    author:String(x.artistName||'Direção não informada'),
    year:x.releaseDate?+String(x.releaseDate).slice(0,4)||'':'',
    mins:x.trackTimeMillis?Math.max(1,Math.round(x.trackTimeMillis/60000)):''
   }));
   if(!results.length){
    try{
     results=await wikiCoverSearch(q,'pt',controller.signal);
     if(!results.length)results=await wikiCoverSearch(q,'en',controller.signal);
    }catch(x){}
    if(!RD.lookup||RD.lookup.seq!==seq)return;
   }
   RD.lookup.loading=false;
   RD.lookup.results=results;
  }else{
   const p=new URLSearchParams({q,fields:'key,title,author_name,cover_i,first_publish_year',limit:'8'});
   const res=await fetch('https://openlibrary.org/search.json?'+p,{signal:controller.signal});
   if(!res.ok)throw Error('rede');const data=await res.json();
   if(!RD.lookup||RD.lookup.seq!==seq)return;
   RD.lookup.loading=false;
   RD.lookup.results=(Array.isArray(data.docs)?data.docs:[]).filter(x=>Number.isSafeInteger(x.cover_i)&&x.cover_i>0).slice(0,8).map(x=>({
    cover:x.cover_i,
    title:String(x.title||'Sem título'),
    author:Array.isArray(x.author_name)?x.author_name.slice(0,2).join(', '):'Autor não informado',
    year:x.first_publish_year||''
   }));
  }
 }catch(e){
  if(!RD.lookup||RD.lookup.seq!==seq)return;
  RD.lookup.loading=false;RD.lookup.error='Não foi possível buscar agora. Confira a conexão e tente novamente.';
 }finally{clearTimeout(timer)}
 el=document.getElementById('cover-results-'+id);if(el)el.innerHTML=coverResults(r);
}
function renderBookSpine(r,i){
 const color=spineColor(r.coverColor),w=spineWidth(r);
 return `<button type="button" class="book-spine" id="spine-${esc(r.id)}" data-a="rd-open" data-id="${esc(r.id)}" data-fav="${r.r===5?'1':'0'}" aria-pressed="${r.id===RD.selected}" aria-label="Ver ${esc(r.t)}${r.a?', de '+esc(r.a):''}" style="--spine:${color};--spine-ink:${spineInk(color)};--book-h:${150+(i%4)*7}px;--book-w:${w}px"><span>${esc(r.t)}</span><small>${esc(r.a||'')}</small></button>`;
}
function renderMovieItem(r){
 const color=spineColor(r.coverColor),ink=spineInk(color),img=mediaImgUrl(r),K=RK[r.k]||RK.filme;
 const attrs=`id="spine-${esc(r.id)}" data-a="rd-open" data-id="${esc(r.id)}" data-fav="${r.r===5?'1':'0'}" aria-pressed="${r.id===RD.selected}" aria-label="Ver ${K[0].toLowerCase()} ${esc(r.t)}${r.a?', de '+esc(r.a):''}" style="--spine:${color};--spine-ink:${ink}"`;
 if(RD.movieMode==='spine'){
  return `<button type="button" class="movie-item movie-spine" ${attrs}><small class="movie-tag">${r.k==='série'?'SÉRIE':'FILME'}</small><span>${esc(r.t)}</span><small>${esc(r.a||String(r.year||''))}</small></button>`;
 }
 const art=img?`<img class="movie-poster-img" data-book-cover src="${esc(img)}" alt="" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer"><span class="movie-poster-fallback" data-cover-fallback hidden>${esc(r.t)}</span>`:`<span class="movie-poster-fallback">${esc(r.t)}${r.a?`<small>${esc(r.a)}</small>`:''}</span>`;
 return `<button type="button" class="movie-item movie-poster" ${attrs}>${art}<span class="movie-caption"><strong class="movie-title">${esc(r.t)}</strong><small class="movie-meta">${r.year?esc(String(r.year)):K[0]}${r.mins?' · '+r.mins+'m':''}${r.r?' · ★'+r.r:''}</small></span></button>`;
}
function groupByShelfYear(list,unitSing,unitPl,renderFn,wrapCls,ariaPrefix){
 if(RD.shelfYear!=='by-year')return `<div class="${wrapCls}" aria-label="${ariaPrefix}">${list.map(renderFn).join('')}</div>`;
 const groups=new Map();
 list.forEach(r=>{const y=/^\d{4}/.test(r.df||'')?r.df.slice(0,4):'Sem ano';if(!groups.has(y))groups.set(y,[]);groups.get(y).push(r)});
 return [...groups.entries()].map(([yr,items])=>`<div class="shelf-group"><div class="shelf-group-head"><span class="shelf-badge">${esc(yr)}</span><small>${items.length} ${items.length===1?unitSing:unitPl}</small></div><div class="${wrapCls}" aria-label="${ariaPrefix} em ${esc(yr)}">${items.map(renderFn).join('')}</div></div>`).join('');
}
function readShelf(){
 const A=S.reads||[],inProg=A.filter(r=>isShelfItem(r)&&r.st==='a');
 const allBooks=A.filter(r=>isBook(r)&&r.st==='f').sort((a,b)=>(b.df||'').localeCompare(a.df||''));
 const allMovies=A.filter(r=>isVisualMedia(r)&&r.st==='f').sort((a,b)=>(b.df||'').localeCompare(a.df||''));
 const allFilms=allMovies.filter(r=>r.k==='filme'),allSeries=allMovies.filter(r=>r.k==='série');
 const years=[...new Set([...allBooks,...allMovies].map(r=>(r.df||'').slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort().reverse();
 const matchShelf=r=>(!RD.shelfFav||(r.r||0)>=+RD.shelfFav)&&(!/^\d{4}$/.test(RD.shelfYear)||(r.df||'').startsWith(RD.shelfYear));
 const books=(RD.shelfKind==='movies'||RD.shelfKind==='series')?[]:allBooks.filter(matchShelf);
 const movieSource=RD.shelfKind==='movies'?allFilms:RD.shelfKind==='series'?allSeries:allMovies;
 const movies=RD.shelfKind==='books'?[]:movieSource.filter(matchShelf);
 const selected=[...allBooks,...allMovies,...inProg].find(r=>r.id===RD.selected);
 const nowHtml=inProg.length?`<section class="panel shelf-now" aria-label="Em andamento agora"><h2>Na cabeceira agora</h2><div class="now-grid">${inProg.map(r=>{
  const K=RK[r.k]||RK.livro,img=mediaImgUrl(r,'S'),col=spineColor(r.coverColor),pct=r.p||0;
  const sub=isBook(r)&&r.pages?`${r.page||0} de ${r.pages} pág. (${pct}%)`:r.k==='série'&&(r.season||r.episode)?`T${r.season||1} · Ep. ${r.episode||0}`:`${pct}% concluído`;
  const step=isBook(r)&&r.pages?`<button type="button" class="pill" data-a="rd-step" data-id="${esc(r.id)}" data-d="10">+10 pág.</button>`:r.k==='série'?`<button type="button" class="pill" data-a="rd-step" data-id="${esc(r.id)}" data-d="1">+1 ep.</button>`:'';
  return `<article class="now-card"><div class="now-thumb" style="--spine:${col};--spine-ink:${spineInk(col)}">${img?`<img src="${esc(img)}" alt="" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer">`:`<span>${esc((r.t||'').slice(0,2).toUpperCase())}</span>`}</div><div class="now-body"><span class="chip" style="margin:0">${K[0]}</span><strong>${esc(r.t)}</strong><small>${esc(sub)}</small><div class="prog" aria-hidden="true"><i style="width:${pct}%"></i></div><div class="bar" style="margin:var(--space-1) 0 0">${step}<button type="button" class="pill" data-a="rd-finish" data-id="${esc(r.id)}">Concluir</button><button type="button" class="pill" data-a="rd-open" data-id="${esc(r.id)}">Detalhes</button></div></div></article>`;
 }).join('')}</div></section>`:'';
 const pill=(a,id,l,on)=>`<button type="button" class="pill ${on?'on':''}" data-a="${a}" data-id="${esc(id)}" aria-pressed="${on}">${l}</button>`;
 const hasAnyFinished=allBooks.length+allMovies.length>0;
 const controls=hasAnyFinished?`<div class="shelf-controls"><div class="bar">${pill('rd-shelf-kind','all','Tudo',RD.shelfKind==='all')}${pill('rd-shelf-kind','books',`Livros (${allBooks.length})`,RD.shelfKind==='books')}${pill('rd-shelf-kind','movies',`Filmes (${allFilms.length})`,RD.shelfKind==='movies')}${pill('rd-shelf-kind','series',`Séries (${allSeries.length})`,RD.shelfKind==='series')}</div><div class="bar">${pill('rd-shelf-fav','','Todas as notas',!RD.shelfFav)}${pill('rd-shelf-fav','4','★ 4+',RD.shelfFav==='4')}${pill('rd-shelf-fav','5','★ 5 Favoritos',RD.shelfFav==='5')}${pill('rd-shelf-year','by-year','Agrupar por ano',RD.shelfYear==='by-year')}${years.map(y=>pill('rd-shelf-year',y,y,RD.shelfYear===y)).join('')}${RD.shelfKind!=='books'&&allMovies.length?`${pill('rd-movie-mode','poster','Pôsteres',RD.movieMode==='poster')}${pill('rd-movie-mode','spine','Lombadas',RD.movieMode==='spine')}`:''}</div></div>`:'';
 const bookSec=(RD.shelfKind!=='movies'&&RD.shelfKind!=='series'&&(books.length||allBooks.length||RD.shelfKind==='books'))?`<section class="shelf-section"><h3>Estante de livros (${books.length})</h3>${books.length?groupByShelfYear(books,'livro','livros',renderBookSpine,'bookshelf','Livros concluídos'):'<p class="empty">Nenhum livro concluído corresponde a esses filtros.</p>'}</section>`:'';
 const movieHeading=RD.shelfKind==='movies'?'Prateleira de filmes':RD.shelfKind==='series'?'Prateleira de séries':'Prateleira de filmes e séries';
 const movieSec=(RD.shelfKind!=='books'&&(movies.length||movieSource.length||RD.shelfKind==='movies'||RD.shelfKind==='series'))?`<section class="shelf-section"><h3>${movieHeading} (${movies.length})</h3>${movies.length?groupByShelfYear(movies,'título','títulos',renderMovieItem,'movieshelf','Filmes e séries concluídos'):'<p class="empty">Nenhum filme ou série concluído corresponde a esses filtros.</p>'}</section>`:'';
 const selImg=selected?mediaImgUrl(selected):'';
 const srcCaption=selected&&selected.coverUrl?(isVisualMedia(selected)?'Pôster: '+(selected.coverUrl.includes('mzstatic.com')?'iTunes':selected.coverUrl.includes('wikimedia.org')?'Wikipédia':'URL'):'Capa personalizada'):'Capa: Open Library';
 const detailHtml=selected?`<section class="panel book-detail" id="book-detail" tabindex="-1" aria-label="Detalhes de ${esc(selected.t)}"><div class="book-detail-head"><div>${selImg?`<img class="book-cover" data-book-cover src="${esc(selImg)}" alt="Capa de ${esc(selected.t)}" crossorigin="anonymous" referrerpolicy="no-referrer"><p class="book-no-cover" data-cover-fallback hidden>Capa indisponível agora. Tente novamente com internet.</p><p class="empty">${srcCaption}</p>`:'<div class="book-no-cover">Capa não selecionada</div>'}</div><div><h2>${esc(selected.t)}</h2><p>${esc(selected.a||(isVisualMedia(selected)?'Direção não informada':'Autor não informado'))}${selected.year?' · '+esc(String(selected.year)):''}</p><p>${selected.df?'Concluído em '+fmt(selected.df)+' '+esc(selected.df.slice(0,4)):rdLab(selected)}${selected.r?' · Nota '+selected.r+'/5':''}</p>${selected.pages?`<p>${selected.pages} páginas</p>`:''}${selected.mins?`<p>Duração: ${selected.mins} min</p>`:''}${(selected.season||selected.episode)?`<p>Temporada ${selected.season||1}${selected.episode?' · Episódio '+selected.episode:''}</p>`:''}${selected.n?`<blockquote class="book-quote" data-priv-text>${esc(selected.n)}</blockquote>`:''}<div class="bar"><button type="button" class="pill" data-a="rd-edit" data-id="${esc(selected.id)}">Editar na coleção</button><button type="button" class="pill" data-a="rd-note-create" data-id="${esc(selected.id)}">Criar nota vinculada</button>${lkBtn('rd',selected.id)}<button type="button" class="pill" data-a="rd-close">Fechar detalhes</button></div></div></div>${coverEditor(selected)}</section>`:'';
 const introText=hasAnyFinished?`${allBooks.length} ${allBooks.length===1?'livro':'livros'} e ${allMovies.length} ${allMovies.length===1?'filme ou série':'filmes e séries'} concluídos. Toque em um título para ver capa, pôster e anotações.`:'Quando você concluir um livro, filme ou série, ele aparecerá aqui.';
 return `<div class="shelf-intro"><h2>Sua estante</h2><p>${introText}</p></div>${nowHtml}${controls}${bookSec}${movieSec}${detailHtml}`;
}
document.addEventListener('error',e=>{const i=e.target;if(i&&i.matches&&i.matches('[data-book-cover]')){i.hidden=true;const p=i.parentElement.querySelector('[data-cover-fallback]');if(p)p.hidden=false}},true);
function leituras(){
 const A=S.reads=S.reads||[],fk=S.rk||'',fs=S.rs||'',Y=String(today.getFullYear());
 const q=norm(RD.q.trim()),L=A.filter(r=>(!fk||(fk==='livro'?isBook(r):r.k===fk))&&(!fs||r.st===fs)&&(!q||norm([r.t,r.a,r.n].join(' ')).includes(q))).sort((a,b)=>RD.sort==='title'?String(a.t||'').localeCompare(String(b.t||''),'pt-BR'):RD.sort==='finished'?(b.df||'').localeCompare(a.df||''):(Number(b.st==='a')-Number(a.st==='a'))||(b.da||'').localeCompare(a.da||''));
 const fin=A.filter(r=>r.st==='f'&&(r.df||'').startsWith(Y)),rt=fin.filter(r=>r.r),av=rt.length?(rt.reduce((s,r)=>s+r.r,0)/rt.length).toFixed(1).replace('.',','):'–';
 const pagesY=fin.filter(isBook).reduce((s,r)=>s+(+r.pages||0),0),minsY=fin.filter(r=>r.k==='filme').reduce((s,r)=>s+(+r.mins||0),0);
 const by=Object.keys(RK).map(k=>[k,fin.filter(r=>k==='livro'?isBook(r):r.k===k).length]).filter(x=>x[1]);
 const readGoals=(S.metas||[]).filter(g=>!g.archived&&(/\b(livro|livros|página|páginas|leitura|leituras|filme|filmes)\b/i.test(g.t)||(g.kr||[]).some(k=>/\b(livro|livros|página|páginas|leitura|leituras|filme|filmes)\b/i.test(k.t+' '+(k.un||'')))||lkOf('mt:'+g.id).some(r=>r.startsWith('rd:')))).slice(0,2);
 const durTxt=minsY>=60?Math.floor(minsY/60)+'h'+(minsY%60?' '+minsY%60+'min':''):minsY+' min';
 const chip=(a,id,l,on)=>`<button class="pill ${on?'on':''}" data-a="${a}" data-id="${id}" aria-pressed="${on}">${l}</button>`;
 const tabs=`<div class="bar" role="group" aria-label="Visualização de leituras"><button class="pill ${RD.tab==='collection'?'on':''}" data-a="rd-tab" data-id="collection" aria-pressed="${RD.tab==='collection'}">Minha coleção</button><button class="pill ${RD.tab==='shelf'?'on':''}" data-a="rd-tab" data-id="shelf" aria-pressed="${RD.tab==='shelf'}">Estante</button>${A.some(r=>r.st==='q')?'<button type="button" class="pill" data-a="rd-pick-random">Sortear da fila</button>':''}</div>`;
 const pickedItem=RD.picked&&A.find(r=>r.id===RD.picked&&r.st==='q');
 const pickedBox=pickedItem?`<div class="panel" data-rd-picked style="margin-bottom:var(--space-3)"><h2>Sugestão da sua fila</h2><p><strong>${esc(pickedItem.t)}</strong> · ${(RK[pickedItem.k]||RK.livro)[0]}${pickedItem.a?' · '+esc(pickedItem.a):''}</p><div class="bar"><button type="button" class="pill dark" data-a="rd-start" data-id="${esc(pickedItem.id)}">Começar agora</button><button type="button" class="pill" data-a="rd-pick-random">Sortear outro</button><button type="button" class="pill" data-a="rd-pick-close">Fechar</button></div></div>`:'';
 if(RD.tab==='shelf')return `<div class="top"><h1>Leituras e mídia</h1></div>${tabs}${pickedBox}${readShelf()}`;
 const metaRow=readGoals.length?`<div style="margin-top:var(--space-2)">${readGoals.map(g=>{const pct=Math.round(metaProg(g)*100);return `<div style="margin-top:var(--space-1)"><small>Meta: <strong>${esc(g.t)}</strong> (${pct}%)</small><div class="prog" aria-hidden="true"><i style="width:${pct}%"></i></div></div>`}).join('')}</div>`:'';
 return `<div class="top"><h1>Leituras e mídia</h1></div>${tabs}${pickedBox}
 <form class="bar" id="frd"><input class="in grow" name="t" placeholder="Título (livro, filme, artigo…)" required><input class="in" name="a" placeholder="Autor ou diretor" aria-label="Autor ou diretor"><select class="in" name="k" aria-label="Tipo">${Object.entries(RK).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('')}</select><select class="in" name="st" aria-label="Situação"><option value="q">Quero</option><option value="a">Em andamento</option><option value="f">Concluído</option></select><input class="in" name="u" type="url" placeholder="Link (opcional)" aria-label="Link"><label class="lb">Data de conclusão (opcional)<input class="in" name="df" type="date"></label><button class="pill dark">Adicionar</button></form>
 <div class="panel" style="margin-bottom:var(--space-3)"><h2>Em ${Y}</h2><p style="margin:0">${fin.length?`<strong>${fin.length}</strong> ${fin.length===1?'concluído':'concluídos'}${by.length?' ('+by.map(x=>x[1]+' '+RK[x[0]][0].toLowerCase()+(x[1]>1?'s':'')).join(', ')+')':''}. Nota média: <strong>${av}</strong>${pagesY?` · <strong>${pagesY}</strong> páginas`:''}${minsY?` · <strong>${durTxt}</strong> de filmes`:''}.`:'Nada concluído ainda neste ano.'} ${A.filter(r=>r.st==='a').length?'Em andamento: '+A.filter(r=>r.st==='a').length+'.':''}</p>${metaRow}</div>
 <div class="bar"><input class="in grow" id="rd-search" value="${esc(RD.q)}" placeholder="Buscar por título, autor ou anotações" aria-label="Buscar na coleção"><select class="in" id="rd-sort" aria-label="Ordenar coleção"><option value="recent" ${RD.sort==='recent'?'selected':''}>Em andamento primeiro</option><option value="title" ${RD.sort==='title'?'selected':''}>Título</option><option value="finished" ${RD.sort==='finished'?'selected':''}>Conclusão recente</option></select></div><div class="bar">${chip('rfk','','Todos',!fk)}${Object.entries(RK).map(([k,v])=>chip('rfk',k,v[0],fk===k)).join('')}</div><div class="bar">${chip('rfs','','Qualquer situação',!fs)}${chip('rfs','q','Quero',fs==='q')}${chip('rfs','a','Em andamento',fs==='a')}${chip('rfs','f','Concluídos',fs==='f')}</div>
 <div class="notes">${L.map(r=>{const K=RK[r.k]||RK.livro;const details=isBook(r)?`<details><summary>Progresso em páginas</summary><label class="lb">Total de páginas <input class="in" type="number" min="1" max="100000" data-rd-pages="${esc(r.id)}" value="${r.pages||''}"></label><label class="lb">Páginas lidas <input class="in" type="number" min="0" max="${r.pages||100000}" data-rd-page="${esc(r.id)}" value="${r.page||0}"></label><label class="lb">Ano <input class="in" type="number" min="1800" max="2100" data-rd-year="${esc(r.id)}" value="${r.year||''}"></label></details>`:r.k==='filme'?`<details><summary>Ficha do filme</summary><label class="lb">Ano de lançamento <input class="in" type="number" min="1880" max="2100" data-rd-year="${esc(r.id)}" value="${r.year||''}"></label><label class="lb">Duração (min) <input class="in" type="number" min="1" max="10000" data-rd-mins="${esc(r.id)}" value="${r.mins||''}"></label></details>`:r.k==='série'?`<details><summary>Temporada e episódios</summary><label class="lb">Temporada atual <input class="in" type="number" min="1" max="999" data-rd-season="${esc(r.id)}" value="${r.season||''}"></label><label class="lb">Episódio atual <input class="in" type="number" min="0" max="9999" data-rd-episode="${esc(r.id)}" value="${r.episode??''}"></label><label class="lb">Ano <input class="in" type="number" min="1920" max="2100" data-rd-year="${esc(r.id)}" value="${r.year||''}"></label></details>`:'';return `<div class="note c-${K[1]}" data-lid="rd:${r.id}"><input data-rdf="t" data-id="${r.id}" value="${esc(r.t)}" placeholder="Título" aria-label="Título"><input data-rdf="a" data-id="${r.id}" value="${esc(r.a||'')}" placeholder="Autor ou diretor" aria-label="Autor ou diretor" style="font-size:var(--type-small);font-weight:400"><div class="bar" style="margin:0;align-items:center"><span class="chip" style="background:rgba(0,0,0,.12)">${K[0]}</span><select class="in" data-rds="${r.id}" aria-label="Situação de ${esc(r.t)}">${RS.map((s,i)=>`<option value="${s}" ${r.st===s?'selected':''}>${K[2][i]}</option>`).join('')}</select></div>${r.st==='a'?`<label class="lb">Progresso <span>${r.p||0}%</span><input type="range" min="0" max="100" step="5" value="${r.p||0}" data-rdp="${r.id}" aria-label="Progresso de ${esc(r.t)}" style="width:100%"></label>`:''}<div role="group" aria-label="Nota">${[1,2,3,4,5].map(n=>`<button class="x" data-a="rdr" data-id="${r.id}" data-n="${n}" aria-pressed="${(r.r||0)>=n}" aria-label="${n} de 5 estrelas">${(r.r||0)>=n?'★':'☆'}</button>`).join('')}</div><textarea data-rdf="n" data-id="${r.id}" placeholder="Anotações, citações, o que achou…" aria-label="Anotações" style="min-height:70px">${esc(r.n||'')}</textarea>${details}${coverEditor(r)}${r.st==='f'?`<label class="lb">Data de conclusão<input class="in" type="date" data-rd-date="${esc(r.id)}" value="${esc(r.df||'')}"></label>`:''}<footer><span>${r.st==='f'&&r.df?'Concluído em '+fmt(r.df):r.da?'Adicionado em '+fmt(r.da):''}</span><span>${r.u?`<a href="${esc(safeUrl(r.u))}" target="_blank" rel="noopener" class="x">abrir ↗</a>`:''}${lkBtn('rd',r.id)}<button class="x" data-a="delrd" data-id="${r.id}" aria-label="Excluir ${esc(r.t)}">Excluir</button></span></footer></div>`}).join('')||(q||fk||fs?'<p class="empty">Nenhum item corresponde à busca ou aos filtros.</p>':emp('rd','Sua lista está vazia. Registre o que quer ler ou assistir, acompanhe o que está em andamento e guarde suas notas.','Adicionar o primeiro','data-a="focusform" data-id="#frd"'))}</div>`}
document.addEventListener('change',e=>{const i=e.target;if(!i||!i.dataset)return;
 if(i.id==='rd-sort'){RD.sort=i.value;renderKeepDraft();return}
 if(i.dataset.rdDate){const r=(S.reads||[]).find(x=>x.id===i.dataset.rdDate),v=i.value;if(r){r.df=v;renderKeepDraft()}return}
 if(i.dataset.rdColor){const r=(S.reads||[]).find(x=>x.id===i.dataset.rdColor);if(r&&/^#[0-9a-f]{6}$/i.test(i.value)){r.coverColor=i.value.toLowerCase();renderKeepDraft()}return}
 if(i.dataset.rdCoverUrl){const r=(S.reads||[]).find(x=>x.id===i.dataset.rdCoverUrl);if(!r)return;const u=i.value.trim();if(!u){delete r.coverUrl;renderKeepDraft();return}if(!validCoverUrl(u)){toast('Use um endereço https:// válido para a imagem');renderKeepDraft();return}r.coverUrl=u;delete r.cover;delete r.coverColor;renderKeepDraft();coverPalette(r.id,null,u);return}
 if(i.dataset.rdYear||i.dataset.rdMins||i.dataset.rdSeason||i.dataset.rdEpisode){
  const specs=[['rdYear','year',1800,2100],['rdMins','mins',1,10000],['rdSeason','season',1,999],['rdEpisode','episode',0,9999]];
  for(const [dk,fk,lo,hi] of specs){
   if(!i.dataset[dk])continue;
   const r=(S.reads||[]).find(x=>x.id===i.dataset[dk]);if(!r)return;
   const v=i.value.trim();if(!v){delete r[fk];renderKeepDraft();return}
   const n=+v;if(!Number.isInteger(n)||n<lo||n>hi){toast('Informe um número inteiro válido');renderKeepDraft();return}
   r[fk]=n;renderKeepDraft();return;
  }
 }
 if(i.dataset.rdPages||i.dataset.rdPage){const r=(S.reads||[]).find(x=>x.id===(i.dataset.rdPages||i.dataset.rdPage));if(!r)return;const v=i.value.trim(),n=+v;if(i.dataset.rdPages&&!v){delete r.pages;delete r.page;renderKeepDraft();return}if(!Number.isInteger(n)||n<0||n>100000||(i.dataset.rdPages&&n<1)||(i.dataset.rdPage&&(!r.pages||n>r.pages))||(i.dataset.rdPage&&r.st==='f'&&n!==r.pages)){toast('Confira o total e as páginas lidas; um livro concluído deve estar completo');renderKeepDraft();return}if(i.dataset.rdPages){r.pages=n;r.page=r.st==='f'?n:Math.min(r.page||0,n)}else r.page=n;r.p=r.pages?Math.round(r.page/r.pages*100):r.p;renderKeepDraft();return}
 if(i.dataset.rds){const r=(S.reads||[]).find(x=>x.id===i.dataset.rds);if(r&&RS.includes(i.value)){const was=r.st;r.st=i.value;if(r.st==='f'){r.df=r.df||T;r.p=100;if(r.pages)r.page=r.pages}else if(was==='f'&&r.p===100){r.p=0;if(r.pages)r.page=0}renderKeepDraft()}}});
/* revisão anual do diário */
function diarioAno(){
 const Y=today.getFullYear()+(S.dyr||0),cur=Y===today.getFullYear(),end=cur?T:Y+'-12-31',days=[];
 for(let d=new Date(Y,0,1);ds(d)<=end;d=add(d,1))days.push(ds(d));
 const E=days.map(k=>({k,e:S.dia[k]||{}})),has=x=>x.e.m||x.e.e||x.e.a||x.e.b||x.e.c,reg=E.filter(has),mo=E.filter(x=>x.e.m),en=E.filter(x=>x.e.e);
 const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0,f1=n=>n.toFixed(1).replace('.',',');
 const head=`<div class="top"><h1>Revisão de ${Y}</h1><div style="display:flex;gap:var(--space-2);flex-wrap:wrap"><button class="pill" data-a="dyn" data-n="-1" aria-label="Ano anterior">‹</button><button class="pill" data-a="dyn" data-n="0">Este ano</button><button class="pill" data-a="dyn" data-n="1" aria-label="Próximo ano" ${cur?'disabled':''}>›</button><button class="pill dark" data-a="dvw" data-id="dia">Voltar ao diário</button></div></div>`;
 if(!reg.length)return head+`<div class="panel">${emp('dia','Ainda não há registros neste ano. Anote o humor e escreva no diário, e a revisão aparece aqui.','Ir para o diário','data-a="dvw" data-id="dia"')}</div>`;
 const mm2=[...Array(12)].map((_,m)=>{const a=mo.filter(x=>+x.k.slice(5,7)===m+1).map(x=>x.e.m);return{m,n:a.length,v:mean(a)}}),mv=mm2.filter(x=>x.n);
 const best=mv.length?mv.reduce((a,b)=>b.v>a.v?b:a):null,wd=[...Array(7)].map((_,g)=>{const a=mo.filter(x=>new Date(x.k+'T00:00').getDay()===g).map(x=>x.e.m);return{g,n:a.length,v:mean(a)}}),wv=wd.filter(x=>x.n>=3),bw=wv.length?wv.reduce((a,b)=>b.v>a.v?b:a):null;
 const pad=(new Date(Y,0,1).getDay()+6)%7,W=Math.ceil((pad+days.length)/7);
 const heat=`<div class="hmap" style="grid-template-columns:repeat(${W},1fr);width:100%;max-width:${W*18}px" role="img" aria-label="Humor dia a dia em ${Y}">${'<i class="hm" style="visibility:hidden"></i>'.repeat(pad)}${E.map(x=>`<i class="hm" style="background:${x.e.m?MC[x.e.m-1]:'var(--card)'}" title="${fmt(x.k)}: ${x.e.m?MN[x.e.m-1]:'sem registro'}"></i>`).join('')}</div><p class="empty" style="padding:var(--space-2) 0 0">${MC.map((c,i)=>`<span class="lg" style="background:${c}"></span>${MN[i]}`).join(' &nbsp; ')} &nbsp; <span class="lg" style="background:var(--card);border:1px solid var(--line)"></span>sem registro</p>`;
 const bars=`<div class="chart" role="img" aria-label="Humor médio por mês: ${mm2.map(x=>MES[x.m]+' '+(x.n?f1(x.v):'sem dados')).join(', ')}">${mm2.map(x=>`<div class="col"><small>${x.n?f1(x.v):'–'}</small><div class="bar-w"><i style="height:${x.v/5*100}%;background:${x.n?MC[Math.min(4,Math.max(0,Math.round(x.v)-1))]:'transparent'}"></i></div><small>${MES[x.m]}</small></div>`).join('')}</div>`;
 const wdr=`${wd.map(x=>`<div class="cat" style="grid-template-columns:34px 1fr auto;margin-bottom:var(--space-1)"><span>${DIA[x.g]}</span><div class="fb" aria-hidden="true"><i style="width:${x.v/5*100}%"></i></div><small>${x.n?f1(x.v):'–'}</small></div>`).join('')}`;
 const hab=S.habits.map(h=>{let c=0,bs=0,r=0;days.forEach(k=>{if(h.log[k]){c++;r++;bs=Math.max(bs,r)}else r=0});const i0=days.findIndex(k=>h.log[k]);return{h,c,bs,pc:i0<0?0:Math.round(c/(days.length-i0)*100)}}).filter(x=>x.c).sort((a,b)=>b.c-a.c).slice(0,6);
 const top=mo.filter(x=>x.e.m>=4).sort((a,b)=>b.e.m-a.e.m||(b.e.e||0)-(a.e.e||0)||b.k.localeCompare(a.k)).slice(0,5);
 const win=reg.filter(x=>(x.e.b||'').trim()).slice(-6).reverse(),gr=reg.filter(x=>(x.e.c||'').trim()).length;
 const tkY=S.tasks.filter(t=>t.done&&(t.dd||'').startsWith(String(Y))).length,fmY=Object.keys(S.fm).filter(k=>k.startsWith(String(Y))).reduce((s,k)=>s+S.fm[k],0),rdY=(S.reads||[]).filter(r=>r.st==='f'&&(r.df||'').startsWith(String(Y))).length;
 const sn=x=>esc(plain(x.e.a||x.e.b||x.e.c||'').slice(0,110));
 const txt=`Em ${Y} você registrou <strong>${reg.length}</strong> ${reg.length===1?'dia':'dias'} no diário (${Math.round(reg.length/days.length*100)}% do período)${mo.length?`, com humor médio de <strong>${f1(mean(mo.map(x=>x.e.m)))}</strong> de 5`:''}${en.length?` e energia média de <strong>${f1(mean(en.map(x=>x.e.e)))}</strong>`:''}.${best?` O melhor mês foi <strong>${MESF[best.m]}</strong> (${f1(best.v)}).`:''}${bw?` Seu dia mais leve costuma ser <strong>${DIAF[bw.g]}</strong>.`:''}`;
 return head+`<div class="cards"><div class="panel wide"><h2>Resumo</h2><p style="margin:0">${txt}</p></div>
 <div class="rv4 wide" style="grid-column:1/-1"><div class="stat c-p"><span>Dias registrados</span><strong>${reg.length}</strong></div><div class="stat c-b"><span>Tarefas concluídas</span><strong>${tkY}</strong></div><div class="stat c-y"><span>Foco</span><strong>${Math.round(fmY/60)} h</strong></div><div class="stat c-g"><span>Leituras concluídas</span><strong>${rdY}</strong></div></div>
 <div class="panel wide"><h2>O ano em cores</h2>${heat}</div>
 <div class="panel"><h2>Humor médio por mês</h2>${bars}</div><div class="panel"><h2>Humor por dia da semana</h2>${wdr}<p class="empty" style="padding:var(--space-2) 0 0">Média de 1 a 5, nos dias com humor registrado.</p></div>
 <div class="panel"><h2>Hábitos mais constantes</h2>${hab.map(x=>`<div class="cat" style="grid-template-columns:1fr 1fr auto"><span>${esc(x.h.n)}</span>${x.h.perWeek?`<span></span><small>${x.c} ${x.c===1?'dia registrado':'dias registrados'} · meta semanal</small>`:`<div class="fb" aria-hidden="true"><i style="width:${x.pc}%"></i></div><small>${x.c} ${x.c===1?'dia':'dias'} (${x.pc}% desde o 1º registro) · melhor sequência ${x.bs}</small>`}</div>`).join('')||'<p class="empty">Nenhum hábito marcado neste ano.</p>'}</div>
 <div class="panel"><h2>Melhores dias</h2>${top.map(x=>`<div class="item"><span class="chip" style="background:${MC[x.e.m-1]}">${MN[x.e.m-1]}</span><div class="t">${fmt(x.k)}<small data-priv-text>${sn(x)}</small></div></div>`).join('')||'<p class="empty">Nenhum dia com humor “Bom” ou “Ótimo” registrado.</p>'}</div>
 <div class="panel wide"><h2>Vitórias e gratidão</h2><p class="empty" style="padding:0 0 var(--space-2)">${gr} ${gr===1?'dia com gratidão registrada':'dias com gratidão registrada'}. Últimas vitórias anotadas:</p>${win.map(x=>`<div class="item"><div class="t">${fmt(x.k)}<small data-priv-text>${esc(plain(x.e.b).slice(0,160))}</small></div></div>`).join('')||'<p class="empty">Nenhuma vitória anotada.</p>'}</div></div>`}
function lkPrune(){const L=lkAll();if(!L.length)return;const ex=ref=>{const[ty,id]=ref.split(':'),c=TRC[ty];return !!c&&((c.g()||[]).some(x=>x.id===id)||(S.trash||[]).some(e=>e.id===ref))},now=Date.now(),keep=L.filter(l=>(l.at&&now-l.at<864e5)||(ex(l.a)&&ex(l.b)));if(keep.length!==L.length)S.lnk=keep}
/* ===== Pacote F: paleta de comandos, privacidade e versões automáticas ===== */
Object.assign(ICO,{
 plus:'<path d="M12 5v14M5 12h14"/>',
 eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
 eyeoff:'<path d="M3 3l18 18"/><path d="M10.6 5.7A9.5 9.5 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-3.2 4M6.6 7.3A16 16 0 002.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1"/><path d="M9.9 9.9a2.8 2.8 0 004 4"/>',
 moon:'<path d="M20 14.5A8.5 8.5 0 119.5 4 7 7 0 0020 14.5z"/>',
 undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'});
/* privacidade */
function setPriv(){const b=$('#pv');if(!b)return;b.innerHTML=ic(PRIV?'eyeoff':'eye',18);b.setAttribute('aria-pressed',PRIV?'true':'false');const t=PRIV?'Mostrar valores e textos':'Ocultar valores e textos';b.setAttribute('aria-label',t);b.title=t;document.documentElement.dataset.priv=PRIV?'1':'0'}
function togglePriv(){PRIV=!PRIV;try{localStorage.setItem('hub-priv',PRIV?'1':'0')}catch(e){}setPriv();render();toast(PRIV?'Valores e textos ocultos neste aparelho.':'Valores e textos visíveis.')}
setTimeout(setPriv,0);
/* versões automáticas (só neste aparelho) */
const SNK='hub-snaps',SNMAX=8;
function snaps(){try{const a=JSON.parse(localStorage.getItem(SNK));return Array.isArray(a)?a:[]}catch(e){return[]}}
function snapPut(why,minGap,state){
 try{const data=state||pick(),j=JSON.stringify(data),L=snaps();if(L[0]&&L[0].j===j)return true;if(minGap&&L[0]&&Date.now()-L[0].t<minGap)return false;
  const F=data.fin||{};L.unshift({t:Math.max(Date.now(),L[0]?L[0].t+1:0),why,j,c:{tk:(data.tasks||[]).length,ev:(data.events||[]).length,nt:(data.notes||[]).length,tx:(F.tx||[]).length}});
  while(L.length>SNMAX)L.pop();
  for(;;){try{localStorage.setItem(SNK,JSON.stringify(L));return true}catch(e){if(L.length<=(state?2:1))return false;L.pop()}}}catch(e){return false}}
function snapAuto(){if(LOCAL_CORRUPT)return;const has=(S.tasks||[]).length+(S.events||[]).length+(S.notes||[]).length+(S.inbox||[]).length+((S.fin||{}).tx||[]).length+(S.habits||[]).length>0;const L=snaps();if(!has)return;if(L[0]&&Date.now()-L[0].t<12*36e5)return;snapPut('Automática')}
setTimeout(snapAuto,4000);setInterval(snapAuto,30*60e3);
function snapRestore(t){
 const x=snaps().find(s=>s.t===t);if(!x)return;
 let d;try{d=JSON.parse(x.j)}catch(e){toast('Esta versão está corrompida.');return}
 const previous=JSON.stringify(S),wasCorrupt=LOCAL_CORRUPT;
 if(!wasCorrupt&&!snapPut('Antes de restaurar uma versão')){toast('Não foi possível guardar a versão atual. Exporte um backup e libere espaço.');return}
 if(!('projects' in d))d.projects=[];
 d.history=auditClean([...(S.history||[]),...(Array.isArray(d.history)?d.history:[])]);
 UN=null;UTime=0;
 applyState(d);auditLog('snapshotRestore');LOCAL_CORRUPT=false;
 if(!save()){S=JSON.parse(previous);LOCAL_CORRUPT=wasCorrupt;applyTheme();applyA11y();undoReset();render();toast('Não foi possível salvar a restauração. Os dados anteriores foram mantidos.');return}
 render();toast('Versão de '+snapFmt(t)+' restaurada.'+(wasCorrupt?'':' Os dados anteriores foram guardados como versão.'),!wasCorrupt);
}
const snapFmt=t=>new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
function snapPanel(){
 const L=snaps();
 return `<div class="panel"><h2>Versões automáticas</h2><p class="empty" style="padding:0 0 var(--space-2)">O hub guarda uma versão por dia e antes de trocar seus dados por outros, até ${SNMAX}. Ficam só neste aparelho e não substituem um backup em arquivo.</p>${L.map(x=>`<div class="item"><span class="chip c-b">${ic('clock',14)}</span><div class="t">${snapFmt(x.t)} · ${esc(x.why)}<small>${x.c.tk} tarefas · ${x.c.ev} eventos · ${x.c.nt} notas · ${x.c.tx} lançamentos</small></div><button class="pill" data-a="snaprest" data-id="${x.t}">Restaurar</button></div>`).join('')||'<p class="empty">Nenhuma versão ainda. A primeira é criada sozinha assim que houver dados.</p>'}<div class="bar" style="margin:var(--space-2) 0 0"><button class="pill dark" data-a="snapnow">Salvar versão agora</button></div></div>`}
/* paleta de comandos */
let CK=null;
function ckItems(q){
 const out=[],tok=norm(q).split(' ').filter(Boolean),A=(g,l,ico,run,kw)=>{const k=norm(l+' '+(kw||''));if(tok.every(t=>k.includes(t)))out.push({g,l,ico,run,s:k.startsWith(tok[0]||'')?0:1})};
 const go=k=>()=>{$('#side').classList.remove('open');FED=null;S.view=k;Q='';ED=null;$('#q').value='';render()};
 const cap=(t,txt)=>()=>{qa(t);if(!txt)return;if(t==='dp'||t==='rc'){const p=parseFinNL(txt,'',true),it=$('#qa input[name=t]'),iv=$('#qa input[name=v]'),id=$('#qa input[name=d]');if(it)it.value=p.t+(p.tg?' #'+p.tg.split(', ').join(' #'):'');if(iv&&p.v)iv.value=p.v;if(id&&p.d){id.value=p.d;id.dispatchEvent(new Event('change'))}}else{const i=$('#qa input[name=t]');if(i)i.value=txt}};
 if(tok.length&&q.trim().length>=2){const x=q.trim();A('Criar','Criar tarefa: '+x,'plus',cap('tk',x),'');A('Criar','Lançar despesa: '+x,'wallet',cap('dp',x),'gasto finanças');A('Criar','Criar evento: '+x,'cal',cap('ev',x),'');A('Criar','Criar nota: '+x,'note',cap('nt',x),'')}
 A('Ações','Nova tarefa','plus',cap('tk'),'criar adicionar');A('Ações','Novo evento','cal',cap('ev'),'criar adicionar compromisso');A('Ações','Nova nota','note',cap('nt'),'criar adicionar');
 A('Ações','Lançar despesa','wallet',cap('dp'),'gasto finanças');A('Ações','Lançar receita','wallet',cap('rc'),'entrada salário finanças');
 A('Ações',PRIV?'Mostrar valores':'Ocultar valores',PRIV?'eye':'eyeoff',togglePriv,'privacidade esconder dinheiro');
 A('Ações','Alternar tema claro e escuro','moon',()=>{S.themeMode=isDark()?'light':'dark';applyTheme();save()},'escuro noite');
 A('Ações','Salvar versão agora','clock',()=>{toast(snapPut('Manual')?'Versão salva em Backup.':'Não foi possível salvar a versão. Libere espaço neste navegador.');if(S.view==='backup')render()},'backup');
 A('Ações','Desfazer','undo',undo,'voltar');
 A('Ações','Rever o tour de boas-vindas','search',()=>tourOpen(0),'ajuda primeiro uso começar');
 if(!isPWA())A('Ações','Instalar aplicativo','save',pwaInstall,'pwa celular tela inicial atalho');
 if(emptyData())A('Ações','Carregar dados de exemplo','plus',exLoad,'demonstração tour');
 if(hasEx())A('Ações','Remover dados de exemplo','undo',exClear,'apagar demonstração');
 if(tok.length){
  const m=(ty,ic2,arr,lab,kw)=>{let n=0;arr.forEach(it=>{if(n>=5)return;const l=lab(it);if(!l)return;const k=norm(l+' '+(kw?kw(it):''));if(tok.every(t=>k.includes(t))){n++;out.push({g:'Itens',l,ico:ic2,run:()=>{lkGo(ty+':'+it.id);render()},s:2})}})};
  m('tk','check',[...S.tasks].sort((a,b)=>(a.done?1:0)-(b.done?1:0)),t=>t.t);m('nt','note',S.notes,n=>n.t||'',n=>(n.b||'').replace(/<[^>]*>/g,' '));m('ev','cal',S.events,e=>e.t);m('lk','link',S.links,l=>l.n);m('rd','book',S.reads||[],r=>r.t);m('mt','flag',S.metas,g=>g.t);m('prj','flag',(S.projects||[]).filter(p=>!p.archived),p=>p.t);
  let ntx=0;finInit().tx.forEach(t=>{if(ntx>=5)return;const l=`${t.t} · ${BRL(t.v)} (${fmt(t.d)})`,k=norm(`${t.t} ${t.cat||''} ${t.sub||''} ${t.tg||''} ${t.pj||''} ${t.d} ${t.v} ${String(t.v).replace('.',',')}`);if(tok.every(w=>k.includes(w))){ntx++;out.push({g:'Itens',l,ico:'wallet',run:()=>{S.view='financas';S.fvw='mes';S.ftab='lanc';S.fmo=(+t.d.slice(0,4)-today.getFullYear())*12+ +t.d.slice(5,7)-1-today.getMonth();FQ=t.t;Q='';$('#q').value='';render()},s:2})}});
  let ndia=0;Object.keys(S.dia||{}).sort().reverse().forEach(d=>{if(ndia>=5)return;const e=S.dia[d]||{},tx=plain(e.a||e.b||e.c||'').trim(),shown=PRIV&&tx?'•••••':tx.slice(0,50),l=`Diário ${fmt(d)}${shown?': '+shown:''}`,k=norm(`${fmt(d)} ${d} ${e.a||''} ${e.b||''} ${e.c||''}`);if(tok.every(w=>k.includes(w))){ndia++;out.push({g:'Itens',l,ico:'smile',run:()=>{S.view='diario';S.dvw='dia';S.ddo=Math.min(0,mDays(d));Q='';$('#q').value='';render()},s:2})}});
  let nhb=0;(S.habits||[]).forEach(h=>{if(nhb>=5)return;if(tok.every(w=>norm(h.n).includes(w))){nhb++;out.push({g:'Itens',l:h.n,ico:'repeat',run:()=>{S.view='habitos';Q='';$('#q').value='';render()},s:2})}});
 }
 const hid=new Set(menuCfg().hidden);Object.keys(NAV).forEach(k=>A('Ir para','Ir para '+NAV[k].n,({dash:'home',hoje:'today',rotina:'sun',avisos:'bell',agenda:'cal',tarefas:'check',projetos:'flag',metas:'flag',habitos:'repeat',notas:'note',diario:'smile',links:'link',etiquetas:'tag',financas:'wallet',aparencia:'spark',backup:'save',lixeira:'trash',arquivados:'note',leituras:'book',menu:'sliders'})[k],go(k),hid.has(k)?'oculto':''));
 const ord=tok.length?{'Itens':0,'Ações':1,'Ir para':2,'Criar':3}:{'Ações':0,'Ir para':1},ql=x=>x.g==='Criar'?2:tok.every(t=>norm(x.l).includes(t))?0:1;
 return out.map((x,i)=>({...x,i})).sort((a,b)=>tok.length?ql(a)-ql(b)||ord[a.g]-ord[b.g]||a.s-b.s||a.i-b.i:ord[a.g]-ord[b.g]||a.i-b.i).slice(0,tok.length?14:16)}
function ckDraw(){
 const q=$('#ckq').value,L=ckItems(q);CK.list=L;CK.i=Math.min(CK.i,Math.max(0,L.length-1));let g='';
 $('#ckl').innerHTML=L.map((x,i)=>{const h=x.g!==g?(g=x.g,`<div class="ckg" role="presentation">${x.g}</div>`):'';return h+`<div class="cko${i===CK.i?' on':''}" role="option" id="cko${i}" aria-selected="${i===CK.i}" data-ck="${i}">${ic(x.ico,18)}<span>${esc(x.l)}</span></div>`}).join('')||'<p class="ckh">Nada encontrado.</p>';
 $('#ckq').setAttribute('aria-activedescendant',L.length?'cko'+CK.i:'');const on=$('#cko'+CK.i);if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest'})}
function ckOpen(){
 if(CK)return;const prev=document.activeElement,d=document.createElement('div');d.id='cmdk';
 d.innerHTML=`<div class="ckb" data-ckclose="1"></div><div class="ckp" role="dialog" aria-modal="true" aria-label="Paleta de comandos"><input id="ckq" class="in" role="combobox" aria-expanded="true" aria-controls="ckl" aria-autocomplete="list" placeholder="Digite um comando, uma tela ou o nome de um item…" autocomplete="off" aria-label="Buscar comandos, telas e itens"><div id="ckl" role="listbox" aria-label="Resultados"></div><p class="ckh">↑↓ navegar · Enter abrir · Esc fechar</p></div>`;
 document.body.appendChild(d);CK={el:d,prev,i:0,list:[]};ckDraw();$('#ckq').focus()}
function ckClose(){if(!CK)return;CK.el.remove();const p=CK.prev;CK=null;if(p&&p.focus&&document.contains(p))p.focus()}
function ckRun(i){const x=CK&&CK.list[i];if(!x)return;ckClose();x.run()}
document.addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopPropagation();CK?ckClose():ckOpen();return}
 if(!CK)return;
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();ckClose();return}
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();const n=CK.list.length;if(n){CK.i=(CK.i+(e.key==='ArrowDown'?1:-1)+n)%n;ckDraw()}return}
 if(e.key==='Enter'){e.preventDefault();e.stopPropagation();ckRun(CK.i);return}
 if(e.key==='Tab'){e.preventDefault();e.stopPropagation()}},true);
document.addEventListener('input',e=>{if(CK&&e.target.id==='ckq'){CK.i=0;ckDraw();e.stopPropagation()}},true);
document.addEventListener('click',e=>{
 if(CK){const o=e.target.closest('.cko');if(o){e.preventDefault();e.stopPropagation();ckRun(+o.dataset.ck);return}if(e.target.closest('[data-ckclose]')){e.stopPropagation();ckClose();return}}
 const b=e.target.closest&&e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
 if(a==='priv'){e.stopPropagation();togglePriv()}
 else if(a==='snapnow'){e.stopPropagation();toast(snapPut('Manual')?'Versão salva.':'Não foi possível salvar a versão. Libere espaço neste navegador.');render()}
 else if(a==='snaprest'){e.stopPropagation();snapRestore(+b.dataset.id)}},true);
/* datas no padrão brasileiro: campo dd/mm/aaaa com seletor de calendário */
const DTI='<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>';
const dtBR=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'';
const dtISO=t=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t||'');if(!m)return '';const d=+m[1],mo=+m[2],y=+m[3],x=new Date(y,mo-1,d);return x.getFullYear()===y&&x.getMonth()===mo-1&&x.getDate()===d&&y>=1900&&y<=2200?m[3]+'-'+m[2]+'-'+m[1]:''};
function dtSet(p,iso){if(!p)return;p.value=iso||'';if(p._dtSync)p._dtSync()}
function dtUp(root){
 (root.querySelectorAll?root.querySelectorAll('input[type=date]:not([data-dt])'):[]).forEach(p=>{
  p.dataset.dt='1';const req=p.required,w=document.createElement('span');w.className='dtw';
  const t=document.createElement('input');t.type='text';t.className=(p.className||'in')+' dtt';t.inputMode='numeric';t.autocomplete='off';t.placeholder='dd/mm/aaaa';t.maxLength=10;
  t.value=dtBR(p.value);t.required=req;t.disabled=p.disabled;
  const lb=p.getAttribute('aria-label')||p.title||'Data';t.setAttribute('aria-label',lb);if(p.title)t.title=p.title;if(p.getAttribute('style'))t.setAttribute('style',p.getAttribute('style'));
  const b=document.createElement('button');b.type='button';b.className='dtb';b.tabIndex=-1;b.disabled=p.disabled;b.setAttribute('aria-label','Abrir calendário: '+lb);b.innerHTML=DTI;
  p.dataset.req=req?'1':'0';p.required=false;p.className='dtp';p.tabIndex=-1;p.setAttribute('aria-hidden','true');p.removeAttribute('style');p.removeAttribute('title');p.removeAttribute('aria-label');
  p.parentNode.insertBefore(w,p);w.append(t,b,p);
  let lastVal=p.value;
  const chk=commit=>{
   const v=dtISO(t.value);p.value=v;
   t.setCustomValidity(t.value&&!v?'Use o formato dia/mês/ano, por exemplo 25/12/2026':'');
   if(commit&&(!t.value||v)&&p.value!==lastVal){
    lastVal=p.value;p._dtInternal=true;
    try{p.dispatchEvent(new Event('change',{bubbles:true}))}finally{p._dtInternal=false}
   }
  };
  p._dtText=t;
  p._dtSync=()=>{t.value=dtBR(p.value);t.disabled=p.disabled;b.disabled=p.disabled;if(p.dataset.req!==undefined)t.required=p.dataset.req==='1';lastVal=p.value;chk(false)};
  t.addEventListener('input',()=>{const d=t.value.replace(/\D/g,'').slice(0,8);t.value=d.length>4?d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4):d.length>2?d.slice(0,2)+'/'+d.slice(2):d;chk(false)});
  t.addEventListener('change',()=>{chk(true)});
  t.addEventListener('blur',()=>{const m=/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(t.value);if(m){t.value=m[1].padStart(2,'0')+'/'+m[2].padStart(2,'0')+'/20'+m[3]}chk(true)});
  t.addEventListener('keydown',e=>{if(e.key==='Enter'&&!t.form){e.preventDefault();chk(true)}});
  p.addEventListener('change',()=>{if(p._dtInternal)return;t.value=dtBR(p.value);lastVal=p.value;chk(false)});
  b.addEventListener('click',()=>{if(p.disabled)return;p.value=dtISO(t.value)||p.value;try{p.showPicker()}catch(e){p.focus();p.click()}});
  chk(false);
 });
}
new MutationObserver(ms=>{for(const m of ms)m.addedNodes.forEach(n=>{if(n.nodeType===1)dtUp(n)})}).observe(document.body,{childList:true,subtree:true});
dtUp(document);
