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
          pdf_provider: string
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
          pdf_provider?: string
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
          pdf_provider?: string
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
      api_keys: {
        Row: {
          agency_id: string | null
          created_at: string | null
          created_by: string | null
          environment: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          metadata: Json | null
          name: string | null
          rate_limit_per_day: number | null
          rate_limit_per_hour: number | null
          rate_limit_per_minute: number | null
          scopes: string[]
          tenant_id: string | null
          usage_count: number | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          created_by?: string | null
          environment?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          metadata?: Json | null
          name?: string | null
          rate_limit_per_day?: number | null
          rate_limit_per_hour?: number | null
          rate_limit_per_minute?: number | null
          scopes?: string[]
          tenant_id?: string | null
          usage_count?: number | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          created_by?: string | null
          environment?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          metadata?: Json | null
          name?: string | null
          rate_limit_per_day?: number | null
          rate_limit_per_hour?: number | null
          rate_limit_per_minute?: number | null
          scopes?: string[]
          tenant_id?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_cache: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          expires_at: string | null
          request_id: string
          response_data: Json
          search_id: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          request_id: string
          response_data: Json
          search_id: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          request_id?: string
          response_data?: Json
          search_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_request_cache_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
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
          created_by: string | null
          external_key: string
          id: string
          last_message_at: string
          phone_number_id: string | null
          state: Database["public"]["Enums"]["conversation_state"]
          tenant_id: string | null
          workspace_mode: Database["public"]["Enums"]["conversation_workspace_mode"]
        }
        Insert: {
          agency_id?: string | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          created_at?: string
          created_by?: string | null
          external_key: string
          id?: string
          last_message_at?: string
          phone_number_id?: string | null
          state?: Database["public"]["Enums"]["conversation_state"]
          tenant_id?: string | null
          workspace_mode?: Database["public"]["Enums"]["conversation_workspace_mode"]
        }
        Update: {
          agency_id?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          created_at?: string
          created_by?: string | null
          external_key?: string
          id?: string
          last_message_at?: string
          phone_number_id?: string | null
          state?: Database["public"]["Enums"]["conversation_state"]
          tenant_id?: string | null
          workspace_mode?: Database["public"]["Enums"]["conversation_workspace_mode"]
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
      hotelbeds_cache: {
        Row: {
          check_in: string
          check_out: string
          currency: string
          hotel_code: string
          max_rate: number | null
          min_rate: number | null
          room_count: number | null
          updated_at: string | null
        }
        Insert: {
          check_in: string
          check_out: string
          currency?: string
          hotel_code: string
          max_rate?: number | null
          min_rate?: number | null
          room_count?: number | null
          updated_at?: string | null
        }
        Update: {
          check_in?: string
          check_out?: string
          currency?: string
          hotel_code?: string
          max_rate?: number | null
          min_rate?: number | null
          room_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hotelbeds_destinations: {
        Row: {
          code: string
          country_code: string | null
          name: string | null
        }
        Insert: {
          code: string
          country_code?: string | null
          name?: string | null
        }
        Update: {
          code?: string
          country_code?: string | null
          name?: string | null
        }
        Relationships: []
      }
      hotelbeds_hotels: {
        Row: {
          address: string | null
          category_code: string | null
          city: string | null
          code: string
          country: string | null
          description: string | null
          destination_code: string | null
          facilities: Json | null
          images: Json | null
          latitude: number | null
          longitude: number | null
          name: string | null
          updated_at: string | null
          web: string | null
        }
        Insert: {
          address?: string | null
          category_code?: string | null
          city?: string | null
          code: string
          country?: string | null
          description?: string | null
          destination_code?: string | null
          facilities?: Json | null
          images?: Json | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          updated_at?: string | null
          web?: string | null
        }
        Update: {
          address?: string | null
          category_code?: string | null
          city?: string | null
          code?: string
          country?: string | null
          description?: string | null
          destination_code?: string | null
          facilities?: Json | null
          images?: Json | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          updated_at?: string | null
          web?: string | null
        }
        Relationships: []
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
          agency_id: string | null
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
          tenant_id: string | null
          trip: Json
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
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
          tenant_id?: string | null
          trip: Json
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
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
          tenant_id?: string | null
          trip?: Json
          trip_id?: string | null
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
          {
            foreignKeyName: "leads_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "lead_trips"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "leads_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_ai_profiles: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          lead_id: string
          profile_json: Json
          schema_version: number
          source_conversation_id: string | null
          summary_text: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          lead_id: string
          profile_json?: Json
          schema_version?: number
          source_conversation_id?: string | null
          summary_text?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          profile_json?: Json
          schema_version?: number
          source_conversation_id?: string | null
          summary_text?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_ai_profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ai_profiles_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ai_profiles_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ai_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_request_logs: {
        Row: {
          agency_id: string | null
          cached_tokens: number | null
          completion_tokens: number | null
          conversation_id: string | null
          created_at: string
          estimated_cost_usd: number
          feature: string
          finish_reason: string | null
          id: string
          latency_ms: number | null
          lead_id: string | null
          metadata: Json
          model: string
          operation: string
          prompt_tokens: number | null
          provider: string
          request_id: string | null
          success: boolean
          tenant_id: string | null
          total_tokens: number | null
        }
        Insert: {
          agency_id?: string | null
          cached_tokens?: number | null
          completion_tokens?: number | null
          conversation_id?: string | null
          created_at?: string
          estimated_cost_usd?: number
          feature: string
          finish_reason?: string | null
          id?: string
          latency_ms?: number | null
          lead_id?: string | null
          metadata?: Json
          model: string
          operation: string
          prompt_tokens?: number | null
          provider: string
          request_id?: string | null
          success?: boolean
          tenant_id?: string | null
          total_tokens?: number | null
        }
        Update: {
          agency_id?: string | null
          cached_tokens?: number | null
          completion_tokens?: number | null
          conversation_id?: string | null
          created_at?: string
          estimated_cost_usd?: number
          feature?: string
          finish_reason?: string | null
          id?: string
          latency_ms?: number | null
          lead_id?: string | null
          metadata?: Json
          model?: string
          operation?: string
          prompt_tokens?: number | null
          provider?: string
          request_id?: string | null
          success?: boolean
          tenant_id?: string | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_request_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_request_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_request_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_request_logs_tenant_id_fkey"
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
      trip_segments: {
        Row: {
          city: string
          country: string | null
          created_at: string | null
          end_date: string | null
          flight_price_per_person: number | null
          hotel_name: string | null
          hotel_price_per_night: number | null
          hotel_status: string | null
          id: string
          nights: number | null
          segment_index: number
          start_date: string | null
          transport_in_status: string | null
          transport_out_status: string | null
          trip_id: string
        }
        Insert: {
          city: string
          country?: string | null
          created_at?: string | null
          end_date?: string | null
          flight_price_per_person?: number | null
          hotel_name?: string | null
          hotel_price_per_night?: number | null
          hotel_status?: string | null
          id?: string
          nights?: number | null
          segment_index: number
          start_date?: string | null
          transport_in_status?: string | null
          transport_out_status?: string | null
          trip_id: string
        }
        Update: {
          city?: string
          country?: string | null
          created_at?: string | null
          end_date?: string | null
          flight_price_per_person?: number | null
          hotel_name?: string | null
          hotel_price_per_night?: number | null
          hotel_status?: string | null
          id?: string
          nights?: number | null
          segment_index?: number
          start_date?: string | null
          transport_in_status?: string | null
          transport_out_status?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "lead_trips"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          account_type: string
          agency_id: string | null
          budget_level: string | null
          conversation_id: string | null
          created_at: string | null
          created_by: string | null
          destination_cities: string[] | null
          destination_countries: string[] | null
          end_date: string | null
          id: string
          last_edited_at: string | null
          last_edited_by: string | null
          last_state_hash: string | null
          lead_id: string | null
          owner_user_id: string
          pace: string | null
          planner_state: Json
          start_date: string | null
          status: string | null
          summary: string | null
          tenant_id: string | null
          title: string | null
          total_nights: number | null
          travelers: Json | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          account_type?: string
          agency_id?: string | null
          budget_level?: string | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          destination_cities?: string[] | null
          destination_countries?: string[] | null
          end_date?: string | null
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          last_state_hash?: string | null
          lead_id?: string | null
          owner_user_id: string
          pace?: string | null
          planner_state?: Json
          start_date?: string | null
          status?: string | null
          summary?: string | null
          tenant_id?: string | null
          title?: string | null
          total_nights?: number | null
          travelers?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          account_type?: string
          agency_id?: string | null
          budget_level?: string | null
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          destination_cities?: string[] | null
          destination_countries?: string[] | null
          end_date?: string | null
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          last_state_hash?: string | null
          lead_id?: string | null
          owner_user_id?: string
          pace?: string | null
          planner_state?: Json
          start_date?: string | null
          status?: string | null
          summary?: string | null
          tenant_id?: string | null
          title?: string | null
          total_nights?: number | null
          travelers?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_type: string
          agency_id: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          preferred_language: string | null
          provider: Database["public"]["Enums"]["auth_provider"]
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string | null
        }
        Insert: {
          account_type?: string
          agency_id?: string | null
          created_at?: string
          email: string
          id: string
          name?: string | null
          preferred_language?: string | null
          provider?: Database["public"]["Enums"]["auth_provider"]
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
        }
        Update: {
          account_type?: string
          agency_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          preferred_language?: string | null
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
      lead_trips: {
        Row: {
          budget_level: string | null
          created_at: string | null
          created_by: string | null
          destination_cities: string[] | null
          end_date: string | null
          estimated_price: number | null
          lead_id: string | null
          start_date: string | null
          status: string | null
          title: string | null
          travelers: Json | null
          trip_id: string | null
          updated_at: string | null
        }
        Insert: {
          budget_level?: string | null
          created_at?: string | null
          created_by?: string | null
          destination_cities?: string[] | null
          end_date?: string | null
          estimated_price?: never
          lead_id?: string | null
          start_date?: string | null
          status?: string | null
          title?: string | null
          travelers?: Json | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_level?: string | null
          created_at?: string | null
          created_by?: string | null
          destination_cities?: string[] | null
          end_date?: string | null
          estimated_price?: never
          lead_id?: string | null
          start_date?: string | null
          status?: string | null
          title?: string | null
          travelers?: Json | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cleanup_expired_request_cache: { Args: never; Returns: undefined }
      cleanup_old_rate_limit_usage: { Args: never; Returns: undefined }
      cleanup_old_search_jobs: { Args: never; Returns: undefined }
      generate_api_key: {
        Args: {
          p_agency_id?: string
          p_created_by?: string
          p_environment?: string
          p_expires_at?: string
          p_name?: string
          p_rate_limit_per_day?: number
          p_rate_limit_per_hour?: number
          p_rate_limit_per_minute?: number
          p_scopes?: string[]
          p_tenant_id: string
        }
        Returns: {
          api_key: string
          created_at: string
          environment: string
          id: string
          key_prefix: string
          scopes: string[]
        }[]
      }
      generate_random_string: { Args: { length: number }; Returns: string }
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
          workspace_mode: Database["public"]["Enums"]["conversation_workspace_mode"]
        }[]
      }
      get_superadmin_agency_ids: { Args: never; Returns: string[] }
      get_user_account_type: { Args: never; Returns: string }
      get_user_agency_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      get_user_tenant_id: { Args: never; Returns: string }
      hash_api_key: { Args: { api_key: string }; Returns: string }
      is_assigned_to_lead: { Args: { _lead_id: string }; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_same_agency: { Args: { _agency_id: string }; Returns: boolean }
      is_same_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      list_api_keys: {
        Args: { p_tenant_id: string }
        Returns: {
          created_at: string
          environment: string
          expires_at: string
          id: string
          is_active: boolean
          key_prefix: string
          last_used_at: string
          name: string
          rate_limit_per_day: number
          rate_limit_per_hour: number
          rate_limit_per_minute: number
          scopes: string[]
          usage_count: number
        }[]
      }
      record_rate_limit_usage: {
        Args: {
          p_action: string
          p_resource?: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      revoke_api_key: { Args: { p_key_id: string }; Returns: boolean }
      rotate_api_key: {
        Args: { p_old_key_id: string }
        Returns: {
          api_key: string
          created_at: string
          environment: string
          id: string
          key_prefix: string
          scopes: string[]
        }[]
      }
      search_conversations_by_content: {
        Args: { p_query: string }
        Returns: {
          conversation_id: string
          matched_at: string
          snippet: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      auth_provider: "email" | "google"
      conversation_channel: "wa" | "web"
      conversation_state: "active" | "closed" | "pending"
      conversation_workspace_mode: "standard" | "planner" | "companion"
      integration_status: "active" | "pending" | "disabled"
      lead_status: "new" | "quoted" | "negotiating" | "won" | "lost"
      message_role: "user" | "assistant" | "system"
      provider_code: "EUROVIPS" | "LOZADA" | "DELFOS" | "ICARO" | "STARLING"
      quality_state: "GREEN" | "YELLOW" | "RED"
      user_role: "SUPERADMIN" | "ADMIN" | "OWNER" | "SELLER" | "CONSUMER"
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
      conversation_workspace_mode: ["standard", "planner", "companion"],
      integration_status: ["active", "pending", "disabled"],
      lead_status: ["new", "quoted", "negotiating", "won", "lost"],
      message_role: ["user", "assistant", "system"],
      provider_code: ["EUROVIPS", "LOZADA", "DELFOS", "ICARO", "STARLING"],
      quality_state: ["GREEN", "YELLOW", "RED"],
      user_role: ["SUPERADMIN", "ADMIN", "OWNER", "SELLER", "CONSUMER"],
    },
  },
} as const
