"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/Spinner";
import type { ComponentProps, ReactNode } from "react";

type ButtonProps = ComponentProps<typeof Button>;

export function SubmitButton({
  children,
  pendingLabel,
  ...rest
}: Omit<ButtonProps, "type"> & {
  children: ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...rest} disabled={pending || rest.disabled}>
      {pending ? (
        <>
          <Spinner className="mr-2" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
