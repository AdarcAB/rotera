# Bidra till Rotera

Kul att du vill bidra! Rotera är öppen källkod (MIT) och välkomnar både
felrapporter och pull requests.

## Kom igång

```bash
git clone https://github.com/AdarcAB/rotera.git
cd rotera
npm install
cp .env.example .env.local
# Fyll i DATABASE_URL (gratis Neon-konto på https://neon.tech)
# och ett AUTH_SECRET som är minst 16 tecken.
npm run db:push
npm run dev
```

Utan `RESEND_API_KEY` loggas magic-link och OTP i server-konsolen istället
för mejl. Praktiskt i dev.

## Arbetsflöde

1. **Fork** repot.
2. **Branch:** `git checkout -b fix/kort-beskrivning` eller
   `feat/kort-beskrivning`.
3. **Commits:** små och tydliga. Svenska eller engelska funkar, välj en.
4. **Kör build lokalt** innan du pushar: `npm run build` (typechecks + build).
5. **Öppna PR** mot `main`. Fyll i PR-mallen.
6. CI kör typecheck + build på varje PR. Grönt krävs för merge.

## Designprinciper

- **Svenska genomgående** i UI. Inga engelska strings i användarflödet.
- **Mobil-först.** Live-läget är kärnan — fungera ska det på telefon utomhus.
- **Uppmärksamhet är valutan.** Varje tryck, varje sekund tränaren tittar
  bort från planen är en kostnad. Färre klick > fler val.
- **14+ px för allt aktionsbar text.** Målgrupp 40+. Se `docs/a11y.md` (finns
  inte ännu — bidra gärna!).
- **Optimistisk UI.** State uppdateras direkt. Server-action sker i
  bakgrunden, rollback vid fel.

## Kod-struktur

Se [README.md #Arkitektur](./README.md#arkitektur-i-korthet).

**Server Actions** är preferred över API routes för mutationer. Scheduler-
logiken i `lib/schedule/` ska vara **pure** (ingen DB, ingen React) — lätt
att testa och köra isolerat.

## Scope

Vi är en gratis-app för ungdomsidrott. Vi säger nej till features som:
- Kräver registrering av känsliga uppgifter om barn (GDPR-tunga).
- Bygger in monetiserings-flöden (abonnemang, annonser).
- Introducerar externa beroenden för kärnflödet (utan stark motivation).

Vi säger ja till:
- Saker som gör matchdagen smidigare för tränaren.
- Bättre schemagenerering.
- Stöd för fler spelformer eller sporter (fundraiser, innebandy, ...).
- Tillgänglighets- och prestandaförbättringar.

## Frågor?

Kort: [issue](https://github.com/AdarcAB/rotera/issues).  
Privat: [hej@adarc.se](mailto:hej@adarc.se).
