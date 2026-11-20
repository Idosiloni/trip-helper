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
    PostgrestVersion: "14.18"
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
      activity: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json
          trip_id: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          trip_id: string
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          trip_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_imports: {
        Row: {
          accepted_count: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          parsed: Json | null
          prompt_id: string
          prompt_version: number
          raw_text: string
          source_label: string | null
          trip_id: string
          undone_at: string | null
        }
        Insert: {
          accepted_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          parsed?: Json | null
          prompt_id: string
          prompt_version?: number
          raw_text: string
          source_label?: string | null
          trip_id: string
          undone_at: string | null
        }
        Update: {
          accepted_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          parsed?: Json | null
          prompt_id?: string
          prompt_version?: number
          raw_text?: string
          source_label?: string | null
          trip_id?: string
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_imports_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      bags: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["bag_kind"]
          label: string
          owner_traveler_id: string | null
          position: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["bag_kind"]
          label: string
          owner_traveler_id?: string | null
          position: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["bag_kind"]
          label?: string
          owner_traveler_id?: string | null
          position?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bags_owner_traveler_id_trip_id_fkey"
            columns: ["owner_traveler_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "travelers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "bags_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          address: string | null
          cancel_by: string | null
          confirmation_code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          ends_at: string | null
          ends_tz: string | null
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          link: string | null
          notes: string | null
          place_id: string | null
          price: string | null
          starts_at: string | null
          starts_tz: string | null
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cancel_by?: string | null
          confirmation_code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends_at?: string | null
          ends_tz?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          link?: string | null
          notes?: string | null
          place_id?: string | null
          price?: string | null
          starts_at?: string | null
          starts_tz?: string | null
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cancel_by?: string | null
          confirmation_code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends_at?: string | null
          ends_tz?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          link?: string | null
          notes?: string | null
          place_id?: string | null
          price?: string | null
          starts_at?: string | null
          starts_tz?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_place_id_trip_id_fkey"
            columns: ["place_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          created_at: string
          provider: string
          query_key: string
          results: Json
        }
        Insert: {
          created_at?: string
          provider: string
          query_key: string
          results: Json
        }
        Update: {
          created_at?: string
          provider?: string
          query_key?: string
          results?: Json
        }
        Relationships: []
      }
      invites: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          max_uses: number | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["trip_role"]
          token: string
          trip_id: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["trip_role"]
          token?: string
          trip_id: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["trip_role"]
          token?: string
          trip_id?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          day_id: string | null
          deleted_at: string | null
          id: string
          place_id: string | null
          position: string
          rating: number | null
          source: Database["public"]["Enums"]["item_source"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          day_id?: string | null
          deleted_at?: string | null
          id?: string
          place_id?: string | null
          position: string
          rating?: number | null
          source?: Database["public"]["Enums"]["item_source"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          day_id?: string | null
          deleted_at?: string | null
          id?: string
          place_id?: string | null
          position?: string
          rating?: number | null
          source?: Database["public"]["Enums"]["item_source"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_place_id_trip_id_fkey"
            columns: ["place_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "journal_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          send_after: string
          sent_at: string | null
          trip_id: string
          urgent: boolean
          url: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          send_after?: string
          sent_at?: string | null
          trip_id: string
          urgent?: boolean
          url: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          send_after?: string
          sent_at?: string | null
          trip_id?: string
          urgent?: boolean
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          kinds: Json
          quiet_enabled: boolean
          quiet_end: string
          quiet_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          kinds?: Json
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_start?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          kinds?: Json
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_items: {
        Row: {
          ai_import_id: string | null
          bag_id: string | null
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          packed_at: string | null
          packed_by: string | null
          position: string
          qty: number
          return_packed: boolean
          source: Database["public"]["Enums"]["item_source"]
          state: Database["public"]["Enums"]["packing_state"]
          title: string
          traveler_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          ai_import_id?: string | null
          bag_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          packed_at?: string | null
          packed_by?: string | null
          position: string
          qty?: number
          return_packed?: boolean
          source?: Database["public"]["Enums"]["item_source"]
          state?: Database["public"]["Enums"]["packing_state"]
          title: string
          traveler_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          ai_import_id?: string | null
          bag_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          packed_at?: string | null
          packed_by?: string | null
          position?: string
          qty?: number
          return_packed?: boolean
          source?: Database["public"]["Enums"]["item_source"]
          state?: Database["public"]["Enums"]["packing_state"]
          title?: string
          traveler_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_items_ai_import_id_fkey"
            columns: ["ai_import_id"]
            isOneToOne: false
            referencedRelation: "ai_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_items_bag_id_trip_id_fkey"
            columns: ["bag_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "bags"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "packing_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_items_packed_by_fkey"
            columns: ["packed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_items_traveler_id_trip_id_fkey"
            columns: ["traveler_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "travelers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "packing_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          ai_import_id: string | null
          area: string | null
          category: Database["public"]["Enums"]["place_category"]
          city: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          geocode_label: string | null
          geocode_status: Database["public"]["Enums"]["geocode_status"]
          hours_text: string | null
          id: string
          lat: number | null
          lng: number | null
          maps_url: string | null
          name: string
          notes: string | null
          position: string
          price_level: number | null
          priority: Database["public"]["Enums"]["place_priority"]
          rating: number | null
          source: Database["public"]["Enums"]["item_source"]
          status: Database["public"]["Enums"]["place_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          ai_import_id?: string | null
          area?: string | null
          category?: Database["public"]["Enums"]["place_category"]
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          geocode_label?: string | null
          geocode_status?: Database["public"]["Enums"]["geocode_status"]
          hours_text?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          maps_url?: string | null
          name: string
          notes?: string | null
          position: string
          price_level?: number | null
          priority?: Database["public"]["Enums"]["place_priority"]
          rating?: number | null
          source?: Database["public"]["Enums"]["item_source"]
          status?: Database["public"]["Enums"]["place_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          ai_import_id?: string | null
          area?: string | null
          category?: Database["public"]["Enums"]["place_category"]
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          geocode_label?: string | null
          geocode_status?: Database["public"]["Enums"]["geocode_status"]
          hours_text?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          maps_url?: string | null
          name?: string
          notes?: string | null
          position?: string
          price_level?: number | null
          priority?: Database["public"]["Enums"]["place_priority"]
          rating?: number | null
          source?: Database["public"]["Enums"]["item_source"]
          status?: Database["public"]["Enums"]["place_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_ai_import_id_fkey"
            columns: ["ai_import_id"]
            isOneToOne: false
            referencedRelation: "ai_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string
          created_at: string
          display_name: string
          id: string
          locale: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          display_name?: string
          id: string
          locale?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          display_name?: string
          id?: string
          locale?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          ai_import_id: string | null
          bought: boolean
          bought_at: string | null
          bought_by: string | null
          budget: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          for_whom: string | null
          id: string
          link: string | null
          notes: string | null
          place_id: string | null
          position: string
          source: Database["public"]["Enums"]["item_source"]
          title: string
          trip_id: string
          updated_at: string
          where_text: string | null
        }
        Insert: {
          ai_import_id?: string | null
          bought?: boolean
          bought_at?: string | null
          bought_by?: string | null
          budget?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          for_whom?: string | null
          id?: string
          link?: string | null
          notes?: string | null
          place_id?: string | null
          position: string
          source?: Database["public"]["Enums"]["item_source"]
          title: string
          trip_id: string
          updated_at?: string
          where_text?: string | null
        }
        Update: {
          ai_import_id?: string | null
          bought?: boolean
          bought_at?: string | null
          bought_by?: string | null
          budget?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          for_whom?: string | null
          id?: string
          link?: string | null
          notes?: string | null
          place_id?: string | null
          position?: string
          source?: Database["public"]["Enums"]["item_source"]
          title?: string
          trip_id?: string
          updated_at?: string
          where_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_ai_import_id_fkey"
            columns: ["ai_import_id"]
            isOneToOne: false
            referencedRelation: "ai_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_bought_by_fkey"
            columns: ["bought_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_place_id_trip_id_fkey"
            columns: ["place_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "purchases_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          tz: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          tz?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          tz?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          ai_import_id: string | null
          created_at: string
          created_by: string | null
          day_id: string | null
          deleted_at: string | null
          duration_min: number | null
          free_text: string | null
          id: string
          notes: string | null
          place_id: string | null
          position: string
          source: Database["public"]["Enums"]["item_source"]
          start_time: string | null
          time_of_day: Database["public"]["Enums"]["time_of_day"] | null
          transport_note: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          ai_import_id?: string | null
          created_at?: string
          created_by?: string | null
          day_id?: string | null
          deleted_at?: string | null
          duration_min?: number | null
          free_text?: string | null
          id?: string
          notes?: string | null
          place_id?: string | null
          position: string
          source?: Database["public"]["Enums"]["item_source"]
          start_time?: string | null
          time_of_day?: Database["public"]["Enums"]["time_of_day"] | null
          transport_note?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          ai_import_id?: string | null
          created_at?: string
          created_by?: string | null
          day_id?: string | null
          deleted_at?: string | null
          duration_min?: number | null
          free_text?: string | null
          id?: string
          notes?: string | null
          place_id?: string | null
          position?: string
          source?: Database["public"]["Enums"]["item_source"]
          start_time?: string | null
          time_of_day?: Database["public"]["Enums"]["time_of_day"] | null
          transport_note?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stops_ai_import_id_fkey"
            columns: ["ai_import_id"]
            isOneToOne: false
            referencedRelation: "ai_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_day_id_trip_id_fkey"
            columns: ["day_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "stops_place_id_trip_id_fkey"
            columns: ["place_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "stops_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      task_groups: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          position: string
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          position: string
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          position?: string
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_groups_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          ai_import_id: string | null
          assignee_traveler_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          done: boolean
          done_at: string | null
          done_by: string | null
          due_all_day: boolean
          due_at: string | null
          group_id: string | null
          id: string
          link: string | null
          notes: string | null
          phase: Database["public"]["Enums"]["trip_phase"]
          position: string
          remind_at: string | null
          source: Database["public"]["Enums"]["item_source"]
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          ai_import_id?: string | null
          assignee_traveler_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          due_all_day?: boolean
          due_at?: string | null
          group_id?: string | null
          id?: string
          link?: string | null
          notes?: string | null
          phase?: Database["public"]["Enums"]["trip_phase"]
          position: string
          remind_at?: string | null
          source?: Database["public"]["Enums"]["item_source"]
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          ai_import_id?: string | null
          assignee_traveler_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          due_all_day?: boolean
          due_at?: string | null
          group_id?: string | null
          id?: string
          link?: string | null
          notes?: string | null
          phase?: Database["public"]["Enums"]["trip_phase"]
          position?: string
          remind_at?: string | null
          source?: Database["public"]["Enums"]["item_source"]
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_ai_import_id_fkey"
            columns: ["ai_import_id"]
            isOneToOne: false
            referencedRelation: "ai_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_traveler_id_trip_id_fkey"
            columns: ["assignee_traveler_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "travelers"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_group_id_trip_id_fkey"
            columns: ["group_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "task_groups"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "tasks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          payload: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      travelers: {
        Row: {
          age_group: Database["public"]["Enums"]["age_group"]
          birth_year: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          interests: string[]
          label: string
          linked_user_id: string | null
          position: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          age_group?: Database["public"]["Enums"]["age_group"]
          birth_year?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          interests?: string[]
          label: string
          linked_user_id?: string | null
          position: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          age_group?: Database["public"]["Enums"]["age_group"]
          birth_year?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          interests?: string[]
          label?: string
          linked_user_id?: string | null
          position?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travelers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travelers_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travelers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_days: {
        Row: {
          city: string | null
          created_at: string
          date: string
          flexible: boolean
          id: string
          lodging_place_id: string | null
          notes: string | null
          plan_b: string | null
          title: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          date: string
          flexible?: boolean
          id?: string
          lodging_place_id?: string | null
          notes?: string | null
          plan_b?: string | null
          title?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          date?: string
          flexible?: boolean
          id?: string
          lodging_place_id?: string | null
          notes?: string | null
          plan_b?: string | null
          title?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_days_lodging_place_id_trip_id_fkey"
            columns: ["lodging_place_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          joined_at: string
          notification_prefs: Json
          role: Database["public"]["Enums"]["trip_role"]
          trip_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          notification_prefs?: Json
          role: Database["public"]["Enums"]["trip_role"]
          trip_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          notification_prefs?: Json
          role?: Database["public"]["Enums"]["trip_role"]
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_notes: {
        Row: {
          ai_import_id: string | null
          body: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["note_kind"]
          position: string
          source: Database["public"]["Enums"]["item_source"]
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          ai_import_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
          position: string
          source?: Database["public"]["Enums"]["item_source"]
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          ai_import_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
          position?: string
          source?: Database["public"]["Enums"]["item_source"]
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_notes_ai_import_id_fkey"
            columns: ["ai_import_id"]
            isOneToOne: false
            referencedRelation: "ai_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_notes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          name: string
          phase_override: Database["public"]["Enums"]["trip_phase"] | null
          profile: Json
          start_date: string | null
          theme_color: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          name: string
          phase_override?: Database["public"]["Enums"]["trip_phase"] | null
          profile?: Json
          start_date?: string | null
          theme_color?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          phase_override?: Database["public"]["Enums"]["trip_phase"] | null
          profile?: Json
          start_date?: string | null
          theme_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: {
          p_new_position?: string
          p_token: string
          p_traveler_id?: string
        }
        Returns: string
      }
      actor_name: { Args: { p_user: string }; Returns: string }
      apply_template_payload: {
        Args: { p_payload: Json; p_trip_id: string }
        Returns: undefined
      }
      can_edit_trip: { Args: { p_trip_id: string }; Returns: boolean }
      undo_import: { Args: { p_import_id: string }; Returns: number }
      claim_push_batch: { Args: { p_secret: string }; Returns: Json }
      commit_import: {
        Args: {
          p_items: Json
          p_kind: string
          p_parsed?: Json
          p_prompt_id?: string
          p_prompt_version?: number
          p_raw_text: string
          p_source?: Database["public"]["Enums"]["item_source"]
          p_source_label?: string
          p_trip_id: string
        }
        Returns: number
      }
      create_trip: {
        Args: {
          p_end_date?: string
          p_name: string
          p_start_date?: string
          p_theme_color?: string
        }
        Returns: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          name: string
          phase_override: Database["public"]["Enums"]["trip_phase"] | null
          profile: Json
          start_date: string | null
          theme_color: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_trip_from_template: {
        Args: {
          p_end_date: string
          p_name: string
          p_payload: Json
          p_start_date: string
          p_theme_color: string
        }
        Returns: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          name: string
          phase_override: Database["public"]["Enums"]["trip_phase"] | null
          profile: Json
          start_date: string | null
          theme_color: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      duplicate_trip: {
        Args: {
          p_end_date?: string
          p_name: string
          p_start_date?: string
          p_trip_id: string
        }
        Returns: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          name: string
          phase_override: Database["public"]["Enums"]["trip_phase"] | null
          profile: Json
          start_date: string | null
          theme_color: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enqueue_for_trip: {
        Args: {
          p_body: string
          p_dedupe?: string
          p_kind: string
          p_trip: string
          p_urgent?: boolean
          p_url: string
        }
        Returns: undefined
      }
      enqueue_notification: {
        Args: {
          p_body: string
          p_dedupe?: string
          p_delay?: string
          p_kind: string
          p_trip: string
          p_urgent?: boolean
          p_url: string
          p_user: string
        }
        Returns: undefined
      }
      enqueue_reminders: { Args: never; Returns: undefined }
      fill_day_cities: { Args: { p_trip_id: string }; Returns: undefined }
      in_bulk_write: { Args: never; Returns: boolean }
      in_quiet_hours: {
        Args: { p_at?: string; p_user: string }
        Returns: boolean
      }
      invite_preview: {
        Args: { p_token: string }
        Returns: {
          end_date: string
          inviter_name: string
          role: Database["public"]["Enums"]["trip_role"]
          start_date: string
          status: string
          theme_color: string
          trip_name: string
        }[]
      }
      invite_travelers: {
        Args: { p_token: string }
        Returns: {
          id: string
          label: string
          linked: boolean
          position: string
        }[]
      }
      is_my_packing_item: {
        Args: { p_bag_id: string; p_traveler_id: string }
        Returns: boolean
      }
      is_my_traveler: { Args: { p_traveler_id: string }; Returns: boolean }
      is_trip_member: { Args: { p_trip_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_payload?: Json
          p_trip_id: string
          p_type: string
        }
        Returns: undefined
      }
      my_trip_role: {
        Args: { p_trip_id: string }
        Returns: Database["public"]["Enums"]["trip_role"]
      }
      patch_trip_profile: {
        Args: { p_patch: Json; p_trip_id: string }
        Returns: Json
      }
      push_report: {
        Args: { p_gone: string[]; p_secret: string }
        Returns: undefined
      }
      push_tick: { Args: never; Returns: undefined }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_tz?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      save_trip_as_template: {
        Args: { p_name: string; p_trip_id: string }
        Returns: string
      }
      send_test_notification: { Args: never; Returns: boolean }
      shares_trip_with: { Args: { p_user_id: string }; Returns: boolean }
      sync_trip_days: { Args: { p_trip_id: string }; Returns: undefined }
      touch_push_subscription: {
        Args: { p_endpoint: string; p_tz: string }
        Returns: boolean
      }
      trip_template_payload: { Args: { p_trip_id: string }; Returns: Json }
      user_tz: { Args: { p_user: string }; Returns: string }
    }
    Enums: {
      age_group: "infant" | "child" | "teen" | "adult" | "senior"
      bag_kind: "suitcase" | "carry_on" | "backpack" | "other"
      booking_kind:
        | "flight"
        | "hotel"
        | "train"
        | "attraction"
        | "car"
        | "other"
      geocode_status: "pending" | "found" | "confirmed" | "not_found" | "manual"
      item_source: "manual" | "ai" | "template" | "paste" | "google"
      note_kind:
        | "phrase"
        | "tip"
        | "emergency"
        | "money"
        | "etiquette"
        | "general"
      packing_state: "need" | "packed" | "missing"
      place_category:
        | "food"
        | "attraction"
        | "shopping"
        | "nature"
        | "lodging"
        | "other"
      place_priority: "must" | "maybe"
      place_status: "want" | "visited" | "skipped"
      time_of_day: "morning" | "noon" | "evening"
      trip_phase: "before" | "during" | "after"
      trip_role: "owner" | "editor" | "viewer"
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
      age_group: ["infant", "child", "teen", "adult", "senior"],
      bag_kind: ["suitcase", "carry_on", "backpack", "other"],
      booking_kind: ["flight", "hotel", "train", "attraction", "car", "other"],
      geocode_status: ["pending", "found", "confirmed", "not_found", "manual"],
      item_source: ["manual", "ai", "template", "paste", "google"],
      note_kind: [
        "phrase",
        "tip",
        "emergency",
        "money",
        "etiquette",
        "general",
      ],
      packing_state: ["need", "packed", "missing"],
      place_category: [
        "food",
        "attraction",
        "shopping",
        "nature",
        "lodging",
        "other",
      ],
      place_priority: ["must", "maybe"],
      place_status: ["want", "visited", "skipped"],
      time_of_day: ["morning", "noon", "evening"],
      trip_phase: ["before", "during", "after"],
      trip_role: ["owner", "editor", "viewer"],
    },
  },
} as const
