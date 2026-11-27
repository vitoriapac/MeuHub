# Melhorias recomendadas em 27/11/2026

Autorização: seguir a recomendação da análise do projeto. Entregas graduais, priorizando proteção de dados e os fluxos cotidianos.

- [x] Identificar campos conflitantes na mesclagem e conferir valores em Backup; preservar versões, isolar por conta e bloquear escolha sobre campo alterado.
- [ ] Executar o roteiro de recuperação com Firebase real e aparelhos físicos (depende de acesso a esses ambientes).
- [x] Revisar Tarefas e Agenda em 320 px com texto a 200%, aproximando o conteúdo dos controles frequentes.
- [x] Encurtar a escolha de próximos passos na revisão dos projetos, reutilizando o fluxo existente.
- [x] Adicionar estado Aguardando a tarefas com data de revisão, preservando prazo e histórico.
- [x] Encurtar a conferência financeira com retomada do percurso.
- [x] Avaliar revisão de notas contextual, cenários financeiros e retrospectiva mensal, após as etapas prioritárias. Ver [avaliação e regras](avaliacao-notas-cenarios-retrospectiva-2026-11-27.md).
- [ ] Ampliar a revisão contextual: priorizar notas vencidas, mostrar mais resultados e reagendar junto à nota.
- [ ] Guardar parâmetros de hipóteses de compra neste aparelho, com recálculo e validação ao reabrir.
- [ ] Criar retrospectiva mensal sob demanda, com cobertura dos dados explícita e nota pessoal opcional.

Notificações com página fechada e extrações de módulos dependem de necessidade e escopo concretos; não são pré-requisitos das etapas acima.

Validação da primeira entrega: 28 testes unitários, 302 cenários na suíte completa de navegador e 7 cenários focados em conflitos após proteger a cópia dos valores. Conferência visual a 375 px, versão PWA 20261127 e verificação de diff sem erros. Firebase real e aparelho físico não foram utilizados. Alterações locais, sem commit ou publicação.

Segunda entrega: Tarefas reúne visualização e filtros num grupo expansível com o escopo visível. Agenda recolhe criação e seleção de visualização; os atalhos abrem o formulário e a edição o mantém aberto. Na amostra de 320 px, texto a 200%, a primeira tarefa passou de 1.254 para 724 px e a semana de 1.219 para 689 px, sem transbordamento da página. A revisão permite escolher tarefas vinculadas ativas e pendentes diretamente, preservando prazo e a etapa aberta. Projetos sem tarefas disponíveis orientam a vincular um item.

Validação da segunda entrega: 28 testes unitários e 305 cenários de navegador passaram. O teste de foco da Agenda abre o seletor antes de focar o botão, conforme o novo fluxo. Conferência visual em 320 px a 200% de texto e revisão de projetos em 375 px. Versão PWA 20261127a; alterações locais, sem commit ou publicação.

Terceira entrega: Aguardando guarda dependência e data de revisão, preserva prazo, planejamento e vínculos. Tarefas aguardando continuam em Tarefas, busca e projetos; saem da execução, do encaixe e da carga. Entram na revisão semanal e em Hoje a partir da data de revisão; a retomada é explícita. A próxima ocorrência recorrente não herda a espera. A conferência financeira percorre os não conferidos do mês e da conta até hoje, com pausa e retomada locais por conta de acesso. Busca, categoria e tipo não limitam o percurso. Os valores já contam no saldo; a ação altera somente a marcação de conferência. Mudança nos dados exibidos exige nova conferência, e falhas de gravação preservam o item pendente.

Validação da terceira entrega: 29 testes unitários e 312 cenários de navegador passaram. Foram cobertas espera futura/vencida, preservação de prazo e planejamento, recorrência, rascunho, backup, mesclagem, proteção durante arraste, retomada financeira, alteração concorrente do lançamento, falha de armazenamento, separação por conta, privacidade e texto ampliado. Conferência visual em 320 px; versão PWA 20261127b. Alterações locais, sem commit ou publicação. Firebase real e aparelhos físicos continuam fora do ensaio.

Quarta etapa — avaliação concluída: as três oportunidades foram conferidas no código e especificadas no documento vinculado acima. A implementação seguirá a ordem notas contextuais → hipóteses de compra → retrospectiva mensal. Projetos não possuem data de conclusão; o prazo não será usado como substituto em indicadores mensais. Esta rodada alterou apenas documentação de tarefas.
