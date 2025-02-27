import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";
import { useProcessingState, useProjectActions } from "@/lib/store";
import { X } from "lucide-react";

export function Toast() {
  const { error } = useProcessingState();
  const { setError } = useProjectActions();

  return (
    <ToastPrimitive.Provider>
      <ToastPrimitive.Root
        open={!!error}
        onOpenChange={(open) => !open && setError(null)}
        className={cn(
          "fixed bottom-4 right-4 z-50",
          "rounded-lg shadow-lg",
          "bg-white border border-red-100",
          "data-[state=open]:animate-in",
          "data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0",
          "data-[state=open]:fade-in-0",
          "data-[state=closed]:slide-out-to-right-full",
          "data-[state=open]:slide-in-from-right-full",
        )}
      >
        <div className="grid gap-1 p-4">
          <ToastPrimitive.Title className="text-sm font-semibold text-red-900">
            Error in {error?.stage}
          </ToastPrimitive.Title>
          <ToastPrimitive.Description className="text-sm text-red-700">
            {error?.message}
          </ToastPrimitive.Description>
        </div>
        <ToastPrimitive.Close className="absolute right-1 top-1 rounded-lg p-1 text-red-500 opacity-70 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500">
          <X className="h-4 w-4" />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
      <ToastPrimitive.Viewport />
    </ToastPrimitive.Provider>
  );
} 