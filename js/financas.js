// finanças: contas, cartões, recorrentes, gráficos, importação, regras, relatórios, fluxo de caixa, reserva e divisão de despesas
/* ===== Finanças v2: contas, cartões, recorrentes, gráficos, medidores, importação ===== */
let FED=null,IMP=null,RED=null,BED=null,FQ='',FRECON='',FCLEAR=null,FCLEART=0,TXBULKDEL=false,TXBULKT=0,INV_BUSY=false,INV_AT=0,INV_ERR='',INV_YR=today.getFullYear(),INV_BUY=null,INV_SIM=null;
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
function simulationPanel(){const accounts=(S.fin.acc||[]).filter(a=>a.ty!=='card'),cards=(S.fin.acc||[]).filter(a=>a.ty==='card');return `<details class="panel"><summary>Simular compra</summary><p class="empty">Projeção ilustrativa por conta, com lançamentos já cadastrados. Não inclui recorrências ainda não lançadas nem faturas futuras sem pagamento vinculado. Juros compostos incidem mensalmente sobre o total. Para cartão, a conta escolhida é usada somente nesta simulação: o cadastro não vincula uma conta ao cartão. Valores de faturas sem pagamento agendado ficam fora da base.</p><form id="purchase-simulator" class="bar"><label class="lb">Conta<select class="in" name="account" required>${accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.n)}</option>`).join('')}</select></label><label class="lb">Forma de pagamento<select class="in" name="card"><option value="">Débito em conta</option>${cards.map(a=>`<option value="${esc(a.id)}">Cartão: ${esc(a.n)}</option>`).join('')}</select></label><label class="lb">Valor à vista (R$)<input class="in" name="amount" inputmode="decimal" required></label><label class="lb">Data da compra ou primeiro pagamento<input class="in" type="date" name="date" value="${T}" min="${T}" required></label><label class="lb">Parcelas<input class="in" name="parts" type="number" min="1" max="48" value="1" required></label><label class="lb">Juros mensais (%)<input class="in" name="rate" type="number" min="0" max="100" step="0.01" value="0" required></label><label class="lb">Categoria do orçamento<select class="in" name="category"><option value="">Sem categoria</option>${FC.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><button class="pill" ${accounts.length?'':'disabled'}>Comparar cenários</button></form><div data-simulation-result aria-live="polite"></div></details>`}
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
 const net=finYearNetCents(F,y),payload={year:y,tx:archivedTx,net,archivedAt:Date.now(),count:archivedTx.length};
 if(typeof idbPut==='function')idbPut('fin-archive-'+y,JSON.stringify(payload));
 if(typeof DBr!=='undefined'&&DBr&&typeof P==='string')DBr.doc(P+'fin-archive-'+y).set(payload).catch(()=>{});
 F.acc.forEach(a=>{a.ini=r2((+a.ini||0)+(net[a.id]||0)/100)});
 F.tx=F.tx.filter(t=>!t.d||!t.d.startsWith(pref));
 F.archives.push({year:y,count:archivedTx.length,archivedAt:payload.archivedAt});
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
function genRec0(){
 const F=finInit(),ids=new Set(F.tx.map(t=>t.id));let n=0;
 F.rec.forEach(r=>{const s=r.ini||T;let y=+s.slice(0,4),m=+s.slice(5,7)-1;if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||m<0||m>11)return;
  while(y<today.getFullYear()||(y===today.getFullYear()&&m<=today.getMonth())){const d=ds(new Date(y,m,Math.min(+r.day||1,dimOf(y,m))));
   if(d>T||(r.end&&d>r.end))break;
   if(d>=s){const id='r_'+r.id+'_'+d.slice(0,7);if(!(r.skip||[]).includes(id)&&!ids.has(id)){F.tx.push({id,k:r.k,t:r.t,v:r.v,cat:r.cat,d,ac:r.ac,rc:r.id});ids.add(id);n++}}
   if(++m>11){m=0;y++}}});
 return n}
function recReminder(r){let y=today.getFullYear(),m=today.getMonth();if(r.day<today.getDate())m++;const d=ds(new Date(y,m,Math.min(r.day,dimOf(y,m)))),eid=uid();S.events.push({id:eid,t:'Conta: '+r.t,d,h:'09:00',e:'',r:'m',rm:'',c:'p',billDay:r.day,until:r.end||''});finInit().bills.push({id:uid(),n:r.t,v:r.v,day:r.day,eid,rec:r.id,ac:r.ac})}
function recReminderUpdate(r){const b=finInit().bills.find(x=>x.rec===r.id);if(!b)return;Object.assign(b,{n:r.t,v:r.v,day:r.day,ac:r.ac});const e=S.events.find(x=>x.id===b.eid);if(e){const y=+e.d.slice(0,4),m=+e.d.slice(5,7)-1;e.t='Conta: '+r.t;e.billDay=r.day;e.until=r.end||'';e.d=ds(new Date(y,m,Math.min(r.day,dimOf(y,m))))}}
function sumAbated(list){
 const by={};let inc=0,out=0;
 list.forEach(t=>{if(t.k==='in')inc+=t.v;else if(t.k==='out'){out+=t.v;by[t.cat]=(by[t.cat]||0)+t.v}});
 list.forEach(t=>{if(t.k==='in'&&t.rb){const c=t.rcat||'Outros',ab=Math.min(by[c]||0,t.v);if(ab>0){by[c]=r2(by[c]-ab);if(by[c]<=0)delete by[c];out=r2(out-ab);inc=r2(inc-ab)}}});
 return{inc,out,by};
}
function finMonth(o,all){
 const F=finInit(),f=new Date(today.getFullYear(),today.getMonth()+(o==null?S.fmo:o),1),p=ds(f).slice(0,7),ok=t=>all||!S.fac||accId(t)===S.fac||t.to===S.fac;
 const tx=F.tx.filter(t=>t.d.slice(0,7)===p&&ok(t)).sort((a,b)=>b.d.localeCompare(a.d)),{inc,out,by}=sumAbated(tx);
 return{f,p,tx,inc,out,by}}
function series(n,base,all){const a=[];for(let i=n-1;i>=0;i--){const m=finMonth(base-i,all);a.push({f:m.f,inc:m.inc,out:m.out})}return a}
const cwid=w=>innerWidth>860?Math.round(w*1.5):w;
function barsSvg(a){
 const W=520,H=230,L=44,R=8,T0=12,B=30,pw=W-L-R,ph=H-T0-B,bals=a.map(x=>x.inc-x.out),hi=Math.max(1,...a.map(x=>Math.max(x.inc,x.out)),...bals),lo=Math.min(0,...bals),y=v=>T0+ph*(hi-v)/((hi-lo)||1),gw=pw/a.length,bw=Math.min(26,gw*.28);
 let g='';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 const bar=(x,v,c,t)=>`<rect x="${x}" y="${Math.min(y(v),y(0))}" width="${bw}" height="${Math.max(1,Math.abs(y(0)-y(v)))}" rx="3" fill="${c}"><title>${t}</title></rect>`;
 const bars=a.map((x,i)=>{const cx=L+gw*(i+.5),mn=MES[x.f.getMonth()];return bar(cx-bw-2,x.inc,'var(--s1)',mn+': receitas '+BRL(x.inc))+bar(cx+2,x.out,'var(--s2)',mn+': despesas '+BRL(x.out))+`<text x="${cx}" y="${H-10}" text-anchor="middle">${mn}</text>`}).join('');
 const pts=a.map((x,i)=>[L+gw*(i+.5),y(x.inc-x.out),x.fut]);
 return `<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas, despesas e saldo por mês: ${a.map(x=>MES[x.f.getMonth()]+' receitas '+BRL(x.inc)+', despesas '+BRL(x.out)).join('; ')}">${g}${bars}<polyline points="${pts.filter(p=>!p[2]).map(p=>p[0]+','+p[1]).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2.5"/>${pts.map((p,i)=>p[2]?'':`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--s1d)"><title>Saldo ${BRL(bals[i])}</title></circle>`).join('')}</svg>`}
function donut(by,out){
 const cs=Object.keys(by).sort((a,b)=>by[b]-by[a]);if(!cs.length)return '<p class="empty">Nenhuma despesa neste mês.</p>';
 const R=70,C=2*Math.PI*R;let off=0;
 const segs=cs.map((c,i)=>{const len=by[c]/out*C,s=`<circle cx="100" cy="100" r="${R}" fill="none" stroke="${PAL8[i%PAL8.length]}" stroke-width="30" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"><title>${esc(c)}: ${BRL(by[c])}</title></circle>`;off+=len;return s}).join('');
 return `<div class="dnw"><svg class="fs" viewBox="0 0 200 200" style="width:190px;flex:none" role="img" aria-label="Despesas por categoria">${segs}<text x="100" y="94" text-anchor="middle" style="font-size:12px">Despesas</text><text x="100" y="114" text-anchor="middle" style="font-size:15px;font-weight:600;fill:var(--ink)">${BRL(out)}</text></svg><div style="flex:1;min-width:170px">${cs.map((c,i)=>`<button class="item" style="width:100%;border:0;text-align:left;cursor:pointer;color:inherit;padding:var(--space-2) var(--space-2);margin-bottom:var(--space-1)${S.fcat===c?';outline:2px solid var(--s1)':''}" data-a="fcat" data-id="${esc(c)}"><i style="width:12px;height:12px;border-radius:50%;background:${PAL8[i%PAL8.length]};flex:none"></i><div class="t">${esc(c)}</div><small style="display:inline;flex-shrink:0">${Math.round(by[c]/out*100)}%</small><strong style="font-weight:500">${BRL(by[c])}</strong></button>`).join('')}</div></div>`}
function gauge(c,spent,lim,exp){
 const p=lim?spent/lim:0,col=p>=1?'var(--neg)':p>exp+.0001?'var(--yellow)':'var(--green)',ex=Math.min(1,Math.max(0,exp)),cx=Math.cos(Math.PI*ex),sx=Math.sin(Math.PI*ex);
 const st=p>=1?'Limite estourado':p>exp?'Acima do ritmo':'Dentro do ritmo';
 return `<div><svg viewBox="0 0 100 60" style="width:100%;max-width:190px" role="img" aria-label="${esc(c)}: ${Math.round(p*100)}% do orçamento"><path d="M10 50A40 40 0 0 1 90 50" pathLength="100" fill="none" stroke="var(--panel)" stroke-width="9"/><path d="M10 50A40 40 0 0 1 90 50" pathLength="100" fill="none" stroke="${col}" stroke-width="9" stroke-dasharray="${Math.min(1,p)*100} 100"/><line x1="${50-33*cx}" y1="${50-33*sx}" x2="${50-47*cx}" y2="${50-47*sx}" stroke="var(--ink)" stroke-width="2"/><text x="50" y="49" text-anchor="middle" style="font-size:14px;font-weight:600;fill:var(--ink)">${Math.round(p*100)}%</text></svg><strong>${esc(c)}</strong><small style="display:block;color:var(--mute)">${BRL(spent)} de ${BRL(lim)}</small><small style="display:block;color:var(--mute)">ritmo esperado: ${BRL(lim*exp)}</small><span class="chip ${p>=1?'c-p':p>exp?'c-y':'c-g'}" style="margin:var(--space-1) 0 0">${st}</span><button class="x" data-a="delbud" data-id="${esc(c)}" aria-label="Remover orçamento">×</button></div>`}
const catOpts=sel=>`<option value="">Categoria automática</option>${FC.map(c=>`<option ${sel===c?'selected':''}>${c}</option>`).join('')}`;
const accOpts=sel=>S.fin.acc.map(a=>`<option value="${a.id}" ${sel===a.id?'selected':''}>${esc(a.n)}</option>`).join('');
function accountEdit(a){const card=a.ty==='card';return `${!card?`<button class="pill" data-a="primaryacc" data-id="${esc(a.id)}" aria-pressed="${finInit().primary===a.id}">${finInit().primary===a.id?'Conta principal':'Definir como principal'}</button>`:''}<details><summary>Editar ${card?'cartão':'conta'}</summary><form class="bar" data-acc-edit="${esc(a.id)}"><label class="lb">Nome<input class="in" name="n" value="${esc(a.n)}" required></label>${card?`<label class="lb">Limite<input class="in" name="lim" type="number" min="0" step="0.01" value="${+a.lim||0}"></label><label class="lb">Fecha dia<input class="in" name="close" type="number" min="1" max="31" value="${+a.close||28}" required></label><label class="lb">Vence dia<input class="in" name="due" type="number" min="1" max="31" value="${+a.due||10}" required></label><p class="empty">Mudar as datas altera o cálculo das faturas. Se houver pagamentos associados, o dia de fechamento fica protegido.</p><p class="empty" data-account-impact aria-live="polite"></p><label><input type="checkbox" name="confirm"> Confirmei o impacto da alteração nas datas</label>`:''}<button class="pill">Salvar conta</button></form></details>`}
function accountImpact(f){const a=finInit().acc.find(x=>x.id===f.dataset.accEdit),el=f.querySelector('[data-account-impact]');if(!a||!el)return;const close=+f.elements.close.value,due=+f.elements.due.value;if(!Number.isInteger(close)||close<1||close>31||!Number.isInteger(due)||due<1||due>31){el.textContent='Informe dias entre 1 e 31 para ver a prévia.';return}const before=invoice(a),after=invoice({...a,close,due});el.textContent=`Fatura do mês selecionado: ${BRL(before.tot)} (vence ${fmt(before.due)}) → ${BRL(after.tot)} (vence ${fmt(after.due)}).`}
function finClearPanel(inGrid){
 const F=finInit(),hasTx=F.tx.length>0||F.acc.some(a=>(+a.ini||0)!==0);
 const hasAny=hasTx||F.acc.length>1||(F.acc[0]&&(F.acc[0].n!=='Conta principal'||F.acc[0].ty!=='cc'))||F.rec.length>0||F.rules.length>0||Object.keys(F.bud||{}).length>0||Object.keys(F.budHist||{}).length>0||F.goals.length>0||F.prules.length>0||F.split.length>0||F.bills.length>0||!!F.primary||((F.inv?.assets?.length||0)>0)||((F.inv?.divs?.length||0)>0);
 const pastYears={};const curY=today.getFullYear();(F.tx||[]).forEach(t=>{const y=+(t.d||'').slice(0,4);if(Number.isInteger(y)&&y>1900&&y<curY&&!(F.archives||[]).some(a=>a.year===y))pastYears[y]=(pastYears[y]||0)+1});
 const archHtml=(Object.keys(pastYears).length||(F.archives||[]).length)?`<div style="margin-top:var(--space-3);padding-top:var(--space-2);border-top:1px solid var(--line)"><h3 style="margin:0 0 var(--space-1)">Arquivamento anual</h3><p class="empty" style="padding:0 0 var(--space-2)">Consolida lançamentos de anos encerrados no saldo inicial das contas e guarda o histórico no IndexedDB/nuvem.</p><div class="bar">${Object.keys(pastYears).sort().reverse().map(y=>`<button class="pill" data-a="fin-archive" data-id="${y}">Arquivar ${y} (${pastYears[y]})</button>`).join('')}${(F.archives||[]).map(a=>`<button class="pill" data-a="fin-unarchive" data-id="${a.year}">Restaurar ${a.year} (${a.count})</button>`).join('')}</div></div>`:'';
 return `<div class="panel${inGrid?'':' wide'}" data-fin-tools${inGrid?'':' style="margin-top:var(--space-3)"'}><h2>Limpar dados das Finanças</h2><p class="empty" style="padding:0 0 var(--space-2)">Uma versão automática é salva em Backup antes de limpar, e você pode desfazer com Ctrl+Z logo em seguida.</p><div class="bar"><button class="pill${FCLEAR==='tx'?' dark':''}" data-a="fincleartx" ${hasTx?'':'disabled'}>${FCLEAR==='tx'?'Confirmar: limpar lançamentos':'Limpar lançamentos'}</button><button class="pill${FCLEAR==='all'?' dark':''}" data-a="finclearall" ${hasAny?'':'disabled'}>${FCLEAR==='all'?'Confirmar: zerar todas as Finanças':'Zerar todas as Finanças'}</button>${FCLEAR?'<button class="pill" data-a="finclearcancel">Cancelar</button>':''}</div>${archHtml}</div>`;
}
function filteredTx(tx){
 const q=norm(FQ.trim()),kd=S.fkd||'',fc=S.fcat||'';
 return tx.filter(t=>(!FRECON||(FRECON==='checked'?!!t.checked:!t.checked))&&(!kd||t.k===kd)&&(!fc||t.cat===fc)&&(!q||norm(t.t).includes(q)||norm(t.cat).includes(q)||norm(t.sub).includes(q)||norm(t.tg).includes(q)||norm(t.pj).includes(q)||norm(accName(accId(t))).includes(q)||fmt(t.d).includes(q)||String(t.v).includes(q)||String(t.v).replace('.',',').includes(q)));
}
function txListHtml(tx){
 const q=norm(FQ.trim()),kd=S.fkd||'',fc=S.fcat||'',hasF=!!(q||kd||fc||FRECON),del=(a,id,l)=>`<button class="x" data-a="${a}" data-id="${esc(id)}" aria-label="${l}">×</button>`;
 const L=filteredTx(tx);
 const sum=L.reduce((s,t)=>s+(t.k==='in'?t.v:t.k==='out'?-t.v:0),0),allOut=L.length&&L.every(t=>t.k==='out'),allIn=L.length&&L.every(t=>t.k==='in');
 const stxt=allOut?'Total: <strong>'+BRL(L.reduce((s,t)=>s+t.v,0))+'</strong>':allIn?'Total: <strong class="pos">+ '+BRL(L.reduce((s,t)=>s+t.v,0))+'</strong>':L.length?'Saldo filtrado: <strong class="'+(sum<0?'neg':'pos')+'">'+BRL(sum)+'</strong>':'';
 const bulkHtml=L.length?`<details data-tx-bulk style="margin-top:var(--space-2)"><summary class="pill" style="display:inline-block;cursor:pointer">Edição em lote (${L.length} ${L.length===1?'lançamento listado':'lançamentos listados'})</summary><form class="bar" id="ftxbulk" style="margin-top:var(--space-2)"><select class="in" name="cat" aria-label="Nova categoria em lote"><option value="">Manter categoria</option>${FC.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><input class="in" name="sub" list="subl" placeholder="Nova subcategoria (opcional)" aria-label="Nova subcategoria em lote"><input class="in" name="tg" list="alltags" placeholder="Adicionar etiqueta (opcional)" aria-label="Adicionar etiqueta em lote"><select class="in" name="ac" aria-label="Nova conta em lote"><option value="">Manter conta</option>${accOpts('')}</select><label><input type="checkbox" name="createRules" value="1"> Criar regras para as descrições</label><button class="pill dark">Aplicar aos ${L.length} listados</button><button type="button" class="pill${TXBULKDEL?' dark':''}" data-a="txbulkdel">${TXBULKDEL?'Confirmar: excluir os '+L.length+' listados':'Excluir os '+L.length+' listados'}</button>${TXBULKDEL?'<button type="button" class="pill" data-a="txbulkcancel">Cancelar</button>':''}</form></details>`:'';
 return (hasF?`<p class="empty" style="padding:0 0 var(--space-2)">Mostrando <strong>${L.length}</strong> de ${tx.length} lançamentos${stxt?' · '+stxt:''}. <button class="pill" data-a="fclr">Limpar filtros</button></p>`:'')
 +(L.slice(0,pgN(FLK(),80)).map(t=>`<div class="item"><label title="Conferido no banco"><input type="checkbox" data-tx-checked="${esc(t.id)}" ${t.checked?'checked':''} aria-label="Conferido no banco: ${esc(t.t)}"></label><div class="t">${esc(t.t)}${t.pc?` <span class="chip c-y">${t.pc.i}/${t.pc.n}</span>`:''}${t.rc?' <span class="chip c-b">auto</span>':''}${t.rb?` <span class="chip c-g">estorno · ${esc(t.rcat||'Outros')}</span>`:''}${t.pj?` <span class="chip c-g">${esc(t.pj)}</span>`:''}${tagChips(t)}${t.d>T?' <span class="chip c-p">agendado</span>':''}<small>${fmt(t.d)} · ${t.k==='tr'?esc(accName(accId(t)))+' → '+esc(accName(t.to))+(t.sub?' · '+esc(t.sub):''):esc(t.cat)+(t.sub?' › '+esc(t.sub):'')+' · '+esc(accName(accId(t)))}</small></div><strong class="${t.k==='in'?'pos':t.k==='tr'?'':'neg'}">${t.k==='in'?'+':t.k==='tr'?'':'−'} ${BRL(t.v)}</strong><button class="x" data-a="edtx" data-id="${t.id}" aria-label="Editar lançamento">✎</button>${del('deltx',t.id,'Excluir lançamento')}${t.pc?`<button class="x" data-a="deltxg" data-id="${t.pc.g}" aria-label="Excluir todas as parcelas" title="Excluir todas as parcelas">⊗</button>`:''}</div>`).join('')||emp('fin',hasF?'Nenhum lançamento combina com os filtros aplicados.':'Nenhum lançamento neste mês.',hasF?'Limpar filtros':'Lançar agora',hasF?'data-a="fclr"':'data-a="focusform" data-id="#ffin"'))
 +pgMore(FLK(),L.length,80)+bulkHtml}
function recurringInfo(r){const start=(r.ini||T)>T?r.ini:T,base=new Date(start.slice(0,7)+'-01T00:00'),F=finInit();let next='';
 for(let i=0;i<(r.skip||[]).length+2;i++){const d=new Date(base.getFullYear(),base.getMonth()+i,1),iso=ds(new Date(d.getFullYear(),d.getMonth(),Math.min(+r.day||1,dimOf(d.getFullYear(),d.getMonth())))),id='r_'+r.id+'_'+iso.slice(0,7);if(r.end&&iso>r.end)break;if(iso>=start&&!(r.skip||[]).includes(id)&&!F.tx.some(t=>t.id===id&&iso<=T)){next=iso;break}}
 const last=F.tx.filter(t=>t.rc===r.id&&t.d<=T).sort((a,b)=>b.d.localeCompare(a.d))[0];return (next?'Próxima: '+fmt(next):'Sem próxima cobrança')+(last&&+last.v!==+r.v?' · último lançamento '+BRL(last.v)+'; valor atual '+BRL(r.v):'')}
function installmentsPanel(){const F=finInit(),tx=F.tx.filter(t=>t.k==='out'&&t.pc&&t.d>T&&(!S.fac||accId(t)===S.fac)),groups={},months={};tx.forEach(t=>{(groups[t.pc.g]=groups[t.pc.g]||[]).push(t);const m=t.d.slice(0,7);months[m]=(months[m]||0)+t.v});const total=tx.reduce((s,t)=>s+t.v,0);return `<h2>Parcelas futuras</h2>${tx.length?`<p>Restam ${BRL(total)} em ${tx.length} parcelas agendadas.</p><details><summary>Ver por mês e compra</summary>${Object.keys(months).sort().map(m=>`<div class="item"><div class="t">${esc(m)}</div><strong>${BRL(months[m])}</strong></div>`).join('')}${Object.values(groups).map(g=>{g.sort((a,b)=>a.d.localeCompare(b.d));return `<div class="item"><div class="t">${esc(g[0].t)}<small>${g.length} parcelas restantes · última em ${fmt(g[g.length-1].d)}</small></div><strong>${BRL(g.reduce((s,t)=>s+t.v,0))}</strong></div>`}).join('')}</details>`:'<p class="empty">Nenhuma parcela futura agendada.</p>'}`}
function recentTxPanel(tx){
 const list=[...tx].sort((a,b)=>(b.d||'').localeCompare(a.d||'')).slice(0,6);
 return `<div class="panel"><div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Últimos lançamentos</h2><button class="pill" data-a="ftab" data-id="lanc">Ver todos</button></div>${list.map(t=>`<div class="item"><div class="t">${esc(t.t)}<small>${fmt(t.d)}${t.cat?' · '+esc(t.cat):''} · ${esc(accName(accId(t)))}</small></div><strong class="${t.k==='in'?'pos':t.k==='out'?'neg':''}">${t.k==='in'?'+':t.k==='out'?'−':''}${BRL(t.v)}</strong></div>`).join('')||'<p class="empty">Nenhum lançamento neste mês ainda.</p>'}</div>`;
}
function financasMes(tab){
 const F=finInit();genRec();if(FED&&!F.tx.some(t=>t.id===FED))FED=null;if(RED&&!F.rec.some(r=>r.id===RED))RED=null;if(BED&&!F.bills.some(b=>b.id===BED))BED=null;
 tab=FTABS.some(x=>x[0]===tab)?tab:(FTABS.some(x=>x[0]===S.ftab)?S.ftab:'geral');
 const {f,tx,inc,out,by}=finMonth(),sal=inc-out,al=finAlerts(by,ds(f).slice(0,7)),e=FED?F.tx.find(t=>t.id===FED):null,k0=e?e.k:'out';
 const {inc:realIn,out:realOut}=sumAbated(tx.filter(t=>t.d<=T));
 const net=F.acc.reduce((a,x)=>a+bal(x),0),selA=S.fac?F.acc.find(a=>a.id===S.fac):null;
 const del=(a,id,l)=>`<button class="x" data-a="${a}" data-id="${esc(id)}" aria-label="${l}">×</button>`;
 const head=`<div class="top"><div><span class="crumb">MEU HUB / FINANÇAS</span><h1>Finanças<span class="sub-ed">Vida financeira</span></h1></div><div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap">${vwToggle()}<select class="in" data-fac="1" aria-label="Filtrar por conta"><option value="">Todas as contas</option>${accOpts(S.fac)}</select><span style="display:inline-flex;gap:var(--space-2);align-items:center"><button class="pill" data-a="fmn" data-n="-1" aria-label="Mês anterior">‹</button><strong>${MES[f.getMonth()]} ${f.getFullYear()}</strong><button class="pill" data-a="fmn" data-n="1" aria-label="Próximo mês">›</button></span><button class="pill" data-a="fmn" data-n="0">Este mês</button></div></div>
 <div class="rv4"><div class="stat c-g"><span>Receitas do mês (inclui agendadas)</span><strong>${BRL(inc)}</strong><small>Até hoje: ${BRL(realIn)} · agendadas: ${BRL(inc-realIn)}</small></div><div class="stat c-p"><span>Despesas do mês (inclui agendadas)</span><strong>${BRL(out)}</strong><small>Até hoje: ${BRL(realOut)} · agendadas: ${BRL(out-realOut)}</small></div><div class="stat ${sal<0?'c-y':'c-b'}"><span>Resultado do mês (inclui agendados)${inc>0?' · poupança '+Math.round(sal/inc*100)+'%':''}</span><strong>${BRL(sal)}</strong><small>Realizado até hoje: ${BRL(realIn-realOut)}</small></div><div class="stat c-y"><span>${selA?'Saldo atual de '+esc(selA.n):'Saldo atual de todas as contas'}</span><strong>${BRL(selA?bal(selA):net)}</strong></div></div>
 ${al.length?`<div class="bar" role="alert" style="margin-top:var(--space-2)"><strong style="align-self:center">Atenção:</strong>${al.map(a=>`<span class="chip ${a[1]>=100?'c-p':'c-y'}">${esc(a[0])}: ${a[1]}% do orçamento</span>`).join('')}</div>`:''}`;
 const formHtml=(tab==='geral'||tab==='lanc'||!!e)?`<form class="bar k${k0}${e?' advo':''}" id="ffin" style="margin-top:var(--space-3)"><select class="in" name="k" aria-label="Tipo"><option value="out" ${k0==='out'?'selected':''}>Despesa</option><option value="in" ${k0==='in'?'selected':''}>Receita</option><option value="tr" ${k0==='tr'?'selected':''}>Transferência</option></select><input class="in grow" name="t" placeholder="Descrição (ex.: mercado 85,90 ontem)" value="${e?esc(e.t):''}" required><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor" value="${e?e.v:''}" style="width:120px"><select class="in" name="cat" aria-label="Categoria">${catOpts(e&&e.cat)}</select>${F.acc.length>1?`<select class="in" name="ac" aria-label="Conta ou cartão">${accOpts(e&&accId(e))}</select>`:''}<span class="adv"><input class="in" type="date" name="d" value="${e?e.d:T}" required aria-label="Data">${F.acc.length>1?'':`<select class="in" name="ac" aria-label="Conta ou cartão">${accOpts(e&&accId(e))}</select>`}<select class="in f-to" name="to" aria-label="Conta de destino">${accOpts(e&&e.to)}</select><input class="in" name="sub" list="subl" placeholder="Subcategoria" value="${e?esc(e.sub||''):''}" aria-label="Subcategoria">${subList()}<input class="in" name="tg" list="alltags" placeholder="Etiquetas" value="${e?esc(e.tg||''):''}" aria-label="Etiquetas"><input class="in" name="pj" list="pjl" placeholder="Projeto (opcional)" value="${e?esc(e.pj||''):''}" aria-label="Projeto">${pjList()}<input class="in f-pc" name="pc" type="number" min="1" value="1" title="Parcelas" aria-label="Parcelas" style="width:90px" ${e?'disabled':''}>${e?'<label class="lb" style="margin:0"><input type="checkbox" name="applySame" value="1"> Aplicar aos demais com mesma descrição e criar regra</label>':''}</span><button class="pill dark">${e?'Salvar alterações':'Lançar'}</button><button type="button" class="pill" data-a="adv">${e?'Menos opções':'Mais opções'}</button>${e?'<button type="button" class="pill" data-a="fcancel">Cancelar</button>':''}</form>`:'';
 const tabsHtml=`<div class="bar ftabs" role="group" aria-label="Seções das Finanças">${FTABS.map(x=>`<button class="pill ${x[0]===tab?'on':''}" aria-pressed="${x[0]===tab}" data-a="ftab" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>`;
 let body='';
 if(tab==='geral'){
  const lc=lineChart(),ser=series(S.fn,S.fmo);
  body=`${summaryPanel()}
  ${nextIncomePanel()}
  <div class="panel"><h2>Despesas por categoria</h2>${donut(by,out)}${S.fcat?`<p class="empty" style="padding:var(--space-2) 0 0">Filtrando lançamentos por <strong>${esc(S.fcat)}</strong>. <button class="pill" data-a="fcat" data-id="${esc(S.fcat)}">Limpar filtro</button></p>`:''}</div>
  ${recentTxPanel(tx)}
  <div class="panel"><div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">${S.flm==='sal'?'Saldo acumulado e projeção':'Resultado acumulado e projeção'}</h2><span style="display:flex;gap:var(--space-2)">${[['res','Resultado'],['sal','Saldo']].map(x=>`<button class="pill ${(S.flm||'res')===x[0]?'on':''}" data-a="flm" data-id="${x[0]}">${x[1]}</button>`).join('')}</span></div>${lc.svg}<div class="bar" style="margin:var(--space-2) 0 0;font-size:var(--type-small)"><span><i class="lg" style="background:var(--s1)"></i>Realizado</span><span><i class="lg" style="background:${lc.end<0?'var(--neg)':'var(--s1d)'}"></i>Projeção</span></div><p class="empty" style="padding:var(--space-1) 0 0">${S.fmo>0?'Mês futuro: considera só lançamentos e recorrências agendados. ':''}${S.flm==='sal'?'Saldo':'Resultado'} até agora: <strong class="${lc.now<0?'neg':'pos'}">${BRL(lc.now)}</strong>${lc.proj?` · projeção para o fim do mês: <strong class="${lc.end<0?'neg':'pos'}">${BRL(lc.end)}</strong>. Inclui parcelas e recorrências ainda por vir${lc.avg?` e a média dos gastos variáveis (${BRL(lc.avg)} por dia)`:''}.`:'.'}</p></div>
  <div class="panel"><div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Receitas e despesas mês a mês</h2><span>${[6,12].map(n=>`<button class="pill ${S.fn===n?'on':''}" data-a="fn" data-id="${n}">${n} meses</button>`).join(' ')}</span></div>${barsSvg(ser)}<div class="bar" style="margin:var(--space-2) 0 0;font-size:var(--type-small)"><span><i class="lg" style="background:var(--s1)"></i>Receitas</span><span><i class="lg" style="background:var(--s2)"></i>Despesas</span><span><i class="lg" style="background:var(--ink)"></i>Saldo do mês</span></div></div>
  <div class="panel wide">${waterPanel()}</div>
  <div class="panel wide" id="cash-flow-panel">${cashPanel()}</div>`;
 }else if(tab==='inv'){
  body=invPanel();
 }else if(tab==='analise'){
  body=`<div class="panel wide">${yoyPanel()}</div>
  <div class="panel">${heatPanel()}</div>
  <div class="panel">${evoPanel()}</div>
  <div class="panel"><h2>Calendário financeiro</h2>${calPanel()}</div>
  <div class="panel">${merchantsPanel()}</div>
  <div class="panel c4">${subPanel()}</div>
  <div class="panel c2">${projPanel()}</div>`;
 }else if(tab==='lanc'){
  body=`<div class="panel wide"><div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Lançamentos${S.fcat?': '+esc(S.fcat):''}</h2><span style="display:flex;gap:var(--space-2);flex-wrap:wrap">${[['','Todos'],['out','Despesas'],['in','Receitas'],['tr','Transferências']].map(x=>`<button class="pill ${(S.fkd||'')===x[0]?'on':''}" data-a="fkd" data-id="${x[0]}" aria-pressed="${(S.fkd||'')===x[0]}">${x[1]}</button>`).join('')}</span></div><div class="bar" style="margin:0 0 var(--space-2)"><input class="in grow" id="fq" placeholder="Buscar por descrição, subcategoria, etiqueta ou valor…" value="${esc(FQ)}" aria-label="Buscar nos lançamentos"><select class="in" data-fcat="1" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>${FC.map(c=>`<option value="${c}" ${S.fcat===c?'selected':''}>${c}</option>`).join('')}</select><select class="in" data-reconcile-filter aria-label="Conferência"><option value="">Todos os lançamentos</option><option value="pending" ${FRECON==='pending'?'selected':''}>Não conferidos</option><option value="checked" ${FRECON==='checked'?'selected':''}>Conferidos</option></select></div><p class="empty">Marque os lançamentos conferidos no banco.</p><div id="txlist">${txListHtml(tx)}</div></div>
  <div class="panel">${installmentsPanel()}</div>
  <div class="panel">${splitPanel()}</div>`;
 }else if(tab==='orc'){
  const dim=dimOf(f.getFullYear(),f.getMonth()),exp=S.fmo<0?1:S.fmo>0?0:today.getDate()/dim;
  body=`<div class="panel wide"><h2>Orçamentos</h2><div class="gg">${Object.entries(budgetsAt(ds(f).slice(0,7))).map(([c,l])=>gauge(c,by[c]||0,l,exp)).join('')||'<p class="empty">Defina um limite mensal por categoria. O medidor mostra quanto você gastou e a marca preta indica onde deveria estar hoje.</p>'}</div><form class="bar" id="fbud" style="margin:var(--space-3) 0 0"><select class="in" name="cat" aria-label="Categoria">${opts(FC)}</select><input class="in grow" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Limite mensal" required><label class="lb">Válido a partir de<input class="in" type="month" name="month" value="${ds(f).slice(0,7)}" required></label><span class="empty" data-budget-preview aria-live="polite"></span><button class="pill">Definir orçamento</button></form><div class="bar" style="margin:var(--space-2) 0 0"><button type="button" class="pill" data-a="budsuggest">Preencher com a média histórica</button></div><p class="empty">O valor vale a partir do mês escolhido e preserva os limites anteriores.</p></div>
  <div class="panel"><h2>Metas de economia</h2>${F.goals.filter(g=>!g.res).map(g=>{const p=Math.min(100,Math.round(g.saved/(g.target||1)*100));return `<div class="item"><div class="t">${esc(g.n)}<small>${BRL(g.saved)} de ${BRL(g.target)} (${p}%)</small>${glink(g)}<div class="fb" style="margin-top:var(--space-2)"><i style="width:${p}%"></i></div></div><input class="in" data-gdep="${g.id}" type="number" step="any" placeholder="+ depositar" aria-label="Depositar" style="width:140px">${del('delgoal',g.id,'Excluir meta')}</div>`}).join('')||'<p class="empty">Crie uma meta, como viagem ou reserva de emergência.</p>'}<form class="bar" id="fgoal" style="margin:var(--space-2) 0 0"><input class="in grow" name="n" placeholder="Nome da meta" required><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor alvo" required style="width:120px"><button class="pill">Criar</button></form></div>
  <div class="panel">${reservaPanel()}</div>
  <div class="panel">${prPanel()}</div>
  <div class="panel">${closingPanel()}</div>`;
 }else if(tab==='contas'){
  const er=RED?F.rec.find(r=>r.id===RED):null,eb=BED?F.bills.find(b=>b.id===BED):null;
  const subscriptions=F.rec.filter(r=>r.k==='out'&&r.cat==='Assinaturas'&&(!r.ini||r.ini<=T)&&(!r.end||r.end>=T)),bills=F.bills.reduce((a,b)=>a+b.v,0);
  const cardShowcase=F.acc.some(a=>a.ty==='card')?`<div class="cc-grid">${F.acc.filter(a=>a.ty==='card').map(a=>{const b=bal(a),iv=invoice(a),used=Math.max(0,-b),proj=[0,1,2,3].map(k=>{const mDate=new Date(today.getFullYear(),today.getMonth()+S.fmo+k,1),piv=invoice(a,S.fmo+k);return `<div class="cc-pm${k===0?' cur':''}"><span>${MES[mDate.getMonth()].slice(0,3)}</span><strong>${BRL(piv.tot)}</strong></div>`}).join('');return `<article class="cc-card"><div class="cc-head"><strong>${esc(a.n)}</strong><span>Fecha ${a.close||28} · Vence ${a.due||10}</span></div><div><small style="color:var(--mute)">Fatura de ${MES[+iv.end.slice(5,7)-1]} (${iv.closed?'fechada':'aberta'})</small><div class="cc-val">${BRL(iv.tot)}</div></div>${a.lim?`<div><div class="fb ${bst(used/a.lim*100)}"><i style="width:${Math.min(100,used/a.lim*100)}%"></i></div><small style="color:var(--mute)">Usado ${BRL(used)} de ${BRL(a.lim)}</small></div>`:''}<div class="cc-proj" aria-label="Projeção das próximas faturas">${proj}</div></article>`}).join('')}</div>`:'';
  body=`<div class="panel wide"><h2>Contas e cartões</h2>${cardShowcase}${F.acc.map(a=>{const b=bal(a),card=a.ty==='card',iv=card?invoice(a):null,used=card?Math.max(0,-b):0,needRec=!card&&Number.isFinite(a.stmtFin)&&Math.abs(b-a.stmtFin)>=.01;return `<div class="item"><div class="t">${esc(a.n)} <span class="chip c-b">${ACT[a.ty]||''}</span><small>${card?`Fatura de ${MES[+iv.end.slice(5,7)-1]}: ${BRL(iv.tot)} · pago ou agendado ${BRL(iv.paid)} · restante ${BRL(iv.left)} · fecha ${fmt(iv.end)} · vence ${fmt(iv.due)} (${iv.closed?'fechada':'aberta'})${iv.legacy?' · confira transferências antigas não vinculadas':''}`:'Saldo atual'+(needRec?' · último extrato '+BRL(a.stmtFin):'')}</small>${card&&a.lim?`<div class="fb ${bst(used/a.lim*100)}" style="margin-top:var(--space-2)"><i style="width:${Math.min(100,used/a.lim*100)}%"></i></div><small>Em uso ${BRL(used)} de ${BRL(a.lim)}</small>`:''}</div><strong class="${b<0?'neg':'pos'}">${BRL(b)}</strong>${needRec?`<button class="pill" data-a="reconcile-acc" data-id="${esc(a.id)}">Reconciliar com extrato (${BRL(a.stmtFin)})</button>`:''}${card&&iv.left>0?`<button class="pill" data-a="payinv" data-id="${a.id}">Pagar fatura</button>`:''}${accountEdit(a)}${del('delacc',a.id,'Excluir conta')}${card?invoiceLinkForm(a,iv):''}</div>`}).join('')}<form class="bar" id="facc" style="margin:var(--space-2) 0 0"><input class="in grow" name="n" placeholder="Nome da conta ou cartão" required><select class="in" name="ty" aria-label="Tipo">${Object.entries(ACT).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select><input class="in" name="ini" type="number" step="any" placeholder="Saldo inicial" style="width:130px"><input class="in f-card" name="lim" type="number" min="0" placeholder="Limite" style="width:110px"><input class="in f-card" name="close" type="number" min="1" max="31" placeholder="Fecha dia" style="width:100px"><input class="in f-card" name="due" type="number" min="1" max="31" placeholder="Vence dia" style="width:100px"><button class="pill">Adicionar conta</button></form><p class="empty" style="padding:var(--space-1) 0 0">Compras no cartão entram como despesas na conta do cartão, e as parcelas se espalham pelos meses seguintes. Para pagar a fatura, use "Pagar fatura", que registra uma transferência da sua conta para o cartão.</p></div>
  <div class="panel"><h2>Lançamentos recorrentes</h2>${subscriptions.length?`<h3>Assinaturas ativas</h3><p class="empty">${subscriptions.length} ${subscriptions.length===1?'assinatura':'assinaturas'} · ${BRL(subscriptions.reduce((sum,r)=>sum+(+r.v||0),0))} por mês.</p>${subscriptions.map(r=>{const al=recPriceAlert(r);return `<div class="item"><div class="t">${esc(r.t)}${al?` <span class="chip ${al.diff>0?'c-p':'c-g'}">${al.diff>0?'subiu +':'caiu −'}${BRL(Math.abs(al.diff))}</span>`:''}<small>${recurringInfo(r)} · ${BRL(r.v)} por mês · ${BRL(r.v*12)} por ano${r.review?' · revisão pendente':''}</small></div>${al?`<button class="pill" data-a="rec-upd-val" data-id="${esc(r.id)}">Atualizar para ${BRL(al.last.v)}</button>`:''}<button class="pill" data-a="sub-review" data-id="${esc(r.id)}">${r.review?'Concluir revisão':'Marcar para revisão'}</button><button class="pill" data-a="edrec" data-id="${esc(r.id)}">Abrir</button>${r.review?`<button class="pill" data-a="sub-task" data-id="${esc(r.id)}">Criar tarefa</button>`:''}</div>`}).join('')}`:''}${F.rec.map(r=>{const al=recPriceAlert(r);return `<div class="item"><div class="t">${esc(r.t)}${al?` <span class="chip ${al.diff>0?'c-p':'c-g'}">${al.diff>0?'subiu +':'caiu −'}${BRL(Math.abs(al.diff))}</span>`:''}<small>${r.k==='in'?'Receita':'Despesa'} · todo dia ${r.day} · ${esc(accName(r.ac||F.acc[0].id))}${r.end?' · até '+fmt(r.end):''} · ${recurringInfo(r)}</small></div><strong class="${r.k==='in'?'pos':'neg'}">${BRL(r.v)}</strong>${al?`<button class="pill" data-a="rec-upd-val" data-id="${esc(r.id)}">Atualizar para ${BRL(al.last.v)}</button>`:''}${r.k==='out'&&r.cat==='Assinaturas'&&r.review?`<button class="pill" data-a="sub-review" data-id="${esc(r.id)}">Concluir revisão</button>`:''}<button class="x" data-a="edrec" data-id="${r.id}" aria-label="Editar recorrência">✎</button>${del('delrec',r.id,'Excluir recorrência')}</div>`}).join('')||'<p class="empty">Salário, aluguel, assinaturas: cadastre uma vez e o lançamento aparece sozinho todo mês.</p>'}<form class="bar" id="frec" style="margin:var(--space-2) 0 0"><select class="in" name="k" aria-label="Tipo"><option value="out" ${!er||er.k==='out'?'selected':''}>Despesa</option><option value="in" ${er&&er.k==='in'?'selected':''}>Receita</option></select><input class="in grow" name="t" placeholder="Descrição" value="${er?esc(er.t):''}" required><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor" value="${er?er.v:''}" required style="width:110px"><select class="in" name="cat" aria-label="Categoria">${catOpts(er&&er.cat)}</select><select class="in" name="ac" aria-label="Conta">${accOpts(er&&(er.ac||F.acc[0].id))}</select><input class="in" name="day" type="number" min="1" max="31" placeholder="Dia" value="${er?er.day:''}" required style="width:80px"><input class="in" type="date" name="end" value="${er?er.end||'':''}" title="Termina em (opcional)" aria-label="Termina em">${!er?'<label><input type="checkbox" name="reminder" value="1"> Criar lembrete mensal na agenda (despesas)</label>':''}<button class="pill${er?' dark':''}">${er?'Salvar recorrência':'Criar'}</button>${er?'<button type="button" class="pill" data-a="reccancel">Cancelar</button>':''}</form>${detectedRecPanel()}</div>
  <div class="panel"><h2>Contas fixas e assinaturas</h2>${F.bills.map(b=>`<div class="item"><div class="t">${esc(b.n)}<small>dia ${b.day} de cada mês, lembrete na agenda · ${b.ac?esc(accName(b.ac)):'sem conta de pagamento'}</small></div><strong>${BRL(b.v)}</strong><button class="x" data-a="edbill" data-id="${b.id}" aria-label="Editar conta">✎</button>${del('delbill',b.id,'Excluir conta')}</div>`).join('')||'<p class="empty">Cadastre contas que se repetem. Elas entram na agenda todo mês.</p>'}${F.bills.length?`<p class="empty" style="margin:0 0 var(--space-2)">Total fixo: ${BRL(bills)} por mês. Estes lembretes podem ser independentes ou ligados a uma recorrência.</p>`:''}<form class="bar" id="fbill" style="margin:var(--space-2) 0 0"><input class="in grow" name="n" placeholder="Nome" value="${eb?esc(eb.n):''}" required><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor" value="${eb?eb.v:''}" required style="width:110px"><input class="in" name="day" type="number" min="1" max="31" placeholder="Dia" value="${eb?eb.day:''}" required style="width:80px"><label class="lb">Conta de pagamento<select class="in" name="ac" ${eb&&eb.rec?'disabled':''}><option value="">Sem conta vinculada</option>${F.acc.filter(a=>a.ty!=='card').map(a=>`<option value="${esc(a.id)}" ${eb&&eb.ac===a.id?'selected':''}>${esc(a.n)}</option>`).join('')}</select></label>${eb&&eb.rec?'<small class="empty">Conta definida pela recorrência; edite-a em Lançamentos recorrentes.</small>':''}<button class="pill${eb?' dark':''}">${eb?'Salvar conta':'Adicionar'}</button>${eb?'<button type="button" class="pill" data-a="billcancel">Cancelar</button>':''}</form></div>`;
 }else if(tab==='regras'){
  const cls=IMP?' wide':'';
  body=`<div class="panel${cls||' c4'}">${rulesPanel()}</div>
  <div class="panel${cls||' c2'}"><h2>Importar extrato (CSV ou OFX)</h2>${impPanel()}</div>`;
 }
 return head+formHtml+tabsHtml+`<div class="cards">${body}</div>`;
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
 if(i.dataset.reconcileFilter!==undefined){FRECON=i.value;TXBULKDEL=false;render();return}
 if(i.dataset.fac!==undefined){S.fac=i.value;TXBULKDEL=false;render();return}
 if(i.dataset.fcat!==undefined){S.fcat=i.value;TXBULKDEL=false;render();return}
 if(invHandleChange(i)){renderKeepDraft();return}
 if(i.name==='k'&&i.form&&i.form.id==='ffin'){i.form.classList.remove('kout','kin','ktr');i.form.classList.add('k'+i.value)}
 if(i.name==='ty'&&i.form&&i.form.id==='facc')i.form.classList.toggle('facard',i.value==='card');
});
document.addEventListener('input',e=>{const i=e.target;if(i&&i.id==='fq'){FQ=i.value;TXBULKDEL=false;const el=$('#txlist');if(el)el.innerHTML=txListHtml(finMonth().tx)}if(i&&i.name==='v'&&i.form&&i.form.id==='fbud'){const el=i.form.querySelector('[data-budget-preview]'),v=num(i.value);if(el)el.textContent=i.value.trim()?(Number.isFinite(v)&&v>0?'Valor interpretado: '+BRL(v):'Informe um valor maior que zero.'):''}if(i&&i.form&&i.form.dataset.accEdit&&['close','due'].includes(i.name))accountImpact(i.form)});

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
function invoice(a,o){
 const f=new Date(today.getFullYear(),today.getMonth()+(o==null?S.fmo:o),1),y=f.getFullYear(),m=f.getMonth(),cl=+a.close||28,c=Math.min(cl,dimOf(y,m)),end=ds(new Date(y,m,c)),pm=new Date(y,m-1,1),st=ds(add(new Date(pm.getFullYear(),pm.getMonth(),Math.min(cl,dimOf(pm.getFullYear(),pm.getMonth()))),1));
 let tot=0;S.fin.tx.forEach(t=>{if(t.k==='out'&&accId(t)===a.id&&t.d>=st&&t.d<=end)tot+=t.v});
 const dd=+a.due||10,dm=new Date(y,dd>cl?m:m+1,1),due=ds(new Date(dm.getFullYear(),dm.getMonth(),Math.min(dd,dimOf(dm.getFullYear(),dm.getMonth()))));
 const paid=S.fin.tx.filter(t=>t.k==='tr'&&t.to===a.id&&t.invoice===end).reduce((s,t)=>s+(+t.v||0),0),legacy=S.fin.tx.some(t=>t.k==='tr'&&t.to===a.id&&!t.invoice&&t.d>=st&&t.d<=due);
 return{tot,end,due,paid,left:Math.max(0,Math.round((tot-paid)*100)/100),legacy,closed:end<T}}
function invoiceLinkForm(a,iv){const tx=finInit().tx.filter(t=>t.k==='tr'&&t.to===a.id&&!t.invoice);if(!tx.length||iv.left<=0)return '';return `<details><summary>Associar transferência antiga à fatura</summary><p class="empty">Confira a data, a conta e o valor. A associação não cria nem altera a transferência.</p><form class="bar" data-invoice-link="${esc(a.id)}" data-end="${iv.end}"><select class="in grow" name="tx" aria-label="Transferência anterior">${tx.map(t=>`<option value="${esc(t.id)}">${fmt(t.d)} · ${esc(accName(accId(t)))} · ${BRL(t.v)} · ${esc(t.t)}</option>`).join('')}</select><label><input type="checkbox" name="confirm" required> Confirmo que é desta fatura</label><button class="pill">Associar pagamento</button></form></details>`}
function lineChart(){
 const F=finInit(),f=new Date(today.getFullYear(),today.getMonth()+S.fmo,1),y0=f.getFullYear(),m0=f.getMonth(),N=dimOf(y0,m0),p=ds(f).slice(0,7),cut=S.fmo===0?today.getDate():S.fmo<0?N:0,sal=S.flm==='sal',fa=S.fac;
 const okf=t=>!fa||accId(t)===fa||(t.k==='tr'&&t.to===fa),act=Array(N+1).fill(0),sch=Array(N+1).fill(0);let varSum=0;
 F.tx.forEach(t=>{if(t.d.slice(0,7)!==p||!okf(t))return;if(t.k==='tr'&&!(sal&&fa))return;const d=+t.d.slice(8),v=t.k==='in'?t.v:t.k==='out'?-t.v:((accId(t)===fa?-t.v:0)+(t.to===fa?t.v:0));if(t.d>T)sch[d]+=v;else{act[d]+=v;if(t.k==='out'&&!t.rc&&!t.pc)varSum+=t.v}});
 F.rec.forEach(r=>{if(fa&&r.ac!==fa&&!(fa===F.acc[0].id&&!r.ac))return;const dd=Math.min(+r.day||1,N),d=ds(new Date(y0,m0,dd)),id='r_'+r.id+'_'+p;if(d>T&&(r.ini||T)<=d&&(!r.end||d<=r.end)&&!F.tx.some(t=>t.id===id)&&!(r.skip||[]).includes(id))sch[dd]+=r.k==='in'?r.v:-r.v});
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
 F.bills.filter(b=>(!b.rec||!F.rec.some(r=>r.id===b.rec))&&(!S.fac||b.ac===S.fac)).forEach(b=>g(Math.min(+b.day||1,N)).ev.push({t:'Conta: '+b.n,v:b.v,c:'y'}));
 F.rec.forEach(r=>{const dd=Math.min(+r.day||1,N),d=ds(new Date(y,m,dd)),id='r_'+r.id+'_'+p;if((!S.fac||(r.ac||F.acc[0].id)===S.fac)&&d>T&&(r.ini||T)<=d&&(!r.end||d<=r.end)&&!F.tx.some(t=>t.id===id)&&!(r.skip||[]).includes(id))g(dd).ev.push({t:r.t+' (agendado)',v:r.v,c:r.k==='in'?'g':'p'})});
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
 <form class="bar" id="frule" style="margin:var(--space-2) 0 0"><select class="in" name="ty" aria-label="Tipo"><option value="out" ${sel(e&&e.ty||'out','out')}>Despesa</option><option value="in" ${sel(e&&e.ty,'in')}>Receita</option><option value="any" ${sel(e&&e.ty,'any')}>Qualquer</option></select><select class="in" name="md" aria-label="Condição"><option value="c" ${sel(e&&e.md,'c')}>contém</option><option value="s" ${sel(e&&e.md,'s')}>começa com</option><option value="e" ${sel(e&&e.md,'e')}>é igual a</option><option value="r" ${sel(e&&e.md,'r')}>expressão (regex)</option></select><input class="in grow" name="m" placeholder="Texto da descrição" value="${e?esc(e.m||''):''}"><input class="in" name="min" type="number" step="any" placeholder="Valor mín." value="${e&&e.min!==''?e.min:''}" style="width:110px"><input class="in" name="max" type="number" step="any" placeholder="Valor máx." value="${e&&e.max!==''?e.max:''}" style="width:110px"><select class="in" name="ac" aria-label="Conta"><option value="">Qualquer conta</option>${accOpts(e&&e.ac)}</select><select class="in" name="cat" aria-label="Categoria">${FC.map(c=>`<option ${e&&e.cat===c?'selected':''}>${c}</option>`).join('')}</select><input class="in" name="sub" list="subl" placeholder="Subcategoria" value="${e?esc(e.sub||''):''}"><input class="in" name="tg" list="alltags" placeholder="Etiquetas" value="${e?esc(e.tg||''):''}"><input class="in" name="pj" list="pjl" placeholder="Projeto" value="${e?esc(e.pj||''):''}"><button class="pill dark">${e?'Salvar regra':'Adicionar regra'}</button>${e?'<button type="button" class="pill" data-a="rcancel">Cancelar</button>':''}</form>
 <div class="bar" style="margin:var(--space-2) 0 0"><input class="in grow" id="rtest" placeholder="Testar: digite uma descrição, como UBER *TRIP"><input class="in" id="rtv" type="number" step="any" placeholder="Valor" style="width:110px"></div><p id="rtestout" class="empty" style="padding:0 0 var(--space-2)"></p>
 <div class="bar"><button class="pill" data-a="rulesapply">Categorizar lançamentos em "Outros"</button><button class="pill${RARM?' dark':''}" data-a="rapplyall">${RARM?'Confirmar: recategorizar todos':'Recategorizar todos os lançamentos'}</button>${RARM?'<button class="pill" data-a="rcancelall">Cancelar</button>':''}</div>`}
function finSubmit(v){
 const F=finInit(),e=FED?F.tx.find(t=>t.id===FED):null,oldT=e?e.t:'';
 if(!e){const p=parseFinNL(v.t,v.v,!v.d||v.d===T);v=Object.assign({},v,{t:p.t,v:p.v,d:p.d||v.d||T,tg:normTags([v.tg,p.tg].filter(Boolean).join(', '))})}
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
 const n=k==='out'?Math.min(48,Math.max(1,+v.pc||1)):1,t=v.t.trim();
 if(n>1){const g=uid(),base=Math.floor(x/n*100)/100;for(let i=0;i<n;i++){const val=i===n-1?Math.round((x-base*(n-1))*100)/100:base;F.tx.unshift({id:uid(),k,t,v:val,cat,d:addM(v.d,i),ac:v.ac,...ex,pc:{g,i:i+1,n}})}toast(n+' parcelas lançadas'+(+v.pc>48?' (limite de 48 parcelas)':''))}
 else{const o={id:uid(),k,t,v:x,cat,d:v.d,ac:v.ac,...ex};if(k==='tr')o.to=v.to;if(invEnd)o.invoice=invEnd;F.tx.unshift(o);toast(k==='in'?'Receita lançada':k==='tr'?'Transferência registrada':'Despesa lançada'+(R?' ('+esc(cat)+(ex.sub?' › '+esc(ex.sub):'')+' pela regra)':''))}}
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
function closingPanel(){
 const F=finInit(),m=finMonth(),sal=r2(m.inc-m.out),mn=MES[m.f.getMonth()];
 const buds=Object.entries(budgetsAt(m.p)),okBud=buds.filter(([c,l])=>(m.by[c]||0)<=l).length;
 const goals=[...F.goals].sort((a,b)=>(b.res?1:0)-(a.res?1:0));
 const rate=m.inc>0?Math.round(sal/m.inc*100):null;
 let body='';
 if(!m.inc&&!m.out)body='<p class="empty">Sem movimentações registradas neste mês.</p>';
 else if(sal<=0)body=`<p>Resultado de ${mn}: <strong class="neg">− ${BRL(-sal)}</strong>.${buds.length?' '+okBud+' de '+buds.length+' orçamentos dentro do limite.':''}</p>`;
 else body=`<p>Sobraram <strong class="pos">${BRL(sal)}</strong> em ${mn}${rate!==null?' ('+rate+'% da renda)':''}.${buds.length?' '+okBud+' de '+buds.length+' orçamentos dentro do limite.':''}</p><form class="bar" id="fclosemonth" style="margin:var(--space-2) 0 0"><label class="lb" style="margin:0">Valor a destinar<input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" value="${sal.toFixed(2).replace('.',',')}" required style="width:130px"></label><label class="lb" style="margin:0">Destino<select class="in" name="goal">${goals.map(g=>`<option value="${esc(g.id)}">${esc(g.n)} (${BRL(g.saved)}/${BRL(g.target)})</option>`).join('')}<option value="__inv_cash">Caixa de Investimentos (para próximo aporte)</option></select></label><button class="pill dark">Destinar sobra</button></form>`;
 return `<h2>Fechamento de ${mn}</h2>${body}`;
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
function finYear(y){
 const ms=[];for(let m=0;m<12;m++)ms.push(y===today.getFullYear()&&m>today.getMonth()?{f:new Date(y,m,1),p:'',tx:[],inc:0,out:0,by:{}}:finMonth((y-today.getFullYear())*12+m-today.getMonth()));
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
 const fx=d.tx.filter(t=>t.k==='out'&&(t.rc||t.pc)).reduce((a,t)=>a+t.v,0);if(d.out>0&&fx>0)L.push(`${Math.round(fx/d.out*100)}% dos gastos são fixos (recorrências e parcelas) e o resto é variável.`);
 const bg=d.tx.filter(t=>t.k==='out').sort((a,b)=>b.v-a.v)[0];if(bg)L.push(`O maior gasto isolado foi "${bg.t}", ${BRL(bg.v)}, em ${fmt(bg.d)}.`);
 const fut=finInit().tx.filter(t=>t.k==='out'&&t.pc&&t.d>T).reduce((a,t)=>a+t.v,0);if(cur&&fut>0)L.push(`Ainda há ${BRL(fut)} em parcelas a vencer.`);
 return L}
function relAnual(){
 const F=finInit();genRec();const Y=today.getFullYear()+S.fyr,d=finYear(Y),pv=finYear(Y-1),cur=Y===today.getFullYear(),sal=d.inc-d.out,rate=d.inc>0?Math.round(sal/d.inc*100):null;
 const act=d.ms.map((m,i)=>({i,m,r:m.inc-m.out})).filter(x=>x.m.inc||x.m.out),nAct=act.length||1,best=act.length>1?[...act].sort((a,b)=>b.r-a.r)[0].i:-1,worst=act.length>1?[...act].sort((a,b)=>a.r-b.r)[0].i:-1;
 const cs=Object.keys(d.by).sort((a,b)=>d.by[b]-d.by[a]).slice(0,14),maxr=c=>Math.max(1,...d.ms.map(m=>m.by[c]||0));
 const bigs=d.tx.filter(t=>t.k==='out').sort((a,b)=>b.v-a.v).slice(0,10);
 const fx=d.tx.filter(t=>t.k==='out'&&(t.rc||t.pc)).reduce((a,t)=>a+t.v,0),vr=d.out-fx;
 const agg=o=>{const ks=Object.keys(o).sort((a,b)=>o[b]-o[a]).slice(0,8),mx=Math.max(1,...ks.map(k=>o[k]));return ks.map((k,i)=>`<div class="cat" style="grid-template-columns:minmax(80px,115px) 1fr auto"><span>${k.startsWith('#')?`<button class="chip tgc" data-a="tagv" data-id="${esc(k.slice(1))}">${esc(k)}</button>`:esc(k)}</span><div class="fb"><i style="width:${o[k]/mx*100}%;background:${PAL8[i%8]}"></i></div><small>${BRL(o[k])}</small></div>`).join('')};
 const sb={},tg={};d.tx.forEach(t=>{if(t.k!=='out')return;if(t.sub)sb[t.cat+' › '+t.sub]=(sb[t.cat+' › '+t.sub]||0)+t.v;tagsU(t).forEach(x=>{tg['#'+x]=(tg['#'+x]||0)+t.v})});
 const sum=yearSummary(d,pv,cur),csv=n=>String(n.toFixed(2)).replace('.',',');
 return `<div class="top"><h1>Finanças</h1><div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap">${vwToggle()}<select class="in" data-fac="1" aria-label="Filtrar por conta"><option value="">Todas as contas</option>${accOpts(S.fac)}</select><span style="display:inline-flex;gap:var(--space-2);align-items:center"><button class="pill" data-a="fyn" data-n="-1" aria-label="Ano anterior">‹</button><strong>${Y}</strong><button class="pill" data-a="fyn" data-n="1" aria-label="Próximo ano">›</button></span><button class="pill" data-a="fyn" data-n="0">Este ano</button></div></div>
 <div class="rv4"><div class="stat c-g"><span>Receitas de ${Y}</span><strong>${BRL(d.inc)}</strong></div><div class="stat c-p"><span>Despesas de ${Y}</span><strong>${BRL(d.out)}</strong></div><div class="stat ${sal<0?'c-y':'c-b'}"><span>Resultado do ano${rate!==null?' · poupança '+rate+'%':''}</span><strong>${BRL(sal)}</strong></div><div class="stat c-y"><span>Gasto médio por mês</span><strong>${BRL(d.out/nAct)}</strong></div></div>
 <div class="cards" style="margin-top:var(--space-3)">
 <div class="panel c4"><h2>Resumo de ${Y}</h2>${sum.map(s=>`<p style="margin:0 0 var(--space-2)">${esc(s)}</p>`).join('')}<div class="bar" style="margin:var(--space-2) 0 0"><button class="pill" data-a="fexp">Baixar relatório (CSV)</button></div><p id="fexpm" class="empty" style="padding:0"></p></div>
 <div class="panel c2"><h2>Fixo e variável</h2>${d.out>0?`<div class="cat" style="grid-template-columns:80px 1fr auto"><span>Fixo</span><div class="fb"><i style="width:${fx/d.out*100}%;background:var(--blue)"></i></div><small>${BRL(fx)} (${Math.round(fx/d.out*100)}%)</small></div><div class="cat" style="grid-template-columns:80px 1fr auto"><span>Variável</span><div class="fb"><i style="width:${vr/d.out*100}%;background:var(--pink)"></i></div><small>${BRL(vr)} (${Math.round(vr/d.out*100)}%)</small></div><p class="empty" style="padding:0">Fixo = recorrências automáticas e parcelas.</p>`:'<p class="empty">Sem despesas neste ano.</p>'}</div>
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
 siteSave('relatorio-financeiro-'+Y+'.csv',csv,'text/csv');m.textContent='Relatório baixado.';
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
function trValid(f){if(!f||f.id!=='ffin')return;const to=f.querySelector('[name=to]'),ac=f.querySelector('[name=ac]');if(!to||!ac)return;to.setCustomValidity(f.classList.contains('ktr')?(S.fin.acc.length<2?'Cadastre uma segunda conta, em "Contas e cartões", para fazer transferências':ac.value===to.value?'Escolha uma conta de destino diferente da origem':''):'')}
document.addEventListener('change',e=>{const i=e.target;if(i&&i.form&&i.form.id==='ffin'&&(i.name==='k'||i.name==='ac'||i.name==='to'))trValid(i.form)});

/* ===== Pacote D: fluxo de caixa previsto e comparação anual ===== */
function cashFlow(o){
 const F=finInit(),H=o.days,fac=o.fac||'',isCard=a=>a.ty==='card',set=new Set((fac?F.acc.filter(a=>a.id===fac):F.acc.filter(a=>!isCard(a))).map(a=>a.id));
 if(!set.size)return null;
 let start=0;set.forEach(id=>{start+=bal(F.acc.find(x=>x.id===id))});
 const endD=ds(add(today,H)),evs=[],push=(d,t,v,k)=>{v=+v;if(v&&d>T&&d<=endD)evs.push({d,t,v,k})};
 F.tx.forEach(t=>{if(t.d<=T||t.d>endD)return;const ac=accId(t);let v=0;if(t.k==='in'&&set.has(ac))v=t.v;else if(t.k==='out'&&set.has(ac))v=-t.v;else if(t.k==='tr')v=(set.has(t.to)?t.v:0)-(set.has(ac)?t.v:0);if(v)push(t.d,t.t,v,v>0?'in':'out')});
 for(let i=0;i<=Math.ceil(H/28)+1;i++){
  const m0=new Date(today.getFullYear(),today.getMonth()+i,1),y=m0.getFullYear(),mo=m0.getMonth(),p=ds(m0).slice(0,7),N=dimOf(y,mo);
  F.rec.forEach(r=>{const ac=r.ac||F.acc[0].id;if(!set.has(ac))return;const dd=Math.min(+r.day||1,N),d=ds(new Date(y,mo,dd)),id='r_'+r.id+'_'+p;if(d>T&&(r.ini||T)<=d&&(!r.end||d<=r.end)&&!F.tx.some(t=>t.id===id)&&!(r.skip||[]).includes(id))push(d,r.t,r.k==='in'?r.v:-r.v,r.k==='in'?'in':'out')});
  F.bills.forEach(b=>{if(fac&&b.ac!==fac)return;const d=ds(new Date(y,mo,Math.min(+b.day||1,N)));if(b.rec&&F.rec.some(r=>r.id===b.rec))return;push(d,b.n,-b.v,'bill')})}
 if(!fac)F.acc.filter(isCard).forEach(a=>[-1,0,1,2,3].forEach(off=>{const iv=invoice(a,off);if(iv.due>T&&iv.due<=endD&&iv.left>0)push(iv.due,'Fatura '+a.n,-iv.left,'card')}));
 let vs=0;const from=ds(add(today,-60));F.tx.forEach(t=>{const a=F.acc.find(x=>x.id===accId(t));if(t.k==='out'&&!t.rc&&!t.pc&&a&&a.ty!=='card'&&t.d>from&&t.d<=T&&(!fac||accId(t)===fac))vs+=t.v});
 const avg=o.vary?vs/60:0,by={};evs.forEach(e=>(by[e.d]=by[e.d]||[]).push(e));
 let b=start;const pts=[{d:T,v:b,ev:[]}];let minP=pts[0],firstNeg=b<0?pts[0]:null;
 for(let i=1;i<=H;i++){const d=ds(add(today,i));let ch=-avg;(by[d]||[]).forEach(e=>ch+=e.v);b+=ch;const q={d,v:b,ev:by[d]||[]};pts.push(q);if(b<minP.v)minP=q;if(b<0&&!firstNeg)firstNeg=q}
 return{start,pts,evs:evs.sort((a,c)=>a.d.localeCompare(c.d)),avg,minP,firstNeg,end:b,H}}
function nextIncomePanel(){
 const F=finInit(),a=F.acc.find(x=>x.id===F.primary&&x.ty!=='card'),head='<div class="panel c2"><h2>Até o próximo recebimento</h2>';
 if(!a)return head+'<p>Escolha uma conta principal em Contas e cartões para ver a previsão.</p></div>';
 const recurring=F.rec.filter(r=>r.k==='in'&&(r.ac||F.acc[0].id)===a.id).flatMap(r=>[...Array(13)].map((_,i)=>{const m=new Date(today.getFullYear(),today.getMonth()+i,1),d=ds(new Date(m.getFullYear(),m.getMonth(),Math.min(+r.day||1,dimOf(m.getFullYear(),m.getMonth())))),id='r_'+r.id+'_'+d.slice(0,7);return d>T&&(r.ini||T)<=d&&(!r.end||d<=r.end)&&!F.tx.some(t=>t.id===id)&&!(r.skip||[]).includes(id)?{d}:null}).filter(Boolean));
 const next=[...F.tx.filter(t=>t.k==='in'&&t.d>T&&accId(t)===a.id),...recurring].sort((x,y)=>x.d.localeCompare(y.d))[0];
 if(!next)return head+`<p>Nenhuma receita futura cadastrada em ${esc(a.n)}.</p></div>`;
 const days=Math.round((new Date(next.d+'T12:00')-new Date(T+'T12:00'))/864e5);if(days>366)return head+'<p>A próxima receita está a mais de 366 dias; a previsão não está disponível para esse intervalo.</p></div>';
 const c=cashFlow({days,fac:a.id,vary:false}),included=c.evs.filter(e=>e.d<next.d||e.v<0),v=c.start+included.reduce((sum,e)=>sum+e.v,0);
 return head+`<p>Estimativa antes de receber em ${fmt(next.d)}: <strong>${BRL(v)}</strong> em ${esc(a.n)}.</p><details><summary>Como esta previsão foi calculada</summary><p>Saldo de partida: ${BRL(c.start)}.</p>${included.map(e=>`<div class="item"><div class="t">${esc(e.t)}<small>${fmt(e.d)}</small></div><span>${e.v<0?'−':'+'} ${BRL(Math.abs(e.v))}</span></div>`).join('')||'<p class="empty">Nenhuma movimentação prevista no período.</p>'}<p>Total estimado: ${BRL(v)}.</p></details><p class="empty">O saldo de partida inclui lançamentos de hoje. A estimativa inclui despesas previstas até a data, inclusive no dia do recebimento; entradas nesse dia não entram. Não inclui faturas sem pagamento agendado nem contas sem conta de pagamento vinculada; confira esses valores. Contas fixas independentes podem coincidir com lançamentos; confira possíveis duplicatas. Gastos ainda não cadastrados não entram.</p></div>`}
function cashSvg(c){
 const W=540,H=235,L=46,R=14,T0=14,B=26,pw=W-L-R,ph=H-T0-B,vals=c.pts.map(p=>p.v),mx0=Math.max(...vals),mn0=Math.min(...vals),pd=Math.max(1,(mx0-mn0)*.12),hi=mx0+pd,lo=mn0<0?mn0-pd:Math.max(0,mn0-pd),x=i=>L+pw*i/c.H,y=v=>T0+ph*(hi-v)/((hi-lo)||1);
 let g='';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 const step=Math.max(1,Math.round(c.H/5));for(let i=0;i<=c.H;i+=step)g+=`<text x="${x(i)}" y="${H-8}" text-anchor="${i===0?'start':i+step>c.H?'end':'middle'}">${fmt(c.pts[i].d)}</text>`;
 const pl=c.pts.map((p,i)=>x(i)+','+y(p.v)).join(' '),z=y(0);
 const neg=lo<0?`<rect x="${L}" y="${z}" width="${pw}" height="${Math.max(0,T0+ph-z)}" fill="var(--neg)" opacity=".1"/>`:'';
 const big=[...c.evs].sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,8).map(e=>{const i=Math.round((new Date(e.d+'T00:00')-new Date(T+'T00:00'))/864e5),p=c.pts[i];return p?`<circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" fill="${e.v>0?'var(--green)':'var(--neg)'}"><title>${esc(e.t)}: ${BRL(e.v)} em ${fmt(e.d)}</title></circle>`:''}).join('');
 const fn=c.firstNeg?(()=>{const i=c.pts.indexOf(c.firstNeg);return `<line x1="${x(i)}" x2="${x(i)}" y1="${T0}" y2="${T0+ph}" stroke="var(--neg)" stroke-dasharray="3 3"/>`})():'';
 return `<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo previsto para os próximos ${c.H} dias: hoje ${BRL(c.start)}, ao final ${BRL(c.end)}, menor saldo ${BRL(c.minP.v)} em ${fmt(c.minP.d)}">${g}${neg}${lo<0?`<line x1="${L}" x2="${W-R}" y1="${z}" y2="${z}" stroke="var(--mute)" stroke-dasharray="2 4"/>`:''}${fn}<polyline points="${pl}" fill="none" stroke="var(--s1)" stroke-width="2.5"/>${big}</svg>`}
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
function avgOut3(){const a=[1,2,3].map(i=>mNet(-i).out).filter(v=>v>0);return a.length?a.reduce((s,v)=>s+v,0)/a.length:0}
function avgSave3(){return [1,2,3].reduce((s,i)=>{const m=mNet(-i);return s+m.inc-m.out},0)/3}
function reservaPanel(){
 const F=finInit(),R=F.goals.filter(g=>g.res),avg=avgOut3(),sv=avgSave3();
 const head='<h2>Reserva de emergência</h2>';
 const form=`<form class="bar" id="fres" style="margin:var(--space-2) 0 0"><select class="in" name="rm" aria-label="Meses de cobertura">${[3,6,9,12].map(n=>`<option value="${n}" ${n===6?'selected':''}>${n} meses de despesas</option>`).join('')}</select><input class="in" name="saved" type="text" inputmode="decimal" autocomplete="off" placeholder="Já guardado (opcional)" style="width:170px"><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor alvo (opcional)" style="width:160px"><button class="pill dark">Criar reserva</button></form>`;
 if(!R.length)return head+`<p class="empty" style="padding:0 0 var(--space-1)">A reserva cobre seus gastos se a renda parar. O alvo é calculado pela sua média de despesas dos últimos 3 meses${avg?' (hoje, '+BRL(avg)+' por mês)':''}.</p>`+form;
 return head+R.map(g=>{
  const tg=+g.target||0,p=tg?Math.min(100,Math.round(g.saved/tg*100)):0,cov=avg?g.saved/avg:0,rest=Math.max(0,tg-g.saved),drift=avg&&tg?Math.abs((g.rm||6)*avg-tg)/tg>.1:false;
  let eta='';if(rest<=0)eta='Reserva completa.';else if(sv>0){const n=Math.ceil(rest/sv),d=new Date(today.getFullYear(),today.getMonth()+n,1);eta=`No ritmo de poupança dos últimos 3 meses (${BRL(sv)} por mês), você chega lá em <strong>${n} ${n===1?'mês':'meses'}</strong> (${MES[d.getMonth()]}/${d.getFullYear()}).`}else eta='Sua poupança média recente é zero ou negativa, então ainda não dá para estimar o prazo.';
  return `<div class="item" style="flex-wrap:wrap"><div class="t"><strong>${esc(g.n)}</strong><small>${BRL(g.saved)} de ${BRL(tg)} (${p}%)${avg?' · cobre '+cov.toFixed(1).replace('.',',')+' meses de despesas':''}</small><div class="fb" style="margin:var(--space-2) 0"><i style="width:${p}%"></i></div><small>${eta}</small>${drift?`<small class="late">Sua média de despesas mudou: a meta de ${g.rm||6} meses seria ${BRL((g.rm||6)*avg)}. <button class="pill" data-a="resrec" data-id="${g.id}">Recalcular meta</button></small>`:''}</div><select class="in" data-rm="${g.id}" aria-label="Meses de cobertura">${[3,6,9,12].map(n=>`<option value="${n}" ${(g.rm||6)===n?'selected':''}>${n} meses</option>`).join('')}</select><input class="in" data-gdep="${g.id}" type="text" inputmode="decimal" autocomplete="off" placeholder="+ depositar" aria-label="Depositar na reserva" style="width:130px"></div>`}).join('')}
const prName=r=>r.k==='save'?'Poupar '+r.pc+'% da renda':(r.cat||'Categoria')+' até '+r.pc+'% da renda';
function prEval(r,o){const m=mNet(o);if(!(m.inc>0))return null;const sp=r.k==='save'?m.out:(m.by[r.cat]||0),pct=r.k==='save'?(m.inc-m.out)/m.inc*100:sp/m.inc*100;return{pct,ok:r.k==='save'?pct>=r.pc:pct<=r.pc,inc:m.inc,sp}}
function prMonths(r){let n=0,met=0;for(let o=-1;o>=-6;o--){const e=prEval(r,o);if(e){n++;if(e.ok)met++}}return{n,met}}
function prStreak(r){let s=0;for(let o=-1;o>=-24;o--){const e=prEval(r,o);if(!e||!e.ok)break;s++}return s}
function prPanel(){
 const F=finInit(),P=F.prules;
 const form=`<form class="bar" id="fpr" style="margin:var(--space-2) 0 0"><select class="in" name="tgt" aria-label="Tipo de meta"><option value="save">Poupar no mínimo</option><optgroup label="Gastar no máximo em…">${FC.map(c=>`<option value="cat:${c}">${c}</option>`).join('')}</optgroup></select><input class="in" name="pc" type="text" inputmode="decimal" autocomplete="off" placeholder="% da renda" required style="width:110px"><button class="pill dark">Criar meta</button></form>`;
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
 const form=`<form class="bar" id="fsp" style="margin:var(--space-2) 0 0"><input class="in grow" name="t" placeholder="O que foi dividido (ex.: jantar)" required><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor total" required style="width:120px"><input class="in grow" name="who" placeholder="Com quem (Ana, Bruno)" required><select class="in" name="by" aria-label="Quem pagou"><option value="me">Eu paguei</option><option value="oth">A 1ª pessoa pagou</option></select><span class="adv"><input class="in" name="mine" type="text" inputmode="decimal" autocomplete="off" placeholder="Minha parte (padrão: igual)" style="width:190px"><input class="in" type="date" name="d" value="${T}" aria-label="Data"><select class="in" name="cat" aria-label="Categoria">${catOpts()}</select><select class="in" name="ac" aria-label="Conta usada">${accOpts()}</select></span><button type="button" class="pill" data-a="adv">Mais opções</button><button class="pill dark">Registrar divisão</button></form>`;
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

