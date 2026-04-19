import { Spinner } from "@/components/Spinner";

export default function AppLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-neutral-500">
      <Spinner size={28} />
      <span className="ml-3 text-sm">Laddar…</span>
    </div>
  );
}
