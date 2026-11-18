# Medições de persistência — M6

Medições com dados fictícios em `tests/run.js`, Firebase simulado e navegador local; não representam tráfego, latência ou custos reais do Firestore. O contador de nuvem mede gravações no armazenamento do simulador, não chamadas faturadas.

| Cenário | Gravações locais `hub-v1` | Gravações no simulador de nuvem | Chamadas de `syncSoon` | Serializações de `S` observadas |
|---|---:|---:|---:|---:|
| Navegar/renderizar sem mudar dados sincronizados | 1 | 0 | 1 | Não medidas diretamente |
| Editar e renderizar, incluindo retornos assíncronos | 3 | 2 | 3 | Não medidas diretamente |
| Receber atualização remota sem conflito | 2 | 0 | 2 | 2 |
| Editar em modo offline simulado | 1 | 0 | 1 | 1 |

No cenário offline a chamada a `syncSoon` retorna sem agendar envio, pois não há conexão ativa. A reconexão preservou a edição. O recebimento executa `after()` e `render()`, cada um podendo salvar; navegação chama `render()` e `save()`. `save()` serializa o estado, atualiza o histórico com `track()` e solicita sincronização; `push()` compara os dados sincronizáveis com a última versão e evita envio quando não mudaram. O recebimento preserva rascunhos via `remoteEditing()`/`remoteFormDirty()`, guarda versões locais antes de conflitos e redefine o histórico de desfazer.

**Recomendação M7:** manter a implementação por enquanto. As gravações locais repetidas são reais, mas os dados coletados não demonstram custo material em uso real; mudar `render()`/`save()` sem cobrir todas as mutações poderia perder alterações ou rascunhos. Antes de otimizar, medir com base representativa e testar edição concorrente, recuperação, quota, reconexão e troca de conta. Os testes existentes simulam esses casos, mas não substituem dois aparelhos e Firebase reais.
