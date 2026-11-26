# Plano de implementação · Finanças do MeuHub

Data de elaboração: 25/11/2026

## Direção aprovada

A opção **B · Extrato em primeiro plano** orienta a área. **Lançamentos** será a tela de trabalho principal para buscar, registrar, conferir e editar movimentações. A **Visão geral** será a tela de consulta com saldo, fluxo de caixa e próximos vencimentos. Essa divisão aplica as melhorias sugeridas sem repetir o mesmo painel de indicadores em todas as abas.

A proposta usa a largura máxima atual de **1.440 px** no desktop, a identidade do MeuHub, os temas claro e escuro e os componentes existentes. Em todas as abas, conteúdo principal vem antes das configurações. Filtros e ações frequentes ficam perto dos itens. Edição individual fica junto ao registro correspondente.

**Regra de entrada proposta:** na primeira abertura de Finanças, mostrar Lançamentos. Na navegação seguinte, lembrar a última subaba usada no aparelho, respeitando atalhos que apontam para uma aba específica. O relatório anual abre pela ação explícita de período e permite voltar ao contexto mensal. O padrão inicial e a memória por aparelho são decisões deste plano para concretizar a opção B.

## O que aproveitar das sete referências

| Imagem | O que aproveitar | Onde aplicar no MeuHub |
| --- | --- | --- |
| 1 · Dinzo, Visão geral | Um valor principal e um gráfico com transição clara entre período realizado e previsto. | Destacar o saldo atual. Mostrar saldo projetado em outra linha, com data e escopo. Ao lado do gráfico, listar próximos vencimentos e faturas com data e valor. |
| 2 · Dinzo, Extrato | Filtros sobre a tabela, data e valor alinhados e detalhes próximos do item selecionado. | Base da opção B. Abrir detalhes em painel lateral quando houver espaço, ou em visualização de largura total em telas estreitas. Quando nada estiver selecionado, o extrato usa toda a largura. |
| 3 · Dinzo, Relatórios | Valor total legível, ranking de categorias e comparação com período anterior. | Em Análises, combinar gráfico e ranking em uma mesma seção. Mostrar R$, percentual do total e diferença frente ao mês anterior com o mesmo escopo. |
| 4 · Organizze, desktop e celular | Leitura vertical em telas estreitas e separação entre contas e cartões. | Na Visão geral móvel, mostrar saldo, vencimentos, fluxo e lançamentos recentes nessa ordem. Em Contas e recorrentes, separar saldo de conta, limite de cartão e fatura. |
| 5 · Minhas Finanças, contas e orçamentos | Distinguir saldo inicial, atual e previsto. Mostrar proporção usada de cada orçamento. | Explicar a base da projeção no respectivo painel. Em Orçamentos e metas, apresentar gasto, limite e saldo ou excesso por categoria. |
| 6 · Minhas Finanças, pendências | Reunir pendências em uma lista curta com acesso direto à conferência. | Em A vencer, ordenar pela data e mostrar os próximos itens cadastrados. Cada ação abre a origem da conta ou fatura. |
| 7 · Visor, visão geral | Progresso em contexto, reserva medida em meses e recorrências com data e valor. | Em Orçamentos e metas, dar destaque aos meses cobertos pela reserva, quando calculáveis. Em Contas e recorrentes, agrupar cobranças futuras e assinaturas. |

As referências orientam **hierarquia, agrupamento e interação**. A composição usa a tipografia, as paletas e o ritmo visual do MeuHub.

## Categoria de despesa · Reserva

Criar **Reserva** como categoria própria para despesas registradas como aportes à reserva. Ela passa a aparecer na captura rápida, no extrato, nos filtros, na edição em lote, na prévia da importação, nos orçamentos, nos relatórios e nas exportações. Um lançamento nessa categoria continua sendo uma despesa e aparece separado de **Outros** nos totais por categoria.

Para o histórico, usar **Outros → despesas → busca por descrição** para localizar os aportes e oferecer a recategorização em lote com conferência explícita. A seleção altera só a categoria. Preserva valor, data, conta, parcela e vínculos. Outros permanece disponível para despesas sem categoria específica.

Quando o dinheiro for movimentado entre duas contas cadastradas, a operação continua sendo uma **transferência**. Preservar também as opções atuais de ignorar ou converter movimentos de cofrinho durante a importação. A categoria identifica uma despesa no extrato e não cria automaticamente uma transferência ou um depósito em meta.

## Organização e distribuição dentro das abas

Hoje, o cabeçalho mensal repete quatro indicadores antes da navegação das subabas. A Visão geral reúne resumo, previsão, categorias, lançamentos recentes, séries e fluxo. A mudança é dar uma pergunta a cada aba, mover gráficos detalhados para Análises e manter o espaço inicial de Lançamentos dedicado à lista.

| Aba | Conteúdo e ordem | Consulta, ações e ferramentas |
| --- | --- | --- |
| **Lançamentos** | 1. Resumo discreto do período. 2. Busca, filtros e ação **Novo lançamento**. 3. Extrato. 4. Parcelas futuras e divisão de despesas. | Filtros de conta/cartão, categoria, tipo, período, etiquetas e conferência junto à lista. Campos extras ficam recolhidos. Seleção e edição preservam filtros, posição na lista e rascunho conforme as regras atuais. |
| **Visão geral** | 1. Saldo atual, com entradas, saídas e resultado em apoio. 2. Fluxo do mês e próximos vencimentos. 3. Últimos lançamentos e resumo de categorias. | Atalhos levam ao detalhe correspondente em Lançamentos, Contas ou Análises. A previsão até a próxima entrada da conta principal continua identificada e tem link para sua composição. |
| **Análises** | 1. Gastos por categoria e comparação. 2. Tendência e resultado. 3. Projeções e demais análises. | Gráfico e ranking usam a mesma seleção. Série mensal, cascata, projeção de 30/60/90 dias, calendário, padrões e estabelecimentos ficam em grupos reconhecíveis. |
| **Investimentos** | 1. Patrimônio e posição da carteira. 2. Alocação e evolução. 3. Proventos e operações. | Atualizar cotações e registrar operação junto aos dados correspondentes. Preferências, fontes de cotação e ferramentas de configuração ficam ao final. |
| **Orçamentos e metas** | 1. Limites que exigem atenção e demais categorias. 2. Metas de economia e reserva. 3. Fechamento. | Mostrar gasto, limite e restante ou excesso de cada categoria. Cadastros, regras percentuais e outros ajustes vêm depois da leitura dos indicadores. |
| **Contas e recorrentes** | 1. Saldos das contas. 2. Cartões e faturas. 3. Próximas contas fixas, recorrências e assinaturas. | Pagar, editar e vincular perto do item. Cadastro de contas, cartões e recorrências depois das respectivas listas. Exibir recorrências mensal e anual com rótulos explícitos. |
| **Regras e importação** | 1. Entrada do extrato ou prévia do arquivo carregado. 2. Conferência de linhas. 3. Regras automáticas. | Categorias, possíveis duplicatas e associações ficam junto das linhas. Mapeamento, conta de destino e demais opções aparecem depois da prévia, antes da confirmação, com a conta de destino também identificada no resumo. |
| **Relatório anual** | 1. Resultados do ano. 2. Evolução mensal. 3. Categorias e detalhamento. | Seletor de ano e exportação junto ao relatório. A volta para o mês restaura o contexto de consulta. |

O simulador de compras fica após o conteúdo principal, junto às ferramentas de projeção. A limpeza de dados fica no final da área de configuração financeira, com as confirmações e as proteções atuais.

## Etapas de implementação

### F1 · Capturar a linha de base e reorganizar a navegação

- [x] Registrar as telas atuais com dados fictícios, em 375 px e 1.440 px, com amostras em temas claro e escuro. Cobrir conta sem movimentos, conta com transações, faturas, orçamento e projeção.
- [x] Colocar o título, período, conta e navegação de Finanças antes do conteúdo de cada subaba. Transferir o resumo mensal completo para Visão geral.
- [x] Implementar a entrada em Lançamentos e a memória local de última subaba. Revisar os atalhos de Hoje, Início, busca e Lembretes, além de modo anual e volta ao mês.
- **Aceite:** Lançamentos abre na primeira visita. Atalhos específicos abrem sua origem. Período, conta e subtítulo ficam visíveis e continuam coerentes ao trocar de aba.
- **Registro da F1:** preferências já salvas de subaba são reaproveitadas. No relatório anual, o filtro de conta é separado do filtro mensal, e sua seleção também é aplicada à exportação. Em telas estreitas, a faixa de subabas posiciona a aba ativa dentro da região visível ao trocar de aba.
- **Locais prováveis:** `js/recursos.js`, `js/financas.js`, `js/main.js`, `css/style.css`, `tests/run.js`. **Dependências:** nenhuma.

### F2 · Entregar o extrato como tela de trabalho

- [x] Reorganizar a lista em tabela semântica no desktop, com **Data · Descrição · Categoria · Conta · Valor** e espaço próprio para conferência. Alinhar valores à direita e manter o sinal e o texto de estado, além da cor. Em telas estreitas, usar lista agrupada por data.
- [x] Colocar busca, filtros ativos, limpar filtros e **Novo lançamento** acima da lista. Reaproveitar a captura e o formulário existentes, incluindo recorrência, parcelamento e transferência.
- [x] Abrir detalhes e edição a partir da linha. Usar painel lateral quando a lista e os detalhes couberem com folga. Em telas estreitas, abrir em largura total com retorno ao item. Preservar paginação, conferência bancária, edição em lote e ações de exclusão com as proteções atuais.
- **Aceite:** buscar, abrir, editar e voltar preserva a consulta. Lançamentos agendados, parcelas, transferências e estornos continuam identificáveis. A linha tem uma ação operável por teclado, distinta da caixa de conferência. Após fechar o detalhe, o foco retorna à origem ou à lista, quando o registro tiver sido removido.
- **Locais prováveis:** `js/financas.js`, `js/main.js`, `css/style.css`, `tests/run.js`. **Dependência:** F1.

- **Registro da F2:** a tabela ocupa a largura disponível. Em desktop amplo, o detalhe abre ao lado. Em telas estreitas, o detalhe ocupa a largura da consulta e, ao sair, o foco retorna ao lançamento ou à lista. O extrato preserva os filtros.

### F2.1 · Separar Reserva de Outros

- [x] Adicionar a categoria à lista compartilhada de despesas e conferir os pontos que montam suas próprias opções, rótulos e cores.
- [x] Sugerir a categoria na prévia de importação para descrições claras de aporte, como “Aplicação para reserva”, respeitando regras explícitas, ajustes manuais e a classificação de transferências e resgates. Deixar descrições ambíguas para conferência.
- [x] Reutilizar os filtros e a edição em lote do extrato para revisar e mover aportes antigos classificados como Outros. Mostrar a seleção antes de confirmar.
- [x] Verificar a categoria em orçamentos, análises e exportações. No cálculo dos meses cobertos pela reserva, tratar o aporte separado da base de despesas de manutenção usada como referência.
- **Aceite:** registrar ou recategorizar um aporte o tira de Outros. A recategorização preserva o total de despesas e os saldos. Transferências internas e resgates continuam com seus tipos originais, e a classificação não duplica movimentos.
- **Locais prováveis:** `js/core.js`, `js/financas.js`, `js/financas-import.js`, `tests/unit.test.js`, `tests/run.js`. **Dependência:** F2. F3 a F5 incorporam a categoria em seus painéis.
- **Registro da F2.1:** em Lançamentos, filtre Outros e selecione Reserva na edição em lote. A prévia lista as despesas do recorte atual, e a confirmação altera apenas a categoria dos aportes marcados.

### F3 · Reorganizar a Visão geral e a projeção

- [x] Usar saldo atual como número principal. Exibir separadamente entradas e saídas realizadas, resultado mensal e previsão com seus respectivos rótulos e datas.
- [x] Dar largura ao gráfico de fluxo. Distinguir visualmente realizado e previsto, com legenda e resumo acessível por texto. Reaproveitar o cálculo atual de fluxo e o painel de previsão até a próxima receita.
- [x] Colocar próximos vencimentos junto ao gráfico no desktop. No celular, mostrar o bloco antes do gráfico. Listar os próximos itens com atalho para a origem, sem contabilizar uma fatura e suas despesas como duas novas saídas.
- [x] Posicionar lançamentos recentes e destaques de categorias depois dos vencimentos e do fluxo. Encaminhar ao extrato ou ranking com o período correspondente.
- **Aceite:** é possível distinguir o que aconteceu, o que está agendado e o que entrou na projeção. Conta selecionada e conta principal ficam explícitas quando os painéis usarem escopos diferentes. Sem dados suficientes, o app explica a ausência de previsão.
- **Registro da F3:** o fluxo do mês usa o cálculo de caixa e projeta somente as movimentações cadastradas. A visão consolidada inclui o restante das faturas, e pagamentos agendados entram pela conta de origem, sem repetir as compras do cartão. As séries e comparações detalhadas continuam acessíveis para a reorganização da F4.
- **Locais prováveis:** `js/financas.js`, `js/recursos.js`, `css/style.css`, `tests/run.js`. **Dependências:** F1 e F2 para os atalhos ao extrato.

### F4 · Dar um lugar próprio às análises e ao relatório anual

- [x] Mover da Visão geral os gráficos detalhados de série mensal, cascata e projeção. Organizar Análises em categorias, evolução e projeções. Coordenar seleção de categoria entre gráfico, ranking e atalho para lançamentos.
- [x] Comparar períodos equivalentes. Para mês em curso, comparar até o mesmo dia do mês anterior, ajustando para meses curtos e identificando o intervalo. Exibir variação em reais e só mostrar percentual quando houver base válida.
- [x] Preservar exportação anual, totais, filtros aplicáveis e as regras atuais de abatimento de estorno e exclusão de transferências dos totais de receita e despesa.
- **Aceite:** gráfico e ranking conciliam com o mesmo conjunto de registros. Meses vazios, sem base anterior ou com valores negativos não geram texto ou percentuais enganosos.
- **Registro da F4:** a comparação do mês em curso usa o dia equivalente no mês anterior, limitado ao último dia daquele mês. O ranking, o gráfico e o atalho para o extrato usam despesas realizadas e abatem estornos. No relatório anual, os totais e o CSV seguem líquidos. A divisão entre fixo e variável é apresentada antes dos estornos, com o critério declarado.
- **Locais prováveis:** `js/financas.js`, `js/recursos.js`, `css/style.css`, `tests/run.js`. **Dependência:** F3.

### F5 · Separar consulta e edição nas abas de apoio

- [x] Separar saldos, cartões e recorrências. Colocar faturas e cobranças próximas em listas com data, conta vinculada e ação junto ao registro.
- [x] Reorganizar limites, metas e reserva. Em orçamento, mostrar valor gasto, limite e o que resta. Em reserva, mostrar meses cobertos quando houver base de despesas cadastrada. Manter depósito junto à meta e gestão ao final.
- [x] Em Investimentos, ordenar posição, alocação e evolução antes de operações e preferências, preservando acesso às ações frequentes.
- [x] Em Regras e importação, colocar a conferência antes das opções, com ajustes de categoria e associação por linha. Manter o simulador ao fim das análises e a limpeza de dados no fim da configuração financeira.
- **Aceite:** cada aba mostra primeiro os dados que justificam sua visita. Importar, conciliar, pagar fatura, lançar parcela, depositar em meta e atualizar cotação continuam acessíveis a partir da área correspondente.
- **Locais prováveis:** `js/financas.js`, `js/financas-import.js`, `js/financas-invest.js`, `js/recursos.js`, `css/style.css`, `tests/run.js`. **Dependências:** F1 e F2.

### F6 · Integração, revisão visual e documentação

- [x] Conferir os estados vazio, poucos registros, lista longa, edição aberta, filtros sem resultado, seleção em lote, valores altos, números ocultos e leitura sem internet. Usar dados fictícios.
- [x] Verificar 320, 375, 430, 860, 1.024, 1.280 e 1.440 px, modos confortável e compacto e temas claro e escuro. Em telas estreitas, validar que página e controles principais não exigem rolagem horizontal. Testar teclado, foco, ampliação de texto e contraste.
- [x] Cobrir o extrato, mudanças de aba, atalhos e novos estados de layout em cenários de regressão. Manter os testes financeiros existentes. Rodar `node --test tests/unit.test.js`, `node tests/run.js` e `node scripts/bump-version.js --check`. Atualizar a versão da PWA pelo script do projeto após alterações de CSS/JS.
- [x] Atualizar `DESIGN.md` e a documentação de uso conforme o resultado validado. Comparar capturas de Lançamentos e Visão geral antes e depois, em desktop e celular.
- **Aceite:** os caminhos financeiros e as proteções de valores continuam cobertos. A leitura inicial de Lançamentos prioriza a lista, e a Visão geral mostra pelo menos saldo, previsão ou sua explicação e acesso aos vencimentos.
- **Registro da F6:** a comparação com `92fc5b6` usou os mesmos dados fictícios em 375 e 1.440 px. Lançamentos começa pelo extrato, e a Visão geral destaca saldo, fluxo e vencimentos. A matriz passou nas sete larguras, nos dois temas e nas duas densidades. Em 320 px, a navegação financeira também passou com texto a 200%; alguns rótulos do menu global podem quebrar palavras nessa combinação. A reabertura do extrato pelo Service Worker foi verificada com a rede do navegador desativada e Firebase simulado. Passaram 25 testes unitários e 273 cenários de navegador.
- **Dependências:** F1 a F5, incluindo F2.1.

## Limites e riscos

- O redesign reaproveita o estado financeiro, os cálculos, as regras de importação, os backups e a sincronização. A preferência de última aba e seleção do detalhe são estados de interface do aparelho.
- A largura do painel de detalhe depende do espaço útil da lista e deve ser validada com descrições e valores longos. A alternativa em largura total evita colunas espremidas.
- Tabela, cartão, gráfico, tooltip, exportação e resumo devem respeitar a privacidade e os seus escopos. Um número discreto de comparação também pode revelar valores e precisa da mesma proteção visual.
- A previsão deve explicitar a data de corte e o que a base inclui. Cartões, parcelas, contas fixas e transferências exigem cuidado especial para não contar valores duas vezes.
