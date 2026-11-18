# Plano de evolução do MeuHub

**Data:** 18/11/2026  
**Objetivo:** facilitar o planejamento e a execução do dia, começando pela experiência no celular e protegendo os dados existentes.  
**Base:** análise fornecida pela usuária, confrontada com o código local e com `PRODUCT.md`, `SPEC.md` e `ARCHITECTURE.md`.  
**Situação:** execução autorizada e parcialmente realizada; os itens abaixo continuam abertos até cumprirem seus critérios.

## Registro de execução

- A usuária autorizou seguir o plano e pediu atualização da documentação ao final.
- Continuação M13–M17: a agenda semanal passou a usar a escala tipográfica relativa para dias, datas e eventos. Foram adicionadas verificações em 320/375 px para conteúdo extenso, temas claro/escuro, densidades e texto ampliado, além de testes específicos da escala da agenda. A inspeção visual da agenda em 375 px e texto ampliado também levou à correção dos nomes da barra mobile e da largura dos campos de data. A revisão automática não substitui inspeção visual de todos os estados nem testes físicos; as etapas continuam abertas até os critérios pendentes serem atendidos.
- Continuação M6–M11: medições e recomendação em `tasks/medicoes-persistencia-m6.md`; mantida a sincronização atual. Corrigida a seleção de receita recorrente remarcada e o alerta de saldo com poucos lançamentos; adicionados cenários de transferências, saldo negativo, remoção/restauração de ligação e virada de semana. Verificações físicas, integração real e demais critérios abaixo ainda precisam de revisão.
- Continuação M0–M5: foram adicionados testes de menu personalizado após recarga, captura offline e data obrigatória, encaixe sem conflito ou horário livre, duração padrão e repetição, e percurso captura → conclusão/adiamento → revisão após recarga. A suíte passou em 145 cenários com Firebase simulado. O mapa M1 foi detalhado abaixo; ainda faltam a revisão completa de estados e a avaliação do percurso pela pessoa usuária em celular, incluindo aparelho físico quando disponível. Os itens permanecem abertos até esses critérios serem cumpridos.
- Solicitação posterior: incluir a adoção de uma grade de 8 pontos em todos os componentes e uma escala tipográfica coerente. A migração de espaçamento e tipografia foi aplicada aos estilos compartilhados e às telas, com inventário em `tasks/inventario-grade-8p-2026-11-18.md`. Foram verificados 138 cenários, larguras de 320 a 1280 px e fonte ampliada em emulação. Permanecem pendentes a revisão visual de todos os estados e a validação em telefone físico/PWA instalado; a agenda diária agora oferece uma lista recolhível com ações acessíveis para eventos e tarefas, inclusive quando são curtos ou simultâneos. As ações dos cartões de links e eventos semanais também foram ampliadas e testadas em emulação.
- A previsão usa a conta principal escolhida no aplicativo e a próxima receita futura cadastrada ou recorrente nela. Despesas do mesmo dia entram; entradas nesse dia, faturas sem pagamento agendado e contas sem conta de pagamento definida não entram e são explicadas. Contas fixas independentes podem ser vinculadas a uma conta de pagamento. Testes de conta, receita, recorrência, despesas e possíveis duplicidades foram adicionados; ainda cabe revisar os demais cenários financeiros antes de concluir M9.
- Hábitos aceitam meta semanal de 1 a 7 registros. Alterar a frequência preserva o histórico e recalcula a sequência usando a meta atual; hábitos antigos continuam diários. Implementação inicial e testes de alteração e pendência adicionados; ainda faltam os demais cenários e verificação visual de M11.
- Mobile: menu separado, acessibilidade de Sistema, personalização, tamanhos e espaço inferior implementados anteriormente; validação física e revisão dos demais estados ainda pendentes.
- Mapeamento inicial: captura rápida e caixa de entrada em `qa()`/`inboxPanel()`; Hoje em `hoje()`; resumo e linha do tempo em `heroCard()`/`lineCard()`; carga e encaixe em `dayLoad()`/`autoSlot()`; revisão semanal em `revCard()`. A captura distingue data planejada de prazo e mantém campos ao alternar tipos; Início destaca a próxima tarefa; Hoje oferece encaixe individual e sugestões compatíveis com a capacidade e horários, dispensáveis até recarregar; a revisão mostra pendências sem prazo e leva a Hoje. As tarefas M1–M5 ainda exigem os demais testes e checkpoints descritos abaixo.
- Medição inicial em Firebase simulado com dados fictícios: navegar e renderizar causou 1 gravação local e 1 agendamento de sincronização, mas 0 gravações na nuvem; uma edição seguida de renderização causou 3 gravações locais, 3 agendamentos e 2 gravações do mock de documentos de nuvem, incluindo os retornos assíncronos. Não extrapolar esses números para produção. As medições offline e de recebimento remoto foram acrescentadas em `tasks/medicoes-persistencia-m6.md`; a recomendação atual é manter a persistência até haver evidência de custo material em uso real.
- Verificação desta etapa: `node tests/run.js` passou em 134 cenários; navegação e telas alteradas foram examinadas em emulação de celular. A suíte cobre, entre outros casos, captura, capacidade, frequência, backup, mesclagem e previsão. Ainda faltam revisão do fluxo completo e teste em aparelho físico. A documentação de uso, especificação e trechos do modelo de dados e renderização foram atualizados.
- Continuam pendentes: concluir os checkpoints de M0–M5, terminar as medições de M6 e revisão de M7–M8, ampliar a verificação financeira de M9, avaliar contextos adicionais de M10, testar histórico e mudanças de frequência em cenários mais amplos de M11 e concluir a revisão final M12. O percurso meta → tarefa e nota foi verificado com dados atualizados e desvinculação sem perda. Os itens abaixo permanecem abertos para não confundir entregas parciais com fases concluídas.

## Diagnóstico e decisões

- O produto atende principalmente à organização diária, às finanças e à companhia de fundo; preservar personalização, funcionamento offline e privacidade.
- Já existem Hoje, caixa de entrada, prioridades, capacidade, blocos de tarefas, `autoSlot`, conflito de agenda, revisão semanal e captura rápida. A primeira evolução deve conectar e simplificar esses recursos, não recriá-los.
- Finanças já oferece alertas de orçamento, contas a vencer e fluxo de caixa de 30/60/90 dias. Uma previsão até o próximo recebimento exige definir as regras de negócio antes de apresentar um número utilizável para decisões.
- `render()` chama `save()`, que serializa o estado e agenda sincronização; `push()` compara os dados com a última versão e pode evitar gravação remota. Portanto, renderizar não comprova por si só escrita redundante no Firestore. Mudança na persistência depende de medição e cobertura dos fluxos atuais.
- A mesclagem já avisa sobre conflitos e guarda versões, inclusive recusando a aplicação se não puder preservar a versão remota. Melhorar a recuperação sobre essa base, sem trocar a política de mescla sem testes.
- O trabalho mobile da conversa anterior estava modificado no checkout no início da execução e foi preservado como linha de base; sua validação em aparelho físico continua pendente.
- O anexo contém apenas a tabela do ciclo 3; os ciclos 1 e 2 abaixo são uma proposta própria, não a reprodução de tabelas ausentes.

## Limites e regras gerais

1. Manter HTML, CSS e scripts clássicos, sem framework, build ou nova dependência salvo justificativa e decisão posterior.
2. Manter dados, configurações, personalizações, importações antigas, fluxos offline e isolamento por conta; testar alterações de esquema com backups antigos e mescla entre aparelhos.
3. Preferir adaptação de funções e componentes atuais; não fazer reescrita geral, migração para IndexedDB ou abstração de serviços antecipadamente.
4. Preservar a identidade Caderno Solar, os temas, as paletas, o modo Companhia e o zoom do navegador.
5. Para cada tarefa: escrever teste que demonstre o comportamento, implementar, executar testes pertinentes e registrar resultado. Antes de considerar uma fase pronta, executar `node tests/run.js` e verificar cenários visuais em mobile e desktop quando houver interface.
6. Mudanças em `css/` ou `js/`: atualizar em conjunto `?v=` do `index.html` e `VER` do `sw.js`. Não misturar trabalho de outra sessão no commit.
7. Não presumir publicação: após commit/push autorizado, verificar o deploy separadamente quando houver acesso.

## Dependências

```text
M0 mobile em andamento ──► M1 linha de base ──► M2–M4 planejamento diário ──► M5 revisão integrada
                                  └────────────► M6–M7 integridade e persistência
M4 + M7 ──► M8–M9 finanças       M4 ──► M10 conexões       M7 ──► M11 hábitos
M0 + inventário da interface ──► M13–M17 grade de 8 pontos e tipografia
M5 + M8–M11 + M13–M17 ──► M12 refinamento, documentação e decisão de próximos passos
```

M6 pode ser investigada junto das tarefas de experiência, mas alterações em persistência e sincronização devem ser sequenciais e não disputar o mesmo checkout com mudanças de interface.

A migração visual M13–M17 deve ser coordenada com o mobile e com as telas em evolução, para não substituir alterações ainda não integradas nem exigir duas migrações dos mesmos componentes. M12 fecha a documentação após as tarefas de grade efetivamente concluídas.

## Ciclo 0 — Consolidar o que já está em andamento

- [ ] **M0 — Finalizar e validar o mobile atual.** Arquivos: `css/style.css`, `index.html`, `js/main.js`, `js/recursos.js`, `sw.js`, `tests/run.js`. Conferir o menu agrupado e personalizável, acesso a Sistema, fontes, foco, fechamento, áreas de toque e fim de página em 320/375/430 px, temas claro/escuro e desktop; testar com teclado e, quando possível, em um telefone real com teclado virtual e PWA instalado. Verificar que atalhos personalizados e grupos do desktop sobrevivem à atualização. Rodar a suíte completa, revisar o diff e só então integrar a mudança. **Aceite:** nenhum destino essencial fica inacessível; controles e último conteúdo continuam alcançáveis; atalhos anteriores permanecem; limitações de aparelho real são registradas. **Depende:** nenhum.

## Ciclo 1 — Um fluxo diário compreensível

- [ ] **M1 — Mapear o percurso existente e fixar uma linha de base.** Arquivos: `js/inicio.js`, `js/core.js`, `js/recursos.js`, `js/main.js`, `tests/run.js`. Registrar onde acontecem captura, priorização, planejamento, agendamento, conclusão e adiamento; identificar onde Início e Hoje repetem informações e como a navegação preserva os dados. Testar uma tarefa com prazo, um compromisso e uma tarefa sem data; registrar telas vazias e cheias. **Aceite:** inventário com pontos de entrada e lacunas reproduzíveis, sem alterar comportamento. **Depende:** M0.

### M1 — Mapa do percurso diário

| Etapa | Entrada e comportamento atual | Estado vazio e continuidade |
|---|---|---|
| Capturar | Captura rápida em `qa()`; a caixa de entrada em `inboxPanel()` guarda itens para organizar depois. A tarefa pode ficar sem data, ser planejada para hoje ou para outra data, com prazo independente. | A caixa vazia oferece captura; cancelar a conversão mantém o item original. |
| Priorizar e planejar | Início usa `heroCard()` e `lineCard()` para resumo; Hoje usa `hoje()` e mostra atrasadas, planejadas e sugestões por prioridade, capacidade e espaço. | Sem tarefas planejadas, Hoje permite adicionar uma; a configuração dos cartões de Início é preservada. |
| Agendar | Em Hoje, Encaixar usa `autoSlot()`; Agenda apresenta blocos e a capacidade por `planPanel()`. | Sem espaço entre 8h e 22h, o encaixe avisa e não cria bloco; ausência de duração usa 30 minutos. |
| Executar e adiar | O controle de conclusão atualiza a tarefa; Adiar para amanhã modifica o prazo para amanhã e retira a tarefa do planejamento de hoje. | Tarefas concluídas aparecem em Hoje; a ação de adiar é distinta de simplesmente planejar, que preserva o prazo. |
| Revisar | `revCard()` mostra concluídas, pendentes e permite retornar a Hoje; preferências ficam no estado sincronizado. | Tarefas sem prazo aparecem como pendentes, sem serem descritas como atrasadas. |

- [ ] **M2 — Dar papéis claros a Início e Hoje.** Arquivos: `js/inicio.js`, `js/core.js`, `css/style.css`, `tests/run.js`. Em Início, evidenciar resumo do dia e próximos itens mantendo os cards e sua configuração; em Hoje, priorizar ações de execução e revisão do dia. Usar os dados existentes e preservar a escolha de cards. **Aceite:** em dados vazios há próximo passo útil; em dados mistos, próximo compromisso e tarefas importantes são identificáveis; configurações existentes e Companhia continuam funcionando. **Verificar:** testes de cards configurados, vazios e ordenação; revisão visual 375 px e desktop. **Depende:** M1.

- [ ] **M3 — Captura de tarefa com destino explícito.** Arquivos: `js/recursos.js`, `js/main.js`, `tests/run.js`, eventualmente `css/style.css`. Usar a captura rápida e os modelos atuais para oferecer guardar na caixa, fazer hoje ou agendar, sem apagar rascunhos. Distinguir prazo de data planejada; não alterar prazos ao simplesmente planejar o dia. **Aceite:** cada escolha cria um único item no local esperado; cancelar preserva dados preexistentes; agendar solicita dados necessários; erros são recuperáveis. **Verificar:** criar, cancelar, offline, recarregar e concluir; teclado no celular. **Depende:** M1.

- [ ] **M4 — Planejar e executar sem saltos desnecessários.** Arquivos: `js/core.js`, `js/recursos.js`, `js/main.js`, `tests/run.js`. A partir de Hoje, apresentar sugestões baseadas em tarefas pendentes, prioridades, compromissos e capacidade já calculada; permitir aceitar ou ignorar cada sugestão e usar `autoSlot` para encaixe individual. Não agendar em lote automaticamente. **Aceite:** compromisso em conflito, falta de espaço e duração ausente têm comportamento explícito; ação de planejar não altera prazo; repetição da ação não duplica tarefa ou bloco; concluída/adiada aparece de forma coerente em Hoje e Agenda. **Verificar:** agenda vazia, dia cheio, conflito e recarga. **Depende:** M3.

- [ ] **M5 — Revisão do fluxo diário.** Arquivos: `js/core.js`, `js/inicio.js`, `tests/run.js`. Garantir que a revisão existente permita identificar o que foi concluído e o que continua pendente, com ações existentes de adiar ou voltar ao planejamento. **Aceite:** tarefas concluídas não reaparecem como pendentes e as que não têm prazo não são apresentadas como atrasadas; revisão não perde preferências. **Verificar:** fluxo captura → planejar → concluir/adiar → revisão, inclusive após recarga. **Depende:** M2 e M4.

**Checkpoint 1:** M0–M5 verificadas; revisão da usuária do fluxo diário em celular. A suíte passa e não há perda de personalização nem dados.

## Ciclo 2 — Segurança dos dados e decisões financeiras

- [ ] **M6 — Medir antes de alterar persistência.** Arquivos: `js/core.js`, `js/main.js`, `js/sync.js`, `tests/run.js`; registros temporários somente em testes ou desenvolvimento. Medir serializações, gravações locais, agendamentos e gravações remotas ao navegar, editar e receber atualizações. Inventariar chamadas de `save()`, alterações de `S`, histórico/desfazer e rascunhos. **Aceite:** relatório com números reproduzíveis, fluxos de risco e uma recomendação: manter comportamento ou avançar para M7; nenhum dado pessoal é transmitido ou registrado. **Verificar:** navegação sem mudanças, edição real, offline/reconexão e atualização remota. **Depende:** M1.

- [ ] **M7 — Persistência e conflito, apenas onde a medição justificar.** Arquivos prováveis: `js/core.js`, `js/main.js`, `js/sync.js`, `js/recursos.js`, `tests/run.js`. Se M6 identificar custo ou risco material, aplicar a menor alteração que elimine gravações desnecessárias sem deixar mutações sem persistência; manter bloqueio por corrupção, aviso de falha, histórico e proteção de rascunhos. Avaliar tornar o caminho de recuperação de conflito mais claro usando os backups já existentes. **Aceite:** navegação pura não causa a operação desnecessária identificada; alterações reais sobrevivem a recarga; duas edições, exclusão concorrente, falha de quota e troca de conta não perdem dados. **Verificar:** testes com dois dispositivos simulados, offline, restauração e suíte completa. Se M6 não justificar alteração, documentar a decisão e encerrar M7 sem refatoração. **Depende:** M6.

- [ ] **M8 — Melhorar a leitura dos alertas financeiros existentes.** Arquivos: `js/financas.js`, `js/recursos.js`, `tests/run.js`, eventualmente `css/style.css`. Dar precedência a contas próximas, limite de orçamento e saldo negativo previsto já calculados; indicar período, conta e limitações do cálculo. Não somar duas vezes contas fixas, recorrências ou faturas. **Aceite:** confirmado e previsto não são confundidos; ausência de conta/dados e projeção incompleta são explicadas; detalhes levam à origem. **Verificar:** cartão, parcela, recorrência vinculada, conta filtrada e previsão sem dados; tela mobile. **Depende:** M1 e M7.

- [ ] **M9 — Avaliar e especificar dinheiro até o próximo recebimento.** Arquivos prováveis: `js/financas.js`, `tests/run.js`, plano de regras em documento próprio. Antes de codificar, definir com a usuária: o que conta como próximo recebimento, seleção de contas, data de referência, despesas incluídas, faturas, transferências, reserva mínima, ausência/múltiplas receitas e estimativas. Comparar a proposta com `cashFlow()` e só prosseguir se houver benefício além da previsão atual. **Aceite para qualquer implementação:** exemplos calculados e revisados, sem duplicidades; premissas e lacunas visíveis; nunca rotular estimativa incerta como saldo garantido. **Verificar:** cenários com e sem recebimento, saldo negativo, fatura, transferência e datas iguais. **Depende:** M8. **Decisão registrada:** conta principal escolhida, próxima receita futura cadastrada ou recorrente, despesas até a data inclusive; faturas sem pagamento agendado e contas sem vínculo são avisadas e não somadas.

**Checkpoint 2:** riscos de dados conhecidos e testados; nenhum novo indicador financeiro publicado sem regras e exemplos validados.

## Ciclo 3 — Conexões e uso recorrente

- [ ] **M10 — Contexto entre itens relacionados.** Arquivos: `js/recursos.js`, `js/core.js`, `js/financas.js`, `tests/run.js`, conforme o tipo escolhido. Mapear primeiro as ligações já existentes; escolher um percurso concreto, como meta → tarefas e nota, e mostrar contexto e retorno à origem sem copiar dados. Só incluir compromissos ou valores se o vínculo existente e o escopo escolhido suportarem essa relação. **Aceite:** editar a origem atualiza o contexto; remover uma ligação não apaga itens; exclusão/restauração não deixa referência enganosa. **Verificar:** item removido, dados antigos, busca e backup. **Depende:** M4 e M7.

- [ ] **M11 — Hábitos em dias previstos e frequência semanal.** Arquivos prováveis: `js/core.js`, `js/main.js`, `js/recursos.js`, `js/sync.js`, `tests/run.js`. Primeiro decidir com a usuária como representar dias da semana e metas de N vezes/semana, e como tratar histórico anterior, início de semana, pausas e mudança de frequência. Preservar o padrão diário para hábitos antigos; atualizar Hoje, histórico, sequência e validação/backup de modo coerente. **Aceite:** dia não previsto não é tratado como falha; progresso semanal é legível; os registros antigos não mudam nem somem. **Verificar:** fim de semana, virada de semana, horário local, alteração de frequência, backups antigos e dois aparelhos. **Depende:** M7. **Decisão registrada:** acompanhar semanalmente e recalcular a sequência pela frequência atual, preservando as marcações.

- [ ] **M12 — Revisão final e documentação.** Arquivos: `README.md`, `SPEC.md`, `ARCHITECTURE.md`, `PRODUCT.md`, `DESIGN.md` quando necessário e `tests/run.js`. Atualizar documentação apenas conforme o comportamento efetivamente entregue; verificar campos e fluxos de sincronização no código em vez de assumir que estão defasados. Revisar clareza, contraste, foco, movimento reduzido, navegação e formulários em telas cheias e vazias; preservar personalização. **Aceite:** documentação coincide com a implementação; jornada principal funciona em desktop e mobile; suíte passa; pendências e testes em aparelhos reais ficam explícitos. **Depende:** das tarefas efetivamente escolhidas e concluídas, incluindo M13–M17 quando implementadas.

## Frente transversal — Grade de 8 pontos e tipografia

**Objetivo:** aplicar uma linguagem espacial consistente a todos os componentes do MeuHub, com tipografia legível e alinhada a essa linguagem. A grade organiza principalmente espaçamentos, dimensões de componentes e alturas de linha; tamanhos de fonte não precisam ser múltiplos de 8 para serem legíveis. Preservar a família Outfit e seus fallbacks, salvo decisão posterior da usuária.

**Ponto de partida:** `DESIGN.md` documenta espaçamentos de 6, 10, 12, 16 e 18 px e tamanhos de fonte entre 12 e 36 px; `css/style.css` e estilos inline em `js/` contêm outras medidas. A migração precisa conciliar essas regras e o código existente, abrangendo os estilos de componentes compartilhados e de telas específicas.

**Contrato proposto para implementação:**

1. Usar múltiplos de 8 px como base para espaçamento externo e interno, intervalos e dimensões de componentes; documentar o uso excepcional de meios passos de 4 px quando necessário para elementos compactos.
2. Definir uma escala tipográfica por função — texto, texto auxiliar, rótulos, títulos e valores — e alturas de linha compatíveis com a grade quando fizer sentido. Não arredondar automaticamente todos os tamanhos de fonte para múltiplos de 8. Usar unidades relativas onde forem adequadas e respeitar o tamanho e o zoom configurados no navegador.
3. Garantir campos de texto com tamanho legível no mobile e alvos de toque de pelo menos 44 × 44 px, sem reduzir acessibilidade para encaixar um elemento na grade; preferir dimensões alinhadas à grade quando viável.
4. Não tratar bordas de 1 px, ícones, gráficos, posicionamento de precisão, unidades relativas, percentuais ou áreas seguras do sistema como violações automáticas. Registrar exceções justificadas e conferir o resultado visualmente.
5. Preservar as duas densidades, os temas, as paletas, os estados de foco/erro/desativado e a identidade existente; a densidade compacta deve continuar utilizável sem diminuir textos ou alvos de toque abaixo do necessário.

- [ ] **M13 — Inventariar componentes e desvios da grade.** Arquivos prováveis: `DESIGN.md`, `css/style.css`, `index.html`, `js/core.js`, `js/recursos.js`, `js/financas.js`, `js/inicio.js`. Listar todos os componentes compartilhados e específicos: estrutura e navegação, botões, campos, listas, cartões, diálogos, avisos, agenda, hábitos, finanças, notas, gráficos e estados vazios. Identificar dimensões e tipografia em CSS, atributos `style` e SVG, separando medidas de layout de medidas que não devem ser arredondadas. **Aceite:** inventário rastreável por componente, telas e arquivo, com exceções justificadas e prioridades. **Verificar:** busca por declarações e estilos inline mais inspeção das telas em desktop e celular. **Depende:** M0 e mapeamento M1.

- [ ] **M14 — Definir os tokens e a escala tipográfica.** Arquivos prováveis: `DESIGN.md`, `css/style.css`. Definir nomes semânticos e valores de espaçamento e tamanho, incluindo meios passos estritamente necessários; definir família/fallback, tamanhos e alturas de linha para cada função. Documentar regras de densidade, zoom, acessibilidade e exceções antes da propagação. **Aceite:** tabela de tokens e exemplos de uso sem regras contraditórias entre guia e código; hierarquia legível em tela pequena e desktop. **Verificar:** amostras com textos curtos e longos, zoom de 200%, temas e densidades; registrar os valores finais e sua justificativa em `DESIGN.md`. **Depende:** M13.

- [ ] **M15 — Migrar os componentes compartilhados.** Arquivos prováveis: `css/style.css`, `index.html`, `js/recursos.js`, `tests/run.js`. Aplicar os tokens à estrutura do app, barra e painel de navegação, botões, campos, seletores, cartões, listas, diálogos, mensagens e estados vazios. Substituir medidas inline desses componentes por classes ou tokens existentes quando necessário; evitar criar uma biblioteca ou dependência nova. **Aceite:** os mesmos componentes usam as mesmas regras em todas as telas; estados de interação e tamanho de toque são preservados; navegação e rodapé não cobrem conteúdo. **Verificar:** testes da navegação e formulários, inspeção visual antes/depois em 320, 375, 430 e 1280 px, modo claro/escuro e densidades confortável/compacta. **Depende:** M14.

- [ ] **M16 — Migrar todos os componentes específicos das telas.** Arquivos prováveis: `css/style.css`, `js/core.js`, `js/financas.js`, `js/recursos.js`, `js/inicio.js`, `tests/run.js`; executar por área em alterações pequenas e verificáveis. Cobrir Início, Hoje, Rotina, Lembretes, Agenda, Tarefas, Metas, Hábitos, Notas, Diário, Links, Etiquetas, Finanças, Leituras e telas de sistema; incluir estados vazios, carregamento, erro, conteúdo extenso e menus. Manter SVGs, calendários e tabelas legíveis e funcionais, justificando exceções em vez de distorcer dados ou interações. **Aceite:** cada componente do inventário M13 é migrado ou possui exceção documentada; nenhum fluxo, configuração ou dado é perdido. **Verificar:** testes relevantes por área, navegação por teclado, texto ampliado e comparação visual responsiva. **Depende:** M15 e implementação de cada tela afetada.

- [ ] **M17 — Auditoria final da grade e regressão.** Arquivos prováveis: `DESIGN.md`, `css/style.css`, arquivos de telas afetados e `tests/run.js`. Comparar a implementação com o inventário M13 e os tokens M14, registrar exceções e atualizar o guia; revisar espaçamento, quebras, hierarquia da fonte, contraste, foco, rolagem e áreas seguras. **Aceite:** nenhuma classe de componente fica sem revisão; exceções têm motivo; sem sobreposição ou corte de conteúdo nos tamanhos verificados; o guia descreve o que foi realmente implementado. **Verificar:** `node tests/run.js`, capturas em 320/375/430/1280 px, temas, densidades, zoom e, quando disponível, telefone físico e PWA instalado. **Depende:** M16.

**Checkpoint da grade:** concluir M13–M17, comparar os componentes com o inventário e registrar qualquer limitação de teste físico antes da revisão final M12.

## Adiado até existir necessidade concreta

- Integração com Google Calendar: projeto separado, inicialmente leitura, com definição de permissões, contas, sincronização e conflitos antes de qualquer escrita.
- Migração para IndexedDB: somente após medir limites reais de volume e desenhar migração, rollback, backup e compatibilidade com sincronização.
- Reorganização geral por serviços ou mudança de framework: considerar por domínio somente quando houver problema de manutenção demonstrado.
- Assistente de IA, gamificação, editor complexo e novas visualizações: fora do escopo deste plano.

## Questões para decidir antes das tarefas correspondentes

1. **M2–M5:** quais ações você mais repete durante o dia e o que deve aparecer primeiro? Validar a proposta na tela antes de alterar a organização por padrão.
2. **M9:** a conta principal, o próximo recebimento, despesas no mesmo dia e itens sem vínculo já foram definidos. Resta decidir se deve existir alguma reserva mínima além dos valores cadastrados.
3. **M10:** qual ligação oferece mais valor primeiro: meta e tarefas, nota e projeto, ou outro fluxo concreto?
4. **M11:** a frequência é escolhida por hábito e a sequência segue a meta atual; ainda cabe verificar como apresentar o histórico quando essa meta muda.

Essas decisões não impedem M0, M1 ou M6. As estimativas de esforço e prazos dependem das respostas e do resultado das medições; não foram inventadas.
