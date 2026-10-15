"use client";

import { Reply } from "lucide-react";
import { FormDialog } from "@/components/action-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/form";
import { replyReviewAction } from "./actions";

export function ReplyDialog({ id, guestName, response, published }: { id: string; guestName: string; response: string; published: boolean }) {
  const first = guestName.split(" ")[0];
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <Reply /> {response ? "Edit reply" : "Reply"}
        </Button>
      }
      title={response ? "Edit public reply" : "Reply publicly"}
      description="Your reply appears under the review on the website. Leave it empty to remove it."
      action={replyReviewAction.bind(null, id)}
      submitLabel="Save reply"
    >
      <Field label="Reply" htmlFor={`reply-${id}`}>
        <Textarea
          id={`reply-${id}`}
          name="response"
          rows={6}
          maxLength={2000}
          defaultValue={response || `Dear ${first},\n\nThank you for taking the time to share your experience. `}
        />
      </Field>
      {!published && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="publish" defaultChecked /> Publish the review together with the reply
        </label>
      )}
    </FormDialog>
  );
}
