export const LANGUAGE = "pt-BR";
export const BRAND = "Score AI";
export const BOT_USERNAME = "GenScoreAi_bot";
export const PROMO_CODE = "Score55";
export const BONUS_LABEL = "500%";
export const AI_PICKS_REGISTER = 10;

export const PRIZES = Array.from({ length: 8 }, (_, index) => ({
  id: `bonus-500-${index}`,
  label: BONUS_LABEL,
  color: index % 2 === 0 ? "#1f8a4c" : "#d4af37",
}));

export const STARTER_PREDICTION = {
  league: "Brasileirão",
  match: "Palmeiras vs Flamengo",
  pick: "Mais de 1.5 gols",
  confidence: "78%",
};

export function inviteLink(telegramId: number | string) {
  return `https://t.me/${BOT_USERNAME}?start=ref_${telegramId}`;
}

export function parseReferrer(startParam: string) {
  const match = startParam.trim().match(/^ref[_-]?(\d+)$/i);
  return match ? match[1] : "";
}
