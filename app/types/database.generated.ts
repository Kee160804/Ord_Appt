export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      analytics_snapshots: {
        Row: {
          id: string;
          metadata: Json | null;
          metric: string | null;
          recorded_at: string | null;
          tenant_id: string;
          value: number | null;
        };
        Insert: {
          id?: string;
          metadata?: Json | null;
          metric?: string | null;
          recorded_at?: string | null;
          tenant_id: string;
          value?: number | null;
        };
        Update: {
          id?: string;
          metadata?: Json | null;
          metric?: string | null;
          recorded_at?: string | null;
          tenant_id?: string;
          value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_email_deliveries: {
        Row: {
          appointment_id: string;
          attempt_count: number;
          created_at: string;
          event_type: string;
          id: string;
          last_error: string | null;
          payload: Json;
          processing_started_at: string | null;
          provider_message_id: string | null;
          recipient_email: string;
          recipient_name: string;
          sent_at: string | null;
          status: string;
          subject: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          appointment_id: string;
          attempt_count?: number;
          created_at?: string;
          event_type?: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          processing_started_at?: string | null;
          provider_message_id?: string | null;
          recipient_email: string;
          recipient_name: string;
          sent_at?: string | null;
          status?: string;
          subject: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string;
          attempt_count?: number;
          created_at?: string;
          event_type?: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          processing_started_at?: string | null;
          provider_message_id?: string | null;
          recipient_email?: string;
          recipient_name?: string;
          sent_at?: string | null;
          status?: string;
          subject?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_email_deliveries_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_email_deliveries_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_reminders: {
        Row: {
          appointment_id: string;
          attempt_count: number;
          channel: string;
          created_at: string;
          due_at: string;
          id: string;
          last_error: string | null;
          provider_message_id: string | null;
          reminder_minutes: number;
          sent_at: string | null;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          appointment_id: string;
          attempt_count?: number;
          channel?: string;
          created_at?: string;
          due_at: string;
          id?: string;
          last_error?: string | null;
          provider_message_id?: string | null;
          reminder_minutes: number;
          sent_at?: string | null;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string;
          attempt_count?: number;
          channel?: string;
          created_at?: string;
          due_at?: string;
          id?: string;
          last_error?: string | null;
          provider_message_id?: string | null;
          reminder_minutes?: number;
          sent_at?: string | null;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_reminders_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_services: {
        Row: {
          appointment_id: string;
          created_at: string;
          duration_minutes: number;
          id: string;
          price: number;
          service_id: string | null;
          service_name: string;
          tenant_id: string;
        };
        Insert: {
          appointment_id: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          price?: number;
          service_id?: string | null;
          service_name: string;
          tenant_id: string;
        };
        Update: {
          appointment_id?: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          price?: number;
          service_id?: string | null;
          service_name?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_services_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          appointment_date: string | null;
          appointment_time: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string | null;
          customer_email: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          deposit_required: number | null;
          ends_at: string | null;
          id: string;
          notes: string | null;
          promotion_code: string | null;
          promotion_discount_amount: number;
          promotion_id: string | null;
          service_id: string | null;
          staff_id: string | null;
          starts_at: string | null;
          status: string | null;
          subtotal: number | null;
          tenant_id: string;
          total: number | null;
          updated_at: string | null;
        };
        Insert: {
          appointment_date?: string | null;
          appointment_time?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          deposit_required?: number | null;
          ends_at?: string | null;
          id?: string;
          notes?: string | null;
          promotion_code?: string | null;
          promotion_discount_amount?: number;
          promotion_id?: string | null;
          service_id?: string | null;
          staff_id?: string | null;
          starts_at?: string | null;
          status?: string | null;
          subtotal?: number | null;
          tenant_id: string;
          total?: number | null;
          updated_at?: string | null;
        };
        Update: {
          appointment_date?: string | null;
          appointment_time?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          deposit_required?: number | null;
          ends_at?: string | null;
          id?: string;
          notes?: string | null;
          promotion_code?: string | null;
          promotion_discount_amount?: number;
          promotion_id?: string | null;
          service_id?: string | null;
          staff_id?: string | null;
          starts_at?: string | null;
          status?: string | null;
          subtotal?: number | null;
          tenant_id?: string;
          total?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_employee_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_promotion_id_fkey";
            columns: ["promotion_id"];
            isOneToOne: false;
            referencedRelation: "promotions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          new_data: Json | null;
          old_data: Json | null;
          profile_id: string | null;
          tenant_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          profile_id?: string | null;
          tenant_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          profile_id?: string | null;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      business_hours: {
        Row: {
          close_time: string | null;
          created_at: string;
          day_of_week: number;
          id: string;
          is_closed: boolean;
          open_time: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          close_time?: string | null;
          created_at?: string;
          day_of_week: number;
          id?: string;
          is_closed?: boolean;
          open_time?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          close_time?: string | null;
          created_at?: string;
          day_of_week?: number;
          id?: string;
          is_closed?: boolean;
          open_time?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_hours_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      business_modules: {
        Row: {
          analytics: boolean | null;
          appointments: boolean | null;
          created_at: string | null;
          crm: boolean | null;
          employees: boolean | null;
          id: string;
          inventory: boolean | null;
          ordering: boolean | null;
          tenant_id: string;
          updated_at: string | null;
        };
        Insert: {
          analytics?: boolean | null;
          appointments?: boolean | null;
          created_at?: string | null;
          crm?: boolean | null;
          employees?: boolean | null;
          id?: string;
          inventory?: boolean | null;
          ordering?: boolean | null;
          tenant_id: string;
          updated_at?: string | null;
        };
        Update: {
          analytics?: boolean | null;
          appointments?: boolean | null;
          created_at?: string | null;
          crm?: boolean | null;
          employees?: boolean | null;
          id?: string;
          inventory?: boolean | null;
          ordering?: boolean | null;
          tenant_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_modules_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      business_notifications: {
        Row: {
          created_at: string;
          event_key: string;
          href: string | null;
          id: string;
          is_read: boolean;
          message: string;
          read_at: string | null;
          source_id: string | null;
          source_table: string | null;
          tenant_id: string;
          title: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          event_key: string;
          href?: string | null;
          id?: string;
          is_read?: boolean;
          message: string;
          read_at?: string | null;
          source_id?: string | null;
          source_table?: string | null;
          tenant_id: string;
          title: string;
          type: string;
        };
        Update: {
          created_at?: string;
          event_key?: string;
          href?: string | null;
          id?: string;
          is_read?: boolean;
          message?: string;
          read_at?: string | null;
          source_id?: string | null;
          source_table?: string | null;
          tenant_id?: string;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_notifications_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      business_reviews: {
        Row: {
          body: string | null;
          created_at: string;
          customer_id: string | null;
          id: string;
          is_published: boolean;
          is_visible: boolean | null;
          rating: number | null;
          review: string | null;
          reviewer_name: string | null;
          service_id: string | null;
          tenant_id: string;
          title: string | null;
          updated_at: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          is_published?: boolean;
          is_visible?: boolean | null;
          rating?: number | null;
          review?: string | null;
          reviewer_name?: string | null;
          service_id?: string | null;
          tenant_id: string;
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          is_published?: boolean;
          is_visible?: boolean | null;
          rating?: number | null;
          review?: string | null;
          reviewer_name?: string | null;
          service_id?: string | null;
          tenant_id?: string;
          title?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_reviews_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      business_settings: {
        Row: {
          allow_online_payment: boolean | null;
          appointment_deposit_percentage: number | null;
          appointment_reminder_minutes: number[];
          appointment_reminders_enabled: boolean;
          booking_enabled: boolean | null;
          created_at: string | null;
          currency: string | null;
          id: string;
          minimum_order_amount: number | null;
          ordering_enabled: boolean | null;
          primary_color: string | null;
          require_appointment_deposit: boolean | null;
          secondary_color: string | null;
          tax_rate: number | null;
          tenant_id: string;
          timezone: string | null;
          updated_at: string | null;
        };
        Insert: {
          allow_online_payment?: boolean | null;
          appointment_deposit_percentage?: number | null;
          appointment_reminder_minutes?: number[];
          appointment_reminders_enabled?: boolean;
          booking_enabled?: boolean | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          minimum_order_amount?: number | null;
          ordering_enabled?: boolean | null;
          primary_color?: string | null;
          require_appointment_deposit?: boolean | null;
          secondary_color?: string | null;
          tax_rate?: number | null;
          tenant_id: string;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Update: {
          allow_online_payment?: boolean | null;
          appointment_deposit_percentage?: number | null;
          appointment_reminder_minutes?: number[];
          appointment_reminders_enabled?: boolean;
          booking_enabled?: boolean | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          minimum_order_amount?: number | null;
          ordering_enabled?: boolean | null;
          primary_color?: string | null;
          require_appointment_deposit?: boolean | null;
          secondary_color?: string | null;
          tax_rate?: number | null;
          tenant_id?: string;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_settings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          sort_order: number | null;
          tenant_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          sort_order?: number | null;
          tenant_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          sort_order?: number | null;
          tenant_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          created_at: string | null;
          email: string | null;
          first_name: string;
          id: string;
          is_active: boolean | null;
          last_name: string;
          notes: string | null;
          phone: string | null;
          tenant_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email?: string | null;
          first_name: string;
          id?: string;
          is_active?: boolean | null;
          last_name: string;
          notes?: string | null;
          phone?: string | null;
          tenant_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          first_name?: string;
          id?: string;
          is_active?: boolean | null;
          last_name?: string;
          notes?: string | null;
          phone?: string | null;
          tenant_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_adjustments: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          order_id: string | null;
          product_id: string;
          quantity_delta: number;
          reason: string;
          tenant_id: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_id?: string | null;
          product_id: string;
          quantity_delta: number;
          reason: string;
          tenant_id: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_id?: string | null;
          product_id?: string;
          quantity_delta?: number;
          reason?: string;
          tenant_id?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_adjustments_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_adjustments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_adjustments_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_transactions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          product_id: string;
          quantity_change: number;
          reference_id: string | null;
          tenant_id: string;
          transaction_type: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          product_id: string;
          quantity_change: number;
          reference_id?: string | null;
          tenant_id: string;
          transaction_type: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          product_id?: string;
          quantity_change?: number;
          reference_id?: string | null;
          tenant_id?: string;
          transaction_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_transactions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_transactions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_acceptances: {
        Row: {
          acceptance_method: string;
          accepted_at: string;
          created_at: string;
          id: string;
          privacy_version: string;
          terms_version: string;
          user_id: string;
        };
        Insert: {
          acceptance_method?: string;
          accepted_at?: string;
          created_at?: string;
          id?: string;
          privacy_version: string;
          terms_version: string;
          user_id: string;
        };
        Update: {
          acceptance_method?: string;
          accepted_at?: string;
          created_at?: string;
          id?: string;
          privacy_version?: string;
          terms_version?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string | null;
          id: string;
          is_read: boolean | null;
          message: string | null;
          read_at: string | null;
          recipient_profile_id: string | null;
          tenant_id: string;
          title: string;
          type: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_read?: boolean | null;
          message?: string | null;
          read_at?: string | null;
          recipient_profile_id?: string | null;
          tenant_id: string;
          title: string;
          type?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_read?: boolean | null;
          message?: string | null;
          read_at?: string | null;
          recipient_profile_id?: string | null;
          tenant_id?: string;
          title?: string;
          type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey";
            columns: ["recipient_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_email_deliveries: {
        Row: {
          attempt_count: number;
          created_at: string;
          event_type: string;
          id: string;
          last_error: string | null;
          order_id: string;
          payload: Json;
          processing_started_at: string | null;
          provider_message_id: string | null;
          recipient_email: string;
          recipient_name: string;
          sent_at: string | null;
          status: string;
          subject: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          created_at?: string;
          event_type: string;
          id?: string;
          last_error?: string | null;
          order_id: string;
          payload?: Json;
          processing_started_at?: string | null;
          provider_message_id?: string | null;
          recipient_email: string;
          recipient_name?: string;
          sent_at?: string | null;
          status?: string;
          subject: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          event_type?: string;
          id?: string;
          last_error?: string | null;
          order_id?: string;
          payload?: Json;
          processing_started_at?: string | null;
          provider_message_id?: string | null;
          recipient_email?: string;
          recipient_name?: string;
          sent_at?: string | null;
          status?: string;
          subject?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_email_deliveries_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_email_deliveries_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          addons: Json;
          created_at: string | null;
          id: string;
          order_id: string;
          price: number | null;
          product_id: string | null;
          product_name: string;
          quantity: number;
          sku: string | null;
          subtotal: number;
          tenant_id: string;
          unit_price: number;
          variant_id: string | null;
        };
        Insert: {
          addons?: Json;
          created_at?: string | null;
          id?: string;
          order_id: string;
          price?: number | null;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          sku?: string | null;
          subtotal: number;
          tenant_id: string;
          unit_price: number;
          variant_id?: string | null;
        };
        Update: {
          addons?: Json;
          created_at?: string | null;
          id?: string;
          order_id?: string;
          price?: number | null;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          sku?: string | null;
          subtotal?: number;
          tenant_id?: string;
          unit_price?: number;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string | null;
          customer_email: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          delivery_address: string | null;
          delivery_fee: number | null;
          discount_amount: number | null;
          fulfillment_type: string | null;
          id: string;
          notes: string | null;
          order_number: string;
          payment_status: string | null;
          promotion_code: string | null;
          promotion_discount_amount: number;
          promotion_id: string | null;
          status: string | null;
          subtotal: number | null;
          tax_amount: number | null;
          tenant_id: string;
          total: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          delivery_address?: string | null;
          delivery_fee?: number | null;
          discount_amount?: number | null;
          fulfillment_type?: string | null;
          id?: string;
          notes?: string | null;
          order_number: string;
          payment_status?: string | null;
          promotion_code?: string | null;
          promotion_discount_amount?: number;
          promotion_id?: string | null;
          status?: string | null;
          subtotal?: number | null;
          tax_amount?: number | null;
          tenant_id: string;
          total?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          delivery_address?: string | null;
          delivery_fee?: number | null;
          discount_amount?: number | null;
          fulfillment_type?: string | null;
          id?: string;
          notes?: string | null;
          order_number?: string;
          payment_status?: string | null;
          promotion_code?: string | null;
          promotion_discount_amount?: number;
          promotion_id?: string | null;
          status?: string | null;
          subtotal?: number | null;
          tax_amount?: number | null;
          tenant_id?: string;
          total?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_promotion_id_fkey";
            columns: ["promotion_id"];
            isOneToOne: false;
            referencedRelation: "promotions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number | null;
          appointment_id: string | null;
          created_at: string | null;
          currency: string | null;
          id: string;
          order_id: string | null;
          paid_at: string | null;
          payment_method: string | null;
          payment_status: string | null;
          payment_type: string | null;
          provider: string | null;
          provider_transaction_id: string | null;
          tenant_id: string;
          transaction_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          amount?: number | null;
          appointment_id?: string | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          order_id?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          payment_status?: string | null;
          payment_type?: string | null;
          provider?: string | null;
          provider_transaction_id?: string | null;
          tenant_id: string;
          transaction_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          amount?: number | null;
          appointment_id?: string | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          order_id?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          payment_status?: string | null;
          payment_type?: string | null;
          provider?: string | null;
          provider_transaction_id?: string | null;
          tenant_id?: string;
          transaction_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          attributes: Json;
          available: boolean;
          created_at: string;
          id: string;
          price: number | null;
          product_id: string;
          sku: string;
          stock: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          attributes?: Json;
          available?: boolean;
          created_at?: string;
          id?: string;
          price?: number | null;
          product_id: string;
          sku: string;
          stock?: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          attributes?: Json;
          available?: boolean;
          created_at?: string;
          id?: string;
          price?: number | null;
          product_id?: string;
          sku?: string;
          stock?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          addons: Json;
          available: boolean | null;
          category_id: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          image_url: string | null;
          low_stock_threshold: number | null;
          name: string;
          price: number;
          sku: string | null;
          stock: number | null;
          tenant_id: string;
          track_inventory: boolean;
          updated_at: string | null;
        };
        Insert: {
          addons?: Json;
          available?: boolean | null;
          category_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          low_stock_threshold?: number | null;
          name: string;
          price: number;
          sku?: string | null;
          stock?: number | null;
          tenant_id: string;
          track_inventory?: boolean;
          updated_at?: string | null;
        };
        Update: {
          addons?: Json;
          available?: boolean | null;
          category_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          low_stock_threshold?: number | null;
          name?: string;
          price?: number;
          sku?: string | null;
          stock?: number | null;
          tenant_id?: string;
          track_inventory?: boolean;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
          platform_role: string;
          role: string | null;
          tenant_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          platform_role?: string;
          role?: string | null;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          platform_role?: string;
          role?: string | null;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      promotion_redemptions: {
        Row: {
          appointment_id: string | null;
          created_at: string;
          customer_id: string | null;
          discount_amount: number;
          id: string;
          order_id: string | null;
          promotion_id: string;
          tenant_id: string;
        };
        Insert: {
          appointment_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          discount_amount: number;
          id?: string;
          order_id?: string | null;
          promotion_id: string;
          tenant_id: string;
        };
        Update: {
          appointment_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          discount_amount?: number;
          id?: string;
          order_id?: string | null;
          promotion_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promotion_redemptions_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_promotion_id_fkey";
            columns: ["promotion_id"];
            isOneToOne: false;
            referencedRelation: "promotions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      promotions: {
        Row: {
          applicable_product_ids: string[];
          applicable_service_ids: string[];
          code: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          discount_type: string;
          discount_value: number;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          name: string;
          starts_at: string | null;
          tenant_id: string;
          updated_at: string;
          usage_count: number;
          usage_limit: number | null;
        };
        Insert: {
          applicable_product_ids?: string[];
          applicable_service_ids?: string[];
          code: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          discount_type: string;
          discount_value: number;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          starts_at?: string | null;
          tenant_id: string;
          updated_at?: string;
          usage_count?: number;
          usage_limit?: number | null;
        };
        Update: {
          applicable_product_ids?: string[];
          applicable_service_ids?: string[];
          code?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          discount_type?: string;
          discount_value?: number;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          starts_at?: string | null;
          tenant_id?: string;
          updated_at?: string;
          usage_count?: number;
          usage_limit?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "promotions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          created_at: string;
          permission_id: string;
          role_id: string;
        };
        Insert: {
          created_at?: string;
          permission_id: string;
          role_id: string;
        };
        Update: {
          created_at?: string;
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_system_role: boolean;
          name: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system_role?: boolean;
          name: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system_role?: boolean;
          name?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      service_departments: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_departments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          available: boolean | null;
          category: string | null;
          created_at: string | null;
          department_id: string | null;
          deposit_amount: number | null;
          deposit_type: string | null;
          description: string | null;
          duration_minutes: number | null;
          id: string;
          image_url: string | null;
          name: string;
          price: number | null;
          requires_deposit: boolean | null;
          tenant_id: string;
          updated_at: string | null;
        };
        Insert: {
          available?: boolean | null;
          category?: string | null;
          created_at?: string | null;
          department_id?: string | null;
          deposit_amount?: number | null;
          deposit_type?: string | null;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          image_url?: string | null;
          name: string;
          price?: number | null;
          requires_deposit?: boolean | null;
          tenant_id: string;
          updated_at?: string | null;
        };
        Update: {
          available?: boolean | null;
          category?: string | null;
          created_at?: string | null;
          department_id?: string | null;
          deposit_amount?: number | null;
          deposit_type?: string | null;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          price?: number | null;
          requires_deposit?: boolean | null;
          tenant_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "services_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "service_departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "services_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      staff: {
        Row: {
          accepts_appointments: boolean;
          avatar_url: string | null;
          bio: string | null;
          color: string;
          created_at: string | null;
          display_name: string;
          email: string | null;
          id: string;
          is_active: boolean | null;
          is_bookable: boolean | null;
          phone: string | null;
          position: string | null;
          profile_id: string | null;
          tenant_id: string;
          updated_at: string | null;
        };
        Insert: {
          accepts_appointments?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          color?: string;
          created_at?: string | null;
          display_name: string;
          email?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_bookable?: boolean | null;
          phone?: string | null;
          position?: string | null;
          profile_id?: string | null;
          tenant_id: string;
          updated_at?: string | null;
        };
        Update: {
          accepts_appointments?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          color?: string;
          created_at?: string | null;
          display_name?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_bookable?: boolean | null;
          phone?: string | null;
          position?: string | null;
          profile_id?: string | null;
          tenant_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_availability: {
        Row: {
          created_at: string;
          day_of_week: number;
          end_time: string;
          id: string;
          is_available: boolean;
          staff_id: string;
          start_time: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          day_of_week: number;
          end_time: string;
          id?: string;
          is_available?: boolean;
          staff_id: string;
          start_time: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          is_available?: boolean;
          staff_id?: string;
          start_time?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_availability_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_availability_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_services: {
        Row: {
          created_at: string;
          duration_override_minutes: number | null;
          id: string;
          price_override: number | null;
          service_id: string;
          staff_id: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          duration_override_minutes?: number | null;
          id?: string;
          price_override?: number | null;
          service_id: string;
          staff_id: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          duration_override_minutes?: number | null;
          id?: string;
          price_override?: number | null;
          service_id?: string;
          staff_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_services_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_time_off: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          reason: string | null;
          staff_id: string;
          starts_at: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          reason?: string | null;
          staff_id: string;
          starts_at: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          reason?: string | null;
          staff_id?: string;
          starts_at?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_time_off_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_time_off_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      storefront_contact_messages: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          sender_email: string;
          sender_name: string;
          status: string;
          subject: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          sender_email: string;
          sender_name: string;
          status?: string;
          subject: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          sender_email?: string;
          sender_name?: string;
          status?: string;
          subject?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "storefront_contact_messages_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      team_access_events: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json;
          id: number;
          invitation_id: string | null;
          subject_profile_id: string | null;
          tenant_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: number;
          invitation_id?: string | null;
          subject_profile_id?: string | null;
          tenant_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: number;
          invitation_id?: string | null;
          subject_profile_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_access_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_access_events_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "team_invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_access_events_subject_profile_id_fkey";
            columns: ["subject_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_access_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      team_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          email_provider_message_id: string | null;
          email_sent_at: string | null;
          expires_at: string;
          id: string;
          invited_by: string;
          revoked_at: string | null;
          role_name: string;
          status: string;
          tenant_id: string;
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          email_provider_message_id?: string | null;
          email_sent_at?: string | null;
          expires_at?: string;
          id?: string;
          invited_by: string;
          revoked_at?: string | null;
          role_name: string;
          status?: string;
          tenant_id: string;
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          email_provider_message_id?: string | null;
          email_sent_at?: string | null;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          revoked_at?: string | null;
          role_name?: string;
          status?: string;
          tenant_id?: string;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_invitations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_memberships: {
        Row: {
          id: string;
          is_active: boolean;
          joined_at: string;
          profile_id: string;
          role_id: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          is_active?: boolean;
          joined_at?: string;
          profile_id: string;
          role_id: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          joined_at?: string;
          profile_id?: string;
          role_id?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_memberships_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_seat_change_requests: {
        Row: {
          created_at: string;
          id: string;
          requested_by: string;
          requested_paid_seats: number;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          requested_by: string;
          requested_paid_seats: number;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          requested_by?: string;
          requested_paid_seats?: number;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_seat_change_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_seat_change_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_seat_change_requests_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_seat_entitlements: {
        Row: {
          created_at: string;
          paid_staff_seats: number;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          paid_staff_seats?: number;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          paid_staff_seats?: number;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_seat_entitlements_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_seat_entitlements_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          accent_color: string | null;
          address: string | null;
          banner_url: string | null;
          business_name: string;
          business_type: string;
          city: string | null;
          cover_image: string | null;
          cover_image_position_x: number | null;
          cover_image_position_y: number | null;
          cover_image_zoom: number | null;
          created_at: string | null;
          created_by: string | null;
          cancel_at_period_end: boolean | null;
          canceled_at: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          custom_domain: string | null;
          custom_domain_verified_at: string | null;
          description: string | null;
          email: string | null;
          id: string;
          is_active: boolean;
          logo: string | null;
          logo_bg: string | null;
          logo_url: string | null;
          owner_id: string | null;
          phone: string | null;
          plan: string | null;
          primary_color: string | null;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          slug: string;
          social_links: Json;
          status: string;
          stripe_connected: boolean | null;
          subdomain: string;
          subscription_status: string | null;
          subscription_base_amount: number | null;
          subscription_paid_staff_seats: number | null;
          subscription_recurring_total: number | null;
          subscription_seat_amount: number | null;
          subscription_updated_at: string | null;
          trial_ends_at: string | null;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          accent_color?: string | null;
          address?: string | null;
          banner_url?: string | null;
          business_name: string;
          business_type?: string;
          city?: string | null;
          cover_image?: string | null;
          cover_image_position_x?: number | null;
          cover_image_position_y?: number | null;
          cover_image_zoom?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          cancel_at_period_end?: boolean | null;
          canceled_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          custom_domain?: string | null;
          custom_domain_verified_at?: string | null;
          description?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          logo?: string | null;
          logo_bg?: string | null;
          logo_url?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          plan?: string | null;
          primary_color?: string | null;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          slug: string;
          social_links?: Json;
          status?: string;
          stripe_connected?: boolean | null;
          subdomain: string;
          subscription_status?: string | null;
          subscription_base_amount?: number | null;
          subscription_paid_staff_seats?: number | null;
          subscription_recurring_total?: number | null;
          subscription_seat_amount?: number | null;
          subscription_updated_at?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          accent_color?: string | null;
          address?: string | null;
          banner_url?: string | null;
          business_name?: string;
          business_type?: string;
          city?: string | null;
          cover_image?: string | null;
          cover_image_position_x?: number | null;
          cover_image_position_y?: number | null;
          cover_image_zoom?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          cancel_at_period_end?: boolean | null;
          canceled_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          custom_domain?: string | null;
          custom_domain_verified_at?: string | null;
          description?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          logo?: string | null;
          logo_bg?: string | null;
          logo_url?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          plan?: string | null;
          primary_color?: string | null;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          slug?: string;
          social_links?: Json;
          status?: string;
          stripe_connected?: boolean | null;
          subdomain?: string;
          subscription_status?: string | null;
          subscription_base_amount?: number | null;
          subscription_paid_staff_seats?: number | null;
          subscription_recurring_total?: number | null;
          subscription_seat_amount?: number | null;
          subscription_updated_at?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenants_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      transactional_email_deliveries: {
        Row: {
          attempt_count: number;
          created_at: string;
          event_type: string;
          id: string;
          idempotency_key: string;
          last_error: string | null;
          payload: Json;
          processing_started_at: string | null;
          provider_message_id: string | null;
          recipient_email: string;
          recipient_name: string;
          sent_at: string | null;
          source_id: string;
          source_table: string;
          status: string;
          subject: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          created_at?: string;
          event_type: string;
          id?: string;
          idempotency_key: string;
          last_error?: string | null;
          payload?: Json;
          processing_started_at?: string | null;
          provider_message_id?: string | null;
          recipient_email: string;
          recipient_name?: string;
          sent_at?: string | null;
          source_id: string;
          source_table: string;
          status?: string;
          subject: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          event_type?: string;
          id?: string;
          idempotency_key?: string;
          last_error?: string | null;
          payload?: Json;
          processing_started_at?: string | null;
          provider_message_id?: string | null;
          recipient_email?: string;
          recipient_name?: string;
          sent_at?: string | null;
          source_id?: string;
          source_table?: string;
          status?: string;
          subject?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactional_email_deliveries_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_team_invitation: {
        Args: { p_full_name?: string; p_token: string };
        Returns: string;
      };
      apply_public_appointment_promotion: {
        Args: { p_appointment_id: string; p_code: string; p_tenant_id: string };
        Returns: number;
      };
      apply_public_order_promotion: {
        Args: { p_code: string; p_order_id: string; p_tenant_id: string };
        Returns: number;
      };
      assign_appointment_provider: {
        Args: {
          p_appointment_id: string;
          p_provider_id: string;
          p_tenant_id: string;
        };
        Returns: undefined;
      };
      calculate_promotion_discount: {
        Args: {
          p_amount: number;
          p_code: string;
          p_product_ids?: string[];
          p_service_id?: string;
          p_tenant_id: string;
        };
        Returns: Json;
      };
      claim_email_jobs: { Args: { p_limit?: number }; Returns: Json[] };
      create_additional_owner_business: {
        Args: {
          p_business_name: string;
          p_business_type: string;
          p_city?: string;
          p_phone?: string;
          p_slug?: string;
        };
        Returns: string;
      };
      create_public_appointment: {
        Args: {
          p_appointment_date: string;
          p_appointment_time: string;
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_notes?: string;
          p_service_id: string;
          p_tenant_id: string;
        };
        Returns: string;
      };
      create_public_appointment_with_provider: {
        Args: {
          p_appointment_date: string;
          p_appointment_time: string;
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_notes?: string;
          p_promotion_code?: string;
          p_service_id: string;
          p_staff_id?: string;
          p_tenant_id: string;
        };
        Returns: string;
      };
      create_public_order: {
        Args: {
          p_customer_name: string;
          p_customer_phone: string;
          p_items: Json;
          p_notes?: string;
          p_order_type: string;
          p_tenant_id: string;
        };
        Returns: {
          order_id: string;
          order_number: string;
          total: number;
        }[];
      };
      create_public_order_with_email: {
        Args: {
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_items: Json;
          p_notes?: string;
          p_order_type: string;
          p_promotion_code?: string;
          p_tenant_id: string;
        };
        Returns: {
          order_id: string;
          order_number: string;
          total: number;
        }[];
      };
      create_public_order_with_promotion: {
        Args: {
          p_customer_name: string;
          p_customer_phone: string;
          p_items: Json;
          p_notes?: string;
          p_order_type: string;
          p_promotion_code?: string;
          p_tenant_id: string;
        };
        Returns: {
          order_id: string;
          order_number: string;
          total: number;
        }[];
      };
      create_public_retail_order: {
        Args: {
          p_customer_email: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_items: Json;
          p_notes?: string;
          p_payment_method?: string;
          p_tenant_id: string;
        };
        Returns: {
          order_id: string;
          order_number: string;
          payment_reference: string;
          payment_status: string;
          total: number;
        }[];
      };
      create_team_invitation: {
        Args: { p_email: string; p_role_name: string; p_tenant_id: string };
        Returns: Json;
      };
      current_tenant_role: { Args: { p_tenant_id: string }; Returns: string };
      current_user_owns_tenant: {
        Args: { p_tenant_id: string };
        Returns: boolean;
      };
      deactivate_team_member: {
        Args: { p_membership_id: string; p_tenant_id: string };
        Returns: undefined;
      };
      cancel_tenant_subscription_at_period_end: {
        Args: { p_tenant_id: string };
        Returns: Json;
      };
      complete_subscription_checkout_v2: {
        Args: {
          p_expected_base_amount: number;
          p_expected_seat_amount: number;
          p_expected_total: number;
          p_idempotency_key: string;
          p_paid_staff_seats: number;
          p_plan: string;
          p_provider: string;
          p_provider_customer_id: string;
          p_provider_reference: string;
          p_provider_subscription_id: string;
          p_tenant_id: string;
        };
        Returns: Json;
      };
      enqueue_due_trial_emails: { Args: never; Returns: number };
      get_public_appointment_availability: {
        Args: {
          p_appointment_date: string;
          p_service_id: string;
          p_tenant_id: string;
        };
        Returns: {
          appointment_time: string;
        }[];
      };
      get_public_provider_availability: {
        Args: {
          p_appointment_date: string;
          p_service_id: string;
          p_staff_id?: string;
          p_tenant_id: string;
        };
        Returns: {
          appointment_time: string;
        }[];
      };
      get_tenant_crm_summary: { Args: { p_tenant_id: string }; Returns: Json };
      get_tenant_monthly_usage: {
        Args: { p_tenant_id: string };
        Returns: {
          activity_count: number;
          activity_limit: number;
          is_limit_reached: boolean;
          period_end: string;
          period_start: string;
          plan: string;
          usage_percent: number;
        }[];
      };
      get_tenant_seat_admin_summary: {
        Args: { p_tenant_id: string };
        Returns: Json;
      };
      get_tenant_team_summary: { Args: { p_tenant_id: string }; Returns: Json };
      tenant_effective_entitlements: {
        Args: { p_tenant_id: string };
        Returns: Json;
      };
      tenant_subscription_allows_access: {
        Args: { p_tenant_id: string };
        Returns: boolean;
      };
      growth_tools_subscription_allows_access: {
        Args: { p_tenant_id: string };
        Returns: boolean;
      };
      is_super_admin: { Args: never; Returns: boolean };
      mark_email_job_result: {
        Args: {
          p_error?: string;
          p_job_id: string;
          p_provider_message_id?: string;
          p_queue_name: string;
          p_status: string;
        };
        Returns: undefined;
      };
      plan_monthly_activity_limit: {
        Args: { p_plan: string };
        Returns: number;
      };
      provision_owner_business: {
        Args: {
          p_business_name: string;
          p_business_type: string;
          p_city: string;
          p_full_name: string;
          p_phone: string;
          p_slug: string;
        };
        Returns: string;
      };
      reject_tenant_paid_staff_seat_request: {
        Args: {
          p_request_id: string;
          p_review_note: string;
          p_tenant_id: string;
        };
        Returns: undefined;
      };
      request_tenant_paid_staff_seats: {
        Args: { p_requested_paid_seats: number; p_tenant_id: string };
        Returns: string;
      };
      revoke_team_invitation: {
        Args: { p_invitation_id: string; p_tenant_id: string };
        Returns: undefined;
      };
      save_service_provider: {
        Args: {
          p_availability: Json;
          p_bio: string;
          p_color: string;
          p_email: string;
          p_is_active: boolean;
          p_name: string;
          p_phone: string;
          p_provider_id: string;
          p_service_ids: string[];
          p_tenant_id: string;
        };
        Returns: string;
      };
      set_tenant_paid_staff_seats: {
        Args: {
          p_paid_staff_seats: number;
          p_request_id?: string;
          p_review_note?: string;
          p_tenant_id: string;
        };
        Returns: undefined;
      };
      submit_storefront_contact_message: {
        Args: {
          p_message: string;
          p_sender_email: string;
          p_sender_name: string;
          p_subject: string;
          p_tenant_id: string;
        };
        Returns: string;
      };
      team_plan_included_staff: { Args: { p_plan: string }; Returns: number };
      team_plan_max_staff: { Args: { p_plan: string }; Returns: number };
      tenant_authorized_staff_capacity: {
        Args: { p_tenant_id: string };
        Returns: number;
      };
      tenant_monthly_activity_usage: {
        Args: { p_at?: string; p_tenant_id: string };
        Returns: number;
      };
      tenant_plan_has_feature: {
        Args: { p_feature: string; p_tenant_id: string };
        Returns: boolean;
      };
      transactional_email_owner: {
        Args: { p_tenant_id: string };
        Returns: {
          email: string;
          full_name: string;
        }[];
      };
      update_team_member_role: {
        Args: {
          p_membership_id: string;
          p_role_name: string;
          p_tenant_id: string;
        };
        Returns: undefined;
      };
      user_has_permission: {
        Args: { requested_permission: string; requested_tenant_id: string };
        Returns: boolean;
      };
      user_has_tenant_access: {
        Args: { requested_tenant_id: string };
        Returns: boolean;
      };
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
  public: {
    Enums: {},
  },
} as const;
