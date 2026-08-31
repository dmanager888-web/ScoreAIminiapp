# Placar.AI Mini App

Telegram Mini App for [@PlacarAI_bot](https://t.me/PlacarAI_bot).

## Funnel

1. Instant gift: 1 AI pick.
2. Fortune wheel once — every slice is 500% + gift box. Promo `placar500`.
3. Register via offer link with `sub1=<telegram_id>` → 20 detailed AI picks after conversion.
4. Invite friends → +10 picks per referred registration.

## Referral link (gives inviter +10 after the friend registers)

```
https://t.me/PlacarAI_bot?start=ref_<telegram_id>
```

Example: user `123456789` shares `https://t.me/PlacarAI_bot?start=ref_123456789`.

The bot must read `/start ref_123456789`, open the Mini App, and on the friend's conversion credit +10 to `123456789`. Mini App also sends `referrer_id` in the webhook when `start_param` is `ref_<id>`.

Mini App never puts the secret in the browser. It calls `/api/postback?sub1=<telegram_id>`; Vite (dev/preview) forwards to:

`POSTBACK_BASE?sub1=<id>&secret=<POSTBACK_SECRET>`

Set `POSTBACK_SECRET` in `.env` (not `VITE_`). This endpoint credits the user in Placar.AI after they tap register. The casino/partner URL is still `VITE_OFFER_URL` — the postback is not a landing page.

## Deploy on Railway

1. `railway login` (if needed)
2. `railway init` — new project or existing
3. Set variable `POSTBACK_SECRET` in Railway (same secret as the Placar postback)
4. `railway up`

Start command is `npm start` (`server.mjs` serves `dist` and `/api/postback`). After deploy, paste the public HTTPS URL into BotFather Mini App / Menu Button.

## Setup

```bash
cp .env.example .env
# set VITE_OFFER_URL to the casino/partner link
npm install
npm run dev
```
