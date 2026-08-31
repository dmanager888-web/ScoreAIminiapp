import { BOT_USERNAME, LANGUAGE, PROMO_CODE } from "./prizes";
import { telegramUser } from "./telegram";

export type LeadPayload = {
  telegram_id: number | null;
  username: string;
  first_name: string;
  last_name: string;
  language: typeof LANGUAGE;
  bonus_id: string;
  bonus_label: string;
  promo_code: typeof PROMO_CODE;
  initData: string;
  bot: typeof BOT_USERNAME;
  sub1: string;
  referrer_id: string;
};

export type WebhookResponse = {
  ok?: boolean;
  success?: boolean;
  offerUrl?: string;
  url?: string;
  redirectUrl?: string;
  affiliateUrl?: string;
  message?: string;
};

function webhookUrl() {
  return import.meta.env.VITE_WEBHOOK_URL?.trim() ?? "";
}

function baseOfferUrl() {
  return (
    import.meta.env.VITE_OFFER_URL?.trim() ||
    import.meta.env.VITE_FALLBACK_OFFER_URL?.trim() ||
    "https://1whqyu.com/betting?open=register&p=nhsh"
  );
}

export function withSub1(url: string, telegramId: number | null) {
  if (!url || !telegramId) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("sub1", String(telegramId));
    return parsed.toString();
  } catch {
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}sub1=${telegramId}`;
  }
}

export function buildLead(input: {
  bonusId: string;
  bonusLabel: string;
  referrerId: string;
}): LeadPayload {
  const user = telegramUser();
  const sub1 = user.telegramId ? String(user.telegramId) : "";
  return {
    telegram_id: user.telegramId,
    username: user.username,
    first_name: user.firstName,
    last_name: user.lastName,
    language: LANGUAGE,
    bonus_id: input.bonusId,
    bonus_label: input.bonusLabel,
    promo_code: PROMO_CODE,
    initData: user.initData,
    bot: BOT_USERNAME,
    sub1,
    referrer_id: input.referrerId,
  };
}

export function pickOfferUrl(data: WebhookResponse | null, telegramId: number | null) {
  const fromWebhook =
    data?.offerUrl || data?.url || data?.redirectUrl || data?.affiliateUrl || "";
  return withSub1(fromWebhook || baseOfferUrl(), telegramId);
}

export async function creditPostback(sub1: string) {
  const response = await fetch(`/api/postback?sub1=${encodeURIComponent(sub1)}`);
  if (!response.ok) {
    throw new Error("Postback recusado. Tente de novo pelo Telegram.");
  }
}

export async function submitLead(payload: LeadPayload) {
  const url = webhookUrl();
  if (!url) {
    if (import.meta.env.DEV) {
      return { ok: true } satisfies WebhookResponse;
    }
    return { ok: true } satisfies WebhookResponse;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook respondeu ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: true } satisfies WebhookResponse;
  }

  return (await response.json()) as WebhookResponse;
}
