import { useEffect, useMemo, useState } from "react";
import { loadGiftPick, type AiPick } from "./ai";
import { buildLead, pickOfferUrl, submitLead } from "./api";
import {
  BONUS_LABEL,
  BOT_USERNAME,
  BRAND,
  inviteLink,
  parseReferrer,
  PRIZES,
  PROMO_CODE,
} from "./prizes";
import { haptic, openBot, openExternal, telegramUser } from "./telegram";
import Wheel from "./Wheel";

type Step = "gift" | "wheel" | "win" | "pending" | "invite";
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

function initialStep(
  telegramId: number | null,
): Step {
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
  const [accepted, setAccepted] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spun, setSpun] = useState(alreadySpun);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [giftPick, setGiftPick] = useState<AiPick | null>(null);
  const [giftLoading, setGiftLoading] = useState(true);

  const shareUrl = user.telegramId ? inviteLink(user.telegramId) : "";

  useEffect(() => {
    let cancelled = false;
    loadGiftPick().then((pick) => {
      if (!cancelled) {
        setGiftPick(pick);
        setGiftLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  function showInvite() {
    localStorage.setItem(storageKey("credits_done", user.telegramId), "1");
    haptic("tap");
    setStep("invite");
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
            {giftLoading || !giftPick ? (
              <p className="copy">Carregando palpite...</p>
            ) : (
              <>
                <p className="kicker">{giftPick.league}</p>
                <p className="match">{giftPick.match}</p>
                <p className="pick">{giftPick.pick}</p>
                <p className="copy">
                  Confiança da IA: {giftPick.confidence}
                  {giftPick.source === "demo" ? " · demo até a API voltar" : ""}
                </p>
              </>
            )}
          </div>
          <p className="copy">
            Os próximos palpites detalhados saem no bot @{BOT_USERNAME}. Agora gire a roleta — 1
            vez.
          </p>
          <button className="cta secondary" type="button" onClick={() => openBot()}>
            Pedir palpite no bot
          </button>
          <button className="cta" type="button" onClick={claimGift}>
            Girar a roleta
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
            {spinning ? "Girando..." : spun ? "Já usado" : "Girar 1 vez"}
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
            Cadastre-se pelo nosso link e use o promocode no depósito. Os{" "}
            <strong>20 palpites de IA</strong> são liberados somente após o registro com este
            promocode.
          </p>
          {error ? <p className="error">{error}</p> : null}
          <button className="cta" type="button" disabled={sending} onClick={register}>
            {sending ? "Abrindo..." : "Cadastrar e ganhar 20 palpites de IA"}
          </button>
        </section>
      )}

      {step === "pending" && (
        <section className="card">
          <p className="kicker">Cadastro</p>
          <h2>20 palpites após o registro</h2>
          <p className="promo">
            Promocode <strong>{PROMO_CODE}</strong>
          </p>
          <p className="copy">
            Use o promocode no cadastro. Os 20 palpites detalhados de IA entram só depois que o
            registro for confirmado — não no clique do botão. Depois peça os palpites no bot.
          </p>
          <button className="cta" type="button" onClick={() => openBot()}>
            Abrir o bot e pedir os 20 palpites
          </button>
          <button className="cta secondary" type="button" disabled={sending} onClick={register}>
            {sending ? "Abrindo..." : "Abrir cadastro de novo"}
          </button>
          <button className="cta secondary" type="button" onClick={showInvite}>
            Já usei os 20 palpites
          </button>
        </section>
      )}

      {step === "invite" && (
        <section className="card">
          <p className="kicker">Palpites acabaram</p>
          <h2>+10 de IA por amigo</h2>
          <p className="copy">
            Seus 20 palpites de IA terminaram. Envie este link ao amigo. Os{" "}
            <strong>10 palpites de IA</strong> entram só depois que ele abrir o link, se cadastrar
            com o promocode <strong>{PROMO_CODE}</strong> e o registro for confirmado.
          </p>
          <p className="copy">
            Só o link não conta: o amigo precisa concluir o cadastro. A confirmação vem pelo
            Telegram dele + o postback da casa.
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
        </section>
      )}

      <p className="legal">18+. Jogue com responsabilidade. Promoções sujeitas a regras do operador.</p>
    </main>
  );
}

