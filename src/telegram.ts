const HEADER = "#07140d";

export function getTelegram() {
  return window.Telegram?.WebApp ?? null;
}

export function initTelegram() {
  const tg = getTelegram();
  if (!tg) return null;
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
  tg.setHeaderColor(HEADER);
  tg.setBackgroundColor(HEADER);
  return tg;
}

export function haptic(kind: "tap" | "win" | "error") {
  const haptic = getTelegram()?.HapticFeedback;
  if (!haptic) return;
  if (kind === "tap") haptic.impactOccurred("medium");
  if (kind === "win") haptic.notificationOccurred("success");
  if (kind === "error") haptic.notificationOccurred("error");
}

export function telegramUser() {
  const tg = getTelegram();
  const user = tg?.initDataUnsafe.user;
  const startParam =
    tg?.initDataUnsafe.start_param ||
    new URLSearchParams(window.location.search).get("tgWebAppStartParam") ||
    "";
  return {
    telegramId: user?.id ?? null,
    username: user?.username ?? "",
    firstName: user?.first_name ?? "",
    lastName: user?.last_name ?? "",
    initData: tg?.initData ?? "",
    startParam,
    inTelegram: Boolean(tg?.initData),
  };
}

export function openExternal(url: string) {
  const tg = getTelegram();
  if (tg) {
    tg.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openBot(start?: string) {
  const path = start ? `?start=${encodeURIComponent(start)}` : "";
  const url = `https://t.me/PlacarAI_bot${path}`;
  const tg = getTelegram() as { openTelegramLink?: (href: string) => void } | null;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
