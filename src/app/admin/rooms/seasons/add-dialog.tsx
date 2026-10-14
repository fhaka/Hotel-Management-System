"use client";

import { Plus } from "lucide-react";
import { FormDialog } from "@/components/action-ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { saveSeasonAction } from "../actions";

export function AddSeasonDialog({ roomTypes }: { roomTypes: { id: string; name: string }[] }) {
  return (
    <FormDialog trigger={<Button size="sm"><Plus /> Add season</Button>} title="Add a season" action={saveSeasonAction} submitLabel="Add season">
      <Field label="Name" htmlFor="s-name"><Input id="s-name" name="name" placeholder="E.g. Easter weekend" required /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="First night" htmlFor="s-start"><Input id="s-start" name="startDate" type="date" required /></Field>
        <Field label="Ends (exclusive)" htmlFor="s-end"><Input id="s-end" name="endDate" type="date" required /></Field>
        <Field label="Multiplier" htmlFor="s-mult" hint="1.20 = +20%, 0.85 = −15%"><Input id="s-mult" name="multiplier" type="number" step="0.01" min={0.3} max={3} defaultValue="1.20" required /></Field>
        <Field label="Room type" htmlFor="s-type">
          <Select id="s-type" name="roomTypeId" defaultValue="">
            <option value="">All room types</option>
            {roomTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
      </div>
    </FormDialog>
  );
}
