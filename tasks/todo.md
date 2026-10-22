# Tarefas

- [x] **T1: testes automáticos em `tests/run.js`**
  - Aceite: `node tests/run.js` roda os cenários 1–5 do SPEC em Chrome headless e sai com código 0. Um erro de JS na página faz falhar.
  - Verificar: rodar e ver 5 `✓`. Apagar a linha `acctSwap(...)` numa cópia faz o cenário 4 falhar.
  - Arquivos: `tests/run.js`, `README.md` (comando de teste), `SPEC.md` (Comandos)

- ~~T2: só e-mails autorizados~~ (retirada a pedido; ver T5)

- [x] **T3: abrir sem internet quando já houve login no aparelho**
  - Aceite: com `FB.err` e `SY.uid`, o hub abre só local, com aviso no status. Sem `SY.uid`, continua "Tentar de novo".
  - Verificar: cenário 6 no `run.js` (os dois casos).
  - Arquivos: `index.html`, `tests/run.js`

- [ ] **T4: pendências menores da revisão**
  - Aceite: a divisão dos dados nunca corta um emoji ao meio; "Tentar de novo" usa `data-a`; a chave `hub-gd` é removida.
  - Verificar: teste do emoji na fronteira no `run.js`; todos os cenários passam.
  - Arquivos: `index.html`, `tests/run.js`

- [ ] **T5: registrar no SPEC as decisões das questões 1 e 5** (sem código)
  - Aceite: as questões 1 (login aberto a qualquer conta Google) e 5 (sem redirecionamento no celular) viram decisões registradas, com o motivo.
  - Arquivos: `SPEC.md`

- [ ] **Publicar** (só com sua aprovação)
  - Verificar: `push`, depois conferir o site publicado (Firebase carrega, sem erros, tela de login).
