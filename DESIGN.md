---
name: Meu Hub
description: Hub pessoal para planejar o dia, cuidar das finanças e anotar, calmo e em português.
colors:
  lilac-signature: "#8350C4"
  lilac-mist: "#cdb4ec"
  morning-sky: "#eef4f8"
  sky-panel: "#dbe9f1"
  paper: "#fbfdfe"
  ink: "#161616"
  warm-mute: "#655f50"
  sand-line: "#d9d2bf"
  slate-blue-tint: "#a9c3dc"
  pale-sky-tint: "#c9e0eb"
  lavender-tint: "#b7aad8"
  coral-negative: "#d0364f"
  night-plum: "#1f1b24"
  night-panel: "#2c2433"
  night-card: "#272030"
  moon-ink: "#f4efe2"
  night-mute: "#a39d8c"
  night-line: "#3a372e"
typography:
  display:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "clamp(26px, 4vw, 36px)"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-1.2px"
  headline:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 500
    letterSpacing: "-1px"
  title:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 500
  body:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"tnum\""
  label:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.08em"
  caption:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
rounded:
  sm: "6px"
  field: "12px"
  item: "14px"
  kpi: "18px"
  tile: "20px"
  panel: "22px"
  frame: "26px"
  full: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "12px"
  lg: "16px"
  xl: "18px"
components:
  button-primary:
    backgroundColor: "{colors.lilac-signature}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    padding: "7px 14px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "7px 14px"
    typography: "{typography.body}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
    typography: "{typography.body}"
  search-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "11px 18px"
  chip:
    backgroundColor: "{colors.lilac-mist}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "1px 9px"
    typography: "{typography.caption}"
  panel:
    backgroundColor: "{colors.sky-panel}"
    rounded: "{rounded.panel}"
    padding: "16px"
  list-item:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.item}"
    padding: "10px 12px"
  nav-item-active:
    backgroundColor: "{colors.lilac-signature}"
    textColor: "{colors.paper}"
    rounded: "{rounded.field}"
    padding: "7px 12px"
---

# Design System: Meu Hub

## Overview

**Creative North Star: "A Escrivaninha Serena"**

O Meu Hub é uma mesa organizada à luz da manhã. As coisas ficam em papéis claros, em tons pastel, cada uma na sua pilha, e tudo está à mão sem que nada grite. A pessoa abre o hub todo dia e o deixa aberto ao lado do trabalho, então o visual tem que descansar o olho: superfícies em camadas suaves, cantos bem arredondados e uma única cor de assinatura, o lilás, que marca só o que é para fazer agora.

A densidade é de ferramenta de uso diário: há bastante informação (tarefas, agenda, dinheiro), mas ela é organizada em painéis claros, com respiro entre eles. A hierarquia vem da tonalidade e do tamanho, nunca de sombras ou bordas pesadas. O tema escuro é uma noite de ameixa (`#1f1b24`), não um preto puro, e o lilás clareia para continuar legível.

A identidade é **escolhida por quem usa**. Há cinco paletas (Céu e lilás, a padrão, e Ametista, Safira, Floresta e Cítrico), dois estilos de menu (suave e forte), duas densidades e um acento opcional. Por isso, todo componente desenha com as variáveis CSS, nunca com cores fixas. O Meu Hub nunca deve parecer **painel corporativo** (cinza, frio, tabelas brigando), **app infantil** (cores saturadas, ilustrações bobas, excesso de emoji) nem **neon/gamer** (preto com brilho, gradientes fortes, efeitos).

**Key Characteristics:**
- Camadas tonais: fundo → painel → papel, sem sombras nas superfícies.
- Uma cor de assinatura (lilás) só para a ação principal, o item ativo e a seleção.
- Cantos generosos: pílulas nos botões, 22 px nos painéis.
- Outfit em três pesos, com números tabulares em todo lugar.
- Rótulos pequenos em maiúsculas como títulos de painel.
- Paletas trocáveis: todo componente funciona nas 5 paletas × claro/escuro.

## Colors

Tons de céu claro e papel, com tintas pastel por categoria e um lilás de assinatura; o tema escuro vira uma noite de ameixa com tinta cor de lua. Os valores abaixo são da paleta padrão, **Céu e lilás**. As outras paletas trocam os mesmos papéis (variáveis `--bg`, `--panel`, `--card`, `--side`, `--pink`, `--blue`, `--yellow`, `--green`, `--acc`).

### Primary
- **Lilás de Assinatura** (lilac-signature): o acento da paleta (`--acc` / `--nacc` / `--s1`). Botão principal, item ativo do menu, aba selecionada, anel de progresso e linha dos gráficos. O texto sobre ele é branco, ou escuro quando o acento for claro: o `applyTheme()` escolhe pela luminância.
- **Névoa Lilás** (lilac-mist): a tinta "rosa" da paleta (`--pink`). Chips da categoria p e, no **tema escuro**, assume o papel de acento (`--nacc`), porque o lilás forte some sobre a ameixa.

### Secondary
- **Tintas de categoria** (slate-blue-tint, pale-sky-tint, lavender-tint): as tintas `--blue`, `--yellow` e `--green`, usadas nos chips e marcadores `c-b`, `c-y` e `c-g` (eventos, tipos de tarefa, categorias de gasto). Os nomes das variáveis são históricos: na paleta Céu, o "yellow" é um céu claro e o "green" é lavanda. O papel vale mais que o nome.

### Tertiary
- **Coral de Alerta** (coral-negative): o `--neg`, para valores negativos, atrasos e exclusões. No tema escuro, atrasos e negativos usam `#ff8a80`. É a única cor quente forte do sistema e aparece só quando algo pede atenção.

### Neutral
- **Céu da Manhã** (morning-sky): o fundo da página (`--bg`).
- **Painel de Céu** (sky-panel): o fundo dos painéis (`--panel`), um passo mais escuro que o fundo.
- **Papel** (paper): itens de lista, campos e cards dentro dos painéis (`--card`), a camada mais clara.
- **Tinta** (ink): o texto principal, o contorno dos botões secundários e o anel de foco (`--ink`).
- **Cinza Quente** (warm-mute): texto secundário e títulos de painel (`--mute`). É marrom-acinzentado, não cinza frio.
- **Linha de Areia** (sand-line): bordas de campo e divisórias (`--line`).
- **Noite** (night-plum, night-panel, night-card, moon-ink, night-mute, night-line): os mesmos papéis no tema escuro. Cada paleta tem a sua tríade escura (`d: [bg, panel, card]`).

### Named Rules
**The One Lilac Rule.** O acento cheio aparece só em três coisas: a ação principal da tela, o item ativo (menu, aba, filtro) e o progresso. Se dois botões cheios competem na mesma área, um deles vira secundário.

**The Palette Contract.** Nenhum componente usa hex fixo para superfície, texto ou acento. Tudo passa pelas variáveis, para funcionar nas 5 paletas, no claro e no escuro, no menu suave ou forte e no alto contraste. As exceções são o coral (`--neg`) e o texto dos chips (`#161616`, porque as tintas são sempre claras).

## Typography

**Display Font:** Outfit (com system-ui, sans-serif)
**Body Font:** Outfit
**Label Font:** Outfit, em maiúsculas e espaçada

**Character:** uma única família geométrica e arredondada, que conversa com os cantos do sistema. A hierarquia vem do peso (400/500/600) e do tamanho, não de uma segunda fonte. Os números são sempre tabulares (`font-variant-numeric: tabular-nums` no `body`), porque valores e horários precisam alinhar.

### Hierarchy
- **Display** (600, clamp 26–36px, tracking −1.2px): o título de cada tela e a saudação do Início ("Bom dia! Hoje é…").
- **Headline** (500, 30px, tracking −1px; 22px em telas estreitas): números de destaque, como os totais das Finanças e as estatísticas da revisão.
- **Title** (500, 18px): títulos de bloco que não são painel (o h2 base).
- **Body** (400, 15px, altura 1.45): todo o texto corrido, itens de lista e campos.
- **Label** (600, 12px, 0.08em, MAIÚSCULAS, Cinza Quente): o título de cada painel ("DADOS DE EXEMPLO", "DESPESAS POR CATEGORIA"). Variantes de 11px para rótulos de KPI e grupos do menu.
- **Caption** (400, 13px; 12px nos chips): datas, metadados e textos de apoio.

### Named Rules
**The One Family Rule.** Só Outfit. A ênfase vem do peso 600 ou do tamanho, nunca de itálico decorativo, de uma segunda fonte ou de cor no texto corrido.

## Layout

- **Estrutura:** grade de duas colunas, com o menu lateral de 210px e o conteúdo, 18px de espaço e de margem, centralizada até 1280px. O menu lateral é uma "folha" fixa com cantos de 26px e a altura da tela.
- **Ritmo:** 18px entre os blocos grandes, 16px dentro dos painéis, 8–10px entre itens de lista e 6px entre o rótulo e o conteúdo.
- **Densidade:** dois modos, confortável (o padrão) e compacto (os botões passam a 5px 11px).
- **Celular (até 860px):** o menu lateral vira uma **barra de abas fixa embaixo** (Início, Hoje, Agenda, Tarefas, Notas e Mais), e os mosaicos de cards caem para duas colunas. Até 520px, os grupos viram uma coluna. Os pontos de quebra observados são 520, 860/861, 1100 e 1179px.
- **Painéis do Início:** mosaico de cards configurável. Alguns cards são largos (Seu dia, Produtividade, Agenda, Notas, Revisão, Histórico, Finanças).

## Elevation & Depth

O sistema é **plano por camadas tonais**. A profundidade vem da sequência fundo → painel → papel: cada camada é um tom mais claro (no escuro, um tom mais claro de ameixa). Superfícies em repouso não têm sombra. Sombras existem só em coisas que **flutuam sobre a mesa**: o tour, a paleta de comandos, os menus e os avisos.

### Shadow Vocabulary
- **Flutuante alto** (`box-shadow: 0 20px 60px rgba(0,0,0,.35)`): diálogos sobrepostos (o tour e a paleta de comandos).
- **Flutuante médio** (`box-shadow: 0 10px 28px rgba(0,0,0,.18)`): menus suspensos e popovers.
- **Flutuante baixo** (`box-shadow: 0 6px 18px rgba(0,0,0,.12)`): elementos pequenos que se destacam ao interagir.
- **Anel de destaque** (`box-shadow: inset 0 0 0 1.5px` lilás a 38%): o painel que pede atenção (resumo, item em foco). É um contorno interno, não uma sombra.

### Named Rules
**The Flat Desk Rule.** O que está na mesa é plano; só o que está por cima dela tem sombra. Card, painel ou item de lista com `box-shadow` em repouso está errado.

## Shapes

A linguagem é de **cantos generosos e pílulas**. Quanto maior a superfície, maior o raio: campos têm 12px, itens 14px, cards de KPI 18px, ícones de estado vazio 20px, painéis 22px, e o menu lateral e o painel de saudação 26px. Botões, chips e a busca são pílulas completas (999px), e botões só de ícone são círculos. As bordas são finas (1px) e só aparecem em campos (Linha de Areia) e em botões secundários (Tinta). Painéis e itens não têm borda.

## Components

### Buttons
- **Character:** pílulas macias. A principal é cheia de lilás; as outras são só contorno.
- **Shape:** pílula completa (999px), padding de 7px 14px (5px 11px no modo compacto).
- **Primary:** fundo Lilás de Assinatura e texto branco, com a borda na mesma cor. No escuro, o fundo é a Tinta cor de lua e o texto, ameixa. Usado em "Lançar", "Começar" e "Criar".
- **Secondary:** fundo Papel, texto Tinta e contorno de 1px em Tinta.
- **Selecionado** (abas e filtros): igual ao primário (`.on`).
- **Icon button:** círculo com contorno (desfazer, refazer, ocultar valores); a captura rápida "+" é um círculo cheio de lilás.
- **States:** transição de cor de 0,15s; ao pressionar, encolhe para 0,97; foco com contorno de 2px em Tinta, afastado 2px; desabilitado com opacidade de 0,4.

### Chips
- **Style:** pílula com uma tinta de categoria por fundo, texto sempre `#161616`, 12px, padding de 1px 9px.
- **Use:** tipo de item ("Tarefa", "Hábitos"), categorias e etiquetas. Os chips classificam, não são clicáveis por padrão.

### Cards / Containers
- **Painel:** fundo Painel de Céu, cantos de 22px, padding de 16px, sem borda e sem sombra. O título é um rótulo pequeno em maiúsculas.
- **Item de lista:** fundo Papel dentro do painel, cantos de 14px, padding de 10px 12px, 8px entre itens.
- **Painel de saudação** (Início): cantos de 26px, gradiente diagonal suave do Painel para o Painel com 16% do acento. É o único gradiente de superfície, junto com a frase do dia.

### Inputs / Fields
- **Style:** fundo Papel, borda de 1px em Linha de Areia, cantos de 12px, padding de 9px 12px, texto de 15px.
- **Busca global:** pílula larga no topo, padding de 11px 18px.
- **Focus:** contorno de 2px em Tinta, afastado 2px (o mesmo de todos os controles).
- **Datas:** sempre no formato dd/mm/aaaa, com seletor de calendário.

### Navigation
- **Desktop:** menu lateral com grupos (Planejar, Registrar, Dinheiro, Sistema) em rótulos de 11px maiúsculos, que podem ser recolhidos. Cada item tem ícone e nome, 15px.
- **Item ativo:** fundo Lilás de Assinatura e texto branco, cantos de 12px.
- **Estilos:** "suave" (o padrão, com o menu levemente tingido pelo acento) ou "forte" (o menu inteiro na cor do acento).
- **Celular:** barra de abas embaixo; a aba ativa ganha o fundo de acento (Lilás de Assinatura no claro, Névoa Lilás no escuro).

### KPI tile (signature)
Os cards do topo do Início: fundo Papel, cantos de 18px, padding de 14px, um anel de progresso no acento com ícone no centro, rótulo pequeno em maiúsculas, número em destaque (22px) e uma linha de tendência de uma semana. Mostram "como está o meu dia" num relance.

### Empty state (signature)
Ícone num quadrado de 64px com cantos de 20px, sobre uma pequena cena geométrica (círculos e uma onda) tingida pelo acento. Embaixo vêm uma frase em negrito, uma dica gentil e, quando faz sentido, um botão. O tom segue a voz do produto: "Tudo em dia!", "Seu dia está livre."

## Do's and Don'ts

### Do:
- **Do** desenhar todas as cores com as variáveis (`--bg`, `--panel`, `--card`, `--ink`, `--mute`, `--line`, `--acc`/`--s1` e as tintas) e conferir na paleta padrão e em pelo menos uma outra, no claro e no escuro.
- **Do** manter a escada tonal fundo → painel → papel para dar profundidade.
- **Do** usar pílulas (999px) em botões e chips e 22px nos painéis.
- **Do** reservar o lilás cheio para uma ação principal por área, o item ativo e o progresso (The One Lilac Rule).
- **Do** usar o contorno de 2px em Tinta, afastado 2px, como foco de todo controle novo.
- **Do** respeitar "menos movimento" e o alto contraste (`data-hc`) que já existem em Aparência.
- **Do** manter números tabulares e os formatos brasileiros (R$ 1.234,56 e dd/mm/aaaa).

### Don't:
- **Don't** pôr sombra em painéis, cards ou itens em repouso (The Flat Desk Rule).
- **Don't** escrever hex fixo para superfície ou texto: isso quebra as outras paletas e o tema escuro.
- **Don't** parecer painel corporativo: nada de cinza frio, tabelas densas sem respiro ou números brigando por atenção.
- **Don't** parecer app infantil: nada de cores saturadas fora do acento, ilustrações bobas ou emoji no lugar de ícones.
- **Don't** parecer neon/gamer: nada de preto puro com brilho, gradientes fortes ou efeitos de luz.
- **Don't** trazer uma segunda família de fonte ou itálico decorativo.
- **Don't** colocar bordas grossas ou faixas coloridas laterais em cards e alertas.
