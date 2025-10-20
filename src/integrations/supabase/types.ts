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
      admin_activity_log: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_kids_profile: boolean
          marketing_opt_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_kids_profile?: boolean
          marketing_opt_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_kids_profile?: boolean
          marketing_opt_in?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_kids_profile: boolean
          updated_at: string
        }
        Insert: {
          created_at: string
          display_name?: string | null
          id: string
          is_kids_profile?: boolean
          updated_at: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_kids_profile?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_public_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          display_name: string
          features: Json
          id: string
          is_default: boolean
          max_profiles: number
          name: string
          price_monthly: number
          updated_at: string
          video_quality: string
        }
        Insert: {
          created_at?: string
          display_name: string
          features?: Json
          id?: string
          is_default?: boolean
          max_profiles?: number
          name: string
          price_monthly?: number
          updated_at?: string
          video_quality?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          features?: Json
          id?: string
          is_default?: boolean
          max_profiles?: number
          name?: string
          price_monthly?: number
          updated_at?: string
          video_quality?: string
        }
        Relationships: []
      }
      subtitles: {
        Row: {
          created_at: string
          format: string
          id: string
          label: string | null
          language_code: string
          path: string
          storage_bucket: string
          updated_at: string
          video_id: string
        }
        Insert: {
          created_at?: string
          format?: string
          id?: string
          label?: string | null
          language_code: string
          path: string
          storage_bucket?: string
          updated_at?: string
          video_id: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          label?: string | null
          language_code?: string
          path?: string
          storage_bucket?: string
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtitles_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          description: string
          id: string
          issue_category: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          issue_category: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          issue_category?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          payment_intent: string | null
          plan_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_intent?: string | null
          plan_id: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_intent?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_watchlist: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_watchlist_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_analytics: {
        Row: {
          avg_rating: number | null
          avg_watch_time_seconds: number | null
          completed_count: number | null
          completion_rate: number | null
          created_at: string | null
          last_calculated_at: string | null
          rating_count: number | null
          replay_count: number | null
          retention_at_25: number | null
          retention_at_50: number | null
          retention_at_75: number | null
          started_count: number | null
          total_views: number | null
          total_watch_time_seconds: number | null
          unique_viewers: number | null
          updated_at: string | null
          video_id: string
          views_this_month: number | null
          views_this_week: number | null
          views_today: number | null
          watchlist_count: number | null
        }
        Insert: {
          avg_rating?: number | null
          avg_watch_time_seconds?: number | null
          completed_count?: number | null
          completion_rate?: number | null
          created_at?: string | null
          last_calculated_at?: string | null
          rating_count?: number | null
          replay_count?: number | null
          retention_at_25?: number | null
          retention_at_50?: number | null
          retention_at_75?: number | null
          started_count?: number | null
          total_views?: number | null
          total_watch_time_seconds?: number | null
          unique_viewers?: number | null
          updated_at?: string | null
          video_id: string
          views_this_month?: number | null
          views_this_week?: number | null
          views_today?: number | null
          watchlist_count?: number | null
        }
        Update: {
          avg_rating?: number | null
          avg_watch_time_seconds?: number | null
          completed_count?: number | null
          completion_rate?: number | null
          created_at?: string | null
          last_calculated_at?: string | null
          rating_count?: number | null
          replay_count?: number | null
          retention_at_25?: number | null
          retention_at_50?: number | null
          retention_at_75?: number | null
          started_count?: number | null
          total_views?: number | null
          total_watch_time_seconds?: number | null
          unique_viewers?: number | null
          updated_at?: string | null
          video_id?: string
          views_this_month?: number | null
          views_this_week?: number | null
          views_today?: number | null
          watchlist_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_analytics_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          bitrate: number | null
          codec: string | null
          created_at: string
          duration: number | null
          height: number | null
          id: string
          path: string
          storage_bucket: string
          updated_at: string
          video_id: string
          width: number | null
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          bitrate?: number | null
          codec?: string | null
          created_at?: string
          duration?: number | null
          height?: number | null
          id?: string
          path: string
          storage_bucket?: string
          updated_at?: string
          video_id: string
          width?: number | null
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          bitrate?: number | null
          codec?: string | null
          created_at?: string
          duration?: number | null
          height?: number | null
          id?: string
          path?: string
          storage_bucket?: string
          updated_at?: string
          video_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_assets_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_categories: {
        Row: {
          category_id: string
          created_at: string
          video_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          video_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_categories_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_ratings: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          rating: number
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          rating: number
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_ratings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_ratings_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_tag_assignments: {
        Row: {
          created_at: string | null
          tag_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          tag_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          tag_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "video_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_tag_assignments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      video_thumbnail_tests: {
        Row: {
          click_through_rate: number | null
          clicks: number | null
          created_at: string | null
          id: string
          impressions: number | null
          is_active: boolean | null
          is_winner: boolean | null
          thumbnail_url: string
          updated_at: string | null
          variant_name: string
          video_id: string | null
        }
        Insert: {
          click_through_rate?: number | null
          clicks?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          is_active?: boolean | null
          is_winner?: boolean | null
          thumbnail_url: string
          updated_at?: string | null
          variant_name: string
          video_id?: string | null
        }
        Update: {
          click_through_rate?: number | null
          clicks?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          is_active?: boolean | null
          is_winner?: boolean | null
          thumbnail_url?: string
          updated_at?: string | null
          variant_name?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_thumbnail_tests_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          duration: number
          id: string
          is_public: boolean | null
          published_at: string | null
          slug: string | null
          thumbnail_url: string
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          duration?: number
          id?: string
          is_public?: boolean | null
          published_at?: string | null
          slug?: string | null
          thumbnail_url: string
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          duration?: number
          id?: string
          is_public?: boolean | null
          published_at?: string | null
          slug?: string | null
          thumbnail_url?: string
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_progress: {
        Row: {
          completed: boolean
          created_at: string
          duration_seconds: number
          id: string
          last_watched_at: string
          profile_id: string
          progress_percentage: number
          progress_seconds: number
          session_id: string | null
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          duration_seconds?: number
          id?: string
          last_watched_at?: string
          profile_id: string
          progress_percentage?: number
          progress_seconds?: number
          session_id?: string | null
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          duration_seconds?: number
          id?: string
          last_watched_at?: string
          profile_id?: string
          progress_percentage?: number
          progress_seconds?: number
          session_id?: string | null
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_watch_progress_video"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_update_videos: {
        Args: { updates: Json; video_ids: string[] }
        Returns: number
      }
      get_my_profiles_public: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          display_name: string
          id: string
          is_kids_profile: boolean
          updated_at: string
        }[]
      }
      get_user_role: {
        Args: { _user_id?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_subscription: {
        Args: { _user_id?: string }
        Returns: {
          expires_at: string
          features: Json
          max_profiles: number
          plan_display_name: string
          plan_id: string
          plan_name: string
          price_monthly: number
          started_at: string
          status: string
          subscription_id: string
          video_quality: string
        }[]
      }
      get_user_video_rating: {
        Args: { profile_id_param: string; video_id_param: string }
        Returns: number
      }
      get_video_average_rating: {
        Args: { video_id_param: string }
        Returns: number
      }
      get_video_rating_count: {
        Args: { video_id_param: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_video_in_watchlist: {
        Args: { profile_id_param: string; video_id_param: string }
        Returns: boolean
      }
      refresh_video_analytics: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      asset_type: "original" | "hls" | "trailer" | "preview"
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
      app_role: ["admin", "moderator", "user"],
      asset_type: ["original", "hls", "trailer", "preview"],
    },
  },
} as const
