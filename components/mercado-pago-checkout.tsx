'use client';
import {type ComponentProps} from 'react';
import {Payment, StatusScreen} from '@mercadopago/sdk-react';

type SubmitData = Parameters<ComponentProps<typeof Payment>['onSubmit']>[0];
export default function MercadoPagoCheckout({amount, email, paymentId, onSubmit, onError}: {
  amount: number; email?: string; paymentId?: string | null;
  onSubmit: (data: SubmitData) => Promise<unknown>; onError: () => void;
}) {
  if (paymentId) return <StatusScreen initialization={{paymentId}} customization={{visual: {style: {theme: 'dark'}}}} onError={onError}/>;
  return <Payment initialization={{amount, ...(email ? {payer: {email}} : {})}}
    customization={{visual: {style: {theme: 'dark'}}, paymentMethods: {bankTransfer: 'all', creditCard: 'all', debitCard: 'all', prepaidCard: 'all', ticket: 'all', maxInstallments: 1}}}
    onSubmit={onSubmit} onError={onError}/>;
}
