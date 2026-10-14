import type {
  BookingSource,
  InvoiceStatus,
  PaymentMethod,
  Priority,
  ReservationStatus,
  RoomStatus,
  ServiceCategory,
  TaskStatus,
  TaskType,
} from "@/generated/prisma/enums";
import { Badge, type BadgeTone } from "@/components/ui/primitives";

export const RESERVATION_STATUS: Record<ReservationStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "info" },
  CHECKED_IN: { label: "In house", tone: "success" },
  CHECKED_OUT: { label: "Checked out", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  NO_SHOW: { label: "No-show", tone: "violet" },
};

export const ROOM_STATUS: Record<RoomStatus, { label: string; tone: BadgeTone; dot: string }> = {
  CLEAN: { label: "Clean", tone: "success", dot: "bg-success" },
  INSPECTED: { label: "Inspected", tone: "info", dot: "bg-info" },
  DIRTY: { label: "Dirty", tone: "warning", dot: "bg-warning" },
  OUT_OF_ORDER: { label: "Out of order", tone: "danger", dot: "bg-danger" },
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "To do", tone: "warning" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  DONE: { label: "Done", tone: "success" },
};

export const TASK_TYPE: Record<TaskType, string> = {
  CHECKOUT_CLEAN: "Departure clean",
  STAYOVER: "Stayover service",
  INSPECTION: "Inspection",
  MAINTENANCE: "Maintenance",
  TURNDOWN: "Turndown",
};

export const PRIORITY: Record<Priority, { label: string; tone: BadgeTone }> = {
  LOW: { label: "Low", tone: "neutral" },
  NORMAL: { label: "Normal", tone: "neutral" },
  HIGH: { label: "High", tone: "danger" },
};

export const SOURCE_LABEL: Record<BookingSource, string> = {
  WEBSITE: "Website",
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  EMAIL: "Email",
  OTA: "Online travel agency",
  CORPORATE: "Corporate",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CARD: "Card",
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
};

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: BadgeTone }> = {
  ISSUED: { label: "Issued", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
  VOID: { label: "Void", tone: "neutral" },
};

export const SERVICE_CATEGORY: Record<ServiceCategory, string> = {
  DINING: "Dining",
  SPA: "Spa & wellness",
  ROOM_SERVICE: "Room service",
  MINIBAR: "Minibar",
  LAUNDRY: "Laundry",
  TRANSPORT: "Transport & tours",
  OTHER: "Other",
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const s = RESERVATION_STATUS[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const s = ROOM_STATUS[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = TASK_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
