# Rotera — Fotbollsbytes-app för barnlag

> Spec för en one-shot MVP. Skriven för Claude Code, fredag em. Håll er till scope, bygg must-have först, deploya tidigt.

---

## 1. Pitch

En webbapp som hjälper fotbollstränare för barn- och ungdomslag att **planera** och **exekvera** byten i barn- och ungdomsfotboll (SvFF:s spelformer 3/5/7/9-manna), så att **alla barn får ungefär lika mycket speltid** (SvFF:s *speltidsgaranti*), roteras mellan **positioner de faktiskt kan spela**, och i mån av möjlighet får **sina önskade positioner**.

Appen är både **förberedelseverktyg** (schemagenerator med scoring-baserad optimerare) och **match-verktyg** (live-läge med timer, bytesmodal, och snabb-omräkning inför varje period). Den stora utmaningen är inte bara att skapa ett schysst schema, utan att exekvera det vid sidlinjen — och att hinna med en ny uppställning i pausen mellan perioderna när man har två minuter, trötta ungar, och en assisterande tränare som vill diskutera formation. Appen är byggd för *den pressen*.

---

## 2. Core user flow (happy path)

1. Tränare loggar in (dev: magic-link-stub, prod: OTP via Resend — *utanför MVP*).
2. Tränare skapar ett **lag** och lägger till **spelare**.
3. Tränare skapar en **spelform** (t.ex. 7-manna) med positioner, antal perioder, tid per period, min/max byten per period.
4. Tränare skapar ett **matchtillfälle**: väljer spelform, kallar spelare, lägger till ev. gästspelare, sätter **spelbara positioner** och **önskade positioner** per spelare för just den matchen.
5. Tränare trycker **Generera schema** → optimeraren föreslår startuppställning + bytesplan. Tränare kan regenerera (ny seed) eller acceptera.
6. På matchdag: tränare öppnar matchen på telefon → **live-läge** med nedräknande timer, byteslarm och full-skärm-modal som visar "UT: X (pos) / IN: Y (pos)" för varje byte. Pause/Resume finns.
7. Efter matchen: varje spelares faktiska speltid sparas.

---

## 3. Features (MoSCoW)

### Must have
- **Auth**: multi-tenant, en tränare per konto, dev-inloggning (email → magic link loggad i server-console, ingen mail skickas).
- **Laghantering**: CRUD på lag och spelare (namn, ev. smeknamn/tröjnummer).
- **Spelformer**: CRUD. Fält: `namn`, `positioner[] (namn + förkortning)`, `antal_perioder`, `minuter_per_period`, `min_byten_per_period`, `max_byten_per_period`, `spelare_på_plan` (= antal positioner).
- **Matchtillfälle**: CRUD. Fält: `motståndare`, `datum`, `plats`, `spelform_id`, `kallade_spelare[]`, per spelare: `spelbara_positioner[]`, `önskade_positioner[]` (delmängd av spelbara).
- **Schemagenerator** (se §5 — detta är kronjuvelen).
- **Live-läge**: timer per period, röd notis X sekunder innan byte (default: 10 s), fullskärmsmodal vid byte som listar alla ut/in-par för den bytespunkten. Pause/Resume. Hoppa till nästa period.
- **Multi-tenant isolation**: alla queries scopade på `user_id`. Ingen kan se andras lag.

### Should have
- **Regenerera schema** med annan seed (om tränaren inte gillar förslaget).
- **Score-breakdown**: visa för tränaren hur schemat poängsattes (minuter-jämnhet, önskemål uppfyllda, etc).
- **Manuell override** innan match: dra och släpp spelare i startuppställning och bytespunkter, appen validerar att constraints håller.
- **Sen ankomst / skadad spelare** mitt i match: markera spelare som "ur spel", appen räknar om resterande schema på enklaste sättet (bränn bara deras återstående byten).

### Could have (skippa om tiden tryter)
- Historik: lista senaste matcher med speltid per spelare.
- Export av schema som PDF / delbar länk till assisterande tränare.
- Mörkt läge (trevligt vid kvällsmatcher).

### Won't have (MVP)
- OTP via Resend.
- Push-notiser.
- Föräldraåtkomst / spelaråtkomst.
- Statistik över flera matcher (mål, gula kort, osv).
- Offline-läge / PWA-install (men sidan ska funka över dålig uppkoppling eftersom matchen genereras innan kick-off).

---

## 4. Data model (Neon / Postgres)

```sql
users (id, email, created_at)

teams (id, user_id → users, name, created_at)

players (id, team_id → teams, name, nickname, shirt_number, created_at)

formations (
  id, user_id → users, name,
  num_periods, minutes_per_period,
  min_subs_per_period, max_subs_per_period,
  created_at
)
-- positions tillhör formation
positions (id, formation_id → formations, name, abbreviation, sort_order)

matches (
  id, user_id → users, team_id → teams, formation_id → formations,
  opponent, played_at, location,
  status: enum('draft', 'scheduled', 'live', 'finished'),
  generated_schedule_json jsonb,  -- hela schemat (se §5)
  live_state_json jsonb,          -- timer-state, current_period, paused, elapsed
  created_at
)

match_players (
  id, match_id → matches, player_id → players,
  is_guest bool, guest_name text,  -- för spelare utanför laget
  playable_position_ids int[],      -- FK till positions
  preferred_position_ids int[],     -- subset av playable
  actual_minutes_played int default 0  -- fylls i efter match
)
```

**Viktigt**:
- Allt scopas på `user_id`. Använd row-level-liknande checks i varje query.
- `generated_schedule_json` innehåller hela schemat som JSON — se format nedan. Detta undviker ett komplicerat relationellt schema för bytespunkter.

### 4.1 Seed-data (SvFF-spelformer)

Vid databasinitieringen ska följande spelformer seedas **per nyregistrerad användare** (eller globalt + klonbart — välj enklaste implementationen). Värdena följer SvFF:s *Nationella spelformer*. Tränaren kan sedan klona och modifiera dessa.

**3 mot 3** (6–7 år) — ingen målvakt
- Spelare på plan: 3
- Perioder: 4, 3 min vardera (sammandragsformat)
- Min/max byten per period: 0/0 (SvFF rekommenderar byten mellan perioder)
- Positioner: `Spelare 1`, `Spelare 2`, `Spelare 3` (rent positionsfria — mest för att appen ska fungera, inga riktiga roller)
- *Default-formation*: Fritt

**5 mot 5** (8–9 år) — med målvakt
- Spelare på plan: 5
- Perioder: 3, 15 min vardera (enskild match); alt 3 × 10 min för sammandrag
- Min/max byten per period: 0/2
- Positioner: `Målvakt (MV)`, `Vänsterback (VB)`, `Högerback (HB)`, `Vänsterforward (VF)`, `Högerforward (HF)`
- *Default-formation*: 2-2 (två backar, två forwards)

**7 mot 7** (10–12 år) — tre lagdelar introduceras
- Spelare på plan: 7
- Perioder: 3, 20 min vardera (enskild match); alt 3 × 15 min för sammandrag
- Min/max byten per period: 1/3
- Positioner (formation 2-3-1, vanligast enligt SvFF): `Målvakt (MV)`, `Vänsterback (VB)`, `Högerback (HB)`, `Vänster mittfältare (VM)`, `Central mittfältare (CM)`, `Höger mittfältare (HM)`, `Forward (FW)`
- *Default-formation*: 2-3-1

**9 mot 9** (13–14 år)
- Spelare på plan: 9
- Perioder: 3, 25 min vardera
- Min/max byten per period: 1/4
- Positioner (formation 3-3-2, balanserad): `Målvakt (MV)`, `Vänsterback (VB)`, `Mittback (MB)`, `Högerback (HB)`, `Vänster mittfältare (VM)`, `Central mittfältare (CM)`, `Höger mittfältare (HM)`, `Vänsterforward (VF)`, `Högerforward (HF)`
- *Default-formation*: 3-3-2 (alternativ 4-3-1 via SvFF:s övergång från 2-3-1)

> **Note till implementatör**: Namnen ovan är *defaults*. Tränaren ska kunna byta både namn och förkortning på positioner efter eget tycke (t.ex. "Libero" istället för "Mittback"). Seed-datan är en rimlig startpunkt, inte en sanning. Default-formationen i 9-manna kan alternativt vara 4-3-1 — välj en, erbjud den andra som mall.

---

## 5. Schemagenerator — kronjuvelen

Det här är den enda delen som är algoritmiskt intressant. Resten är CRUD. Lägg tid här.

### 5.1 Input
```ts
type ScheduleInput = {
  formation: { numPeriods, minutesPerPeriod, minSubs, maxSubs, positions: Position[] };
  players: {
    id, name,
    playablePositionIds: number[],
    preferredPositionIds: number[]
  }[];
  seed?: number; // för reproducerbarhet vid regenerering
};
```

### 5.2 Output
```ts
type Schedule = {
  periods: {
    index: number;  // 0-indexerad
    startLineup: { positionId: number, playerId: number }[];
    subPoints: {
      minuteInPeriod: number;        // när i perioden bytet sker
      changes: { positionId: number, outPlayerId: number, inPlayerId: number }[];
    }[];
  }[];
  score: number;
  scoreBreakdown: {
    minutesFairness: number;     // högre = jämnare
    preferencesMet: number;      // antal/ratio önskemål tillgodosedda
    positionVariety: number;     // bonus för att spelare får testa olika positioner
    chainSubPenalty: number;     // liten penalty för komplexa kedjebyten (de är krångliga att kommunicera)
  };
};
```

### 5.3 Algoritm

**Strategi: Randomized sampling med scoring. Inte deterministisk optimering.**

1. **Beräkna bytespunkter per period**: givet `minSubs`/`maxSubs` och `minutesPerPeriod`, välj ett antal bytespunkter som fördelas jämnt i perioden (t.ex. 2 byten på 20 min → minut 7 och 14).
2. **Loop N gånger** (N ≈ 500, tunable): generera ett giltigt schema slumpmässigt:
   - Välj startuppställning slumpmässigt bland spelare som kan spela varje position.
   - För varje bytespunkt: välj vilka positioner som byts (antal mellan minSubs och maxSubs), välj ut-spelare (prioritera de med mest speltid), välj in-spelare från bänken som kan spela den positionen. Tillåt kedjebyten: om en bänkspelare bara kan spela position P som är upptagen av någon som inte ska bytas, försök rockera in en kedja (max 3 spelare samtidigt).
3. **Poängsätt varje genererat schema** med målfunktionen (se 5.4).
4. **Returnera det med högst score.**

**Valideringsregler (hårda constraints — schemat måste uppfylla alla):**
- Varje spelare har total speltid ≥ `golv` (se nedan) och ≤ `tak`. Golv = `floor(totalMinutesOnField / numPlayers) - 2`. Tak = `ceil(...) + 2`. (Justera om omöjligt.)
- Ingen spelare står på en position hen inte kan spela.
- Antal byten per period inom [minSubs, maxSubs].
- Ingen spelare byts in och ut i samma bytespunkt (skulle vara absurt).

**Målfunktion (mjuka preferenser — maximera):**
```
score =
    W1 * minutesFairness       // 1 - (stddev(minutes) / mean(minutes))
  + W2 * preferencesMet         // ratio: minuter spelade på önskad position / total minuter
  + W3 * positionVariety        // bonus per spelare som spelat > 1 position
  - W4 * chainSubCount          // varje kedjebyte med 3 spelare ger -1
```
Förslag: `W1=100, W2=40, W3=10, W4=5`. Justera efter känsla.

### 5.4 Varför randomized sampling och inte riktig solver?
- Problemet är litet (≤ 15 spelare, ≤ 4 perioder). 500 samples tar < 100 ms i Node.
- Det är lätt att förklara för användaren ("vi provar 500 varianter och väljer den bästa").
- Regenerera = ny seed, användaren kan klicka tills de gillar resultatet.
- Inga externa solver-dependencies som spränger Vercel-builden.

---

## 6. Live-läge

Live-läget är *halva appen*. Användningsmiljön är:
- Telefon i handen, utomhus, i sol/regn, ofta med handskar.
- 10 sekunder uppmärksamhet åt gången mellan att titta på planen.
- 2 minuter i periodpausen att uppfatta nästa uppställning + kommunicera till laget.
- Ibland hög stress (skadad spelare, sen ankomst, missad buss).

Designprincip: **ingen interaktion får kräva mer än tre tryck**. Inga långa listor att scrolla i. Aldrig ett läge där "nu får appen *tänka*" i sekunder — om schemat ska räknas om ska det ske i förväg eller instant.

### 6.1 Routing
- `/matches/[id]/live`

### 6.2 Timer-state
- Persisterat i `live_state_json`: `{ status, currentPeriodIndex, resumedAt, elapsedBeforePause, currentSubPointIndex }`.
- Klienten räknar ned från `resumedAt + (periodLength - elapsedBeforePause)`.
- State sparas (debounced, var 5 s + på alla övergångar) så en page refresh mitt i matchen återställer timern korrekt.

### 6.3 Pre-period-vy (kronjuvel nr 2)
Detta är vad man ser under periodpauserna — och där tränaren ska kunna ta in allt på *tio sekunder*.

- **Stor rubrik**: "Period 2 av 3 börjar om 1:47" (nedräknande).
- **Uppställning för nästa period**, ritad som en fotbollsplan i porträtt (enkel SVG, inga beroenden): prickar på positioner med spelarnas namn/smeknamn i stor läsbar text.
- **Bänken**: lista längs nederkanten med namn + "kommer in vid minut X".
- **Bytespunkter för perioden**: en tidslinje längst ned — "07:00 byte, 14:00 byte" — så tränaren vet vad som väntar.
- **En enda knapp**: "Starta period 2". Stor, grön, längst ner.

### 6.4 Under pågående period
- **Timer överst**: stor monospace `MM:SS`, räknar nedåt mot periodens slut.
- **Sekundär timer**: liten text "Nästa byte: 02:14" under huvudtimern.
- **Bänken synlig** längs nederkanten, diskret.
- **Bytesnotis**: 10 s före varje `subPoint` → röd banner + ljudsignal (Web Audio API: kort beep, ingen extern asset).
- **Byte-modal**: fullskärm, tar över när bytet ska ske. Lista: `UT: Namn (pos) → IN: Namn (pos)` i stor text, en rad per ändring. En enda knapp: "Byte genomfört". Modalen kan inte stängas med klick utanför — kräver knapptryck.
- **Pause/Resume-knapp**: alltid tillgänglig, tydligt separat från byte-flödet så den inte trycks av misstag.
- **"Hoppa till paus"-knapp**: för när domaren blåser av tidigt.

### 6.5 Mitt-i-match-undantag (should have)
- **"Spelare ur"**: stor knapp i bänk-listan. Markerar spelare som ur spel, appen tar bort deras resterande bytespunkter utan att räkna om hela schemat (MVP-genväg). Deras ersättare går in vid nästa naturliga bytestillfälle.
- **"Manuell override"**: dra en spelare från plan till bänk, välj ersättare. Endast positioner de kan spela visas. Ingen algoritmomräkning, bara direktändring.

### 6.6 Efter sista perioden
- Status → `finished`.
- Räkna `actual_minutes_played` per spelare från schemat (justerat för pauser och manuella ändringar).
- Enkel summeringsvy: spelare + faktiska minuter + vilka positioner de spelat.

---

## 7. Tech stack

- **Next.js 15** (App Router, Server Components där det passar, Server Actions för mutationer).
- **TypeScript** strict.
- **Neon Postgres** (connection string i `DATABASE_URL`, använd Neon MCP för att skapa DB och köra migrationer).
- **Drizzle ORM** (lätt, TypeSafe, passar Neon serverless).
- **Tailwind** + **shadcn/ui** för komponenter. Inga egna designsystem.
- **Zod** för input-validering.
- **Vercel** deploy via Vercel MCP. Deploya tidigt och ofta.
- **Auth (dev-stub)**: email → generera token → logga magic-link till server-console → användaren klistrar in den. Hela flödet skrivet så det enkelt byts mot Resend senare.

### Mappstruktur
```
/app
  /(auth)/login
  /teams/[id]
  /formations/[id]
  /matches/[id]
  /matches/[id]/live
  /api/auth/...
/lib
  /schedule/generate.ts    ← kronjuvelen bor här
  /schedule/score.ts
  /schedule/validate.ts
  /db/schema.ts
  /db/queries.ts
/components
  /ui/...                  ← shadcn
  SubModal.tsx
  PeriodTimer.tsx
```

---

## 8. Non-goals (bygg INTE dessa)

- OTP-mail. Magic-link till konsol räcker.
- Riktiga push-notiser. In-app-notis + ljud räcker.
- Internationalisering — **svenska hela vägen**. Hårdkoda strängar i UI.
- Mobil-app. Det är en webbapp. Men UI:t ska fungera bra på mobil (live-läget är mobile-first).
- Avancerad statistik.
- "Offline-first" som arkitekturprincip. Appen kräver nät för att skapa schema; live-läget ska dock överleva tillfälliga nätproblem (tack vare persisterad state).

---

## 9. Definition of done

MVP är klar när:
1. Jag kan registrera/logga in via magic-link-till-konsol.
2. Jag kan skapa ett lag med 12 spelare, en 7-manna-spelform, och ett matchtillfälle.
3. Jag kan sätta spelbara och önskade positioner per spelare i matchen.
4. Jag kan trycka "Generera schema" och få ett giltigt schema på < 2 s som uppfyller alla hårda constraints.
5. Jag kan gå till live-läge, starta timer, se bytesnotis och byte-modal, pausa, återuppta, och avsluta matchen.
6. Efter matchen syns faktisk speltid per spelare.
7. Jag kan inte se en annan användares data ens genom att manipulera URL:er.
8. Appen är deployad på Vercel med Neon DB och fungerar end-to-end i prod.

---

## 10. Build-ordning (förslag till Claude Code)

> Följ ordningen. Deploya efter varje större steg så vi aldrig sitter med obruten röd.

1. Next.js-projekt + Neon-DB via MCP + Drizzle-schema + första deploy.
2. Dev-auth (magic-link-till-konsol) + user-scoped session.
3. CRUD: lag + spelare.
4. CRUD: spelformer + positioner.
5. CRUD: matchtillfälle + match_players med playable/preferred-positioner.
6. **Schemagenerator** (`/lib/schedule/*`). Skriv med små rena funktioner. Unit-testa `validate` och `score` om tid finns.
7. Schema-vyn: visa genererat schema, regenerera, visa score-breakdown.
8. Live-läge med timer, notis, modal, pause/resume.
9. Efter-match-vy med actual minutes.
10. Polish: mobile-first CSS på live-vyn, liten ljudsignal, snygg landing.

---

## 11. Språk och kopia

- **Svenska genomgående**. Hårdkoda strängar i UI.
- Använd SvFF-terminologi där det finns (*speltidsgaranti*, *spelform*, *kallade spelare*, *retreatlinje* om relevant).
- Undvik anglicismer — "schema" inte "schedule", "byten" inte "substitutions", "uppställning" inte "lineup".
- Ton: vänlig, direkt, ingen infantilisering. Tränare är vuxna som har bråttom.

---

*Fredag em. Kör hårt. Deploya tidigt. Om du måste skära — skär "should have" innan "must have". Om schemagenerator blir knepig, börja med greedy round-robin och byt till sampling sen.*
