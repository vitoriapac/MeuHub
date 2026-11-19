# MeuHub 2.0 — Plano dividido em pacotes

**Data:** 18/11/2026

**Situação:** planejamento. Nenhum pacote é considerado concluído apenas por estar listado aqui.

**Referência:** [plano de implementação revisado](plano-meuhub-2-0-revisado.md), que contém as regras detalhadas e as decisões em aberto.

## Como usar

Cada pacote entrega um resultado que pode ser implementado e verificado separadamente. As dependências indicam a ordem recomendada, mas uma etapa pode ser subdividida quando houver risco ou necessidade de revisão. Tamanhos são relativos ao projeto, não são prazos.

| Pacote | Entrega | Abrange | Prioridade | Tamanho | Depende de |
|---|---|---|---|---|---|
| P00 | Base confiável | P0 | Alta | Médio | — |
| P01 | Hábitos e previsões consistentes | F01 | Alta | Médio | P00 |
| P02 | Atenção: tarefas e agenda | F02, primeira parte | Alta | Médio | P01 |
| P03 | Atenção: finanças e privacidade | F02, segunda parte | Alta | Médio | P02 |
| P04 | Planejamento em lote | F04 | Alta | Médio | P00; integração com P02 quando aplicável |
| P05 | Política e central de arquivados | F03 | Alta | Grande | P00 |
| P06 | Planejamento semanal | F05 | Alta | Grande | P01, P04 |
| P07 | Fechamento do dia e modelos de tarefas | F06, F07 | Média | Médio | P00; P04 para ações em lote |
| P08 | Compras: preços e totais | F08, primeira parte | Alta | Médio | P00 |
| P09 | Compras: registro financeiro | F08, segunda parte | Alta | Grande | P08; P05 apenas para integração com arquivados |
| P10 | Simulador financeiro | F09 | Alta | Grande | P01, P00; P09 somente se incluir compras |
| P11 | Revisão de assinaturas | F10 | Média | Médio | P00; P03 para integração com Atenção |
| P12 | Projetos pessoais | F11 | Média | Grande | P05; validar necessidade após P06/P09 |
| P13 | Histórico de alterações | F12 | Média | Grande | P00; tipos de eventos definidos |
| P14 | Exportação seletiva | F13 | Baixa | Médio | P00 |
| P15 | Perfis de visualização | F14 | Baixa | Médio | P00 |

## P00 — Base confiável

**Objetivo:** conhecer o estado real do aplicativo e proteger os dados antes de alterar regras ou estruturas.

**Andamento:** linha de base inicial com 162 cenários e mapeamento em [linha-base-p00-2026-11-18.md](linha-base-p00-2026-11-18.md). Verificações com duas versões abertas, aparelhos físicos e Firebase real ainda estão pendentes.

- [x] Revisar o estado Git e preservar alterações locais existentes.
- [x] Executar a suíte e registrar a linha de base, sem assumir que resultados anteriores continuam válidos.
- [x] Preparar dados fictícios que representem backups antigos e estados parcialmente preenchidos.
- [x] Mapear persistência, `SK`, `merge3()`, restauração, lixeira, versões, rascunhos e atualização do PWA.
- [ ] Registrar como verificar offline, dois aparelhos simulados e recuperação; apontar o que exige ambiente real.

**Pronto quando:** há uma linha de base reproduzível, testes com dados antigos e um mapa dos pontos afetados. Nenhum dado pessoal foi usado nas fixtures.

## P01 — Hábitos e previsões consistentes

**Objetivo:** tornar claros os indicadores de hábitos e as premissas das previsões financeiras.

**Andamento:** implementado nos resumos de Início e Hoje; a suíte final passou em 166 cenários. Previsões existentes foram verificadas quanto a contas sem vínculo, despesas na data da receita e deduplicação.

- [x] Distinguir hábitos realizados hoje, pendências diárias e progresso semanal em Hoje e Início.
- [x] Manter a frequência semanal escolhida pela pessoa usuária e preservar as marcações anteriores.
- [x] Revisar exclusões, contas e faturas sem vínculo e duplicidades na previsão financeira.
- [x] Testar virada de semana, alteração de frequência e dados antigos.

**Pronto quando:** uma meta semanal cumprida não aparece como obrigação diária e as previsões explicam seus limites.

## P02 — Atenção: tarefas e agenda

**Objetivo:** melhorar a central de atenção já existente sem duplicá-la.

**Andamento:** alertas de tarefas abrem o item, conflitos com horários de início e fim explícitos são verificados para hoje e amanhã, com um aviso por par; é possível ocultar alertas de tarefas e conflitos até o dia seguinte. A dispensa é invalidada se a situação mudar.

- [x] Mapear as regras atuais de tarefas e avisos e definir quais situações merecem atenção.
- [x] Adicionar conflitos de agenda somente quando comprovados pelos horários disponíveis.
- [x] Normalizar, ordenar e deduplicar ocorrências; levar cada ação ao item original.
- [x] Se houver dispensa, definir sua validade e persistir somente essa escolha.

**Pronto quando:** cada problema aparece uma vez, sua ação abre a origem correta e resolver ou dispensar não altera outros dados.

## P03 — Atenção: finanças e privacidade

**Objetivo:** apresentar somente alertas financeiros compreensíveis e confiáveis.

**Andamento:** alertas indicam valor previsto e conta quando conhecida; a projeção explica o período e as limitações. A navegação abre a conta fixa ou a seção de fluxo de caixa. A suíte passou em 175 cenários com Firebase simulado. Vínculos conhecidos são considerados; contas independentes potencialmente duplicadas continuam sinalizadas para conferência, pois não há informação suficiente para conciliá-las automaticamente.

- [x] Distinguir vencimento, despesa prevista e saldo projetado, informando período e limitações.
- [ ] Verificar contas e faturas sem vínculo e impedir contagem duplicada.
- [x] Conferir modo privacidade nos valores e detalhes dos alertas.
- [ ] Deixar integração com compras e assinaturas para P09 e P11.

**Pronto quando:** alertas explicam sua origem e não tratam previsão como valor garantido; dados sensíveis respeitam o modo privacidade.

## P04 — Planejamento em lote

**Objetivo:** planejar várias tarefas sem modificar seus prazos por acidente.

**Andamento:** seleção com data, prévia, cancelamento e confirmação implementados; recorrências ficam fora do lote. A confirmação é invalidada se a seleção ou os dados relevantes mudarem; desfazer reverte a operação.

- [x] Adicionar seleção, prévia, escolha de data e cancelamento em Tarefas ou Atenção.
- [x] Preservar prazo ao alterar data planejada; deixar alteração de prazo como ação separada, caso seja aprovada.
- [x] Definir tratamento de recorrências e itens incompatíveis.
- [x] Garantir que uma ação de desfazer reverta o lote.

**Pronto quando:** um lote pode ser revisto, executado e desfeito sem perda, duplicação ou alteração silenciosa de prazo.

**Decisão implementada:** alterar prazo em lote é uma ação separada, com prévia, confirmação e exclusão de recorrências; preserva planejamento e horários.

## P05 — Política e central de arquivados

**Objetivo:** encontrar e restaurar conteúdo arquivado sem confundi-lo com a Lixeira.

- [x] Mapear arquivamento atual de notas, busca, vínculos, recorrências, lixeira e fechamento financeiro.
- [ ] Definir regras por tipo e o comportamento de recorrências antes de alterar dados.
- [x] Começar pela consulta e restauração de notas e listas já arquiváveis.
- [ ] Expandir para tarefas e metas somente após testes de backup, mesclagem e recuperação.

**Decisões:** ao arquivar futuramente uma tarefa recorrente, pausar suas próximas ocorrências e manter o histórico. Ao arquivar uma meta, pausar as tarefas ligadas junto com ela. A expansão para tarefas e metas ainda não foi implementada; resta detalhar a restauração e o tratamento de tarefas já pausadas ou ligadas a mais de uma meta.

**Pronto quando:** arquivar e restaurar preserva identidade, vínculos e estado, e itens arquivados deixam de gerar pendências indevidas.

## P06 — Planejamento semanal

**Objetivo:** integrar Agenda e revisão semanal em um fluxo de planejamento.

- [x] Reaproveitar a revisão guiada, compromissos, tarefas e `autoSlot` existentes.
- [x] Capacidade diária permanece separada das janelas configuráveis por dia.
- [x] Exibir conflitos, sobrecarga e duração estimada com clareza.
- [ ] Confirmar encaixes individualmente: prévia e confirmação implementadas na Agenda; ainda falta validação da apresentação em celular físico.

**Pronto quando:** Hoje e Agenda refletem a mesma tarefa e nenhuma sugestão grava uma mudança sem ação explícita.

## P07 — Fechamento do dia e modelos

**Objetivo:** aproveitar a rotina noturna e facilitar tarefas repetidas.

- [x] Completar o fechamento na rotina existente, incluindo pendências e retomada.
- [x] Reutilizar registros de tarefas, humor e Diário, sem duplicá-los.
- [x] Criar modelos simples de tarefas/subtarefas com novos IDs e datas relativas opcionais.
- [ ] Verificar uso offline, backup e independência das instâncias criadas.

**Situação:** os modelos de viagem e projeto criam tarefas e subtarefas independentes com prazo absoluto ou relativo opcional. Foi adicionado teste de criação offline, recarga e reconexão simulada; resta verificar a restauração específica de backup.

**Pronto quando:** repetir o fechamento não duplica registros e aplicar um modelo cria somente os itens escolhidos.

## P08 — Compras: preços e totais

**Objetivo:** ampliar as listas existentes mantendo o uso simples.

- [x] Definir compatibilidade com os itens `{id, t, q, done}` e o orçamento atual.
- [x] Permitir quantidades estruturadas e preços estimados/reais como campos opcionais.
- [x] Mostrar totais parciais quando faltarem preços e separar estimativa de valor efetivo.
- [x] Preços unitários em centavos inteiros; arredondar cada subtotal para centavos antes de somar.

**Pronto quando:** cálculos com quantidades inteiras e decimais são corretos, e listas antigas continuam utilizáveis.

## P09 — Compras: registro financeiro

**Objetivo:** registrar compras confirmadas sem gerar lançamentos duplicados.

- [ ] Definir compra integral e sessões parciais, com referências estáveis.
- [ ] Revisar possíveis duplicatas e preservar a escolha de conta, data e categoria.
- [ ] Exigir confirmação antes de criar ou ajustar lançamento financeiro.
- [ ] Testar repetição, offline, reconexão, arquivamento e restauração.

**Decisão:** diante de possível duplicata, avisar e permitir escolher entre criar outro lançamento ou associar o existente. A sessão permite escolher itens explicitamente; criar uma compra semelhante exige confirmação.

**Situação:** cada confirmação gera um identificador próprio e registra referências dos itens marcados; o total real completo pode preencher o valor. É possível escolher uma despesa existente sem associação e confirmar sua vinculação, preservando valor, conta, data e categoria; valores iguais são sinalizados como possíveis duplicatas. Cada sessão permite selecionar itens; itens anteriormente associados e despesas sem associação com mesmo valor, data e conta exigem conferência antes de criar outra despesa. Os testes cobrem alteração concorrente da lista e do lançamento, criação offline e reconexão simulada. Ainda faltam verificações de arquivamento, restauração e conflitos de sincronização entre aparelhos.

**Pronto quando:** marcar um item não movimenta contas e repetir a operação não duplica despesas nem descarta compras legítimas.

## P10 — Simulador financeiro

**Objetivo:** comparar cenários de compra sem alterar finanças reais.

- [ ] Especificar exemplos para pagamento à vista, parcelas, juros e datas de cartão.
- [ ] Isolar cálculos de funções existentes que podem alterar estado, como rotinas que chamam `genRec()`.
- [ ] Apresentar cenário-base, impacto, menor saldo, período e exclusões.
- [ ] Testar meses curtos, despesas existentes, saldo negativo e contas distintas.

**Decisão:** para cenários de cartão, usar fechamento e vencimento cadastrados, permitir informar juros e avisar quando não houver conta de pagamento vinculada.

**Situação:** há uma comparação somente de débito em conta com parcelas e juros compostos, usando lançamentos já cadastrados. A simulação informa que não inclui recorrências não lançadas nem faturas sem pagamento; cenários específicos de cartão e testes adicionais permanecem pendentes.

**Pronto quando:** a simulação não altera `S.fin`, persistência ou sincronização e os resultados conferem com exemplos calculados.

## P11 — Revisão de assinaturas

**Objetivo:** facilitar a conferência de recorrências já cadastradas.

- [x] Mostrar custos equivalentes e variação de valor quando houver dados confiáveis.
- [x] Permitir marcar para revisão, concluir revisão e abrir a recorrência.
- [x] Oferecer criação de tarefa mediante escolha e integrar revisões pendentes à Atenção.

**Pronto quando:** não são criadas cobranças adicionais e nenhum alerta afirma que uma assinatura está sem uso sem evidência.

## P12 — Projetos pessoais

**Objetivo:** agrupar referências a tarefas, metas, notas e despesas sem copiar registros.

- [ ] Comparar extensão das metas e projetos atuais com um tipo independente.
- [ ] Definir status, datas, custos e regras de arquivamento/exclusão.
- [ ] Construir a visão escolhida com tratamento de referências indisponíveis.

**Decisão:** implementar projeto independente, com identidade própria, para permitir arquivamento e acompanhamento sem depender de nomes iguais.

**Situação:** foi adicionada uma visão derivada dos nomes já usados em tarefas e despesas, com notas e metas ligadas às tarefas. Cadastro independente, status, datas e regras de arquivamento/exclusão ainda não foram implementados.

**Pronto quando:** remover o projeto não apaga itens vinculados e custos não são contados duas vezes.

## P13 — Histórico de alterações

**Objetivo:** tornar alterações importantes compreensíveis sem substituir backup e desfazer.

- [ ] Definir eventos, dados mínimos, prazo de retenção, limite de tamanho e privacidade.
- [ ] Testar deduplicação e recuperação após edição em aparelhos diferentes.

**Decisão:** sincronizar o histórico entre aparelhos. Definir mesclagem, deduplicação, retenção e recuperação antes de migrar os registros locais.

**Situação:** histórico local separado por conta, com tipo e horário de ações selecionadas, limitado a 100 eventos e 90 dias; a limpeza ocorre ao abrir o aplicativo ou registrar ações. Não inclui conteúdo, nomes ou valores e não sincroniza nem acompanha restaurações. A deduplicação e recuperação entre aparelhos ainda estão pendentes.

**Pronto quando:** os eventos escolhidos são compreensíveis, limitados e não expõem dados desnecessários.

## P14 — Exportação seletiva

**Objetivo:** exportar apenas as áreas escolhidas.

- [x] Definir escopo e dependências exibidos antes da exportação.
- [x] Oferecer JSON estruturado e CSV para dados tabulares apropriados.
- [x] Manter importação seletiva fora deste pacote até haver regras próprias de conciliação.

**Situação:** JSON seletivo não é restaurável; CSV cobre tarefas, eventos e lançamentos com proteção contra fórmulas. O backup integral permanece separado.

**Pronto quando:** o arquivo contém o escopo informado e o backup integral continua funcionando.

## P15 — Perfis de visualização

**Objetivo:** alternar configurações de cards e atalhos sem dividir os dados.

- [x] Perfis nomeados locais por conta; a configuração aplicada de cards e menu segue a sincronização existente.
- [x] Permitir voltar à configuração padrão e preservar a seleção explícita.
- [x] Não alternar automaticamente por horário sem uma escolha posterior.

**Situação:** perfis não entram no backup nem sincronizam; o perfil ativo guarda suas mudanças ao alternar, e uma configuração anterior sem perfil é preservada.

**Pronto quando:** alternar perfis não apaga dados nem sobrescreve configurações indevidamente.

## Verificação aplicável a cada pacote

- [ ] Testes significativos para regras novas e fluxos afetados.
- [ ] Estados vazios, erros, teclado, alvos de toque e apresentação em celular e desktop.
- [ ] Modo privacidade quando houver conteúdo sensível.
- [ ] Backup antigo, recuperação, offline e mesclagem quando houver dados persistentes novos.
- [ ] Atualização das versões do PWA e documentação quando necessário.
- [ ] Registro explícito do que foi ou não verificado em aparelho físico e Firebase real.

## Decisões e detalhamentos por pacote

| Pacote | Decisão |
|---|---|
| P02 | Definido: dispensa até o dia seguinte, invalidada se a situação mudar. |
| P04 | Definido: alterar prazo em ação separada, com prévia e confirmação. |
| P05 | Definido: tarefas de meta arquivada e próximas ocorrências de recorrências serão pausadas. Detalhar restauração. |
| P06 | Definido: janelas por dia e capacidade diária separada. |
| P08–P09 | Definido: selecionar itens, avisar sobre possíveis duplicatas e permitir criar outro lançamento ou associar o existente. |
| P10 | Definido: usar datas do cartão, aceitar juros e avisar sobre conta não vinculada. Detalhar cálculo e despesas. |
| P12 | Definido: projeto independente. Detalhar status, datas, migração e exclusão. |
| P13 | Definido: histórico sincronizado. Detalhar mesclagem, retenção e migração. |

**Fora destes pacotes:** a conexão bancária futura permanece em [plano-open-finance-pessoal.md](plano-open-finance-pessoal.md) e exige avaliação própria de provedor, segurança e custos.
