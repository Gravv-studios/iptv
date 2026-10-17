# Medição Aperte Play — 17/10/2026

## Verificado
- Conjunto Meta 2051657525545495, conta de anúncios 1113115824457128.
- Gerenciador de Eventos: PageView e InitiateCheckout ativos pelo navegador; Purchase ativo pela API (1 recebido no período exibido até 16/10, qualidade 7,4/10).
- Domínio aperteoplayiptv.com.br e subdomínios adicionados à lista de permissão em 17/10. Não habilitar eventos de compra automáticos por clique em botão.
- Purchase só é enviado após aprovação verificada do provedor, em produção e com consentimento; ID estável evita duplicação em retries. Recebimento pela API não comprova atribuição ao anúncio.

## Correção
- Captura consentida de UTMs/IDs do link e preservação por até 90 dias entre páginas. Rótulos são filtrados e gravados em attribution.campaign no pedido, sem URL completa.
- fbclid real da URL origina _fbc; links sem clique não recebem identificador inventado. Campos de cookies inválidos não eliminam os demais dados de atribuição.
- Recusa limpa armazenamento e cookies mesmo se a revogação dos pedidos falhar temporariamente.
- Testes offline: pagamentos, Meta, WhatsApp e scripts/test-attribution.mjs; este último exige executar test:payments antes. Nenhuma compra ou mensagem real é gerada.

## Links e limites
Para anúncios cujo destino é o site, usar parâmetros de URL:
`utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.id}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}`

Para um link genérico enviado pelo atendimento:
`https://www.aperteoplayiptv.com.br/comprar?plano=mensal&utm_source=whatsapp&utm_medium=chat`
Trocar plano por semestral/anual conforme o produto. Isso identifica WhatsApp, não prova origem em anúncio.

Anúncio → WhatsApp → link genérico pode perder o identificador do clique. A integração de entrada precisa fornecer referência do anúncio vinculada ao contato/pedido (por exemplo referral/ctwa_clid) para demonstrar essa origem. Não ligar o hook antigo: foi desativado para evitar loops de respostas. Não adicionar IDs de campanha fixos a todos os compradores, não inventar fbc e não reenviar compras históricas como novas.

Os dados coletados no checkout ficam em aperte_meta_purchases.attribution; sent_at confirma aceite da API. O Gerenciador de Anúncios informa atribuição de plataforma e janela. Sem essas evidências, origem deve permanecer não identificada. Recusa de medição, bloqueadores e troca de aparelho limitam a cobertura. As UTMs não recuperam dados de pedidos anteriores.
