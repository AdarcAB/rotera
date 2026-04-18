import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const sp = await searchParams;

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
        {sp.deleted ? (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 text-sm text-emerald-900 text-center">
            Ditt konto och all din data är raderad. Tack för att du testade
            Rotera.
          </div>
        ) : null}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 -right-40 w-[560px] h-[560px] rounded-full border-2 border-dashed border-emerald-200/70" />
            <div className="absolute -bottom-56 -left-56 w-[680px] h-[680px] rounded-full border-2 border-dashed border-emerald-100" />
          </div>

          <div className="relative max-w-3xl mx-auto px-6 pt-20 md:pt-28 pb-20 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-900 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              För barn- och ungdomstränare
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Mindre kaos. <br className="md:hidden" />
              Mer{" "}
              <span className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
                rättvisa
              </span>
              .
            </h1>
            <p className="mt-5 text-lg md:text-xl text-neutral-700 leading-relaxed max-w-2xl mx-auto">
              Rotera planerar speltid och byten åt dig — med SvFF:s
              speltidsgaranti i ryggraden. Sen hjälper appen dig exekvera det
              vid sidlinjen.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 justify-center">
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

            <div className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-emerald-800">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Gratis. För alltid.
            </div>
            <div className="mt-2 text-xs text-neutral-500">
              Webbapp · Installeras som PWA på iPhone och Android · Svenska
            </div>
          </div>
        </section>

        <section
          id="funktioner"
          className="border-t border-border bg-neutral-50"
        >
          <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
            <Feature
              icon={<ScaleIcon />}
              title="Speltidsgaranti"
              body="Algoritmen fördelar minuter jämnt så alla får ungefär lika mycket speltid över en match."
            />
            <Feature
              icon={<RotateIcon />}
              title="Positionsrotation"
              body="Spelare får sina önskade positioner när det går — och testar andra roller på ett rättvist sätt."
            />
            <Feature
              icon={<StopwatchIcon />}
              title="Live-läge för sidlinjen"
              body="Timer, nedräkning, byte-modal och ad hoc-byten när någon går sönder. Byggd för 3 sekunders uppmärksamhet."
            />
          </div>
        </section>

        <section className="border-t border-border bg-white">
          <div className="max-w-4xl mx-auto px-6 py-16 grid md:grid-cols-[1.2fr_auto] gap-10 items-center">
            <div>
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
                  title="Skapa din match"
                  body="Bocka spelare. Per spelare: välj vilka positioner de kan spela — och vilka de helst vill spela."
                />
                <Step
                  n={4}
                  title="Generera schema"
                  body="Vår algoritm provar många varianter och plockar den som bäst uppfyller speltidsgaranti + önskemål. Gillar du inte — klicka regenerera."
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
            <div className="hidden md:flex justify-center">
              <PhonePreview />
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-primary/5">
          <div className="max-w-3xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Kom igång på en minut
            </h2>
            <p className="mt-3 text-neutral-700 max-w-xl mx-auto">
              Logga in med e-post och skapa ditt första lag.
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
        <div className="mb-1">Så du kan coacha barnen, inte byteslistan.</div>
        <div>
          <Link href="/om" className="hover:underline">
            Om & integritet
          </Link>
          {" · "}
          <a href="mailto:hej@adarc.se" className="hover:underline">
            hej@adarc.se
          </a>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-border p-5">
      {icon ? (
        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
          {icon}
        </div>
      ) : null}
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-neutral-600 leading-relaxed">{body}</div>
    </div>
  );
}

function ScaleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v18" />
      <path d="M7 21h10" />
      <path d="M5 7h14" />
      <path d="M8 7l3 6H5l3-6Z" fill="currentColor" fillOpacity="0.12" />
      <path d="M16 7l3 6h-6l3-6Z" fill="currentColor" fillOpacity="0.12" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function StopwatchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 2h4" />
      <path d="M12 4v2" />
      <circle cx="12" cy="14" r="8" />
      <path d="M12 10v4l2.5 2.5" />
      <path d="M18.4 6.6l1.6-1.6" />
    </svg>
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

function PhonePreview() {
  return (
    <div className="relative mx-auto w-[260px] h-[520px]">
      <div className="absolute inset-0 rounded-[40px] bg-neutral-900 shadow-xl" />
      <div className="absolute inset-[8px] rounded-[32px] bg-white overflow-hidden flex flex-col">
        <div className="h-7 bg-neutral-900" />
        <div className="flex-1 p-4 flex flex-col">
          <div className="text-[10px] text-neutral-500">Period 2 av 3</div>
          <div className="font-mono text-5xl font-bold tracking-tight text-center mt-3">
            07:12
          </div>
          <div className="text-[10px] text-center text-neutral-500 mt-1">
            Nästa byte: 14′ (om 4:12)
          </div>

          <div className="relative mt-4 mx-auto w-[170px] h-[220px] rounded-md bg-emerald-600 border-2 border-white/80 overflow-hidden">
            <div className="absolute top-1/2 left-0 right-0 border-t border-white/60" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 border border-white/60 rounded-full" />
            <Dot top="14%" left="50%" label="FW" />
            <Dot top="32%" left="22%" label="VM" />
            <Dot top="32%" left="50%" label="CM" />
            <Dot top="32%" left="78%" label="HM" />
            <Dot top="60%" left="30%" label="VB" />
            <Dot top="60%" left="70%" label="HB" />
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
