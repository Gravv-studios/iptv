# Aperte Play — fluxo de atualizações

Preferência expressa por Marcos em 06/10/2026.

## Repositório principal

- Repositório: https://github.com/Gravv-studios/iptv.git
- Remote de envio: `origin`; branch principal: `main`.
- Os remotes `anterior` e `antigo` são referências históricas. Não enviar atualizações para eles.

## Quando registrar e enviar alterações

- Quando Marcos solicitar ou informar uma atualização real no site, concluir a alteração autorizada, conferir o resultado e fazer um commit descritivo dessa atualização. Depois, enviar o commit para `origin`.
- Tratar cada atualização concluída como uma unidade: não criar um commit por arquivo ou por ajuste intermediário.
- Consultas, inspeções, explicações, abertura da prévia e revisões sem alterações não geram commits nem envios.
- Não criar commits vazios, monitoramento de arquivos, tarefas agendadas ou sincronização automática em segundo plano.
- Não inventar alterações apenas para gerar um commit. Alterações administrativas só entram quando solicitadas pelo usuário, como esta configuração inicial.
- Antes de alterar ou enviar, conferir o estado local e remoto. Preservar o trabalho feito pelo usuário, Claude ou outros agentes. Não descartar mudanças nem reescrever histórico remoto; não usar push forçado.
- Incluir somente os arquivos da atualização autorizada. Manter credenciais, dados de clientes, contratos, arquivos de ambiente e artefatos locais fora dos commits.
- Confirmar o resultado do push antes de dizer que está sincronizado. Se houver impedimento, informar o que foi salvo localmente e o que não chegou ao GitHub.

## Ambiente e validação

- O site continua em localhost até Marcos definir a hospedagem. Enviar código ao GitHub não autoriza publicar o site ou alterar DNS.
- Usar verificações proporcionais à alteração. `scripts/test-commercial-offer.mjs` não altera a conta de apresentação.
- `scripts/test-demo.mjs` reinicializa dados da demonstração: não executar sem uma necessidade autorizada de reset.
- Pagamentos e provisionamento continuam em demonstração até as integrações reais serem configuradas e verificadas.
