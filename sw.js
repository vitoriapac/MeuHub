// Service Worker do Meu Hub: guarda a casca do app e a fonte para abrir sem internet; Firebase e APIs vão direto à rede
const VER='20261022g',CACHE='meuhub-v'+VER;
const ASSETS=[
 './',
 './index.html',
 './manifest.webmanifest',
 './css/style.css?v='+VER,
 './js/core.js?v='+VER,
 './js/sync.js?v='+VER,
 './js/financas.js?v='+VER,
 './js/recursos.js?v='+VER,
 './js/inicio.js?v='+VER,
 './js/main.js?v='+VER,
 './img/icon.svg',
 './img/icon-192.png',
 './img/icon-512.png',
 './img/icon-maskable.png',
 './img/apple-touch-icon.png'
];
self.addEventListener('install',e=>{
 e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(u.origin!==self.location.origin){
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){
   e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{const cl=res.clone();caches.open(CACHE).then(c=>c.put(req,cl));return res})));
  }
  return;
 }
 if(req.mode==='navigate'){
  e.respondWith(fetch(req).then(res=>{if(res.ok&&!u.search){const cl=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',cl))}return res}).catch(()=>caches.match('./index.html').then(r=>r||caches.match('./'))));
  return;
 }
 e.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
  const w=cs.find(c=>c.url.startsWith(self.registration.scope));
  return w?w.focus():self.clients.openWindow('./');
 }));
});
