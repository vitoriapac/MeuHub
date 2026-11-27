# Avaliação: notas contextuais, cenários financeiros e retrospectiva mensal

Data: 27/11/2026. Etapa de avaliação prevista no plano de melhorias, após esperas e conferência financeira. Base: código e documentação atuais; não houve nova inspeção visual nesta etapa.

## Decisões e ordem de implementação

| Ordem | Proposta | Decisão | Benefício |
|---|---|---|---|
| 1 | Revisão contextual de notas | Ampliar o componente existente | Revisar decisões durante o trabalho, sem sair do projeto, tarefa ou meta. |
| 2 | Hipóteses de compra guardadas | Guardar parâmetros e recalcular ao reabrir | Retomar uma comparação sem preencher tudo outra vez. |
| 3 | Retrospectiva mensal | Resumo sob demanda dos registros disponíveis | Refletir sobre o mês em conjunto, com acesso às origens. |

A implementação deve seguir essa ordem em entregas separadas. As propostas abaixo estão especificadas; ainda não foram implementadas nesta rodada.

## 1. Revisão contextual de notas

### O que existe

`contextNotes()` em `js/core.js` já atende tarefas, projetos e metas. Usa vínculos diretos, vínculos das tarefas e etiquetas; exclui notas arquivadas; permite abrir, fixar uma ligação e dispensar sugestões. Mostra uma indicação de revisão pendente. A revisão semanal já permite alterar `reviewDate`, e o listener em `js/main.js` usa `noteTouch()` e preserva rascunhos.

### Lacunas verificadas

- A ordenação dá precedência ao vínculo direto antes da revisão vencida. Assim, sugestões que precisam de revisão podem ficar depois de notas sem revisão pendente.
- O componente usa `slice(0,3)` sem ação para consultar os resultados restantes.
- Reagendar a revisão exige abrir outra área, embora o campo e seu tratamento já existam.

### Entrega recomendada

- Priorizar revisões vencidas dentro do conjunto de notas efetivamente relacionadas; desempatar por vínculo direto, data de revisão e fixação.
- Manter três notas inicialmente e oferecer Mostrar mais usando a paginação existente.
- Exibir a data e reutilizar o controle de reagendamento junto à nota, dentro do bloco expansível.
- Preservar a explicação da relação e o retorno ao contexto de origem.
- Continuar usando a nota original: não criar cópias, tarefas ou lembretes automaticamente.

### Aceite e verificações

Uma quarta nota relacionada e vencida deve ser acessível; notas arquivadas ou sem relação devem continuar excluídas. Reagendar deve atualizar a nota original, sua revisão semanal, backup e sincronização. Trocar a data enquanto uma nota está em edição deve preservar o rascunho. Conferir teclado, data inválida, textos longos, 320 px a 200% de texto, privacidade e dispensa por conta.

Não é necessária mudança no modelo de dados ou uma nova aba.

## 2. Hipóteses de compra guardadas

### O que existe

`simulatePurchase()` e `simulationPanel()` em `js/financas.js` já comparam compra à vista e parcelada, incluindo cartão. O envio de `purchase-simulator` em `js/main.js` mostra resultados sem criar lançamentos. A base considera lançamentos cadastrados; recorrências ainda não lançadas e faturas sem pagamento agendado ficam fora. A data da hipótese deve ser igual ou posterior à data de referência.

### Entrega recomendada

- Acrescentar Guardar hipótese e uma lista de hipóteses junto ao simulador existente em Análises.
- Guardar nome, valor em centavos, conta, cartão opcional, data, parcelas, juros e categoria. Reutilizar os limites e a validação do simulador.
- Primeira versão: armazenamento local, separado por UID, com indicação visível de que não acompanha backup nem outros aparelhos. Usar o mecanismo local existente; evitar criar outro estado sincronizável nesta entrega.
- Ao abrir, preencher os parâmetros e recalcular com os dados atuais. Identificar a data de referência da comparação.
- Se a data ficou no passado, pedir uma nova data antes de calcular. Não deslocar parcelas silenciosamente.
- Se a conta ou o cartão foi removido, solicitar uma substituição. Não trocar automaticamente pela primeira conta.
- Excluir uma hipótese deve afetar apenas seus parâmetros guardados.

### Limites da primeira versão

Guardar uma hipótese não congela o saldo ou a previsão. O resultado pode mudar quando os lançamentos mudam. Simulações de alteração de salário ou combinações de várias compras precisam de outro contrato de cálculo; não são cobertas por este simulador de compra.

### Aceite e verificações

Guardar e reabrir deve preservar parâmetros e valores decimais sem criar lançamento, alterar saldo ou enviar dados financeiros adicionais à nuvem. Cobrir recarga, troca de conta, falha de quota, data antiga, conta/cartão removido, privacidade, exclusão e mudança dos lançamentos entre duas comparações. Uma hipótese de compra de R$ 100 deve continuar sendo de R$ 100 após salvar e abrir.

## 3. Retrospectiva mensal

### O que existe

`revCard()` em `js/core.js` reúne dados semanais, enquanto o Diário oferece uma revisão anual. Tarefas concluídas usam `dd`; leituras usam `df`; hábitos guardam marcações por data. `finMonth()`, `monthTransactions()` e `sumAbated()` já fornecem regras financeiras comuns, incluindo transferências e estornos.

`submitProjectForm()` em `js/main.js` guarda situação, início e prazo do projeto. Não guarda data de conclusão. O campo `end` é prazo; não permite afirmar em que mês o projeto foi concluído.

### Entrega recomendada

- Acrescentar uma retrospectiva mensal expansível em Hoje, após o conteúdo diário e perto da revisão semanal. Não criar nova aba ou outro painel obrigatório no Início.
- Permitir escolher um mês até o atual; no mês em curso, limitar o realizado à data de hoje e indicar que o mês está em andamento.
- Mostrar tarefas concluídas com `dd` no período, registros de hábitos e leituras concluídas com `df` no período. Oferecer acesso às áreas de origem.
- Finanças opcionais: receitas e despesas registradas, seguindo `sumAbated()` e separando movimentações futuras. Respeitar a preferência de exibir finanças e o modo Privacidade.
- Oferecer Criar nota sobre este mês usando as Notas existentes. O resumo numérico permanece calculado a partir das origens; a nota pessoal é editável e só é criada por ação explícita.
- Tratar ausência de registros como ausência de dados cadastrados, sem inferir desempenho ou gasto real igual a zero.

### Limites e cobertura

- Primeira versão sem contagem de projetos concluídos por mês. Incluir esse indicador exigiria registrar uma data real de conclusão e distinguir projetos antigos sem essa informação; o prazo não pode substituí-la.
- Tarefas e leituras sem data de conclusão não entram na contagem mensal. Explicar essa cobertura.
- Marcações de hábitos não equivalem a metas históricas cumpridas: a frequência pode ter mudado. Rotular como registros, sem reconstruir sequências antigas pela frequência atual.
- Anos financeiros e diários arquivados devem indicar cobertura parcial ou indisponível até haver leitura explícita desses arquivos. Não apresentar resumo dos dados carregados como histórico completo.
- Não criar correlações automáticas entre humor e gastos nem atribuir causas aos números.

### Aceite e verificações

Cobrir virada do mês e do ano, fevereiro, mês atual parcial, período vazio, registros sem data, dados arquivados e privacidade. Transferências não devem duplicar despesas; um gasto de R$ 100 com estorno de R$ 20 deve seguir a mesma regra líquida da análise financeira existente. Abrir a retrospectiva não deve criar dados nem modificar origens. Criar uma nota deve preservar backup, sincronização, rascunhos e recuperação já existentes.

## Verificação e conclusão desta avaliação

As três propostas reaproveitam componentes e fontes de dados existentes. Não precisam de mudança de framework, integração externa ou nova aba. As regras acima delimitam uma implementação revisável e evitam tratar dados históricos ausentes como fatos.

Esta rodada modificou apenas documentos de tarefas. A suíte da entrega anterior continua sendo uma evidência daquela entrega (29 unitários e 312 cenários), não uma validação das funcionalidades propostas aqui. O ensaio com Firebase real e aparelhos físicos permanece pendente no roteiro já existente.
