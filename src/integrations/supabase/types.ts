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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activation_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          duration_days: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          license_tier: string | null
          max_cashiers: number | null
          max_uses: number | null
          note: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          duration_days: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          license_tier?: string | null
          max_cashiers?: number | null
          max_uses?: number | null
          note?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          duration_days?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          license_tier?: string | null
          max_cashiers?: number | null
          max_uses?: number | null
          note?: string | null
        }
        Relationships: []
      }
      app_licenses: {
        Row: {
          activated_at: string | null
          activation_code_id: string | null
          allow_multi_device: boolean | null
          created_at: string | null
          current_cashiers: number | null
          device_id: string | null
          expires_at: string
          id: string
          is_revoked: boolean | null
          is_trial: boolean | null
          license_tier: string | null
          max_cashiers: number | null
          revoked_at: string | null
          revoked_reason: string | null
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          activation_code_id?: string | null
          allow_multi_device?: boolean | null
          created_at?: string | null
          current_cashiers?: number | null
          device_id?: string | null
          expires_at: string
          id?: string
          is_revoked?: boolean | null
          is_trial?: boolean | null
          license_tier?: string | null
          max_cashiers?: number | null
          revoked_at?: string | null
          revoked_reason?: string | null
          user_id: string
        }
        Update: {
          activated_at?: string | null
          activation_code_id?: string | null
          allow_multi_device?: boolean | null
          created_at?: string | null
          current_cashiers?: number | null
          device_id?: string | null
          expires_at?: string
          id?: string
          is_revoked?: boolean | null
          is_trial?: boolean | null
          license_tier?: string | null
          max_cashiers?: number | null
          revoked_at?: string | null
          revoked_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_licenses_activation_code_id_fkey"
            columns: ["activation_code_id"]
            isOneToOne: false
            referencedRelation: "activation_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          cashier_id: string | null
          created_at: string | null
          email: string | null
          id: string
          invoice_count: number | null
          last_purchase: string | null
          name: string
          phone: string | null
          total_debt: number | null
          total_purchases: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          cashier_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          invoice_count?: number | null
          last_purchase?: string | null
          name: string
          phone?: string | null
          total_debt?: number | null
          total_purchases?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          cashier_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          invoice_count?: number | null
          last_purchase?: string | null
          name?: string
          phone?: string | null
          total_debt?: number | null
          total_purchases?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          cashier_id: string | null
          created_at: string | null
          customer_name: string
          customer_phone: string | null
          due_date: string | null
          id: string
          invoice_id: string | null
          is_cash_debt: boolean | null
          notes: string | null
          remaining_debt: number | null
          status: string | null
          total_debt: number | null
          total_paid: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cashier_id?: string | null
          created_at?: string | null
          customer_name: string
          customer_phone?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          is_cash_debt?: boolean | null
          notes?: string | null
          remaining_debt?: number | null
          status?: string | null
          total_debt?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cashier_id?: string | null
          created_at?: string | null
          customer_name?: string
          customer_phone?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          is_cash_debt?: boolean | null
          notes?: string | null
          remaining_debt?: number | null
          status?: string | null
          total_debt?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number | null
          cashier_id: string | null
          created_at: string | null
          date: string | null
          description: string | null
          distributions: Json | null
          expense_type: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          cashier_id?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          distributions?: Json | null
          expense_type: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          cashier_id?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          distributions?: Json | null
          expense_type?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount_original: number | null
          amount_usd: number | null
          cost_price: number | null
          currency: string | null
          exchange_rate: number | null
          id: string
          invoice_id: string | null
          product_id: string | null
          product_name: string
          profit: number | null
          quantity: number | null
          unit_price: number | null
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          amount_original?: number | null
          amount_usd?: number | null
          cost_price?: number | null
          currency?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_id?: string | null
          product_id?: string | null
          product_name: string
          profit?: number | null
          quantity?: number | null
          unit_price?: number | null
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          amount_original?: number | null
          amount_usd?: number | null
          cost_price?: number | null
          currency?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_id?: string | null
          product_id?: string | null
          product_name?: string
          profit?: number | null
          quantity?: number | null
          unit_price?: number | null
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          cashier_id: string | null
          cashier_name: string | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          date: string
          debt_paid: number | null
          debt_remaining: number | null
          discount: number | null
          discount_percentage: number | null
          exchange_rate: number | null
          id: string
          invoice_number: string
          invoice_type: string | null
          notes: string | null
          payment_type: string | null
          profit: number | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          time: string
          total: number | null
          updated_at: string | null
          user_id: string
          warehouse_id: string | null
        }
        Insert: {
          cashier_id?: string | null
          cashier_name?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date?: string
          debt_paid?: number | null
          debt_remaining?: number | null
          discount?: number | null
          discount_percentage?: number | null
          exchange_rate?: number | null
          id?: string
          invoice_number: string
          invoice_type?: string | null
          notes?: string | null
          payment_type?: string | null
          profit?: number | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          time?: string
          total?: number | null
          updated_at?: string | null
          user_id: string
          warehouse_id?: string | null
        }
        Update: {
          cashier_id?: string | null
          cashier_name?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date?: string
          debt_paid?: number | null
          debt_remaining?: number | null
          discount?: number | null
          discount_percentage?: number | null
          exchange_rate?: number | null
          id?: string
          invoice_number?: string
          invoice_type?: string | null
          notes?: string | null
          payment_type?: string | null
          profit?: number | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          time?: string
          total?: number | null
          updated_at?: string | null
          user_id?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_services: {
        Row: {
          created_at: string | null
          customer_name: string
          customer_phone: string | null
          description: string | null
          id: string
          parts_cost: number | null
          payment_type: string | null
          profit: number | null
          service_price: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_name: string
          customer_phone?: string | null
          description?: string | null
          id?: string
          parts_cost?: number | null
          payment_type?: string | null
          profit?: number | null
          service_price?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_name?: string
          customer_phone?: string | null
          description?: string | null
          id?: string
          parts_cost?: number | null
          payment_type?: string | null
          profit?: number | null
          service_price?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          access_all: boolean | null
          capital_history: Json | null
          category_shares: Json | null
          confirmed_profit: number | null
          created_at: string | null
          current_balance: number | null
          current_capital: number | null
          email: string | null
          expense_history: Json | null
          expense_share_percentage: number | null
          id: string
          initial_capital: number | null
          joined_date: string | null
          name: string
          pending_profit: number | null
          pending_profit_details: Json | null
          phone: string | null
          profit_history: Json | null
          share_percentage: number | null
          total_profit_earned: number | null
          total_withdrawn: number | null
          updated_at: string | null
          user_id: string
          withdrawal_history: Json | null
        }
        Insert: {
          access_all?: boolean | null
          capital_history?: Json | null
          category_shares?: Json | null
          confirmed_profit?: number | null
          created_at?: string | null
          current_balance?: number | null
          current_capital?: number | null
          email?: string | null
          expense_history?: Json | null
          expense_share_percentage?: number | null
          id?: string
          initial_capital?: number | null
          joined_date?: string | null
          name: string
          pending_profit?: number | null
          pending_profit_details?: Json | null
          phone?: string | null
          profit_history?: Json | null
          share_percentage?: number | null
          total_profit_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id: string
          withdrawal_history?: Json | null
        }
        Update: {
          access_all?: boolean | null
          capital_history?: Json | null
          category_shares?: Json | null
          confirmed_profit?: number | null
          created_at?: string | null
          current_balance?: number | null
          current_capital?: number | null
          email?: string | null
          expense_history?: Json | null
          expense_share_percentage?: number | null
          id?: string
          initial_capital?: number | null
          joined_date?: string | null
          name?: string
          pending_profit?: number | null
          pending_profit_details?: Json | null
          phone?: string | null
          profit_history?: Json | null
          share_percentage?: number | null
          total_profit_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id?: string
          withdrawal_history?: Json | null
        }
        Relationships: []
      }
      products: {
        Row: {
          archived: boolean | null
          barcode: string | null
          barcode2: string | null
          barcode3: string | null
          bulk_cost_price: number | null
          bulk_sale_price: number | null
          bulk_unit: string | null
          category: string | null
          conversion_factor: number | null
          cost_price: number | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          location: string | null
          min_stock_level: number | null
          name: string
          notes: string | null
          purchase_history: Json | null
          quantity: number | null
          sale_price: number | null
          small_unit: string | null
          supplier: string | null
          track_by_unit: string | null
          unit: string | null
          updated_at: string | null
          user_id: string
          variant_label: string | null
        }
        Insert: {
          archived?: boolean | null
          barcode?: string | null
          barcode2?: string | null
          barcode3?: string | null
          bulk_cost_price?: number | null
          bulk_sale_price?: number | null
          bulk_unit?: string | null
          category?: string | null
          conversion_factor?: number | null
          cost_price?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          min_stock_level?: number | null
          name: string
          notes?: string | null
          purchase_history?: Json | null
          quantity?: number | null
          sale_price?: number | null
          small_unit?: string | null
          supplier?: string | null
          track_by_unit?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id: string
          variant_label?: string | null
        }
        Update: {
          archived?: boolean | null
          barcode?: string | null
          barcode2?: string | null
          barcode3?: string | null
          bulk_cost_price?: number | null
          bulk_sale_price?: number | null
          bulk_unit?: string | null
          category?: string | null
          conversion_factor?: number | null
          cost_price?: number | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          min_stock_level?: number | null
          name?: string
          notes?: string | null
          purchase_history?: Json | null
          quantity?: number | null
          sale_price?: number | null
          small_unit?: string | null
          supplier?: string | null
          track_by_unit?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string
          variant_label?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allowed_pages: Json | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string | null
          updated_at: string
          user_id: string
          user_type: string | null
        }
        Insert: {
          allowed_pages?: Json | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
          user_id: string
          user_type?: string | null
        }
        Update: {
          allowed_pages?: Json | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string | null
        }
        Relationships: []
      }
      purchase_invoice_items: {
        Row: {
          barcode: string | null
          category: string | null
          cost_price: number
          created_at: string | null
          id: string
          invoice_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_price: number | null
          total_cost: number
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string | null
          id?: string
          invoice_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_price?: number | null
          total_cost?: number
        }
        Update: {
          barcode?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string | null
          id?: string
          invoice_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_price?: number | null
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          actual_grand_total: number | null
          actual_items_count: number | null
          actual_total_quantity: number | null
          created_at: string | null
          expected_grand_total: number
          expected_items_count: number
          expected_total_quantity: number
          id: string
          image_url: string | null
          invoice_date: string
          invoice_number: string
          notes: string | null
          status: string | null
          supplier_company: string | null
          supplier_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_grand_total?: number | null
          actual_items_count?: number | null
          actual_total_quantity?: number | null
          created_at?: string | null
          expected_grand_total?: number
          expected_items_count?: number
          expected_total_quantity?: number
          id?: string
          image_url?: string | null
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          status?: string | null
          supplier_company?: string | null
          supplier_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_grand_total?: number | null
          actual_items_count?: number | null
          actual_total_quantity?: number | null
          created_at?: string | null
          expected_grand_total?: number
          expected_items_count?: number
          expected_total_quantity?: number
          id?: string
          image_url?: string | null
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          status?: string | null
          supplier_company?: string | null
          supplier_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          expense_type: string
          id: string
          interval: string | null
          is_active: boolean | null
          next_due_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          expense_type: string
          id?: string
          interval?: string | null
          is_active?: boolean | null
          next_due_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          expense_type?: string
          id?: string
          interval?: string | null
          is_active?: boolean | null
          next_due_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stock_transfer_items: {
        Row: {
          id: string
          product_id: string
          quantity: number
          quantity_in_pieces: number
          transfer_id: string
          unit: string | null
        }
        Insert: {
          id?: string
          product_id: string
          quantity: number
          quantity_in_pieces: number
          transfer_id: string
          unit?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          quantity_in_pieces?: number
          transfer_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string | null
          from_warehouse_id: string
          id: string
          notes: string | null
          status: string | null
          to_warehouse_id: string
          transfer_number: string
          transfer_type: string
          transferred_at: string | null
          transferred_by: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          from_warehouse_id: string
          id?: string
          notes?: string | null
          status?: string | null
          to_warehouse_id: string
          transfer_number: string
          transfer_type?: string
          transferred_at?: string | null
          transferred_by?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          status?: string | null
          to_warehouse_id?: string
          transfer_number?: string
          transfer_type?: string
          transferred_at?: string | null
          transferred_by?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          created_at: string | null
          currency_symbol: string | null
          exchange_rates: Json | null
          id: string
          language: string | null
          logo_url: string | null
          name: string
          notification_settings: Json | null
          phone: string | null
          print_settings: Json | null
          store_type: string | null
          sync_settings: Json | null
          tax_enabled: boolean | null
          tax_rate: number | null
          theme: string | null
          theme_settings: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          currency_symbol?: string | null
          exchange_rates?: Json | null
          id?: string
          language?: string | null
          logo_url?: string | null
          name?: string
          notification_settings?: Json | null
          phone?: string | null
          print_settings?: Json | null
          store_type?: string | null
          sync_settings?: Json | null
          tax_enabled?: boolean | null
          tax_rate?: number | null
          theme?: string | null
          theme_settings?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          currency_symbol?: string | null
          exchange_rates?: Json | null
          id?: string
          language?: string | null
          logo_url?: string | null
          name?: string
          notification_settings?: Json | null
          phone?: string | null
          print_settings?: Json | null
          store_type?: string | null
          sync_settings?: Json | null
          tax_enabled?: boolean | null
          tax_rate?: number | null
          theme?: string | null
          theme_settings?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          owner_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          owner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          owner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouse_stock: {
        Row: {
          id: string
          last_updated: string | null
          product_id: string
          quantity: number | null
          quantity_bulk: number | null
          warehouse_id: string
        }
        Insert: {
          id?: string
          last_updated?: string | null
          product_id: string
          quantity?: number | null
          quantity_bulk?: number | null
          warehouse_id: string
        }
        Update: {
          id?: string
          last_updated?: string | null
          product_id?: string
          quantity?: number | null
          quantity_bulk?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          assigned_cashier_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          phone: string | null
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          assigned_cashier_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          phone?: string | null
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          assigned_cashier_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          phone?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      boss_owners_view: {
        Row: {
          cashier_count: number | null
          device_id: string | null
          full_name: string | null
          is_active: boolean | null
          license_expires: string | null
          license_revoked: boolean | null
          license_tier: string | null
          max_cashiers: number | null
          role: Database["public"]["Enums"]["app_role"] | null
          role_created_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_product_quantity: {
        Args: { _amount: number; _product_id: string }
        Returns: number
      }
      can_add_cashier: { Args: { _owner_id: string }; Returns: boolean }
      count_owner_cashiers: { Args: { _owner_id: string }; Returns: number }
      deduct_product_quantity: {
        Args: { _amount: number; _product_id: string }
        Returns: number
      }
      delete_owner_cascade: { Args: { _owner_id: string }; Returns: boolean }
      get_owner_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_boss: { Args: { _user_id: string }; Returns: boolean }
      is_first_user: { Args: never; Returns: boolean }
      is_license_valid: { Args: { _user_id: string }; Returns: boolean }
      reset_user_device: { Args: { _target_user_id: string }; Returns: boolean }
      revoke_license: {
        Args: { _license_id: string; _reason?: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "cashier" | "boss"
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
      app_role: ["admin", "cashier", "boss"],
    },
  },
} as const
