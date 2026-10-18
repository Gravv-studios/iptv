# Teste único — ZEROUM

Implementação de 18/10/2026, isolada dos pagamentos, suporte e webhook geral.

- Rota POST `/api/whatsapp/trial-limit?k=...`; chave derivada por HMAC do segredo existente `WHATSAPP_BOT_SECRET`, contexto `trial-limit-endpoint-v1`. Não registrar a URL completa.
- Aceita o payload documentado da resposta URL do BotBot. Retorna `{reply}`; a regra deve usar somente essa resposta, sem o template antigo de variáveis do fornecedor.
- Reserva permanente em `aperte_trial_limits` e identidades HMAC em `aperte_trial_identities`. Transação com locks e unicidade antes de qualquer criação. Sem prazo de expiração da elegibilidade.
- Telefone brasileiro normalizado, inclusive variante móvel sem nono dígito. LID é tratado separadamente como identificador opaco, nunca convertido em telefone; quando os dois chegam juntos, os aliases ficam associados.
- Timeout/erro depois de iniciar criação mantém bloqueio `uncertain`; não repete automaticamente. Username determinístico por reserva como segunda barreira. A recuperação precisa consultar o fornecedor antes de qualquer nova tentativa.
- Mantém pacote ZEROUM sem adultos de 4 horas, códigos LOTUS 2060 e RX Purple 85304368, e link de renovação retornado pelo fornecedor. Não altera renovação, preço ou processamento de pagamento.
- O endpoint geral `/api/whatsapp/hook` deve continuar na configuração anterior. Não ativar um segundo atendente ou envio paralelo.

## Preparação e limites reais

POST autenticado com `mode=prepare` verifica o pacote e importa identidades do histórico paginado da API antes de habilitar a rota. Não cria testes nem envia mensagens. GET autenticado informa prontidão e contagens por estado, sem dados pessoais.

A inspeção inicial encontrou 775 clientes, somente 12 com WhatsApp preenchido. Os registros antigos sem telefone não podem ser associados retroativamente por esta API. O limite cobre o histórico identificável e as solicitações futuras recebidas pela rota. LID e número recebidos separadamente, sem um evento que os associe, não permitem demonstrar que são a mesma pessoa. Criação manual ou por outra URL do fornecedor fica fora desta trava.

Não afirmar cobertura retroativa total ou validação ponta a ponta sem um teste real controlado. Os testes locais são sintéticos, incluindo 30 pedidos simultâneos, aliases de telefone, LID, histórico, timeout e falha de persistência.

## Ativação

Publicar, preparar o histórico, verificar prontidão e só então substituir a URL da regra de teste existente. Manter uma única resposta. Não criar uma regra paralela. Conferir novamente a configuração salva e fazer a validação do WhatsApp com Marcos.
