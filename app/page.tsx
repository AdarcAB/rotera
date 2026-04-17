import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary" />
          <span className="font-bold text-lg">Rotera</span>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:underline"
        >
          Logga in
        </Link>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Byten som faktiskt blir rättvisa.
          </h1>
          <p className="text-lg text-neutral-700 mb-8 leading-relaxed">
            Rotera hjälper barn- och ungdomstränare att planera och exekvera byten i
            fotboll — så alla får ungefär lika mycket speltid, roteras mellan
            positioner de kan spela, och får sina önskade positioner när det går.
          </p>
          <p className="text-lg text-neutral-700 mb-10 leading-relaxed">
            Byggd för sidlinjen: timer, byteslarm, full-skärm-modal. Tre tryck till
            rätt uppställning, även med handskar i regnet.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="inline-flex h-12 px-6 items-center justify-center rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90"
            >
              Kom igång
            </Link>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg border border-border bg-white">
              <div className="font-semibold mb-1">Speltidsgaranti</div>
              <div className="text-neutral-600">
                Optimeraren sprider minuter jämnt enligt SvFF:s spelformer.
              </div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-white">
              <div className="font-semibold mb-1">Live-läge</div>
              <div className="text-neutral-600">
                Timer, byteslarm och byte-modal som syns även i solen.
              </div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-white">
              <div className="font-semibold mb-1">Regenerera</div>
              <div className="text-neutral-600">
                Gillar du inte förslaget? Klicka om tills det känns rätt.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
