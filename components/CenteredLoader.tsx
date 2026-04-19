import { Spinner } from "@/components/Spinner";

export function CenteredLoader({ label = "Laddar…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-neutral-500">
      <Spinner size={28} />
      <span className="ml-3 text-sm">{label}</span>
    </div>
  );
}
