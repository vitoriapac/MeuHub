// núcleo: estado S, utilidades, telas base (tarefas, agenda, notas, hábitos, temas), atalhos e arrastar
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ds=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const uid=()=>Math.random().toString(36).slice(2,9);
const COL=['p','b','y','g'];
let today=new Date(),T=ds(today);
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
let S={view:'dash',wk:0,mo:0,dy:0,nf:'',ng:'',lc:'',goal:3,focus:'',hw:8,rw:0,rev:{},cards:null,cust:false,pal:'ceu',nav:'suave',dens:'conf',acc:'',habits:[],fm:{},pf:'',fk:null,fin:{tx:[],bud:{},goals:[],bills:[]},fmo:0,dia:{},ddo:0,tgsel:'',metas:[],revm:{},mro:0,fac:'',fcat:'',fn:6,fpj:{},fpm:'m',flm:'res',fday:'',fwm:'res',fvw:'mes',fyr:0,ftab:'geral',menu:null,mcol:['sis'],trash:[],rem:{},rot:{},cap:8,lnk:[],reads:[],rk:'',rs:'',dvw:'dia',dyr:0,keys:true,hc:false,rmo:'auto',mode:'week',filter:'all',events:[],notes:[],tasks:[],links:[],seeded:false};
try{Object.assign(S,JSON.parse(localStorage.getItem('hub-v1')||'{}'))}catch(e){}
if(!S.seeded){S.seeded=true;S.onb=true}
const save=()=>{try{localStorage.setItem('hub-v1',JSON.stringify(S))}catch(e){}track();syncSoon()};
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const DIA=['dom','seg','ter','qua','qui','sex','sáb'];
const fmt=s=>{const [y,m,d]=s.split('-');return d+' '+MES[+m-1]};
const evSort=(a,b)=>(a.d+a.h).localeCompare(b.d+b.h);

function dash0(){
 const tk=S.tasks,dn=tk.filter(t=>t.done).length,hj0=doneOn(T),pc=Math.min(100,Math.round(hj0/S.goal*100));
 const R=90,C=2*Math.PI*R;
 const hoje=evOn(T);
 const prox=upcoming(4);
 const pend=tk.filter(t=>!t.done).sort((a,b)=>grp(a)-grp(b)).slice(0,5);
 return `${heroCard()}
 <div class="grid">
  <div class="stack">
   <div class="ring"><svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="${R}" fill="none" stroke="var(--yellow)" stroke-width="30"/>${pc>0?`<circle cx="110" cy="110" r="${R}" fill="none" stroke="var(--pink)" stroke-width="30" stroke-linecap="round" stroke-dasharray="${C*pc/100} ${C}"/>`:''}</svg><div>${pc}%<small>da meta de hoje (${hj0}/${S.goal})</small></div></div>
   <div class="stat c-p"><span>Concluídas hoje</span><strong>${hj0}</strong></div>
   <div class="stat c-b"><span>Tarefas pendentes</span><strong>${tk.length-dn}</strong></div>
   <div class="stat c-y"><span>Eventos hoje</span><strong>${hoje.length}</strong></div>
  </div>
  <div class="stack">
   ${prodPanel()}<div class="panel" data-card="agenda"><h2>Próximos eventos</h2>${prox.map(e=>`<div class="item"><span class="stat c-${e.c}" style="padding:0;width:12px;height:36px;border-radius:6px"></span><div class="t">${esc(e.t)}<small>${fmt(e.d)} às ${tr(e)}${e.cf?' ⚠':''}</small></div></div>`).join('')||emp('ev','Nenhum evento por aqui.','Novo evento','data-a="qat" data-id="ev"')}</div>
   <div class="two">
    <div class="panel" data-card="todo"><h2>Para fazer</h2>${pend.map(t=>`<div class="item"><input type="checkbox" class="chk" data-a="tog" data-id="${t.id}" aria-label="Concluir"><div class="t">${esc(t.t)}</div></div>`).join('')||emp('tk','Tudo em dia!','Nova tarefa','data-a="qat" data-id="tk"')}</div>
    <div class="panel" data-card="links"><h2>Links rápidos</h2>${S.links.length?`<div class="lqg">${[...S.links].sort((a,b)=>!!b.pin-!!a.pin).slice(0,6).map(l=>`<a class="lq" href="${esc(safeUrl(l.u))}" target="_blank" rel="noopener" title="${esc(l.n)}"><span class="ico" style="background:hsl(${hue(l.u)} 55% 36%)" aria-hidden="true">${esc(ini(l.n))}</span><span>${esc(l.n)}</span></a>`).join('')}</div>`:emp('lk','Salve os links que você mais usa.','Adicionar link','data-v="links"')}</div>
   </div>
   <div class="panel" data-card="notas"><h2>Notas recentes</h2><div class="ntg">${[...S.notes].sort((a,b)=>!!b.pin-!!a.pin).slice(0,3).map((n,i)=>`<button class="ntile c-${n.c}${i===0?' big':''}" data-v="notas"><strong>${n.pin?'📌 ':''}${esc(n.t||'Sem título')}</strong><span>${esc(plain(n.b).slice(0,i===0?170:90))}</span></button>`).join('')||emp('nt','Nenhuma nota ainda.','Criar nota','data-a="qat" data-id="nt"')}</div></div>
  </div>
 </div>`;
}

function agenda(){
 const hd=agHead();if(S.mode==='month')return hd+month();
 if(S.mode==='day')return hd+dayView();
 const dow=(today.getDay()+6)%7,start=add(today,-dow+S.wk*7);
 let cols='';
 for(let i=0;i<7;i++){
  const d=add(start,i),k=ds(d);
  const evs=withNow(evOn(k),k);
  cols+=`<div class="day ${k===T?'today':''}" data-day="${k}"><h3>${DIA[d.getDay()]}<small>${d.getDate()} ${MES[d.getMonth()]}</small>${dayLoad(k).tot>capM()?'<small>⚠ cheio</small>':''}</h3>${blocksOn(k).map(b=>`<div class="ev blk" draggable="true" data-dbk="${b.id}"><strong>${esc(b.t)}</strong><small>${b.h}–${b.e}</small><button class="x" data-a="unbk" data-id="${b.id}" aria-label="Tirar da agenda">×</button></div>`).join('')}${evs.map(e=>e.now?`<div class="now">${e.h}</div>`:`<div class="ev c-${e.c}${e.cf?' cf':''}" draggable="true" data-de="${e.id}" data-lid="ev:${e.id}"><strong>${esc(e.t)}</strong><small>${tr(e)}</small>${lkBtn('ev',e.id,'l')}<button class="x e" data-a="ed" data-t="ev" data-id="${e.id}" aria-label="Editar evento">✎</button><button class="x" data-a="delev" data-id="${e.id}" aria-label="Excluir evento">×</button></div>`).join('')}</div>`;
 }
 return hd+`
 
 <div class="week">${cols}</div>`;
}

function notas(){
 return `<div class="top"><h1>Suas notas</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill dark" data-a="addnote">Nova nota</button>${TPL.map(t=>`<button class="pill" data-a="tpl" data-id="${t.k}">${t.n}</button>`).join('')}</div></div>
 ${nBar()}<div class="notes">${nList().slice(0,pgN('nt',30)).map(n=>`<div class="note c-${n.c}" data-lid="nt:${n.id}"><input data-n="${n.id}" data-f="t" value="${esc(n.t)}" placeholder="Título" aria-label="Título">${tbar()}<div class="rt" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Texto" data-ph="Escreva sua nota…" data-n="${n.id}" data-f="b">${rich(n.b)}</div>${meta(n)}<footer>${lkBtn('nt',n.id)}<button class="x" data-a="color" data-id="${n.id}" aria-label="Trocar cor">◐ cor</button><button class="x" data-a="pin" data-t="notes" data-id="${n.id}" aria-label="Fixar nota">${n.pin?'Fixada':'Fixar'}</button><button class="x" data-a="delnote" data-id="${n.id}" aria-label="Excluir nota">Excluir</button></footer></div>`).join('')||emp('nt','Nenhuma nota aqui. Comece em branco ou com um modelo.','Nova nota','data-a="addnote"')}</div>${pgMore('nt',nList().length,30)}`;
}

function tarefas(){
 const L=S.tasks.filter(t=>(S.filter==='all'||(S.filter==='done')===t.done)&&(!S.pf||t.pj===S.pf)).sort((a,b)=>grp(a)-grp(b));
 const F=[['all','Todas'],['open','Pendentes'],['done','Concluídas']];
 return `<div class="top"><h1>Suas tarefas</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill" data-a="sorttk">Ordenar por prazo</button>${F.map(f=>`<button class="pill ${S.filter===f[0]?'on':''}" data-a="filter" data-id="${f[0]}">${f[1]}</button>`).join('')}</div></div>
 ${tkForm()}${pjBar()}
 <div class="panel hero">${L.slice(0,pgN('tk',60)).map((t,i)=>gh(L,i)+`<div class="item ${t.done?'done':''}${(t.sub||[]).length?' hs':''}" draggable="true" data-dt="${t.id}" data-lid="tk:${t.id}"><input type="checkbox" class="chk" data-a="tog" data-id="${t.id}" ${t.done?'checked':''} aria-label="Concluir"><div class="t">${esc(t.t)}<small>${tkMeta(t)}</small>${subs(t)}</div>${t.done?'':`<button class="x" data-a="plan" data-id="${t.id}" aria-label="${t.hd===T?'Tirar do dia de hoje':'Planejar para hoje'}" title="${t.hd===T?'Tirar do dia de hoje':'Planejar para hoje'}">${ic(t.hd===T?'starfill':'star')}</button>`}${lkOf('tk:'+t.id).filter(r=>lkItem(r)).length?lkBtn('tk',t.id):''}<details class="mnu"><summary class="x" aria-label="Mais ações: ${esc(t.t)}" title="Mais ações">${ic('dots')}</summary><div class="mm">${t.done?'':`<button class="mi" data-a="snooze" data-id="${t.id}">${ic('skip')}Adiar para amanhã</button>`}<button class="mi" data-a="focus" data-id="${t.id}">${ic('play')}Iniciar foco (25 min)</button><button class="mi" data-a="tmv" data-id="${t.id}" data-n="-1">${ic('up')}Mover para cima</button><button class="mi" data-a="tmv" data-id="${t.id}" data-n="1">${ic('down')}Mover para baixo</button>${lkOf('tk:'+t.id).filter(r=>lkItem(r)).length?'':`<button class="mi" data-a="lkopen" data-id="tk:${t.id}">${ic('link')}Ligar a outro item</button>`}<button class="mi" data-a="ed" data-t="tk" data-id="${t.id}">${ic('edit')}Editar</button><button class="mi dng" data-a="deltk" data-id="${t.id}">Excluir tarefa</button></div></details></div>`).join('')||emp('tk','Nenhuma tarefa por aqui.','Adicionar tarefa','data-a="focusform" data-id="#ftk"')}${pgMore('tk',L.length,60)}
 ${S.tasks.some(t=>t.done)?'<button class="pill" data-a="clear">Limpar concluídas</button>':''}</div>`;
}

function links(){
 return `<div class="top"><h1>Seus links</h1></div>
 ${lkForm()}
 ${lkBar()}<div class="links">${S.links.filter(l=>!S.lc||(l.cat||'Outros')===S.lc).sort((a,b)=>!!b.pin-!!a.pin).map(l=>`<a class="link c-${l.c}" data-lid="lk:${l.id}" href="${esc(safeUrl(l.u))}" target="_blank" rel="noopener"><span class="ico" style="background:hsl(${hue(l.u)} 55% 36%)">${esc(ini(l.n))}</span><strong>${esc(l.n)}</strong>${l.k?`<kbd>${l.k}</kbd>`:''}<span class="chip" style="background:rgba(0,0,0,.12)">${esc(l.cat||'Outros')}</span>${tagsU(l).map(t=>`<span class="chip tgc" data-a="tagv" data-id="${esc(t)}">#${esc(t)}</span>`).join('')}<small>${esc(l.u.replace(/^https?:\/\//,''))}</small>${lkBtn('lk',l.id,'l')}<button class="x e p" data-a="pin" data-t="links" data-id="${l.id}" aria-label="Fixar link">${l.pin?'★':'☆'}</button><button class="x e" data-a="ed" data-t="lk" data-id="${l.id}" aria-label="Editar link">✎</button><button class="x" data-a="dellk" data-id="${l.id}" aria-label="Excluir link">×</button></a>`).join('')||emp('lk','Nenhum link salvo ainda.','Adicionar link','data-a="focusform" data-id="#flk"')}</div>`;
}

const IN_CLAUDE=typeof claude!=='undefined'&&!!claude.use;
let Q='',ED=null,DL=null;
try{claude.use('downloads').then(d=>{DL=d}).catch(()=>{})}catch(e){}
const PR={a:['Alta','p'],m:['Média','y'],b:['Baixa','g']};
const cur=(t,k)=>ED&&ED.t===t?S[k].find(x=>x.id===ED.id):null;
const cancelBtn=e=>e?'<button type="button" class="pill" data-a="cancel">Cancelar</button>':'';
const tsort=(a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||'amb'.indexOf(a.p||'m')-'amb'.indexOf(b.p||'m');
const tkMeta=t=>{const p=PR[t.p||'m'],late=t.due&&!t.done&&t.due<T;return `<span class="chip c-${p[1]}">${p[0]}</span>${t.pj?`<span class="chip c-b">${esc(t.pj)}</span>`:''}${t.dur?`<span class="chip c-g">${fdur(t.dur)}</span>`:''}${t.bk?`<span class="chip c-y">${fmt(t.bk.d)} ${t.bk.h}</span>`:''}${(t.sub||[]).length?`<span class="chip c-g">${t.sub.filter(s=>s.done).length}/${t.sub.length}</span>`:''}${t.rc?'<span class="chip c-p">repete</span>':''}${t.pm?`<span class="chip c-y">${t.pm}× foco</span>`:''}${tagChips(t)}${t.mt&&S.metas.some(g=>g.id===t.mt)?`<span class="chip c-p">meta: ${esc(S.metas.find(g=>g.id===t.mt).t)}</span>`:''}${t.due?`<span class="${late?'late':''}">${late?'Atrasada, ':''}prazo ${fmt(t.due)}</span>`:''}`};
function tkForm(){const e=cur('tk','tasks');return `<form class="bar" id="ftk"><input class="in grow" name="t" placeholder="O que precisa ser feito?" value="${e?esc(e.t):''}" required><select class="in" name="p" aria-label="Prioridade">${Object.entries(PR).map(([k,v])=>`<option value="${k}" ${(e?e.p||'m':'m')===k?'selected':''}>Prioridade ${v[0].toLowerCase()}</option>`).join('')}</select><input class="in" type="date" name="due" value="${e&&e.due||''}" aria-label="Prazo"><select class="in" name="dur" aria-label="Duração estimada"><option value="">Duração</option>${[15,30,45,60,90,120,180].map(m=>`<option value="${m}" ${e&&e.dur===m?'selected':''}>${fdur(m)}</option>`).join('')}</select><input class="in" name="tg" list="alltags" placeholder="Etiquetas" value="${e?esc(e.tg||''):''}" aria-label="Etiquetas"><input class="in" name="pj" list="pjs" placeholder="Projeto" value="${e?esc(e.pj||''):''}" aria-label="Projeto"><select class="in" name="rc" aria-label="Repetição">${[['','Não repete'],['d','Todo dia'],['w','Toda semana'],['m','Todo mês']].map(x=>`<option value="${x[0]}" ${e&&(e.rc||'')===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select><button class="pill dark">${e?'Salvar alterações':'Adicionar tarefa'}</button>${cancelBtn(e)}</form>`}
function lkForm(){const e=cur('lk','links');return `<form class="bar" id="flk"><input class="in grow" name="n" placeholder="Nome" value="${e?esc(e.n):''}" required><input class="in grow" name="u" placeholder="https://…" value="${e?esc(e.u):''}" required><input class="in" name="tg" list="alltags" placeholder="Etiquetas" value="${e?esc(e.tg||''):''}" aria-label="Etiquetas"><select class="in" name="cat" aria-label="Categoria">${CATS.map(c=>`<option ${e&&e.cat===c?'selected':''}>${c}</option>`).join('')}</select><select class="in" name="k" aria-label="Atalho">${['','1','2','3','4','5','6','7','8','9'].map(k=>`<option value="${k}" ${e&&e.k===k?'selected':''}>${k?'Atalho '+k:'Sem atalho'}</option>`).join('')}</select><button class="pill dark">${e?'Salvar alterações':'Salvar link'}</button>${cancelBtn(e)}</form>`}
function agHead(){
 const e=cur('ev','events'),m=S.mode==='month',f=new Date(today.getFullYear(),today.getMonth()+S.mo,1);
 const mb=(k,l)=>`<button class="pill ${S.mode===k?'on':''}" data-a="mode" data-id="${k}">${l}</button>`;
 return `<div class="top"><h1>${agTitle(f)}</h1><div style="display:flex;gap:8px;flex-wrap:wrap">${mb('day','Dia')}${mb('week','Semana')}${mb('month','Mês')}<button class="pill" data-a="nav" data-n="-1">‹ Anterior</button><button class="pill" data-a="nav" data-n="0">Hoje</button><button class="pill" data-a="nav" data-n="1">Próxima ›</button></div></div>
 <form class="bar ${e?'advo':''}" id="fev"><input class="in grow" name="t" placeholder="Novo evento" value="${e?esc(e.t):''}" required><input class="in" type="date" name="d" value="${e?e.d:S.mode==='day'?ds(add(today,S.dy)):T}" required><input class="in" type="time" name="h" value="${e?e.h:'09:00'}" required><span class="adv"><input class="in" name="tg" list="alltags" placeholder="Etiquetas" value="${e?esc(e.tg||''):''}" aria-label="Etiquetas"><span style="align-self:center;color:var(--mute)">até</span><input class="in" type="time" name="h2" value="${e&&e.e||''}" aria-label="Horário de término" title="Horário de término (opcional)"><select class="in" name="c">${[['y','Amarelo'],['b','Azul'],['p','Rosa'],['g','Verde']].map(c=>`<option value="${c[0]}" ${(e?e.c:COL[S.events.length%4])===c[0]?'selected':''}>${c[1]}</option>`).join('')}</select><select class="in" name="r" aria-label="Repetição">${RP.map(x=>`<option value="${x[0]}" ${e&&(e.r||'')===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select><select class="in" name="rm" aria-label="Lembrete">${RM.map(x=>`<option value="${x[0]}" ${e&&String(e.rm||'')===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></span><button type="button" class="pill" data-a="adv">${e?'Menos opções':'Mais opções'}</button><button class="pill dark">${e?'Salvar alterações':'Adicionar evento'}</button>${cancelBtn(e)}</form>`;
}
function month(){
 const f=new Date(today.getFullYear(),today.getMonth()+S.mo,1),m=f.getMonth(),s=add(f,-((f.getDay()+6)%7));
 let h=['seg','ter','qua','qui','sex','sáb','dom'].map(x=>`<div class="mh">${x}</div>`).join(''),c='';
 for(let i=0;i<42;i++){const d=add(s,i),k=ds(d);if(i===35&&d.getMonth()!==m)break;
  const ev=evOn(k);
  c+=`<button class="cell ${d.getMonth()!==m?'out':''} ${k===T?'today':''}" data-a="pick" data-id="${k}" data-day="${k}"><b>${d.getDate()}</b>${ev.slice(0,3).map(e=>`<span class="mev c-${e.c}">${e.h} ${esc(e.t)}</span>`).join('')}${ev.length>3?`<small>+${ev.length-3} mais</small>`:''}</button>`}
 return `<div class="month">${h}${c}</div>`;
}
function backup(){
 return `<div class="top"><h1>Backup</h1></div><div class="panel"><p style="margin-top:0" id="bklast">${S.lastBk?'Último backup: '+fmt(S.lastBk)+' ('+(daysSince(S.lastBk)||'hoje')+(daysSince(S.lastBk)?' dias atrás':'')+'). ':'Nenhum backup baixado ainda. '}Baixe uma cópia para guardar ou restaurar em outro aparelho. A sincronização automática está logo abaixo.</p><div class="bar"><button class="pill dark" data-a="bkexp">Baixar backup</button><label class="pill" style="cursor:pointer">Restaurar de arquivo<input type="file" id="bkfile" accept=".json,application/json" class="hide"></label><label class="pill" style="cursor:pointer" title="Junta os dados do arquivo com os deste aparelho, sem apagar nada">Importar mesclando<input type="file" id="bkmerge" accept=".json,application/json" class="hide"></label></div><p id="bkmsg" class="empty" role="status"></p></div>${snapPanel()}${syncPanel()}`;
}
function siteSave(name,data,type){const b=new Blob([data],{type:type||'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}
const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return T+'-'+p(d.getHours())+p(d.getMinutes())};
async function exportBk(){
 const m=$('#bkmsg'),{view,wk,mo,dy,mode,filter,nf,ng,lc,...data}=S,json=JSON.stringify({app:'meu-hub',v:1,data},null,1);
 if(!DL&&!IN_CLAUDE){siteSave('meu-hub-backup-'+stamp()+'.json',json);S.lastBk=T;save();m.textContent='Backup baixado. Guarde o arquivo no Google Drive ou em outro lugar seguro.';return}
 if(!DL){m.textContent='O download não está disponível aqui. Copie o texto abaixo e guarde em um arquivo .json:';const ta=document.createElement('textarea');ta.className='in bk';ta.readOnly=true;ta.value=json;m.after(ta);ta.select();return}
 try{await DL.save({filename:'meu-hub-backup-'+stamp()+'.json',data:json});S.lastBk=T;save();m.textContent='Backup pronto. Confirme o salvamento na janela que abriu.'}catch(e){m.textContent=e&&e.code==='declined'?'Download cancelado.':'Não foi possível baixar o backup.'}
}
const CATS=['Trabalho','Estudo','Ferramentas','Outros'];
const nowH=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
const withNow=(a,k)=>{if(k!==T)return a;const n=nowH(),i=a.findIndex(e=>e.h>n),m={now:true,h:n};return i<0?[...a,m]:[...a.slice(0,i),m,...a.slice(i)]};
const agTitle=f=>{if(S.mode==='month')return 'Agenda de '+MES[f.getMonth()]+' '+f.getFullYear();if(S.mode==='day'){const d=add(today,S.dy);return 'Agenda de '+DIA[d.getDay()]+', '+d.getDate()+' '+MES[d.getMonth()]}return 'Sua agenda'};
function dayViewOld(){
 const d=add(today,S.dy),k=ds(d),L0=S.events.filter(e=>e.d===k).sort(evSort),now=new Date(),nh=k===T?now.getHours():12,hs=L0.map(e=>+e.h.slice(0,2)),a=Math.min(6,nh,...hs),z=Math.max(22,nh,...hs);
 let r='';
 for(let h=a;h<=z;h++){const L=L0.filter(e=>+e.h.slice(0,2)===h);
  r+=`<div class="hr" data-day="${k}" data-hr="${String(h).padStart(2,'0')}"><span>${String(h).padStart(2,'0')}:00</span><div>${L.map(e=>`<div class="ev c-${e.c}" draggable="true" data-de="${e.id}"><strong>${esc(e.t)}</strong><small>${e.h}</small><button class="x e" data-a="ed" data-t="ev" data-id="${e.id}" aria-label="Editar evento">✎</button><button class="x" data-a="delev" data-id="${e.id}" aria-label="Excluir evento">×</button></div>`).join('')}</div>${k===T&&nh===h?`<div class="nowl" data-t="${nowH()}" style="top:${now.getMinutes()/60*100}%"></div>`:''}</div>`}
 return `<div class="hrs">${r}</div>`;
}
const OK=new Set(['B','STRONG','I','EM','U','UL','OL','LI','BR','DIV','P','H3','INPUT']);
function clean(h){const t=document.createElement('template');t.innerHTML=h;const w=n=>{[...n.childNodes].forEach(c=>{if(c.nodeType===3)return;if(c.nodeType!==1){c.remove();return}w(c);if(OK.has(c.tagName)){const ck=c.tagName==='INPUT';[...c.attributes].forEach(a=>{if(!(ck&&a.name==='checked'))c.removeAttribute(a.name)});if(ck)c.setAttribute('type','checkbox')}else c.replaceWith(...c.childNodes)})};w(t.content);return t.innerHTML}
const rich=b=>clean(/</.test(b||'')?b:esc(b||'').replace(/\n/g,'<br>'));
const plain=x=>String(x||'').replace(/<[^>]*>/g,' ');
const tags=n=>(n.g||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
const tbar=()=>`<div class="tb">${[['bold','<b>B</b>','Negrito'],['italic','<i>I</i>','Itálico'],['formatBlock:h3','H','Título'],['insertUnorderedList','•','Lista'],['insertOrderedList','1.','Lista numerada'],['chk','☑','Checklist'],['task','→ Tarefa','Transformar a linha em tarefa']].map(x=>`<button class="x" data-a="fmt" data-c="${x[0]}" aria-label="${x[2]}" title="${x[2]}">${x[1]}</button>`).join('')}</div>`;
const meta=n=>`<input data-n="${n.id}" data-f="f" list="folders" value="${esc(n.f||'')}" placeholder="Pasta" aria-label="Pasta"><input data-n="${n.id}" data-f="g" list="alltags" value="${esc(n.g||'')}" placeholder="Etiquetas, separadas por vírgula" aria-label="Etiquetas">`;
const nList=()=>S.notes.filter(n=>(!S.nf||n.f===S.nf)&&(!S.ng||tags(n).includes(S.ng))).sort((a,b)=>!!b.pin-!!a.pin);
function nFilters(){const fs=[...new Set(S.notes.map(n=>n.f).filter(Boolean))],ts=[...new Set(S.notes.flatMap(tags))];
 const ch=(a,id,l,on)=>`<button class="pill ${on?'on':''}" data-a="${a}" data-id="${esc(id)}">${esc(l)}</button>`;
 return fs.length||ts.length?`${fs.length?`<div class="bar">${ch('nf','','Todas as pastas',!S.nf)}${fs.map(f=>ch('nf',f,f,S.nf===f)).join('')}</div>`:''}${ts.length?`<div class="bar">${ts.map(t=>ch('ng',t,'#'+t,S.ng===t)).join('')}</div>`:''}`:''}
const nBar=()=>`<datalist id="folders">${[...new Set(S.notes.map(n=>n.f).filter(Boolean))].map(f=>`<option value="${esc(f)}">`).join('')}</datalist><div id="nfil">${nFilters()}</div>`;
const hue=s=>[...s].reduce((a,c)=>(a*31+c.charCodeAt(0))%360,7);
const ini=n=>(n.trim()[0]||'?').toUpperCase();
const lkBar=()=>`<div class="bar">${['',...CATS].map(c=>`<button class="pill ${S.lc===c?'on':''}" data-a="lc" data-id="${c}">${c||'Todas'}</button>`).join('')}</div><p class="empty" style="margin-top:0">Pressione o número do atalho (1 a 9) fora dos campos de texto para abrir o link.</p>`;
document.addEventListener('mousedown',e=>{if(e.target.closest('[data-a="fmt"]'))e.preventDefault()});
document.addEventListener('keydown',e=>{if(S.keys===false||e.metaKey||e.ctrlKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;const l=S.links.find(x=>x.k&&x.k===e.key);if(l){const a=document.createElement('a');a.href=safeUrl(l.u);a.target='_blank';a.rel='noopener';a.click()}});
setInterval(()=>{if(S.view==='agenda'&&!Q&&!ED&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))render()},6e4);
const focusBox=()=>`<div class="focus"><span>Foco do dia</span><input id="fo" value="${esc(S.focus||'')}" placeholder="Seu foco ou frase de hoje" maxlength="140" aria-label="Foco do dia"></div>`;
const doneOn=k=>S.tasks.filter(t=>t.done&&t.dd===k).length;
function streak(){let n=0,d=doneOn(T)>=S.goal?0:1;while(d<400&&doneOn(ds(add(today,-d)))>=S.goal){n++;d++}return n}
function prodPanel(){
 const dow=(today.getDay()+6)%7,days=[...Array(7)].map((_,i)=>add(today,i-dow)),cs=days.map(d=>doneOn(ds(d))),mx=Math.max(S.goal,...cs,1),tot=cs.reduce((a,b)=>a+b,0),hj=doneOn(T),pc=Math.min(100,Math.round(hj/S.goal*100)),st=streak();
 return `<div class="panel hero" data-card="prod"><h2>Produtividade da semana</h2><div class="chart" role="img" aria-label="Tarefas concluídas por dia: ${cs.join(', ')}">${days.map((d,i)=>`<div class="col${ds(d)===T?' tdc':''}"><small>${cs[i]||'\u00a0'}</small><div class="bar-w"><i class="${cs[i]>=S.goal?'c-g':'c-p'}${ds(d)===T?' td':''}" style="height:${cs[i]/mx*100}%"></i></div><small>${DIA[d.getDay()]}</small></div>`).join('')}</div>
 <div class="goal"><div><strong>Meta de hoje: ${hj}/${S.goal}</strong> tarefas<div class="prog"><i style="width:${pc}%"></i></div></div><div class="gctl"><button class="x" data-a="goal" data-id="-1" aria-label="Diminuir meta">−</button><button class="x" data-a="goal" data-id="1" aria-label="Aumentar meta">+</button></div><div class="stk"><strong>${st}</strong><small>${st===1?'dia':'dias'} seguidos</small></div></div><p class="empty" style="margin:8px 0 0">${tot} ${tot===1?'tarefa concluída':'tarefas concluídas'} nesta semana. Foco: ${S.fm[T]||0} min hoje, ${days.reduce((a,d)=>a+(S.fm[ds(d)]||0),0)} min na semana.</p><p class="lgd"><span><i class="lg g"></i>bateu a meta</span><span><i class="lg p"></i>abaixo da meta</span><span><i class="lg t"></i>hoje</span></p></div>`;
}
let UN=null,UT=0,DR=null,QT='tk';
function snap(a){UN=JSON.stringify({events:S.events,notes:S.notes,tasks:S.tasks,links:S.links,fin:S.fin});toast({delev:'Evento excluído',delnote:'Nota excluída',deltk:'Tarefa excluída',dellk:'Link excluído',clear:'Tarefas concluídas removidas',deltx:'Lançamento excluído',deltxg:'Parcelas excluídas'}[a]+' · fica 30 dias na lixeira',1)}
function go(v){S.view=v;Q='';ED=null;$('#q').value='';render()}
function newNote(){const id=uid();S.ng='';S.notes.unshift({id,t:'',b:'',f:S.nf||'',g:'',c:COL[S.notes.length%4]});go('notas');const i=document.querySelector('.note input[data-n="'+id+'"]');if(i)i.focus()}
function focusForm(v,f){go(v);const i=document.querySelector(f+' input');if(i)i.focus()}
const qaOpen=()=>!$('#qa').classList.contains('hide');
function qaClose(){const el=$('#qa');el.classList.add('hide');el.innerHTML=''}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(LKP){LKP=null;lkDraw();return}if(qaOpen())qaClose();else if(Q||ED){Q='';ED=null;$('#q').value='';render()}return}
 if(S.keys===false||e.metaKey||e.ctrlKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
 const k=e.key.toLowerCase();
 if(k==='/'){e.preventDefault();$('#q').focus()}
 else if(k==='n'){e.preventDefault();newNote()}
 else if(k==='t'){e.preventDefault();focusForm('tarefas','#ftk')}
 else if(k==='e'){e.preventDefault();focusForm('agenda','#fev')}
 else if(k==='c'){e.preventDefault();qa()}
 else if(k==='d'){e.preventDefault();qa('dp')}
 else if(k==='?')toast('Atalhos: N nota, T tarefa, E evento, D despesa, C captura rápida, / busca, Ctrl+Z desfaz, 1 a 9 links');
});
const dz=()=>DR.k==='tk'?'[data-dt]':'[data-day]';
document.addEventListener('dragstart',e=>{const t=e.target.closest&&e.target.closest('[data-dt],[data-de],[data-dtp],[data-dbk]');if(!t)return;DR=t.dataset.dt?{k:'tk',id:t.dataset.dt}:t.dataset.dtp?{k:'tp',id:t.dataset.dtp}:t.dataset.dbk?{k:'bk',id:t.dataset.dbk}:{k:'ev',id:t.dataset.de};e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',DR.id)}catch(x){}t.classList.add('drag')});
document.addEventListener('dragend',()=>{DR=null;document.querySelectorAll('.drag,.over').forEach(x=>x.classList.remove('drag','over'))});
document.addEventListener('dragover',e=>{if(!DR)return;const t=e.target.closest(dz());if(t){e.preventDefault();document.querySelectorAll('.over').forEach(x=>x.classList.remove('over'));t.classList.add('over')}});
document.addEventListener('drop',e=>{
 if(!DR)return;const t=e.target.closest(dz());if(!t)return;e.preventDefault();
 if(DR.k==='tp'||DR.k==='bk'){const t0=S.tasks.find(x=>x.id===DR.id);if(t0){let h;if(t.dataset.hr){const q=t.getBoundingClientRect(),m=Math.min(45,Math.max(0,Math.floor((e.clientY-q.top)/q.height*4)*15));h=t.dataset.hr+':'+String(m).padStart(2,'0')}else h=(DR.k==='bk'&&t0.bk&&t0.bk.d!==t.dataset.day?t0.bk.h:null)||autoSlot(t.dataset.day,t0.dur||30,t0.id);if(!h)toast('Sem espaço livre nesse dia');else{t0.bk={d:t.dataset.day,h};warnPlan(t.dataset.day,t0.id)}}DR=null;render();return}
 if(DR.k==='tk'){const a=S.tasks.findIndex(x=>x.id===DR.id),b0=S.tasks.findIndex(x=>x.id===t.dataset.dt);if(a>=0&&b0>=0&&a!==b0){const [m]=S.tasks.splice(a,1),b=S.tasks.findIndex(x=>x.id===t.dataset.dt);S.tasks.splice(a<b0?b+1:b,0,m)}}
 else{const ev=S.events.find(x=>x.id===DR.id);if(ev){ev.d=t.dataset.day;if(t.dataset.hr){const du=ev.e?mm(ev.e)-mm(ev.h):0;ev.h=t.dataset.hr+':'+ev.h.slice(3);if(ev.e)ev.e=hm(mm(ev.h)+du)}}}
 DR=null;render();
});
const dlbl=()=>today.getDate()+' de '+MES[today.getMonth()];
const TPL=[
{k:'reu',n:'Reunião',t:'Reunião {d}',g:'reunião',c:'b',b:'<h3>Pauta</h3><ul><li>&nbsp;</li></ul><h3>Decisões</h3><ul><li>&nbsp;</li></ul><h3>Próximos passos</h3><div><input type="checkbox">&nbsp;</div>'},
{k:'ide',n:'Ideia',t:'Ideia: ',g:'ideia',c:'y',b:'<h3>A ideia</h3><div><br></div><h3>Por que importa</h3><div><br></div><h3>Primeiro passo</h3><div><input type="checkbox">&nbsp;</div>'},
{k:'dia',n:'Diário',t:'Diário {d}',g:'diário',c:'p',b:'<h3>Como me sinto</h3><div><br></div><h3>Três vitórias</h3><ol><li>&nbsp;</li><li>&nbsp;</li><li>&nbsp;</li></ol><h3>Gratidão</h3><div><br></div>'},
{k:'lis',n:'Checklist',t:'Checklist',g:'',c:'g',b:'<div><input type="checkbox">&nbsp;</div><div><input type="checkbox">&nbsp;</div><div><input type="checkbox">&nbsp;</div>'}];
function lineToTask(ed){
 const s=getSelection();if(!s.rangeCount||!ed.contains(s.anchorNode)){toast('Clique na linha que quer transformar em tarefa');return}
 let el=s.anchorNode;el=el.nodeType===3?el.parentNode:el;const ln=el.closest('li,div,p,h3');let txt='';
 if(ln&&ln!==ed&&ed.contains(ln))txt=ln.textContent;else{s.modify('move','backward','lineboundary');s.modify('extend','forward','lineboundary');txt=s.toString();s.collapseToEnd()}
 txt=txt.replace(/\u00a0/g,' ').trim();
 if(!txt){toast('A linha está vazia');return}
 const nid=uid();S.tasks.unshift({id:nid,t:txt,done:false,p:'m',due:''});if(ed.dataset.n)lkSet('nt:'+ed.dataset.n,'tk:'+nid,true);save();toast('Tarefa criada e ligada à nota: '+esc(txt.slice(0,40)));
}
document.addEventListener('change',e=>{const c=e.target;if(c.matches&&c.matches('.rt input[type=checkbox]')){c.toggleAttribute('checked',c.checked);c.closest('.rt').dispatchEvent(new Event('input',{bubbles:true}))}});
const ILL={tk:'M34 44l6 6 12-14',nt:'M30 38h20M30 46h20M30 54h12',ev:'M33 38h4M43 38h4M33 47h4M43 47h4M33 56h4',lk:'M36 48l12-12M31 52a7 7 0 0 1 0-10l4-4M53 34a7 7 0 0 1 0 10l-4 4'};
const EI={tk:'check',nt:'note',ev:'cal',lk:'link',hb:'repeat',fin:'wallet',mt:'flag',dia:'smile',rd:'book',tg:'tag',cfg:'sliders'};
const EH={'Tudo em dia!':'Nada pendente agora. Adicione a próxima tarefa quando precisar.','Nenhum evento por aqui.':'Dica: escreva "reunião sexta 14h" e a data é reconhecida.','Nenhuma nota ainda.':'Anote ideias, atas e listas.','Nenhum link salvo ainda.':'Guarde os sites que você mais usa.','Nenhum evento hoje.':'Seu dia está livre.','Nenhum lançamento neste mês.':'Registre uma receita ou despesa para ver os gráficos.','Nenhuma tarefa por aqui.':'Crie uma tarefa ou mude o filtro acima.','Nenhum hábito cadastrado.':'Hábitos pequenos e diários funcionam melhor.'};
const EART='<svg class="eart" viewBox="0 0 120 80" aria-hidden="true"><ellipse cx="60" cy="70" rx="38" ry="5" fill="currentColor" opacity=".08"/><rect x="34" y="10" width="52" height="52" rx="18" style="fill:color-mix(in srgb,var(--s1) 22%,var(--card))"/><circle cx="24" cy="26" r="6" style="fill:var(--s2)"/><circle cx="100" cy="18" r="4" style="fill:var(--s1);opacity:.55"/><rect x="92" y="44" width="11" height="11" rx="3.5" style="fill:var(--s2)" transform="rotate(18 97 49)"/><path d="M14 52q5-7 10 0t10 0" fill="none" style="stroke:var(--s1);stroke-opacity:.45" stroke-width="2" stroke-linecap="round"/></svg>';
const emp=(k,m,b,at)=>{const i=m.indexOf('. '),t=i>0?m.slice(0,i+1):m,h=i>0?m.slice(i+2):(EH[m]||'');return `<div class="emp"><span class="eic" aria-hidden="true">${EART}<span class="ei">${ic(EI[k]||'check',28)}</span></span><p><strong>${t}</strong>${h?`<small>${h}</small>`:''}</p>${b?`<button class="pill dark" ${at}>${b}</button>`:''}</div>`};
const PAL={ceu:{n:'Céu e lilás',src:['#C9E0EB','#7392B5','#8350C4','#402B47','#262423'],bg:'#eef4f8',panel:'#dbe9f1',card:'#fbfdfe',pink:'#cdb4ec',blue:'#a9c3dc',yellow:'#c9e0eb',green:'#b7aad8',acc:'#8350C4',side:'#262423',d:['#1f1b24','#2c2433','#272030']},
ametista:{n:'Ametista',src:['#F6FFE9','#F2E0A4','#CAC5E5','#A230A4','#290087'],bg:'#f9fdf0',panel:'#efe9c9',card:'#fffff8',pink:'#d99ddb',blue:'#cac5e5',yellow:'#f2e0a4',green:'#e3efc4',acc:'#290087',side:'#1a0a4a',d:['#1a0d3f','#2a1a5e','#231452']},
safira:{n:'Safira',src:['#D9FCED','#405FFA','#09BBC8','#3B3664','#07240F'],bg:'#eefcf5',panel:'#d9f2e6',card:'#fbfffd',pink:'#b9b7e0',blue:'#8fa6ff',yellow:'#8fe3ea',green:'#d9fced',acc:'#3B3664',side:'#07240F',d:['#0b1e14','#162d27','#11251c']},
floresta:{n:'Floresta',src:['#D8E4FF','#AA77A9','#59EE99','#35605A','#00120B'],bg:'#eef3ff',panel:'#dde6fb',card:'#fcfdff',pink:'#d3b0d2',blue:'#c4d3f7',yellow:'#a8f2c6',green:'#8fd9b8',acc:'#35605A',side:'#00120B',d:['#0a1a14','#1b332e','#12241f']},
citrico:{n:'Cítrico',src:['#F0FCD9','#D2FF28','#C84C09','#436436','#420217'],bg:'#f7fbe6',panel:'#eaf2c9',card:'#fdfef6',pink:'#f0a77a',blue:'#b3d0a4',yellow:'#e3ff7a',green:'#9dc48f',acc:'#C84C09',side:'#420217',d:['#240110','#3a1423','#2f0b1a']}};
const isDark=()=>{const t=document.documentElement.dataset.theme;return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches};
function applyTheme(){
 const r=document.documentElement,st=r.style,p=PAL[S.pal]||PAL.ceu,th=r.dataset.theme,dark=th?th==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
 ['pink','blue','yellow','green'].forEach(k=>st.setProperty('--'+k,p[k]));
 ['bg','panel','card'].forEach((k,i)=>dark?(p.d?st.setProperty('--'+k,p.d[i]):st.removeProperty('--'+k)):st.setProperty('--'+k,p[k]));
 if(p.side)st.setProperty('--side',dark&&p.d?p.d[0]:p.side);else st.removeProperty('--side');
 const ac=S.acc||(p.acc&&!dark?p.acc:'');
 if(ac){const n=parseInt(ac.slice(1),16),l=((n>>16)*.299+(n>>8&255)*.587+(n&255)*.114)/255,w=l<=.6;st.setProperty('--acc',ac);st.setProperty('--onacc',w?'#ffffff':'#161616');st.setProperty('--navon',w?'rgba(0,0,0,.24)':'rgba(0,0,0,.16)')}
 else['--acc','--onacc','--navon'].forEach(k=>st.removeProperty(k));
 r.dataset.nav=S.nav==='forte'?'forte':'suave';r.dataset.dens=S.dens==='comp'?'compacto':'confortavel';
 {const na=ac||(dark?p.pink:p.acc||'#121212'),n=parseInt(na.slice(1),16),l=((n>>16)*.299+(n>>8&255)*.587+(n&255)*.114)/255;st.setProperty('--nacc',na);st.setProperty('--nonacc',l<=.6?'#ffffff':'#161616')}
}
function aparencia(){
 return `<div class="top"><h1>Aparência</h1></div><div class="panel"><h2>Paleta</h2><div class="pgrid" role="group" aria-label="Paleta de cores">${Object.entries(PAL).map(([k,p])=>`<button class="pcard ${(PAL[S.pal]?S.pal:'ceu')===k?'on':''}" data-a="pal" data-id="${k}" aria-pressed="${(PAL[S.pal]?S.pal:'ceu')===k}"><span class="pst">${(p.src||[p.bg,p.pink,p.blue,p.yellow,p.green]).map(c=>`<i style="background:${c}"></i>`).join('')}</span><strong>${p.n}</strong></button>`).join('')}</div><h2 style="margin-top:14px">Menu lateral</h2><div class="pgrid" role="group" aria-label="Estilo do menu lateral">${[['suave','Suave (padrão)','color-mix(in srgb,var(--nacc) 16%,var(--card))','var(--nacc)'],['forte','Forte (anterior)','var(--side)','#262522']].map(([k,n,bg,on])=>{const sel=(S.nav==='forte'?'forte':'suave')===k;return `<button class="pcard ${sel?'on':''}" data-a="navstyle" data-id="${k}" aria-pressed="${sel}"><span class="pst" style="background:${bg};padding:5px;gap:3px;flex-direction:column"><i style="flex:0 0 7px;border-radius:4px;background:${on}"></i><i style="flex:0 0 7px;border-radius:4px;background:${k==='suave'?'color-mix(in srgb,var(--ink) 18%,transparent)':'rgba(255,255,255,.25)'}"></i></span><strong>${n}</strong></button>`}).join('')}</div><h2 style="margin-top:14px">Densidade</h2><div class="pgrid" role="group" aria-label="Densidade da interface">${[['conf','Confortável (padrão)','Mais espaço entre os elementos'],['comp','Compacto','Mais conteúdo por tela']].map(([k,n,d])=>{const sel=(S.dens==='comp'?'comp':'conf')===k;return `<button class="pcard ${sel?'on':''}" data-a="dens" data-id="${k}" aria-pressed="${sel}"><span class="pst" style="flex-direction:column;gap:${k==='comp'?2:5}px;padding:5px;background:var(--card)">${[0,1,2].map(()=>`<i style="flex:0 0 ${k==='comp'?6:8}px;border-radius:3px;background:var(--s2)"></i>`).join('')}</span><strong>${n}</strong><small style="color:var(--mute)">${d}</small></button>`}).join('')}</div><h2 style="margin-top:14px">Cor de destaque</h2><div class="bar">${['','#1f3a5f','#3b2a6b','#1d4d3a','#7a2e3f','#b4235a'].map(c=>`<button class="swc ${(S.acc||'')===c?'sel':''}" style="background:${c||(!isDark()&&(PAL[S.pal]||{}).acc)||'#121212'}" data-a="acc" data-id="${c}" aria-label="Cor ${c||'padrão'}"></button>`).join('')}<label class="pill" style="cursor:pointer">Outra cor <input type="color" id="acc" value="${S.acc||'#121212'}"></label></div><p class="empty">A cor de destaque muda o menu lateral, os botões principais e o dia atual da agenda. A paleta muda os tons dos cards e o fundo, nos modos claro e escuro. As paletas novas também trazem um destaque próprio no modo claro, e a cor de destaque que você escolher sempre tem prioridade.</p></div>${a11yPanel()}`;
}
const CARDS={linha:'Seu dia',frase:'Frase do dia',spotify:'Playlist do Spotify',clima:'Clima',prod:'Produtividade da semana',agenda:'Próximos eventos',todo:'Para fazer',links:'Links rápidos',notas:'Notas recentes',rev:'Revisão semanal',hist:'Histórico',habs:'Hábitos de hoje',fin:'Finanças do mês',humor:'Humor de hoje',metas:'Metas'},WIDE=['linha','prod','agenda','notas','rev','hist','fin'];
const cfg=()=>{const c=(S.cards||[]).filter(x=>CARDS[x.id]);Object.keys(CARDS).forEach(id=>{if(!c.some(x=>x.id===id))c[id==='linha'?'unshift':'push']({id,on:!['frase','spotify','clima'].includes(id)})});return c};
function mk(h){const d=document.createElement('div');d.innerHTML=h;return d.firstElementChild}
function custBar(){
 const c=cfg();
 return `<div><div class="bar"><button class="pill" data-a="cust">${S.cust?'Fechar personalização':'Personalizar painel'}</button></div>${S.cust?`<div class="panel" style="margin-bottom:14px"><h2>Cards do Início</h2>${c.map((x,i)=>`<div class="item"><input type="checkbox" class="chk" data-a="ctog" data-id="${x.id}" ${x.on?'checked':''} aria-label="Mostrar ${CARDS[x.id]}"><div class="t">${CARDS[x.id]}</div><button class="x" data-a="cmv" data-id="${x.id}" data-n="-1" aria-label="Subir" ${i?'':'disabled'}>↑</button><button class="x" data-a="cmv" data-id="${x.id}" data-n="1" aria-label="Descer" ${i<c.length-1?'':'disabled'}>↓</button></div>`).join('')}</div>`:''}</div>`;
}
function revCard(){
 const dow=(today.getDay()+6)%7,m=add(today,-dow+S.rw*7),a=ds(m),z=ds(add(m,6)),dn=S.tasks.filter(t=>t.done&&t.dd>=a&&t.dd<=z),ev=[...Array(7)].flatMap((_,i)=>evOn(ds(add(m,i)))),r=S.rev[a]||{},days=[...Array(7)].map((_,i)=>doneOn(ds(add(m,i)))),best=Math.max(...days),bi=days.indexOf(best);
 return `<div class="panel" data-card="rev"><h2>Revisão semanal</h2><div class="top" style="margin:0 0 10px"><strong>${fmt(a)} a ${fmt(z)}${S.rw===0?' (esta semana)':''}</strong><span><button class="x" data-a="rw" data-id="-1" aria-label="Semana anterior">‹</button><button class="x" data-a="rw" data-id="0" aria-label="Esta semana">hoje</button><button class="x" data-a="rw" data-id="1" aria-label="Próxima semana">›</button></span></div>
 <div class="revs"><div class="stat c-p"><span>Tarefas feitas</span><strong>${dn.length}</strong></div><div class="stat c-b"><span>Eventos</span><strong>${ev.length}</strong></div><div class="stat c-y"><span>Sequência atual</span><strong>${streak()}</strong></div></div>
 <p class="empty" style="margin:4px 0">${best?'Melhor dia: '+DIA[add(m,bi).getDay()]+' ('+best+'). ':''}Concluídas: ${dn.slice(0,4).map(t=>esc(t.t)).join('; ')||'nenhuma ainda'}.</p>
 <label class="lb">O que aprendi<textarea class="in ta" data-rv="l" data-wk="${a}">${esc(r.l||'')}</textarea></label><label class="lb">Prioridades da próxima semana<textarea class="in ta" data-rv="p" data-wk="${a}">${esc(r.p||'')}</textarea></label></div>`;
}
function histCard(){
 const N=S.hw||8,dow=(today.getDay()+6)%7,m0=add(today,-dow-(N-1)*7),cnt={};
 S.tasks.forEach(t=>{if(t.done&&t.dd)cnt[t.dd]=(cnt[t.dd]||0)+1});
 const wk=[...Array(N)].map((_,w)=>[...Array(7)].map((_,d)=>{const k=ds(add(m0,w*7+d));return{k,n:cnt[k]||0,f:k>T}})),tot=wk.map(w=>w.reduce((a,c)=>a+c.n,0)),mx=Math.max(1,...tot),lv=n=>n<1?0:n<2?1:n<3?2:n<5?3:4;
 const total=tot.reduce((a,b)=>a+b,0),avg=total/N,mxw=Math.max(...tot),bi=tot.indexOf(mxw),past=wk.flat().filter(c=>!c.f),act=past.filter(c=>c.n>0).length;
 const dws=Array(7).fill(0);wk.forEach(w=>w.forEach((c,d)=>{if(!c.f)dws[d]+=c.n}));const dmx=Math.max(1,...dws),bd=dws.indexOf(Math.max(...dws));
 const DN=['seg','ter','qua','qui','sex','sáb','dom'],DNF=['às segundas','às terças','às quartas','às quintas','às sextas','aos sábados','aos domingos'],nf=v=>String(Math.round(v*10)/10).replace('.',',');
 const lab=(w,i)=>N>8?((N-1-i)%2===0?fmt(w[0].k):''):fmt(w[0].k);
 const cols=wk.map((w,i)=>`<div class="hwk${i===N-1?' cur':''}"><small class="hv">${tot[i]||'&nbsp;'}</small><div class="hb"><i style="height:${tot[i]/mx*100}%"></i></div><div class="hc">${w.map(c=>`<i class="hm l${lv(c.n)}${c.f?' fut':''}${c.k===T?' tdy':''}" title="${fmt(c.k)}: ${c.n}"></i>`).join('')}</div><small class="hl">${lab(w,i)}</small></div>`).join('');
 const tile=(l,v,e)=>`<div class="hkt"><small>${l}</small><strong>${v}</strong><em>${e}</em></div>`;
 return `<div class="panel" data-card="hist"><h2>Histórico</h2><div class="bar">${[4,8,12].map(n=>`<button class="pill ${N===n?'on':''}" data-a="hw" data-id="${n}">${n} semanas</button>`).join('')}</div>
 <div class="hgrid"><div class="hleft"><div class="hst" style="--avg:${(avg/mx*100).toFixed(1)}%" role="img" aria-label="Tarefas concluídas por semana, do mais antigo ao mais recente: ${tot.join(', ')}"><div class="hwd" aria-hidden="true">${DN.map(x=>`<span>${x[0].toUpperCase()}</span>`).join('')}</div>${cols}</div>
 <div class="hlg"><span>menos</span>${[0,1,2,3,4].map(l=>`<i class="hm l${l}"></i>`).join('')}<span>mais</span><span class="hav"><i></i>média semanal</span></div></div>
 <div class="hright"><div class="hk">${tile('Concluídas',total,'em '+N+' semanas')}${tile('Média semanal',nf(avg),'tarefas por semana')}${tile('Melhor semana',mxw||'—',mxw?'semana de '+fmt(wk[bi][0].k):'sem dados')}${tile('Dias ativos',act+'/'+past.length,past.length?Math.round(act/past.length*100)+'% dos dias':'')}</div>
 <h2 class="gh" style="margin-top:14px">Por dia da semana</h2>${DN.map((x,d)=>`<div class="hd${total&&d===bd?' on':''}"><span>${x}</span><div class="ht"><i style="width:${dws[d]/dmx*100}%"></i></div><b>${dws[d]}</b></div>`).join('')}<p class="empty" style="margin:6px 0 0">${total?'Você conclui mais tarefas '+DNF[bd]+'.':'Sem dados ainda: conclua tarefas e o histórico começa a se preencher.'}</p></div></div></div>`;
}
function dash(){
 const t=document.createElement('template');t.innerHTML=dash0();
 const g=t.content.querySelector('.grid'),st=g.children[1],base={};g.children[0].remove();g.classList.add('solo');
 t.content.querySelectorAll('[data-card]').forEach(n=>{base[n.dataset.card]=n});
 base.linha=mk(lineCard());base.frase=mk(frCard());base.spotify=mk(spCard());base.clima=mk(wxCard());base.rev=mk(revCard());base.hist=mk(histCard());base.habs=mk(habCard());base.fin=mk(finCard());base.humor=mk(humorCard());base.metas=mk(metasCard());
 st.className='cards dashc';st.innerHTML='';
 cfg().filter(c=>c.on).forEach(c=>{const n=base[c.id];if(n){n.classList.toggle('wide',WIDE.includes(c.id));st.appendChild(n)}});
 if(!st.children.length)st.appendChild(mk(`<div class="panel wide">${emp('cfg','Nenhum card ativo no Início.','Personalizar','data-a="cust"')}</div>`));
 const cb=confBanner();if(cb)g.before(mk(cb));const ob=onbBox();if(ob)g.before(mk(ob));const bk=bkBox();if(bk)g.before(mk(bk));const rb=routBox();if(rb)g.before(mk(rb));const at=attBox();if(at)g.before(mk(at));g.before(mk(custBar()));
 return t.innerHTML;
}
const daysSince=d=>Math.round((new Date(T+'T12:00')-new Date(d+'T12:00'))/864e5);
function bkBox(){
 if(S.onb||DBr)return '';const n=S.tasks.length+S.notes.length+S.links.length+((S.fin&&S.fin.tx)||[]).length+Object.keys(S.dia||{}).length;if(n<5)return '';
 if(S.bkSnz&&daysSince(S.bkSnz)<7&&daysSince(S.bkSnz)>=0)return '';
 const d=S.lastBk?daysSince(S.lastBk):null;if(d!==null&&d<30)return '';
 return `<div class="panel" id="bkb" role="region" aria-label="Lembrete de backup"><h2>Hora de fazer um backup</h2><p class="empty" style="padding:0 0 8px">${d===null?'Você ainda não baixou nenhum backup.':'Seu último backup foi há '+d+' dias.'} Seus dados ficam só neste navegador, e uma cópia protege contra perda.</p><div class="bar" style="margin:0"><button class="pill dark" data-v="backup">Fazer backup</button><button class="pill" data-a="bksnz">Lembrar em 7 dias</button></div></div>`}
function onbBox(){
 const exb=hasEx()?`<div class="panel" id="exb"><h2>Dados de exemplo</h2><p class="empty" style="padding:0 0 8px">Você está vendo itens de exemplo, marcados com “(exemplo)”. Remova todos com um clique quando quiser começar do zero.</p><div class="bar" style="margin:0"><button class="pill dark" data-a="exclear">Remover exemplos</button><button class="pill" data-a="exkeep">Manter como meus</button></div></div>`:'';
 if(!S.onb)return exb;const F=S.fin,st=[['Crie sua primeira tarefa',S.tasks.length>0,'tk','Nova tarefa'],['Marque um evento na agenda',S.events.length>0,'ev','Novo evento'],['Lance uma despesa',(F.tx||[]).length>0,'dp','Nova despesa']];
 if(st.every(x=>x[1])){S.onb=false;return exb}
 return exb+`<div class="panel" id="onb"><h2>Primeiros passos</h2><p class="empty" style="padding:0 0 6px">Tudo fica salvo na sua conta e aparece nos seus outros aparelhos. Dica: ao digitar “reunião sexta 14h” ou “pagar boleto amanhã”, o hub entende a data e a hora.</p>${st.map(x=>`<div class="item ${x[1]?'done':''}"><span aria-hidden="true">${x[1]?'✔':'○'}</span><div class="t">${x[0]}</div>${x[1]?'':`<button class="pill dark" data-a="qat" data-id="${x[2]}">${x[3]}</button>`}</div>`).join('')}<div class="bar" style="margin:8px 0 0"><button class="pill" data-a="tourgo">Ver o tour</button>${emptyData()?'<button class="pill" data-a="exload">Carregar exemplo</button>':''}<button class="pill" data-a="onbx">Dispensar</button></div></div>`}
applyTheme();document.documentElement.classList.add('nt');setTimeout(()=>document.documentElement.classList.remove('nt'),400);
const RP=[['','Não repete'],['d','Todo dia'],['u','Dias úteis'],['w','Toda semana'],['m','Todo mês']],RM=[['','Sem lembrete'],['5','5 min antes'],['10','10 min antes'],['15','15 min antes'],['30','30 min antes'],['60','1 h antes']];
const mm=x=>+x.slice(0,2)*60+ +x.slice(3,5);
const hm=m=>String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const sp=e=>{const s=mm(e.h);return[s,e.e&&mm(e.e)>s?mm(e.e):s+30]};
const tr=e=>e.h+(e.e?'–'+e.e:'')+(e.r?' ↻':'');
const hit=(e,k)=>{if(e.d===k)return true;if(!e.r||k<e.d)return false;const a=new Date(e.d+'T00:00'),b=new Date(k+'T00:00'),g=b.getDay();return e.r==='d'||(e.r==='u'&&g>0&&g<6)||(e.r==='w'&&a.getDay()===g)||(e.r==='m'&&a.getDate()===b.getDate())};
function evOn(k){const l=S.events.filter(e=>hit(e,k)).map(e=>({...e,d:k})).sort(evSort);l.forEach((a,i)=>{const[s,f]=sp(a);l.forEach((b,j)=>{if(j>i){const[s2,f2]=sp(b);if(s<f2&&s2<f){a.cf=b.cf=true}}})});return l}
function upcoming(n){const o=[];for(let i=0;i<60&&o.length<n;i++)o.push(...evOn(ds(add(today,i))));return o.slice(0,n)}
function confBanner(){const o=[];for(let i=0;i<14&&o.length<3;i++){const k=ds(add(today,i)),c=evOn(k).filter(x=>x.cf);if(c.length)o.push(`<button class="pill" data-a="gotoday" data-id="${k}">⚠ ${i===0?'Hoje':fmt(k)}: ${c.map(x=>esc(x.t)).join(' × ')}</button>`)}return o.length?`<div><div class="bar" role="alert"><strong style="align-self:center">Conflitos de horário:</strong>${o.join('')}</div></div>`:''}
function askNotif(){try{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission()}catch(e){}}
function notify(t,b){toast('<strong>'+esc(t)+'</strong> '+esc(b));clearTimeout(UT);UT=setTimeout(()=>{const x=$('#toast');if(x)x.classList.remove('on')},15000);try{if('Notification' in window&&Notification.permission==='granted')new Notification(t,{body:b})}catch(e){}}
const fired=new Set();
function remind(){const t0=ds(new Date()),n=Date.now();evOn(t0).forEach(e=>{if(e.rm==null||e.rm==='')return;const df=(new Date(t0+'T'+e.h).getTime()-n)/6e4,key=e.id+t0;if(df<=+e.rm&&df>-1&&!fired.has(key)){fired.add(key);notify('Lembrete: '+e.t,df>0.5?'Começa em '+Math.ceil(df)+' min ('+e.h+')':'Começa agora ('+e.h+')')}})}
setInterval(remind,30000);setTimeout(remind,1500);
const HPX=56;
function layout(l){const it=l.map(e=>{const[s,f]=sp(e);return{e,s,f}}),cl=[];let c=null;
 it.forEach(x=>{if(c&&x.s<c.end){c.i.push(x);c.end=Math.max(c.end,x.f)}else{c={i:[x],end:x.f};cl.push(c)}});
 cl.forEach(c=>{const ln=[];c.i.forEach(x=>{let j=ln.findIndex(v=>v<=x.s);if(j<0){j=ln.length;ln.push(0)}ln[j]=x.f;x.l=j});c.i.forEach(x=>{x.n=ln.length})});return it}
function dayView(){
 const d=add(today,S.dy),k=ds(d),L0=evOn(k).map(e=>({...e})),B0=blocksOn(k),now=new Date(),nm=now.getHours()*60+now.getMinutes(),td=k===T,ALL=[...L0,...B0].sort((x,y)=>sp(x)[0]-sp(y)[0]);
 B0.forEach(b=>{const[s,f]=sp(b);b.cf=ALL.some(o=>o!==b&&(([s2,f2])=>s<f2&&s2<f)(sp(o)))});
 const a=Math.min(6,td?now.getHours():6,...ALL.map(e=>Math.floor(sp(e)[0]/60))),z=Math.min(23,Math.max(22,td?now.getHours()+1:0,...ALL.map(e=>Math.ceil(sp(e)[1]/60))));
 let rows='';
 for(let h=a;h<=z;h++){const hh=String(h).padStart(2,'0');rows+=`<div class="hr" data-day="${k}" data-hr="${hh}" style="height:${HPX}px"><span>${hh}:00</span></div>`}
 const evh=layout(ALL).map(x=>{const e=x.e,w=100/x.n,st=`top:${(x.s-a*60)/60*HPX}px;height:${Math.max(22,(x.f-x.s)/60*HPX-2)}px;left:calc(${x.l*w}% + 2px);width:calc(${w}% - 4px)`;
  if(e.blk)return `<div class="ev blk${e.cf?' cf':''}${e.done?' done':''}" draggable="true" data-dbk="${e.id}" style="${st}"><input type="checkbox" class="chk" data-a="tog" data-id="${e.id}" ${e.done?'checked':''} aria-label="Concluir ${esc(e.t)}"><strong>${esc(e.t)}</strong><small>${e.h}–${e.e}</small><button class="x" data-a="unbk" data-id="${e.id}" aria-label="Tirar ${esc(e.t)} da agenda">×</button></div>`;
  return `<div class="ev c-${e.c}${e.cf?' cf':''}" draggable="true" data-de="${e.id}" data-lid="ev:${e.id}" style="${st}"><strong>${esc(e.t)}</strong><small>${tr(e)}</small>${lkBtn('ev',e.id,'l')}<button class="x e" data-a="ed" data-t="ev" data-id="${e.id}" aria-label="Editar evento">✎</button><button class="x" data-a="delev" data-id="${e.id}" aria-label="Excluir evento">×</button></div>`}).join('');
 return `<div class="dayw"><div class="dayg"><div class="hrs">${rows}</div><div class="evl">${evh}${td?`<div class="nowl" data-t="${nowH()}" style="top:${(nm-a*60)/60*HPX}px"></div>`:''}</div></div>${planPanel(k)}</div>`;
}
const subs=t=>(t.sub||[]).map(s=>`<span class="sb ${s.done?'done':''}"><input type="checkbox" class="chk sm" data-a="stog" data-id="${t.id}" data-s="${s.id}" ${s.done?'checked':''} aria-label="Concluir etapa">${esc(s.t)}<button class="x" data-a="sdel" data-id="${t.id}" data-s="${s.id}" aria-label="Excluir etapa">×</button></span>`).join('')+`<input class="in sadd" data-sadd="${t.id}" placeholder="+ etapa" aria-label="Nova etapa">`;
const pjBar=()=>{const ps=[...new Set(S.tasks.map(t=>t.pj).filter(Boolean))],ch=(id,l,on)=>`<button class="pill ${on?'on':''}" data-a="pf" data-id="${esc(id)}">${esc(l)}</button>`;return `<datalist id="pjs">${ps.map(p=>`<option value="${esc(p)}">`).join('')}</datalist>${ps.length?`<div class="bar">${ch('','Todos os projetos',!S.pf)}${ps.map(p=>{const l=S.tasks.filter(t=>t.pj===p);return ch(p,p+' ('+l.filter(t=>t.done).length+'/'+l.length+')',S.pf===p)}).join('')}</div>`:''}`};
function nextDue(t){let x=new Date((t.due||T)+'T00:00');const od=x.getDate(),st=()=>{if(t.rc==='d')x=add(x,1);else if(t.rc==='w')x=add(x,7);else{x=new Date(x.getFullYear(),x.getMonth()+1,1);x.setDate(Math.min(od,new Date(x.getFullYear(),x.getMonth()+1,0).getDate()))}};do st();while(ds(x)<=T);return ds(x)}
const FOCO=25,PAUSA=5;
const mmss=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
function pomoDraw(){const el=$('#pomo');if(!el)return;const k=S.fk;if(!k){el.classList.add('hide');return}const t=S.tasks.find(x=>x.id===k.id);el.classList.remove('hide');el.innerHTML=`<strong>${k.mode==='foco'?'Foco':'Pausa'}</strong><span class="tm">${mmss(k.run?k.end-Date.now():k.left)}</span><small>${t?esc(t.t):''}</small><button data-a="pp">${k.run?'Pausar':'Continuar'}</button><button data-a="ps">Parar</button>`}
function pdone(){const k=S.fk;if(!k)return;const t=S.tasks.find(x=>x.id===k.id);
 if(k.mode==='foco'){S.fm[T]=(S.fm[T]||0)+FOCO;if(t)t.pm=(t.pm||0)+1;if(t&&t.pj){const o=(S.fpj[t.pj]=S.fpj[t.pj]||{});o[T]=(o[T]||0)+FOCO}S.fk={id:k.id,mode:'pausa',run:true,end:Date.now()+PAUSA*6e4,left:PAUSA*6e4};notify('Foco concluído','Faça uma pausa de '+PAUSA+' min.')}
 else{S.fk=null;notify('Pausa terminou','Pronto para outro ciclo?')}
 if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){save();pomoDraw()}else render()}
setInterval(()=>{const k=S.fk;if(!k||!k.run)return;const l=k.end-Date.now(),tm=$('#pomo .tm');if(tm)tm.textContent=mmss(l);if(l<=0)pdone()},1000);
const hstreak=h=>{let n=0,d=h.log[T]?0:1;while(d<400&&h.log[ds(add(today,-d))]){n++;d++}return n};
function habitos(){
 const days=[...Array(7)].map((_,i)=>add(today,i-6));
 return `<div class="top"><h1>Hábitos</h1></div><form class="bar" id="fhb"><input class="in grow" name="n" placeholder="Novo hábito (ex.: beber água, ler)" required><button class="pill dark">Adicionar hábito</button></form><div class="panel" style="overflow-x:auto">${S.habits.length?`<div class="hh"><span></span>${days.map(d=>`<small class="${ds(d)===T?'tdy':''}">${DIA[d.getDay()]}</small>`).join('')}<span></span></div>`+S.habits.map(h=>`<div class="hh"><div class="t">${esc(h.n)}<small style="text-align:left;display:block">${hstreak(h)} ${hstreak(h)===1?'dia':'dias'} seguidos</small></div>${days.map(d=>`<input type="checkbox" class="chk" data-a="htog" data-id="${h.id}" data-d="${ds(d)}" ${h.log[ds(d)]?'checked':''} aria-label="${esc(h.n)} em ${fmt(ds(d))}">`).join('')}<button class="x" data-a="delhb" data-id="${h.id}" aria-label="Excluir hábito">×</button></div>`).join(''):emp('hb','Nenhum hábito ainda. Comece com um simples.','Adicionar hábito','data-a="focusform" data-id="#fhb"')}</div>`;
}
function habCard(){return `<div class="panel" data-card="habs"><h2>Hábitos de hoje</h2>${S.habits.length?S.habits.map(h=>`<div class="item"><input type="checkbox" class="chk" data-a="htog" data-id="${h.id}" data-d="${T}" ${h.log[T]?'checked':''} aria-label="${esc(h.n)}"><div class="t">${esc(h.n)}<small>${hstreak(h)} ${hstreak(h)===1?'dia':'dias'} seguidos</small></div></div>`).join(''):emp('hb','Crie hábitos diários, como beber água ou ler.','Novo hábito','data-v="habitos"')}</div>`}
document.addEventListener('change',e=>{const c=e.target.closest&&e.target.closest('[data-a="stog"],[data-a="htog"]');if(!c)return;
 if(c.dataset.a==='stog'){const t=S.tasks.find(x=>x.id===c.dataset.id),s=t&&t.sub.find(x=>x.id===c.dataset.s);if(s)s.done=c.checked}
 else{const h=S.habits.find(x=>x.id===c.dataset.id);if(h){if(c.checked)h.log[c.dataset.d]=1;else delete h.log[c.dataset.d]}}
 render()});
document.addEventListener('keydown',e=>{const i=e.target;if(e.key==='Enter'&&i.dataset&&i.dataset.sadd){e.preventDefault();const v=i.value.trim(),t=S.tasks.find(x=>x.id===i.dataset.sadd);if(v&&t){(t.sub=t.sub||[]).push({id:uid(),t:v,done:false});render();const n=document.querySelector('[data-sadd="'+t.id+'"]');if(n)n.focus()}}});
const safeUrl=u=>/^(https?:|mailto:)/i.test(String(u).trim())?String(u).trim():'#';
function newDay(){const n=new Date();if(ds(n)===T)return;today=n;T=ds(n);if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||document.activeElement.isContentEditable)return;render()}
setInterval(newDay,6e4);document.addEventListener('visibilitychange',()=>{if(!document.hidden)newDay()});
const DIAF=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'],MESF=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const saud=()=>{const h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'};
const grp=t=>t.done?3:t.due&&t.due<T?0:t.due===T?1:2;
const gh=(L,i)=>{const g=grp(L[i]);return i&&grp(L[i-1])===g?'':`<h2 class="gh${g===0?' late':''}">${['Atrasadas','Hoje','Próximas e sem prazo','Concluídas'][g]}</h2>`};
document.addEventListener('click',e=>{
 if(ED)return;const t=e.target;if(!t.closest||t.closest('.ev,button,a,input,select'))return;
 const f=$('#fev'),r=t.closest('.hr'),c=t.closest('.day[data-day]');if(!f||(!r&&!c))return;
 const set=(n,v)=>{f.querySelector('[name='+n+']').value=v};
 if(r){const q=r.getBoundingClientRect(),m=Math.min(45,Math.floor((e.clientY-q.top)/q.height*4)*15),h=r.dataset.hr+':'+String(m).padStart(2,'0');set('d',r.dataset.day);set('h',h);set('h2',hm(mm(h)+60));toast('Novo evento às '+h+': digite o título e salve')}
 else{set('d',c.dataset.day);toast('Novo evento em '+fmt(c.dataset.day)+': digite o título e salve')}
 f.querySelector('[name=t]').focus();window.scrollTo({top:0,behavior:SMOOTH()});
});
let PRIV=false;try{PRIV=localStorage.getItem('hub-priv')==='1'}catch(e){}
const BRL=v=>PRIV?'R$ •••••':(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const FC=['Moradia','Alimentação','Transporte','Saúde','Lazer','Educação','Assinaturas','Outros'];
const opts=a=>a.map(c=>`<option>${c}</option>`).join('');
const bst=p=>p>=100?'o':p>=80?'w':'';
const finAlerts=by=>Object.entries(S.fin.bud).map(([c,l])=>[c,Math.round((by[c]||0)/l*100)]).filter(x=>x[1]>=80);
const MC=['var(--pink)','#f2c7a5','var(--yellow)','var(--blue)','var(--green)'],MN=['Péssimo','Ruim','Ok','Bom','Ótimo'],EN=['Exausto','Baixa','Média','Alta','Máxima'];
const moodBtns=(d,k)=>`<div class="mood">${[1,2,3,4,5].map(n=>`<button class="mb${(S.dia[d]||{})[k]===n?' on':''}" style="background:${MC[n-1]}" data-a="mood" data-id="${n}" data-d="${d}" data-k="${k}" aria-pressed="${(S.dia[d]||{})[k]===n}">${n}<small>${(k==='m'?MN:EN)[n-1]}</small></button>`).join('')}</div>`;
function humorCard(){const e=S.dia[T]||{};return `<div class="panel" data-card="humor"><h2>Humor de hoje</h2>${moodBtns(T,'m')}<p class="empty" style="margin:8px 0 0">${e.m?'Registrado: '+MN[e.m-1]+'. ':'Como você está hoje? '}<button class="pill" data-v="diario">Abrir diário</button></p></div>`}
const dAvg=(k,n)=>{const v=[...Array(n)].map((_,i)=>(S.dia[ds(add(today,-i))]||{})[k]).filter(Boolean);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):'–'};
const trend=k=>`<div class="mchart" role="img" aria-label="${k==='m'?'Humor':'Energia'} dos últimos 30 dias">${[...Array(30)].map((_,i)=>{const d=ds(add(today,i-29)),v=(S.dia[d]||{})[k]||0;return `<i title="${fmt(d)}: ${v||'sem registro'}" style="height:${v?v/5*100:3}%;background:${v?MC[v-1]:'var(--card)'}"></i>`}).join('')}</div>`;
function insights(){
 const days=Object.keys(S.dia).filter(k=>S.dia[k].m),avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
 const cmp=(l,p)=>{const A=days.filter(p).map(k=>S.dia[k].m),B=days.filter(k=>!p(k)).map(k=>S.dia[k].m);return A.length<3||B.length<3?null:`${l}: humor médio ${avg(A).toFixed(1)} contra ${avg(B).toFixed(1)} nos outros dias.`};
 return [S.habits.length?cmp('Dias com todos os hábitos feitos',k=>S.habits.every(h=>h.log[k])):null,cmp('Dias com sessão de foco',k=>(S.fm[k]||0)>0),cmp('Dias em que bati a meta de tarefas',k=>doneOn(k)>=S.goal)].filter(Boolean)}
function diario(){
 if(S.dvw==='ano')return diarioAno();
 const dt=add(today,S.ddo),d=ds(dt),e=S.dia[d]||{},has=v=>v.m||v.e||v.a||v.b||v.c,ks=Object.keys(S.dia).filter(k=>has(S.dia[k])).sort().reverse().slice(0,8),ins=insights();
 const ta=(k,l,ph)=>`<label class="lb">${l}<textarea class="in ta" data-dk="${k}" data-dd="${d}" placeholder="${ph}">${esc(e[k]||'')}</textarea></label>`;
 return `<div class="top"><h1>Diário e humor</h1><div style="display:flex;gap:8px"><button class="pill" data-a="dnav" data-n="-1" aria-label="Dia anterior">‹</button><button class="pill" data-a="dnav" data-n="0">Hoje</button><button class="pill" data-a="dnav" data-n="1" aria-label="Próximo dia" ${S.ddo>=0?'disabled':''}>›</button><button class="pill" data-a="dvw" data-id="ano">Revisão do ano</button></div></div>
 <div class="cards"><div class="panel wide hero"><h2>${DIAF[dt.getDay()]}, ${dt.getDate()} de ${MESF[dt.getMonth()]}</h2><div class="lb" style="margin-top:0">Humor</div>${moodBtns(d,'m')}<div class="lb">Energia</div>${moodBtns(d,'e')}${ta('a','Como foi o dia','Escreva livremente…')}${ta('b','Três vitórias','Pequenas ou grandes…')}${ta('c','Gratidão','Pelo que você é grato hoje?')}</div>
 <div class="panel"><h2>Últimos 30 dias</h2><div class="lb" style="margin-top:0">Humor (média 7 dias: ${dAvg('m',7)} · 30 dias: ${dAvg('m',30)})</div>${trend('m')}<div class="lb">Energia (média 7 dias: ${dAvg('e',7)} · 30 dias: ${dAvg('e',30)})</div>${trend('e')}</div>
 <div class="panel"><h2>Padrões</h2>${ins.length?ins.map(x=>`<div class="item"><div class="t">${esc(x)}</div></div>`).join(''):'<p class="empty">Registre o humor por alguns dias, com e sem hábitos, foco e metas cumpridas (mínimo de 3 dias de cada), e os padrões aparecem aqui.</p>'}</div>
 ${moodSpend()}<div class="panel wide"><h2>Entradas recentes</h2>${ks.map(k=>{const v=S.dia[k];return `<button class="item" style="width:100%;border:0;text-align:left;cursor:pointer;color:inherit" data-a="dgo" data-id="${k}"><div class="t">${fmt(k)}${v.m?` <span class="chip" style="background:${MC[v.m-1]}">${MN[v.m-1]}</span>`:''}<small>${esc(plain(v.a||v.b||v.c||'').slice(0,100))}</small></div></button>`}).join('')||emp('dia','Nenhuma entrada ainda. Comece registrando seu humor de hoje.','Registrar hoje','data-a="dnav" data-n="0"')}</div></div>`;
}
document.addEventListener('keydown',e=>{const g=e.target.closest&&e.target.closest('.mood');if(g&&/^Arrow(Left|Right|Up|Down)$/.test(e.key)){const bs=[...g.querySelectorAll('button')],i=bs.indexOf(e.target),n=bs[(i+(/Left|Up/.test(e.key)?-1:1)+bs.length)%bs.length];if(n){e.preventDefault();bs.forEach(x=>x.tabIndex=-1);n.tabIndex=0;n.focus()}}});
document.addEventListener('keydown',e=>{const i=e.target;if(e.key==='Enter'&&i.dataset&&i.dataset.gdep){e.preventDefault();const x=parseFloat(String(i.value).replace(',','.')),g=S.fin.goals.find(y=>y.id===i.dataset.gdep);if(g&&x>0){g.saved+=x;render()}}});
const tagsU=x=>String(x.tg??x.g??'').split(',').map(s=>s.trim().replace(/^#/,'').toLowerCase()).filter(Boolean);
const normTags=s=>[...new Set(String(s||'').split(',').map(x=>x.trim().replace(/^#/,'').toLowerCase()).filter(Boolean))].join(', ');
const tagChips=x=>tagsU(x).map(t=>`<button class="chip tgc" data-a="tagv" data-id="${esc(t)}">#${esc(t)}</button>`).join('');
const TG=()=>[['tarefas','Tarefas',S.tasks],['eventos','Eventos',S.events],['notas','Notas',S.notes],['links','Links',S.links],['lançamentos','Lançamentos',S.fin.tx]];
function allTags(){const m={};TG().forEach(([k,,a])=>a.forEach(x=>tagsU(x).forEach(t=>{const o=m[t]=m[t]||{n:0};o[k]=(o[k]||0)+1;o.n++})));return m}
function fillTags(){const el=$('#alltags');if(el)el.innerHTML=Object.keys(allTags()).sort().map(t=>`<option value="${esc(t)}">`).join('')}
function renameTag(o,n){TG().forEach(([k,,a])=>a.forEach(x=>{const l=tagsU(x);if(!l.includes(o))return;const nl=[...new Set(l.map(t=>t===o?n:t).filter(Boolean))].join(', ');if(k==='notas')x.g=nl;else x.tg=nl}))}
function etiquetas(){
 const m=allTags(),ks=Object.keys(m).sort((a,b)=>m[b].n-m[a].n||a.localeCompare(b)),sel=m[S.tgsel]?S.tgsel:'';
 const grp=(ti,arr,fn)=>arr.length?`<div class="panel"><h2>${ti} (${arr.length})</h2>${arr.map(fn).join('')}</div>`:'';
 const btn='style="width:100%;border:0;text-align:left;cursor:pointer;color:inherit"';
 let body='';
 if(sel){const has=a=>a.filter(x=>tagsU(x).includes(sel));
  body=`<form class="bar" id="frtag"><input type="hidden" name="old" value="${esc(sel)}"><input class="in grow" name="nw" placeholder="Novo nome (deixe vazio para remover a etiqueta)"><button class="pill">Renomear em tudo</button></form><div class="cards">`
  +grp('Tarefas',has(S.tasks),t=>`<div class="item ${t.done?'done':''}"><input type="checkbox" class="chk" data-a="tog" data-id="${t.id}" ${t.done?'checked':''} aria-label="Concluir"><div class="t">${esc(t.t)}<small>${tkMeta(t)}</small></div></div>`)
  +grp('Eventos',has(S.events),e=>`<button class="item" ${btn} data-a="gotoday" data-id="${e.d}"><div class="t">${esc(e.t)}<small>${fmt(e.d)} às ${tr(e)}</small></div></button>`)
  +grp('Notas',has(S.notes),n=>`<button class="item" ${btn} data-a="tgnote" data-id="${esc(sel)}"><div class="t">${esc(n.t||'Sem título')}<small>${esc(plain(n.b).slice(0,90))}</small></div></button>`)
  +grp('Links',has(S.links),l=>`<a class="item" style="text-decoration:none;color:inherit" href="${esc(safeUrl(l.u))}" target="_blank" rel="noopener"><div class="t">${esc(l.n)}<small>${esc(l.cat||'Outros')}</small></div>↗</a>`)+grp('Lançamentos',has(S.fin.tx),t=>`<div class="item"><div class="t">${esc(t.t)}<small>${fmt(t.d)} · ${esc(t.cat)}</small></div><strong>${BRL(t.v)}</strong></div>`)+'</div>'}
 return `<div class="top"><h1>Etiquetas</h1></div>${ks.length?`<div class="bar">${ks.map(t=>`<button class="pill ${t===sel?'on':''}" data-a="tagv" data-id="${esc(t)}">#${esc(t)} <small>${m[t].n}</small></button>`).join('')}</div>`:''}${sel?body:ks.length?'<p class="empty">Escolha uma etiqueta para ver tudo o que está marcado com ela: tarefas, eventos, notas e links.</p>':emp('tg','Nenhuma etiqueta ainda. Adicione etiquetas em tarefas, eventos, notas e links.','Ir para Tarefas','data-v="tarefas"')}`;
}
function hItem(t){return `<div class="item ${t.done?'done':''}"><input type="checkbox" class="chk" data-a="tog" data-id="${t.id}" ${t.done?'checked':''} aria-label="Concluir"><div class="t">${esc(t.t)}<small>${tkMeta(t)}</small></div>${t.done?'':`<button class="x" data-a="snooze" data-id="${t.id}" aria-label="Adiar para amanhã" title="Adiar para amanhã">⇥</button><button class="x" data-a="focus" data-id="${t.id}" aria-label="Iniciar foco" title="Iniciar foco">▶</button>`}${t.hd===T&&!t.done?`<button class="x" data-a="plan" data-id="${t.id}" aria-label="Tirar de hoje" title="Tirar de hoje">−</button>`:''}</div>`}
function hoje(){
 const evs=withNow(evOn(T),T),real=evs.filter(e=>!e.now),nowm=mm(nowH());
 const od=S.tasks.filter(t=>!t.done&&t.due&&t.due<T),pl=S.tasks.filter(t=>!t.done&&(t.hd===T||t.due===T)),dn=S.tasks.filter(t=>t.done&&t.dd===T);
 const used=new Set([...od,...pl].map(t=>t.id)),sug=S.tasks.filter(t=>!t.done&&!used.has(t.id)).sort((a,b)=>'amb'.indexOf(a.p||'m')-'amb'.indexOf(b.p||'m')||(a.due||'9').localeCompare(b.due||'9')).slice(0,4);
 const hb=S.habits.filter(h=>h.log[T]).length,tot=od.length+pl.length+dn.length;
 const cur=real.find(e=>{const r=sp(e);return r[0]<=nowm&&nowm<r[1]}),nx=real.find(e=>sp(e)[0]>nowm);
 const msg=cur?`Agora: ${esc(cur.t)} (até ${hm(sp(cur)[1])})`:nx?`Próximo: ${esc(nx.t)} às ${nx.h} (em ${sp(nx)[0]-nowm} min)`:real.length?'Sem mais compromissos hoje.':'Nenhum evento hoje.';
 return `<div class="top"><h1>Hoje</h1><span class="empty" style="padding:0">${DIAF[today.getDay()]}, ${today.getDate()} de ${MESF[today.getMonth()]}</span></div>${focusBox()}
 <div class="rv4"><div class="stat c-y"><span>Compromissos</span><strong>${real.length}</strong></div><div class="stat c-p"><span>Tarefas feitas</span><strong>${dn.length}/${tot}</strong></div><div class="stat c-g"><span>Hábitos</span><strong>${hb}/${S.habits.length}</strong></div><div class="stat c-b"><span>Foco</span><strong>${S.fm[T]||0} min</strong></div></div>
 <div class="panel" style="margin-top:12px"><strong>${msg}</strong></div>
 <div class="cards" style="margin-top:12px">
 <div class="panel"><h2>Agenda de hoje</h2>${evs.map(e=>e.now?`<div class="now">${e.h}</div>`:`<div class="item"><span class="chip c-${e.c}">${tr(e)}</span><div class="t">${esc(e.t)}${e.cf?' <span class="neg">⚠ conflito</span>':''}</div></div>`).join('')||emp('ev','Nenhum evento hoje.','Novo evento','data-a="qat" data-id="ev"')}${real.length?`<button class="pill" data-a="gotoday" data-id="${T}">Ver na agenda</button>`:''}</div>
 <div class="panel hero"><h2>Tarefas do dia</h2><form class="bar" id="fhj"><input class="in grow" name="t" placeholder="Adicionar ao dia" required><button class="pill dark">Planejar</button></form>${od.length?`<h2 class="gh late">Atrasadas</h2>${od.slice(0,pgN('hod',15)).map(hItem).join('')}${pgMore('hod',od.length,15)}`:''}${pl.length?`<h2 class="gh">Para hoje</h2>${pl.map(hItem).join('')}`:''}${dn.length?`<h2 class="gh">Concluídas hoje</h2>${dn.map(hItem).join('')}`:''}${tot?'':emp('tk','Nada planejado ainda. Adicione tarefas ao seu dia.','','')}${sug.length?`<h2 class="gh">Sugestões</h2>${sug.map(t=>`<div class="item"><div class="t">${esc(t.t)}<small>${tkMeta(t)}</small></div><button class="pill" data-a="plan" data-id="${t.id}">+ hoje</button></div>`).join('')}`:''}</div>
 <div class="panel"><h2>Hábitos de hoje</h2>${S.habits.map(h=>`<div class="item"><input type="checkbox" class="chk" data-a="htog" data-id="${h.id}" data-d="${T}" ${h.log[T]?'checked':''} aria-label="${esc(h.n)}"><div class="t">${esc(h.n)}<small>${hstreak(h)} ${hstreak(h)===1?'dia':'dias'} seguidos</small></div></div>`).join('')||emp('hb','Nenhum hábito cadastrado.','Criar hábito','data-v="habitos"')}</div>
 ${duesPanel()}<div class="panel wide"><h2>Como você está</h2><div class="two"><div><div class="lb" style="margin-top:0">Humor</div>${moodBtns(T,'m')}</div><div><div class="lb" style="margin-top:0">Energia</div>${moodBtns(T,'e')}</div></div></div>
 </div>`;
}
const mDays=d=>Math.round((new Date(d+'T00:00')-new Date(T+'T00:00'))/864e5);
const linked=g=>S.tasks.filter(t=>t.mt===g.id);
function krProg(g,k){
 if(k.ty==='pc'){const r=finInit().prules.find(x=>x.id===k.ref);if(!r)return{p:0,txt:'Meta de percentual removida'};const t=+k.tg||6,m=prMonths(r);return{p:Math.min(1,m.met/t),txt:`${m.met} de ${t} meses cumpridos`}}
 if(k.ty==='sv'){const s=S.fin.goals.find(x=>x.id===k.ref);return s?{p:Math.min(1,s.saved/(s.target||1)),txt:BRL(s.saved)+' de '+BRL(s.target)}:{p:0,txt:'Meta de economia removida'}}
 if(k.ty==='man'){const t=+k.tg||1,c=+k.cur||0;return{p:Math.min(1,c/t),txt:`${c} de ${t}${k.un?' '+esc(k.un):''}`}}
 if(k.ty==='hb'){const h=S.habits.find(x=>x.id===k.ref);if(!h)return{p:0,txt:'Hábito removido'};const t=+k.tg||1,n=Object.keys(h.log).filter(d=>h.log[d]&&d>=g.ini&&d<=T).length;return{p:Math.min(1,n/t),txt:`${n} de ${t} dias cumpridos desde ${fmt(g.ini)}`}}
 const l=S.tasks.filter(t=>k.ty==='pj'?t.pj===k.ref:tagsU(t).includes(k.ref)),d=l.filter(t=>t.done).length;
 return{p:l.length?d/l.length:0,txt:`${d} de ${l.length} tarefas concluídas`}}
function metaProg(g){const a=g.kr.map(k=>krProg(g,k).p),l=linked(g);if(l.length)a.push(l.filter(t=>t.done).length/l.length);return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function srcOpts(){const pj=[...new Set(S.tasks.map(t=>t.pj).filter(Boolean))],tg=[...new Set(S.tasks.flatMap(tagsU))];return `<option value="man">Número manual</option>${pj.length?`<optgroup label="Projeto (tarefas)">${pj.map(p=>`<option value="pj:${esc(p)}">${esc(p)}</option>`).join('')}</optgroup>`:''}${tg.length?`<optgroup label="Etiqueta (tarefas)">${tg.map(p=>`<option value="tg:${esc(p)}">#${esc(p)}</option>`).join('')}</optgroup>`:''}${S.fin.goals.length?`<optgroup label="Meta de economia (Finanças)">${S.fin.goals.map(g=>`<option value="sv:${g.id}">${esc(g.n)}</option>`).join('')}</optgroup>`:''}${(S.fin.prules||[]).length?`<optgroup label="Meta de percentual (Finanças)">${S.fin.prules.map(r=>`<option value="pc:${r.id}">${esc(prName(r))}</option>`).join('')}</optgroup>`:''}${S.habits.length?`<optgroup label="Hábito (dias cumpridos)">${S.habits.map(h=>`<option value="hb:${h.id}">${esc(h.n)}</option>`).join('')}</optgroup>`:''}`}
function metaCard(g){
 const p=metaProg(g),pc=Math.round(p*100),l=linked(g),left=g.fim?mDays(g.fim):null;
 let st='';if(pc>=100)st='<span class="chip c-g">Concluída</span>';else if(g.fim){const tot=Math.max(1,mDays(g.fim)-mDays(g.ini)),exp=Math.min(1,Math.max(0,(tot-left)/tot));st=left<0?'<span class="chip c-p">Prazo vencido</span>':p+.15<exp?'<span class="chip c-y">Atrás do ritmo</span>':'<span class="chip c-b">No ritmo</span>'}
 const free=S.tasks.filter(t=>!t.done&&t.mt!==g.id);
 return `<div class="panel wide" data-lid="mt:${g.id}"><div class="top" style="margin:0 0 8px"><h2 style="margin:0">${esc(g.t)}</h2><span>${st}${lkBtn('mt',g.id)}<button class="x" data-a="delmeta" data-id="${g.id}" aria-label="Excluir meta">×</button></span></div>
 <div class="cat" style="grid-template-columns:1fr auto"><div class="fb ${st.includes('Atrás')?'w':st.includes('vencido')?'o':''}"><i style="width:${pc}%"></i></div><strong>${pc}%</strong></div>
 <p class="empty" style="padding:0 0 8px">${g.fim?(left<0?'Prazo em '+fmt(g.fim)+' (vencido há '+(-left)+' dias)':'Prazo em '+fmt(g.fim)+': faltam '+left+' dias'):'Sem prazo definido'}</p>
 ${g.kr.map(k=>{const r=krProg(g,k),q=Math.round(r.p*100);return `<div class="item"><div class="t">${esc(k.t)}<small>${r.txt} (${q}%)</small><div class="fb" style="margin-top:6px"><i style="width:${q}%"></i></div></div>${k.ty==='man'?`<button class="x" data-a="krm" data-id="${g.id}" data-k="${k.id}" data-n="-1" aria-label="Diminuir">−</button><input class="in" type="number" min="0" data-krset="${g.id}:${k.id}" value="${k.cur||0}" aria-label="Valor atual" style="width:80px"><button class="x" data-a="krm" data-id="${g.id}" data-k="${k.id}" data-n="1" aria-label="Aumentar">+</button>`:''}<button class="x" data-a="delkr" data-id="${g.id}" data-k="${k.id}" aria-label="Excluir resultado">×</button></div>`}).join('')}
 <form class="bar" data-kr="${g.id}" style="margin:8px 0"><select class="in" name="src" aria-label="Origem do progresso">${srcOpts()}</select><input class="in grow" name="t" placeholder="Resultado (opcional nos vínculos)"><input class="in" name="tg" type="number" min="1" placeholder="Alvo" style="width:90px"><input class="in" name="un" placeholder="unidade" style="width:100px"><button class="pill">Adicionar resultado</button></form>
 ${l.length?`<h2 class="gh">Tarefas vinculadas (${l.filter(t=>t.done).length}/${l.length})</h2>${l.map(t=>`<div class="item ${t.done?'done':''}"><input type="checkbox" class="chk" data-a="tog" data-id="${t.id}" ${t.done?'checked':''} aria-label="Concluir"><div class="t">${esc(t.t)}</div><button class="x" data-a="unmt" data-id="${t.id}" aria-label="Desvincular">×</button></div>`).join('')}`:''}
 ${free.length?`<form class="bar" data-mt="${g.id}" style="margin:8px 0 0"><select class="in grow" name="tk" aria-label="Tarefa">${free.map(t=>`<option value="${t.id}">${esc(t.t)}</option>`).join('')}</select><button class="pill">Vincular tarefa</button></form>`:''}</div>`;
}
function metaRev(){
 const f=new Date(today.getFullYear(),today.getMonth()+S.mro,1),k=ds(f).slice(0,7),r=S.revm[k]||{};
 const tk=S.tasks.filter(t=>t.done&&(t.dd||'').slice(0,7)===k).length,hd=new Set(S.habits.flatMap(h=>Object.keys(h.log).filter(d=>h.log[d]&&d.slice(0,7)===k))).size;
 const ms=Object.entries(S.dia).filter(([d,v])=>d.slice(0,7)===k&&v.m).map(([,v])=>v.m),mood=ms.length?(ms.reduce((a,b)=>a+b,0)/ms.length).toFixed(1):'–';
 const foc=Object.entries(S.fm).filter(([d])=>d.slice(0,7)===k).reduce((a,[,v])=>a+v,0),avg=S.metas.length?Math.round(S.metas.reduce((a,g)=>a+metaProg(g),0)/S.metas.length*100)+'%':'–';
 return `<div class="panel wide"><div class="top" style="margin:0 0 8px"><h2 style="margin:0">Revisão de ${MES[f.getMonth()]} ${f.getFullYear()}</h2><span><button class="x" data-a="mrn" data-n="-1" aria-label="Mês anterior">‹</button><button class="x" data-a="mrn" data-n="0">este mês</button><button class="x" data-a="mrn" data-n="1" aria-label="Próximo mês">›</button></span></div>
 <div class="rv4"><div class="stat c-p"><span>Tarefas concluídas</span><strong>${tk}</strong></div><div class="stat c-g"><span>Dias com hábitos</span><strong>${hd}</strong></div><div class="stat c-b"><span>Humor médio</span><strong>${mood}</strong></div><div class="stat c-y"><span>Foco · metas</span><strong>${foc} min · ${avg}</strong></div></div>
 <label class="lb">O que avançou nas metas<textarea class="in ta" data-rm="l" data-mo="${k}">${esc(r.l||'')}</textarea></label><label class="lb">Ajustes para o próximo mês<textarea class="in ta" data-rm="p" data-mo="${k}">${esc(r.p||'')}</textarea></label></div>`;
}
function metas(){
 return `<div class="top"><h1>Metas</h1></div><form class="bar" id="fmeta"><input class="in grow" name="t" placeholder="Nova meta (ex.: Ler 12 livros em 2026)" required><input class="in" type="date" name="fim" aria-label="Prazo" title="Prazo (opcional)"><button class="pill dark">Criar meta</button></form>
 <div class="cards">${S.metas.map(metaCard).join('')||`<div class="panel wide">${emp('mt','Nenhuma meta ainda. Defina um objetivo e ligue-o a projetos, etiquetas, hábitos e tarefas: o progresso sobe sozinho.','Criar meta','data-a="focusform" data-id="#fmeta"')}</div>`}${metaRev()}</div>`;
}
function metasCard(){const l=S.metas.map(g=>({g,p:metaProg(g)})).filter(x=>x.p<1).slice(0,3);return `<div class="panel" data-card="metas"><h2>Metas</h2>${l.map(x=>`<div class="cat" style="grid-template-columns:1fr auto;margin-bottom:4px"><span>${esc(x.g.t)}</span><small>${Math.round(x.p*100)}%</small></div><div class="fb" style="margin-bottom:10px"><i style="width:${x.p*100}%"></i></div>`).join('')||emp('mt','Defina metas e ligue-as a tarefas e hábitos.','Criar meta','data-v="metas"')}${l.length?'<button class="pill" data-v="metas">Abrir Metas</button>':''}</div>`}
document.addEventListener('change',e=>{const i=e.target;if(!i.dataset||!i.dataset.krset)return;const[g,k]=i.dataset.krset.split(':'),m=S.metas.find(x=>x.id===g),r=m&&m.kr.find(x=>x.id===k);if(r){r.cur=Math.max(0,+i.value||0);render()}});
