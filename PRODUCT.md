# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (PWA instalável no celular e no computador)

## Users

- **Principal:** a dona (Vitória), nos próprios aparelhos (computador e celular), com login do Google.
- **Também:** família e amigos próximos, cada um com o próprio hub, separado dos outros. Não é um produto público: não tem suporte, cadastro divulgado nem cobrança.
- **Tarefas, por ordem de uso (confirmado):**
  1. **Planejar o dia:** abrir de manhã para ver as tarefas, a agenda, os hábitos e o foco do dia.
  2. **Controlar as finanças:** lançar gastos e receitas e ver o mês, as contas, os vencimentos e os orçamentos.
  3. **Companhia de fundo:** deixar aberto com o player do Spotify e o clima enquanto trabalha ou estuda.
- Notas, diário, humor e leituras existem e são usados, mas vêm depois dessas três tarefas.

## Product Purpose

Um hub pessoal que junta o planejamento do dia, as finanças e as anotações num lugar só, disponível em qualquer aparelho. O sucesso é abrir todo dia porque é útil *e* agradável. Também significa que o que é feito num aparelho aparece nos outros, ninguém vê os dados de outra pessoa e nada se perde.

## Positioning

É tudo o que a dona quer ter, num lugar só e feito sob medida, e o conjunto tem quatro qualidades:
- **As partes conversam:** os vencimentos aparecem em Hoje, os gastos ficam ao lado do plano do dia e a busca cobre tudo.
- **É dela:** sem assinatura, sem anúncio, sem rastreamento, em português e no padrão brasileiro (dd/mm/aaaa, R$).
- **É privado:** cada conta só lê e grava os próprios dados.
- **É calmo e bonito:** um lugar que dá vontade de abrir, não uma ferramenta fria.

Apps separados (Notion, Todoist, uma planilha de gastos) não conseguem oferecer as quatro coisas ao mesmo tempo.

## Operating Context

- É aberto logo de manhã para planejar o dia e revisitado ao longo do dia para capturas rápidas (tarefas, gastos).
- Muitas vezes fica aberto numa aba do computador como companhia de fundo (Spotify, clima).
- É usado no computador e no celular; 375 px de largura é um tamanho suportado.
- Às vezes é aberto sem internet. Nesse caso, o Service Worker entrega a casca em cache, o hub abre com os dados locais e reconecta automaticamente quando a conexão volta.

## Capabilities and Constraints

- **Áreas:** Início (resumo, linha do tempo, modo Companhia e cards), Hoje, Rotina, Lembretes, Agenda, Tarefas, Metas, Hábitos, Notas, Diário, Links, Etiquetas, Finanças, Aparência, Backup, Lixeira, Leituras e Personalizar menu.
  - As Finanças têm visão geral, análises, lançamentos, orçamentos e metas, contas e recorrentes, regras e importação.
  - Também existem busca global, paleta de comandos (Ctrl+K), desfazer/refazer e captura rápida.
- **Cards do Início:** 5 cards ativos por padrão (`linha`, `todo`, `agenda`, `habs`, `fin`), botão **Companhia** para alternar Spotify + Clima com um clique, e mais 8 cards opcionais (Frase do dia, Produtividade, Links rápidos, Notas recentes, Revisão semanal, Histórico, Humor e Metas).
- **Contas e sincronização:**
  - O hub só abre depois do login com o Google (Firebase Auth).
  - Os dados sincronizam pelo Firestore em `data/users/<uid>/`, com mescla item a item entre aparelhos.
  - As contas ficam separadas mesmo num navegador compartilhado.
- **Integrações:** o player oficial do Spotify (carregado só ao clicar) e o clima do Open-Meteo (sem chave; só as coordenadas saem do aparelho).
- **Técnico:**
  - HTML/CSS/JS puro em scripts comuns, sem build, publicado no GitHub Pages.
  - O login é só por pop-up, porque o redirecionamento não funciona no github.io.
  - Detalhes e regras estão no [SPEC.md](SPEC.md).
- **Textos sobre onde os dados ficam:** o tour e os Primeiros passos dizem "salvo na sua conta", porque aparecem depois do login. Avisos que só aparecem sem sincronização (lembrete de backup, modo sem internet, versões automáticas) dizem "neste aparelho/navegador", e isso é correto nesses casos.

## Brand Commitments

- **Nome:** "Meu Hub", escrito em minúsculas no logo ("meu hub").
- **Voz (confirmado):** próxima e leve.
  - Trata a pessoa por "você", com frases curtas e gentis.
  - Dá sugestões suaves, como "Bom dia! Comece pela rotina da manhã".
  - Sem exagero e sem culpa.
- **Idioma:** português do Brasil em tudo, com datas, números e moeda no padrão brasileiro.
- **Visual atual:** logo com um ponto colorido, painéis arredondados, tema claro e escuro e 5 paletas que a pessoa escolhe (`Céu`, `Ametista`, `Safira`, `Floresta`, `Cítrico`), documentado no [DESIGN.md](DESIGN.md).

## Evidence on Hand

- O próprio app tem dados de exemplo removíveis ("Carregar exemplo" / "Remover exemplos"), para demonstração e primeiro uso.
- Não existem depoimentos, métricas, imprensa nem usuários públicos. Nunca inventar nada disso.

## Product Principles

1. **Um lugar só, conectado.** Uma funcionalidade nova deve se ligar ao que já existe (Hoje, busca, cards do Início), em vez de virar uma ilha.
2. **Calmo por padrão.** O hub é aberto todo dia e fica em segundo plano, então nunca deve insistir, piscar ou disputar atenção. Sugestões são gentis e podem ser dispensadas.
3. **Privado e de quem usa.** Sem rastreamento nem analytics. Os dados de cada pessoa são dela e ficam separados, inclusive no mesmo aparelho.
4. **Nunca perder dados.** Mesclar em vez de sobrescrever, guardar cópias e confirmar antes de ações destrutivas.
5. **Brasileiro e pessoal.** Texto em português, formatos brasileiros e funcionalidades moldadas pela rotina real da dona, mais do que por boas práticas genéricas.

## Accessibility & Inclusion

- **O que já existe (em Aparência):** dá para desligar os atalhos de uma tecla, e há opções de alto contraste e de menos movimento (segue o sistema ou pode ser forçado).
- **O que precisa continuar valendo:** uso por teclado com foco visível, layout funcionando em 375 px e nos temas claro e escuro.
- **Padrão de referência:** nenhum foi definido formalmente. Usar o WCAG 2.2 AA como piso de trabalho (isso foi inferido, não confirmado).
