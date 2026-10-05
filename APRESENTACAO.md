# Aperte Play — roteiro para apresentar ao cliente

A demonstração usa dados fictícios. Nenhuma cobrança é realizada e os logins não dão acesso a conteúdo. O site foi preparado para apresentação privada pelo responsável, sem compartilhar suas credenciais de acesso.

## Antes da reunião

Com a prévia local em execução, abra `http://127.0.0.1:5173/area-do-cliente` e clique em **Apresentar ao cliente**. Selecione **Preparar novo cliente** e confirme **Reiniciar dados de teste**. Isso limpa somente os pedidos e conversas da demonstração vinculados à sua conta local. Depois clique em **Ver site** para iniciar a apresentação pela página de vendas. O desenvolvimento e a apresentação ficam no localhost até o usuário definir a hospedagem definitiva.

## Roteiro de 5 minutos

Para apresentar em duas janelas, deixe o site em `http://127.0.0.1:5173/` e o painel em `http://127.0.0.1:5174/`. Inicie o segundo com `npm run dev:panel` enquanto o site estiver rodando. Faça a compra de teste na janela do site e volte para o painel para ver o pedido atualizado.

1. **Site de vendas:** em `http://127.0.0.1:5173/`, mostre a apresentação da Aperte Play, a oferta de 6 horas grátis na primeira seção, o botão para solicitar pelo WhatsApp e os planos mensal (R$ 25), semestral (R$ 100) e anual (R$ 170). O atendimento confirma a ativação do teste; clicar no botão não libera um acesso automaticamente.
2. **Contratação e pagamento:** clique em **Escolher mensal**, **Escolher semestral** ou **Escolher anual**. Na página de compra, confira o resumo, selecione Pix ou cartão e clique em **Continuar para pagamento**. Clique em **Simular pagamento aprovado**. Nenhum dado bancário deve ser informado.
3. **Entrega:** mostre o usuário, a senha e a validade na confirmação. Clique em **Acessar minha área do cliente**. O exemplo não conecta a nenhum servidor IPTV.
4. **Instalação:** abra Como assistir e alterne entre Smart TV, celular e computador. Explique que os aplicativos e links serão definidos com o fornecedor.
5. **Renovação:** renove por outro período. Mostre que a validade aumenta preservando os dias existentes e que o novo pedido aparece no histórico.
6. **Atendimento:** pergunte “Como renovar?” ou “Onde está minha senha?”. O assistente responde por assunto e mantém a conversa neste portal. A solicitação do teste usa o link do WhatsApp (33) 98462-2431; automação de atendimento e de liberação ainda não está conectada.
7. **Gestão:** abra Painel de gestão para mostrar o cliente de exemplo, os pedidos pendentes, os valores simulados e as três integrações a definir.

## O que já funciona nesta demonstração

- Site de vendas responsivo, compra dedicada, portal do cliente e visão de gestão.
- Pedidos persistentes de teste e histórico por conta autenticada.
- Compra, cancelamento de pedido pendente e renovação por Pix/cartão simulados.
- Entrega de credenciais fictícias após confirmação e preservação dos dias restantes.
- Proteção contra duplicar o período ao confirmar duas vezes o mesmo pedido.
- Atendimento no site com respostas por assunto e conversa persistente.
- Roteiro integrado e reinicialização entre apresentações.

## O que depende da próxima etapa

- Escolha de fornecedor e validação de API para criar, consultar e renovar acessos.
- Escolha do serviço de pagamento, conta recebedora e validação de confirmação de pagamento.
- Integração oficial do WhatsApp, modelos de mensagem e encaminhamento humano. O número comercial já foi informado e está aplicado ao link de teste.
- Validação das condições de teste, configuração, suporte e dos períodos reais no fornecedor. Preços e períodos comerciais já foram informados.
- Acesso de clientes externos, autenticação adequada ao público e separação de permissões de administrador. O localhost usa uma identidade fictícia automática para facilitar a apresentação.
- Testes reais em ambiente de teste dos fornecedores antes de ativar cobrança e provisionamento.

A renovação demonstrada é iniciada pelo cliente pelo site. Cobrança recorrente automática não foi implementada nem prometida.
