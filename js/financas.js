// finanças: contas, cartões, recorrentes, gráficos, importação, regras, relatórios, fluxo de caixa, reserva e divisão de despesas
/* ===== Finanças v2: contas, cartões, recorrentes, gráficos, medidores, importação ===== */
let FED=null,FTAG='',ANALYSIS_CAT='',ANALYSIS_CUT='',IMP=null,RED=null,BED=null,FQ='',FRECON='',FCLEAR=null,FCLEART=0,TXBULKDEL=false,TXBULKT=0,INV_BUSY=false,INV_AT=0,INV_ERR='',INV_YR=today.getFullYear(),INV_BUY=null,INV_SIM=null;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const dimOf=(y,m)=>new Date(y,m+1,0).getDate();
const addM=(d,n)=>{const x=new Date(d+'T00:00'),day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+n);x.setDate(Math.min(day,dimOf(x.getFullYear(),x.getMonth())));return ds(x)};
const r2=v=>Math.round(v*100)/100;
const K=v=>PRIV?'•':Math.abs(v)>=1000?(v/1000).toFixed(Math.abs(v)>=1e4?0:1).replace('.',',')+'k':String(Math.round(v));
const PAL8=['var(--pink)','var(--blue)','var(--yellow)','var(--green)','var(--chart-5)','var(--chart-6)','var(--chart-7)','var(--chart-8)','color-mix(in srgb,var(--pink) 65%,var(--blue))','color-mix(in srgb,var(--chart-6) 65%,var(--yellow))','color-mix(in srgb,var(--chart-7) 68%,var(--green))','color-mix(in srgb,var(--chart-8) 65%,var(--pink))','color-mix(in srgb,var(--s1) 60%,var(--blue))'];
const ACT={cc:'Conta corrente',card:'Cartão de crédito',cash:'Dinheiro',inv:'Investimento'};
const hm2=v=>String(v).padStart(2,'0');
function simulatedCardCycle(purchase,card){const date=new Date(purchase+'T12:00:00'),close=+card.close||28,due=+card.due||10;if(!Number.isInteger(close)||close<1||close>31||!Number.isInteger(due)||due<1||due>31)throw Error('Confira fechamento e vencimento do cartão');let y=date.getFullYear(),m=date.getMonth(),closing=ds(new Date(y,m,Math.min(close,dimOf(y,m))));if(purchase>closing){const next=new Date(y,m+1,1);y=next.getFullYear();m=next.getMonth();closing=ds(new Date(y,m,Math.min(close,dimOf(y,m))))}const dm=new Date(y,due>close?m:m+1,1),payment=ds(new Date(dm.getFullYear(),dm.getMonth(),Math.min(due,dimOf(dm.getFullYear(),dm.getMonth()))));return {closing,payment}}
function simulatePurchase(fin,accountId,start,amount,parts,rate,asOf,cardId,until){
 const accounts=fin.acc||[],account=accounts.find(a=>a.id===accountId&&a.ty!=='card');if(!account||!Number.isSafeInteger(amount)||amount<=0||!Number.isInteger(parts)||parts<1||parts>48||!Number.isFinite(rate)||rate<0||rate>100||!/^\d{4}-\d{2}-\d{2}$/.test(start)||start<asOf||Number.isNaN(Date.parse(start+'T12:00:00'))||ds(new Date(start+'T12:00:00'))!==start)throw Error('Dados inválidos');
 const card=cardId?accounts.find(a=>a.id===cardId&&a.ty==='card'):null;if(cardId&&!card)throw Error('Cartão inválido');const total=Math.round(amount*Math.pow(1+rate/100,parts)),share=Math.floor(total/parts),schedule=Array.from({length:parts},(_,i)=>{const d=addM(start,i),cycle=card?simulatedCardCycle(d,card):null;return {purchase:d,closing:cycle&&cycle.closing,d:cycle?cycle.payment:d,value:i===parts-1?total-share*(parts-1):share}}),last=[schedule[schedule.length-1].d,until||asOf].sort().pop(),events=[];let opening=Math.round((+account.ini||0)*100);
 for(const tx of fin.tx||[]){const ac=accounts.some(a=>a.id===tx.ac)?tx.ac:accounts[0]?.id,v=Math.round((+tx.v||0)*100);let delta=0;if(tx.k==='in'&&ac===accountId)delta=v;if(tx.k==='out'&&ac===accountId)delta=-v;if(tx.k==='tr'){if(ac===accountId)delta-=v;if(tx.to===accountId)delta+=v}if(!delta)continue;if(tx.d<asOf)opening+=delta;else if(tx.d<=last)events.push({d:tx.d,delta})}
 schedule.forEach(p=>events.push({d:p.d,scenario:-p.value}));
 if(!Number.isSafeInteger(total))throw Error('Valor muito alto');const dates=[...new Set([asOf,last,...events.map(e=>e.d)])].sort();let base=opening,scenario=opening,minBase=opening,minScenario=opening;for(const d of dates){for(const e of events.filter(x=>x.d===d)){base+=e.delta||0;scenario+=(e.delta||0)+(e.scenario||0)}minBase=Math.min(minBase,base);minScenario=Math.min(minScenario,scenario)}return {total,base,scenario,minBase,minScenario,start:asOf,end:last,schedule};
}
function simulationBudget(category,schedule){
 if(!category)return '';
 const costs=new Map();
 for(const p of schedule){
  const month=p.purchase.slice(0,7);
  costs.set(month,(costs.get(month)||0)+p.value/100);
 }
 const results=[];
 for(const [month,extra] of costs){
  const limit=budgetsAt(month)[category];
  if(!(limit>0))continue;
  const spent=S.fin.tx.filter(t=>t.d?.startsWith(month))
   .reduce((sum,t)=>sum+(t.k==='out'&&t.cat===category?t.v:t.k==='in'&&t.rb&&t.rcat===category?-t.v:0),0);
  results.push(`${month.slice(5)}/${month.slice(0,4)} · ${BRL(spent+extra)} de ${BRL(limit)}`);
 }
 return results.length?`<p>Orçamento de ${esc(category)} · ${results.join(' · ')}</p>`:'<p>Sem teto para a categoria nos meses afetados.</p>';
}
function simulationPanel(){const accounts=(S.fin.acc||[]).filter(a=>a.ty!=='card'),cards=(S.fin.acc||[]).filter(a=>a.ty==='card');return `<details class="panel"><summary>Simular compra</summary><p class="empty">Projeção ilustrativa por conta, com lançamentos já cadastrados. Não inclui recorrências ainda não lançadas nem faturas futuras sem pagamento vinculado. Juros compostos incidem mensalmente sobre o total. Para cartão, a conta escolhida é usada somente nesta simulação: o cadastro não vincula uma conta ao cartão. Valores de faturas sem pagamento agendado ficam fora da base.</p><form id="purchase-simulator" class="bar"><label class="lb">Conta<select class="in" name="account" required>${accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.n)}</option>`).join('')}</select></label><label class="lb">Forma de pagamento<select class="in" name="card"><option value="">Débito em conta</option>${cards.map(a=>`<option value="${esc(a.id)}">Cartão: ${esc(a.n)}</option>`).join('')}</select></label><label class="lb">Valor à vista (R$)<input data-fin-private class="in" name="amount" inputmode="decimal" required></label><label class="lb">Data da compra ou primeiro pagamento<input class="in" type="date" name="date" value="${T}" min="${T}" required></label><label class="lb">Parcelas<input class="in" name="parts" type="number" min="1" max="48" value="1" required></label><label class="lb">Juros mensais (%)<input class="in" name="rate" type="number" min="0" max="100" step="0.01" value="0" required></label><label class="lb">Categoria do orçamento<select class="in" name="category"><option value="">Sem categoria</option>${FC.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><button class="pill" ${accounts.length?'':'disabled'}>Comparar cenários</button></form><div data-simulation-result aria-live="polite"></div></details>`}
function finInit(){const F=S.fin;F.acc=F.acc||[];F.rec=F.rec||[];F.recDismiss=F.recDismiss||[];F.rules=F.rules||[];F.tx=F.tx||[];F.bud=F.bud||{};F.goals=F.goals||[];F.prules=F.prules||[];F.split=F.split||[];F.bills=F.bills||[];F.archives=F.archives||[];if(!F.acc.length)F.acc.push({id:'main',n:'Conta principal',ty:'cc',ini:0});if(F.inv)invInit(F);return F}
function finYearNetCents(F,year){
 const pref=year+'-',net={};F.acc.forEach(a=>net[a.id]=0);
 const defId=F.acc[0]&&F.acc[0].id;
 for(const t of F.tx||[]){
  if(!t.d||!t.d.startsWith(pref))continue;
  const ac=F.acc.some(a=>a.id===t.ac)?t.ac:defId,c=Math.round((+t.v||0)*100);
  if(t.k==='in'&&ac)net[ac]=(net[ac]||0)+c;
  else if(t.k==='out'&&ac)net[ac]=(net[ac]||0)-c;
  else if(t.k==='tr'){if(ac)net[ac]=(net[ac]||0)-c;if(t.to&&F.acc.some(a=>a.id===t.to))net[t.to]=(net[t.to]||0)+c}
 }
 return net;
}
function finArchiveYear(year){
 const F=finInit(),y=+year,curY=today.getFullYear();
 if(!Number.isInteger(y)||y>=curY)return false;
 if(F.archives.some(x=>x.year===y))return false;
 const pref=y+'-',archivedTx=F.tx.filter(t=>t.d&&t.d.startsWith(pref));
 if(!archivedTx.length)return false;
 if(typeof snapPut==='function')snapPut('Antes de arquivar Finanças '+y);
 const closingMonths=new Set((F.closings||[]).filter(e=>e.month.startsWith(pref)).map(e=>e.month));
 const closingCaps=Object.fromEntries(closingNet(F,closingMonths));
 for(const month of closingMonths)if(!(month in closingCaps))closingCaps[month]=F.closingRetained?.[month]||0;
 const net=finYearNetCents(F,y),payload={year:y,tx:archivedTx,net,archivedAt:Date.now(),count:archivedTx.length};
 if(typeof idbPut==='function')idbPut('fin-archive-'+y,JSON.stringify(payload));
 if(typeof DBr!=='undefined'&&DBr&&typeof P==='string')DBr.doc(P+'fin-archive-'+y).set(payload).catch(()=>{});
 F.acc.forEach(a=>{a.ini=r2((+a.ini||0)+(net[a.id]||0)/100)});
 F.tx=F.tx.filter(t=>!t.d||!t.d.startsWith(pref));
 F.archives.push({year:y,count:archivedTx.length,archivedAt:payload.archivedAt,closingCaps});
 F.archives.sort((a,b)=>b.year-a.year);
 return true;
}
async function finUnarchiveYear(year){
 const F=finInit(),y=+year;
 let payload=null;
 if(typeof idbGet==='function'){const raw=await idbGet('fin-archive-'+y);if(raw&&typeof raw==='string')try{payload=JSON.parse(raw)}catch(e){}}
 if(!payload&&typeof DBr!=='undefined'&&DBr&&typeof P==='string'){try{const doc=await DBr.doc(P+'fin-archive-'+y).get();if(doc.exists)payload=doc.data()}catch(e){}}
 if(!payload||!Array.isArray(payload.tx)){toast('Arquivo de '+y+' não encontrado neste aparelho nem na nuvem.');return false}
 const seen=new Set(F.tx.map(t=>t.id)),restored=payload.tx.filter(t=>t&&!seen.has(t.id));
 F.tx.push(...restored);
 const net=payload.net||finYearNetCents({acc:F.acc,tx:restored},y);
 F.acc.forEach(a=>{a.ini=r2((+a.ini||0)-(net[a.id]||0)/100)});
 F.archives=F.archives.filter(x=>x.year!==y);
 render();toast('Lançamentos de '+y+' restaurados ('+restored.length+').');
 return true;
}
function budgetsAt(month){const F=finInit(),out={...F.bud};Object.entries(F.budHist||{}).forEach(([cat,changes])=>{const key=Object.keys(changes).filter(k=>k<=month).sort().pop();if(key){if(changes[key]===null)delete out[cat];else out[cat]=changes[key]}});return out}
function setBudget(cat,month,value){const F=finInit();F.budHist=F.budHist||{};(F.budHist[cat]=F.budHist[cat]||{})[month]=value}
const accId=t=>{const a=S.fin.acc;return t.ac&&a.some(x=>x.id===t.ac)?t.ac:a[0].id};
const accName=id=>{const a=S.fin.acc.find(x=>x.id===id);return a?a.n:'—'};
const WD=[['domingo','dom'],['segunda','seg'],['terca','ter'],['quarta','qua'],['quinta','qui'],['sexta','sex'],['sabado','sab']];
function parseNL(str,o){o=o||{};let t=' '+str+' ',d=null,h=null;const Z=n=>String(n).padStart(2,'0'),nn=x=>norm(x);
 const cut=re=>{const m=re.exec(nn(t));if(!m)return null;t=t.slice(0,m.index)+' '+t.slice(m.index+m[0].length);return m};
 let m;
 if(m=cut(/\bdepois de amanha\b/))d=ds(add(today,2));
 else if(m=cut(/\banteontem\b/))d=ds(add(today,-2));
 else if(m=cut(/\bamanha\b/))d=ds(add(today,1));
 else if(m=cut(/\bontem\b/))d=ds(add(today,-1));
 else if(m=cut(/\bhoje\b/))d=T;
 else if(m=cut(/\bdaqui a (\d{1,3}) dias?\b/))d=ds(add(today,+m[1]));
 else if(m=cut(/\b(semana que vem|proxima semana)\b/))d=ds(add(today,7));
 else if(m=cut(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)){let y=m[3]?+m[3]:today.getFullYear();if(y<100)y+=2000;const mo=+m[2]-1,dd=+m[1],x=new Date(y,mo,dd);if(mo>=0&&mo<12&&x.getMonth()===mo&&x.getDate()===dd){if(!m[3]&&ds(x)<T)x.setFullYear(y+1);d=ds(x)}else{t=str.length?' '+str+' ':t;return{t:str.trim(),d:null,h:null}}}
 else if(m=cut(/\bdia (\d{1,2})\b/)){const dd=+m[1];if(dd>=1&&dd<=31){let x=new Date(today.getFullYear(),today.getMonth(),dd);if(x.getDate()!==dd||ds(x)<T)x=new Date(today.getFullYear(),today.getMonth()+1,dd);if(x.getDate()===dd)d=ds(x)}}
 else{for(let i=0;i<7;i++){const re=new RegExp('\\b'+WD[i][0]+'(-feira)?\\b');if(m=cut(re)){let k=(i-today.getDay()+7)%7;if(k===0)k=7;d=ds(add(today,k));break}}}
 if(o.time!==false){if(m=cut(/\bas?\s+(\d{1,2})(?:[:h](\d{2}))?\s*h?\b/)||cut(/\b(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/)){const hh=+m[1],mi=+(m[2]||m[3]||0);if(hh<24&&mi<60)h=Z(hh)+':'+Z(mi)}}
 let r=t.replace(/\s+(as|às|para|pra|em|no|na|de|a)\s*$/i,'').replace(/\s+/g,' ').trim();
 if(!r)return{t:str.trim(),d:null,h:null};return{t:r,d,h}}
const num=s=>{s=String(s==null?'':s).replace(/[^\d,.\-]/g,'');if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');return parseFloat(s)};
function parseFinNL(str,vRaw,useDate){
 let s=String(str||'');const tgs=[];
 s=s.replace(/(?:^|\s)#([a-zA-ZÀ-ÿ0-9_-]+)/g,(_,g)=>{tgs.push(g);return ' '}).replace(/\s+/g,' ').trim();
 const nl=useDate!==false?parseNL(s,{time:false}):{t:s,d:null};let t=nl.t,v=vRaw;
 if(!(num(v)>0)){
  const re=/(\d{1,3}(?:\.\d{3})+,\d{1,2}|\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d{1,2})?)/;
  let m=new RegExp('^(.*?)\\s+(?:r\\$\\s*)?'+re.source+'\\s*$','i').exec(t);
  if(m&&m[1].trim()){t=m[1].trim();v=m[2]}
  else if((m=new RegExp('^(?:r\\$\\s*)?'+re.source+'\\s+(.+)$','i').exec(t))&&m[2].trim()){v=m[1];t=m[2].trim()}
  else if((m=new RegExp('\\br\\$\\s*'+re.source+'\\b','i').exec(t))){const r=(t.slice(0,m.index)+' '+t.slice(m.index+m[0].length)).replace(/\s+/g,' ').trim();if(r){v=m[1];t=r}}
 }
 t=t.replace(/\s+(em|no|na|por|de|valor)\s*$/i,'').trim()||nl.t;
 return{t,v,d:nl.d,tg:normTags(tgs.join(', '))}}
function bal(a){let b=+a.ini||0;S.fin.tx.forEach(t=>{if(t.d>T)return;const ac=accId(t),v=+t.v||0;if(t.k==='in'&&ac===a.id)b+=v;else if(t.k==='out'&&ac===a.id)b-=v;else if(t.k==='tr'){if(ac===a.id)b-=v;if(t.to===a.id)b+=v}});return b}
function recurringAllowed(r,date){
 return (!r.ini||date>=r.ini)&&(!r.end||date<=r.end)&&!(r.skip||[]).includes(recurringId(r,date))&&!(r.pauses||[]).some(p=>date>=p.from&&date<=p.until);
}
function recurringId(r,date){return 'r_'+r.id+'_'+date.slice(0,7)}
function nextRecurringDate(r){
 let cursor=r.ini&&r.ini>T?r.ini:T;
 for(;;){
  const date=nextFixedDate(r.day,cursor);
  if(r.end&&date>r.end)return '';
  const pause=(r.pauses||[]).find(p=>date>=p.from&&date<=p.until);
  if(pause){if(pause.until==='9999-12-31')return '';cursor=ds(add(new Date(pause.until+'T12:00'),1));continue}
  if(recurringAllowed(r,date)&&!finInit().tx.some(t=>t.id===recurringId(r,date)))return date;
  cursor=ds(add(new Date(date+'T12:00'),1));
 }
}
function recurringChange(r,v){
 const proposed={...r};
 if(v.action==='skip'){
  const date=nextRecurringDate(r);
  if(!date||date.slice(0,7)!==T.slice(0,7))return null;
  proposed.skip=[...new Set([...(r.skip||[]),recurringId(r,date)])];
 }else if(v.action==='pause'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v.until||'')||v.until<T||!nextRecurringDate(r))return null;
  const id=T+'/'+v.until;
  proposed.pauses=[...(r.pauses||[]).filter(p=>p.id!==id),{id,from:T,until:v.until}];
 }else if(v.action==='end'){
  proposed.end=r.end&&r.end<T?r.end:ds(add(today,-1));
 }else return null;
 return proposed;
}
function recurringControls(r){
 const next=nextRecurringDate(r);
 if(!next)return '';
 return `<details class="fin-item-details"><summary>Gerenciar recorrência</summary>
 <form class="bar" data-rec-schedule="${esc(r.id)}">
 <label class="lb">Alteração<select class="in" name="action">${next.slice(0,7)===T.slice(0,7)?'<option value="skip">Pular este mês</option>':''}<option value="pause">Pausar até…</option><option value="end">Encerrar recorrência</option></select></label>
 <label class="lb" ${next.slice(0,7)===T.slice(0,7)?'hidden':''}>Pausar até<input class="in" type="date" name="until" min="${T}"></label>
 <output class="fin-live" aria-live="polite">${next.slice(0,7)===T.slice(0,7)?recurringImpact(r,{action:'skip'}):'Informe até quando pausar.'}</output>
 <button class="pill">Confirmar alteração</button></form></details>`;
}
function recurringImpact(r,v){
 const change=recurringChange(r,v);
 if(!change)return 'Informe um prazo válido para a pausa.';
 const next=nextRecurringDate(change);
 return next?'Próximo vencimento após a alteração: '+datePt(next)+'.':'Sem próximos vencimentos após a alteração.';
}
function previewRecurring(form){
 const r=finInit().rec.find(x=>x.id===form.dataset.recSchedule);
 if(!r)return;
 const v=Object.fromEntries(new FormData(form));
 form.elements.until.closest('label').hidden=v.action!=='pause';
 form.querySelector('output').textContent=recurringImpact(r,v);
}
function genRec0(){
 const F=finInit(),ids=new Set(F.tx.map(t=>t.id));let n=0;
 F.rec.forEach(r=>{const s=r.ini||T;let y=+s.slice(0,4),m=+s.slice(5,7)-1;if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||m<0||m>11)return;
  while(y<today.getFullYear()||(y===today.getFullYear()&&m<=today.getMonth())){const d=ds(new Date(y,m,Math.min(+r.day||1,dimOf(y,m))));
   if(d>T||(r.end&&d>r.end))break;
   if(d>=s){const id='r_'+r.id+'_'+d.slice(0,7);if(recurringAllowed(r,d)&&!ids.has(id)){F.tx.push({id,k:r.k,t:r.t,v:r.v,cat:r.cat,d,ac:r.ac,rc:r.id});ids.add(id);n++}}
   if(++m>11){m=0;y++}}});
 return n}
function recReminder(r){let y=today.getFullYear(),m=today.getMonth();if(r.day<today.getDate())m++;const d=ds(new Date(y,m,Math.min(r.day,dimOf(y,m)))),eid=uid();S.events.push({id:eid,t:'Conta: '+r.t,d,h:'09:00',e:'',r:'m',rm:'',c:'p',billDay:r.day,until:r.end||'',finRec:r.id,skip:r.skip||[],pauses:r.pauses||[]});finInit().bills.push({id:uid(),n:r.t,v:r.v,day:r.day,eid,rec:r.id,ac:r.ac,end:r.end||''})}
function recReminderUpdate(r){const b=finInit().bills.find(x=>x.rec===r.id);if(!b)return;Object.assign(b,{n:r.t,v:r.v,day:r.day,ac:r.ac,end:r.end||''});const e=S.events.find(x=>x.id===b.eid);if(e){const y=+e.d.slice(0,4),m=+e.d.slice(5,7)-1;e.t='Conta: '+r.t;e.billDay=r.day;e.until=r.end||'';e.finRec=r.id;e.skip=r.skip||[];e.pauses=r.pauses||[];e.d=ds(new Date(y,m,Math.min(r.day,dimOf(y,m))))}}
function sumAbated(list){
 const by={};let inc=0,out=0;
 list.forEach(t=>{const v=+t.v||0;if(t.k==='in')inc+=v;else if(t.k==='out'){const c=t.cat||'Outros';out+=v;by[c]=(by[c]||0)+v}});
 list.forEach(t=>{if(t.k==='in'&&t.rb){const c=t.rcat||'Outros',ab=Math.min(by[c]||0,t.v);if(ab>0){by[c]=r2(by[c]-ab);if(by[c]<=0)delete by[c];out=r2(out-ab);inc=r2(inc-ab)}}});
 return{inc,out,by};
}
const financeMonthDate=(offset=S.fmo)=>new Date(today.getFullYear(),today.getMonth()+offset,1);
function monthTransactions(period,account=S.fac){
 return finInit().tx.filter(t=>t.d.slice(0,7)===period&&(!account||accId(t)===account||t.to===account))
  .sort((a,b)=>a.d===b.d?0:a.d<b.d?1:-1);
}
function finMonth(o,all,account=S.fac){
 const f=financeMonthDate(o??S.fmo),p=ds(f).slice(0,7),tx=monthTransactions(p,all?'':account);
 return{f,p,tx,...sumAbated(tx)};
}
function series(n,base,all){const a=[];for(let i=n-1;i>=0;i--){const m=finMonth(base-i,all);a.push({f:m.f,inc:m.inc,out:m.out})}return a}
const cwid=w=>innerWidth>860?Math.round(w*1.5):w;
function barsSvg(a){
 const W=520,H=230,L=44,R=8,T0=12,B=30,pw=W-L-R,ph=H-T0-B,bals=a.map(x=>x.inc-x.out),hi=Math.max(1,...a.map(x=>Math.max(x.inc,x.out)),...bals),lo=Math.min(0,...bals),y=v=>T0+ph*(hi-v)/((hi-lo)||1),gw=pw/a.length,bw=Math.min(26,gw*.28);
 let g='';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 const bar=(x,v,c,t)=>`<rect x="${x}" y="${Math.min(y(v),y(0))}" width="${bw}" height="${Math.max(1,Math.abs(y(0)-y(v)))}" rx="3" fill="${c}"><title>${t}</title></rect>`;
 const bars=a.map((x,i)=>{const cx=L+gw*(i+.5),mn=MES[x.f.getMonth()];return bar(cx-bw-2,x.inc,'var(--s1)',mn+': receitas '+BRL(x.inc))+bar(cx+2,x.out,'var(--s2)',mn+': despesas '+BRL(x.out))+`<text x="${cx}" y="${H-10}" text-anchor="middle">${mn}</text>`}).join('');
 const pts=a.map((x,i)=>[L+gw*(i+.5),y(x.inc-x.out),x.fut]);
 return `<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas, despesas e saldo por mês: ${a.map(x=>MES[x.f.getMonth()]+' receitas '+BRL(x.inc)+', despesas '+BRL(x.out)).join('; ')}">${g}${bars}<polyline points="${pts.filter(p=>!p[2]).map(p=>p[0]+','+p[1]).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2.5"/>${pts.map((p,i)=>p[2]?'':`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--s1d)"><title>Saldo ${BRL(bals[i])}</title></circle>`).join('')}</svg>`}
function analysisExpenses(){
 const current=finMonth(),previous=finMonth(S.fmo-1),last=f=>dimOf(f.getFullYear(),f.getMonth());
 const count=S.fmo===0?today.getDate():S.fmo<0?last(current.f):0;
 const oldCount=S.fmo===0?Math.min(count,last(previous.f)):last(previous.f);
 const summarize=(m,days)=>sumAbated(m.tx.filter(t=>+t.d.slice(8)<=days));
 const now=summarize(current,count),before=summarize(previous,oldCount);
 const rows=[...new Set([...Object.keys(now.by),...Object.keys(before.by)])].filter(c=>now.by[c]||before.by[c])
  .map(c=>({c,v:now.by[c]||0,p:before.by[c]||0})).sort((a,b)=>b.v-a.v||b.p-a.p||a.c.localeCompare(b.c));
 const interval=(f,days)=>`1 a ${days} ${MES[f.getMonth()]} ${f.getFullYear()}`;
 return {current,now,before,rows,count,cut:count?ds(add(current.f,count-1)):'',
  currentLabel:count?interval(current.f,count):'',previousLabel:interval(previous.f,oldCount)};
}
function analysisDifference(current,previous){
 const change=r2(current-previous),amount=(change>0?'+':change<0?'−':'')+BRL(Math.abs(change));
 if(!(previous>0)||current<0)return `${amount} · sem base percentual`;
 const pct=Math.round(change/previous*100);
 return `${amount} (${PRIV?'percentual oculto':(pct>0?'+':'')+pct+'%'})`;
}
function analysisCategories(){
 const {now,before,rows,count,cut,currentLabel,previousLabel}=analysisExpenses();
 const header='<h2 id="finance-category-analysis" tabindex="-1">Despesas por categoria</h2>';
 if(!count)return header+'<p class="empty">O mês selecionado ainda não começou. Consulte as movimentações agendadas no extrato ou em Projeções.</p>';
 const selection=rows.find(r=>r.c===ANALYSIS_CAT),positive=rows.filter(r=>r.v>0),R=69,C=2*Math.PI*R;
 const diff=analysisDifference(now.out,before.out),signed=rows.some(r=>r.v<0);
 let start=0;
 const slices=positive.map(r=>{
  const i=rows.indexOf(r),len=r.v/now.out*C,offset=start;start+=len;
  return `<circle class="analysis-slice${selection&&r.c!==selection.c?' muted':''}" data-a="analysis-cat" data-id="${esc(r.c)}" cx="100" cy="100" r="${R}" fill="none" stroke="${PAL8[i%PAL8.length]}" stroke-width="26" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"><title>${esc(r.c)}: ${BRL(r.v)}</title></circle>`;
 }).join('');
 const chart=!signed&&positive.length&&now.out>0?`<svg class="fs analysis-donut" viewBox="0 0 200 200" role="img" aria-label="Despesas por categoria. As categorias também podem ser selecionadas na lista.">${slices}
  <text x="100" y="94" text-anchor="middle">${selection?esc(selection.c.length>22?selection.c.slice(0,21)+'…':selection.c):'Despesas realizadas'}</text>
  <text x="100" y="116" text-anchor="middle" class="analysis-donut-value">${BRL(selection?selection.v:now.out)}</text></svg>`:
  signed?'<p class="empty">Há despesas com valor negativo. Confira os totais na lista.</p>':'<p class="empty">Sem despesas realizadas neste período.</p>';
 return `${header}<p class="empty">${currentLabel} × ${previousLabel} · ${S.fac?esc(accName(S.fac)):'Todas as contas e cartões'}.</p>
 <div class="analysis-net"><div><small>Despesas líquidas</small><strong>${BRL(now.out)}</strong></div><div><small>Variação frente ao período anterior</small><strong>${diff}</strong></div></div>
 ${rows.length?`<div class="analysis-categories"><div>${chart}</div><div>
 <h3>Por categoria</h3>
 ${rows.map((r,i)=>`<button class="analysis-category-row item" data-a="analysis-cat" data-id="${esc(r.c)}" aria-pressed="${selection?.c===r.c}">
  <span class="analysis-dot" style="background:${PAL8[i%PAL8.length]}"></span>
  <span class="t">${esc(r.c)}<small>${analysisDifference(r.v,r.p)}</small></span><span class="analysis-value"><strong>${BRL(r.v)}</strong>${!signed&&now.out>0&&!PRIV?`<small>${Math.round(r.v/now.out*100)}% do total</small>`:''}</span></button>`).join('')}
 ${selection&&selection.v>0?`<button class="pill dark" data-a="analysis-extract" data-id="${esc(selection.c)}" data-cut="${cut}">Ver lançamentos de ${esc(selection.c)}</button>`:''}
 </div></div>`:'<p class="empty">Sem despesas nos dois períodos.</p>'}`;
}
function monthlyCommitments(month,account=S.fac){
 const F=finInit(),year=month.getFullYear(),m=month.getMonth(),period=ds(month).slice(0,7),last=dimOf(year,m);
 const date=day=>ds(new Date(year,m,Math.min(+day||1,last))),isScoped=ac=>!account||ac===account;
 const existing=new Set(F.tx.map(t=>t.id)),recurrences=new Set(F.rec.map(r=>r.id)),rows=[];
 for(const t of F.tx){
  if(t.k==='out'&&t.d>T&&t.d.slice(0,7)===period&&isScoped(accId(t))){
   rows.push({id:t.id,d:t.d,t:t.t,v:t.v,cat:t.cat||'Outros',ac:accId(t),kind:t.pc?'Parcela':t.rc?'Recorrência':'Despesa agendada',action:'finance-review-open'});
  }
 }
 for(const r of F.rec){
  const d=date(r.day),ac=r.ac||F.acc[0].id;
  if(r.k==='out'&&d>T&&isScoped(ac)&&recurringAllowed(r,d)&&!existing.has(recurringId(r,d))){
   rows.push({id:r.id,d,t:r.t,v:r.v,cat:r.cat||'Outros',ac,kind:'Recorrência',action:'att-open',target:'sub'});
  }
 }
 for(const b of F.bills){
  const d=date(b.day);
  if(d>=T&&isScoped(b.ac)&&billInRange(b,d)&&!recurrences.has(b.rec)){
   rows.push({id:b.id,d,t:b.n,v:b.v,cat:b.cat||'',ac:b.ac,kind:'Conta fixa',action:'att-open',target:'bill'});
  }
 }
 return rows.sort((a,b)=>a.d.localeCompare(b.d));
}
function commitmentLink(row,label){
 return `<button class="pill" data-a="${row.action}" data-id="${esc(row.id)}" ${row.target?'data-kind="'+row.target+'"':''}>${esc(label)}</button>`;
}
function commitmentsPanel(){
 const months=[0,1,2].map(i=>new Date(today.getFullYear(),today.getMonth()+i,1));
 return `<section class="panel wide" id="finance-commitments"><h2>Compromissos dos próximos meses</h2>
 <p class="empty">Despesas a partir de hoje, pelo mês do lançamento ou vencimento cadastrado. Compras no cartão entram pela data da parcela.</p>
 ${months.map(month=>{
  const rows=monthlyCommitments(month),total=r2(rows.reduce((n,r)=>n+r.v,0)),unlinked=rows.filter(r=>!r.ac).length,byKind={};
  rows.forEach(r=>{byKind[r.kind]=r2((byKind[r.kind]||0)+r.v)});
  return `<details class="fin-item-details" id="commitments-${ds(month).slice(0,7)}"><summary>${MES[month.getMonth()]} de ${month.getFullYear()} · ${BRL(total)}${unlinked?' · '+unlinked+' sem conta vinculada':''}</summary>
  ${rows.length?`<p class="empty">${Object.entries(byKind).map(([kind,value])=>esc(kind)+': '+BRL(value)).join(' · ')}</p>`:''}${rows.map(r=>`<div class="item"><div class="t"><strong>${esc(r.t)}</strong><small>${datePt(r.d)} · ${r.kind} · ${r.ac?esc(accName(r.ac)):'Sem conta de pagamento'}</small></div><strong>${BRL(r.v)}</strong>${commitmentLink(r,'Conferir')}</div>`).join('')||'<p class="empty">Sem compromissos cadastrados.</p>'}</details>`;
 }).join('')}</section>`;
}
function budgetSplit(month){
 const actual=sumAbated(month.tx.filter(t=>t.d<=T)).by,scheduled={};
 for(const row of monthlyCommitments(month.f))if(row.cat)scheduled[row.cat]=r2((scheduled[row.cat]||0)+row.v);
 return {actual,scheduled};
}
function gauge(c,spent,lim,exp,scheduled=0){
 const p=lim?spent/lim:0,col=p>=1?'var(--neg)':p>exp+.0001?'var(--yellow)':'var(--green)',ex=Math.min(1,Math.max(0,exp)),cx=Math.cos(Math.PI*ex),sx=Math.sin(Math.PI*ex);
 const remaining=r2(lim-spent),projected=r2(remaining-scheduled),st=p>1?'Limite excedido':p===1?'Limite atingido':p>exp?'Acima do ritmo':'Dentro do ritmo';
 return `<div><svg viewBox="0 0 100 60" style="width:100%;max-width:190px" role="img" aria-label="${esc(c)}: ${Math.round(p*100)}% do orçamento"><path d="M10 50A40 40 0 0 1 90 50" pathLength="100" fill="none" stroke="var(--panel)" stroke-width="9"/><path d="M10 50A40 40 0 0 1 90 50" pathLength="100" fill="none" stroke="${col}" stroke-width="9" stroke-dasharray="${Math.min(1,p)*100} 100"/><line x1="${50-33*cx}" y1="${50-33*sx}" x2="${50-47*cx}" y2="${50-47*sx}" stroke="var(--ink)" stroke-width="2"/><text x="50" y="49" text-anchor="middle" style="font-size:14px;font-weight:600;fill:var(--ink)">${Math.round(p*100)}%</text></svg><strong>${esc(c)}</strong><small style="display:block;color:var(--mute)">${BRL(spent)} gastos de ${BRL(lim)}</small><small class="${remaining<0?'neg':'pos'}">${remaining<0?'Excedeu em':'Restam'} ${BRL(Math.abs(remaining))}</small><small style="display:block;color:var(--mute)">ritmo esperado: ${BRL(lim*exp)}</small><small style="display:block">Agendado: ${BRL(scheduled)}</small><small class="${projected<0?'neg':'pos'}">${projected<0?'Excesso previsto:':'Restaria:'} ${BRL(Math.abs(projected))}</small><span class="chip ${p>=1?'c-p':p>exp?'c-y':'c-g'}" style="margin:var(--space-1) 0 0">${st}</span><button class="x" data-a="delbud" data-id="${esc(c)}" aria-label="Remover orçamento">×</button></div>`}
const catOpts=sel=>`<option value="">Categoria automática</option>${FC.map(c=>`<option ${sel===c?'selected':''}>${c}</option>`).join('')}`;
const accOpts=sel=>S.fin.acc.map(a=>`<option value="${a.id}" ${sel===a.id?'selected':''}>${esc(a.n)}</option>`).join('');
function accountEdit(a){const card=a.ty==='card';return `${!card?`<button class="pill" data-a="primaryacc" data-id="${esc(a.id)}" aria-pressed="${finInit().primary===a.id}">${finInit().primary===a.id?'Conta principal':'Definir como principal'}</button>`:''}<details id="fin-edit-account-${esc(a.id)}"><summary>Editar ${card?'cartão':'conta'}</summary><form class="bar" data-acc-edit="${esc(a.id)}"><label class="lb">Nome<input class="in" name="n" value="${esc(a.n)}" required></label>${card?`<label class="lb">Limite<input data-fin-private class="in" name="lim" type="number" min="0" step="0.01" value="${+a.lim||0}"></label><label class="lb">Fecha dia<input class="in" name="close" type="number" min="1" max="31" value="${+a.close||28}" required></label><label class="lb">Vence dia<input class="in" name="due" type="number" min="1" max="31" value="${+a.due||10}" required></label><p class="empty">Mudar as datas altera o cálculo das faturas. Se houver pagamentos associados, o dia de fechamento fica protegido.</p><p class="empty" data-account-impact aria-live="polite"></p><label><input type="checkbox" name="confirm"> Confirmei o impacto da alteração nas datas</label>`:''}<button class="pill">Salvar conta</button></form></details>`}
function accountImpact(f){const a=finInit().acc.find(x=>x.id===f.dataset.accEdit),el=f.querySelector('[data-account-impact]');if(!a||!el)return;const close=+f.elements.close.value,due=+f.elements.due.value;if(!Number.isInteger(close)||close<1||close>31||!Number.isInteger(due)||due<1||due>31){el.textContent='Informe dias entre 1 e 31 para ver a prévia.';return}const before=invoice(a),after=invoice({...a,close,due});el.textContent=`Fatura do mês selecionado: ${BRL(before.tot)} (vence ${fmt(before.due)}) → ${BRL(after.tot)} (vence ${fmt(after.due)}).`}
function accountRow(a,del){
 const balance=bal(a),needRec=Number.isFinite(a.stmtFin)&&Math.abs(balance-a.stmtFin)>=.01;
 return `<div class="item" data-lid="acc:${esc(a.id)}"><div class="t"><strong>${esc(a.n)}</strong>
 <small>${ACT[a.ty]||'Conta'}${needRec?' · Extrato: '+BRL(a.stmtFin):''}</small></div>
 <strong class="${balance<0?'neg':'pos'}">${BRL(balance)}</strong>
 ${needRec?`<button class="pill" data-a="reconcile-acc" data-id="${esc(a.id)}">Reconciliar com extrato</button>`:''}
 ${accountEdit(a)}${del('delacc',a.id,'Excluir conta')}</div>`;
}
function creditCardTile(a,del){
 const iv=invoice(a),used=Math.max(0,-bal(a)),limit=+a.lim||0;
 const projected=[0,1,2,3].map(k=>{
  const v=invoice(a,S.fmo+k),month=MES[+v.end.slice(5,7)-1];
  return `<div class="cc-pm${k===0?' cur':''}"><span>${month}</span><strong>${BRL(v.tot)}</strong></div>`;
 }).join('');
 return `<article class="cc-card" data-lid="acc:${esc(a.id)}">
 <div class="cc-head"><strong>${esc(a.n)}</strong><span>${iv.closed?'Fatura fechada':'Fatura aberta'}</span></div>
 <p class="cc-amount"><small>Fatura de ${MES[+iv.end.slice(5,7)-1]}</small><strong class="cc-val">${BRL(iv.tot)}</strong></p>
 <small>Fecha ${fmt(iv.end)} · Vence ${fmt(iv.due)}</small>
 ${iv.credit?`<small>Crédito de estorno anterior: ${BRL(iv.credit)}</small>`:''}
 <small>Pago ou agendado: ${BRL(iv.paid)} · Restante: ${BRL(iv.left)}</small>
 ${iv.legacy?'<p class="empty">Confira as transferências antigas sem vínculo.</p>':''}
 ${limit>0?`<small>Limite usado: ${BRL(used)} de ${BRL(limit)}</small><div class="fb ${bst(used/limit*100)}"><i style="width:${Math.min(100,used/limit*100)}%"></i></div>`:''}
 <details><summary>Faturas por mês de fechamento</summary><div class="cc-proj">${projected}</div></details>
 <div class="actions">${iv.left>0?`<button class="pill" data-a="payinv" data-id="${esc(a.id)}">Pagar fatura</button>`:''}${accountEdit(a)}${del('delacc',a.id,'Excluir cartão')}</div>
 ${invoiceLinkForm(a,iv)}</article>`;
}
function nextFixedDate(day,from=T){
 const [year,month]=from.split('-').map(Number);
 const thisMonth=ds(new Date(year,month-1,Math.min(+day||1,dimOf(year,month-1))));
 if(thisMonth>=from)return thisMonth;
 const next=new Date(year,month,1);
 return ds(new Date(next.getFullYear(),next.getMonth(),Math.min(+day||1,dimOf(next.getFullYear(),next.getMonth()))));
}
function billInRange(b,d){return (!b.ini||d>=b.ini)&&(!b.end||d<=b.end)}
function nextBillDate(b){return nextFixedDate(b.day,b.ini&&b.ini>T?b.ini:T)}
function billSchedule(b){
 const next=nextBillDate(b);
 return [billInRange(b,next)?'Próximo vencimento: '+fmt(next):'Sem próximo vencimento',b.end?'Repete até '+datePt(b.end):''].filter(Boolean).join(' · ');
}
function recurringEndLabel(r){
 if(!r.end)return '';
 const month=new Date(r.end.slice(0,7)+'-01T12:00');
 for(let i=0;i<=(r.skip||[]).length+1;i++){
  const m=new Date(month.getFullYear(),month.getMonth()-i,1);
  const date=ds(new Date(m.getFullYear(),m.getMonth(),Math.min(r.day,dimOf(m.getFullYear(),m.getMonth()))));
  if(date<r.ini)break;
  if(recurringAllowed(r,date))return ' · repete até '+datePt(r.end)+' · último vencimento '+datePt(date);
 }
 return ' · repete até '+datePt(r.end);
}
function datePt(d){return d.split('-').reverse().join('/')}
function repeatUntilField(end='',locked=false){
 return `<label class="lb">Repetir até<input class="in" type="date" name="end" value="${esc(end)}" ${locked?'disabled':''}><small>${locked?'Prazo definido na recorrência.':'Em branco: sem data de término.'}</small></label>`;
}
function installmentSchedule(first,cents,count){
 const share=Math.floor(cents/count);
 return Array.from({length:count},(_,i)=>({d:addM(first,i),v:(i===count-1?cents-share*(count-1):share)/100}));
}
const editableInstallment=t=>t.d>T&&!t.checked&&!t.statementKey;
function installmentAccount(t,date=t.d){
 const a=finInit().acc.find(a=>a.id===accId(t));
 if(a?.ty!=='card')return a?.n||'Conta não vinculada';
 const {payment}=simulatedCardCycle(date,a);
 return a.n+' · fatura com vencimento em '+datePt(payment);
}
function refundAvailable(t){
 const refunded=finInit().tx.filter(x=>x.refundOf===t.id).reduce((sum,x)=>sum+x.v,0);
 return Math.max(0,r2(t.v-refunded));
}
function installmentDetails(group){
 const future=group.filter(t=>t.d>T),cancelable=future.filter(editableInstallment),sum=items=>r2(items.reduce((n,t)=>n+t.v,0));
 return `<details class="fin-item-details" id="fin-parts-${esc(group[0].pc.g)}"><summary>Gerenciar parcelas</summary>
 <p>${future.length===1?'1 parcela futura':future.length+' parcelas futuras'} · <strong>${BRL(sum(future))} restantes</strong></p>
 ${group.map(t=>`<div class="item"><div class="t"><strong>Parcela ${t.pc.i}/${t.pc.n} · ${BRL(t.v)}</strong><small>${datePt(t.d)} · ${esc(installmentAccount(t))}</small>
 ${editableInstallment(t)?`<details id="fin-adjust-part-${esc(t.id)}"><summary>Ajustar parcela</summary><form class="bar" data-part-adjust="${esc(t.id)}">
 <label class="lb">Novo valor<input data-fin-private class="in" name="v" inputmode="decimal" value="${t.v.toFixed(2).replace('.',',')}" required></label>
 <label class="lb">Nova data<input class="in" type="date" name="d" value="${t.d}" min="${T}" required></label>
 <output class="fin-live" aria-live="polite"></output><button class="pill">Salvar ajuste</button></form></details>`:t.d<=T&&refundAvailable(t)>0?`<details id="fin-refund-part-${esc(t.id)}"><summary>Registrar estorno</summary><form class="bar" data-part-refund="${esc(t.id)}">
 <label class="lb">Valor do estorno<input data-fin-private class="in" name="v" inputmode="decimal" required></label>
 <label class="lb">Data do crédito<input class="in" type="date" name="d" value="${T}" min="${t.d}" max="${T}" required></label>
 <small>Até ${BRL(refundAvailable(t))} em ${esc(accName(accId(t)))}.</small>
 <output class="fin-live" aria-live="polite"></output><button class="pill">Registrar estorno</button></form></details>`:''}</div></div>`).join('')}
 ${cancelable.length?`<details><summary>Cancelar parcelas futuras</summary><form class="bar" data-part-cancel="${esc(group[0].pc.g)}"><p>${cancelable.length} parcelas serão removidas da previsão, liberando ${BRL(sum(cancelable))}. Parcelas registradas ou conferidas serão preservadas.</p>
 ${cancelable.map(t=>`<input type="hidden" name="part" value="${esc(t.id)}">`).join('')}
 <label><input type="checkbox" required> Confirmo o cancelamento</label><button class="pill">Confirmar cancelamento</button></form></details>`:''}</details>`;
}
function previewPart(form){
 const t=finInit().tx.find(x=>x.id===(form.dataset.partAdjust||form.dataset.partRefund));
 if(!t)return;
 const {v,d}=Object.fromEntries(new FormData(form)),amount=r2(num(v));
 const output=form.querySelector('output');
 if(!d||!(amount>0)){output.textContent='Informe valor e data para ver o impacto.';return}
 if(form.dataset.partRefund){output.textContent=amount>refundAvailable(t)?'O valor supera o saldo disponível para estorno.':'Crédito de '+BRL(amount)+' em '+installmentAccount(t,d)+'.';return}
 const delta=r2(amount-t.v);
 output.textContent='Novo vencimento: '+datePt(d)+' · '+installmentAccount(t,d)+' · '+(delta===0?'Valor total restante sem alteração.':(delta>0?'Aumenta ':'Reduz ')+BRL(Math.abs(delta))+' no total restante.');
}
function installmentPanel(){
 const F=finInit(),groups=new Map();
 for(const t of F.tx){
  if(t.k!=='out'||!t.pc||(S.fac&&accId(t)!==S.fac))continue;
  if(!groups.has(t.pc.g))groups.set(t.pc.g,[]);
  groups.get(t.pc.g).push(t);
 }
 const rows=[...groups.values()].map(group=>{
  group.sort((a,b)=>a.d.localeCompare(b.d));
  const first=group[0],next=group.find(t=>t.d>T),registered=group.filter(t=>t.d<=T).length;
  return {first,next,registered,group};
 }).sort((a,b)=>(a.next?.d||'9999').localeCompare(b.next?.d||'9999')||b.first.d.localeCompare(a.first.d));
 return `<section class="panel wide"><div class="top"><h2>Despesas parceladas</h2><button class="pill dark" data-a="fin-config-open" data-id="fin-installment-form">Parcelar despesa</button></div>
 ${rows.length?rows.slice(0,pgN('fin-installment-groups',20)).map(({first,next,registered,group})=>`<div class="item"><div class="t"><strong>${esc(first.t)}</strong><small>${registered} de ${first.pc.n} parcelas registradas · ${next?'Próxima em '+datePt(next.d):'Sem próximas parcelas'} · ${esc(accName(accId(next||first)))}</small>${installmentDetails(group)}</div>${next?`<strong>${BRL(next.v)}</strong><button class="pill" data-a="finance-review-open" data-id="${esc(next.id)}">Ver próxima parcela</button>`:`<button class="pill" data-a="finance-review-open" data-id="${esc(first.id)}">Ver lançamento</button>`}</div>`).join(''):'<p class="empty">Nenhuma despesa parcelada neste escopo.</p>'}
 ${pgMore('fin-installment-groups',rows.length,20)}
 <details id="fin-installment-form"><summary>Nova despesa parcelada</summary>
 <form id="fin-installment" class="bar">
 <label class="lb">Descrição<input class="in" name="t" required></label>
 <label class="lb">Valor total<input data-fin-private class="in" name="v" inputmode="decimal" required></label>
 <label class="lb">Parcelas<input class="in" name="pc" type="number" min="2" max="48" value="2" required></label>
 <label class="lb">Data da primeira parcela<input class="in" name="d" type="date" value="${T}" required></label>
 <label class="lb">Conta ou cartão<select class="in" name="ac">${accOpts(S.fac)}</select></label>
 <label class="lb">Categoria<select class="in" name="cat">${catOpts()}</select></label>
 <div class="fin-installment-summary"><output class="fin-installment-preview" aria-live="polite"></output><button class="pill dark">Salvar parcelamento</button></div>
 </form></details></section>`;
}
function installmentPlan(v){
 const cents=Math.round(num(v.v)*100),count=+v.pc;
 if(!Number.isSafeInteger(cents)||!Number.isInteger(count)||count<2||count>48||cents<count||!v.d)return [];
 return installmentSchedule(v.d,cents,count);
}
function previewInstallment(form){
 const v=Object.fromEntries(new FormData(form)),rows=installmentPlan(v),output=form.querySelector('output');
 output.innerHTML=rows.length?`<strong>Prévia das parcelas</strong><ol>${rows.map(row=>`<li>${datePt(row.d)} · ${BRL(row.v)}</li>`).join('')}</ol>`:v.v?'Confira o total, a data e a quantidade de parcelas.':'';
}
function finClearPanel(){
 const F=finInit(),hasTx=F.tx.length>0||F.acc.some(a=>(+a.ini||0)!==0);
 const hasAny=hasTx||F.acc.length>1||(F.acc[0]&&(F.acc[0].n!=='Conta principal'||F.acc[0].ty!=='cc'))||F.rec.length>0||F.rules.length>0||Object.keys(F.bud||{}).length>0||Object.keys(F.budHist||{}).length>0||F.goals.length>0||F.prules.length>0||F.split.length>0||F.bills.length>0||!!F.primary||((F.inv?.assets?.length||0)>0)||((F.inv?.divs?.length||0)>0);
 const pastYears={};const curY=today.getFullYear();(F.tx||[]).forEach(t=>{const y=+(t.d||'').slice(0,4);if(Number.isInteger(y)&&y>1900&&y<curY&&!(F.archives||[]).some(a=>a.year===y))pastYears[y]=(pastYears[y]||0)+1});
 const archHtml=(Object.keys(pastYears).length||(F.archives||[]).length)?`<div style="margin-top:var(--space-3);padding-top:var(--space-2);border-top:1px solid var(--line)"><h3 style="margin:0 0 var(--space-1)">Arquivamento anual</h3><p class="empty" style="padding:0 0 var(--space-2)">Consolida lançamentos de anos encerrados no saldo inicial das contas e guarda o histórico no IndexedDB/nuvem.</p><div class="bar">${Object.keys(pastYears).sort().reverse().map(y=>`<button class="pill" data-a="fin-archive" data-id="${y}">Arquivar ${y} (${pastYears[y]})</button>`).join('')}${(F.archives||[]).map(a=>`<button class="pill" data-a="fin-unarchive" data-id="${a.year}">Restaurar ${a.year} (${a.count})</button>`).join('')}</div></div>`:'';
 return `<div class="panel" data-fin-tools style="margin-top:var(--space-3)"><h2>Limpar dados das Finanças</h2><p class="empty" style="padding:0 0 var(--space-2)">Uma versão automática é salva em Backup antes de limpar, e você pode desfazer com Ctrl+Z logo em seguida.</p><div class="bar"><button class="pill${FCLEAR==='tx'?' dark':''}" data-a="fincleartx" ${hasTx?'':'disabled'}>${FCLEAR==='tx'?'Confirmar: limpar lançamentos':'Limpar lançamentos'}</button><button class="pill${FCLEAR==='all'?' dark':''}" data-a="finclearall" ${hasAny?'':'disabled'}>${FCLEAR==='all'?'Confirmar: zerar todas as Finanças':'Zerar todas as Finanças'}</button>${FCLEAR?'<button class="pill" data-a="finclearcancel">Cancelar</button>':''}</div>${archHtml}</div>`;
}
function filteredTx(tx){
 const q=norm(FQ.trim()),kd=S.fkd||'',fc=S.fcat||'';
 return tx.filter(t=>(!ANALYSIS_CUT||t.d<=ANALYSIS_CUT)&&(!FTAG||tagsU(t).includes(FTAG))&&(!FRECON||(FRECON==='checked'?!!t.checked:!t.checked))&&(!kd||t.k===kd)&&(!fc||(ANALYSIS_CUT?(t.k==='out'&&(t.cat||'Outros')===fc)||(t.k==='in'&&t.rb&&(t.rcat||'Outros')===fc):t.cat===fc))&&(!q||norm(t.t).includes(q)||norm(t.cat).includes(q)||norm(t.sub).includes(q)||norm(t.tg).includes(q)||norm(t.pj).includes(q)||norm(accName(accId(t))).includes(q)||fmt(t.d).includes(q)||String(t.v).includes(q)||String(t.v).replace('.',',').includes(q)));
}
function txListHtml(tx){
 const q=norm(FQ.trim()),kd=S.fkd||'',fc=S.fcat||'',hasF=!!(q||kd||fc||FRECON||FTAG||S.fac);
 const L=filteredTx(tx);
 let stxt='';
 if(hasF&&L.length){
  const sum=L.reduce((s,t)=>s+(t.k==='in'?t.v:t.k==='out'?-t.v:0),0),allOut=L.every(t=>t.k==='out'),allIn=L.every(t=>t.k==='in');
  stxt=ANALYSIS_CUT&&fc?`Despesas líquidas: <strong>${BRL(sumAbated(L).out)}</strong>`:allOut?'Total: <strong>'+BRL(L.reduce((s,t)=>s+t.v,0))+'</strong>':allIn?'Total: <strong class="pos">+ '+BRL(L.reduce((s,t)=>s+t.v,0))+'</strong>':L.length?'Saldo filtrado: <strong class="'+(sum<0?'neg':'pos')+'">'+BRL(sum)+'</strong>':'';
 }
 const bulkHtml=L.length?`<details data-tx-bulk style="margin-top:var(--space-2)"><summary class="pill" style="display:inline-block;cursor:pointer">Edição em lote (${L.length} ${L.length===1?'lançamento listado':'lançamentos listados'})</summary><form class="bar" id="ftxbulk" style="margin-top:var(--space-2)"><select class="in" name="cat" aria-label="Nova categoria em lote"><option value="">Manter categoria</option>${FC.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><input class="in" name="sub" list="subl" placeholder="Nova subcategoria (opcional)" aria-label="Nova subcategoria em lote"><input class="in" name="tg" list="alltags" placeholder="Adicionar etiqueta (opcional)" aria-label="Adicionar etiqueta em lote"><select class="in" name="ac" aria-label="Nova conta em lote"><option value="">Manter conta</option>${accOpts('')}</select><label><input type="checkbox" name="createRules" value="1"> Criar regras para as descrições</label><button class="pill dark" data-tx-bulk-submit data-label="Aplicar aos ${L.length} listados">Aplicar aos ${L.length} listados</button><button type="button" class="pill${TXBULKDEL?' dark':''}" data-a="txbulkdel">${TXBULKDEL?'Confirmar: excluir os '+L.length+' listados':'Excluir os '+L.length+' listados'}</button>${TXBULKDEL?'<button type="button" class="pill" data-a="txbulkcancel">Cancelar</button>':''}<div data-reserve-review tabindex="-1"></div></form></details>`:'';
 return (hasF?`<p class="empty" style="padding:0 0 var(--space-2)">Mostrando <strong>${L.length}</strong> de ${tx.length} lançamentos${stxt?' · '+stxt:''}${ANALYSIS_CUT?' · realizados até '+fmt(ANALYSIS_CUT):''}. <button class="pill" data-a="fclr">Limpar filtros</button></p>`:'')
 +(L.length?txTable(L.slice(0,pgN(FLK(),80))):emp('fin',hasF?'Nenhum lançamento combina com os filtros aplicados.':'Nenhum lançamento neste mês.',hasF?'Limpar filtros':'Novo lançamento',hasF?'data-a="fclr"':'data-a="tx-new"'))
 +pgMore(FLK(),L.length,80)+bulkHtml}
function txTable(rows){
 const days=new Map();
 for(const t of rows){
  if(!days.has(t.d))days.set(t.d,[]);
  days.get(t.d).push(t);
 }
 return `<table class="tx-table" aria-label="Extrato" role="table">
 <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Data</th><th scope="col" role="columnheader">Descrição</th><th scope="col" role="columnheader">Categoria</th><th scope="col" role="columnheader">Conta</th><th scope="col" role="columnheader">Valor</th><th scope="col" role="columnheader">Conferido</th><th scope="col" role="columnheader">Ações</th></tr></thead>
 ${[...days].map(([date,items])=>`<tbody role="rowgroup"><tr class="tx-day" role="row"><th colspan="7" scope="rowgroup">${fmt(date)}</th></tr>${items.map(t=>`<tr class="tx-row" role="row" data-tx-row="${esc(t.id)}">
  <td class="tx-date" role="cell"><time datetime="${esc(t.d)}">${fmt(t.d)}</time></td>
  <td class="tx-description" role="cell"><button class="tx-open" data-a="edtx" data-id="${esc(t.id)}" aria-label="Abrir detalhes de ${esc(t.t)}" ${FED===t.id?'aria-current="true"':''}>${esc(t.t)}</button>
  ${t.d>T||t.pc||t.rc||t.rb?`<small>${[t.d>T?'Agendado':'',t.pc?'Parcela '+t.pc.i+'/'+t.pc.n:'',t.rc?'Recorrente':'',t.rb?'Estorno de '+(t.rcat||'Outros'):''].filter(Boolean).map(esc).join(' · ')}</small>`:''}
  ${t.pj?`<small>${esc(t.pj)}</small>`:''}${tagChips(t)}</td>
  <td class="tx-category" role="cell">${esc(t.k==='tr'?'Transferência':t.cat||'Sem categoria')}${t.sub?' · '+esc(t.sub):''}</td>
  <td class="tx-account" role="cell">${esc(accName(accId(t)))}${t.k==='tr'?' → '+esc(accName(t.to)):''}</td>
  <td class="tx-amount" role="cell"><strong class="${t.k==='in'?'pos':t.k==='out'?'neg':''}">${t.k==='in'?'+':t.k==='out'?'−':''} ${BRL(t.v)}</strong></td>
  <td class="tx-checked" role="cell"><input type="checkbox" data-tx-checked="${esc(t.id)}" ${t.checked?'checked':''} aria-label="Conferido no banco: ${esc(t.t)}"></td>
  <td class="tx-actions" role="cell"><button class="x" data-a="deltx" data-id="${esc(t.id)}" aria-label="Excluir lançamento">×</button>${t.pc?`<button class="x" data-a="deltxg" data-id="${esc(t.pc.g)}" aria-label="Excluir todas as parcelas">⊗</button>`:''}</td>
 </tr>`).join('')}</tbody>`).join('')}</table>`;
}
function recurringInfo(r){const next=nextRecurringDate(r),F=finInit(),pause=(r.pauses||[]).filter(p=>p.from<=T&&p.until>=T&&(!r.end||r.end>=T)).map(p=>p.until).sort().pop();
 const last=F.tx.filter(t=>t.rc===r.id&&t.d<=T).sort((a,b)=>b.d.localeCompare(a.d))[0];return (pause?'Pausa até '+datePt(pause)+' · ':'')+(next?'Próxima: '+fmt(next):'Sem próxima cobrança')+(last&&+last.v!==+r.v?' · último lançamento '+BRL(last.v)+'; valor atual '+BRL(r.v):'')}
function installmentsPanel(){const F=finInit(),tx=F.tx.filter(t=>t.k==='out'&&t.pc&&t.d>T&&(!S.fac||accId(t)===S.fac)),groups={},months={};tx.forEach(t=>{(groups[t.pc.g]=groups[t.pc.g]||[]).push(t);const m=t.d.slice(0,7);months[m]=(months[m]||0)+t.v});const total=tx.reduce((s,t)=>s+t.v,0);return `<h2>Parcelas futuras</h2>${tx.length?`<p>Restam ${BRL(total)} em ${tx.length} parcelas agendadas.</p><details><summary>Ver por mês e compra</summary>${Object.keys(months).sort().map(m=>`<div class="item"><div class="t">${esc(m)}</div><strong>${BRL(months[m])}</strong></div>`).join('')}${Object.values(groups).map(g=>{g.sort((a,b)=>a.d.localeCompare(b.d));return `<div class="item"><div class="t">${esc(g[0].t)}<small>${g.length} parcelas restantes · última em ${fmt(g[g.length-1].d)}</small></div><strong>${BRL(g.reduce((s,t)=>s+t.v,0))}</strong></div>`}).join('')}</details>`:'<p class="empty">Nenhuma parcela futura agendada.</p>'}`}
function financeOverviewBalance(F,account,f,inc,out,realIn,realOut,alerts){
 const accounts=account?[account]:F.acc.filter(a=>a.ty!=='card'),balance=accounts.reduce((sum,a)=>sum+bal(a),0);
 const date=fmt(T)+' '+T.slice(0,4),period=MES[f.getMonth()]+' de '+f.getFullYear();
 const scope=account?esc(account.n):'Contas sem cartão';
 const metrics=[['Entradas realizadas',realIn,'pos'],['Saídas realizadas',realOut,'neg'],['Resultado realizado',realIn-realOut,realIn>=realOut?'pos':'neg']];
 return `<section class="panel finance-balance" aria-labelledby="finance-balance-title">
 <div class="finance-balance-main"><h2 id="finance-balance-title">${account?.ty==='card'?'Saldo do cartão':'Saldo atual'}</h2>
 <strong class="finance-balance-value ${balance<0?'neg':''}">${BRL(balance)}</strong><small>${scope} · ${date}</small></div>
 <div><h3>Resultado de ${esc(period)} <small>· ${account?scope:'Todas as contas e cartões'}</small></h3>
 <dl class="finance-metrics">${metrics.map(([label,value,cl])=>`<div><dt>${label}</dt><dd class="${cl}">${BRL(value)}</dd></div>`).join('')}</dl>
 <p class="finance-period-note">${S.fmo<0?'Até o fim do mês.':S.fmo>0?'O período ainda não começou.':'Até hoje no mês selecionado.'}
 ${inc!==realIn||out!==realOut?`O total inclui agendadas: ${BRL(inc)} em entradas e ${BRL(out)} em saídas.`:''}</p></div>
 ${alerts.length?`<div class="bar" role="alert"><strong>Atenção:</strong> ${alerts.map(([c,n])=>`<span class="chip ${n>=100?'c-p':'c-y'}">${esc(c)}: ${n}% do orçamento</span>`).join('')}</div>`:''}</section>`;
}
function overviewDues(account){
 const list=dues(30,true).filter(e=>e.k!=='in'&&(!account||e.ac===account.id||e.to===account.id));
 const labels={sched:'Despesa agendada',bill:'Conta fixa',card:'Saldo da fatura a pagar',payment:'Pagamento de fatura agendado'};
 const row=e=>{
  const link=e.txid?`data-a="finance-review-open" data-id="${esc(e.txid)}" data-keep-fin-scope`:
   e.rec||e.k==='bill'?`data-a="att-open" data-kind="${e.rec?'sub':'bill'}" data-id="${esc(e.rec||e.id)}"`:
   `data-a="overview-card" data-id="${esc(e.id)}" data-o="${e.o}"`;
  return `<div class="item"><div class="t"><button class="tx-open" ${link}>${esc(e.t)}</button>
   <small>${fmt(e.d)} · ${e.subscription?'Assinatura':labels[e.k]} · ${esc(e.account||'Conta não vinculada')}${e.installment?' · Parcela '+esc(e.installment):''}</small></div><strong>${BRL(e.v)}</strong></div>`;
 };
 return `<section class="panel finance-dues"><h2>Próximos vencimentos</h2>
 <p class="empty">Hoje e próximos 30 dias · ${account?esc(account.n):'Todas as contas e cartões'}.</p>
 ${list.slice(0,5).map(row).join('')||'<p>Nenhuma saída cadastrada para esse período.</p>'}
 ${list.length>5?`<details><summary>Ver mais ${list.length-5}</summary>${list.slice(5).map(row).join('')}</details>`:''}</section>`;
}
function overviewCategories(tx){
 const {by,out}=sumAbated(tx),items=Object.entries(by).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,4);
 return `<section class="panel"><div class="top"><h2>Principais categorias</h2><button class="pill" data-a="overview-analysis">Ver análises</button></div>
 <p class="empty">Despesas realizadas no mês selecionado.</p>${items.map(([c,v])=>`<div class="item"><div class="t"><button class="tx-open" data-a="overview-category" data-id="${esc(c)}">${esc(c)}</button>${out>0?`<small>${Math.round(v/out*100)}% das despesas realizadas</small>`:''}</div><strong>${BRL(v)}</strong></div>`).join('')||'<p>Nenhuma despesa realizada neste mês.</p>'}</section>`;
}
function recentTxPanel(tx){
 const list=[...tx].sort((a,b)=>(b.d||'').localeCompare(a.d||'')).slice(0,6);
 return `<div class="panel"><div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Últimos lançamentos</h2><button class="pill" data-a="overview-category">Ver todos</button></div>${list.map(t=>`<div class="item"><div class="t"><button class="tx-open" data-a="finance-review-open" data-id="${esc(t.id)}" data-keep-fin-scope>${esc(t.t)}</button><small>${fmt(t.d)}${t.cat?' · '+esc(t.cat):''} · ${esc(accName(accId(t)))}</small></div><strong class="${t.k==='in'?'pos':t.k==='out'?'neg':''}">${t.k==='in'?'+':t.k==='out'?'−':''}${BRL(t.v)}</strong></div>`).join('')||'<p class="empty">Nenhum lançamento neste mês ainda.</p>'}</div>`;
}
function financeReviewState(){
 const s=readLocalDraft(localDraftKey('finance-review'));
 return s&&typeof s==='object'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month)&&typeof s.account==='string'&&typeof s.cursor==='string'?s:null;
}
function financeReviewRows(state){return monthTransactions(state.month,state.account).filter(t=>!t.checked&&t.d<=T).sort((a,b)=>a.d.localeCompare(b.d)||String(a.id).localeCompare(String(b.id)))}
function financeReviewSignature(t){return JSON.stringify([t.id,t.t,t.v,t.d,t.ac,t.to,t.cat,t.checked])}
function financeReviewStart(month,account){
 const prior=financeReviewState(),state=prior&&prior.month===month&&prior.account===account?{...prior,paused:false}:{month,account,cursor:'',paused:false};
 writeLocalDraft(localDraftKey('finance-review'),state);
}
function financeReviewSessionPanel(period){
 const state=financeReviewState();
 if(!state||state.month!==period||state.account!==(S.fac||''))return '';
 const rows=financeReviewRows(state),t=rows.find(t=>t.id===state.cursor)||rows[0];
 const notice=localDraftFallback.has(localDraftKey('finance-review'))?'<p role="status">Não foi possível salvar a posição neste navegador. Ela será mantida somente enquanto esta página estiver aberta.</p>':'';
 const title=notice+'<h3>Conferência de '+esc(MES[+state.month.slice(5)-1]+' de '+state.month.slice(0,4))+' · '+esc(state.account?accName(state.account):'Todas as contas')+'</h3>';
 if(state.paused)return '<section data-finance-review-session>'+title+'<p>Conferência pausada neste aparelho.</p><button class="pill" data-a="finance-review-start">Retomar conferência</button></section>';
 if(!t)return '<section data-finance-review-session>'+title+'<p role="status">Nenhum lançamento não conferido até hoje neste escopo.</p><button class="pill" data-a="finance-review-end">Encerrar conferência</button></section>';
 return '<section data-finance-review-session>'+title+'<p>'+rows.length+(rows.length===1?' lançamento a conferir até hoje.':' lançamentos a conferir até hoje.')+' Os valores já fazem parte do saldo. Busca, categoria e tipo não limitam esta conferência.</p><article class="panel"><h4 data-priv-text>'+esc(t.t)+'</h4><p>'+fmt(t.d)+' · '+esc(accName(accId(t)))+' · '+esc(t.cat||'Sem categoria')+' · '+BRL(t.v)+'</p><div class="bar"><button class="pill dark" data-a="finance-review-check" data-id="'+esc(t.id)+'" data-signature="'+esc(financeReviewSignature(t))+'">Conferido, próximo</button><button class="pill" data-a="finance-review-skip" data-id="'+esc(t.id)+'">Ver depois</button><button class="pill" data-a="finance-review-open" data-id="'+esc(t.id)+'" data-keep-fin-scope>Abrir lançamento</button><button class="pill" data-a="finance-review-pause">Pausar conferência</button></div></article></section>';
}
function financeReviewStep(id,signature,check){
 const state=financeReviewState();if(!state||state.paused)return;
 const rows=financeReviewRows(state),current=rows.find(t=>t.id===state.cursor)||rows[0];
 if(!current||current.id!==id||check&&financeReviewSignature(current)!==signature){toast('O lançamento mudou. Confira os dados atualizados.');render();return}
 if(check){const previous=current.checked;current.checked=true;if(!save()){current.checked=previous;toast('Não foi possível salvar a conferência.');render({save:false});return}}
 const next=rows[(rows.indexOf(current)+1)%rows.length];
 writeLocalDraft(localDraftKey('finance-review'),{...state,cursor:next?.id||''});render();
}
function financasMes(tab){
 const F=finInit();genRec();if(FED&&!F.tx.some(t=>t.id===FED))FED=null;if(RED&&!F.rec.some(r=>r.id===RED))RED=null;if(BED&&!F.bills.some(b=>b.id===BED))BED=null;
 tab=FTABS.some(x=>x[0]===tab)?tab:(FTABS.some(x=>x[0]===S.ftab)?S.ftab:'lanc');
 const f=financeMonthDate(),period=ds(f).slice(0,7),e=FED?F.tx.find(t=>t.id===FED):null,k0=e?e.k:'out';
 const tx=['geral','lanc','orc'].includes(tab)?monthTransactions(period):[];
 const selA=S.fac?F.acc.find(a=>a.id===S.fac):null;
 const del=(a,id,l)=>`<button class="x" data-a="${a}" data-id="${esc(id)}" aria-label="${l}">×</button>`;
 const head=`<div class="top${tab==='lanc'?' tx-heading':''}"><div><span class="crumb">MEU HUB / FINANÇAS</span><h1>${tab==='lanc'?'Lançamentos':`Finanças<span class="sub-ed">${FTABS.find(([id])=>id===tab)[1]}</span>`}</h1></div><div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap">${vwToggle()}${tab==='lanc'?'':`<select class="in" data-fac="1" aria-label="Filtrar por conta"><option value="">Todas as contas</option>${accOpts(S.fac)}</select>`}<span style="display:inline-flex;gap:var(--space-2);align-items:center"><button class="pill" data-a="fmn" data-n="-1" aria-label="Mês anterior">‹</button><strong>${MES[f.getMonth()]} ${f.getFullYear()}</strong><button class="pill" data-a="fmn" data-n="1" aria-label="Próximo mês">›</button></span><button class="pill${S.fmo===0?' current-month':''}" data-a="fmn" data-n="0">Este mês</button></div></div>`;
 let monthlySummary='';
 const formHtml=(tab==='geral'||tab==='lanc'||!!e)?`<form class="bar k${k0}${e?' advo':''}" id="ffin" style="margin-top:var(--space-3)"><select class="in" name="k" aria-label="Tipo"><option value="out" ${k0==='out'?'selected':''}>Despesa</option><option value="in" ${k0==='in'?'selected':''}>Receita</option><option value="tr" ${k0==='tr'?'selected':''}>Transferência</option></select><label class="lb capture-label grow">Descrição<input class="in grow" name="t" placeholder="Descrição (ex.: mercado 85,90 ontem)" value="${e?esc(e.t):''}" required></label><label class="lb capture-label">Valor<input data-fin-private class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor" value="${e?e.v:''}" style="width:120px"></label><select class="in" name="cat" aria-label="Categoria">${catOpts(e&&e.cat)}</select>${F.acc.length>1?`<select class="in" name="ac" aria-label="Conta ou cartão">${accOpts(e&&accId(e))}</select>`:''}<span class="adv"><input class="in" type="date" name="d" value="${e?e.d:T}" required aria-label="Data">${F.acc.length>1?'':`<select class="in" name="ac" aria-label="Conta ou cartão">${accOpts(e&&accId(e))}</select>`}<select class="in f-to" name="to" aria-label="Conta de destino">${accOpts(e&&e.to)}</select><input class="in" name="sub" list="subl" placeholder="Subcategoria" value="${e?esc(e.sub||''):''}" aria-label="Subcategoria">${subList()}<input class="in" name="tg" list="alltags" placeholder="Etiquetas" value="${e?esc(e.tg||''):''}" aria-label="Etiquetas"><input class="in" name="pj" list="pjl" placeholder="Projeto (opcional)" value="${e?esc(e.pj||''):''}" aria-label="Projeto">${pjList()}<input class="in f-pc" name="pc" type="number" min="1" value="1" title="Parcelas" aria-label="Parcelas" style="width:90px" ${e?'disabled':''}>${e?'<label class="lb" style="margin:0"><input type="checkbox" name="applySame" value="1"> Aplicar aos demais com mesma descrição e criar regra</label>':''}</span><button class="pill dark">${e?'Salvar alterações':'Lançar'}</button><button type="button" class="pill" data-a="adv">${e?'Menos opções':'Mais opções'}</button>${e?'<button type="button" class="pill" data-a="fcancel">Cancelar</button>':''}</form>`:'';
 const tabsHtml=`<div class="bar ftabs" role="group" aria-label="Seções das Finanças">${FTABS.map(x=>`<button class="pill ${x[0]===tab?'on':''}" aria-pressed="${x[0]===tab}" data-a="ftab" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>`;
 let body='';
 if(tab==='geral'){
  const {inc,out,by}=sumAbated(tx),realized=tx.filter(t=>t.d<=T),{inc:realIn,out:realOut}=sumAbated(realized);
  monthlySummary=financeOverviewBalance(F,selA,f,inc,out,realIn,realOut,finAlerts(by,period));
  body=`<div class="finance-overview wide">${overviewDues(selA)}${monthCashPanel(f,selA)}</div>
  ${commitmentsPanel()}
  ${recentTxPanel(realized)}
  ${overviewCategories(realized)}
  ${summaryPanel()}${nextIncomePanel()}`;
 }else if(tab==='inv'){
  body=invPanel();
 }else if(tab==='analise'){
  const lc=lineChart(),ser=series(S.fn,S.fmo);
  body=`<nav class="bar wide analysis-jump" aria-label="Seções de Análises"><a class="pill" href="#finance-category-analysis">Categorias</a><a class="pill" href="#finance-evolution">Evolução</a><a class="pill" href="#finance-projections">Projeções</a></nav>
  <section class="panel wide">${analysisCategories()}</section>
  <section class="analysis-group wide" aria-labelledby="finance-evolution"><h2 id="finance-evolution">Evolução</h2><div class="cards">
    <div class="panel"><div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Receitas e despesas mês a mês</h2><span class="actions">${[6,12].map(n=>`<button class="pill ${S.fn===n?'on':''}" data-a="fn" data-id="${n}">${n} meses</button>`).join(' ')}</span></div>${barsSvg(ser)}<div class="bar" style="margin:var(--space-2) 0 0;font-size:var(--type-small)"><span><i class="lg" style="background:var(--s1)"></i>Receitas</span><span><i class="lg" style="background:var(--s2)"></i>Despesas</span><span><i class="lg" style="background:var(--ink)"></i>Saldo do mês</span></div></div>
  <div class="panel">${waterPanel()}</div>
  <div class="panel wide">${yoyPanel()}</div>
  <div class="panel">${evoPanel()}</div><div class="panel">${heatPanel()}</div>
  <div class="panel"><h2>Calendário financeiro</h2>${calPanel()}</div><div class="panel">${merchantsPanel()}</div>
  <div class="panel c4">${subPanel()}</div><div class="panel c2">${projPanel()}</div></div></section>
  <section class="analysis-group wide" aria-labelledby="finance-projections"><h2 id="finance-projections">Projeções</h2><div class="cards">
    <div class="panel wide"><div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">${S.flm==='sal'?'Saldo acumulado e projeção':'Resultado acumulado e projeção'}</h2><span style="display:flex;gap:var(--space-2)">${[['res','Resultado'],['sal','Saldo']].map(x=>`<button class="pill ${(S.flm||'res')===x[0]?'on':''}" data-a="flm" data-id="${x[0]}">${x[1]}</button>`).join('')}</span></div>${lc.svg}<div class="bar" style="margin:var(--space-2) 0 0;font-size:var(--type-small)"><span><i class="lg" style="background:var(--s1)"></i>Realizado</span><span><i class="lg" style="background:${lc.end<0?'var(--neg)':'var(--s1d)'}"></i>Projeção</span></div><p class="empty" style="padding:var(--space-1) 0 0">${S.fmo>0?'Mês futuro: considera só lançamentos e recorrências agendados. ':''}${S.flm==='sal'?'Saldo':'Resultado'} até agora: <strong class="${lc.now<0?'neg':'pos'}">${BRL(lc.now)}</strong>${lc.proj?` · projeção para o fim do mês: <strong class="${lc.end<0?'neg':'pos'}">${BRL(lc.end)}</strong>. Inclui parcelas e recorrências ainda por vir${lc.avg?` e a média dos gastos variáveis (${BRL(lc.avg)} por dia)`:''}.`:'.'}</p></div>
  <div class="panel wide" id="cash-flow-panel">${cashPanel()}</div></div></section>`;
 }else if(tab==='lanc'){
  const scope=[selA?.n,{out:'Despesas',in:'Receitas',tr:'Transferências'}[S.fkd],S.fcat,{pending:'Não conferidos',checked:'Conferidos'}[FRECON],FTAG?'#'+FTAG:''].filter(Boolean);
  body=`<div class="tx-workspace wide"><section class="panel tx-ledger"><div class="top" style="margin:0 0 var(--space-2)"><h2 id="tx-list-heading" tabindex="-1" style="margin:0">Extrato</h2><span class="actions tx-types">${[['','Todos'],['out','Despesas'],['in','Receitas'],['tr','Transferências']].map(x=>`<button class="pill ${(S.fkd||'')===x[0]?'on':''}" data-a="fkd" data-id="${x[0]}" aria-pressed="${(S.fkd||'')===x[0]}">${x[1]}</button>`).join('')}</span></div><div class="tx-search"><input class="in grow" id="fq" placeholder="Buscar nos lançamentos" value="${esc(FQ)}" aria-label="Buscar nos lançamentos"></div>
 <div class="tx-tools">${e?'':`<details id="tx-new"><summary class="pill dark">Novo lançamento</summary>${formHtml}<button class="pill" data-a="new-fin-rec">Cadastrar recorrência</button></details>`}<details class="tx-filters" id="tx-filters"><summary class="pill">Filtros</summary><div class="bar tx-filter-fields"><label class="lb">Conta<select class="in" data-fac="1" aria-label="Filtrar por conta"><option value="">Todas as contas</option>${accOpts(S.fac)}</select></label><label class="lb tx-type-select">Tipo<select class="in" data-fin-kind aria-label="Filtrar por tipo">${[['','Todos os tipos'],['out','Despesas'],['in','Receitas'],['tr','Transferências']].map(([k,label])=>`<option value="${k}" ${(S.fkd||'')===k?'selected':''}>${label}</option>`).join('')}</select></label><label class="lb">Categoria<select class="in" data-fcat="1" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>${FC.map(c=>`<option value="${c}" ${S.fcat===c?'selected':''}>${c}</option>`).join('')}</select></label><label class="lb">Conferência<select class="in" data-reconcile-filter aria-label="Conferência"><option value="">Todos os lançamentos</option><option value="pending" ${FRECON==='pending'?'selected':''}>Não conferidos</option><option value="checked" ${FRECON==='checked'?'selected':''}>Conferidos</option></select></label><label class="lb">Etiqueta<select class="in" data-fin-tag><option value="">Todas as etiquetas</option>${[...new Set(tx.flatMap(tagsU))].sort().map(tag=>`<option value="${esc(tag)}" ${tag===FTAG?'selected':''}>${esc(tag)}</option>`).join('')}</select></label></div><button class="pill" data-a="finance-review-start">Conferir este mês</button></details></div>
 ${scope.length?`<p class="tx-active-scope" data-tx-scope>${esc(scope.join(" · "))}</p>`:''}
 ${financeReviewSessionPanel(period)}<div id="txlist">${txListHtml(tx)}</div></section>
 ${e?`<aside class="panel tx-detail" data-tx-detail="${esc(e.id)}" aria-labelledby="tx-detail-title"><div class="top" style="margin:0 0 var(--space-2)"><h2 tabindex="-1" id="tx-detail-title">Detalhes do lançamento</h2><button class="pill" data-a="fcancel">Voltar ao extrato</button></div><p>${esc(e.t)} · ${fmt(e.d)}</p>${formHtml}</aside>`:''}</div>
  <div class="panel">${installmentsPanel()}</div>
  <div class="panel">${splitPanel()}</div>`;
 }else if(tab==='orc'){
  const {actual,scheduled}=budgetSplit({f,tx}),closing=closingProjection(F);
  const dim=dimOf(f.getFullYear(),f.getMonth()),exp=S.fmo<0?1:S.fmo>0?0:today.getDate()/dim;
  body=`<div class="panel wide"><div class="top"><h2>Orçamentos</h2><button class="pill" data-a="fin-config-open" data-id="fin-budget-form">Definir limite</button></div><p class="empty">Gastos registrados e despesas agendadas do mês. Contas fixas sem categoria ficam fora dos limites por categoria.</p><div class="gg">${Object.entries(budgetsAt(ds(f).slice(0,7))).sort(([a,x],[b,y])=>((actual[b]||0)+(scheduled[b]||0))/y-((actual[a]||0)+(scheduled[a]||0))/x).map(([c,l])=>gauge(c,actual[c]||0,l,exp,scheduled[c]||0)).join('')||'<p class="empty">Defina um limite mensal por categoria. O medidor mostra quanto você gastou e a marca preta indica onde deveria estar hoje.</p>'}</div></div>
  <div class="panel"><h2>Metas de economia</h2>${F.goals.filter(g=>!g.res).map(g=>{const saved=closingGoalBalance(g,closing),p=Math.min(100,Math.round(saved/(g.target||1)*100));return `<div class="item"><div class="t">${esc(g.n)}<small>${BRL(saved)} de ${BRL(g.target)} (${p}%)</small>${glink(g)}<div class="fb" style="margin-top:var(--space-2)"><i style="width:${p}%"></i></div></div><input data-fin-private class="in" data-gdep="${g.id}" type="number" step="any" placeholder="+ depositar" aria-label="Depositar" style="width:140px">${del('delgoal',g.id,'Excluir meta')}</div>`}).join('')||'<p class="empty">Crie uma meta, como viagem ou reserva de emergência.</p>'}<details id="fin-goal-form"><summary>Criar meta de economia</summary><form class="bar" id="fgoal" style="margin:var(--space-2) 0 0"><input class="in grow" name="n" placeholder="Nome da meta" required><input data-fin-private class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor alvo" required style="width:120px"><button class="pill">Criar</button></form></details></div>
  <div class="panel">${reservaPanel(closing)}</div>
  <div class="panel">${closingPanel(closing)}</div>
  <div class="panel">${prPanel()}</div>
  <details class="panel wide" id="fin-budget-form"><summary>Configurar limites mensais</summary><form class="bar" id="fbud" style="margin:var(--space-3) 0 0"><select class="in" name="cat" aria-label="Categoria">${opts(FC)}</select><input data-fin-private class="in grow" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Limite mensal" required><label class="lb">Válido a partir de<input class="in" type="month" name="month" value="${ds(f).slice(0,7)}" required></label><span class="empty" data-budget-preview aria-live="polite"></span><button class="pill">Definir orçamento</button></form><div class="bar" style="margin:var(--space-2) 0 0"><button type="button" class="pill" data-a="budsuggest">Preencher com a média histórica</button></div><p class="empty">O valor vale a partir do mês escolhido e preserva os limites anteriores.</p></details>`;
 }else if(tab==='contas'){
  const er=RED?F.rec.find(r=>r.id===RED):null,eb=BED?F.bills.find(b=>b.id===BED):null;
  const subscriptions=F.rec.filter(r=>r.k==='out'&&r.cat==='Assinaturas'&&(!r.ini||r.ini<=T)&&(!r.end||r.end>=T));
  const subscriptionIds=new Set(subscriptions.map(r=>r.id)),monthly=subscriptions.reduce((sum,r)=>sum+(+r.v||0),0);
  const editedBillRec=eb&&F.rec.find(r=>r.id===eb.rec);
  const fixedBills=F.bills.map(b=>{const linked=F.rec.find(r=>r.id===b.rec);return linked?{...b,end:linked.end||''}:b});
  const bills=fixedBills.reduce((a,b)=>a+(billInRange(b,nextBillDate(b))?(+b.v||0):0),0);
  const accounts=F.acc.filter(a=>a.ty!=='card'),cards=F.acc.filter(a=>a.ty==='card');
  body=`<section class="panel wide" id="fin-accounts"><div class="top"><h2>Saldos das contas</h2><button class="pill" data-a="fin-config-open" data-id="fin-account-form">Cadastrar conta ou cartão</button></div>
  <p>Saldo registrado até hoje: <strong>${BRL(accounts.reduce((sum,a)=>sum+bal(a),0))}</strong></p>
  ${accounts.map(a=>accountRow(a,del)).join('')||'<p class="empty">Nenhuma conta cadastrada.</p>'}</section>
  <div class="wide fin-card-workspace${cards.length<=1?' fin-card-workspace-compact':''}">
  <section class="panel" id="fin-cards"><h2>Cartões e faturas</h2>
  ${cards.length?`<div class="cc-grid">${cards.map(a=>creditCardTile(a,del)).join('')}</div>`:'<p class="empty">Nenhum cartão cadastrado.</p>'}
  </section>
  ${overviewDues(null)}</div>
  <section class="panel" id="fin-recurring"><h2>Lançamentos recorrentes</h2>${subscriptions.length?`<p class="empty">Assinaturas ativas: <strong>${subscriptions.length}</strong> · ${BRL(monthly)} por mês · ${BRL(monthly*12)} por ano no ritmo atual.</p>`:''}${F.rec.map(r=>{const al=recPriceAlert(r);return `<div class="item"><div class="t">${esc(r.t)}${al?` <span class="chip ${al.diff>0?'c-p':'c-g'}">${al.diff>0?'subiu +':'caiu −'}${BRL(Math.abs(al.diff))}</span>`:''}<small>${r.k==='in'?'Receita':subscriptionIds.has(r.id)?'Assinatura ativa':'Despesa'} · dia ${r.day} de cada mês · ${esc(accName(r.ac||F.acc[0].id))}${recurringEndLabel(r)} · ${recurringInfo(r)}</small>${recurringControls(r)}</div><strong class="${r.k==='in'?'pos':'neg'}">${BRL(r.v)}</strong>${al?`<button class="pill" data-a="rec-upd-val" data-id="${esc(r.id)}">Atualizar para ${BRL(al.last.v)}</button>`:''}${subscriptionIds.has(r.id)?`<button class="pill" data-a="sub-review" data-id="${esc(r.id)}">${r.review?'Concluir revisão':'Marcar para revisão'}</button>${r.review?`<button class="pill" data-a="sub-task" data-id="${esc(r.id)}">Criar tarefa</button>`:''}`:''}<button class="x" data-a="edrec" data-id="${r.id}" aria-label="Editar recorrência">✎</button>${del('delrec',r.id,'Excluir recorrência')}</div>`}).join('')||'<p class="empty">Salário, aluguel, assinaturas: cadastre uma vez e o lançamento aparece sozinho todo mês.</p>'}${detectedRecPanel()}<details id="fin-rec-form" ${er?'open':''}><summary>${er?'Editar recorrência':'Cadastrar recorrência'}</summary><form class="bar" id="frec" style="margin:var(--space-2) 0 0"><select class="in" name="k" aria-label="Tipo"><option value="out" ${!er||er.k==='out'?'selected':''}>Despesa</option><option value="in" ${er&&er.k==='in'?'selected':''}>Receita</option></select><input class="in grow" name="t" placeholder="Descrição" value="${er?esc(er.t):''}" required><input data-fin-private class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor" value="${er?er.v:''}" required style="width:110px"><select class="in" name="cat" aria-label="Categoria">${catOpts(er&&er.cat)}</select><select class="in" name="ac" aria-label="Conta">${accOpts(er&&(er.ac||F.acc[0].id))}</select><label class="lb">Dia do vencimento<input class="in" name="day" type="number" min="1" max="31" value="${er?er.day:''}" required style="width:80px"></label>${repeatUntilField(er?.end)}${!er?'<label><input type="checkbox" name="reminder" value="1"> Criar lembrete mensal na agenda (despesas)</label>':''}<button class="pill${er?' dark':''}">${er?'Salvar recorrência':'Criar'}</button>${er?'<button type="button" class="pill" data-a="reccancel">Cancelar</button>':''}</form></details></section>
  <section class="panel" id="fin-fixed"><h2>Contas fixas</h2>${fixedBills.map(b=>`<div class="item"><div class="t">${esc(b.n)}<small>${billSchedule(b)} · ${b.ac?esc(accName(b.ac)):'sem conta de pagamento'}</small></div><strong>${BRL(b.v)}</strong><button class="x" data-a="edbill" data-id="${b.id}" aria-label="Editar conta">✎</button>${del('delbill',b.id,'Excluir conta')}</div>`).join('')||'<p class="empty">Cadastre contas que se repetem. Elas entram na agenda todo mês.</p>'}${F.bills.length?`<p class="empty" style="margin:0 0 var(--space-2)">Total fixo: ${BRL(bills)} por mês. Estes lembretes podem ser independentes ou ligados a uma recorrência.</p>`:''}<details id="fin-bill-form" ${eb?'open':''}><summary>${eb?'Editar conta fixa':'Cadastrar conta fixa'}</summary><form class="bar" id="fbill" style="margin:var(--space-2) 0 0"><input class="in grow" name="n" placeholder="Nome" value="${eb?esc(eb.n):''}" required><input data-fin-private class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor" value="${eb?eb.v:''}" required style="width:110px"><label class="lb">Dia do vencimento<input class="in" name="day" type="number" min="1" max="31" value="${eb?eb.day:''}" required style="width:80px"></label>${repeatUntilField(editedBillRec?editedBillRec.end:eb?.end,!!editedBillRec)}<label class="lb">Conta de pagamento<select class="in" name="ac" ${eb&&eb.rec?'disabled':''}><option value="">Sem conta vinculada</option>${F.acc.filter(a=>a.ty!=='card').map(a=>`<option value="${esc(a.id)}" ${eb&&eb.ac===a.id?'selected':''}>${esc(a.n)}</option>`).join('')}</select></label>${eb&&eb.rec?'<small class="empty">Conta definida pela recorrência; edite-a em Lançamentos recorrentes.</small>':''}<button class="pill${eb?' dark':''}">${eb?'Salvar conta':'Adicionar'}</button>${eb?'<button type="button" class="pill" data-a="billcancel">Cancelar</button>':''}</form></details></section>
  ${installmentPanel()}
  <details class="panel wide" id="fin-account-form"><summary>Cadastrar conta ou cartão</summary><form class="bar" id="facc" style="margin:var(--space-2) 0 0"><input class="in grow" name="n" placeholder="Nome da conta ou cartão" required><select class="in" name="ty" aria-label="Tipo">${Object.entries(ACT).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select><input data-fin-private class="in" name="ini" type="number" step="any" placeholder="Saldo inicial" style="width:130px"><input data-fin-private class="in f-card" name="lim" type="number" min="0" placeholder="Limite" style="width:110px"><input class="in f-card" name="close" type="number" min="1" max="31" placeholder="Fecha dia" style="width:100px"><input class="in f-card" name="due" type="number" min="1" max="31" placeholder="Vence dia" style="width:100px"><button class="pill">Adicionar conta</button></form></details>`;
 }else if(tab==='regras'){
  body=`<section class="panel wide" id="fin-import"><h2>Importar extrato (CSV ou OFX)</h2>${impPanel()}</section>
  <section class="panel wide" id="fin-rules">${rulesPanel()}</section>`;
 }
 return head+tabsHtml+monthlySummary+(tab==='lanc'||tab==='geral'?'':formHtml)+`<div class="cards">${body}</div>`+(tab==='geral'?`<details class="panel" id="overview-capture"><summary>Novo lançamento</summary>${formHtml}</details>`:'');
}
document.addEventListener('change',async e=>{
 const i=e.target;if(!i||!i.dataset)return;
 if(i.id==='csvf'&&i.files[0]){
  const fl=i.files[0],buf=await fl.arrayBuffer();let txt;try{txt=new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(x){txt=new TextDecoder('windows-1252').decode(buf)}
  if(prepCSV(txt,fl.name))render();
  e.target.value='';return}
 if(i.dataset.impReview&&IMP){
  const review=(IMP.review=IMP.review||{});
  if(i.value)review[i.dataset.impReview]=i.value;
  else delete review[i.dataset.impReview];
  render();return;
 }
 if(i.dataset.imp&&IMP){const k=i.dataset.imp;if(['hdr','inv','df','ac','d','t','v','ref','clean','skipRes','trRes','skipCardPay'].includes(k))IMP.review={};if(['hdr','inv','df','ac','d','t','v','ref','skipRes','trRes','skipCardPay','genInst'].includes(k))IMP.include=[];if(['inv','hdr','clean','setIni','reconcile','genInst','skipRes','trRes','skipCardPay','saveRules'].includes(k)){IMP[k]=i.checked;if(k==='trRes'&&i.checked)IMP.skipRes=false;if(k==='skipRes'&&i.checked)IMP.trRes=false}else if(k==='df'||k==='ac'){IMP[k]=i.value;if(k==='ac'){const a=finInit().acc.find(x=>x.id===i.value);IMP.isCard=!!(a&&a.ty==='card')}}else IMP.map[k]=+i.value;render();return}
 if(i.dataset.impCat!==undefined&&IMP){IMP.cats=IMP.cats||{};if(i.value)IMP.cats[i.dataset.impCat]=i.value;else delete IMP.cats[i.dataset.impCat];render();return}
 if(i.dataset.impInclude&&IMP){const n=+i.dataset.impInclude;IMP.include=(IMP.include||[]).filter(x=>x!==n);if(i.checked)IMP.include.push(n);render();return}
 if(i.dataset.txChecked){const t=finInit().tx.find(x=>x.id===i.dataset.txChecked);if(t)t.checked=i.checked;renderKeepDraft();return}
 if(i.form?.id==='ftxbulk'&&i.name==='cat'){
  const submit=i.form.querySelector('[data-tx-bulk-submit]'),review=i.form.querySelector('[data-reserve-review]');
  submit.textContent=i.value==='Reserva'?'Revisar aportes para Reserva':submit.dataset.label;
  review.replaceChildren();
  delete review.dataset.snapshot;
  return;
 }
 if(i.dataset.finKind!==undefined){ANALYSIS_CUT='';S.fkd=i.value;TXBULKDEL=false;renderKeepDraft();return}
 if(i.dataset.finTag!==undefined){FTAG=i.value;TXBULKDEL=false;renderKeepDraft();return}
 if(i.dataset.reconcileFilter!==undefined){FRECON=i.value;TXBULKDEL=false;render();return}
 if(i.dataset.facYear!==undefined){S.fay=i.value;render();return}
 if(i.dataset.fac!==undefined){ANALYSIS_CUT='';S.fac=i.value;TXBULKDEL=false;render();return}
 if(i.dataset.fcat!==undefined){ANALYSIS_CUT='';S.fcat=i.value;TXBULKDEL=false;render();return}
 if(invHandleChange(i)){renderKeepDraft();return}
 if(i.name==='k'&&i.form&&i.form.id==='ffin'){i.form.classList.remove('kout','kin','ktr');i.form.classList.add('k'+i.value)}
 if(i.name==='ty'&&i.form&&i.form.id==='facc')i.form.classList.toggle('facard',i.value==='card');
});
document.addEventListener('input',e=>{const i=e.target;if(i.form?.dataset.partAdjust||i.form?.dataset.partRefund)previewPart(i.form);if(i.form?.dataset.recSchedule)previewRecurring(i.form);if(i.form?.id==='fin-installment'&&['v','pc','d'].includes(i.name))previewInstallment(i.form);if(i&&i.id==='fq'){FQ=i.value;TXBULKDEL=false;const el=$('#txlist');if(el)el.innerHTML=txListHtml(monthTransactions(ds(financeMonthDate()).slice(0,7)))}if(i&&i.name==='v'&&i.form&&i.form.id==='fbud'){const el=i.form.querySelector('[data-budget-preview]'),v=num(i.value);if(el)el.textContent=i.value.trim()?(Number.isFinite(v)&&v>0?'Valor interpretado: '+BRL(v):'Informe um valor maior que zero.'):''}if(i&&i.form&&i.form.dataset.accEdit&&['close','due'].includes(i.name))accountImpact(i.form)});

/* ===== Integração das finanças com o resto do painel ===== */
function projData(){
 const F=finInit(),p=ds(new Date(today.getFullYear(),today.getMonth()+S.fmo,1)).slice(0,7),inM=d=>S.fpm==='all'||d.slice(0,7)===p,m={},g=k=>(m[k]=m[k]||{inc:0,out:0,min:0});
 F.tx.forEach(t=>{if(t.k==='tr'||!t.pj||!inM(t.d))return;const o=g(t.pj);if(t.k==='in')o.inc+=t.v;else o.out+=t.v});
 Object.entries(S.fpj||{}).forEach(([k,days])=>Object.entries(days).forEach(([d,v])=>{if(inM(d))g(k).min+=v}));
 let inc=0,out=0,fo=0;F.tx.forEach(t=>{if(t.k==='tr'||!inM(t.d))return;if(t.k==='in')inc+=t.v;else out+=t.v});
 Object.entries(S.fm||{}).forEach(([d,v])=>{if(inM(d))fo+=v});
 return{m,inc,out,fo}}
const hh=min=>Math.floor(min/60)+'h'+String(Math.round(min%60)).padStart(2,'0');
function projPanel(){
 const {m,inc,out,fo}=projData(),ks=Object.keys(m).sort((a,b)=>(m[b].inc+m[b].out)-(m[a].inc+m[a].out)),mx=Math.max(1,...ks.map(k=>Math.max(m[k].inc,m[k].out))),h=fo/60;
 const tg=`<span style="display:flex;gap:var(--space-2)">${[['m','Mês selecionado'],['all','Tudo']].map(x=>`<button class="pill ${S.fpm===x[0]?'on':''}" data-a="fpm" data-id="${x[0]}">${x[1]}</button>`).join('')}</span>`;
 return `<div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Projetos: receita, gasto e horas de foco</h2>${tg}</div>
 <p class="empty" style="padding:0 0 var(--space-2)">${fo?`Foco total: <strong>${hh(fo)}</strong> · gasto por hora de foco: <strong>${BRL(out/h)}</strong>${inc?` · receita por hora de foco: <strong>${BRL(inc/h)}</strong>`:''}.`:'Use o modo foco (▶ nas tarefas) para registrar horas e ver o gasto e a receita por hora.'}</p>
 ${ks.map(k=>{const o=m[k],hp=o.min/60;return `<div class="item"><div class="t">${esc(k)}<small>Receita ${BRL(o.inc)} · Gasto ${BRL(o.out)} · Resultado <span class="${o.inc-o.out<0?'neg':'pos'}">${BRL(o.inc-o.out)}</span></small><small>${o.min?hh(o.min)+' de foco'+(o.inc?' · '+BRL(o.inc/hp)+' de receita por hora':'')+(o.out?' · '+BRL(o.out/hp)+' de gasto por hora':''):'Sem horas de foco registradas neste período'}</small><div class="fb" style="margin-top:var(--space-2)"><i style="width:${o.inc/mx*100}%"></i></div><div class="fb o" style="margin-top:var(--space-1)"><i style="width:${o.out/mx*100}%"></i></div></div></div>`}).join('')||'<p class="empty">Marque lançamentos com um projeto (campo "Projeto" do formulário) para ver receita e gasto por projeto. Projetos são os mesmos das tarefas.</p>'}`}
const pjList=()=>`<datalist id="pjl">${[...new Set([...S.tasks.map(t=>t.pj),...finInit().tx.map(t=>t.pj)].filter(Boolean))].map(p=>`<option value="${esc(p)}">`).join('')}</datalist>`;
function moodSpend(){
 const F=finInit(),sp={};F.tx.forEach(t=>{if(t.k==='out'&&!t.rc&&!t.pc)sp[t.d]=(sp[t.d]||0)+t.v});
 const days=Object.keys(S.dia).filter(d=>S.dia[d].m&&d<=T),avg=a=>a.length?a.reduce((s,d)=>s+(sp[d]||0),0)/a.length:null;
 const grp=[1,2,3,4,5].map(n=>days.filter(d=>S.dia[d].m===n)),av=grp.map(avg),mx=Math.max(1,...av.map(x=>x||0));
 const lo=days.filter(d=>S.dia[d].m<=2),hi=days.filter(d=>S.dia[d].m>=4),al=avg(lo),ah=avg(hi);
 let msg='Registre o humor em pelo menos 3 dias ruins (1 ou 2) e 3 dias bons (4 ou 5) para comparar.';
 if(lo.length>=3&&hi.length>=3){const r=ah>0?Math.round((al/ah-1)*100):null;msg=al>ah*1.1?`Em dias ruins (humor 1 ou 2) você gastou em média ${BRL(al)} por dia${r!==null?', '+r+'% a mais':''} do que nos dias bons (${BRL(ah)}).`:al<ah*.9?`Em dias ruins você gastou menos (${BRL(al)} por dia) do que nos dias bons (${BRL(ah)}).`:`Seu gasto diário é parecido em dias ruins (${BRL(al)}) e bons (${BRL(ah)}).`}
 const W=300,H=150,L=8,pw=W-2*L,gw=pw/5,bw=gw*.6;
 const svg=`<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto médio diário por nível de humor">${av.map((v,i)=>{const hgt=v?Math.max(2,(H-50)*v/mx):0,x=L+gw*i+(gw-bw)/2;return `<rect x="${x}" y="${H-30-hgt}" width="${bw}" height="${hgt}" rx="4" fill="${MC[i]}"><title>Humor ${i+1}: ${v===null?'sem dias':BRL(v)+' por dia ('+grp[i].length+' dias)'}</title></rect><text x="${x+bw/2}" y="${H-30-hgt-4}" text-anchor="middle">${v===null?'':K(v)}</text><text x="${x+bw/2}" y="${H-14}" text-anchor="middle" style="fill:var(--ink)">${i+1}</text><text x="${x+bw/2}" y="${H-3}" text-anchor="middle">${grp[i].length} d</text>`}).join('')}</svg>`;
 return `<div class="panel wide"><h2>Humor e gastos</h2>${days.length?svg:'<p class="empty">Registre o humor em alguns dias para cruzar com seus gastos.</p>'}<p class="empty" style="padding:var(--space-1) 0 0">${msg} Conta só os gastos variáveis: não inclui recorrências nem parcelas.</p></div>`}
const glink=g=>{const ls=S.metas.filter(m=>m.kr.some(k=>k.ty==='sv'&&k.ref===g.id)),free=S.metas.filter(m=>!m.archived&&!ls.includes(m));return (ls.length?`<small>Ligada à meta ${ls.map(m=>'"'+esc(m.t)+'"').join(', ')}</small>`:'')+(free.length?`<form class="bar" data-gl="${g.id}" style="margin:var(--space-2) 0 0"><select class="in" name="m" aria-label="Meta">${free.map(m=>`<option value="${m.id}">${esc(m.t)}</option>`).join('')}</select><button class="pill">Ligar à meta</button></form>`:(!S.metas.length?'<small>Crie uma meta na aba Metas para ligar esta economia a ela.</small>':''))};
function finCard(){
 finInit();genRec();const sf=S.fmo,sa=S.fac;S.fmo=0;S.fac='';const lc=lineChart();S.fmo=sf;S.fac=sa;
 const {inc,out,by}=finMonth(0,true),sal=inc-out,a=series(6,0,true),mx=Math.max(1,...a.map(x=>Math.max(x.inc,x.out))),cs=Object.keys(by).sort((x,y)=>by[y]-by[x]).slice(0,3);
 const mini=`<svg class="fs mini lab" viewBox="0 0 240 72" style="max-width:100%" role="img" aria-label="Receitas e despesas dos últimos 6 meses">${a.map((x,i)=>{const hi=Math.max(1,48*x.inc/mx),ho=Math.max(1,48*x.out/mx),c=i===a.length-1;return `<rect x="${i*40+6}" y="${52-hi}" width="13" height="${hi}" rx="4" fill="var(--s1)"/><rect x="${i*40+21}" y="${52-ho}" width="13" height="${ho}" rx="4" fill="var(--s2)"/><text x="${i*40+20}" y="67" text-anchor="middle" font-size="10" fill="currentColor" opacity="${c?1:.65}" font-weight="${c?700:400}">${MES[x.f.getMonth()]}</text>`}).join('')}</svg>`;
 const f0=new Date(today.getFullYear(),today.getMonth(),1),ND=dimOf(f0.getFullYear(),f0.getMonth()),pm=T.slice(0,7),dd=Array(ND+1).fill(0),tdn=today.getDate();
 S.fin.tx.forEach(t=>{if(t.k==='out'&&t.d.slice(0,7)===pm)dd[+t.d.slice(8)]+=+t.v||0});
 const dmx=Math.max(1,...dd),avg=dd.slice(1,tdn+1).reduce((p,q)=>p+q,0)/tdn,bw=300/ND,ay=64-56*avg/dmx;
 const dly=`<svg class="fs mini lab" viewBox="0 0 300 80" style="max-width:100%" role="img" aria-label="Gastos por dia no mês, com a média diária">${dd.slice(1).map((v,i)=>{const d=i+1,h=v>0?Math.max(2,56*v/dmx):0;return d>tdn?`<rect x="${(i*bw+1).toFixed(1)}" y="62" width="${(bw-2).toFixed(1)}" height="2" rx="1" fill="currentColor" opacity=".15"/>`:`<rect x="${(i*bw+1).toFixed(1)}" y="${(64-h).toFixed(1)}" width="${(bw-2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${d===tdn?'var(--s1d)':'var(--s1)'}" opacity="${d===tdn?1:.75}"/>`}).join('')}<line x1="0" x2="300" y1="64" y2="64" stroke="currentColor" opacity=".25"/>${avg>0?`<line x1="0" x2="300" y1="${ay.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="var(--neg)" stroke-width="1.5" stroke-dasharray="4 3"/>`:''}${[1,10,20,ND].filter((d,i,l)=>l.indexOf(d)===i).map(d=>`<text x="${((d-.5)*bw).toFixed(1)}" y="77" text-anchor="middle" font-size="9" fill="currentColor" opacity=".65">${d}</text>`).join('')}</svg>`;
 const prox=typeof dues==='function'?dues(7).filter(x=>x.k!=='in'):[],proxTot=r2(prox.reduce((s,x)=>s+(+x.v||0),0));
 const proxBox=prox.length?`<div class="item" style="margin-top:var(--space-2)"><div class="t">Vencimentos (7 dias)<small>${prox.slice(0,2).map(x=>esc(x.t)+' ('+fmt(x.d)+')').join(' · ')}${prox.length>2?' e +'+(prox.length-2):''}</small></div><strong>${BRL(proxTot)}</strong></div>`:'';
 const acts=`<div class="bar" style="margin:var(--space-2) 0 0"><button class="pill" data-v="financas">Abrir Finanças</button><button class="pill" data-a="qat" data-id="dp">+ Despesa</button><button class="pill" data-a="qat" data-id="rc">+ Receita</button></div>`;
 if(!S.fin.tx.length)return `<div class="panel" data-card="fin"><h2>Finanças do mês</h2>${emp('fin','Nenhum lançamento ainda. Registre gastos e receitas para ver gráficos aqui.','Abrir Finanças','data-v="financas"')}${proxBox}${acts}</div>`;
 return `<div class="panel" data-card="fin"><h2>Finanças do mês</h2><div class="two" style="gap:var(--space-4)"><div><div class="item"><div class="t">Resultado<small>${BRL(inc)} entradas · ${BRL(out)} saídas</small></div><strong class="${sal<0?'neg':'pos'}">${BRL(sal)}</strong></div>${cs.map((c,i)=>`<div class="cat" style="grid-template-columns:96px 1fr auto"><span>${esc(c)}</span><div class="fb"><i style="width:${by[c]/out*100}%;background:${PAL8[i]}"></i></div><small>${BRL(by[c])}</small></div>`).join('')}${finAlerts(by,T.slice(0,7)).map(x=>`<p class="empty neg" style="padding:var(--space-1);margin:0">⚠ ${esc(x[0])}: ${x[1]}% do orçamento</p>`).join('')}${proxBox}</div><div><div class="lb" style="margin:0 0 var(--space-1)">Gastos por dia</div>${dly}<p class="empty" style="padding:var(--space-1) 0 var(--space-2)">Média de ${BRL(avg)} por dia${lc.proj?` · saldo projetado do mês: <strong class="${lc.end<0?'neg':'pos'}">${BRL(lc.end)}</strong>`:''}</p><div class="lb" style="margin:var(--space-2) 0 var(--space-1)">Últimos 6 meses</div>${mini}<p class="lgd"><span><i class="lg g"></i>receitas</span><span><i class="lg p"></i>despesas</span></p></div></div>${acts}</div>`}
document.addEventListener('submit',e=>{const f=e.target;if(!f.dataset||!f.dataset.gl)return;e.preventDefault();const v=Object.fromEntries(new FormData(f)),m=S.metas.find(x=>x.id===v.m),g=S.fin.goals.find(x=>x.id===f.dataset.gl);if(m&&g){m.kr.push({id:uid(),ty:'sv',ref:g.id,t:'Economizar para "'+g.n+'"',tg:1,un:'',cur:0});toast('Meta de economia ligada à meta "'+esc(m.t)+'"');render()}},true);

/* ===== Finanças v3: saldo, mapa de calor, evolução, calendário, subcategorias, resumo e regras ===== */
let FRE=null,RARM=false;
const DOW=['seg','ter','qua','qui','sex','sáb','dom'],DOWF=['segundas','terças','quartas','quintas','sextas','sábados','domingos'];
const RM_LABEL={c:'contém',s:'começa com',e:'é igual a',r:'corresponde à expressão'};
const subList=()=>`<datalist id="subl">${[...new Set([...finInit().tx.map(t=>t.sub),...finInit().rules.map(r=>r.sub)].filter(Boolean))].map(s=>`<option value="${esc(s)}">`).join('')}</datalist>`;
function openBal(start){const F=finInit(),fa=S.fac;let b=0;(fa?F.acc.filter(a=>a.id===fa):F.acc).forEach(a=>{b+=+a.ini||0});F.tx.forEach(t=>{if(t.d>=start)return;const ac=accId(t);if(t.k==='in'&&(!fa||ac===fa))b+=t.v;else if(t.k==='out'&&(!fa||ac===fa))b-=t.v;else if(t.k==='tr'&&fa){if(ac===fa)b-=t.v;if(t.to===fa)b+=t.v}});return b}
function installmentRefundCarry(card,before){
 const list=finInit().tx,hasCredit=list.some(t=>t.k==='in'&&t.refundOf&&accId(t)===card.id&&t.d<before);
 if(!hasCredit)return 0;
 const cycles=new Map();
 const get=d=>{if(!cycles.has(d))cycles.set(d,{charges:0,credits:0,paid:0});return cycles.get(d)};
 for(const t of list){
  if(t.k==='tr'&&t.to===card.id&&t.invoice&&t.invoice<before){get(t.invoice).paid+=t.v;continue}
  if(t.d>=before||accId(t)!==card.id||!(t.k==='out'||(t.k==='in'&&t.refundOf)))continue;
  const end=simulatedCardCycle(t.d,card).closing;
  if(end>=before)continue;
  if(t.k==='out')get(end).charges+=t.v;else get(end).credits+=t.v;
 }
 let carry=0;
 for(const end of [...cycles.keys()].sort()){
  const {charges,credits,paid}=cycles.get(end);
  carry=Math.max(0,r2(carry+credits-Math.max(0,charges-paid)));
 }
 return carry;
}
function invoice(a,o){
 const f=new Date(today.getFullYear(),today.getMonth()+(o==null?S.fmo:o),1),y=f.getFullYear(),m=f.getMonth(),cl=+a.close||28,c=Math.min(cl,dimOf(y,m)),end=ds(new Date(y,m,c)),pm=new Date(y,m-1,1),st=ds(add(new Date(pm.getFullYear(),pm.getMonth(),Math.min(cl,dimOf(pm.getFullYear(),pm.getMonth()))),1));
 const credit=installmentRefundCarry(a,st);let tot=-credit;S.fin.tx.forEach(t=>{if(accId(t)!==a.id||t.d<st||t.d>end)return;if(t.k==='out')tot+=t.v;else if(t.k==='in'&&t.refundOf)tot-=t.v});
 const dd=+a.due||10,dm=new Date(y,dd>cl?m:m+1,1),due=ds(new Date(dm.getFullYear(),dm.getMonth(),Math.min(dd,dimOf(dm.getFullYear(),dm.getMonth()))));
 const paid=S.fin.tx.filter(t=>t.k==='tr'&&t.to===a.id&&t.invoice===end).reduce((s,t)=>s+(+t.v||0),0),legacy=S.fin.tx.some(t=>t.k==='tr'&&t.to===a.id&&!t.invoice&&t.d>=st&&t.d<=due);
 return{tot:r2(tot),credit,end,due,paid,left:Math.max(0,Math.round((tot-paid)*100)/100),legacy,closed:end<T}}
function invoiceLinkForm(a,iv){const tx=finInit().tx.filter(t=>t.k==='tr'&&t.to===a.id&&!t.invoice);if(!tx.length||iv.left<=0)return '';return `<details><summary>Associar transferência antiga à fatura</summary><p class="empty">Confira a data, a conta e o valor. A associação não cria nem altera a transferência.</p><form class="bar" data-invoice-link="${esc(a.id)}" data-end="${iv.end}"><select class="in grow" name="tx" aria-label="Transferência anterior">${tx.map(t=>`<option value="${esc(t.id)}">${fmt(t.d)} · ${esc(accName(accId(t)))} · ${BRL(t.v)} · ${esc(t.t)}</option>`).join('')}</select><label><input type="checkbox" name="confirm" required> Confirmo que é desta fatura</label><button class="pill">Associar pagamento</button></form></details>`}
function lineChart(){
 const F=finInit(),f=new Date(today.getFullYear(),today.getMonth()+S.fmo,1),y0=f.getFullYear(),m0=f.getMonth(),N=dimOf(y0,m0),p=ds(f).slice(0,7),cut=S.fmo===0?today.getDate():S.fmo<0?N:0,sal=S.flm==='sal',fa=S.fac;
 const okf=t=>!fa||accId(t)===fa||(t.k==='tr'&&t.to===fa),act=Array(N+1).fill(0),sch=Array(N+1).fill(0);let varSum=0;
 F.tx.forEach(t=>{if(t.d.slice(0,7)!==p||!okf(t))return;if(t.k==='tr'&&!(sal&&fa))return;const d=+t.d.slice(8),v=t.k==='in'?t.v:t.k==='out'?-t.v:((accId(t)===fa?-t.v:0)+(t.to===fa?t.v:0));if(t.d>T)sch[d]+=v;else{act[d]+=v;if(t.k==='out'&&!t.rc&&!t.pc)varSum+=t.v}});
 F.rec.forEach(r=>{if(fa&&r.ac!==fa&&!(fa===F.acc[0].id&&!r.ac))return;const dd=Math.min(+r.day||1,N),d=ds(new Date(y0,m0,dd)),id='r_'+r.id+'_'+p;if(d>T&&recurringAllowed(r,d)&&!F.tx.some(t=>t.id===id))sch[dd]+=r.k==='in'?r.v:-r.v});
 const off=sal?openBal(p+'-01'):0,avg=S.fmo===0&&cut>0?varSum/cut:0,A=[off];let c=off;for(let d=1;d<=cut;d++){c+=act[d];A.push(c)}
 const now=A[cut]!==undefined?A[cut]:off,Pj=[[cut,now]];let c2=now;for(let d=cut+1;d<=N;d++){c2+=sch[d]-avg;Pj.push([d,c2])}
 const W=420,H=240,L=42,R=8,T0=12,B=26,pw=W-L-R,ph=H-T0-B,vals=[0,...A,...Pj.map(q=>q[1])],hi=Math.max(4,...vals),lo=Math.min(0,...vals),y=v=>T0+ph*(hi-v)/((hi-lo)||1),x=d=>L+pw*d/N;
 let g='';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 for(let d=5;d<=N;d+=5)g+=`<text x="${x(d)}" y="${H-8}" text-anchor="middle">${d}</text>`;
 const pa=A.map((v,d)=>x(d)+','+y(v)).join(' '),pp=Pj.map(q=>x(q[0])+','+y(q[1])).join(' '),end=Pj[Pj.length-1][1];
 const svg=`<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="${sal?'Saldo':'Resultado'} acumulado no mês com projeção">${g}<line x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--mute)" stroke-dasharray="2 4"/>${S.fmo===0?`<line x1="${x(cut)}" x2="${x(cut)}" y1="${T0}" y2="${H-B}" stroke="var(--mute)" stroke-dasharray="2 4"/>`:''}<polyline points="${pa}" fill="none" stroke="var(--s1)" stroke-width="2.5"/><polyline points="${pp}" fill="none" stroke="${end<0?'var(--neg)':'var(--s1d)'}" stroke-width="2.5" stroke-dasharray="6 5"/><circle cx="${x(cut)}" cy="${y(now)}" r="4" fill="var(--s1d)"/></svg>`;
 return{svg,now,end,avg,proj:S.fmo>=0&&cut<N}}
function heatPanel(){
 const F=finInit(),f=new Date(today.getFullYear(),today.getMonth()+S.fmo,1),last=ds(new Date(f.getFullYear(),f.getMonth()+1,0)),end=S.fmo===0?T:last,ed=new Date(end+'T00:00'),W=16,start=add(ed,-((ed.getDay()+6)%7)-(W-1)*7),sp={};
 F.tx.forEach(t=>{if(t.k!=='out'||(S.fac&&accId(t)!==S.fac))return;sp[t.d]=(sp[t.d]||0)+t.v});
 const cells=[],dw=Array(7).fill(0),dn=Array(7).fill(0);let mx=0;
 for(let i=0;i<W*7;i++){const d=ds(add(start,i)),v=sp[d]||0,fut=d>end;cells.push({d,v,fut});if(!fut){mx=Math.max(mx,v);dw[i%7]+=v;dn[i%7]++}}
 const lv=v=>v<=0?0:Math.ceil(4*v/mx),avg=dw.map((v,i)=>dn[i]?v/dn[i]:0),ma=Math.max(...avg),top=avg.indexOf(ma);
 return `<h2>Mapa de calor de gastos</h2><div class="hmap" style="grid-template-columns:repeat(${W},1fr);width:100%;max-width:${W*26}px" role="img" aria-label="Gasto por dia nas últimas ${W} semanas">${cells.map(c=>`<i class="hm p${lv(c.v)}${c.fut?' fut':''}" title="${fmt(c.d)}: ${BRL(c.v)}" data-a="fday" data-id="${c.d}"></i>`).join('')}</div>
 <p class="empty" style="padding:var(--space-2) 0">Cada quadrado é um dia (colunas: semanas, de segunda a domingo; cor mais forte = mais gasto). Clique num dia para ver os detalhes no calendário.</p>
 ${ma>0?`<p style="margin:0 0 var(--space-2)">Você gasta mais às <strong>${DOWF[top]}</strong> (média de ${BRL(ma)}).</p>`:''}${DOW.map((n,i)=>`<div class="cat" style="grid-template-columns:34px 1fr auto;margin-bottom:var(--space-1)"><span>${n}</span><div class="fb"><i style="width:${ma?avg[i]/ma*100:0}%;background:${i===top&&ma?'var(--s1)':'var(--pink)'}"></i></div><small>${BRL(avg[i])}</small></div>`).join('')}`}
function evoPanel(){
 const n=6,ms=[];for(let i=n-1;i>=0;i--)ms.push(finMonth(S.fmo-i));
 const tot=c=>ms.reduce((a,m)=>a+(m.by[c]||0),0),cats=[...new Set(ms.flatMap(m=>Object.keys(m.by)))].sort((a,b)=>(ms[n-1].by[b]||0)-(ms[n-1].by[a]||0)||tot(b)-tot(a)).slice(0,8),mn=MES[ms[n-1].f.getMonth()];
 if(!cats.length)return '<h2>Evolução por categoria</h2><p class="empty">Sem despesas nos últimos 6 meses.</p>';
 return `<h2>Evolução por categoria</h2><p class="empty" style="padding:0 0 var(--space-2)">Últimos 6 meses, até ${mn}. A etiqueta compara com o mês anterior.</p>${cats.map(c=>{const v=ms.map(m=>m.by[c]||0),mx=Math.max(1,...v),cur=v[n-1],pr=v[n-2],pts=v.map((x,i)=>[4+i*(112/(n-1)),24-20*x/mx]),pct=pr>0?Math.round((cur/pr-1)*100):null,lp=pts[n-1];
  const badge=pr>0?(Math.abs(pct)<5?'<span class="chip c-b">≈ igual</span>':`<span class="chip ${pct>0?'c-p':'c-g'}">${pct>0?'+':''}${pct}%</span>`):cur>0?'<span class="chip c-y">novo</span>':'';
  return `<div class="item"><div class="t">${esc(c)}<small>${BRL(cur)} em ${mn}${pr>0?' · mês anterior '+BRL(pr):''}</small></div><svg class="fs mini" viewBox="0 0 120 28" style="width:110px;flex:none" role="img" aria-label="Evolução de ${esc(c)}"><polyline points="${pts.map(q=>q.join(',')).join(' ')}" fill="none" stroke="var(--s1)" stroke-width="2"/><circle cx="${lp[0]}" cy="${lp[1]}" r="3" fill="var(--s1d)"/></svg>${badge}</div>`}).join('')}`}
function calPanel(){
 const F=finInit(),f=new Date(today.getFullYear(),today.getMonth()+S.fmo,1),y=f.getFullYear(),m=f.getMonth(),N=dimOf(y,m),p=ds(f).slice(0,7),off=(f.getDay()+6)%7,ok=t=>!S.fac||accId(t)===S.fac||t.to===S.fac,days={};
 const g=d=>(days[d]=days[d]||{inc:0,out:0,ev:[],tx:[]});
 F.tx.forEach(t=>{if(t.d.slice(0,7)!==p||!ok(t))return;const o=g(+t.d.slice(8));o.tx.push(t);if(t.k==='in')o.inc+=t.v;else if(t.k==='out')o.out+=t.v});
 F.bills.filter(b=>(!b.rec||!F.rec.some(r=>r.id===b.rec))&&(!S.fac||b.ac===S.fac)).forEach(b=>{const day=Math.min(+b.day||1,N);if(billInRange(b,ds(new Date(y,m,day))))g(day).ev.push({t:'Conta: '+b.n,v:b.v,c:'y'})});
 F.rec.forEach(r=>{const dd=Math.min(+r.day||1,N),d=ds(new Date(y,m,dd)),id='r_'+r.id+'_'+p;if((!S.fac||(r.ac||F.acc[0].id)===S.fac)&&d>T&&recurringAllowed(r,d)&&!F.tx.some(t=>t.id===id))g(dd).ev.push({t:r.t+' (agendado)',v:r.v,c:r.k==='in'?'g':'p'})});
 F.acc.filter(a=>a.ty==='card'&&(!S.fac||a.id===S.fac)).forEach(a=>[-1,0].forEach(o=>{const iv=invoice(a,S.fmo+o);if(iv.due.slice(0,7)===p&&iv.left>0)g(+iv.due.slice(8)).ev.push({t:'Vence a fatura '+a.n,v:iv.left,c:'b'})}));
 const sel=S.fday&&S.fday.slice(0,7)===p?S.fday:(S.fmo===0?T:''),cells=[];
 for(let i=0;i<off;i++)cells.push('<span></span>');
 for(let d=1;d<=N;d++){const iso=ds(new Date(y,m,d)),o=days[d],net=o?o.inc-o.out:0;cells.push(`<button class="fcell${iso===T?' td':''}${iso===sel?' sel':''}" data-a="fday" data-id="${iso}" aria-label="${d} de ${MES[m]}"><b>${d}</b>${o&&(o.inc||o.out)?`<span class="${net<0?'neg':'pos'}">${K(net)}</span>`:''}<span class="dots">${(o?o.ev:[]).slice(0,4).map(e=>`<i class="dot c-${e.c}"></i>`).join('')}</span></button>`)}
 const sd=sel?days[+sel.slice(8)]:null;
 const det=sel?`<h2 class="gh" style="margin-top:var(--space-3)">${+sel.slice(8)} de ${MESF[m]}</h2>${sd&&(sd.tx.length||sd.ev.length)?sd.tx.map(t=>`<div class="item"><div class="t">${esc(t.t)}<small>${t.k==='tr'?'Transferência':esc(t.cat)+(t.sub?' › '+esc(t.sub):'')} · ${esc(accName(accId(t)))}</small></div><strong class="${t.k==='in'?'pos':t.k==='tr'?'':'neg'}">${t.k==='in'?'+':t.k==='tr'?'':'−'} ${BRL(t.v)}</strong></div>`).join('')+sd.ev.map(e=>`<div class="item"><span class="dot c-${e.c}"></span><div class="t">${esc(e.t)}</div><strong>${BRL(e.v)}</strong></div>`).join(''):'<p class="empty">Nada registrado neste dia.</p>'}`:'<p class="empty">Escolha um dia para ver os detalhes.</p>';
 return `<div class="fcal">${DOW.map(n=>`<div class="fch">${n}</div>`).join('')}${cells.join('')}</div><div class="bar" style="margin:var(--space-2) 0 0;font-size:var(--type-small)"><span><i class="dot c-y"></i>conta fixa</span><span><i class="dot c-b"></i>vencimento de fatura</span><span><i class="dot c-p"></i>despesa agendada</span><span><i class="dot c-g"></i>receita agendada</span></div>${det}`}
function subPanel(){
 const {tx}=finMonth(),sb={},tg={};
 tx.forEach(t=>{if(t.k!=='out'||(S.fcat&&t.cat!==S.fcat))return;const k=t.sub?(S.fcat?t.sub:t.cat+' › '+t.sub):(S.fcat?'(sem subcategoria)':null);if(k)sb[k]=(sb[k]||0)+t.v;tagsU(t).forEach(x=>{tg[x]=(tg[x]||0)+t.v})});
 const bars=(o,fn)=>{const ks=Object.keys(o).sort((a,b)=>o[b]-o[a]).slice(0,8),mx=Math.max(1,...ks.map(k=>o[k]));return ks.map((k,i)=>`<div class="cat" style="grid-template-columns:minmax(90px,130px) 1fr auto"><span>${fn(k)}</span><div class="fb"><i style="width:${o[k]/mx*100}%;background:${PAL8[i%8]}"></i></div><small>${BRL(o[k])}</small></div>`).join('')};
 return `<div class="two" style="gap:var(--space-4)"><div><h2>${S.fcat?'Subcategorias de '+esc(S.fcat):'Subcategorias'}</h2>${bars(sb,esc)||'<p class="empty">Preencha o campo "Subcategoria" nos lançamentos, ou crie regras que a definam, para ver o detalhe dentro de cada categoria. Clique numa categoria da rosca para filtrar.</p>'}</div><div><h2>Gastos por etiqueta</h2>${bars(tg,k=>`<button class="chip tgc" data-a="tagv" data-id="${esc(k)}">#${esc(k)}</button>`)||'<p class="empty">Etiquete lançamentos (por exemplo #viagem) para ver o total gasto por etiqueta. As etiquetas são as mesmas do resto do painel.</p>'}</div></div>`}
/* regras de categorização */
function ruleHit(r,t){
 if(r.on===false)return false;const d=norm(t.t),m=norm(r.m||''),ty=r.ty||'out';let ok=true;
 if(r.m){if(r.md==='s')ok=d.startsWith(m);else if(r.md==='e')ok=d===m;else if(r.md==='r'){try{ok=new RegExp(r.m,'i').test(String(t.t))}catch(e){ok=false}}else ok=d.includes(m)}
 if(!ok)return false;if(ty!=='any'&&t.k!==ty)return false;
 if(r.min!==''&&r.min!=null&&!(t.v>=+r.min))return false;if(r.max!==''&&r.max!=null&&!(t.v<=+r.max))return false;
 if(r.ac&&(t.ac?t.ac:S.fin.acc[0].id)!==r.ac)return false;return true}
const ruleOf=t=>finInit().rules.find(r=>ruleHit(r,t))||null;
function applyRules(all){
 let n=0;const F=finInit();
 F.tx.forEach(t=>{
  if(t.k==='tr')return;
  const R=ruleOf(t),canRule=R&&(t.k==='out'||R.ty==='in'||R.ty==='any');
  if(!all&&t.cat&&t.cat!=='Outros'&&(t.k!=='in'||t.sub))return;
  let ch=false;
  if(canRule){
   if(R.cat&&(t.k==='out'||R.ty==='in')&&t.cat!==R.cat){t.cat=R.cat;ch=true}
   if(R.sub&&t.sub!==R.sub){t.sub=R.sub;ch=true}
   else if(!t.sub){const ns=dictSub(t.t,t.k,t.cat);if(ns){t.sub=ns;ch=true}}
   if(R.tg){const nt=normTags((t.tg||'')+','+R.tg);if(nt!==(t.tg||'')){t.tg=nt;ch=true}}
   if(R.pj&&t.pj!==R.pj){t.pj=R.pj;ch=true}
  }else if(t.k==='out'){
   if(!all&&t.cat&&t.cat!=='Outros')return;
   const H=histCat(t.t,t.k,t.id),nc=(H&&H.cat)||dictCat(t.t);
   if(nc&&nc!=='Outros'&&t.cat!==nc){t.cat=nc;ch=true}
   const ns=(H&&H.sub)||dictSub(t.t,t.k,t.cat||nc);
   if(ns&&!t.sub){t.sub=ns;ch=true}
   if(H&&H.tg){const nt=normTags((t.tg||'')+','+H.tg);if(nt!==(t.tg||'')){t.tg=nt;ch=true}}
   if(H&&H.pj&&!t.pj){t.pj=H.pj;ch=true}
  }else if(t.k==='in'){
   const ns=dictSub(t.t,t.k,'Receita');
   if(ns&&!t.sub){t.sub=ns;ch=true}
  }
  if(ch)n++;
 });
 return n;
}
function ruleSave(v){
 const F=finInit(),r={m:(v.m||'').trim(),md:v.md||'c',ty:v.ty||'out',min:v.min===''||v.min==null?'':num(v.min),max:v.max===''||v.max==null?'':num(v.max),ac:v.ac||'',cat:v.cat,sub:(v.sub||'').trim(),tg:normTags(v.tg),pj:(v.pj||'').trim()};
 if(!r.m&&r.min===''&&r.max==='')return toast('Informe um texto ou uma faixa de valor para a regra');
 const e=FRE?F.rules.find(x=>x.id===FRE):null;
 if(e){Object.assign(e,r);FRE=null;toast('Regra atualizada')}else{r.id=uid();r.on=true;F.rules.push(r);toast('Regra adicionada. Ela afeta '+F.tx.filter(t=>t.k!=='tr'&&ruleOf(t)===r).length+' lançamentos já existentes (use "Aplicar" para atualizá-los).')}}
function rulesPanel(){
 const F=finInit(),e=FRE?F.rules.find(r=>r.id===FRE):null,cnt={};
 F.tx.forEach(t=>{if(t.k==='tr')return;const R=ruleOf(t);if(R)cnt[R.id]=(cnt[R.id]||0)+1});
 const when=r=>`${r.ty==='in'?'Receita':r.ty==='any'?'Qualquer lançamento':'Despesa'}${r.m?' com descrição que '+RM_LABEL[r.md||'c']+' <strong>'+esc(r.m)+'</strong>':''}${r.min!==''&&r.min!=null?' · valor de '+BRL(r.min)+' ou mais':''}${r.max!==''&&r.max!=null?' · valor de até '+BRL(r.max):''}${r.ac?' · conta '+esc(accName(r.ac)):''}`;
 const then=r=>`${esc(r.cat||'—')}${r.sub?' › '+esc(r.sub):''}${r.tg?' · #'+r.tg.split(', ').map(esc).join(' #'):''}${r.pj?' · projeto '+esc(r.pj):''}`;
 const sel=(v,x)=>v===x?'selected':'';
 return `<h2>Regras de categorização</h2><p class="empty" style="padding:0 0 var(--space-2)">As regras são testadas de cima para baixo e vale a primeira que combina. Elas preenchem categoria, subcategoria, etiquetas e projeto em lançamentos com categoria automática e na importação de extratos.</p>
 ${F.rules.map((r,i)=>`<div class="item ${r.on===false?'done':''}"><div class="t">${when(r)}<small>→ ${then(r)} · afeta ${cnt[r.id]||0} lançamentos${r.on===false?' · desativada':''}</small></div><button class="x" data-a="rmv" data-id="${r.id}" data-n="-1" aria-label="Subir" ${i?'':'disabled'}>▲</button><button class="x" data-a="rmv" data-id="${r.id}" data-n="1" aria-label="Descer" ${i<F.rules.length-1?'':'disabled'}>▼</button><button class="x" data-a="rtog" data-id="${r.id}" aria-label="Ativar ou desativar" title="Ativar ou desativar">${r.on===false?'○':'●'}</button><button class="x" data-a="redit" data-id="${r.id}" aria-label="Editar regra">✎</button><button class="x" data-a="delrule" data-id="${r.id}" aria-label="Excluir regra">×</button></div>`).join('')||'<p class="empty">Exemplo: despesa cuja descrição contém "uber" → Transporte › App, etiqueta #trabalho.</p>'}
 <form class="bar" id="frule" style="margin:var(--space-2) 0 0"><select class="in" name="ty" aria-label="Tipo"><option value="out" ${sel(e&&e.ty||'out','out')}>Despesa</option><option value="in" ${sel(e&&e.ty,'in')}>Receita</option><option value="any" ${sel(e&&e.ty,'any')}>Qualquer</option></select><select class="in" name="md" aria-label="Condição"><option value="c" ${sel(e&&e.md,'c')}>contém</option><option value="s" ${sel(e&&e.md,'s')}>começa com</option><option value="e" ${sel(e&&e.md,'e')}>é igual a</option><option value="r" ${sel(e&&e.md,'r')}>expressão (regex)</option></select><input class="in grow" name="m" placeholder="Texto da descrição" value="${e?esc(e.m||''):''}"><input data-fin-private class="in" name="min" type="number" step="any" placeholder="Valor mín." value="${e&&e.min!==''?e.min:''}" style="width:110px"><input data-fin-private class="in" name="max" type="number" step="any" placeholder="Valor máx." value="${e&&e.max!==''?e.max:''}" style="width:110px"><select class="in" name="ac" aria-label="Conta"><option value="">Qualquer conta</option>${accOpts(e&&e.ac)}</select><select class="in" name="cat" aria-label="Categoria">${FC.map(c=>`<option ${e&&e.cat===c?'selected':''}>${c}</option>`).join('')}</select><input class="in" name="sub" list="subl" placeholder="Subcategoria" value="${e?esc(e.sub||''):''}"><input class="in" name="tg" list="alltags" placeholder="Etiquetas" value="${e?esc(e.tg||''):''}"><input class="in" name="pj" list="pjl" placeholder="Projeto" value="${e?esc(e.pj||''):''}"><button class="pill dark">${e?'Salvar regra':'Adicionar regra'}</button>${e?'<button type="button" class="pill" data-a="rcancel">Cancelar</button>':''}</form>
 <div class="bar" style="margin:var(--space-2) 0 0"><input class="in grow" id="rtest" placeholder="Testar: digite uma descrição, como UBER *TRIP"><input data-fin-private class="in" id="rtv" type="number" step="any" placeholder="Valor" style="width:110px"></div><p id="rtestout" class="empty" style="padding:0 0 var(--space-2)"></p>
 <div class="bar"><button class="pill" data-a="rulesapply">Categorizar lançamentos em "Outros"</button><button class="pill${RARM?' dark':''}" data-a="rapplyall">${RARM?'Confirmar: recategorizar todos':'Recategorizar todos os lançamentos'}</button>${RARM?'<button class="pill" data-a="rcancelall">Cancelar</button>':''}</div>`}
function finSubmit(v){
 const F=finInit(),e=FED?F.tx.find(t=>t.id===FED):null,oldT=e?e.t:'';
 if(!e){const p=parseFinNL(v.t,v.v,v.parseDate!==false&&(!v.d||v.d===T));v=Object.assign({},v,{t:p.t,v:p.v,d:p.d||v.d||T,tg:normTags([v.tg,p.tg].filter(Boolean).join(', '))})}
 const x=Math.round(num(v.v)*100)/100;if(!(x>0)){toast('Informe um valor maior que zero');return}if(v.k==='tr'&&(v.ac===v.to||F.acc.length<2)){toast(F.acc.length<2?'Cadastre uma segunda conta para transferir':'A conta de destino precisa ser diferente da origem');return}
 const invEnd=v.invoice||(e&&e.k==='tr'&&v.k==='tr'&&e.to===v.to?e.invoice:'');if(invEnd){const a=F.acc.find(a=>a.id===v.to&&a.ty==='card'),offset=(+invEnd.slice(0,4)-today.getFullYear())*12+(+invEnd.slice(5,7)-1-today.getMonth()),iv=a&&invoice(a,offset),remaining=iv?iv.left+(e&&e.invoice===invEnd?e.v:0):0;if(!iv||iv.end!==invEnd||v.k!=='tr'||x>remaining+.001){toast('Confira o cartão e o valor restante da fatura');return}}
 const k=v.k,R=(!v.cat&&k!=='tr'&&!e)?ruleOf({t:v.t,v:x,k,ac:v.ac}):null,H=(!v.cat&&!R&&k!=='tr'&&!e)?histCat(v.t,k):null;
 const cat=k==='in'?'Receita':k==='tr'?'Transferência':(v.cat||(R&&R.cat)||(H&&H.cat)||dictCat(v.t)),ex={pj:(v.pj||'').trim()||(R&&R.pj)||(H&&H.pj)||'',sub:(v.sub||'').trim()||(R&&R.sub)||(H&&H.sub)||(!v.cat&&!e?dictSub(v.t,k,cat):'')||'',tg:normTags(v.tg)||(R&&R.tg)||(H&&H.tg)||''};
 if(e){
  Object.assign(e,{k,t:v.t.trim(),v:x,cat,d:v.d,ac:v.ac,...ex});
  if(k==='tr')e.to=v.to;else delete e.to;if(!invEnd)delete e.invoice;
  let extra=0;
  if(v.applySame&&k!=='tr'){
   const nt1=norm(oldT),nt2=norm(cleanDesc(v.t));
   F.tx.forEach(q=>{
    if(q.id===e.id||q.k!==k)return;
    const match=(nt1&&norm(q.t)===nt1)||(nt2&&norm(cleanDesc(q.t))===nt2);
    if(!match)return;
    if(k==='out')q.cat=cat;
    if(ex.sub)q.sub=ex.sub;
    if(ex.tg)q.tg=normTags((q.tg||'')+','+ex.tg);
    if(ex.pj)q.pj=ex.pj;
    extra++;
   });
   const cl=cleanDesc(v.t),pat=cl.length>=3?cl:v.t.trim();
   if(pat){
    const exRule=F.rules.find(r=>(r.ty||'out')===k&&norm(r.m)===norm(pat)&&(r.md||'c')==='c');
    if(exRule)Object.assign(exRule,{cat,sub:ex.sub,tg:ex.tg,pj:ex.pj,on:true});
    else F.rules.push({id:uid(),on:true,m:pat,md:'c',ty:k,min:'',max:'',ac:'',cat,sub:ex.sub,tg:ex.tg,pj:ex.pj});
   }
  }
  FED=null;toast('Lançamento atualizado'+(v.applySame&&k!=='tr'?' (aplicado a '+extra+' outro'+(extra===1?'':'s')+' e regra salva)':''));return
 }
 const n=k==='out'?Math.min(48,Math.max(1,Math.trunc(+v.pc)||1)):1,t=v.t.trim();
 if(n>1){const g=uid();installmentSchedule(v.d,Math.round(x*100),n).forEach((row,i)=>F.tx.unshift({id:uid(),k,t,...row,cat,ac:v.ac,...ex,pc:{g,i:i+1,n}}));toast(n+' parcelas lançadas'+(+v.pc>48?' (limite de 48 parcelas)':''))}
 else{const o={id:uid(),k,t,v:x,cat,d:v.d,ac:v.ac,...ex};if(k==='tr')o.to=v.to;if(invEnd)o.invoice=invEnd;F.tx.unshift(o);toast(k==='in'?'Receita lançada':k==='tr'?'Transferência registrada':'Despesa lançada'+(R?' ('+esc(cat)+(ex.sub?' › '+esc(ex.sub):'')+' pela regra)':''))}}
function reviewReserveBatch(form,v,confirming=false){
 const box=form.querySelector('[data-reserve-review]');
 if(v.cat!=='Reserva'||v.sub||v.tg||v.ac||v.createRules){
  toast('Ao mover aportes para Reserva, selecione somente a categoria.');return;
 }
 const eligible=filteredTx(finMonth().tx).filter(t=>t.id&&t.k==='out'&&t.cat==='Outros');
 const snapshot=JSON.stringify(eligible.map(t=>[t.id,t.t,t.d,t.v,t.ac]));
 if(!confirming||box.dataset.snapshot!==snapshot){
  box.dataset.snapshot=snapshot;
  box.innerHTML=eligible.length?`<fieldset><legend>Selecione os aportes classificados em Outros</legend>
   ${confirming?'<p role="status">A lista mudou. Confira novamente antes de confirmar.</p>':''}
   ${eligible.map(t=>`<label class="item"><input type="checkbox" name="reservePick" value="${esc(t.id)}"><span class="t">${esc(t.t)}<small>${fmt(t.d)} · ${esc(accName(accId(t)))} · ${BRL(t.v)}</small></span></label>`).join('')}
   <button type="button" class="pill dark" data-a="reserve-confirm">Confirmar mudança para Reserva</button></fieldset>`:'<p class="empty">Nenhuma despesa em Outros nos filtros atuais.</p>';
  box.focus();
  return;
 }
 const selected=new Set(new FormData(form).getAll('reservePick'));
 const records=eligible.filter(t=>selected.has(t.id));
 if(!records.length){toast('Selecione ao menos um aporte para confirmar.');return}
 records.forEach(t=>{t.cat='Reserva'});
 toast(records.length+(records.length===1?' despesa movida para Reserva.':' despesas movidas para Reserva.'));
 render();
}
function txBulkApply(v){
 const F=finInit(),L=filteredTx(finMonth().tx);if(!L.length)return;
 const cat=(v.cat||'').trim(),sub=(v.sub||'').trim(),tg=normTags(v.tg||''),ac=(v.ac||'').trim(),createRules=!!v.createRules;
 if(!cat&&!sub&&!tg&&!ac&&!createRules){toast('Escolha uma alteração (categoria, subcategoria, etiqueta ou conta)');return 'stop'}
 let ch=0;const rulesSeen=new Set();
 L.forEach(t=>{
  let m=false;
  if(cat&&t.k==='out'&&t.cat!==cat){t.cat=cat;m=true}
  if(sub&&t.k!=='tr'&&t.sub!==sub){t.sub=sub;m=true}
  if(tg){const nt=normTags((t.tg||'')+','+tg);if(nt!==(t.tg||'')){t.tg=nt;m=true}}
  if(ac&&accId(t)!==ac&&!(t.k==='tr'&&t.to===ac)){t.ac=ac;m=true}
  if(m)ch++;
  if(createRules&&t.k!=='tr'){
   const targetCat=t.k==='out'?(cat||t.cat):'Receita';
   if(targetCat&&targetCat!=='Outros'){
    const cl=cleanDesc(t.t),pat=cl.length>=3?cl:t.t.trim(),rk=t.k+'|'+norm(pat);
    if(pat&&!rulesSeen.has(rk)&&!F.rules.some(r=>(r.ty||'out')===t.k&&norm(r.m)===norm(pat)&&(r.md||'c')==='c')){
     F.rules.push({id:uid(),on:true,m:pat,md:'c',ty:t.k,min:'',max:'',ac:'',cat:targetCat,sub:sub||t.sub||'',tg:tg||'',pj:''});
     rulesSeen.add(rk);
    }
   }
  }
 });
 TXBULKDEL=false;clearTimeout(TXBULKT);
 toast(ch+' lançamentos atualizados'+(rulesSeen.size?' · '+rulesSeen.size+(rulesSeen.size===1?' regra criada':' regras criadas'):''));
}
function parseInstDesc(s){
 const raw=String(s||''),re=/(^|[\s\-*])(?:parcela|parc\.?)?\s*0*(\d{1,2})\s*\/\s*0*(\d{1,2})(?![\/\-.]\d)(?=$|[\s\-\)*])/gi;
 let m;
 while((m=re.exec(raw))!==null){
  const pre=raw.slice(Math.max(0,m.index-8),m.index).toLowerCase();
  if(/\b(?:dia|em|data)\s*$/.test(pre))continue;
  const i=+m[2],n=+m[3];
  if(i>=1&&n>=2&&n<=48&&i<=n)return{i,n,rem:n-i};
 }
 return null;
}
function recPriceAlert(r){
 if(!r||r.k!=='out')return null;
 const F=finInit(),key=norm(cleanDesc(r.t));
 const last=F.tx.filter(t=>t.k==='out'&&t.d<=T&&(t.rc===r.id||(key&&norm(cleanDesc(t.t))===key))).sort((a,b)=>b.d.localeCompare(a.d))[0];
 if(!last||Math.abs((+last.v||0)-(+r.v||0))<.01)return null;
 return{last,diff:r2((+last.v||0)-(+r.v||0))};
}
function closingReview(month,tx){
 const F=finInit(),pending=tx.filter(t=>!t.checked),groups=new Map();
 for(const t of tx){
  const key=JSON.stringify([t.k,accId(t),t.to||'',t.d,Math.round(t.v*100),norm(cleanDesc(t.t))]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(t);
 }
 const duplicates=[...groups.values()].filter(g=>g.length>1&&!g.every(t=>t.shoppingReviewed));
 const offset=(month.f.getFullYear()-today.getFullYear())*12+month.f.getMonth()-today.getMonth();
 const open=F.acc.filter(a=>a.ty==='card'&&(!S.fac||a.id===S.fac)).flatMap(a=>{
  const direct=invoice(a,offset),prior=invoice(a,offset-1);
  return [direct,prior].filter(iv=>iv.left>0&&iv.due.startsWith(month.p)).map(iv=>({a,iv}));
 });
 const reserve=tx.filter(t=>t.k==='out'&&t.cat==='Reserva');
 const link=t=>commitmentLink({id:t.id,action:'finance-review-open'},t.t);
 return `<section class="fin-month-check" aria-label="Revisão antes do fechamento"><h3>Antes de fechar o mês</h3>
 <details id="closing-unchecked"><summary>${pending.length} lançamentos a conferir</summary>
 ${pending.slice(0,5).map(t=>`<div class="item"><div class="t">${datePt(t.d)} · ${BRL(t.v)}</div>${link(t)}</div>`).join('')}
 ${pending.length?`<button class="pill" data-a="closing-pending">Ver lançamentos não conferidos</button>`:'<p class="empty">Nenhuma pendência de conferência.</p>'}</details>
 <details id="closing-duplicates"><summary>${duplicates.length===1?'1 grupo':duplicates.length+' grupos'} de possíveis duplicatas</summary>${duplicates.map(group=>`<div class="item"><div class="t">${esc(group[0].t)} · ${datePt(group[0].d)} · ${BRL(group[0].v)}<div class="bar">${group.map(link).join('')}</div></div></div>`).join('')||'<p class="empty">Nenhuma duplicata exata encontrada.</p>'}</details>
 <details id="closing-invoices"><summary>${open.length} faturas com saldo a pagar</summary>${open.map(({a,iv})=>`<div class="item"><div class="t">${esc(a.n)} · vence em ${datePt(iv.due)}</div><strong>${BRL(iv.left)}</strong><button class="pill" data-a="overview-card" data-id="${esc(a.id)}" data-o="${iv.end.startsWith(month.p)?offset:offset-1}">Ver fatura</button></div>`).join('')||'<p class="empty">Sem faturas com saldo a pagar neste período.</p>'}</details>
 <details id="closing-reserve"><summary>Aportes na categoria Reserva · ${BRL(reserve.reduce((n,t)=>n+t.v,0))}</summary>${reserve.map(t=>`<div class="item"><div class="t">${datePt(t.d)} · ${BRL(t.v)}</div>${link(t)}</div>`).join('')||'<p class="empty">Nenhum aporte registrado neste mês.</p>'}</details></section>`;
}
const CLOSING_CASH='__inv_cash';
const centsOf=value=>Math.round((+value||0)*100);
function closingNet(F,months){
 const result=new Map();
 for(const t of F.tx||[]){
  const month=t.d?.slice(0,7);
  if(!months.has(month)||t.d>T||(t.k!=='in'&&t.k!=='out'))continue;
  result.set(month,(result.get(month)||0)+centsOf(t.v)*(t.k==='in'?1:-1));
 }
 return result;
}
function closingProjection(F=finInit()){
 const entries=F.closings||[],months=new Map(),credits=new Map(),status=new Map();
 if(!entries.length)return {months,credits,status};
 const periods=new Set(entries.map(e=>e.month)),net=closingNet(F,periods);
 for(const month of periods){
  const archived=F.archives?.find(a=>String(a.year)===month.slice(0,4));
  const cap=archived?.closingCaps?.[month]??net.get(month)??F.closingRetained?.[month]??0;
  months.set(month,{cap:Math.max(0,cap),used:0});
 }
 // A ordem é estável após a mescla. Um estorno posterior não aprova tentativas que já ficaram sem saldo.
 const events=entries.flatMap(e=>e.reversedAt?[{e,at:e.at,reverse:false},{e,at:e.reversedAt,reverse:true}]:[{e,at:e.at,reverse:false}])
  .sort((a,b)=>a.at-b.at||Number(a.reverse)-Number(b.reverse)||(a.e.id<b.e.id?-1:a.e.id>b.e.id?1:0));
 for(const {e,reverse} of events){
  const month=months.get(e.month),state=status.get(e.id);
  if(reverse){
   if(state==='accepted'){month.used-=e.cents;credits.set(e.goal,(credits.get(e.goal)||0)-e.cents)}
   status.set(e.id,'reversed');continue;
  }
  if(state)continue;
  if(month.used+e.cents>Math.min(month.cap,e.limit)){status.set(e.id,'conflict');continue}
  month.used+=e.cents;credits.set(e.goal,(credits.get(e.goal)||0)+e.cents);status.set(e.id,'accepted');
 }
 return {months,credits,status};
}
function closingGoalBalance(goal,projection=closingProjection()){
 return r2((+goal.saved||0)+(projection.credits.get(goal.id)||0)/100);
}
function closingCashBalance(inv,projection=closingProjection()){
 return r2((+inv.cfg.cash||0)+(projection.credits.get(CLOSING_CASH)||0)/100);
}
function closingStamp(entries){
 return entries.reduce((latest,e)=>Math.max(latest,e.at+1,(e.reversedAt||0)+1),Date.now());
}
function closingRecordValid(e){
 return !!e&&typeof e.id==='string'&&!!e.id&&/^\d{4}-(0[1-9]|1[0-2])$/.test(e.month)&&e.scope==='all'&&
  typeof e.goal==='string'&&!!e.goal&&typeof e.label==='string'&&Number.isSafeInteger(e.cents)&&e.cents>0&&
  Number.isSafeInteger(e.limit)&&e.limit>=e.cents&&Number.isSafeInteger(e.at)&&e.at>0&&
  (e.reversedAt===undefined||(Number.isSafeInteger(e.reversedAt)&&e.reversedAt>e.at));
}
function closeMonthSubmit(form,v){
 const F=finInit(),month=form.dataset.month,id=form.dataset.operation;
 const amount=centsOf(num(v.v)),goal=F.goals.find(g=>g.id===v.goal);
 if(!id||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||'')||(!goal&&v.goal!==CLOSING_CASH)||
     !Number.isSafeInteger(amount)||amount<=0){toast('Confira o valor e o destino da sobra');return 'stop'}
 if((F.closings||[]).some(entry=>entry.id===id))return 'stop';
 if(month!==finMonth().p||F.archives.some(a=>String(a.year)===month.slice(0,4))){toast('Reabra o fechamento do mês antes de confirmar');return 'stop'}
 const limit=Math.max(0,closingNet(F,new Set([month])).get(month)||0);
 const used=closingProjection(F).months.get(month)?.used||0;
 if(amount>limit-used){toast('O valor excede a sobra disponível deste mês');return 'stop'}
 const entries=F.closings||(F.closings=[]);
 entries.push({id,month,scope:'all',goal:v.goal,label:goal?.n||'Caixa de Investimentos',cents:amount,limit,at:closingStamp(entries)});
 if(!save()){entries.pop();toast('Não foi possível salvar a destinação neste aparelho. Tente novamente.');return 'stop'}
 render({save:false});toast('Destinação registrada. O saldo das contas não mudou.');
 return 'stop';
}
function closeMonthReverse(id){
 const F=finInit(),e=F.closings?.find(x=>x.id===id);
 if(!e||e.reversedAt){toast('A destinação já foi revertida ou não existe');return 'stop'}
 const projection=closingProjection(F);
 if(e.goal===CLOSING_CASH&&projection.status.get(id)==='accepted'&&centsOf(closingCashBalance(invInit(F),projection))<e.cents){
  toast('O caixa já foi usado. Confira o saldo antes de reverter esta destinação.');return 'stop';
 }
 e.reversedAt=closingStamp(F.closings);
 if(!save()){delete e.reversedAt;toast('Não foi possível salvar a reversão neste aparelho. Tente novamente.');return 'stop'}
 render({save:false});toast('Destinação revertida');return 'stop';
}
function closingHistory(F,month,projection){
 const rows=(F.closings||[]).filter(e=>e.month===month);
 if(!rows.length)return '';
 const labels={accepted:'Destinada',conflict:'Não aplicada: sobra insuficiente após conferência',reversed:'Revertida'};
 return `<section aria-label="Histórico de destinações"><h3>Histórico de destinações</h3>${rows.map(e=>{
  const status=projection.status.get(e.id);
  return `<div class="item"><div class="t"><strong>${esc(e.label)}</strong><small>${labels[status]}</small></div><strong>${BRL(e.cents/100)}</strong>
   ${status!=='reversed'?`<details><summary>${status==='conflict'?'Descartar tentativa':'Reverter destinação'}</summary><form class="bar" data-close-reverse="${esc(e.id)}"><button class="pill">${status==='conflict'?'Confirmar descarte':'Confirmar reversão'}</button></form></details>`:''}</div>`;
 }).join('')}</section>`;
}
function closingPanel(projection=closingProjection()){
 const F=finInit(),m=finMonth(),realized=m.tx.filter(t=>t.d<=T),{inc,out,by}=sumAbated(realized),sal=r2(inc-out),mn=MES[m.f.getMonth()];
 const buds=Object.entries(budgetsAt(m.p)),okBud=buds.filter(([c,l])=>(by[c]||0)<=l).length;
 const goals=[...F.goals].sort((a,b)=>(b.res?1:0)-(a.res?1:0));
 const used=projection.months.get(m.p)?.used||0;
 const limit=Math.max(0,closingNet(F,new Set([m.p])).get(m.p)||0),available=Math.max(0,limit-used);
 const room=!F.archives.some(a=>String(a.year)===m.p.slice(0,4))&&available>0;
 const scoped=inc||out?`Resultado realizado${S.fac?' da conta selecionada':''}: <strong>${BRL(sal)}</strong>.${buds.length?' '+okBud+' de '+buds.length+' orçamentos dentro do limite.':''}`:'Sem movimentações realizadas neste escopo.';
 return `<h2>Fechamento de ${mn}</h2>${closingReview(m,realized)}<p>${scoped}</p>
 <p>Sobra do mês em todas as contas: <strong>${BRL(limit/100)}</strong>. Já destinado: <strong>${BRL(used/100)}</strong>. Disponível: <strong>${BRL(available/100)}</strong>.</p>
 ${closingHistory(F,m.p,projection)}
 ${room?`<form class="bar" id="fclosemonth" data-month="${m.p}" data-operation="${uid()}" style="margin:var(--space-2) 0 0">
 <label class="lb">Valor a destinar<input data-fin-private class="in" name="v" type="text" inputmode="decimal" autocomplete="off" value="${used?'':(available/100).toFixed(2).replace('.',',')}" required style="width:130px"></label>
 <label class="lb">Destino<select class="in" name="goal">${goals.map(g=>`<option value="${esc(g.id)}">${esc(g.n)} (${BRL(closingGoalBalance(g,projection))}/${BRL(g.target)})</option>`).join('')}<option value="${CLOSING_CASH}">Caixa de Investimentos (para próximo aporte)</option></select></label><button class="pill dark">Destinar sobra</button></form>`:''}`;
}
function merchantsPanel(){
 const F=finInit(),per=S.fmm==='y'?'y':'m',pix=!!S.fmpix;
 const refD=new Date(today.getFullYear(),today.getMonth()+S.fmo,1),yr=refD.getFullYear(),p=ds(refD).slice(0,7);
 const isRes=t=>/^(reserva por gasto|reserva programada|dinheiro reservado)\b/.test(norm(t));
 const isPix=t=>/\bpix\b|transfer[eê]ncia\s+enviada/i.test(t.t)||t.sub==='Pix';
 const list=F.tx.filter(t=>t.k==='out'&&(!S.fac||accId(t)===S.fac)&&(!S.fcat||t.cat===S.fcat)&&!isRes(t.t)&&(per==='y'?+t.d.slice(0,4)===yr:t.d.slice(0,7)===p)&&(!pix||isPix(t)));
 const grp={};
 list.forEach(t=>{
  const disp=cleanDesc(t.t)||t.t,key=norm(disp)||norm(t.t);
  const g=grp[key]||(grp[key]={name:disp,v:0,n:0,cats:{}});
  if(disp.length<g.name.length)g.name=disp;
  g.v+=t.v;g.n++;g.cats[t.cat]=(g.cats[t.cat]||0)+1;
 });
 const rows=Object.values(grp).map(g=>({...g,v:r2(g.v),cat:Object.keys(g.cats).sort((a,b)=>g.cats[b]-g.cats[a])[0]||'Outros'})).sort((a,b)=>b.v-a.v).slice(0,10);
 const mx=Math.max(1,...rows.map(x=>x.v));
 const hd=`<div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Maiores estabelecimentos e favorecidos</h2><span style="display:flex;gap:var(--space-2);flex-wrap:wrap"><button class="pill ${per==='m'?'on':''}" data-a="fmm" data-id="m" aria-pressed="${per==='m'}">${MES[refD.getMonth()]}</button><button class="pill ${per==='y'?'on':''}" data-a="fmm" data-id="y" aria-pressed="${per==='y'}">${yr}</button><button class="pill ${pix?'on':''}" data-a="fmpix" aria-pressed="${pix}">Só Pix e transferências</button></span></div>`;
 return hd+(rows.length?rows.map((g,i)=>`<div class="item"><div class="t"><strong>${esc(g.name)}</strong><small>${g.n} ${g.n===1?'lançamento':'lançamentos'} · média ${BRL(g.v/g.n)} · ${esc(g.cat)}</small><div class="fb" style="margin-top:var(--space-1)"><i style="width:${g.v/mx*100}%;background:${PAL8[i%8]}"></i></div></div><strong class="neg">− ${BRL(g.v)}</strong><button class="pill" data-a="fmerch" data-id="${esc(g.name)}">Ver</button></div>`).join(''):`<p class="empty">Nenhuma despesa ${pix?'via Pix ou transferência ':''}${per==='y'?'em '+yr:'neste mês'} para agrupar.</p>`);
}
function detectRecurring(){
 const F=finInit(),recKeys=new Set(F.rec.map(r=>norm(cleanDesc(r.t)))),dismissed=new Set(F.recDismiss||[]);
 const isRes=s=>/^(reserva por gasto|reserva programada|dinheiro reservado)\b/.test(norm(s));
 const grp={};
 F.tx.forEach(t=>{
  if(t.k!=='out'||isRes(t.t))return;
  const disp=cleanDesc(t.t)||t.t,key=norm(disp)||norm(t.t);
  if(!key||recKeys.has(key)||dismissed.has(key))return;
  (grp[key]=grp[key]||[]).push({...t,disp});
 });
 const subFix=new Set(['Internet e telefone','Contas da casa','Habitação','Academia']);
 return Object.entries(grp).map(([key,items])=>{
  if(items.some(x=>x.rc))return null;
  items.sort((a,b)=>b.d.localeCompare(a.d));
  const latest=items[0],months=new Set(items.map(x=>x.d.slice(0,7))).size;
  if(!(latest.cat==='Assinaturas'||subFix.has(latest.sub)||months>=2))return null;
  return{key,t:latest.disp,v:latest.v,cat:latest.cat,sub:latest.sub||'',ac:accId(latest),day:+latest.d.slice(8),months,count:items.length,latestDate:latest.d};
 }).filter(Boolean).sort((a,b)=>(b.months>=2)-(a.months>=2)||b.count-a.count||b.v-a.v).slice(0,8);
}
function detectedRecPanel(){
 const L=detectRecurring();if(!L.length)return '';
 return `<details style="margin:var(--space-2) 0" data-det-rec open><summary>Sugestões do extrato (${L.length})</summary><p class="empty" style="padding:var(--space-1) 0">Assinaturas e despesas repetidas encontradas nos lançamentos para cadastrar no fluxo previsto.</p>${L.map(c=>`<div class="item"><div class="t"><strong>${esc(c.t)}</strong><small>${esc(c.cat)}${c.sub?' › '+esc(c.sub):''} · dia ${c.day} · ${c.months>1?c.months+' meses no histórico':c.count+'x no extrato'}</small></div><strong>${BRL(c.v)}</strong><button class="pill dark" data-a="recadd-det" data-id="${esc(c.key)}">Cadastrar recorrente</button><button class="x" data-a="recdismiss-det" data-id="${esc(c.key)}" aria-label="Ignorar sugestão ${esc(c.t)}" title="Ignorar">×</button></div>`).join('')}</details>`;
}
function budgetSuggestions(){
 const F=finInit(),f=new Date(today.getFullYear(),today.getMonth()+S.fmo,1),curP=ds(f).slice(0,7);
 let months=[1,2,3].map(i=>finMonth(S.fmo-i,true)).filter(m=>m.out>0);
 if(!months.length){
  const avail=[...new Set(F.tx.filter(t=>t.k==='out'&&t.d.slice(0,7)<=curP).map(t=>t.d.slice(0,7)))].sort().reverse().slice(0,3);
  months=avail.map(p=>finMonth((+p.slice(0,4)-today.getFullYear())*12+(+p.slice(5,7)-1-today.getMonth()),true)).filter(m=>m.out>0);
 }
 if(!months.length)return null;
 const tot={};months.forEach(m=>Object.entries(m.by).forEach(([c,v])=>{if(FC.includes(c))tot[c]=(tot[c]||0)+v}));
 const out={};Object.entries(tot).forEach(([c,v])=>{const avg=v/months.length;if(avg>0)out[c]=avg>=10?Math.round(avg):r2(avg)});
 return{months:months.length,by:out,curP};
}
document.addEventListener('input',e=>{const i=e.target;if(!i||(i.id!=='rtest'&&i.id!=='rtv'))return;const q=($('#rtest')||{}).value||'',vv=parseFloat(($('#rtv')||{}).value),o=$('#rtestout');if(!o)return;
 if(!q){o.textContent='';return}const R=ruleOf({t:q,v:isNaN(vv)?0:vv,k:'out',ac:finInit().acc[0].id});
 o.textContent=R?'→ '+[R.cat,R.sub].filter(Boolean).join(' › ')+(R.tg?' · #'+R.tg.split(', ').join(' #'):'')+(R.pj?' · projeto '+R.pj:'')+' (regra '+(finInit().rules.indexOf(R)+1)+')':'Nenhuma regra combina com esta descrição.'});

/* ===== Finanças: cascata e relatório anual ===== */
const vwToggle=()=>`<span style="display:flex;gap:var(--space-1)">${[['mes','Mês'],['ano','Ano']].map(x=>`<button class="pill ${(S.fvw||'mes')===x[0]?'on':''}" data-a="fvw" data-id="${x[0]}">${x[1]}</button>`).join('')}</span>`;
function waterSteps(by,inc,out,open){
 const cs=Object.keys(by).sort((a,b)=>by[b]-by[a]),top=cs.slice(0,6),rest=cs.slice(6).reduce((a,k)=>a+by[k],0),st=[];
 if(open!==undefined)st.push({l:'Saldo inicial',v:open,t:'tot'});
 st.push({l:'Receitas',v:inc,t:'up'});top.forEach(k=>st.push({l:k,v:-by[k],t:'dn'}));if(rest>0)st.push({l:'Outras',v:-rest,t:'dn'});
 st.push({l:open!==undefined?'Saldo final':'Resultado',v:(open||0)+inc-out,t:'tot'});return st}
function waterSvg(st){
 const W=520,H=250,L=44,R=8,T0=18,B=54,pw=W-L-R,ph=H-T0-B,n=st.length;let run=0;
 const bars=st.map(s=>{let a,b;if(s.t==='tot'){a=0;b=s.v;run=s.v}else{a=run;b=run+s.v;run=b}return{...s,a,b,run}});
 const vals=bars.flatMap(x=>[x.a,x.b]),hi=Math.max(4,...vals),lo=Math.min(0,...vals),y=v=>T0+ph*(hi-v)/((hi-lo)||1),gw=pw/n,bw=Math.min(54,gw*.62);
 let g='';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 const body=bars.map((s,i)=>{const x=L+gw*i+(gw-bw)/2,top=Math.min(y(s.a),y(s.b)),h=Math.max(1,Math.abs(y(s.a)-y(s.b))),fill=s.t==='up'?'var(--s1)':s.t==='dn'?'var(--s2)':(s.run>=0?'var(--s1d)':'var(--neg)'),cx=x+bw/2;
  const lbl=s.l.length>11?s.l.slice(0,10)+'…':s.l,txt=(s.t==='up'?'+':'')+K(s.v),nxt=bars[i+1];
  return `<rect x="${x}" y="${top}" width="${bw}" height="${h}" rx="3" fill="${fill}"><title>${esc(s.l)}: ${BRL(s.v)}</title></rect>${nxt?`<line x1="${x+bw}" x2="${L+gw*(i+1)+(gw-bw)/2}" y1="${y(s.run)}" y2="${y(s.run)}" stroke="var(--mute)" stroke-dasharray="3 3"/>`:''}<text x="${cx}" y="${top-4}" text-anchor="middle" style="fill:var(--ink)">${txt}</text><text transform="rotate(-30 ${cx} ${H-B+14})" x="${cx}" y="${H-B+14}" text-anchor="end">${esc(lbl)}</text>`}).join('');
 return `<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de cascata: ${st.map(s=>esc(s.l)+' '+BRL(s.v)).join('; ')}">${g}${body}</svg>`}
function waterPanel(){
 const {f,inc,out,by}=finMonth(),sal=S.fwm==='sal',st=waterSteps(by,inc,out,sal?openBal(ds(f)):undefined);
 return `<div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Cascata de ${MES[f.getMonth()]}</h2><span style="display:flex;gap:var(--space-2)">${[['res','Resultado'],['sal','Saldo']].map(x=>`<button class="pill ${(S.fwm||'res')===x[0]?'on':''}" data-a="fwm" data-id="${x[0]}">${x[1]}</button>`).join('')}</span></div>${inc||out?waterSvg(st):'<p class="empty">Sem lançamentos neste mês.</p>'}<p class="empty" style="padding:var(--space-1) 0 0">A primeira barra é o que entrou. Cada barra clara é uma categoria que reduz o que sobrou, até chegar ao ${sal?'saldo final':'resultado'} (barra escura, ou vermelha se negativo).${sal?' O saldo inicial é o das contas no dia 1.':''}</p>`}
function finYear(y,account=S.fay??S.fac){
 const ms=[];for(let m=0;m<12;m++)ms.push(y===today.getFullYear()&&m>today.getMonth()?{f:new Date(y,m,1),p:'',tx:[],inc:0,out:0,by:{}}:finMonth((y-today.getFullYear())*12+m-today.getMonth(),false,account));
 const by={},inc=ms.reduce((a,x)=>a+x.inc,0),out=ms.reduce((a,x)=>a+x.out,0);ms.forEach(x=>Object.entries(x.by).forEach(([k,v])=>{by[k]=(by[k]||0)+v}));
 return{y,ms,inc,out,by,tx:ms.flatMap(x=>x.tx)}}
function yearSummary(d,pv,cur){
 const L=[],sal=d.inc-d.out,rate=d.inc>0?Math.round(sal/d.inc*100):null,act=d.ms.map((m,i)=>({i,m,r:m.inc-m.out})).filter(x=>x.m.inc||x.m.out),n=act.length;
 if(!n)return ['Ainda não há lançamentos neste ano.'];
 L.push(`${cur?'Até agora, em':'Em'} ${d.y}, você recebeu ${BRL(d.inc)} e gastou ${BRL(d.out)}, ${sal>=0?'sobrando':'faltando'} ${BRL(Math.abs(sal))}${rate!==null&&sal>=0?` (taxa de poupança de ${rate}%)`:''}.`);
 if(pv.inc||pv.out){const lim=cur?today.getMonth()+1:12,sp=(x,k)=>x.ms.slice(0,lim).reduce((a,m)=>a+m[k],0),pc=(a,b)=>b>0?Math.round((a/b-1)*100):null,go=pc(sp(d,'out'),sp(pv,'out')),gi=pc(sp(d,'inc'),sp(pv,'inc'));L.push(`Em relação ${cur?'ao mesmo período de':'a'} ${d.y-1}${cur?' (jan a '+MES[today.getMonth()]+')':''}, os gastos ${go===null?'não têm base de comparação':Math.abs(go)<3?'ficaram praticamente iguais':(go>0?'subiram ':'caíram ')+Math.abs(go)+'%'} e as receitas ${gi===null?'não têm base de comparação':Math.abs(gi)<3?'ficaram praticamente iguais':(gi>0?'subiram ':'caíram ')+Math.abs(gi)+'%'}.`)}
 L.push(`Seu gasto médio é de ${BRL(d.out/n)} por mês, considerando os ${n} meses com lançamentos.`);
 const best=[...act].sort((a,b)=>b.r-a.r)[0],worst=[...act].sort((a,b)=>a.r-b.r)[0],big=[...act].sort((a,b)=>b.m.out-a.m.out)[0];
 if(n>1)L.push(`O melhor mês foi ${MES[best.i]} (${best.r>=0?'+':'−'}${BRL(Math.abs(best.r))}) e o pior foi ${MES[worst.i]} (${worst.r>=0?'+':'−'}${BRL(Math.abs(worst.r))}). O mês de maior gasto foi ${MES[big.i]} (${BRL(big.m.out)}).`);
 const pos=act.filter(x=>x.r>0).length;L.push(`Você fechou no positivo em ${pos} de ${n} meses.`);
 const cs=Object.keys(d.by).sort((a,b)=>d.by[b]-d.by[a]);if(cs.length)L.push(`A categoria que mais pesou foi ${cs[0]}, com ${Math.round(d.by[cs[0]]/d.out*100)}% dos gastos (${BRL(d.by[cs[0]])}, cerca de ${BRL(d.by[cs[0]]/n)} por mês).`);
 const gross=d.tx.filter(t=>t.k==='out').reduce((a,t)=>a+(+t.v||0),0),fx=d.tx.filter(t=>t.k==='out'&&(t.rc||t.pc)).reduce((a,t)=>a+(+t.v||0),0);if(gross>0&&fx>0)L.push(`Antes dos estornos, ${Math.round(fx/gross*100)}% das despesas são recorrências ou parcelas.`);
 const bg=d.tx.filter(t=>t.k==='out').sort((a,b)=>b.v-a.v)[0];if(bg)L.push(`O maior gasto isolado foi "${bg.t}", ${BRL(bg.v)}, em ${fmt(bg.d)}.`);
 const fut=finInit().tx.filter(t=>t.k==='out'&&t.pc&&t.d>T).reduce((a,t)=>a+t.v,0);if(cur&&fut>0)L.push(`Ainda há ${BRL(fut)} em parcelas a vencer.`);
 return L}
function relAnual(){
 const F=finInit();genRec();const Y=today.getFullYear()+S.fyr,d=finYear(Y),pv=finYear(Y-1),cur=Y===today.getFullYear(),sal=d.inc-d.out,rate=d.inc>0?Math.round(sal/d.inc*100):null;
 const act=d.ms.map((m,i)=>({i,m,r:m.inc-m.out})).filter(x=>x.m.inc||x.m.out),nAct=act.length||1,best=act.length>1?[...act].sort((a,b)=>b.r-a.r)[0].i:-1,worst=act.length>1?[...act].sort((a,b)=>a.r-b.r)[0].i:-1;
 const cs=Object.keys(d.by).sort((a,b)=>d.by[b]-d.by[a]).slice(0,14),maxr=c=>Math.max(1,...d.ms.map(m=>m.by[c]||0));
 const bigs=d.tx.filter(t=>t.k==='out').sort((a,b)=>b.v-a.v).slice(0,10);
 const gross=d.tx.filter(t=>t.k==='out').reduce((s,t)=>s+(+t.v||0),0);
 const fx=d.tx.filter(t=>t.k==='out'&&(t.rc||t.pc)).reduce((s,t)=>s+(+t.v||0),0),vr=gross-fx;
 const agg=o=>{const ks=Object.keys(o).sort((a,b)=>o[b]-o[a]).slice(0,8),mx=Math.max(1,...ks.map(k=>o[k]));return ks.map((k,i)=>`<div class="cat" style="grid-template-columns:minmax(80px,115px) 1fr auto"><span>${k.startsWith('#')?`<button class="chip tgc" data-a="tagv" data-id="${esc(k.slice(1))}">${esc(k)}</button>`:esc(k)}</span><div class="fb"><i style="width:${o[k]/mx*100}%;background:${PAL8[i%8]}"></i></div><small>${BRL(o[k])}</small></div>`).join('')};
 const sb={},tg={};d.tx.forEach(t=>{if(t.k!=='out')return;if(t.sub)sb[t.cat+' › '+t.sub]=(sb[t.cat+' › '+t.sub]||0)+t.v;tagsU(t).forEach(x=>{tg['#'+x]=(tg['#'+x]||0)+t.v})});
 const sum=yearSummary(d,pv,cur),csv=n=>String(n.toFixed(2)).replace('.',',');
 return `<div class="top"><div><span class="crumb">MEU HUB / FINANÇAS</span><h1>Finanças<span class="sub-ed">Relatório anual</span></h1></div><div class="actions"><button class="pill" data-a="fvw" data-id="mes">Voltar ao mês</button><select class="in" data-fac-year="1" aria-label="Filtrar relatório por conta"><option value="">Todas as contas</option>${accOpts(S.fay??S.fac)}</select><span style="display:inline-flex;gap:var(--space-2);align-items:center"><button class="pill" data-a="fyn" data-n="-1" aria-label="Ano anterior">‹</button><strong>${Y}</strong><button class="pill" data-a="fyn" data-n="1" aria-label="Próximo ano">›</button></span><button class="pill" data-a="fyn" data-n="0">Este ano</button><button class="pill dark" data-a="fexp">Exportar CSV</button></div></div><p id="fexpm" class="empty" role="status"></p>
 <div class="rv4"><div class="stat c-g"><span>Receitas de ${Y}</span><strong>${BRL(d.inc)}</strong></div><div class="stat c-p"><span>Despesas de ${Y}</span><strong>${BRL(d.out)}</strong></div><div class="stat ${sal<0?'c-y':'c-b'}"><span>Resultado do ano${rate!==null?' · poupança '+rate+'%':''}</span><strong>${BRL(sal)}</strong></div><div class="stat c-y"><span>Gasto médio por mês</span><strong>${BRL(d.out/nAct)}</strong></div></div>
 <div class="cards" style="margin-top:var(--space-3)">
 <div class="panel c4"><h2>Resumo de ${Y}</h2>${sum.map(s=>`<p style="margin:0 0 var(--space-2)">${esc(s)}</p>`).join('')}</div>
 <div class="panel c2"><h2>Fixo e variável</h2>${gross>0?`<div class="cat" style="grid-template-columns:80px 1fr auto"><span>Fixo</span><div class="fb"><i style="width:${fx/gross*100}%;background:var(--blue)"></i></div><small>${BRL(fx)} (${Math.round(fx/gross*100)}%)</small></div><div class="cat" style="grid-template-columns:80px 1fr auto"><span>Variável</span><div class="fb"><i style="width:${vr/gross*100}%;background:var(--pink)"></i></div><small>${BRL(vr)} (${Math.round(vr/gross*100)}%)</small></div><p class="empty" style="padding:0">Valores antes dos estornos. Fixo inclui recorrências e parcelas.</p>`:'<p class="empty">Sem despesas neste ano.</p>'}</div>
 <div class="panel"><h2>Receitas e despesas mês a mês</h2>${barsSvg(d.ms.map((m,i)=>({f:m.f,inc:m.inc,out:m.out,fut:cur&&i>today.getMonth()})))}<div class="bar" style="margin:var(--space-2) 0 0;font-size:var(--type-small)"><span><i class="lg" style="background:var(--s1)"></i>Receitas</span><span><i class="lg" style="background:var(--s2)"></i>Despesas</span><span><i class="lg" style="background:var(--ink)"></i>Saldo do mês</span></div></div>
 <div class="panel"><h2>Cascata do ano</h2>${d.inc||d.out?waterSvg(waterSteps(d.by,d.inc,d.out)):'<p class="empty">Sem lançamentos neste ano.</p>'}<p class="empty" style="padding:var(--space-1) 0 0">Das receitas do ano, quanto foi para cada categoria até chegar ao resultado.</p></div>
 <div class="panel"><h2>Mês a mês</h2><div style="overflow-x:auto"><table class="yt"><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th><th>Poupança</th></tr></thead><tbody>${d.ms.map((m,i)=>{const r=m.inc-m.out;return `<tr><td>${MES[i]}${i===best?' <span class="chip c-g">melhor</span>':i===worst?' <span class="chip c-p">pior</span>':''}</td><td>${BRL(m.inc)}</td><td>${BRL(m.out)}</td><td class="${r<0?'neg':'pos'}">${m.inc||m.out?BRL(r):'–'}</td><td>${m.inc>0?Math.round(r/m.inc*100)+'%':'–'}</td></tr>`}).join('')}<tr style="font-weight:600"><td>Total</td><td>${BRL(d.inc)}</td><td>${BRL(d.out)}</td><td class="${sal<0?'neg':'pos'}">${BRL(sal)}</td><td>${rate!==null?rate+'%':'–'}</td></tr></tbody></table></div></div>
 <div class="panel"><h2>Categorias ao longo do ano</h2>${cs.length?`<div style="overflow-x:auto"><div class="ymx" style="min-width:560px"><span></span>${MES.map(m=>`<small class="ymh">${m}</small>`).join('')}<span class="ymh">Total</span>${cs.map(c=>{const mx=maxr(c);return `<span class="ymc">${esc(c)}</span>${d.ms.map((m,i)=>{const v=m.by[c]||0,l=v>0?Math.ceil(4*v/mx):0;return `<i class="hm p${l}" title="${MES[i]} · ${esc(c)}: ${BRL(v)}"></i>`}).join('')}<small class="ymt">${BRL(d.by[c])}</small>`}).join('')}</div></div><p class="empty" style="padding:var(--space-2) 0 0">Cada linha tem a própria escala: o quadrado mais escuro é o mês de maior gasto daquela categoria. Média por mês com movimento: ${cs.slice(0,3).map(c=>esc(c)+' '+BRL(d.by[c]/nAct)).join(' · ')}.</p>`:'<p class="empty">Sem despesas neste ano.</p>'}</div>
 <div class="panel c2"><h2>Maiores gastos do ano</h2>${bigs.map(t=>`<div class="item"><div class="t">${esc(t.t)}<small>${fmt(t.d)} · ${esc(t.cat)}${t.sub?' › '+esc(t.sub):''}</small></div><strong class="neg">− ${BRL(t.v)}</strong></div>`).join('')||'<p class="empty">Sem despesas neste ano.</p>'}</div>
 <div class="panel c2"><h2>Subcategorias do ano</h2>${agg(sb)||'<p class="empty">Preencha a subcategoria nos lançamentos para ver o detalhe.</p>'}</div>
 <div class="panel c2"><h2>Etiquetas do ano</h2>${agg(tg)||'<p class="empty">Etiquete lançamentos para ver o total por etiqueta.</p>'}</div>
 </div>`}
function exportYear(){
 const Y=today.getFullYear()+S.fyr,d=finYear(Y),m=$('#fexpm'),nAct=d.ms.filter(x=>x.inc||x.out).length||1,f=n=>String(n.toFixed(2)).replace('.',',');
 const rows=[['Relatório financeiro',Y],[],['Mês','Receitas','Despesas','Resultado'],...d.ms.map((x,i)=>[MES[i],f(x.inc),f(x.out),f(x.inc-x.out)]),['Total',f(d.inc),f(d.out),f(d.inc-d.out)],[],['Categoria','Total','Média por mês com movimento','% dos gastos'],...Object.keys(d.by).sort((a,b)=>d.by[b]-d.by[a]).map(c=>[c,f(d.by[c]),f(d.by[c]/nAct),d.out?Math.round(d.by[c]/d.out*100)+'%':'0%'])];
 const csv='\uFEFF'+rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 siteSave('relatorio-financeiro-'+Y+'.csv',csv,'text/csv');if(m)m.textContent='Relatório baixado.';
}

/* ===== Correções: resumo comparável e validação de transferência ===== */
function partMonth(o,day){const m=finMonth(o),s=sumAbated(m.tx.filter(t=>+t.d.slice(8)<=day));return{out:s.out,by:s.by}}
function summaryPanel(){
 const F=finInit(),c0=finMonth(),pv=finMonth(S.fmo-1),mn=MES[c0.f.getMonth()],pn=MES[pv.f.getMonth()],cur=S.fmo===0,dd=today.getDate(),L=[];
 const real=c0.tx.filter(t=>!cur||t.d<=T),{inc,out,by}=sumAbated(real);
 if(!real.length)return `<div class="panel c4 hero"><h2>Resumo de ${mn}</h2><p class="empty">Ainda não há lançamentos neste mês.</p></div>`;
 const c={f:c0.f,inc,out,by,tx:real},pp=cur?partMonth(S.fmo-1,dd):{out:pv.out,by:pv.by},pt=cur?` no mesmo ponto do mês, até o dia ${dd}`:'';
 const sal=c.inc-c.out,rate=c.inc>0?Math.round(sal/c.inc*100):null;
 L.push(`${cur?'Até agora, em':'Em'} ${mn}, você recebeu ${BRL(c.inc)} e gastou ${BRL(c.out)}, ${sal>=0?'sobrando':'faltando'} ${BRL(Math.abs(sal))}${rate!==null&&sal>=0?` (taxa de poupança de ${rate}%)`:''}.`);
 if(pp.out>0){const d=Math.round((c.out/pp.out-1)*100);L.push(Math.abs(d)<3?`Seus gastos estão praticamente iguais aos de ${pn}${pt} (${BRL(pp.out)}).`:`Seus gastos estão ${Math.abs(d)}% ${d>0?'acima':'abaixo'} dos de ${pn}${pt}: ${BRL(c.out)} contra ${BRL(pp.out)}.`)}
 const cats=Object.keys(c.by).sort((a,b)=>c.by[b]-c.by[a]);
 if(cats.length){L.push(`A maior categoria é ${cats[0]}, com ${Math.round(c.by[cats[0]]/c.out*100)}% dos gastos (${BRL(c.by[cats[0]])}).`);
  if(pp.out>0){const ch=[...new Set([...cats,...Object.keys(pp.by)])].map(k=>[k,(c.by[k]||0)-(pp.by[k]||0)]).sort((a,b)=>b[1]-a[1]);
   if(ch[0][1]>0)L.push(`O maior aumento${cur?' em relação ao mesmo ponto de '+pn:''} foi em ${ch[0][0]} (+${BRL(ch[0][1])}).`);
   const dr=ch[ch.length-1];if(dr[1]<0&&dr[0]!==ch[0][0])L.push(`A maior queda foi em ${dr[0]} (−${BRL(-dr[1])}).`)}}
 const big=real.filter(t=>t.k==='out').sort((a,b)=>b.v-a.v)[0];if(big)L.push(`O maior gasto foi "${big.t}", ${BRL(big.v)}, em ${fmt(big.d)}.`);
 const dim=dimOf(c0.f.getFullYear(),c0.f.getMonth()),exp=S.fmo<0?1:S.fmo>0?0:dd/dim,bu=Object.entries(budgetsAt(ds(c0.f).slice(0,7))).map(([k,l])=>[k,(c.by[k]||0)/l]);
 if(bu.length){const bad=bu.filter(x=>x[1]>=1).map(x=>x[0]),warn=bu.filter(x=>x[1]<1&&x[1]>exp).map(x=>x[0]);L.push(!bad.length&&!warn.length?'Todos os orçamentos estão dentro do ritmo.':`Orçamentos: ${bad.length?bad.join(', ')+' estourou'+(bad.length>1?'aram':''):''}${bad.length&&warn.length?'; ':''}${warn.length?warn.join(', ')+' está'+(warn.length>1?'ão':'')+' acima do ritmo':''}.`)}
 const fut=F.tx.filter(t=>t.k==='out'&&t.d>T&&t.d<=ds(add(today,30))).reduce((a,t)=>a+t.v,0);if(fut>0)L.push(`Nos próximos 30 dias já há ${BRL(fut)} comprometidos em parcelas e lançamentos agendados.`);
 if(cur){const sv=S.flm;S.flm='res';const lc=lineChart();S.flm=sv;L.push(`Você gasta em média ${BRL(c.out/dd)} por dia${lc.proj?`; no ritmo atual, o mês deve fechar com um resultado de ${BRL(lc.end)}`:''}.`)}
 return `<div class="panel c4 hero"><h2>Resumo de ${mn}</h2>${L.map(s=>`<p style="margin:0 0 var(--space-2)">${esc(s)}</p>`).join('')}</div>`}
function trValid(f){if(!f||f.id!=='ffin')return;const to=f.querySelector('[name=to]'),ac=f.querySelector('[name=ac]');if(!to||!ac)return;to.setCustomValidity(f.classList.contains('ktr')?(S.fin.acc.length<2?'Cadastre uma segunda conta em "Contas e recorrentes" para fazer transferências':ac.value===to.value?'Escolha uma conta de destino diferente da origem':''):'')}
document.addEventListener('change',e=>{const i=e.target;if(i&&i.form&&i.form.id==='ffin'&&(i.name==='k'||i.name==='ac'||i.name==='to'))trValid(i.form)});

/* ===== Pacote D: fluxo de caixa previsto e comparação anual ===== */
function cashAccounts(F,fac){return F.acc.filter(a=>fac?a.id===fac:a.ty!=='card')}
function cashDelta(t,accounts){
 const owner=accounts.has(accId(t)),v=+t.v||0;
 if(t.k==='tr')return (accounts.has(t.to)?v:0)-(owner?v:0);
 if(!owner)return 0;
 return t.k==='in'?v:t.k==='out'?-v:0;
}
function cashFlow(o){
 const F=finInit(),H=o.days,fac=o.fac||'',set=new Set(cashAccounts(F,fac).map(a=>a.id));
 if(!set.size)return null;
 let start=0;set.forEach(id=>{start+=bal(F.acc.find(x=>x.id===id))});
 const endD=ds(add(today,H)),evs=[],push=(d,t,v,k)=>{v=+v;if(v&&d>T&&d<=endD)evs.push({d,t,v,k})};
 F.tx.forEach(t=>{if(t.d<=T||t.d>endD)return;const v=cashDelta(t,set);if(v)push(t.d,t.t,v,v>0?'in':'out')});
 for(let i=0;i<=Math.ceil(H/28)+1;i++){
  const m0=new Date(today.getFullYear(),today.getMonth()+i,1),y=m0.getFullYear(),mo=m0.getMonth(),p=ds(m0).slice(0,7),N=dimOf(y,mo);
  F.rec.forEach(r=>{const ac=r.ac||F.acc[0].id;if(!set.has(ac))return;const dd=Math.min(+r.day||1,N),d=ds(new Date(y,mo,dd)),id='r_'+r.id+'_'+p;if(d>T&&recurringAllowed(r,d)&&!F.tx.some(t=>t.id===id))push(d,r.t,r.k==='in'?r.v:-r.v,r.k==='in'?'in':'out')});
  F.bills.forEach(b=>{if(fac&&b.ac!==fac)return;const d=ds(new Date(y,mo,Math.min(+b.day||1,N)));if(!billInRange(b,d)||(b.rec&&F.rec.some(r=>r.id===b.rec)))return;push(d,b.n,-b.v,'bill')})}
 if(!fac)F.acc.filter(a=>a.ty==='card').forEach(a=>[-1,0,1,2,3].forEach(off=>{const iv=invoice(a,off);if(iv.due>T&&iv.due<=endD&&iv.left>0)push(iv.due,'Fatura '+a.n,-iv.left,'card')}));
 let vs=0;const from=ds(add(today,-60));F.tx.forEach(t=>{const a=F.acc.find(x=>x.id===accId(t));if(t.k==='out'&&!t.rc&&!t.pc&&a&&a.ty!=='card'&&t.d>from&&t.d<=T&&(!fac||accId(t)===fac))vs+=t.v});
 const avg=o.vary?vs/60:0,by={};evs.forEach(e=>(by[e.d]=by[e.d]||[]).push(e));
 let b=start;const pts=[{d:T,v:b,ev:[]}];let minP=pts[0],firstNeg=b<0?pts[0]:null;
 for(let i=1;i<=H;i++){const d=ds(add(today,i));let ch=-avg;(by[d]||[]).forEach(e=>ch+=e.v);b+=ch;const q={d,v:b,ev:by[d]||[]};pts.push(q);if(b<minP.v)minP=q;if(b<0&&!firstNeg)firstNeg=q}
 return{start,pts,evs:evs.sort((a,c)=>a.d.localeCompare(c.d)),avg,minP,firstNeg,end:b,H}}
function nextIncomePanel(){
 const F=finInit(),a=F.acc.find(x=>x.id===F.primary&&x.ty!=='card'),head='<div class="panel c2"><h2>Até o próximo recebimento</h2>';
 if(!a)return head+'<p>Escolha uma conta principal em Contas e recorrentes para ver a previsão.</p></div>';
 const recurring=F.rec.filter(r=>r.k==='in'&&(r.ac||F.acc[0].id)===a.id).flatMap(r=>[...Array(13)].map((_,i)=>{const m=new Date(today.getFullYear(),today.getMonth()+i,1),d=ds(new Date(m.getFullYear(),m.getMonth(),Math.min(+r.day||1,dimOf(m.getFullYear(),m.getMonth())))),id='r_'+r.id+'_'+d.slice(0,7);return d>T&&recurringAllowed(r,d)&&!F.tx.some(t=>t.id===id)?{d}:null}).filter(Boolean));
 const next=[...F.tx.filter(t=>t.k==='in'&&t.d>T&&accId(t)===a.id),...recurring].sort((x,y)=>x.d.localeCompare(y.d))[0];
 if(!next)return head+`<p>Nenhuma receita futura cadastrada em ${esc(a.n)}.</p></div>`;
 const days=Math.round((new Date(next.d+'T12:00')-new Date(T+'T12:00'))/864e5);if(days>366)return head+'<p>A próxima receita está a mais de 366 dias; a previsão não está disponível para esse intervalo.</p></div>';
 const c=cashFlow({days,fac:a.id,vary:false}),included=c.evs.filter(e=>e.d<next.d||e.v<0),v=c.start+included.reduce((sum,e)=>sum+e.v,0);
 const accounts=new Set(F.acc.filter(x=>x.ty!=='card').map(x=>x.id)),unlinked=F.bills.filter(b=>{const d=nextBillDate(b);return d>=T&&d<=next.d&&billInRange(b,d)&&!accounts.has(b.ac)&&(!b.rec||!F.rec.some(r=>r.id===b.rec))}).length;
 return head+`<p>Estimativa antes de receber em ${fmt(next.d)}: <strong>${BRL(v)}</strong> em ${esc(a.n)}.</p>${unlinked?`<p>${unlinked} ${unlinked===1?'conta fixa sem conta de pagamento fica':'contas fixas sem conta de pagamento ficam'} fora da previsão. <button class="pill" data-v="avisos">Conferir vínculos</button></p>`:''}<details><summary>Como esta previsão foi calculada</summary><p>Saldo de partida: ${BRL(c.start)}.</p>${included.map(e=>`<div class="item"><div class="t">${esc(e.t)}<small>${fmt(e.d)}</small></div><span>${e.v<0?'−':'+'} ${BRL(Math.abs(e.v))}</span></div>`).join('')||'<p class="empty">Nenhuma movimentação prevista no período.</p>'}<p>Total estimado: ${BRL(v)}.</p></details><p class="empty">O saldo de partida inclui lançamentos de hoje. A estimativa inclui despesas previstas até a data, inclusive no dia do recebimento; entradas nesse dia não entram. Não inclui faturas sem pagamento agendado nem contas sem conta de pagamento vinculada; confira esses valores. Contas fixas independentes podem coincidir com lançamentos; confira possíveis duplicatas. Gastos ainda não cadastrados não entram.</p></div>`}
function monthCashPanel(f,account){
 const title='<h2>Fluxo de caixa do mês</h2>';
 const shell=content=>`<section class="panel finance-month-flow">${title}${content}</section>`;
 if(account?.ty==='card')return shell('<p>Escolha uma conta com saldo ou “Todas as contas” para ver o caixa. Os pagamentos do cartão entram no caixa da conta que os paga.</p>');
 const F=finInit(),fac=account?.id||'',accounts=cashAccounts(F,fac),scope=account?esc(account.n):'Contas sem cartão';
 if(!accounts.length)return shell('<p>Cadastre uma conta com saldo para ver o fluxo de caixa.</p>');
 const N=dimOf(f.getFullYear(),f.getMonth()),openingDay=ds(add(f,-1)),end=ds(add(f,N-1));
 const horizon=Math.max(0,Math.round((new Date(end+'T12:00')-new Date(T+'T12:00'))/864e5));
 if(horizon>366)return shell('<p>A projeção está disponível até 366 dias à frente.</p>');
 const forecast=horizon?cashFlow({days:horizon,fac,vary:false}):null;
 const planned=new Map((forecast?.pts||[]).map(p=>[p.d,p.v])),ids=new Set(accounts.map(a=>a.id)),byDay=new Map();
 let opening=accounts.reduce((sum,a)=>sum+(+a.ini||0),0),hasData=accounts.some(a=>Number(a.ini));
 for(const t of F.tx){
  if(t.d>T||t.d>end)continue;
  const delta=cashDelta(t,ids);
  if(!delta)continue;
  hasData=true;
  if(t.d<openingDay)opening+=delta;
  else byDay.set(t.d,(byDay.get(t.d)||0)+delta);
 }
 if(!hasData&&!forecast?.evs.length)return shell(`<p class="empty">${scope} · ${MES[f.getMonth()]} de ${f.getFullYear()}.</p><p>Sem saldo inicial ou movimentações cadastradas para projetar o mês.</p>`);
 const points=[];
 let running=opening;
 for(let day=-1;day<N;day++){
  const d=ds(add(f,day));
  running=d>T?(planned.get(d)??running):running+(byDay.get(d)||0);
  points.push({d,v:running});
 }
 const cut=points.findLastIndex(p=>p.d<=T),actual=points[cut],last=points.at(-1);
 const text=`${actual?`Saldo registrado em ${fmt(actual.d)}: <strong>${BRL(actual.v)}</strong>.`:''}
  ${cut<N?`Saldo previsto em ${fmt(end)}: <strong class="${last.v<0?'neg':''}">${BRL(last.v)}</strong>.`:''}`;
 return shell(`<p class="empty">${scope} · ${MES[f.getMonth()]} de ${f.getFullYear()}.</p>
 <p>${text}</p>${cashSvg({pts:points,H:N,evs:[],month:true,cut})}
 ${actual||cut<N?`<div class="bar finance-flow-key">${actual?'<span>Realizado</span>':''}${cut<N?'<span class="projected">Previsto</span>':''}</div>`:''}
 ${cut<N?`<p class="empty">A previsão considera as movimentações cadastradas. ${fac?'Faturas entram quando têm pagamento agendado nesta conta, e contas fixas precisam estar vinculadas a ela.':'Faturas entram pelo valor restante, descontando os pagamentos cadastrados.'}</p>`:''}`);
}
function cashSvg(c){
 const W=c.month?(innerWidth>860?650:380):540,H=c.month?190:235,L=46,R=14,T0=14,B=26,pw=W-L-R,ph=H-T0-B,vals=c.pts.map(p=>p.v),mx0=Math.max(...vals),mn0=Math.min(...vals),pd=Math.max(1,(mx0-mn0)*.12),hi=mx0+pd,lo=mn0<0?mn0-pd:Math.max(0,mn0-pd),x=i=>L+pw*i/c.H,y=v=>T0+ph*(hi-v)/((hi-lo)||1);
 let g='';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 const step=Math.max(1,Math.round(c.H/5));for(let i=0;i<=c.H;i+=step)g+=`<text x="${x(i)}" y="${H-8}" text-anchor="${i===0?'start':i+step>c.H?'end':'middle'}">${fmt(c.pts[i].d)}</text>`;
 const pl=c.pts.map((p,i)=>x(i)+','+y(p.v)).join(' '),z=y(0);
 const neg=lo<0?`<rect x="${L}" y="${z}" width="${pw}" height="${Math.max(0,T0+ph-z)}" fill="var(--neg)" opacity=".1"/>`:'';
 const big=[...c.evs].sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,8).map(e=>{const i=Math.round((new Date(e.d+'T00:00')-new Date(T+'T00:00'))/864e5),p=c.pts[i];return p?`<circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" fill="${e.v>0?'var(--green)':'var(--neg)'}"><title>${esc(e.t)}: ${BRL(e.v)} em ${fmt(e.d)}</title></circle>`:''}).join('');
 const fn=c.firstNeg?(()=>{const i=c.pts.indexOf(c.firstNeg);return `<line x1="${x(i)}" x2="${x(i)}" y1="${T0}" y2="${T0+ph}" stroke="var(--neg)" stroke-dasharray="3 3"/>`})():'';
 const monthly=c.month,cut=c.cut;
 const trace=(from,to,projected)=>to>=from&&`<polyline points="${c.pts.slice(from,to+1).map((p,i)=>x(i+from)+','+y(p.v)).join(' ')}" fill="none" stroke="var(--s1)" stroke-width="2.5" ${projected?'stroke-dasharray="6 5"':''}/>`;
 const lines=monthly?`${cut>=0?trace(0,cut,false):''}${cut<c.H?trace(Math.max(0,cut),c.H,true):''}`:`<polyline points="${pl}" fill="none" stroke="var(--s1)" stroke-width="2.5"/>`;
 const label=monthly?'Fluxo de caixa do mês. Linha contínua para valores realizados e tracejada para previstos.':`Saldo previsto para os próximos ${c.H} dias: hoje ${BRL(c.start)}, ao final ${BRL(c.end)}, menor saldo ${BRL(c.minP.v)} em ${fmt(c.minP.d)}`;
 return `<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${g}${neg}${lo<0?`<line x1="${L}" x2="${W-R}" y1="${z}" y2="${z}" stroke="var(--mute)" stroke-dasharray="2 4"/>`:''}${fn}${lines}${big}</svg>`}
function cashPanel(){
 const F=finInit(),H=S.fcn||30,vary=S.fcv!==false,a=S.fac?F.acc.find(x=>x.id===S.fac):null;
 const head=`<div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Fluxo de caixa previsto</h2><span style="display:flex;gap:var(--space-2);flex-wrap:wrap">${[30,60,90].map(n=>`<button class="pill ${H===n?'on':''}" data-a="fcn" data-id="${n}" aria-pressed="${H===n}">${n} dias</button>`).join('')}<button class="pill ${vary?'on':''}" data-a="fcv" aria-pressed="${vary}">Gastos variáveis</button></span></div>`;
 if(a&&a.ty==='card')return head+'<p class="empty">Cartões não têm caixa próprio: o que você gasta nele aparece como fatura, paga pela conta. Escolha “Todas as contas” ou uma conta corrente.</p>';
 const c=cashFlow({days:H,fac:S.fac,vary});if(!c)return head+'<p class="empty">Cadastre uma conta corrente para ver a previsão.</p>';
 const al=c.firstNeg?`<p class="late" role="alert" style="margin:0 0 var(--space-2);font-weight:500">Atenção: ${c.firstNeg.d===T?'o saldo já está negativo hoje':'o saldo previsto fica negativo em '+fmt(c.firstNeg.d)} (${BRL(c.firstNeg.v)}). Menor saldo: ${BRL(c.minP.v)} em ${fmt(c.minP.d)}.</p>`:`<p style="margin:0 0 var(--space-2)">Sem saldo negativo previsto nos próximos ${H} dias. Menor saldo: <strong>${BRL(c.minP.v)}</strong> em ${fmt(c.minP.d)}.</p>`;
 const nx=c.evs.slice(0,8),tl={in:'Receita',out:'Despesa',bill:'Conta fixa',card:'Fatura'};
 return head+`<div class="two" style="gap:var(--space-4)"><div>${al}${cashSvg(c)}<div class="bar" style="margin:var(--space-2) 0 0;font-size:var(--type-small)"><span><i class="lg" style="background:var(--s1)"></i>Saldo previsto</span><span><i class="lg" style="background:var(--green)"></i>Entrada grande</span><span><i class="lg" style="background:var(--neg)"></i>Saída grande</span></div><p class="empty" style="padding:var(--space-1) 0 0">Hoje: <strong>${BRL(c.start)}</strong> · em ${fmt(c.pts[c.H].d)}: <strong class="${c.end<0?'neg':'pos'}">${BRL(c.end)}</strong>. ${S.fac?'Considera lançamentos e recorrências desta conta. Contas fixas sem vínculo e faturas sem conta de pagamento definida não entram.':'Considera lançamentos futuros, parcelas, recorrências, contas fixas e faturas de cartão. Confira transferências antigas não vinculadas'}${vary?`, mais a média dos gastos variáveis fora do cartão (${BRL(c.avg)} por dia, últimos 60 dias)`:''}.</p></div>
 <div><h3 class="gh" style="margin-top:0">Próximos movimentos</h3>${nx.map(e=>`<div class="item"><span class="chip c-${e.k==='in'?'g':e.k==='card'?'b':e.k==='bill'?'y':'p'}">${fmt(e.d)}</span><div class="t">${esc(e.t)}<small>${tl[e.k]}</small></div><strong class="${e.v>0?'pos':''}">${e.v>0?'+ ':'− '}${BRL(Math.abs(e.v))}</strong></div>`).join('')||'<p class="empty">Nada agendado neste período.</p>'}</div></div>`}
function yoyPanel(){
 const F=finInit(),f=new Date(today.getFullYear(),today.getMonth()+S.fmo,1),Y=f.getFullYear(),m=f.getMonth(),part=S.fmo===0,dc=part?today.getDate():31,exp=(S.fyo||'out')==='out';
 const ok=t=>!S.fac||accId(t)===S.fac||t.to===S.fac;
 const sum=(y,m1,m2,dm)=>sumAbated(F.tx.filter(t=>{if(!ok(t))return false;const yy=+t.d.slice(0,4),mo=+t.d.slice(5,7)-1,dd=+t.d.slice(8);return yy===y&&mo>=m1&&mo<=m2&&(mo<m2||dd<=dm)}));
 const c1=sum(Y,m,m,dc),p1=sum(Y-1,m,m,dc),c2=sum(Y,0,m,dc),p2=sum(Y-1,0,m,dc),mn=MES[m],per=mn+' '+Y+' × '+mn+' '+(Y-1)+(part?' (até o dia '+dc+')':'');
 const head=`<h2>Comparação com o ano anterior</h2><p class="empty" style="padding:0 0 var(--space-2)">${per}</p>`;
 if(!(p1.inc+p1.out)&&!(p2.inc+p2.out))return head+`<p class="empty">Ainda não há lançamentos em ${Y-1} para comparar. Importe um extrato antigo na aba Regras e importação para ver a comparação.</p>`;
 const dl=(c,p,bad)=>{if(!p)return c?'<span class="empty" style="padding:0">novo</span>':'–';const v=Math.round((c-p)/p*100);return `<span class="${v===0?'':(bad?v>0:v<0)?'neg':'pos'}">${v>0?'+':''}${v}%</span>`};
 const row=(l,c,p,bad)=>`<tr><th scope="row" style="text-align:left;font-weight:400">${l}</th><td>${BRL(p)}</td><td>${BRL(c)}</td><td>${dl(c,p,bad)}</td></tr>`;
 const r1=c1.inc-c1.out,r0=p1.inc-p1.out,y1=c2.inc-c2.out,y0=p2.inc-p2.out;
 const cats=[...new Set([...Object.keys(c1.by),...Object.keys(p1.by)])].map(k=>({k,c:c1.by[k]||0,p:p1.by[k]||0})).sort((a,b)=>Math.max(b.c,b.p)-Math.max(a.c,a.p)).slice(0,8);
 const up=[...cats].sort((a,b)=>(b.c-b.p)-(a.c-a.p)),ins=[];
 if(p1.out>0)ins.push(`Despesas ${c1.out>=p1.out?(Math.round((c1.out/p1.out-1)*100)+'% maiores'):(Math.round((1-c1.out/p1.out)*100)+'% menores')} que no mesmo período de ${Y-1}.`);
 if(up[0]&&up[0].c-up[0].p>0)ins.push(`Maior aumento: <strong>${esc(up[0].k)}</strong> (+${BRL(up[0].c-up[0].p)}).`);
 const dn=up[up.length-1];if(dn&&dn.c-dn.p<0)ins.push(`Maior queda: <strong>${esc(dn.k)}</strong> (−${BRL(dn.p-dn.c)}).`);
 return head+`${ins.length?`<p style="margin:0 0 var(--space-2)">${ins.join(' ')}</p>`:''}<div class="two" style="gap:var(--space-4)"><div><div style="overflow-x:auto"><table class="yt"><thead><tr><th scope="col"></th><th scope="col">${Y-1}</th><th scope="col">${Y}</th><th scope="col">Variação</th></tr></thead><tbody>${row('Receitas do mês',c1.inc,p1.inc,false)}${row('Despesas do mês',c1.out,p1.out,true)}${row('Resultado do mês',r1,r0,false)}${row('Receitas jan–'+mn,c2.inc,p2.inc,false)}${row('Despesas jan–'+mn,c2.out,p2.out,true)}${row('Resultado jan–'+mn,y1,y0,false)}</tbody></table></div>
 <h3 class="gh">Despesas por categoria</h3>${cats.map(x=>{const mx=Math.max(x.c,x.p,1);return `<div class="cat" style="grid-template-columns:110px 1fr auto"><span>${esc(x.k)}</span><div aria-hidden="true"><div class="fb" style="height:7px;margin-bottom:var(--space-1)"><i style="width:${x.p/mx*100}%;background:var(--mute)"></i></div><div class="fb" style="height:7px"><i style="width:${x.c/mx*100}%;background:var(--pink)"></i></div></div><small>${BRL(x.p)} → ${BRL(x.c)} ${dl(x.c,x.p,true)}</small></div>`}).join('')||'<p class="empty">Sem despesas nesses períodos.</p>'}</div>
 <div><div class="top" style="margin:0 0 var(--space-2)"><h3 class="gh" style="margin:0">Mês a mês: ${Y-1} × ${Y}</h3><span style="display:flex;gap:var(--space-2)"><button class="pill ${exp?'on':''}" data-a="fyo" data-id="out" aria-pressed="${exp}">Despesas</button><button class="pill ${!exp?'on':''}" data-a="fyo" data-id="in" aria-pressed="${!exp}">Receitas</button></span></div>${yoySvg(Y,exp)}<div class="bar" style="margin:var(--space-2) 0 0;font-size:var(--type-small)"><span><i class="lg" style="background:var(--mute)"></i>${Y-1}</span><span><i class="lg" style="background:${exp?'var(--pink)':'var(--green)'}"></i>${Y}</span></div></div></div>`}
function yoySvg(Y,exp){
 const F=finInit(),ok=t=>!S.fac||accId(t)===S.fac||t.to===S.fac,k=exp?'out':'in',ser=y=>{const a=Array(12).fill(0);F.tx.forEach(t=>{if(t.k===k&&ok(t)&&+t.d.slice(0,4)===y)a[+t.d.slice(5,7)-1]+=t.v});return a};
 const A=ser(Y-1),B=ser(Y),mx=Math.max(1,...A,...B),W=520,H=235,L=42,R=8,T0=12,Bt=26,pw=W-L-R,ph=H-T0-Bt,gw=pw/12,bw=Math.min(18,gw/2-3),y=v=>T0+ph*(1-v/mx);
 let g='';for(let i=0;i<=4;i++){const v=mx*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 const bar=(x0,v,fill,lb)=>v>0?`<rect x="${x0}" y="${y(v)}" width="${bw}" height="${T0+ph-y(v)}" rx="2" fill="${fill}"><title>${lb}: ${BRL(v)}</title></rect>`:'';
 const bars=A.map((a,i)=>{const cx=L+gw*(i+.5);return bar(cx-bw-1,a,'var(--mute)',MES[i]+' '+(Y-1))+bar(cx+1,B[i],exp?'var(--pink)':'var(--green)',MES[i]+' '+Y)+`<text x="${cx}" y="${H-10}" text-anchor="middle">${MES[i]}</text>`}).join('');
 const tt=a=>a.reduce((s,v)=>s+v,0);
 return `<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="${exp?'Despesas':'Receitas'} por mês, ${Y-1} e ${Y}. Total ${Y-1}: ${BRL(tt(A))}. Total ${Y}: ${BRL(tt(B))}">${g}${bars}</svg>`}
/* ===== Pacote E: reserva, metas por percentual e divisão de despesas ===== */
const mNet=o=>finMonth(o,true);
function avgOut3(){const a=[1,2,3].map(i=>{const m=mNet(-i);return m.out-(m.by.Reserva||0)}).filter(v=>v>0);return a.length?a.reduce((s,v)=>s+v,0)/a.length:0}
function avgSave3(){return [1,2,3].reduce((s,i)=>{const m=mNet(-i);return s+m.inc-m.out},0)/3}
function reservaPanel(projection=closingProjection()){
 const F=finInit(),R=F.goals.filter(g=>g.res),avg=avgOut3(),sv=avgSave3();
 const head='<h2>Reserva de emergência</h2>';
 const form=`<form class="bar" id="fres" style="margin:var(--space-2) 0 0"><select class="in" name="rm" aria-label="Meses de cobertura">${[3,6,9,12].map(n=>`<option value="${n}" ${n===6?'selected':''}>${n} meses de despesas</option>`).join('')}</select><input data-fin-private class="in" name="saved" type="text" inputmode="decimal" autocomplete="off" placeholder="Já guardado (opcional)" style="width:170px"><input data-fin-private class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor alvo (opcional)" style="width:160px"><button class="pill dark">Criar reserva</button></form>`;
 if(!R.length)return head+`<p class="empty" style="padding:0 0 var(--space-1)">A reserva cobre seus gastos se a renda parar. O alvo é calculado pela média de despesas dos últimos 3 meses, sem contar os aportes na categoria Reserva${avg?' (hoje, '+BRL(avg)+' por mês)':''}.</p>`+`<details id="fin-reserve-form"><summary>Criar reserva de emergência</summary>${form}</details>`;
 return head+R.map(g=>{
  const saved=closingGoalBalance(g,projection),tg=+g.target||0,p=tg?Math.min(100,Math.round(saved/tg*100)):0,cov=avg?saved/avg:0,rest=Math.max(0,tg-saved),drift=avg&&tg?Math.abs((g.rm||6)*avg-tg)/tg>.1:false;
  let eta='';if(rest<=0)eta='Reserva completa.';else if(sv>0){const n=Math.ceil(rest/sv),d=new Date(today.getFullYear(),today.getMonth()+n,1);eta=`No ritmo de poupança dos últimos 3 meses (${BRL(sv)} por mês), você chega lá em <strong>${n} ${n===1?'mês':'meses'}</strong> (${MES[d.getMonth()]}/${d.getFullYear()}).`}else eta='Sua poupança média recente é zero ou negativa, então ainda não dá para estimar o prazo.';
  return `<div class="item" style="flex-wrap:wrap"><div class="t"><strong>${esc(g.n)}</strong><small>${BRL(saved)} de ${BRL(tg)} (${p}%)</small>${avg?`<p class="reserve-coverage"><strong>${cov.toFixed(1).replace('.',',')}</strong> meses de despesas cobertos</p>`:'<small>Sem base de despesas para estimar a cobertura.</small>'}<div class="fb" style="margin:var(--space-2) 0"><i style="width:${p}%"></i></div><small>${eta}</small>${drift?`<small class="late">Sua média de despesas mudou: a meta de ${g.rm||6} meses seria ${BRL((g.rm||6)*avg)}. <button class="pill" data-a="resrec" data-id="${g.id}">Recalcular meta</button></small>`:''}</div><select class="in" data-rm="${g.id}" aria-label="Meses de cobertura">${[3,6,9,12].map(n=>`<option value="${n}" ${(g.rm||6)===n?'selected':''}>${n} meses</option>`).join('')}</select><input data-fin-private class="in" data-gdep="${g.id}" type="text" inputmode="decimal" autocomplete="off" placeholder="+ depositar" aria-label="Depositar na reserva" style="width:130px"></div>`}).join('')}
const prName=r=>r.k==='save'?'Poupar '+r.pc+'% da renda':(r.cat||'Categoria')+' até '+r.pc+'% da renda';
function prEval(r,o){const m=mNet(o);if(!(m.inc>0))return null;const sp=r.k==='save'?m.out:(m.by[r.cat]||0),pct=r.k==='save'?(m.inc-m.out)/m.inc*100:sp/m.inc*100;return{pct,ok:r.k==='save'?pct>=r.pc:pct<=r.pc,inc:m.inc,sp}}
function prMonths(r){let n=0,met=0;for(let o=-1;o>=-6;o--){const e=prEval(r,o);if(e){n++;if(e.ok)met++}}return{n,met}}
function prStreak(r){let s=0;for(let o=-1;o>=-24;o--){const e=prEval(r,o);if(!e||!e.ok)break;s++}return s}
function prPanel(){
 const F=finInit(),P=F.prules;
 const form=`<form class="bar" id="fpr" style="margin:var(--space-2) 0 0"><select class="in" name="tgt" aria-label="Tipo de meta"><option value="save">Poupar no mínimo</option><optgroup label="Gastar no máximo em…">${FC.map(c=>`<option value="cat:${c}">${c}</option>`).join('')}</optgroup></select><input data-fin-private class="in" name="pc" type="text" inputmode="decimal" autocomplete="off" placeholder="% da renda" required style="width:110px"><button class="pill dark">Criar meta</button></form>`;
 const rows=P.map(r=>{
  const cur=prEval(r,0),ms=prMonths(r),st=prStreak(r);
  let status='Sem receita neste mês ainda para avaliar.';
  if(cur){const allow=r.k==='save'?cur.inc*(1-r.pc/100)-cur.sp:cur.inc*r.pc/100-cur.sp;
   status=r.k==='save'?`Este mês: <strong>${Math.round(cur.pct)}%</strong> da renda poupada. ${allow>=0?'Você ainda pode gastar '+BRL(allow)+' e manter a meta.':'Para atingir a meta, faltam '+BRL(-allow)+' a menos de gastos.'}`:`Este mês: <strong>${Math.round(cur.pct)}%</strong> da renda (${BRL(cur.sp)}). ${allow>=0?'Ainda cabem '+BRL(allow)+'.':'Passou '+BRL(-allow)+' do limite.'}`}
  const cells=[-5,-4,-3,-2,-1,0].map(o=>{const e=prEval(r,o),d=new Date(today.getFullYear(),today.getMonth()+o,1),lb=MES[d.getMonth()]+': '+(e?Math.round(e.pct)+'% ('+(o===0?(e.ok?'no caminho':'fora do ritmo'):e.ok?'cumprida':'não cumprida')+')':'sem receita');return `<span class="chip${e?e.ok?' c-g':' c-p':''}" role="img" aria-label="${lb}" title="${lb}"${o===0?' style="outline:1px dashed var(--ink)"':''}>${MES[d.getMonth()]} ${e?Math.round(e.pct)+'%':'–'}</span>`}).join(' ');
  return `<div class="item" style="flex-wrap:wrap"><div class="t"><strong>${esc(prName(r))}</strong><small>${status}</small><div style="margin-top:var(--space-2);display:flex;gap:var(--space-1);flex-wrap:wrap">${cells}</div><small>${ms.n?ms.met+' de '+ms.n+' meses cumpridos'+(st>1?' · '+st+' seguidos':''):'Ainda sem meses fechados com receita.'}</small></div><button class="x" data-a="prdel" data-id="${r.id}" aria-label="Excluir meta ${esc(prName(r))}">×</button></div>`}).join('');
 return `<h2>Metas por percentual da renda</h2><p class="empty" style="padding:0 0 var(--space-2)">Defina quanto da renda quer poupar ou gastar numa categoria. O hub confere mês a mês (receitas e despesas do mês, todas as contas). Para somar ao progresso de uma meta, adicione como resultado na aba Metas.</p>${rows||''}${form}`}
/* divisão de despesas */
const splList=()=>finInit().split;
function splBal(){const m={};splList().filter(e=>!e.st).forEach(e=>{m[e.p]=r2((m[e.p]||0)+(e.dir==='recv'?e.v:-e.v))});return m}
function splitPanel(){
 const F=finInit(),L=splList(),bal0=splBal(),ppl=Object.keys(bal0).sort(),recv=ppl.reduce((s,p)=>s+Math.max(0,bal0[p]),0),owe=ppl.reduce((s,p)=>s+Math.max(0,-bal0[p]),0);
 const form=`<form class="bar" id="fsp" style="margin:var(--space-2) 0 0"><input class="in grow" name="t" placeholder="O que foi dividido (ex.: jantar)" required><input data-fin-private class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor total" required style="width:120px"><input class="in grow" name="who" placeholder="Com quem (Ana, Bruno)" required><select class="in" name="by" aria-label="Quem pagou"><option value="me">Eu paguei</option><option value="oth">A 1ª pessoa pagou</option></select><span class="adv"><input data-fin-private class="in" name="mine" type="text" inputmode="decimal" autocomplete="off" placeholder="Minha parte (padrão: igual)" style="width:190px"><input class="in" type="date" name="d" value="${T}" aria-label="Data"><select class="in" name="cat" aria-label="Categoria">${catOpts()}</select><select class="in" name="ac" aria-label="Conta usada">${accOpts()}</select></span><button type="button" class="pill" data-a="adv">Mais opções</button><button class="pill dark">Registrar divisão</button></form>`;
 const person=p=>{const b=bal0[p],ents=L.filter(e=>!e.st&&e.p===p).sort((a,c)=>a.d.localeCompare(c.d));
  return `<div class="item" style="flex-wrap:wrap"><div class="t"><strong>${esc(p)}</strong> <span class="chip c-${b>0?'g':b<0?'p':'b'}">${b>0?'te deve '+BRL(b):b<0?'você deve '+BRL(-b):'quites'}</span>${ents.map(e=>`<small>${fmt(e.d)} · ${esc(e.t)} · ${e.dir==='recv'?'ele deve':'você deve'} ${BRL(e.v)} <button class="x" data-a="spone" data-id="${e.id}" aria-label="Marcar como pago: ${esc(e.t)}" title="Marcar como pago e lançar">✓</button><button class="x" data-a="spdel" data-id="${e.id}" aria-label="Excluir ${esc(e.t)}">×</button></small>`).join('')}</div><button class="pill" data-a="spset" data-id="${esc(p)}">${b>0?'Receber':b<0?'Pagar':'Quitar'}</button></div>`};
 const hist=L.filter(e=>e.st).sort((a,c)=>(c.sd||'').localeCompare(a.sd||'')).slice(0,6);
 return `<h2>Divisão de despesas</h2><p class="empty" style="padding:0 0 var(--space-2)">${ppl.length?`A receber: <strong class="pos">${BRL(recv)}</strong> · A pagar: <strong class="${owe?'neg':''}">${BRL(owe)}</strong>`:'Divida um gasto com amigos, família ou colegas e acompanhe quem deve a quem.'}</p>${ppl.map(person).join('')}${form}${hist.length?`<details style="margin-top:var(--space-2)"><summary>Acertos recentes (${hist.length})</summary>${hist.map(e=>`<div class="item"><div class="t">${esc(e.p)} · ${esc(e.t)}<small>${BRL(e.v)} · acertado em ${fmt(e.sd||e.d)}</small></div></div>`).join('')}</details>`:''}<p class="empty" style="padding:var(--space-2) 0 0">Ao dividir um gasto que você pagou, o valor total entra como despesa. Quando a pessoa devolve, o acerto entra como receita, e o resultado do mês fica correto.</p>`}
function splitAdd(v){
 const F=finInit(),names=String(v.who||'').split(',').map(s=>s.trim()).filter(Boolean),tot=r2(num(v.v));if(!names.length||!(tot>0)){toast('Informe o valor total e com quem dividiu');return}
 const n=names.length;let mine=v.mine&&String(v.mine).trim()?r2(num(v.mine)):r2(tot/(n+1));if(!(mine>=0)||mine>tot){toast('Minha parte inválida');return}
 const d=v.d||T,t=v.t.trim(),cat=v.cat||dictCat(t);
 if(v.by==='oth'){const p=names[0];F.split.push({id:uid(),p,v:mine,t,d,cat,dir:'owe',st:0});toast(`Você deve ${BRL(mine)} a ${esc(p)}`);return}
 const txid=uid();F.tx.push({id:txid,k:'out',t,v:tot,cat,d,ac:v.ac||F.acc[0].id,pj:'',sub:'',tg:'',sp:1});
 const each=r2((tot-mine)/n);let left=r2(tot-mine);names.forEach((p,i)=>{const x=i===n-1?r2(left):each;left=r2(left-x);F.split.push({id:uid(),p,v:x,t,d,cat,dir:'recv',st:0,tx:txid})});
 toast(`Divisão registrada: ${names.map(esc).join(', ')} ${n>1?'devem':'deve'} ${BRL(each)}${n>1?' cada':''}`)}
function splSettle(ids,p,net){
 const F=finInit(),acc=(F.acc.find(a=>a.ty!=='card')||F.acc[0]).id,E=F.split.filter(e=>ids.includes(e.id));if(!E.length)return;
 const top=L=>{const c=L.map(e=>e.cat);return c.sort((a,b)=>c.filter(x=>x===b).length-c.filter(x=>x===a).length)[0]||'Outros'};
 const R=E.filter(e=>e.dir==='recv'),O=E.filter(e=>e.dir==='owe'),rv=r2(R.reduce((t,e)=>t+e.v,0));
 if(rv>0)F.tx.push({id:uid(),k:'in',t:'Reembolso: '+p,v:rv,cat:'Receita',d:T,ac:acc,pj:'',sub:'',tg:'',rb:1,rcat:top(R)});
 [...new Set(O.map(e=>e.cat))].forEach(c=>{const v=r2(O.filter(e=>e.cat===c).reduce((t,e)=>t+e.v,0));if(v>0)F.tx.push({id:uid(),k:'out',t:'Acerto com '+p,v,cat:c,d:T,ac:acc,pj:'',sub:'',tg:''})});
 E.forEach(e=>{e.st=1;e.sd=T});toast(Math.abs(net)<.01?'Contas quites com '+esc(p):(net>0?'Recebido de ':'Pago a ')+esc(p)+': '+BRL(Math.abs(net)))}
document.addEventListener('change',e=>{const i=e.target;if(!i||!i.dataset||!i.dataset.rm)return;const g=finInit().goals.find(x=>x.id===i.dataset.rm);if(g){g.rm=+i.value;const a=avgOut3();if(a>0)g.target=Math.round(g.rm*a);save();render()}});

