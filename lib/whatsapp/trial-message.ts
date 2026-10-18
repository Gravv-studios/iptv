export type TrialAccess={id:string;whatsapp?:string;username?:string;password?:string;created_at?:string;expires_at?:string;connections?:number;m3u_url?:string;m3u_url_short?:string;renew_url?:string};
const date=(value:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'}).format(new Date(value));
export function trialMessage(c:TrialAccess,paymentLink:string) {
  if(!c.username||!c.password||!c.expires_at||!c.m3u_url) throw new Error('trial_response_incomplete');
  const m3u=new URL(c.m3u_url);
  if(!['http:','https:'].includes(m3u.protocol)) throw new Error('invalid_playlist_url');
  const hls=new URL(m3u);
  hls.searchParams.set('output','hls');
  const login=`✅ *Usuário:* ${c.username}\n✅ *Senha:* ${c.password}`;
  const lists=[`◾ *M3U completo:*\n${m3u.href}`];
  if(c.m3u_url_short) {
    const short=new URL(c.m3u_url_short);
    if(['http:','https:'].includes(short.protocol)) lists.push(`◾ *M3U curto:*\n${short.href}`);
  }
  lists.push(`◾ *HLS:*\n${hls.href}`);
  // Only derive supplier short variants from the exact documented credential path.
  if(c.m3u_url_short) {
    const short=new URL(c.m3u_url_short);
    const expected=`/p/${encodeURIComponent(c.username)}/${encodeURIComponent(c.password)}/m3u`;
    if(['http:','https:'].includes(short.protocol)&&short.pathname===expected&&!short.search&&!short.hash) {
      for(const [label,suffix] of [['HLS curto','hls'],['SSIPTV','ssiptv']]) {
        const variant=new URL(short);variant.pathname=short.pathname.replace(/m3u$/,suffix);
        lists.push(`◾ *${label}:*\n${variant.href}`);
      }
    }
  }
  return `📺 *SEJA BEM-VINDO À APERTE PLAY!* 💚💛

📌 *Seu teste grátis está liberado.*

${login}

📦 *Plano:* Teste completo sem adultos
💵 *Valor do teste:* R$ 0,00${c.created_at?`\n🗓️ *Criado em:* ${date(c.created_at)}`:''}
⏰ *Vencimento:* ${date(c.expires_at)} (Brasília)${Number.isInteger(c.connections)&&c.connections!>0?`\n📶 *Conexões:* ${c.connections}`:''}

🌎 *DNS / URL do servidor:* ${m3u.origin}

📲 *ESCOLHA O APLICATIVO DO SEU APARELHO*
Você só precisa instalar um dos aplicativos compatíveis.

🌟 *LOTUS*
Roku TV, Samsung, LG, MacOS, Android TV e Microsoft Store.
🔢 *Código: 2060*
${login}

🌟 *RX PURPLE*
LG, Roku, Play Store e Windows.
🔢 *Código: 85304368*
${login}

🌟 *ZINK PLAYER*
Play Store, Fire TV e Roku.
${login}
▶️ Play Store: pesquise *ZINK PLAYER*.
🔥 Fire TV: pesquise *ZINK*.
📥 NTDown: *48753*
https://dl.ntdev.in/48753
📥 Downloader: *4428351*
http://aftv.news/4428351

🌟 *ZINK PLAYER PRO — Android*
${login}
▶️ Play Store: pesquise *ZINK PLAYER PRO*.
📥 Downloader: *3228791*
http://aftv.news/3228791
📥 NTDown: *91728*
https://dl.ntdev.in/91728

📺 *PRIME IBO — TVs Android*
📥 Downloader: *6977521*
http://aftv.news/6977521

🔗 *LISTAS PARA CONFIGURAÇÃO*
Use se o aplicativo pedir uma playlist. Esses links contêm seu acesso; não compartilhe.

${lists.join('\n\n')}

💳 *GOSTOU? CONTINUE COM A APERTE PLAY*
Abra seu link exclusivo no nosso site para acessar o pagamento:
${paymentLink}

Após a confirmação, seu acesso continua com o mesmo usuário e senha.

🛟 *Precisa de ajuda?*
Responda *ajuda* e diga a marca da TV e o aplicativo que está usando.

🎁 O teste grátis é liberado uma única vez por contato.
*Aperte Play — seu plano, no seu ritmo.* 💚💛`;
}
