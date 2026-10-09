'use client';

import {useState, type FormEvent} from 'react';
import {CheckCircle2} from 'lucide-react';
import {BrandLogo} from '../../components/brand-logo';
import type {PublicAccess} from '../../lib/whatsapp/texts';
import '../mobile-storefront.css';
import '../public-service.css';
import '../comprar/payment.css';

// Owner-only page: rehearses what a buyer sees and receives after a confirmed payment, without any charge.
export default function DeliveryPreview() {
  const [key, setKey] = useState(''), [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState<{access: PublicAccess; sent: boolean} | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/whatsapp/preview', {method: 'POST', cache: 'no-store', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({key, phone})});
      const data = await response.json() as {access?: PublicAccess; sent?: boolean; error?: string};
      if (!response.ok || !data.access) throw new Error(data.error ?? 'Não foi possível simular agora.');
      setResult({access: data.access, sent: !!data.sent});
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível simular agora.'); }
    finally { setBusy(false); }
  }
  const access = result?.access;
  return (
    <div className="ap-site ap-public"><main className="ap-container" style={{maxWidth: 640, padding: '32px 16px'}}>
      <BrandLogo/>
      <h1 style={{fontSize: 26, margin: '24px 0 8px'}}>Simulação de entrega</h1>
      <p style={{fontSize: 14, lineHeight: 1.7, marginBottom: 20}}>Mostra o que o cliente vê e recebe depois de um pagamento confirmado. Não gera cobrança nem gasta créditos: o acesso criado é um teste de 5 horas.</p>
      <form className="mp-customer" onSubmit={submit}>
        <label>Senha do robô<input type="password" autoComplete="off" required value={key} onChange={e => setKey(e.target.value)}/></label>
        <label>WhatsApp com DDD<input type="tel" inputMode="tel" required minLength={10} maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000"/></label>
        <button className="ap-button" type="submit" disabled={busy}>{busy ? 'Simulando…' : 'Simular pagamento confirmado'}</button>
      </form>
      {error && <p className="mp-error" role="alert">{error}</p>}
      {access && <>
        <div className="mp-result approved" role="status"><CheckCircle2 size={28}/><div><h2>Pagamento aprovado</h2><p>Pagamento confirmado e acesso liberado. Seus dados estão abaixo e também foram enviados para o WhatsApp informado.</p></div></div>
        <div className="mp-access" role="status">
          <h2>Seu acesso Aperte Play</h2>
          <dl><div><dt>Usuário</dt><dd>{access.username}</dd></div><div><dt>Senha</dt><dd>{access.password ?? 'a mesma de antes'}</dd></div><div><dt>Válido até</dt><dd>{access.expiresAt}</dd></div>{access.server && <div><dt>Endereço (DNS/URL)</dt><dd>{access.server}</dd></div>}</dl>
          <p>Instale LOTUS (código 2050), RX PURPLE (código 41494302) ou ZINK PLAYER na sua TV ou celular e entre com o usuário e a senha. Guarde estes dados.</p>
        </div>
        <p style={{fontSize: 13}}>{result?.sent ? 'Mensagem enviada pelo BotBot para o WhatsApp informado.' : 'O acesso foi criado, mas o BotBot recusou o envio da mensagem para esse número.'}</p>
      </>}
    </main></div>
  );
}
