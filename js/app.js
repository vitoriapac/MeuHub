// (em divisão) recursos e Início; será dividido no T7
/* ===== Abas das Finanças, despesa na captura rápida, busca ampliada, vencimentos e desfazer geral ===== */
const FTABS=[['geral','Visão geral'],['analise','Análises'],['lanc','Lançamentos'],['orc','Orçamentos e metas'],['contas','Contas e recorrentes'],['regras','Regras e importação']];
const FTMAP=[['Fluxo de caixa','geral'],['Comparação com','analise'],['Resumo de','geral'],['Despesas por categoria','geral'],['Resultado acumulado','geral'],['Saldo acumulado','geral'],['Receitas e despesas mês a mês','geral'],['Cascata de','geral'],['Mapa de calor','analise'],['Evolução por categoria','analise'],['Calendário financeiro','analise'],['Subcategorias','analise'],['Projetos:','analise'],['Orçamentos','orc'],['Metas de economia','orc'],['Contas fixas','orc'],['Contas e cartões','contas'],['Lançamentos recorrentes','contas'],['Regras de categorização','regras'],['Importar extrato','regras'],['Reserva de emergência','orc'],['Metas por percentual','orc'],['Divisão de despesas','lanc'],['Lançamentos','lanc']];
function financasTabs(html){
 const t=document.createElement('template');t.innerHTML=html;const cards=t.content.querySelector('.cards');if(!cards)return html;
 const tab=FTABS.some(x=>x[0]===S.ftab)?S.ftab:'geral';
 [...cards.children].forEach(p=>{const h=p.querySelector('h2'),tx=h?h.textContent.trim():'',m=FTMAP.find(x=>tx.startsWith(x[0]));if(!m||m[1]!==tab)p.remove()});
 if(!cards.children.length)cards.innerHTML='<div class="panel wide"><p class="empty">Nada para mostrar nesta aba.</p></div>';
 const bar=document.createElement('div');bar.className='bar ftabs';bar.setAttribute('role','group');bar.setAttribute('aria-label','Seções das Finanças');
 bar.innerHTML=FTABS.map(x=>`<button class="pill ${x[0]===tab?'on':''}" aria-pressed="${x[0]===tab}" data-a="ftab" data-id="${x[0]}">${x[1]}</button>`).join('');
 cards.before(bar);return t.innerHTML}
function financas(){return S.fvw==='ano'?relAnual():financasTabs(financasMes())}
/* captura rápida com despesa e receita */
function qa(t){
 if(t)QT=t;const el=$('#qa'),F=finInit();el.classList.remove('hide');
 const pb=(k,l)=>`<button type="button" class="pill ${QT===k?'on':''}" data-a="qat" data-id="${k}">${l}</button>`,money=QT==='dp'||QT==='rc';
 el.innerHTML=`<form class="panel bar" id="fqa"><div class="bar" style="width:100%;margin:0">${pb('tk','Tarefa')}${pb('nt','Nota')}${pb('ev','Evento')}${pb('dp','Despesa')}${pb('rc','Receita')}<button type="button" class="x" data-a="qax" aria-label="Fechar" style="margin-left:auto">×</button></div><input class="in grow" name="t" placeholder="${{tk:'Nova tarefa',nt:'Título da nota',ev:'Novo evento',dp:'Descrição da despesa',rc:'Descrição da receita'}[QT]}" required>${money?`<input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor" aria-label="Valor" required style="width:120px">${QT==='dp'?`<select class="in" name="cat" aria-label="Categoria">${catOpts('')}</select>`:''}${F.acc.length>1?`<select class="in" name="ac" aria-label="Conta ou cartão">${accOpts('')}</select>`:''}`:''}${QT==='ev'?`<input class="in" type="date" name="d" value="${T}" required aria-label="Data"><input class="in" type="time" name="h" value="09:00" required aria-label="Hora">`:''}${QT==='tk'?'<input class="in" type="date" name="due" aria-label="Prazo">':''}<button class="pill dark">Adicionar</button></form>`;
 el.querySelector('input[name=t]').focus()}
/* vencimentos na tela Hoje */
function dues(n){
 const F=finInit(),out=[],end=ds(add(today,n)),push=(d,t,v,k,x)=>out.push({d,t,v,k,...(x||{})});
 F.bills.forEach(b=>{for(let i=0;i<=n;i++){const d=add(today,i),dd=Math.min(+b.day||1,dimOf(d.getFullYear(),d.getMonth()));if(d.getDate()===dd)push(ds(d),b.n,b.v,'bill')}});
 F.acc.filter(a=>a.ty==='card').forEach(a=>[-1,0,1].forEach(o=>{const iv=invoice(a,o);if(iv.tot>0&&iv.due>=T&&iv.due<=end)push(iv.due,'Fatura '+a.n,iv.tot,'card',{id:a.id,o})}));
 F.tx.forEach(t=>{if(t.k==='tr'||t.d<=T||t.d>end)return;const a=F.acc.find(x=>x.id===accId(t));if(a&&a.ty==='card')return;push(t.d,t.t,t.v,t.k==='in'?'in':'sched')});
 F.rec.forEach(r=>{for(let i=1;i<=n;i++){const d=add(today,i),iso=ds(d),dd=Math.min(+r.day||1,dimOf(d.getFullYear(),d.getMonth())),id='r_'+r.id+'_'+iso.slice(0,7);if(d.getDate()===dd&&(r.ini||T)<=iso&&(!r.end||iso<=r.end)&&!F.tx.some(t=>t.id===id)&&!(r.skip||[]).includes(id))push(iso,r.t,r.v,r.k==='in'?'in':'sched')}});
 return out.sort((a,b)=>a.d.localeCompare(b.d))}
function duesPanel(){
 const L=dues(7),td=L.filter(x=>x.d===T),wk=L.filter(x=>x.d>T),tot=a=>a.filter(x=>x.k!=='in').reduce((s,x)=>s+x.v,0);
 const row=x=>{const dd=mDays(x.d),when=dd===0?'hoje':dd===1?'amanhã':DIA[new Date(x.d+'T00:00').getDay()]+', '+fmt(x.d);
  return `<div class="item"><span class="chip c-${x.k==='card'?'b':x.k==='bill'?'y':x.k==='in'?'g':'p'}">${when}</span><div class="t">${esc(x.t)}<small>${{card:'Vencimento de fatura',bill:'Conta fixa',sched:'Despesa agendada',in:'Receita prevista'}[x.k]}</small></div><strong class="${x.k==='in'?'pos':''}">${x.k==='in'?'+ ':''}${BRL(x.v)}</strong>${x.k==='card'?`<button class="pill" data-a="payfat" data-id="${x.id}" data-o="${x.o}">Pagar</button>`:''}</div>`};
 return `<div class="panel"><h2>Contas e vencimentos</h2>${L.length?`<p class="empty" style="padding:0 0 6px">${td.length?'Hoje: <strong>'+BRL(tot(td))+'</strong> a pagar. ':'Nada vence hoje. '}Próximos 7 dias: <strong>${BRL(tot(wk))}</strong>.</p>${L.map(row).join('')}`:'<p class="empty">Nada a pagar ou receber nos próximos 7 dias. Cadastre contas fixas, recorrentes e cartões em Finanças.</p>'}</div>`}
function payInv(id,o){const a=S.fin.acc.find(x=>x.id===id),f=$('#ffin');if(!a||!f)return;const iv=invoice(a,o);f.className='bar ktr';const s=(n,v)=>{f.querySelector('[name='+n+']').value=v};s('k','tr');s('t','Pagamento da fatura: '+a.n);s('v',iv.tot.toFixed(2));s('d',iv.due);s('to',a.id);const x=S.fin.acc.find(y=>y.id!==a.id);if(x)s('ac',x.id);trValid(f);f.querySelector('[name=t]').focus();window.scrollTo({top:0,behavior:SMOOTH()});toast('Confira a conta de origem e clique em Lançar')}
/* busca global ampliada */
function busca(){
 const q=norm(Q),h=x=>norm(x).includes(q),F=finInit(),v=n=>`data-v="${n}"`;
 const sec=(ti,arr,fn,go)=>{if(!arr.length)return '';const sh=arr.slice(0,15);return `<h2>${ti} (${arr.length})</h2>`+sh.map(x=>`<button class="item" style="width:100%;border:0;text-align:left;cursor:pointer;color:inherit" ${go(x)}><div class="t">${fn(x)}</div></button>`).join('')+(arr.length>sh.length?`<p class="empty" style="padding:2px 0 8px">Mais ${arr.length-sh.length} resultados. Refine a busca.</p>`:'')};
 const fm=t=>(+t.d.slice(0,4)-today.getFullYear())*12+ +t.d.slice(5,7)-1-today.getMonth();
 const out=sec('Tarefas',S.tasks.filter(t=>h(t.t)||h(t.tg)||h(t.pj)),t=>`${esc(t.t)}<small>${t.done?'Concluída':'Pendente'}${t.due?', prazo '+fmt(t.due):''}</small>`,()=>v('tarefas'))
 +sec('Eventos',S.events.filter(e=>h(e.t)||h(e.d)||h(e.tg)),e=>`${esc(e.t)}<small>${fmt(e.d)} às ${e.h}</small>`,()=>v('agenda'))
 +sec('Notas',S.notes.filter(n=>h(n.t)||h(plain(n.b))||h(n.f)||h(n.g)),n=>`${esc(n.t||'Sem título')}<small>${esc(plain(n.b).slice(0,90))}</small>`,()=>v('notas'))
 +sec('Links',S.links.filter(l=>h(l.n)||h(l.u)||h(l.tg)||h(l.cat)),l=>`${esc(l.n)}<small>${esc(l.u)}</small>`,()=>v('links'))
 +sec('Lançamentos',F.tx.filter(t=>h(t.t)||h(t.cat)||h(t.sub)||h(t.tg)||h(t.pj)||h(t.d)||h(String(t.v))||h(String(t.v).replace('.',','))).sort((a,b)=>b.d.localeCompare(a.d)),t=>`${esc(t.t)}<small>${fmt(t.d)} · ${t.k==='tr'?'Transferência':esc(t.cat)+(t.sub?' › '+esc(t.sub):'')} · ${t.k==='in'?'+':t.k==='tr'?'':'−'} ${BRL(t.v)}</small>`,t=>`data-a="sgo" data-view="financas" data-tab="lanc" data-fmo="${fm(t)}"`)
 +sec('Metas',S.metas.filter(g=>h(g.t)||g.kr.some(k=>h(k.t))),g=>`${esc(g.t)}<small>${Math.round(metaProg(g)*100)}% concluída</small>`,()=>v('metas'))
 +sec('Leituras',(S.reads||[]).filter(r=>h(r.t)||h(r.a)||h(r.n)),r=>`${esc(r.t)}<small>${esc(RK[r.k]?RK[r.k][0]:'')}${r.a?' · '+esc(r.a):''}</small>`,()=>v('leituras'))
 +sec('Hábitos',S.habits.filter(x=>h(x.n)),x=>`${esc(x.n)}<small>${hstreak(x)} ${hstreak(x)===1?'dia':'dias'} seguidos</small>`,()=>v('habitos'))
 +sec('Diário',Object.keys(S.dia).filter(d=>{const e=S.dia[d];return h(e.a)||h(e.b)||h(e.c)||h(d)}).sort().reverse(),d=>`${fmt(d)}<small>${esc(plain(S.dia[d].a||S.dia[d].b||S.dia[d].c||'').slice(0,90))}</small>`,d=>`data-a="sgo" data-view="diario" data-ddo="${mDays(d)}"`);
 return `<div class="top"><h1>Resultados</h1></div><p class="vh" role="status">${(n=>n+(n===1?' resultado exibido':' resultados exibidos'))((out.match(/class="item"/g)||[]).length)}</p><div class="res">${out||`<div class="empty">Nada encontrado para “${esc(Q)}”.</div>`}</div>`}
/* desfazer e refazer gerais */
let UH=[],UR=[],ULast=null,UTime=0;
function updU(){const a=$('#ub'),b=$('#rb');if(a)a.disabled=!UH.length;if(b)b.disabled=!UR.length}
function undoReset(){UH=[];UR=[];ULast=pickJSON();UTime=0;updU()}
function track(){if(ULast===null)return;const cur=pickJSON();if(cur===ULast)return;const now=Date.now();
 if(now-UTime>900||!UH.length){UH.push(ULast);let tot=UH.reduce((a,s)=>a+s.length,0);while(UH.length>40||tot>12e6)tot-=UH.shift().length}
 UTime=now;ULast=cur;UR=[];updU()}
function undo(){if(!UH.length){toast('Nada para desfazer');return}const prev=UH.pop();UR.push(ULast);applyState(JSON.parse(prev));ULast=prev;UTime=0;toast('Desfeito. Ctrl+Shift+Z refaz.');render()}
function redo(){if(!UR.length){toast('Nada para refazer');return}const nx=UR.pop();UH.push(ULast);applyState(JSON.parse(nx));ULast=nx;UTime=0;toast('Refeito.');render()}
function genRec(){const clean=pickJSON()===ULast,n=genRec0();if(n&&clean)ULast=pickJSON();return n}
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey)return;const k=e.key.toLowerCase();if(k!=='z'&&k!=='y')return;const t=e.target;if(/INPUT|TEXTAREA|SELECT/.test(t.tagName)||t.isContentEditable)return;e.preventDefault();if(k==='y'||e.shiftKey)redo();else undo()});
undoReset();

/* ===== Menu lateral agrupado e personalizável ===== */
const ICO={"home": "<path d=\"M3 11.5L12 4l9 7.5\"/><path d=\"M5.5 10v10h13V10\"/>", "today": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"3.5\"/>", "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6\"/>", "bell": "<path d=\"M6 9a6 6 0 0112 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9\"/><path d=\"M10 20.5a2.2 2.2 0 004 0\"/>", "cal": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15.5\" rx=\"3\"/><path d=\"M3.5 10h17M8 3v4M16 3v4\"/>", "check": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12.5l3 3 5-6\"/>", "flag": "<path d=\"M5.5 21V4\"/><path d=\"M5.5 4.5h12l-2.2 4 2.2 4h-12\"/>", "repeat": "<path d=\"M17 3l4 4-4 4\"/><path d=\"M3 11V9.5A2.5 2.5 0 015.5 7H21\"/><path d=\"M7 21l-4-4 4-4\"/><path d=\"M21 13v1.5a2.5 2.5 0 01-2.5 2.5H3\"/>", "note": "<path d=\"M6 3h8.5L19 7.5V21H6z\"/><path d=\"M14 3v5h5M9 13h6M9 17h6\"/>", "book": "<path d=\"M3 5.5c3-1.2 6-.8 9 1.3 3-2.1 6-2.5 9-1.3v13c-3-1.2-6-.8-9 1.3-3-2.1-6-2.5-9-1.3z\"/><path d=\"M12 6.8v13\"/>", "smile": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8.2 14.2s1.5 2.3 3.8 2.3 3.8-2.3 3.8-2.3\"/><path d=\"M9 9.7h.01M15 9.7h.01\"/>", "link": "<path d=\"M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1\"/>", "tag": "<path d=\"M3 12.5V4h8.5L21 13.5 13.5 21z\"/><circle cx=\"7.5\" cy=\"8.5\" r=\"1.2\"/>", "wallet": "<rect x=\"3\" y=\"6\" width=\"18\" height=\"14\" rx=\"3\"/><path d=\"M3 10.5h18M16.5 15h1.5\"/><path d=\"M6 6V5a2 2 0 012-2h8\"/>", "spark": "<path d=\"M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z\"/><path d=\"M18.5 16.5v4M16.5 18.5h4\"/>", "save": "<path d=\"M12 3.5v11\"/><path d=\"M7.5 10.5l4.5 4.5 4.5-4.5\"/><path d=\"M4.5 19.5h15\"/>", "trash": "<path d=\"M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13\"/>", "sliders": "<path d=\"M4 7h9M17 7h3M4 17h3M11 17h9\"/><circle cx=\"15\" cy=\"7\" r=\"2\"/><circle cx=\"9\" cy=\"17\" r=\"2\"/>", "star": "<path d=\"M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z\"/>", "starfill": "<path fill=\"currentColor\" d=\"M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z\"/>", "dots": "<circle cx=\"5.5\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/><circle cx=\"18.5\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/>", "skip": "<path d=\"M4 12h11M11 7l5 5-5 5M20 5v14\"/>", "play": "<path d=\"M8 5.5l11 6.5-11 6.5z\"/>", "edit": "<path d=\"M4 20l4.2-1L19.5 7.7a2 2 0 000-2.8l-.4-.4a2 2 0 00-2.8 0L5 15.8z\"/>", "up": "<path d=\"M6 14l6-6 6 6\"/>", "down": "<path d=\"M6 10l6 6 6-6\"/>"};
const ic=(n,z)=>`<svg class="ic" viewBox="0 0 24 24" width="${z||18}" height="${z||18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]||''}</svg>`;
const NAV={dash:{n:'Início',i:'⌂'},hoje:{n:'Hoje',i:'◎'},rotina:{n:'Rotina',i:'☀'},avisos:{n:'Lembretes',i:'◷'},agenda:{n:'Agenda',i:'▦'},tarefas:{n:'Tarefas',i:'✓'},metas:{n:'Metas',i:'◆'},habitos:{n:'Hábitos',i:'◉'},notas:{n:'Notas',i:'✎'},diario:{n:'Diário',i:'✿'},links:{n:'Links',i:'↗'},etiquetas:{n:'Etiquetas',i:'#'},financas:{n:'Finanças',i:'$'},aparencia:{n:'Aparência',i:'✦'},backup:{n:'Backup',i:'⇅'},lixeira:{n:'Lixeira',i:'⌫'},leituras:{n:'Leituras',i:'▤'},menu:{n:'Personalizar menu',i:'⚙'}};
for(const k in {"dash": "home", "hoje": "today", "rotina": "sun", "avisos": "bell", "agenda": "cal", "tarefas": "check", "metas": "flag", "habitos": "repeat", "notas": "note", "diario": "smile", "links": "link", "etiquetas": "tag", "financas": "wallet", "aparencia": "spark", "backup": "save", "lixeira": "trash", "leituras": "book", "menu": "sliders"})NAV[k].i=ic(({dash:'home',hoje:'today',rotina:'sun',avisos:'bell',agenda:'cal',tarefas:'check',metas:'flag',habitos:'repeat',notas:'note',diario:'smile',links:'link',etiquetas:'tag',financas:'wallet',aparencia:'spark',backup:'save',lixeira:'trash',leituras:'book',menu:'sliders'})[k],20);
const LOCK=['dash','menu'],BARMAX=5;
const menuDef=()=>({groups:[{id:'plan',n:'Planejar',items:['dash','hoje','rotina','avisos','agenda','tarefas','metas','habitos']},{id:'reg',n:'Registrar',items:['notas','leituras','diario','links','etiquetas']},{id:'din',n:'Dinheiro',items:['financas']},{id:'sis',n:'Sistema',items:['aparencia','backup','lixeira','menu']}],hidden:[],bar:['dash','hoje','agenda','notas','tarefas']});
function menuCfg(){const m=S.menu&&Array.isArray(S.menu.groups)?JSON.parse(JSON.stringify(S.menu)):menuDef();m.hidden=(m.hidden||[]).filter(k=>NAV[k]&&!LOCK.includes(k));m.bar=(m.bar||[]).filter(k=>NAV[k]).slice(0,BARMAX);
 m.groups.forEach(g=>{g.items=g.items.filter(k=>NAV[k])});const all=new Set(m.groups.flatMap(g=>g.items)),miss=Object.keys(NAV).filter(k=>!all.has(k));
 if(miss.length)(m.groups.find(g=>g.id==='sis')||m.groups[m.groups.length-1]).items.push(...miss);return m}
function menuEdit(fn){const m=menuCfg();fn(m);S.menu=m}
function renderMenu(){
 const m=menuCfg(),hid=new Set(m.hidden),bar=new Set(m.bar),col=new Set(S.mcol||[]);
 const html=m.groups.map(g=>{const items=g.items.filter(k=>!hid.has(k));if(!items.length)return '';const c=col.has(g.id);
  return `<div class="mg"><button class="mgh" data-a="mcol" data-id="${g.id}" aria-expanded="${!c}"><span>${esc(g.n)}</span><i>${c?'▸':'▾'}</i></button>${items.filter(k=>!c||k===S.view).map(k=>`<button class="nav${bar.has(k)?'':' sec'}" data-v="${k}"><b>${NAV[k].i}</b>${NAV[k].n}</button>`).join('')}</div>`}).join('');
 const nv=$('#nv');if(nv&&nv.dataset.sig!==html){nv.innerHTML=html;nv.dataset.sig=html}}
function menuView(){
 const m=menuCfg(),hid=new Set(m.hidden),bar=new Set(m.bar);
 return `<div class="top"><h1>Personalizar menu</h1><button class="pill" data-a="mreset">Restaurar padrão</button></div>
 <p class="empty" style="padding:0 0 10px">Escolha o que aparece no menu lateral, a ordem e os grupos. No celular, a barra inferior mostra até ${BARMAX} itens (${bar.size} escolhidos) e o resto fica em "Mais". Início e esta tela não podem ser escondidos.</p>
 <div class="cards">${m.groups.map((g,gi)=>`<div class="panel wide"><div class="top" style="margin:0 0 8px"><input class="in" data-gname="${g.id}" value="${esc(g.n)}" aria-label="Nome do grupo" style="font-weight:600;max-width:60%"><span style="display:flex;gap:4px"><button class="x" data-a="mgmv" data-id="${g.id}" data-n="-1" ${gi?'':'disabled'} aria-label="Subir grupo">▲</button><button class="x" data-a="mgmv" data-id="${g.id}" data-n="1" ${gi<m.groups.length-1?'':'disabled'} aria-label="Descer grupo">▼</button><button class="x" data-a="mdelg" data-id="${g.id}" ${g.items.length||m.groups.length<2?'disabled':''} aria-label="Excluir grupo vazio" title="Só grupos vazios podem ser excluídos">×</button></span></div>${g.items.map((k,i)=>`<div class="item"><input type="checkbox" class="chk" data-a="mshow" data-id="${k}" ${hid.has(k)?'':'checked'} ${LOCK.includes(k)?'disabled':''} aria-label="Mostrar ${NAV[k].n} no menu"><div class="t"><b>${NAV[k].i}</b> ${NAV[k].n}</div><label class="lb" style="margin:0;white-space:nowrap"><input type="checkbox" data-a="mbar" data-id="${k}" ${bar.has(k)?'checked':''}> barra inferior</label><select class="in" data-mmv="${k}" aria-label="Mover ${NAV[k].n} para o grupo" style="max-width:130px">${m.groups.map(x=>`<option value="${x.id}" ${x.id===g.id?'selected':''}>${esc(x.n)}</option>`).join('')}</select><button class="x" data-a="mimv" data-id="${k}" data-n="-1" ${i?'':'disabled'} aria-label="Subir">▲</button><button class="x" data-a="mimv" data-id="${k}" data-n="1" ${i<g.items.length-1?'':'disabled'} aria-label="Descer">▼</button></div>`).join('')||'<p class="empty">Grupo vazio. Use "Mover" num item de outro grupo para trazê-lo para cá.</p>'}</div>`).join('')}
 <div class="panel wide"><form class="bar" id="fmgrp" style="margin:0"><input class="in grow" name="n" placeholder="Nome de um novo grupo" required><button class="pill">Criar grupo</button></form></div></div>`}
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
const a11yPanel=()=>`<div class="panel" style="margin-top:12px"><h2>Acessibilidade</h2>
 <label class="item"><input type="checkbox" class="chk" data-opt="keys" ${S.keys!==false?'checked':''}><div class="t">Atalhos de uma tecla<small>N, T, E, D, C, / e os números dos links. Desligue se usa ditado ou leitor de voz, para não acionar sem querer. Atalhos com Ctrl continuam funcionando.</small></div></label>
 <label class="item"><input type="checkbox" class="chk" data-opt="hc" ${S.hc?'checked':''}><div class="t">Alto contraste<small>Escurece o texto secundário e reforça as bordas.</small></div></label>
 <label class="item"><input type="checkbox" class="chk" data-opt="rmo" ${S.rmo==='on'?'checked':''}><div class="t">Reduzir animações<small>Também segue a preferência do seu sistema.</small></div></label>
 <p class="empty" style="padding:6px 0 0">Teclado: Tab navega, Enter e Espaço ativam, Esc fecha a captura rápida e Ctrl+Z desfaz. Ctrl+K (ou Cmd+K) abre a paleta de comandos. O zoom do navegador funciona até 400%.</p></div>`;
applyA11y();

/* ===== Pacote A: lixeira e lembretes ===== */
const TRD=30*864e5;
const TRC={ev:{n:'Evento',g:()=>S.events,l:x=>x.t},nt:{n:'Nota',g:()=>S.notes,l:x=>x.t||'Nota sem título'},tk:{n:'Tarefa',g:()=>S.tasks,l:x=>x.t},lk:{n:'Link',g:()=>S.links,l:x=>x.n},hb:{n:'Hábito',g:()=>S.habits,l:x=>x.n},mt:{n:'Meta',g:()=>S.metas,l:x=>x.t},tx:{n:'Lançamento',g:()=>finInit().tx,l:x=>x.t+' · '+BRL(x.v)},bl:{n:'Conta fixa',g:()=>finInit().bills,l:x=>x.n},gl:{n:'Meta de economia',g:()=>finInit().goals,l:x=>x.n},rc:{n:'Recorrente',g:()=>finInit().rec,l:x=>x.t},rl:{n:'Regra',g:()=>finInit().rules,l:x=>x.m||'Regra'},sp:{n:'Divisão',g:()=>finInit().split,l:x=>x.p+' · '+x.t},pr:{n:'Meta de renda',g:()=>finInit().prules,l:x=>prName(x)},rd:{n:'Leitura',g:()=>S.reads||(S.reads=[]),l:x=>x.t}};
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
 const L=(S.trash||[]).filter(x=>x.b===bid);if(!L.length)return;
 L.forEach(e=>{const arr=TRC[e.ty].g();if(!arr.some(x=>x.id===e.it.id)){arr.push(e.it);if(e.ty==='tx'&&e.it.rc){const r=finInit().rec.find(x=>x.id===e.it.rc);if(r&&r.skip)r.skip=r.skip.filter(i=>i!==e.it.id)}}});
 S.trash=S.trash.filter(x=>x.b!==bid);toast('Restaurado: '+esc(L[0].lb)+(L.length>1?' e mais '+(L.length-1):''))}
function lixeira(){
 trashSweep();const bs=[];(S.trash||[]).forEach(e=>{let g=bs.find(x=>x.b===e.b);if(!g){g={b:e.b,at:e.at,L:[]};bs.push(g)}g.L.push(e)});
 const row=g=>{const f=g.L[0],d=Math.floor((Date.now()-g.at)/864e5),left=Math.max(0,30-d),same=g.L.every(x=>x.ty===f.ty),ty=g.L.length>1?(same?g.L.length+' '+TRC[f.ty].n.toLowerCase()+'s':g.L.length+' itens'):TRC[f.ty].n;
  return `<div class="item"><span class="chip c-b">${esc(ty)}</span><div class="t">${esc(f.lb)}${g.L.length>1?' e mais '+(g.L.length-1):''}<small>Excluído ${d===0?'hoje':d===1?'ontem':'há '+d+' dias'} · some em ${left} ${left===1?'dia':'dias'}</small></div><button class="pill" data-a="trres" data-id="${g.b}">Restaurar</button><button class="x" data-a="trdel" data-id="${g.b}" aria-label="Excluir de vez" title="Excluir de vez">×</button></div>`};
 return `<div class="top"><h1>Lixeira</h1>${bs.length?'<button class="pill" data-a="trall">Esvaziar lixeira</button>':''}</div><p class="empty" style="padding:0 0 10px">Tarefas, eventos, notas, links, hábitos, metas e lançamentos excluídos ficam aqui por 30 dias. Depois somem sozinhos.</p><div class="panel">${bs.map(row).join('')||'<p class="empty">A lixeira está vazia.</p>'}</div>`}
const remCfg=()=>Object.assign({on:true,tk:true,fat:true,hab:true,fd:2,hh:'09:00'},S.rem||{});
function attention(){
 const R=remCfg(),o=[],tm=ds(add(today,1));
 if(R.tk){S.tasks.filter(t=>!t.done&&t.due&&t.due<=tm).sort((a,b)=>a.due.localeCompare(b.due)).forEach(t=>o.push({k:'tk',u:t.due<T?0:t.due===T?1:2,t:t.t,s:t.due<T?'Atrasada desde '+fmt(t.due):t.due===T?'Vence hoje':'Vence amanhã',v:'tarefas'}))}
 if(R.fat&&finInit().tx.length>=5){const cf=cashFlow({days:14,fac:'',vary:false});if(cf&&cf.firstNeg)o.push({k:'sal',u:1,t:cf.firstNeg.d===T?'Saldo negativo hoje':'Saldo previsto fica negativo',s:(cf.firstNeg.d===T?'Hoje':'Em '+fmt(cf.firstNeg.d))+' ('+BRL(cf.firstNeg.v)+'). Veja o fluxo de caixa.',v:'financas'})}
 if(R.fat){dues(+R.fd).filter(x=>x.k==='card'||x.k==='bill').forEach(x=>{const dd=mDays(x.d);o.push({k:x.k,u:dd<=0?1:2,t:(x.k==='card'?'':'Conta: ')+x.t,s:(dd===0?'Vence hoje':dd===1?'Vence amanhã':'Vence em '+dd+' dias')+' · '+BRL(x.v),card:x.k==='card'?x:null,v:'financas'})})}
 if(R.fat){const old=finInit().split.filter(e=>!e.st&&e.dir==='recv'&&e.d<=ds(add(today,-30)));if(old.length)o.push({k:'sal',u:2,t:'Dívidas a receber há mais de 30 dias',s:[...new Set(old.map(e=>e.p))].slice(0,3).join(', ')+' · '+BRL(old.reduce((t,e)=>t+e.v,0)),v:'financas'})}
 if(R.hab&&nowH()>=R.hh){const p=S.habits.filter(h=>!h.log[T]);if(p.length)o.push({k:'hb',u:3,t:p.length+(p.length===1?' hábito de hoje pendente':' hábitos de hoje pendentes'),s:p.slice(0,3).map(h=>h.n).join(', ')+(p.length>3?'…':''),v:'habitos'})}
 return o.sort((a,b)=>a.u-b.u)}
const attRow=x=>`<div class="item"><span class="chip c-${x.u===0?'p':x.u===1?'y':'b'}">${{tk:'Tarefa',card:'Fatura',bill:'Conta',hb:'Hábitos',sal:'Saldo'}[x.k]}</span><div class="t">${esc(x.t)}<small class="${x.u===0?'late':''}">${esc(x.s)}</small></div>${x.card?`<button class="pill" data-a="payfat" data-id="${x.card.id}" data-o="${x.card.o}">Pagar</button>`:`<button class="pill" data-v="${x.v}">Abrir</button>`}</div>`;
function attBox(){
 if(S.onb||!remCfg().on)return '';const L=attention();if(!L.length)return '';
 return `<div class="panel" id="attb" role="region" aria-label="Precisa de atenção"><h2>Precisa de atenção</h2>${L.slice(0,4).map(attRow).join('')}${L.length>4?`<button class="pill" data-v="avisos">Ver todos (${L.length})</button>`:''}</div>`}
function avisos(){
 const R=remCfg(),L=R.on?attention():[],np=('Notification' in window)?Notification.permission:'unsupported';
 const sw=(k,l,d)=>`<label class="item"><input type="checkbox" class="chk" data-rem="${k}" ${R[k]?'checked':''}><div class="t">${l}<small>${d}</small></div></label>`;
 return `<div class="top"><h1>Lembretes</h1></div>
 <div class="panel"><h2>Precisa de atenção agora</h2>${L.slice(0,pgN('av',40)).map(attRow).join('')}${pgMore('av',L.length,40)}${L.length?'':`<p class="empty">${R.on?'Nada pendente por enquanto.':'Os lembretes estão desligados.'}</p>`}</div>
 <div class="panel" style="margin-top:12px"><h2>Configurar avisos</h2>
 ${sw('on','Avisos ligados','Mostra o painel no Início e envia um resumo diário.')}
 ${sw('tk','Tarefas atrasadas e com prazo próximo','Atrasadas, de hoje e de amanhã.')}
 ${sw('fat','Faturas e contas fixas','Vencimentos nos próximos dias.')}
 ${sw('hab','Hábitos do dia pendentes','Só depois do horário do resumo.')}
 <div class="bar" style="margin:10px 0 0"><label class="lb" style="margin:0">Antecedência dos vencimentos <select class="in" data-rem="fd">${[1,2,3,5,7].map(n=>`<option value="${n}" ${+R.fd===n?'selected':''}>${n} ${n===1?'dia':'dias'}</option>`).join('')}</select></label><label class="lb" style="margin:0">Horário do resumo diário <input class="in" type="time" data-rem="hh" value="${R.hh}"></label></div></div>
 <div class="panel" style="margin-top:12px"><h2>Notificações do navegador</h2><p class="empty" style="padding:0 0 8px">${np==='granted'?'Ativadas. Elas aparecem enquanto o hub estiver aberto em alguma aba.':np==='denied'?'Bloqueadas pelo navegador. Libere nas configurações do site para receber.':np==='unsupported'?'Este navegador não oferece notificações. Os avisos aparecem dentro do hub.':'Ainda não ativadas. Sem elas, os avisos aparecem só dentro do hub.'} O hub não consegue avisar com a página totalmente fechada.</p><div class="bar" style="margin:0">${np==='default'?'<button class="pill dark" data-a="rperm">Ativar notificações</button>':''}<button class="pill" data-a="rtest">Enviar aviso de teste</button></div></div>`}
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
const blocksOn=k=>S.tasks.filter(t=>t.bk&&t.bk.d===k).map(t=>({id:t.id,t:t.t,h:t.bk.h,e:blkEnd(t),blk:1,done:t.done}));
function dayLoad(k){
 const iv=[...evOn(k),...blocksOn(k)].map(sp).sort((a,b)=>a[0]-b[0]);let tot=0,c=null;
 iv.forEach(([s,f])=>{if(c&&s<=c[1])c[1]=Math.max(c[1],f);else{if(c)tot+=c[1]-c[0];c=[s,f]}});if(c)tot+=c[1]-c[0];
 const pl=S.tasks.filter(t=>!t.done&&!t.bk&&t.hd===k).reduce((a,t)=>a+(t.dur||0),0);
 return{tot:tot+pl,pl,cap:capM()}}
function autoSlot(k,dur,skip){
 const iv=[...evOn(k).map(sp),...blocksOn(k).filter(b=>b.id!==skip).map(sp)],nw=new Date();let st=8*60;
 if(k===T)st=Math.max(st,Math.ceil((nw.getHours()*60+nw.getMinutes())/15)*15);
 for(let s=st;s+dur<=22*60;s+=15)if(!iv.some(([a,b])=>s<b&&a<s+dur))return hm(s);return null}
function warnPlan(k,id){
 const t=S.tasks.find(x=>x.id===id);if(!t||!t.bk)return;const me=sp({h:t.bk.h,e:blkEnd(t)}),c=evOn(k).find(e=>{const[s,f]=sp(e);return s<me[1]&&me[0]<f});
 if(c){toast('Atenção: conflita com “'+esc(c.t)+'” ('+c.h+')');return}
 const l=dayLoad(k);if(l.tot>l.cap)toast('Atenção: este dia passou da sua capacidade de '+fdur(l.cap))}
function planPanel(k){
 const L=S.tasks.filter(t=>!t.done&&!(t.bk&&t.bk.d===k)).sort((a,b)=>(b.hd===k)-(a.hd===k)||(a.due||'9999').localeCompare(b.due||'9999')).slice(0,12),ld=dayLoad(k),pc=Math.round(ld.tot/ld.cap*100),over=ld.tot>ld.cap;
 return `<aside class="panel plp" aria-label="Planejar o dia"><h2>Carga do dia</h2><div class="fb ${over?'o':pc>85?'w':''}" aria-hidden="true"><i style="width:${Math.min(100,pc)}%"></i></div><p class="empty" style="padding:6px 0 0"><strong>${ld.tot?fdur(ld.tot):'0 min'}</strong> de ${fdur(ld.cap)} (${pc}%)${ld.pl?'. Inclui '+fdur(ld.pl)+' de tarefas planejadas sem horário.':''}</p>${over?`<p class="late" role="alert" style="margin:4px 0">Dia sobrecarregado: passa ${fdur(ld.tot-ld.cap)} da sua capacidade. Mova algo para outro dia.</p>`:''}<div class="bar" style="margin:6px 0 0;align-items:center"><span class="empty" style="padding:0">Capacidade: ${fdur(ld.cap)}</span><span class="gctl"><button class="x" data-a="cap" data-id="-1" aria-label="Diminuir capacidade em 1 hora">−</button><button class="x" data-a="cap" data-id="1" aria-label="Aumentar capacidade em 1 hora">+</button></span></div>
 <h2 style="margin-top:14px">Encaixar tarefas</h2><p class="empty" style="padding:0 0 6px">Arraste para um horário ou toque em Encaixar. Sem duração, conta 30 min.</p><div class="pll">${L.map(t=>`<div class="item plt" draggable="true" data-dtp="${t.id}"><div class="t">${esc(t.t)}<small>${t.hd===k?'★ planejada · ':''}${t.due?'prazo '+fmt(t.due):'sem prazo'}</small></div><select class="in" data-dur="${t.id}" aria-label="Duração de ${esc(t.t)}"><option value="">?</option>${[15,30,45,60,90,120,180].map(m=>`<option value="${m}" ${t.dur===m?'selected':''}>${fdur(m)}</option>`).join('')}</select><button class="pill" data-a="fit" data-id="${t.id}">Encaixar</button></div>`).join('')||'<p class="empty">Nenhuma tarefa pendente para encaixar.</p>'}</div></aside>`}
document.addEventListener('change',e=>{const i=e.target;if(!i||!i.dataset||i.dataset.dur===undefined)return;const t=S.tasks.find(x=>x.id===i.dataset.dur);if(t){t.dur=+i.value||0;save();render()}});
/* rotina */
let RT={mode:null,i:0};
const RTS={m:['Como você está','Foco do dia','Seu dia','Tarefas de hoje','Pronto'],n:['Revisão do dia','Hábitos','Como foi o dia','Amanhã','Pronto']};
function rtStreak(){const ok=d=>{const r=(S.rot||{})[d];return r&&(r.m||r.n)};let n=0,i=ok(T)?0:1;while(i<400&&ok(ds(add(today,-i)))){n++;i++}return n}
function rotina(){
 if(!RT.mode)RT.mode=today.getHours()<14?'m':'n';const md=RT.mode,st=RTS[md],i=Math.min(RT.i,st.length-1),tm=ds(add(today,1)),done=(S.rot||{})[T]||{};
 const ta=(k,l,ph)=>`<label class="lb">${l}<textarea class="in ta" data-dk="${k}" data-dd="${T}" placeholder="${ph}">${esc((S.dia[T]||{})[k]||'')}</textarea></label>`;
 const pend=S.tasks.filter(t=>!t.done).sort((a,b)=>grp(a)-grp(b)),ev=evOn(T),hj=S.tasks.filter(t=>!t.done&&t.hd===T);
 const ld=dayLoad(T),evRow=(e)=>`<div class="item"><span class="chip c-${e.c}">${e.h}</span><div class="t">${esc(e.t)}</div></div>`;
 const tk=t=>`<div class="item"><div class="t">${esc(t.t)}<small>${t.due?(t.due<T?'Atrasada, ':'prazo ')+fmt(t.due):'sem prazo'}${t.dur?' · '+fdur(t.dur):''}</small></div><button class="pill ${t.hd===T?'on':''}" data-a="plan" data-id="${t.id}" aria-pressed="${t.hd===T}">${t.hd===T?'★ Planejada':'☆ Planejar'}</button></div>`;
 let body='';
 if(md==='m'){
  if(i===0)body=`<h2>Como você acordou?</h2><div class="lb" style="margin-top:0">Humor</div>${moodBtns(T,'m')}<div class="lb">Energia</div>${moodBtns(T,'e')}`;
  else if(i===1)body=`<h2>Qual é o foco de hoje?</h2><p class="empty" style="padding:0 0 8px">Uma coisa que, se feita, deixa o dia bom.</p><input id="fo" class="in" style="width:100%" value="${esc(S.focus||'')}" placeholder="Meu foco de hoje" maxlength="140" aria-label="Foco do dia">`;
  else if(i===2){const A=attention();body=`<h2>Seu dia</h2><p class="empty" style="padding:0 0 8px">${ev.length?ev.length+(ev.length===1?' compromisso':' compromissos'):'Nenhum compromisso'} · carga ${fdur(ld.tot)} de ${fdur(ld.cap)}${ld.tot>ld.cap?' (sobrecarregado)':''}</p>${ev.map(evRow).join('')}${A.length?`<h2 style="margin-top:12px">Precisa de atenção</h2>${A.map(attRow).join('')}`:''}`}
  else if(i===3)body=`<h2>Escolha o que fazer hoje</h2><p class="empty" style="padding:0 0 8px">Planejadas: ${hj.length}${hj.reduce((a,t)=>a+(t.dur||0),0)?' · '+fdur(hj.reduce((a,t)=>a+(t.dur||0),0)):''}. Três ou menos funciona melhor.</p>${pend.slice(0,8).map(tk).join('')||'<p class="empty">Nenhuma tarefa pendente.</p>'}<div class="bar" style="margin:10px 0 0"><button class="pill" data-a="gotoday" data-id="${T}">Encaixar na agenda</button></div>`;
  else{const hv=(S.dia[T]||{}).m;body=`<h2>Tudo pronto</h2><div class="item"><div class="t">Foco<small>${esc(S.focus||'não definido')}</small></div></div><div class="item"><div class="t">Humor<small>${hv?MN[hv-1]:'não registrado'}</small></div></div><div class="item"><div class="t">Tarefas planejadas<small>${hj.length}</small></div></div><div class="item"><div class="t">Compromissos<small>${ev.length}</small></div></div>`}
 }else{
  const dn=S.tasks.filter(t=>t.done&&t.dd===T),op=pend.filter(t=>t.hd===T||(t.due&&t.due<=T)),hb=S.habits;
  if(i===0)body=`<h2>Como foi o dia</h2><p class="empty" style="padding:0 0 8px">${dn.length} ${dn.length===1?'tarefa concluída':'tarefas concluídas'} hoje.</p>${op.map(t=>`<div class="item"><input type="checkbox" class="chk" data-a="tog" data-id="${t.id}" aria-label="Concluir ${esc(t.t)}"><div class="t">${esc(t.t)}<small>${t.due&&t.due<T?'Atrasada, '+fmt(t.due):t.due===T?'prazo hoje':'planejada para hoje'}</small></div><button class="pill" data-a="snooze" data-id="${t.id}">Para amanhã</button></div>`).join('')||'<p class="empty">Nada pendente de hoje. Bom trabalho!</p>'}${op.length>1?'<div class="bar" style="margin:10px 0 0"><button class="pill" data-a="rtmove">Mover tudo para amanhã</button></div>':''}`;
  else if(i===1)body=`<h2>Hábitos de hoje</h2>${hb.map(h=>`<div class="item"><input type="checkbox" class="chk" data-a="htog" data-id="${h.id}" data-d="${T}" ${h.log[T]?'checked':''} aria-label="${esc(h.n)}"><div class="t">${esc(h.n)}<small>${hstreak(h)} ${hstreak(h)===1?'dia':'dias'} seguidos</small></div></div>`).join('')||'<p class="empty">Nenhum hábito cadastrado.</p>'}`;
  else if(i===2)body=`<h2>Como foi o dia?</h2><div class="lb" style="margin-top:0">Humor</div>${moodBtns(T,'m')}<div class="lb">Energia</div>${moodBtns(T,'e')}${ta('b','Três vitórias','Pequenas ou grandes…')}${ta('c','Gratidão','Pelo que você é grato hoje?')}`;
  else if(i===3){const e2=evOn(tm),due=S.tasks.filter(t=>!t.done&&t.due===tm);body=`<h2>Amanhã</h2><p class="empty" style="padding:0 0 8px">${e2.length} ${e2.length===1?'compromisso':'compromissos'} · ${due.length} ${due.length===1?'tarefa com prazo':'tarefas com prazo'} · carga ${fdur(dayLoad(tm).tot)}</p>${e2.map(evRow).join('')}<label class="lb">A primeira coisa de amanhã<input id="rtnew" class="in" style="width:100%" placeholder="Ex.: ligar para o banco" maxlength="120"></label><div class="bar" style="margin:8px 0 0"><button class="pill" data-a="rtadd">Adicionar para amanhã</button></div>`}
  else body=`<h2>Dia encerrado</h2><div class="item"><div class="t">Concluídas hoje<small>${dn.length}</small></div></div><div class="item"><div class="t">Hábitos feitos<small>${hb.filter(h=>h.log[T]).length} de ${hb.length}</small></div></div><div class="item"><div class="t">Humor<small>${(S.dia[T]||{}).m?MN[S.dia[T].m-1]:'não registrado'}</small></div></div>`;
 }
 const last=i===st.length-1,fin=done[md],sk=rtStreak();
 return `<div class="top"><h1>Rotina ${md==='m'?'da manhã':'da noite'}</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill ${md==='m'?'on':''}" data-a="rtm" data-id="m" aria-pressed="${md==='m'}">Manhã</button><button class="pill ${md==='n'?'on':''}" data-a="rtm" data-id="n" aria-pressed="${md==='n'}">Noite</button></div></div>
 <p class="empty" style="padding:0 0 10px">Cerca de 2 minutos.${sk?` Rotina feita ${sk} ${sk===1?'dia':'dias'} seguidos.`:''}${fin?' Hoje já concluída.':''}</p>
 <ol class="rts" aria-label="Etapas">${st.map((s,j)=>`<li class="${j===i?'on':''}" ${j===i?'aria-current="step"':''}>${j+1}. ${s}</li>`).join('')}</ol>
 <div class="panel" style="margin-top:10px">${body}</div>
 <div class="bar" style="margin-top:12px">${i>0?'<button class="pill" data-a="rtn" data-id="-1">‹ Voltar</button>':''}${last?`<button class="pill dark" data-a="rtd">Concluir rotina</button>`:'<button class="pill dark" data-a="rtn" data-id="1">Próximo ›</button>'}</div>`}
function routBox(){
 if(S.onb)return '';const h=today.getHours(),r=(S.rot||{})[T]||{};
 const m=h<12&&!r.m,n=h>=18&&!r.n;if(!m&&!n)return '';
 return `<div class="panel" id="rtb" role="region" aria-label="Rotina"><h2>${m?'Bom dia! Comece pela rotina da manhã':'Feche o dia com a rotina da noite'}</h2><p class="empty" style="padding:0 0 8px">${m?'Humor, foco e as tarefas de hoje, em 2 minutos.':'Revise o dia, marque os hábitos e prepare amanhã.'}</p><button class="pill dark" data-a="rtgo" data-id="${m?'m':'n'}">Começar</button></div>`}
/* ===== Pacote C: ligações, leituras e revisão anual ===== */
const LKT=['tk','nt','ev','mt','rd','lk'],LKV={tk:'tarefas',nt:'notas',ev:'agenda',mt:'metas',rd:'leituras',lk:'links'};
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
 el.innerHTML=`<div class="lk-back" data-a="lkclose"></div><div class="lkd" role="dialog" aria-modal="true" aria-label="Ligações de ${esc(cur.lb)}"><div class="top" style="margin:0 0 6px"><h2 style="margin:0">Ligações</h2><button class="x" data-a="lkclose" aria-label="Fechar">×</button></div><p class="empty" style="padding:0 0 8px"><strong>${TRC[cur.ty].n}:</strong> ${esc(cur.lb)}</p>${rel.map(r=>`<div class="item"><span class="chip c-b">${TRC[r.ty].n}</span><button class="lkg" data-a="lkgo" data-id="${r.ref}">${esc(r.lb)}</button><button class="x" data-a="lkdel" data-id="${r.ref}" aria-label="Remover ligação com ${esc(r.lb)}">×</button></div>`).join('')||'<p class="empty">Nada ligado ainda.</p>'}<label class="lb">Ligar a…<input id="lkq" class="in" style="width:100%" placeholder="Buscar item para ligar" value="${esc(LKP.q||'')}" autocomplete="off"></label><div id="lkres">${lkResHtml()}</div></div>`;
 if(LKP.focus){LKP.focus=false;const i=$('#lkq');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}}}
function flashEl(){if(!FLASH)return;const el=document.querySelector('[data-lid="'+FLASH+'"]');FLASH=null;if(el){el.scrollIntoView({block:'center'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),2400)}}
document.addEventListener('input',e=>{if(e.target.id==='lkq'&&LKP){LKP.q=e.target.value;const r=$('#lkres');if(r)r.innerHTML=lkResHtml()}});
function lkGo(ref){
 const r=lkItem(ref);if(!r)return;LKP=null;S.view=LKV[r.ty];Q='';ED=null;$('#q').value='';FLASH=ref;
 if(r.ty==='ev'){S.mode='day';S.dy=mDays(r.it.d)}else if(r.ty==='nt'){S.nf='';S.ng=''}else if(r.ty==='tk'){S.filter='all';S.pf=''}else if(r.ty==='lk')S.lc='';else if(r.ty==='rd'){S.rk='';S.rs=''}}
/* leituras */
const RK={livro:['Livro','y',['Quero ler','Lendo','Lido']],filme:['Filme','p',['Quero ver','Assistindo','Visto']],série:['Série','g',['Quero ver','Assistindo','Visto']],artigo:['Artigo','b',['Quero ler','Lendo','Lido']],podcast:['Podcast','b',['Quero ouvir','Ouvindo','Ouvido']]},RS=['q','a','f'];
const rdLab=r=>(RK[r.k]||RK.livro)[2][RS.indexOf(r.st)];
function leituras(){
 const A=S.reads=S.reads||[],fk=S.rk||'',fs=S.rs||'',Y=String(today.getFullYear());
 const L=A.filter(r=>(!fk||r.k===fk)&&(!fs||r.st===fs)).sort((a,b)=>RS.indexOf(a.st)===1?-1:RS.indexOf(b.st)===1?1:(b.da||'').localeCompare(a.da||''));
 const fin=A.filter(r=>r.st==='f'&&(r.df||'').startsWith(Y)),rt=fin.filter(r=>r.r),av=rt.length?(rt.reduce((s,r)=>s+r.r,0)/rt.length).toFixed(1).replace('.',','):'–';
 const by=Object.keys(RK).map(k=>[k,fin.filter(r=>r.k===k).length]).filter(x=>x[1]);
 const chip=(a,id,l,on)=>`<button class="pill ${on?'on':''}" data-a="${a}" data-id="${id}" aria-pressed="${on}">${l}</button>`;
 return `<div class="top"><h1>Leituras e mídia</h1></div>
 <form class="bar" id="frd"><input class="in grow" name="t" placeholder="Título (livro, filme, artigo…)" required><input class="in" name="a" placeholder="Autor ou diretor" aria-label="Autor ou diretor"><select class="in" name="k" aria-label="Tipo">${Object.entries(RK).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('')}</select><select class="in" name="st" aria-label="Situação"><option value="q">Quero</option><option value="a">Em andamento</option><option value="f">Concluído</option></select><input class="in" name="u" type="url" placeholder="Link (opcional)" aria-label="Link"><button class="pill dark">Adicionar</button></form>
 <div class="panel" style="margin-bottom:12px"><h2>Em ${Y}</h2><p style="margin:0">${fin.length?`<strong>${fin.length}</strong> ${fin.length===1?'concluído':'concluídos'}${by.length?' ('+by.map(x=>x[1]+' '+RK[x[0]][0].toLowerCase()+(x[1]>1&&x[0]!=='série'?'s':x[1]>1?'s':'')).join(', ')+')':''}. Nota média: <strong>${av}</strong>.`:'Nada concluído ainda neste ano.'} ${A.filter(r=>r.st==='a').length?'Em andamento: '+A.filter(r=>r.st==='a').length+'.':''}</p></div>
 <div class="bar">${chip('rfk','','Todos',!fk)}${Object.entries(RK).map(([k,v])=>chip('rfk',k,v[0],fk===k)).join('')}</div><div class="bar">${chip('rfs','','Qualquer situação',!fs)}${chip('rfs','q','Quero',fs==='q')}${chip('rfs','a','Em andamento',fs==='a')}${chip('rfs','f','Concluídos',fs==='f')}</div>
 <div class="notes">${L.map(r=>{const K=RK[r.k]||RK.livro;return `<div class="note c-${K[1]}" data-lid="rd:${r.id}"><input data-rdf="t" data-id="${r.id}" value="${esc(r.t)}" placeholder="Título" aria-label="Título"><input data-rdf="a" data-id="${r.id}" value="${esc(r.a||'')}" placeholder="Autor ou diretor" aria-label="Autor ou diretor" style="font-size:14px;font-weight:400"><div class="bar" style="margin:0;align-items:center"><span class="chip" style="background:rgba(0,0,0,.12)">${K[0]}</span><select class="in" data-rds="${r.id}" aria-label="Situação de ${esc(r.t)}">${RS.map((s,i)=>`<option value="${s}" ${r.st===s?'selected':''}>${K[2][i]}</option>`).join('')}</select></div>${r.st==='a'?`<label class="lb" style="color:#161616">Progresso <span>${r.p||0}%</span><input type="range" min="0" max="100" step="5" value="${r.p||0}" data-rdp="${r.id}" aria-label="Progresso de ${esc(r.t)}" style="width:100%"></label>`:''}<div role="group" aria-label="Nota">${[1,2,3,4,5].map(n=>`<button class="x" data-a="rdr" data-id="${r.id}" data-n="${n}" aria-pressed="${(r.r||0)>=n}" aria-label="${n} de 5 estrelas">${(r.r||0)>=n?'★':'☆'}</button>`).join('')}</div><textarea data-rdf="n" data-id="${r.id}" placeholder="Anotações, citações, o que achou…" aria-label="Anotações" style="min-height:70px">${esc(r.n||'')}</textarea><footer><span>${r.st==='f'&&r.df?'Concluído em '+fmt(r.df):r.da?'Adicionado em '+fmt(r.da):''}</span><span>${r.u?`<a href="${esc(safeUrl(r.u))}" target="_blank" rel="noopener" class="x">abrir ↗</a>`:''}${lkBtn('rd',r.id)}<button class="x" data-a="delrd" data-id="${r.id}" aria-label="Excluir ${esc(r.t)}">Excluir</button></span></footer></div>`}).join('')||emp('rd','Sua lista está vazia. Registre o que quer ler ou assistir, acompanhe o que está em andamento e guarde suas notas.','Adicionar o primeiro','data-a="focusform" data-id="#frd"')}</div>`}
document.addEventListener('change',e=>{const i=e.target;if(!i||!i.dataset)return;
 if(i.dataset.rds){const r=(S.reads||[]).find(x=>x.id===i.dataset.rds);if(r){r.st=i.value;if(r.st==='f'){r.df=r.df||T;r.p=100}else if(r.st==='q')r.df='';else r.df=''; render()}}});
/* revisão anual do diário */
function diarioAno(){
 const Y=today.getFullYear()+(S.dyr||0),cur=Y===today.getFullYear(),end=cur?T:Y+'-12-31',days=[];
 for(let d=new Date(Y,0,1);ds(d)<=end;d=add(d,1))days.push(ds(d));
 const E=days.map(k=>({k,e:S.dia[k]||{}})),has=x=>x.e.m||x.e.e||x.e.a||x.e.b||x.e.c,reg=E.filter(has),mo=E.filter(x=>x.e.m),en=E.filter(x=>x.e.e);
 const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0,f1=n=>n.toFixed(1).replace('.',',');
 const head=`<div class="top"><h1>Revisão de ${Y}</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill" data-a="dyn" data-n="-1" aria-label="Ano anterior">‹</button><button class="pill" data-a="dyn" data-n="0">Este ano</button><button class="pill" data-a="dyn" data-n="1" aria-label="Próximo ano" ${cur?'disabled':''}>›</button><button class="pill dark" data-a="dvw" data-id="dia">Voltar ao diário</button></div></div>`;
 if(!reg.length)return head+`<div class="panel">${emp('dia','Ainda não há registros neste ano. Anote o humor e escreva no diário, e a revisão aparece aqui.','Ir para o diário','data-a="dvw" data-id="dia"')}</div>`;
 const mm2=[...Array(12)].map((_,m)=>{const a=mo.filter(x=>+x.k.slice(5,7)===m+1).map(x=>x.e.m);return{m,n:a.length,v:mean(a)}}),mv=mm2.filter(x=>x.n);
 const best=mv.length?mv.reduce((a,b)=>b.v>a.v?b:a):null,wd=[...Array(7)].map((_,g)=>{const a=mo.filter(x=>new Date(x.k+'T00:00').getDay()===g).map(x=>x.e.m);return{g,n:a.length,v:mean(a)}}),wv=wd.filter(x=>x.n>=3),bw=wv.length?wv.reduce((a,b)=>b.v>a.v?b:a):null;
 const pad=(new Date(Y,0,1).getDay()+6)%7,W=Math.ceil((pad+days.length)/7);
 const heat=`<div class="hmap" style="grid-template-columns:repeat(${W},1fr);width:100%;max-width:${W*18}px" role="img" aria-label="Humor dia a dia em ${Y}">${'<i class="hm" style="visibility:hidden"></i>'.repeat(pad)}${E.map(x=>`<i class="hm" style="background:${x.e.m?MC[x.e.m-1]:'var(--card)'}" title="${fmt(x.k)}: ${x.e.m?MN[x.e.m-1]:'sem registro'}"></i>`).join('')}</div><p class="empty" style="padding:6px 0 0">${MC.map((c,i)=>`<span class="lg" style="background:${c}"></span>${MN[i]}`).join(' &nbsp; ')} &nbsp; <span class="lg" style="background:var(--card);border:1px solid var(--line)"></span>sem registro</p>`;
 const bars=`<div class="chart" role="img" aria-label="Humor médio por mês: ${mm2.map(x=>MES[x.m]+' '+(x.n?f1(x.v):'sem dados')).join(', ')}">${mm2.map(x=>`<div class="col"><small>${x.n?f1(x.v):'–'}</small><div class="bar-w"><i style="height:${x.v/5*100}%;background:${x.n?MC[Math.min(4,Math.max(0,Math.round(x.v)-1))]:'transparent'}"></i></div><small>${MES[x.m]}</small></div>`).join('')}</div>`;
 const wdr=`${wd.map(x=>`<div class="cat" style="grid-template-columns:34px 1fr auto;margin-bottom:4px"><span>${DIA[x.g]}</span><div class="fb" aria-hidden="true"><i style="width:${x.v/5*100}%"></i></div><small>${x.n?f1(x.v):'–'}</small></div>`).join('')}`;
 const hab=S.habits.map(h=>{let c=0,bs=0,r=0;days.forEach(k=>{if(h.log[k]){c++;r++;bs=Math.max(bs,r)}else r=0});const i0=days.findIndex(k=>h.log[k]);return{h,c,bs,pc:i0<0?0:Math.round(c/(days.length-i0)*100)}}).filter(x=>x.c).sort((a,b)=>b.c-a.c).slice(0,6);
 const top=mo.filter(x=>x.e.m>=4).sort((a,b)=>b.e.m-a.e.m||(b.e.e||0)-(a.e.e||0)||b.k.localeCompare(a.k)).slice(0,5);
 const win=reg.filter(x=>(x.e.b||'').trim()).slice(-6).reverse(),gr=reg.filter(x=>(x.e.c||'').trim()).length;
 const tkY=S.tasks.filter(t=>t.done&&(t.dd||'').startsWith(String(Y))).length,fmY=Object.keys(S.fm).filter(k=>k.startsWith(String(Y))).reduce((s,k)=>s+S.fm[k],0),rdY=(S.reads||[]).filter(r=>r.st==='f'&&(r.df||'').startsWith(String(Y))).length;
 const sn=x=>esc(plain(x.e.a||x.e.b||x.e.c||'').slice(0,110));
 const txt=`Em ${Y} você registrou <strong>${reg.length}</strong> ${reg.length===1?'dia':'dias'} no diário (${Math.round(reg.length/days.length*100)}% do período)${mo.length?`, com humor médio de <strong>${f1(mean(mo.map(x=>x.e.m)))}</strong> de 5`:''}${en.length?` e energia média de <strong>${f1(mean(en.map(x=>x.e.e)))}</strong>`:''}.${best?` O melhor mês foi <strong>${MESF[best.m]}</strong> (${f1(best.v)}).`:''}${bw?` Seu dia mais leve costuma ser <strong>${DIAF[bw.g]}</strong>.`:''}`;
 return head+`<div class="cards"><div class="panel wide"><h2>Resumo</h2><p style="margin:0">${txt}</p></div>
 <div class="rv4 wide" style="grid-column:1/-1"><div class="stat c-p"><span>Dias registrados</span><strong>${reg.length}</strong></div><div class="stat c-b"><span>Tarefas concluídas</span><strong>${tkY}</strong></div><div class="stat c-y"><span>Foco</span><strong>${Math.round(fmY/60)} h</strong></div><div class="stat c-g"><span>Leituras concluídas</span><strong>${rdY}</strong></div></div>
 <div class="panel wide"><h2>O ano em cores</h2>${heat}</div>
 <div class="panel"><h2>Humor médio por mês</h2>${bars}</div><div class="panel"><h2>Humor por dia da semana</h2>${wdr}<p class="empty" style="padding:6px 0 0">Média de 1 a 5, nos dias com humor registrado.</p></div>
 <div class="panel"><h2>Hábitos mais constantes</h2>${hab.map(x=>`<div class="cat" style="grid-template-columns:1fr 1fr auto"><span>${esc(x.h.n)}</span><div class="fb" aria-hidden="true"><i style="width:${x.pc}%"></i></div><small>${x.c} ${x.c===1?'dia':'dias'} (${x.pc}% desde o 1º registro) · melhor sequência ${x.bs}</small></div>`).join('')||'<p class="empty">Nenhum hábito marcado neste ano.</p>'}</div>
 <div class="panel"><h2>Melhores dias</h2>${top.map(x=>`<div class="item"><span class="chip" style="background:${MC[x.e.m-1]}">${MN[x.e.m-1]}</span><div class="t">${fmt(x.k)}<small>${sn(x)}</small></div></div>`).join('')||'<p class="empty">Nenhum dia com humor “Bom” ou “Ótimo” registrado.</p>'}</div>
 <div class="panel wide"><h2>Vitórias e gratidão</h2><p class="empty" style="padding:0 0 8px">${gr} ${gr===1?'dia com gratidão registrada':'dias com gratidão registrada'}. Últimas vitórias anotadas:</p>${win.map(x=>`<div class="item"><div class="t">${fmt(x.k)}<small>${esc(plain(x.e.b).slice(0,160))}</small></div></div>`).join('')||'<p class="empty">Nenhuma vitória anotada.</p>'}</div></div>`}
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
function setPriv(){const b=$('#pv');if(!b)return;b.innerHTML=ic(PRIV?'eyeoff':'eye',18);b.setAttribute('aria-pressed',PRIV?'true':'false');const t=PRIV?'Mostrar valores':'Ocultar valores';b.setAttribute('aria-label',t);b.title=t;document.documentElement.dataset.priv=PRIV?'1':'0'}
function togglePriv(){PRIV=!PRIV;try{localStorage.setItem('hub-priv',PRIV?'1':'0')}catch(e){}setPriv();render();toast(PRIV?'Valores ocultos neste aparelho.':'Valores visíveis.')}
setTimeout(setPriv,0);
/* versões automáticas (só neste aparelho) */
const SNK='hub-snaps',SNMAX=8,SNBYTES=1.2e6;
function snaps(){try{const a=JSON.parse(localStorage.getItem(SNK));return Array.isArray(a)?a:[]}catch(e){return[]}}
function snapPut(why,minGap){
 try{const j=pickJSON(),L=snaps();if(L[0]&&L[0].j===j)return false;if(minGap&&L[0]&&Date.now()-L[0].t<minGap)return false;
  const F=S.fin||{};L.unshift({t:Date.now(),why,j,c:{tk:(S.tasks||[]).length,ev:(S.events||[]).length,nt:(S.notes||[]).length,tx:(F.tx||[]).length}});
  while(L.length>SNMAX)L.pop();while(L.length>1&&JSON.stringify(L).length>SNBYTES)L.pop();
  if(JSON.stringify(L).length>SNBYTES)return false;
  for(;;){try{localStorage.setItem(SNK,JSON.stringify(L));return true}catch(e){if(L.length<=1)return false;L.pop()}}}catch(e){return false}}
function snapAuto(){const has=(S.tasks||[]).length+(S.events||[]).length+(S.notes||[]).length+((S.fin||{}).tx||[]).length+(S.habits||[]).length>0;const L=snaps();if(!has)return;if(L[0]&&Date.now()-L[0].t<12*36e5)return;snapPut('Automática')}
setTimeout(snapAuto,4000);setInterval(snapAuto,30*60e3);
function snapRestore(t){const x=snaps().find(s=>s.t===t);if(!x)return;let d;try{d=JSON.parse(x.j)}catch(e){toast('Esta versão está corrompida.');return}
 snapPut('Antes de restaurar uma versão');applyState(d);save();render();toast('Versão de '+snapFmt(t)+' restaurada. Os dados anteriores foram guardados como versão.',true)}
const snapFmt=t=>new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
function snapPanel(){
 const L=snaps();
 return `<div class="panel"><h2>Versões automáticas</h2><p class="empty" style="padding:0 0 8px">O hub guarda uma versão por dia e antes de trocar seus dados por outros, até ${SNMAX}. Ficam só neste aparelho e não substituem um backup em arquivo.</p>${L.map(x=>`<div class="item"><span class="chip c-b">${ic('clock',14)}</span><div class="t">${snapFmt(x.t)} · ${esc(x.why)}<small>${x.c.tk} tarefas · ${x.c.ev} eventos · ${x.c.nt} notas · ${x.c.tx} lançamentos</small></div><button class="pill" data-a="snaprest" data-id="${x.t}">Restaurar</button></div>`).join('')||'<p class="empty">Nenhuma versão ainda. A primeira é criada sozinha assim que houver dados.</p>'}<div class="bar" style="margin:8px 0 0"><button class="pill dark" data-a="snapnow">Salvar versão agora</button></div></div>`}
/* paleta de comandos */
let CK=null;
function ckItems(q){
 const out=[],tok=norm(q).split(' ').filter(Boolean),A=(g,l,ico,run,kw)=>{const k=norm(l+' '+(kw||''));if(tok.every(t=>k.includes(t)))out.push({g,l,ico,run,s:k.startsWith(tok[0]||'')?0:1})};
 const go=k=>()=>{$('#side').classList.remove('open');FED=null;S.view=k;Q='';ED=null;$('#q').value='';render()};
 const cap=(t,txt)=>()=>{qa(t);const i=$('#qa input[name=t]');if(i&&txt)i.value=txt};
 if(tok.length&&q.trim().length>=2){const x=q.trim();A('Criar','Criar tarefa: '+x,'plus',cap('tk',x),'');A('Criar','Criar evento: '+x,'cal',cap('ev',x),'');A('Criar','Criar nota: '+x,'note',cap('nt',x),'')}
 A('Ações','Nova tarefa','plus',cap('tk'),'criar adicionar');A('Ações','Novo evento','cal',cap('ev'),'criar adicionar compromisso');A('Ações','Nova nota','note',cap('nt'),'criar adicionar');
 A('Ações','Lançar despesa','wallet',cap('dp'),'gasto finanças');A('Ações','Lançar receita','wallet',cap('rc'),'entrada salário finanças');
 A('Ações',PRIV?'Mostrar valores':'Ocultar valores',PRIV?'eye':'eyeoff',togglePriv,'privacidade esconder dinheiro');
 A('Ações','Alternar tema claro e escuro','moon',()=>{const r=document.documentElement;r.dataset.theme=isDark()?'light':'dark';applyTheme()},'escuro noite');
 A('Ações','Salvar versão agora','clock',()=>{toast(snapPut('Manual')?'Versão salva em Backup.':'Nada mudou desde a última versão.');if(S.view==='backup')render()},'backup');
 A('Ações','Desfazer','undo',undo,'voltar');
 A('Ações','Rever o tour de boas-vindas','search',()=>tourOpen(0),'ajuda primeiro uso começar');
 if(emptyData())A('Ações','Carregar dados de exemplo','plus',exLoad,'demonstração tour');
 if(hasEx())A('Ações','Remover dados de exemplo','undo',exClear,'apagar demonstração');
 if(tok.length){
  const m=(ty,ic2,arr,lab,kw)=>{let n=0;arr.forEach(it=>{if(n>=5)return;const l=lab(it);if(!l)return;const k=norm(l+' '+(kw?kw(it):''));if(tok.every(t=>k.includes(t))){n++;out.push({g:'Itens',l,ico:ic2,run:()=>{lkGo(ty+':'+it.id);render()},s:2})}})};
  m('tk','check',[...S.tasks].sort((a,b)=>(a.done?1:0)-(b.done?1:0)),t=>t.t);m('nt','note',S.notes,n=>n.t||'',n=>(n.b||'').replace(/<[^>]*>/g,' '));m('ev','cal',S.events,e=>e.t);m('lk','link',S.links,l=>l.n);m('rd','book',S.reads||[],r=>r.t);m('mt','flag',S.metas,g=>g.t);
 }
 const hid=new Set(menuCfg().hidden);Object.keys(NAV).forEach(k=>A('Ir para','Ir para '+NAV[k].n,({dash:'home',hoje:'today',rotina:'sun',avisos:'bell',agenda:'cal',tarefas:'check',metas:'flag',habitos:'repeat',notas:'note',diario:'smile',links:'link',etiquetas:'tag',financas:'wallet',aparencia:'spark',backup:'save',lixeira:'trash',leituras:'book',menu:'sliders'})[k],go(k),hid.has(k)?'oculto':''));
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
 else if(a==='snapnow'){e.stopPropagation();toast(snapPut('Manual')?'Versão salva.':'Nada mudou desde a última versão.');render()}
 else if(a==='snaprest'){e.stopPropagation();snapRestore(+b.dataset.id)}},true);
/* datas no padrão brasileiro: campo dd/mm/aaaa com seletor de calendário */
const DTI='<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>';
const dtBR=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'';
const dtISO=t=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t||'');if(!m)return '';const d=+m[1],mo=+m[2],y=+m[3],x=new Date(y,mo-1,d);return x.getFullYear()===y&&x.getMonth()===mo-1&&x.getDate()===d&&y>=1900&&y<=2200?m[3]+'-'+m[2]+'-'+m[1]:''};
function dtUp(root){
 (root.querySelectorAll?root.querySelectorAll('input[type=date]:not([data-dt])'):[]).forEach(p=>{
  p.dataset.dt='1';const req=p.required,w=document.createElement('span');w.className='dtw';
  const t=document.createElement('input');t.type='text';t.className=(p.className||'in')+' dtt';t.inputMode='numeric';t.autocomplete='off';t.placeholder='dd/mm/aaaa';t.maxLength=10;
  t.value=dtBR(p.value);if(req)t.required=true;
  const lb=p.getAttribute('aria-label')||p.title||'Data';t.setAttribute('aria-label',lb);if(p.title)t.title=p.title;if(p.getAttribute('style'))t.setAttribute('style',p.getAttribute('style'));
  const b=document.createElement('button');b.type='button';b.className='dtb';b.tabIndex=-1;b.setAttribute('aria-label','Abrir calendário: '+lb);b.innerHTML=DTI;
  p.required=false;p.className='dtp';p.tabIndex=-1;p.setAttribute('aria-hidden','true');p.removeAttribute('style');p.removeAttribute('title');p.removeAttribute('aria-label');
  p.parentNode.insertBefore(w,p);w.append(t,b,p);
  const chk=()=>{const v=dtISO(t.value);p.value=v;t.setCustomValidity(t.value&&!v?'Use o formato dia/mês/ano, por exemplo 25/12/2026':'')};
  t.addEventListener('input',()=>{const d=t.value.replace(/\D/g,'').slice(0,8);t.value=d.length>4?d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4):d.length>2?d.slice(0,2)+'/'+d.slice(2):d;chk()});
  t.addEventListener('blur',()=>{const m=/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(t.value);if(m){t.value=m[1].padStart(2,'0')+'/'+m[2].padStart(2,'0')+'/20'+m[3]}chk()});
  p.addEventListener('change',()=>{t.value=dtBR(p.value);chk()});
  b.addEventListener('click',()=>{p.value=dtISO(t.value)||p.value;try{p.showPicker()}catch(e){p.focus();p.click()}});
  chk();
 });
}
new MutationObserver(ms=>{for(const m of ms)m.addedNodes.forEach(n=>{if(n.nodeType===1)dtUp(n)})}).observe(document.body,{childList:true,subtree:true});
dtUp(document);
/* Início visual: faixa de resumo (anéis + tendências) e linha do tempo do dia */
const kRing=(p,col,ico)=>{const C=2*Math.PI*22;return `<span class="kr"><svg class="kring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" stroke-opacity=".13" stroke-width="7"/>${p>0?`<circle cx="28" cy="28" r="22" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(C*Math.min(100,p)/100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 28 28)"/>`:''}</svg>${ic(ico,18)}</span>`};
const kSpark=(a,col)=>{const n=a.length,mx=Math.max(1,...a),d=a.map((v,i)=>(i/(n-1)*100).toFixed(1)+','+(25-(v/mx)*21).toFixed(1)).join(' ');return `<svg class="spk" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,28 ${d} 100,28" fill="${col}" fill-opacity=".16"/><polyline points="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`};
const kTrend=(cur,prev,pct,what)=>{if(!cur&&!prev)return 'sem dados ainda';const d=cur-prev;if(!d)return '= igual à semana anterior';const v=pct?(prev?Math.abs(Math.round(d/prev*100))+'%':'novo'):Math.abs(d);return (d>0?'▲ +':'▼ −')+v+(what?' '+what:'')+' vs. semana anterior'};
function kpi(v,ico,col,pct,lab,big,sub,spk,trd){return `<button class="kpi" data-v="${v}"><div class="kr0">${kRing(pct,col,ico)}</div><div class="kt"><small>${esc(lab)}</small><strong>${big}</strong><em>${sub}</em></div><div class="kfoot">${spk?kSpark(spk,col):''}<span class="trd">${trd||''}</span></div></button>`}
function heroCard(){
 const days=[...Array(14)].map((_,i)=>ds(add(today,i-13))),idx={};days.forEach((k,i)=>idx[k]=i);
 const dTk=days.map(()=>0),dFx=days.map(()=>0);
 S.tasks.forEach(t=>{if(t.done&&t.dd in idx)dTk[idx[t.dd]]++});
 ((S.fin||{}).tx||[]).forEach(t=>{if(t.k==='out'&&t.d in idx)dFx[idx[t.d]]+=+t.v||0});
 const dHb=days.map(k=>S.habits.filter(h=>h.log&&h.log[k]).length),sum=(a,x,y)=>a.slice(x,y).reduce((p,q)=>p+q,0);
 const hj0=dTk[13],goal=S.goal||3,pend=S.tasks.filter(t=>!t.done&&(t.hd===T||(t.due&&t.due<=T))).length;
 const hs=S.habits,hdn=hs.filter(h=>h.log&&h.log[T]).length,best=Math.max(0,...hs.map(hstreak));
 const evs=evOn(T),nowm=mm(nowH()),cur=evs.find(e=>{const r=sp(e);return r[0]<=nowm&&nowm<r[1]}),nx=evs.find(e=>sp(e)[0]>nowm),past=evs.filter(e=>sp(e)[1]<=nowm).length;
 let eBig='Dia livre',eSub=evs.length?'Sem mais compromissos hoje':'Nenhum evento hoje';
 if(cur){eBig=esc(cur.t);eSub='Agora, até '+hm(sp(cur)[1])}
 else if(nx){eBig=esc(nx.t);eSub='às '+nx.h+' · em '+fdur(sp(nx)[0]-nowm)}
 else{const u=upcoming(8).find(x=>x.d>T);if(u){eBig=esc(u.t);eSub=fmt(u.d)+' às '+u.h}}
 const F=finInit(),{inc,out}=finMonth(0),hasFx=F.tx.length>0,fp=inc>0?Math.round(out/inc*100):0;
 const parts=[];if(pend)parts.push(pend+(pend>1?' tarefas':' tarefa')+' para hoje');if(evs.length)parts.push(evs.length+(evs.length>1?' compromissos':' compromisso'));if(hs.length&&hdn<hs.length)parts.push((hs.length-hdn)+(hs.length-hdn>1?' hábitos pendentes':' hábito pendente'));
 return `<section class="hero2" aria-label="Resumo do dia"><div class="top"><h1>${saud()}! Hoje é ${DIAF[today.getDay()]}, ${today.getDate()} de ${MESF[today.getMonth()]}</h1></div><p class="hsub">${parts.length?parts.join(' · '):'Nada pendente por enquanto. Bom momento para planejar algo.'}</p>${focusBox()}
 <div class="kpis">${kpi('tarefas','check','var(--s1)',Math.round(hj0/goal*100),'Meta de hoje',hj0+'/'+goal,pend?pend+' para hoje':'Nada pendente para hoje',dTk,kTrend(sum(dTk,7),sum(dTk,0,7),0,'concluídas'))}
 ${kpi('habitos','repeat','var(--s1)',hs.length?Math.round(hdn/hs.length*100):0,'Hábitos de hoje',hs.length?hdn+'/'+hs.length:'—',hs.length?(best?best+(best>1?' dias seguidos':' dia seguido'):'Comece hoje a sequência'):'Crie seu primeiro hábito',hs.length?dHb:null,hs.length?kTrend(sum(dHb,7),sum(dHb,0,7),0,'marcações'):'')}
 ${kpi('agenda','cal','var(--s1)',evs.length?Math.round(past/evs.length*100):0,cur?'Agora':'Próximo compromisso',eBig,eSub,null,evs.length?past+' de '+evs.length+(evs.length>1?' compromissos já passaram':' compromisso já passou'):'')}
 ${kpi('financas','wallet',fp>100?'var(--neg)':'var(--s1)',Math.min(100,fp),'Resultado do mês',hasFx?BRL(inc-out):'—',hasFx?(inc>0?'Gastou '+fp+'% da renda':'Gastos: '+BRL(out)):'Lance sua primeira despesa',hasFx?dFx:null,hasFx?kTrend(sum(dFx,7),sum(dFx,0,7),1,'nos gastos'):'')}</div></section>`}
function lineCard(){
 const L0=[...evOn(T),...blocksOn(T)].filter(e=>e.h).sort((x,y)=>sp(x)[0]-sp(y)[0]),nowm=mm(nowH());
 const free=S.tasks.filter(t=>!t.done&&(t.hd===T||t.due===T)&&!(t.bk&&t.bk.d===T));
 let a=8,z=20;const pts=L0.flatMap(e=>[Math.floor(sp(e)[0]/60),Math.ceil(sp(e)[1]/60)]);
 if(pts.length){a=Math.min(...pts)-1;z=Math.max(...pts)+1;if(z-a<8){const x=8-(z-a);a-=Math.floor(x/2);z+=Math.ceil(x/2)}}
 a=Math.max(0,a);z=Math.min(24,Math.max(z,a+8));if(z-a<8)a=Math.max(0,z-8);const span=(z-a)*60,it=layout(L0),rows=Math.max(1,...it.map(x=>x.l+1)),pc=m=>((m-a*60)/span*100).toFixed(2);
 const ticks=[];for(let h=a;h<=z;h+=(z-a>14?2:1))ticks.push(`<i class="tk" style="left:${pc(h*60)}%"><span>${String(h%24).padStart(2,'0')}h</span></i>`);
 const blocks=it.map(x=>{const e=x.e,w=Math.max(3,(x.f-x.s)/span*100),l=+pc(x.s),en=hm(x.f);return `<button class="tl ${e.blk?'blk':'c-'+e.c}${x.f<=nowm?' past':''}${e.cf?' cf':''}" style="left:${l}%;width:${Math.min(w,100-l)}%;top:${x.l*34}px" data-a="gotoday" data-id="${T}" title="${esc(e.t)} (${e.h}–${en})" aria-label="${esc(e.t)}, ${e.h} às ${en}${e.cf?', conflito de horário':''}"><b>${e.h}</b>${e.blk&&e.done?'✔ ':''}${esc(e.t)}</button>`}).join('');
 const now=nowm>=a*60&&nowm<=z*60?`<span class="now" style="left:${pc(nowm)}%" aria-hidden="true"></span>`:'';
 const fr=free.length?`<div class="tlf"><small>Sem horário:</small>${free.slice(0,4).map(t=>`<span class="chip c-y">${esc(t.t)}</span>`).join('')}${free.length>4?`<span class="chip">+${free.length-4}</span>`:''}</div>`:'';
 return `<div class="panel wide" data-card="linha"><h2>Seu dia</h2>${L0.length||free.length?`<div class="tlw"><div class="tlc"><div class="tll" style="height:${rows*34-4}px">${ticks.join('')}${blocks}${now}</div></div></div>${fr}`:emp('ev','Nada marcado para hoje. Aproveite o dia livre ou planeje algo.','Novo evento','data-a="qat" data-id="ev"')}</div>`}
/* Spotify: o player vive fora do #main para não reiniciar a música a cada atualização da tela */
const spParse=u=>{u=String(u||'').trim();const m=/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/.exec(u)||/^spotify:(playlist|album|track|artist|show|episode):([A-Za-z0-9]+)$/.exec(u);return m?{t:m[1],id:m[2]}:null};
let SPED=false,SPBIG=false,SPON=false,SPCUR='';
function spCard(){
 const L=S.sp=S.sp||[],cur=L.find(x=>x.id===S.spsel)||L[0],p=cur&&spParse(cur.u);
 const chips=L.length?`<div class="bar" style="margin:0 0 10px">${L.map(x=>`<button class="pill${cur&&x.id===cur.id?' on':''}" data-a="sppick" data-id="${x.id}">${esc(x.n)}</button>`).join('')}<button class="pill" data-a="spadd" aria-label="Adicionar playlist">+</button></div>`:'';
 const form=(SPED||!L.length)?`<form id="fsp2" class="bar" style="margin:0 0 6px"><input class="in" name="n" placeholder="Nome (ex.: Foco)" maxlength="30" required aria-label="Nome da playlist"><input class="in grow" name="u" placeholder="Link da playlist no Spotify" required aria-label="Link do Spotify"><button class="pill dark">Adicionar</button>${L.length?'<button type="button" class="pill" data-a="spcancel">Cancelar</button>':''}</form><p class="empty" style="padding:2px 0 0">No Spotify, abra a playlist, toque nos três pontos, Compartilhar e Copiar link.</p>`:'';
 let body='';
 if(!form&&cur){
  if(!p)body=`<p class="empty">O link de “${esc(cur.n)}” não parece ser do Spotify. Remova e adicione de novo.</p>`;
  else if(IN_CLAUDE)body=`<a class="spl" href="https://open.spotify.com/${p.t}/${p.id}" target="_blank" rel="noopener"><span class="ico" style="background:hsl(${hue(cur.u)} 55% 36%)" aria-hidden="true">${esc(ini(cur.n))}</span><span><strong>${esc(cur.n)}</strong><small>Abrir no Spotify</small></span></a><p class="empty" style="padding:8px 0 0">O player embutido só aparece na versão publicada como site.</p>`;
  else if(!SPON)body=`<button class="spl" data-a="spload"><span class="ico" style="background:hsl(${hue(cur.u)} 55% 36%)" aria-hidden="true">${esc(ini(cur.n))}</span><span><strong>${esc(cur.n)}</strong><small>Carregar o player</small></span></button>`;
  else body=`<div class="spslot" data-src="https://open.spotify.com/embed/${p.t}/${p.id}?utm_source=generator" style="height:${SPBIG&&p.t!=='track'?352:152}px"></div>`;
 }
 const acts=(!form&&cur)?`<div class="bar" style="margin:10px 0 0">${SPON&&!IN_CLAUDE?`<button class="pill" data-a="spbig">${SPBIG?'Player menor':'Player maior'}</button><button class="pill" data-a="spstop">Parar</button>`:''}<button class="pill" data-a="spdel">Remover “${esc(cur.n)}”</button></div>`:'';
 return `<div class="panel" data-card="spotify"><h2>Playlist</h2>${chips}${form}${body}${acts}</div>`}
function spSync(){
 const slot=document.querySelector('.spslot');let w=document.getElementById('spwrap');
 if(!SPON||IN_CLAUDE){if(w){w.remove();SPCUR=''}return}
 const want=slot?slot.dataset.src:SPCUR;
 if(!want){if(w){w.remove();SPCUR=''}return}
 if(!w){w=document.createElement('div');w.id='spwrap';document.body.prepend(w)}
 if(want!==SPCUR){SPCUR=want;w.innerHTML='<iframe title="Player do Spotify" src="'+want+'" width="100%" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>'}
 const fr=w.firstElementChild;
 if(slot){const r=slot.getBoundingClientRect();w.style.cssText='position:absolute;left:'+(r.left+scrollX)+'px;top:'+(r.top+scrollY)+'px;width:'+r.width+'px;height:'+r.height+'px';if(fr)fr.height=String(r.height)}
 else w.style.cssText='position:fixed;left:-9999px;top:0;width:320px;height:152px'}
setInterval(()=>{if(SPCUR)spSync()},500);window.addEventListener('resize',()=>spSync());
/* Clima (Open-Meteo, sem chave) */
const WXI={sun:'<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',part:'<circle cx="8.5" cy="8.5" r="3"/><path d="M8.5 2.5v1.5M2.5 8.5H4M4.3 4.3l1 1M12.7 4.3l-1 1"/><path d="M8 19h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.5 1.2A3 3 0 0 0 8 19z"/>',cloud:'<path d="M7 19h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.4A3.4 3.4 0 0 0 7 19z"/>',fog:'<path d="M4 9h16M3 13h18M5 17h14"/>',rain:'<path d="M7 14h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.4A3.4 3.4 0 0 0 7 14z"/><path d="M8 17.5l-1 2.5M12 17.5l-1 2.5M16 17.5l-1 2.5"/>',snow:'<path d="M7 14h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.4A3.4 3.4 0 0 0 7 14z"/><path d="M8 18v.01M12 19.5v.01M16 18v.01"/>',storm:'<path d="M7 14h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.4A3.4 3.4 0 0 0 7 14z"/><path d="M12 14l-2 3.5h3l-2 3.5"/>'};
const wxK=(c,day)=>c===0?(day?'sun':'moon'):c<=2?(day?'part':'cloud'):c===3?'cloud':c<=48?'fog':c<=67?'rain':c<=77?'snow':c<=82?'rain':c<=86?'snow':'storm';
const WXT=c=>c===0?'Céu limpo':c<=2?'Poucas nuvens':c===3?'Nublado':c<=48?'Neblina':c<=57?'Garoa':c<=67?'Chuva':c<=77?'Neve':c<=82?'Pancadas de chuva':c<=86?'Neve forte':'Tempestade';
const wxSvg=(k,z)=>`<svg class="ic" viewBox="0 0 24 24" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WXI[k]}</svg>`;
let WX=null,WXKEY='',WXAT=0,WXBUSY=false,WXERR='',WXED=false,WXRES=[];
const wxKey=()=>S.wx&&S.wx.lat!=null?S.wx.lat+','+S.wx.lon:'';
async function wxLoad(force){
 const w=S.wx;if(!w||w.lat==null||IN_CLAUDE)return;const k=wxKey();let c=null;try{c=JSON.parse(localStorage.getItem('hub-wxc')||'null')}catch(e){}
 if(!force&&c&&c.k===k&&Date.now()-c.t<18e5){WX=c.d;WXKEY=k;WXAT=c.t;WXERR='';return wxDraw()}
 WXBUSY=true;
 try{const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+w.lat+'&longitude='+w.lon+'&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5');if(!r.ok)throw 0;WX=await r.json();WXERR='';try{localStorage.setItem('hub-wxc',JSON.stringify({k,t:Date.now(),d:WX}))}catch(e){}}
 catch(e){WXERR='Não foi possível carregar o clima agora.';if(c&&c.k===k)WX=c.d}
 WXKEY=k;WXAT=Date.now();wxDraw()}
function wxDraw(){WXBUSY=false;if(document.querySelector('[data-card=clima]'))render()}
function wxEnsure(){const k=wxKey();if(!k||IN_CLAUDE||WXBUSY)return;if(WXKEY===k&&WX&&!WXERR&&Date.now()-WXAT<18e5)return;if(WXKEY===k&&WXERR&&Date.now()-WXAT<3e5)return;wxLoad()}
async function wxSearch(q){try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=5&language=pt&format=json');if(!r.ok)throw 0;const j=await r.json();WXRES=(j.results||[]).map(x=>({n:[x.name,x.admin1].filter(Boolean).join(', ')+(x.country_code&&x.country_code!=='BR'?' ('+x.country_code+')':''),lat:+(+x.latitude).toFixed(2),lon:+(+x.longitude).toFixed(2)}));if(!WXRES.length)toast('Nenhuma cidade encontrada.')}catch(e){WXRES=[];toast('Não foi possível buscar a cidade agora.')}render()}
function wxCard(){
 const w=S.wx,ed=WXED||!w;
 if(IN_CLAUDE){
  const f=`<form id="fwx" class="bar" style="margin:0 0 6px"><input class="in grow" name="q" placeholder="Sua cidade" value="${esc((w&&w.n)||'')}" maxlength="60" required aria-label="Cidade"><button class="pill dark">Salvar</button></form>`;
  return `<div class="panel" data-card="clima"><h2>Clima</h2>${ed?f:''}${w&&w.n?`<a class="spl" href="https://www.google.com/search?q=${encodeURIComponent('clima '+w.n)}" target="_blank" rel="noopener"><span class="ico" style="background:hsl(205 55% 36%)" aria-hidden="true">${wxSvg('part',18)}</span><span><strong>${esc(w.n)}</strong><small>Ver a previsão em outra aba</small></span></a>${ed?'':'<div class="bar" style="margin:10px 0 0"><button class="pill" data-a="wxchg">Trocar cidade</button></div>'}`:''}<p class="empty" style="padding:6px 0 0">A previsão ao vivo só aparece na versão publicada como site.</p></div>`}
 const form=`<form id="fwx" class="bar" style="margin:0 0 6px"><input class="in grow" name="q" placeholder="Buscar cidade (ex.: Curitiba)" maxlength="60" required aria-label="Cidade"><button class="pill dark">Buscar</button><button type="button" class="pill" data-a="wxgeo">Usar minha localização</button>${w?'<button type="button" class="pill" data-a="wxcancel">Cancelar</button>':''}</form>${WXRES.length?`<div class="bar" style="margin:0 0 6px">${WXRES.map((x,i)=>`<button class="pill" data-a="wxpick" data-id="${i}">${esc(x.n)}</button>`).join('')}</div>`:''}`;
 if(ed)return `<div class="panel" data-card="clima"><h2>Clima</h2>${form}${w?'':'<p class="empty" style="padding:2px 0 0">Escolha uma cidade para ver a previsão. Só as coordenadas são enviadas ao serviço de clima (Open-Meteo).</p>'}</div>`;
 const c=WX&&WX.current,d=WX&&WX.daily;
 if(!c||!d)return `<div class="panel" data-card="clima"><h2>Clima</h2><p class="empty" style="padding:0 0 8px">${WXERR||'Carregando a previsão de '+esc(w.n)+'…'}</p><div class="bar" style="margin:0"><button class="pill" data-a="wxrf">Tentar de novo</button><button class="pill" data-a="wxchg">Trocar cidade</button></div></div>`;
 const rd=v=>Math.round(v),days=d.time.map((t,i)=>`<div class="wxd"><small>${i===0?'hoje':DIA[new Date(t+'T12:00').getDay()]}</small>${wxSvg(wxK(d.weather_code[i],1),22)}<b>${rd(d.temperature_2m_max[i])}°</b><span>${rd(d.temperature_2m_min[i])}°</span></div>`).join('');
 return `<div class="panel" data-card="clima"><h2>Clima</h2><div class="wxn"><span class="wxi">${wxSvg(wxK(c.weather_code,c.is_day),44)}</span><div><strong class="wxt">${rd(c.temperature_2m)}°</strong><small>${WXT(c.weather_code)} · sensação ${rd(c.apparent_temperature)}°</small></div><div class="wxm"><small>Vento ${rd(c.wind_speed_10m)} km/h</small><small>Umidade ${rd(c.relative_humidity_2m)}%</small><small>Chuva ${d.precipitation_probability_max[0]==null?'–':d.precipitation_probability_max[0]+'%'}</small></div></div><div class="wxs">${days}</div><div class="bar" style="margin:10px 0 0"><span class="empty" style="padding:0">${esc(w.n)}${WXERR?' · '+esc(WXERR):''}</span><button class="pill" data-a="wxchg">Trocar cidade</button><button class="pill" data-a="wxrf">Atualizar</button></div></div>`}
document.addEventListener('click',e=>{
 const b=e.target.closest&&e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a,id=b.dataset.id,L=()=>S.sp=S.sp||[];
 const done=()=>{e.stopPropagation();e.preventDefault()};
 if(a==='fblogin'){done();fbLogin()}
 else if(a==='reload'){done();location.reload()}
 else if(a==='fbout'){done();fbLogout()}
 else if(a==='sppick'){done();S.spsel=id;render()}
 else if(a==='spload'){done();SPON=true;render()}
 else if(a==='spstop'){done();SPON=false;render()}
 else if(a==='spbig'){done();SPBIG=!SPBIG;render()}
 else if(a==='spadd'){done();SPED=true;render()}
 else if(a==='spcancel'){done();SPED=false;render()}
 else if(a==='spdel'){done();const cur=L().find(x=>x.id===S.spsel)||L()[0];if(cur){S.sp=L().filter(x=>x!==cur);S.spsel=S.sp[0]?S.sp[0].id:'';if(!S.sp.length)SPON=false;toast('Playlist removida.');render()}}
 else if(a==='wxchg'){done();WXED=true;WXRES=[];render()}
 else if(a==='wxcancel'){done();WXED=false;WXRES=[];render()}
 else if(a==='wxrf'){done();wxLoad(true)}
 else if(a==='wxpick'){done();const x=WXRES[+id];if(x){S.wx={n:x.n,lat:x.lat,lon:x.lon};WXED=false;WXRES=[];WX=null;WXKEY='';render()}}
 else if(a==='wxgeo'){done();if(!navigator.geolocation){toast('Este navegador não oferece localização.');return}navigator.geolocation.getCurrentPosition(p=>{S.wx={n:'Minha localização',lat:+p.coords.latitude.toFixed(2),lon:+p.coords.longitude.toFixed(2)};WXED=false;WXRES=[];WX=null;WXKEY='';render()},()=>toast('Não foi possível obter a localização.'),{timeout:10000})}
},true);
document.addEventListener('submit',e=>{const f=e.target;
 if(f.id==='fsp2'){e.preventDefault();e.stopPropagation();const v=Object.fromEntries(new FormData(f)),p=spParse(v.u);if(!p){toast('Esse link não parece ser do Spotify.');return}const it={id:uid(),n:String(v.n).trim(),u:'https://open.spotify.com/'+p.t+'/'+p.id,c:COL[(S.sp||[]).length%4]};S.sp=[...(S.sp||[]),it];S.spsel=it.id;SPED=false;render();return}
 if(f.id==='fwx'){e.preventDefault();e.stopPropagation();const q=String(new FormData(f).get('q')||'').trim();if(!q)return;if(IN_CLAUDE){S.wx={n:q};WXED=false;render()}else wxSearch(q)}},true);
/* frase do dia (opcional): frases prontas ou a sua */
const FRS=['Um passo de cada vez já é movimento.','Faça o simples primeiro; o difícil fica menor depois.','Hoje basta o próximo passo.','Constância vale mais que intensidade.','O que começa pequeno também cresce.','Descansar também faz parte do plano.','Termine uma coisa antes de abrir outra.','Pouco por dia, muito no fim do mês.','Clareza vem de colocar no papel.','Um bom dia começa com uma prioridade só.','Não precisa estar pronto para começar.','Cuide da rotina e o resto acompanha.','Progresso imperfeito ainda é progresso.','Escolha o que importa e diga não ao resto.','Quem planeja a semana respira melhor.','Dinheiro organizado compra tranquilidade.','Comece pelo que você vem adiando.','Pausas curtas rendem horas melhores.','Registrar hoje é facilitar o amanhã.','Seu ritmo é o ritmo certo.','Metas viram hábitos quando cabem no dia.','Foque no que está ao seu alcance.','Bom humor também se treina.','Feito é melhor que perfeito.'];
let FRED=false;
const frToday=()=>{if(S.frase)return S.frase;const d=Math.floor((new Date(T+'T12:00')-new Date(today.getFullYear()+'-01-01T12:00'))/864e5);return FRS[(d+(S.frasen||0))%FRS.length]};
function frCard(){
 const mine=!!S.frase;
 if(FRED)return `<div class="panel quote" data-card="frase"><h2>Frase do dia</h2><form id="ffr" class="bar" style="margin:0"><input class="in grow" name="f" maxlength="160" placeholder="Escreva sua frase ou lema" value="${esc(S.frase||'')}" aria-label="Sua frase"><button class="pill dark">Salvar</button><button type="button" class="pill" data-a="frcancel">Cancelar</button></form></div>`;
 return `<div class="panel quote" data-card="frase"><h2>Frase do dia</h2><blockquote>${esc(frToday())}</blockquote><div class="bar" style="margin:12px 0 0">${mine?'':'<button class="pill" data-a="frnext">Outra frase</button>'}<button class="pill" data-a="fredit">${mine?'Editar minha frase':'Escrever a minha'}</button>${mine?'<button class="pill" data-a="frclear">Voltar às frases</button>':''}</div></div>`}
document.addEventListener('click',e=>{
 const b=e.target.closest&&e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
 if(a==='frnext'){e.stopPropagation();S.frasen=(S.frasen||0)+1;render()}
 else if(a==='fredit'){e.stopPropagation();FRED=true;render();const i=$('#ffr input');if(i){i.focus();i.select()}}
 else if(a==='frcancel'){e.stopPropagation();FRED=false;render()}
 else if(a==='frclear'){e.stopPropagation();S.frase='';render()}},true);
document.addEventListener('submit',e=>{if(e.target.id!=='ffr')return;e.preventDefault();e.stopPropagation();S.frase=String(new FormData(e.target).get('f')||'').trim();FRED=false;render()},true);
/* primeiro uso: tour curto + dados de exemplo removíveis */
const EXK=['tasks','events','notes','links','habits','metas'];
const hasEx=()=>EXK.some(k=>(S[k]||[]).some(x=>x.ex))||((S.fin||{}).tx||[]).some(x=>x.ex);
const emptyData=()=>!(S.tasks.length||S.events.length||S.notes.length||S.links.length||S.habits.length||S.metas.length||((S.fin||{}).tx||[]).length||Object.keys(S.dia||{}).length);
function exLoad(){
 if(!emptyData()&&!confirm('Já existem dados aqui. Adicionar os exemplos mesmo assim? Eles ficam marcados e podem ser removidos depois.'))return;
 snapPut('Antes de carregar dados de exemplo');
 const F=finInit(),d=n=>ds(add(today,n)),m=o=>({id:uid(),ex:1,...o}),dm=x=>T.slice(0,8)+String(Math.max(1,Math.min(x,today.getDate()))).padStart(2,'0');
 [['Explorar o hub (exemplo)','a',d(0),0],['Pagar a conta de luz (exemplo)','m',d(2),0],['Organizar documentos (exemplo)','b','',0],['Revisar o orçamento do mês (exemplo)','m',d(5),0],['Ligar para o dentista (exemplo)','m','',1]].forEach(x=>S.tasks.push(m({t:x[0],done:!!x[3],p:x[1],due:x[2],...(x[3]?{dd:T}:{})})));
 [['Reunião de alinhamento (exemplo)',d(0),'10:00','11:00'],['Almoço com amigos (exemplo)',d(1),'12:30','13:30'],['Consulta de rotina (exemplo)',d(3),'15:00','']].forEach((x,i)=>S.events.push(m({t:x[0],d:x[1],h:x[2],e:x[3],r:'',rm:'',c:COL[i%4]})));
 S.notes.unshift(m({t:'Ideias para o fim de semana (exemplo)',b:'Visitar a feira\nLer um capítulo do livro\nPlanejar a semana',f:'',g:'',c:'y'}));
 S.links.push(m({n:'Wikipédia (exemplo)',u:'https://pt.wikipedia.org',cat:'Outros',k:'',tg:normTags(''),c:'b'}));
 S.habits.push(m({n:'Beber 2 L de água (exemplo)',log:{[d(0)]:true,[d(-1)]:true,[d(-2)]:true,[d(-4)]:true}}),m({n:'Caminhar 20 min (exemplo)',log:{[d(-1)]:true,[d(-3)]:true}}));
 S.metas.unshift(m({t:'Ler 6 livros neste ano (exemplo)',ini:T,fim:today.getFullYear()+'-12-31',kr:[]}));
 [['in','Salário (exemplo)',3600,'Outros',1],['out','Aluguel (exemplo)',1200,'Moradia',2],['out','Mercado (exemplo)',342.8,'Alimentação',4],['out','Uber (exemplo)',28.9,'Transporte',5],['out','Streaming (exemplo)',39.9,'Assinaturas',6],['out','Farmácia (exemplo)',56.4,'Saúde',7],['out','Cinema (exemplo)',64,'Lazer',9],['out','Padaria (exemplo)',18.5,'Alimentação',10],['out','Curso online (exemplo)',89,'Educação',11]].forEach(x=>F.tx.unshift(m({k:x[0],t:x[1],v:x[2],cat:x[3],d:dm(x[4]),ac:F.acc[0].id})));
 S.onb=false;save();render();toast('Exemplos carregados. Remova quando quiser.')}
function exClear(){
 snapPut('Antes de remover dados de exemplo');
 EXK.forEach(k=>{S[k]=(S[k]||[]).filter(x=>!x.ex)});if(S.fin)S.fin.tx=(S.fin.tx||[]).filter(x=>!x.ex);
 save();render();toast('Exemplos removidos.')}
function exKeep(){EXK.forEach(k=>(S[k]||[]).forEach(x=>{delete x.ex}));((S.fin||{}).tx||[]).forEach(x=>{delete x.ex});save();render();toast('Os exemplos agora são seus.')}
const TS=[
 {t:'Bem-vindo ao seu hub',b:'Agenda, tarefas, notas, links, hábitos e finanças em um só lugar. Tudo fica salvo neste aparelho; sincronizar com outros é opcional.'},
 {t:'Captura rápida',b:'Use o botão + ou Ctrl+K e escreva do jeito que pensar: “reunião sexta 14h” ou “pagar boleto amanhã”. O hub entende a data e a hora.'},
 {t:'Navegue pelo menu',b:'Hoje mostra o dia, Agenda e Tarefas organizam o que vem pela frente, Finanças acompanha gastos e metas. Em Aparência você escolhe cores, menu e densidade.'},
 {t:'Seus dados, sob controle',b:'O botão de olho esconde os valores em R$. Em Backup ficam as versões automáticas e a exportação em arquivo. Errou? Ctrl+Z desfaz.'},
 {t:'Por onde começar?',b:'Você pode começar do zero ou carregar alguns dados de exemplo para ver o hub funcionando. Os exemplos vêm marcados com “(exemplo)” e saem com um clique.'}];
let TR=null;
const tourSeen=()=>{try{return !!localStorage.getItem('hub-tour')}catch(e){return false}};
function tourOpen(i){TR={i:i||0,prev:document.activeElement};tourDraw()}
function tourClose(){try{localStorage.setItem('hub-tour','1')}catch(e){}const el=$('#tour');if(el)el.remove();const p=TR&&TR.prev;TR=null;if(p&&p.focus&&document.contains(p))try{p.focus()}catch(e){}}
function tourDraw(){
 let el=$('#tour');if(!el){el=document.createElement('div');el.id='tour';document.body.append(el)}
 const s0=TS[TR.i],last=TR.i===TS.length-1;
 el.innerHTML=`<div class="ckb" data-a="tourx"></div><div class="tourc" role="dialog" aria-modal="true" aria-labelledby="tourt" aria-describedby="tourb"><div class="tdots" aria-hidden="true">${TS.map((_,k)=>`<i class="${k===TR.i?'on':''}"></i>`).join('')}</div><h2 id="tourt">${s0.t}</h2><p id="tourb">${s0.b}</p><div class="trow">${last?`${TR.i?'<button class="pill" data-a="tourback">Voltar</button>':''}<span class="sp"></span><button class="pill" data-a="tourzero">Começar do zero</button><button class="pill dark" data-a="tourex" id="tourpri">Carregar exemplo</button>`:`<button class="pill" data-a="tourx">Pular</button><span class="sp"></span>${TR.i?'<button class="pill" data-a="tourback">Voltar</button>':''}<button class="pill dark" data-a="tournext" id="tourpri">Próximo</button>`}</div></div>`;
 const pr=$('#tourpri');if(pr)pr.focus()}
window.addEventListener('keydown',e=>{
 if(!TR)return;
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();tourClose();return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopPropagation();return}
 if(e.key==='Tab'){const bs=[...document.querySelectorAll('#tour button:not(.ckb)')];if(!bs.length)return;const i=bs.indexOf(document.activeElement),n=e.shiftKey?(i<=0?bs.length-1:i-1):(i+1)%bs.length;e.preventDefault();e.stopPropagation();bs[n].focus()}},true);
document.addEventListener('click',e=>{
 const b=e.target.closest&&e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
 if(a==='tournext'){e.stopPropagation();TR.i=Math.min(TS.length-1,TR.i+1);tourDraw()}
 else if(a==='tourback'){e.stopPropagation();TR.i=Math.max(0,TR.i-1);tourDraw()}
 else if(a==='tourx'){e.stopPropagation();tourClose()}
 else if(a==='tourzero'){e.stopPropagation();tourClose()}
 else if(a==='tourex'){e.stopPropagation();tourClose();exLoad()}
 else if(a==='tourgo'){e.stopPropagation();tourOpen(0)}
 else if(a==='exload'){e.stopPropagation();exLoad()}
 else if(a==='exclear'){e.stopPropagation();exClear()}
 else if(a==='exkeep'){e.stopPropagation();exKeep()}},true);
setTimeout(()=>{if(S.onb&&!tourSeen()&&emptyData()&&!TR&&!CK)tourOpen(0)},1500);
