"use client";

import { KeyRound, Pencil, UserPlus } from "lucide-react";
import { FormDialog } from "@/components/action-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { createStaffAction, resetPasswordAction, updateStaffAction } from "./actions";

function RoleSelect({ id, value }: { id: string; value?: string }) {
  return (
    <Select id={id} name="role" defaultValue={value ?? "RECEPTIONIST"}>
      <option value="ADMIN">Administrator</option>
      <option value="MANAGER">Manager</option>
      <option value="RECEPTIONIST">Receptionist</option>
      <option value="HOUSEKEEPING">Housekeeping</option>
    </Select>
  );
}

export function NewStaffDialog() {
  return (
    <FormDialog trigger={<Button><UserPlus /> Add staff member</Button>} title="Add staff member" description="They can sign in immediately with the temporary password you set." action={createStaffAction} submitLabel="Create account">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name" htmlFor="ns-name" className="col-span-2"><Input id="ns-name" name="name" required /></Field>
        <Field label="Work email" htmlFor="ns-email"><Input id="ns-email" name="email" type="email" required /></Field>
        <Field label="Phone" htmlFor="ns-phone"><Input id="ns-phone" name="phone" /></Field>
        <Field label="Role" htmlFor="ns-role"><RoleSelect id="ns-role" /></Field>
        <Field label="Temporary password" htmlFor="ns-pw" hint="8+ characters with a number"><Input id="ns-pw" name="password" type="password" autoComplete="new-password" required /></Field>
      </div>
    </FormDialog>
  );
}

export function EditStaffDialog({ user }: { user: { id: string; name: string; phone: string; role: string; active: boolean } }) {
  return (
    <FormDialog trigger={<Button size="icon-sm" variant="ghost" aria-label={`Edit ${user.name}`}><Pencil /></Button>} title={`Edit ${user.name}`} action={updateStaffAction.bind(null, user.id)}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name" htmlFor={`es-name-${user.id}`} className="col-span-2"><Input id={`es-name-${user.id}`} name="name" defaultValue={user.name} required /></Field>
        <Field label="Phone" htmlFor={`es-phone-${user.id}`}><Input id={`es-phone-${user.id}`} name="phone" defaultValue={user.phone} /></Field>
        <Field label="Role" htmlFor={`es-role-${user.id}`}><RoleSelect id={`es-role-${user.id}`} value={user.role} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><Checkbox name="active" defaultChecked={user.active} /> Account active (can sign in)</label>
    </FormDialog>
  );
}

export function ResetPasswordDialog({ id, name }: { id: string; name: string }) {
  return (
    <FormDialog trigger={<Button size="icon-sm" variant="ghost" aria-label={`Reset password for ${name}`}><KeyRound /></Button>} title={`Reset password for ${name}`} action={resetPasswordAction.bind(null, id)} submitLabel="Reset password">
      <Field label="New password" htmlFor={`rp-${id}`} hint="8+ characters with a number"><Input id={`rp-${id}`} name="password" type="password" autoComplete="new-password" required /></Field>
    </FormDialog>
  );
}
