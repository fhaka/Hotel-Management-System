"use client";

import { ChevronDown, Mail, Pencil, XCircle } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/action-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlay";
import { cancelGroupAction, groupEmailAction, updateGroupAction } from "../actions";

export function EditGroupDialog({
  id,
  values,
  companies,
  invoiced,
}: {
  id: string;
  values: { name: string; companyId: string; singleBill: boolean; notes: string };
  companies: { id: string; name: string; taxId: string | null }[];
  invoiced: boolean;
}) {
  return (
    <FormDialog trigger={<Button variant="outline"><Pencil /> Edit group</Button>} title="Edit group" action={updateGroupAction.bind(null, id)}>
      <Field label="Group name" htmlFor="g-name">
        <Input id="g-name" name="name" defaultValue={values.name} required />
      </Field>
      <Field label="Invoice to" htmlFor="g-company" hint="Leave on the booker for private groups. Manage companies under Front office → Companies.">
        <Select id="g-company" name="companyId" defaultValue={values.companyId}>
          <option value="">The booker (private)</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.taxId ? ` · ${c.taxId}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox name="singleBill" defaultChecked={values.singleBill} disabled={invoiced} className="mt-0.5" />
        <span>
          One bill for the whole group
          <span className="block text-xs text-muted-foreground">Rooms can check out with open charges; the group is settled and invoiced when the last room leaves.</span>
        </span>
      </label>
      {invoiced && <input type="hidden" name="singleBill" value="on" />}
      <Field label="Group notes" htmlFor="g-notes">
        <Textarea id="g-notes" name="notes" defaultValue={values.notes} rows={3} />
      </Field>
    </FormDialog>
  );
}

export function CancelGroupDialog({ id, rooms }: { id: string; rooms: number }) {
  return (
    <FormDialog
      trigger={<Button variant="danger-outline"><XCircle /> Cancel group</Button>}
      title={`Cancel ${rooms} upcoming rooms`}
      description="Every upcoming room is cancelled. Late cancellations retain each room's first night unless waived; prepayments are refunded automatically."
      action={cancelGroupAction.bind(null, id)}
      submitLabel="Cancel rooms"
      submitVariant="danger"
    >
      <Field label="Reason" htmlFor="cg-reason">
        <Select id="cg-reason" name="reason" defaultValue="Group cancelled by organiser">
          {["Group cancelled by organiser", "Event cancelled", "Change of travel plans", "Payment not received", "Hotel request", "Other"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm"><Checkbox name="waiveFee" /> Waive late-cancellation fees</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox name="notify" defaultChecked /> Email the booker a cancellation confirmation</label>
    </FormDialog>
  );
}

export function GroupEmailMenu({ id, hasEmail, upcoming, departed }: { id: string; hasEmail: boolean; upcoming: boolean; departed: boolean }) {
  const send = async (kind: "confirmation" | "pre-arrival" | "checkout") => {
    const r = await groupEmailAction(id, kind);
    if (r?.error) toast.error(r.error);
    else toast.success(r?.success ?? "Email sent.");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={!hasEmail}>
          <Mail /> Email <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => send("confirmation")}>Resend group confirmation</DropdownMenuItem>
        {upcoming && <DropdownMenuItem onSelect={() => send("pre-arrival")}>Send pre-arrival email</DropdownMenuItem>}
        {departed && <DropdownMenuItem onSelect={() => send("checkout")}>Resend group invoice</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
