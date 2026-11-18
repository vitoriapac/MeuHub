# Inventário da grade de 8 pontos

Linha de base: os estilos usavam sobretudo espaçamentos de 6, 10, 12, 14 e 18 px no CSS e nos estilos inline. A migração normaliza valores literais de margem, preenchimento e espaçamento para passos de 4 px, com 8 px como unidade principal. As variáveis `--space-1` a `--space-8` cobrem 4 a 32 px; tamanhos de fonte são uma escala separada.

| Componentes e telas | Onde verificar | Regras e exceções |
|---|---|---|
| Casca, busca, navegação lateral e mobile, painel Mais | `index.html`, `js/recursos.js`, `css/style.css` | Respeitar área segura, tamanho do texto e espaço abaixo da barra fixa; nomes usam quebra de até três linhas e preservam o nome acessível; nomes personalizados maiores podem ser limitados visualmente. |
| Botões, campos, rótulos, cartões, listas, chips, diálogo, avisos e estados vazios | `css/style.css`, todas as telas em `js/` | Tokens comuns; campos de texto mantêm tamanho legível, campos de data recebem largura adaptável no celular e botões `.pill` têm altura mínima de 44 px. Variantes compactas usam passos intermediários; ações de links e da agenda semanal têm alvos de pelo menos 44 px; na agenda diária, uma lista recolhível oferece ações com alvos de pelo menos 44 px independentemente da altura dos eventos. |
| Início, widgets, Spotify, clima e revisões | `js/inicio.js`, `js/core.js`, `css/style.css` | Anéis, indicadores e linhas de gráficos conservam dimensões e coordenadas próprias. |
| Hoje, rotina, lembretes, tarefas e metas | `js/core.js`, `js/recursos.js`, `js/main.js`, `css/style.css` | Preservar campos e estados de execução; listas e formulários precisam quebrar em telas estreitas e com fonte ampliada. |
| Agenda, calendário e blocos de tempo | `js/core.js`, `js/recursos.js`, `css/style.css` | Na visão semanal, dias, datas e eventos usam `--type-small` e acompanham a ampliação de texto. Na visão diária, horários, posicionamentos absolutos, sobreposição, linhas e dimensões calculadas são medidas funcionais; não arredondar coordenadas automaticamente. |
| Hábitos, diário, humor e leituras | `js/core.js`, `js/recursos.js`, `css/style.css` | Grades de hábitos e estante podem rolar dentro do próprio contêiner; preservar títulos, capas e controles. |
| Finanças, tabelas, valores, filtros e gráficos | `js/financas.js`, `js/recursos.js`, `css/style.css` | A escala de dados e as coordenadas SVG não são espaçamento de interface; manter aviso de projeção, separação entre valores e legendas legíveis. |
| Notas, listas de compras, links, etiquetas e captura rápida | `js/core.js`, `js/recursos.js`, `js/inicio.js`, `css/style.css` | Preservar conteúdo editável, rascunhos e controles. Valores de cores, bordas e raios mantêm a identidade do projeto. |
| Aparência, backup, lixeira, instalação, login e paleta de comandos | `js/core.js`, `js/recursos.js`, `js/sync.js`, `index.html`, `css/style.css` | Conferir temas, densidades, foco, mensagens e recuperação sem alterar a persistência ou privacidade. |

**Exceções:** bordas e contornos finos; raios e formatos que compõem a identidade visual; posições e duração dos eventos na agenda diária; medidas de SVG e gráficos; valores `auto`, `%`, `calc()`, `env()` e posicionamentos dinâmicos. Alguns rótulos gráficos e da barra móvel usam tamanhos menores que o texto corrente para caber no componente; devem continuar com nome acessível e ser revisados visualmente ao ampliar a fonte.

**Verificação:** suíte `node tests/run.js`; amostras em 320/375/430/1280 px, claro e escuro, densidade compacta, fonte ampliada e nomes longos. A emulação não substitui teste de toque, teclado virtual e área segura em telefone físico.

**Prioridades da auditoria:** 1. navegação, formulários, leitura e alvos de toque; 2. listas, cartões e estados de conteúdo longo; 3. componentes de geometria própria, incluindo gráficos, calendário diário e lombadas. A verificação automática de largura não comprova, por si só, ausência de corte dentro de cada componente.
