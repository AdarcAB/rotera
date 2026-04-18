"use client";

import { useState, useTransition } from "react";
import {
  inviteToOrg,
  removeOrgInvite,
  removeOrgMember,
  renameOrg,
} from "@/app/(app)/orgs/actions";
import type { OrgDetail } from "@/app/(app)/orgs/actions";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Label } from "@/components/ui/Input";

export function OrgDetailPanel({ detail }: { detail: OrgDetail }) {
  const [name, setName] = useState(detail.name);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<null | {
    kind: "ok" | "err";
    text: string;
  }>(null);
  const [members, setMembers] = useState(detail.members);
  const [invites, setInvites] = useState(detail.invites);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const saveName = () => {
    const clean = name.trim();
    if (!clean || clean === detail.name) {
      setName(detail.name);
      return;
    }
    startTransition(async () => {
      try {
        await renameOrg(detail.id, clean);
      } catch {
        setName(detail.name);
      }
    });
  };

  const invite = () => {
    if (!draft.trim()) return;
    const raw = draft;
    setDraft("");
    startTransition(async () => {
      try {
        const r = await inviteToOrg(detail.id, raw);
        const parts: string[] = [];
        if (r.invited > 0)
          parts.push(`${r.invited} inbjuden${r.invited === 1 ? "" : "a"}`);
        if (r.alreadyMember > 0) parts.push(`${r.alreadyMember} redan medlem`);
        if (r.alreadyInvited > 0)
          parts.push(`${r.alreadyInvited} redan inbjudna`);
        setFeedback({
          kind: r.invited > 0 ? "ok" : "err",
          text: parts.join(" · ") || "Inga giltiga e-poster.",
        });
        setTimeout(() => setFeedback(null), 4000);
        router.refresh();
      } catch {
        setFeedback({ kind: "err", text: "Kunde inte bjuda in." });
      }
    });
  };

  const removeInv = (id: number) => {
    setInvites((prev) => prev.filter((i) => i.id !== id));
    startTransition(() => {
      removeOrgInvite(detail.id, id).catch(() => {});
    });
  };

  const removeMem = (memberUserId: number, email: string) => {
    const isSelf = false; // server verifies access; using email for UX
    void isSelf;
    if (
      !confirm(
        `Ta bort ${email} från organisationen? De förlorar access till alla lag inom den.`
      )
    )
      return;
    setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
    startTransition(() => {
      removeOrgMember(detail.id, memberUserId).catch(() => {});
    });
  };

  return (
    <Card>
      <CardTitle>Aktuell organisation</CardTitle>

      <div className="mt-3 mb-5">
        <Label htmlFor="orgname">Namn</Label>
        <input
          id="orgname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setName(detail.name);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          maxLength={80}
        />
        <div className="text-xs text-neutral-500 mt-1">
          Sport: {detail.sport}
        </div>
      </div>

      <div className="text-xs uppercase tracking-wide text-neutral-600 font-medium mb-2">
        Medlemmar ({members.length})
      </div>
      <div className="divide-y divide-border">
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center justify-between py-2"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm">{m.email}</span>
            </div>
            <button
              type="button"
              onClick={() => removeMem(m.userId, m.email)}
              className="text-sm text-red-700 hover:underline px-2 py-1"
            >
              Ta bort
            </button>
          </div>
        ))}
      </div>

      {invites.length > 0 ? (
        <>
          <div className="text-xs uppercase tracking-wide text-neutral-600 font-medium mt-5 mb-2">
            Väntar på inloggning ({invites.length})
          </div>
          <div className="divide-y divide-border">
            {invites.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-sm">{i.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeInv(i.id)}
                  className="text-sm text-red-700 hover:underline px-2 py-1"
                >
                  Ta bort
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-5 pt-4 border-t border-border">
        <Label htmlFor="org-invite-emails">Bjud in via e-post</Label>
        <div className="flex gap-2">
          <input
            id="org-invite-emails"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                invite();
              }
            }}
            placeholder="foo@exempel.se, bar@exempel.se"
            className="flex-1 h-10 px-3 rounded-md border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={invite}
            className="h-10 px-4 rounded-md bg-primary text-white text-sm font-medium"
          >
            Bjud in
          </button>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Kommaseparera för flera. Nya användare skapas när de loggar in med
          sin e-post.
        </p>
        {feedback ? (
          <div
            className={`mt-2 text-sm ${
              feedback.kind === "ok" ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {feedback.text}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
