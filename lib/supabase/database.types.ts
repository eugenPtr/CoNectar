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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      affiliated_communities: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      birth_details: {
        Row: {
          birth_date: string
          birth_time: string
          birthplace: string
          chart_generation: string
          chart_path: string | null
          chart_status: string
          is_visible: boolean
          latitude: number
          longitude: number
          member_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          birth_date: string
          birth_time: string
          birthplace: string
          chart_generation?: string
          chart_path?: string | null
          chart_status?: string
          is_visible?: boolean
          latitude: number
          longitude: number
          member_id: string
          timezone: string
          updated_at?: string
        }
        Update: {
          birth_date?: string
          birth_time?: string
          birthplace?: string
          chart_generation?: string
          chart_path?: string | null
          chart_status?: string
          is_visible?: boolean
          latitude?: number
          longitude?: number
          member_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "birth_details_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          member_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          member_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          member_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      heart_project_match_settings: {
        Row: {
          catalog_version: number
          min_similarity: number
          singleton: boolean
        }
        Insert: {
          catalog_version?: number
          min_similarity?: number
          singleton?: boolean
        }
        Update: {
          catalog_version?: number
          min_similarity?: number
          singleton?: boolean
        }
        Relationships: []
      }
      heart_project_theme_links: {
        Row: {
          heart_project_id: string
          match_version: number
          similarity: number
          theme_id: string
        }
        Insert: {
          heart_project_id: string
          match_version: number
          similarity: number
          theme_id: string
        }
        Update: {
          heart_project_id?: string
          match_version?: number
          similarity?: number
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "heart_project_theme_links_heart_project_id_fkey"
            columns: ["heart_project_id"]
            isOneToOne: false
            referencedRelation: "heart_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heart_project_theme_links_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      heart_projects: {
        Row: {
          description: string
          embedded_at: string | null
          embedding: string | null
          embedding_input: string | null
          id: string
          member_id: string
          position: number
          title: string
        }
        Insert: {
          description: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_input?: string | null
          id?: string
          member_id: string
          position: number
          title: string
        }
        Update: {
          description?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_input?: string | null
          id?: string
          member_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "heart_projects_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          generated_by: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          generated_by?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          generated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: number
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: never
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: never
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_community_affiliations: {
        Row: {
          community_id: string
          member_id: string
        }
        Insert: {
          community_id: string
          member_id: string
        }
        Update: {
          community_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_community_affiliations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "affiliated_communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_community_affiliations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["member_id"]
          },
        ]
      }
      profiles: {
        Row: {
          first_name: string
          heart_project_description: string | null
          heart_project_seeking: boolean
          last_name: string
          location: string
          member_id: string
          passions: string
          profile_context_embedded_at: string | null
          profile_context_embedding: string | null
          profile_context_embedding_input: string | null
          profile_photo_path: string | null
        }
        Insert: {
          first_name: string
          heart_project_description?: string | null
          heart_project_seeking: boolean
          last_name: string
          location: string
          member_id: string
          passions: string
          profile_context_embedded_at?: string | null
          profile_context_embedding?: string | null
          profile_context_embedding_input?: string | null
          profile_photo_path?: string | null
        }
        Update: {
          first_name?: string
          heart_project_description?: string | null
          heart_project_seeking?: boolean
          last_name?: string
          location?: string
          member_id?: string
          passions?: string
          profile_context_embedded_at?: string | null
          profile_context_embedding?: string | null
          profile_context_embedding_input?: string | null
          profile_photo_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          classification: Database["public"]["Enums"]["resource_classification"]
          description: string
          embedded_at: string
          embedding: string
          embedding_input: string
          id: string
          member_id: string
          position: number
        }
        Insert: {
          classification: Database["public"]["Enums"]["resource_classification"]
          description: string
          embedded_at?: string
          embedding: string
          embedding_input: string
          id?: string
          member_id: string
          position: number
        }
        Update: {
          classification?: Database["public"]["Enums"]["resource_classification"]
          description?: string
          embedded_at?: string
          embedding?: string
          embedding_input?: string
          id?: string
          member_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "resources_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      socials: {
        Row: {
          email: string | null
          facebook: string | null
          instagram: string | null
          linkedin: string | null
          member_id: string
          phone: string | null
          website: string | null
          x: string | null
        }
        Insert: {
          email?: string | null
          facebook?: string | null
          instagram?: string | null
          linkedin?: string | null
          member_id: string
          phone?: string | null
          website?: string | null
          x?: string | null
        }
        Update: {
          email?: string | null
          facebook?: string | null
          instagram?: string | null
          linkedin?: string | null
          member_id?: string
          phone?: string | null
          website?: string | null
          x?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "socials_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["member_id"]
          },
        ]
      }
      themes: {
        Row: {
          archived_at: string | null
          description: string
          embedded_at: string
          embedding: string
          embedding_input: string
          id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          description: string
          embedded_at?: string
          embedding: string
          embedding_input: string
          id?: string
          name: string
        }
        Update: {
          archived_at?: string | null
          description?: string
          embedded_at?: string
          embedding?: string
          embedding_input?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      universal_invite_signups: {
        Row: {
          code: string
          created_at: string
          member_id: string
        }
        Insert: {
          code: string
          created_at?: string
          member_id: string
        }
        Update: {
          code?: string
          created_at?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "universal_invite_signups_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      backfill_legacy_heart_projects: { Args: never; Returns: number }
      claim_invite: {
        Args: { p_code: string; p_email: string; p_user_id: string }
        Returns: string
      }
      complete_onboarding:
        | {
            Args: {
              p_code: string
              p_community_ids: string[]
              p_email: string
              p_is_universal: boolean
              p_profile: Json
              p_resources: Json
              p_socials: Json
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_code: string
              p_community_ids: string[]
              p_email: string
              p_is_universal: boolean
              p_profile: Json
              p_projects: Json
              p_resources: Json
              p_socials: Json
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_birth: Json
              p_code: string
              p_community_ids: string[]
              p_email: string
              p_is_universal: boolean
              p_profile: Json
              p_projects: Json
              p_resources: Json
              p_socials: Json
              p_user_id: string
            }
            Returns: string
          }
      configure_natal_chart_webhook: {
        Args: { p_project_url: string; p_secret: string }
        Returns: undefined
      }
      delete_expired_conversations: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
      match_heart_projects: {
        Args: {
          match_count: number
          min_similarity: number
          query_embedding: string
        }
        Returns: {
          description: string
          first_name: string
          last_name: string
          member_id: string
          project_id: string
          similarity: number
          title: string
        }[]
      }
      match_profile_contexts: {
        Args: {
          match_count: number
          min_similarity: number
          query_embedding: string
        }
        Returns: {
          first_name: string
          heart_project_description: string
          heart_project_seeking: boolean
          last_name: string
          member_id: string
          passions: string
          similarity: number
        }[]
      }
      match_resources: {
        Args: {
          match_count: number
          min_similarity: number
          query_embedding: string
        }
        Returns: {
          classification: Database["public"]["Enums"]["resource_classification"]
          description: string
          first_name: string
          last_name: string
          member_id: string
          resource_id: string
          similarity: number
        }[]
      }
      rematch_all_heart_projects: { Args: never; Returns: undefined }
      rematch_heart_project: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      replace_heart_projects_for_member: {
        Args: { p_member_id: string; p_projects: Json }
        Returns: undefined
      }
      replace_own_heart_projects: {
        Args: { p_projects: Json }
        Returns: undefined
      }
      replace_own_resources: { Args: { p_resources: Json }; Returns: undefined }
      retry_own_natal_chart: { Args: never; Returns: undefined }
      update_own_profile:
        | {
            Args: {
              p_community_ids: string[]
              p_profile: Json
              p_resources: Json
              p_socials: Json
            }
            Returns: undefined
          }
        | {
            Args: {
              p_community_ids: string[]
              p_profile: Json
              p_projects: Json
              p_resources: Json
              p_socials: Json
            }
            Returns: undefined
          }
        | {
            Args: {
              p_birth: Json
              p_community_ids: string[]
              p_profile: Json
              p_projects: Json
              p_resources: Json
              p_socials: Json
            }
            Returns: undefined
          }
    }
    Enums: {
      member_role: "member" | "admin"
      resource_classification: "free" | "paid"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      member_role: ["member", "admin"],
      resource_classification: ["free", "paid"],
    },
  },
} as const
