// Início: faixa de resumo, linha do tempo, Spotify, clima, frase do dia e tour do primeiro uso
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
 {t:'Bem-vindo ao seu hub',b:'Agenda, tarefas, notas, links, hábitos e finanças num lugar só. Tudo fica salvo na sua conta e aparece em todos os aparelhos em que você entrar.'},
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
