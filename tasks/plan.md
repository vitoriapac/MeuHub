# Plano: modularizar o Meu Hub

O plano anterior (testes, modo offline, pendências e decisões do SPEC) foi concluído e publicado. Ele está no histórico do git (commit `2f2fe3f`).

## Objetivo

Dividir o `index.html` (2.368 linhas: ~400 de CSS, ~1.950 de JS num único `<script>`) em arquivos por área, **sem mudar o comportamento** e **sem passo de build**. O site continua sendo publicado como está, no GitHub Pages.

O SPEC lista "dividir o `index.html`" em **Perguntar antes**. Este plano é essa pergunta. Ao final, a seção Estrutura do SPEC é atualizada.

## Decisões de arquitetura

1. **Scripts clássicos em ordem, não módulos ES.** Vários `<script src>` normais compartilham o mesmo escopo global. Assim `S`, `render()`, `$()` e os demais continuam visíveis em todos os arquivos, e o código é **movido, não reescrito**. Módulos ES (`import`/`export`) obrigariam a declarar cada dependência entre ~2.000 linhas de código denso, o que é uma reescrita com risco alto de quebrar algo sem ganho para quem usa o site.
2. **A ordem original é mantida.** Cada arquivo é um trecho contínuo do script atual, carregado na mesma sequência. Isso preserva a ordem dos listeners de eventos (alguns usam `stopPropagation`) e das constantes de nível superior.
3. **Sem build e sem npm** (SPEC → Stack). GitHub Pages serve os arquivos como estão.
4. **Versão nos links dos arquivos** (`js/core.js?v=AAAAMMDD`). O GitHub Pages guarda arquivos em cache por ~10 minutos. Sem a versão, um navegador poderia pegar o `index.html` novo com um `.js` antigo e quebrar. Um teste confere que todos os links usam a mesma versão.

## Grafo de dependências

```
css/style.css                         (independente)

js/core.js        estado S, utilidades, telas base, tarefas, agenda, notas, temas (linhas 422–896)
  └─ js/sync.js   motor de sincronização, Firebase, tela de login, troca de conta (897–1013)
       └─ js/financas.js     Finanças v2/v3, cascata, correções, integração, Pacotes D e E (1014–1438, 1751–1881)
            └─ js/recursos.js  abas, busca, desfazer, menu, acessibilidade, Pacotes A, B, C e F, datas (1439–1750, 1882–1981)
                 └─ js/inicio.js  Início visual, Spotify, clima, frase, tour (1982–2162)
                      └─ js/main.js  paginação, telas (V), render(), listeners centrais, inicialização (2163–2366)
```

As setas indicam a ordem de carregamento: cada arquivo pode usar o que veio antes. Ele também pode usar o que vem depois, mas **só dentro de funções chamadas mais tarde**, nunca em código que roda no carregamento. As Finanças aparecem em dois trechos (Pacotes D e E ficam depois dos Pacotes A–C). Elas só podem ser unidas num arquivo se nada dos Pacotes A–C depender delas no carregamento, e o T6 verifica isso.

## Tarefas

### Fase 1: preparar (ainda em um arquivo só)

- **T1. Testes para vários arquivos e teste de fumaça.** O servidor de teste passa a servir qualquer arquivo do projeto e aplica o Firebase simulado no arquivo que tiver `FB_CONFIG`, seja ele qual for. Novo cenário 9: abre cada tela do menu (`NAV`) e as abas das Finanças e confere que nenhuma dá erro de JS e que `#main` não fica vazio. É o cenário que pega uma função "perdida" na divisão.
- **T2. Apagar as 12 funções duplicadas.** Ficam só as últimas declarações, que são as que valem hoje: `busca`, `toast`, `qa`, `finMonth`, `financas` (3x), `finCard` (3x), `lineChart`, `invoice`, `payInv`, `finSubmit`, `impRows` e `summaryPanel`. O comportamento não muda. São ~100 linhas de código morto a menos, e a divisão deixa de depender de qual versão "ganha".

**Checkpoint 1:** 9 cenários passam; o site local abre sem erros com a config real; revisão com você.

### Fase 2: dividir (um arquivo por tarefa; o site funciona depois de cada uma)

- **T3. CSS → `css/style.css`.** O `<style>` vira `<link>`. O tema escuro e as cores precisam continuar iguais (captura de tela antes e depois, em claro e escuro).
- **T4. Script inteiro → `js/app.js`.** É a prova de que scripts externos funcionam nos testes, no site local e no GitHub Pages, antes de qualquer divisão. Inclui a versão no link e o teste das versões.
- **T5. `js/app.js` → `js/core.js` + `js/sync.js` + `js/main.js`.** Separa o começo (core), o motor de sincronização com o login e o fim (render e inicialização). Se algum comando de carregamento chamar uma função de arquivo posterior, só esse comando vai para o `main.js`.
- **T6. Finanças → `js/financas.js`.** Primeiro, os dois trechos são movidos mantendo a ordem. Depois, se o cenário 9 continuar passando, os Pacotes D e E são unidos ao resto das Finanças.
- **T7. O que sobrou → `js/recursos.js` e `js/inicio.js`.** Ao final, o `app.js` deixa de existir.

**Checkpoint 2:** 9 cenários passam; capturas de tela iguais às de antes; o `index.html` fica só com o HTML e os links.

### Fase 3: fechar

- **T8. Documentação e publicação.** Atualizar o SPEC (Estrutura, Estilo: "cada área no seu arquivo em `js/`; código novo de carregamento vai no `main.js`") e o README. Testar o site local com a config real e publicar (com sua aprovação). Conferir no site publicado que todos os arquivos carregam.

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Comando de carregamento chama função de arquivo posterior → erro na abertura | Alto | O cenário 9 abre todas as telas e falha com qualquer erro de JS. A correção é mover só aquele comando para o `main.js`. |
| Ordem dos listeners muda e um clique passa a ser tratado por outro handler | Médio | Os trechos mantêm a ordem original; os testes clicam em login, sair e "Tentar de novo". |
| Cache do GitHub Pages mistura versões | Médio | `?v=` igual em todos os links, com teste. |
| Modo artefato do Claude (`IN_CLAUDE`) deixa de funcionar como arquivo único | Médio | Ver a pergunta 1. |
| Mover trechos grandes sem querer altera algum caractere | Baixo | Mover com script (cortar por número de linha), nunca à mão. `git diff --stat` deve somar as mesmas linhas, e o diff de cada arquivo novo contra o trecho original deve ser vazio. |

## Decisões (22/10/2026)

1. **O modo artefato do Claude deixa de ser mantido.** A dona não usa mais o artefato. O T8 registra isso no SPEC (e tira a regra "manter funcionando como artefato"). O código `IN_CLAUDE` continua no lugar até um plano futuro decidir removê-lo.
2. **Scripts clássicos**, não módulos ES.
3. **Nomes dos arquivos em português.**

Plano aprovado.
