'use client';

import {useState} from 'react';
import Link from 'next/link';
import {marketingConsent} from '../../lib/meta-browser';

export default function MetaDiagnostics() {
  const [report, setReport] = useState('Clique em Verificar depois de aceitar a medição em Privacidade.');
  function inspect() {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const meta = resources.filter(entry => {
      const host = new URL(entry.name).hostname;
      return host === 'connect.facebook.net' || host === 'www.facebook.com';
    });
    setReport(JSON.stringify({
      consentimento: marketingConsent(),
      pixelPresente: !!window.fbq,
      pixelInicializado: typeof window.fbq?.callMethod === 'function',
      comandosPendentes: window.fbq?.queue?.length ?? 0,
      recursos: meta.map(entry => ({
        caminho: new URL(entry.name).origin + new URL(entry.name).pathname,
        tipo: entry.initiatorType,
        duracaoMs: Math.round(entry.duration),
        statusHTTP: entry.responseStatus || 'Não exposto pelo navegador',
      })),
    }, null, 2));
  }
  return <main style={{maxWidth:900,margin:'40px auto',padding:24,color:'#fff'}}>
    <h1>Diagnóstico da medição</h1>
    <p>Esta tela verifica apenas o carregamento neste navegador. O recebimento precisa ser confirmado no Gerenciador de Eventos da Meta. Não gera compras nem contorna bloqueadores.</p>
    <button onClick={inspect} style={{padding:12,background:'#00d471',color:'#001d0f',borderRadius:8}}>Verificar</button>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',margin:'20px 0'}}>{report}</pre>
    <Link href="/">Voltar ao site</Link>
  </main>;
}
