import {readFile} from 'node:fs/promises';
import postgres from 'postgres';

// Explicitly invoked migration. Never called by build, request handlers or deployment.
const url = process.env.DATABASE_URL;
if (!url || !/^postgres(?:ql)?:\/\//.test(url)) {
  console.error('Configure DATABASE_URL no ambiente antes de preparar o banco.');
  process.exit(1);
}
const db = postgres(url, {max: 1, connect_timeout: 10, ssl: ['localhost','127.0.0.1'].includes(new URL(url).hostname) ? false : 'require'});
try {
  const schema = await readFile(new URL('../db/payments.sql', import.meta.url), 'utf8');
  await db.begin(async tx => { await tx.unsafe(schema); });
  console.log('Estrutura de pedidos preparada. Nenhum pedido ou pagamento foi criado.');
} catch {
  console.error('Não foi possível preparar o banco. Confira conexão e permissões; dados de acesso não são exibidos.');
  process.exitCode = 1;
} finally { await db.end({timeout: 5}); }
