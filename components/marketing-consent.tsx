'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {consentKey,loadPixel,trackMeta,captureCampaignAttribution,clearCampaignAttribution} from '../lib/meta-browser';
export default function MarketingConsent({pixelId}:{pixelId:string}) {
  const [choice,setChoice]=useState<string|null>('loading');
  const [error,setError]=useState('');
  const pathname=usePathname();
  useEffect(()=>{const frame=requestAnimationFrame(()=>{try {setChoice(localStorage.getItem(consentKey));} catch {setChoice(null);}});return()=>cancelAnimationFrame(frame);},[]);
  useEffect(()=>{if(choice==='accepted'){captureCampaignAttribution(); loadPixel(pixelId); trackMeta('PageView');}},[choice,pixelId,pathname]);
  async function choose(value:string){
    setError('');
    if(value==='rejected') {
      try {localStorage.setItem(consentKey,value);} catch {}
      window.fbq?.('consent','revoke');
      clearCampaignAttribution();
      for(const key of ['_fbp','_fbc']) for(const domain of ['',`; Domain=${location.hostname}`, '; Domain=.aperteoplayiptv.com.br']) document.cookie=`${key}=; Max-Age=0; Path=/${domain}`;
      try {const response=await fetch('/api/checkout/privacy',{method:'POST'});if(!response.ok)throw new Error();}
      catch {setError('A medição neste navegador foi interrompida. Não conseguimos atualizar seus pedidos agora; tente recusar novamente.');return;}
    } else {try {localStorage.setItem(consentKey,value);} catch {} window.fbq?.('consent','grant');}
    setChoice(value);
  }
  if(!pixelId || choice==='loading') return null;
  return <><button type="button" onClick={()=>setChoice(null)} style={{position:'fixed',bottom:8,left:8,zIndex:70,fontSize:12,background:'#151719',color:'#fff',padding:8,borderRadius:8}}>Privacidade</button>{choice===null && <section role="dialog" aria-label="Preferências de medição" style={{position:'fixed',bottom:12,left:12,right:12,maxWidth:640,zIndex:1000,padding:20,borderRadius:16,background:'#151719',color:'#fff',border:'1px solid #505050',boxShadow:'0 8px 30px #0008'}}>
    <strong>Você escolhe como medimos nossos anúncios</strong><p style={{fontSize:14,margin:'10px 0'}}>Com sua permissão, usamos cookies da Meta e enviamos informações de navegação e compras, valor, e-mail e telefone transformados em códigos de correspondência para medir anúncios no Facebook e Instagram. Você pode recusar e comprar normalmente ou mudar sua escolha em Privacidade. <a href="/privacidade" style={{textDecoration:'underline'}}>Saiba mais</a>.</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button type="button" onClick={()=>choose('rejected')} style={{padding:12,border:'1px solid #aaa',borderRadius:8}}>Recusar opcionais</button><button type="button" onClick={()=>choose('accepted')} style={{padding:12,background:'#00d471',color:'#001d0f',borderRadius:8}}>Aceitar medição</button></div>
    {error && <p role="alert">{error}</p>}
  </section>}</>;
}
