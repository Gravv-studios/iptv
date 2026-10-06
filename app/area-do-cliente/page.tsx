import Portal from '../portal';
import {requireChatGPTUser} from '../chatgpt-auth';
import {isVercelHosted} from '../../lib/hosting';
import PublicCustomerArea from './public-customer-area';
export const dynamic='force-dynamic';
export const metadata={title:'Minha conta · Aperte Play'};
export default async function CustomerArea(){if(isVercelHosted)return <PublicCustomerArea/>;await requireChatGPTUser('/area-do-cliente');return <Portal/>;}
