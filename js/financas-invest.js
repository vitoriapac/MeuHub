// investimentos: carteira, balanceamento em 2 níveis, proventos, valuation, metas e cotações
/* ===== Investimentos: carteira, balanceamento 2 niveis, proventos, valuation e cotacoes automaticas ===== */
const INV_DEF_CLS=[
 {id:'acoes',n:'Ações BR',target:40,thesis:'Ações sólidas e focadas em pagamentos de dividendos'},
 {id:'fiis',n:'FIIs',target:40,thesis:'70% investidos em FIIs de Tijolos e 30% em Papel'},
 {id:'etf_br',n:"ETF's BR",target:5,thesis:'Exposição diversificada e cripto via B3'},
 {id:'etf_us',n:"ETF's US",target:15,thesis:'20% EUA e dolarização do patrimônio no exterior'},
 {id:'rf',n:'Renda Fixa',target:0,thesis:'Segurança e liquidez acompanhando a Taxa SELIC'},
 {id:'cripto',n:'Cripto',target:0,thesis:'Exposição diversificada em Bitcoin e criptomoedas'}
];
function invInit(F=finInit()){
 const inv=F.inv=(F.inv&&typeof F.inv==='object'&&!Array.isArray(F.inv))?F.inv:{};
 inv.cfg=Object.assign({start:T.slice(0,7),aporte:300,usd:5.94,cash:0,costTotal:0,sheetId:'1a3EeYg_p0w2aD_EJXr4s5KAxcrI1yfriUgPbOb2qovM',brapiToken:'',updatedAt:0,showRadar:true,clsFilter:''},inv.cfg||{});
 if(!Array.isArray(inv.classes)||!inv.classes.length)inv.classes=INV_DEF_CLS.map(c=>({...c}));
 if(!Array.isArray(inv.assets))inv.assets=[];
 if(!Array.isArray(inv.divs))inv.divs=[];
 if(!Array.isArray(inv.milestones))inv.milestones=[];
 return inv;
}
const invUsd=inv=>+((inv.cfg||{}).usd)>0?+inv.cfg.usd:5.94;
const invUnitBrl=(a,usd)=>(+a.price||0)*(a.cur==='USD'?usd:1);
const invValBrl=(a,usd)=>r2((+a.qty||0)*invUnitBrl(a,usd));
const invFmtPct=v=>(+v||0).toFixed(1).replace('.',',')+'%';
const invFmtUsd=v=>PRIV?'US$ ••••':'US$ '+(+v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const invParseSheetId=s=>{const t=String(s||'').trim();if(!t)return '';const m=/\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,})/.exec(t);return m?m[1]:(/^[a-zA-Z0-9_-]{10,}$/.test(t)?t:'')};
function invSyncLinkedGoals(F=finInit()){
 const inv=F.inv;if(!inv||!Array.isArray(inv.assets))return;
 const usd=invUsd(inv),sums={};
 inv.assets.forEach(a=>{if(a.goalId)sums[a.goalId]=r2((sums[a.goalId]||0)+invValBrl(a,usd))});
 (F.goals||[]).forEach(g=>{if(g.id in sums)g.saved=sums[g.id]});
}
function invExtractSheetPrices(csvTxt){
 const rows=parseCSV(String(csvTxt||'')),prices={},val={};let sheetUsd=0;
 const ativoCols=[];
 rows.forEach((r,ri)=>{
  r.forEach((cell,ci)=>{
   const c=String(cell||'').trim();
   if(c==='Ativo'){
    const nxt=String(r[ci+1]||'').trim(),nxt2=String(r[ci+2]||'').trim();
    if(/^Cota[çc][ãa]o/i.test(nxt))ativoCols.push({r0:ri,tkCol:ci,pCol:ci+1});
    else if(/^Ticket$/i.test(nxt)&&/d[óo]lar/i.test(nxt2))ativoCols.push({r0:ri,tkCol:ci+1,pCol:ci+2});
   }
   if(/^D[óo]lar$/i.test(c)){const d=pnum(r[ci+1]),rb=ri>0?pnum(rows[ri-1][ci+1]):0;if(d>0&&rb>0)sheetUsd=r2(rb/d)}
   if(/^A[ÇC][ÃA]O$/i.test(c)&&/PRE[ÇC]O/i.test(String(r[ci+1]||''))){
    for(let k=ri+1;k<rows.length;k++){
     const tk=String(rows[k][ci]||'').trim().toUpperCase();
     if(!tk||!/^[A-Z0-9.\-]{2,12}$/.test(tk))continue;
     const p=pnum(rows[k][ci+1]),div=pnum(rows[k][ci+2]),lpa=pnum(rows[k][ci+4]),vpa=pnum(rows[k][ci+5]);
     val[tk]={...(p>0?{price:r2(p)}:{}),...(div>0?{div12:r2(div)}:{}),...(lpa>0?{lpa:r2(lpa)}:{}),...(vpa>0?{vpa:r2(vpa)}:{})};
    }
   }
  });
 });
 ativoCols.forEach(({r0,tkCol,pCol})=>{
  for(let i=r0+1;i<rows.length;i++){
   const tk=String(rows[i][tkCol]||'').trim().toUpperCase();
   if(!tk||!/^[A-Z0-9.\-]{2,12}$/.test(tk))continue;
   const p=pnum(rows[i][pCol]);
   if(Number.isFinite(p)&&p>0&&!(tk in prices))prices[tk]=r2(p);
  }
 });
 return{prices,val,sheetUsd};
}
async function invSyncQuotes(force){
 const F=finInit(),inv=invInit(F);
 if(INV_BUSY)return;
 INV_BUSY=true;INV_ERR='';
 if(force&&S.view==='financas'&&S.ftab==='inv')render({save:false});
 let usdGot=false,cnt=0;
 try{
  await withTimeout(10000,async signal=>{
   const tasks=[];
   tasks.push(fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL',{signal}).then(r=>r.ok?r.json():null).then(j=>{
    const bid=pnum(j&&j.USDBRL&&j.USDBRL.bid);
    if(bid>0){inv.cfg.usd=r2(bid);usdGot=true}
   }).catch(()=>{}));
   const sid=invParseSheetId(inv.cfg.sheetId),updatedTk=new Set();
   if(sid){
    tasks.push(fetch('https://docs.google.com/spreadsheets/d/'+encodeURIComponent(sid)+'/gviz/tq?tqx=out:csv&sheet=BalanceamentoCarteira',{signal}).then(r=>r.ok?r.text():'').then(csv=>{
     if(!csv)return;
     const {prices,val,sheetUsd}=invExtractSheetPrices(csv);
     if(!usdGot&&sheetUsd>0)inv.cfg.usd=sheetUsd;
     inv.assets.forEach(a=>{
      const tk=String(a.ticker||'').trim().toUpperCase();
      if(prices[tk]>0){a.price=prices[tk];updatedTk.add(tk);cnt++}
      if(val[tk]){
       if(val[tk].price>0&&!updatedTk.has(tk)){a.price=val[tk].price;updatedTk.add(tk);cnt++}
       if(val[tk].div12>0)a.div12=val[tk].div12;
       if(val[tk].lpa>0)a.lpa=val[tk].lpa;
       if(val[tk].vpa>0)a.vpa=val[tk].vpa;
      }
     });
    }).catch(()=>{}));
   }
   await Promise.all(tasks);
   const rem=[...new Set(inv.assets.filter(a=>['acoes','fiis','etf_br'].includes(a.cls)&&/^[A-Z]{4}\d{1,2}$/.test(String(a.ticker||'').toUpperCase())&&!updatedTk.has(String(a.ticker||'').toUpperCase())).map(a=>String(a.ticker).toUpperCase()))].slice(0,10);
   const token=String(inv.cfg.brapiToken||'').trim();
   if(rem.length&&(token||!sid)){
    try{
     const res=await fetch('https://brapi.dev/api/quote/'+rem.join(',')+(token?'?token='+encodeURIComponent(token):''),{signal});
     if(res.ok){
      const data=await res.json();
      (data&&Array.isArray(data.results)?data.results:[]).forEach(q=>{
       const tk=String(q.symbol||'').toUpperCase(),p=+q.regularMarketPrice;
       if(p>0)inv.assets.forEach(a=>{if(String(a.ticker||'').toUpperCase()===tk){a.price=r2(p);cnt++}});
      });
     }
    }catch(e){}
   }
  });
  if(cnt||usdGot){inv.cfg.updatedAt=Date.now();invSyncLinkedGoals(F);save()}
  else if(force)INV_ERR='Não foi possível atualizar cotações agora. Confira sua conexão.';
 }finally{
  INV_BUSY=false;INV_AT=Date.now();
  if(force&&!INV_ERR)toast(cnt?`${cnt} cotações e dólar (${BRL(invUsd(inv))}) atualizados`:usdGot?`Dólar atualizado para ${BRL(invUsd(inv))}`:'Nenhuma cotação alterada');
  if(force&&INV_ERR)toast(INV_ERR);
  if(S.view==='financas'&&S.ftab==='inv')render();
 }
}
function invEnsureQuotes(){
 const F=S.fin;if(!F||!F.inv||!Array.isArray(F.inv.assets)||!F.inv.assets.length||INV_BUSY)return;
 const inv=F.inv;if(!invParseSheetId(inv.cfg?.sheetId)&&!inv.cfg?.brapiToken)return;
 if(Date.now()-Math.max(INV_AT,inv.cfg?.updatedAt||0)<18e5)return;
 invSyncQuotes(false);
}
function invLoadPreset(){
 const F=finInit(),inv=invInit(F);
 inv.cfg=Object.assign({},inv.cfg,{start:'2024-11',aporte:300,usd:5.94,cash:9.85,costTotal:2272.14,sheetId:'1a3EeYg_p0w2aD_EJXr4s5KAxcrI1yfriUgPbOb2qovM',updatedAt:0,showRadar:true,clsFilter:''});
 inv.classes=INV_DEF_CLS.map(c=>({...c}));
 const A=(ticker,name,cls,price,qty,target,extra={})=>({id:uid(),ticker,name,cls,price,qty,cur:cls==='etf_us'?'USD':'BRL',target,cost:price,div12:0,lpa:0,vpa:0,ceilRate:8,payMonths:[],goalId:'',...extra});
 inv.assets=[
  // Ações BR
  A('BBAS3','Banco do Brasil (Financeiro)','acoes',14.3,12,20,{payMonths:[3,5,6,8,9,11,12]}),
  A('ISAE4','Isa Energia (Energia)','acoes',26.05,2,10,{payMonths:[1,2,3]}),
  A('PETR4','Petrobras (Petróleo)','acoes',42.67,7,15,{payMonths:[2,3,5,6,8,9,11,12]}),
  A('CXSE3','Caixa Seguridade (Seguros)','acoes',20.57,5,15,{payMonths:[1,4,11]}),
  A('CMIG4','Cemig (Energia)','acoes',10.94,10,10,{payMonths:[6,12]}),
  A('SAPR4','Sanepar (Saneamento)','acoes',6.62,18,5,{payMonths:[6]}),
  A('ITSA4','Itaúsa (Financeiro)','acoes',13.17,8,10,{payMonths:[1,3,4,7,8,10]}),
  A('KEPL3','Kepler Weber (Indústria)','acoes',6.63,0,5,{payMonths:[4,8,12]}),
  A('VALE3','Vale (Mineração)','acoes',58.48,0,5,{payMonths:[3,9]}),
  A('VLID3','Valid (Tecnologia)','acoes',14.78,0,5,{div12:1.78,lpa:3.74,vpa:21.39,ceilRate:8,payMonths:[1,3,6,8,12]}),
  A('BBSE3','BB Seguridade (Seguros)','acoes',36.99,0,0,{payMonths:[3,8]}),
  A('ROMI3','Indústrias Romi (Bens Cap.)','acoes',5.48,0,0),
  A('CSMG3','Copasa (Saneamento)','acoes',56.09,0,0,{payMonths:[5,6,9,12]}),
  A('KLBN4','Klabin (Papel e Celulose)','acoes',3.34,0,0),
  A('BBDC4','Bradesco (Financeiro)','acoes',13.83,0,0),
  A('LEVE3','Mahle Metal Leve (Autopeças)','acoes',28,0,0,{payMonths:[5,12]}),
  // FIIs
  A('MXRF11','Papel / Híbrido (CRIs e FIIs)','fiis',8.5,10,10),
  A('GGRC11','Galpões Logísticos / Industrial','fiis',8.09,10,10),
  A('RURA11','Fiagro / Misto','fiis',7.19,10,10),
  A('GARE11','Galpões Logísticos / R. Urbana','fiis',7.91,20,10),
  A('RZTR11','Desenvolvimento Agro','fiis',64.49,2,10),
  A('XPML11','Shoppings','fiis',81.99,2,10),
  A('KNSC11','Papel (IPCA e CDI)','fiis',8.26,20,10),
  A('RZAK11','Papel','fiis',68.33,2,10),
  A('ALZR11','Logística e Renda Urbana','fiis',9.4,0,10),
  A('BTLG11','Galpões Logísticos','fiis',94.8,0,10),
  A('HGLG11','Galpões Logísticos','fiis',141.8,0,0),
  A('KNCR11','Papel CDI','fiis',102.85,0,0),
  A('HGRU11','Renda Urbana','fiis',113.35,0,0),
  A('BTCI11','Papel','fiis',8,0,0),
  A('TRXF11','Varejo e Renda Urbana','fiis',54,0,0),
  A('KNRI11','Lajes e Galpões','fiis',143.11,0,0),
  A('HGCR11','Papel','fiis',83.7,0,0),
  A('HGBS11','Shoppings','fiis',16.83,0,0),
  // ETFs BR
  A('HASH11','Índice Cripto Hashdex','etf_br',47.08,1,30),
  A('COIN11','Índice Cripto / Bitcoin','etf_br',37.72,1,70),
  // ETFs US (em USD)
  A('VT','Ações Globais (Vanguard Total World)','etf_us',142.08,0.0002,20),
  A('VNQ','REITs EUA (Vanguard Real Estate)','etf_us',92.56,0,20),
  A('VOO','S&P 500 EUA (Vanguard)','etf_us',635.54,0,40),
  A('VXUS','Ações Internacionais ex-EUA','etf_us',75.38,0,20),
  A('IAU','Ouro (iShares Gold Trust)','etf_us',66.23,0,0),
  A('SHY','Treasuries EUA 1-3 Anos','etf_us',81.61,0,0),
  A('EFV','Mercados Desenvolvidos Value','etf_us',37.45,0,0),
  A('JEPQ','Nasdaq Equity Premium Income','etf_us',50.84,0,0),
  A('SGOV','Tesouro EUA Curto Prazo','etf_us',100.64,0,0),
  // Renda Fixa
  A('SELIC2031','Tesouro Selic 2031 - Curto','rf',1,0,50),
  A('IPCA2035','Tesouro IPCA+ 2035 - Médio','rf',1,0,50)
 ];
 inv.divs=[
  {id:uid(),ym:'2024-12',v:5.31},
  {id:uid(),ym:'2025-01',v:9.38},
  {id:uid(),ym:'2025-02',v:13.03},
  {id:uid(),ym:'2025-03',v:20.73},
  {id:uid(),ym:'2025-04',v:10.65},
  {id:uid(),ym:'2025-05',v:15.73},
  {id:uid(),ym:'2025-06',v:17.57}
 ];
 inv.milestones=[
  {id:uid(),t:'META 1: Conseguir gerar cotas infinitas com FIIs base R$10',doneDate:'2025-02-01',rule:''},
  {id:uid(),t:'META 2: Diversificar carteira com ativos de todas as classes',doneDate:'',rule:''},
  {id:uid(),t:'META 3: Focar em FIIs até gerar R$ 30 reais em dividendos por mês',doneDate:'',rule:''},
  {id:uid(),t:'META 4: Terminar 2025 com R$ 5.000 reais de patrimônio',doneDate:'',rule:''},
  {id:uid(),t:'META 5: Conseguir aportar R$ 500 reais mensais',doneDate:'2025-03-20',rule:''},
  {id:uid(),t:'META 6: Alcançar R$ 10.000 reais até Outubro de 2026',doneDate:'',rule:''},
  {id:uid(),t:"Regra: Focar em ETF's no exterior quando tiver mais de R$ 3.000 investidos",doneDate:'',rule:'rule'},
  {id:uid(),t:'Regra: Diversificar nas ações quando tiver mais de R$ 30.000 investidos',doneDate:'',rule:'rule'}
 ];
}
function invCompute(inv){
 const usd=invUsd(inv),aporte=Math.max(0,+inv.cfg.aporte||0),cash=closingCashBalance(inv);
 const assets=inv.assets||[],classes=inv.classes||[];
 const gross=r2(assets.reduce((s,a)=>s+invValBrl(a,usd),0));
 const assetCost=r2(assets.reduce((s,a)=>s+(+a.cost>0?(+a.qty||0)*(+a.cost)*(a.cur==='USD'?usd:1):invValBrl(a,usd)),0));
 const cost=+inv.cfg.costTotal>0?r2(+inv.cfg.costTotal):assetCost;
 const capGain=r2(gross-cost),capPct=cost>0?capGain/cost*100:0;
 const divTotal=r2((inv.divs||[]).reduce((s,d)=>s+(+d.v||0),0));
 const perfPct=cost>0?(capGain+divTotal)/cost*100:0;
 const postGross=gross+aporte;
 const clsRows=classes.map(c=>{
  const list=assets.filter(a=>a.cls===c.id);
  const val=r2(list.reduce((s,a)=>s+invValBrl(a,usd),0));
  const curPct=gross>0?val/gross*100:0,tgtPct=+c.target||0,diffPct=curPct-tgtPct;
  const gapBrl=Math.max(0,postGross*(tgtPct/100)-val);
  const buy=tgtPct>0&&curPct<tgtPct&&gapBrl>.01;
  return{...c,list,val,curPct,tgtPct,diffPct,gapBrl,buy,cAporte:0};
 });
 const sumGap=clsRows.filter(r=>r.buy).reduce((s,r)=>s+r.gapBrl,0);
 clsRows.forEach(r=>{
  r.cAporte=sumGap>0&&r.buy&&aporte>0?r2(aporte*(r.gapBrl/sumGap)):0;
  const postCls=r.val+r.cAporte;
  const rows=r.list.map(a=>{
   const aVal=invValBrl(a,usd),uBrl=invUnitBrl(a,usd),curPct=r.val>0?aVal/r.val*100:0,tgtPct=+a.target||0,diffPct=curPct-tgtPct;
   const gapBrl=tgtPct>0?Math.max(0,postCls*(tgtPct/100)-aVal):0;
   const buy=tgtPct>0&&(curPct<tgtPct||r.val===0)&&gapBrl>.01;
   return{a,aVal,uBrl,curPct,tgtPct,diffPct,gapBrl,buy,aAporte:0,newQty:0};
  });
  const sumAGap=rows.filter(x=>x.buy).reduce((s,x)=>s+x.gapBrl,0);
  rows.forEach(x=>{
   x.aAporte=r.cAporte>0&&sumAGap>0&&x.buy?r2(r.cAporte*(x.gapBrl/sumAGap)):0;
   x.newQty=x.uBrl>0&&x.aAporte>0?(aCurFrac(x.a,r.id)?+(x.aAporte/x.uBrl).toFixed(4):+(x.aAporte/x.uBrl).toFixed(2)):0;
  });
  r.items=rows;
 });
 return{usd,aporte,cash,gross,cost,capGain,capPct,divTotal,perfPct,clsRows};
}
const aCurFrac=(a,cid)=>a.cur==='USD'||cid==='cripto';
function invDonutSvg(clsRows,gross){
 const active=clsRows.filter(r=>r.val>0).sort((a,b)=>b.val-a.val);
 if(!active.length)return '<p class="empty">Adicione ativos ou carregue os dados da planilha para ver a alocação.</p>';
 const R=70,C=2*Math.PI*R;let off=0;
 const segs=active.map((r,i)=>{const len=r.val/gross*C,s=`<circle cx="100" cy="100" r="${R}" fill="none" stroke="${PAL8[i%8]}" stroke-width="30" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"><title>${esc(r.n)}: ${BRL(r.val)} (${invFmtPct(r.curPct)})</title></circle>`;off+=len;return s}).join('');
 return `<div class="dnw"><svg class="fs" viewBox="0 0 200 200" style="width:185px;flex:none" role="img" aria-label="Carteira por classe de ativo">${segs}<text x="100" y="94" text-anchor="middle" style="font-size:12px">Carteira</text><text x="100" y="114" text-anchor="middle" style="font-size:15px;font-weight:600;fill:var(--ink)">${BRL(gross)}</text></svg><div style="flex:1;min-width:170px">${active.map((r,i)=>`<div class="item" style="padding:var(--space-2);margin-bottom:var(--space-1)"><i style="width:12px;height:12px;border-radius:50%;background:${PAL8[i%8]};flex:none"></i><div class="t">${esc(r.n)}<small>Ideal: ${invFmtPct(r.tgtPct)}</small></div><strong>${invFmtPct(r.curPct)}</strong><strong>${BRL(r.val)}</strong></div>`).join('')}</div></div>`;
}
function invKpiPanel(inv,M){
 const sortedDivs=[...inv.divs].sort((a,b)=>a.ym.localeCompare(b.ym));
 const curDiv=inv.divs.find(d=>d.ym===T.slice(0,7))||sortedDivs[sortedDivs.length-1]||null;
 const avgOut=avgOut3(),cov=avgOut>0&&curDiv?(curDiv.v/avgOut*100):0,curYield=M.gross>0&&curDiv?(curDiv.v/M.gross*100):0;
 const invAccs=r2(finInit().acc.filter(a=>a.ty==='inv').reduce((s,a)=>s+bal(a),0));
 const upd=inv.cfg.updatedAt?'Última atualização: '+new Date(inv.cfg.updatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Cotações salvas localmente';
 return `<div class="panel wide" data-inv-kpis>
  <div class="top" style="margin:0 0 var(--space-2)">
   <h2 style="margin:0">Carteira de Investimentos</h2>
   <div class="bar" style="margin:0">
    <button type="button" class="pill dark" data-a="inv-refresh" ${INV_BUSY?'disabled':''}>${INV_BUSY?'Atualizando cotações…':'Atualizar cotações agora'}</button>
    ${!inv.assets.length?'<button type="button" class="pill" data-a="inv-preset">Carregar planilha Rumo aos 100k</button>':''}
   </div>
  </div>
  <p class="empty" style="padding:0 0 var(--space-2)">${esc(upd)} · Dólar: <strong>${BRL(M.usd)}</strong>${invAccs?' · Contas de investimento: <strong>'+BRL(invAccs)+'</strong>':''}${INV_ERR?' · <span class="neg">'+esc(INV_ERR)+'</span>':''}</p>
  <div class="rv4">
   <div class="stat c-b"><span>Saldo Bruto Atual</span><strong>${BRL(M.gross)}</strong><small>Total investido: ${BRL(M.cost)}</small></div>
   <div class="stat ${M.capGain<0?'c-p':'c-g'}"><span>Ganho de Capital</span><strong>${M.capGain>=0?'+ ':'− '}${BRL(Math.abs(M.capGain))}</strong><small>Variação: ${invFmtPct(M.capPct)} · Perf. total: ${invFmtPct(M.perfPct)}</small></div>
   <div class="stat c-y"><span>Total de Proventos</span><strong>${BRL(M.divTotal)}</strong><small>${curDiv?`${curDiv.ym}: ${BRL(curDiv.v)} (${invFmtPct(curYield)})${cov?' · '+invFmtPct(cov)+' dos gastos':''}`:'Sem proventos registrados'}</small></div>
   <div class="stat c-p"><span>Caixa / Div · Aporte do mês</span><strong>${BRL(M.cash)}</strong><small>Aporte: ${BRL(M.aporte)} (${invFmtUsd(M.usd>0?M.aporte/M.usd:0)})</small></div>
  </div>
 </div>`;
}
function invMacroPanel(inv,M){
 const sumT=inv.classes.reduce((s,c)=>s+(+c.target||0),0);
 const rows=M.clsRows.map(r=>`<tr>
  <th scope="row" style="text-align:left">${esc(r.n)}</th>
  <td>${BRL(r.val)}</td>
  <td>${invFmtPct(r.curPct)}</td>
  <td><input class="in" type="number" step="1" min="0" max="100" data-inv-cls-target="${esc(r.id)}" value="${r.tgtPct}" aria-label="% Objetivo ${esc(r.n)}" style="width:74px"></td>
  <td class="${r.diffPct<0?'pos':r.diffPct>0?'neg':''}">${r.diffPct>0?'+':''}${invFmtPct(r.diffPct)}</td>
  <td><span class="chip ${r.buy?'c-g':''}">${r.buy?'Comprar':'Esperar'}</span></td>
  <td><strong>${BRL(r.cAporte)}</strong></td>
 </tr>`).join('');
 return `<div class="panel c2"><h2>Carteira Atual × Ideal</h2>${invDonutSvg(M.clsRows,M.gross)}<p class="empty" style="padding:var(--space-2) 0 0">Soma das metas: <strong>${invFmtPct(sumT)}</strong>${Math.abs(sumT-100)>.1?' (ajuste para 100%)':''}.</p></div>
 <div class="panel c4"><h2>Rebalanceamento Macro</h2><p class="empty" style="padding:0 0 var(--space-2)">Distribuição sugerida do aporte de <strong>${BRL(M.aporte)}</strong> conforme as metas abaixo:</p><div style="overflow-x:auto"><table class="yt"><thead><tr><th scope="col">Segmento</th><th scope="col">Total</th><th scope="col">% Atual</th><th scope="col">% Ideal</th><th scope="col">Dif.</th><th scope="col">Ação</th><th scope="col">Aportar</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function invSettingsFields(inv,M){
 return `<div class="bar" style="margin:0 0 var(--space-2)"><label class="lb" style="margin:0">Aporte do mês (R$)<input data-fin-private class="in" data-inv-cfg="aporte" inputmode="decimal" value="${M.aporte.toFixed(2).replace('.',',')}" style="width:120px"></label><label class="lb" style="margin:0">Cotação Dólar (R$)<input data-fin-private class="in" data-inv-cfg="usd" inputmode="decimal" value="${M.usd.toFixed(2).replace('.',',')}" style="width:110px"></label><label class="lb" style="margin:0">Caixa / Dividendos (R$)<input data-fin-private class="in" data-inv-cfg="cash" inputmode="decimal" value="${M.cash.toFixed(2).replace('.',',')}" style="width:130px"></label><label class="lb" style="margin:0">Total Investido / Custo (R$)<input data-fin-private class="in" data-inv-cfg="costTotal" inputmode="decimal" value="${(+inv.cfg.costTotal||0)?(+inv.cfg.costTotal).toFixed(2).replace('.',','):''}" placeholder="Automático" style="width:140px"></label></div>`;
}
function invAssetForm(inv){
 return `<form class="bar" id="finvasset" style="margin:var(--space-3) 0 0"><input class="in" name="ticker" placeholder="Ticker (ex.: WEGE3)" required style="width:130px"><input class="in grow" name="name" placeholder="Nome / Setor (opcional)"><select class="in" name="cls" aria-label="Classe">${inv.classes.map(c=>`<option value="${esc(c.id)}">${esc(c.n)}</option>`).join('')}</select><input data-fin-private class="in" name="price" inputmode="decimal" placeholder="Cotação" required style="width:100px"><input data-fin-private class="in" name="qty" inputmode="decimal" placeholder="Qtd" value="0" style="width:90px"><input class="in" name="target" type="number" step="1" min="0" max="100" placeholder="% Alvo" value="10" style="width:90px"><select class="in" name="cur" aria-label="Moeda"><option value="BRL">BRL (R$)</option><option value="USD">USD (US$)</option></select><button class="pill dark">Adicionar ativo</button></form>`;
}
function invAssetsPanel(inv,M){
 const F=finInit(),cf=(inv.cfg.clsFilter||''),showRadar=inv.cfg.showRadar!==false;
 const fltBar=`<div class="bar" style="margin:0 0 var(--space-2)"><button type="button" class="pill ${!cf?'on':''}" data-a="inv-cls" data-id="">Todas as classes</button>${M.clsRows.map(c=>`<button type="button" class="pill ${cf===c.id?'on':''}" data-a="inv-cls" data-id="${esc(c.id)}">${esc(c.n)} (${c.list.length})</button>`).join('')}<button type="button" class="pill ${showRadar?'on':''}" data-a="inv-radar">${showRadar?'Ocultar radar (Qtd 0)':'Mostrar radar (Qtd 0)'}</button></div>`;
 const sections=M.clsRows.filter(c=>!cf||c.id===cf).map(c=>{
  const vis=c.items.filter(x=>showRadar||(+x.a.qty||0)>0||(+x.a.target||0)>0);
  if(!vis.length)return '';
  const rows=vis.map(({a,aVal,aUnitBrl,uBrl,curPct,tgtPct,diffPct,buy,aAporte,newQty})=>{
   const buyForm=INV_BUY===a.id?`<tr><td colspan="10"><form class="bar" id="finvbuy" data-id="${esc(a.id)}" style="margin:var(--space-1) 0"><input data-fin-private class="in" name="qty" inputmode="decimal" value="${newQty>0?newQty:1}" required style="width:100px" aria-label="Quantidade comprada"><input data-fin-private class="in" name="price" inputmode="decimal" value="${(+a.price||0)}" required style="width:100px" aria-label="Cotação unitária (${a.cur})"><label><input type="checkbox" name="useCash"> Usar Caixa / Div</label><select class="in" name="ac" aria-label="Debitar conta"><option value="">Não debitar conta</option>${F.acc.filter(x=>x.ty!=='card').map(x=>`<option value="${esc(x.id)}">${esc(x.n)}</option>`).join('')}</select><button class="pill dark">Confirmar aporte</button><button type="button" class="pill" data-a="inv-buy-cancel">Cancelar</button></form></td></tr>`:'';
   return `<tr>
    <th scope="row" style="text-align:left"><strong>${esc(a.ticker)}</strong>${a.cur==='USD'?' <span class="chip c-y">US$</span>':''}<small style="display:block;font-weight:400">${esc(a.name||'')}</small></th>
    <td><input data-fin-private class="in" data-inv-price="${esc(a.id)}" inputmode="decimal" value="${(+a.price||0)}" aria-label="Cotação de ${esc(a.ticker)}" style="width:88px">${a.cur==='USD'?`<small style="display:block">${BRL(uBrl)}</small>`:''}</td>
    <td><input data-fin-private class="in" data-inv-qty="${esc(a.id)}" inputmode="decimal" value="${(+a.qty||0)}" aria-label="Quantidade de ${esc(a.ticker)}" style="width:82px"></td>
    <td>${BRL(aVal)}</td>
    <td>${invFmtPct(curPct)}</td>
    <td><input class="in" type="number" step="1" min="0" max="100" data-inv-target="${esc(a.id)}" value="${tgtPct}" aria-label="% Alvo ${esc(a.ticker)}" style="width:68px"></td>
    <td class="${diffPct<0?'pos':''}">${diffPct>0?'+':''}${invFmtPct(diffPct)}</td>
    <td><span class="chip ${buy?'c-g':''}">${buy?'Comprar':'Esperar'}</span></td>
    <td>${newQty>0?`<strong>+${newQty}</strong> (${BRL(aAporte)})`:aAporte>0?BRL(aAporte):'—'}</td>
    <td><span class="bar" style="margin:0;flex-wrap:nowrap"><button type="button" class="pill" data-a="inv-buy" data-id="${esc(a.id)}">+ Aportar</button><button type="button" class="x" data-a="inv-del" data-id="${esc(a.id)}" aria-label="Excluir ${esc(a.ticker)}">×</button></span>${F.goals.length?`<select class="in" data-inv-goal="${esc(a.id)}" aria-label="Vincular à meta" style="margin-top:4px;max-width:130px"><option value="">Sem meta</option>${F.goals.map(g=>`<option value="${esc(g.id)}" ${a.goalId===g.id?'selected':''}>${esc(g.n)}</option>`).join('')}</select>`:''}</td>
   </tr>${buyForm}`;
  }).join('');
  return `<h3 class="gh">${esc(c.n)} · ${BRL(c.val)}${c.cAporte?` · Aporte sugerido: <strong>${BRL(c.cAporte)}</strong>`:''}</h3><div style="overflow-x:auto"><table class="yt"><thead><tr><th scope="col">Ativo</th><th scope="col">Cotação</th><th scope="col">Qtd</th><th scope="col">Investido</th><th scope="col">% Atual</th><th scope="col">% Alvo</th><th scope="col">Dif.</th><th scope="col">Ação</th><th scope="col">Comprar</th><th scope="col">Opções</th></tr></thead><tbody>${rows}</tbody></table></div>`;
 }).join('');
 return `<div class="panel wide"><div class="top"><h2>Posição por ativo</h2><button class="pill" data-a="fin-config-open" data-id="fin-asset-form">Cadastrar ativo</button></div>${fltBar}${sections||'<p class="empty">Nenhum ativo cadastrado. Use Cadastrar ativo ou carregue a planilha Rumo aos 100k.</p>'}</div>`;
}
function invProventosPanel(inv){
 const sorted=[...inv.divs].sort((a,b)=>a.ym.localeCompare(b.ym));
 const years=[...new Set([today.getFullYear(),today.getFullYear()-1,...sorted.map(d=>+d.ym.slice(0,4))])].sort();
 if(INV_YR!=='all'&&!years.includes(INV_YR))INV_YR=years[years.length-1];
 const allY=INV_YR==='all',yr=allY?today.getFullYear():INV_YR;
 const list=allY?sorted:sorted.filter(d=>+d.ym.slice(0,4)===yr);
 const yrTot=r2(list.reduce((s,d)=>s+(+d.v||0),0)),allTot=r2(sorted.reduce((s,d)=>s+(+d.v||0),0));
 const yrAvg=list.length?r2(yrTot/list.length):0;
 const mBars=Array.from({length:12},(_,i)=>{const ym=yr+'-'+hm2(i+1),it=sorted.find(d=>d.ym===ym);return{m:MES[i],v:it?+it.v:0}});
 const mx=Math.max(1,...mBars.map(x=>x.v));
 const bars=!allY?`<div style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;align-items:end;height:52px;margin:var(--space-2) 0" role="img" aria-label="Proventos mês a mês em ${yr}">${mBars.map(x=>`<div style="display:flex;flex-direction:column;align-items:center;gap:2px" title="${x.m}: ${BRL(x.v)}"><div style="width:100%;height:${x.v?Math.max(4,Math.round(x.v/mx*34)):2}px;border-radius:3px;background:${x.v?'var(--green)':'var(--line)'}"></div><small style="font-size:10px;opacity:${x.v?1:.55}">${x.m}</small></div>`).join('')}</div>`:'';
 const tRows=list.map(d=>{
  const idx=sorted.indexOf(d),prev=idx>0?+sorted[idx-1].v:null;
  const dR=prev!==null?r2(+d.v-prev):null,dPct=prev>0?((+d.v-prev)/prev*100):null;
  return `<tr><th scope="row" style="text-align:left">${esc(d.ym)}</th><td><strong>${BRL(d.v)}</strong></td><td class="${dR>0?'pos':dR<0?'neg':''}">${dR===null?'—':(dR>=0?'+ ':'− ')+BRL(Math.abs(dR))}</td><td class="${dPct>0?'pos':dPct<0?'neg':''}">${dPct===null?'—':(dPct>=0?'+':'')+invFmtPct(dPct)}</td><td><button type="button" class="x" data-a="inv-div-del" data-id="${esc(d.id)}" aria-label="Excluir provento de ${esc(d.ym)}">×</button></td></tr>`;
 }).join('');
 const payAssets=inv.assets.filter(a=>a.cls==='acoes'||(Array.isArray(a.payMonths)&&a.payMonths.length));
 const curMo=today.getMonth()+1;
 const mapaHtml=payAssets.length?`<h3 class="gh" style="margin-top:0">Mapa de Proventos (Jan–Dez)</h3><p class="empty" style="padding:0 0 var(--space-1)">Clique em um mês para marcar ou desmarcar quando o ativo costuma pagar dividendos/JCP.</p>${payAssets.map(a=>{const pm=new Set(a.payMonths||[]);return `<div class="item" style="flex-wrap:wrap"><strong style="min-width:66px">${esc(a.ticker)}</strong><div class="bar" style="margin:0;gap:4px">${MES.map((mn,i)=>{const m=i+1,on=pm.has(m);return `<button type="button" class="pill ${on?'on':''}" style="padding:2px 7px;min-height:26px${m===curMo&&!on?';outline:1px dashed var(--s1)':''}" data-a="inv-paymonth" data-id="${esc(a.id)}" data-m="${m}" aria-pressed="${on}">${mn[0].toUpperCase()}</button>`}).join('')}</div></div>`}).join('')}`:'';
 const leftHtml=`<p style="margin:0">${allY?'Total acumulado':'Total de '+yr}: <strong>${BRL(yrTot)}</strong> · Média mensal (${list.length} ${list.length===1?'mês':'meses'}): <strong>${BRL(yrAvg)}</strong> · Acumulado geral: <strong>${BRL(allTot)}</strong>.</p>
  ${bars}
  ${list.length?`<div style="overflow-x:auto"><table class="yt"><thead><tr><th scope="col">Mês</th><th scope="col">Proventos</th><th scope="col">Δ em R$</th><th scope="col">Δ em %</th><th scope="col"></th></tr></thead><tbody>${tRows}</tbody></table></div>`:'<p class="empty">Nenhum provento registrado neste período.</p>'}
  <form class="bar" id="finvdiv" style="margin:var(--space-2) 0 0"><label class="lb" style="margin:0">Mês<input class="in" type="month" name="ym" value="${T.slice(0,7)}" required></label><label class="lb" style="margin:0">Valor recebido (R$)<input data-fin-private class="in" name="v" inputmode="decimal" placeholder="Ex.: 17,57" required style="width:120px"></label><label><input type="checkbox" name="addCash" checked> Somar ao Caixa/Div</label><label><input type="checkbox" name="addTx"> Lançar em Receitas (Rendimentos)</label><button class="pill dark">Salvar provento</button></form>`;
 return `<div class="panel wide">
  <div class="top" style="margin:0 0 var(--space-2)"><h2 style="margin:0">Proventos Pagos e Crescimento</h2><div class="bar" style="margin:0">${years.map(y=>`<button type="button" class="pill ${!allY&&yr===y?'on':''}" data-a="inv-yr" data-id="${y}">${y}</button>`).join('')}<button type="button" class="pill ${allY?'on':''}" data-a="inv-yr" data-id="all">Tudo</button></div></div>
  ${mapaHtml?`<div class="two" style="gap:var(--space-4)"><div>${leftHtml}</div><div>${mapaHtml}</div></div>`:leftHtml}
 </div>`;
}
function invMilestonesPanel(inv){
 return `<div class="panel wide"><h2>Marcos da Carteira ("Rumo aos 100k")</h2>
  ${inv.milestones.map(m=>`<div class="item"><input type="checkbox" class="chk" data-a="inv-mile-tog" data-id="${esc(m.id)}" ${m.doneDate?'checked':''} aria-label="Marcar ${esc(m.t)}"><div class="t">${esc(m.t)}<small>${m.doneDate?'Batida em '+fmt(m.doneDate)+' '+m.doneDate.slice(0,4):m.rule==='rule'?'Regra de estratégia':'Em aberto'}</small></div><input class="in" type="date" data-inv-mile-date="${esc(m.id)}" value="${esc(m.doneDate||'')}" aria-label="Data de conquista"><button type="button" class="x" data-a="inv-mile-del" data-id="${esc(m.id)}" aria-label="Excluir marco">×</button></div>`).join('')||'<p class="empty">Defina metas de patrimônio, aporte ou renda passiva para acompanhar sua evolução.</p>'}
  <form class="bar" id="finvmile" style="margin:var(--space-2) 0 0"><input class="in grow" name="t" placeholder="Ex.: Alcançar R$ 10.000 em investimentos" required><select class="in" name="rule" aria-label="Tipo"><option value="">Meta da carteira</option><option value="rule">Regra / critério</option></select><button class="pill">Adicionar marco</button></form>
 </div>`;
}
function invToolsPanel(inv,M){
 const theses=inv.classes.map(c=>`<label class="lb" style="margin:var(--space-1) 0">${esc(c.n)}<input class="in" data-inv-cls-thesis="${esc(c.id)}" value="${esc(c.thesis||'')}" placeholder="Estratégia da classe…"></label>`).join('');
 const valAssets=inv.assets.filter(a=>a.cls==='acoes'||a.lpa>0||a.vpa>0||a.div12>0);
 const valRows=valAssets.map(a=>{
  const p=+a.price||0,d12=+a.div12||0,rate=(+a.ceilRate>0?+a.ceilRate:6),teto=d12>0?r2(d12/(rate/100)):0;
  const lpa=+a.lpa||0,vpa=+a.vpa||0,graham=(lpa>0&&vpa>0)?r2(Math.sqrt(22.5*lpa*vpa)):0;
  const mg=(graham>0&&p>0)?((graham/p-1)*100):0;
  return `<tr>
   <th scope="row" style="text-align:left"><strong>${esc(a.ticker)}</strong><small style="display:block;font-weight:400">${BRL(p)}</small></th>
   <td><input data-fin-private class="in" data-inv-div12="${esc(a.id)}" inputmode="decimal" value="${d12||''}" placeholder="0,00" style="width:78px" aria-label="Dividendos 12m ${esc(a.ticker)}"></td>
   <td><input data-fin-private class="in" data-inv-ceil="${esc(a.id)}" inputmode="decimal" value="${rate}" style="width:60px" aria-label="Taxa teto % ${esc(a.ticker)}"></td>
   <td><strong>${teto>0?BRL(teto):'—'}</strong>${teto>0&&p>0?` <span class="chip ${p<=teto?'c-g':''}">${p<=teto?'Abaixo do teto':'Acima'}</span>`:''}</td>
   <td><input data-fin-private class="in" data-inv-lpa="${esc(a.id)}" inputmode="decimal" value="${lpa||''}" placeholder="0,00" style="width:72px" aria-label="LPA ${esc(a.ticker)}"></td>
   <td><input data-fin-private class="in" data-inv-vpa="${esc(a.id)}" inputmode="decimal" value="${vpa||''}" placeholder="0,00" style="width:72px" aria-label="VPA ${esc(a.ticker)}"></td>
   <td><strong>${graham>0?BRL(graham):'—'}</strong>${mg!==0&&graham>0?` <small>(${mg>0?'+':''}${Math.round(mg)}%)</small>`:''}</td>
  </tr>`;
 }).join('');
 const simRes=INV_SIM?`<div class="item" data-inv-sim-result style="margin-top:var(--space-2)"><div class="t"><strong>Em ${INV_SIM.years} anos (${INV_SIM.rate}% a.a.): ${BRL(INV_SIM.finalVal)}</strong><small>Do seu bolso: ${BRL(INV_SIM.contributed)} · Juros compostos: <strong class="pos">+${BRL(INV_SIM.interest)}</strong> · Renda passiva estimada (~${INV_SIM.rate}% a.a.): <strong>${BRL(INV_SIM.monthlyPassive)}/mês</strong>${INV_SIM.goal?' · '+(INV_SIM.goalPeriods?`Meta de ${BRL(INV_SIM.goal)}/mês atingida em ~${INV_SIM.goalPeriods} ${INV_SIM.goalPeriods===1?'ano':'anos'}`:'Meta de renda requer mais prazo ou aporte'):''}</small></div></div>`:'';
 return `<div class="panel"><h2>Valuation de Ações (Preço Teto Bazin &amp; Preço Justo Graham)</h2>
  <p class="empty" style="padding:0 0 var(--space-2)">Preço Teto = Dividendos 12m ÷ Taxa mínima desejada. Preço Justo de Graham = √(22,5 × LPA × VPA).</p>
  ${valAssets.length?`<div style="overflow-x:auto"><table class="yt"><thead><tr><th scope="col">Ação</th><th scope="col">Div. 12m</th><th scope="col">Taxa %</th><th scope="col">Preço Teto</th><th scope="col">LPA</th><th scope="col">VPA</th><th scope="col">Graham</th></tr></thead><tbody>${valRows}</tbody></table></div>`:'<p class="empty">Adicione ações BR para calcular Preço Teto e Preço Justo.</p>'}
 </div>
 <div class="panel"><h2>Simulador de Juros Compostos</h2>
  <form class="bar" id="finvsim"><label class="lb" style="margin:0">Patrimônio inicial<input data-fin-private class="in" name="initial" inputmode="decimal" value="${(INV_SIM?INV_SIM.initial:M.gross).toFixed(2).replace('.',',')}" required style="width:130px"></label><label class="lb" style="margin:0">Aporte mensal<input data-fin-private class="in" name="monthly" inputmode="decimal" value="${(INV_SIM?INV_SIM.monthly:M.aporte).toFixed(2).replace('.',',')}" required style="width:120px"></label><label class="lb" style="margin:0">Taxa (% a.a.)<input data-fin-private class="in" name="rate" inputmode="decimal" value="${INV_SIM?INV_SIM.rate:'10'}" required style="width:90px"></label><label class="lb" style="margin:0">Prazo (anos)<input class="in" name="years" type="number" min="1" max="60" value="${INV_SIM?INV_SIM.years:'10'}" required style="width:80px"></label><label class="lb" style="margin:0">Meta renda/mês (opc.)<input data-fin-private class="in" name="goal" inputmode="decimal" value="${INV_SIM&&INV_SIM.goal?INV_SIM.goal:''}" placeholder="Ex.: 2000" style="width:120px"></label><button class="pill dark">Simular</button></form>
  ${simRes}
 </div>
 <div class="panel wide" id="fin-invest-settings"><h2>Configurações da carteira e cotações</h2>
  ${invSettingsFields(inv,M)}<details id="fin-invest-theses"><summary>Teses por classe</summary>${theses}</details>
  <p class="empty" style="padding:0 0 var(--space-2)">As cotações de Ações, FIIs e ETFs são sincronizadas diretamente das fórmulas GOOGLEFINANCE da sua Planilha Google + Dólar ao vivo (AwesomeAPI). Para tickers fora da planilha, informe um token gratuito da Brapi (opcional).</p>
  <div class="bar"><label class="lb grow" style="margin:0">ID ou Link da Planilha Google<input class="in" data-inv-cfg="sheetId" value="${esc(inv.cfg.sheetId||'')}" placeholder="URL ou ID da planilha pública"></label><label class="lb" style="margin:0">Token Brapi (opcional)<input class="in" data-inv-cfg="brapiToken" value="${esc(inv.cfg.brapiToken||'')}" placeholder="Token brapi.dev" style="width:180px"></label><button type="button" class="pill" data-a="inv-preset">Carregar / restaurar planilha Rumo aos 100k</button></div>
 </div>`;
}
function invPanel(){
 const F=finInit(),inv=invInit(F),M=invCompute(inv);
 const registration=`<details class="panel wide" id="fin-asset-form"><summary>Cadastrar ativo</summary>${invAssetForm(inv)}</details>`;
 return invKpiPanel(inv,M)+invAssetsPanel(inv,M)+invMacroPanel(inv,M)+invProventosPanel(inv)+invMilestonesPanel(inv)+registration+invToolsPanel(inv,M);
}
function invHandleChange(i){
 const d=i.dataset;if(!d)return 0;
 const F=finInit();
 const inv=()=>invInit(F);
 if(d.invPrice||d.invQty||d.invTarget||d.invDiv12||d.invLpa||d.invVpa||d.invCeil){
  const mp=[['invPrice','price',0],['invQty','qty',0],['invTarget','target',0],['invDiv12','div12',0],['invLpa','lpa',0],['invVpa','vpa',0],['invCeil','ceilRate',0.1]];
  for(const [k,fk,min] of mp){
   if(d[k]===undefined)continue;
   const a=inv().assets.find(x=>x.id===d[k]);if(!a)return 1;
   const v=num(i.value);if(Number.isFinite(v)&&v>=min){a[fk]=v;invSyncLinkedGoals(F)}else if(!i.value.trim()&&min===0){a[fk]=0;invSyncLinkedGoals(F)}else toast('Informe um valor válido');
   return 1;
  }
 }
 if(d.invGoal!==undefined){const a=inv().assets.find(x=>x.id===d.invGoal);if(a){a.goalId=i.value;invSyncLinkedGoals(F)}return 1}
 if(d.invClsTarget!==undefined){const c=inv().classes.find(x=>x.id===d.invClsTarget);const v=num(i.value);if(c&&Number.isFinite(v)&&v>=0&&v<=100)c.target=v;return 1}
 if(d.invClsThesis!==undefined){const c=inv().classes.find(x=>x.id===d.invClsThesis);if(c)c.thesis=i.value.trim();return 1}
 if(d.invCfg!==undefined){
  const k=d.invCfg,I=inv();
  if(k==='sheetId'){I.cfg.sheetId=invParseSheetId(i.value)||i.value.trim();I.cfg.updatedAt=0}
  else if(k==='brapiToken'){I.cfg.brapiToken=i.value.trim();I.cfg.updatedAt=0}
  else{const v=num(i.value);if(!i.value.trim()&&k==='costTotal')I.cfg.costTotal=0;else if(Number.isFinite(v)&&(k!=='usd'||v>0)&&v>=0)I.cfg[k]=k==='cash'?r2(v-(closingProjection(F).credits.get(CLOSING_CASH)||0)/100):r2(v);else toast('Informe um valor válido')}
  return 1;
 }
 if(d.invMileDate!==undefined){const m=inv().milestones.find(x=>x.id===d.invMileDate);if(m)m.doneDate=i.value;return 1}
 return 0;
}
function finActE(a,id,b){
 const F=finInit();
 if(a==='edrec'){RED=id;return 1}
 if(a==='reccancel'){RED=null;return 1}
 if(a==='rec-upd-val'){const r=F.rec.find(x=>x.id===id),al=recPriceAlert(r);if(r&&al){r.v=al.last.v;recReminderUpdate(r);toast('Valor da recorrência atualizado para '+BRL(r.v))}return 1}
 if(a==='reconcile-acc'){const acc=F.acc.find(x=>x.id===id&&x.ty!=='card');if(acc&&Number.isFinite(acc.stmtFin)){acc.ini=r2((+acc.ini||0)+(acc.stmtFin-bal(acc)));toast('Saldo reconciliado com o extrato ('+BRL(acc.stmtFin)+')')}return 1}
 if(a==='edbill'){BED=id;return 1}
 if(a==='billcancel'){BED=null;return 1}
 if(a==='inv-refresh'){invSyncQuotes(true);return 1}
 if(a==='inv-preset'){invLoadPreset();invSyncLinkedGoals(F);toast('Planilha Rumo aos 100k carregada com cotações e proventos');return 1}
 if(a==='inv-cls'){invInit(F).cfg.clsFilter=id;return 1}
 if(a==='inv-radar'){const I=invInit(F);I.cfg.showRadar=I.cfg.showRadar===false;return 1}
 if(a==='inv-yr'){INV_YR=id==='all'?'all':+id;return 1}
 if(a==='inv-del'){const I=invInit(F);I.assets=I.assets.filter(x=>x.id!==id);if(INV_BUY===id)INV_BUY=null;invSyncLinkedGoals(F);return 1}
 if(a==='inv-buy'){INV_BUY=INV_BUY===id?null:id;return 1}
 if(a==='inv-buy-cancel'){INV_BUY=null;return 1}
 if(a==='inv-paymonth'&&b){const a0=invInit(F).assets.find(x=>x.id===id),m=+b.dataset.m;if(a0&&m>=1&&m<=12){const set=new Set(a0.payMonths||[]);if(set.has(m))set.delete(m);else set.add(m);a0.payMonths=[...set].sort((x,y)=>x-y)}return 1}
 if(a==='inv-div-del'){const I=invInit(F);I.divs=I.divs.filter(x=>x.id!==id);return 1}
 if(a==='inv-mile-tog'){const m=invInit(F).milestones.find(x=>x.id===id);if(m)m.doneDate=m.doneDate?'':T;return 1}
 if(a==='inv-mile-del'){const I=invInit(F);I.milestones=I.milestones.filter(x=>x.id!==id);return 1}
 if(a==='fkd'){ANALYSIS_CUT='';S.fkd=S.fkd===id?'':id;TXBULKDEL=false;return 1}
 if(a==='fclr'){ANALYSIS_CUT='';S.fkd='';S.fcat='';S.fac='';FQ='';FRECON='';FTAG='';TXBULKDEL=false;return 1}
 if(a==='fmm'){S.fmm=id;return 1}
 if(a==='fmpix'){S.fmpix=!S.fmpix;return 1}
 if(a==='fmerch'){
  S.ftab='lanc';FQ=id;S.fkd='out';TXBULKDEL=false;
  const q=norm(id);
  if(!finMonth().tx.some(t=>t.k==='out'&&norm(t.t).includes(q))){
   const latest=F.tx.filter(t=>t.k==='out'&&norm(t.t).includes(q)).sort((a,b)=>b.d.localeCompare(a.d))[0];
   if(latest)S.fmo=(+latest.d.slice(0,4)-today.getFullYear())*12+(+latest.d.slice(5,7)-1-today.getMonth());
  }
  return 1;
 }
 if(a==='recadd-det'){
  const c=detectRecurring().find(x=>x.key===id);
  if(!c){toast('Sugestão não encontrada');return 1}
  const r={id:uid(),k:'out',t:c.t,v:c.v,cat:c.cat,ac:c.ac,day:c.day,ini:c.latestDate,end:'',skip:[]};
  F.tx.forEach(t=>{if(!t.rc&&t.k==='out'&&norm(cleanDesc(t.t)||t.t)===c.key){t.rc=r.id;const sk='r_'+r.id+'_'+t.d.slice(0,7);if(!r.skip.includes(sk))r.skip.push(sk)}});
  F.rec.push(r);genRec();toast('Recorrência "'+esc(c.t)+'" cadastrada');return 1;
 }
 if(a==='recdismiss-det'){F.recDismiss=F.recDismiss||[];if(!F.recDismiss.includes(id))F.recDismiss.push(id);return 1}
 if(a==='budsuggest'){
  const s=budgetSuggestions();
  if(!s||!Object.keys(s.by).length){toast('Sem histórico de despesas suficiente para sugerir orçamentos');return 1}
  Object.entries(s.by).forEach(([cat,val])=>setBudget(cat,s.curP,val));
  toast('Orçamentos preenchidos com a média de '+s.months+(s.months===1?' mês':' meses')+' ('+Object.keys(s.by).length+' categorias)');return 1;
 }
 if(a==='txbulkcancel'){TXBULKDEL=false;clearTimeout(TXBULKT);return 1}
 if(a==='txbulkdel'){
  const L=filteredTx(finMonth().tx);if(!L.length)return 1;
  if(!TXBULKDEL){
   TXBULKDEL=true;clearTimeout(TXBULKT);
   TXBULKT=setTimeout(()=>{if(TXBULKDEL){TXBULKDEL=false;if(S.view==='financas')render({save:false})}},6000);
   toast('Clique novamente em Confirmar para excluir os '+L.length+' lançamentos listados (ficam 30 dias na lixeira)');return 1;
  }
  TXBULKDEL=false;clearTimeout(TXBULKT);
  UN=JSON.stringify({events:S.events,notes:S.notes,tasks:S.tasks,links:S.links,fin:S.fin});
  UTime=0;
  const ids=new Set(L.map(t=>t.id));
  L.forEach(t=>{if(t.rc){const r=F.rec.find(x=>x.id===t.rc);if(r){r.skip=r.skip||[];if(!r.skip.includes(t.id))r.skip.push(t.id)}}});
  F.tx=F.tx.filter(t=>!ids.has(t.id));
  if(FED&&ids.has(FED))FED=null;
  auditLog('txDelete');
  toast(ids.size+' lançamentos excluídos · ficam 30 dias na lixeira',1);return 1;
 }
 if(a==='resrec'){const g=F.goals.find(x=>x.id===id),v=avgOut3();if(g&&v>0)g.target=Math.round((g.rm||6)*v);return 1}
 if(a==='prdel'){F.prules=F.prules.filter(x=>x.id!==id);return 1}
 if(a==='spdel'){F.split=F.split.filter(x=>x.id!==id);return 1}
 if(a==='spone'){const e=F.split.find(x=>x.id===id);if(e)splSettle([id],e.p,e.dir==='recv'?e.v:-e.v);return 1}
 if(a==='spset'){const E=F.split.filter(x=>!x.st&&x.p===id);splSettle(E.map(x=>x.id),id,splBal()[id]||0);return 1}
 if(a==='fin-archive'){if(finArchiveYear(+id))toast('Ano '+id+' arquivado com saldo consolidado.');return 1}
 if(a==='fin-unarchive'){finUnarchiveYear(+id);return 1}
 if(a==='finclearcancel'){FCLEAR=null;clearTimeout(FCLEART);return 1}
 if(a==='fincleartx'){
  if(FCLEAR!=='tx'){
   FCLEAR='tx';clearTimeout(FCLEART);
   FCLEART=setTimeout(()=>{if(FCLEAR==='tx'){FCLEAR=null;if(S.view==='financas')render({save:false})}},6000);
   toast('Clique novamente em Confirmar para remover todos os lançamentos e zerar o saldo inicial');return 1;
  }
  FCLEAR=null;clearTimeout(FCLEART);TXBULKDEL=false;clearTimeout(TXBULKT);
  snapPut('Antes de limpar lançamentos das Finanças');
  UN=JSON.stringify({events:S.events,notes:S.notes,tasks:S.tasks,links:S.links,fin:S.fin});
  UTime=0;
  F.tx.forEach(t=>{if(t.rc){const r=F.rec.find(x=>x.id===t.rc);if(r){r.skip=r.skip||[];if(!r.skip.includes(t.id))r.skip.push(t.id)}}});
  const periods=new Set((F.closings||[]).map(e=>e.month));
  if(periods.size)F.closingRetained=Object.assign({},F.closingRetained,Object.fromEntries(closingNet(F,periods)));
  F.tx=[];F.acc.forEach(x=>{x.ini=0});
  FED=null;IMP=null;FQ='';FRECON='';S.fcat='';S.fkd='';
  toast('Lançamentos financeiros removidos',1);return 1;
 }
 if(a==='finclearall'){
  if(FCLEAR!=='all'){
   FCLEAR='all';clearTimeout(FCLEART);
   FCLEART=setTimeout(()=>{if(FCLEAR==='all'){FCLEAR=null;if(S.view==='financas')render({save:false})}},6000);
   toast('Clique novamente em Confirmar para zerar todos os dados das Finanças');return 1;
  }
  FCLEAR=null;clearTimeout(FCLEART);TXBULKDEL=false;clearTimeout(TXBULKT);
  snapPut('Antes de zerar Finanças');
  UN=JSON.stringify({events:S.events,notes:S.notes,tasks:S.tasks,links:S.links,fin:S.fin});
  UTime=0;
  const eids=new Set(F.bills.map(b=>b.eid).filter(Boolean));
  if(eids.size)S.events=S.events.filter(e=>!eids.has(e.id));
  S.fin={tx:[],acc:[{id:'main',n:'Conta principal',ty:'cc',ini:0}],rec:[],recDismiss:[],rules:[],bud:{},budHist:{},goals:[],prules:[],split:[],bills:[]};
  FED=null;IMP=null;RED=null;BED=null;FRE=null;FQ='';FRECON='';S.fac='';S.fcat='';S.fkd='';INV_BUY=null;INV_SIM=null;
  toast('Dados das Finanças zerados',1);return 1;
 }
 return 0}
function finSubE(f,v){
 const F=finInit();
 if(f.id==='fres'){const rm=+v.rm||6,a=avgOut3(),tg=num(v.v)>0?r2(num(v.v)):Math.round(rm*a);if(!(tg>0)){toast('Sem histórico de despesas: informe o valor alvo');return}F.goals.push({id:uid(),n:'Reserva de emergência',target:tg,saved:Math.max(0,num(v.saved)||0),res:1,rm})}
 if(f.id==='fpr'){const pc=num(v.pc);if(!(pc>0&&pc<=100)){toast('Informe um percentual entre 1 e 100');return}const p=String(v.tgt).split(':');F.prules.push(p[0]==='save'?{id:uid(),k:'save',pc}:{id:uid(),k:'cat',cat:p.slice(1).join(':'),pc})}
 if(f.id==='fsp')splitAdd(v);
 if(f.id==='finvasset'){
  const I=invInit(F),tk=String(v.ticker||'').trim().toUpperCase(),p=num(v.price),q=num(v.qty)||0,tg=num(v.target)||0;
  if(!tk||!(p>0)||q<0||tg<0||tg>100){toast('Confira ticker, cotação e quantidade');return 'stop'}
  I.assets.push({id:uid(),ticker:tk,name:(v.name||'').trim(),cls:v.cls||'acoes',price:p,qty:q,cur:v.cur==='USD'?'USD':'BRL',target:tg,cost:p,div12:0,lpa:0,vpa:0,ceilRate:8,payMonths:[],goalId:''});
  invSyncLinkedGoals(F);toast('Ativo '+esc(tk)+' adicionado');return;
 }
 if(f.id==='finvbuy'){
  const I=invInit(F),a=I.assets.find(x=>x.id===f.dataset.id),q=num(v.qty),p=num(v.price);
  if(!a||!(q>0)||!(p>0)){toast('Informe quantidade e preço válidos');return 'stop'}
  const brl=r2(q*p*(a.cur==='USD'?invUsd(I):1));
  a.qty=+((+a.qty||0)+q).toFixed(4);a.price=p;
  if(+I.cfg.costTotal>0)I.cfg.costTotal=r2(+I.cfg.costTotal+brl);
  if(v.useCash)I.cfg.cash=r2((+I.cfg.cash||0)-Math.min(brl,Math.max(0,closingCashBalance(I))));
  if(v.ac)F.tx.unshift({id:uid(),k:'out',t:'Aporte '+a.ticker,v:brl,cat:'Outros',sub:'Investimentos',d:T,ac:v.ac});
  INV_BUY=null;invSyncLinkedGoals(F);toast('Aporte de '+BRL(brl)+' registrado em '+esc(a.ticker));return;
 }
 if(f.id==='finvdiv'){
  const I=invInit(F),ym=String(v.ym||'').trim(),x=r2(num(v.v));
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)||!(x>0)){toast('Informe mês e valor válidos');return 'stop'}
  const ex=I.divs.find(d=>d.ym===ym);if(ex)ex.v=x;else I.divs.push({id:uid(),ym,v:x});
  if(v.addCash)I.cfg.cash=r2((+I.cfg.cash||0)+x);
  if(v.addTx)F.tx.unshift({id:uid(),k:'in',t:'Proventos '+ym,v:x,cat:'Receita',sub:'Rendimentos',d:ym+'-25',ac:F.acc[0].id});
  toast('Proventos de '+ym+' salvos ('+BRL(x)+')');return;
 }
 if(f.id==='finvmile'){const I=invInit(F),t=(v.t||'').trim();if(!t)return 'stop';I.milestones.push({id:uid(),t,doneDate:'',rule:v.rule||''});toast('Marco adicionado');return}
 if(f.id==='finvsim'){
  const P=Math.max(0,num(v.initial)||0),PMT=Math.max(0,num(v.monthly)||0),rate=Math.max(0,Math.min(100,num(v.rate)||0)),years=Math.max(1,Math.min(60,parseInt(v.years,10)||10)),goal=Math.max(0,num(v.goal)||0);
  const rm=Math.pow(1+rate/100,1/12)-1,n=years*12;
  let fv=P,gh=0;for(let m=1;m<=n;m++){fv=fv*(1+rm)+PMT;if(goal>0&&!gh&&fv*rm>=goal)gh=Math.ceil(m/12)}
  const contributed=r2(P+PMT*n),interest=r2(fv-contributed);
  INV_SIM={initial:P,monthly:PMT,rate,years,goal,finalVal:r2(fv),contributed,interest,monthlyPassive:r2(fv*rm),goalPeriods:gh};
  return;
 }
}
