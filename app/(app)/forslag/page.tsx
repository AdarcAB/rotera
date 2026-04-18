import type { Metadata } from "next";
import { listFeatures } from "./actions";
import { FeaturesBoard } from "@/components/FeaturesBoard";

export const metadata: Metadata = {
  title: "Förslag",
};

export default async function ForslagPage() {
  const features = await listFeatures();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Förslag & röstning</h1>
      <p className="text-sm text-neutral-700 mb-6 max-w-2xl">
        Hjälp oss prioritera. Rösta på idéer du vill se, eller föreslå egna.
        Max en röst per förslag, obegränsat antal förslag att rösta på. Vi
        implementerar från toppen och ner.
      </p>
      <FeaturesBoard initialFeatures={features} />
    </div>
  );
}
