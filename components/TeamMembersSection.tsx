"use client";

import { useState, useTransition } from "react";
import {
  inviteToTeam,
  removeInvite,
  removeMember,
} from "@/app/(app)/teams/actions";

type Member = {
  userId: number;
  email: string;
  joinedAt: string;
};

type Invite = {
  id: number;
  email: string;
  invitedByEmail: string | null;
  createdAt: string;
};

export function TeamMembersSection({
  teamId,
  currentUserId,
  initialMembers,
  initialInvites,
}: {
  teamId: number;
  currentUserId: number;
  initialMembers: Member[];
  initialInvites: Invite[];
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<null | {
    kind: "ok" | "err";
    text: string;
  }>(null);
  const [, startTransition] = useTransition();

  const submit = () => {
    if (!draft.trim()) return;
    const raw = draft;
    setDraft("");
    startTransition(async () => {
      try {
        const result = await inviteToTeam(teamId, raw);
        const parts: string[] = [];
        if (result.invited > 0) parts.push(`${result.invited} inbjuden${result.invited === 1 ? "" : "a"}`);
        if (result.alreadyMember > 0)
          parts.push(`${result.alreadyMember} redan medlem`);
        if (result.alreadyInvited > 0)
          parts.push(`${result.alreadyInvited} redan inbjudna`);
        setFeedback({
          kind: result.invited > 0 ? "ok" : "err",
          text: parts.length > 0 ? parts.join(" · ") : "Inga giltiga e-poster.",
        });
        // Optimistic update: add invites to local state. Real data syncs via
        // revalidatePath on next navigation.
        const emails = raw
          .split(/[\s,;]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
        const existingEmails = new Set([
          ...members.map((m) => m.email),
          ...invites.map((i) => i.email),
        ]);
        const newInvites = emails
          .filter((e) => !existingEmails.has(e))
          .map<Invite>((email) => ({
            id: -Date.now() - Math.floor(Math.random() * 1000),
            email,
            invitedByEmail: null,
            createdAt: new Date().toISOString(),
          }));
        if (newInvites.length > 0) setInvites((prev) => [...prev, ...newInvites]);
        setTimeout(() => setFeedback(null), 4000);
      } catch {
        setFeedback({ kind: "err", text: "Kunde inte bjuda in." });
      }
    });
  };

  const removeInv = (inviteId: number) => {
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    startTransition(() => {
      removeInvite(teamId, inviteId).catch(() => {});
    });
  };

  const removeMem = (memberUserId: number, email: string) => {
    const isSelf = memberUserId === currentUserId;
    const msg = isSelf
      ? "Lämna laget? Du förlorar access."
      : `Ta bort ${email} från laget?`;
    if (!confirm(msg)) return;
    setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
    startTransition(() => {
      removeMember(teamId, memberUserId).catch(() => {});
      if (isSelf) {
        // Self-leave navigates away
        window.location.href = "/teams";
      }
    });
  };

  return (
    <div>
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-neutral-600 font-medium">
          Medlemmar ({members.length})
        </div>
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center justify-between py-2 border-t border-border"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm">{m.email}</span>
              {m.userId === currentUserId ? (
                <span className="text-xs text-neutral-500">(du)</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => removeMem(m.userId, m.email)}
              className="text-sm text-red-700 hover:underline px-3 py-1 min-h-[36px]"
            >
              {m.userId === currentUserId ? "Lämna" : "Ta bort"}
            </button>
          </div>
        ))}

        {invites.length > 0 ? (
          <>
            <div className="text-xs uppercase tracking-wide text-neutral-600 font-medium mt-5">
              Väntar på att logga in ({invites.length})
            </div>
            {invites.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between py-2 border-t border-border"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-sm">{i.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeInv(i.id)}
                  className="text-sm text-red-700 hover:underline px-3 py-1 min-h-[36px]"
                >
                  Ta bort
                </button>
              </div>
            ))}
          </>
        ) : null}
      </div>

      <div className="mt-5 pt-4 border-t border-border">
        <label
          htmlFor="invite-emails"
          className="text-xs uppercase tracking-wide text-neutral-600 font-medium mb-1 block"
        >
          Bjud in via e-post
        </label>
        <div className="flex gap-2">
          <input
            id="invite-emails"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="foo@exempel.se, bar@exempel.se"
            className="flex-1 h-10 px-3 rounded-md border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            type="button"
            onClick={submit}
            className="h-10 px-4 rounded-md bg-primary text-white text-sm font-medium hover:opacity-90"
          >
            Bjud in
          </button>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Kommaseparera för flera. Ett mejl skickas till varje — de får access
          när de loggar in med den e-posten.
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
    </div>
  );
}
