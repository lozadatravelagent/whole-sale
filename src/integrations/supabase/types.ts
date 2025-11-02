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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          agency_id: string
          created_at: string | null
          deleted_at: string | null
          description: string
          id: string
          lead_id: string | null
          metadata: Json | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          agency_id: string
          created_at?: string | null
          deleted_at?: string | null
          description: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          agency_id?: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          branding: Json
          created_at: string
          custom_template_ids: Json | null
          id: string
          name: string
          pdf_backgrounds: Json | null
          phones: string[]
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          custom_template_ids?: Json | null
          id?: string
          name: string
          pdf_backgrounds?: Json | null
          phones?: string[]
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          custom_template_ids?: Json | null
          id?: string
          name?: string
          pdf_backgrounds?: Json | null
          phones?: string[]
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          meta: Json
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          id?: string
          meta?: Json
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          meta?: Json
          target?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          agency_id: string | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          created_at: string
          created_by: string
          external_key: string
          id: string
          last_message_at: string
          phone_number_id: string | null
          state: Database["public"]["Enums"]["conversation_state"]
          tenant_id: string | null
        }
        Insert: {
          agency_id?: string | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          created_at?: string
          created_by: string
          external_key: string
          id?: string
          last_message_at?: string
          phone_number_id?: string | null
          state?: Database["public"]["Enums"]["conversation_state"]
          tenant_id?: string | null
        }
        Update: {
          agency_id?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          created_at?: string
          created_by?: string
          external_key?: string
          id?: string
          last_message_at?: string
          phone_number_id?: string | null
          state?: Database["public"]["Enums"]["conversation_state"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          agency_id: string
          created_at: string
          credentials_encrypted: Json
          id: string
          meta: Json
          provider_code: Database["public"]["Enums"]["provider_code"]
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          credentials_encrypted?: Json
          id?: string
          meta?: Json
          provider_code: Database["public"]["Enums"]["provider_code"]
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          credentials_encrypted?: Json
          id?: string
          meta?: Json
          provider_code?: Database["public"]["Enums"]["provider_code"]
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agency_id: string
          assigned_user_id: string | null
          attachments: Json | null
          budget: number | null
          checklist: Json | null
          contact: Json
          conversation_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          loss_reason: string | null
          pdf_urls: string[]
          section_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
          trip: Json
          updated_at: string
        }
        Insert: {
          agency_id: string
          assigned_user_id?: string | null
          attachments?: Json | null
          budget?: number | null
          checklist?: Json | null
          contact: Json
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          loss_reason?: string | null
          pdf_urls?: string[]
          section_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
          trip: Json
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assigned_user_id?: string | null
          attachments?: Json | null
          budget?: number | null
          checklist?: Json | null
          contact?: Json
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          loss_reason?: string | null
          pdf_urls?: string[]
          section_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id?: string
          trip?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          client_id: string | null
          content: Json
          conversation_id: string
          created_at: string
          id: string
          meta: Json
          role: string
        }
        Insert: {
          client_id?: string | null
          content?: Json
          conversation_id: string
          created_at?: string
          id?: string
          meta?: Json
          role: string
        }
        Update: {
          client_id?: string | null
          content?: Json
          conversation_id?: string
          created_at?: string
          id?: string
          meta?: Json
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
      rate_limit_config: {
        Row: {
          created_at: string | null
          max_api_calls_per_hour: number | null
          max_messages_per_day: number | null
          max_messages_per_hour: number | null
          max_searches_per_day: number | null
          max_searches_per_hour: number | null
          plan_type: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          max_api_calls_per_hour?: number | null
          max_messages_per_day?: number | null
          max_messages_per_hour?: number | null
          max_searches_per_day?: number | null
          max_searches_per_hour?: number | null
          plan_type?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          max_api_calls_per_hour?: number | null
          max_messages_per_day?: number | null
          max_messages_per_hour?: number | null
          max_searches_per_day?: number | null
          max_searches_per_hour?: number | null
          plan_type?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_usage: {
        Row: {
          action: string
          created_at: string | null
          id: string
          request_count: number | null
          resource: string | null
          tenant_id: string | null
          user_id: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          request_count?: number | null
          resource?: string | null
          tenant_id?: string | null
          user_id?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          request_count?: number | null
          resource?: string | null
          tenant_id?: string | null
          user_id?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reports_daily: {
        Row: {
          agency_id: string
          date: string
          id: string
          metrics: Json
          tenant_id: string
        }
        Insert: {
          agency_id: string
          date: string
          id?: string
          metrics?: Json
          tenant_id: string
        }
        Update: {
          agency_id?: string
          date?: string
          id?: string
          metrics?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_daily_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      search_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          expires_at: string | null
          hard_expires_at: string
          hit_count: number | null
          id: string
          params: Json
          results: Json
          search_type: string
          soft_expires_at: string
          tenant_id: string | null
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          expires_at?: string | null
          hard_expires_at: string
          hit_count?: number | null
          id?: string
          params: Json
          results: Json
          search_type: string
          soft_expires_at: string
          tenant_id?: string | null
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          expires_at?: string | null
          hard_expires_at?: string
          hit_count?: number | null
          id?: string
          params?: Json
          results?: Json
          search_type?: string
          soft_expires_at?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      search_jobs: {
        Row: {
          cache_hit: boolean | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string | null
          error: string | null
          id: string
          params: Json
          provider: string
          results: Json | null
          search_type: string
          status: string | null
        }
        Insert: {
          cache_hit?: boolean | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          params: Json
          provider: string
          results?: Json | null
          search_type: string
          status?: string | null
        }
        Update: {
          cache_hit?: boolean | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          params?: Json
          provider?: string
          results?: Json | null
          search_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          agency_id: string
          color: string | null
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
          position: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      sellers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          agency_id: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          provider: Database["public"]["Enums"]["auth_provider"]
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          email: string
          id: string
          name?: string | null
          provider?: Database["public"]["Enums"]["auth_provider"]
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          provider?: Database["public"]["Enums"]["auth_provider"]
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_numbers: {
        Row: {
          id: string
          meta: Json
          phone_number_id: string
          quality_state: Database["public"]["Enums"]["quality_state"]
          tenant_id: string
          token_encrypted: string
          waba_id: string
        }
        Insert: {
          id?: string
          meta?: Json
          phone_number_id: string
          quality_state?: Database["public"]["Enums"]["quality_state"]
          tenant_id: string
          token_encrypted: string
          waba_id: string
        }
        Update: {
          id?: string
          meta?: Json
          phone_number_id?: string
          quality_state?: Database["public"]["Enums"]["quality_state"]
          tenant_id?: string
          token_encrypted?: string
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_numbers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      users_with_details: {
        Row: {
          agency_id: string | null
          agency_name: string | null
          agency_status: string | null
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          provider: Database["public"]["Enums"]["auth_provider"] | null
          role: Database["public"]["Enums"]["user_role"] | null
          tenant_id: string | null
          tenant_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_create_agency: { Args: never; Returns: boolean }
      can_create_user_with_role: {
        Args: { target_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      can_manage_agency: {
        Args: { target_agency_id: string }
        Returns: boolean
      }
      can_manage_user: { Args: { target_user_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_action: string
          p_tenant_id: string
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      clean_expired_cache: { Args: never; Returns: undefined }
      cleanup_old_rate_limit_usage: { Args: never; Returns: undefined }
      cleanup_old_search_jobs: { Args: never; Returns: undefined }
      get_allowed_roles_for_creation: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"][]
      }
      get_conversations_with_agency: {
        Args: never
        Returns: {
          agency_id: string
          agency_name: string
          channel: Database["public"]["Enums"]["conversation_channel"]
          created_at: string
          created_by: string
          creator_email: string
          creator_role: Database["public"]["Enums"]["user_role"]
          external_key: string
          id: string
          last_message_at: string
          phone_number_id: string
          state: Database["public"]["Enums"]["conversation_state"]
          tenant_id: string
          tenant_name: string
        }[]
      }
      get_user_agency_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      get_user_tenant_id: { Args: never; Returns: string }
      is_assigned_to_lead: { Args: { _lead_id: string }; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_same_agency: { Args: { _agency_id: string }; Returns: boolean }
      is_same_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      record_rate_limit_usage: {
        Args: {
          p_action: string
          p_resource?: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      auth_provider: "email" | "google"
      conversation_channel: "wa" | "web"
      conversation_state: "active" | "closed" | "pending"
      integration_status: "active" | "pending" | "disabled"
      lead_status: "new" | "quoted" | "negotiating" | "won" | "lost"
      message_role: "user" | "assistant" | "system"
      provider_code: "EUROVIPS" | "LOZADA" | "DELFOS" | "ICARO" | "STARLING"
      quality_state: "GREEN" | "YELLOW" | "RED"
      user_role: "SUPERADMIN" | "ADMIN" | "OWNER" | "SELLER"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      auth_provider: ["email", "google"],
      conversation_channel: ["wa", "web"],
      conversation_state: ["active", "closed", "pending"],
      integration_status: ["active", "pending", "disabled"],
      lead_status: ["new", "quoted", "negotiating", "won", "lost"],
      message_role: ["user", "assistant", "system"],
      provider_code: ["EUROVIPS", "LOZADA", "DELFOS", "ICARO", "STARLING"],
      quality_state: ["GREEN", "YELLOW", "RED"],
      user_role: ["SUPERADMIN", "ADMIN", "OWNER", "SELLER"],
    },
  },
} as const
