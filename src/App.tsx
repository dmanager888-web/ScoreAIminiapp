import { useMemo, useState } from "react";
import { buildLead, creditPostback, pickOfferUrl, submitLead } from "./api";
import {
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

type Step = "gift" | "wheel" | "win";

function storageKey(kind: "gift" | "spin", telegramId: number | null) {
  return `placar_${kind}_${telegramId ?? "anon"}`;
}

function rotationFor(extraTurns = 6) {
  const slice = 360 / PRIZES.length;
  return extraTurns * 360 + 360 - slice / 2;
}

export default function App() {
  const user = useMemo(() => telegramUser(), []);
  const referrerId = parseReferrer(user.startParam);
  const alreadyGift = localStorage.getItem(storageKey("gift", user.telegramId)) === "1";
  const alreadySpun = localStorage.getItem(storageKey("spin", user.telegramId)) === "1";

  const [step, setStep] = useState<Step>(
    alreadySpun ? "win" : alreadyGift ? "wheel" : "gift",
  );
  const [accepted, setAccepted] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spun, setSpun] = useState(alreadySpun);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [offerUrl, setOfferUrl] = useState("");

  const shareUrl = user.telegramId ? inviteLink(user.telegramId) : "";

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
        throw new Error("Abra o Mini App pelo Telegram para ativar os 20 palpites.");
      }
      await creditPostback(String(user.telegramId));
      const payload = buildLead({
        bonusId: "bonus-500",
        bonusLabel: BONUS_LABEL,
        referrerId,
      });
      const response = await submitLead(payload);
      const url = pickOfferUrl(response, user.telegramId);
      if (url) {
        setOfferUrl(url);
        openExternal(url);
      }
    } catch (err) {
      haptic("error");
      setError(err instanceof Error ? err.message : "Falha ao abrir o cadastro.");
    } finally {
      setSending(false);
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
            <p className="copy">Confiança da IA: {STARTER_PREDICTION.confidence}</p>
          </div>
          <p className="copy">Agora gire a roleta. Só vale 1 vez — o prêmio é 500% no depósito.</p>
          <button className="cta" type="button" onClick={claimGift}>
            Girar a roleta
          </button>
        </section>
      )}

      {step === "wheel" && (
        <section className="card wheel-card">
          <p className="kicker">Roleta da sorte</p>
          <h2>500% no depósito</h2>
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
            Cupom <strong>{PROMO_CODE}</strong>
          </p>
          <p className="copy">
            Cadastre-se pelo nosso link e use o cupom no depósito. Depois do cadastro você ganha{" "}
            <strong>20 palpites detalhados de IA</strong>.
          </p>
          {error ? <p className="error">{error}</p> : null}
          <button className="cta" type="button" disabled={sending} onClick={register}>
            {sending ? "Abrindo..." : "Cadastrar e ativar 20 palpites"}
          </button>
          {offerUrl ? (
            <p className="copy">
              Se a janela não abrir, use o botão de novo. Tracking: sub1=
              {user.telegramId ?? "—"}
            </p>
          ) : null}

          <div className="invite">
            <p className="kicker">Indique um amigo</p>
            <h2> +10 palpites</h2>
            <p className="copy">
              Cada amigo que entrar pelo seu link e se cadastrar libera +10 palpites para você.
              O amigo também começa com 1 palpite de IA.
            </p>
            {shareUrl ? (
              <>
                <code className="invite-link">{shareUrl}</code>
                <button className="cta secondary" type="button" onClick={copyInvite}>
                  {copied ? "Link copiado" : "Copiar link de indicação"}
                </button>
              </>
            ) : (
              <p className="error">Abra no Telegram para gerar seu link de indicação.</p>
            )}
          </div>
        </section>
      )}

      <p className="legal">18+. Jogue com responsabilidade. Promoções sujeitas a regras do operador.</p>
    </main>
  );
}
