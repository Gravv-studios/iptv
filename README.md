# Lume TV

Portal privado de demonstração para contratação, entrega e renovação de acessos IPTV.

## Escopo desta versão

Esta versão opera exclusivamente em demonstração. Pix e cartão são simulados; o acesso mostrado não se conecta a um fornecedor. O endpoint de cobrança real retorna 503 enquanto as integrações não estiverem definidas. O roteiro da reunião está em [APRESENTACAO.md](APRESENTACAO.md).

O portal inclui planos, renovação, credenciais fictícias, instalação por aparelho, histórico persistente, atendimento por assunto, visão de gestão e reinicialização da demonstração. Os preços não representam oferta comercial aprovada.

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

- `app/portal.tsx`: portal e roteiro da apresentação.
- `app/api/demo/route.ts`: leitura e ações autenticadas, com origem validada.
- `lib/store.ts`: consultas preparadas, persistência D1 e operações atômicas.
- `lib/domain.ts`: planos ilustrativos, cálculos e respostas do atendimento.
- `db/schema.ts` e `drizzle/`: esquema e migração persistente.

Os registros são vinculados ao identificador autenticado da plataforma. O cliente nunca determina o preço da cobrança. Pedido e confirmação têm proteção contra repetição; a renovação usa a maior data entre a validade atual e a confirmação. A marcação de pagamento e a extensão da assinatura ocorrem na mesma transação D1, exclusivamente no domínio de demonstração.

## Integrações futuras

O fornecedor de IPTV e o serviço de pagamento ainda não foram escolhidos pelo solicitante. Não existem credenciais, SDKs ou chamadas a fornecedores reais nesta versão. Também não há conexão com WhatsApp, cobrança recorrente automática, reprodução de conteúdo ou autenticação pública de clientes finais.

Antes de operar, definir APIs e contas, separar produção de demonstração, validar webhooks do serviço de pagamento, autenticar e autorizar cliente/gestor, implementar provisionamento idempotente com reconciliação, proteger credenciais reais, conectar o WhatsApp e validar a operação em sandbox. A configuração de fornecedores não é um simples interruptor desta demonstração.

## Validação realizada

Verificação de tipos, build de produção, 21 verificações de integração local e inspeção no navegador: pedido, pagamento simulado, extensão da validade, atendimento, navegação para celular e ferramentas WebMCP. Cobranças reais desativadas por construção.
