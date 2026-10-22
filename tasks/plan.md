# Plano: testes automáticos + questões em aberto do SPEC

Base: [SPEC.md](../SPEC.md) aprovado (commit `261b796`).

## Ordem

```
T1 tests/run.js ──┬──> T3 modo sem internet
                  └──> T4 pendências menores
                         ↓
                  T5 registrar decisões no SPEC (questões 1 e 5, sem código)
                         ↓
                  Publicar (com sua aprovação)
```

T2 (só e-mails autorizados) foi **retirada** por decisão sua: qualquer conta Google continua podendo criar o próprio hub, vazio e separado dos outros. As tarefas mantêm os números originais para não confundir com o que já foi conversado.

T1 vem primeiro porque é a rede de segurança das outras. T3 e T4 não dependem entre si, mas mexem no mesmo `index.html`, então vão em sequência, um commit cada. Nada é publicado até o fim; publicar continua pedindo aprovação (SPEC → Perguntar antes).

## T1 — `tests/run.js`

Um arquivo, Node 24, sem dependências:
- **Servidor:** servidor estático do próprio Node (`http`), em porta livre. Não depende do Python, que não está no PATH do Git Bash nesta máquina.
- **Firebase simulado:** gera em memória uma cópia do `index.html` com o mock injetado no `<body>` (nuvem e sessão em `localStorage`, para sobreviver a reload), `FB_CONFIG` de teste e `fbScript` que não baixa nada. É o mesmo mock já validado nesta sessão.
- **Navegador:** Chrome ou Edge headless via DevTools Protocol (`WebSocket` nativo do Node 24). Caminho por `CHROME_PATH` ou caminhos padrão do Windows.
- **Cenários** (SPEC → Estratégia de testes): 1 sem login bloqueia; 2 login grava `hub-meta` e `hub-0`; 3 mescla de outro aparelho; 4 troca A→B→A; 5 sair envia as últimas mudanças.
- Saída: `✓`/`✗` por cenário, código de saída ≠ 0 se algo falhar. Erros de JS da página também fazem falhar.

**Risco:** o tempo do mock (`setTimeout`) pode deixar algum teste instável. **Mitigação:** em vez de esperar um tempo fixo, esperar uma condição (`waitFor(expr)`) com prazo máximo.

## T3 — Abrir sem internet (questão 2)

- Se os scripts do Firebase não carregarem (`FB.err`) **e** já houve login neste aparelho (`SY.uid`), abrir o hub em modo só local, com o status "Somente neste aparelho (sem conexão)". Sem login anterior, continua a tela "Tentar de novo".
- Quando a conexão voltar, o próximo carregamento sincroniza normalmente. A mescla de três vias já cobre mudanças feitas offline.
- **Teste:** cenário 6, com `fbScript` falhando.

## T4 — Pendências menores (questão 4)

- **Corte de emoji:** se um pedaço terminar no meio de um par surrogate, recuar 1 caractere. Teste unitário dentro do `run.js` com um emoji exatamente na fronteira.
- Botão "Tentar de novo": trocar o `onclick` por `data-a="reload"`.
- Remover a chave antiga `hub-gd` do `localStorage` (1 linha).

## T5 — Registrar decisões no SPEC (questões 1 e 5, sem código)

- **Questão 1, quem pode entrar:** fica aberto a qualquer conta Google. Cada pessoa só acessa o próprio hub, garantido pelas regras do Firestore.
- **Questão 5, login no celular:** não fazer alternativa por redirecionamento. O `signInWithRedirect` não funciona de forma confiável quando o site (`github.io`) e o domínio de login do Firebase (`firebaseapp.com`) são diferentes, porque Safari e o Chrome recente bloqueiam o armazenamento entre sites. A correção oficial exige Firebase Hosting ou domínio próprio, o que vai contra o SPEC. O pop-up atual já mostra a mensagem "permita pop-ups".
- Depois de T1, atualizar também a seção Comandos do SPEC (`node tests/run.js` deixa de ser só proposta).

## Pontos de verificação

- Depois de T1: `node tests/run.js` passa os 5 cenários; removendo a linha do `acctSwap`, o cenário 4 falha.
- Depois de T3–T4: todos os cenários passam, com o site testado local e sem `FB_CONFIG`.
- Antes de publicar: site local com a config real carrega sem erros. Depois do `push`: conferir o site publicado (SPEC → Sempre).
