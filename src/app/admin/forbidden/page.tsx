import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export default function ForbiddenPage() {
  return (
    <Card>
      <EmptyState
        icon={<ShieldAlert />}
        title="You don't have access to this page"
        description="Your role doesn't include this area. Ask an administrator if you need access."
        action={<ButtonLink href="/admin">Back to dashboard</ButtonLink>}
      />
    </Card>
  );
}
