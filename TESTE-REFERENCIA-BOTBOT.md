# Teste passivo de referência de anúncio

Autorizado por Marcos em 17/10/2026. Rota POST /api/whatsapp/referral-probe, independente do hook de atendimento, sem funções de resposta, pagamento, Meta ou provisionamento.

Autenticação de escrita derivada por HMAC-SHA256 do BOTBOT_AUTH_KEY existente com contexto passive-referral-probe-v1. A chave principal não é colocada na URL. O segredo derivado apenas autoriza esta coleta temporária. Sem GET público de resultados.

Coleta encerra automaticamente em 19/10/2026 às 17:30 de Brasília. Até 500 amostras mínimas no banco aperte_referral_probe (RLS, sem acesso PUBLIC). Não guarda payload, conteúdo, nome, telefone bruto, URLs, mídia ou ctwa_clid bruto. Registra presença de referência/clique, IDs numéricos de anúncio, direção quando fornecida, sender HMAC, evento/tipo técnico e horário. Ausência de referência só significa ausência na amostra capturada; não prova incapacidade da plataforma. Direção ausente não é classificada como entrada.

Verificação posterior via consulta somente leitura no Neon: SELECT received_at, summary FROM aperte_referral_probe ORDER BY id DESC LIMIT 30. Para identificar o teste, comparar horário e HMAC do número autorizado com o mesmo contexto referral-probe:. Não usar registro sintético como evidência do BotBot.

Depois do teste, restaurar a URL anterior do dispositivo (vazia na inspeção inicial) e encerrar a coleta. A expiração impede novas gravações; os registros existentes não são apagados automaticamente. Apagar amostras somente conforme autorização de limpeza do teste. Não habilitar WHATSAPP_HOOK_ENABLED.

Validação offline: npm run test:payments; node scripts/test-referral-probe.mjs; npm run build:vercel. O teste usa fetch que sempre falha para detectar qualquer envio externo.
