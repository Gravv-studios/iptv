// Commercial offer supplied by the client on 03/10/2026.
export const trialHours = 5;
export const whatsappNumber = '5533984622431';
export const whatsappDisplay = '(33) 98462-2431';
export const trialMessage = `Olá! Quero solicitar o teste grátis de ${trialHours} horas da Aperte Play. Pode me orientar para configurar no meu aparelho?`;
export const trialUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(trialMessage)}`;

export type TrialDevice = 'tv' | 'mobile' | 'computer';

export function trialUrlForDevice(device: TrialDevice | null = null) {
  if (!device) return trialUrl;
  const screens: Record<TrialDevice, string> = {
    tv: 'na minha Smart TV',
    mobile: 'no meu celular ou tablet',
    computer: 'no meu computador',
  };
  const message = `Olá! Quero solicitar o teste grátis de ${trialHours} horas da Aperte Play para assistir ${screens[device]}. Pode confirmar a compatibilidade e me ajudar a configurar?`;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}
