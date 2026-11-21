# Ensaio de recuperação do MeuHub

Use uma conta Google exclusiva de teste em um celular e em um computador. Para a restauração, use outro perfil de navegador com uma segunda conta exclusiva de teste. Execute o roteiro em uma publicação que contenha as mudanças que você quer validar.

1. Na primeira conta, crie uma meta e um projeto chamado Reforma. Cadastre uma conta de teste com saldo inicial de R$ 100,00 e crie uma lista de compras com um item marcado como comprado. Aguarde a confirmação de sincronização em Backup e confira que ambos os aparelhos exibem os mesmos dados.
2. Desconecte os dois aparelhos da rede. No celular, crie a tarefa Revisar orçamento, vincule-a à meta e ao projeto e selecione-a como próximo passo. No computador, registre uma despesa de R$ 30,00 na conta de teste. Recarregue os dois aparelhos ainda offline e confira se cada alteração local foi preservada.
3. Reconecte um aparelho por vez. Aguarde as confirmações de sincronização e confira em ambos a tarefa, o vínculo com a meta, o próximo passo do projeto e o saldo de R$ 70,00.
4. Desconecte os aparelhos novamente e registre em cada um uma compra fictícia com o mesmo item da lista, na mesma data e conta, no valor de R$ 10,00. Reconecte e abra **Lembretes → Conferência financeira**. Confira que os dois lançamentos aparecem no mesmo grupo, abra um deles pelo botão **Conferir** e volte para confirmar que são compras distintas. Confira que o saldo é de R$ 50,00 antes e depois da confirmação.
5. Na primeira conta, baixe o backup completo. No perfil isolado da segunda conta, use **Conferir backup** e, em seguida, **Restaurar de arquivo**. Verifique os vínculos, o saldo após as duas compras e a confirmação de que são distintas. Volte à primeira conta e confira se ela continua independente.

Anote a versão, os aparelhos, os navegadores, os horários das confirmações e o resultado de cada etapa. Use somente dados fictícios e mantenha o arquivo exportado no ambiente de teste.

A suíte automatizada testa a mesclagem de edições independentes e restaura o resultado em uma conta isolada com Firebase simulado. A execução deste roteiro com Firebase real e aparelhos físicos deve ser registrada separadamente.
