# Aperte Play

Site de vendas e área do cliente para demonstrar a contratação, entrega e renovação de acessos IPTV.

## Publicação na Vercel — 06/10/2026

Atualização de pagamentos: checkout transparente pela API de Orders do Mercado Pago, com Pix, cartão tokenizado e boleto, pedidos em PostgreSQL, idempotência e confirmação por webhook assinado/consulta ao provedor. A aplicação Aperte Play e o banco Neon gratuito em São Paulo já foram criados; a ativação depende de concluir credenciais, schema e homologação. A página mostra **Pagamento online em ativação**, sem criar cobranças. Ver [PAGAMENTOS.md](PAGAMENTOS.md) para o estado atual, configuração e limites. A liberação do IPTV segue pendente de integração e, após o pagamento, depende da equipe. A descrição a seguir registra a publicação anterior ao checkout.

Marcos escolheu a Vercel para publicar este repositório. `vercel.json` fixa o framework Next.js, o comando `npm run build:vercel` e a saída `.next-vercel`. O build anterior do Vinext produzia um Worker da Cloudflare; publicá-lo como arquivos estáticos causava 404 mesmo com o deployment marcado como Ready.

A página inicial mantém a identidade aprovada, as 6 horas grátis e a tabela comercial. Na Vercel, `/comprar` apresenta o plano e abre o WhatsApp com preço total e período; `/area-do-cliente` oferece atendimento e informa que o portal com login está em preparação. Nenhuma mensagem é enviada automaticamente. Não há pagamento, acesso IPTV, autenticação de cliente ou banco de clientes reais configurados nesta publicação.

Os headers de identidade do Sites não são aceitos como autenticação em requisições públicas da Vercel. O acesso ao D1 permanece exclusivo da demonstração local/Sites; a publicação não utiliza banco compartilhado em memória nem exibe uma conta fictícia como se fosse do visitante. O endpoint real de cobrança continua bloqueado com 503. A API de demonstração permite somente a prévia fictícia não autenticada e rejeita gravações.

O ambiente local Vinext continua com `npm run dev` na porta 5173 e preserva a demonstração original. Para verificar o mesmo build da Vercel, executar `npm run build:vercel`, depois `npm run start:vercel -- --hostname 127.0.0.1 --port 5180`. `node scripts/test-vercel.mjs` valida esse servidor sem criar pedidos; `node scripts/test-commercial-offer.mjs` confere a oferta. Os tipos do Next e do Vinext ficam em configurações e diretórios separados.

Esta decisão substitui a orientação anterior de manter exclusivamente em localhost. As instruções antigas abaixo registram a evolução do projeto. Atualizações continuam sendo enviadas ao GitHub somente quando solicitadas, com um commit por alteração concluída; a integração da Vercel publica esses commits.

## Página inicial em estilo streaming — 05/10/2026

A pedido de Marcos, a página inicial foi refeita em `app/storefront.tsx` e `app/mobile-storefront.css`: fundo neutro escuro, verde como cor de ação e amarelo só para destaques; foto da sala em tela cheia no topo; nova seção de conteúdo com seis categorias e aparelhos; três cartões de plano, cada um com seu botão de compra, e o anual em destaque. Compra e área do cliente mantêm o visual anterior.

As categorias (canais ao vivo, filmes, séries, esportes, infantil, notícias) e a frase "TV ao vivo, filmes e séries" são ilustrativas e precisam ser confirmadas com o catálogo do fornecedor. Não há nomes de canais, títulos nem quantidades.

Logo nova, também de 05/10/2026: `public/images/aperte-play-logo.svg`, desenhada em vetor (botão de play pressionado e letras próprias, nas mesmas cores). Substitui a anterior em todas as páginas via `components/brand-logo.tsx`; o PNG antigo continua em `public/images`. O `favicon.svg` usa o mesmo botão.

## Experiência para celular — 04/10/2026

A página inicial foi redesenhada em `app/storefront.tsx` e `app/mobile-storefront.css`, preservando os estilos de compra e do portal. O visitante escolhe opcionalmente Smart TV, celular ou computador; `trialUrlForDevice` inclui essa escolha na mensagem de WhatsApp. Não há envio automático, cadastro obrigatório nem promessa de compatibilidade antes da confirmação da equipe.

Os três planos agora aparecem em um seletor compacto, com valor total e link de compra atualizados conforme a seleção. No celular, os atalhos para planos, teste e ajuda aparecem quando o convite principal está fora de vista. Seletores usam controles nativos, com teclado e foco visível.

Nova fotografia ilustrativa: `public/images/aperte-play-living-room.png`, criada com ImageGen integrado. Prompt completo em `../assets/aperte-play-mobile-image-prompt.json`. A imagem anterior permanece preservada e continua na apresentação do checkout.

Validados: larguras de 320 e 390 px, computador, escolhas de aparelho e mensagens, teclado, seletor de planos, destino anual de R$ 170, dúvidas e ausência de rolagem horizontal. A verificação comercial soma 24 verificações sem alterar os dados da conta.

## Identidade atual — 03/10/2026

Marca definida pelo usuário: **Aperte Play**. Identidade em verde-esmeralda (`#22C975`), amarelo (`#F8D447`) e verde profundo (`#071A11`), aplicada à página comercial, compra, área do cliente e painel. A logo traz uma mão pressionando o botão de play de um controle remoto.

- `components/brand-logo.tsx`: componente compartilhado da marca.
- `app/brand.css`: cores e aplicação da marca no portal.
- `public/images/aperte-play-logo.png`: logo original com transparência.
- `public/images/aperte-play-hero.png`: imagem principal adaptada para verde e amarelo.
- `../assets/aperte-play-prompts.json`: prompts completos e modo de geração com ImageGen integrado; cópias dos originais na mesma pasta.

O nome anterior era provisório. Seus arquivos de imagem foram preservados, mas não são mais usados nas páginas. Os valores atuais seguem a tabela comercial abaixo; os registros de exemplo anteriores continuam disponíveis com seus valores e períodos originais. A exibição do usuário fictício anterior é compatibilizada com `aperteplay_demo`, sem apagar os pedidos.

Conferidos no navegador: página inicial, planos, compra e área do cliente, inclusive largura de 390 px, carregamento das imagens, nome acessível da área do cliente e funcionamento do menu. O projeto permanece exclusivamente local, conforme a orientação de hospedagem abaixo.

## Oferta comercial — 03/10/2026

Tabela enviada pelo usuário: mensal **R$ 25 por 1 mês**, semestral **R$ 100 por 6 meses** e anual **R$ 170 por 12 meses**. O trimestral saiu do catálogo; pedidos anteriores permanecem legíveis, com valores e períodos originais. O anual recebe o destaque visual de maior economia. O checkout, as renovações e a área do cliente usam a mesma fonte de preços.

A primeira seção oferece **6 horas grátis**, conforme o pedido explícito do usuário. O botão abre `https://wa.me/5533984622431` com uma mensagem preenchida para o visitante enviar. O número **(33) 98462-2431** veio da arte anexada. O site não envia mensagens automaticamente, não libera teste ao clicar e não inicia um cronômetro fictício. O atendimento confirma aparelho, configuração e ativação. A liberação automática depende de validar e conectar a API do fornecedor.

A demonstração existente trabalha em dias: mensal 30, semestral 180 e anual 365. Antes de conectar um fornecedor real, validar os IDs de pacote e a regra de vencimento (dias ou meses de calendário) e usar a validade confirmada por ele. A oferta pública exibe os períodos em meses conforme a tabela recebida.

`node scripts/test-commercial-offer.mjs` confere os preços, o plano retirado, a preservação de pedidos antigos e a solicitação de 6 horas sem alterar a conta de apresentação. O teste de integração completo em `scripts/test-demo.mjs` foi atualizado para a nova tabela; ele reinicializa a conta de demonstração e deve ser usado somente quando se desejar esse reset.

## Direção atual — 02/10/2026

Por solicitação de Marcos, continuar o desenvolvimento e a apresentação exclusivamente no localhost (`http://127.0.0.1:5173`). Não publicar novas versões em Sites/ChatGPT nem em outra hospedagem. A hospedagem definitiva será informada pelo usuário quando o projeto estiver pronto. A publicação privada anterior não é o ambiente de trabalho; seu identificador permanece preservado para permitir a gestão ou remoção posterior.

## Escopo desta versão

Esta versão opera exclusivamente em demonstração. Pix e cartão são simulados; o acesso mostrado não se conecta a um fornecedor. O endpoint de cobrança real retorna 503 enquanto as integrações não estiverem definidas. O roteiro da reunião está em [APRESENTACAO.md](APRESENTACAO.md).

O site começa com uma página comercial: apresentação da marca, planos, como funciona, aparelhos e dúvidas frequentes. Cada plano abre uma compra dedicada, com resumo, escolha de Pix/cartão, confirmação simulada e entrega do acesso de exemplo. O pedido pode ser retomado pela mesma URL depois de recarregar a página.

A área do cliente inclui renovação, credenciais fictícias, instalação por aparelho, histórico persistente, atendimento por assunto, visão de gestão e reinicialização da demonstração. Os preços do catálogo foram definidos pelo usuário; os pagamentos e os acessos emitidos pelo portal continuam simulados.

## Páginas locais

- `http://127.0.0.1:5173/`: site de vendas aberto para apresentação.
- `http://127.0.0.1:5173/comprar?plano=mensal`: compra de exemplo; aceita também `semestral` e `anual`.
- `http://127.0.0.1:5173/area-do-cliente`: conta, renovação, suporte e demonstração de gestão.
- `http://127.0.0.1:5174/`: entrada separada para apresentar o painel de gestão.

### Apresentação em duas janelas

Mantenha `npm run dev` em execução para o site. Em um segundo terminal, execute `npm run dev:panel`. Abra o site na porta 5173 e o painel na porta 5174 lado a lado. O painel é um servidor local de entrada que encaminha as requisições para a mesma aplicação; ambos compartilham a conta fictícia e o banco da demonstração. Ao voltar o foco para o painel, os pedidos são atualizados. O link **Ver site** no painel retorna à porta 5173. Os dois processos precisam permanecer em execução; o painel não é uma instalação de produção independente.

## Desenvolvimento

- Node.js 22.13 ou superior.
- `npm run install:ci` instala as dependências do lockfile.
- `npm run dev` inicia a prévia em loopback.
- `npm run db:generate` gera migrações a partir de `db/schema.ts`.
- `npm run build` gera o Worker e sua configuração em `dist/server`.
- Para inicializar o banco local após o build, use `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_deep_metal_master.sql` uma única vez por banco.
- `node scripts/test-demo.mjs` executa os testes de integração contra a prévia local. Os dados locais da conta de demonstração são reinicializados ao final.

O ambiente portátil oferece entrada de teste em `/signin-with-chatgpt?return_to=/`. A simulação de identidade não é incluída na versão publicada. A hospedagem privada usa a identidade validada pela plataforma.

## Estrutura

- `app/storefront.tsx`: site comercial, planos e dúvidas.
- `app/comprar/`: compra dedicada e entrega de acesso de demonstração.
- `app/area-do-cliente/page.tsx` e `app/portal.tsx`: portal e roteiro da apresentação.
- `app/api/demo/route.ts`: leitura e ações autenticadas, com origem validada.
- `lib/store.ts`: consultas preparadas, persistência D1 e operações atômicas.
- `lib/domain.ts`: catálogo comercial, compatibilidade de pedidos anteriores, cálculos e respostas do atendimento.
- `lib/offer.ts`: teste grátis de 6 horas e contato comercial por WhatsApp.
- `db/schema.ts` e `drizzle/`: esquema e migração persistente.

Os registros são vinculados ao identificador autenticado da plataforma. O cliente nunca determina o preço da cobrança. Pedido e confirmação têm proteção contra repetição; a renovação usa a maior data entre a validade atual e a confirmação. A marcação de pagamento e a extensão da assinatura ocorrem na mesma transação D1, exclusivamente no domínio de demonstração.

## Integrações futuras

O fornecedor de IPTV e o serviço de pagamento ainda não foram escolhidos pelo solicitante. Não existem credenciais, SDKs ou chamadas a fornecedores reais nesta versão. Também não há conexão com WhatsApp, cobrança recorrente automática, reprodução de conteúdo ou autenticação pública de clientes finais.

Antes de operar, definir APIs e contas, separar produção de demonstração, validar webhooks do serviço de pagamento, autenticar e autorizar cliente/gestor, implementar provisionamento idempotente com reconciliação, proteger credenciais reais, conectar o WhatsApp e validar a operação em sandbox. A configuração de fornecedores não é um simples interruptor desta demonstração.

### Avaliação de referência Sigma — 02/10/2026

Marcos autorizou a inspeção de um painel de revenda em `https://prodtv.sigma.st/`. Trata-se de uma conta de referência para entender a operação, não da conta definitiva do cliente nem de uma escolha confirmada de fornecedor. A consulta não ativou integrações, não salvou clientes, não criou testes, não renovou acessos, não enviou mensagens e não consumiu créditos. Não foram copiados tokens, senhas ou URLs individuais de automação para o projeto.

Evidências observadas na interface:

- Em [Integrações](https://prodtv.sigma.st/#/integrations), zero integrações ativas e dez disponíveis. Existe uma opção **API de Revenda**; sua presença não comprova permissões, operações, custos ou limites.
- O link de suporte da API (`/integrations/reseller-api/api-reference`) abriu o dashboard, em vez da documentação. Na verificação seguinte, a navegação pelo cartão da integração revelou a rota interna correta: [API de Revenda](https://prodtv.sigma.st/#/integrations/reseller-api). A tela informa **Assinar (R$ 49/mês)** nesta conta de referência. O botão inicial **Ativar** apenas abre essa página; nenhuma assinatura foi contratada.
- A [documentação pela rota interna correta](https://prodtv.sigma.st/#/integrations/reseller-api/api-reference) apresentou **Falha ao carregar a documentação da API: Request failed with status code 402**. A consulta parou nessa restrição, sem tentar contorná-la. Confirmados: existência da oferta da API e exigência de assinatura exibida nesta conta. Não confirmados: autenticação, endpoints, criação, consulta, renovação, idempotência, webhooks, limites nem ambiente de teste. Para validar capacidades antes de contratar, solicitar a documentação ao fornecedor ou consultar uma conta autorizada que já possua API habilitada. O preço observado não é um orçamento da GRAVV e deve ser reconfirmado na conta definitiva.
- O formulário de cliente oferece servidor, plano, usuário/senha, vencimento, conexões, valor e contatos. Foram observados períodos mensal, trimestral, semestral e anual. O mapeamento comercial deve considerar o pacote e servidor escolhidos; não assumir equivalência automática com os preços/dias ilustrativos locais.
- Um pacote mensal consultado informa criação em servidor principal e adicional, com possibilidade de falha no adicional se estiver indisponível ou se o usuário não estiver disponível. Isso exige acompanhar o resultado por servidor antes de anunciar entrega completa.
- As opções de pagamento incluem Asaas, Mercado Pago, paggpay, PayPal e Stripe. São opções oferecidas na interface, sem configuração nem confirmação de disponibilidade comercial para a conta definitiva.
- BotBot descreve envio de links de pagamento, lembretes de vencimento e captura de contatos. A configuração consultada estava vazia e solicita chaves próprias e conexão de dispositivo. Isso não comprova um agente de IA conversacional nem o uso da API oficial do WhatsApp. Há automações de testes, cujas URLs não foram acionadas.

Proposta para o lançamento, sujeita à validação da API: site e atendimento captam o interesse; o nosso painel registra cliente, origem, conversa e pedido; um evento de pagamento validado pelo servidor solicita a criação/renovação ao fornecedor; o resultado confirmado atualiza acesso e validade; o cliente recebe a orientação na conta e no canal autorizado. A IA responde dúvidas e encaminha pedidos, sem poder marcar pagamentos como quitados ou liberar créditos por instrução de uma conversa. Os canais de IA ainda precisam de confirmação do usuário.

O fornecedor permanece como fonte do acesso e do vencimento; o serviço de pagamento, como fonte da confirmação financeira. Para falhas de provisionamento, falta de créditos, notificações duplicadas e respostas incertas, registrar pendência e reconciliar antes de repetir operações. Não substituir a API por automação de cliques sem uma avaliação específica.

Próxima etapa técnica: obter a documentação funcional e confirmar as permissões na conta definitiva; então mapear os pacotes e validar em ambiente de teste a jornada pagamento → acesso → entrega → renovação. A etapa comercial de lançamento precisa definir marca, oferta, preços, aparelhos compatíveis, suporte e canais de aquisição. O site e a IA organizam a conversão; aquisição e volume de clientes dependem de ações comerciais próprias. Nenhuma campanha foi publicada ou contratada nesta avaliação. O projeto continua local e em demonstração.

## Validação realizada

Verificação de tipos e build de produção concluídos. As 21 verificações de integração local passaram. As rotas de venda, plano inválido e retorno da autenticação (preservando plano e pedido) também foram verificadas. No navegador, foram conferidos o caminho site → compra → entrega → histórico, a retomada do pedido após recarregar, a escolha de pagamento, menu e dúvidas no celular, ausência de rolagem horizontal a 390 px e a ferramenta WebMCP de resumo da compra. Cobranças reais desativadas por construção.

## Imagem da página de vendas

`public/images/lume-hero.png` é uma imagem original gerada com a ferramenta ImageGen, em modo de geração de imagem, sem referência externa. Prompt de direção: paisagem cinematográfica de ficção científica, enorme planeta laranja sobre montanhas desérticas violetas, pequeno explorador, lado esquerdo escuro e aberto para texto, luz âmbar, sem texto, logos, interface ou personagens existentes. O original está em `../assets/lume-hero.png`.
