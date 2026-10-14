import type { Metadata } from "next";
import { Check, Inbox, Mail, Phone, RotateCcw } from "lucide-react";
import { ActionButton } from "@/components/action-ui";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { toggleMessageAction } from "./actions";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff("messages");
  const { show } = await searchParams;
  const all = show === "all";
  const messages = await db.contactMessage.findMany({ where: all ? {} : { handled: false }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader
        title="Messages"
        description="Enquiries sent through the website contact form."
        actions={<ButtonLink href={all ? "/admin/messages" : "/admin/messages?show=all"} variant="outline">{all ? "Show open only" : "Show all"}</ButtonLink>}
      />
      {messages.length === 0 ? (
        <Card><EmptyState icon={<Inbox />} title="Inbox zero" description="There are no open enquiries." /></Card>
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <Card key={m.id} className={m.handled ? "opacity-70" : ""}>
              <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{m.subject}</p>
                    {m.handled ? <Badge tone="success">Handled</Badge> : <Badge tone="warning">Open</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {m.name} · {formatDateTime(m.createdAt)}
                  </p>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{m.message}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Mail className="size-4" /> {m.email}</span>
                    {m.phone && <span className="flex items-center gap-1.5"><Phone className="size-4" /> {m.phone}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <ButtonLink href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} variant="outline" size="sm">
                    <Mail /> Reply
                  </ButtonLink>
                  <ActionButton size="sm" variant={m.handled ? "ghost" : "default"} action={toggleMessageAction.bind(null, m.id, !m.handled)}>
                    {m.handled ? <><RotateCcw /> Reopen</> : <><Check /> Mark handled</>}
                  </ActionButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
