export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ai_usage_logs: {
        Row: {
          audio_seconds: number | null;
          created_at: string;
          estimated_cost_usd: number | null;
          id: string;
          input_tokens: number | null;
          model: string;
          operation: string;
          output_tokens: number | null;
          provider: string;
          session_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          audio_seconds?: number | null;
          created_at?: string;
          estimated_cost_usd?: number | null;
          id?: string;
          input_tokens?: number | null;
          model: string;
          operation: string;
          output_tokens?: number | null;
          provider: string;
          session_id?: string | null;
          user_id: string;
        };
        Update: {
          audio_seconds?: number | null;
          created_at?: string;
          estimated_cost_usd?: number | null;
          id?: string;
          input_tokens?: number | null;
          model?: string;
          operation?: string;
          output_tokens?: number | null;
          provider?: string;
          session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_session_id_user_id_fkey";
            columns: ["session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "ai_usage_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      assessments: {
        Row: {
          created_at: string;
          estimated_level: string | null;
          evidence: NonNullable<Json>;
          id: string;
          is_official: boolean;
          modality: string;
          rubric: NonNullable<Json>;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          estimated_level?: string | null;
          evidence?: NonNullable<Json>;
          id?: string;
          is_official?: boolean;
          modality: string;
          rubric?: NonNullable<Json>;
          user_id: string;
        };
        Update: {
          created_at?: string;
          estimated_level?: string | null;
          evidence?: NonNullable<Json>;
          id?: string;
          is_official?: boolean;
          modality?: string;
          rubric?: NonNullable<Json>;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      assignments: {
        Row: {
          created_at: string;
          due_at: string | null;
          estimated_minutes: number;
          id: string;
          instructions: string;
          kind: string;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          due_at?: string | null;
          estimated_minutes?: number;
          id?: string;
          instructions: string;
          kind: string;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          due_at?: string | null;
          estimated_minutes?: number;
          id?: string;
          instructions?: string;
          kind?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      audio_assets: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          duration_seconds: number | null;
          expires_at: string | null;
          id: string;
          mime_type: string | null;
          provider: string;
          session_id: string | null;
          storage_path: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          duration_seconds?: number | null;
          expires_at?: string | null;
          id?: string;
          mime_type?: string | null;
          provider: string;
          session_id?: string | null;
          storage_path?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          duration_seconds?: number | null;
          expires_at?: string | null;
          id?: string;
          mime_type?: string | null;
          provider?: string;
          session_id?: string | null;
          storage_path?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audio_assets_session_id_user_id_fkey";
            columns: ["session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "audio_assets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      consents: {
        Row: {
          consent_type: string;
          granted_at: string;
          id: string;
          revoked_at: string | null;
          user_id: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          consent_type: string;
          granted_at?: string;
          id?: string;
          revoked_at?: string | null;
          user_id: string;
          version: string;
        };
        Update: {
          consent_type?: string;
          granted_at?: string;
          id?: string;
          revoked_at?: string | null;
          user_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      error_patterns: {
        Row: {
          category: string;
          evidence: NonNullable<Json>;
          explanation_tr: string | null;
          id: string;
          last_seen_at: string;
          occurrence_count: number;
          pattern_key: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          evidence?: NonNullable<Json>;
          explanation_tr?: string | null;
          id?: string;
          last_seen_at?: string;
          occurrence_count?: number;
          pattern_key: string;
          user_id: string;
        };
        Update: {
          category?: string;
          evidence?: NonNullable<Json>;
          explanation_tr?: string | null;
          id?: string;
          last_seen_at?: string;
          occurrence_count?: number;
          pattern_key?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "error_patterns_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      learning_items: {
        Row: {
          category: string;
          created_at: string;
          due_at: string | null;
          example: string | null;
          fsrs_state: Json | null;
          id: string;
          last_reviewed_at: string | null;
          meaning_tr: string | null;
          normalized_phrase: string;
          phrase: string;
          source_context: string | null;
          source_message_id: string | null;
          source_session_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string;
          created_at?: string;
          due_at?: string | null;
          example?: string | null;
          fsrs_state?: Json | null;
          id?: string;
          last_reviewed_at?: string | null;
          meaning_tr?: string | null;
          normalized_phrase: string;
          phrase: string;
          source_context?: string | null;
          source_message_id?: string | null;
          source_session_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          due_at?: string | null;
          example?: string | null;
          fsrs_state?: Json | null;
          id?: string;
          last_reviewed_at?: string | null;
          meaning_tr?: string | null;
          normalized_phrase?: string;
          phrase?: string;
          source_context?: string | null;
          source_message_id?: string | null;
          source_session_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_items_source_message_id_user_id_fkey";
            columns: ["source_message_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "learning_items_source_session_id_user_id_fkey";
            columns: ["source_session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "learning_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      messages: {
        Row: {
          client_message_id: string | null;
          content: string;
          created_at: string;
          id: string;
          modality: string;
          role: string;
          sequence_number: number;
          session_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_message_id?: string | null;
          content: string;
          created_at?: string;
          id?: string;
          modality?: string;
          role: string;
          sequence_number: number;
          session_id: string;
          user_id: string;
        };
        Update: {
          client_message_id?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          modality?: string;
          role?: string;
          sequence_number?: number;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_session_id_user_id_fkey";
            columns: ["session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          channels: string[];
          enabled: boolean;
          reminder_time: string | null;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          channels?: string[];
          enabled?: boolean;
          reminder_time?: string | null;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          channels?: string[];
          enabled?: boolean;
          reminder_time?: string | null;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          daily_minutes: number;
          dialect: string;
          display_name: string | null;
          feedback_mode: string;
          goals: string[];
          interests: string[];
          native_language: string;
          onboarding_completed_at: string | null;
          purpose: string | null;
          target_language: string;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          daily_minutes?: number;
          dialect?: string;
          display_name?: string | null;
          feedback_mode?: string;
          goals?: string[];
          interests?: string[];
          native_language?: string;
          onboarding_completed_at?: string | null;
          purpose?: string | null;
          target_language?: string;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          daily_minutes?: number;
          dialect?: string;
          display_name?: string | null;
          feedback_mode?: string;
          goals?: string[];
          interests?: string[];
          native_language?: string;
          onboarding_completed_at?: string | null;
          purpose?: string | null;
          target_language?: string;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pronunciation_attempts: {
        Row: {
          created_at: string;
          id: string;
          locale: string;
          private_audio_path: string | null;
          reference_text: string;
          result: Json | null;
          session_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          locale?: string;
          private_audio_path?: string | null;
          reference_text: string;
          result?: Json | null;
          session_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          locale?: string;
          private_audio_path?: string | null;
          reference_text?: string;
          result?: Json | null;
          session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pronunciation_attempts_session_id_user_id_fkey";
            columns: ["session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "pronunciation_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          created_at: string;
          endpoint: string;
          id: string;
          keys: NonNullable<Json>;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          endpoint: string;
          id?: string;
          keys: NonNullable<Json>;
          user_id: string;
        };
        Update: {
          created_at?: string;
          endpoint?: string;
          id?: string;
          keys?: NonNullable<Json>;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      review_logs: {
        Row: {
          ai_suggested_grade: number | null;
          client_request_id: string | null;
          grade: number;
          id: string;
          learning_item_id: string;
          next_state: NonNullable<Json>;
          previous_state: NonNullable<Json>;
          response_text: string | null;
          reviewed_at: string;
          session_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          ai_suggested_grade?: number | null;
          client_request_id?: string | null;
          grade: number;
          id?: string;
          learning_item_id: string;
          next_state: NonNullable<Json>;
          previous_state: NonNullable<Json>;
          response_text?: string | null;
          reviewed_at?: string;
          session_id?: string | null;
          user_id: string;
        };
        Update: {
          ai_suggested_grade?: number | null;
          client_request_id?: string | null;
          grade?: number;
          id?: string;
          learning_item_id?: string;
          next_state?: NonNullable<Json>;
          previous_state?: NonNullable<Json>;
          response_text?: string | null;
          reviewed_at?: string;
          session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_logs_learning_item_id_user_id_fkey";
            columns: ["learning_item_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "learning_items";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "review_logs_session_id_user_id_fkey";
            columns: ["session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      scenarios: {
        Row: {
          category: string;
          difficulty: string;
          duration_options: number[];
          goals: NonNullable<Json>;
          id: string;
          is_active: boolean;
          persona: NonNullable<Json>;
          rubric: NonNullable<Json>;
          slug: string;
          summary: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          difficulty?: string;
          duration_options?: number[];
          goals?: NonNullable<Json>;
          id?: string;
          is_active?: boolean;
          persona?: NonNullable<Json>;
          rubric?: NonNullable<Json>;
          slug: string;
          summary?: string;
          title: string;
        };
        Update: {
          category?: string;
          difficulty?: string;
          duration_options?: number[];
          goals?: NonNullable<Json>;
          id?: string;
          is_active?: boolean;
          persona?: NonNullable<Json>;
          rubric?: NonNullable<Json>;
          slug?: string;
          summary?: string;
          title?: string;
        };
        Relationships: [];
      };
      session_feedback: {
        Row: {
          analyzer_version: string;
          created_at: string;
          id: string;
          payload: NonNullable<Json>;
          session_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          analyzer_version: string;
          created_at?: string;
          id?: string;
          payload: NonNullable<Json>;
          session_id: string;
          user_id: string;
        };
        Update: {
          analyzer_version?: string;
          created_at?: string;
          id?: string;
          payload?: NonNullable<Json>;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_feedback_session_id_user_id_fkey";
            columns: ["session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      sessions: {
        Row: {
          ended_at: string | null;
          id: string;
          metadata: NonNullable<Json>;
          mode: string;
          scenario_id: string | null;
          started_at: string;
          status: string;
          summary: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          ended_at?: string | null;
          id?: string;
          metadata?: NonNullable<Json>;
          mode: string;
          scenario_id?: string | null;
          started_at?: string;
          status?: string;
          summary?: string | null;
          user_id: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          metadata?: NonNullable<Json>;
          mode?: string;
          scenario_id?: string | null;
          started_at?: string;
          status?: string;
          summary?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_scenario_id_fkey";
            columns: ["scenario_id"];
            isOneToOne: false;
            referencedRelation: "scenarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      submissions: {
        Row: {
          answer_text: string | null;
          assignment_id: string;
          feedback: Json | null;
          id: string;
          private_audio_path: string | null;
          submitted_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answer_text?: string | null;
          assignment_id: string;
          feedback?: Json | null;
          id?: string;
          private_audio_path?: string | null;
          submitted_at?: string;
          user_id: string;
        };
        Update: {
          answer_text?: string | null;
          assignment_id?: string;
          feedback?: Json | null;
          id?: string;
          private_audio_path?: string | null;
          submitted_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_user_id_fkey";
            columns: ["assignment_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
