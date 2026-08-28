export type EventStatus = "draft" | "in_progress" | "finished";
export type PresentationStatus = "aguardando" | "em_andamento" | "encerrada";
export type ActorType = "admin" | "judge" | "system";

// Nota: usar `type` (não `interface`) para as linhas das tabelas — o parser
// de tipos do postgrest-js não resolve corretamente tipos declarados como
// `interface` dentro do generic Database, resultando em `never`.
export type EventRow = {
  id: string;
  name: string;
  status: EventStatus;
  admin_user_id: string;
  current_presentation_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ParticipantRow = {
  id: string;
  event_id: string;
  name: string;
  display_order: number;
  created_at: string;
};

export type JudgeRow = {
  id: string;
  event_id: string;
  name: string;
  access_token: string;
  created_at: string;
};

export type PresentationRow = {
  id: string;
  event_id: string;
  participant_id: string;
  status: PresentationStatus;
  started_at: string | null;
  closed_at: string | null;
  reopened_at: string | null;
  created_at: string;
};

export type VoteRow = {
  id: string;
  presentation_id: string;
  judge_id: string;
  score: number;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
};

export type VoteReceiptRow = {
  presentation_id: string;
  judge_id: string;
  voted_at: string;
};

export type AuditLogRow = {
  id: string;
  event_id: string;
  actor_type: ActorType;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      events: TableDef<EventRow>;
      participants: TableDef<ParticipantRow>;
      judges: TableDef<JudgeRow>;
      presentations: TableDef<PresentationRow>;
      votes: TableDef<VoteRow>;
      vote_receipts: TableDef<VoteReceiptRow>;
      audit_logs: TableDef<AuditLogRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
