"use client";

import { Plus, UserCog } from "lucide-react";
import { FormDialog } from "@/components/action-ui";
import { TASK_TYPE } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { assignTaskAction, createTaskAction } from "./actions";

type Staff = { id: string; name: string }[];

export function NewTaskDialog({ rooms, staff }: { rooms: { id: string; number: string }[]; staff: Staff }) {
  return (
    <FormDialog trigger={<Button><Plus /> New task</Button>} title="New housekeeping task" action={createTaskAction} submitLabel="Create task">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Room" htmlFor="t-room">
          <Select id="t-room" name="roomId" required defaultValue="">
            <option value="" disabled>Select…</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}
          </Select>
        </Field>
        <Field label="Type" htmlFor="t-type">
          <Select id="t-type" name="type" defaultValue="STAYOVER">
            {Object.entries(TASK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="t-prio">
          <Select id="t-prio" name="priority" defaultValue="NORMAL">
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </Select>
        </Field>
        <Field label="Assign to" htmlFor="t-who">
          <Select id="t-who" name="assignedToId" defaultValue="">
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="t-notes"><Input id="t-notes" name="notes" placeholder="E.g. Extra towels requested" /></Field>
    </FormDialog>
  );
}

export function AssignDialog({ id, staff, values }: { id: string; staff: Staff; values: { assignedToId: string; priority: string; notes: string } }) {
  return (
    <FormDialog
      trigger={<Button size="icon-sm" variant="ghost" aria-label="Assign task"><UserCog /></Button>}
      title="Assign task"
      action={assignTaskAction.bind(null, id)}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Assign to" htmlFor={`a-who-${id}`}>
          <Select id={`a-who-${id}`} name="assignedToId" defaultValue={values.assignedToId}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Priority" htmlFor={`a-prio-${id}`}>
          <Select id={`a-prio-${id}`} name="priority" defaultValue={values.priority}>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </Select>
        </Field>
      </div>
      <Field label="Notes" htmlFor={`a-notes-${id}`}><Input id={`a-notes-${id}`} name="notes" defaultValue={values.notes} /></Field>
    </FormDialog>
  );
}
