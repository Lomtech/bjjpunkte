export type Belt = 'white' | 'blue' | 'purple' | 'brown' | 'black'
export type ClassType = 'gi' | 'no-gi' | 'open mat' | 'kids' | 'competition'
export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'cancelled' | 'trial'
export type GymPlan = 'free' | 'starter' | 'grow' | 'pro'

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[] }

export interface Database {
  __InternalSupabase: { PostgrestVersion: '12' }
  public: {
    Tables: {
      gyms: {
        Row: {
          id: string
          owner_id: string
          name: string
          address: string | null
          phone: string | null
          email: string | null
          logo_url: string | null
          monthly_fee_cents: number | null
          created_at: string
          // Stripe Connect (gym receives member payments)
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          // Osss platform subscription (gym pays Osss)
          osss_stripe_customer_id: string | null
          osss_stripe_subscription_id: string | null
          // Plan & limits
          plan: GymPlan | null
          plan_member_limit: number | null
          // Invoice settings
          invoice_prefix: string | null
          invoice_counter: number | null
          tax_number: string | null
          ustid: string | null
          is_kleinunternehmer: boolean | null
          bank_iban: string | null
          bank_bic: string | null
          bank_name: string | null
          legal_name: string | null
          legal_address: string | null
          legal_email: string | null
          // Belt system config
          belt_system: string | null
          class_types: string[] | null
          // Public page
          slug: string | null
        }
        Insert: {
          owner_id: string
          name: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          monthly_fee_cents?: number | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          osss_stripe_customer_id?: string | null
          osss_stripe_subscription_id?: string | null
          plan?: GymPlan | null
          plan_member_limit?: number | null
          invoice_prefix?: string | null
          invoice_counter?: number | null
          tax_number?: string | null
          ustid?: string | null
          is_kleinunternehmer?: boolean | null
          bank_iban?: string | null
          bank_bic?: string | null
          bank_name?: string | null
          legal_name?: string | null
          legal_address?: string | null
          legal_email?: string | null
          belt_system?: string | null
          class_types?: string[] | null
          slug?: string | null
        }
        Update: {
          name?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          monthly_fee_cents?: number | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          osss_stripe_customer_id?: string | null
          osss_stripe_subscription_id?: string | null
          plan?: GymPlan | null
          plan_member_limit?: number | null
          invoice_prefix?: string | null
          invoice_counter?: number | null
          tax_number?: string | null
          ustid?: string | null
          is_kleinunternehmer?: boolean | null
          bank_iban?: string | null
          bank_bic?: string | null
          bank_name?: string | null
          legal_name?: string | null
          legal_address?: string | null
          legal_email?: string | null
          belt_system?: string | null
          class_types?: string[] | null
          slug?: string | null
        }
        Relationships: Rel[]
      }
      members: {
        Row: {
          id: string
          gym_id: string
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          date_of_birth: string | null
          join_date: string
          belt: Belt
          stripes: number
          is_active: boolean
          notes: string | null
          portal_token: string | null
          contract_end_date: string | null
          monthly_fee_override_cents: number | null
          created_at: string
          // Stripe
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: SubscriptionStatus
          // Plans
          plan_id: string | null
          requested_plan_id: string | null
          onboarding_status: string | null
        }
        Insert: {
          gym_id: string
          first_name: string
          last_name: string
          email?: string | null
          phone?: string | null
          date_of_birth?: string | null
          join_date?: string
          belt?: Belt
          stripes?: number
          is_active?: boolean
          notes?: string | null
          portal_token?: string | null
          contract_end_date?: string | null
          monthly_fee_override_cents?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: SubscriptionStatus
          plan_id?: string | null
          requested_plan_id?: string | null
          onboarding_status?: string | null
        }
        Update: {
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          date_of_birth?: string | null
          join_date?: string
          belt?: Belt
          stripes?: number
          is_active?: boolean
          notes?: string | null
          portal_token?: string | null
          contract_end_date?: string | null
          monthly_fee_override_cents?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: SubscriptionStatus
          plan_id?: string | null
          requested_plan_id?: string | null
          onboarding_status?: string | null
        }
        Relationships: Rel[]
      }
      payments: {
        Row: {
          id: string
          gym_id: string
          member_id: string
          amount_cents: number
          status: string
          paid_at: string | null
          created_at: string
          // Stripe identifiers — session ID is the reliable match key
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          // Metadata
          checkout_url: string | null
          invoice_number: string | null
        }
        Insert: {
          gym_id: string
          member_id: string
          amount_cents: number
          status?: string
          paid_at?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          checkout_url?: string | null
          invoice_number?: string | null
        }
        Update: {
          status?: string
          paid_at?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          checkout_url?: string | null
          invoice_number?: string | null
        }
        Relationships: Rel[]
      }
      belt_promotions: {
        Row: { id: string; member_id: string; gym_id: string; previous_belt: Belt; previous_stripes: number; new_belt: Belt; new_stripes: number; promoted_at: string; notes: string | null }
        Insert: { member_id: string; gym_id: string; previous_belt: Belt; previous_stripes: number; new_belt: Belt; new_stripes: number; notes?: string | null }
        Update: { notes?: string | null }
        Relationships: Rel[]
      }
      attendance: {
        Row: { id: string; member_id: string; gym_id: string; checked_in_at: string; class_type: ClassType; checked_out_at: string | null; class_id: string | null }
        Insert: { member_id: string; gym_id: string; class_type?: ClassType; checked_out_at?: string | null; class_id?: string | null }
        Update: { class_type?: ClassType; checked_out_at?: string | null; class_id?: string | null }
        Relationships: Rel[]
      }
      classes: {
        Row: { id: string; gym_id: string; title: string; class_type: ClassType; description: string | null; instructor: string | null; starts_at: string; ends_at: string; max_capacity: number | null; is_cancelled: boolean; recurrence_type: string; recurrence_until: string | null; recurrence_parent_id: string | null; created_at: string }
        Insert: { gym_id: string; title: string; class_type: ClassType; description?: string | null; instructor?: string | null; starts_at: string; ends_at: string; max_capacity?: number | null; is_cancelled?: boolean; recurrence_type?: string; recurrence_until?: string | null; recurrence_parent_id?: string | null }
        Update: { title?: string; class_type?: ClassType; description?: string | null; instructor?: string | null; starts_at?: string; ends_at?: string; max_capacity?: number | null; is_cancelled?: boolean; recurrence_type?: string; recurrence_until?: string | null; recurrence_parent_id?: string | null }
        Relationships: Rel[]
      }
      class_bookings: {
        Row: { id: string; class_id: string; member_id: string; gym_id: string; status: 'confirmed' | 'waitlist' | 'cancelled'; created_at: string }
        Insert: { class_id: string; member_id: string; gym_id: string; status?: 'confirmed' | 'waitlist' | 'cancelled' }
        Update: { status?: 'confirmed' | 'waitlist' | 'cancelled' }
        Relationships: Rel[]
      }
      membership_plans: {
        Row: { id: string; gym_id: string; name: string; price_cents: number; billing_interval: string; stripe_price_id: string | null; created_at: string }
        Insert: { gym_id: string; name: string; price_cents: number; billing_interval?: string; stripe_price_id?: string | null }
        Update: { name?: string; price_cents?: number; billing_interval?: string; stripe_price_id?: string | null }
        Relationships: Rel[]
      }
    }
    Views: Record<string, never>
    Functions: {
      save_stripe_account: { Args: { p_gym_id: string; p_stripe_account_id: string }; Returns: void }
      increment_invoice_counter: { Args: { p_gym_id: string }; Returns: number }
      get_classes_for_gym: { Args: { p_gym_id: string; p_from: string }; Returns: unknown[] }
    }
  }
}
