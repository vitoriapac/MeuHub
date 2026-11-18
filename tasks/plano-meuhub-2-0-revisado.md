# Plano revisado de implementação — MeuHub 2.0

**Data:** 18/11/2026

**Situação:** proposta de trabalho; este documento não autoriza, por si só, a implementação nem afirma que os itens foram concluídos.

**Origem:** plano “MeuHub 2.0” fornecido pela pessoa usuária, ajustado à análise do código e às decisões da conversa. O documento original permanece preservado no anexo da conversa.

## Objetivo e limites

Evoluir o organizador pessoal sem perder a experiência local-first, o PWA, a publicação estática e a compatibilidade com os dados existentes. Priorizar os fluxos do dia e a confiança nos dados; entregar melhorias pequenas, verificáveis e reversíveis.

- Preservar prazos, datas planejadas, configurações, vínculos e dados já cadastrados.
- Não transformar simulações em lançamentos reais nem fazer movimentações bancárias.
- Arquivamento não é exclusão; fechamento financeiro não é arquivamento de item.
- Usar estado derivado sempre que possível e persistir somente escolhas que precisem sobreviver à sessão.
- Manter scripts clássicos, JavaScript sem framework, PWA e funcionamento offline, salvo decisão posterior fundamentada.
- Testar com dados fictícios; não modificar dados reais durante verificações.
- A integração bancária é uma iniciativa separada, documentada em [plano-open-finance-pessoal.md](plano-open-finance-pessoal.md), e não é dependência deste plano.

## Base atual a preservar

O ponto de partida deve ser confirmado no início da execução, pois há alterações locais ainda não incorporadas a um commit. A última suíte registrada passou em **162 cenários**, com Firebase simulado; confirmar novamente, sem assumir que esse número continuará igual.

O projeto já tem Hoje, caixa de entrada, Agenda, `autoSlot`, tarefas, revisão semanal e uma primeira revisão guiada; rotinas de manhã e noite; lembretes e `attention()`; notas arquiváveis; lixeira, versões locais e desfazer; listas de compras com quantidade, orçamento estimado e histórico; finanças com `cashFlow()`, contas, cartões, recorrências e previsão até o próximo recebimento. As cinco melhorias recentes — revisão guiada, próximo passo da meta, atalhos de notas, resumo de segurança e contas futuras — também devem ser consideradas na linha de base.

**Nomes reais a confrontar antes de editar:** notas usam `archived`; as conexões ficam em `S.lnk`; as chaves sincronizadas são listadas em `SK`; `merge3()` faz a mesclagem. O plano original cita `notes.arch`, `links2`, `DEF()` e `migrate()` como se fossem estruturas existentes; não presumir essas APIs nem criar uma migração com base nesses nomes. A restauração e validação atuais também precisam ser revistas para qualquer campo novo.

**Decisão já tomada sobre hábitos:** frequência semanal de N vezes, com sequência calculada pela frequência atual e histórico preservado. Dias específicos, pausas e outras regras são extensões futuras e não são pré-requisitos de F01.

## Ordem revisada

```text
P0 base e segurança
   ↓
F01 consistência → F02 atenção existente → F04 planejamento em lote
   ↓                       ↓
F03 política de arquivo    F05 planejamento e F06/F07, quando úteis
   ↓
F08 compras → F09 simulador e F10 assinaturas
   ↓
F11 projetos / F12 histórico / F13 exportação / F14 contextos
```

F02 começa apenas com fontes confiáveis já existentes; compras e assinaturas entram depois de suas próprias regras estarem prontas. F03 exige política e testes antes de expandir o arquivamento. F04 pode avançar sem esperar a central completa de arquivados, desde que suas ações não dependam de arquivar. F11–F14 não bloqueiam as etapas anteriores.

## P0 — Consolidar e medir a base

- [ ] Revisar o estado Git e a procedência das alterações locais; preservar trabalho preexistente e evitar misturar mudanças alheias. Preparar uma linha de base reproduzível antes de alterações de esquema.
- [ ] Executar `node tests/run.js`; registrar resultado, versões, comportamento offline, restauração e PWA. Criar fixtures fictícias representando backups antigos e estados parcialmente preenchidos.
- [ ] Mapear os fluxos de `save()`, `render()`, `SK`, validação, restauração, mescla, versões e rascunhos nos módulos afetados. Verificar o impacto de versões diferentes do PWA abertas ao mesmo tempo.
- [ ] Definir como testar isolamento e recuperação em duas sessões simuladas; registrar separadamente o que exige Firebase e aparelhos reais.

**Aceite:** linha de base e limitações registradas, backups fictícios recuperáveis, nenhuma alteração destrutiva e responsabilidades dos componentes identificadas. As [medições existentes](medicoes-persistencia-m6.md) são referência, não substituem nova medição quando a arquitetura mudar.

## Ciclo 1 — Consistência, atenção e ações diárias

### F01 — Consistência de hábitos e previsões · prioridade alta

- [ ] Definir o significado dos indicadores de hábitos em Hoje e Início: realizado hoje, diário pendente e progresso semanal devem ser distinguíveis. Reaproveitar `habitInfo()` e as regras de frequência existentes; uma meta semanal cumprida não deve ser tratada como obrigação diária.
- [ ] Extrair uma função de domínio somente se ela reduzir divergências entre telas; não introduzir dias agendados sem decisão posterior.
- [ ] Revisar premissas visíveis da previsão até a receita, exclusões de contas/faturas sem vínculo e testes de duplicação.
- [ ] Cobrir virada de semana, frequência alterada, dados antigos, horários locais e coerência entre Hoje, Início e lembretes.

**Aceite:** cada indicador explica seu período e significado; meta semanal cumprida não gera pendência diária indevida; previsões mostram premissas; dados antigos e testes de sincronização continuam íntegros.

### F02 — Evoluir “Precisa de atenção” · prioridade alta

- [ ] Partir de `attention()`, `attBox()` e da tela de Lembretes; não criar uma segunda central com as mesmas informações.
- [ ] Especificar regras do MVP para tarefas vencidas, conflitos comprovados de agenda e alertas financeiros confiáveis. Distinguir dados previstos de confirmados e oferecer acesso à origem.
- [ ] Implementar coletores e deduplicação com identificadores estáveis. Se houver dispensa temporária, persistir apenas a decisão e sua validade; definir invalidação quando a origem mudar.
- [ ] Preservar modo privacidade, preferências e acessibilidade. Inserir compras e assinaturas somente após F08/F10 fornecerem dados confiáveis.

**Aceite:** uma situação aparece uma vez, sua ação leva à origem correta, resolvê-la a remove e dispensá-la não modifica o item; estados vazios e informações financeiras respeitam privacidade.

### F04 — Planejamento em lote · prioridade alta

- [ ] Aproveitar as ações existentes de planejar tarefas para amanhã, inclusive na rotina, e acrescentar seleção, prévia e escolha de data em Tarefas ou Atenção.
- [ ] Planejar altera somente `hd` ou a data planejada equivalente; prazo só muda em uma ação explícita. Não mover eventos fixos nem modificar uma série recorrente sem escolha específica.
- [ ] Definir comportamento para itens incompatíveis e garantir uma única operação de desfazer para o lote.

**Aceite:** seleção de múltiplas tarefas pode ser revista e cancelada; execução e desfazer preservam os prazos; recarga e sincronização não duplicam ou perdem alterações.

### F03 — Política de arquivamento e central · prioridade alta, risco de dados

- [ ] Primeiro mapear `archived` de notas, lixeira, recorrências, busca, conexões, fechamento financeiro, backup e mesclagem. Distinguir arquivo, conclusão e exclusão.
- [ ] Definir por tipo o que arquivar significa, quais vistas e automações deixam de mostrar o item, como restaurar e o que fazer com recorrências. Não presumir uma política única para todos os tipos.
- [ ] Iniciar a central reaproveitando notas/listas já arquiváveis; ampliar gradualmente para tarefas e metas somente com leitura compatível, sincronização e recuperação testadas. Não criar cópias paralelas dos objetos.
- [ ] Adicionar busca, leitura e restauração; exclusão deve usar a lixeira aplicável e explicar suas consequências.

**Aceite:** arquivar/restaurar preserva IDs, atributos, vínculos e estado de conclusão; itens arquivados não geram pendências indevidas; restauração e conflito entre aparelhos não perdem dados. Separar qualquer migração aditiva de uma ativação ampla.

## Ciclo 2 — Planejamento e vida diária

### F05 — Planejamento semanal integrado · prioridade alta

- [ ] Evoluir Agenda e a revisão guiada existente. Reutilizar compromissos, tarefas, capacidade e `autoSlot`; não manter uma segunda cópia do plano semanal.
- [ ] Definir o cálculo de disponibilidade com a pessoa usuária: capacidade atual do app não equivale necessariamente a janelas livres configuráveis. Explicar estimativa padrão de duração, conflitos e sobrecarga.
- [ ] Oferecer sugestão de encaixe com confirmação individual e alternância adequada para celular; preservar prazo ao alterar a data planejada.

**Aceite:** Hoje e Agenda refletem a mesma tarefa; sem gravação silenciosa por sugestão; conflito, falta de espaço e duração presumida são claros; datas locais são testadas.

### F06 — Fechamento do dia · prioridade média

- [ ] Avaliar primeiro a rotina noturna existente; completar o fluxo nela quando possível: concluídas, pendentes, humor/anotação e retomada após interrupção.
- [ ] Reutilizar dados do Diário, humor e tarefas. Persistir metadados adicionais apenas se necessários e sem duplicar texto ou estatísticas.

**Aceite:** repetir ou retomar o fechamento não duplica registros e as informações continuam editáveis.

### F07 — Modelos de tarefas · prioridade média

- [ ] Oferecer modelos simples com subtarefas e datas relativas opcionais; gerar novos IDs ao aplicar e manter instâncias independentes do modelo.
- [ ] Verificar uso offline, backup, restauração e ligações.

**Aceite:** aplicação cria somente os itens escolhidos, sem datas fixas acidentais nem vínculos quebrados.

## Ciclo 3 — Compras e decisões financeiras

### F08 — Planejamento de compras · prioridade alta, execução incremental

- [ ] Ampliar as listas existentes em Notas, preservando listas simples e os campos atuais. Antes de mudar esquema, decidir compatibilidade com itens `{id, t, q, done}`, orçamento existente e histórico vinculado por lançamento.
- [ ] Adicionar, de forma opcional, quantidade estruturada, unidade e preços estimado/real. Explicar totais parciais quando faltarem preços; não tratar preço estimado como despesa realizada.
- [ ] Especificar cálculos monetários e arredondamento; avaliar centavos inteiros para novos campos com conversão segura para o modelo financeiro existente.
- [ ] Projetar sessões parciais e referência estável por compra antes de implementar criação financeira idempotente. Manter escolha de conta, data, categoria e confirmação; revisar possíveis duplicatas sem descartar transações legítimas.
- [ ] Garantir que marcar compra ou arquivar lista não movimente conta nem apague lançamentos.

**Aceite:** `2 × R$ 18,00 = R$ 36,00`; quantidades decimais e estimativas incompletas são claras; reenvio/reconexão não duplica despesa; histórico antigo, backup e mesclagem continuam válidos.

### F09 — Simulador financeiro · prioridade alta, risco financeiro

- [ ] Registrar exemplos calculados para compra à vista e parcelada, meses de 28–31 dias, cartões, juros, contas distintas e despesas já cadastradas.
- [ ] Usar o fluxo existente como referência, mas isolar a simulação: partes de Finanças chamam `genRec()` e podem alterar estado. Trabalhar em cópia ou funções puras verificadas antes de comparar cenários.
- [ ] Mostrar Base × Cenário, menor saldo, período e exclusões; não representar uma estimativa como garantia. Não oferecer gravação real sem uma ação separada e confirmação.

**Aceite:** simular não altera `S.fin`, persistência ou sincronização; resultados são reproduzíveis e conferidos com exemplos; parcelas e faturas não são duplicadas.

### F10 — Revisão de assinaturas · prioridade média

- [ ] Evoluir recorrências e o resumo já existente com custo equivalente, histórico verificável e marcação explícita para revisar. Não inferir falta de uso.
- [ ] Adicionar ações para marcar revisão, abrir a recorrência e, se escolhida, criar tarefa. Integrar à Atenção somente quando a revisão estiver efetivamente pendente.

**Aceite:** não cria cobranças adicionais; alterações preservam histórico e alertas têm motivo verificável.

## Ciclo 4 — Contexto e ferramentas adicionais

### F11 — Projetos pessoais · prioridade média, após validação de uso

- [ ] Comparar extensão das metas e projetos textuais de tarefas com um tipo próprio; escolher o menor modelo que cubra o fluxo aprovado. Usar referências existentes em vez de copiar registros.
- [ ] Definir status, datas, custo e comportamento ao arquivar/excluir antes da interface.

**Aceite:** tarefas, notas e despesas vinculadas não são apagadas ao remover o agrupador; referências inválidas e somas duplicadas são tratadas.

### F12 — Histórico de alterações · prioridade média

- [ ] Antes de gravar eventos, especificar ações cobertas, informações mínimas, retenção, privacidade, capacidade e deduplicação entre aparelhos. O histórico não substitui desfazer nem versões locais.

**Aceite:** operações críticas ficam compreensíveis, sem expor dados desnecessários ou crescer sem limite.

### F13 — Exportação seletiva · prioridade baixa

- [ ] Exportar áreas selecionadas em JSON e, onde fizer sentido, CSV; mostrar escopo e dependências. Importação seletiva fica para especificação separada.

**Aceite:** arquivo contém apenas o escopo apresentado e não compromete o backup integral existente.

### F14 — Personalização por contexto · prioridade baixa

- [ ] Avaliar perfis de visualização para cards e atalhos, sem particionar dados; preservar perfil atual e permitir restaurar padrão. Nenhuma troca automática sem decisão explícita.

**Aceite:** alternar perfis não apaga dados nem altera indevidamente as preferências de outro perfil ou aparelho.

## Critérios transversais de conclusão

Para cada entrega: estados vazios e erros claros; teclado e alvos de toque utilizáveis; comparação em desktop e celular; modo privacidade; dados antigos, migração idempotente quando necessária, backup e recuperação; teste offline e de mesclagem para alterações persistentes; proteção contra duplicação; teste automatizado significativo; atualização de `sw.js`/versões quando aplicável; documentação e limitações reais. Com dados financeiros, usar exemplos calculados e nunca testar com dados pessoais reais em fixtures.

Atualização do PWA e rollback merecem validação separada: uma cópia antiga pode estar aberta em outro aparelho. Testes simulados não comprovam o comportamento em aparelho físico ou Firebase de produção.

## Decisões em aberto antes das fases dependentes

1. Quais situações devem aparecer na Atenção e por quanto tempo uma dispensa deve valer?
2. Quais tipos poderão ser arquivados, e arquivar uma recorrência pausa futuras ocorrências?
3. Planejamento em lote deve permitir alterar prazo, além de data planejada? Se sim, essa ação deve ser separada e explícita.
4. Qual granularidade de compras parciais e como conciliar lista, cartão e lançamentos anteriores?
5. Para F05, existem janelas de disponibilidade configuráveis ou somente uma capacidade diária?
6. Quais custos, datas e hipóteses serão admitidos no simulador? Como explicar faturas sem conta de pagamento?
7. F11 deve ser um projeto independente ou uma evolução de metas e projetos já existentes?

## Primeira entrega sugerida

1. Consolidar a linha de base e preservar as alterações locais.
2. Especificar e testar os indicadores de hábitos diários e semanais em Hoje/Início.
3. Revisar as regras atuais de Atenção e o modo privacidade, com testes de deduplicação e navegação à origem.
4. Propor a interface de seleção e a semântica do desfazer para planejamento em lote.
5. Mapear os tipos e fluxos de arquivamento antes de introduzir campos ou migrações.

**Checkpoint:** conferir resultados e usabilidade, especialmente em celular, antes de iniciar compras e o simulador. Nenhum item deve ser marcado como concluído apenas por ter sido analisado ou parcialmente implementado.
