# Pagamentos no site — Mercado Pago

Implementação de 06/10/2026. Marcos escolheu Mercado Pago para Pix, cartões e boleto. A conta que receberá o dinheiro ainda será criada pelo cliente. O checkout fica desativado até configurar e validar a conta e o banco. Não houve cobrança real nem validação com credenciais do Mercado Pago nesta etapa.

## Jornada implementada

1. O cliente escolhe mensal (R$ 25), semestral (R$ 100) ou anual (R$ 170) e informa nome, e-mail e WhatsApp.
2. O servidor registra o pedido no PostgreSQL com preço e período do catálogo. O navegador não define o valor cobrado.
3. O Payment Brick oficial apresenta os meios habilitados na conta: Pix, cartões à vista e boleto. Os dados de cartão são tokenizados pelo Mercado Pago; o site não grava número, código de segurança, token de cartão nem documento do pagador no banco.
4. O servidor cria o pagamento com chave de idempotência igual ao UUID do pedido. O Status Screen oficial mostra o QR Code/código Pix, boleto e situação. Nenhum QR Code fictício é produzido.
5. O webhook assinado e a consulta de status buscam o pagamento na API. Antes de confirmar, verificam referência, valor, moeda, conta recebedora, ambiente e identificação do pedido.
6. O pedido aprovado aguarda ativação pela equipe. Não há emissão automática de IPTV, assinatura recorrente, renovação automática, login público ou painel administrativo de pagamentos nesta entrega.

A consulta usa um cookie HttpOnly de 30 dias; o pedido só pode ser consultado pelo mesmo navegador que iniciou a compra. O link sozinho não dá acesso. Os dados pessoais não são devolvidos na consulta pública. Em outro dispositivo ou após limpar cookies, o cliente deve recorrer ao atendimento.

## Configuração

Criar a conta de recebimento do Michel e a aplicação de integração de Checkout Bricks no Mercado Pago. As credenciais e segredos devem ser preenchidos diretamente na Vercel; não enviar pelo chat nem versionar. Usar credenciais e recebedor correspondentes ao ambiente. Não misturar credenciais de teste com produção.

Preparar um PostgreSQL dedicado, com conexão privada de backend e TLS. Na conta escolhida, executar `npm run payments:setup` com `DATABASE_URL` definida (ou `node --env-file=.env.local scripts/setup-payments.mjs`). O script aplica `db/payments.sql` em transação, sem apagar tabelas ou criar pedidos. Não é executado durante o build. Usar a conexão do proprietário da tabela; RLS está habilitada sem políticas públicas. Se o provedor conceder acesso a funções anônimas por padrão, remover também esses privilégios específicos. Não expor a tabela em APIs públicas.

| Variável | Uso |
| --- | --- |
| `PAYMENTS_ENABLED` | `false` até concluir configuração; `true` habilita quando todas as demais variáveis estão presentes. |
| `MP_MODE` | `test` para homologação; `production` somente com conta e credenciais de produção. |
| `APP_URL` | Origem HTTPS pública do site, sem caminho; hoje `https://iptv-nine-drab.vercel.app`. |
| `MP_PUBLIC_KEY` | Public Key da aplicação e do ambiente; única credencial exposta ao Brick no navegador. |
| `MP_ACCESS_TOKEN` | Access Token privado do mesmo recebedor e ambiente. |
| `MP_COLLECTOR_ID` | ID numérico do recebedor, conferido em `/users/me` com o token do servidor. |
| `MP_WEBHOOK_SECRET` | Assinatura secreta da configuração de Webhooks da aplicação. |
| `PAYMENTS_SESSION_SECRET` | Segredo aleatório de pelo menos 32 caracteres; gerar com criptografia e guardar como segredo. Rotacionar invalida a consulta de pedidos nas sessões anteriores. |
| `DATABASE_URL` | URL privada PostgreSQL; usar a conexão com pool do provedor quando disponível. |

Na aplicação Mercado Pago, configurar o tópico **Pagamentos** e o webhook `https://iptv-nine-drab.vercel.app/api/payments/webhook`. O mesmo endereço é enviado na criação de cada pagamento. Produção e testes precisam das configurações e segredos correspondentes. Novos domínios exigem atualizar `APP_URL` e o webhook.

Não ativar `PAYMENTS_ENABLED` em previews públicos com credenciais reais. Homologar em um ambiente de teste separado e com banco isolado. A verificação de presença das variáveis não valida a conexão com o banco, o esquema nem a autorização da conta; isso faz parte da homologação abaixo.

## Homologação e ativação pendentes

- Com a conta criada: confirmar disponibilidade de Pix, boleto e cartões, permissões da aplicação e dados do recebedor. A oferta de meios depende do Mercado Pago e da conta.
- Preparar o banco; testar criação e retomada do pedido na mesma sessão e rejeição em outra sessão.
- Usar compradores/cartões de teste oficiais: aprovação, recusa, pendência, clique repetido e interrupção da conexão. Testar também Pix e boleto conforme os recursos de teste disponibilizados pelo Mercado Pago para essa conta.
- Verificar webhook assinado, duplicado e fora de ordem; comparar pagamento com registro no banco. Reembolso/contestação devem marcar conferência, sem emitir acesso.
- Confirmar que nenhum dado sensível aparece nos logs e que produção utiliza HTTPS, backups e acesso restrito ao banco.
- Só então habilitar as variáveis de produção e publicar. Qualquer cobrança real de validação exige decisão do responsável pela conta e verificação do recebimento; não é executada pelos scripts deste projeto.

Falha ambígua após enviar pagamento fecha o formulário e consulta a API por referência antes de qualquer nova tentativa. Não existe repetição automática da cobrança. Se o provedor não localizar a tentativa ou houver divergência, o atendimento precisa conferir antes de orientar outro pedido. Sem integração de IPTV, um pagamento aprovado fica em `awaiting_activation`. Reembolsos e contestações ficam em `review_required`; o código não inicia devoluções nem cancela acessos.

## Verificações locais

`npm run test:payments` verifica regras e segurança com dados sintéticos, sem rede ou banco. `node scripts/test-commercial-offer.mjs` verifica os três preços e o teste grátis. `npm run build:vercel` valida o build; com `npm run start:vercel -- --hostname 127.0.0.1 --port 5180`, executar `node scripts/test-vercel.mjs`. Este último testa somente a configuração ainda desativada e nunca cria uma cobrança.

## Referências oficiais

- [Payment Brick](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/default-rendering)
- [Pagamento com Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix)
- [Outros meios, incluindo boleto](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/other-payment-methods)
- [Webhooks e assinatura](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/additional-content/your-integrations/notifications/webhooks)
