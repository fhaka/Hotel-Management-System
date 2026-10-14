"use client";

import { Dialog as D, DropdownMenu as M } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-primary/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-2xl focus:outline-none",
          className,
        )}
      >
        <div className="mb-5 pr-8">
          <D.Title className="font-serif text-xl text-foreground">{title}</D.Title>
          {description ? (
            <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{title}</D.Description>
          )}
        </div>
        {children}
        <D.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({ children, align = "end", className }: { children: React.ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className={cn("z-50 min-w-48 rounded-lg border border-border bg-white p-1 shadow-lg", className)}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return <M.Label className="px-2.5 py-1.5 text-xs text-muted-foreground">{children}</M.Label>;
}

export function DropdownMenuSeparator() {
  return <M.Separator className="my-1 h-px bg-border" />;
}
