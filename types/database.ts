export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          role: 'public_user' | 'admin' | 'super_admin';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          role?: 'public_user' | 'admin' | 'super_admin';
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      access_accounts: {
        Row: {
          id: string;
          profile_id: string | null;
          access_id: string | null;
          status: 'pending' | 'active' | 'expired' | 'suspended' | 'revoked' | 'denied';
          account_type: string;
          organization: string | null;
          default_gate: 'Wood Valley' | 'Honanui' | 'ʻĀinapō' | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          issued_at: string | null;
          expires_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['access_accounts']['Row']> & { account_type?: string };
        Update: Partial<Database['public']['Tables']['access_accounts']['Row']>;
      };
      vehicles: {
        Row: {
          id: string;
          access_account_id: string;
          label: string;
          license_plate: string;
          state: string | null;
          make: string | null;
          model: string | null;
          color: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['vehicles']['Row']> & { access_account_id: string; license_plate: string; label: string };
        Update: Partial<Database['public']['Tables']['vehicles']['Row']>;
      };
      gates: {
        Row: {
          id: string;
          name: 'Wood Valley' | 'Honanui' | 'ʻĀinapō';
          status: 'open' | 'restricted' | 'closed';
          road_condition: string | null;
          notes: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['gates']['Row']> & { name: 'Wood Valley' | 'Honanui' | 'ʻĀinapō' };
        Update: Partial<Database['public']['Tables']['gates']['Row']>;
      };
      gate_combinations: {
        Row: {
          id: string;
          gate_id: string;
          combo: string;
          valid_from: string;
          valid_to: string | null;
          active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['gate_combinations']['Row']> & { gate_id: string; combo: string; valid_from: string };
        Update: Partial<Database['public']['Tables']['gate_combinations']['Row']>;
      };
      daily_access_requests: {
        Row: {
          id: string;
          access_account_id: string;
          request_date: string;
          gate_id: string;
          purpose: string;
          party_size: number;
          vehicle_summary: string | null;
          emergency_contact_phone: string | null;
          summit_permit_number: string | null;
          organization: string | null;
          status: 'draft' | 'pending' | 'approved' | 'held' | 'denied' | 'cancelled';
          approved_by: string | null;
          approved_at: string | null;
          gate_combination_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['daily_access_requests']['Row']> & { access_account_id: string; request_date: string; gate_id: string; purpose: string };
        Update: Partial<Database['public']['Tables']['daily_access_requests']['Row']>;
      };
      documents: {
        Row: {
          id: string;
          access_account_id: string;
          document_type: 'government_id' | 'agreement' | 'summit_permit' | 'insurance' | 'other';
          file_path: string;
          status: 'pending' | 'verified' | 'rejected' | 'expired';
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['documents']['Row']> & { access_account_id: string; document_type: 'government_id' | 'agreement' | 'summit_permit' | 'insurance' | 'other'; file_path: string };
        Update: Partial<Database['public']['Tables']['documents']['Row']>;
      };
      timeline_events: {
        Row: {
          id: string;
          access_account_id: string | null;
          actor_profile_id: string | null;
          event_type: string;
          event_title: string;
          event_body: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['timeline_events']['Row']> & { event_type: string; event_title: string };
        Update: Partial<Database['public']['Tables']['timeline_events']['Row']>;
      };
      sms_logs: {
        Row: {
          id: string;
          daily_access_request_id: string | null;
          phone: string;
          message_preview: string;
          provider: string;
          provider_message_id: string | null;
          status: 'queued' | 'sent' | 'delivered' | 'failed';
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sms_logs']['Row']> & { phone: string; message_preview: string };
        Update: Partial<Database['public']['Tables']['sms_logs']['Row']>;
      };
    };
  };
};
