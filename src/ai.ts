import { STARTER_PREDICTION } from "./prizes";
import { telegramUser } from "./telegram";

export type AiPick = {
  league: string;
  match: string;
  pick: string;
  confidence: string;
  source: "api" | "demo";
};

type RawPick = {
  league?: string;
  match?: string;
  pick?: string;
  tip?: string;
  confidence?: string;
  remaining?: number;
};

export async function loadGiftPick(): Promise<AiPick> {
  const user = telegramUser();
  try {
    const response = await fetch("/api/ai/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_id: user.telegramId,
        initData: user.initData,
        language: "pt-BR",
        kind: "gift",
      }),
    });
    if (!response.ok) {
      return { ...STARTER_PREDICTION, source: "demo" };
    }
    const data = (await response.json()) as RawPick;
    const pick = data.pick || data.tip;
    if (!data.match || !pick) {
      return { ...STARTER_PREDICTION, source: "demo" };
    }
    return {
      league: data.league || "Placar.AI",
      match: data.match,
      pick,
      confidence: data.confidence || "—",
      source: "api",
    };
  } catch {
    return { ...STARTER_PREDICTION, source: "demo" };
  }
}
