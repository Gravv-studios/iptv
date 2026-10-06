# Pagamentos no site — Mercado Pago Orders

Atualizado em 06/10/2026. Checkout transparente para Pix, cartões à vista e boleto. A aplicação **Aperte Play**, com API de Orders, foi criada na conta de recebimento confirmada por Marcos. A aplicação liberou as credenciais de teste. O Neon gratuito foi criado em São Paulo e conectado ao projeto Vercel `iptv`, em Production e Preview, com ramificações de banco para Preview. As funções Vercel usam `gru1`.

**Recebimentos ainda desativados.** Não houve cobrança real nem homologação de pagamento com o provedor. Pendências: inserção do Access Token protegido diretamente na Vercel, confirmação do e-mail da Neon, aplicação do schema, demais variáveis, webhook e testes integrados. Não salvar credenciais, dados pessoais ou números privados de contas neste repositório.

Na Vercel, Preview já recebeu `MP_MODE=test`, a Public Key e o ID do vendedor de teste, `PAYMENTS_ENABLED=false` e um segredo de sessão aleatório. O formulário de `MP_ACCESS_TOKEN` está preparado para inserção manual protegida. A página de webhooks voltou a exigir validação da conta por telefone; nenhuma notificação foi configurada ainda.

## Jornada implementada

1. O cliente escolhe mensal (R$ 25), semestral (R$ 100) ou anual (R$ 170) e informa nome, e-mail e WhatsApp.
2. O servidor registra o pedido no PostgreSQL com preço e período do catálogo. O navegador não define o valor cobrado.
3. Pix e boleto usam formulário do site; cartões usam o Card Payment Brick oficial. Número e código de segurança do cartão são tokenizados pelo Mercado Pago. O banco do site não grava PAN, CVV, token do cartão nem CPF/CNPJ. Documento e endereço de cobrança são enviados apenas no processamento necessário.
4. O servidor verifica a conta em `/users/me`, reserva a tentativa atomicamente e envia uma Order com chave de idempotência igual ao UUID do pedido. Há somente uma transação por pedido. Pix expira em 30 minutos e boleto em três dias, contados pelo provedor a partir da emissão.
5. A consulta `GET /v1/orders/{id}` valida o pedido antes de aplicar o resultado. Pix exibe o QR Code e código retornados pelo provedor; boleto exibe o link e código quando disponíveis. Não são geradas instruções de pagamento fictícias.
6. O webhook assinado e a atualização de status consultam a Order real. Verificam referência, valor, país/moeda, recebedor, ambiente, transação e data do evento. Pedido processado sem valores efetivamente creditados não é marcado como aprovado.
7. Pagamento aprovado aguarda ativação pela equipe. Não há emissão automática de IPTV, assinatura recorrente, renovação automática, login público ou painel administrativo de pagamentos nesta entrega. O desafio 3DS opcional ainda não foi implementado.

A consulta usa um cookie HttpOnly de 30 dias; o pedido só pode ser consultado pelo navegador que iniciou a compra. O link sozinho não dá acesso. Os dados pessoais não são devolvidos na consulta pública. Em outro dispositivo ou após limpar cookies, o cliente deve recorrer ao atendimento.

## Banco

O Neon já forneceu `DATABASE_URL` à Vercel. É necessário aplicar `db/payments.sql` no SQL Editor da ramificação correta ou executar `npm run payments:setup` com a conexão privada definida. O script aplica o schema em transação, sem apagar tabelas ou criar pedidos, e não roda durante o build. O schema inclui migração aditiva para IDs e instruções da API de Orders.

Usar TLS e a conexão do proprietário da tabela; RLS está habilitada sem políticas públicas. Não expor a tabela em APIs públicas. Preparar o schema antes de criar a ramificação de homologação ou aplicá-lo também nessa ramificação. Confirmar na Vercel que Preview realmente aponta para banco isolado antes dos testes.

## Variáveis

Preencher diretamente em Settings → Environment Variables do projeto `iptv` na Vercel. Tokens e segredos devem ser do tipo **Secret**, nunca enviados pelo chat nem versionados. Produção e Preview precisam de configurações próprias. A aplicação usa variáveis de servidor, sem prefixo `NEXT_PUBLIC_`.

| Variável | Uso |
| --- | --- |
| `PAYMENTS_ENABLED` | `false` até concluir a configuração. `true` habilita apenas quando as demais variáveis também estão presentes. |
| `MP_MODE` | `test` para homologação; `production` somente com conta e credenciais de produção. |
| `APP_URL` | Origem HTTPS exata do deployment, sem caminho. Produção: `https://iptv-nine-drab.vercel.app`. Preview deve usar a própria origem. |
| `MP_PUBLIC_KEY` | Public Key do ambiente; única credencial entregue ao Brick no navegador. |
| `MP_ACCESS_TOKEN` | Access Token privado do mesmo recebedor e ambiente. Orders usa credenciais `APP_USR`, inclusive para o vendedor de teste. |
| `MP_COLLECTOR_ID` | ID numérico do recebedor. A API confere `/users/me`, site MLB, identificação da conta e a marca `test_user` para distinguir teste de produção. |
| `MP_WEBHOOK_SECRET` | Assinatura secreta do webhook correspondente ao ambiente. |
| `PAYMENTS_SESSION_SECRET` | Segredo criptograficamente aleatório de pelo menos 32 caracteres. Rotacionar invalida as sessões anteriores. |
| `DATABASE_URL` | URL privada PostgreSQL, preferencialmente com pool. A integração Neon já fornece esta variável. |

Configurar na aplicação Mercado Pago o tópico **Order**, com o endpoint `/api/payments/webhook` da origem correspondente. A assinatura usa `data.id` em minúsculas conforme a regra de IDs alfanuméricos. Não configurar o tópico legado de pagamentos para este backend. Alterações de domínio exigem atualizar `APP_URL` e a configuração de notificações.

A presença das variáveis não valida conexão, schema, permissões nem disponibilidade dos meios de pagamento. Nunca habilitar Preview com credenciais de recebimento real.

## Homologação e ativação pendentes

- Confirmar disponibilidade de Pix, boleto e cartões, permissões e recebedor da conta escolhida.
- Aplicar schema e testar criação/retomada do pedido, isolamento entre sessões e ramificações de banco.
- Usar compradores e cartões de teste oficiais: aprovação, recusa, pendência, clique repetido e interrupção da conexão. Testar Pix e boleto conforme os recursos oferecidos à conta.
- Verificar webhook assinado, duplicado e fora de ordem. Confirmar recuperação por referência quando a resposta de criação é perdida; a disponibilidade de `Order.search` precisa ser validada com o token real.
- Conferir valor, recebedor, vencimento, QR Code, boleto e apresentação em celular. Confirmar que dados sensíveis não aparecem nos logs.
- Configurar as credenciais e o webhook de produção somente após homologação. Uma eventual cobrança real de validação depende de execução pelo responsável pela conta; nenhum script deste projeto faz essa cobrança.

Falha ambígua após o envio fecha o formulário e mantém a consulta de status. Não há reenvio automático da cobrança: a recuperação consulta a Order ou pesquisa pela referência. Resultado vazio não comprova ausência de cobrança; múltiplos resultados exigem atendimento. Erros 400 reconhecidos como validação anterior à criação marcam a tentativa como rejeitada e permitem iniciar outro pedido. Outras falhas permanecem pendentes até reconciliação.

Sem integração de IPTV, aprovação fica em `awaiting_activation`. Reembolsos, contestações e devoluções parciais ficam em `review_required`; o código não inicia devoluções nem cancela acessos. Eventos antigos não sobrescrevem um estado mais recente.

## Verificações locais

`npm run test:payments`: 51 verificações offline com dados sintéticos, incluindo valores, ambiente/recebedor, assinatura, estados, sanitização, idempotência, erros e instruções de pagamento vencidas. Não substituem testes com banco e conta reais. `node scripts/test-commercial-offer.mjs` verifica preços e teste grátis. `npm run build:vercel` valida a compilação.

Com `npm run start:vercel -- --hostname 127.0.0.1 --port 5180`, executar `node scripts/test-vercel.mjs`. Este último exige configuração ainda desativada e nunca cria uma cobrança. Não executar `test-demo.mjs`: ele reinicializa a demonstração.

## Referências oficiais

- [Cartões e Card Payment Brick com Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/cards)
- [Pix com Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix)
- [Boleto com Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/boleto)
- [Consulta de pedidos por referência](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro/search-orders/get)
