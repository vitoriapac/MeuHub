# Spec: Meu Hub

Status: **aprovado** (21/10/2026) · Base: commit `b07dbca` (21/10/2026)

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
| Artefato Claude | O mesmo arquivo roda como artefato (`IN_CLAUDE`): sem login nem Firebase, usa o banco do artefato. |

## Stack

- **Um único arquivo** `index.html` (HTML + CSS + JS puro, ~2.400 linhas, ~370 KB). Sem build, sem npm, sem framework.
- Firebase JS SDK **compat 10.12.2** (app, auth, firestore) via `www.gstatic.com`, carregado só no site.
- Fonte Outfit (Google Fonts). APIs externas: Open-Meteo, Spotify embed.
- Hospedagem: GitHub Pages, branch `main`, raiz → https://vitoriapac.github.io/MeuHub/
- Projeto Firebase `meuhub-48efb` (plano Spark, gratuito). Firestore em `southamerica-east1`.

## Comandos

```
Rodar local:   python -m http.server 8080        (na pasta do projeto; abre http://localhost:8080)
Publicar:      git push origin main               (Pages publica em ~1 min)
Testar:        node tests/run.js                  (proposto: ver Estratégia de testes)
```

## Estrutura

```
index.html         → o app inteiro
README.md          → configuração do Firebase e uso
SPEC.md            → esta especificação
tests/             → (proposto) testes ponta a ponta com Chrome headless + Firebase simulado
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

## Estratégia de testes

Hoje não há testes no repositório; os testes desta sessão rodaram de scripts temporários. Proposta:

- `tests/run.js` (Node 24, sem dependências): sobe `python -m http.server`, gera uma cópia do `index.html` com Firebase simulado (nuvem e sessão em `localStorage`) e dirige um Chrome headless via DevTools Protocol.
- Cenários mínimos, cada um com `assert`:
  1. Sem login: tela de login visível e hub bloqueado (`inert`).
  2. Login → mudança → documentos `hub-meta` e `hub-0` gravados.
  3. Mudança vinda de "outro aparelho" é mesclada.
  4. Troca de conta A → B → A: B vê hub vazio, nuvens separadas, A recupera seus dados.
  5. Sair envia as últimas mudanças antes de desconectar.
- Login real com Google e regras do Firestore: checagem manual + consultas REST sem login (devem retornar `PERMISSION_DENIED`).
- Regra: correção de bug vem com cenário que falha sem a correção.

## Limites

**Sempre:**
- Testar localmente (e rodar `tests/run.js`, quando existir) antes de publicar.
- Manter o app funcionando sem `FB_CONFIG` e como artefato Claude.
- Escapar com `esc()` todo dado externo exibido.
- Confirmar no site publicado depois de cada `push`.

**Perguntar antes:**
- Publicar (`git push`) qualquer mudança.
- Mudar o formato dos dados salvos (`S`, chaves do `localStorage`, caminhos do Firestore) — afeta dados existentes.
- Mudar as regras do Firestore ou a configuração do Firebase.
- Adicionar serviço externo, biblioteca ou dividir o `index.html` em vários arquivos.
- Apagar dados de qualquer pessoa (local ou nuvem).

**Nunca:**
- Commitar segredos (chave secreta OAuth, contas de serviço). A config Web do Firebase é pública e pode ficar no código.
- Enviar dados de uma conta para o caminho de outra.
- Desligar a mescla ou o backup automático para "simplificar".
- Incluir rastreamento/analytics.

## Critérios de sucesso (verificáveis)

- [ ] Site publicado carrega o Firebase sem erros no console e mostra "Entrar com o Google".
- [ ] Leitura e escrita no Firestore sem login retornam `PERMISSION_DENIED`.
- [ ] Os 5 cenários de teste passam com `node tests/run.js`.
- [ ] Uma tarefa criada no computador aparece no celular da mesma conta em até ~1 minuto.
- [ ] Tela de login e hub funcionam em 375 px de largura sem rolagem horizontal.

## Questões em aberto

1. **Quem pode entrar?** Hoje qualquer conta Google consegue criar um hub (vazio). Para "eu e pessoas próximas", restringir por lista de e-mails nas regras do Firestore?
2. **Sem internet:** se o Firebase não estiver no cache, o hub fica travado em "Tentar de novo". Abrir em modo só local quando já houve login neste aparelho?
3. **Testes no repositório:** aprovar a criação de `tests/run.js` como descrito?
4. **Pendências menores da revisão:** corte de emoji na divisão dos pedaços; botão "Tentar de novo" com `onclick` em vez de `data-a`; chave antiga `hub-gd` no `localStorage`.
5. **Login no celular:** a janela do Google pode ser bloqueada em alguns navegadores. Ter alternativa por redirecionamento?
