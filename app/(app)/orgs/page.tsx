import Link from "next/link";
import type { Metadata } from "next";
import { currentOrgId } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";
import { Card, CardTitle } from "@/components/ui/Card";
import { createOrg, getOrgDetail, listMyOrgs } from "./actions";
import { OrgsList } from "@/components/OrgsList";
import { OrgDetailPanel } from "@/components/OrgDetailPanel";

export const metadata: Metadata = {
  title: "Organisation",
};

export default async function OrgsPage() {
  const current = await currentOrgId();
  const orgs = await listMyOrgs();
  const detail = await getOrgDetail(current);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Organisation</h1>

      <div className="grid md:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          {detail ? <OrgDetailPanel detail={detail} /> : null}

          <Card>
            <CardTitle>Alla organisationer du tillhör</CardTitle>
            <OrgsList orgs={orgs} />
          </Card>
        </div>

        <div>
          <Card>
            <CardTitle>Ny organisation</CardTitle>
            <form action={createOrg} className="mt-3">
              <Field>
                <Label htmlFor="name">Namn</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="t.ex. HBIF P16"
                />
              </Field>
              <Field>
                <Label htmlFor="sport">Sport</Label>
                <select
                  id="sport"
                  name="sport"
                  defaultValue="fotboll"
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="fotboll">Fotboll</option>
                </select>
              </Field>
              <Button type="submit" className="w-full">
                Skapa
              </Button>
              <p className="text-xs text-neutral-600 mt-3">
                Du blir ägare. Du kan bjuda in andra efteråt.
              </p>
            </form>
          </Card>

          <div className="mt-4 text-sm">
            <Link
              href="/dashboard"
              className="text-neutral-600 hover:underline"
            >
              ← Tillbaka till översikten
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
