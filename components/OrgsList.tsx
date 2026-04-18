"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchOrg } from "@/app/(app)/orgs/actions";
import type { OrgListItem } from "@/app/(app)/orgs/actions";

export function OrgsList({ orgs }: { orgs: OrgListItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const pick = (id: number) => {
    startTransition(async () => {
      await switchOrg(id);
      router.refresh();
    });
  };

  return (
    <ul className="mt-3 divide-y divide-border">
      {orgs.map((o) => (
        <li
          key={o.id}
          className="py-2 flex items-center justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{o.name}</span>
              {o.isCurrent ? (
                <span className="text-xs bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded">
                  Aktiv
                </span>
              ) : null}
            </div>
            <div className="text-xs text-neutral-600">
              {o.sport} · {o.memberCount} medlem{o.memberCount !== 1 ? "mar" : ""} ·{" "}
              {o.teamCount} lag
            </div>
          </div>
          {o.isCurrent ? null : (
            <button
              type="button"
              onClick={() => pick(o.id)}
              className="text-sm h-9 px-3 rounded-md border border-border hover:bg-neutral-50"
            >
              Byt till
            </button>
          )}
        </li>
      ))}
      {orgs.length === 0 ? (
        <li className="py-2 text-sm text-neutral-600">
          Du tillhör ingen organisation än.
        </li>
      ) : null}
    </ul>
  );
}
