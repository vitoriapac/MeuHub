# Plano de implementação da auditoria do MeuHub

**Data:** 25/11/2026

**Base revisada:** `3b3ee12`

**Origem:** auditoria com Impeccable e Craft. A linha de base registrou 25 testes unitários e 279 cenários de navegador com Firebase simulado.

## Escopo e ordem

Preservar a identidade visual, o limite de 1.440 px, a PWA sem etapa de build e os fluxos já adicionados às Finanças. O conteúdo principal vem antes das ferramentas e configurações. Filtros e criação ficam perto dos registros, e a edição fica junto do item.

| Pacote | Entrega | Prioridade | Tamanho | Depende de |
|---|---|---|---|---|
| A0 | Linha de base e casos de regressão | Preparação | Pequeno | — |
| A1 | Destinação segura da sobra mensal | Alta | Grande | A0 |
| A2 | Privacidade em formulários financeiros | Alta | Médio | A0. Validar o formulário novo após A1 |
| A3 | Menu e avisos no celular com texto ampliado | Alta | Médio | A0 |
| A4 | Contraste, títulos e rótulos de campos | Alta | Médio | A0 |
| A5 | Rascunhos e recuperação ao navegar | Média | Médio | A0 |
| A6 | Conteúdo principal mais cedo em Hoje, Tarefas, Agenda e Lançamentos | Média | Grande | A3, A4 e A5 |
| A7 | Grade de Finanças com poucos cartões | Média | Pequeno | A0 |
| A8 | Leitura de Notas e ações de Backup | Média | Médio | A4. Usar a política de rascunhos de A5 em Notas |
| A9 | Carregamento e renderização da PWA | Média | Médio | A0. Aplicar medições finais após A6 e A7 |
| A10 | Integração, revisão visual e documentação | Fechamento | Médio | A1 a A9 |

**Ordem sugerida:** A0 → A1 e A2 → A3 e A4 → A5 e A6 → A7, A8 e A9 → A10. A3 e A4 podem avançar enquanto A1 estiver em desenvolvimento, desde que alterações no CSS compartilhado sejam coordenadas.

## A0 — Linha de base e casos de regressão

- [x] Confirmar o commit de partida, executar as suítes e identificar diferenças em relação à auditoria.
- [x] Montar dados fictícios para reproduzir destinação repetida, privacidade com formulários abertos, perda de rascunho, Agenda semanal e menu a 200%. Incluir um backup anterior à mudança e uma carteira com histórico longo.
- [x] Guardar referências de Início, Hoje, Tarefas, Agenda, Notas, Backup e Finanças em 375 e 1.440 px. Capturar os problemas de escala em 320 px a 200%.

**Aceite:** cada problema prioritário tem passos de reprodução ou um teste. A linha de base documenta os navegadores, os dados e os cenários utilizados.

**Registro de execução:** linha de base em `3b3ee12`, com 25 testes unitários, 279 cenários de navegador e PWA `20261125i` validados. Foram reutilizadas e conferidas as capturas e evidências da auditoria desse mesmo commit, coletadas em Chromium com dados fictícios e Firebase simulado. A reprodução em 375 e 1.440 px usou as telas solicitadas. A ampliação em 320 px expôs a quebra de rótulos e a sobreposição do resumo. A carteira longa utilizou 100, 1.200 e 5.000 lançamentos adicionais. A perda de rascunho e a posição da Agenda foram registradas para A3, A5 e A6.


## A1 — Destinação segura da sobra mensal

- [x] Separar resultado realizado, valor já destinado e saldo ainda disponível. Manter receitas, despesas e saldo das contas coerentes com o extrato. Apresentar destinação interna como tal.
- [x] Registrar cada destinação com identificador estável, período, escopo, destino, valor e estado. Centralizar cálculo e gravação para metas, Reserva quando oferecida como destino e Caixa de Investimentos.
- [x] Validar novamente o valor na confirmação. Permitir várias destinações parciais dentro da sobra disponível e reversão explícita com histórico. Proteger contra clique duplo, reenvio após recarregar e reaplicação na sincronização.
- [x] Adotar uma única capacidade de destinação para cada mês consolidado. Filtros por conta podem mostrar a composição. Qualquer destinação por conta proposta na implementação precisa evitar sobreposição com essa mesma sobra.
- [x] Preservar valores antigos das metas e do caixa. Como versões anteriores não registravam a origem de cada destinação, não inferir alocações retroativas a partir dos saldos existentes.
- [x] Tratar duas destinações independentes feitas offline em aparelhos diferentes. Na reconciliação, se a soma superar a sobra, sinalizar o conflito e aplicar somente as destinações aceitas conforme a regra definida e testada.

**Aceite:** com sobra fictícia de R$ 2.000, reenviar uma destinação de R$ 1.200 mantém apenas um crédito. Outra de R$ 800 é aceita e o disponível zera. Reverter uma destinação libera somente seu valor. Dois aparelhos convergem sem crédito excedente; um backup antigo preserva seus saldos.

**Verificação:** testes de cálculo, ponta a ponta para metas e investimentos e ensaios de repetição, concorrência simulada, restauração e reversão. Pontos principais em `js/financas.js`, `js/financas-invest.js` e persistência de Finanças.

**Registro de execução:** destinações são internas e calculadas por mês consolidado. O registro por identificador mantém saldo de metas e caixa sem reaplicar créditos na mescla. Tentativas acima da sobra ficam sinalizadas. Uma reversão libera somente a destinação revertida e mantém o histórico, desde que haja caixa suficiente quando o valor já foi usado para aportar. Foram validados reenvio, filtros, parcelas de destinação, reversão, mescla simulada, falha de armazenamento, backup anterior e arquivamento.


## A2 — Privacidade em formulários financeiros

- [x] Inventariar campos preenchidos, resumos, prévias e detalhes com valores. Priorizar Fechamento, contas e cartões, orçamento, parcelas, investimentos e importação.
- [x] Reaproveitar uma regra comum de mascaramento. Com o olho ativado, revelar somente o campo que a pessoa optar por editar e mascará-lo novamente ao sair dele. Respeitar foco, navegação por teclado e contraste.
- [x] Aplicar a mesma regra quando o olho for acionado com detalhes abertos e depois de fechar, reabrir ou navegar para outra aba.

**Aceite:** nenhum campo monetário inventariado exibe seu valor quando está desfocado sob o modo privacidade. Editar e salvar funciona com o valor intacto. O formulário entregue em A1 passa pelo mesmo teste.

**Verificação:** cenários de interface em temas claro e escuro e em desktop e celular, incluindo Fechamento aberto e campos de edição de cartão e parcela.

**Registro de execução:** foram protegidos saldos editáveis, limites de cartão, fechamento, recorrências, parcelas, orçamentos, cotações e formulários de investimentos e importação. A proteção visual usa um marcador compartilhado para campos financeiros e preserva o valor original. As capturas finais de fechamento em 375 e 1.440 px e de cartão em 375 px confirmam o mascaramento em campos abertos. A revelação por foco e a alternância do olho foram testadas em Chromium. A validação final de A0 a A2 passou em 25 testes unitários e 283 cenários de navegador, com a versão da PWA sincronizada em `20261125j`.


## A3 — Menu e avisos no celular com texto ampliado

- [ ] Ajustar a barra global para que seus rótulos permaneçam legíveis em telas estreitas. Usar a gaveta **Mais** para acomodar ações quando o espaço exigir.
- [ ] Separar avisos breves de confirmação do **Resumo do dia**. Exibir o resumo longo no fluxo da tela ou em formato compacto e dispensável, com acesso ao conteúdo completo em Hoje ou Lembretes.
- [ ] Manter área de toque, foco visível, ordem de teclado e espaço inferior para a navegação fixa e a captura rápida.

**Aceite:** em 320 px a 200% os rótulos mantêm palavras legíveis e o resumo não encobre busca, título ou controles da Agenda. Todos os atalhos continuam acessíveis também em 375 e 430 px.

**Verificação:** analisar captura e testar ação por teclado e toque simulado. Se houver aparelho disponível, repetir a navegação ampliada nele.

## A4 — Contraste, títulos e rótulos de campos

- [ ] Corrigir “Agora” em Hoje e Agenda e os títulos secundários de Hoje e Tarefas usando tokens semânticos.
- [ ] Medir o texto pequeno nos fundos reais de Céu e Safira, em claro e escuro. Usar 4,5:1 como referência para os casos apontados na auditoria.
- [ ] Inserir um título de grupo na Agenda semanal e conferir a sequência equivalente em Tarefas. Adicionar rótulos persistentes nos campos de captura frequentes que dependem de placeholder.

**Aceite:** os elementos que mediam 3,1:1 e 4,0:1 atingem 4,5:1 nos cenários auditados. Datas e campos mantêm nome compreensível durante a digitação e a navegação por teclado. A Agenda semanal tem sequência de títulos coerente.

**Verificação:** detector de contraste no navegador, inspeção da árvore de acessibilidade e teste de foco nos fluxos alterados.

## A5 — Rascunhos e recuperação ao navegar

- [ ] Começar pela captura de tarefa. Guardar os campos alterados antes de trocar de aba ou receber uma atualização, com separação por conta e formulário.
- [ ] Restaurar o rascunho ao retornar e oferecer descarte explícito. Limpar ao salvar com sucesso e tratar a troca de conta sem recuperar dados de outra pessoa.
- [ ] Manter rascunhos no aparelho e aproveitar o comportamento validado ao ajustar Notas em A8. Verificar que atualização remota de outros itens não sobrescreve o rascunho.

**Aceite:** digitar uma tarefa, abrir Agenda e voltar mantém os campos. O rascunho não reaparece após descarte nem após envio bem-sucedido. A troca de conta não revela o rascunho anterior.

**Verificação:** ponta a ponta de navegação, descarte, salvamento, atualização remota simulada e alternância de conta.

## A6 — Conteúdo principal mais cedo nas telas de uso diário

- [ ] Em **Hoje**, mostrar o próximo compromisso e as tarefas prioritárias cedo. Manter alertas urgentes acessíveis e mover listas completas de apoio para depois do conteúdo do dia.
- [ ] Em **Tarefas**, dar prioridade à lista e à captura curta. Deixar prioridade, duração, etiquetas, projeto e repetição em opções avançadas.
- [ ] Na **Agenda semanal**, enquadrar o dia atual ao abrir a semana corrente e o dia consultado ao voltar de outro modo. Manter rolagem e foco após ações no mesmo período.
- [ ] Em **Lançamentos** no celular, resumir filtros secundários sem esconder o escopo ativo. Manter busca, criação e acesso ao detalhe perto do extrato.

**Aceite:** em 375 px com dados fictícios, a primeira tarefa ou o primeiro lançamento aparece sem atravessar um formulário completo. Em Hoje, tarefa prioritária e próximo compromisso estão acessíveis perto do cabeçalho. A agenda semanal enquadra a data esperada e respeita rolagem manual.

**Verificação:** comparação antes/depois em 375 e 1.440 px, teste de data atual no meio da semana, troca de período e os cenários existentes de filtros, parcelamento e edição.

## A7 — Grade financeira com poucos cartões

- [ ] Usar a largura já disponível no desktop para aproximar **Cartões e faturas** de **Próximos vencimentos** quando houver espaço e poucos cartões.
- [ ] Definir distribuição para zero, um e vários cartões. Preservar leitura em uma coluna no celular e ações de pagar, editar e conferir junto do registro.

**Aceite:** no desktop, um cartão não deixa uma área desproporcional ao lado enquanto os vencimentos ficam escondidos abaixo. Com vários cartões ou uma tela estreita, nenhum conteúdo transborda e a ordem de leitura é consistente.

**Verificação:** capturas com zero, um e vários cartões em 375, 1.024 e 1.440 px. Repetir os testes de grade e pagamento de fatura.

## A8 — Leitura de Notas e ações de Backup

- [ ] Em **Notas**, dar prioridade ao título e ao texto em leitura. Mostrar ferramentas de formatação, cor, etiquetas e arquivo ao editar ou nas ações do item. Preservar fixação, busca, listas de compras e modelos.
- [ ] Em **Backup**, ordenar as ações em **Fazer cópia**, **Conferir** e **Recuperar ou restaurar**. Explicar o efeito de mesclar e restaurar antes da confirmação e reservar termos como IndexedDB para os detalhes técnicos.
- [ ] Preservar download, dados seletivos, versões automáticas e recuperação após falha. Reaproveitar os rascunhos de A5 quando houver edição aberta em Notas.

**Aceite:** é possível ler uma nota e distinguir criar cópia, verificar arquivo, mesclar dados e restaurar sem precisar entender o armazenamento interno. Restauração e mescla preservam as proteções existentes.

**Verificação:** fluxos de nota com texto longo, lista de compras, restaurar backup anterior, importar mesclando e falha de armazenamento simulada.

## A9 — Carregamento e renderização da PWA

- [ ] Medir transferência, cache frio e quente e renderização do extrato com os mesmos cenários da auditoria. Os três banners somavam cerca de 3 MB em disco. No ensaio inicial, Lançamentos teve medianas de 39 ms com 100 registros adicionais e 77 ms com 5.000.
- [ ] Otimizar os banners para as larguras reais, preservando enquadramento e legibilidade. Medir se há ganho ao reduzir o precache inicial. Se as outras imagens forem carregadas depois, conservar uma apresentação coerente nas trocas de turno sem rede.
- [ ] Perfilar o extrato com histórico longo e atacar o gargalo medido. Avaliar o carregamento de scripts sob demanda somente depois de medir o ganho e os efeitos sobre navegação, atalhos e abertura offline.

**Aceite:** a comparação mostra quanto foi reduzido em bytes e tempo sob as mesmas condições, com ganho verificável na carga inicial ou na renderização do extrato. Instalação, atualização da versão anterior e reabertura offline permanecem funcionais.

**Verificação:** medições antes/depois, teste de instalação a frio, atualização com cache anterior, reabertura offline e capturas de manhã, tarde e noite.

## A10 — Integração, revisão visual e documentação

- [ ] Atualizar `PRODUCT.md`, `DESIGN.md` e `README.md` segundo as decisões implementadas. Normalizar a plataforma como `web` e decidir se o uso de Instrument Serif nas citações é uma exceção editorial a documentar.
- [ ] Rever as telas em 320, 375, 430, 768, 1.024 e 1.440 px. Incluir texto a 200%, temas claro e escuro, Céu e Safira, teclado, conjunto vazio, dados preenchidos e recuperação após erro.
- [ ] Repetir a auditoria Impeccable e Craft com os mesmos percursos. Testar aparelho físico, leitor de tela e Firebase real se estiverem disponíveis e registrar a cobertura efetiva.
- [ ] Rodar `node --test tests/unit.test.js`, `node tests/run.js`, `node scripts/bump-version.js --check` e `git diff --check`. Atualizar a versão da PWA quando CSS ou JavaScript mudarem.

**Aceite:** os problemas prioritários da auditoria têm regressões cobertas, a documentação descreve o comportamento real, e a revisão final indica a evidência de cada pacote e as verificações que ficaram pendentes.

## Pontos de controle

1. **Confiança financeira · A1 e A2.** Reproduzir os dois problemas originais em dados fictícios e confirmar que foram corrigidos, incluindo recuperação e sincronização.
2. **Uso diário no celular · A3 a A6.** Conferir a primeira tela útil, o modo ampliado, a data na Agenda e a preservação do rascunho, sem regressão no desktop.
3. **Fechamento da rodada · A7 a A10.** Comparar as telas e as medições com a linha de base, verificar a PWA e consolidar os resultados por pacote.
