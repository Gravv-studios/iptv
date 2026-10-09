import type {Metadata} from 'next';
import DeliveryPreview from './delivery-preview';

export const metadata: Metadata = {title: 'Simulação de entrega · Aperte Play', robots: {index: false, follow: false}};
export default function Page() { return <DeliveryPreview/>; }
