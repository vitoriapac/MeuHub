# Tarefas: modularizar o Meu Hub

Plano: [plan.md](plan.md). Comando de teste: `node tests/run.js`.

## Fase 1: preparar

- [x] **T1: testes servem vários arquivos + cenário 9 (todas as telas)**
  - Aceite: o servidor de teste serve qualquer arquivo e injeta o mock no arquivo que tem `FB_CONFIG`. O cenário 9 abre cada tela de `NAV` e as abas das Finanças sem erro de JS e com `#main` preenchido.
  - Verificar: 9 `✓`. Renomear uma função usada por uma tela (numa cópia) faz o cenário 9 falhar.
  - Depende de: nada · Arquivos: `tests/run.js` · Tamanho: S

- [x] **T2: apagar as 12 funções duplicadas (código morto)**
  - Aceite: cada função tem uma declaração só, a última, que já é a que vale hoje. Nenhuma outra linha muda.
  - Verificar: 9 `✓`; uma verificação automática mostra 0 funções declaradas 2x; site local com config real sem erros.
  - Depende de: T1 · Arquivos: `index.html` · Tamanho: S

### Checkpoint 1
- [x] 9 cenários passam · [x] site local sem erros · [ ] revisão com você

## Fase 2: dividir

- [x] **T3: CSS para `css/style.css`**
  - Aceite: `index.html` sem `<style>`; aparência igual em claro e escuro.
  - Verificar: 9 `✓`; capturas antes e depois (claro e escuro, 1280 px e 375 px).
  - Depende de: T2 · Arquivos: `index.html`, `css/style.css` · Tamanho: S

- [x] **T4: script inteiro para `js/app.js`, com `?v=`**
  - Aceite: `index.html` sem JS embutido; o link tem `?v=`; um teste confere que todos os links usam a mesma versão.
  - Verificar: 9 `✓` + teste da versão; o conteúdo do `js/app.js` é idêntico ao trecho original (diff vazio).
  - Depende de: T3 · Arquivos: `index.html`, `js/app.js`, `tests/run.js` · Tamanho: S

- [x] **T5: separar `js/core.js`, `js/sync.js` e `js/main.js`**
  - Aceite: os três carregam em ordem; nenhum erro na abertura; login, sincronização e troca de conta iguais.
  - Verificar: 9 `✓`; o diff dos trechos movidos contra o original é vazio (exceto comandos realocados, listados no commit).
  - Depende de: T4 · Arquivos: `index.html`, `js/app.js`, `js/core.js`, `js/sync.js`, `js/main.js` · Tamanho: M

- [x] **T6: Finanças para `js/financas.js`**
  - Aceite: todas as telas e abas das Finanças funcionam; os Pacotes D e E ficam no mesmo arquivo se o cenário 9 permitir, ou num segundo trecho registrado no plano.
  - Verificar: 9 `✓`; capturas da tela Finanças (Geral, Mês, Lançamentos) iguais às de antes.
  - Depende de: T5 · Arquivos: `index.html`, `js/app.js`, `js/financas.js` · Tamanho: M

- [x] **T7: o restante para `js/recursos.js` e `js/inicio.js`; `js/app.js` deixa de existir**
  - Aceite: `index.html` só com HTML e links; cada arquivo tem um comentário de uma linha dizendo o que contém.
  - Verificar: 9 `✓`; capturas do Início (com Spotify e Clima ligados) iguais às de antes.
  - Depende de: T6 · Arquivos: `index.html`, `js/app.js`, `js/recursos.js`, `js/inicio.js` · Tamanho: M

### Checkpoint 2
- [x] 11 cenários passam · [x] capturas iguais às de antes · [ ] revisão com você

## Fase 3: fechar

- [ ] **T8: SPEC, README e publicação**
  - Aceite: as seções Estrutura e Estilo do SPEC descrevem os arquivos novos; a decisão sobre o modo artefato (pergunta 1) está registrada.
  - Verificar: site local com config real sem erros → publicar (com sua aprovação) → no site publicado, todos os `.css`/`.js` respondem 200 e o login aparece.
  - Depende de: T7 · Arquivos: `SPEC.md`, `README.md` · Tamanho: S
