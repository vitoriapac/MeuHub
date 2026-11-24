// Testes unitários rápidos (Node 24+, sem dependências) para lógica pura de core.js, sync.js e financas.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createAppSandbox() {
  const store = new Map();
  const noop = () => {};
  const makeEl = () => ({
    style: { setProperty: noop, removeProperty: noop },
    dataset: {},
    classList: { toggle: noop, add: noop, remove: noop, contains: () => false },
    setAttribute: noop,
    removeAttribute: noop,
    append: noop,
    prepend: noop,
    remove: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    innerHTML: '',
    textContent: ''
  });

  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const ctx = {
    console,
    Math,
    Date,
    JSON,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    Number,
    String,
    Boolean,
    Promise,
    Error,
    parseInt,
    parseFloat,
    isFinite,
    isNaN,
    CompressionStream,
    DecompressionStream,
    TextEncoder,
    Response,
    btoa,
    atob,
    setTimeout: noop,
    clearTimeout: noop,
    setInterval: noop,
    clearInterval: noop,
    localStorage,
    navigator: { language: 'pt-BR' },
    location: { search: '', pathname: '/' },
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    document: {
      documentElement: makeEl(),
      head: makeEl(),
      body: makeEl(),
      activeElement: makeEl(),
      hidden: false,
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: makeEl,
      addEventListener: noop
    },
    addEventListener: noop,
    auditClean: (h) => (Array.isArray(h) ? h : []),
    snaps: () => [],
    SNK: 'hub-snaps',
    AUDIT_KEY: 'hub-history',
    PROFILE_KEY: 'hub-view-profiles',
    PRIV: false,
    normTags: (s) => String(s || '').split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean).join(', '),
    tagsU: () => [],
    applyTheme: noop,
    applyA11y: noop,
    render: noop,
    track: noop,
    toast: noop,
    undoReset: noop,
    nowH: () => '12:00'
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;

  vm.createContext(ctx);
  for (const file of ['js/core.js', 'js/sync.js', 'js/financas.js', 'js/financas-import.js', 'js/financas-invest.js']) {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(code, ctx, { filename: file });
  }
  return vm.runInContext(
    '({ S, SY, saveSY, localStorage, esc, ds, fmt, withTimeout, taskPaused, goalTracks, storageSummary, saveUI, gzipStr, ungzipStr, gzipBin, ungzipVal, idbKey, diaArchiveYear, SK, DOMS, chunks, merge3, norm, num, simulatedCardCycle, simulatePurchase, parseFinNL, parseNL, parseCSV, parseOFX, finInit, applyRules, finArchiveYear, FC, dictCat, dictSub, histCat, invInit, invUsd, invUnitBrl, invValBrl, invParseSheetId, invExtractSheetPrices })',
    ctx
  );
}

const app = createAppSandbox();

test('core: esc, ds, fmt e normTags básicos', () => {
  assert.equal(app.esc('<script>"a"&\'b\'</script>'), '&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/script&gt;');
  assert.equal(app.ds(new Date(2026, 10, 5)), '2026-11-05');
  assert.equal(app.fmt('2026-11-05'), '05 nov');
});

test('sync: chunks não divide par surrogate de emoji ao meio', () => {
  const emoji = '😀'; // 2 code units UTF-16
  const input = 'abc' + emoji + 'def';
  const parts = app.chunks(input, 4); // índice 4 cairia no meio de 😀
  assert.equal(parts.join(''), input);
  for (const p of parts) {
    assert.ok(!/[\uD800-\uDBFF]$/.test(p), 'chunk não deve terminar em high surrogate');
    assert.ok(!/^[\uDC00-\uDFFF]/.test(p), 'chunk não deve começar em low surrogate');
  }
});

test('sync: merge3 mescla alterações independentes e detecta conflito no mesmo campo', () => {
  const base = {
    tasks: [
      { id: 't1', t: 'Original', done: false },
      { id: 't2', t: 'Apagar no remoto', done: false }
    ],
    goal: 3
  };
  const local = {
    tasks: [
      { id: 't1', t: 'Original', done: true },
      { id: 't2', t: 'Apagar no remoto', done: false },
      { id: 't3', t: 'Criada local', done: false }
    ],
    goal: 3
  };
  const remote = {
    tasks: [
      { id: 't1', t: 'Original', done: false },
      { id: 't4', t: 'Criada remoto', done: false }
    ],
    goal: 5
  };

  const conflicts = [];
  const merged = app.merge3(base, local, remote, conflicts);
  assert.equal(conflicts.length, 0);
  assert.equal(merged.goal, 5);
  assert.deepEqual(
    [...merged.tasks.map((t) => t.id)].sort(),
    ['t1', 't3', 't4']
  );
  assert.equal(merged.tasks.find((t) => t.id === 't1').done, true);

  const c2 = [];
  const conflictMerge = app.merge3({ a: 1 }, { a: 2 }, { a: 3 }, c2);
  assert.equal(c2.length, 1);
  assert.equal(conflictMerge.a, 2); // mantém local em conflito
});

test('financas: norm e num tratam acentos e separadores brasileiros', () => {
  assert.equal(app.norm('Alimentação & Café'), 'alimentacao & cafe');
  assert.equal(app.num('R$ 1.234,56'), 1234.56);
  assert.equal(app.num('1.000'), 1000);
  assert.equal(app.num('49.90'), 49.9);
});

test('financas: simulatedCardCycle respeita fechamento e virada de mês', () => {
  const card = { id: 'c1', ty: 'card', close: 20, due: 5 };
  const beforeClose = app.simulatedCardCycle('2026-11-15', card);
  assert.equal(beforeClose.closing, '2026-11-20');
  assert.equal(beforeClose.payment, '2026-12-05');

  const afterClose = app.simulatedCardCycle('2026-11-25', card);
  assert.equal(afterClose.closing, '2026-12-20');
  assert.equal(afterClose.payment, '2027-01-05');
});

test('financas: simulatePurchase calcula parcelas, juros e saldo mínimo sem mutar estado', () => {
  const fin = {
    acc: [{ id: 'cc1', ty: 'cc', n: 'Conta', ini: 1000 }],
    tx: [{ id: 'x1', k: 'out', ac: 'cc1', v: 200, d: '2026-11-25' }]
  };
  const res = app.simulatePurchase(fin, 'cc1', '2026-11-22', 30000, 3, 0, '2026-11-22', '');
  assert.equal(res.total, 30000); // em centavos
  assert.equal(res.schedule.length, 3);
  assert.equal(res.base, 80000); // 1000 - 200 = 800,00
  assert.equal(res.scenario, 50000); // 800 - 300 = 500,00
  assert.equal(fin.tx.length, 1); // não muta fin.tx
});

test('financas: parseFinNL extrai descrição, valor e hashtags', () => {
  const parsed = app.parseFinNL('Almoço no mercado R$ 45,90 #alimentacao', '', false);
  assert.equal(parsed.t, 'Almoço no mercado');
  assert.equal(parsed.v, '45,90');
  assert.equal(parsed.tg, 'alimentacao');
});

test('financas: parseCSV e parseOFX processam extratos com segurança', () => {
  const rows = app.parseCSV('Data;Descrição;Valor\n20/11/2026;"Mercado; Central";-125,50\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], 'Mercado; Central');

  const ofx = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
    <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261120120000<TRNAMT>-89.90<FITID>123<NAME>Padaria &amp; Café</STMTTRN>
  </BANKTRANLIST><LEDGERBAL><BALAMT>1500.00</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const parsed = app.parseOFX(ofx);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].dt, '2026-11-20');
  assert.equal(parsed.items[0].amt, -89.9);
  assert.equal(parsed.items[0].desc, 'Padaria & Café');
  assert.equal(parsed.balAmt, 1500);
});

test('financas-invest: conversão USD/BRL, parse de sheetId e extração de cotações CSV', () => {
  const inv = app.invInit({ acc: [], tx: [] });
  inv.cfg.usd = 5.5;
  assert.equal(app.invUsd(inv), 5.5);
  assert.equal(app.invUnitBrl({ price: 10, cur: 'USD' }, 5.5), 55);
  assert.equal(app.invValBrl({ qty: 2, price: 10, cur: 'USD' }, 5.5), 110);

  const sid = app.invParseSheetId('https://docs.google.com/spreadsheets/d/1a3EeYg_p0w2aD_EJXr4s5KAxcrI1yfriUgPbOb2qovM/edit');
  assert.equal(sid, '1a3EeYg_p0w2aD_EJXr4s5KAxcrI1yfriUgPbOb2qovM');

  const res = app.invExtractSheetPrices('Ativo,Cotação\nPETR4,"R$ 38,50"\nIVVB11,"R$ 320,00"\n');
  assert.equal(res.prices.PETR4, 38.5);
  assert.equal(res.prices.IVVB11, 320);
});

test('segurança: todos os hosts de fetch() em js/*.js estão liberados no connect-src da CSP', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const cspMatch = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  assert.ok(cspMatch, 'CSP meta tag deve existir em index.html');
  const connectDir = cspMatch[1].split(';').map((s) => s.trim()).find((s) => s.startsWith('connect-src '));
  assert.ok(connectDir, 'connect-src deve existir na CSP');
  const allowed = connectDir.slice('connect-src '.length).split(/\s+/);

  const jsDir = path.join(ROOT, 'js');
  const hosts = new Set();
  for (const file of fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(jsDir, file), 'utf8');
    for (const m of src.matchAll(/fetch\(\s*['"]https:\/\/([^/'"]+)/g)) {
      hosts.add(m[1]);
    }
    if (src.includes("wikipedia.org/w/api.php")) {
      hosts.add('pt.wikipedia.org');
      hosts.add('en.wikipedia.org');
    }
  }
  assert.ok(hosts.size > 0, 'Deve encontrar hosts externos em fetch()');
  for (const host of hosts) {
    const ok = allowed.some((entry) => entry === 'https://' + host || (entry.startsWith('https://*.') && host.endsWith(entry.slice('https://*'.length))));
    assert.ok(ok, `Host https://${host} usado em fetch() não está liberado no connect-src da CSP`);
  }
});

test('design: style.css usa tokens sem cor solta #b9b3a2, preserva opacidade de placeholders e tem @media print', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
  assert.ok(!css.includes('#b9b3a2'), 'Cor fixa #b9b3a2 deve ser substituída por token derivado de --sideink');
  assert.ok(css.includes('.in::placeholder{color:var(--mute);opacity:1}'), 'Placeholders devem usar --mute com opacity: 1');
  assert.ok(css.includes('@media print{'), 'Folha de impressão @media print deve estar presente');
});

test('core: withTimeout resolve resultado e limpa timer', async () => {
  const res = await app.withTimeout(500, async (signal) => {
    assert.ok(signal === undefined || typeof signal.aborted === 'boolean');
    return 42;
  });
  assert.equal(res, 42);
});

test('core: goalTracks e taskPaused respeitam meta arquivada, vínculo e série', () => {
  const prevTasks = app.S.tasks;
  const prevMetas = app.S.metas;
  const prevLnk = app.S.lnk;
  try {
    app.S.metas = [
      { id: 'm1', archived: true, pausedTaskIds: ['t1'], kr: [{ ty: 'pj', ref: 'Casa' }] },
      { id: 'm2', archived: false, kr: [] }
    ];
    app.S.lnk = [{ a: 'mt:m1', b: 'tk:t3' }];
    app.S.tasks = [
      { id: 't1', done: false },
      { id: 't2', done: false, pj: 'Casa' },
      { id: 't3', done: false },
      { id: 't4', done: false, mt: 'm2' },
      { id: 't5', done: false, seriesId: 's1' },
      { id: 't6', done: true, seriesId: 's1', archived: true }
    ];
    assert.equal(app.goalTracks(app.S.metas[0], app.S.tasks[1]), true);
    assert.equal(app.goalTracks(app.S.metas[0], app.S.tasks[2]), true);
    assert.equal(app.taskPaused(app.S.tasks[0]), true);
    assert.equal(app.taskPaused(app.S.tasks[1]), true);
    assert.equal(app.taskPaused(app.S.tasks[2]), true);
    assert.equal(app.taskPaused(app.S.tasks[3]), false);
    assert.equal(app.taskPaused(app.S.tasks[4]), true);
  } finally {
    app.S.tasks = prevTasks;
    app.S.metas = prevMetas;
    app.S.lnk = prevLnk;
  }
});

test('financas: applyRules categoriza lançamentos respeitando prioridade e modo sobrescrever', () => {
  const prevFin = app.S.fin;
  try {
    app.S.fin = {
      acc: [{ id: 'main', n: 'Conta', ty: 'cc', ini: 0 }],
      tx: [
        { id: '1', k: 'out', t: 'UBER *TRIP', v: 25, cat: 'Outros', d: '2026-11-20', ac: 'main' },
        { id: '2', k: 'out', t: 'UBER EATS', v: 60, cat: 'Lazer', d: '2026-11-20', ac: 'main' }
      ],
      rules: [
        { id: 'r1', ty: 'out', md: 'c', m: 'uber eats', cat: 'Alimentação', sub: 'Delivery', on: true },
        { id: 'r2', ty: 'out', md: 'c', m: 'uber', cat: 'Transporte', sub: 'App', on: true }
      ]
    };
    const changedAuto = app.applyRules(false);
    assert.equal(changedAuto, 1);
    assert.equal(app.S.fin.tx[0].cat, 'Transporte');
    assert.equal(app.S.fin.tx[1].cat, 'Lazer');

    const changedAll = app.applyRules(true);
    assert.equal(changedAll, 1);
    assert.equal(app.S.fin.tx[1].cat, 'Alimentação');
    assert.equal(app.S.fin.tx[1].sub, 'Delivery');
  } finally {
    app.S.fin = prevFin;
  }
});

test('core: storageSummary exibe uso de armazenamento', () => {
  const html = app.storageSummary();
  assert.ok(html.includes('data-storage-usage'));
  assert.ok(html.includes('Espaço usado neste navegador:'));
});

test('core: saveUI persiste apenas chaves leves de navegação em hub-ui', () => {
  const prevView = app.S.view;
  try {
    app.S.view = 'financas';
    app.saveUI();
    const ui = JSON.parse(app.localStorage.getItem('hub-ui'));
    assert.equal(ui.view, 'financas');
    assert.equal('tasks' in ui, false);
    assert.equal('fin' in ui, false);
  } finally {
    app.S.view = prevView;
  }
});

test('sync: DOMS particiona todas as chaves de SK sem omissões ou duplicidades', () => {
  const all = Object.values(app.DOMS).flat();
  assert.equal(all.length, app.SK.length);
  assert.deepEqual([...new Set(all)].sort(), [...app.SK].sort());
});

test('financas: finArchiveYear consolida saldo nas contas e preserva ano atual', () => {
  const prevFin = app.S.fin;
  try {
    app.S.fin = {
      acc: [
        { id: 'c1', n: 'Conta', ty: 'cc', ini: 100 },
        { id: 'c2', n: 'Reserva', ty: 'cc', ini: 0 }
      ],
      tx: [
        { id: '1', k: 'in', v: 500, d: '2024-03-10', ac: 'c1' },
        { id: '2', k: 'out', v: 120.5, d: '2024-06-15', ac: 'c1' },
        { id: '3', k: 'tr', v: 80, d: '2024-09-01', ac: 'c1', to: 'c2' },
        { id: '4', k: 'out', v: 50, d: '2026-11-10', ac: 'c1' }
      ]
    };
    assert.equal(app.finArchiveYear(2026), false); // ano atual não arquiva
    assert.equal(app.finArchiveYear(2024), true);
    assert.equal(app.S.fin.acc[0].ini, 100 + 500 - 120.5 - 80); // 399.5
    assert.equal(app.S.fin.acc[1].ini, 80);
    assert.equal(app.S.fin.tx.length, 1);
    assert.equal(app.S.fin.tx[0].id, '4');
    assert.equal(app.S.fin.archives[0].year, 2024);
    assert.equal(app.S.fin.archives[0].count, 3);
  } finally {
    app.S.fin = prevFin;
  }
});

test('core: gzipStr e ungzipStr preservam texto e mantêm compatibilidade com texto simples', async () => {
  const sample = 'Meu Hub — '.repeat(80);
  const packed = await app.gzipStr(sample);
  const restored = await app.ungzipStr(packed);
  assert.equal(restored, sample);
  assert.equal(await app.ungzipStr('{"plain":true}'), '{"plain":true}');
});

test('core: diaArchiveYear arquiva anos anteriores e preserva o ano atual', () => {
  const prevDia = app.S.dia;
  const prevArch = app.S.diaArchives;
  try {
    app.S.dia = {
      '2024-05-01': { a: 'Dia antigo 1', m: 4 },
      '2024-12-31': { a: 'Dia antigo 2', m: 5 },
      '2026-11-20': { a: 'Hoje', m: 4 }
    };
    app.S.diaArchives = [];
    assert.equal(app.diaArchiveYear(2026), false);
    assert.equal(app.diaArchiveYear(2024), true);
    assert.deepEqual(Object.keys(app.S.dia), ['2026-11-20']);
    assert.equal(app.S.diaArchives[0].year, 2024);
    assert.equal(app.S.diaArchives[0].count, 2);
  } finally {
    app.S.dia = prevDia;
    app.S.diaArchives = prevArch;
  }
});

test('core: gzipBin e ungzipVal preservam texto em Uint8Array e mantêm compatibilidade', async () => {
  const sample = 'Armazenamento Meu Hub — '.repeat(60);
  const packed = await app.gzipBin(sample);
  assert.equal(packed.__gz, 1);
  assert.ok(ArrayBuffer.isView(packed.b));
  assert.equal(await app.ungzipVal(packed), sample);
  const legacy = await app.gzipStr(sample);
  assert.equal(await app.ungzipVal(legacy), sample);
});

test('core: idbKey isola chaves por uid e suporta escopo global', () => {
  const prevUid = app.SY.uid;
  try {
    app.SY.uid = '';
    assert.equal(app.idbKey('hub-v1'), 'local:hub-v1');
    app.SY.uid = 'user123';
    assert.equal(app.idbKey('hub-v1'), 'user123:hub-v1');
    assert.equal(app.idbKey('acct-A', true), 'global:acct-A');
  } finally {
    app.SY.uid = prevUid;
  }
});

test('sync: saveSY omite last e domLast do localStorage preservando em memória', () => {
  const prevLast = app.SY.last;
  const prevDom = app.SY.domLast;
  try {
    app.SY.last = '{"tasks":[]}';
    app.SY.domLast = { core: '{"tasks":[]}' };
    app.saveSY();
    const raw = JSON.parse(app.localStorage.getItem('hub-sync'));
    assert.equal('last' in raw, false);
    assert.equal('domLast' in raw, false);
    assert.equal(raw.hasBase, true);
    assert.equal(app.SY.last, '{"tasks":[]}');
  } finally {
    app.SY.last = prevLast;
    app.SY.domLast = prevDom;
  }
});

test('financas: novas categorias, desambiguação no dicionário e histórico por descrição limpa', () => {
  for (const c of ['Compras', 'Férias', 'Serviços', 'Pets', 'Impostos e taxas']) {
    assert.ok(app.FC.includes(c), `FC deve incluir ${c}`);
  }
  assert.equal(app.dictCat('PAG*MERCADOLIVRE'), 'Compras');
  assert.equal(app.dictSub('PAG*MERCADOLIVRE', 'out', 'Compras'), 'Online');
  assert.equal(app.dictCat('Shopee Brasil'), 'Compras');
  assert.equal(app.dictCat('Renner Shopping'), 'Compras');
  assert.equal(app.dictSub('Renner Shopping', 'out', 'Compras'), 'Vestuário');
  assert.equal(app.dictCat('Uber Eats'), 'Alimentação');
  assert.equal(app.dictCat('Uber One'), 'Assinaturas');
  assert.equal(app.dictCat('Passagem aerea Latam'), 'Férias');
  assert.equal(app.dictSub('Passagem aerea Latam', 'out', 'Férias'), 'Passagens');
  assert.equal(app.dictCat('Airbnb Hospedagem'), 'Férias');
  assert.equal(app.dictSub('Airbnb Hospedagem', 'out', 'Férias'), 'Hospedagem');
  assert.equal(app.dictCat('Barbearia Central'), 'Serviços');
  assert.equal(app.dictCat('Petz Racao'), 'Pets');
  assert.equal(app.dictCat('IOF compra internacional'), 'Impostos e taxas');
  assert.equal(app.dictCat('Kalunga'), 'Educação');

  const prevFin = JSON.stringify(app.S.fin);
  try {
    app.S.fin = {
      acc: [{ id: 'main', n: 'Conta principal', ty: 'cc', ini: 0 }],
      rec: [], recDismiss: [], rules: [], bud: {}, budHist: {}, goals: [], prules: [], split: [], bills: [],
      tx: [{ id: 'h1', k: 'out', t: 'Joao Silva', v: 50, cat: 'Serviços', sub: 'Manutenção', d: '2026-11-01', ac: 'main' }]
    };
    const h = app.histCat('Pagamento com Pix Joao Silva', 'out');
    assert.equal(h.cat, 'Serviços');
    assert.equal(h.sub, 'Manutenção');
  } finally {
    app.S.fin = JSON.parse(prevFin);
  }
});
