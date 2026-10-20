export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_usage: {
        Row: {
          count: number;
          created_at: string;
          day: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          count?: number;
          created_at?: string;
          day: string;
          user_id?: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          day?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      alert_log: {
        Row: {
          created_at: string;
          night: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          night: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          night?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      assessments: {
        Row: {
          class_session_id: string | null;
          course_id: string;
          created_at: string;
          id: string;
          on_date: string | null;
          session_number: number | null;
          source: string;
          title: string;
          user_id: string;
          weight: number | null;
          weight_assumed: boolean;
        };
        ComputedFields: never;
        Insert: {
          class_session_id?: string | null;
          course_id: string;
          created_at?: string;
          id?: string;
          on_date?: string | null;
          session_number?: number | null;
          source: string;
          title: string;
          user_id?: string;
          weight?: number | null;
          weight_assumed?: boolean;
        };
        Update: {
          class_session_id?: string | null;
          course_id?: string;
          created_at?: string;
          id?: string;
          on_date?: string | null;
          session_number?: number | null;
          source?: string;
          title?: string;
          user_id?: string;
          weight?: number | null;
          weight_assumed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_class_session_id_user_id_fkey";
            columns: ["class_session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "class_sessions";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "assessments_course_id_user_id_fkey";
            columns: ["course_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      calendar_feeds: {
        Row: {
          created_at: string;
          id: string;
          last_attempt_at: string | null;
          last_error: string | null;
          last_synced_at: string | null;
          status: string;
          url: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          last_attempt_at?: string | null;
          last_error?: string | null;
          last_synced_at?: string | null;
          status?: string;
          url: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_attempt_at?: string | null;
          last_error?: string | null;
          last_synced_at?: string | null;
          status?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      class_sessions: {
        Row: {
          all_day: boolean;
          course_id: string;
          created_at: string;
          ends_at: string;
          feed_id: string;
          id: string;
          is_exam_slot: boolean;
          kind: string;
          original_start: string;
          session_numbers: number[];
          starts_at: string;
          uid: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          all_day?: boolean;
          course_id: string;
          created_at?: string;
          ends_at: string;
          feed_id: string;
          id?: string;
          is_exam_slot?: boolean;
          kind: string;
          original_start: string;
          session_numbers?: number[];
          starts_at: string;
          uid: string;
          user_id?: string;
        };
        Update: {
          all_day?: boolean;
          course_id?: string;
          created_at?: string;
          ends_at?: string;
          feed_id?: string;
          id?: string;
          is_exam_slot?: boolean;
          kind?: string;
          original_start?: string;
          session_numbers?: number[];
          starts_at?: string;
          uid?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_sessions_course_id_user_id_fkey";
            columns: ["course_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "class_sessions_feed_id_user_id_fkey";
            columns: ["feed_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "calendar_feeds";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      courses: {
        Row: {
          created_at: string;
          id: string;
          missed_before: number;
          name: string;
          name_key: string;
          sessions_calendar: number | null;
          sessions_syllabus: number | null;
          sessions_typed: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          missed_before?: number;
          name: string;
          name_key?: never;
          sessions_calendar?: number | null;
          sessions_syllabus?: number | null;
          sessions_typed?: number | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          missed_before?: number;
          name?: string;
          name_key?: never;
          sessions_calendar?: number | null;
          sessions_syllabus?: number | null;
          sessions_typed?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      feed_course_map: {
        Row: {
          course_id: string | null;
          created_at: string;
          feed_id: string;
          id: string;
          source_hash: string;
          source_key: string | null;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          course_id?: string | null;
          created_at?: string;
          feed_id: string;
          id?: string;
          source_hash: string;
          source_key?: string | null;
          status?: string;
          user_id?: string;
        };
        Update: {
          course_id?: string | null;
          created_at?: string;
          feed_id?: string;
          id?: string;
          source_hash?: string;
          source_key?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feed_course_map_course_id_user_id_fkey";
            columns: ["course_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "feed_course_map_feed_id_user_id_fkey";
            columns: ["feed_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "calendar_feeds";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      items: {
        Row: {
          created_at: string;
          id: number;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: never;
          title: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notices: {
        Row: {
          body: string;
          created_at: string;
          dismissed_at: string | null;
          id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          dismissed_at?: string | null;
          id?: string;
          user_id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          dismissed_at?: string | null;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      skips: {
        Row: {
          class_session_id: string | null;
          course_id: string;
          created_at: string;
          id: string;
          planned: boolean;
          sessions: number;
          skip_date: string;
          text_typed: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_session_id?: string | null;
          course_id: string;
          created_at?: string;
          id?: string;
          planned?: boolean;
          sessions?: number;
          skip_date?: string;
          text_typed: string;
          user_id?: string;
        };
        Update: {
          class_session_id?: string | null;
          course_id?: string;
          created_at?: string;
          id?: string;
          planned?: boolean;
          sessions?: number;
          skip_date?: string;
          text_typed?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "skips_class_session_id_user_id_fkey";
            columns: ["class_session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "class_sessions";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "skips_course_id_user_id_fkey";
            columns: ["course_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      syllabus_sessions: {
        Row: {
          course_id: string;
          created_at: string;
          id: string;
          pre_reading: string | null;
          probably: boolean;
          session_number: number;
          topic: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          course_id: string;
          created_at?: string;
          id?: string;
          pre_reading?: string | null;
          probably?: boolean;
          session_number: number;
          topic: string;
          user_id?: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          id?: string;
          pre_reading?: string | null;
          probably?: boolean;
          session_number?: number;
          topic?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "syllabus_sessions_course_id_user_id_fkey";
            columns: ["course_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      weekly_checks: {
        Row: {
          created_at: string;
          user_id: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id?: string;
          week_start: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      connect_feed: { Args: { p_url: string }; Returns: string };
      delete_my_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      feed_url_for_sync: { Args: { p_feed: string }; Returns: string };
      log_skip: {
        Args: { p_day?: string; p_sessions?: number; p_text: string };
        Returns: {
          class_session_id: string | null;
          course_id: string;
          created_at: string;
          id: string;
          planned: boolean;
          sessions: number;
          skip_date: string;
          text_typed: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "skips";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      madrid_today: { Args: Record<PropertyKey, never>; Returns: string };
      norm_course_name: { Args: { p_name: string }; Returns: string };
      reserve_ai_call: { Args: Record<PropertyKey, never>; Returns: boolean };
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
