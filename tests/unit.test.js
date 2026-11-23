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
    '({ esc, ds, fmt, chunks, merge3, norm, num, simulatedCardCycle, simulatePurchase, parseFinNL, parseNL, parseCSV, parseOFX, invInit, invUsd, invUnitBrl, invValBrl, invParseSheetId, invExtractSheetPrices })',
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
