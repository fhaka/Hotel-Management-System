"use client";

import { useState } from "react";
import { ArrowRightLeft, CalendarCog, ChevronDown, CreditCard, Mail, Plus, Undo2, X, XCircle } from "lucide-react";
import { ActionForm, FormDialog } from "@/components/action-ui";
import { ROOM_STATUS } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlay";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import {
  assignRoomAction,
  cancelAction,
  modifyStayAction,
  postChargeAction,
  recordPaymentAction,
  refundAction,
  sendEmailAction,
  updateDetailsAction,
  voidChargeAction,
} from "../actions";

export function ModifyStayDialog({
  id,
  inHouse,
  values,
  roomTypes,
}: {
  id: string;
  inHouse: boolean;
  values: { checkIn: string; checkOut: string; adults: number; children: number; roomTypeId: string };
  roomTypes: { id: string; name: string; maxAdults: number; maxChildren: number }[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          <CalendarCog /> Modify
        </Button>
      }
      title="Modify stay"
      description={inHouse ? "The guest is in house — you can extend or shorten the departure and change occupancy." : "Room charges and city tax are re-priced automatically."}
      action={modifyStayAction.bind(null, id)}
      submitLabel="Update stay"
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Check-in" htmlFor="m-in">
          <Input id="m-in" name="checkIn" type="date" defaultValue={values.checkIn} readOnly={inHouse} required />
        </Field>
        <Field label="Check-out" htmlFor="m-out">
          <Input id="m-out" name="checkOut" type="date" defaultValue={values.checkOut} required />
        </Field>
        <Field label="Adults" htmlFor="m-ad">
          <Input id="m-ad" name="adults" type="number" min={1} max={8} defaultValue={values.adults} required />
        </Field>
        <Field label="Children" htmlFor="m-ch">
          <Input id="m-ch" name="children" type="number" min={0} max={6} defaultValue={values.children} required />
        </Field>
      </div>
      {inHouse ? (
        <input type="hidden" name="roomTypeId" value={values.roomTypeId} />
      ) : (
        <Field label="Room type" htmlFor="m-rt">
          <Select id="m-rt" name="roomTypeId" defaultValue={values.roomTypeId}>
            {roomTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (max {t.maxAdults}+{t.maxChildren})
              </option>
            ))}
          </Select>
        </Field>
      )}
    </FormDialog>
  );
}

export function AssignRoomDialog({ id, currentRoomId, rooms }: { id: string; currentRoomId: string | null; rooms: { id: string; number: string; status: keyof typeof ROOM_STATUS }[] }) {
  const options = rooms.filter((r) => r.id !== currentRoomId);
  return (
    <FormDialog
      trigger={
        <button className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline">
          <ArrowRightLeft className="size-3" /> {currentRoomId ? "Move room" : "Assign room"}
        </button>
      }
      title={currentRoomId ? "Move to another room" : "Assign a room"}
      description="Only rooms of the same type that are free for the whole stay are listed."
      action={assignRoomAction.bind(null, id)}
      submitLabel="Assign"
    >
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">No other rooms of this type are free for these dates.</p>
      ) : (
        <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {options.map((r) => (
            <label key={r.id} className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input type="radio" name="roomId" value={r.id} className="sr-only" required />
              <span className="font-semibold">{r.number}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className={`size-1.5 rounded-full ${ROOM_STATUS[r.status].dot}`} /> {ROOM_STATUS[r.status].label}
              </span>
            </label>
          ))}
        </div>
      )}
    </FormDialog>
  );
}

export function CancelDialog({ id }: { id: string }) {
  return (
    <FormDialog
      trigger={
        <Button variant="danger-outline">
          <XCircle /> Cancel
        </Button>
      }
      title="Cancel reservation"
      description="Charges are voided. Within the cancellation window the first night is retained unless you waive it. Prepayments are refunded automatically."
      action={cancelAction.bind(null, id)}
      submitLabel="Cancel reservation"
      submitVariant="danger"
    >
      <Field label="Reason" htmlFor="c-reason">
        <Select id="c-reason" name="reason" defaultValue="Guest request">
          {["Guest request", "Change of travel plans", "Duplicate booking", "Payment not received", "Hotel request", "Other"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="waiveFee" /> Waive late-cancellation fee
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="notify" defaultChecked /> Email the guest a cancellation confirmation
      </label>
    </FormDialog>
  );
}

export function AddChargeDialog({ id, services }: { id: string; services: { id: string; name: string; price: number; category: string }[] }) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((s) => s.id === serviceId);
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <Plus /> Post charge
        </Button>
      }
      title="Post a charge"
      description="Add a service, an incidental or a discount to the guest's bill."
      action={postChargeAction.bind(null, id)}
      submitLabel="Post to folio"
    >
      <Field label="Item" htmlFor="pc-svc">
        <Select id="pc-svc" name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatMoney(s.price)}
            </option>
          ))}
          <option value="">Custom item or discount…</option>
        </Select>
      </Field>
      {!service && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Description" htmlFor="pc-desc" className="col-span-2">
            <Input id="pc-desc" name="description" placeholder="E.g. Damaged towel, Loyalty discount" required />
          </Field>
          <Field label="Type" htmlFor="pc-type">
            <Select id="pc-type" name="type" defaultValue="OTHER">
              <option value="OTHER">Charge</option>
              <option value="DISCOUNT">Discount (credit)</option>
            </Select>
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Quantity" htmlFor="pc-qty">
          <Input id="pc-qty" name="quantity" type="number" min={1} max={100} defaultValue={1} required />
        </Field>
        <Field label="Unit price (€)" htmlFor="pc-price">
          <Input key={serviceId} id="pc-price" name="unitPrice" type="number" step="0.01" min={0} defaultValue={service?.price ?? ""} required />
        </Field>
      </div>
    </FormDialog>
  );
}

export function VoidChargeButton({ chargeId, description }: { chargeId: string; description: string }) {
  return (
    <FormDialog
      trigger={
        <button className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-danger-soft hover:text-danger" aria-label={`Void ${description}`}>
          <X className="size-4" />
        </button>
      }
      title="Void charge"
      description={`"${description}" will be removed from the bill. This is recorded in the audit log.`}
      action={voidChargeAction.bind(null, chargeId)}
      submitLabel="Void charge"
      submitVariant="danger"
    >
      <Field label="Reason" htmlFor="v-reason">
        <Input id="v-reason" name="reason" placeholder="E.g. Posted in error" required minLength={3} />
      </Field>
    </FormDialog>
  );
}

type FormAction = (state: { error?: string; success?: string } | null, formData: FormData) => Promise<{ error?: string; success?: string } | null>;

export function PaymentDialog({ id, balance, action, label = "Take payment", description }: { id: string; balance: number; action?: FormAction; label?: string; description?: string }) {
  const [method, setMethod] = useState("CARD");
  const [terminal, setTerminal] = useState(false);
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <CreditCard /> {label}
        </Button>
      }
      title={label}
      description={description ?? `Outstanding balance: ${formatMoney(balance)}`}
      action={action ?? recordPaymentAction.bind(null, id)}
      submitLabel="Record payment"
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount (€)" htmlFor="p-amt">
          <Input id="p-amt" name="amount" type="number" step="0.01" min={0.01} defaultValue={balance > 0 ? balance.toFixed(2) : ""} required />
        </Field>
        <Field label="Method" htmlFor="p-method">
          <Select id="p-method" name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
          </Select>
        </Field>
      </div>
      {method === "CARD" && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={terminal} onChange={(e) => setTerminal(e.target.checked)} /> Charge a card now via the payment gateway (demo)
        </label>
      )}
      {method === "CARD" && terminal && (
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/60 p-3">
          <Field label="Card number" htmlFor="p-num" className="col-span-3">
            <Input id="p-num" name="cardNumber" defaultValue="4242 4242 4242 4242" className="font-mono" required />
          </Field>
          <Field label="Expiry" htmlFor="p-exp">
            <Input id="p-exp" name="cardExpiry" defaultValue="12/30" required />
          </Field>
          <Field label="CVC" htmlFor="p-cvc">
            <Input id="p-cvc" name="cardCvc" defaultValue="123" required />
          </Field>
          <Field label="Name" htmlFor="p-name">
            <Input id="p-name" name="cardName" />
          </Field>
        </div>
      )}
      <Field label="Note (optional)" htmlFor="p-note">
        <Input id="p-note" name="note" placeholder={method === "CARD" ? "E.g. POS terminal slip #1043" : "E.g. Receipt number"} />
      </Field>
    </FormDialog>
  );
}

export function RefundDialog({ id, max, suggested }: { id: string; max: number; suggested: number }) {
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <Undo2 /> Refund
        </Button>
      }
      title="Issue a refund"
      description={`Card payments are refunded to the original card. Up to ${formatMoney(max)} can be refunded.`}
      action={refundAction.bind(null, id)}
      submitLabel="Refund"
      submitVariant="danger"
    >
      <Field label="Amount (€)" htmlFor="r-amt">
        <Input id="r-amt" name="amount" type="number" step="0.01" min={0.01} max={max} defaultValue={suggested ? suggested.toFixed(2) : ""} required />
      </Field>
      <Field label="Reason" htmlFor="r-note">
        <Input id="r-note" name="note" defaultValue={suggested ? "Overpayment refund" : ""} placeholder="E.g. Goodwill gesture" required />
      </Field>
    </FormDialog>
  );
}

export function EmailMenu({ id, status, hasEmail }: { id: string; status: string; hasEmail: boolean }) {
  const send = async (kind: "confirmation" | "pre-arrival" | "cancellation" | "checkout") => {
    const r = await sendEmailAction(id, kind);
    if (r?.error) toast.error(r.error);
    else toast.success(r?.success ?? "Email sent.");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={!hasEmail} title={hasEmail ? undefined : "The guest has no email address"}>
          <Mail /> Email <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {["CONFIRMED", "PENDING", "CHECKED_IN"].includes(status) && <DropdownMenuItem onSelect={() => send("confirmation")}>Resend confirmation</DropdownMenuItem>}
        {["CONFIRMED", "PENDING"].includes(status) && <DropdownMenuItem onSelect={() => send("pre-arrival")}>Send pre-arrival email</DropdownMenuItem>}
        {status === "CANCELLED" && <DropdownMenuItem onSelect={() => send("cancellation")}>Resend cancellation</DropdownMenuItem>}
        {status === "CHECKED_OUT" && <DropdownMenuItem onSelect={() => send("checkout")}>Resend invoice</DropdownMenuItem>}
        {status === "NO_SHOW" && <DropdownMenuItem disabled>No emails for no-shows</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DetailsForm({ id, values }: { id: string; values: { specialRequests: string; internalNotes: string; estimatedArrival: string } }) {
  return (
    <ActionForm action={updateDetailsAction.bind(null, id)} className="space-y-4">
      <Field label="Estimated arrival" htmlFor="d-eta">
        <Input id="d-eta" name="estimatedArrival" defaultValue={values.estimatedArrival} placeholder="E.g. 16:00" />
      </Field>
      <Field label="Guest requests" htmlFor="d-req">
        <Textarea id="d-req" name="specialRequests" defaultValue={values.specialRequests} rows={3} />
      </Field>
      <Field label="Internal notes" htmlFor="d-notes" hint="Visible to staff only.">
        <Textarea id="d-notes" name="internalNotes" defaultValue={values.internalNotes} rows={3} />
      </Field>
      <SubmitButton size="sm" variant="outline">
        Save details
      </SubmitButton>
    </ActionForm>
  );
}
