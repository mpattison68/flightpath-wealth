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
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reviews: {
        Row: {
          created_at: string
          id: string
          kind: string
          metrics: Json | null
          period_end: string | null
          period_start: string | null
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          metrics?: Json | null
          period_end?: string | null
          period_start?: string | null
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metrics?: Json | null
          period_end?: string | null
          period_start?: string | null
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          id: string
          mime_type: string | null
          parsed_json: Json | null
          status: string
          storage_path: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          mime_type?: string | null
          parsed_json?: Json | null
          status?: string
          storage_path: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          parsed_json?: Json | null
          status?: string
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          as_of: string
          base_currency: string
          id: string
          quote_currency: string
          rate: number
        }
        Insert: {
          as_of?: string
          base_currency?: string
          id?: string
          quote_currency: string
          rate: number
        }
        Update: {
          as_of?: string
          base_currency?: string
          id?: string
          quote_currency?: string
          rate?: number
        }
        Relationships: []
      }
      holdings: {
        Row: {
          asset_class: string | null
          created_at: string
          currency: string
          id: string
          liquidity: string | null
          name: string
          notes: string | null
          platform_id: string | null
          price: number | null
          region: string | null
          role: string | null
          ticker: string | null
          units: number | null
          updated_at: string
          user_id: string
          value: number
          wrapper: string | null
        }
        Insert: {
          asset_class?: string | null
          created_at?: string
          currency?: string
          id?: string
          liquidity?: string | null
          name: string
          notes?: string | null
          platform_id?: string | null
          price?: number | null
          region?: string | null
          role?: string | null
          ticker?: string | null
          units?: number | null
          updated_at?: string
          user_id: string
          value: number
          wrapper?: string | null
        }
        Update: {
          asset_class?: string | null
          created_at?: string
          currency?: string
          id?: string
          liquidity?: string | null
          name?: string
          notes?: string | null
          platform_id?: string | null
          price?: number | null
          region?: string | null
          role?: string | null
          ticker?: string | null
          units?: number | null
          updated_at?: string
          user_id?: string
          value?: number
          wrapper?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holdings_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      income_sources: {
        Row: {
          annual_value: number
          created_at: string
          currency: string
          enabled: boolean
          end_date: string | null
          id: string
          inflation_behaviour: string
          kind: string
          name: string
          notes: string | null
          start_date: string | null
          tax_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_value: number
          created_at?: string
          currency?: string
          enabled?: boolean
          end_date?: string | null
          id?: string
          inflation_behaviour?: string
          kind: string
          name: string
          notes?: string | null
          start_date?: string | null
          tax_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_value?: number
          created_at?: string
          currency?: string
          enabled?: boolean
          end_date?: string | null
          id?: string
          inflation_behaviour?: string
          kind?: string
          name?: string
          notes?: string | null
          start_date?: string | null
          tax_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platforms: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          provider: string | null
          user_id: string
          wrapper: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          provider?: string | null
          user_id: string
          wrapper?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          provider?: string | null
          user_id?: string
          wrapper?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          alt_currency: string | null
          base_currency: string
          created_at: string
          display_name: string | null
          locale: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alt_currency?: string | null
          base_currency?: string
          created_at?: string
          display_name?: string | null
          locale?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alt_currency?: string | null
          base_currency?: string
          created_at?: string
          display_name?: string | null
          locale?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      property_assets: {
        Row: {
          created_at: string
          currency: string
          current_value: number
          estimated_sale_date: string | null
          id: string
          monthly_expenses: number | null
          monthly_rental_income: number | null
          mortgage_balance: number | null
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          role_in_plan: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          current_value: number
          estimated_sale_date?: string | null
          id?: string
          monthly_expenses?: number | null
          monthly_rental_income?: number | null
          mortgage_balance?: number | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          role_in_plan?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_value?: number
          estimated_sale_date?: string | null
          id?: string
          monthly_expenses?: number | null
          monthly_rental_income?: number | null
          mortgage_balance?: number | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          role_in_plan?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      retirement_plans: {
        Row: {
          assumptions: Json
          created_at: string
          current_annual_spend: number | null
          date_of_birth: string | null
          desired_annual_income: number | null
          id: string
          is_active: boolean
          name: string
          target_retirement_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assumptions?: Json
          created_at?: string
          current_annual_spend?: number | null
          date_of_birth?: string | null
          desired_annual_income?: number | null
          id?: string
          is_active?: boolean
          name?: string
          target_retirement_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assumptions?: Json
          created_at?: string
          current_annual_spend?: number | null
          date_of_birth?: string | null
          desired_annual_income?: number | null
          id?: string
          is_active?: boolean
          name?: string
          target_retirement_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          assumptions: Json
          created_at: string
          description: string | null
          id: string
          name: string
          result: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assumptions?: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          result?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assumptions?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          result?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      snapshot_holdings: {
        Row: {
          asset_class: string | null
          currency: string | null
          id: string
          name: string
          price: number | null
          region: string | null
          snapshot_id: string
          ticker: string | null
          units: number | null
          user_id: string
          value: number
          wrapper: string | null
        }
        Insert: {
          asset_class?: string | null
          currency?: string | null
          id?: string
          name: string
          price?: number | null
          region?: string | null
          snapshot_id: string
          ticker?: string | null
          units?: number | null
          user_id: string
          value: number
          wrapper?: string | null
        }
        Update: {
          asset_class?: string | null
          currency?: string | null
          id?: string
          name?: string
          price?: number | null
          region?: string | null
          snapshot_id?: string
          ticker?: string | null
          units?: number | null
          user_id?: string
          value?: number
          wrapper?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_holdings_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "valuation_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          assumptions: Json
          notifications: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          assumptions?: Json
          notifications?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          assumptions?: Json
          notifications?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      valuation_snapshots: {
        Row: {
          base_currency: string
          created_at: string
          fx_rates: Json
          id: string
          notes: string | null
          snapshot_date: string
          source: string
          total_value: number
          user_id: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          fx_rates?: Json
          id?: string
          notes?: string | null
          snapshot_date?: string
          source?: string
          total_value: number
          user_id: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          fx_rates?: Json
          id?: string
          notes?: string | null
          snapshot_date?: string
          source?: string
          total_value?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
