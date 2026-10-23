// finanças: contas, cartões, recorrentes, gráficos, importação, regras, relatórios, fluxo de caixa, reserva e divisão de despesas
/* ===== Finanças v2: contas, cartões, recorrentes, gráficos, medidores, importação ===== */
let FED=null,IMP=null,RED=null,BED=null,FQ='';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const dimOf=(y,m)=>new Date(y,m+1,0).getDate();
const addM=(d,n)=>{const x=new Date(d+'T00:00'),day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+n);x.setDate(Math.min(day,dimOf(x.getFullYear(),x.getMonth())));return ds(x)};
const K=v=>PRIV?'•':Math.abs(v)>=1000?(v/1000).toFixed(Math.abs(v)>=1e4?0:1).replace('.',',')+'k':String(Math.round(v));
const PAL8=['var(--pink)','var(--blue)','var(--yellow)','var(--green)','#c8a2e8','#f2a65a','#7fc8c8','#d97b9b'];
const ACT={cc:'Conta corrente',card:'Cartão de crédito',cash:'Dinheiro',inv:'Investimento'};
const hm2=v=>String(v).padStart(2,'0');
function finInit(){const F=S.fin;F.acc=F.acc||[];F.rec=F.rec||[];F.rules=F.rules||[];F.tx=F.tx||[];F.bud=F.bud||{};F.goals=F.goals||[];F.prules=F.prules||[];F.split=F.split||[];F.bills=F.bills||[];if(!F.acc.length)F.acc.push({id:'main',n:'Conta principal',ty:'cc',ini:0});return F}
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
function bal(a){let b=+a.ini||0;S.fin.tx.forEach(t=>{if(t.d>T)return;const ac=accId(t);if(t.k==='in'&&ac===a.id)b+=t.v;else if(t.k==='out'&&ac===a.id)b-=t.v;else if(t.k==='tr'){if(ac===a.id)b-=t.v;if(t.to===a.id)b+=t.v}});return b}
const CATDIC={Alimentação:'mercado supermercado padaria acougue hortifruti feira restaurante lanche pizza hamburguer ifood rappi almoco jantar cafe sorvete churrasco delivery',Transporte:'uber 99 taxi onibus metro gasolina combustivel posto estacionamento pedagio passagem',Moradia:'aluguel condominio luz energia agua internet gas iptu reforma',Saúde:'farmacia drogaria remedio consulta medico dentista exame hospital plano de saude academia',Lazer:'cinema show bar viagem hotel ingresso parque jogo livraria',Educação:'curso escola faculdade mensalidade livro apostila',Assinaturas:'netflix spotify prime disney youtube assinatura icloud'};
const dictCat=t=>{const d=' '+norm(t).replace(/[^a-z0-9 ]/g,' ')+' ';for(const[c,w]of Object.entries(CATDIC))for(const k of w.split(' '))if(k&&d.includes(' '+k+' '))return c;return 'Outros'};
const ruleCat=t=>{const d=norm(t),r=finInit().rules.find(r=>r.m&&d.includes(norm(r.m)));return r?r.cat:'Outros'};
function genRec0(){
 const F=finInit();let n=0;
 F.rec.forEach(r=>{const s=r.ini||T;let y=+s.slice(0,4),m=+s.slice(5,7)-1;
  for(let c=0;c<60;c++){const d=ds(new Date(y,m,Math.min(+r.day||1,dimOf(y,m))));
   if(d>T||(r.end&&d>r.end))break;
   if(d>=s){const id='r_'+r.id+'_'+d.slice(0,7);if(!(r.skip||[]).includes(id)&&!F.tx.some(t=>t.id===id)){F.tx.push({id,k:r.k,t:r.t,v:r.v,cat:r.cat,d,ac:r.ac,rc:r.id});n++}}
   if(++m>11){m=0;y++}}});
 return n}
function finMonth(o,all){
 const F=finInit(),f=new Date(today.getFullYear(),today.getMonth()+(o==null?S.fmo:o),1),p=ds(f).slice(0,7),ok=t=>all||!S.fac||accId(t)===S.fac||t.to===S.fac;
 const tx=F.tx.filter(t=>t.d.slice(0,7)===p&&ok(t)).sort((a,b)=>b.d.localeCompare(a.d)),by={};let inc=0,out=0;
 tx.forEach(t=>{if(t.k==='in')inc+=t.v;else if(t.k==='out'){out+=t.v;by[t.cat]=(by[t.cat]||0)+t.v}});
 return{f,p,tx,inc,out,by}}
function series(n,base,all){const a=[];for(let i=n-1;i>=0;i--){const m=finMonth(base-i,all);a.push({f:m.f,inc:m.inc,out:m.out})}return a}
const cwid=w=>innerWidth>860?Math.round(w*1.5):w;
function barsSvg(a){
 const W=cwid(640),H=230,L=44,R=8,T0=12,B=30,pw=W-L-R,ph=H-T0-B,bals=a.map(x=>x.inc-x.out),hi=Math.max(1,...a.map(x=>Math.max(x.inc,x.out)),...bals),lo=Math.min(0,...bals),y=v=>T0+ph*(hi-v)/((hi-lo)||1),gw=pw/a.length,bw=Math.min(26,gw*.28);
 let g='';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 const bar=(x,v,c,t)=>`<rect x="${x}" y="${Math.min(y(v),y(0))}" width="${bw}" height="${Math.max(1,Math.abs(y(0)-y(v)))}" rx="3" fill="${c}"><title>${t}</title></rect>`;
 const bars=a.map((x,i)=>{const cx=L+gw*(i+.5),mn=MES[x.f.getMonth()];return bar(cx-bw-2,x.inc,'var(--s1)',mn+': receitas '+BRL(x.inc))+bar(cx+2,x.out,'var(--s2)',mn+': despesas '+BRL(x.out))+`<text x="${cx}" y="${H-10}" text-anchor="middle">${mn}</text>`}).join('');
 const pts=a.map((x,i)=>[L+gw*(i+.5),y(x.inc-x.out),x.fut]);
 return `<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas, despesas e saldo por mês: ${a.map(x=>MES[x.f.getMonth()]+' receitas '+BRL(x.inc)+', despesas '+BRL(x.out)).join('; ')}">${g}${bars}<polyline points="${pts.filter(p=>!p[2]).map(p=>p[0]+','+p[1]).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2.5"/>${pts.map((p,i)=>p[2]?'':`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--s1d)"><title>Saldo ${BRL(bals[i])}</title></circle>`).join('')}</svg>`}
function donut(by,out){
 const cs=Object.keys(by).sort((a,b)=>by[b]-by[a]);if(!cs.length)return '<p class="empty">Nenhuma despesa neste mês.</p>';
 const R=70,C=2*Math.PI*R;let off=0;
 const segs=cs.map((c,i)=>{const len=by[c]/out*C,s=`<circle cx="100" cy="100" r="${R}" fill="none" stroke="${PAL8[i%8]}" stroke-width="30" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"><title>${esc(c)}: ${BRL(by[c])}</title></circle>`;off+=len;return s}).join('');
 return `<div class="dnw"><svg class="fs" viewBox="0 0 200 200" style="width:190px;flex:none" role="img" aria-label="Despesas por categoria">${segs}<text x="100" y="94" text-anchor="middle" style="font-size:12px">Despesas</text><text x="100" y="114" text-anchor="middle" style="font-size:15px;font-weight:600;fill:var(--ink)">${BRL(out)}</text></svg><div style="flex:1;min-width:170px">${cs.map((c,i)=>`<button class="item" style="width:100%;border:0;text-align:left;cursor:pointer;color:inherit;padding:6px 10px;margin-bottom:4px${S.fcat===c?';outline:2px solid var(--ink)':''}" data-a="fcat" data-id="${esc(c)}"><i style="width:12px;height:12px;border-radius:50%;background:${PAL8[i%8]};flex:none"></i><div class="t">${esc(c)}</div><small style="display:inline">${Math.round(by[c]/out*100)}%</small><strong style="font-weight:500">${BRL(by[c])}</strong></button>`).join('')}</div></div>`}
function gauge(c,spent,lim,exp){
 const p=lim?spent/lim:0,col=p>=1?'var(--neg)':p>exp+.0001?'var(--yellow)':'var(--green)',ex=Math.min(1,Math.max(0,exp)),cx=Math.cos(Math.PI*ex),sx=Math.sin(Math.PI*ex);
 const st=p>=1?'Limite estourado':p>exp?'Acima do ritmo':'Dentro do ritmo';
 return `<div><svg viewBox="0 0 100 60" style="width:100%;max-width:190px" role="img" aria-label="${esc(c)}: ${Math.round(p*100)}% do orçamento"><path d="M10 50A40 40 0 0 1 90 50" pathLength="100" fill="none" stroke="var(--panel)" stroke-width="9"/><path d="M10 50A40 40 0 0 1 90 50" pathLength="100" fill="none" stroke="${col}" stroke-width="9" stroke-dasharray="${Math.min(1,p)*100} 100"/><line x1="${50-33*cx}" y1="${50-33*sx}" x2="${50-47*cx}" y2="${50-47*sx}" stroke="var(--ink)" stroke-width="2"/><text x="50" y="49" text-anchor="middle" style="font-size:14px;font-weight:600;fill:var(--ink)">${Math.round(p*100)}%</text></svg><strong>${esc(c)}</strong><small style="display:block;color:var(--mute)">${BRL(spent)} de ${BRL(lim)}</small><small style="display:block;color:var(--mute)">ritmo esperado: ${BRL(lim*exp)}</small><span class="chip ${p>=1?'c-p':p>exp?'c-y':'c-g'}" style="margin:4px 0 0">${st}</span><button class="x" data-a="delbud" data-id="${esc(c)}" aria-label="Remover orçamento">×</button></div>`}
const catOpts=sel=>`<option value="">Categoria automática</option>${FC.map(c=>`<option ${sel===c?'selected':''}>${c}</option>`).join('')}`;
const accOpts=sel=>S.fin.acc.map(a=>`<option value="${a.id}" ${sel===a.id?'selected':''}>${esc(a.n)}</option>`).join('');
/* importação de CSV */
function parseCSV(txt){
 const first=txt.split(/\r?\n/)[0]||'',del=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':first.includes('\t')?'\t':',';
 const rows=[];let row=[],cur='',q=false;
 for(let i=0;i<txt.length;i++){const c=txt[i];
  if(q){if(c==='"'){if(txt[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
  else if(c==='"')q=true;else if(c===del){row.push(cur);cur=''}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(cur);if(row.some(x=>x.trim()))rows.push(row);row=[];cur=''}else cur+=c}
 row.push(cur);if(row.some(x=>x.trim()))rows.push(row);return rows}
function pnum(s){let t=String(s==null?'':s).replace(/[^\d,.\-+()]/g,'');if(!t)return NaN;const neg=/^\(.*\)$/.test(t)||t.startsWith('-');t=t.replace(/[()\-+]/g,'');const lc=t.lastIndexOf(','),ld=t.lastIndexOf('.');
 if(lc>-1&&ld>-1){t=lc>ld?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'')}else if(lc>-1)t=t.replace(',','.');else if((t.match(/\./g)||[]).length>1)t=t.replace(/\./g,'');
 const n=parseFloat(t);return neg?-n:n}
function pdate(s,df){const m=String(s||'').trim().match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);if(!m)return null;let y,mo,d;const a=+m[1],b=+m[2],c=+m[3];
 if(m[1].length===4){y=a;mo=b;d=c}else if(df==='mdy'){mo=a;d=b;y=c}else{d=a;mo=b;y=c}
 if(y<100)y+=2000;if(mo<1||mo>12||d<1||d>dimOf(y,mo-1))return null;return y+'-'+hm2(mo)+'-'+hm2(d)}
function impPanel(){
 if(!IMP)return `<p class="empty" style="padding:0 0 8px">Importe o extrato do banco ou da fatura em CSV. Você escolhe as colunas, confere uma prévia, e as regras de categoria são aplicadas sozinhas. Lançamentos que já existem (mesma conta, data, valor e descrição) são ignorados.</p><label class="pill dark" style="cursor:pointer;display:inline-block">Escolher arquivo CSV<input type="file" id="csvf" accept=".csv,.txt,text/csv" class="hide"></label>`;
 const I=IMP,{rows,bad}=impRows(),hd=I.hdr?I.rows[0]:I.rows[0].map((_,i)=>'Coluna '+(i+1)),n=rows.filter(r=>!r.dup).length;
 const sel=(k,l)=>`<label class="lb" style="margin:0">${l}<select class="in" data-imp="${k}">${hd.map((h,i)=>`<option value="${i}" ${I.map[k]===i?'selected':''}>${esc(h||'Coluna '+(i+1))}</option>`).join('')}</select></label>`;
 return `<p style="margin:0 0 8px"><strong>${esc(I.name)}</strong> <span class="empty" style="padding:0">(${I.rows.length-(I.hdr?1:0)} linhas)</span></p>
 <div class="bar" style="align-items:flex-end">${sel('d','Coluna da data')}${sel('t','Coluna da descrição')}${sel('v','Coluna do valor')}<label class="lb" style="margin:0">Conta de destino<select class="in" data-imp="ac">${accOpts(I.ac)}</select></label><label class="lb" style="margin:0">Formato da data<select class="in" data-imp="df"><option value="dmy" ${I.df==='dmy'?'selected':''}>dia/mês/ano</option><option value="mdy" ${I.df==='mdy'?'selected':''}>mês/dia/ano</option></select></label></div>
 <div class="bar"><label><input type="checkbox" data-imp="hdr" ${I.hdr?'checked':''}> A primeira linha é o cabeçalho</label><label><input type="checkbox" data-imp="inv" ${I.inv?'checked':''}> Valores positivos são despesas (fatura de cartão)</label></div>
 ${rows.slice(0,8).map(r=>`<div class="item ${r.dup?'done':''}"><span class="chip c-b">${fmt(r.d)}</span><div class="t">${esc(r.t)}<small>${esc(r.cat)}${r.sub?' › '+esc(r.sub):''}${r.dup?' · já existe, será ignorado':''}</small></div><strong class="${r.k==='in'?'pos':'neg'}">${r.k==='in'?'+':'−'} ${BRL(r.v)}</strong></div>`).join('')||'<p class="empty">Nenhuma linha válida com estas colunas. Ajuste o mapeamento ou o formato da data.</p>'}
 <p class="empty" style="padding:4px 0">${n} a importar${rows.length-n?', '+(rows.length-n)+' duplicados ignorados':''}${bad?', '+bad+' linhas inválidas puladas':''}. Prévia das 8 primeiras linhas.</p>
 <div class="bar"><button class="pill dark" data-a="impgo" ${n?'':'disabled'}>Importar ${n} lançamentos</button><button class="pill" data-a="impcancel">Cancelar</button></div>`}
function txListHtml(tx){
 const q=norm(FQ.trim()),kd=S.fkd||'',fc=S.fcat||'',hasF=!!(q||kd||fc),del=(a,id,l)=>`<button class="x" data-a="${a}" data-id="${esc(id)}" aria-label="${l}">×</button>`;
 const L=tx.filter(t=>(!kd||t.k===kd)&&(!fc||t.cat===fc)&&(!q||norm(t.t).includes(q)||norm(t.cat).includes(q)||norm(t.sub).includes(q)||norm(t.tg).includes(q)||norm(t.pj).includes(q)||norm(accName(accId(t))).includes(q)||fmt(t.d).includes(q)||String(t.v).includes(q)||String(t.v).replace('.',',').includes(q)));
 const sum=L.reduce((s,t)=>s+(t.k==='in'?t.v:t.k==='out'?-t.v:0),0),allOut=L.length&&L.every(t=>t.k==='out'),allIn=L.length&&L.every(t=>t.k==='in');
 const stxt=allOut?'Total: <strong>'+BRL(L.reduce((s,t)=>s+t.v,0))+'</strong>':allIn?'Total: <strong class="pos">+ '+BRL(L.reduce((s,t)=>s+t.v,0))+'</strong>':L.length?'Saldo filtrado: <strong class="'+(sum<0?'neg':'pos')+'">'+BRL(sum)+'</strong>':'';
 return (hasF?`<p class="empty" style="padding:0 0 8px">Mostrando <strong>${L.length}</strong> de ${tx.length} lançamentos${stxt?' · '+stxt:''}. <button class="pill" data-a="fclr">Limpar filtros</button></p>`:'')
 +(L.slice(0,pgN(FLK(),80)).map(t=>`<div class="item"><div class="t">${esc(t.t)}${t.pc?` <span class="chip c-y">${t.pc.i}/${t.pc.n}</span>`:''}${t.rc?' <span class="chip c-b">auto</span>':''}${t.pj?` <span class="chip c-g">${esc(t.pj)}</span>`:''}${tagChips(t)}${t.d>T?' <span class="chip c-p">agendado</span>':''}<small>${fmt(t.d)} · ${t.k==='tr'?esc(accName(accId(t)))+' → '+esc(accName(t.to)):esc(t.cat)+(t.sub?' › '+esc(t.sub):'')+' · '+esc(accName(accId(t)))}</small></div><strong class="${t.k==='in'?'pos':t.k==='tr'?'':'neg'}">${t.k==='in'?'+':t.k==='tr'?'':'−'} ${BRL(t.v)}</strong><button class="x" data-a="edtx" data-id="${t.id}" aria-label="Editar lançamento">✎</button>${del('deltx',t.id,'Excluir lançamento')}${t.pc?`<button class="x" data-a="deltxg" data-id="${t.pc.g}" aria-label="Excluir todas as parcelas" title="Excluir todas as parcelas">⊗</button>`:''}</div>`).join('')||emp('fin',hasF?'Nenhum lançamento combina com os filtros aplicados.':'Nenhum lançamento neste mês.',hasF?'Limpar filtros':'Lançar agora',hasF?'data-a="fclr"':'data-a="focusform" data-id="#ffin"'))
 +pgMore(FLK(),L.length,80)}
function financasMes(){
 const F=finInit();genRec();if(FED&&!F.tx.some(t=>t.id===FED))FED=null;if(RED&&!F.rec.some(r=>r.id===RED))RED=null;if(BED&&!F.bills.some(b=>b.id===BED))BED=null;
 const {f,tx,inc,out,by}=finMonth(),sal=inc-out,al=finAlerts(by),e=FED?F.tx.find(t=>t.id===FED):null,er=RED?F.rec.find(r=>r.id===RED):null,eb=BED?F.bills.find(b=>b.id===BED):null,k0=e?e.k:'out';
 const net=F.acc.reduce((a,x)=>a+bal(x),0),selA=S.fac?F.acc.find(a=>a.id===S.fac):null,del=(a,id,l)=>`<button class="x" data-a="${a}" data-id="${esc(id)}" aria-label="${l}">×</button>`;
 const lc=lineChart(),ser=series(S.fn,S.fmo),dim=dimOf(f.getFullYear(),f.getMonth()),exp=S.fmo<0?1:S.fmo>0?0:today.getDate()/dim,bills=F.bills.reduce((a,b)=>a+b.v,0);
 return `<div class="top"><h1>Finanças</h1><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${vwToggle()}<select class="in" data-fac="1" aria-label="Filtrar por conta"><option value="">Todas as contas</option>${accOpts(S.fac)}</select><span style="display:inline-flex;gap:6px;align-items:center"><button class="pill" data-a="fmn" data-n="-1" aria-label="Mês anterior">‹</button><strong>${MES[f.getMonth()]} ${f.getFullYear()}</strong><button class="pill" data-a="fmn" data-n="1" aria-label="Próximo mês">›</button></span><button class="pill" data-a="fmn" data-n="0">Este mês</button></div></div>
 <div class="rv4"><div class="stat c-g"><span>Receitas</span><strong>${BRL(inc)}</strong></div><div class="stat c-p"><span>Despesas</span><strong>${BRL(out)}</strong></div><div class="stat ${sal<0?'c-y':'c-b'}"><span>Resultado do mês${inc>0?' · poupança '+Math.round(sal/inc*100)+'%':''}</span><strong>${BRL(sal)}</strong></div><div class="stat c-y"><span>${selA?'Saldo de '+esc(selA.n):'Patrimônio (todas as contas)'}</span><strong>${BRL(selA?bal(selA):net)}</strong></div></div>
 ${al.length?`<div class="bar" role="alert" style="margin-top:10px"><strong style="align-self:center">Atenção:</strong>${al.map(a=>`<span class="chip ${a[1]>=100?'c-p':'c-y'}">${esc(a[0])}: ${a[1]}% do orçamento</span>`).join('')}</div>`:''}
 <form class="bar k${k0}${e?' advo':''}" id="ffin" style="margin-top:12px"><select class="in" name="k" aria-label="Tipo"><option value="out" ${k0==='out'?'selected':''}>Despesa</option><option value="in" ${k0==='in'?'selected':''}>Receita</option><option value="tr" ${k0==='tr'?'selected':''}>Transferência</option></select><input class="in grow" name="t" placeholder="Descrição (ex.: mercado 85,90 ontem)" value="${e?esc(e.t):''}" required><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor" value="${e?e.v:''}" style="width:120px"><select class="in" name="cat" aria-label="Categoria">${catOpts(e&&e.cat)}</select>${F.acc.length>1?`<select class="in" name="ac" aria-label="Conta ou cartão">${accOpts(e&&accId(e))}</select>`:''}<span class="adv"><input class="in" type="date" name="d" value="${e?e.d:T}" required aria-label="Data">${F.acc.length>1?'':`<select class="in" name="ac" aria-label="Conta ou cartão">${accOpts(e&&accId(e))}</select>`}<select class="in f-to" name="to" aria-label="Conta de destino">${accOpts(e&&e.to)}</select><input class="in" name="sub" list="subl" placeholder="Subcategoria" value="${e?esc(e.sub||''):''}" aria-label="Subcategoria">${subList()}<input class="in" name="tg" list="alltags" placeholder="Etiquetas" value="${e?esc(e.tg||''):''}" aria-label="Etiquetas"><input class="in" name="pj" list="pjl" placeholder="Projeto (opcional)" value="${e?esc(e.pj||''):''}" aria-label="Projeto">${pjList()}<input class="in f-pc" name="pc" type="number" min="1" value="1" title="Parcelas" aria-label="Parcelas" style="width:90px" ${e?'disabled':''}></span><button class="pill dark">${e?'Salvar alterações':'Lançar'}</button><button type="button" class="pill" data-a="adv">${e?'Menos opções':'Mais opções'}</button>${e?'<button type="button" class="pill" data-a="fcancel">Cancelar</button>':''}</form>
 <div class="cards">
 ${summaryPanel()}
 <div class="panel"><h2>Despesas por categoria</h2>${donut(by,out)}${S.fcat?`<p class="empty" style="padding:6px 0 0">Filtrando lançamentos por <strong>${esc(S.fcat)}</strong>. <button class="pill" data-a="fcat" data-id="${esc(S.fcat)}">Limpar filtro</button></p>`:''}</div>
 <div class="panel"><div class="top" style="margin:0 0 8px"><h2 style="margin:0">${S.flm==='sal'?'Saldo acumulado e projeção':'Resultado acumulado e projeção'}</h2><span style="display:flex;gap:6px">${[['res','Resultado'],['sal','Saldo']].map(x=>`<button class="pill ${(S.flm||'res')===x[0]?'on':''}" data-a="flm" data-id="${x[0]}">${x[1]}</button>`).join('')}</span></div>${lc.svg}<div class="bar" style="margin:8px 0 0;font-size:13px"><span><i class="lg" style="background:var(--s1)"></i>Realizado</span><span><i class="lg" style="background:${lc.end<0?'var(--neg)':'var(--s1d)'}"></i>Projeção</span></div><p class="empty" style="padding:4px 0 0">${S.fmo>0?'Mês futuro: considera só lançamentos e recorrências agendados. ':''}${S.flm==='sal'?'Saldo':'Resultado'} até agora: <strong class="${lc.now<0?'neg':'pos'}">${BRL(lc.now)}</strong>${lc.proj?` · projeção para o fim do mês: <strong class="${lc.end<0?'neg':'pos'}">${BRL(lc.end)}</strong>. Inclui parcelas e recorrências ainda por vir${lc.avg?` e a média dos gastos variáveis (${BRL(lc.avg)} por dia)`:''}.`:'.'}</p></div>
 <div class="panel wide"><div class="top" style="margin:0 0 8px"><h2 style="margin:0">Receitas e despesas mês a mês</h2><span>${[6,12].map(n=>`<button class="pill ${S.fn===n?'on':''}" data-a="fn" data-id="${n}">${n} meses</button>`).join(' ')}</span></div>${barsSvg(ser)}<div class="bar" style="margin:8px 0 0;font-size:13px"><span><i class="lg" style="background:var(--s1)"></i>Receitas</span><span><i class="lg" style="background:var(--s2)"></i>Despesas</span><span><i class="lg" style="background:var(--ink)"></i>Saldo do mês</span></div></div>
 <div class="panel wide">${cashPanel()}</div>
 <div class="panel wide">${waterPanel()}</div>
 <div class="panel wide">${yoyPanel()}</div>
 <div class="panel">${heatPanel()}</div>
 <div class="panel">${evoPanel()}</div>
 <div class="panel wide"><h2>Calendário financeiro</h2>${calPanel()}</div>
 <div class="panel wide">${subPanel()}</div>
 <div class="panel wide"><h2>Orçamentos</h2><div class="gg">${Object.entries(F.bud).map(([c,l])=>gauge(c,by[c]||0,l,exp)).join('')||'<p class="empty">Defina um limite mensal por categoria. O medidor mostra quanto você gastou e a marca preta indica onde deveria estar hoje.</p>'}</div><form class="bar" id="fbud" style="margin:12px 0 0"><select class="in" name="cat" aria-label="Categoria">${opts(FC)}</select><input class="in grow" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Limite mensal" required><button class="pill">Definir orçamento</button></form></div>
 <div class="panel wide"><h2>Contas e cartões</h2>${F.acc.map(a=>{const b=bal(a),card=a.ty==='card',iv=card?invoice(a):null,used=card?Math.max(0,-b):0;return `<div class="item"><div class="t">${esc(a.n)} <span class="chip c-b">${ACT[a.ty]||''}</span><small>${card?`Fatura de ${MES[+iv.end.slice(5,7)-1]}: ${BRL(iv.tot)} · fecha ${fmt(iv.end)} · vence ${fmt(iv.due)} (${iv.closed?'fechada':'aberta'})`:'Saldo atual'}</small>${card&&a.lim?`<div class="fb ${bst(used/a.lim*100)}" style="margin-top:6px"><i style="width:${Math.min(100,used/a.lim*100)}%"></i></div><small>Em uso ${BRL(used)} de ${BRL(a.lim)}</small>`:''}</div><strong class="${b<0?'neg':'pos'}">${BRL(b)}</strong>${card&&iv.tot>0?`<button class="pill" data-a="payinv" data-id="${a.id}">Pagar fatura</button>`:''}${del('delacc',a.id,'Excluir conta')}</div>`}).join('')}<form class="bar" id="facc" style="margin:8px 0 0"><input class="in grow" name="n" placeholder="Nome da conta ou cartão" required><select class="in" name="ty" aria-label="Tipo">${Object.entries(ACT).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select><input class="in" name="ini" type="number" step="any" placeholder="Saldo inicial" style="width:130px"><input class="in f-card" name="lim" type="number" min="0" placeholder="Limite" style="width:110px"><input class="in f-card" name="close" type="number" min="1" max="31" placeholder="Fecha dia" style="width:100px"><input class="in f-card" name="due" type="number" min="1" max="31" placeholder="Vence dia" style="width:100px"><button class="pill">Adicionar conta</button></form><p class="empty" style="padding:4px 0 0">Compras no cartão entram como despesas na conta do cartão, e as parcelas se espalham pelos meses seguintes. Para pagar a fatura, use "Pagar fatura", que registra uma transferência da sua conta para o cartão.</p></div>
 <div class="panel"><h2>Lançamentos recorrentes</h2>${F.rec.map(r=>`<div class="item"><div class="t">${esc(r.t)}<small>${r.k==='in'?'Receita':'Despesa'} · todo dia ${r.day} · ${esc(accName(r.ac||F.acc[0].id))}${r.end?' · até '+fmt(r.end):''}</small></div><strong class="${r.k==='in'?'pos':'neg'}">${BRL(r.v)}</strong><button class="x" data-a="edrec" data-id="${r.id}" aria-label="Editar recorrência">✎</button>${del('delrec',r.id,'Excluir recorrência')}</div>`).join('')||'<p class="empty">Salário, aluguel, assinaturas: cadastre uma vez e o lançamento aparece sozinho todo mês.</p>'}<form class="bar" id="frec" style="margin:8px 0 0"><select class="in" name="k" aria-label="Tipo"><option value="out" ${!er||er.k==='out'?'selected':''}>Despesa</option><option value="in" ${er&&er.k==='in'?'selected':''}>Receita</option></select><input class="in grow" name="t" placeholder="Descrição" value="${er?esc(er.t):''}" required><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor" value="${er?er.v:''}" required style="width:110px"><select class="in" name="cat" aria-label="Categoria">${catOpts(er&&er.cat)}</select><select class="in" name="ac" aria-label="Conta">${accOpts(er&&(er.ac||F.acc[0].id))}</select><input class="in" name="day" type="number" min="1" max="31" placeholder="Dia" value="${er?er.day:''}" required style="width:80px"><input class="in" type="date" name="end" value="${er?er.end||'':''}" title="Termina em (opcional)" aria-label="Termina em"><button class="pill${er?' dark':''}">${er?'Salvar recorrência':'Criar'}</button>${er?'<button type="button" class="pill" data-a="reccancel">Cancelar</button>':''}</form></div>
 <div class="panel"><h2>Contas fixas e assinaturas</h2>${F.bills.map(b=>`<div class="item"><div class="t">${esc(b.n)}<small>dia ${b.day} de cada mês, lembrete na agenda</small></div><strong>${BRL(b.v)}</strong><button class="x" data-a="edbill" data-id="${b.id}" aria-label="Editar conta">✎</button>${del('delbill',b.id,'Excluir conta')}</div>`).join('')||'<p class="empty">Cadastre contas que se repetem. Elas entram na agenda todo mês.</p>'}${F.bills.length?`<p class="empty" style="margin:0 0 8px">Total fixo: ${BRL(bills)} por mês. Para lançar o valor automaticamente, crie também um lançamento recorrente.</p>`:''}<form class="bar" id="fbill" style="margin:8px 0 0"><input class="in grow" name="n" placeholder="Nome" value="${eb?esc(eb.n):''}" required><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor" value="${eb?eb.v:''}" required style="width:110px"><input class="in" name="day" type="number" min="1" max="31" placeholder="Dia" value="${eb?eb.day:''}" required style="width:80px"><button class="pill${eb?' dark':''}">${eb?'Salvar conta':'Adicionar'}</button>${eb?'<button type="button" class="pill" data-a="billcancel">Cancelar</button>':''}</form></div>
 <div class="panel"><h2>Metas de economia</h2>${F.goals.filter(g=>!g.res).map(g=>{const p=Math.min(100,Math.round(g.saved/(g.target||1)*100));return `<div class="item"><div class="t">${esc(g.n)}<small>${BRL(g.saved)} de ${BRL(g.target)} (${p}%)</small>${glink(g)}<div class="fb" style="margin-top:6px"><i style="width:${p}%"></i></div></div><input class="in" data-gdep="${g.id}" type="number" step="any" placeholder="+ depositar" aria-label="Depositar" style="width:140px">${del('delgoal',g.id,'Excluir meta')}</div>`}).join('')||'<p class="empty">Crie uma meta, como viagem ou reserva de emergência.</p>'}<form class="bar" id="fgoal" style="margin:8px 0 0"><input class="in grow" name="n" placeholder="Nome da meta" required><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor alvo" required style="width:120px"><button class="pill">Criar</button></form></div>
 <div class="panel">${reservaPanel()}</div>
 <div class="panel">${prPanel()}</div>
 <div class="panel">${rulesPanel()}</div>
 <div class="panel wide">${projPanel()}</div>
 <div class="panel wide"><h2>Importar extrato (CSV)</h2>${impPanel()}</div>
 <div class="panel wide">${splitPanel()}</div>
 <div class="panel wide"><div class="top" style="margin:0 0 8px"><h2 style="margin:0">Lançamentos${S.fcat?': '+esc(S.fcat):''}</h2><span style="display:flex;gap:6px;flex-wrap:wrap">${[['','Todos'],['out','Despesas'],['in','Receitas'],['tr','Transferências']].map(x=>`<button class="pill ${(S.fkd||'')===x[0]?'on':''}" data-a="fkd" data-id="${x[0]}" aria-pressed="${(S.fkd||'')===x[0]}">${x[1]}</button>`).join('')}</span></div><div class="bar" style="margin:0 0 10px"><input class="in grow" id="fq" placeholder="Buscar por descrição, subcategoria, etiqueta ou valor…" value="${esc(FQ)}" aria-label="Buscar nos lançamentos"><select class="in" data-fcat="1" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>${FC.map(c=>`<option value="${c}" ${S.fcat===c?'selected':''}>${c}</option>`).join('')}</select></div><div id="txlist">${txListHtml(tx)}</div></div>
 </div>`}
document.addEventListener('change',async e=>{
 const i=e.target;if(!i||!i.dataset)return;
 if(i.id==='csvf'&&i.files[0]){
  const fl=i.files[0],buf=await fl.arrayBuffer();let txt;try{txt=new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(x){txt=new TextDecoder('windows-1252').decode(buf)}
  const rows=parseCSV(txt.replace(/^\uFEFF/,''));if(rows.length<2){toast('Arquivo vazio ou sem linhas de dados');return}
  const hdr=!rows[0].some(c=>pdate(c,'dmy')),h=rows[0].map(norm),g=(re,d)=>{const j=h.findIndex(x=>re.test(x));return j>=0?j:d};
  IMP={name:fl.name,rows,hdr,df:'dmy',inv:false,ac:finInit().acc[0].id,map:{d:hdr?g(/data|date/,0):0,t:hdr?g(/descri|hist|estab|memo|lanc|detail|name/,1):1,v:hdr?g(/valor|amount|value|quantia/,2):2}};
  render();return}
 if(i.dataset.imp&&IMP){const k=i.dataset.imp;if(k==='inv'||k==='hdr')IMP[k]=i.checked;else if(k==='df'||k==='ac')IMP[k]=i.value;else IMP.map[k]=+i.value;render();return}
 if(i.dataset.fac!==undefined){S.fac=i.value;render();return}
 if(i.dataset.fcat!==undefined){S.fcat=i.value;render();return}
 if(i.name==='k'&&i.form&&i.form.id==='ffin'){i.form.classList.remove('kout','kin','ktr');i.form.classList.add('k'+i.value)}
 if(i.name==='ty'&&i.form&&i.form.id==='facc')i.form.classList.toggle('facard',i.value==='card');
});
document.addEventListener('input',e=>{const i=e.target;if(i&&i.id==='fq'){FQ=i.value;const el=$('#txlist');if(el)el.innerHTML=txListHtml(finMonth().tx)}});

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
 const tg=`<span style="display:flex;gap:6px">${[['m','Mês selecionado'],['all','Tudo']].map(x=>`<button class="pill ${S.fpm===x[0]?'on':''}" data-a="fpm" data-id="${x[0]}">${x[1]}</button>`).join('')}</span>`;
 return `<div class="top" style="margin:0 0 8px"><h2 style="margin:0">Projetos: receita, gasto e horas de foco</h2>${tg}</div>
 <p class="empty" style="padding:0 0 8px">${fo?`Foco total: <strong>${hh(fo)}</strong> · gasto por hora de foco: <strong>${BRL(out/h)}</strong>${inc?` · receita por hora de foco: <strong>${BRL(inc/h)}</strong>`:''}.`:'Use o modo foco (▶ nas tarefas) para registrar horas e ver o gasto e a receita por hora.'}</p>
 ${ks.map(k=>{const o=m[k],hp=o.min/60;return `<div class="item"><div class="t">${esc(k)}<small>Receita ${BRL(o.inc)} · Gasto ${BRL(o.out)} · Resultado <span class="${o.inc-o.out<0?'neg':'pos'}">${BRL(o.inc-o.out)}</span></small><small>${o.min?hh(o.min)+' de foco'+(o.inc?' · '+BRL(o.inc/hp)+' de receita por hora':'')+(o.out?' · '+BRL(o.out/hp)+' de gasto por hora':''):'Sem horas de foco registradas neste período'}</small><div class="fb" style="margin-top:6px"><i style="width:${o.inc/mx*100}%"></i></div><div class="fb o" style="margin-top:3px"><i style="width:${o.out/mx*100}%"></i></div></div></div>`}).join('')||'<p class="empty">Marque lançamentos com um projeto (campo "Projeto" do formulário) para ver receita e gasto por projeto. Projetos são os mesmos das tarefas.</p>'}`}
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
 return `<div class="panel wide"><h2>Humor e gastos</h2>${days.length?svg:'<p class="empty">Registre o humor em alguns dias para cruzar com seus gastos.</p>'}<p class="empty" style="padding:4px 0 0">${msg} Conta só os gastos variáveis: não inclui recorrências nem parcelas.</p></div>`}
const glink=g=>{const ls=S.metas.filter(m=>m.kr.some(k=>k.ty==='sv'&&k.ref===g.id)),free=S.metas.filter(m=>!ls.includes(m));return (ls.length?`<small>Ligada à meta ${ls.map(m=>'"'+esc(m.t)+'"').join(', ')}</small>`:'')+(free.length?`<form class="bar" data-gl="${g.id}" style="margin:6px 0 0"><select class="in" name="m" aria-label="Meta">${free.map(m=>`<option value="${m.id}">${esc(m.t)}</option>`).join('')}</select><button class="pill">Ligar à meta</button></form>`:(!S.metas.length?'<small>Crie uma meta na aba Metas para ligar esta economia a ela.</small>':''))};
function finCard(){
 finInit();genRec();const sf=S.fmo,sa=S.fac;S.fmo=0;S.fac='';const lc=lineChart();S.fmo=sf;S.fac=sa;
 const {inc,out,by}=finMonth(0,true),sal=inc-out,a=series(6,0,true),mx=Math.max(1,...a.map(x=>Math.max(x.inc,x.out))),cs=Object.keys(by).sort((x,y)=>by[y]-by[x]).slice(0,3);
 const mini=`<svg class="fs mini lab" viewBox="0 0 240 72" style="max-width:100%" role="img" aria-label="Receitas e despesas dos últimos 6 meses">${a.map((x,i)=>{const hi=Math.max(1,48*x.inc/mx),ho=Math.max(1,48*x.out/mx),c=i===a.length-1;return `<rect x="${i*40+6}" y="${52-hi}" width="13" height="${hi}" rx="4" fill="var(--s1)"/><rect x="${i*40+21}" y="${52-ho}" width="13" height="${ho}" rx="4" fill="var(--s2)"/><text x="${i*40+20}" y="67" text-anchor="middle" font-size="10" fill="currentColor" opacity="${c?1:.65}" font-weight="${c?700:400}">${MES[x.f.getMonth()]}</text>`}).join('')}</svg>`;
 const f0=new Date(today.getFullYear(),today.getMonth(),1),ND=dimOf(f0.getFullYear(),f0.getMonth()),pm=T.slice(0,7),dd=Array(ND+1).fill(0),tdn=today.getDate();
 S.fin.tx.forEach(t=>{if(t.k==='out'&&t.d.slice(0,7)===pm)dd[+t.d.slice(8)]+=+t.v||0});
 const dmx=Math.max(1,...dd),avg=dd.slice(1,tdn+1).reduce((p,q)=>p+q,0)/tdn,bw=300/ND,ay=64-56*avg/dmx;
 const dly=`<svg class="fs mini lab" viewBox="0 0 300 80" style="max-width:100%" role="img" aria-label="Gastos por dia no mês, com a média diária">${dd.slice(1).map((v,i)=>{const d=i+1,h=v>0?Math.max(2,56*v/dmx):0;return d>tdn?`<rect x="${(i*bw+1).toFixed(1)}" y="62" width="${(bw-2).toFixed(1)}" height="2" rx="1" fill="currentColor" opacity=".15"/>`:`<rect x="${(i*bw+1).toFixed(1)}" y="${(64-h).toFixed(1)}" width="${(bw-2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${d===tdn?'var(--s1d)':'var(--s1)'}" opacity="${d===tdn?1:.75}"/>`}).join('')}<line x1="0" x2="300" y1="64" y2="64" stroke="currentColor" opacity=".25"/>${avg>0?`<line x1="0" x2="300" y1="${ay.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="var(--neg)" stroke-width="1.5" stroke-dasharray="4 3"/>`:''}${[1,10,20,ND].filter((d,i,l)=>l.indexOf(d)===i).map(d=>`<text x="${((d-.5)*bw).toFixed(1)}" y="77" text-anchor="middle" font-size="9" fill="currentColor" opacity=".65">${d}</text>`).join('')}</svg>`;
 if(!S.fin.tx.length)return `<div class="panel" data-card="fin"><h2>Finanças do mês</h2>${emp('fin','Nenhum lançamento ainda. Registre gastos e receitas para ver gráficos aqui.','Abrir Finanças','data-v="financas"')}</div>`;
 return `<div class="panel" data-card="fin"><h2>Finanças do mês</h2><div class="two" style="gap:16px"><div><div class="item"><div class="t">Resultado<small>${BRL(inc)} entradas · ${BRL(out)} saídas</small></div><strong class="${sal<0?'neg':'pos'}">${BRL(sal)}</strong></div>${cs.map((c,i)=>`<div class="cat" style="grid-template-columns:96px 1fr auto"><span>${esc(c)}</span><div class="fb"><i style="width:${by[c]/out*100}%;background:${PAL8[i]}"></i></div><small>${BRL(by[c])}</small></div>`).join('')}${finAlerts(by).map(x=>`<p class="empty neg" style="padding:2px;margin:0">⚠ ${esc(x[0])}: ${x[1]}% do orçamento</p>`).join('')}</div><div><div class="lb" style="margin:0 0 4px">Gastos por dia</div>${dly}<p class="empty" style="padding:2px 0 6px">Média de ${BRL(avg)} por dia${lc.proj?` · saldo projetado do mês: <strong class="${lc.end<0?'neg':'pos'}">${BRL(lc.end)}</strong>`:''}</p><div class="lb" style="margin:8px 0 4px">Últimos 6 meses</div>${mini}<p class="lgd"><span><i class="lg g"></i>receitas</span><span><i class="lg p"></i>despesas</span></p></div></div><button class="pill" data-v="financas" style="margin-top:10px">Abrir Finanças</button></div>`}
document.addEventListener('submit',e=>{const f=e.target;if(!f.dataset||!f.dataset.gl)return;e.preventDefault();const v=Object.fromEntries(new FormData(f)),m=S.metas.find(x=>x.id===v.m),g=S.fin.goals.find(x=>x.id===f.dataset.gl);if(m&&g){m.kr.push({id:uid(),ty:'sv',ref:g.id,t:'Economizar para "'+g.n+'"',tg:1,un:'',cur:0});toast('Meta de economia ligada à meta "'+m.t+'"');render()}},true);

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
 return{tot,end,due,closed:end<T}}
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
 <p class="empty" style="padding:6px 0">Cada quadrado é um dia (colunas: semanas, de segunda a domingo; cor mais forte = mais gasto). Clique num dia para ver os detalhes no calendário.</p>
 ${ma>0?`<p style="margin:0 0 6px">Você gasta mais às <strong>${DOWF[top]}</strong> (média de ${BRL(ma)}).</p>`:''}${DOW.map((n,i)=>`<div class="cat" style="grid-template-columns:34px 1fr auto;margin-bottom:4px"><span>${n}</span><div class="fb"><i style="width:${ma?avg[i]/ma*100:0}%;background:${i===top&&ma?'var(--s1)':'var(--pink)'}"></i></div><small>${BRL(avg[i])}</small></div>`).join('')}`}
function evoPanel(){
 const n=6,ms=[];for(let i=n-1;i>=0;i--)ms.push(finMonth(S.fmo-i));
 const tot=c=>ms.reduce((a,m)=>a+(m.by[c]||0),0),cats=[...new Set(ms.flatMap(m=>Object.keys(m.by)))].sort((a,b)=>(ms[n-1].by[b]||0)-(ms[n-1].by[a]||0)||tot(b)-tot(a)).slice(0,8),mn=MES[ms[n-1].f.getMonth()];
 if(!cats.length)return '<h2>Evolução por categoria</h2><p class="empty">Sem despesas nos últimos 6 meses.</p>';
 return `<h2>Evolução por categoria</h2><p class="empty" style="padding:0 0 6px">Últimos 6 meses, até ${mn}. A etiqueta compara com o mês anterior.</p>${cats.map(c=>{const v=ms.map(m=>m.by[c]||0),mx=Math.max(1,...v),cur=v[n-1],pr=v[n-2],pts=v.map((x,i)=>[4+i*(112/(n-1)),24-20*x/mx]),pct=pr>0?Math.round((cur/pr-1)*100):null,lp=pts[n-1];
  const badge=pr>0?(Math.abs(pct)<5?'<span class="chip c-b">≈ igual</span>':`<span class="chip ${pct>0?'c-p':'c-g'}">${pct>0?'+':''}${pct}%</span>`):cur>0?'<span class="chip c-y">novo</span>':'';
  return `<div class="item"><div class="t">${esc(c)}<small>${BRL(cur)} em ${mn}${pr>0?' · mês anterior '+BRL(pr):''}</small></div><svg class="fs mini" viewBox="0 0 120 28" style="width:110px;flex:none" role="img" aria-label="Evolução de ${esc(c)}"><polyline points="${pts.map(q=>q.join(',')).join(' ')}" fill="none" stroke="var(--s1)" stroke-width="2"/><circle cx="${lp[0]}" cy="${lp[1]}" r="3" fill="var(--s1d)"/></svg>${badge}</div>`}).join('')}`}
function calPanel(){
 const F=finInit(),f=new Date(today.getFullYear(),today.getMonth()+S.fmo,1),y=f.getFullYear(),m=f.getMonth(),N=dimOf(y,m),p=ds(f).slice(0,7),off=(f.getDay()+6)%7,ok=t=>!S.fac||accId(t)===S.fac||t.to===S.fac,days={};
 const g=d=>(days[d]=days[d]||{inc:0,out:0,ev:[],tx:[]});
 F.tx.forEach(t=>{if(t.d.slice(0,7)!==p||!ok(t))return;const o=g(+t.d.slice(8));o.tx.push(t);if(t.k==='in')o.inc+=t.v;else if(t.k==='out')o.out+=t.v});
 F.bills.forEach(b=>g(Math.min(+b.day||1,N)).ev.push({t:'Conta: '+b.n,v:b.v,c:'y'}));
 F.rec.forEach(r=>{const dd=Math.min(+r.day||1,N),d=ds(new Date(y,m,dd)),id='r_'+r.id+'_'+p;if(d>T&&(r.ini||T)<=d&&(!r.end||d<=r.end)&&!F.tx.some(t=>t.id===id)&&!(r.skip||[]).includes(id))g(dd).ev.push({t:r.t+' (agendado)',v:r.v,c:r.k==='in'?'g':'p'})});
 F.acc.filter(a=>a.ty==='card').forEach(a=>[-1,0].forEach(o=>{const iv=invoice(a,S.fmo+o);if(iv.due.slice(0,7)===p&&iv.tot>0)g(+iv.due.slice(8)).ev.push({t:'Vence a fatura '+a.n,v:iv.tot,c:'b'})}));
 const sel=S.fday&&S.fday.slice(0,7)===p?S.fday:(S.fmo===0?T:''),cells=[];
 for(let i=0;i<off;i++)cells.push('<span></span>');
 for(let d=1;d<=N;d++){const iso=ds(new Date(y,m,d)),o=days[d],net=o?o.inc-o.out:0;cells.push(`<button class="fcell${iso===T?' td':''}${iso===sel?' sel':''}" data-a="fday" data-id="${iso}" aria-label="${d} de ${MES[m]}"><b>${d}</b>${o&&(o.inc||o.out)?`<span class="${net<0?'neg':'pos'}">${K(net)}</span>`:''}<span class="dots">${(o?o.ev:[]).slice(0,4).map(e=>`<i class="dot c-${e.c}"></i>`).join('')}</span></button>`)}
 const sd=sel?days[+sel.slice(8)]:null;
 const det=sel?`<h2 class="gh" style="margin-top:12px">${+sel.slice(8)} de ${MESF[m]}</h2>${sd&&(sd.tx.length||sd.ev.length)?sd.tx.map(t=>`<div class="item"><div class="t">${esc(t.t)}<small>${t.k==='tr'?'Transferência':esc(t.cat)+(t.sub?' › '+esc(t.sub):'')} · ${esc(accName(accId(t)))}</small></div><strong class="${t.k==='in'?'pos':t.k==='tr'?'':'neg'}">${t.k==='in'?'+':t.k==='tr'?'':'−'} ${BRL(t.v)}</strong></div>`).join('')+sd.ev.map(e=>`<div class="item"><span class="dot c-${e.c}"></span><div class="t">${esc(e.t)}</div><strong>${BRL(e.v)}</strong></div>`).join(''):'<p class="empty">Nada registrado neste dia.</p>'}`:'<p class="empty">Escolha um dia para ver os detalhes.</p>';
 return `<div class="fcal">${DOW.map(n=>`<div class="fch">${n}</div>`).join('')}${cells.join('')}</div><div class="bar" style="margin:8px 0 0;font-size:12px"><span><i class="dot c-y"></i>conta fixa</span><span><i class="dot c-b"></i>vencimento de fatura</span><span><i class="dot c-p"></i>despesa agendada</span><span><i class="dot c-g"></i>receita agendada</span></div>${det}`}
function subPanel(){
 const {tx}=finMonth(),sb={},tg={};
 tx.forEach(t=>{if(t.k!=='out'||(S.fcat&&t.cat!==S.fcat))return;const k=t.sub?(S.fcat?t.sub:t.cat+' › '+t.sub):(S.fcat?'(sem subcategoria)':null);if(k)sb[k]=(sb[k]||0)+t.v;tagsU(t).forEach(x=>{tg[x]=(tg[x]||0)+t.v})});
 const bars=(o,fn)=>{const ks=Object.keys(o).sort((a,b)=>o[b]-o[a]).slice(0,8),mx=Math.max(1,...ks.map(k=>o[k]));return ks.map((k,i)=>`<div class="cat" style="grid-template-columns:140px 1fr auto"><span>${fn(k)}</span><div class="fb"><i style="width:${o[k]/mx*100}%;background:${PAL8[i%8]}"></i></div><small>${BRL(o[k])}</small></div>`).join('')};
 return `<div class="two" style="gap:18px"><div><h2>${S.fcat?'Subcategorias de '+esc(S.fcat):'Subcategorias'}</h2>${bars(sb,esc)||'<p class="empty">Preencha o campo "Subcategoria" nos lançamentos, ou crie regras que a definam, para ver o detalhe dentro de cada categoria. Clique numa categoria da rosca para filtrar.</p>'}</div><div><h2>Gastos por etiqueta</h2>${bars(tg,k=>`<button class="chip tgc" data-a="tagv" data-id="${esc(k)}">#${esc(k)}</button>`)||'<p class="empty">Etiquete lançamentos (por exemplo #viagem) para ver o total gasto por etiqueta. As etiquetas são as mesmas do resto do painel.</p>'}</div></div>`}
/* regras de categorização */
function ruleHit(r,t){
 if(r.on===false)return false;const d=norm(t.t),m=norm(r.m||''),ty=r.ty||'out';let ok=true;
 if(r.m){if(r.md==='s')ok=d.startsWith(m);else if(r.md==='e')ok=d===m;else if(r.md==='r'){try{ok=new RegExp(r.m,'i').test(String(t.t))}catch(e){ok=false}}else ok=d.includes(m)}
 if(!ok)return false;if(ty!=='any'&&t.k!==ty)return false;
 if(r.min!==''&&r.min!=null&&!(t.v>=+r.min))return false;if(r.max!==''&&r.max!=null&&!(t.v<=+r.max))return false;
 if(r.ac&&(t.ac?t.ac:S.fin.acc[0].id)!==r.ac)return false;return true}
const ruleOf=t=>finInit().rules.find(r=>ruleHit(r,t))||null;
function applyRules(all){let n=0;finInit().tx.forEach(t=>{if(t.k==='tr')return;const R=ruleOf(t);if(!R||!(t.k==='out'||R.ty==='in'))return;if(!all&&t.cat&&t.cat!=='Outros')return;let ch=false;
 if(R.cat&&t.cat!==R.cat){t.cat=R.cat;ch=true}if(R.sub&&t.sub!==R.sub){t.sub=R.sub;ch=true}if(R.tg){const nt=normTags((t.tg||'')+','+R.tg);if(nt!==(t.tg||'')){t.tg=nt;ch=true}}if(R.pj&&t.pj!==R.pj){t.pj=R.pj;ch=true}if(ch)n++});return n}
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
 return `<h2>Regras de categorização</h2><p class="empty" style="padding:0 0 8px">As regras são testadas de cima para baixo e vale a primeira que combina. Elas preenchem categoria, subcategoria, etiquetas e projeto em lançamentos com categoria automática e na importação de extratos.</p>
 ${F.rules.map((r,i)=>`<div class="item ${r.on===false?'done':''}"><div class="t">${when(r)}<small>→ ${then(r)} · afeta ${cnt[r.id]||0} lançamentos${r.on===false?' · desativada':''}</small></div><button class="x" data-a="rmv" data-id="${r.id}" data-n="-1" aria-label="Subir" ${i?'':'disabled'}>▲</button><button class="x" data-a="rmv" data-id="${r.id}" data-n="1" aria-label="Descer" ${i<F.rules.length-1?'':'disabled'}>▼</button><button class="x" data-a="rtog" data-id="${r.id}" aria-label="Ativar ou desativar" title="Ativar ou desativar">${r.on===false?'○':'●'}</button><button class="x" data-a="redit" data-id="${r.id}" aria-label="Editar regra">✎</button><button class="x" data-a="delrule" data-id="${r.id}" aria-label="Excluir regra">×</button></div>`).join('')||'<p class="empty">Exemplo: despesa cuja descrição contém "uber" → Transporte › App, etiqueta #trabalho.</p>'}
 <form class="bar" id="frule" style="margin:8px 0 0"><select class="in" name="ty" aria-label="Tipo"><option value="out" ${sel(e&&e.ty||'out','out')}>Despesa</option><option value="in" ${sel(e&&e.ty,'in')}>Receita</option><option value="any" ${sel(e&&e.ty,'any')}>Qualquer</option></select><select class="in" name="md" aria-label="Condição"><option value="c" ${sel(e&&e.md,'c')}>contém</option><option value="s" ${sel(e&&e.md,'s')}>começa com</option><option value="e" ${sel(e&&e.md,'e')}>é igual a</option><option value="r" ${sel(e&&e.md,'r')}>expressão (regex)</option></select><input class="in grow" name="m" placeholder="Texto da descrição" value="${e?esc(e.m||''):''}"><input class="in" name="min" type="number" step="any" placeholder="Valor mín." value="${e&&e.min!==''?e.min:''}" style="width:110px"><input class="in" name="max" type="number" step="any" placeholder="Valor máx." value="${e&&e.max!==''?e.max:''}" style="width:110px"><select class="in" name="ac" aria-label="Conta"><option value="">Qualquer conta</option>${accOpts(e&&e.ac)}</select><select class="in" name="cat" aria-label="Categoria">${FC.map(c=>`<option ${e&&e.cat===c?'selected':''}>${c}</option>`).join('')}</select><input class="in" name="sub" list="subl" placeholder="Subcategoria" value="${e?esc(e.sub||''):''}"><input class="in" name="tg" list="alltags" placeholder="Etiquetas" value="${e?esc(e.tg||''):''}"><input class="in" name="pj" list="pjl" placeholder="Projeto" value="${e?esc(e.pj||''):''}"><button class="pill dark">${e?'Salvar regra':'Adicionar regra'}</button>${e?'<button type="button" class="pill" data-a="rcancel">Cancelar</button>':''}</form>
 <div class="bar" style="margin:8px 0 0"><input class="in grow" id="rtest" placeholder="Testar: digite uma descrição, como UBER *TRIP"><input class="in" id="rtv" type="number" step="any" placeholder="Valor" style="width:110px"></div><p id="rtestout" class="empty" style="padding:0 0 8px"></p>
 ${F.rules.length?'<div class="bar"><button class="pill" data-a="rulesapply">Aplicar aos lançamentos em "Outros"</button><button class="pill" data-a="rapplyall">Reaplicar a todos os lançamentos</button></div>':''}`}
function finSubmit(v){
 const F=finInit(),e=FED?F.tx.find(t=>t.id===FED):null;
 if(!e){const p=parseFinNL(v.t,v.v,!v.d||v.d===T);v=Object.assign({},v,{t:p.t,v:p.v,d:p.d||v.d||T,tg:normTags([v.tg,p.tg].filter(Boolean).join(', '))})}
 const x=Math.round(num(v.v)*100)/100;if(!(x>0)){toast('Informe um valor maior que zero');return}if(v.k==='tr'&&(v.ac===v.to||F.acc.length<2)){toast(F.acc.length<2?'Cadastre uma segunda conta para transferir':'A conta de destino precisa ser diferente da origem');return}
 const k=v.k,R=(!v.cat&&k!=='tr'&&!e)?ruleOf({t:v.t,v:x,k,ac:v.ac}):null;
 const cat=k==='in'?'Receita':k==='tr'?'Transferência':(v.cat||(R&&R.cat)||dictCat(v.t)),ex={pj:(v.pj||'').trim()||(R&&R.pj)||'',sub:(v.sub||'').trim()||(R&&R.sub)||'',tg:normTags(v.tg)||(R&&R.tg)||''};
 if(e){Object.assign(e,{k,t:v.t.trim(),v:x,cat,d:v.d,ac:v.ac,...ex});if(k==='tr')e.to=v.to;else delete e.to;FED=null;toast('Lançamento atualizado');return}
 const n=k==='out'?Math.min(48,Math.max(1,+v.pc||1)):1,t=v.t.trim();
 if(n>1){const g=uid(),base=Math.floor(x/n*100)/100;for(let i=0;i<n;i++){const val=i===n-1?Math.round((x-base*(n-1))*100)/100:base;F.tx.unshift({id:uid(),k,t,v:val,cat,d:addM(v.d,i),ac:v.ac,...ex,pc:{g,i:i+1,n}})}toast(n+' parcelas lançadas'+(+v.pc>48?' (limite de 48 parcelas)':''))}
 else{const o={id:uid(),k,t,v:x,cat,d:v.d,ac:v.ac,...ex};if(k==='tr')o.to=v.to;F.tx.unshift(o);toast(k==='in'?'Receita lançada':k==='tr'?'Transferência registrada':'Despesa lançada'+(R?' ('+cat+(ex.sub?' › '+ex.sub:'')+' pela regra)':''))}}
function impRows(){
 const I=IMP,F=finInit(),m=I.map,out=[];let bad=0;
 I.rows.slice(I.hdr?1:0).forEach(r=>{const d=pdate(r[m.d],I.df),t=String(r[m.t]||'').trim(),n=pnum(r[m.v]);if(!d||!t||isNaN(n)||n===0){bad++;return}
  const exp=I.inv?n>0:n<0,v=Math.abs(n),k=exp?'out':'in',R=ruleOf({t,v,k,ac:I.ac}),dup=F.tx.some(x=>x.d===d&&Math.abs(x.v-v)<.005&&accId(x)===I.ac&&norm(x.t).slice(0,18)===norm(t).slice(0,18));
  out.push({d,t,k,v,cat:k==='out'?(R&&R.cat)||dictCat(t):'Receita',sub:R&&R.sub||'',tg:R&&R.tg||'',pj:R&&R.pj||'',dup})});
 return{rows:out,bad}}
document.addEventListener('input',e=>{const i=e.target;if(!i||(i.id!=='rtest'&&i.id!=='rtv'))return;const q=($('#rtest')||{}).value||'',vv=parseFloat(($('#rtv')||{}).value),o=$('#rtestout');if(!o)return;
 if(!q){o.textContent='';return}const R=ruleOf({t:q,v:isNaN(vv)?0:vv,k:'out',ac:finInit().acc[0].id});
 o.textContent=R?'→ '+[R.cat,R.sub].filter(Boolean).join(' › ')+(R.tg?' · #'+R.tg.split(', ').join(' #'):'')+(R.pj?' · projeto '+R.pj:'')+' (regra '+(finInit().rules.indexOf(R)+1)+')':'Nenhuma regra combina com esta descrição.'});

/* ===== Finanças: cascata e relatório anual ===== */
const vwToggle=()=>`<span style="display:flex;gap:4px">${[['mes','Mês'],['ano','Ano']].map(x=>`<button class="pill ${(S.fvw||'mes')===x[0]?'on':''}" data-a="fvw" data-id="${x[0]}">${x[1]}</button>`).join('')}</span>`;
function waterSteps(by,inc,out,open){
 const cs=Object.keys(by).sort((a,b)=>by[b]-by[a]),top=cs.slice(0,6),rest=cs.slice(6).reduce((a,k)=>a+by[k],0),st=[];
 if(open!==undefined)st.push({l:'Saldo inicial',v:open,t:'tot'});
 st.push({l:'Receitas',v:inc,t:'up'});top.forEach(k=>st.push({l:k,v:-by[k],t:'dn'}));if(rest>0)st.push({l:'Outras',v:-rest,t:'dn'});
 st.push({l:open!==undefined?'Saldo final':'Resultado',v:(open||0)+inc-out,t:'tot'});return st}
function waterSvg(st){
 const W=cwid(640),H=270,L=44,R=8,T0=18,B=54,pw=W-L-R,ph=H-T0-B,n=st.length;let run=0;
 const bars=st.map(s=>{let a,b;if(s.t==='tot'){a=0;b=s.v;run=s.v}else{a=run;b=run+s.v;run=b}return{...s,a,b,run}});
 const vals=bars.flatMap(x=>[x.a,x.b]),hi=Math.max(4,...vals),lo=Math.min(0,...vals),y=v=>T0+ph*(hi-v)/((hi-lo)||1),gw=pw/n,bw=Math.min(54,gw*.62);
 let g='';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 const body=bars.map((s,i)=>{const x=L+gw*i+(gw-bw)/2,top=Math.min(y(s.a),y(s.b)),h=Math.max(1,Math.abs(y(s.a)-y(s.b))),fill=s.t==='up'?'var(--s1)':s.t==='dn'?'var(--s2)':(s.run>=0?'var(--s1d)':'var(--neg)'),cx=x+bw/2;
  const lbl=s.l.length>11?s.l.slice(0,10)+'…':s.l,txt=(s.t==='up'?'+':'')+K(s.v),nxt=bars[i+1];
  return `<rect x="${x}" y="${top}" width="${bw}" height="${h}" rx="3" fill="${fill}"><title>${esc(s.l)}: ${BRL(s.v)}</title></rect>${nxt?`<line x1="${x+bw}" x2="${L+gw*(i+1)+(gw-bw)/2}" y1="${y(s.run)}" y2="${y(s.run)}" stroke="var(--mute)" stroke-dasharray="3 3"/>`:''}<text x="${cx}" y="${top-4}" text-anchor="middle" style="fill:var(--ink)">${txt}</text><text transform="rotate(-30 ${cx} ${H-B+14})" x="${cx}" y="${H-B+14}" text-anchor="end">${esc(lbl)}</text>`}).join('');
 return `<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de cascata: ${st.map(s=>s.l+' '+BRL(s.v)).join('; ')}">${g}${body}</svg>`}
function waterPanel(){
 const {f,inc,out,by}=finMonth(),sal=S.fwm==='sal',st=waterSteps(by,inc,out,sal?openBal(ds(f)):undefined);
 return `<div class="top" style="margin:0 0 8px"><h2 style="margin:0">Cascata de ${MES[f.getMonth()]}</h2><span style="display:flex;gap:6px">${[['res','Resultado'],['sal','Saldo']].map(x=>`<button class="pill ${(S.fwm||'res')===x[0]?'on':''}" data-a="fwm" data-id="${x[0]}">${x[1]}</button>`).join('')}</span></div>${inc||out?waterSvg(st):'<p class="empty">Sem lançamentos neste mês.</p>'}<p class="empty" style="padding:4px 0 0">A primeira barra é o que entrou. Cada barra clara é uma categoria que reduz o que sobrou, até chegar ao ${sal?'saldo final':'resultado'} (barra escura, ou vermelha se negativo).${sal?' O saldo inicial é o das contas no dia 1.':''}</p>`}
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
 const cs=Object.keys(d.by).sort((a,b)=>d.by[b]-d.by[a]).slice(0,8),maxr=c=>Math.max(1,...d.ms.map(m=>m.by[c]||0));
 const bigs=d.tx.filter(t=>t.k==='out').sort((a,b)=>b.v-a.v).slice(0,10);
 const fx=d.tx.filter(t=>t.k==='out'&&(t.rc||t.pc)).reduce((a,t)=>a+t.v,0),vr=d.out-fx;
 const agg=o=>{const ks=Object.keys(o).sort((a,b)=>o[b]-o[a]).slice(0,8),mx=Math.max(1,...ks.map(k=>o[k]));return ks.map((k,i)=>`<div class="cat" style="grid-template-columns:140px 1fr auto"><span>${k.startsWith('#')?`<button class="chip tgc" data-a="tagv" data-id="${esc(k.slice(1))}">${esc(k)}</button>`:esc(k)}</span><div class="fb"><i style="width:${o[k]/mx*100}%;background:${PAL8[i%8]}"></i></div><small>${BRL(o[k])}</small></div>`).join('')};
 const sb={},tg={};d.tx.forEach(t=>{if(t.k!=='out')return;if(t.sub)sb[t.cat+' › '+t.sub]=(sb[t.cat+' › '+t.sub]||0)+t.v;tagsU(t).forEach(x=>{tg['#'+x]=(tg['#'+x]||0)+t.v})});
 const sum=yearSummary(d,pv,cur),csv=n=>String(n.toFixed(2)).replace('.',',');
 return `<div class="top"><h1>Finanças</h1><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${vwToggle()}<select class="in" data-fac="1" aria-label="Filtrar por conta"><option value="">Todas as contas</option>${accOpts(S.fac)}</select><span style="display:inline-flex;gap:6px;align-items:center"><button class="pill" data-a="fyn" data-n="-1" aria-label="Ano anterior">‹</button><strong>${Y}</strong><button class="pill" data-a="fyn" data-n="1" aria-label="Próximo ano">›</button></span><button class="pill" data-a="fyn" data-n="0">Este ano</button></div></div>
 <div class="rv4"><div class="stat c-g"><span>Receitas de ${Y}</span><strong>${BRL(d.inc)}</strong></div><div class="stat c-p"><span>Despesas de ${Y}</span><strong>${BRL(d.out)}</strong></div><div class="stat ${sal<0?'c-y':'c-b'}"><span>Resultado do ano${rate!==null?' · poupança '+rate+'%':''}</span><strong>${BRL(sal)}</strong></div><div class="stat c-y"><span>Gasto médio por mês</span><strong>${BRL(d.out/nAct)}</strong></div></div>
 <div class="cards" style="margin-top:12px">
 <div class="panel wide"><h2>Resumo de ${Y}</h2>${sum.map(s=>`<p style="margin:0 0 6px">${esc(s)}</p>`).join('')}<div class="bar" style="margin:8px 0 0"><button class="pill" data-a="fexp">Baixar relatório (CSV)</button></div><p id="fexpm" class="empty" style="padding:0"></p></div>
 <div class="panel wide"><h2>Receitas e despesas mês a mês</h2>${barsSvg(d.ms.map((m,i)=>({f:m.f,inc:m.inc,out:m.out,fut:cur&&i>today.getMonth()})))}<div class="bar" style="margin:8px 0 0;font-size:13px"><span><i class="lg" style="background:var(--s1)"></i>Receitas</span><span><i class="lg" style="background:var(--s2)"></i>Despesas</span><span><i class="lg" style="background:var(--ink)"></i>Saldo do mês</span></div></div>
 <div class="panel wide"><h2>Cascata do ano</h2>${d.inc||d.out?waterSvg(waterSteps(d.by,d.inc,d.out)):'<p class="empty">Sem lançamentos neste ano.</p>'}<p class="empty" style="padding:4px 0 0">Das receitas do ano, quanto foi para cada categoria até chegar ao resultado.</p></div>
 <div class="panel wide"><h2>Mês a mês</h2><div style="overflow-x:auto"><table class="yt"><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th><th>Poupança</th></tr></thead><tbody>${d.ms.map((m,i)=>{const r=m.inc-m.out;return `<tr><td>${MES[i]}${i===best?' <span class="chip c-g">melhor</span>':i===worst?' <span class="chip c-p">pior</span>':''}</td><td>${BRL(m.inc)}</td><td>${BRL(m.out)}</td><td class="${r<0?'neg':'pos'}">${m.inc||m.out?BRL(r):'–'}</td><td>${m.inc>0?Math.round(r/m.inc*100)+'%':'–'}</td></tr>`}).join('')}<tr style="font-weight:600"><td>Total</td><td>${BRL(d.inc)}</td><td>${BRL(d.out)}</td><td class="${sal<0?'neg':'pos'}">${BRL(sal)}</td><td>${rate!==null?rate+'%':'–'}</td></tr></tbody></table></div></div>
 <div class="panel wide"><h2>Categorias ao longo do ano</h2>${cs.length?`<div style="overflow-x:auto"><div class="ymx" style="min-width:560px"><span></span>${MES.map(m=>`<small class="ymh">${m}</small>`).join('')}<span class="ymh">Total</span>${cs.map(c=>{const mx=maxr(c);return `<span class="ymc">${esc(c)}</span>${d.ms.map((m,i)=>{const v=m.by[c]||0,l=v>0?Math.ceil(4*v/mx):0;return `<i class="hm p${l}" title="${MES[i]} · ${esc(c)}: ${BRL(v)}"></i>`}).join('')}<small class="ymt">${BRL(d.by[c])}</small>`}).join('')}</div></div><p class="empty" style="padding:6px 0 0">Cada linha tem a própria escala: o quadrado mais escuro é o mês de maior gasto daquela categoria. Média por mês: ${cs.slice(0,3).map(c=>esc(c)+' '+BRL(d.by[c]/nAct)).join(' · ')}.</p>`:'<p class="empty">Sem despesas neste ano.</p>'}</div>
 <div class="panel"><h2>Fixo e variável</h2>${d.out>0?`<div class="cat" style="grid-template-columns:90px 1fr auto"><span>Fixo</span><div class="fb"><i style="width:${fx/d.out*100}%;background:var(--blue)"></i></div><small>${BRL(fx)} (${Math.round(fx/d.out*100)}%)</small></div><div class="cat" style="grid-template-columns:90px 1fr auto"><span>Variável</span><div class="fb"><i style="width:${vr/d.out*100}%;background:var(--pink)"></i></div><small>${BRL(vr)} (${Math.round(vr/d.out*100)}%)</small></div><p class="empty" style="padding:0">Fixo = recorrências automáticas e parcelas.</p>`:'<p class="empty">Sem despesas neste ano.</p>'}</div>
 <div class="panel"><h2>Maiores gastos do ano</h2>${bigs.map(t=>`<div class="item"><div class="t">${esc(t.t)}<small>${fmt(t.d)} · ${esc(t.cat)}${t.sub?' › '+esc(t.sub):''}</small></div><strong class="neg">− ${BRL(t.v)}</strong></div>`).join('')||'<p class="empty">Sem despesas neste ano.</p>'}</div>
 <div class="panel"><h2>Subcategorias do ano</h2>${agg(sb)||'<p class="empty">Preencha a subcategoria nos lançamentos para ver o detalhe.</p>'}</div>
 <div class="panel"><h2>Etiquetas do ano</h2>${agg(tg)||'<p class="empty">Etiquete lançamentos para ver o total por etiqueta.</p>'}</div>
 </div>`}
async function exportYear(){
 const Y=today.getFullYear()+S.fyr,d=finYear(Y),m=$('#fexpm'),f=n=>String(n.toFixed(2)).replace('.',',');
 const rows=[['Relatório financeiro',Y],[],['Mês','Receitas','Despesas','Resultado'],...d.ms.map((x,i)=>[MES[i],f(x.inc),f(x.out),f(x.inc-x.out)]),['Total',f(d.inc),f(d.out),f(d.inc-d.out)],[],['Categoria','Total','Média por mês','% dos gastos'],...Object.keys(d.by).sort((a,b)=>d.by[b]-d.by[a]).map(c=>[c,f(d.by[c]),f(d.by[c]/12),d.out?Math.round(d.by[c]/d.out*100)+'%':'0%'])];
 const csv='\uFEFF'+rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 if(!DL&&!IN_CLAUDE){siteSave('relatorio-financeiro-'+Y+'.csv',csv,'text/csv');m.textContent='Relatório baixado.';return}
 if(!DL){m.textContent='O download não está disponível aqui. Copie o texto abaixo e guarde em um arquivo .csv:';const ta=document.createElement('textarea');ta.className='in bk';ta.readOnly=true;ta.value=csv;m.after(ta);ta.select();return}
 try{await DL.save({filename:'relatorio-financeiro-'+Y+'.csv',data:csv});m.textContent='Relatório pronto. Confirme o salvamento na janela que abriu.'}catch(e){m.textContent=e&&e.code==='declined'?'Download cancelado.':'Não foi possível baixar o relatório.'}}

/* ===== Correções: resumo comparável e validação de transferência ===== */
function partMonth(o,day){const m=finMonth(o),by={};let out=0;m.tx.forEach(t=>{if(t.k==='out'&&+t.d.slice(8)<=day){out+=t.v;by[t.cat]=(by[t.cat]||0)+t.v}});return{out,by}}
function summaryPanel(){
 const F=finInit(),c0=finMonth(),pv=finMonth(S.fmo-1),mn=MES[c0.f.getMonth()],pn=MES[pv.f.getMonth()],cur=S.fmo===0,dd=today.getDate(),L=[];
 const real=c0.tx.filter(t=>!cur||t.d<=T);let inc=0,out=0;const by={};
 real.forEach(t=>{if(t.k==='in')inc+=t.v;else if(t.k==='out'){out+=t.v;by[t.cat]=(by[t.cat]||0)+t.v}});
 if(!real.length)return `<div class="panel wide"><h2>Resumo de ${mn}</h2><p class="empty">Ainda não há lançamentos neste mês.</p></div>`;
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
 const dim=dimOf(c0.f.getFullYear(),c0.f.getMonth()),exp=S.fmo<0?1:S.fmo>0?0:dd/dim,bu=Object.entries(F.bud).map(([k,l])=>[k,(c.by[k]||0)/l]);
 if(bu.length){const bad=bu.filter(x=>x[1]>=1).map(x=>x[0]),warn=bu.filter(x=>x[1]<1&&x[1]>exp).map(x=>x[0]);L.push(!bad.length&&!warn.length?'Todos os orçamentos estão dentro do ritmo.':`Orçamentos: ${bad.length?bad.join(', ')+' estourou'+(bad.length>1?'aram':''):''}${bad.length&&warn.length?'; ':''}${warn.length?warn.join(', ')+' está'+(warn.length>1?'ão':'')+' acima do ritmo':''}.`)}
 const fut=F.tx.filter(t=>t.k==='out'&&t.d>T&&t.d<=ds(add(today,30))).reduce((a,t)=>a+t.v,0);if(fut>0)L.push(`Nos próximos 30 dias já há ${BRL(fut)} comprometidos em parcelas e lançamentos agendados.`);
 if(cur){const sv=S.flm;S.flm='res';const lc=lineChart();S.flm=sv;L.push(`Você gasta em média ${BRL(c.out/dd)} por dia${lc.proj?`; no ritmo atual, o mês deve fechar com um resultado de ${BRL(lc.end)}`:''}.`)}
 return `<div class="panel wide hero"><h2>Resumo de ${mn}</h2>${L.map(s=>`<p style="margin:0 0 6px">${esc(s)}</p>`).join('')}</div>`}
function trValid(f){if(!f||f.id!=='ffin')return;const to=f.querySelector('[name=to]'),ac=f.querySelector('[name=ac]');if(!to||!ac)return;to.setCustomValidity(f.classList.contains('ktr')?(S.fin.acc.length<2?'Cadastre uma segunda conta, em "Contas e cartões", para fazer transferências':ac.value===to.value?'Escolha uma conta de destino diferente da origem':''):'')}
document.addEventListener('change',e=>{const i=e.target;if(i&&i.form&&i.form.id==='ffin'&&(i.name==='k'||i.name==='ac'||i.name==='to'))trValid(i.form)});

/* ===== Pacote D: fluxo de caixa previsto e comparação anual ===== */
function cashFlow(o){
 const F=finInit(),H=o.days,fac=o.fac||'',isCard=a=>a.ty==='card',set=new Set((fac?F.acc.filter(a=>a.id===fac):F.acc.filter(a=>!isCard(a))).map(a=>a.id));
 if(!set.size)return null;
 let start=0;set.forEach(id=>{start+=bal(F.acc.find(x=>x.id===id))});
 const endD=ds(add(today,H)),evs=[],push=(d,t,v,k)=>{if(v&&d>T&&d<=endD)evs.push({d,t,v,k})};
 F.tx.forEach(t=>{if(t.d<=T||t.d>endD)return;const ac=accId(t);let v=0;if(t.k==='in'&&set.has(ac))v=t.v;else if(t.k==='out'&&set.has(ac))v=-t.v;else if(t.k==='tr')v=(set.has(t.to)?t.v:0)-(set.has(ac)?t.v:0);if(v)push(t.d,t.t,v,v>0?'in':'out')});
 for(let i=0;i<=Math.ceil(H/28)+1;i++){
  const m0=new Date(today.getFullYear(),today.getMonth()+i,1),y=m0.getFullYear(),mo=m0.getMonth(),p=ds(m0).slice(0,7),N=dimOf(y,mo);
  F.rec.forEach(r=>{const ac=r.ac||F.acc[0].id;if(!set.has(ac))return;const dd=Math.min(+r.day||1,N),d=ds(new Date(y,mo,dd)),id='r_'+r.id+'_'+p;if(d>T&&(r.ini||T)<=d&&(!r.end||d<=r.end)&&!F.tx.some(t=>t.id===id)&&!(r.skip||[]).includes(id))push(d,r.t,r.k==='in'?r.v:-r.v,r.k==='in'?'in':'out')});
  F.bills.forEach(b=>{const d=ds(new Date(y,mo,Math.min(+b.day||1,N)));if(F.tx.some(t=>t.d.slice(0,7)===p&&norm(t.t).includes(norm(b.n))))return;push(d,b.n,-b.v,'bill')})}
 F.acc.filter(isCard).forEach(a=>[-1,0,1,2,3].forEach(off=>{const iv=invoice(a,off);if(iv.due<=T||iv.due>endD||iv.tot<=0)return;
  const paid=F.tx.filter(t=>t.k==='tr'&&t.to===a.id&&t.d>iv.end&&t.d<=iv.due).reduce((s,t)=>s+t.v,0);if(iv.tot-paid>0)push(iv.due,'Fatura '+a.n,-(iv.tot-paid),'card')}));
 let vs=0;const from=ds(add(today,-60));F.tx.forEach(t=>{if(t.k==='out'&&!t.rc&&!t.pc&&t.d>from&&t.d<=T&&(!fac||accId(t)===fac))vs+=t.v});
 const avg=o.vary?vs/60:0,by={};evs.forEach(e=>(by[e.d]=by[e.d]||[]).push(e));
 let b=start;const pts=[{d:T,v:b,ev:[]}];let minP=pts[0],firstNeg=b<0?pts[0]:null;
 for(let i=1;i<=H;i++){const d=ds(add(today,i));let ch=-avg;(by[d]||[]).forEach(e=>ch+=e.v);b+=ch;const q={d,v:b,ev:by[d]||[]};pts.push(q);if(b<minP.v)minP=q;if(b<0&&!firstNeg)firstNeg=q}
 return{start,pts,evs:evs.sort((a,c)=>a.d.localeCompare(c.d)),avg,minP,firstNeg,end:b,H}}
function cashSvg(c){
 const W=cwid(720),H=250,L=46,R=14,T0=14,B=26,pw=W-L-R,ph=H-T0-B,vals=c.pts.map(p=>p.v),mx0=Math.max(...vals),mn0=Math.min(...vals),pd=Math.max(1,(mx0-mn0)*.12),hi=mx0+pd,lo=mn0<0?mn0-pd:Math.max(0,mn0-pd),x=i=>L+pw*i/c.H,y=v=>T0+ph*(hi-v)/((hi-lo)||1);
 let g='';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 const step=Math.max(1,Math.round(c.H/5));for(let i=0;i<=c.H;i+=step)g+=`<text x="${x(i)}" y="${H-8}" text-anchor="${i===0?'start':i+step>c.H?'end':'middle'}">${fmt(c.pts[i].d)}</text>`;
 const pl=c.pts.map((p,i)=>x(i)+','+y(p.v)).join(' '),z=y(0);
 const neg=lo<0?`<rect x="${L}" y="${z}" width="${pw}" height="${Math.max(0,T0+ph-z)}" fill="var(--neg)" opacity=".1"/>`:'';
 const big=[...c.evs].sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,8).map(e=>{const i=Math.round((new Date(e.d+'T00:00')-new Date(T+'T00:00'))/864e5),p=c.pts[i];return p?`<circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" fill="${e.v>0?'var(--green)':'var(--neg)'}"><title>${esc(e.t)}: ${BRL(e.v)} em ${fmt(e.d)}</title></circle>`:''}).join('');
 const fn=c.firstNeg?(()=>{const i=c.pts.indexOf(c.firstNeg);return `<line x1="${x(i)}" x2="${x(i)}" y1="${T0}" y2="${T0+ph}" stroke="var(--neg)" stroke-dasharray="3 3"/>`})():'';
 return `<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo previsto para os próximos ${c.H} dias: hoje ${BRL(c.start)}, ao final ${BRL(c.end)}, menor saldo ${BRL(c.minP.v)} em ${fmt(c.minP.d)}">${g}${neg}${lo<0?`<line x1="${L}" x2="${W-R}" y1="${z}" y2="${z}" stroke="var(--mute)" stroke-dasharray="2 4"/>`:''}${fn}<polyline points="${pl}" fill="none" stroke="var(--s1)" stroke-width="2.5"/>${big}</svg>`}
function cashPanel(){
 const F=finInit(),H=S.fcn||30,vary=S.fcv!==false,a=S.fac?F.acc.find(x=>x.id===S.fac):null;
 const head=`<div class="top" style="margin:0 0 8px"><h2 style="margin:0">Fluxo de caixa previsto</h2><span style="display:flex;gap:6px;flex-wrap:wrap">${[30,60,90].map(n=>`<button class="pill ${H===n?'on':''}" data-a="fcn" data-id="${n}" aria-pressed="${H===n}">${n} dias</button>`).join('')}<button class="pill ${vary?'on':''}" data-a="fcv" aria-pressed="${vary}">Gastos variáveis</button></span></div>`;
 if(a&&a.ty==='card')return head+'<p class="empty">Cartões não têm caixa próprio: o que você gasta nele aparece como fatura, paga pela conta. Escolha “Todas as contas” ou uma conta corrente.</p>';
 const c=cashFlow({days:H,fac:S.fac,vary});if(!c)return head+'<p class="empty">Cadastre uma conta corrente para ver a previsão.</p>';
 const al=c.firstNeg?`<p class="late" role="alert" style="margin:0 0 8px;font-weight:500">Atenção: ${c.firstNeg.d===T?'o saldo já está negativo hoje':'o saldo previsto fica negativo em '+fmt(c.firstNeg.d)} (${BRL(c.firstNeg.v)}). Menor saldo: ${BRL(c.minP.v)} em ${fmt(c.minP.d)}.</p>`:`<p style="margin:0 0 8px">Sem saldo negativo previsto nos próximos ${H} dias. Menor saldo: <strong>${BRL(c.minP.v)}</strong> em ${fmt(c.minP.d)}.</p>`;
 const nx=c.evs.slice(0,8),tl={in:'Receita',out:'Despesa',bill:'Conta fixa',card:'Fatura'};
 return head+al+cashSvg(c)+`<div class="bar" style="margin:8px 0 0;font-size:13px"><span><i class="lg" style="background:var(--s1)"></i>Saldo previsto</span><span><i class="lg" style="background:var(--green)"></i>Entrada grande</span><span><i class="lg" style="background:var(--neg)"></i>Saída grande</span></div><p class="empty" style="padding:4px 0 8px">Hoje: <strong>${BRL(c.start)}</strong> · em ${fmt(c.pts[c.H].d)}: <strong class="${c.end<0?'neg':'pos'}">${BRL(c.end)}</strong>. Considera lançamentos futuros, parcelas, recorrências, contas fixas e faturas de cartão${vary?`, mais a média dos gastos variáveis (${BRL(c.avg)} por dia, últimos 60 dias)`:''}.</p>
 <h3 class="gh" style="margin-top:4px">Próximos movimentos</h3>${nx.map(e=>`<div class="item"><span class="chip c-${e.k==='in'?'g':e.k==='card'?'b':e.k==='bill'?'y':'p'}">${fmt(e.d)}</span><div class="t">${esc(e.t)}<small>${tl[e.k]}</small></div><strong class="${e.v>0?'pos':''}">${e.v>0?'+ ':'− '}${BRL(Math.abs(e.v))}</strong></div>`).join('')||'<p class="empty">Nada agendado neste período.</p>'}`}
function yoyPanel(){
 const F=finInit(),f=new Date(today.getFullYear(),today.getMonth()+S.fmo,1),Y=f.getFullYear(),m=f.getMonth(),part=S.fmo===0,dc=part?today.getDate():31,exp=(S.fyo||'out')==='out';
 const ok=t=>!S.fac||accId(t)===S.fac||t.to===S.fac;
 const sum=(y,m1,m2,dm)=>{let inc=0,out=0;const by={};F.tx.forEach(t=>{if(t.k==='tr'||!ok(t))return;const yy=+t.d.slice(0,4),mo=+t.d.slice(5,7)-1,dd=+t.d.slice(8);if(yy!==y||mo<m1||mo>m2||(mo===m2&&dd>dm))return;if(t.k==='in')inc+=t.v;else{out+=t.v;by[t.cat]=(by[t.cat]||0)+t.v}});return{inc,out,by}};
 const c1=sum(Y,m,m,dc),p1=sum(Y-1,m,m,dc),c2=sum(Y,0,m,dc),p2=sum(Y-1,0,m,dc),mn=MES[m],per=mn+' '+Y+' × '+mn+' '+(Y-1)+(part?' (até o dia '+dc+')':'');
 const head=`<h2>Comparação com o ano anterior</h2><p class="empty" style="padding:0 0 8px">${per}</p>`;
 if(!(p1.inc+p1.out)&&!(p2.inc+p2.out))return head+`<p class="empty">Ainda não há lançamentos em ${Y-1} para comparar. Importe um extrato antigo na aba Regras e importação para ver a comparação.</p>`;
 const dl=(c,p,bad)=>{if(!p)return c?'<span class="empty" style="padding:0">novo</span>':'–';const v=Math.round((c-p)/p*100);return `<span class="${v===0?'':(bad?v>0:v<0)?'neg':'pos'}">${v>0?'+':''}${v}%</span>`};
 const row=(l,c,p,bad)=>`<tr><th scope="row" style="text-align:left;font-weight:400">${l}</th><td>${BRL(p)}</td><td>${BRL(c)}</td><td>${dl(c,p,bad)}</td></tr>`;
 const r1=c1.inc-c1.out,r0=p1.inc-p1.out,y1=c2.inc-c2.out,y0=p2.inc-p2.out;
 const cats=[...new Set([...Object.keys(c1.by),...Object.keys(p1.by)])].map(k=>({k,c:c1.by[k]||0,p:p1.by[k]||0})).sort((a,b)=>Math.max(b.c,b.p)-Math.max(a.c,a.p)).slice(0,8);
 const up=[...cats].sort((a,b)=>(b.c-b.p)-(a.c-a.p)),ins=[];
 if(p1.out>0)ins.push(`Despesas ${c1.out>=p1.out?(Math.round((c1.out/p1.out-1)*100)+'% maiores'):(Math.round((1-c1.out/p1.out)*100)+'% menores')} que no mesmo período de ${Y-1}.`);
 if(up[0]&&up[0].c-up[0].p>0)ins.push(`Maior aumento: <strong>${esc(up[0].k)}</strong> (+${BRL(up[0].c-up[0].p)}).`);
 const dn=up[up.length-1];if(dn&&dn.c-dn.p<0)ins.push(`Maior queda: <strong>${esc(dn.k)}</strong> (−${BRL(dn.p-dn.c)}).`);
 return head+`${ins.length?`<p style="margin:0 0 8px">${ins.join(' ')}</p>`:''}<div style="overflow-x:auto"><table class="yt"><thead><tr><th scope="col"></th><th scope="col">${Y-1}</th><th scope="col">${Y}</th><th scope="col">Variação</th></tr></thead><tbody>${row('Receitas do mês',c1.inc,p1.inc,false)}${row('Despesas do mês',c1.out,p1.out,true)}${row('Resultado do mês',r1,r0,false)}${row('Receitas jan–'+mn,c2.inc,p2.inc,false)}${row('Despesas jan–'+mn,c2.out,p2.out,true)}${row('Resultado jan–'+mn,y1,y0,false)}</tbody></table></div>
 <h3 class="gh">Despesas por categoria</h3>${cats.map(x=>{const mx=Math.max(x.c,x.p,1);return `<div class="cat" style="grid-template-columns:110px 1fr auto"><span>${esc(x.k)}</span><div aria-hidden="true"><div class="fb" style="height:7px;margin-bottom:3px"><i style="width:${x.p/mx*100}%;background:var(--mute)"></i></div><div class="fb" style="height:7px"><i style="width:${x.c/mx*100}%;background:var(--pink)"></i></div></div><small>${BRL(x.p)} → ${BRL(x.c)} ${dl(x.c,x.p,true)}</small></div>`}).join('')||'<p class="empty">Sem despesas nesses períodos.</p>'}
 <div class="top" style="margin:14px 0 6px"><h3 class="gh" style="margin:0">Mês a mês: ${Y-1} × ${Y}</h3><span style="display:flex;gap:6px"><button class="pill ${exp?'on':''}" data-a="fyo" data-id="out" aria-pressed="${exp}">Despesas</button><button class="pill ${!exp?'on':''}" data-a="fyo" data-id="in" aria-pressed="${!exp}">Receitas</button></span></div>${yoySvg(Y,exp)}<div class="bar" style="margin:8px 0 0;font-size:13px"><span><i class="lg" style="background:var(--mute)"></i>${Y-1}</span><span><i class="lg" style="background:${exp?'var(--pink)':'var(--green)'}"></i>${Y}</span></div>`}
function yoySvg(Y,exp){
 const F=finInit(),ok=t=>!S.fac||accId(t)===S.fac||t.to===S.fac,k=exp?'out':'in',ser=y=>{const a=Array(12).fill(0);F.tx.forEach(t=>{if(t.k===k&&ok(t)&&+t.d.slice(0,4)===y)a[+t.d.slice(5,7)-1]+=t.v});return a};
 const A=ser(Y-1),B=ser(Y),mx=Math.max(1,...A,...B),W=cwid(720),H=250,L=42,R=8,T0=12,Bt=26,pw=W-L-R,ph=H-T0-Bt,gw=pw/12,bw=Math.min(18,gw/2-3),y=v=>T0+ph*(1-v/mx);
 let g='';for(let i=0;i<=4;i++){const v=mx*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${K(v)}</text>`}
 const bar=(x0,v,fill,lb)=>v>0?`<rect x="${x0}" y="${y(v)}" width="${bw}" height="${T0+ph-y(v)}" rx="2" fill="${fill}"><title>${lb}: ${BRL(v)}</title></rect>`:'';
 const bars=A.map((a,i)=>{const cx=L+gw*(i+.5);return bar(cx-bw-1,a,'var(--mute)',MES[i]+' '+(Y-1))+bar(cx+1,B[i],exp?'var(--pink)':'var(--green)',MES[i]+' '+Y)+`<text x="${cx}" y="${H-10}" text-anchor="middle">${MES[i]}</text>`}).join('');
 const tt=a=>a.reduce((s,v)=>s+v,0);
 return `<svg class="fs" viewBox="0 0 ${W} ${H}" role="img" aria-label="${exp?'Despesas':'Receitas'} por mês, ${Y-1} e ${Y}. Total ${Y-1}: ${BRL(tt(A))}. Total ${Y}: ${BRL(tt(B))}">${g}${bars}</svg>`}
/* ===== Pacote E: reserva, metas por percentual e divisão de despesas ===== */
const r2=v=>Math.round(v*100)/100;
function mNet(o){const m=finMonth(o,true),by=Object.assign({},m.by);let inc=m.inc,out=m.out;m.tx.forEach(t=>{if(t.k==='in'&&t.rb){inc-=t.v;out-=t.v;const c=t.rcat||'Outros';by[c]=Math.max(0,(by[c]||0)-t.v)}});return{inc,out,by}}
function avgOut3(){const a=[1,2,3].map(i=>mNet(-i).out).filter(v=>v>0);return a.length?a.reduce((s,v)=>s+v,0)/a.length:0}
function avgSave3(){return [1,2,3].reduce((s,i)=>{const m=mNet(-i);return s+m.inc-m.out},0)/3}
function reservaPanel(){
 const F=finInit(),R=F.goals.filter(g=>g.res),avg=avgOut3(),sv=avgSave3();
 const head='<h2>Reserva de emergência</h2>';
 const form=`<form class="bar" id="fres" style="margin:8px 0 0"><select class="in" name="rm" aria-label="Meses de cobertura">${[3,6,9,12].map(n=>`<option value="${n}" ${n===6?'selected':''}>${n} meses de despesas</option>`).join('')}</select><input class="in" name="saved" type="text" inputmode="decimal" autocomplete="off" placeholder="Já guardado (opcional)" style="width:170px"><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor alvo (opcional)" style="width:160px"><button class="pill dark">Criar reserva</button></form>`;
 if(!R.length)return head+`<p class="empty" style="padding:0 0 4px">A reserva cobre seus gastos se a renda parar. O alvo é calculado pela sua média de despesas dos últimos 3 meses${avg?' (hoje, '+BRL(avg)+' por mês)':''}.</p>`+form;
 return head+R.map(g=>{
  const tg=+g.target||0,p=tg?Math.min(100,Math.round(g.saved/tg*100)):0,cov=avg?g.saved/avg:0,rest=Math.max(0,tg-g.saved),drift=avg&&tg?Math.abs((g.rm||6)*avg-tg)/tg>.1:false;
  let eta='';if(rest<=0)eta='Reserva completa.';else if(sv>0){const n=Math.ceil(rest/sv),d=new Date(today.getFullYear(),today.getMonth()+n,1);eta=`No ritmo de poupança dos últimos 3 meses (${BRL(sv)} por mês), você chega lá em <strong>${n} ${n===1?'mês':'meses'}</strong> (${MES[d.getMonth()]}/${d.getFullYear()}).`}else eta='Sua poupança média recente é zero ou negativa, então ainda não dá para estimar o prazo.';
  return `<div class="item" style="flex-wrap:wrap"><div class="t"><strong>${esc(g.n)}</strong><small>${BRL(g.saved)} de ${BRL(tg)} (${p}%)${avg?' · cobre '+cov.toFixed(1).replace('.',',')+' meses de despesas':''}</small><div class="fb" style="margin:6px 0"><i style="width:${p}%"></i></div><small>${eta}</small>${drift?`<small class="late">Sua média de despesas mudou: a meta de ${g.rm||6} meses seria ${BRL((g.rm||6)*avg)}. <button class="pill" data-a="resrec" data-id="${g.id}">Recalcular meta</button></small>`:''}</div><select class="in" data-rm="${g.id}" aria-label="Meses de cobertura">${[3,6,9,12].map(n=>`<option value="${n}" ${(g.rm||6)===n?'selected':''}>${n} meses</option>`).join('')}</select><input class="in" data-gdep="${g.id}" type="text" inputmode="decimal" autocomplete="off" placeholder="+ depositar" aria-label="Depositar na reserva" style="width:130px"></div>`}).join('')}
const prName=r=>r.k==='save'?'Poupar '+r.pc+'% da renda':(r.cat||'Categoria')+' até '+r.pc+'% da renda';
function prEval(r,o){const m=mNet(o);if(!(m.inc>0))return null;const sp=r.k==='save'?m.out:(m.by[r.cat]||0),pct=r.k==='save'?(m.inc-m.out)/m.inc*100:sp/m.inc*100;return{pct,ok:r.k==='save'?pct>=r.pc:pct<=r.pc,inc:m.inc,sp}}
function prMonths(r){let n=0,met=0;for(let o=-1;o>=-6;o--){const e=prEval(r,o);if(e){n++;if(e.ok)met++}}return{n,met}}
function prStreak(r){let s=0;for(let o=-1;o>=-24;o--){const e=prEval(r,o);if(!e||!e.ok)break;s++}return s}
function prPanel(){
 const F=finInit(),P=F.prules;
 const form=`<form class="bar" id="fpr" style="margin:8px 0 0"><select class="in" name="tgt" aria-label="Tipo de meta"><option value="save">Poupar no mínimo</option><optgroup label="Gastar no máximo em…">${FC.map(c=>`<option value="cat:${c}">${c}</option>`).join('')}</optgroup></select><input class="in" name="pc" type="text" inputmode="decimal" autocomplete="off" placeholder="% da renda" required style="width:110px"><button class="pill dark">Criar meta</button></form>`;
 const rows=P.map(r=>{
  const cur=prEval(r,0),ms=prMonths(r),st=prStreak(r);
  let status='Sem receita neste mês ainda para avaliar.';
  if(cur){const allow=r.k==='save'?cur.inc*(1-r.pc/100)-cur.sp:cur.inc*r.pc/100-cur.sp;
   status=r.k==='save'?`Este mês: <strong>${Math.round(cur.pct)}%</strong> da renda poupada. ${allow>=0?'Você ainda pode gastar '+BRL(allow)+' e manter a meta.':'Para atingir a meta, faltam '+BRL(-allow)+' a menos de gastos.'}`:`Este mês: <strong>${Math.round(cur.pct)}%</strong> da renda (${BRL(cur.sp)}). ${allow>=0?'Ainda cabem '+BRL(allow)+'.':'Passou '+BRL(-allow)+' do limite.'}`}
  const cells=[-5,-4,-3,-2,-1,0].map(o=>{const e=prEval(r,o),d=new Date(today.getFullYear(),today.getMonth()+o,1),lb=MES[d.getMonth()]+': '+(e?Math.round(e.pct)+'% ('+(o===0?(e.ok?'no caminho':'fora do ritmo'):e.ok?'cumprida':'não cumprida')+')':'sem receita');return `<span class="chip" role="img" aria-label="${lb}" title="${lb}" style="background:${e?e.ok?'var(--green)':'var(--pink)':'var(--card)'};${o===0?'outline:1px dashed var(--ink)':''}">${MES[d.getMonth()]} ${e?Math.round(e.pct)+'%':'–'}</span>`}).join(' ');
  return `<div class="item" style="flex-wrap:wrap"><div class="t"><strong>${esc(prName(r))}</strong><small>${status}</small><div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">${cells}</div><small>${ms.n?ms.met+' de '+ms.n+' meses cumpridos'+(st>1?' · '+st+' seguidos':''):'Ainda sem meses fechados com receita.'}</small></div><button class="x" data-a="prdel" data-id="${r.id}" aria-label="Excluir meta ${esc(prName(r))}">×</button></div>`}).join('');
 return `<h2>Metas por percentual da renda</h2><p class="empty" style="padding:0 0 6px">Defina quanto da renda quer poupar ou gastar numa categoria. O hub confere mês a mês (receitas e despesas do mês, todas as contas). Para somar ao progresso de uma meta, adicione como resultado na aba Metas.</p>${rows||''}${form}`}
/* divisão de despesas */
const splList=()=>finInit().split;
function splBal(){const m={};splList().filter(e=>!e.st).forEach(e=>{m[e.p]=r2((m[e.p]||0)+(e.dir==='recv'?e.v:-e.v))});return m}
function splitPanel(){
 const F=finInit(),L=splList(),bal0=splBal(),ppl=Object.keys(bal0).sort(),recv=ppl.reduce((s,p)=>s+Math.max(0,bal0[p]),0),owe=ppl.reduce((s,p)=>s+Math.max(0,-bal0[p]),0);
 const form=`<form class="bar" id="fsp" style="margin:8px 0 0"><input class="in grow" name="t" placeholder="O que foi dividido (ex.: jantar)" required><input class="in" name="v" type="text" inputmode="decimal" autocomplete="off" placeholder="Valor total" required style="width:120px"><input class="in grow" name="who" placeholder="Com quem (Ana, Bruno)" required><select class="in" name="by" aria-label="Quem pagou"><option value="me">Eu paguei</option><option value="oth">A 1ª pessoa pagou</option></select><span class="adv"><input class="in" name="mine" type="text" inputmode="decimal" autocomplete="off" placeholder="Minha parte (padrão: igual)" style="width:190px"><input class="in" type="date" name="d" value="${T}" aria-label="Data"><select class="in" name="cat" aria-label="Categoria">${catOpts()}</select><select class="in" name="ac" aria-label="Conta usada">${accOpts()}</select></span><button type="button" class="pill" data-a="adv">Mais opções</button><button class="pill dark">Registrar divisão</button></form>`;
 const person=p=>{const b=bal0[p],ents=L.filter(e=>!e.st&&e.p===p).sort((a,c)=>a.d.localeCompare(c.d));
  return `<div class="item" style="flex-wrap:wrap"><div class="t"><strong>${esc(p)}</strong> <span class="chip c-${b>0?'g':b<0?'p':'b'}">${b>0?'te deve '+BRL(b):b<0?'você deve '+BRL(-b):'quites'}</span>${ents.map(e=>`<small>${fmt(e.d)} · ${esc(e.t)} · ${e.dir==='recv'?'ele deve':'você deve'} ${BRL(e.v)} <button class="x" data-a="spone" data-id="${e.id}" aria-label="Marcar como pago: ${esc(e.t)}" title="Marcar como pago e lançar">✓</button><button class="x" data-a="spdel" data-id="${e.id}" aria-label="Excluir ${esc(e.t)}">×</button></small>`).join('')}</div><button class="pill" data-a="spset" data-id="${esc(p)}">${b>0?'Receber':b<0?'Pagar':'Quitar'}</button></div>`};
 const hist=L.filter(e=>e.st).sort((a,c)=>(c.sd||'').localeCompare(a.sd||'')).slice(0,6);
 return `<h2>Divisão de despesas</h2><p class="empty" style="padding:0 0 6px">${ppl.length?`A receber: <strong class="pos">${BRL(recv)}</strong> · A pagar: <strong class="${owe?'neg':''}">${BRL(owe)}</strong>`:'Divida um gasto com amigos, família ou colegas e acompanhe quem deve a quem.'}</p>${ppl.map(person).join('')}${form}${hist.length?`<details style="margin-top:8px"><summary>Acertos recentes (${hist.length})</summary>${hist.map(e=>`<div class="item"><div class="t">${esc(e.p)} · ${esc(e.t)}<small>${BRL(e.v)} · acertado em ${fmt(e.sd||e.d)}</small></div></div>`).join('')}</details>`:''}<p class="empty" style="padding:6px 0 0">Ao dividir um gasto que você pagou, o valor total entra como despesa. Quando a pessoa devolve, o acerto entra como receita, e o resultado do mês fica correto.</p>`}
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

function finActE(a,id){
 const F=finInit();
 if(a==='edrec'){RED=id;return 1}
 if(a==='reccancel'){RED=null;return 1}
 if(a==='edbill'){BED=id;return 1}
 if(a==='billcancel'){BED=null;return 1}
 if(a==='fkd'){S.fkd=S.fkd===id?'':id;return 1}
 if(a==='fclr'){S.fkd='';S.fcat='';FQ='';return 1}
 if(a==='resrec'){const g=F.goals.find(x=>x.id===id),v=avgOut3();if(g&&v>0)g.target=Math.round((g.rm||6)*v);return 1}
 if(a==='prdel'){F.prules=F.prules.filter(x=>x.id!==id);return 1}
 if(a==='spdel'){F.split=F.split.filter(x=>x.id!==id);return 1}
 if(a==='spone'){const e=F.split.find(x=>x.id===id);if(e)splSettle([id],e.p,e.dir==='recv'?e.v:-e.v);return 1}
 if(a==='spset'){const E=F.split.filter(x=>!x.st&&x.p===id);splSettle(E.map(x=>x.id),id,splBal()[id]||0);return 1}
 return 0}
function finSubE(f,v){
 const F=finInit();
 if(f.id==='fres'){const rm=+v.rm||6,a=avgOut3(),tg=num(v.v)>0?r2(num(v.v)):Math.round(rm*a);if(!(tg>0)){toast('Sem histórico de despesas: informe o valor alvo');return}F.goals.push({id:uid(),n:'Reserva de emergência',target:tg,saved:Math.max(0,num(v.saved)||0),res:1,rm})}
 if(f.id==='fpr'){const pc=num(v.pc);if(!(pc>0&&pc<=100)){toast('Informe um percentual entre 1 e 100');return}const p=String(v.tgt).split(':');F.prules.push(p[0]==='save'?{id:uid(),k:'save',pc}:{id:uid(),k:'cat',cat:p.slice(1).join(':'),pc})}
 if(f.id==='fsp')splitAdd(v)}
