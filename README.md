# Meu Hub

Site publicado: **https://vitoriapac.github.io/MeuHub/** (GitHub Pages, branch `main`, pasta raiz).

Um painel pessoal brasileiro que reúne **planejamento do dia**, **controle financeiro completo**, **hábitos e rotinas**, **anotações/diário/leituras** e **companhia de fundo** (Spotify e clima) em um só lugar — funcionando no navegador ou instalado como aplicativo (**PWA**) no celular e no computador.

---

## Documentação do Projeto

| Documento | Conteúdo |
|---|---|
| **[README.md](README.md)** | Visão geral, funcionalidades, atalhos, configuração do Firebase, execução local e testes. |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Arquitetura detalhada: carga dos módulos, estado `S`, `localStorage`, mescla de 3 vias (`merge3`), PWA/Service Worker e motor de testes CDP. |
| **[SPEC.md](SPEC.md)** | Especificação técnica, regras de código, limites operacionais, decisões arquiteturais e os cenários de teste. |
| **[PRODUCT.md](PRODUCT.md)** | Visão de produto, usos principais, posicionamento, voz da marca e princípios. |
| **[DESIGN.md](DESIGN.md)** | Sistema de design ("Caderno Solar"), tipografia (`Outfit`), paletas de cores, tokens semânticos e padrões de interface. |

---

## Principais Funcionalidades

### 1. Planejamento e Produtividade
- **Início personalizável:** card opcional para lista de compras fixada, resumo do dia com anel de progresso, gráficos sparkline de 7 dias, linha do tempo interativa (6h–22h), botão **Companhia** (liga/desliga Spotify + Clima com um clique) e 15 cards reordenáveis.
- **Hoje e Carga do Dia:** caixa de entrada, revisão semanal com pendências, próximos passos escolhidos nos projetos, notas e metas com data de revisão, além dos hábitos, planejamento individual para a próxima semana, prioridades, alertas e cálculo de capacidade. As sugestões consideram a capacidade e um horário livre; podem ser dispensadas até o próximo carregamento. A captura mantém seus campos ao alternar tipos. Planejar uma tarefa não altera seu prazo; em Tarefas, o planejamento em lote permite selecionar, revisar e desfazer a operação. Tarefas recorrentes são planejadas individualmente. A ação **Adiar para amanhã** altera o prazo para o dia seguinte e retira a tarefa de Hoje.
- **Rotina (Manhã e Noite):** passo a passo guiado configurável com registro de dias seguidos.
- **Tarefas, Agenda e Metas:** prioridades, subtarefas, recorrência, captura para caixa de entrada ou tarefa com data planejada independente do prazo, encaixe individual em Hoje e metas com acompanhamento por quantidade ou tarefas. Em Metas, use **Nova meta** para acessar o formulário ao final da página; edição e opções de acompanhamento ficam depois do conteúdo de cada meta; o próximo passo pode ser planejado para hoje sem alterar seu prazo. Na agenda diária, **Ações dos compromissos do dia** reúne edição, exclusão e ações das tarefas em botões maiores, inclusive para eventos curtos ou simultâneos.
- **Hábitos e Pomodoro:** hábitos diários ou de 1 a 7 vezes por semana, grade de registros e timer Pomodoro (25 min foco / 5 min pausa). Ao mudar a frequência, os registros são preservados e a sequência passa a usar a meta atual. Em Início e Hoje, os indicadores de hábitos diários são separados das metas semanais cumpridas.

### 2. Finanças Pessoais (6 abas + Relatório Anual)
- **Visão Geral:** KPIs do mês, contas a vencer e previsão até a próxima receita futura da conta principal escolhida em **Contas e Recorrentes → Contas e cartões**. O detalhamento apresenta o saldo inicial e as movimentações consideradas. A estimativa inclui despesas até o dia do recebimento e exclui entradas desse dia, faturas sem pagamento agendado e contas sem conta de pagamento vinculada; gastos não cadastrados também ficam fora. Contas fixas independentes podem ser vinculadas a uma conta de pagamento, mas podem coincidir com outros lançamentos e devem ser conferidas. O alerta de saldo negativo considera a previsão consolidada para os próximos 14 dias, mesmo com poucos lançamentos. Em Hoje, contas, parcelas e assinaturas futuras indicam a conta vinculada ou avisam quando ela não está definida.
- **Análises:** fluxo de caixa projetado para **30, 60 e 90 dias**, cascata de receitas → despesas → economia, gráfico de rosca por categoria, evolução de 6 meses e correlação **Humor × Gastos**.
- **Lançamentos:** busca, filtros por categoria/conta/cartão/etiqueta, parcelamento automático (`2x` a `24x`), divisão de despesas com outra pessoa (`split`) e fechamento/arquivamento de mês.
- **Orçamentos e Metas:** tetos por categoria, regra percentual customizável (`50 / 30 / 20`), calculadora de **Reserva de Emergência** e caixinhas de economia com depósito rápido.
- **Contas e Recorrentes:** gestão de contas correntes, dinheiro e investimentos, cartões de crédito (limite, fechamento e vencimento), resumo de assinaturas ativas, próxima data e histórico de valor de recorrências e geração automática de fixos do mês.
- **Regras e Importação:** regras automáticas por palavra-chave e importação de extratos **CSV** (Nubank, Itaú, Inter, Bradesco, C6 etc.) com pré-visualização e detecção de duplicatas.

### 3. Conhecimento, Bem-Estar e Recursos Globais
- **Notas, Diário, Humor e Leituras:** notas fixáveis com checklist e modelos agrupados em **Usar modelo**, listas de compras com quantidades, edição, duplicação, compartilhamento, orçamento estimado, histórico de compras e sugestões de itens, atalhos para notas fixadas, recentes e para revisitar, além de sugestões por etiqueta ou ligação, diário com perguntas guiadas e retrospectiva do ano, registro de humor e estante de livros/cursos/filmes/séries.
- **Conexões (`links2`) e Etiquetas:** qualquer item do hub pode ser conectado a outro (ex.: ligar uma tarefa a uma nota ou meta) e filtrado por `#etiquetas`.
- **Paleta de Comandos (`Ctrl+K`) e Busca Global:** navegue, execute ações ou encontre qualquer item instantaneamente.
- **Segurança dos Dados:** proteção na abertura e importação de dados inválidos, alertas de tarefas e conflitos de agenda com opção de ocultar até amanhã, resumo e estado detalhado da sincronização em Backup, Desfazer/Refazer (`Ctrl+Z` / `Ctrl+Y`, até 30 passos), Lixeira com retenção de 30 dias, até 8 versões locais, limitadas pelo espaço disponível, e exportação/importação JSON.
- **Modo Privacidade:** botão do olho na barra lateral borra todos os valores em `R$`, notas e textos do diário quando há alguém por perto.

---

## Instalar como Aplicativo (PWA)

O Meu Hub pode ser instalado no celular ou no computador e abre em janela própria, sem barra de endereço, funcionando mesmo sem internet:

- **Android / Chrome / Edge (PC):** abra **Aparência → Aplicativo (PWA)** e clique em **Instalar aplicativo** (ou use o ícone de instalar na barra do navegador).
- **iPhone / iPad (Safari):** toque em **Compartilhar** e escolha **Adicionar à Tela de Início**.
- **Atalhos no ícone do app:** segure o ícone instalado para abrir direto **Hoje**, **Nova tarefa**, **Novo gasto**, **Agenda** ou **Finanças**.

---

## Atalhos de Teclado

*(Podem ser desativados em **Aparência → Acessibilidade e teclado**)*

| Tecla | Ação |
|---|---|
| `Ctrl + K` | Abrir a paleta de comandos |
| `/` | Buscar em tudo |
| `Ctrl + Z` / `Ctrl + Y` | Desfazer / Refazer última alteração |
| `N` | Nova nota |
| `T` | Nova tarefa |
| `E` | Novo compromisso |
| `D` | Captura rápida de despesa |
| `C` | Abrir captura rápida |
| `1` a `9` | Abrir link configurado com o respectivo atalho |
| `?` | Mostrar atalhos |

---

## Configurar o Firebase (uma vez)

O site só abre depois de entrar com o Google. Os dados são sincronizados entre aparelhos pelo Firebase (Authentication + Firestore). Enquanto `FB_CONFIG` estiver vazio em [`js/sync.js`](file:///c:/Users/vitor/Documents/MeuHub/js/sync.js), o site abre direto e guarda os dados só no navegador.

1. Acesse https://console.firebase.google.com → **Criar um projeto** → nome `MeuHub`. O Google Analytics pode ficar desativado.
2. Na página inicial do projeto, clique no ícone **Web** (`</>`) → apelido `Meu Hub` → **Registrar app** (não marque o Firebase Hosting).
3. Copie o objeto `firebaseConfig` que aparece (`apiKey`, `authDomain`, `projectId`…) e cole em `FB_CONFIG` no [`js/sync.js`](file:///c:/Users/vitor/Documents/MeuHub/js/sync.js), no lugar de `null`. Esses valores são públicos: a proteção está nas regras do passo 6.
4. Menu **Criação** → **Authentication** → **Vamos começar** → **Google** → **Ativar** → escolha o e-mail de suporte → **Salvar**.
5. Ainda em Authentication → **Configurações** → **Domínios autorizados** → **Adicionar domínio** → `vitoriapac.github.io`.
6. Menu **Criação** → **Firestore Database** → **Criar banco de dados** → local `southamerica-east1 (São Paulo)` → **modo de produção**. Na aba **Regras**, troque tudo por:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /data/users/{uid}/{doc} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   e clique em **Publicar**. Cada pessoa só lê e grava os próprios dados.

---

## Arquivos e Manutenção de Cache

[`index.html`](file:///c:/Users/vitor/Documents/MeuHub/index.html) contém a casca HTML e os links. A aparência fica em [`css/style.css`](file:///c:/Users/vitor/Documents/MeuHub/css/style.css) e o código em `js/`, um arquivo por área (`core`, `sync`, `financas`, `financas-import`, `financas-invest`, `recursos`, `inicio`, `main`), carregados nessa ordem. Consulte [ARCHITECTURE.md](ARCHITECTURE.md) e [SPEC.md](SPEC.md) para detalhes.

**Ao publicar mudanças em `css/` ou `js/`**, execute `node scripts/bump-version.js` para atualizar em sincronia o `?v=` de todos os links no [`index.html`](file:///c:/Users/vitor/Documents/MeuHub/index.html) e a constante `VER` em [`sw.js`](file:///c:/Users/vitor/Documents/MeuHub/sw.js) para a mesma versão (ex.: `?v=20261120`), validando também que nenhum asset ficou de fora. O Cenário 10 e o Cenário 12 de `tests/run.js` verificam essa sincronia automaticamente.

---

## Rodar Localmente e Testar

```bash
# Servir localmente em http://localhost:8080
python -m http.server 8080

# Executar os testes unitários rápidos (~100 ms)
node --test tests/unit.test.js

# Executar os cenários de teste ponta a ponta (Node 24+, sem dependências)
node tests/run.js

# Filtrar um cenário específico durante o desenvolvimento
node tests/run.js --filter=financas
```

Os testes unitários (`node --test tests/unit.test.js`) validam funções puras em ~0,1 s, e o executor [`tests/run.js`](file:///c:/Users/vitor/Documents/MeuHub/tests/run.js) abre o site em um Chrome ou Edge headless com Firebase simulado e valida login, sincronização por domínio, mescla entre aparelhos, troca de conta, saída, modo sem internet, integridade de emojis UTF-16, todas as 20 telas e 6 abas de finanças, cache-busting, rede lenta, falhas de armazenamento, gravação concorrente, PWA/Service Worker e cenários de regressão de segurança, privacidade, acessibilidade e desempenho. Se o navegador não for encontrado automaticamente, defina a variável de ambiente `CHROME_PATH`.

### Arquivados e planejamento

A central **Arquivados** reúne notas, listas, tarefas, metas e projetos, permitindo buscar e restaurar sem perder vínculos ou histórico. Ao arquivar uma meta, as tarefas pendentes que ela acompanha diretamente, por ligação, projeto ou etiqueta são pausadas. Ao restaurar, permanecem pausadas as tarefas arquivadas individualmente ou por outra meta. Tarefas recorrentes arquivadas não geram novas ocorrências enquanto estiverem pausadas; prazos e horários são preservados.

Na Agenda, configure uma ou mais janelas de horário para cada dia da semana. A primeira janela substitui o padrão de 8h a 22h; remover todas torna o dia indisponível, e “Usar padrão” recupera o horário inicial. A capacidade diária é um limite separado. As janelas são incluídas no backup e na sincronização.

Em Tarefas, os modelos criam cópias independentes com subtarefas e prazo opcional. Em Hoje, **Fechar o dia** abre a rotina noturna existente, que permite retomar o progresso.

Nas listas de compras, quantidade numérica, unidade e preços estimado e real por unidade são opcionais. Os preços são guardados em centavos e cada subtotal é arredondado para centavos; os totais indicam quando faltam dados. Ao registrar uma compra, confira valor, conta, data e categoria: cada confirmação cria uma despesa independente.

O simulador de compra em Finanças compara débitos em conta ou parcelas no cartão com os lançamentos já cadastrados, sem salvar o cenário. No cartão, usa fechamento e vencimento cadastrados e informa que a conta escolhida é apenas para a simulação. Juros compostos incidem mensalmente sobre o valor total. A base exclui recorrências não lançadas e faturas sem pagamento agendado.

Nas recorrências de assinaturas, marque uma revisão para que ela apareça em Atenção; criar uma tarefa é opcional e não cria cobranças. Em Tarefas, a visão dos projetos reúne tarefas e despesas com o mesmo nome, além de notas e metas ligadas às tarefas.

Em Backup, o histórico mostra o tipo e horário de algumas alterações, sem nomes, conteúdos ou valores. Ele mantém até 100 eventos por até 90 dias e acompanha a sincronização da conta quando ela estiver ativa. Ao restaurar um backup, os eventos existentes são preservados e a restauração é registrada. O histórico não substitui o backup.

Em Backup, **Exportar áreas selecionadas** gera JSON das áreas escolhidas ou CSV de tarefas, eventos e lançamentos. A exportação seletiva não inclui vínculos de outras áreas nem serve para restaurar o aplicativo; mantenha o backup completo para recuperação. O CSV protege células de texto que poderiam ser interpretadas como fórmulas.

Em Personalizar menu, salve perfis de visualização com os cards e o menu atuais. Eles ficam neste navegador, separados por conta, fora do backup; ao trocar, o perfil ativo incorpora a configuração atual. Aplicar um perfil altera cards e menu, que usam a sincronização normal da conta. A escolha é sempre manual.

Em Tarefas, a alteração de prazo em lote é uma ação separada do planejamento: revise os prazos anteriores e confirme para aplicar. Planejamento e horários permanecem iguais; recorrências são alteradas individualmente. Na Agenda diária, sugestões de encaixe exigem confirmação e são invalidadas se a agenda mudar.

Ao registrar uma compra, também é possível associar uma despesa existente ainda não vinculada. Valores iguais são destacados para conferência; a associação não altera valor, conta, data ou categoria e não cria um novo lançamento.

Em compras parciais, escolha os itens da sessão antes de confirmar. O MeuHub avisa se os itens já foram usados em outra compra ou se há despesa sem vínculo com mesmo valor, data e conta; é possível associar a despesa ou confirmar uma nova compra. Se um item selecionado ou o lançamento escolhido mudar enquanto a tela estiver aberta, reabra a operação para conferir.

Na aba **Projetos**, crie agrupamentos com identidade própria, situação e datas opcionais. Vincule tarefas, metas, notas e despesas existentes sem copiá-las. Arquivar ou excluir o projeto preserva os itens; projetos excluídos podem ser recuperados da Lixeira. Os agrupamentos antigos por nome continuam disponíveis em Tarefas e não são convertidos automaticamente.

### Conferência de backup e revisão

Em **Backup → Conferir backup**, escolha um arquivo JSON para validar sua estrutura e ver quantidades sem importar ou modificar dados. A conferência não substitui um teste de restauração. Em Projetos, selecione uma tarefa vinculada e ativa como próximo passo; a revisão semanal avisa se ela deixar de estar disponível. Notas e metas aceitam uma data opcional de revisão, mostrada na revisão semanal até o fim da próxima semana. As ações são manuais e as informações acompanham o backup e a sincronização.

Em **Hoje**, os próximos passos de projetos ativos aparecem com ações para abrir a tarefa ou incluí-la no dia. Se a tarefa já aparecer entre as atrasadas ou planejadas, o nome do projeto fica junto dela.

Em **Lembretes → Conferência financeira**, vincule contas de pagamento a contas fixas e compare compras da mesma lista com data, conta e valor iguais. Cada lançamento pode ser aberto individualmente. Confirmar compras distintas registra a conferência sem alterar os valores. Se o grupo mudar, ele volta à fila.

O roteiro de recuperação entre aparelhos usa uma conta exclusiva de teste e dados fictícios. Consulte o [ensaio de recuperação](tasks/ensaio-recuperacao.md).

### Leituras e filmes (Estante)

Em **Leituras e mídia → Estante**, livros concluídos aparecem em lombadas com largura proporcional às páginas (`r.pages`) e destaque para notas máximas (`★ 5`), e filmes e séries concluídos contam com **Prateleira de filmes e séries** alternável entre modo Pôster (`2:3`) e Lombadas, além da faixa superior **"Na cabeceira agora"** para acompanhar e concluir itens em andamento (`+10 pág.` / `+1 ep.` / `Concluir`). É possível buscar capas na Open Library (livros) e pôsteres na iTunes Search API pública com fallback na Wikipédia PT/EN (filmes e séries), ajustar manualmente a cor ou URL da imagem, filtrar por tipo (`Livros`, `Filmes`, `Séries`), ano ou nota, sortear o próximo título da fila **Quero** direto na coleção ou na estante e criar notas já vinculadas do painel de detalhes.
