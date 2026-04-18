"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "rotera.installHintDismissed";

export function InstallAppHint() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    setIsIOS(/iPhone|iPad|iPod/.test(ua));

    setDismissed(
      typeof window !== "undefined" &&
        window.localStorage.getItem(DISMISS_KEY) === "1"
    );

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone) return null;
  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") dismiss();
    setPrompt(null);
  };

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-emerald-900 mb-1">
            Installera Rotera på hemskärmen
          </div>
          <p className="text-sm text-emerald-900/80 mb-3">
            Starta som en riktig app, full-screen, med bättre stöd för ljud och
            att skärmen hålls vaken under matchen.
          </p>

          {prompt ? (
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center h-9 px-4 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              Installera
            </button>
          ) : isIOS ? (
            <ol className="text-sm text-emerald-900/90 list-decimal ml-5 space-y-1">
              <li>
                Tryck på <strong>Dela</strong>-ikonen längst ned i Safari
                (kvadrat med uppåtpil).
              </li>
              <li>
                Välj <strong>Lägg till på hemskärmen</strong>.
              </li>
              <li>Tryck <strong>Lägg till</strong>.</li>
            </ol>
          ) : (
            <div className="text-sm text-emerald-900/90">
              Öppna din webbläsares meny → välj{" "}
              <strong>Installera app</strong> eller{" "}
              <strong>Lägg till på hemskärmen</strong>.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dölj"
          className="text-emerald-900/50 hover:text-emerald-900 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
