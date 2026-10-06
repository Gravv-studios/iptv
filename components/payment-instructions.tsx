'use client';
import {useEffect, useState} from 'react';
import {Copy, ExternalLink} from 'lucide-react';
import type {PublicOrder} from '../lib/payments/types';

export function PaymentInstructions({instructions}: {instructions: PublicOrder['payment_instructions']}) {
  const [message,setMessage] = useState('');
  const [now,setNow] = useState(() => Date.now());
  const expiry = instructions?.expiresAt ? Date.parse(instructions.expiresAt) : NaN;
  useEffect(() => {
    if (!Number.isFinite(expiry) || now >= expiry) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, expiry - Date.now()) + 10, 2147483647));
    return () => clearTimeout(timer);
  }, [expiry, now]);
  if (!instructions) return null;
  if (Number.isFinite(expiry) && now >= expiry) return <section className="mp-instructions" aria-label="Instruções para pagar">
    <h2>{instructions.kind === 'pix' ? 'Prazo do Pix encerrado' : 'Prazo do boleto encerrado'}</h2>
    <p>Atualize o status do pedido abaixo para conferir a situação. Se você já pagou, aguarde a confirmação. Se precisar de ajuda, fale com o atendimento antes de iniciar outro pagamento.</p>
  </section>;
  const code = instructions.kind === 'pix' ? instructions.qrCode : instructions.barcode;
  return <section className="mp-instructions" aria-label="Instruções para pagar">
    <h2>{instructions.kind === 'pix' ? 'Seu Pix está pronto' : 'Seu boleto está pronto'}</h2>
    <p>{instructions.kind === 'pix' ? 'No aplicativo do seu banco, leia o QR Code ou use Pix Copia e Cola. Confira o valor e o recebedor antes de pagar.' : 'Abra o boleto para pagar. O pedido será atualizado após a confirmação do Mercado Pago.'}</p>
    {/* QR supplied by Mercado Pago, validated and restricted to PNG by the server. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {instructions.qrCodeBase64 && <img className="mp-qr" width={240} height={240} src={'data:image/png;base64,' + instructions.qrCodeBase64} alt="QR Code do Pix deste pedido"/>}
    {code && <><label className="mp-code-label">{instructions.kind === 'pix' ? 'Pix Copia e Cola' : 'Código do boleto'}<textarea readOnly rows={3} value={code} onFocus={event=>event.currentTarget.select()}/></label>
      <button className="ap-button" type="button" onClick={async()=>{try {await navigator.clipboard.writeText(code);setMessage('Código copiado. Abra o aplicativo do seu banco para pagar.');} catch {setMessage('Selecione o código acima e copie para o aplicativo do seu banco.');}}}><Copy size={17}/>{instructions.kind === 'pix' ? 'Copiar código Pix' : 'Copiar código do boleto'}</button></>}
    {instructions.ticketUrl && <a className="ap-trial-alternative" target="_blank" rel="noopener noreferrer" href={instructions.ticketUrl}>{instructions.kind === 'boleto' ? 'Abrir boleto' : 'Abrir pagamento Pix'}<ExternalLink size={15}/></a>}
    {instructions.expiresAt && <p className="ap-service-fine">Válido até {new Date(instructions.expiresAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} (horário de Brasília).</p>}
    <p role="status">{message}</p>
  </section>;
}
