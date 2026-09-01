import { useEffect, useMemo, useState } from "react";
import { loadSaldo, requestPick } from "./ai";
import { buildLead, pickOfferUrl, submitLead } from "./api";
import { fileToPayload } from "./image";
import {
  AI_PICKS_REGISTER,
  BONUS_LABEL,
  BOT_USERNAME,
  BRAND,
  inviteLink,
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

  function openAsk() {
    setError("");
    setAskBack(step === "ask" ? askBack : step);
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
      setError("Confirme que você tem 18+ para continuar.");
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
        throw new Error("Abra o Mini App pelo Telegram para continuar.");
      }
      const payload = buildLead({
        bonusId: "bonus-500",
        bonusLabel: BONUS_LABEL,
        referrerId,
      });
      const response = await submitLead(payload);
      const url = pickOfferUrl(response, user.telegramId, referrerId);
      if (!url) {
        throw new Error("Link de cadastro ainda não configurado.");
      }
      openExternal(url);
      localStorage.setItem(storageKey("registered", user.telegramId), "1");
      haptic("tap");
      setStep("pending");
    } catch (err) {
      haptic("error");
      setError(err instanceof Error ? err.message : "Falha ao abrir o cadastro.");
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
        setError("O cadastro ainda não foi confirmado. Você ainda pode usar o palpite grátis.");
        return;
      }
      setError(
        "Ainda não chegou a confirmação. Termine o cadastro com o promocode e volte em 1 minuto.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível checar o saldo.");
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
      setError("Não foi possível copiar. Envie o link manualmente.");
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
      setError("Escreva o jogo ou envie um print.");
      haptic("error");
      return;
    }
    setError("");
    setAsking(true);
    try {
      const image = photoFile ? await fileToPayload(photoFile) : undefined;
      const result = await requestPick(text, image);
      setCredits(result.credits);
      if ("registered" in result && result.registered) {
        setRegistered(true);
      }
      if (!result.ok) {
        haptic("error");
        setError(
          result.registered || registered
            ? "Saldo zerado. Indique um amigo para ganhar +10."
            : `Cadastro ainda não confirmado. Use o promocode ${PROMO_CODE} e aguarde a liberação dos ${AI_PICKS_REGISTER} palpites.`,
        );
        return;
      }
      setAnswer(result.answer);
      haptic("win");
    } catch (err) {
      haptic("error");
      setError(err instanceof Error ? err.message : "Falha ao pedir palpite.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="app">
      <header className="top">
        <p className="eyebrow">@{BOT_USERNAME}</p>
        <h1>{BRAND}</h1>
        {user.firstName ? (
          <p className="hello">Olá, {user.firstName} 👋</p>
        ) : (
          <p className="hello muted">Abra pelo Telegram para identificar sua conta.</p>
        )}
      </header>

      {step === "gift" && (
        <section className="card">
          <p className="kicker">Presente imediato</p>
          <h2>1 palpite de IA liberado</h2>
          <div className="prediction">
            <p className="kicker">{STARTER_PREDICTION.league}</p>
            <p className="match">{STARTER_PREDICTION.match}</p>
            <p className="pick">{STARTER_PREDICTION.pick}</p>
            <p className="copy">Confiança da IA: {STARTER_PREDICTION.confidence} · exemplo</p>
          </div>
          <p className="copy">
            Você tem <strong>1 palpite grátis</strong> agora: texto ou print. Os próximos{" "}
            <strong>{AI_PICKS_REGISTER} palpites</strong> entram só depois do cadastro confirmado.
          </p>
          <button className="cta" type="button" onClick={claimGift}>
            <span className="wheel-icon" aria-hidden="true">
              🎡
            </span>
            Girar a roleta
          </button>
          <button className="cta secondary" type="button" onClick={openAsk}>
            Pedir palpite agora
          </button>
        </section>
      )}

      {step === "wheel" && (
        <section className="card wheel-card">
          <p className="kicker">Roleta da sorte</p>
          <h2>Gire e ganhe</h2>
          <Wheel rotation={rotation} spinning={spinning} />
          <label className="check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            Tenho 18+ e aceito a oferta.
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="cta" type="button" disabled={spinning || spun} onClick={spin}>
            {spun ? (
              "Já usado"
            ) : (
              <>
                <span className="wheel-icon" aria-hidden="true">
                  🎡
                </span>
                {spinning ? "Girando..." : "Girar 1 vez"}
              </>
            )}
          </button>
          <button className="cta secondary" type="button" onClick={openAsk}>
            Pedir palpite
          </button>
        </section>
      )}

      {step === "win" && (
        <section className="card">
          <p className="kicker">Você ganhou</p>
          <h2>Bônus {BONUS_LABEL}</h2>
          <p className="promo">
            Promocode <strong>{PROMO_CODE}</strong>
          </p>
          <p className="copy">
            Para usar o bônus de 500%, cadastre-se e aplique o promocode. Antes disso você tem{" "}
            <strong>1 palpite grátis</strong>. Depois do registro confirmado entram mais{" "}
            <strong>{AI_PICKS_REGISTER} palpites de IA</strong>. Texto ou print, como preferir.
          </p>
          {error ? <p className="error">{error}</p> : null}
          <button className="cta" type="button" disabled={sending} onClick={register}>
            {sending ? "Abrindo..." : "Cadastrar e usar o bônus"}
          </button>
          <button className="cta secondary" type="button" onClick={openAsk}>
            Pedir palpite
          </button>
        </section>
      )}

      {step === "pending" && (
        <section className="card">
          <p className="kicker">Você ganhou</p>
          <h2>Bônus {BONUS_LABEL}</h2>
          <p className="promo">
            Promocode <strong>{PROMO_CODE}</strong>
          </p>
          <p className="copy">
            O clique no cadastro ainda não libera a IA. Os {AI_PICKS_REGISTER} palpites entram
            quando a 1win confirmar o registro com o promocode <strong>{PROMO_CODE}</strong>.
            Depois disso o saldo embaixo sobe e o palpite abre aqui.
          </p>
          {error ? <p className="error">{error}</p> : null}
          <button className="cta" type="button" disabled={sending} onClick={register}>
            {sending ? "Abrindo..." : "Cadastrar e usar o bônus"}
          </button>
          <button className="cta secondary" type="button" disabled={checking} onClick={() => void checkRegistration()}>
            {checking ? "Checando..." : "Já me cadastrei"}
          </button>
          <button className="cta secondary" type="button" onClick={openAsk}>
            Pedir palpite
          </button>
        </section>
      )}

      {step === "ask" && (
        <section className="card">
          <p className="kicker">Palpite da IA</p>
          <h2>Texto ou print</h2>
          <p className="copy">
            {registered
              ? `Saldo após cadastro: peça o palpite por texto ou print. Cada pedido desconta 1.`
              : `1 palpite grátis antes do cadastro. Depois, +${AI_PICKS_REGISTER}. Cada pedido desconta 1.`}
          </p>
          <label className="field">
            Escreva o jogo
            <textarea
              rows={3}
              value={matchText}
              onChange={(event) => setMatchText(event.target.value)}
              placeholder="Palmeiras x Flamengo"
            />
          </label>
          <label className="file-btn">
            {photoName || "Ou escolher print do jogo"}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => onPhoto(event.target.files?.[0] ?? null)}
            />
          </label>
          {photoPreview ? <img className="photo-preview" src={photoPreview} alt="Print do jogo" /> : null}
          {error ? <p className="error">{error}</p> : null}
          {answer ? <p className="prediction pick-answer">{answer}</p> : null}
          <button className="cta" type="button" disabled={asking} onClick={() => void ask()}>
            {asking ? "Analisando..." : "Pedir palpite"}
          </button>
          {credits === 0 ? (
            <button className="cta secondary" type="button" disabled={sending} onClick={register}>
              Cadastrar e usar o bônus
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
            Voltar
          </button>
        </section>
      )}

      {step === "invite" && (
        <section className="card">
          <p className="kicker">Palpites acabaram</p>
          <h2>+10 de IA por amigo</h2>
          <p className="copy">
            Seus palpites de IA terminaram. Envie este link ao amigo. Os{" "}
            <strong>10 palpites de IA</strong> entram só depois que ele abrir o link, se cadastrar
            com o promocode <strong>{PROMO_CODE}</strong> e o registro for confirmado.
          </p>
          {shareUrl ? (
            <>
              <code className="invite-link">{shareUrl}</code>
              <button className="cta" type="button" onClick={copyInvite}>
                {copied ? "Link copiado" : "Copiar link de indicação"}
              </button>
            </>
          ) : (
            <p className="error">Abra no Telegram para gerar seu link de indicação.</p>
          )}
          <button className="cta secondary" type="button" disabled={sending} onClick={register}>
            Cadastrar e usar o bônus
          </button>
        </section>
      )}

      <p className="legal">18+. Jogue com responsabilidade. Promoções sujeitas a regras do operador.</p>

      <div className="saldo-bar">
        <p>
          💎 Saldo:{" "}
          <strong>{credits === null ? "—" : credits}</strong> palpite(s)
        </p>
        {step !== "ask" ? (
          <button type="button" onClick={openAsk}>
            Pedir palpite
          </button>
        ) : null}
      </div>
    </main>
  );
}

