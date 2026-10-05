import Portal from '../portal';
import {requireChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export const metadata={title:'Minha conta · Aperte Play'};
export default async function CustomerArea(){await requireChatGPTUser('/area-do-cliente');return <Portal/>;}
