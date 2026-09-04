import { useEffect, useMemo, useState } from "react";
import { loadSaldo, requestPick } from "./ai";
import { buildLead, pickOfferUrl, submitLead } from "./api";
import { fileToPayload } from "./image";
import { LANGS, detectLang, isLang, isRtl, t, type Lang } from "./i18n";
import {
  AI_PICKS_REGISTER,
  BONUS_LABEL,
  BOT_USERNAME,
  BRAND,
  inviteLink,
  MATCH_EXAMPLE,
  parseReferrer,
  PRIZES,
  PROMO_CODE,
  STARTER_PREDICTION,
} from "./prizes";
import { haptic, openExternal, telegramUser } from "./telegram";
import Wheel from "./Wheel";

type Step = "gift" | "wheel" | "win" | "pending" | "invite" | "ask";
type Flag = "gift" | "spin" | "registered" | "credits_done";

function storageKey(kind: Flag | "referrer", telegramId: number | null) {
  return `placar_${kind}_${telegramId ?? "anon"}`;
}

function savedReferrer(telegramId: number | null, startParam: string) {
  const incoming = parseReferrer(startParam);
  const key = storageKey("referrer", telegramId);
  if (incoming && incoming !== String(telegramId ?? "")) {
    localStorage.setItem(key, incoming);
    return incoming;
  }
  return localStorage.getItem(key) || "";
}

function rotationFor(extraTurns = 6) {
  const slice = 360 / PRIZES.length;
  return extraTurns * 360 + 360 - slice / 2;
}

function initialStep(telegramId: number | null): Step {
  if (localStorage.getItem(storageKey("credits_done", telegramId)) === "1") return "invite";
  if (localStorage.getItem(storageKey("registered", telegramId)) === "1") return "pending";
  if (localStorage.getItem(storageKey("spin", telegramId)) === "1") return "win";
  if (localStorage.getItem(storageKey("gift", telegramId)) === "1") return "wheel";
  return "gift";
}

export default function App() {
  const user = useMemo(() => telegramUser(), []);
  const referrerId = savedReferrer(user.telegramId, user.startParam);
  const alreadySpun = localStorage.getItem(storageKey("spin", user.telegramId)) === "1";
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("placar_lang");
    if (isLang(saved)) return saved;
    return detectLang(user.languageCode);
  });

  const [step, setStep] = useState<Step>(() => initialStep(user.telegramId));
  const [askBack, setAskBack] = useState<Step>("gift");
  const [accepted, setAccepted] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spun, setSpun] = useState(alreadySpun);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [matchText, setMatchText] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [answer, setAnswer] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [registered, setRegistered] = useState(false);
  const [asking, setAsking] = useState(false);
  const [checking, setChecking] = useState(false);

  const shareUrl = user.telegramId ? inviteLink(user.telegramId) : "";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
        const value = await loadSaldo();
        if (cancelled) return;
        setCredits(value.credits);
        setRegistered(value.registered);
        if (value.registered && value.credits > 0 && step === "pending") {
          haptic("win");
          setAskBack("pending");
          setStep("ask");
        }
      } catch {
        if (!cancelled) setCredits(null);
      }
    }

    void pull();
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const timer = step === "pending" ? window.setInterval(() => void pull(), 4000) : 0;
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (timer) window.clearInterval(timer);
    };
  }, [step]);

  function chooseLang(next: Lang) {
    setLang(next);
    localStorage.setItem("placar_lang", next);
  }

  function tx(key: string, vars: Record<string, string | number> = {}) {
    return t(lang, key, vars);
  }

  function openAsk() {
    setError("");
    setAskBack(step === "ask" ? askBack : step);
    haptic("tap");
    setStep("ask");
  }

  function claimGift() {
    localStorage.setItem(storageKey("gift", user.telegramId), "1");
    haptic("win");
    setStep("wheel");
  }

  function spin() {
    if (spinning || spun) return;
    if (!accepted) {
      setError(tx("ageError"));
      haptic("error");
      return;
    }
    setError("");
    haptic("tap");
    setSpinning(true);
    setRotation((current) => current + rotationFor());
    window.setTimeout(() => {
      localStorage.setItem(storageKey("spin", user.telegramId), "1");
      setSpinning(false);
      setSpun(true);
      haptic("win");
      setStep("win");
    }, 4200);
  }

  async function register() {
    setError("");
    setSending(true);
    try {
      if (!user.telegramId) {
        throw new Error(tx("needTelegram"));
      }
      const payload = buildLead({
        bonusId: "bonus-500",
        bonusLabel: BONUS_LABEL,
        referrerId,
      });
      const response = await submitLead(payload);
      const url = pickOfferUrl(response, user.telegramId, referrerId);
      if (!url) {
        throw new Error(tx("noOffer"));
      }
      openExternal(url);
      localStorage.setItem(storageKey("registered", user.telegramId), "1");
      haptic("tap");
      setStep("pending");
    } catch (err) {
      haptic("error");
      setError(err instanceof Error ? err.message : tx("failRegister"));
    } finally {
      setSending(false);
    }
  }

  async function checkRegistration() {
    setChecking(true);
    setError("");
    try {
      const value = await loadSaldo();
      setCredits(value.credits);
      setRegistered(value.registered);
      if (value.registered && value.credits > 0) {
        haptic("win");
        setAskBack("pending");
        setStep("ask");
        return;
      }
      if (value.credits > 0) {
        setError(tx("pendingWait"));
        return;
      }
      setError(
        tx("pendingNone"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : tx("failSaldo"));
    } finally {
      setChecking(false);
    }
  }

  async function copyInvite() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      haptic("tap");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(tx("failCopy"));
    }
  }

  function onPhoto(file: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (!file) {
      setPhotoFile(null);
      setPhotoName("");
      setPhotoPreview("");
      return;
    }
    setPhotoFile(file);
    setPhotoName(file.name);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function ask() {
    const text = matchText.trim();
    if (!photoFile && text.length < 3) {
      setError(tx("needInput"));
      haptic("error");
      return;
    }
    setError("");
    setAsking(true);
    try {
      const image = photoFile ? await fileToPayload(photoFile) : undefined;
      const result = await requestPick(text, image, lang);
      setCredits(result.credits);
      if ("registered" in result && result.registered) {
        setRegistered(true);
      }
      if (!result.ok) {
        haptic("error");
        setError(
          result.registered || registered
            ? tx("noCreditsReg")
            : tx("noCreditsWait", { code: PROMO_CODE, n: AI_PICKS_REGISTER }),
        );
        return;
      }
      setAnswer(result.answer);
      haptic("win");
    } catch (err) {
      haptic("error");
      setError(err instanceof Error ? err.message : tx("failAsk"));
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="app">
      <header className="nav">
        <p className="nav-caption">@{BOT_USERNAME}</p>
        <label className="lang-select">
          <select
            value={lang}
            aria-label="Language"
            onChange={(event) => {
              if (isLang(event.target.value)) chooseLang(event.target.value);
            }}
          >
            {LANGS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} · {item.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="large-title">
        <h1>{BRAND}</h1>
        {user.firstName ? (
          <p className="hello">{tx("hello", { name: user.firstName })}</p>
        ) : (
          <p className="hello muted">{tx("openTelegram")}</p>
        )}
      </div>

      {step === "gift" && (
        <section className="card">
          <p className="kicker">{tx("giftKicker")}</p>
          <h2>{tx("giftTitle")}</h2>
          <div className="prediction">
            <p className="kicker">{STARTER_PREDICTION.league}</p>
            <p className="match">{STARTER_PREDICTION.match}</p>
            <p className="pick">{STARTER_PREDICTION.pick}</p>
            <p className="copy">{tx("giftDemo", { n: STARTER_PREDICTION.confidence })}</p>
          </div>
          <p className="copy">{tx("giftCopy", { n: AI_PICKS_REGISTER })}</p>
          <div className="actions">
            <button className="cta" type="button" onClick={claimGift}>
              {tx("spinWheel")}
            </button>
            <button className="cta secondary" type="button" onClick={openAsk}>
              {tx("askNow")}
            </button>
          </div>
        </section>
      )}

      {step === "wheel" && (
        <section className="card wheel-card">
          <p className="kicker">{tx("wheelKicker")}</p>
          <h2>{tx("wheelTitle")}</h2>
          <Wheel rotation={rotation} spinning={spinning} />
          <label className="ios-switch">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span className="ios-switch-ui" aria-hidden="true" />
            <span>{tx("age")}</span>
          </label>
          {error ? <p className="error">{error}</p> : null}
          <div className="actions">
            <button className="cta" type="button" disabled={spinning || spun} onClick={spin}>
              {spun ? tx("used") : spinning ? tx("spinning") : tx("spinOnce")}
            </button>
            <button className="cta secondary" type="button" onClick={openAsk}>
              {tx("askPick")}
            </button>
          </div>
        </section>
      )}

      {step === "win" && (
        <section className="card">
          <p className="kicker">{tx("youWon")}</p>
          <h2>{tx("bonusTitle", { n: BONUS_LABEL })}</h2>
          <p className="promo">
            {tx("promo")} <strong>{PROMO_CODE}</strong>
          </p>
          <p className="copy">{tx("winCopy", { n: AI_PICKS_REGISTER })}</p>
          {error ? <p className="error">{error}</p> : null}
          <div className="actions">
            <button className="cta" type="button" disabled={sending} onClick={register}>
              {sending ? tx("opening") : tx("register")}
            </button>
            <button className="cta secondary" type="button" onClick={openAsk}>
              {tx("askPick")}
            </button>
          </div>
        </section>
      )}

      {step === "pending" && (
        <section className="card">
          <p className="kicker">{tx("youWon")}</p>
          <h2>{tx("bonusTitle", { n: BONUS_LABEL })}</h2>
          <p className="promo">
            {tx("promo")} <strong>{PROMO_CODE}</strong>
          </p>
          <p className="copy">{tx("pendingCopy", { n: AI_PICKS_REGISTER, code: PROMO_CODE })}</p>
          {error ? <p className="error">{error}</p> : null}
          <div className="actions">
            <button className="cta" type="button" disabled={sending} onClick={register}>
              {sending ? tx("opening") : tx("register")}
            </button>
            <button className="cta secondary" type="button" disabled={checking} onClick={() => void checkRegistration()}>
              {checking ? tx("checking") : tx("alreadyReg")}
            </button>
            <button className="cta secondary" type="button" onClick={openAsk}>
              {tx("askPick")}
            </button>
          </div>
        </section>
      )}

      {step === "ask" && (
        <section className="card">
          <p className="kicker">{tx("askKicker")}</p>
          <h2>{tx("askTitle")}</h2>
          <p className="copy">
            {registered ? tx("askAfter") : tx("askBefore", { n: AI_PICKS_REGISTER })}
          </p>
          <label className="field">
            {tx("matchLabel")}
            <textarea
              rows={3}
              value={matchText}
              onChange={(event) => setMatchText(event.target.value)}
              placeholder={MATCH_EXAMPLE}
            />
          </label>
          <label className="file-btn">
            {photoName || tx("choosePrint")}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => onPhoto(event.target.files?.[0] ?? null)}
            />
          </label>
          {photoPreview ? <img className="photo-preview" src={photoPreview} alt="" /> : null}
          {error ? <p className="error">{error}</p> : null}
          {answer ? <p className="prediction pick-answer">{answer}</p> : null}
          <div className="actions">
            <button className="cta" type="button" disabled={asking} onClick={() => void ask()}>
              {asking ? tx("analyzing") : tx("askPick")}
            </button>
            {credits === 0 ? (
              <button className="cta secondary" type="button" disabled={sending} onClick={register}>
                {tx("register")}
              </button>
            ) : null}
            <button
              className="cta secondary"
              type="button"
              onClick={() => {
                setError("");
                setStep(askBack);
              }}
            >
              {tx("back")}
            </button>
          </div>
        </section>
      )}

      {step === "invite" && (
        <section className="card">
          <p className="kicker">{tx("inviteKicker")}</p>
          <h2>{tx("inviteTitle")}</h2>
          <p className="copy">{tx("inviteCopy", { code: PROMO_CODE })}</p>
          {shareUrl ? <code className="invite-link">{shareUrl}</code> : <p className="error">{tx("inviteNeedTg")}</p>}
          <div className="actions">
            {shareUrl ? (
              <button className="cta" type="button" onClick={copyInvite}>
                {copied ? tx("copied") : tx("copyInvite")}
              </button>
            ) : null}
            <button className="cta secondary" type="button" disabled={sending} onClick={register}>
              {tx("register")}
            </button>
          </div>
        </section>
      )}

      <p className="legal">{tx("legal")}</p>

      <div className="saldo-bar">
        <p>
          💎 {tx("saldo")}: <strong>{credits === null ? "—" : credits}</strong> {tx("picks")}
        </p>
        {step !== "ask" ? (
          <button type="button" onClick={openAsk}>
            {tx("askPick")}
          </button>
        ) : null}
      </div>
    </main>
  );
}
