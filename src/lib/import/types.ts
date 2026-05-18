/** Bloomerang import — kind, target fields per kind, and shared types. */

export type ImportKindLower = "constituents" | "transactions" | "interactions";

export const IMPORT_KIND_TO_ENUM: Record<ImportKindLower, "CONSTITUENTS" | "TRANSACTIONS" | "INTERACTIONS"> = {
  constituents: "CONSTITUENTS",
  transactions: "TRANSACTIONS",
  interactions: "INTERACTIONS",
};

export type TargetField = {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
};

/** Target field per import kind. The wizard renders one row per field and
 *  the user maps each one to a CSV column. */
export const TARGET_FIELDS: Record<ImportKindLower, TargetField[]> = {
  constituents: [
    { key: "bloomerangId", label: "Constituent ID", required: true, hint: "Used to de-dupe on re-runs." },
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name", required: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "organization", label: "Organization" },
    { key: "donorStatus", label: "Donor status", hint: "Maps Bloomerang's status to Active / Lapsed / Major Donor." },
    { key: "dateAdded", label: "Date created" },
    { key: "lastContactAt", label: "Last engagement date" },
    { key: "lastGiftDate", label: "Last gift date", hint: "Used to seed convertedToDonorAt if Transactions aren't imported yet." },
    { key: "lifetimeAmount", label: "Lifetime giving" },
    { key: "notes", label: "Notes / tags" },
  ],
  transactions: [
    { key: "bloomerangId", label: "Transaction ID", required: true, hint: "Used to de-dupe on re-runs." },
    { key: "constituentBloomerangId", label: "Constituent ID", required: true, hint: "Matched against the people you imported in step 1." },
    { key: "date", label: "Date", required: true },
    { key: "amount", label: "Amount", required: true },
    { key: "paymentMethod", label: "Payment method" },
    { key: "campaignName", label: "Fund / Campaign", hint: "Created automatically if it doesn't exist." },
    { key: "notes", label: "Note" },
  ],
  interactions: [
    { key: "bloomerangId", label: "Interaction ID", required: true },
    { key: "constituentBloomerangId", label: "Constituent ID", required: true },
    { key: "date", label: "Date", required: true },
    { key: "channel", label: "Channel / Type", hint: "Phone, Email, Meeting, Mail, Text, Event." },
    { key: "purpose", label: "Purpose / Subject" },
    { key: "notes", label: "Note" },
  ],
};

export type Mapping = Record<string, string | null>;

export type ImportInput = {
  kind: ImportKindLower;
  filename: string;
  centerId: string | null; // required for constituents
  mapping: Mapping;
  rows: Record<string, unknown>[];
  dryRun: boolean;
};

export type ImportResult = {
  ok: true;
  dryRun: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: { rowIndex: number; bloomerangId?: string; message: string }[];
  // Examples to show in the preview UI
  sampleCreated?: { firstName?: string; lastName?: string; amount?: number; date?: string }[];
} | {
  ok: false;
  error: string;
};
