'use client';
import {useState, type FormEvent} from 'react';
import {CardPayment} from '@mercadopago/sdk-react';
import {CreditCard, QrCode, ReceiptText} from 'lucide-react';

type Method = 'pix' | 'card' | 'boleto';
export default function MercadoPagoCheckout({amount, email, busy, onSubmit, onError}: {
  amount: number; email?: string; busy: boolean;
  onSubmit: (data: unknown) => Promise<unknown>; onError: () => void;
}) {
  const [method, setMethod] = useState<Method>('pix');
  const [documentType, setDocumentType] = useState('CPF'), [documentNumber, setDocumentNumber] = useState('');
  const [address, setAddress] = useState({zip_code:'',street_name:'',street_number:'',neighborhood:'',city:'',federal_unit:''});
  const [validation, setValidation] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const number = documentNumber.replace(/\D/g,'');
    if (number.length !== (documentType === 'CPF' ? 11 : 14)) {setValidation('Confira o número do seu documento.'); return;}
    setValidation('');
    try {
      await onSubmit({selectedPaymentMethod: method === 'pix' ? 'bank_transfer' : 'ticket', formData: {
        payment_method_id: method === 'pix' ? 'pix' : 'boleto',
        payer: {identification: {type:documentType,number}, ...(method === 'boleto' ? {address: {...address,zip_code:address.zip_code.replace(/\D/g,''),federal_unit:address.federal_unit.toUpperCase()}} : {})},
      }});
    } catch { /* The parent reconciles the order and presents a safe error. */ }
  }
  return <div className="mp-transparent">
    <h2>Como você prefere pagar?</h2>
    <fieldset className="mp-choice" disabled={busy}><legend className="mp-sr-only">Meio de pagamento</legend>
      {([{id:'pix',name:'Pix',Icon:QrCode},{id:'card',name:'Cartão',Icon:CreditCard},{id:'boleto',name:'Boleto',Icon:ReceiptText}] as const).map(({id,name,Icon}) => <label key={id} className={method === id ? 'selected' : ''}>
        <input type="radio" name="payment-method" checked={method === id} onChange={() => {setMethod(id);setValidation('');}}/><Icon size={20}/><span>{name}</span>
      </label>)}
    </fieldset>
    {method === 'card' ? <CardPayment initialization={{amount,...(email ? {payer:{email}} : {})}}
      customization={{visual:{style:{theme:'dark'}},paymentMethods:{maxInstallments:1,minInstallments:1}}}
      onSubmit={async (formData, additionalData) => {
        const type = additionalData?.paymentTypeId;
        if (!type || !['credit_card','debit_card','prepaid_card'].includes(type)) {onError(); throw new Error('Tipo de cartão não identificado.');}
        await onSubmit({selectedPaymentMethod:type === 'debit_card' ? 'debitCard' : type === 'prepaid_card' ? 'prepaidCard' : 'creditCard',formData:{...formData,paymentTypeId:type}});
      }} onError={onError}/> : <form className="mp-customer mp-payer" onSubmit={submit}>
        <p>{method === 'pix' ? 'Gere o QR Code ou copie o código para pagar pelo aplicativo do seu banco.' : 'Gere o boleto e pague no seu banco. A ativação aguarda a compensação.'}</p>
        <fieldset disabled={busy}>
          <label>Tipo de documento<select value={documentType} onChange={e => setDocumentType(e.target.value)}><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select></label>
          <label>{documentType} do pagador<input inputMode="numeric" autoComplete="off" required maxLength={18} value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}/></label>
          {method === 'boleto' && <div className="mp-billing-address"><h3>Endereço do pagador</h3>
            <label>CEP<input required autoComplete="postal-code" inputMode="numeric" maxLength={9} pattern="[0-9]{5}-?[0-9]{3}" value={address.zip_code} onChange={e=>setAddress({...address,zip_code:e.target.value})}/></label>
            <label>Rua ou avenida<input required autoComplete="address-line1" maxLength={150} value={address.street_name} onChange={e=>setAddress({...address,street_name:e.target.value})}/></label>
            <label>Número<input required maxLength={20} value={address.street_number} onChange={e=>setAddress({...address,street_number:e.target.value})}/></label>
            <label>Bairro<input required maxLength={100} value={address.neighborhood} onChange={e=>setAddress({...address,neighborhood:e.target.value})}/></label>
            <label>Cidade<input required autoComplete="address-level2" maxLength={100} value={address.city} onChange={e=>setAddress({...address,city:e.target.value})}/></label>
            <label>Estado (UF)<input required autoComplete="address-level1" pattern="[A-Za-z]{2}" minLength={2} maxLength={2} value={address.federal_unit} onChange={e=>setAddress({...address,federal_unit:e.target.value.toUpperCase()})} placeholder="MG"/></label>
          </div>}
          {validation && <p className="mp-error" role="alert">{validation}</p>}
          <button className="ap-button" type="submit" disabled={busy}>{busy ? 'Gerando pagamento…' : method === 'pix' ? 'Gerar meu Pix' : 'Gerar meu boleto'}</button>
        </fieldset>
        <p className="ap-service-fine">O documento é enviado ao Mercado Pago para processar o pagamento. Não é salvo no cadastro do site.</p>
      </form>}
  </div>;
}
