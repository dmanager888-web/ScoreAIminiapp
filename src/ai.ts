import { telegramUser } from "./telegram";
import type { ImagePayload } from "./image";

export async function loadSaldo() {
  const user = telegramUser();
  const response = await fetch("/api/ai/saldo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: user.initData }),
  });
  const data = (await response.json()) as {
    ok?: boolean;
    credits?: number;
    registered?: boolean;
    error?: string;
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.error === "auth" ? "Abra o Mini App pelo Telegram." : "Não foi possível ler o saldo.");
  }
  return { credits: data.credits ?? 0, registered: Boolean(data.registered) };
}

export async function requestPick(text: string, image?: ImagePayload) {
  const user = telegramUser();
  const response = await fetch("/api/ai/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      initData: user.initData,
      text,
      image,
    }),
  });
  const data = (await response.json()) as {
    ok?: boolean;
    answer?: string;
    credits?: number;
    error?: string;
    registered?: boolean;
  };
  if (response.status === 402 || data.error === "no_credits") {
    return {
      ok: false as const,
      error: "no_credits",
      credits: 0,
      answer: "",
      registered: Boolean(data.registered),
    };
  }
  if (response.status === 401 || data.error === "auth") {
    throw new Error("Abra o Mini App pelo Telegram para pedir palpite.");
  }
  if (!response.ok || !data.ok || !data.answer) {
    throw new Error("A IA não respondeu. Tente de novo em instantes.");
  }
  return { ok: true as const, answer: data.answer, credits: data.credits ?? 0, error: "" };
}

