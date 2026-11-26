// importação de extratos (CSV/OFX) e categorização automática por dicionário/histórico
const CAT_FIRST=[
 ['mercado_livre','Compras'],['mercadolivre','Compras'],['meli_mais','Assinaturas'],['meli','Compras'],
 ['uber_eats','Alimentação'],['uber_one','Assinaturas'],['ifood_clube','Assinaturas'],['rappi_prime','Assinaturas'],
 ['amazon_prime','Assinaturas'],['apple_one','Assinaturas'],['apple_music','Assinaturas'],
 ['passagem_aerea','Férias'],['passagens_aereas','Férias'],['aluguel_carro','Férias'],['aluguel_de_carro','Férias'],['seguro_viagem','Férias'],
 ['plano_de_saude','Saúde']
];
const CATDIC={
 Alimentação:'mercado* supermerc* minimercado atacarejo padar* acougue* frigorif* peixaria hortifrut* feira emporio restaurante* lanch* pizz* hamburg* ifood ifd rappi almoco jantar cafe cafet* sorvet* churrasc* delivery pagamento_dia supermercado_dia mercado_dia oxxo carrefour assai atacadao pao_de_acucar extra sonda mambo hirota sacolao mcdonalds burger bk outback madero jeronimo starbucks subway habibs giraffas spoleto dominos pizza_hut popeyes kfc coco_bambu china_in_box doceria confeitaria bomboniere cacau_show kopenhagen chocolat* refeicao marmita* quentin* sushi temaki poke bistro ze_delivery cervej* chopp swift vr_refeicao alelo sodexo ticket_restaurante',
 Transporte:'uber 99 99pop taxi cabify indrive onibus metro* vlt cptm bilhete_unico gasolina combustiv* etanol posto* auto_posto ipiranga shell petrobras ale br_mania estacionam* estapar indigo zona_azul sem_parar veloe conectcar pedagio* passagem rodoviaria buser clickbus oficina mecanica borracharia lava_jato lavagem balsa ferry tembici itau_bike patinete',
 Moradia:'aluguel quintoandar quinto_andar imobiliaria condominio luz energia eletric* enel cpfl cemig copel celesc coelba celpe equatorial neoenergia light energisa eletropaulo agua saneamento sabesp copasa sanepar cedae embasa corsan cagece internet fibra banda_larga claro vivo tim oi sky telecom* algar brisanet desktop vero gas comgas naturgy ultragaz supergasbras liquigas iptu reforma leroy_merlin telhanorte sodimac cec dicico obramax material_construcao ferragem moveis tokstok tok_stok etna mobly madeiramadeira ortobom diarista faxina limpeza',
 Compras:'amazon mercadolivre mercado_livre shopee shein aliexpress temu magalu magazine_luiza casas_bahia pontofrio ponto_frio americanas submarino shoptime kabum pichau terabyte fast_shop fastshop apple_store samsung xiaomi motorola eletronic* baseus renner riachuelo cea c_a zara hering marisa pernambucanas youcom farm animale arezzo schutz centauro decathlon netshoes nike adidas puma vans mizuno asics havaianas shopping loja* store boutique roupa* calcado* sapato* tenis bolsa* mochila* relogio* oculos otica joalheria vivara pandora perfum* boticario o_boticario natura sephora eudora beleza_na_web epocacosmeticos presente* brinquedo* ri_happy pbkids lego comercio comercial importacao bazar utilidades daiso miniso le_biscuit camicado imaginarium',
 Saúde:'farmac* droga* drogasil droga_raia raia pague_menos panvel ultrafarma nissei araujo pacheco venancio onofre bifarma remedio medicamento manipulacao consulta medico clinica* dentist* odonto* exame laborat* fleury delboni lavoisier dasa sabin hermes_pardini hospital* pronto_socorro psicolog* psiquiatr* terapia fisioterapia nutricionista fonoaudiolog* oftalmolog* dermatolog* plano_de_saude unimed amil sulamerica hapvida notredame bradesco_saude porto_saude academia* smartfit smart_fit bluefit bodytech totalpass gympass wellhub crossfit pilates yoga',
 Lazer:'cinema cinemark cinepolis kinoplex uci show teatro ingresso* sympla eventim ticketmaster ingresse bar pub balada boate choperia karaoke boliche sinuca parque jogo* jogos livraria* saraiva leitura travessa cultura epic_games riot twitch clube',
 Férias:'viagem viagens hotel hoteis pousada resort hostel airbnb booking decolar hurb 123milhas maxmilhas trivago expedia cvc latam gol azul tap air_france lufthansa united american_airlines copa_airlines aeroporto infraero aerea passagem_aerea passagens_aereas milhas smiles livelo esfera turismo passeio excursao localiza movida unidas hertz rentcars aluguel_carro cruzeiro duty_free cambio wise nomad',
 Educação:'curso* escola* colegio* faculdad* universid* pos_graduacao mestrado mensalidade livro* apostila* udemy alura coursera duolingo rocketseat origamid ebac descomplica estrategia gran_cursos cultura_inglesa fisk wizard ccaa yazigi kumon kalunga papelaria*',
 Assinaturas:'netflix spotify prime amazon_prime disney hbo max globoplay paramount crunchyroll deezer tidal youtube assinatura assinat* icloud apple apple_one apple_music google_brasil_pagamentos google_play google_one ebanx pix_automatico anthropic claude openai chatgpt gemini perplexity github copilot cursor vercel netlify heroku aws digitalocean cloudflare canva figma notion adobe microsoft office dropbox onedrive steam playstation xbox nintendo patreon substack medium',
 Serviços:'salao barbearia cabeleireiro manicure pedicure estetica depilacao massagem spa lavanderia tinturaria correios sedex pac loggi jadlog cartorio despachante tabelionato contador contabilidade advogado advocacia consultoria seguro* porto_seguro azul_seguros tokio_marine mapfre suhai conserto manutencao assistencia_tecnica chaveiro grafica fotografia',
 Pets:'petshop pet_shop petz cobasi petlove veterinar* vet_* clinica_vet* racao banho_e_tosa tosa',
 'Impostos e taxas':'imposto* tributo* iof irpf darf gps inss fgts iss icms ipva detran tarifa* taxa* anuidade juros mora multa* encargo* cesta_servicos pacote_servicos manutencao_conta'
};
const catMatch=(d,w)=>w.endsWith('*')?d.includes(' '+w.slice(0,-1)):d.includes(' '+w.replace(/_/g,' ')+' ');
const reserveDeposit=t=>/\b(?:aplicacao|aporte|deposito) (?:na|para|em) (?:a )?reserva(?: (?:de emergencia|financeira|pessoal))?(?: \d+(?: \d+)*)?$/.test(norm(t).replace(/[^a-z0-9]+/g,' ').trim());
const dictCat=t=>{if(reserveDeposit(t))return 'Reserva';const raw=String(t||''),d=' '+norm(raw).replace(/[^a-z0-9]+/g,' ')+' ';for(const[k,c]of CAT_FIRST)if(catMatch(d,k))return c;for(const[c,w]of Object.entries(CATDIC))for(const k of w.split(' '))if(k&&catMatch(d,k))return c;if(/\bDIA\b/.test(raw)&&!d.includes(' bom dia '))return 'Alimentação';return 'Outros'};
function dictSub(t,k,cat){
 const d=' '+norm(t).replace(/[^a-z0-9]+/g,' ')+' ',has=(...ws)=>ws.some(w=>catMatch(d,w));
 if(k==='in'){
  if(has('rendimento*','cdb','poupan*','dividendo*','juros'))return 'Rendimentos';
  if(has('reembolso*','estorno*','devolucao*'))return 'Reembolso';
  if(has('dinheiro_retirado','resgate*'))return 'Resgate de reserva';
  if(has('pix_recebido'))return 'Pix recebido';
  if(has('transferencia_recebida','ted','doc'))return 'Transferência';
  if(has('salario*','remuneracao*'))return 'Salário';
  return '';
 }
 if(k!=='out')return '';
 if(cat==='Alimentação'){
  if(has('ifood','rappi','delivery','ifd','uber_eats','ze_delivery'))return 'Delivery';
  if(has('restaurante*','lanch*','pizz*','hamburg*','almoco','jantar','cafe','cafet*','sorvet*','churrasc*','burger','mcdonalds','bk','outback','madero','jeronimo','starbucks','subway','habibs','giraffas','spoleto','dominos','pizza_hut','popeyes','kfc','coco_bambu','china_in_box','doceria','confeitaria','refeicao','sushi','temaki','poke','bistro','bar','chopp'))return 'Restaurante';
  return 'Mercado';
 }
 if(cat==='Transporte'){
  if(has('uber','99','99pop','taxi','cabify','indrive'))return 'App';
  if(has('gasolina','combustiv*','etanol','posto*','auto_posto','ipiranga','shell','petrobras','ale','br_mania'))return 'Combustível';
  if(has('onibus','metro*','vlt','cptm','bilhete_unico','passagem','rodoviaria','buser','clickbus','balsa','ferry'))return 'Transporte público';
  if(has('estacionam*','estapar','indigo','zona_azul','pedagio*','sem_parar','veloe','conectcar'))return 'Pedágio e estacionamento';
  if(has('oficina','mecanica','borracharia','lava_jato','lavagem'))return 'Manutenção';
  return '';
 }
 if(cat==='Moradia'){
  if(has('claro','vivo','tim','oi','sky','telecom*','internet','fibra','banda_larga','algar','brisanet','desktop','vero'))return 'Internet e telefone';
  if(has('luz','energia','eletric*','enel','cpfl','cemig','copel','celesc','coelba','celpe','equatorial','neoenergia','light','energisa','eletropaulo','agua','saneamento','sabesp','copasa','sanepar','cedae','embasa','corsan','cagece','gas','comgas','naturgy','ultragaz','supergasbras','liquigas'))return 'Contas da casa';
  if(has('aluguel','quintoandar','quinto_andar','imobiliaria','condominio','iptu'))return 'Habitação';
  if(has('diarista','faxina','limpeza','reforma','leroy_merlin','telhanorte','sodimac','moveis','tokstok','tok_stok','etna','mobly','madeiramadeira'))return 'Casa e manutenção';
  return '';
 }
 if(cat==='Compras'){
  if(has('renner','riachuelo','cea','c_a','zara','hering','marisa','pernambucanas','youcom','farm','animale','arezzo','schutz','nike','adidas','puma','vans','roupa*','calcado*','sapato*','tenis'))return 'Vestuário';
  if(has('eletronic*','baseus','kabum','pichau','terabyte','apple_store','samsung','xiaomi','motorola','fast_shop','fastshop'))return 'Eletrônicos';
  if(has('amazon','mercadolivre','mercado_livre','meli','shopee','shein','aliexpress','temu','magalu','magazine_luiza','americanas','submarino','shoptime'))return 'Online';
  if(has('camicado','imaginarium','daiso','miniso','le_biscuit','presente*','brinquedo*','ri_happy','pbkids','lego'))return 'Casa e presentes';
  return 'Lojas';
 }
 if(cat==='Saúde'){
  if(has('farmac*','droga*','drogasil','droga_raia','raia','pague_menos','panvel','ultrafarma','nissei','araujo','pacheco','venancio','onofre','bifarma','remedio','medicamento','manipulacao'))return 'Farmácia';
  if(has('academia*','smartfit','smart_fit','bluefit','bodytech','totalpass','gympass','wellhub','crossfit','pilates','yoga'))return 'Academia';
  return 'Consultas e exames';
 }
 if(cat==='Lazer'){
  if(has('cinema','cinemark','cinepolis','kinoplex','uci','show','teatro','ingresso*','sympla','eventim','ticketmaster','ingresse'))return 'Cinema e eventos';
  if(has('bar','pub','balada','boate','choperia','karaoke'))return 'Bares e vida noturna';
  if(has('livraria*','saraiva','cultura','leitura','travessa','jogo*','jogos','epic_games','riot','twitch'))return 'Livros e jogos';
  return '';
 }
 if(cat==='Férias'){
  if(has('latam','gol','azul','tap','air_france','lufthansa','united','american_airlines','copa_airlines','passagem_aerea','passagens_aereas','aerea','aeroporto','infraero','smiles','milhas'))return 'Passagens';
  if(has('hotel','hoteis','pousada','resort','hostel','airbnb','booking','trivago','expedia'))return 'Hospedagem';
  if(has('decolar','hurb','cvc','turismo','passeio','excursao','localiza','movida','unidas','hertz','rentcars','aluguel_carro','aluguel_de_carro','cruzeiro'))return 'Pacotes e passeios';
  return '';
 }
 if(cat==='Assinaturas'){
  if(has('anthropic','claude','openai','chatgpt','gemini','perplexity','github','copilot','cursor','vercel','netlify','heroku','aws','digitalocean','cloudflare','canva','figma','notion','adobe','microsoft','office','icloud','google_one','dropbox','onedrive'))return 'IA e software';
  return 'Serviços digitais';
 }
 if(cat==='Serviços'){
  if(has('salao','barbearia','cabeleireiro','manicure','pedicure','estetica','depilacao','massagem','spa'))return 'Beleza e cuidados';
  if(has('seguro*','porto_seguro','azul_seguros','tokio_marine','mapfre','suhai'))return 'Seguros';
  if(has('correios','sedex','pac','loggi','jadlog'))return 'Correios e entregas';
  return '';
 }
 if(cat==='Pets'){
  if(has('veterinar*','vet_*','clinica_vet*'))return 'Veterinário';
  return 'Pet shop';
 }
 if(cat==='Impostos e taxas'){
  if(has('imposto*','tributo*','iof','irpf','darf','gps','inss','fgts','iss','icms','ipva'))return 'Impostos';
  return 'Tarifas e juros';
 }
 if(cat==='Outros'){
  if(has('reserva_por_gasto','reserva_programada'))return 'Reserva';
  if(has('pix_enviado','pagamento_com_pix'))return 'Pix';
 }
 return '';
}
function histCat(t,k,skipId){const nt=norm(t),nc=norm(cleanDesc(t));if(!nt)return null;const list=finInit().tx.filter(q=>q.id!==skipId&&q.k===k&&q.cat&&q.cat!=='Outros');const x=list.find(q=>norm(q.t)===nt)||(nc.length>=3?list.find(q=>norm(cleanDesc(q.t))===nc):null);return x?{cat:x.cat,sub:x.sub||'',tg:x.tg||'',pj:x.pj||''}:null}
const ruleCat=t=>(ruleOf({t,v:0,k:'out'})||{}).cat||dictCat(t);
function cleanDesc(s){const raw=String(s||'').trim(),c=raw.replace(/^(?:pagamento\s+com\s+(?:qr\s+)?pix|pagamento|pix\s+enviado|pix\s+recebido|pix\s+autom[aá]tico|transfer[eê]ncia\s+(?:pix\s+)?recebida|transfer[eê]ncia\s+(?:pix\s+)?enviada)\s+/i,'').trim();return c||raw}
/* importação de CSV */
function parseCSV(txt){
 const first=txt.split(/\r?\n/).find(l=>/[;,\t]/.test(l))||txt.split(/\r?\n/).find(l=>l.trim())||'',sc=(first.match(/;/g)||[]).length,cm=(first.match(/,/g)||[]).length,tb=(first.match(/\t/g)||[]).length;
 const del=sc>cm&&sc>=tb?';':tb>cm&&tb>=sc?'\t':',';
 const rows=[];let row=[],cur='',q=false;
 for(let i=0;i<txt.length;i++){const c=txt[i];
  if(q){if(c==='"'){if(txt[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
  else if(c==='"')q=true;else if(c===del){row.push(cur);cur=''}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(cur);if(row.some(x=>x.trim()))rows.push(row);row=[];cur=''}else cur+=c}
 row.push(cur);if(row.some(x=>x.trim()))rows.push(row);return rows}
function pnum(s){let t=String(s==null?'':s).replace(/[^\d,.\-+()]/g,'');if(!t)return NaN;const neg=/^\(.*\)$/.test(t)||t.startsWith('-');t=t.replace(/[()\-+]/g,'');const lc=t.lastIndexOf(','),ld=t.lastIndexOf('.');
 if(lc>-1&&ld>-1){t=lc>ld?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'')}else if(lc>-1)t=t.replace(',','.');else if((t.match(/\./g)||[]).length>1)t=t.replace(/\./g,'');
 const n=parseFloat(t);return neg?-n:n}
function pdate(s,df){const m=String(s||'').trim().match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})(?=$|\s|T)/);if(!m)return null;let y,mo,d;const a=+m[1],b=+m[2],c=+m[3];
 if(m[1].length===4){y=a;mo=b;d=c}else if(df==='mdy'){mo=a;d=b;y=c}else{d=a;mo=b;y=c}
 if(y<100)y+=2000;if(mo<1||mo>12||d<1||d>dimOf(y,mo-1))return null;return y+'-'+hm2(mo)+'-'+hm2(d)}
const ofxDec=s=>String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
function parseOFX(txt){
 const tag=(s,k)=>{const m=new RegExp('<'+k+'\\b[^>]*>([^<\\r\\n]+)','i').exec(s);return m?ofxDec(m[1]):''};
 const isCard=/<CREDITCARDMSGSRSV1|<CCSTMTRNRS|<CCSTMTRS/i.test(txt);
 const blks=String(txt||'').split(/<STMTTRN\b[^>]*>/i).slice(1).map(s=>s.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]);
 const items=[];
 blks.forEach(b=>{
  const dtRaw=tag(b,'DTPOSTED'),dm=dtRaw.match(/^(\d{4})(\d{2})(\d{2})/),amt=pnum(tag(b,'TRNAMT'));
  if(!dm||!Number.isFinite(amt)||amt===0)return;
  const dt=dm[1]+'-'+dm[2]+'-'+dm[3],nm=tag(b,'NAME'),mm=tag(b,'MEMO');
  const desc=(nm&&mm&&norm(nm)!==norm(mm)&&!norm(mm).includes(norm(nm)))?(norm(nm).includes(norm(mm))?nm:nm+' · '+mm):(mm||nm||tag(b,'TRNTYPE')||'Lançamento OFX');
  const fitid=tag(b,'FITID')||tag(b,'CHECKNUM');
  items.push({dt,desc,fitid,amt});
 });
 const balSec=String(txt||'').split(/<LEDGERBAL\b[^>]*>/i)[1]||'';
 const balAmt=pnum(tag(balSec,'BALAMT'));
 return{items,isCard,balAmt};
}
const isCardPayDesc=s=>/^(pagamento (?:de |da )?fatura|pagamento recebido|pagamento efetuado|credito(?: de)? pagamento|inclusao de pagamento|pagto\.?\s*(?:de\s*)?fatura)\b/.test(norm(s));
function prepOFX(txt,name){
 const {items,isCard,balAmt}=parseOFX(txt);
 if(!items.length){toast('Arquivo OFX sem lançamentos');return false}
 const F=finInit(),rows=[['RELEASE_DATE','TRANSACTION_TYPE','REFERENCE_ID','TRANSACTION_NET_AMOUNT'],...items.map(x=>[x.dt,x.desc,x.fitid,String(x.amt)])];
 const ac0=isCard?(S.fac&&F.acc.some(a=>a.id===S.fac&&a.ty==='card')?S.fac:(F.acc.find(a=>a.ty==='card')?.id||F.acc[0].id)):(S.fac&&F.acc.some(a=>a.id===S.fac&&a.ty!=='card')?S.fac:(F.acc.find(a=>a.ty!=='card')?.id||F.acc[0].id));
 const accObj=F.acc.find(a=>a.id===ac0),hasTx=F.tx.some(x=>accId(x)===ac0),cardMode=isCard||!!(accObj&&accObj.ty==='card');
 const nonPay=items.filter(x=>!isCardPayDesc(x.desc));
 const inv=cardMode&&nonPay.length>0&&nonPay.filter(x=>x.amt>0).length>nonPay.filter(x=>x.amt<0).length;
 let meta=null;
 if(!cardMode&&Number.isFinite(balAmt)){
  const cred=r2(items.filter(x=>x.amt>0).reduce((s,x)=>s+x.amt,0)),deb=r2(items.filter(x=>x.amt<0).reduce((s,x)=>s+x.amt,0)),fin=r2(balAmt),ini=r2(fin-(cred+deb));
  meta={ini,cred,deb,fin};
 }
 IMP={name:name||'extrato.ofx',rows,hdr:true,df:'dmy',inv,ac:ac0,isCard:cardMode,skipCardPay:cardMode,meta,setIni:!!(meta&&Number.isFinite(meta.ini)&&!hasTx&&!(accObj&&accObj.ini)),reconcile:false,genInst:true,clean:false,skipRes:false,trRes:false,saveRules:true,cats:{},include:[],map:{d:0,t:1,v:3,ref:2}};
 return true;
}
function prepCSV(txt,name){
 if(/<OFX\b|<STMTTRN\b/i.test(String(txt||'')))return prepOFX(txt,name);
 const all=parseCSV(String(txt||'').replace(/^\uFEFF/,''));
 if(all.length<2){toast('Arquivo vazio ou sem linhas de dados');return false}
 const firstData=all.findIndex(r=>r.some(c=>pdate(c,'dmy')||pdate(c,'mdy')));
 let rows=all,meta=null;
 if(firstData>1){
  const pre=all.slice(0,firstData-1);
  for(let i=0;i<pre.length-1;i++){
   const h0=pre[i].map(norm),v0=pre[i+1],idx=re=>h0.findIndex(x=>re.test(x)),ii=idx(/initial_balance|saldo_inicial|saldo inicial|saldo anterior/);
   if(ii>=0&&v0&&v0.length>=h0.length){
    const val=j=>j>=0?pnum(v0[j]):NaN,ini=val(ii),cred=val(idx(/credits|creditos|entradas/)),deb=val(idx(/debits|debitos|saidas/)),fin=val(idx(/final_balance|saldo_final|saldo final/));
    if(Number.isFinite(ini)){meta={ini,cred:Number.isFinite(cred)?cred:null,deb:Number.isFinite(deb)?deb:null,fin:Number.isFinite(fin)?fin:null};break}
   }
  }
  const prev=all[firstData-1];
  rows=(prev.length!==all[firstData].length&&prev.every(c=>Number.isFinite(pnum(c))))?all.slice(firstData):all.slice(firstData-1);
 }
 const hdr=!rows[0].some(c=>pdate(c,'dmy')||pdate(c,'mdy')),h=rows[0].map(norm),g=(re,d)=>{const j=h.findIndex(x=>re.test(x));return j>=0?j:d};
 const dCol=hdr?g(/release_date|data|date|\bdt\b|\bdia\b/,0):0,tCol=hdr?g(/transaction_type|descri|hist|estab|memo|lanc|detail|name|titulo|title|moviment|tipo/,1):1,vCol=hdr?g(/transaction_net_amount|net_amount|valor|amount|value|quantia|montante/,2):2,refCol=hdr?g(/reference_id|ref_id|identificador|id_transacao|transaction_id|codigo|nsu|autenticacao|\bdoc\b|documento/,-1):-1;
 const balCol=hdr?h.findIndex((x,j)=>j!==dCol&&j!==tCol&&j!==vCol&&j!==refCol&&/partial_balance|saldo_parcial|saldo_apos|saldo_atual|^saldo$|balance/.test(x)):-1;
 const sample=hdr?rows.slice(1,40):rows.slice(0,40),dmyOk=sample.filter(r=>pdate(r[dCol],'dmy')).length,mdyOk=sample.filter(r=>pdate(r[dCol],'mdy')).length,df=mdyOk>dmyOk?'mdy':'dmy';
 if((!meta||meta.fin==null)&&balCol>=0){
  let lastD='',lastB=NaN;
  (hdr?rows.slice(1):rows).forEach(r=>{const d=pdate(r[dCol],df),b=pnum(r[balCol]);if(d&&Number.isFinite(b)&&d>=lastD){lastD=d;lastB=b}});
  if(Number.isFinite(lastB))meta=Object.assign(meta||{ini:null,cred:null,deb:null,fin:null},{fin:r2(lastB)});
 }
 const F=finInit(),ac0=S.fac&&F.acc.some(a=>a.id===S.fac)?S.fac:F.acc[0].id,accObj=F.acc.find(a=>a.id===ac0),hasTx=F.tx.some(x=>accId(x)===ac0),isCardAcc=!!(accObj&&accObj.ty==='card');
 const nonPayVals=sample.filter(r=>!isCardPayDesc(r[tCol])).map(r=>pnum(r[vCol])).filter(Number.isFinite);
 const inv=isCardAcc&&nonPayVals.filter(v=>v>0).length>nonPayVals.filter(v=>v<0).length;
 IMP={name:name||'extrato.csv',rows,hdr,df,inv,ac:ac0,isCard:isCardAcc,skipCardPay:isCardAcc,meta,setIni:!!(meta&&Number.isFinite(meta.ini)&&!hasTx&&!(accObj&&accObj.ini)),reconcile:false,genInst:true,clean:false,skipRes:false,trRes:false,saveRules:true,cats:{},include:[],map:{d:dCol,t:tCol,v:vCol,ref:refCol}};
 return true;
}
function statementReview(r){
 const choice=IMP.review?.[r.index];
 const options=r.matches.map(tx=>`<option value="tx:${esc(tx.id)}" ${choice==='tx:'+tx.id?'selected':''}>Associar a ${esc(tx.t)}${tx.shopping?' (compra de lista)':tx.rc||tx.id.startsWith('r_')?' (conta recorrente)':''}</option>`).join('');
 if(!options&&!r.uncertain&&!choice)return '';
 return `<label class="lb">${options?'Mesmo valor, data e conta':'Categoria a conferir'}
 <select class="in" data-imp-review="${r.index}" aria-label="Conferência de ${esc(r.t)}">
 <option value="">${r.dup?'Usar decisão de duplicata':'Importar como novo'}</option>
 <option value="skip" ${choice==='skip'?'selected':''}>Ignorar linha</option>${options}</select></label>`;
}
function statementImports(row){
 return !IMP.review?.[row.index]&&(!row.dup||(IMP.include||[]).includes(row.index));
}
function impPanel(){
 if(!IMP)return `<p class="empty" style="padding:0 0 var(--space-2)">Importe o extrato do banco ou da fatura em CSV ou OFX. O hub reconhece cabeçalhos de resumo (como Mercado Pago), arquivos OFX e faturas de cartão, identifica colunas automaticamente e categoriza os lançamentos.</p><div class="bar"><label class="pill dark" style="cursor:pointer;display:inline-block">Escolher arquivo CSV ou OFX<input type="file" id="csvf" accept=".csv,.ofx,.txt,text/csv,application/x-ofx,text/plain" class="hide"></label></div><details style="margin-top:var(--space-2)"><summary class="pill" style="display:inline-block;cursor:pointer">Ou colar texto do extrato</summary><form id="fcsvpaste" style="margin-top:var(--space-2)"><label class="lb">Cole o conteúdo CSV ou OFX do extrato<textarea class="in ta" name="csv" rows="6" placeholder="INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE&#10;..." required></textarea></label><div class="bar"><button class="pill dark">Carregar extrato</button></div></form></details>`;
 const I=IMP,F=finInit(),{rows,bad,resTotal,cardPayTotal,instCount,instRem}=impRows(),hd=I.hdr?I.rows[0]:I.rows[0].map((_,i)=>'Coluna '+(i+1)),toImp=rows.filter(statementImports),n=toImp.length,dups=rows.filter(r=>r.dup||r.matches.length||r.uncertain||I.review?.[r.index]),first=rows.slice(0,8),preview=[...new Set([...first,...dups])],rest=rows.filter(r=>!preview.includes(r));
 const sel=(k,l,opt0)=>`<label class="lb" style="margin:0">${l}<select class="in" data-imp="${k}">${opt0?`<option value="-1" ${(I.map[k]==null||I.map[k]<0)?'selected':''}>${opt0}</option>`:''}${hd.map((h,i)=>`<option value="${i}" ${I.map[k]===i?'selected':''}>${esc(h||'Coluna '+(i+1))}</option>`).join('')}</select></label>`;
 const catSum={};toImp.forEach(r=>{const c=r.resTr?'Transferências':r.k==='in'?'Receitas':r.cat;(catSum[c]=catSum[c]||{n:0,v:0}).n++;catSum[c].v+=r.v});
 const catChips=Object.entries(catSum).sort((a,b)=>b[1].v-a[1].v).map(([c,x])=>`<span class="chip c-b">${esc(c)}: ${x.n} (${BRL(x.v)})</span>`).join('');
 const associations=rows.filter(r=>I.review?.[r.index]?.startsWith('tx:')).length;
 const rowHtml=r=>`<div class="item"><span class="chip c-b">${fmt(r.d)}</span><div class="t">${esc(r.t)}${r.pc?` <span class="chip c-y">${r.pc.i}/${r.pc.n}</span>`:''}<small>${r.resTr?'Transferência · '+(r.resDir==='out'?'Reserva':'Resgate de reserva'):r.k==='out'?esc(r.cat)+(r.sub?' › '+esc(r.sub):''):'Receita'+(r.rb?' › Reembolso (abate de '+esc(r.rcat||'Outros')+')':r.sub?' › '+esc(r.sub):'')}${r.dup?' · possível duplicata (linha '+r.index+')':''}</small>${statementReview(r)}${r.dup?`<label><input type="checkbox" data-imp-include="${r.index}" ${(I.include||[]).includes(r.index)?'checked':''}> Importar mesmo assim</label>`:''}</div>${!r.resTr&&r.k==='out'?`<select class="in" data-imp-cat="${esc(norm(r.rawT))}" aria-label="Categoria de ${esc(r.t)}" style="width:auto">${FC.map(c=>`<option value="${c}" ${r.cat===c?'selected':''}>${c}</option>`).join('')}</select>`:''}<strong class="${r.resTr?'':r.k==='in'?'pos':'neg'}">${r.resTr?(r.resDir==='out'?'→ ':'← '):r.k==='in'?'+':'−'} ${BRL(r.v)}</strong></div>`;
 const metaParts=I.meta?[Number.isFinite(I.meta.ini)?'saldo inicial <strong>'+BRL(I.meta.ini)+'</strong>':'',I.meta.cred!=null?'entradas <strong class="pos">'+BRL(I.meta.cred)+'</strong>':'',I.meta.deb!=null?'saídas <strong class="neg">'+BRL(I.meta.deb)+'</strong>':'',I.meta.fin!=null?'saldo final <strong>'+BRL(I.meta.fin)+'</strong>':''].filter(Boolean):[];
 const metaBox=metaParts.length?`<p class="empty" style="padding:0 0 var(--space-2)">Resumo do extrato: ${metaParts.join(' · ')}.</p>`:'';
 const accObj=F.acc.find(a=>a.id===I.ac);
 let projBal=0;
 if(accObj&&accObj.ty!=='card'){
  const exist=F.tx.filter(x=>x.d<=T).reduce((s,x)=>{const ac=accId(x),v=+x.v||0;if(x.k==='in'&&ac===I.ac)return s+v;if(x.k==='out'&&ac===I.ac)return s-v;if(x.k==='tr')return s+(x.to===I.ac?v:0)-(ac===I.ac?v:0);return s},0);
  const impDelta=toImp.filter(r=>r.d<=T).reduce((s,r)=>s+(r.resTr?(r.resDir==='out'?-r.v:r.v):r.k==='in'?r.v:-r.v),0);
  const iniBase=(I.setIni&&I.meta&&Number.isFinite(I.meta.ini))?I.meta.ini:(+accObj.ini||0);
  projBal=r2(iniBase+exist+impDelta);
 }
 const needRec=!!(accObj&&accObj.ty!=='card'&&I.meta&&Number.isFinite(I.meta.fin)&&Math.abs(projBal-I.meta.fin)>=.01);
 const hasCats=!!Object.keys(I.cats||{}).length,showCardOpt=!!(I.isCard||(accObj&&accObj.ty==='card')||cardPayTotal>0);
 return `<p style="margin:0 0 var(--space-2)"><strong>${esc(I.name)}</strong> <span class="empty" style="padding:0">(${I.rows.length-(I.hdr?1:0)} linhas)</span></p><p>Conta de destino: <strong>${esc(accObj?.n||'Escolha uma conta')}</strong>.</p>${metaBox}
 ${catChips?`<div class="bar" style="margin:0 0 var(--space-2)">${catChips}</div>`:''}
 ${preview.map(rowHtml).join('')||'<p class="empty">Nenhuma linha válida com estas colunas. Ajuste o mapeamento ou o formato da data.</p>'}
 ${rest.length?`<details data-imp-rest style="margin:var(--space-2) 0"><summary class="pill" style="display:inline-block;cursor:pointer">Ver os demais ${rest.length} lançamentos da prévia</summary><div style="margin-top:var(--space-2)">${rest.slice(0,200).map(rowHtml).join('')}${rest.length>200?`<p class="empty">Mostrando os primeiros 200 dos ${rest.length} lançamentos restantes.</p>`:''}</div></details>`:''}
 <details id="statement-options"><summary>Opções da importação</summary>
 <div class="bar" style="align-items:flex-end">${sel('d','Coluna da data')}${sel('t','Coluna da descrição')}${sel('v','Coluna do valor')}${sel('ref','Coluna do ID (opcional)','Nenhuma')}<label class="lb" style="margin:0">Conta de destino<select class="in" data-imp="ac">${accOpts(I.ac)}</select></label><label class="lb" style="margin:0">Formato da data<select class="in" data-imp="df"><option value="dmy" ${I.df==='dmy'?'selected':''}>dia/mês/ano</option><option value="mdy" ${I.df==='mdy'?'selected':''}>mês/dia/ano</option></select></label></div>
 <div class="bar"><label><input type="checkbox" data-imp="hdr" ${I.hdr?'checked':''}> A primeira linha é o cabeçalho</label><label><input type="checkbox" data-imp="inv" ${I.inv?'checked':''}> Valores positivos são despesas (fatura de cartão)</label><label><input type="checkbox" data-imp="clean" ${I.clean?'checked':''}> Limpar prefixos bancários (ex.: "Pagamento DIA" → "DIA")</label>${I.meta&&Number.isFinite(I.meta.ini)?`<label><input type="checkbox" data-imp="setIni" ${I.setIni?'checked':''}> Definir saldo inicial da conta como ${BRL(I.meta.ini)}</label>`:''}${needRec?`<label><input type="checkbox" data-imp="reconcile" ${I.reconcile?'checked':''}> Ajustar saldo inicial automaticamente para bater com o saldo final do extrato (${BRL(I.meta.fin)})</label>`:''}${resTotal?`<label><input type="checkbox" data-imp="skipRes" ${I.skipRes?'checked':''}> Ignorar movimentações de reserva/cofrinho (${resTotal})</label><label><input type="checkbox" data-imp="trRes" ${I.trRes?'checked':''}> Converter reservas/cofrinho em transferência para conta Reserva (${resTotal})</label>`:''}${showCardOpt?`<label><input type="checkbox" data-imp="skipCardPay" ${I.skipCardPay?'checked':''}> Ignorar pagamentos da fatura anterior${cardPayTotal?' ('+cardPayTotal+')':''}</label>`:''}${instCount?`<label><input type="checkbox" data-imp="genInst" ${I.genInst!==false?'checked':''}> Gerar parcelas futuras restantes (${instCount} ${instCount===1?'compra':'compras'}, +${instRem} ${instRem===1?'parcela':'parcelas'})</label>`:''}${hasCats?`<label><input type="checkbox" data-imp="saveRules" ${I.saveRules!==false?'checked':''}> Criar regras para categorias ajustadas</label>`:''}</div>
 </details>
 <p class="empty" style="padding:var(--space-1) 0">${n} a importar${rows.length-n-associations?', '+(rows.length-n-associations)+' a ignorar':''}${bad.length?', linhas inválidas ignoradas: '+bad.join(', '):''}.</p>
 <div class="bar"><button class="pill dark" data-a="impgo" ${n||associations?'':'disabled'}>${associations?'Confirmar '+n+' novos e '+associations+' associações':'Importar '+n+' lançamentos'}</button><button class="pill" data-a="impcancel">Cancelar</button></div>`}
function impRows(){
 const I=IMP,F=finInit(),m=I.map,parsed=[],bad=[],out=[],seen=new Set(),accIsCard=!!((F.acc.find(a=>a.id===I.ac)||{}).ty==='card'),cardMode=!!(I.isCard||accIsCard);
 let resTotal=0,cardPayTotal=0,instCount=0,instRem=0;
 I.rows.forEach((r,i)=>{
  if(I.hdr&&i===0)return;
  const index=i+1,d=pdate(r[m.d],I.df),rawT=String(r[m.t]||'').trim(),n=pnum(r[m.v]),ref=(m.ref!=null&&m.ref>=0)?String(r[m.ref]||'').trim():'';
  if(!d||!rawT||!Number.isFinite(n)||n===0){bad.push(index);return}
  const isRes=/^(reserva por gasto|reserva programada|dinheiro reservado|dinheiro retirado)\b/.test(norm(rawT));
  if(isRes)resTotal++;
  if(I.skipRes&&isRes)return;
  const isCardPay=isCardPayDesc(rawT);
  if(isCardPay)cardPayTotal++;
  if(cardMode&&I.skipCardPay&&isCardPay)return;
  const t=I.clean?cleanDesc(rawT):rawT;
  const exp=I.inv?n>0:n<0,v=Math.abs(n),k=exp?'out':'in';
  const resTr=!!(isRes&&I.trRes),resDir=exp?'out':'in';
  const pc=(!resTr&&k==='out')?parseInstDesc(rawT):null;
  if(pc&&pc.rem>0){instCount++;instRem+=pc.rem}
  const ov=(!resTr&&k==='out')?(I.cats||{})[norm(rawT)]:'';
  const R=resTr?null:(ruleOf({t,v,k,ac:I.ac})||(t!==rawT?ruleOf({t:rawT,v,k,ac:I.ac}):null));
  const H=(!resTr&&!R&&!ov)?(histCat(t,k)||histCat(rawT,k)):null;
  const cat=resTr?'Transferência':k==='out'?(ov||(R&&R.cat)||(H&&H.cat)||dictCat(rawT)):'Receita';
  const sub=resTr?(resDir==='out'?'Reserva':'Resgate de reserva'):((!ov||!R||R.cat===ov?(R&&R.sub):'')||(H&&H.sub)||dictSub(rawT,k,cat)||'');
  parsed.push({index,d,t,rawT,k,v,cat,uncertain:!resTr&&k==='out'&&!ov&&!R&&!H&&cat==='Outros',sub,tg:(R&&R.tg)||(H&&H.tg)||'',pj:(R&&R.pj)||(H&&H.pj)||'',ref,resTr,resDir,pc});
 });
 const outPool=[...parsed.filter(x=>x.k==='out'&&!x.resTr).map(x=>({t:x.rawT,v:x.v,cat:x.cat,ref:x.ref})),...F.tx.filter(x=>x.k==='out').map(x=>({t:x.t,v:x.v,cat:x.cat,ref:x.ref||''}))];
 parsed.forEach(item=>{
  let rb=0,rcat='';
  if(!item.resTr&&item.k==='in'&&(item.sub==='Reembolso'||/^(reembolso|estorno|devolucao)\b/.test(norm(item.rawT)))){
   rb=1;
   const byRef=item.ref?outPool.find(x=>x.ref&&x.ref===item.ref):null;
   if(byRef)rcat=byRef.cat;
   else{
    const merch=item.rawT.replace(/^(?:reembolso(?:\s+de\s+pagamento)?|estorno(?:\s+de\s+pagamento)?|devolucao(?:\s+de\s+pagamento)?)\s*/i,'').trim();
    const nm=norm(cleanDesc(merch));
    let byMerch=nm?outPool.find(x=>(norm(cleanDesc(x.t))===nm||(nm.length>=3&&norm(x.t).includes(nm)))&&Math.abs(x.v-item.v)<.005):null;
    if(!byMerch&&nm)byMerch=outPool.find(x=>norm(cleanDesc(x.t))===nm||(nm.length>=3&&norm(x.t).includes(nm)));
    const dc=merch?ruleCat(merch):'Outros';
    rcat=(byMerch&&byMerch.cat)||(dc!=='Outros'?dc:'Outros');
   }
  }
  const key=JSON.stringify(item.ref?[item.k,item.d,item.v,norm(item.rawT),item.ref]:[item.k,item.d,item.v,norm(item.t)]);
  const statementKey=JSON.stringify([I.ac,item.k,item.ref||key]);
  const matches=item.resTr?[]:F.tx.filter(x=>x.id&&!x.statementKey&&!x.imp&&x.k===item.k&&x.d===item.d&&Math.abs(x.v-item.v)<.005&&accId(x)===I.ac&&(!item.ref||!x.ref||x.ref===item.ref));
  const dup=seen.has(key)||F.tx.some(x=>x.statementKey===statementKey)||F.tx.some(x=>((x.k===item.k)||(item.resTr&&x.k==='tr'))&&x.d===item.d&&Math.abs(x.v-item.v)<.005&&(accId(x)===I.ac||(item.resTr&&x.k==='tr'&&x.to===I.ac))&&(item.ref&&x.ref?x.ref===item.ref:(norm(x.t)===norm(item.t)||norm(x.t)===norm(item.rawT))));
  seen.add(key);
  out.push({...item,rb,rcat,dup,matches,statementKey});
 });
 return{rows:out,bad,resTotal,cardPayTotal,instCount,instRem};
}
