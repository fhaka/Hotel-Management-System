import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { isDemoMode } from "@/lib/demo";
import { isDemoPayments } from "@/lib/payments";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireStaff("settings");
  const [s, emails, emailStats] = await Promise.all([
    getSettings(),
    db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    db.emailLog.groupBy({ by: ["status"], _count: true }),
  ]);
  const failed = emailStats.find((e) => e.status === "FAILED")?._count ?? 0;
  return (
    <>
      <PageHeader title="Settings" description="Hotel details, taxes and policies used across the website, invoices and emails." />
      <div className="grid gap-6 [&>*]:min-w-0 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader title="Hotel profile & policies" />
          <CardBody>
            <SettingsForm values={{ ...s, vatRate: String(s.vatRate), cityTaxPerPersonNight: String(s.cityTaxPerPersonNight), freeCancellationHours: String(s.freeCancellationHours) }} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Integrations" />
            <CardBody className="space-y-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Payments</p>
                  <p className="text-muted-foreground">{isDemoPayments() ? "Demo gateway — card payments are simulated. Connect Stripe by setting PAYMENT_PROVIDER and keys." : `Live provider: ${process.env.PAYMENT_PROVIDER}`}</p>
                </div>
                <Badge tone={isDemoPayments() ? "warning" : "success"}>{isDemoPayments() ? "Demo" : "Live"}</Badge>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Email (SMTP)</p>
                  <p className="text-muted-foreground">{process.env.SMTP_HOST}:{process.env.SMTP_PORT} {process.env.SMTP_HOST === "localhost" ? "— local Mailpit inbox at http://localhost:8025" : ""}</p>
                </div>
                <Badge tone={failed ? "danger" : "success"}>{failed ? `${failed} failed` : "OK"}</Badge>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Demo mode</p>
                  <p className="text-muted-foreground">Shows one-click demo logins and test-card hints. Disable with DEMO_MODE=&quot;false&quot;.</p>
                </div>
                <Badge tone={isDemoMode() ? "warning" : "neutral"}>{isDemoMode() ? "On" : "Off"}</Badge>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent emails" />
            <Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id}>
                    <Td>
                      <p className="max-w-64 truncate text-sm">{e.subject}</p>
                      <p className="text-xs text-muted-foreground">{e.to} · {formatDateTime(e.createdAt)}</p>
                    </Td>
                    <Td><Badge tone={e.status === "SENT" ? "success" : "danger"} title={e.error ?? undefined}>{e.status === "SENT" ? "Sent" : "Failed"}</Badge></Td>
                  </tr>
                ))}
                {emails.length === 0 && (
                  <tr><Td colSpan={2} className="text-muted-foreground">No emails sent yet.</Td></tr>
                )}
              </tbody>
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
