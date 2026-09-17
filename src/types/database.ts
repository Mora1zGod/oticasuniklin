// ============================================================================
// GERADO AUTOMATICAMENTE — NAO EDITAR A MAO
// ----------------------------------------------------------------------------
// Fonte: schema real em db/migrations/*.sql, introspectado do Postgres.
// Regerar: ./db/tools/validate.sh && python3 db/tools/gen_types.py
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string
          auth_user_id: string | null
          tenant_id: string
          full_name: string
          email: string
          phone: string | null
          is_active: boolean
          is_tenant_admin: boolean
          is_salesperson: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          tenant_id: string
          full_name: string
          email: string
          phone?: string | null
          is_active?: boolean
          is_tenant_admin?: boolean
          is_salesperson?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          tenant_id?: string
          full_name?: string
          email?: string
          phone?: string | null
          is_active?: boolean
          is_tenant_admin?: boolean
          is_salesperson?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'app_users_auth_user_id_fkey'
            columns: ['auth_user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'app_users_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      /** Unidade operacional do tenant. NAO e fronteira de cadastro de cliente (ADR-008). */
      branches: {
        Row: {
          id: string
          tenant_id: string
          code: string
          legal_name: string
          trade_name: string
          tax_document: string | null
          state_registration: string | null
          phone: string | null
          email: string | null
          zip_code: string | null
          street: string | null
          street_number: string | null
          complement: string | null
          district: string | null
          city: string | null
          state_code: string | null
          timezone: string
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          code: string
          legal_name: string
          trade_name: string
          tax_document?: string | null
          state_registration?: string | null
          phone?: string | null
          email?: string | null
          zip_code?: string | null
          street?: string | null
          street_number?: string | null
          complement?: string | null
          district?: string | null
          city?: string | null
          state_code?: string | null
          timezone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          code?: string
          legal_name?: string
          trade_name?: string
          tax_document?: string | null
          state_registration?: string | null
          phone?: string | null
          email?: string | null
          zip_code?: string | null
          street?: string | null
          street_number?: string | null
          complement?: string | null
          district?: string | null
          city?: string | null
          state_code?: string | null
          timezone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'branches_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      brands: {
        Row: {
          id: string
          tenant_id: string
          name: string
          manufacturer_name: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          manufacturer_name?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          manufacturer_name?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'brands_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      catalog_definitions: {
        Row: {
          key: string
          label: string
          description: string | null
          scope: 'platform' | 'tenant' | 'both'
          allows_custom: boolean
          created_at: string
        }
        Insert: {
          key: string
          label: string
          description?: string | null
          scope?: 'platform' | 'tenant' | 'both'
          allows_custom?: boolean
          created_at?: string
        }
        Update: {
          key?: string
          label?: string
          description?: string | null
          scope?: 'platform' | 'tenant' | 'both'
          allows_custom?: boolean
          created_at?: string
        }
        Relationships: [
        ]
      }
      /** Listas descritivas sem comportamento (profissao, origem, parentesco, tipo de documento...). tenant_id NULL = semente global da plataforma. */
      catalog_entries: {
        Row: {
          id: string
          catalog_key: string
          tenant_id: string | null
          code: string
          label: string
          sort_order: number
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          catalog_key: string
          tenant_id?: string | null
          code: string
          label: string
          sort_order?: number
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          catalog_key?: string
          tenant_id?: string | null
          code?: string
          label?: string
          sort_order?: number
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'catalog_entries_catalog_key_fkey'
            columns: ['catalog_key']
            referencedRelation: 'catalog_definitions'
            referencedColumns: ['key']
          },
          {
            foreignKeyName: 'catalog_entries_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      chart_accounts: {
        Row: {
          id: string
          tenant_id: string
          parent_id: string | null
          code: string
          label: string
          account_kind: 'revenue' | 'expense' | 'asset' | 'liability' | 'equity'
          accepts_entries: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          parent_id?: string | null
          code: string
          label: string
          account_kind: 'revenue' | 'expense' | 'asset' | 'liability' | 'equity'
          accepts_entries?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          parent_id?: string | null
          code?: string
          label?: string
          account_kind?: 'revenue' | 'expense' | 'asset' | 'liability' | 'equity'
          accepts_entries?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chart_accounts_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'chart_accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chart_accounts_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      commission_rules: {
        Row: {
          id: string
          tenant_id: string
          label: string
          branch_id: string | null
          app_user_id: string | null
          product_kind: 'frame' | 'sunglass' | 'lens' | 'contact_lens' | 'accessory' | 'service' | 'lens_treatment' | null
          category_id: string | null
          rate_percent: number
          base: 'net_item' | 'gross_item' | 'margin'
          release_event: 'sale_confirmed' | 'sale_paid' | 'order_delivered'
          priority: number
          valid_from: string | null
          valid_to: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          label: string
          branch_id?: string | null
          app_user_id?: string | null
          product_kind?: 'frame' | 'sunglass' | 'lens' | 'contact_lens' | 'accessory' | 'service' | 'lens_treatment' | null
          category_id?: string | null
          rate_percent: number
          base?: 'net_item' | 'gross_item' | 'margin'
          release_event?: 'sale_confirmed' | 'sale_paid' | 'order_delivered'
          priority?: number
          valid_from?: string | null
          valid_to?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          label?: string
          branch_id?: string | null
          app_user_id?: string | null
          product_kind?: 'frame' | 'sunglass' | 'lens' | 'contact_lens' | 'accessory' | 'service' | 'lens_treatment' | null
          category_id?: string | null
          rate_percent?: number
          base?: 'net_item' | 'gross_item' | 'margin'
          release_event?: 'sale_confirmed' | 'sale_paid' | 'order_delivered'
          priority?: number
          valid_from?: string | null
          valid_to?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'commission_rules_app_user_id_fkey'
            columns: ['app_user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_rules_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_rules_category_id_fkey'
            columns: ['category_id']
            referencedRelation: 'product_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_rules_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      commissions: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          sale_id: string
          sale_item_id: string | null
          app_user_id: string
          commission_rule_id: string | null
          base_amount: number
          rate_percent: number
          amount: number
          status: 'pending' | 'released' | 'paid' | 'cancelled'
          released_at: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          branch_id: string
          sale_id: string
          sale_item_id?: string | null
          app_user_id: string
          commission_rule_id?: string | null
          base_amount: number
          rate_percent: number
          amount: number
          status?: 'pending' | 'released' | 'paid' | 'cancelled'
          released_at?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          branch_id?: string
          sale_id?: string
          sale_item_id?: string | null
          app_user_id?: string
          commission_rule_id?: string | null
          base_amount?: number
          rate_percent?: number
          amount?: number
          status?: 'pending' | 'released' | 'paid' | 'cancelled'
          released_at?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'commissions_app_user_id_fkey'
            columns: ['app_user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commissions_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commissions_commission_rule_id_fkey'
            columns: ['commission_rule_id']
            referencedRelation: 'commission_rules'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commissions_sale_id_fkey'
            columns: ['sale_id']
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commissions_sale_item_id_fkey'
            columns: ['sale_item_id']
            referencedRelation: 'sale_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commissions_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      company_profiles: {
        Row: {
          customer_id: string
          tenant_id: string
          cnpj: string | null
          legal_name: string | null
          trade_name: string | null
          state_registration: string | null
          state_registration_exempt: boolean
          municipal_registration: string | null
          tax_regime: 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei' | 'imune' | 'isento' | null
          icms_taxpayer: boolean
          suframa_code: string | null
          founded_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          customer_id: string
          tenant_id: string
          cnpj?: string | null
          legal_name?: string | null
          trade_name?: string | null
          state_registration?: string | null
          state_registration_exempt?: boolean
          municipal_registration?: string | null
          tax_regime?: 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei' | 'imune' | 'isento' | null
          icms_taxpayer?: boolean
          suframa_code?: string | null
          founded_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          tenant_id?: string
          cnpj?: string | null
          legal_name?: string | null
          trade_name?: string | null
          state_registration?: string | null
          state_registration_exempt?: boolean
          municipal_registration?: string | null
          tax_regime?: 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei' | 'imune' | 'isento' | null
          icms_taxpayer?: boolean
          suframa_code?: string | null
          founded_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'company_profiles_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'company_profiles_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
        ]
      }
      customer_addresses: {
        Row: {
          id: string
          customer_id: string
          tenant_id: string
          kind: 'residential' | 'commercial' | 'billing' | 'delivery' | 'other'
          zip_code: string | null
          street: string | null
          street_number: string | null
          complement: string | null
          district: string | null
          city: string | null
          state_code: string | null
          country_code: string
          is_primary: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          tenant_id: string
          kind?: 'residential' | 'commercial' | 'billing' | 'delivery' | 'other'
          zip_code?: string | null
          street?: string | null
          street_number?: string | null
          complement?: string | null
          district?: string | null
          city?: string | null
          state_code?: string | null
          country_code?: string
          is_primary?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          tenant_id?: string
          kind?: 'residential' | 'commercial' | 'billing' | 'delivery' | 'other'
          zip_code?: string | null
          street?: string | null
          street_number?: string | null
          complement?: string | null
          district?: string | null
          city?: string | null
          state_code?: string | null
          country_code?: string
          is_primary?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customer_addresses_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'customer_addresses_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
        ]
      }
      customer_attachments: {
        Row: {
          id: string
          customer_id: string
          tenant_id: string
          kind: 'prescription' | 'document' | 'photo' | 'contract' | 'other'
          storage_path: string
          file_name: string
          mime_type: string | null
          byte_size: number | null
          uploaded_by: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          tenant_id: string
          kind?: 'prescription' | 'document' | 'photo' | 'contract' | 'other'
          storage_path: string
          file_name: string
          mime_type?: string | null
          byte_size?: number | null
          uploaded_by?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          tenant_id?: string
          kind?: 'prescription' | 'document' | 'photo' | 'contract' | 'other'
          storage_path?: string
          file_name?: string
          mime_type?: string | null
          byte_size?: number | null
          uploaded_by?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customer_attachments_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'customer_attachments_uploaded_by_fkey'
            columns: ['uploaded_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      customer_audit_events: {
        Row: {
          id: string
          customer_id: string
          tenant_id: string
          event_type: string
          entity_name: string | null
          entity_id: string | null
          before_data: Json | null
          after_data: Json | null
          performed_by: string | null
          performed_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          tenant_id: string
          event_type: string
          entity_name?: string | null
          entity_id?: string | null
          before_data?: Json | null
          after_data?: Json | null
          performed_by?: string | null
          performed_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          tenant_id?: string
          event_type?: string
          entity_name?: string | null
          entity_id?: string | null
          before_data?: Json | null
          after_data?: Json | null
          performed_by?: string | null
          performed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customer_audit_events_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'customer_audit_events_performed_by_fkey'
            columns: ['performed_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      /** Vendedor preferencial, tabela de preco e convenio POR FILIAL. Permite que a rede veja o mesmo cliente em varias unidades sem duplica-lo (ADR-008). */
      customer_branch_profiles: {
        Row: {
          id: string
          customer_id: string
          tenant_id: string
          branch_id: string
          preferred_salesperson_id: string | null
          price_table_id: string | null
          agreement_entry_id: string | null
          first_interaction_at: string | null
          last_interaction_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          tenant_id: string
          branch_id: string
          preferred_salesperson_id?: string | null
          price_table_id?: string | null
          agreement_entry_id?: string | null
          first_interaction_at?: string | null
          last_interaction_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          tenant_id?: string
          branch_id?: string
          preferred_salesperson_id?: string | null
          price_table_id?: string | null
          agreement_entry_id?: string | null
          first_interaction_at?: string | null
          last_interaction_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customer_branch_profiles_agreement_entry_id_fkey'
            columns: ['agreement_entry_id']
            referencedRelation: 'catalog_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_branch_profiles_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_branch_profiles_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'customer_branch_profiles_preferred_salesperson_id_fkey'
            columns: ['preferred_salesperson_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_branch_profiles_price_table_fk'
            columns: ['price_table_id']
            referencedRelation: 'price_tables'
            referencedColumns: ['id']
          },
        ]
      }
      customer_communications: {
        Row: {
          id: string
          customer_id: string
          tenant_id: string
          branch_id: string | null
          channel: 'whatsapp' | 'sms' | 'email' | 'phone' | 'in_person' | 'system'
          direction: 'inbound' | 'outbound'
          subject: string | null
          body: string | null
          related_entity: string | null
          related_entity_id: string | null
          occurred_at: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          tenant_id: string
          branch_id?: string | null
          channel: 'whatsapp' | 'sms' | 'email' | 'phone' | 'in_person' | 'system'
          direction: 'inbound' | 'outbound'
          subject?: string | null
          body?: string | null
          related_entity?: string | null
          related_entity_id?: string | null
          occurred_at?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          tenant_id?: string
          branch_id?: string | null
          channel?: 'whatsapp' | 'sms' | 'email' | 'phone' | 'in_person' | 'system'
          direction?: 'inbound' | 'outbound'
          subject?: string | null
          body?: string | null
          related_entity?: string | null
          related_entity_id?: string | null
          occurred_at?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customer_communications_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_communications_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_communications_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
        ]
      }
      customer_consents: {
        Row: {
          id: string
          customer_id: string
          tenant_id: string
          purpose: 'data_processing' | 'marketing' | 'health_data' | 'image_use' | 'third_party_sharing'
          granted: boolean
          granted_at: string
          revoked_at: string | null
          source: string | null
          evidence_path: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          tenant_id: string
          purpose: 'data_processing' | 'marketing' | 'health_data' | 'image_use' | 'third_party_sharing'
          granted: boolean
          granted_at?: string
          revoked_at?: string | null
          source?: string | null
          evidence_path?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          tenant_id?: string
          purpose?: 'data_processing' | 'marketing' | 'health_data' | 'image_use' | 'third_party_sharing'
          granted?: boolean
          granted_at?: string
          revoked_at?: string | null
          source?: string | null
          evidence_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customer_consents_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
        ]
      }
      customer_contacts: {
        Row: {
          id: string
          customer_id: string
          tenant_id: string
          kind: 'mobile' | 'landline' | 'whatsapp' | 'email' | 'instagram' | 'other'
          value: string
          label: string | null
          is_primary: boolean
          accepts_marketing: boolean
          verified_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          tenant_id: string
          kind: 'mobile' | 'landline' | 'whatsapp' | 'email' | 'instagram' | 'other'
          value: string
          label?: string | null
          is_primary?: boolean
          accepts_marketing?: boolean
          verified_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          tenant_id?: string
          kind?: 'mobile' | 'landline' | 'whatsapp' | 'email' | 'instagram' | 'other'
          value?: string
          label?: string | null
          is_primary?: boolean
          accepts_marketing?: boolean
          verified_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customer_contacts_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'customer_contacts_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
        ]
      }
      customer_credit_movements: {
        Row: {
          id: string
          customer_credit_id: string
          sale_id: string | null
          amount: number
          occurred_at: string
          performed_by: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          customer_credit_id: string
          sale_id?: string | null
          amount: number
          occurred_at?: string
          performed_by?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          customer_credit_id?: string
          sale_id?: string | null
          amount?: number
          occurred_at?: string
          performed_by?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customer_credit_movements_customer_credit_id_fkey'
            columns: ['customer_credit_id']
            referencedRelation: 'customer_credits'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_credit_movements_performed_by_fkey'
            columns: ['performed_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_credit_movements_sale_id_fkey'
            columns: ['sale_id']
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
        ]
      }
      customer_credits: {
        Row: {
          id: string
          tenant_id: string
          customer_id: string
          branch_id: string | null
          origin: 'return' | 'exchange' | 'courtesy' | 'warranty' | 'adjustment'
          origin_sale_id: string | null
          amount: number
          balance_amount: number
          expires_at: string | null
          status: 'active' | 'consumed' | 'expired' | 'cancelled'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          customer_id: string
          branch_id?: string | null
          origin: 'return' | 'exchange' | 'courtesy' | 'warranty' | 'adjustment'
          origin_sale_id?: string | null
          amount: number
          balance_amount: number
          expires_at?: string | null
          status?: 'active' | 'consumed' | 'expired' | 'cancelled'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          customer_id?: string
          branch_id?: string | null
          origin?: 'return' | 'exchange' | 'courtesy' | 'warranty' | 'adjustment'
          origin_sale_id?: string | null
          amount?: number
          balance_amount?: number
          expires_at?: string | null
          status?: 'active' | 'consumed' | 'expired' | 'cancelled'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customer_credits_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_credits_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_credits_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'customer_credits_origin_sale_id_fkey'
            columns: ['origin_sale_id']
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_credits_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      /** Vinculo cliente->cliente (filho, responsavel, conjuge...). Substitui o campo unico responsible_customer_id: um cliente pode ter varios responsaveis e um responsavel pode responder por varios dependentes (ADR-003). NAO existe entidade Familia. */
      customer_relationships: {
        Row: {
          id: string
          tenant_id: string
          customer_id: string
          related_customer_id: string
          relationship_entry_id: string
          is_financial_responsible: boolean
          is_legal_guardian: boolean
          is_pickup_authorized: boolean
          valid_from: string
          valid_to: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          customer_id: string
          related_customer_id: string
          relationship_entry_id: string
          is_financial_responsible?: boolean
          is_legal_guardian?: boolean
          is_pickup_authorized?: boolean
          valid_from?: string
          valid_to?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          customer_id?: string
          related_customer_id?: string
          relationship_entry_id?: string
          is_financial_responsible?: boolean
          is_legal_guardian?: boolean
          is_pickup_authorized?: boolean
          valid_from?: string
          valid_to?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customer_relationships_a_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'customer_relationships_b_fk'
            columns: ['related_customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'customer_relationships_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_relationships_relationship_entry_id_fkey'
            columns: ['relationship_entry_id']
            referencedRelation: 'catalog_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_relationships_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      /** Agregador de navegacao do cliente. Historicos ficam nas tabelas satelite (contatos, enderecos, receitas, orcamentos, vendas, O.S., financeiro). */
      customers: {
        Row: {
          id: string
          tenant_id: string
          party_type: 'individual' | 'company'
          code: string | null
          display_name: string
          status: 'active' | 'inactive' | 'blocked' | 'merged'
          record_status: 'quick' | 'complete'
          created_at_branch_id: string | null
          preferred_branch_id: string | null
          origin_entry_id: string | null
          notes: string | null
          merged_into_customer_id: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          party_type: 'individual' | 'company'
          code?: string | null
          display_name: string
          status?: 'active' | 'inactive' | 'blocked' | 'merged'
          record_status?: 'quick' | 'complete'
          created_at_branch_id?: string | null
          preferred_branch_id?: string | null
          origin_entry_id?: string | null
          notes?: string | null
          merged_into_customer_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          party_type?: 'individual' | 'company'
          code?: string | null
          display_name?: string
          status?: 'active' | 'inactive' | 'blocked' | 'merged'
          record_status?: 'quick' | 'complete'
          created_at_branch_id?: string | null
          preferred_branch_id?: string | null
          origin_entry_id?: string | null
          notes?: string | null
          merged_into_customer_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customers_created_at_branch_id_fkey'
            columns: ['created_at_branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customers_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customers_merged_into_customer_id_fkey'
            columns: ['merged_into_customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customers_origin_entry_id_fkey'
            columns: ['origin_entry_id']
            referencedRelation: 'catalog_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customers_preferred_branch_id_fkey'
            columns: ['preferred_branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customers_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customers_updated_by_fkey'
            columns: ['updated_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      document_sequences: {
        Row: {
          tenant_id: string
          branch_id: string
          document_type: 'quote' | 'sale' | 'service_order' | 'lab_order' | 'receipt'
          next_value: number
          prefix: string | null
        }
        Insert: {
          tenant_id: string
          branch_id: string
          document_type: 'quote' | 'sale' | 'service_order' | 'lab_order' | 'receipt'
          next_value?: number
          prefix?: string | null
        }
        Update: {
          tenant_id?: string
          branch_id?: string
          document_type?: 'quote' | 'sale' | 'service_order' | 'lab_order' | 'receipt'
          next_value?: number
          prefix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'document_sequences_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'document_sequences_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      /** Medidas da armacao. Combinadas com as medidas de montagem da O.S. definem diametro e descentracao da lente — nada disso pertence a receita. */
      frame_attributes: {
        Row: {
          product_id: string
          material: string | null
          color: string | null
          shape: string | null
          gender_target: 'female' | 'male' | 'unisex' | 'kids' | null
          lens_width_mm: number | null
          bridge_mm: number | null
          temple_mm: number | null
          vertical_box_mm: number | null
          diagonal_mm: number | null
          rim_type: 'full_rim' | 'semi_rimless' | 'rimless' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          product_id: string
          material?: string | null
          color?: string | null
          shape?: string | null
          gender_target?: 'female' | 'male' | 'unisex' | 'kids' | null
          lens_width_mm?: number | null
          bridge_mm?: number | null
          temple_mm?: number | null
          vertical_box_mm?: number | null
          diagonal_mm?: number | null
          rim_type?: 'full_rim' | 'semi_rimless' | 'rimless' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          product_id?: string
          material?: string | null
          color?: string | null
          shape?: string | null
          gender_target?: 'female' | 'male' | 'unisex' | 'kids' | null
          lens_width_mm?: number | null
          bridge_mm?: number | null
          temple_mm?: number | null
          vertical_box_mm?: number | null
          diagonal_mm?: number | null
          rim_type?: 'full_rim' | 'semi_rimless' | 'rimless' | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'frame_attributes_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      individual_profiles: {
        Row: {
          customer_id: string
          tenant_id: string
          cpf: string | null
          national_id: string | null
          national_id_issuer: string | null
          birth_date: string | null
          gender: 'female' | 'male' | 'other' | 'undisclosed' | null
          marital_status_entry_id: string | null
          profession_entry_id: string | null
          mother_name: string | null
          father_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          customer_id: string
          tenant_id: string
          cpf?: string | null
          national_id?: string | null
          national_id_issuer?: string | null
          birth_date?: string | null
          gender?: 'female' | 'male' | 'other' | 'undisclosed' | null
          marital_status_entry_id?: string | null
          profession_entry_id?: string | null
          mother_name?: string | null
          father_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          tenant_id?: string
          cpf?: string | null
          national_id?: string | null
          national_id_issuer?: string | null
          birth_date?: string | null
          gender?: 'female' | 'male' | 'other' | 'undisclosed' | null
          marital_status_entry_id?: string | null
          profession_entry_id?: string | null
          mother_name?: string | null
          father_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'individual_profiles_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'individual_profiles_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'individual_profiles_marital_status_entry_id_fkey'
            columns: ['marital_status_entry_id']
            referencedRelation: 'catalog_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'individual_profiles_profession_entry_id_fkey'
            columns: ['profession_entry_id']
            referencedRelation: 'catalog_entries'
            referencedColumns: ['id']
          },
        ]
      }
      lab_order_items: {
        Row: {
          id: string
          lab_order_id: string
          lens_spec_id: string
          eye: 'OD' | 'OS'
          cost: number | null
          created_at: string
        }
        Insert: {
          id?: string
          lab_order_id: string
          lens_spec_id: string
          eye: 'OD' | 'OS'
          cost?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          lab_order_id?: string
          lens_spec_id?: string
          eye?: 'OD' | 'OS'
          cost?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lab_order_items_lab_order_id_fkey'
            columns: ['lab_order_id']
            referencedRelation: 'lab_orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lab_order_items_lens_spec_id_fkey'
            columns: ['lens_spec_id']
            referencedRelation: 'service_order_lens_specs'
            referencedColumns: ['id']
          },
        ]
      }
      lab_orders: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          service_order_id: string
          laboratory_id: string
          number: number
          external_number: string | null
          status: 'draft' | 'sent' | 'acknowledged' | 'in_production' | 'shipped' | 'received' | 'rejected' | 'cancelled'
          sent_at: string | null
          expected_at: string | null
          received_at: string | null
          total_cost: number | null
          rejection_reason: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          branch_id: string
          service_order_id: string
          laboratory_id: string
          number: number
          external_number?: string | null
          status?: 'draft' | 'sent' | 'acknowledged' | 'in_production' | 'shipped' | 'received' | 'rejected' | 'cancelled'
          sent_at?: string | null
          expected_at?: string | null
          received_at?: string | null
          total_cost?: number | null
          rejection_reason?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          branch_id?: string
          service_order_id?: string
          laboratory_id?: string
          number?: number
          external_number?: string | null
          status?: 'draft' | 'sent' | 'acknowledged' | 'in_production' | 'shipped' | 'received' | 'rejected' | 'cancelled'
          sent_at?: string | null
          expected_at?: string | null
          received_at?: string | null
          total_cost?: number | null
          rejection_reason?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lab_orders_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lab_orders_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lab_orders_laboratory_id_fkey'
            columns: ['laboratory_id']
            referencedRelation: 'laboratories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lab_orders_service_order_id_fkey'
            columns: ['service_order_id']
            referencedRelation: 'service_orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lab_orders_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      laboratories: {
        Row: {
          id: string
          tenant_id: string
          code: string
          trade_name: string
          legal_name: string | null
          tax_document: string | null
          contact_name: string | null
          phone: string | null
          email: string | null
          default_lead_days: number
          integration_kind: 'manual' | 'email' | 'api' | 'edi'
          integration_config: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          code: string
          trade_name: string
          legal_name?: string | null
          tax_document?: string | null
          contact_name?: string | null
          phone?: string | null
          email?: string | null
          default_lead_days?: number
          integration_kind?: 'manual' | 'email' | 'api' | 'edi'
          integration_config?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          code?: string
          trade_name?: string
          legal_name?: string | null
          tax_document?: string | null
          contact_name?: string | null
          phone?: string | null
          email?: string | null
          default_lead_days?: number
          integration_kind?: 'manual' | 'email' | 'api' | 'edi'
          integration_config?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'laboratories_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      lens_attributes: {
        Row: {
          product_id: string
          lens_type_id: string
          lens_material_id: string
          refractive_index: number
          design: 'spherical' | 'aspheric' | 'bi_aspheric' | 'freeform' | 'digital'
          manufacturer_name: string | null
          product_line: string | null
          supply_mode: 'stock' | 'surfaced'
          diameter_mm: number | null
          base_curve: number | null
          sphere_min_dpt: number | null
          sphere_max_dpt: number | null
          cylinder_min_dpt: number | null
          cylinder_max_dpt: number | null
          addition_min_dpt: number | null
          addition_max_dpt: number | null
          default_laboratory_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          product_id: string
          lens_type_id: string
          lens_material_id: string
          refractive_index: number
          design?: 'spherical' | 'aspheric' | 'bi_aspheric' | 'freeform' | 'digital'
          manufacturer_name?: string | null
          product_line?: string | null
          supply_mode?: 'stock' | 'surfaced'
          diameter_mm?: number | null
          base_curve?: number | null
          sphere_min_dpt?: number | null
          sphere_max_dpt?: number | null
          cylinder_min_dpt?: number | null
          cylinder_max_dpt?: number | null
          addition_min_dpt?: number | null
          addition_max_dpt?: number | null
          default_laboratory_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          product_id?: string
          lens_type_id?: string
          lens_material_id?: string
          refractive_index?: number
          design?: 'spherical' | 'aspheric' | 'bi_aspheric' | 'freeform' | 'digital'
          manufacturer_name?: string | null
          product_line?: string | null
          supply_mode?: 'stock' | 'surfaced'
          diameter_mm?: number | null
          base_curve?: number | null
          sphere_min_dpt?: number | null
          sphere_max_dpt?: number | null
          cylinder_min_dpt?: number | null
          cylinder_max_dpt?: number | null
          addition_min_dpt?: number | null
          addition_max_dpt?: number | null
          default_laboratory_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lens_attributes_default_laboratory_id_fkey'
            columns: ['default_laboratory_id']
            referencedRelation: 'laboratories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lens_attributes_lens_material_id_fkey'
            columns: ['lens_material_id']
            referencedRelation: 'lens_materials'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lens_attributes_lens_type_id_fkey'
            columns: ['lens_type_id']
            referencedRelation: 'lens_types'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lens_attributes_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      lens_materials: {
        Row: {
          id: string
          tenant_id: string | null
          code: string
          label: string
          default_refractive_index: number | null
          abbe_number: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          code: string
          label: string
          default_refractive_index?: number | null
          abbe_number?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          code?: string
          label?: string
          default_refractive_index?: number | null
          abbe_number?: number | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lens_materials_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      lens_product_treatments: {
        Row: {
          product_id: string
          treatment_id: string
          extra_price: number
        }
        Insert: {
          product_id: string
          treatment_id: string
          extra_price?: number
        }
        Update: {
          product_id?: string
          treatment_id?: string
          extra_price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'lens_product_treatments_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lens_product_treatments_treatment_id_fkey'
            columns: ['treatment_id']
            referencedRelation: 'lens_treatments'
            referencedColumns: ['id']
          },
        ]
      }
      lens_treatments: {
        Row: {
          id: string
          tenant_id: string | null
          code: string
          label: string
          treatment_group: 'coating' | 'tint' | 'photochromic' | 'polarized' | 'filter' | 'hardening' | 'other'
          is_billable: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          code: string
          label: string
          treatment_group?: 'coating' | 'tint' | 'photochromic' | 'polarized' | 'filter' | 'hardening' | 'other'
          is_billable?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          code?: string
          label?: string
          treatment_group?: 'coating' | 'tint' | 'photochromic' | 'polarized' | 'filter' | 'hardening' | 'other'
          is_billable?: boolean
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lens_treatments_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      lens_types: {
        Row: {
          id: string
          tenant_id: string | null
          code: string
          label: string
          vision_design: 'single_vision' | 'bifocal' | 'trifocal' | 'progressive' | 'occupational' | 'contact'
          requires_addition: boolean
          requires_fitting_height: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          code: string
          label: string
          vision_design: 'single_vision' | 'bifocal' | 'trifocal' | 'progressive' | 'occupational' | 'contact'
          requires_addition?: boolean
          requires_fitting_height?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          code?: string
          label?: string
          vision_design?: 'single_vision' | 'bifocal' | 'trifocal' | 'progressive' | 'occupational' | 'contact'
          requires_addition?: boolean
          requires_fitting_height?: boolean
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lens_types_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      optical_prescription_measures: {
        Row: {
          id: string
          prescription_id: string
          eye: 'OD' | 'OS'
          vision_zone: 'far' | 'near' | 'intermediate'
          sphere_dpt: number | null
          cylinder_dpt: number | null
          axis_deg: number | null
          addition_dpt: number | null
          prism_horizontal_pd: number | null
          prism_horizontal_base: 'in' | 'out' | null
          prism_vertical_pd: number | null
          prism_vertical_base: 'up' | 'down' | null
          dnp_mm: number | null
          visual_acuity: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          prescription_id: string
          eye: 'OD' | 'OS'
          vision_zone?: 'far' | 'near' | 'intermediate'
          sphere_dpt?: number | null
          cylinder_dpt?: number | null
          axis_deg?: number | null
          addition_dpt?: number | null
          prism_horizontal_pd?: number | null
          prism_horizontal_base?: 'in' | 'out' | null
          prism_vertical_pd?: number | null
          prism_vertical_base?: 'up' | 'down' | null
          dnp_mm?: number | null
          visual_acuity?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          prescription_id?: string
          eye?: 'OD' | 'OS'
          vision_zone?: 'far' | 'near' | 'intermediate'
          sphere_dpt?: number | null
          cylinder_dpt?: number | null
          axis_deg?: number | null
          addition_dpt?: number | null
          prism_horizontal_pd?: number | null
          prism_horizontal_base?: 'in' | 'out' | null
          prism_vertical_pd?: number | null
          prism_vertical_base?: 'up' | 'down' | null
          dnp_mm?: number | null
          visual_acuity?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'optical_prescription_measures_prescription_id_fkey'
            columns: ['prescription_id']
            referencedRelation: 'optical_prescriptions'
            referencedColumns: ['id']
          },
        ]
      }
      /** Prescricao clinica do cliente. NAO contem lente, material, indice, tratamento, fabricante nem preco (ADR-001). Imutavel apos ativacao (ADR-002). */
      optical_prescriptions: {
        Row: {
          id: string
          tenant_id: string
          customer_id: string
          branch_id: string | null
          prescriber_id: string | null
          prescriber_name_snapshot: string | null
          prescriber_council_snapshot: string | null
          source: 'external_document' | 'in_store_exam' | 'customer_report'
          issued_at: string
          valid_until: string | null
          purpose: 'eyeglasses' | 'contact_lenses' | 'both'
          vision_use: 'far' | 'near' | 'multifocal' | 'bifocal' | 'occupational' | 'intermediate'
          cylinder_notation: 'negative' | 'positive'
          status: 'draft' | 'active' | 'superseded' | 'void'
          revision: number
          root_prescription_id: string | null
          supersedes_prescription_id: string | null
          void_reason: string | null
          clinical_notes: string | null
          attachment_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          customer_id: string
          branch_id?: string | null
          prescriber_id?: string | null
          prescriber_name_snapshot?: string | null
          prescriber_council_snapshot?: string | null
          source?: 'external_document' | 'in_store_exam' | 'customer_report'
          issued_at: string
          valid_until?: string | null
          purpose?: 'eyeglasses' | 'contact_lenses' | 'both'
          vision_use?: 'far' | 'near' | 'multifocal' | 'bifocal' | 'occupational' | 'intermediate'
          cylinder_notation?: 'negative' | 'positive'
          status?: 'draft' | 'active' | 'superseded' | 'void'
          revision?: number
          root_prescription_id?: string | null
          supersedes_prescription_id?: string | null
          void_reason?: string | null
          clinical_notes?: string | null
          attachment_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          customer_id?: string
          branch_id?: string | null
          prescriber_id?: string | null
          prescriber_name_snapshot?: string | null
          prescriber_council_snapshot?: string | null
          source?: 'external_document' | 'in_store_exam' | 'customer_report'
          issued_at?: string
          valid_until?: string | null
          purpose?: 'eyeglasses' | 'contact_lenses' | 'both'
          vision_use?: 'far' | 'near' | 'multifocal' | 'bifocal' | 'occupational' | 'intermediate'
          cylinder_notation?: 'negative' | 'positive'
          status?: 'draft' | 'active' | 'superseded' | 'void'
          revision?: number
          root_prescription_id?: string | null
          supersedes_prescription_id?: string | null
          void_reason?: string | null
          clinical_notes?: string | null
          attachment_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'optical_prescriptions_attachment_id_fkey'
            columns: ['attachment_id']
            referencedRelation: 'customer_attachments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'optical_prescriptions_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'optical_prescriptions_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'optical_prescriptions_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'optical_prescriptions_prescriber_id_fkey'
            columns: ['prescriber_id']
            referencedRelation: 'prescribers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'optical_prescriptions_root_prescription_id_fkey'
            columns: ['root_prescription_id']
            referencedRelation: 'optical_prescriptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'optical_prescriptions_supersedes_prescription_id_fkey'
            columns: ['supersedes_prescription_id']
            referencedRelation: 'optical_prescriptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'optical_prescriptions_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      payables: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          supplier_id: string | null
          laboratory_id: string | null
          lab_order_id: string | null
          chart_account_id: string | null
          description: string
          issue_date: string
          due_date: string
          amount: number
          paid_amount: number
          status: 'open' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          branch_id: string
          supplier_id?: string | null
          laboratory_id?: string | null
          lab_order_id?: string | null
          chart_account_id?: string | null
          description: string
          issue_date?: string
          due_date: string
          amount: number
          paid_amount?: number
          status?: 'open' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          branch_id?: string
          supplier_id?: string | null
          laboratory_id?: string | null
          lab_order_id?: string | null
          chart_account_id?: string | null
          description?: string
          issue_date?: string
          due_date?: string
          amount?: number
          paid_amount?: number
          status?: 'open' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payables_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payables_chart_account_id_fkey'
            columns: ['chart_account_id']
            referencedRelation: 'chart_accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payables_lab_order_id_fkey'
            columns: ['lab_order_id']
            referencedRelation: 'lab_orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payables_laboratory_id_fkey'
            columns: ['laboratory_id']
            referencedRelation: 'laboratories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payables_supplier_id_fkey'
            columns: ['supplier_id']
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payables_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      payment_methods: {
        Row: {
          id: string
          tenant_id: string
          code: string
          label: string
          kind: 'cash' | 'debit_card' | 'credit_card' | 'pix' | 'bank_slip' | 'store_credit' | 'check' | 'transfer' | 'installment_plan' | 'voucher'
          generates_receivable: boolean
          allows_installments: boolean
          max_installments: number
          settlement_days: number
          fee_percent: number
          requires_acquirer: boolean
          requires_customer: boolean
          chart_account_id: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          code: string
          label: string
          kind: 'cash' | 'debit_card' | 'credit_card' | 'pix' | 'bank_slip' | 'store_credit' | 'check' | 'transfer' | 'installment_plan' | 'voucher'
          generates_receivable?: boolean
          allows_installments?: boolean
          max_installments?: number
          settlement_days?: number
          fee_percent?: number
          requires_acquirer?: boolean
          requires_customer?: boolean
          chart_account_id?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          code?: string
          label?: string
          kind?: 'cash' | 'debit_card' | 'credit_card' | 'pix' | 'bank_slip' | 'store_credit' | 'check' | 'transfer' | 'installment_plan' | 'voucher'
          generates_receivable?: boolean
          allows_installments?: boolean
          max_installments?: number
          settlement_days?: number
          fee_percent?: number
          requires_acquirer?: boolean
          requires_customer?: boolean
          chart_account_id?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payment_methods_chart_account_fk'
            columns: ['chart_account_id']
            referencedRelation: 'chart_accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_methods_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          label: string
          module: string
          created_at: string
        }
        Insert: {
          code: string
          label: string
          module: string
          created_at?: string
        }
        Update: {
          code?: string
          label?: string
          module?: string
          created_at?: string
        }
        Relationships: [
        ]
      }
      prescribers: {
        Row: {
          id: string
          tenant_id: string
          full_name: string
          kind: 'ophthalmologist' | 'optometrist' | 'other'
          council_type: 'CRM' | 'CRO' | 'CROf' | 'OUTRO' | null
          council_number: string | null
          council_state: string | null
          clinic_name: string | null
          phone: string | null
          email: string | null
          notes: string | null
          record_status: 'quick' | 'complete'
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          full_name: string
          kind?: 'ophthalmologist' | 'optometrist' | 'other'
          council_type?: 'CRM' | 'CRO' | 'CROf' | 'OUTRO' | null
          council_number?: string | null
          council_state?: string | null
          clinic_name?: string | null
          phone?: string | null
          email?: string | null
          notes?: string | null
          record_status?: 'quick' | 'complete'
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          full_name?: string
          kind?: 'ophthalmologist' | 'optometrist' | 'other'
          council_type?: 'CRM' | 'CRO' | 'CROf' | 'OUTRO' | null
          council_number?: string | null
          council_state?: string | null
          clinic_name?: string | null
          phone?: string | null
          email?: string | null
          notes?: string | null
          record_status?: 'quick' | 'complete'
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'prescribers_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prescribers_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      price_table_branches: {
        Row: {
          price_table_id: string
          branch_id: string
        }
        Insert: {
          price_table_id: string
          branch_id: string
        }
        Update: {
          price_table_id?: string
          branch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'price_table_branches_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'price_table_branches_price_table_id_fkey'
            columns: ['price_table_id']
            referencedRelation: 'price_tables'
            referencedColumns: ['id']
          },
        ]
      }
      price_table_items: {
        Row: {
          id: string
          price_table_id: string
          product_id: string
          price: number
          max_discount_percent: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          price_table_id: string
          product_id: string
          price: number
          max_discount_percent?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          price_table_id?: string
          product_id?: string
          price?: number
          max_discount_percent?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'price_table_items_price_table_id_fkey'
            columns: ['price_table_id']
            referencedRelation: 'price_tables'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'price_table_items_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      price_tables: {
        Row: {
          id: string
          tenant_id: string
          code: string
          label: string
          is_default: boolean
          valid_from: string | null
          valid_to: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          code: string
          label: string
          is_default?: boolean
          valid_from?: string | null
          valid_to?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          code?: string
          label?: string
          is_default?: boolean
          valid_from?: string | null
          valid_to?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'price_tables_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      product_categories: {
        Row: {
          id: string
          tenant_id: string
          parent_id: string | null
          code: string
          label: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          parent_id?: string | null
          code: string
          label: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          parent_id?: string | null
          code?: string
          label?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_categories_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'product_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_categories_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          id: string
          tenant_id: string
          sku: string | null
          gtin: string | null
          name: string
          product_kind: 'frame' | 'sunglass' | 'lens' | 'contact_lens' | 'accessory' | 'service' | 'lens_treatment'
          category_id: string | null
          brand_id: string | null
          supplier_id: string | null
          unit: string
          tracks_stock: boolean
          is_made_to_order: boolean
          cost_price: number | null
          list_price: number | null
          ncm_code: string | null
          cest_code: string | null
          record_status: 'quick' | 'complete'
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          sku?: string | null
          gtin?: string | null
          name: string
          product_kind: 'frame' | 'sunglass' | 'lens' | 'contact_lens' | 'accessory' | 'service' | 'lens_treatment'
          category_id?: string | null
          brand_id?: string | null
          supplier_id?: string | null
          unit?: string
          tracks_stock?: boolean
          is_made_to_order?: boolean
          cost_price?: number | null
          list_price?: number | null
          ncm_code?: string | null
          cest_code?: string | null
          record_status?: 'quick' | 'complete'
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          sku?: string | null
          gtin?: string | null
          name?: string
          product_kind?: 'frame' | 'sunglass' | 'lens' | 'contact_lens' | 'accessory' | 'service' | 'lens_treatment'
          category_id?: string | null
          brand_id?: string | null
          supplier_id?: string | null
          unit?: string
          tracks_stock?: boolean
          is_made_to_order?: boolean
          cost_price?: number | null
          list_price?: number | null
          ncm_code?: string | null
          cest_code?: string | null
          record_status?: 'quick' | 'complete'
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_brand_id_fkey'
            columns: ['brand_id']
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            referencedRelation: 'product_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_supplier_id_fkey'
            columns: ['supplier_id']
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          tenant_id: string
          parent_item_id: string | null
          line_number: number
          product_id: string | null
          description: string
          eye: 'OD' | 'OS' | 'both' | null
          quantity: number
          unit_price: number
          discount_amount: number
          total_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          tenant_id: string
          parent_item_id?: string | null
          line_number: number
          product_id?: string | null
          description: string
          eye?: 'OD' | 'OS' | 'both' | null
          quantity?: number
          unit_price: number
          discount_amount?: number
          total_amount: number
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          tenant_id?: string
          parent_item_id?: string | null
          line_number?: number
          product_id?: string | null
          description?: string
          eye?: 'OD' | 'OS' | 'both' | null
          quantity?: number
          unit_price?: number
          discount_amount?: number
          total_amount?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quote_items_parent_item_id_fkey'
            columns: ['parent_item_id']
            referencedRelation: 'quote_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quote_items_product_fk'
            columns: ['product_id', 'tenant_id']
            referencedRelation: 'products'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'quote_items_quote_id_fkey'
            columns: ['quote_id']
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          },
        ]
      }
      quotes: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          number: number
          customer_id: string | null
          salesperson_id: string | null
          prescription_id: string | null
          status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'
          valid_until: string | null
          subtotal_amount: number
          discount_amount: number
          total_amount: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          branch_id: string
          number: number
          customer_id?: string | null
          salesperson_id?: string | null
          prescription_id?: string | null
          status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'
          valid_until?: string | null
          subtotal_amount?: number
          discount_amount?: number
          total_amount?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          branch_id?: string
          number?: number
          customer_id?: string | null
          salesperson_id?: string | null
          prescription_id?: string | null
          status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'
          valid_until?: string | null
          subtotal_amount?: number
          discount_amount?: number
          total_amount?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quotes_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'quotes_prescription_id_fkey'
            columns: ['prescription_id']
            referencedRelation: 'optical_prescriptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_salesperson_id_fkey'
            columns: ['salesperson_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      receivable_settlements: {
        Row: {
          id: string
          receivable_id: string
          tenant_id: string
          branch_id: string
          payment_method_id: string | null
          amount: number
          settled_at: string
          performed_by: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          receivable_id: string
          tenant_id: string
          branch_id: string
          payment_method_id?: string | null
          amount: number
          settled_at?: string
          performed_by?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          receivable_id?: string
          tenant_id?: string
          branch_id?: string
          payment_method_id?: string | null
          amount?: number
          settled_at?: string
          performed_by?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'receivable_settlements_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receivable_settlements_payment_method_id_fkey'
            columns: ['payment_method_id']
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receivable_settlements_performed_by_fkey'
            columns: ['performed_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receivable_settlements_receivable_id_fkey'
            columns: ['receivable_id']
            referencedRelation: 'receivables'
            referencedColumns: ['id']
          },
        ]
      }
      receivables: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          sale_id: string | null
          sale_payment_id: string | null
          customer_id: string
          payment_method_id: string | null
          chart_account_id: string | null
          installment_number: number
          installments_total: number
          issue_date: string
          due_date: string
          amount: number
          paid_amount: number
          interest_amount: number
          discount_amount: number
          status: 'open' | 'partially_paid' | 'paid' | 'overdue' | 'renegotiated' | 'cancelled' | 'written_off'
          document_number: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          branch_id: string
          sale_id?: string | null
          sale_payment_id?: string | null
          customer_id: string
          payment_method_id?: string | null
          chart_account_id?: string | null
          installment_number?: number
          installments_total?: number
          issue_date?: string
          due_date: string
          amount: number
          paid_amount?: number
          interest_amount?: number
          discount_amount?: number
          status?: 'open' | 'partially_paid' | 'paid' | 'overdue' | 'renegotiated' | 'cancelled' | 'written_off'
          document_number?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          branch_id?: string
          sale_id?: string | null
          sale_payment_id?: string | null
          customer_id?: string
          payment_method_id?: string | null
          chart_account_id?: string | null
          installment_number?: number
          installments_total?: number
          issue_date?: string
          due_date?: string
          amount?: number
          paid_amount?: number
          interest_amount?: number
          discount_amount?: number
          status?: 'open' | 'partially_paid' | 'paid' | 'overdue' | 'renegotiated' | 'cancelled' | 'written_off'
          document_number?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'receivables_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receivables_chart_account_id_fkey'
            columns: ['chart_account_id']
            referencedRelation: 'chart_accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receivables_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'receivables_payment_method_id_fkey'
            columns: ['payment_method_id']
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receivables_sale_id_fkey'
            columns: ['sale_id']
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receivables_sale_payment_id_fkey'
            columns: ['sale_payment_id']
            referencedRelation: 'sale_payments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receivables_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      role_permissions: {
        Row: {
          role_id: string
          permission_code: string
        }
        Insert: {
          role_id: string
          permission_code: string
        }
        Update: {
          role_id?: string
          permission_code?: string
        }
        Relationships: [
          {
            foreignKeyName: 'role_permissions_code_fk'
            columns: ['permission_code']
            referencedRelation: 'permissions'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'role_permissions_role_id_fkey'
            columns: ['role_id']
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
        ]
      }
      roles: {
        Row: {
          id: string
          tenant_id: string | null
          code: string
          label: string
          is_system: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          code: string
          label: string
          is_system?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          code?: string
          label?: string
          is_system?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'roles_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          tenant_id: string
          parent_item_id: string | null
          line_number: number
          product_id: string | null
          description: string
          eye: 'OD' | 'OS' | 'both' | null
          quantity: number
          unit_price: number
          discount_amount: number
          total_amount: number
          unit_cost: number | null
          stock_branch_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          tenant_id: string
          parent_item_id?: string | null
          line_number: number
          product_id?: string | null
          description: string
          eye?: 'OD' | 'OS' | 'both' | null
          quantity?: number
          unit_price: number
          discount_amount?: number
          total_amount: number
          unit_cost?: number | null
          stock_branch_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          tenant_id?: string
          parent_item_id?: string | null
          line_number?: number
          product_id?: string | null
          description?: string
          eye?: 'OD' | 'OS' | 'both' | null
          quantity?: number
          unit_price?: number
          discount_amount?: number
          total_amount?: number
          unit_cost?: number | null
          stock_branch_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sale_items_parent_item_id_fkey'
            columns: ['parent_item_id']
            referencedRelation: 'sale_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_product_fk'
            columns: ['product_id', 'tenant_id']
            referencedRelation: 'products'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'sale_items_sale_id_fkey'
            columns: ['sale_id']
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_stock_branch_id_fkey'
            columns: ['stock_branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
        ]
      }
      sale_payments: {
        Row: {
          id: string
          sale_id: string
          tenant_id: string
          payment_method_id: string
          amount: number
          installments: number
          first_due_date: string | null
          acquirer_name: string | null
          authorization_code: string | null
          card_brand: string | null
          paid_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          tenant_id: string
          payment_method_id: string
          amount: number
          installments?: number
          first_due_date?: string | null
          acquirer_name?: string | null
          authorization_code?: string | null
          card_brand?: string | null
          paid_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          tenant_id?: string
          payment_method_id?: string
          amount?: number
          installments?: number
          first_due_date?: string | null
          acquirer_name?: string | null
          authorization_code?: string | null
          card_brand?: string | null
          paid_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sale_payments_payment_method_id_fkey'
            columns: ['payment_method_id']
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_payments_sale_id_fkey'
            columns: ['sale_id']
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
        ]
      }
      sales: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          number: number
          quote_id: string | null
          sale_type: 'identified' | 'anonymous'
          customer_id: string | null
          tax_document_on_invoice: string | null
          salesperson_id: string | null
          status: 'open' | 'confirmed' | 'invoiced' | 'cancelled' | 'returned'
          sold_at: string
          subtotal_amount: number
          discount_amount: number
          total_amount: number
          cancelled_at: string | null
          cancel_reason: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          branch_id: string
          number: number
          quote_id?: string | null
          sale_type?: 'identified' | 'anonymous'
          customer_id?: string | null
          tax_document_on_invoice?: string | null
          salesperson_id?: string | null
          status?: 'open' | 'confirmed' | 'invoiced' | 'cancelled' | 'returned'
          sold_at?: string
          subtotal_amount?: number
          discount_amount?: number
          total_amount?: number
          cancelled_at?: string | null
          cancel_reason?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          branch_id?: string
          number?: number
          quote_id?: string | null
          sale_type?: 'identified' | 'anonymous'
          customer_id?: string | null
          tax_document_on_invoice?: string | null
          salesperson_id?: string | null
          status?: 'open' | 'confirmed' | 'invoiced' | 'cancelled' | 'returned'
          sold_at?: string
          subtotal_amount?: number
          discount_amount?: number
          total_amount?: number
          cancelled_at?: string | null
          cancel_reason?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sales_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'sales_quote_id_fkey'
            columns: ['quote_id']
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_salesperson_id_fkey'
            columns: ['salesperson_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      service_order_fitting_measures: {
        Row: {
          id: string
          service_order_fitting_id: string
          eye: 'OD' | 'OS'
          dnp_mm: number
          fitting_height_mm: number | null
          near_dnp_mm: number | null
          horizontal_decentration_mm: number | null
          vertical_decentration_mm: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          service_order_fitting_id: string
          eye: 'OD' | 'OS'
          dnp_mm: number
          fitting_height_mm?: number | null
          near_dnp_mm?: number | null
          horizontal_decentration_mm?: number | null
          vertical_decentration_mm?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          service_order_fitting_id?: string
          eye?: 'OD' | 'OS'
          dnp_mm?: number
          fitting_height_mm?: number | null
          near_dnp_mm?: number | null
          horizontal_decentration_mm?: number | null
          vertical_decentration_mm?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_order_fitting_measures_service_order_fitting_id_fkey'
            columns: ['service_order_fitting_id']
            referencedRelation: 'service_order_fittings'
            referencedColumns: ['id']
          },
        ]
      }
      /** Medidas de montagem da O.S. DP total e medida de MONTAGEM/legado; DNP por olho e medida CLINICA/OPTICA. Semanticamente distintas (ADR-007). */
      service_order_fittings: {
        Row: {
          id: string
          service_order_id: string
          tenant_id: string
          dp_total_mm: number | null
          dp_source: 'measured' | 'derived_from_dnp' | 'from_prescription'
          frame_lens_width_mm: number | null
          frame_bridge_mm: number | null
          frame_vertical_box_mm: number | null
          frame_diagonal_mm: number | null
          vertex_distance_mm: number | null
          pantoscopic_tilt_deg: number | null
          wrap_angle_deg: number | null
          measurement_method: 'manual' | 'pupilometer' | 'digital_photo' | 'app'
          measured_by: string | null
          measured_at: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_order_id: string
          tenant_id: string
          dp_total_mm?: number | null
          dp_source?: 'measured' | 'derived_from_dnp' | 'from_prescription'
          frame_lens_width_mm?: number | null
          frame_bridge_mm?: number | null
          frame_vertical_box_mm?: number | null
          frame_diagonal_mm?: number | null
          vertex_distance_mm?: number | null
          pantoscopic_tilt_deg?: number | null
          wrap_angle_deg?: number | null
          measurement_method?: 'manual' | 'pupilometer' | 'digital_photo' | 'app'
          measured_by?: string | null
          measured_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_order_id?: string
          tenant_id?: string
          dp_total_mm?: number | null
          dp_source?: 'measured' | 'derived_from_dnp' | 'from_prescription'
          frame_lens_width_mm?: number | null
          frame_bridge_mm?: number | null
          frame_vertical_box_mm?: number | null
          frame_diagonal_mm?: number | null
          vertex_distance_mm?: number | null
          pantoscopic_tilt_deg?: number | null
          wrap_angle_deg?: number | null
          measurement_method?: 'manual' | 'pupilometer' | 'digital_photo' | 'app'
          measured_by?: string | null
          measured_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_order_fittings_measured_by_fkey'
            columns: ['measured_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_fittings_service_order_id_fkey'
            columns: ['service_order_id']
            referencedRelation: 'service_orders'
            referencedColumns: ['id']
          },
        ]
      }
      /** O QUE FOI VENDIDO E FABRICADO. Tipo, material, indice, tratamento e fabricante vivem AQUI — nunca na receita clinica (ADR-001). */
      service_order_lens_specs: {
        Row: {
          id: string
          service_order_id: string
          tenant_id: string
          eye: 'OD' | 'OS'
          product_id: string | null
          sale_item_id: string | null
          lens_type_id: string | null
          lens_material_id: string | null
          lens_type_label: string | null
          lens_material_label: string | null
          manufacturer_name: string | null
          product_line: string | null
          refractive_index: number | null
          design: 'spherical' | 'aspheric' | 'bi_aspheric' | 'freeform' | 'digital' | null
          supply_mode: 'stock' | 'surfaced'
          diameter_mm: number | null
          base_curve: number | null
          tint_description: string | null
          laboratory_id: string | null
          unit_cost: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_order_id: string
          tenant_id: string
          eye: 'OD' | 'OS'
          product_id?: string | null
          sale_item_id?: string | null
          lens_type_id?: string | null
          lens_material_id?: string | null
          lens_type_label?: string | null
          lens_material_label?: string | null
          manufacturer_name?: string | null
          product_line?: string | null
          refractive_index?: number | null
          design?: 'spherical' | 'aspheric' | 'bi_aspheric' | 'freeform' | 'digital' | null
          supply_mode?: 'stock' | 'surfaced'
          diameter_mm?: number | null
          base_curve?: number | null
          tint_description?: string | null
          laboratory_id?: string | null
          unit_cost?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_order_id?: string
          tenant_id?: string
          eye?: 'OD' | 'OS'
          product_id?: string | null
          sale_item_id?: string | null
          lens_type_id?: string | null
          lens_material_id?: string | null
          lens_type_label?: string | null
          lens_material_label?: string | null
          manufacturer_name?: string | null
          product_line?: string | null
          refractive_index?: number | null
          design?: 'spherical' | 'aspheric' | 'bi_aspheric' | 'freeform' | 'digital' | null
          supply_mode?: 'stock' | 'surfaced'
          diameter_mm?: number | null
          base_curve?: number | null
          tint_description?: string | null
          laboratory_id?: string | null
          unit_cost?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_order_lens_specs_laboratory_id_fkey'
            columns: ['laboratory_id']
            referencedRelation: 'laboratories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_lens_specs_lens_material_id_fkey'
            columns: ['lens_material_id']
            referencedRelation: 'lens_materials'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_lens_specs_lens_type_id_fkey'
            columns: ['lens_type_id']
            referencedRelation: 'lens_types'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_lens_specs_service_order_id_fkey'
            columns: ['service_order_id']
            referencedRelation: 'service_orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'so_lens_specs_product_fk'
            columns: ['product_id', 'tenant_id']
            referencedRelation: 'products'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'so_lens_specs_sale_item_fk'
            columns: ['sale_item_id', 'tenant_id']
            referencedRelation: 'sale_items'
            referencedColumns: ['id', 'tenant_id']
          },
        ]
      }
      service_order_lens_treatments: {
        Row: {
          id: string
          lens_spec_id: string
          treatment_id: string | null
          treatment_label: string
          sale_item_id: string | null
          tenant_id: string
          created_at: string
        }
        Insert: {
          id?: string
          lens_spec_id: string
          treatment_id?: string | null
          treatment_label: string
          sale_item_id?: string | null
          tenant_id: string
          created_at?: string
        }
        Update: {
          id?: string
          lens_spec_id?: string
          treatment_id?: string | null
          treatment_label?: string
          sale_item_id?: string | null
          tenant_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_order_lens_treatments_lens_spec_id_fkey'
            columns: ['lens_spec_id']
            referencedRelation: 'service_order_lens_specs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_lens_treatments_treatment_id_fkey'
            columns: ['treatment_id']
            referencedRelation: 'lens_treatments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'so_lens_treatments_sale_item_fk'
            columns: ['sale_item_id', 'tenant_id']
            referencedRelation: 'sale_items'
            referencedColumns: ['id', 'tenant_id']
          },
        ]
      }
      service_order_prescription_measures: {
        Row: {
          id: string
          service_order_prescription_id: string
          eye: 'OD' | 'OS'
          vision_zone: 'far' | 'near' | 'intermediate'
          sphere_dpt: number | null
          cylinder_dpt: number | null
          axis_deg: number | null
          addition_dpt: number | null
          prism_horizontal_pd: number | null
          prism_horizontal_base: 'in' | 'out' | null
          prism_vertical_pd: number | null
          prism_vertical_base: 'up' | 'down' | null
          dnp_mm: number | null
          created_at: string
        }
        Insert: {
          id?: string
          service_order_prescription_id: string
          eye: 'OD' | 'OS'
          vision_zone?: 'far' | 'near' | 'intermediate'
          sphere_dpt?: number | null
          cylinder_dpt?: number | null
          axis_deg?: number | null
          addition_dpt?: number | null
          prism_horizontal_pd?: number | null
          prism_horizontal_base?: 'in' | 'out' | null
          prism_vertical_pd?: number | null
          prism_vertical_base?: 'up' | 'down' | null
          dnp_mm?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          service_order_prescription_id?: string
          eye?: 'OD' | 'OS'
          vision_zone?: 'far' | 'near' | 'intermediate'
          sphere_dpt?: number | null
          cylinder_dpt?: number | null
          axis_deg?: number | null
          addition_dpt?: number | null
          prism_horizontal_pd?: number | null
          prism_horizontal_base?: 'in' | 'out' | null
          prism_vertical_pd?: number | null
          prism_vertical_base?: 'up' | 'down' | null
          dnp_mm?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_order_prescription_me_service_order_prescription_i_fkey'
            columns: ['service_order_prescription_id']
            referencedRelation: 'service_order_prescriptions'
            referencedColumns: ['id']
          },
        ]
      }
      /** Receita EFETIVAMENTE UTILIZADA na producao desta O.S. Copia congelada: editar ou substituir a receita de origem nao altera esta linha (ADR-002). */
      service_order_prescriptions: {
        Row: {
          id: string
          service_order_id: string
          tenant_id: string
          source_prescription_id: string | null
          source_revision: number | null
          snapshot_taken_at: string
          issued_at: string
          prescriber_name: string | null
          prescriber_council: string | null
          vision_use: string
          cylinder_notation: 'negative' | 'positive'
          is_adjusted: boolean
          adjustment_reason: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          service_order_id: string
          tenant_id: string
          source_prescription_id?: string | null
          source_revision?: number | null
          snapshot_taken_at?: string
          issued_at: string
          prescriber_name?: string | null
          prescriber_council?: string | null
          vision_use: string
          cylinder_notation?: 'negative' | 'positive'
          is_adjusted?: boolean
          adjustment_reason?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          service_order_id?: string
          tenant_id?: string
          source_prescription_id?: string | null
          source_revision?: number | null
          snapshot_taken_at?: string
          issued_at?: string
          prescriber_name?: string | null
          prescriber_council?: string | null
          vision_use?: string
          cylinder_notation?: 'negative' | 'positive'
          is_adjusted?: boolean
          adjustment_reason?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_order_prescriptions_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_prescriptions_service_order_id_fkey'
            columns: ['service_order_id']
            referencedRelation: 'service_orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_prescriptions_source_prescription_id_fkey'
            columns: ['source_prescription_id']
            referencedRelation: 'optical_prescriptions'
            referencedColumns: ['id']
          },
        ]
      }
      service_order_status_history: {
        Row: {
          id: string
          service_order_id: string
          from_status_id: string | null
          to_status_id: string
          changed_by: string | null
          changed_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          service_order_id: string
          from_status_id?: string | null
          to_status_id: string
          changed_by?: string | null
          changed_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          service_order_id?: string
          from_status_id?: string | null
          to_status_id?: string
          changed_by?: string | null
          changed_at?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'service_order_status_history_changed_by_fkey'
            columns: ['changed_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_status_history_from_status_id_fkey'
            columns: ['from_status_id']
            referencedRelation: 'service_order_statuses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_status_history_service_order_id_fkey'
            columns: ['service_order_id']
            referencedRelation: 'service_orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_status_history_to_status_id_fkey'
            columns: ['to_status_id']
            referencedRelation: 'service_order_statuses'
            referencedColumns: ['id']
          },
        ]
      }
      service_order_status_transitions: {
        Row: {
          id: string
          tenant_id: string
          from_status_id: string
          to_status_id: string
          required_permission: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          from_status_id: string
          to_status_id: string
          required_permission?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          from_status_id?: string
          to_status_id?: string
          required_permission?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'service_order_status_transitions_from_status_id_fkey'
            columns: ['from_status_id']
            referencedRelation: 'service_order_statuses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_status_transitions_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_order_status_transitions_to_status_id_fkey'
            columns: ['to_status_id']
            referencedRelation: 'service_order_statuses'
            referencedColumns: ['id']
          },
        ]
      }
      service_order_statuses: {
        Row: {
          id: string
          tenant_id: string
          code: string
          label: string
          stage: 'draft' | 'awaiting_prescription' | 'awaiting_lab' | 'in_production' | 'received_from_lab' | 'assembling' | 'quality_check' | 'ready_for_pickup' | 'delivered' | 'cancelled'
          is_initial: boolean
          is_final: boolean
          blocks_delivery: boolean
          notifies_customer: boolean
          color_hex: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          code: string
          label: string
          stage: 'draft' | 'awaiting_prescription' | 'awaiting_lab' | 'in_production' | 'received_from_lab' | 'assembling' | 'quality_check' | 'ready_for_pickup' | 'delivered' | 'cancelled'
          is_initial?: boolean
          is_final?: boolean
          blocks_delivery?: boolean
          notifies_customer?: boolean
          color_hex?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          code?: string
          label?: string
          stage?: 'draft' | 'awaiting_prescription' | 'awaiting_lab' | 'in_production' | 'received_from_lab' | 'assembling' | 'quality_check' | 'ready_for_pickup' | 'delivered' | 'cancelled'
          is_initial?: boolean
          is_final?: boolean
          blocks_delivery?: boolean
          notifies_customer?: boolean
          color_hex?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_order_statuses_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      service_orders: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          number: number
          customer_id: string
          sale_id: string | null
          status_id: string
          priority: 'low' | 'normal' | 'high' | 'urgent'
          frame_source: 'store_stock' | 'customer_own' | 'supplier_direct'
          frame_product_id: string | null
          frame_sale_item_id: string | null
          frame_description: string | null
          opened_at: string
          promised_at: string | null
          delivered_at: string | null
          delivered_to_name: string | null
          delivered_to_document: string | null
          cancelled_at: string | null
          cancel_reason: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          branch_id: string
          number: number
          customer_id: string
          sale_id?: string | null
          status_id: string
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          frame_source?: 'store_stock' | 'customer_own' | 'supplier_direct'
          frame_product_id?: string | null
          frame_sale_item_id?: string | null
          frame_description?: string | null
          opened_at?: string
          promised_at?: string | null
          delivered_at?: string | null
          delivered_to_name?: string | null
          delivered_to_document?: string | null
          cancelled_at?: string | null
          cancel_reason?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          branch_id?: string
          number?: number
          customer_id?: string
          sale_id?: string | null
          status_id?: string
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          frame_source?: 'store_stock' | 'customer_own' | 'supplier_direct'
          frame_product_id?: string | null
          frame_sale_item_id?: string | null
          frame_description?: string | null
          opened_at?: string
          promised_at?: string | null
          delivered_at?: string | null
          delivered_to_name?: string | null
          delivered_to_document?: string | null
          cancelled_at?: string | null
          cancel_reason?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_orders_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_orders_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_orders_customer_fk'
            columns: ['customer_id', 'tenant_id']
            referencedRelation: 'customers'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'service_orders_frame_item_fk'
            columns: ['frame_sale_item_id', 'tenant_id']
            referencedRelation: 'sale_items'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'service_orders_frame_product_fk'
            columns: ['frame_product_id', 'tenant_id']
            referencedRelation: 'products'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'service_orders_sale_fk'
            columns: ['sale_id', 'tenant_id']
            referencedRelation: 'sales'
            referencedColumns: ['id', 'tenant_id']
          },
          {
            foreignKeyName: 'service_orders_sale_id_fkey'
            columns: ['sale_id']
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_orders_status_id_fkey'
            columns: ['status_id']
            referencedRelation: 'service_order_statuses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_orders_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      stock_balances: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          product_id: string
          quantity: number
          reserved_quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          branch_id: string
          product_id: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          branch_id?: string
          product_id?: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_balances_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_balances_product_fk'
            columns: ['product_id', 'tenant_id']
            referencedRelation: 'products'
            referencedColumns: ['id', 'tenant_id']
          },
        ]
      }
      stock_movements: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          product_id: string
          movement_kind: 'purchase_in' | 'sale_out' | 'reserve' | 'release_reserve' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'return_in' | 'loss' | 'lab_out' | 'lab_in'
          quantity: number
          direction: '-1'
          unit_cost: number | null
          related_entity: string | null
          related_entity_id: string | null
          notes: string | null
          performed_by: string | null
          occurred_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          branch_id: string
          product_id: string
          movement_kind: 'purchase_in' | 'sale_out' | 'reserve' | 'release_reserve' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'return_in' | 'loss' | 'lab_out' | 'lab_in'
          quantity: number
          direction: '-1'
          unit_cost?: number | null
          related_entity?: string | null
          related_entity_id?: string | null
          notes?: string | null
          performed_by?: string | null
          occurred_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          branch_id?: string
          product_id?: string
          movement_kind?: 'purchase_in' | 'sale_out' | 'reserve' | 'release_reserve' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'return_in' | 'loss' | 'lab_out' | 'lab_in'
          quantity?: number
          direction?: '-1'
          unit_cost?: number | null
          related_entity?: string | null
          related_entity_id?: string | null
          notes?: string | null
          performed_by?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_movements_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_movements_performed_by_fkey'
            columns: ['performed_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_movements_product_fk'
            columns: ['product_id', 'tenant_id']
            referencedRelation: 'products'
            referencedColumns: ['id', 'tenant_id']
          },
        ]
      }
      suppliers: {
        Row: {
          id: string
          tenant_id: string
          trade_name: string
          legal_name: string | null
          tax_document: string | null
          phone: string | null
          email: string | null
          contact_name: string | null
          record_status: 'quick' | 'complete'
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          trade_name: string
          legal_name?: string | null
          tax_document?: string | null
          phone?: string | null
          email?: string | null
          contact_name?: string | null
          record_status?: 'quick' | 'complete'
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          trade_name?: string
          legal_name?: string | null
          tax_document?: string | null
          phone?: string | null
          email?: string | null
          contact_name?: string | null
          record_status?: 'quick' | 'complete'
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'suppliers_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'suppliers_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      /** Empresa contratante do SaaS. Fronteira de isolamento de dados (RLS). */
      tenants: {
        Row: {
          id: string
          slug: string
          legal_name: string
          trade_name: string
          tax_document: string | null
          plan_code: string
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          slug: string
          legal_name: string
          trade_name: string
          tax_document?: string | null
          plan_code?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          slug?: string
          legal_name?: string
          trade_name?: string
          tax_document?: string | null
          plan_code?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
        ]
      }
      /** Define em quais filiais o usuario opera. O cliente e do tenant, mas a visibilidade operacional pode ser restringida por filial via politicas. */
      user_branch_access: {
        Row: {
          id: string
          app_user_id: string
          branch_id: string
          role_id: string
          is_default_branch: boolean
          created_at: string
        }
        Insert: {
          id?: string
          app_user_id: string
          branch_id: string
          role_id: string
          is_default_branch?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          app_user_id?: string
          branch_id?: string
          role_id?: string
          is_default_branch?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_branch_access_app_user_id_fkey'
            columns: ['app_user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_branch_access_branch_id_fkey'
            columns: ['branch_id']
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_branch_access_role_id_fkey'
            columns: ['role_id']
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
        ]
      }
      user_invitations: {
        Row: {
          id: string
          tenant_id: string
          email: string
          full_name: string | null
          role_id: string
          branch_ids: string[]
          is_salesperson: boolean
          invited_by: string | null
          accepted_at: string | null
          accepted_user_id: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          email: string
          full_name?: string | null
          role_id: string
          branch_ids?: string[]
          is_salesperson?: boolean
          invited_by?: string | null
          accepted_at?: string | null
          accepted_user_id?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string
          full_name?: string | null
          role_id?: string
          branch_ids?: string[]
          is_salesperson?: boolean
          invited_by?: string | null
          accepted_at?: string | null
          accepted_user_id?: string | null
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_invitations_accepted_user_id_fkey'
            columns: ['accepted_user_id']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_invitations_invited_by_fkey'
            columns: ['invited_by']
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_invitations_role_id_fkey'
            columns: ['role_id']
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_invitations_tenant_id_fkey'
            columns: ['tenant_id']
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      v_customer_overview: {
        Row: {
          id: string | null
          tenant_id: string | null
          party_type: string | null
          display_name: string | null
          status: string | null
          record_status: string | null
          created_at_branch_id: string | null
          created_at_branch_name: string | null
          tax_document: string | null
          birth_date: string | null
          primary_phone: string | null
          primary_email: string | null
          pending_fields: string[] | null
        }
        Relationships: []
      }
      v_customer_prescriptions: {
        Row: {
          id: string | null
          tenant_id: string | null
          customer_id: string | null
          issued_at: string | null
          valid_until: string | null
          status: string | null
          revision: number | null
          root_prescription_id: string | null
          vision_use: string | null
          prescriber_name: string | null
          od_sphere: number | null
          od_cylinder: number | null
          od_axis: number | null
          od_dnp: number | null
          os_sphere: number | null
          os_cylinder: number | null
          os_axis: number | null
          os_dnp: number | null
          od_addition: number | null
          os_addition: number | null
        }
        Relationships: []
      }
      v_service_order_production: {
        Row: {
          service_order_id: string | null
          tenant_id: string | null
          branch_id: string | null
          number: number | null
          customer_id: string | null
          customer_name: string | null
          status_code: string | null
          status_stage: string | null
          opened_at: string | null
          promised_at: string | null
          delivered_at: string | null
          source_prescription_id: string | null
          source_revision: number | null
          prescription_issued_at: string | null
          prescriber_name: string | null
          od_sphere_used: number | null
          od_cylinder_used: number | null
          od_axis_used: number | null
          od_addition_used: number | null
          os_sphere_used: number | null
          os_cylinder_used: number | null
          os_axis_used: number | null
          os_addition_used: number | null
          od_dnp_prescribed: number | null
          os_dnp_prescribed: number | null
          od_dnp_fitting: number | null
          os_dnp_fitting: number | null
          od_height: number | null
          os_height: number | null
          dp_total_mm: number | null
          dp_source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      /** bootstrap_tenant(p_slug text, p_legal_name text, p_trade_name text, p_branch_name text DEFAULT 'Matriz'::text, p_admin_name text DEFAULT NULL::text, p_tax_document text DEFAULT NULL::text, p_auth_user_id uuid DEFAULT NULL::uuid) returns uuid */
      bootstrap_tenant: {
        Args: { p_slug: string; p_legal_name: string; p_trade_name: string; p_branch_name?: string; p_admin_name?: string | null; p_tax_document?: string | null; p_auth_user_id?: string | null }
        Returns: string
      }
      /** current_app_user_id() returns uuid */
      current_app_user_id: {
        Args: Record<string, never>
        Returns: string
      }
      /** current_branch_ids() returns uuid[] */
      current_branch_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      /** current_session_context() returns jsonb */
      current_session_context: {
        Args: Record<string, never>
        Returns: Json
      }
      /** current_tenant_id() returns uuid */
      current_tenant_id: {
        Args: Record<string, never>
        Returns: string
      }
      /** customer_missing_fields(p_customer_id uuid, p_requirement text DEFAULT 'complete'::text) returns text[] */
      customer_missing_fields: {
        Args: { p_customer_id: string; p_requirement?: string }
        Returns: string[]
      }
      /** digits_only(p_value text) returns text */
      digits_only: {
        Args: { p_value: string }
        Returns: string
      }
      /** handle_new_auth_user() returns trigger */
      handle_new_auth_user: {
        Args: Record<string, never>
        Returns: unknown
      }
      /** has_permission(p_permission_code text) returns boolean */
      has_permission: {
        Args: { p_permission_code: string }
        Returns: boolean
      }
      /** is_valid_cnpj(p_value text) returns boolean */
      is_valid_cnpj: {
        Args: { p_value: string }
        Returns: boolean
      }
      /** is_valid_cpf(p_value text) returns boolean */
      is_valid_cpf: {
        Args: { p_value: string }
        Returns: boolean
      }
      /** latest_active_prescription(p_customer_id uuid) returns uuid */
      latest_active_prescription: {
        Args: { p_customer_id: string }
        Returns: string
      }
      /** next_document_number(p_branch_id uuid, p_document_type text) returns bigint */
      next_document_number: {
        Args: { p_branch_id: string; p_document_type: string }
        Returns: number
      }
      /** resolve_catalog(p_catalog_key text, p_tenant_id uuid) returns TABLE(id uuid, code text, label text, sort_order integer, is_platform boolean) */
      resolve_catalog: {
        Args: { p_catalog_key: string; p_tenant_id: string }
        Returns: { id: string; code: string; label: string; sort_order: number; is_platform: boolean }[]
      }
      /** seed_tenant_defaults(p_tenant_id uuid, p_branch_id uuid) returns void */
      seed_tenant_defaults: {
        Args: { p_tenant_id: string; p_branch_id: string }
        Returns: void
      }
      /** seed_tenant_roles(p_tenant_id uuid) returns void */
      seed_tenant_roles: {
        Args: { p_tenant_id: string }
        Returns: void
      }
      /** take_prescription_snapshot(p_service_order_id uuid, p_prescription_id uuid, p_created_by uuid DEFAULT NULL::uuid) returns uuid */
      take_prescription_snapshot: {
        Args: { p_service_order_id: string; p_prescription_id: string; p_created_by?: string | null }
        Returns: string
      }
      /** user_can_access_branch(p_branch_id uuid) returns boolean */
      user_can_access_branch: {
        Args: { p_branch_id: string }
        Returns: boolean
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

export type Views<T extends keyof PublicSchema['Views']> =
  PublicSchema['Views'][T]['Row']

export type FunctionArgs<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Args']

export type FunctionReturns<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Returns']
