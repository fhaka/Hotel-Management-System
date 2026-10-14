import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { NewGuestForm } from "./form";

export const metadata: Metadata = { title: "New guest" };

export default async function NewGuestPage() {
  await requireStaff("guests");
  return (
    <>
      <PageHeader back={{ href: "/admin/guests", label: "Guests" }} title="New guest" />
      <Card className="max-w-3xl">
        <CardBody>
          <NewGuestForm />
        </CardBody>
      </Card>
    </>
  );
}
