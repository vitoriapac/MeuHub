# Spec: Meu Hub

Status: **aprovado** (21/10/2026) · Atualizado: 22/10/2026, modularização (`tasks/plan.md`)

## Objetivo

Painel pessoal (tarefas, agenda, hábitos, notas, finanças, Spotify, clima…) que a dona do projeto e pessoas próximas usam no navegador, em vários aparelhos, cada uma com o próprio hub.

**Usuários:** a dona (Vitória) e família/amigos. Não é um produto público: não há suporte, cadastro aberto divulgado nem cobrança.

**Sucesso:**
- Entrar com um clique ("Entrar com o Google") e ver o próprio hub em qualquer aparelho.
- O que é feito num aparelho aparece nos outros sem passo manual.
- Nenhuma pessoa vê, recebe ou sobrescreve dados de outra, nem no mesmo navegador.
- Nada se perde: conflitos entre aparelhos são mesclados item a item e há backup local e em arquivo.

## Funcionalidades atuais (linha de base)

| Área | O que faz |
|---|---|
| Login | Tela inicial bloqueia o hub até entrar com Google (Firebase Auth). Sessão fica salva no aparelho até "Sair da conta". Sem `FB_CONFIG`, o site abre direto, só local. |
| Sincronização | Estado do hub em `data/users/<uid>/hub-0..n` + `hub-meta` no Firestore, em pedaços de 300 mil caracteres. Envio 2 s após a última mudança; escuta só `hub-meta`. Mescla de três vias (`merge3`) quando dois aparelhos mudam. |
| Troca de conta | Dados locais da conta anterior guardados em `hub-acct-<uid>` e restaurados quando ela volta. |
| Menu | Início, Hoje, Rotina, Lembretes, Agenda, Tarefas, Metas, Hábitos, Notas, Diário, Links, Etiquetas, Finanças, Aparência, Backup, Lixeira, Leituras, Personalizar menu. |
| Cards do Início | Seu dia, Frase do dia, Spotify, Clima, Produtividade, Próximos eventos, Para fazer, Links rápidos, Notas recentes, Revisão semanal, Histórico, Hábitos, Finanças do mês, Humor, Metas. Spotify e Clima vêm desligados (Personalizar painel). |
| Spotify | Link de playlist/álbum/faixa → player oficial embutido (`open.spotify.com/embed`), carregado só ao clicar. |
| Clima | Busca de cidade ou localização → Open-Meteo (sem chave). Só coordenadas saem do aparelho. |
| Backup | Baixa/importa JSON (importar mescla sem apagar); cópias automáticas antes de receber dados de outro aparelho. |
| Artefato Claude | **Não mantido** desde 22/10/2026 (ver Decisões 6). O código `IN_CLAUDE` continua no lugar, mas não é testado nem publicado. |

## Stack

- HTML + CSS + JS puro em **scripts clássicos** (`<script src>` em ordem, mesmo escopo global), ~2.300 linhas no total. Sem build, sem npm, sem framework.
- Firebase JS SDK **compat 10.12.2** (app, auth, firestore) via `www.gstatic.com`, carregado só no site.
- Fonte Outfit (Google Fonts). APIs externas: Open-Meteo, Spotify embed.
- Hospedagem: GitHub Pages, branch `main`, raiz → https://vitoriapac.github.io/MeuHub/
- Projeto Firebase `meuhub-48efb` (plano Spark, gratuito). Firestore em `southamerica-east1`.

## Comandos

```
Rodar local:   python -m http.server 8080        (na pasta do projeto; abre http://localhost:8080)
Publicar:      git push origin main               (Pages publica em ~1 min)
Testar:        node tests/run.js                  (~50 s; CHROME_PATH se o navegador não for achado)
```

## Estrutura

```
index.html         → só o HTML da casca e os links, na ordem de carregamento
css/style.css      → toda a aparência (tema claro/escuro por variáveis)
js/core.js         → estado S, utilidades, telas base (tarefas, agenda, notas, hábitos, temas), atalhos
js/sync.js         → sincronização, Firebase, tela de login, troca de conta
js/financas.js     → Finanças inteiras (inclui fluxo de caixa, reserva, divisão de despesas)
js/recursos.js     → busca, desfazer, menu, acessibilidade, lixeira, lembretes, rotina, leituras, paleta, datas
js/inicio.js       → Início, Spotify, clima, frase do dia, tour
js/main.js         → telas (V), render(), listeners centrais e inicialização — sempre o último
README.md          → configuração do Firebase e uso
SPEC.md            → esta especificação
tests/run.js       → testes ponta a ponta com Chrome headless + Firebase simulado
tasks/             → plano e tarefas do trabalho em andamento
.claude/launch.json→ servidor local do app Claude (não versionado)
```

## Estilo de código

Seguir o que o arquivo já faz: JS compacto, nomes curtos já estabelecidos (`S` estado, `render()`, `$()` seletor, `esc()` escapar HTML, `toast()` aviso), template strings para HTML, ações por `data-a` tratadas no listener central de `click`/`submit`, textos da interface em português.

```js
/* outra conta no mesmo aparelho: guarda à parte os dados locais da anterior e traz os da nova */
function acctSwap(from,to){const ls=localStorage,ks=['hub-v1','hub-sync',SNK];
 try{ls.setItem('hub-acct-'+from,JSON.stringify(ks.map(k=>ls.getItem(k))))}catch(e){FB.auth.signOut();toast('Não há espaço neste navegador para trocar de conta. Faça um Backup e tente de novo.');return}
 ...}
```

- Comentário de uma linha só para o **porquê**.
- Todo texto vindo do usuário ou de API externa passa por `esc()` antes de ir para `innerHTML`.
- Botões novos usam `data-a="acao"`, não `onclick`.
- Cores só por variáveis CSS (`--bg`, `--card`, `--ink`…), com tema claro e escuro.
- Código novo vai no arquivo da sua área em `js/`. Os arquivos compartilham o escopo global e carregam em ordem: um arquivo pode **chamar** função de outro carregado depois só dentro de funções que rodam mais tarde (clique, render). **Comando que roda no carregamento e usa algo de outro arquivo vai no fim do `main.js`** (ex.: `fbInit()`).
- Ao mudar qualquer `css/` ou `js/`, trocar o `?v=` de **todos** os links no `index.html` para a data do dia (`AAAAMMDD`, com sufixo se publicar 2x no dia). Sem isso, o cache do GitHub Pages (~10 min) pode misturar arquivos novos e velhos.

## Estratégia de testes

Implementado em `tests/run.js` (T1):

- `tests/run.js` (Node 24, sem dependências): sobe um servidor estático do próprio Node que entrega `index.html`, `css/` e `js/` com Firebase simulado (nuvem e sessão em `localStorage`) no arquivo que tiver `FB_CONFIG`, e dirige um Chrome headless via DevTools Protocol. Arquivo linkado que não existe faz o cenário falhar.
- Cenários mínimos, cada um com `assert`:
  1. Sem login: tela de login visível e hub bloqueado (`inert`).
  2. Login → mudança → documentos `hub-meta` e `hub-0` gravados.
  3. Mudança vinda de "outro aparelho" é mesclada.
  4. Troca de conta A → B → A: B vê hub vazio, nuvens separadas, A recupera seus dados.
  5. Sair envia as últimas mudanças antes de desconectar.
  6. Sem internet: abre só local se já houve login (e a mudança offline chega à nuvem depois); senão, "Tentar de novo".
  7. Divisão em pedaços não corta emoji ao meio.
  8. Remove o token do antigo login pelo Google Drive (`hub-gd`).
  9. Todas as telas do menu, cada aba das Finanças (mês e ano), o Início com todos os cards e a busca abrem sem erro de JS e sem tela vazia.
  10. Todo arquivo local tem `?v=`, todos com a mesma versão, e nenhum arquivo de `css/`/`js/` fica fora do `index.html`.
  11. Rede lenta: cada `.js` chega 700 ms depois do anterior; abrir com e sem login e sem internet não dá erro.
- Login real com Google e regras do Firestore: checagem manual + consultas REST sem login (devem retornar `PERMISSION_DENIED`).
- Regra: correção de bug vem com cenário que falha sem a correção.

## Limites

**Sempre:**
- Rodar `node tests/run.js` e testar localmente antes de publicar.
- Manter o app funcionando sem `FB_CONFIG`.
- Trocar o `?v=` de todos os links ao mudar `css/` ou `js/` (ver Estilo).
- Escapar com `esc()` todo dado externo exibido.
- Confirmar no site publicado depois de cada `push`.

**Perguntar antes:**
- Publicar (`git push`) qualquer mudança.
- Mudar o formato dos dados salvos (`S`, chaves do `localStorage`, caminhos do Firestore) — afeta dados existentes.
- Mudar as regras do Firestore ou a configuração do Firebase.
- Adicionar serviço externo ou biblioteca.
- Criar, juntar ou reordenar arquivos em `js/` (a ordem de carregamento faz parte do comportamento).
- Apagar dados de qualquer pessoa (local ou nuvem).

**Nunca:**
- Commitar segredos (chave secreta OAuth, contas de serviço). A config Web do Firebase é pública e pode ficar no código.
- Enviar dados de uma conta para o caminho de outra.
- Desligar a mescla ou o backup automático para "simplificar".
- Incluir rastreamento/analytics.

## Critérios de sucesso (verificáveis)

- [ ] Site publicado carrega o Firebase sem erros no console e mostra "Entrar com o Google".
- [ ] Leitura e escrita no Firestore sem login retornam `PERMISSION_DENIED`.
- [ ] Os 11 cenários de teste passam com `node tests/run.js`.
- [ ] Uma tarefa criada no computador aparece no celular da mesma conta em até ~1 minuto.
- [ ] Tela de login e hub funcionam em 375 px de largura sem rolagem horizontal.

## Decisões

As questões em aberto da primeira versão deste SPEC foram resolvidas assim (22/10/2026):

1. **Quem pode entrar: qualquer conta Google.** Não há lista de e-mails. Cada pessoa cria o próprio hub, vazio, e as regras do Firestore garantem que ela só lê e grava `data/users/<seu uid>/`. Custo aceito: quem tiver o link usa a cota grátis do projeto Firebase, o que não pesa para um grupo pequeno. Rever se o link se espalhar ou se a cota apertar.
2. **Sem internet: abre só local** quando já houve login no aparelho (T3). A sincronização volta no próximo carregamento com conexão, não sozinha com o site aberto.
3. **Testes no repositório:** `tests/run.js` (T1).
4. **Pendências da revisão:** resolvidas (T4).
5. **Login no celular: só pop-up, sem redirecionamento.** O `signInWithRedirect` não funciona de forma confiável quando o site (`github.io`) e o domínio de login do Firebase (`firebaseapp.com`) são diferentes: Safari e Chrome recente bloqueiam o armazenamento entre sites e o login volta sem usuário. A correção oficial exige Firebase Hosting ou domínio próprio, o que contraria a hospedagem no GitHub Pages. Se o pop-up for bloqueado, o site pede para permitir pop-ups. Rever se o site mudar de hospedagem.
6. **Modo artefato do Claude não é mais mantido** (22/10/2026): a dona não usa mais o artefato. O código `IN_CLAUDE` fica até um plano futuro decidir removê-lo.
7. **Modularização com scripts clássicos, não módulos ES** (22/10/2026): o código foi movido para arquivos por área sem reescrita (as mesmas linhas, conferido), mantendo a ordem original. `import`/`export` exigiria declarar as dependências entre ~2.000 linhas densas; pode ser um passo futuro, área por área.

## Questões em aberto

Nenhuma no momento.
