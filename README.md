# Meu Hub

Site: https://vitoriapac.github.io/MeuHub/ (GitHub Pages, branch `main`, pasta raiz).

O site só abre depois de entrar com o Google. Os dados são sincronizados entre aparelhos pelo Firebase (Authentication + Firestore). Enquanto `FB_CONFIG` estiver vazio em `js/sync.js`, o site abre direto e guarda os dados só no navegador.

## Configurar o Firebase (uma vez)

1. Acesse https://console.firebase.google.com → **Criar um projeto** → nome `MeuHub`. O Google Analytics pode ficar desativado.
2. Na página inicial do projeto, clique no ícone **Web** (`</>`) → apelido `Meu Hub` → **Registrar app** (não marque o Firebase Hosting).
3. Copie o objeto `firebaseConfig` que aparece (`apiKey`, `authDomain`, `projectId`…) e cole em `FB_CONFIG` no `js/sync.js`, no lugar de `null`. Esses valores são públicos: a proteção está nas regras do passo 6.
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

## Como funciona

- **Login**: botão *Entrar com o Google*. A sessão fica salva no aparelho até clicar em *Sair da conta* (Backup).
- **Sincronização**: o hub de cada pessoa fica em `data/users/<uid>/` no Firestore. Mudanças de aparelhos diferentes são mescladas item a item.
- **Spotify**: card "Playlist do Spotify" (Personalizar painel) → cole o link compartilhado.
- **Clima**: card "Clima" → busque a cidade (Open-Meteo, sem chave).
- **Backup**: baixa `meu-hub-backup-AAAA-MM-DD-HHMM.json`; *Importar mesclando* junta sem apagar nada.

## Arquivos

`index.html` só tem a casca e os links. A aparência fica em `css/style.css` e o código em `js/`, um arquivo por área (`core`, `sync`, `financas`, `recursos`, `inicio`, `main`), carregados nessa ordem. Detalhes e regras em [SPEC.md](SPEC.md) → Estrutura e Estilo.

**Ao publicar mudanças em `css/` ou `js/`**, troque o `?v=` de todos os links no `index.html` e o `VER` em `sw.js` para a data do dia (ex.: `?v=20261023`). Assim o navegador e o aplicativo instalado (PWA) não misturam arquivos novos com antigos do cache.

## Rodar localmente

`python -m http.server 8080` na pasta do projeto e abra http://localhost:8080 (o `localhost` já vem autorizado no Firebase).

## Testes

`node tests/run.js` (Node 24+, sem instalar nada). Abre o site num Chrome ou Edge sem interface, com um Firebase simulado, e testa login, sincronização, mescla entre aparelhos, troca de conta, saída, modo sem internet, todas as telas e rede lenta. Leva ~50 s. Se o navegador não for encontrado, defina `CHROME_PATH`.
