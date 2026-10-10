export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      lineups: {
        Row: {
          id: string
          is_goalkeeper: boolean
          match_id: string
          player_id: string
          role: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          id?: string
          is_goalkeeper?: boolean
          match_id: string
          player_id: string
          role: string
          team_id: string
          tournament_id: string
        }
        Update: {
          id?: string
          is_goalkeeper?: boolean
          match_id?: string
          player_id?: string
          role?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          is_penalty: boolean
          match_id: string
          minute: number
          player_id: string | null
          related_player_id: string | null
          stoppage_minute: number | null
          team_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          is_penalty?: boolean
          match_id: string
          minute: number
          player_id?: string | null
          related_player_id?: string | null
          stoppage_minute?: number | null
          team_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          is_penalty?: boolean
          match_id?: string
          minute?: number
          player_id?: string | null
          related_player_id?: string | null
          stoppage_minute?: number | null
          team_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_related_player_id_fkey"
            columns: ["related_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_penalties: number
          away_score: number
          away_team_id: string | null
          clock_elapsed_seconds: number
          clock_running: boolean
          first_half_added_minutes: number
          second_half_added_minutes: number
          clock_started_at: string | null
          created_at: string
          home_penalties: number
          home_score: number
          home_team_id: string | null
          id: string
          next_match_id: string | null
          next_match_slot: string | null
          pitch: string
          player_of_match_id: string | null
          round_label: string
          round_number: number
          scheduled_at: string
          stage: string
          status: string
          tournament_id: string
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          away_penalties?: number
          away_score?: number
          away_team_id?: string | null
          clock_elapsed_seconds?: number
          clock_running?: boolean
          first_half_added_minutes?: number
          second_half_added_minutes?: number
          clock_started_at?: string | null
          created_at?: string
          home_penalties?: number
          home_score?: number
          home_team_id?: string | null
          id?: string
          next_match_id?: string | null
          next_match_slot?: string | null
          pitch: string
          player_of_match_id?: string | null
          round_label?: string
          round_number?: number
          scheduled_at: string
          stage?: string
          status?: string
          tournament_id: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          away_penalties?: number
          away_score?: number
          away_team_id?: string | null
          clock_elapsed_seconds?: number
          clock_running?: boolean
          first_half_added_minutes?: number
          second_half_added_minutes?: number
          clock_started_at?: string | null
          created_at?: string
          home_penalties?: number
          home_score?: number
          home_team_id?: string | null
          id?: string
          next_match_id?: string | null
          next_match_slot?: string | null
          pitch?: string
          player_of_match_id?: string | null
          round_label?: string
          round_number?: number
          scheduled_at?: string
          stage?: string
          status?: string
          tournament_id?: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player_of_match_id_fkey"
            columns: ["player_of_match_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_attempts: {
        Row: {
          attempt_key: string
          attempted_at: string
          id: string
          succeeded: boolean
          tournament_id: string
        }
        Insert: {
          attempt_key: string
          attempted_at?: string
          id?: string
          succeeded?: boolean
          tournament_id: string
        }
        Update: {
          attempt_key?: string
          attempted_at?: string
          id?: string
          succeeded?: boolean
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_attempts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          is_captain: boolean
          jersey_number: number
          name: string
          position: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_captain?: boolean
          jersey_number: number
          name: string
          position: string
          team_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_captain?: boolean
          jersey_number?: number
          name?: string
          position?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      scorer_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorer_sessions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      shootout_kicks: {
        Row: {
          created_at: string
          id: string
          kick_order: number
          match_id: string
          player_id: string | null
          result: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kick_order: number
          match_id: string
          player_id?: string | null
          result: string
          team_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kick_order?: number
          match_id?: string
          player_id?: string | null
          result?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shootout_kicks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shootout_kicks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shootout_kicks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shootout_kicks_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          group_name: string | null
          id: string
          kit_color: string
          name: string
          seed: number
          short_name: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          group_name?: string | null
          id?: string
          kit_color: string
          name: string
          seed: number
          short_name: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          group_name?: string | null
          id?: string
          kit_color?: string
          name?: string
          seed?: number
          short_name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_secrets: {
        Row: {
          edit_token_hash: string
          scorer_pin_hash: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          edit_token_hash: string
          scorer_pin_hash: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          edit_token_hash?: string
          scorer_pin_hash?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_secrets_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          advance_count: number
          created_at: string
          extra_time_enabled: boolean
          extra_time_half_minutes: number
          format: string
          group_count: number
          half_minutes: number
          id: string
          max_subs: number
          name: string
          penalties_enabled: boolean
          public_slug: string
          round_robin_legs: number
          seeding: string
          start_date: string
          team_size: number
          updated_at: string
          venue: string
        }
        Insert: {
          advance_count?: number
          created_at?: string
          extra_time_enabled?: boolean
          extra_time_half_minutes?: number
          format: string
          group_count?: number
          half_minutes?: number
          id?: string
          max_subs: number
          name: string
          penalties_enabled?: boolean
          public_slug?: string
          round_robin_legs?: number
          seeding?: string
          start_date: string
          team_size: number
          updated_at?: string
          venue: string
        }
        Update: {
          advance_count?: number
          created_at?: string
          extra_time_enabled?: boolean
          extra_time_half_minutes?: number
          format?: string
          group_count?: number
          half_minutes?: number
          id?: string
          max_subs?: number
          name?: string
          penalties_enabled?: boolean
          public_slug?: string
          round_robin_legs?: number
          seeding?: string
          start_date?: string
          team_size?: number
          updated_at?: string
          venue?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
