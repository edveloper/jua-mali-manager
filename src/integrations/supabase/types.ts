// Database types for Duka Manager.
//
// HAND-MAINTAINED. Normally this file is produced by
//   npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
// but it was written by hand on 2026-08-14 from the migrations in
// supabase/migrations plus a live pg_catalog introspection, because the
// Supabase Management API was unreachable at the time.
//
// If you change the schema, update this file in the same commit -- nothing
// enforces that they agree. Regenerating with the CLI when it is available will
// overwrite this and is the preferred long-term option.

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
      shops: {
        Row: {
          id: string;
          name: string;
          business_category: string;
          offering_mode: string;
          single_offering: boolean;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          business_category?: string;
          offering_mode?: string;
          single_offering?: boolean;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          business_category?: string;
          offering_mode?: string;
          single_offering?: boolean;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      shop_members: {
        Row: {
          id: string;
          shop_id: string;
          user_id: string;
          role: Database['public']['Enums']['shop_role'];
          permissions: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          user_id: string;
          role?: Database['public']['Enums']['shop_role'];
          permissions?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          user_id?: string;
          role?: Database['public']['Enums']['shop_role'];
          permissions?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shop_members_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };

      products: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          category: string | null;
          price: number;
          cost_price: number | null;
          min_price: number | null;
          max_price: number | null;
          stock_level: number;
          min_stock_level: number;
          unit: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          category?: string | null;
          price?: number;
          cost_price?: number | null;
          min_price?: number | null;
          max_price?: number | null;
          stock_level?: number;
          min_stock_level?: number;
          unit?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          category?: string | null;
          price?: number;
          cost_price?: number | null;
          min_price?: number | null;
          max_price?: number | null;
          stock_level?: number;
          min_stock_level?: number;
          unit?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'products_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };

      sales: {
        Row: {
          id: string;
          shop_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          total_amount: number;
          cost_price_at_sale: number;
          unit_price: number | null;
          list_price_at_sale: number | null;
          price_source: string;
          sold_by: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          total_amount: number;
          cost_price_at_sale?: number;
          unit_price?: number | null;
          list_price_at_sale?: number | null;
          price_source?: string;
          sold_by?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          total_amount?: number;
          cost_price_at_sale?: number;
          unit_price?: number | null;
          list_price_at_sale?: number | null;
          price_source?: string;
          sold_by?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sales_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };

      customers: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };

      credit_sales: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string;
          sale_id: string | null;
          product_name: string;
          quantity: number;
          amount: number;
          amount_paid: number | null;
          status: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id: string;
          sale_id?: string | null;
          product_name: string;
          quantity: number;
          amount: number;
          amount_paid?: number | null;
          status?: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string;
          sale_id?: string | null;
          product_name?: string;
          quantity?: number;
          amount?: number;
          amount_paid?: number | null;
          status?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_sales_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'credit_sales_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'credit_sales_sale_id_fkey';
            columns: ['sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
        ];
      };

      credit_payments: {
        Row: {
          id: string;
          shop_id: string;
          credit_sale_id: string;
          customer_id: string;
          amount: number;
          paid_at: string;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          credit_sale_id: string;
          customer_id: string;
          amount: number;
          paid_at?: string;
          notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          credit_sale_id?: string;
          customer_id?: string;
          amount?: number;
          paid_at?: string;
          notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_payments_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'credit_payments_credit_sale_id_fkey';
            columns: ['credit_sale_id'];
            isOneToOne: false;
            referencedRelation: 'credit_sales';
            referencedColumns: ['id'];
          },
        ];
      };

      expenses: {
        Row: {
          id: string;
          shop_id: string | null;
          category: string;
          description: string | null;
          amount: number;
          date: string | null;
          expense_type: string;
          recurrence_unit: string;
          allocation_mode: string;
          source: string;
          effective_from: string | null;
          effective_to: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          category: string;
          description?: string | null;
          amount?: number;
          date?: string | null;
          expense_type?: string;
          recurrence_unit?: string;
          allocation_mode?: string;
          source?: string;
          effective_from?: string | null;
          effective_to?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          category?: string;
          description?: string | null;
          amount?: number;
          date?: string | null;
          expense_type?: string;
          recurrence_unit?: string;
          allocation_mode?: string;
          source?: string;
          effective_from?: string | null;
          effective_to?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };

      services: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          category: string | null;
          cost_per_service: number;
          price: number;
          capacity: number;
          min_capacity_level: number;
          duration_minutes: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          category?: string | null;
          cost_per_service?: number;
          price: number;
          capacity?: number;
          min_capacity_level?: number;
          duration_minutes?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          category?: string | null;
          cost_per_service?: number;
          price?: number;
          capacity?: number;
          min_capacity_level?: number;
          duration_minutes?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'services_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
        ];
      };

      service_sales: {
        Row: {
          id: string;
          shop_id: string;
          service_id: string;
          service_name: string;
          quantity: number;
          total_amount: number;
          cost_at_sale: number;
          staff_name: string | null;
          session_time: string | null;
          notes: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          service_id: string;
          service_name: string;
          quantity: number;
          total_amount: number;
          cost_at_sale?: number;
          staff_name?: string | null;
          session_time?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          service_id?: string;
          service_name?: string;
          quantity?: number;
          total_amount?: number;
          cost_at_sale?: number;
          staff_name?: string | null;
          session_time?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_sales_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_sales_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };

      stock_movements: {
        Row: {
          id: string;
          shop_id: string;
          product_id: string;
          product_name: string;
          movement_type: string;
          reason: string;
          quantity: number;
          unit_cost: number | null;
          total_cost: number | null;
          notes: string | null;
          happened_at: string;
          created_by: string | null;
          expense_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          product_id: string;
          product_name: string;
          movement_type: string;
          reason: string;
          quantity: number;
          unit_cost?: number | null;
          total_cost?: number | null;
          notes?: string | null;
          happened_at?: string;
          created_by?: string | null;
          expense_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          product_id?: string;
          product_name?: string;
          movement_type?: string;
          reason?: string;
          quantity?: number;
          unit_cost?: number | null;
          total_cost?: number | null;
          notes?: string | null;
          happened_at?: string;
          created_by?: string | null;
          expense_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_movements_shop_id_fkey';
            columns: ['shop_id'];
            isOneToOne: false;
            referencedRelation: 'shops';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
        ];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      record_product_sale_atomic: {
        Args: {
          p_shop_id: string;
          p_product_id: string;
          p_quantity: number;
          p_unit_price?: number | null;
        };
        Returns: {
          id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          total_amount: number;
          cost_price_at_sale: number;
          unit_price: number;
          list_price_at_sale: number;
          price_source: string;
          sold_by: string;
          created_at: string;
        }[];
      };

      record_service_sale_atomic: {
        Args: {
          p_shop_id: string;
          p_service_id: string;
          p_quantity: number;
          p_staff_name?: string | null;
          p_session_time?: string | null;
          p_notes?: string | null;
          p_status?: string | null;
        };
        Returns: {
          id: string;
          service_id: string;
          service_name: string;
          quantity: number;
          total_amount: number;
          cost_at_sale: number;
          staff_name: string;
          session_time: string;
          notes: string;
          status: string;
          created_at: string;
        }[];
      };

      record_product_restock_atomic: {
        Args: {
          p_shop_id: string;
          p_product_id: string;
          p_quantity: number;
          p_unit_cost: number;
          p_happened_at?: string | null;
          p_notes?: string | null;
          p_allocation_mode?: string | null;
        };
        Returns: {
          movement_id: string;
          product_id: string;
          new_stock_level: number;
          new_cost_price: number;
          total_cost: number;
          expense_id: string;
          happened_at: string;
        }[];
      };

      record_credit_payment_atomic: {
        Args: {
          p_shop_id: string;
          p_credit_sale_id: string;
          p_amount: number;
          p_paid_at?: string | null;
          p_notes?: string | null;
        };
        Returns: {
          id: string;
          credit_sale_id: string;
          customer_id: string;
          amount: number;
          paid_at: string;
          new_amount_paid: number;
          new_balance: number;
          new_status: string;
        }[];
      };

      create_shop_with_owner: {
        Args: {
          p_name: string;
          p_business_category?: string | null;
          p_offering_mode?: string | null;
          p_single_offering?: boolean | null;
          p_currency?: string | null;
        };
        Returns: Database['public']['Tables']['shops']['Row'];
      };

      shares_shop_with: {
        Args: { p_viewer: string; p_target: string };
        Returns: boolean;
      };

      is_shop_owner: {
        Args: { p_user_id: string; p_shop_id: string };
        Returns: boolean;
      };
      is_shop_member: {
        Args: { p_user_id: string; p_shop_id: string };
        Returns: boolean;
      };
      member_can: {
        Args: { p_user_id: string; p_shop_id: string; p_permission: string };
        Returns: boolean;
      };
      shop_has_no_members: {
        Args: { p_shop_id: string };
        Returns: boolean;
      };
      get_user_shop_id: {
        Args: { p_user_id: string };
        Returns: string;
      };
      get_user_shop_role: {
        Args: { p_user_id: string; p_shop_id: string };
        Returns: Database['public']['Enums']['shop_role'];
      };
    };

    Enums: {
      shop_role: 'owner' | 'employee';
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Convenience aliases so callers don't repeat the deep index every time.
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
