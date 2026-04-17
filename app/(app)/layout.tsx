import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-10 px-4 md:px-6 py-3 border-b border-border bg-white flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary" />
            <span className="font-bold">Rotera</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="hover:underline">
              Översikt
            </Link>
            <Link href="/teams" className="hover:underline">
              Lag
            </Link>
            <Link href="/formations" className="hover:underline">
              Spelformer
            </Link>
            <Link href="/matches" className="hover:underline">
              Matcher
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-neutral-600">
            {user.email}
          </span>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="text-sm text-neutral-600 hover:underline"
            >
              Logga ut
            </button>
          </form>
        </div>
      </header>

      <nav className="md:hidden px-4 py-2 border-b border-border bg-white flex gap-4 text-sm overflow-x-auto">
        <Link href="/dashboard">Översikt</Link>
        <Link href="/teams">Lag</Link>
        <Link href="/formations">Spelformer</Link>
        <Link href="/matches">Matcher</Link>
      </nav>

      <main className="flex-1 px-4 md:px-6 py-6 max-w-5xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
