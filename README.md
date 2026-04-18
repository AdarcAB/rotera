# Rotera

> Mindre kaos. Mer rättvisa.

Webbapp som hjälper tränare i barn- och ungdomsfotboll att planera speltid,
rotera positioner och exekvera byten — i linje med SvFF:s speltidsgaranti.

Live: **https://rotera.online**

Byggt och driftat gratis av Adarc AB som ett bidrag till svensk
ungdomsidrott.

---

## Funktioner

- **Lag och spelare** — enkel CRUD, inga krav på smeknamn eller tröjnummer.
- **Spelformer** — SvFF 3-, 5-, 7- och 9-manna förifyllda. Justerbara
  positioner, perioder och bytesregler.
- **Schemagenerator** — randomized sampling (~1500 varianter) som optimerar
  för jämn speltid, önskade positioner och positionsvariation. Målvakten
  behandlas specialfall: roteras mellan perioder, inte inom.
- **Live-läge** — stor timer, planvy med aktuell uppställning + live-räknade
  minuter per spelare, pre-sub-banner + nedräkningsbeep (10/3/2/1 s),
  full-screen byte-modal med checkbox per spelarbyte, ad hoc-byte via tap på
  planen, Wake Lock så skärmen inte slocknar.
- **Sammanställning** — faktisk speltid per spelare efter matchen, justerad
  för ad hoc-byten och skippade planerade byten.
- **PWA** — installeras som app på iPhone/Android.
- **Auth** — magic-link + 6-siffrig OTP via mejl (Resend). Ingen användare
  behöver lösenord.

---

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Server Components, Server
  Actions)
- TypeScript, strict
- [Tailwind CSS v4](https://tailwindcss.com)
- [Neon Postgres](https://neon.tech) + [Drizzle ORM](https://orm.drizzle.team)
- [Resend](https://resend.com) för transaktionella mejl
- [Vercel](https://vercel.com) hosting

---

## Kom igång lokalt

```bash
git clone https://github.com/AdarcAB/rotera.git
cd rotera
npm install

# Kopiera .env.example till .env.local och fyll i
cp .env.example .env.local

# Skapa en gratis Neon-databas på https://neon.tech
# Kopiera connection string till DATABASE_URL i .env.local

# Pusha schemat
npm run db:push

# Starta dev-server
npm run dev
```

Öppna http://localhost:3000. Utan `RESEND_API_KEY` skickas magic-link och OTP
till server-konsolen istället för mejl — kolla där du kör `npm run dev`.

### Env-variabler

```
DATABASE_URL=postgresql://...       # Neon
AUTH_SECRET=...                     # ≥ 16 tecken, session-cookie HMAC
APP_URL=http://localhost:3000       # Bas för magic-link
RESEND_API_KEY=                     # Valfri. Om tom → log till konsol.
EMAIL_FROM=Rotera <hej@domän.se>    # Valfri. Kräver verifierad Resend-domän.
```

---

## Arkitektur i korthet

```
app/
  (app)/              authed sidor (dashboard, teams, matches, live, konto)
  login/              login + OTP-verifiering
  om/                 offentlig om/integritet/villkor
  opengraph-image.tsx dynamiska OG-bilder
components/           UI (Logo, PlayersTable, PlayersSection, ...)
lib/
  auth.ts             HMAC-session, magic-link, OTP
  db/
    schema.ts         Drizzle-schema
    client.ts         Neon HTTP-klient
  schedule/
    generate.ts       schemagenerator (kronjuvelen)
    score.ts          scoring-funktion
    validate.ts       hårda constraints
    rng.ts            seedbar PRNG
```

Genererat schema lagras som JSONB på `matches.generated_schedule_json`.
Live-state (timer, genomförda/skippade byten, ad hoc-byten) på
`matches.live_state_json`. Båda muterade optimistiskt i klienten,
persisteras via Server Actions.

---

## Bidrag

PR:s välkomna. Ingen CLA. Bugg? Öppna en issue.

---

## Licens

[MIT](./LICENSE). Gör vad du vill. Kommersiellt, privat, modifierat — gärna.
