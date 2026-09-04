import { BOT_USERNAME } from "./prizes";

const HEADER = "#000000";

export function getTelegram() {
  return window.Telegram?.WebApp ?? null;
}

function applySafeArea(tg: NonNullable<ReturnType<typeof getTelegram>>) {
  const bottom = Math.max(
    Number(tg.safeAreaInset?.bottom) || 0,
    Number(tg.contentSafeAreaInset?.bottom) || 0,
    16,
  );
  document.documentElement.style.setProperty("--safe-bottom", `${bottom}px`);
}

export function initTelegram() {
  const tg = getTelegram();
  if (!tg) return null;
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
  tg.setHeaderColor(HEADER);
  tg.setBackgroundColor(HEADER);
  applySafeArea(tg);
  const sync = () => applySafeArea(tg);
  tg.onEvent?.("viewportChanged", sync);
  tg.onEvent?.("safeAreaChanged", sync);
  tg.onEvent?.("contentSafeAreaChanged", sync);
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
    languageCode: user?.language_code ?? "",
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

export function openTelegramUrl(url: string) {
  const tg = getTelegram() as { openTelegramLink?: (href: string) => void } | null;
  if (/^https?:\/\/t\.me\//i.test(url) && tg?.openTelegramLink) {
    tg.openTelegramLink(url);
    return;
  }
  openExternal(url);
}

export function openBot(start?: string) {
  const path = start ? `?start=${encodeURIComponent(start)}` : "";
  const url = `https://t.me/${BOT_USERNAME}${path}`;
  const tg = getTelegram() as { openTelegramLink?: (href: string) => void } | null;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
