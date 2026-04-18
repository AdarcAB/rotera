"use client";

import { useState, useTransition } from "react";
import { submitFeature, toggleVote } from "@/app/(app)/forslag/actions";
import type { FeatureRow } from "@/app/(app)/forslag/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";
import { Card, CardTitle } from "@/components/ui/Card";

export function FeaturesBoard({
  initialFeatures,
}: {
  initialFeatures: FeatureRow[];
}) {
  const [features, setFeatures] = useState<FeatureRow[]>(initialFeatures);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sorted = [...features].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 3) {
      setError("Titel krävs (minst 3 tecken).");
      return;
    }
    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    startTransition(async () => {
      const result = await submitFeature(fd);
      if (!result.ok) {
        setError(result.error ?? "Kunde inte spara.");
        return;
      }
      setTitle("");
      setDescription("");
      // Optimistic add — real row will re-sync on next revalidate
      const temp: FeatureRow = {
        id: -Date.now(),
        title: title.trim(),
        description: description.trim() || null,
        status: "open",
        votes: 1,
        myVote: true,
        createdByUserId: null,
        createdAt: new Date().toISOString(),
      };
      setFeatures((prev) => [temp, ...prev]);
    });
  };

  const handleVote = (id: number) => {
    setFeatures((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              votes: f.myVote ? f.votes - 1 : f.votes + 1,
              myVote: !f.myVote,
            }
          : f
      )
    );
    startTransition(() => {
      toggleVote(id).catch(() => {});
    });
  };

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-3">
        {sorted.map((f) => (
          <Card key={f.id} className="p-0 overflow-hidden">
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => handleVote(f.id)}
                className={`shrink-0 px-4 py-3 flex flex-col items-center justify-center gap-1 border-r border-border transition ${
                  f.myVote
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "bg-white hover:bg-neutral-50 text-neutral-600"
                }`}
                aria-pressed={f.myVote}
                aria-label={
                  f.myVote
                    ? `Ta tillbaka röst på ${f.title}`
                    : `Rösta på ${f.title}`
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 4l7 8h-4v8h-6v-8H5l7-8z" />
                </svg>
                <span className="text-lg font-mono leading-none">
                  {f.votes}
                </span>
              </button>
              <div className="flex-1 p-4">
                <div className="font-semibold">{f.title}</div>
                {f.description ? (
                  <div className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap">
                    {f.description}
                  </div>
                ) : null}
                {f.status !== "open" ? (
                  <div className="text-xs mt-2 inline-block px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 uppercase tracking-wide">
                    {f.status}
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
        {sorted.length === 0 ? (
          <div className="text-sm text-neutral-600">
            Inga förslag ännu. Bli först!
          </div>
        ) : null}
      </div>

      <div className="md:sticky md:top-28 self-start">
        <Card>
          <CardTitle>Föreslå ny</CardTitle>
          <form onSubmit={handleSubmit} className="mt-3">
            <Field>
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="t.ex. Stöd för landslag"
                required
              />
            </Field>
            <Field>
              <Label htmlFor="description">Beskrivning (valfri)</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={800}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-200"
                placeholder="Kort om hur det skulle funka eller varför det behövs."
              />
            </Field>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sparar..." : "Skicka förslag"}
            </Button>
            {error ? (
              <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-900">
                {error}
              </div>
            ) : null}
            <p className="text-xs text-neutral-600 mt-3">
              Din röst läggs automatiskt på förslaget du skickar in.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
