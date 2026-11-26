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
| **[DESIGN.md](DESIGN.md)** | Sistema de design ("A Escrivaninha Serena"), tipografia (`Outfit` e `Instrument Serif`), paletas de cores, tokens semânticos e padrões de interface. |

---

## Principais Funcionalidades

### 1. Planejamento e Produtividade
- **Início personalizável:** painel de saudação com arte por período do dia, relógio e saudação atualizados automaticamente e atalhos de captura rápida, card opcional para lista de compras fixada, resumo do dia com anel de progresso, gráficos sparkline de 7 dias, linha do tempo interativa (6h–22h), botão **Companhia** (liga/desliga Spotify + Clima com um clique) e 15 cards reordenáveis.
- **Hoje e Carga do Dia:** caixa de entrada, revisão semanal com pendências, próximos passos escolhidos nos projetos, notas e metas com data de revisão, além dos hábitos, planejamento individual para a próxima semana, prioridades, alertas e cálculo de capacidade. As sugestões consideram a capacidade e um horário livre; podem ser dispensadas até o próximo carregamento. A captura mantém seus campos ao alternar tipos. Planejar uma tarefa não altera seu prazo; em Tarefas, o planejamento em lote permite selecionar, revisar e desfazer a operação. Tarefas recorrentes são planejadas individualmente. A ação **Adiar para amanhã** altera o prazo para o dia seguinte e retira a tarefa de Hoje.
- **Rotina (Manhã e Noite):** passo a passo guiado configurável com registro de dias seguidos.
- **Tarefas, Agenda e Metas:** visualização de tarefas em **Lista** ou **Semana por turnos** (Manhã, Tarde, Noite e Qualquer hora) com arrastar e soltar, prioridades, subtarefas, recorrência, captura para caixa de entrada ou tarefa com data planejada independente do prazo, encaixe individual em Hoje e metas com acompanhamento por quantidade ou tarefas. Em Metas, use **Nova meta** para acessar o formulário ao final da página; edição e opções de acompanhamento ficam depois do conteúdo de cada meta; o próximo passo pode ser planejado para hoje sem alterar seu prazo. Na agenda diária, **Ações dos compromissos do dia** reúne edição, exclusão e ações das tarefas em botões maiores, inclusive para eventos curtos ou simultâneos.
- **Hábitos e Pomodoro:** hábitos diários ou de 1 a 7 vezes por semana, grade de registros e timer Pomodoro (25 min foco / 5 min pausa). Ao mudar a frequência, os registros são preservados e a sequência passa a usar a meta atual. Em Início e Hoje, os indicadores de hábitos diários são separados das metas semanais cumpridas.

Em telas estreitas ou com texto ampliado, os atalhos que não cabem na barra inferior ficam em **Mais**. O resumo diário pode ser dispensado em **Hoje** ou **Lembretes**, onde as pendências continuam disponíveis para consulta.

### 2. Finanças Pessoais (7 abas + Relatório Anual)

- **Lançamentos** é a tela inicial de Finanças no primeiro acesso. O Meu Hub lembra a última aba aberta neste aparelho. Busque os registros acima da lista. Abra **Filtros** para ajustar o escopo, que continua visível quando os filtros estão recolhidos. Use **Novo lançamento** para criar, e selecione a descrição de um registro para editar. Em telas largas, o detalhe abre ao lado da lista. No celular, use **Voltar ao extrato** para retornar ao registro. Use **Mais opções** para parcelar uma despesa. Os painéis de parcelas futuras e despesas compartilhadas ficam abaixo da lista.
- **Visão geral** reúne saldo atual, resultado realizado no período, próximos vencimentos e fluxo de caixa do mês. O traço contínuo do gráfico mostra o realizado, e o tracejado mostra a previsão com as movimentações cadastradas. Para a estimativa até o próximo recebimento, escolha a conta principal em **Contas e recorrentes → Saldos das contas**. O detalhamento informa o saldo inicial e as movimentações consideradas. A estimativa inclui despesas até o dia do recebimento. Entradas desse dia, faturas sem pagamento agendado, contas sem vínculo de pagamento e gastos ainda não cadastrados ficam fora. Confira possíveis duplicatas entre contas fixas e lançamentos. O alerta de saldo negativo usa a previsão consolidada para os próximos 14 dias. Abra **Compromissos dos próximos meses** para consultar parcelas, contas fixas e recorrências pelo mês do lançamento ou vencimento cadastrado.
- **Análises** agrupa categorias, evolução e projeções. Use o ranking para ver os lançamentos de uma categoria. A comparação do mês em curso usa o intervalo equivalente do mês anterior. O fluxo de caixa tem projeções para 30, 60 e 90 dias. A aba também inclui a cascata de receitas e despesas e a correlação entre humor e gastos. O simulador de compras fica no fim da aba.
- **Orçamentos e metas** separa gastos registrados do valor agendado e mostra o que restaria do limite por categoria. Cadastre aportes como despesa na categoria **Reserva**. Para reclassificar lançamentos antigos, filtre a lista e escolha **Reserva** na edição em lote. A confirmação permite escolher os aportes da lista. A reserva de emergência mostra meses cobertos quando houver histórico de despesas. Deposite junto à meta e revise lançamentos pendentes, possíveis duplicatas, faturas e aportes no fechamento mensal. A sobra realizada tem um limite consolidado por mês, mesmo ao filtrar uma conta. Destinações são registradas no histórico e podem ser revertidas por ele. Se dois aparelhos destinarem além da sobra enquanto estiverem offline, a tentativa sem saldo fica sinalizada para conferência.
- **Contas e recorrentes** separa saldos, cartões e faturas, vencimentos e cobranças recorrentes. Use as ações de pagamento, conciliação ou edição junto aos registros. Com zero ou um cartão, os cartões e os vencimentos ficam lado a lado quando há largura. Os formulários de cadastro ficam depois das listas. Use **Repetir até** para encerrar uma recorrência ou conta fixa em uma data, inclusive na agenda e nas projeções. Em **Despesas parceladas → Parcelar despesa**, informe o total, a primeira data e a quantidade de parcelas para revisar os valores e as datas antes de salvar. Em **Gerenciar parcelas**, consulte as faturas, ajuste parcelas em aberto, registre estornos e cancele parcelas futuras. Use **Gerenciar recorrência** para pular o mês, pausar até uma data ou encerrar.
- **Investimentos** apresenta posição, alocação, proventos e evolução da carteira. A atualização de cotações fica junto ao resumo. Cadastros, ferramentas de cálculo e preferências ficam abaixo.
- **Regras e importação** permite revisar um extrato CSV, confirmar a conta de destino, ajustar categorias e associações e conferir duplicatas antes de importar. Compare a linha bancária com a parcela, recorrência ou pagamento já cadastrado e confirme a associação para preservar o lançamento. As regras automáticas, a manutenção de dados e o arquivamento ficam depois da área de importação.
- **Relatório anual** abre pelo seletor **Ano**. Filtre por conta e exporte os totais em CSV.

### 3. Conhecimento, Bem-Estar e Recursos Globais

Notas abre em leitura. Use **Editar** para formatar e salvar, ou **Opções** para fixar, revisar, trocar a cor ou arquivar. Rascunhos de edição e da captura de Tarefas ficam neste aparelho, por conta, até salvar ou descartar. Se a nota original mudar durante a edição, é possível guardar a versão local como uma nova nota.
- **Notas, Diário, Humor e Leituras:** notas fixáveis com checklist e modelos agrupados em **Usar modelo**, listas de compras com quantidades, edição, duplicação, compartilhamento, orçamento estimado, histórico de compras e sugestões de itens, atalhos para notas fixadas, recentes e para revisitar, além de sugestões por etiqueta ou ligação, diário com perguntas guiadas e retrospectiva do ano, registro de humor e estante de livros/cursos/filmes/séries.
- **Conexões (`links2`) e Etiquetas:** qualquer item do hub pode ser conectado a outro (ex.: ligar uma tarefa a uma nota ou meta) e filtrado por `#etiquetas`.
- **Paleta de Comandos (`Ctrl+K`) e Busca Global:** navegue, execute ações ou encontre qualquer item instantaneamente.
- **Segurança dos Dados:** proteção na abertura e importação de dados inválidos, alertas de tarefas e conflitos de agenda com opção de ocultar até amanhã, resumo e estado detalhado da sincronização em Backup, Desfazer/Refazer (`Ctrl+Z` / `Ctrl+Y`, até 30 passos), Lixeira com retenção de 30 dias, até 8 versões locais, limitadas pelo espaço disponível, e exportação/importação JSON.
- **Modo Privacidade:** botão do olho na barra superior mascara valores em `R$` e borra textos de notas e do diário. Campos financeiros permanecem mascarados até receberem foco para edição, inclusive nos formulários do fechamento, das parcelas e dos cartões.

---

## Instalar como Aplicativo (PWA)

O Meu Hub pode ser instalado no celular ou no computador e abre em janela própria, sem barra de endereço, funcionando mesmo sem internet:

- **Android / Chrome / Edge (PC):** abra **Aparência → Aplicativo (PWA)** e clique em **Instalar aplicativo** (ou use o ícone de instalar na barra do navegador).
- **iPhone / iPad (Safari):** toque em **Compartilhar** e escolha **Adicionar à Tela de Início**.
- **Sem rede:** após o primeiro acesso com login, a PWA pode reabrir com os dados locais e as ilustrações de manhã, tarde e noite. O navegador escolhe entre duas larguras em WebP.
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

Os testes unitários (`node --test tests/unit.test.js`) validam funções puras em ~0,1 s, e o executor [`tests/run.js`](file:///c:/Users/vitor/Documents/MeuHub/tests/run.js) abre o site em um Chrome ou Edge headless com Firebase simulado e valida login, sincronização por domínio, mescla entre aparelhos, troca de conta, saída, modo sem internet, integridade de emojis UTF-16, todas as 20 telas e 7 abas de finanças, cache-busting, rede lenta, falhas de armazenamento, gravação concorrente, PWA/Service Worker e cenários de regressão de segurança, privacidade, acessibilidade e desempenho. Se o navegador não for encontrado automaticamente, defina a variável de ambiente `CHROME_PATH`.

### Arquivados e planejamento

A central **Arquivados** reúne notas, listas, tarefas, metas e projetos, permitindo buscar e restaurar sem perder vínculos ou histórico. Ao arquivar uma meta, as tarefas pendentes que ela acompanha diretamente, por ligação, projeto ou etiqueta são pausadas. Ao restaurar, permanecem pausadas as tarefas arquivadas individualmente ou por outra meta. Tarefas recorrentes arquivadas não geram novas ocorrências enquanto estiverem pausadas; prazos e horários são preservados.

Na Agenda, configure uma ou mais janelas de horário para cada dia da semana. A primeira janela substitui o padrão de 8h a 22h; remover todas torna o dia indisponível, e “Usar padrão” recupera o horário inicial. A capacidade diária é um limite separado. As janelas são incluídas no backup e na sincronização.

Em Tarefas, os modelos criam cópias independentes com subtarefas e prazo opcional. Em Hoje, **Fechar o dia** abre a rotina noturna existente, que permite retomar o progresso.

Nas listas de compras, quantidade numérica, unidade e preços estimado e real por unidade são opcionais. Os preços são guardados em centavos e cada subtotal é arredondado para centavos; os totais indicam quando faltam dados. Ao registrar uma compra, confira valor, conta, data e categoria: cada confirmação cria uma despesa independente.

O simulador de compra no fim de **Finanças → Análises** compara débitos em conta ou parcelas no cartão com os lançamentos já cadastrados, sem salvar o cenário. No cartão, usa fechamento e vencimento cadastrados e informa que a conta escolhida é apenas para a simulação. Juros compostos incidem mensalmente sobre o valor total. A base exclui recorrências não lançadas e faturas sem pagamento agendado.

Nas recorrências de assinaturas, marque uma revisão para que ela apareça em Atenção; criar uma tarefa é opcional e não cria cobranças. Em Tarefas, a visão dos projetos reúne tarefas e despesas com o mesmo nome, além de notas e metas ligadas às tarefas.

Em Backup, o histórico mostra o tipo e horário de algumas alterações, sem nomes, conteúdos ou valores. Ele mantém até 100 eventos por até 90 dias e acompanha a sincronização da conta quando ela estiver ativa. Ao restaurar um backup, os eventos existentes são preservados e a restauração é registrada. O histórico não substitui o backup.

Em Backup, **Exportar áreas selecionadas** gera JSON das áreas escolhidas ou CSV de tarefas, eventos e lançamentos. A exportação seletiva não inclui vínculos de outras áreas nem serve para restaurar o aplicativo; mantenha o backup completo para recuperação. O CSV protege células de texto que poderiam ser interpretadas como fórmulas.

Em Personalizar menu, salve perfis de visualização com os cards e o menu atuais. Eles ficam neste navegador, separados por conta, fora do backup; ao trocar, o perfil ativo incorpora a configuração atual. Aplicar um perfil altera cards e menu, que usam a sincronização normal da conta. A escolha é sempre manual.

Em Tarefas, a alteração de prazo em lote é uma ação separada do planejamento: revise os prazos anteriores e confirme para aplicar. Planejamento e horários permanecem iguais; recorrências são alteradas individualmente. Na Agenda diária, sugestões de encaixe exigem confirmação e são invalidadas se a agenda mudar.

Ao registrar uma compra, também é possível associar uma despesa existente ainda não vinculada. Valores iguais são destacados para conferência; a associação não altera valor, conta, data ou categoria e não cria um novo lançamento.

Em compras parciais, escolha os itens da sessão antes de confirmar. O MeuHub avisa se os itens já foram usados em outra compra ou se há despesa sem vínculo com mesmo valor, data e conta; é possível associar a despesa ou confirmar uma nova compra. Se um item selecionado ou o lançamento escolhido mudar enquanto a tela estiver aberta, reabra a operação para conferir.

Na aba **Projetos**, crie agrupamentos com identidade própria, situação e datas opcionais. Vincule tarefas, metas, notas e despesas existentes sem copiá-las. Arquivar ou excluir o projeto preserva os itens; projetos excluídos podem ser recuperados da Lixeira. Os agrupamentos antigos por nome continuam disponíveis em Tarefas e não são convertidos automaticamente.

### Conferência de backup e revisão

Em **Backup**, use **Fazer cópia** para baixar ou compartilhar, **Conferir** para verificar a estrutura do JSON e **Recuperar ou restaurar** para recuperar dados. Mesclar combina os dados e prioriza a versão local em conflitos. Restaurar substitui os dados atuais. Os dois fluxos pedem confirmação depois de ler o arquivo. Faça um ensaio de restauração para verificar a recuperação completa. Em Projetos, selecione uma tarefa vinculada e ativa como próximo passo; a revisão semanal avisa se ela deixar de estar disponível. Notas e metas aceitam uma data opcional de revisão, mostrada na revisão semanal até o fim da próxima semana. As ações são manuais e as informações acompanham o backup e a sincronização.

Em **Hoje**, os próximos passos de projetos ativos aparecem com ações para abrir a tarefa ou incluí-la no dia. Se a tarefa já aparecer entre as atrasadas ou planejadas, o nome do projeto fica junto dela.

Em **Lembretes → Conferência financeira**, vincule contas de pagamento a contas fixas e compare compras da mesma lista com data, conta e valor iguais. Cada lançamento pode ser aberto individualmente. Confirmar compras distintas registra a conferência sem alterar os valores. Se o grupo mudar, ele volta à fila.

O roteiro de recuperação entre aparelhos usa uma conta exclusiva de teste e dados fictícios. Consulte o [ensaio de recuperação](tasks/ensaio-recuperacao.md).

### Leituras e filmes (Estante)

Em **Leituras e mídia → Estante**, livros concluídos aparecem em lombadas com largura proporcional às páginas (`r.pages`) e destaque para notas máximas (`★ 5`), e filmes e séries concluídos contam com **Prateleira de filmes e séries** alternável entre modo Pôster (`2:3`) e Lombadas, além da faixa superior **"Na cabeceira agora"** para acompanhar e concluir itens em andamento (`+10 pág.` / `+1 ep.` / `Concluir`). É possível buscar capas na Open Library (livros) e pôsteres na iTunes Search API pública com fallback na Wikipédia PT/EN (filmes e séries), ajustar manualmente a cor ou URL da imagem, filtrar por tipo (`Livros`, `Filmes`, `Séries`), ano ou nota, sortear o próximo título da fila **Quero** direto na coleção ou na estante e criar notas já vinculadas do painel de detalhes.
