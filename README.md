# Meu Hub

Site publicado: **https://vitoriapac.github.io/MeuHub/** (GitHub Pages, branch `main`, pasta raiz).

Um painel pessoal brasileiro que reúne **planejamento do dia**, **controle financeiro completo**, **hábitos e rotinas**, **anotações/diário/leituras** e **companhia de fundo** (Spotify e clima) em um só lugar — funcionando no navegador ou instalado como aplicativo (**PWA**) no celular e no computador.

---

## Documentação do Projeto

| Documento | Conteúdo |
|---|---|
| **[README.md](README.md)** | Visão geral, funcionalidades, atalhos, configuração do Firebase, execução local e testes. |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Arquitetura detalhada: carga dos módulos, estado `S`, `localStorage`, mescla de 3 vias (`merge3`), PWA/Service Worker e motor de testes CDP. |
| **[SPEC.md](SPEC.md)** | Especificação técnica, regras de código, limites operacionais, decisões arquiteturais e os cenários de teste. |
| **[PRODUCT.md](PRODUCT.md)** | Visão de produto, usos principais, posicionamento, voz da marca e princípios. |
| **[DESIGN.md](DESIGN.md)** | Sistema de design ("Caderno Solar"), tipografia (`Outfit`), paletas de cores, tokens semânticos e padrões de interface. |

---

## Principais Funcionalidades

### 1. Planejamento e Produtividade
- **Início personalizável:** card opcional para lista de compras fixada, resumo do dia com anel de progresso, gráficos sparkline de 7 dias, linha do tempo interativa (6h–22h), botão **Companhia** (liga/desliga Spotify + Clima com um clique) e 15 cards reordenáveis.
- **Hoje e Carga do Dia:** caixa de entrada, revisão semanal com pendências, prioridades, alertas e cálculo de capacidade. As sugestões consideram a capacidade e um horário livre; podem ser dispensadas até o próximo carregamento. A captura mantém seus campos ao alternar tipos. Planejar uma tarefa não altera seu prazo; a ação **Adiar para amanhã** altera o prazo para o dia seguinte e retira a tarefa de Hoje.
- **Rotina (Manhã e Noite):** passo a passo guiado configurável com registro de dias seguidos.
- **Tarefas, Agenda e Metas:** prioridades, subtarefas, recorrência, captura para caixa de entrada ou tarefa com data planejada independente do prazo, encaixe individual em Hoje e metas com acompanhamento. Na agenda diária, **Ações dos compromissos do dia** reúne edição, exclusão e ações das tarefas em botões maiores, inclusive para eventos curtos ou simultâneos.
- **Hábitos e Pomodoro:** hábitos diários ou de 1 a 7 vezes por semana, grade de registros e timer Pomodoro (25 min foco / 5 min pausa). Ao mudar a frequência, os registros são preservados e a sequência passa a usar a meta atual.

### 2. Finanças Pessoais (6 abas + Relatório Anual)
- **Visão Geral:** KPIs do mês, contas a vencer e previsão até a próxima receita futura da conta principal escolhida em **Contas e Recorrentes → Contas e cartões**. A estimativa inclui despesas até o dia do recebimento e exclui entradas desse dia, faturas sem pagamento agendado e contas sem conta de pagamento vinculada; gastos não cadastrados também ficam fora. Contas fixas independentes podem ser vinculadas a uma conta de pagamento, mas podem coincidir com outros lançamentos e devem ser conferidas. O alerta de saldo negativo considera a previsão consolidada para os próximos 14 dias, mesmo com poucos lançamentos.
- **Análises:** fluxo de caixa projetado para **30, 60 e 90 dias**, cascata de receitas → despesas → economia, gráfico de rosca por categoria, evolução de 6 meses e correlação **Humor × Gastos**.
- **Lançamentos:** busca, filtros por categoria/conta/cartão/etiqueta, parcelamento automático (`2x` a `24x`), divisão de despesas com outra pessoa (`split`) e fechamento/arquivamento de mês.
- **Orçamentos e Metas:** tetos por categoria, regra percentual customizável (`50 / 30 / 20`), calculadora de **Reserva de Emergência** e caixinhas de economia com depósito rápido.
- **Contas e Recorrentes:** gestão de contas correntes, dinheiro e investimentos, cartões de crédito (limite, fechamento e vencimento), resumo de assinaturas ativas, próxima data e histórico de valor de recorrências e geração automática de fixos do mês.
- **Regras e Importação:** regras automáticas por palavra-chave e importação de extratos **CSV** (Nubank, Itaú, Inter, Bradesco, C6 etc.) com pré-visualização e detecção de duplicatas.

### 3. Conhecimento, Bem-Estar e Recursos Globais
- **Notas, Diário, Humor e Leituras:** notas fixáveis com checklist, listas de compras com quantidades, edição, duplicação, compartilhamento, orçamento estimado, histórico de compras e sugestões de itens, além de sugestões por etiqueta ou ligação, diário com perguntas guiadas e retrospectiva do ano, registro de humor e estante de livros/cursos/filmes/séries.
- **Conexões (`links2`) e Etiquetas:** qualquer item do hub pode ser conectado a outro (ex.: ligar uma tarefa a uma nota ou meta) e filtrado por `#etiquetas`.
- **Paleta de Comandos (`Ctrl+K`) e Busca Global:** navegue, execute ações ou encontre qualquer item instantaneamente.
- **Segurança dos Dados:** proteção na abertura e importação de dados inválidos, estado da sincronização em Backup, Desfazer/Refazer (`Ctrl+Z` / `Ctrl+Y`, até 30 passos), Lixeira com retenção de 30 dias, até 8 versões locais, limitadas pelo espaço disponível, e exportação/importação JSON.
- **Modo Privacidade:** botão do olho na barra lateral borra todos os valores em `R$`, notas e textos do diário quando há alguém por perto.

---

## Instalar como Aplicativo (PWA)

O Meu Hub pode ser instalado no celular ou no computador e abre em janela própria, sem barra de endereço, funcionando mesmo sem internet:

- **Android / Chrome / Edge (PC):** abra **Aparência → Aplicativo (PWA)** e clique em **Instalar aplicativo** (ou use o ícone de instalar na barra do navegador).
- **iPhone / iPad (Safari):** toque em **Compartilhar** e escolha **Adicionar à Tela de Início**.
- **Atalhos no ícone do app:** segure o ícone instalado para abrir direto **Hoje**, **Nova tarefa**, **Novo gasto** ou **Finanças**.

---

## Atalhos de Teclado

*(Podem ser desativados em **Aparência → Acessibilidade e teclado**)*

| Tecla | Ação |
|---|---|
| `Ctrl + K` | Abrir a paleta de comandos |
| `/` | Buscar em tudo |
| `Ctrl + Z` / `Ctrl + Y` | Desfazer / Refazer última alteração |
| `N` | Nova nota |
| `T` | Nova tarefa |
| `E` | Novo compromisso |
| `D` | Captura rápida de despesa |
| `C` | Abrir captura rápida |
| `1` a `9` | Abrir link configurado com o respectivo atalho |
| `?` | Mostrar atalhos |

---

## Configurar o Firebase (uma vez)

O site só abre depois de entrar com o Google. Os dados são sincronizados entre aparelhos pelo Firebase (Authentication + Firestore). Enquanto `FB_CONFIG` estiver vazio em [`js/sync.js`](file:///c:/Users/vitor/Documents/MeuHub/js/sync.js), o site abre direto e guarda os dados só no navegador.

1. Acesse https://console.firebase.google.com → **Criar um projeto** → nome `MeuHub`. O Google Analytics pode ficar desativado.
2. Na página inicial do projeto, clique no ícone **Web** (`</>`) → apelido `Meu Hub` → **Registrar app** (não marque o Firebase Hosting).
3. Copie o objeto `firebaseConfig` que aparece (`apiKey`, `authDomain`, `projectId`…) e cole em `FB_CONFIG` no [`js/sync.js`](file:///c:/Users/vitor/Documents/MeuHub/js/sync.js), no lugar de `null`. Esses valores são públicos: a proteção está nas regras do passo 6.
4. Menu **Criação** → **Authentication** → **Vamos começar** → **Google** → **Ativar** → escolha o e-mail de suporte → **Salvar**.
5. Ainda em Authentication → **Configurações** → **Domínios autorizados** → **Adicionar domínio** → `vitoriapac.github.io`.
6. Menu **Criação** → **Firestore Database** → **Criar banco de dados** → local `southamerica-east1 (São Paulo)` → **modo de produção**. Na aba **Regras**, troque tudo por:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /data/users/{uid}/{doc} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   e clique em **Publicar**. Cada pessoa só lê e grava os próprios dados.

---

## Arquivos e Manutenção de Cache

[`index.html`](file:///c:/Users/vitor/Documents/MeuHub/index.html) contém a casca HTML e os links. A aparência fica em [`css/style.css`](file:///c:/Users/vitor/Documents/MeuHub/css/style.css) e o código em `js/`, um arquivo por área (`core`, `sync`, `financas`, `recursos`, `inicio`, `main`), carregados nessa ordem. Consulte [ARCHITECTURE.md](ARCHITECTURE.md) e [SPEC.md](SPEC.md) para detalhes.

**Ao publicar mudanças em `css/` ou `js/`**, troque o `?v=` de todos os links no [`index.html`](file:///c:/Users/vitor/Documents/MeuHub/index.html) e a constante `VER` em [`sw.js`](file:///c:/Users/vitor/Documents/MeuHub/sw.js) para a mesma versão (ex.: `?v=20261023`). O Cenário 10 e o Cenário 12 de `tests/run.js` validam essa sincronia automaticamente.

---

## Rodar Localmente e Testar

```bash
# Servir localmente em http://localhost:8080
python -m http.server 8080

# Executar os cenários de teste ponta a ponta (Node 24+, sem dependências)
node tests/run.js
```

O executor [`tests/run.js`](file:///c:/Users/vitor/Documents/MeuHub/tests/run.js) abre o site em um Chrome ou Edge headless com Firebase simulado e valida login, sincronização, mescla entre aparelhos, troca de conta, saída, modo sem internet, integridade de emojis UTF-16, todas as 18 telas e 6 abas de finanças, cache-busting, rede lenta, falhas de armazenamento, gravação concorrente e PWA/Service Worker (~50 s). Se o navegador não for encontrado automaticamente, defina a variável de ambiente `CHROME_PATH`.
