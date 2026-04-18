import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="px-6 py-4 border-b border-border/70 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <span className="font-bold text-lg tracking-tight">Rotera</span>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
        >
          Logga in →
        </Link>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full border-2 border-dashed border-emerald-200/70" />
            <div className="absolute -bottom-48 -left-48 w-[640px] h-[640px] rounded-full border-2 border-dashed border-emerald-100" />
          </div>

          <div className="relative max-w-5xl mx-auto px-6 pt-16 md:pt-24 pb-20 grid md:grid-cols-[1.2fr_1fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-900 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                För barn- och ungdomstränare
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
                Byten som faktiskt blir <span className="text-emerald-700">rättvisa</span>.
              </h1>
              <p className="mt-5 text-lg md:text-xl text-neutral-700 leading-relaxed max-w-xl">
                Rotera planerar speltid och byten åt dig — med SvFF:s
                speltidsgaranti i ryggraden. Sen hjälper appen dig exekvera det
                vid sidlinjen.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex h-12 px-6 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 shadow-sm"
                >
                  Kom igång gratis
                </Link>
                <a
                  href="#funktioner"
                  className="inline-flex h-12 px-6 items-center justify-center rounded-md border border-border text-neutral-800 font-medium hover:bg-neutral-50"
                >
                  Så funkar det
                </a>
              </div>

              <div className="mt-6 text-xs text-neutral-500">
                Webbapp · Installeras som PWA på iPhone och Android · Svenska
              </div>
            </div>

            <div className="hidden md:block">
              <PhonePreview />
            </div>
          </div>
        </section>

        <section
          id="funktioner"
          className="border-t border-border bg-neutral-50"
        >
          <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
            <Feature
              title="Speltidsgaranti"
              body="Optimeraren fördelar minuter jämnt så alla får ungefär lika mycket speltid över en match."
            />
            <Feature
              title="Positionsrotation"
              body="Spelare får sina önskade positioner när det går — och testa andra roller på ett rättvist sätt."
            />
            <Feature
              title="Live-läge för sidlinjen"
              body="Timer, nedräkning, byte-modal och ad hoc-byten när någon går sönder. Byggd för 3 sekunders uppmärksamhet."
            />
          </div>
        </section>

        <section className="border-t border-border bg-white">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">
              Så funkar en match
            </h2>
            <ol className="space-y-5">
              <Step
                n={1}
                title="Skapa lag och spelare"
                body="Bara namnen. Inget krångel."
              />
              <Step
                n={2}
                title="Välj spelform"
                body="SvFF 3-, 5-, 7- och 9-manna är förifyllda. Justera positioner och byten som du vill."
              />
              <Step
                n={3}
                title="Kalla till match"
                body="Bocka spelare. Per spelare: välj vilka positioner de kan spela — och vilka de helst vill spela."
              />
              <Step
                n={4}
                title="Generera schema"
                body="Optimeraren kör 1500 varianter och plockar den som bäst uppfyller speltidsgaranti + önskemål. Gillar du inte — klicka regenerera."
              />
              <Step
                n={5}
                title="Live-läge"
                body="Stor timer, röd banner 10s före byte, full-skärm byte-modal. Pausa, hoppa till paus, eller byt ad hoc. Allt sparas automatiskt."
              />
              <Step
                n={6}
                title="Se faktisk speltid efter matchen"
                body="Summering per spelare: minuter och positioner. Lätt att visa föräldrar."
              />
            </ol>
          </div>
        </section>

        <section className="border-t border-border bg-primary/5">
          <div className="max-w-3xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Kom igång på en minut
            </h2>
            <p className="mt-3 text-neutral-700 max-w-xl mx-auto">
              Ingen installation. Logga in med e-post och skapa ditt första lag.
            </p>
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex h-12 px-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 shadow-sm"
              >
                Logga in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-neutral-500">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Logo size={20} />
          <span className="font-semibold text-neutral-700">Rotera</span>
        </div>
        <div>Byggt för coacher med bråttom.</div>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-white border border-border p-5">
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-neutral-600 leading-relaxed">{body}</div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4 items-start">
      <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">
        {n}
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-neutral-600 leading-relaxed mt-0.5">
          {body}
        </div>
      </div>
    </li>
  );
}

/** Stylized phone mockup of the live view — pure CSS/SVG, no assets. */
function PhonePreview() {
  return (
    <div className="relative mx-auto w-[280px] h-[560px]">
      <div className="absolute inset-0 rounded-[40px] bg-neutral-900 shadow-xl" />
      <div className="absolute inset-[8px] rounded-[32px] bg-white overflow-hidden flex flex-col">
        <div className="h-7 bg-neutral-900" />
        <div className="flex-1 p-4 flex flex-col">
          <div className="text-[10px] text-neutral-500">
            Period 2 av 3
          </div>
          <div className="font-mono text-5xl font-bold tracking-tight text-center mt-3">
            07:12
          </div>
          <div className="text-[10px] text-center text-neutral-500 mt-1">
            Nästa byte: 14′ (om 4:12)
          </div>

          <div className="relative mt-4 mx-auto w-[180px] h-[230px] rounded-md bg-emerald-600 border-2 border-white/80 overflow-hidden">
            <div className="absolute top-1/2 left-0 right-0 border-t border-white/60" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 border border-white/60 rounded-full" />
            {/* forwards */}
            <Dot top="14%" left="50%" label="FW" />
            {/* mid */}
            <Dot top="32%" left="22%" label="VM" />
            <Dot top="32%" left="50%" label="CM" />
            <Dot top="32%" left="78%" label="HM" />
            {/* backs */}
            <Dot top="60%" left="30%" label="VB" />
            <Dot top="60%" left="70%" label="HB" />
            {/* MV */}
            <Dot top="82%" left="50%" label="MV" />
          </div>

          <div className="mt-3 text-[10px] text-neutral-700">
            <div className="font-semibold mb-1">Bänk</div>
            <div className="flex flex-wrap gap-1">
              {["Tove", "Kalle", "Ada", "Nisse", "Lisa"].map((n) => (
                <span
                  key={n}
                  className="px-1.5 py-0.5 rounded bg-neutral-100 border border-border"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot({
  top,
  left,
  label,
}: {
  top: string;
  left: string;
  label: string;
}) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white text-emerald-900 flex items-center justify-center text-[9px] font-bold shadow-sm"
      style={{ top, left }}
    >
      {label}
    </div>
  );
}
