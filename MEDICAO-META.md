# Medição Meta — Aperte Play

Conjunto de dados criado em 14/10/2026: **2051657525545495**. Portfólio **1158625679822532**, conta de anúncios **1113115824457128**.

## Ativação

Configurar na Vercel, somente Production, e gerar novo deployment:

- `META_PIXEL_ID=2051657525545495`
- `META_TRACKING_ENABLED=true`
- `META_CAPI_ACCESS_TOKEN`: segredo de integração direta deste conjunto, nunca no Git nem no frontend.
- `META_GRAPH_VERSION=v25.0` (padrão; conferir versão suportada na Meta antes de ativar).

Sem habilitação explícita, não há coleta. Consentimento recusado não impede checkout. O token permanece no servidor. Não há importação de compras antigas.

## Eventos

- PageView: navegador, somente depois do aceite.
- InitiateCheckout: pedido de produção criado, valor vindo do servidor.
- Purchase: **somente servidor**, depois de `verifiedProviderOrder` validar o pagamento Mercado Pago. Não é disparado ao gerar Pix, clicar em pagar, nem apenas exibir confirmação. Browser não envia Purchase, evitando dupla fonte.
- ID estável `purchase_<uuid>` e reserva atômica no banco protegem reenvios concorrentes. Recibo Meta só marca envio concluído quando `events_received=1`. Falhas não alteram o pagamento nem a liberação do acesso. Novas notificações verificadas ou consultas do pedido tentam novamente; não existe cron ou garantia de retry sem nova chamada.

Coleta de e-mail/telefone em SHA-256, cookies fbp/fbc e user agent após consentimento explícito. Sem CPF, nome, cartão, senha IPTV ou conteúdo das mensagens. A tabela de atribuição tem RLS e acesso público revogado. Recusar remove a atribuição dos pedidos associados à sessão atual; dados já recebidos pela Meta não são apagados por essa ação. O site explica essa limitação.

Compras inteiramente no bot **não são cobertas**: não há consentimento/atribuição do site nesses pedidos. Não inventar origem website para vendas do WhatsApp.

## Validação

`npm run test:payments` seguido de `node scripts/test-meta.mjs`: fixtures sintéticas, sem cobranças ou envio externo. Build: `npm run build:vercel`.

Antes dos anúncios: verificar PageView em Eventos de teste com aceite e ausência após recusa; gerar compra de homologação e conferir Purchase/BRL/valor e unicidade. Não gerar compras fictícias em eventos de produção. Confirmar aceitação do endpoint e diagnóstico na Meta antes de declarar a API validada.

## Estado em 14/10/2026

Pixel criado e associado à conta correta. Eventos automáticos e coleta automática detalhada desligados. Token inicialmente bloqueado pela falta de e-mail empresarial; cadastro solicitado pelo usuário e confirmação pendente. Código implementado e testes locais não equivalem a integração validada em produção. Campanha permanece sem autorização final de publicação enquanto medição é finalizada.
