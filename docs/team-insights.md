# Team insights (mönster-logg + aggregat)

> Status: **concept / design exploration**, inte implementerat.
> Skapad: 2026-04-18. Senast uppdaterad: 2026-04-18.

## Vision

Rotera idag ger coachen **kontroll** (byten, speltid, schema). Nästa steg är
att ge coachen **insikt**: varför en match gick som den gick, och vad laget
bör träna på härnäst.

Inspiration: strokes-gained i golf, pingis-poänglogg ("vann på servar,
förlorade på backhand"). Där kan spelaren se mönster i sin egen statistik
och rikta sin träning.

## Icke-förhandlingsbar princip: **anonymt**

Rotera är för barn- och ungdomsfotboll. Vi loggar **aldrig** individuella
händelser som kan peka ut en enskild spelare:

- Ingen "vem sköt målet"
- Ingen "vem släppte in målet som MV"
- Ingen "vem tappade bollen som ledde till insläpp"

Den typen av data, även med goda intentioner, blir en skamlista i händerna
på en stressad tränare eller en förälder som ser appen över axeln.

Istället fokuserar vi på **laget som enhet** och **mönster** — kedjor av
händelser som ledde fram till mål eller chans.

## Taxonomi: mål-mönster

### Insläpp — hur motståndaren kom åt målet

1. **Hörna/frispark emot** (standardsituation)
2. **Uppspel som kraschar** — vårt uppspel från egen zon tappas, motståndaren
   kommer åt bollen nära vårt mål
3. **Kontring efter eget anfallstapp** — vi pressade/anföll, tappade bollen,
   motståndaren sprang igenom
4. **Sidförlust + inlägg** — förlorad yttre duell → inlägg → mål
5. **Lång boll över backlinjen**
6. **Mittfältsduell förlorad → passning genom**
7. **Straff**
8. **Retur / rebound** — efter skott eller räddning
9. **1-mot-1 mot MV** — motståndare bröt igenom hela försvaret

### Mål för — hur vi kom åt målet

1. **Kombinationsspel** — flera passningar leder till avslut
2. **Kontring** — snabb övergång efter återvunnen boll
3. **Hörna/frispark** — direkt eller efter retur
4. **High press** — vunnen boll i deras zon → avslut
5. **Uppspel som når fram** — lång boll eller direktspel
6. **Individuell genombrytning** — utan att peka ut vem
7. **Rebound / kvarliggande** — efter skott eller räddning

### Missade möjligheter (chans-statistik)

Samma taxonomi men med "chans" istället för "mål". Ger nyckeltal som:

- "Vi skapade 4 kontringslägen, bara 1 blev mål" → avslutsträning
- "Motståndaren hade 3 hörnchanser, vi släppte in 1" → försvarsträning

## UX-idéer

### Live-läget (valfritt)

Snabbknappar i live-vyn:

- "Mål för oss" / "Mål emot"
- "Chans för" / "Chans emot"

Tap → modal med chip-selector (max 2 mönster). Minut loggas automatiskt.
"Klar"-knapp stor, <3s per event.

### Post-match (primär väg)

På match-summary-sidan:

- Nytt kort: "Analys av matchen"
- Visar målen som redan är loggade (t.ex. "2 mål för, 1 emot")
- Per mål: tap → välj mönster retroaktivt
- Fritext "annat" för ovanligheter
- Coach kan hoppa över — fältet är frivilligt

### Säsongsaggregat

På team-sidan, nytt kort "Mönster över säsongen":

- Fördelning av insläpp per mönster (cirkel/bar-chart)
- Fördelning av egna mål per mönster
- Chans-konvertering (chanser → mål per mönster)
- Utveckling över tid: "Uppspelskrasher har minskat från 50% till 20%"

## AI-lagret (Claude API)

Efter att coachen loggat några matcher genererar vi en kort coaching-rapport:

> "De senaste 5 matcherna visar ett mönster: **8 av era 12 insläpp kommer
> från uppspelskrasher eller mittfältstapp i egen zon**. Prova en
> förstärkt mittfältsrad i nästa match, eller jobba specifikt på
> passningsrytm under uppspel i träning.
>
> **Styrka:** era kontringar konverteras till 45% mål — väl över
> genomsnittet. Fortsätt värna om snabba övergångar efter återvunnen boll."

Viktigt: rapporten ska hålla samma anonymitetsprincip. Aldrig "Kalle
gör mest fel i uppspel". Alltid laget + mönster.

## Implementationsplan

### Fas 1 — Grundloggning (~1-2 h)

- Schema: `match_events(match_id, kind, pattern, minute, note)` där kind =
  goal_for/goal_against/chance_for/chance_against, pattern = enum av
  taxonomin ovan
- UI: post-match-kort för att logga mål retroaktivt
- Per match: visa fördelning av mönster

### Fas 2 — Säsongsaggregat (~2 h)

- Lag-sida: ny "Mönster"-sektion
- Fördelning över säsongen
- Konverteringsgrader
- Utveckling över tid

### Fas 3 — AI-rapport (~2-3 h)

- Server action som skickar kontext till Claude API
- Strukturerad prompt med principer (anonymt, konstruktivt, peka på träning)
- Cache resultat per-match eller per-vecka

### Fas 4 — Live-loggning (valfritt, ~2 h)

- Snabbknappar i live-vyn
- Modal med chip-selector

## Öppna frågor

- **Hur många mönster ska vi ha?** 9 insläpp-mönster + 7 mål-mönster =
  16 totalt. Risk för överval → chip-selector måste vara väldigt enkel.
  Kanske börja med färre (5 av varje) och expandera baserat på användning.
- **Chanser = subjektivt.** Vad räknas som chans? Standardisera: "skott
  inom 16-metersboxen eller friläge". Eller låt coachen bestämma.
- **Vem kan logga?** Alla org-medlemmar? Bara den som körde live-läget?
  Troligen alla — mönster kan diskuteras post-match.
- **Kan man redigera loggade events?** Ja, för det är ofta så att coachen
  tänker om efter videon. Lägg till redigering i UI:t från dag 1.
- **Integrering med fair score?** Är positionens prestanda värd nån insikt?
  Kanske: "I hörn-situationer har vi släppt in 3 av 5 när ni spelat 2-3-1.
  0 av 3 med 3-3-1." Formation-specifika insikter.
- **Hur visa utan att dramatisera enskilda matcher?** Aggregera minst 3-5
  matcher innan insikter visas på säsongsnivå.

## Referensappar

- **Strokes Gained (golf)** — datadriven insikt utan att skylla på
  klubborna
- **Pingis-apper (t.ex. TableTennisTracker)** — poänglogg per kategori
- **Wyscout / StatsBomb** — proffsstatistik, men individbaserat. Inte vår
  modell, men tekniskt sett är mönster-taggning etablerat.

## Nästa steg

Vänta på:

1. Organisk efterfrågan (röster på /forslag)
2. Feedback från första 5-10 HBIF-matcher om vad som faktiskt saknas
3. Några månaders användning för att kalibrera vilken detaljnivå coacher
   orkar logga

Uppdatera detta dokument när vi lär oss mer.
