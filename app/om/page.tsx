import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Om & integritet",
  description:
    "Om Rotera, vem som står bakom, hur vi hanterar personuppgifter och cookies.",
};

export default function AboutPage() {
  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="px-6 py-4 border-b border-border/70 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={32} />
          <span className="font-bold tracking-tight">Rotera</span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
        >
          Logga in →
        </Link>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12 prose-neutral">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Startsida
        </Link>

        <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
          Om Rotera
        </h1>

        <Section title="Vad Rotera är">
          <p>
            Rotera är en webbapp som hjälper tränare i barn- och ungdomsfotboll
            att planera speltid, rotera positioner rättvist och exekvera byten
            vid sidlinjen — i linje med SvFF:s speltidsgaranti.
          </p>
          <p>
            Tjänsten tillhandahålls <strong>gratis, för alltid</strong>, av{" "}
            <strong>Adarc AB</strong> som ett bidrag till svensk ungdomsidrott
            — så att tränare kan lägga sin uppmärksamhet på att coacha
            barnen, istället för att hålla reda på byten, tider och
            speltidslistor vid sidlinjen.
          </p>
          <p>
            Kontakt:{" "}
            <a
              className="text-emerald-700 hover:underline"
              href="mailto:hej@adarc.se"
            >
              hej@adarc.se
            </a>
          </p>
        </Section>

        <Section title="Personuppgifter (GDPR)">
          <p>
            Vi behandlar så lite personuppgifter som möjligt. Konkret:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Din e-post</strong> — används för att logga in (engångslänk
              via mejl) och för att hålla din session knuten till ditt konto.
            </li>
            <li>
              <strong>Spelarnas namn</strong> — information du själv matar in
              för att använda appen. Vi uppmuntrar dig att bara ange förnamn.
            </li>
            <li>
              <strong>Lag, spelformer, matcher och scheman</strong> — skapat av
              dig, kopplat till ditt konto.
            </li>
          </ul>

          <p className="mt-3">
            Vi behandlar inga uppgifter om spelarnas e-post, födelsedatum,
            adress eller liknande. Vi säljer inte data. Vi delar inte data.
            Ingen spårning, inga annonser, inga analysskript.
          </p>

          <p className="mt-3 font-semibold">Dina rättigheter:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Få veta vad vi lagrar om dig</li>
            <li>Få en kopia (dataportabilitet)</li>
            <li>Rätta felaktigheter</li>
            <li>Bli raderad — kontot + all relaterad data</li>
          </ul>
          <p className="mt-3">
            Hör av dig till{" "}
            <a
              className="text-emerald-700 hover:underline"
              href="mailto:hej@adarc.se"
            >
              hej@adarc.se
            </a>{" "}
            så fixar vi det inom 30 dagar.
          </p>

          <p className="mt-3 text-sm text-neutral-600">
            Personuppgiftsansvarig: Adarc AB, Sverige.
          </p>
        </Section>

        <Section title="Var datan lagras">
          <p>
            Databasen hanteras av{" "}
            <a
              className="text-emerald-700 hover:underline"
              href="https://neon.tech"
              target="_blank"
              rel="noreferrer"
            >
              Neon
            </a>
            . Mejl skickas via{" "}
            <a
              className="text-emerald-700 hover:underline"
              href="https://resend.com"
              target="_blank"
              rel="noreferrer"
            >
              Resend
            </a>
            . Appen hostas hos{" "}
            <a
              className="text-emerald-700 hover:underline"
              href="https://vercel.com"
              target="_blank"
              rel="noreferrer"
            >
              Vercel
            </a>
            .
          </p>
          <p>
            Delar av infrastrukturen kan finnas i USA. Överföring sker med
            standardavtalsklausuler (SCCs) enligt GDPR. Vi planerar att flytta
            databasen till EU när det är praktiskt.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Vi använder <strong>en enda cookie</strong>:{" "}
            <code className="bg-neutral-100 px-1 rounded text-sm">
              rotera_session
            </code>{" "}
            — en signerad, httpOnly session-cookie som håller dig inloggad i 30
            dagar. Den är strikt nödvändig för att appen ska fungera och
            innehåller inte annat än din användar-ID plus en signatur.
          </p>
          <p>
            <strong>Inga spårningscookies. Inga analytics. Inga
            tredjepartscookies. Ingen cookie-banner behövs.</strong>
          </p>
        </Section>

        <Section title="Användarvillkor i korthet">
          <p>
            Rotera är ett verktyg, tillhandahållet i befintligt skick. Vi gör
            vårt bästa för att det ska fungera men garanterar inte perfekt
            tillgänglighet. Använd appen för att planera byten — inte för att
            fatta domarbeslut.
          </p>
          <p>
            Vi förbehåller oss rätten att stänga konton som missbrukar
            tjänsten. "Missbruk" = saker som spam, försök att komma åt andras
            data, eller liknande.
          </p>
          <p>
            Tvister avgörs enligt svensk lag.
          </p>
        </Section>

        <Section title="Ändringar">
          <p>
            När vi ändrar den här sidan uppdaterar vi datumet nedan. Om det är
            en större ändring skickar vi ett mejl till alla med konto.
          </p>
          <p className="text-sm text-neutral-500">
            Senast uppdaterad: 2026-04-18.
          </p>
        </Section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-neutral-500">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Logo size={20} />
          <span className="font-semibold text-neutral-700">Rotera</span>
        </div>
        <div>
          Rotera av{" "}
          <a
            className="hover:underline"
            href="mailto:hej@adarc.se"
          >
            Adarc AB
          </a>
          .
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3">
        {title}
      </h2>
      <div className="text-neutral-700 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
