export type Belt = 'white' | 'blue' | 'purple' | 'brown' | 'black'
export type ClassType = 'gi' | 'no-gi' | 'open mat' | 'kids' | 'competition'
export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'cancelled' | 'trial'
export type GymPlan = 'free' | 'starter' | 'grow' | 'pro'
export type LeadStatus = 'new' | 'contacted' | 'trial_scheduled' | 'trial_done' | 'converted' | 'lost'
export type LeadSource = 'walk-in' | 'referral' | 'instagram' | 'website' | 'other' | 'signup_link' | 'public_page'
export type BookingStatus = 'confirmed' | 'waitlist' | 'cancelled'
export type LeadBookingStatus = 'booked' | 'checked_in' | 'cancelled'

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
          slug: string | null
          // Stripe Connect
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          // Osss platform subscription
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
          belt_system_enabled: boolean | null
          class_types: string[] | null
          // Public page
          tagline: string | null
          about: string | null
          about_blocks: unknown[] | null
          hero_image_url: string | null
          hero_image_position: number | null
          gallery_urls: string[] | null
          video_url: string | null
          video_urls: string[] | null
          sport_type: string | null
          founded_year: number | null
          opening_hours: Record<string, unknown> | null
          impressum_text: string | null
          // Social
          whatsapp_number: string | null
          instagram_url: string | null
          facebook_url: string | null
          website_url: string | null
          // Notifications
          callmebot_api_key: string | null
          // Signup
          signup_token: string | null
        }
        Insert: {
          owner_id: string
          name: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          monthly_fee_cents?: number | null
          slug?: string | null
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
          belt_system_enabled?: boolean | null
          class_types?: string[] | null
          tagline?: string | null
          about?: string | null
          about_blocks?: unknown[] | null
          hero_image_url?: string | null
          hero_image_position?: number | null
          gallery_urls?: string[] | null
          video_url?: string | null
          video_urls?: string[] | null
          sport_type?: string | null
          founded_year?: number | null
          opening_hours?: Record<string, unknown> | null
          impressum_text?: string | null
          whatsapp_number?: string | null
          instagram_url?: string | null
          facebook_url?: string | null
          website_url?: string | null
          callmebot_api_key?: string | null
          signup_token?: string | null
        }
        Update: {
          name?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          monthly_fee_cents?: number | null
          slug?: string | null
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
          belt_system_enabled?: boolean | null
          class_types?: string[] | null
          tagline?: string | null
          about?: string | null
          about_blocks?: unknown[] | null
          hero_image_url?: string | null
          hero_image_position?: number | null
          gallery_urls?: string[] | null
          video_url?: string | null
          video_urls?: string[] | null
          sport_type?: string | null
          founded_year?: number | null
          opening_hours?: Record<string, unknown> | null
          impressum_text?: string | null
          whatsapp_number?: string | null
          instagram_url?: string | null
          facebook_url?: string | null
          website_url?: string | null
          callmebot_api_key?: string | null
          signup_token?: string | null
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
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: SubscriptionStatus
          plan_id: string | null
          requested_plan_id: string | null
          onboarding_status: string | null
          cancellation_requested_at: string | null
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
          cancellation_requested_at?: string | null
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
          cancellation_requested_at?: string | null
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
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
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
        Row: { id: string; class_id: string; member_id: string; gym_id: string; status: BookingStatus; created_at: string }
        Insert: { class_id: string; member_id: string; gym_id: string; status?: BookingStatus }
        Update: { status?: BookingStatus }
        Relationships: Rel[]
      }
      membership_plans: {
        Row: { id: string; gym_id: string; name: string; description: string | null; price_cents: number; billing_interval: string; contract_months: number; sort_order: number; is_active: boolean; stripe_price_id: string | null; created_at: string }
        Insert: { gym_id: string; name: string; description?: string | null; price_cents: number; billing_interval?: string; contract_months?: number; sort_order?: number; is_active?: boolean; stripe_price_id?: string | null }
        Update: { name?: string; description?: string | null; price_cents?: number; billing_interval?: string; contract_months?: number; sort_order?: number; is_active?: boolean; stripe_price_id?: string | null }
        Relationships: Rel[]
      }
      leads: {
        Row: { id: string; gym_id: string; first_name: string; last_name: string; email: string | null; phone: string | null; status: LeadStatus; source: LeadSource; notes: string | null; trial_date: string | null; referred_by: string | null; lead_token: string | null; created_at: string; contacted_at: string | null; converted_at: string | null }
        Insert: { gym_id: string; first_name: string; last_name: string; email?: string | null; phone?: string | null; status?: LeadStatus; source?: LeadSource; notes?: string | null; trial_date?: string | null; referred_by?: string | null; lead_token?: string | null }
        Update: { first_name?: string; last_name?: string; email?: string | null; phone?: string | null; status?: LeadStatus; source?: LeadSource; notes?: string | null; trial_date?: string | null; referred_by?: string | null; contacted_at?: string | null; converted_at?: string | null }
        Relationships: Rel[]
      }
      lead_bookings: {
        Row: { id: string; lead_id: string; class_id: string; gym_id: string | null; status: LeadBookingStatus; booked_at: string; checked_in_at: string | null }
        Insert: { lead_id: string; class_id: string; gym_id?: string | null; status?: LeadBookingStatus }
        Update: { status?: LeadBookingStatus; checked_in_at?: string | null }
        Relationships: Rel[]
      }
      posts: {
        Row: { id: string; gym_id: string; title: string; cover_url: string | null; blocks: unknown[]; published_at: string | null; created_at: string; updated_at: string }
        Insert: { gym_id: string; title: string; cover_url?: string | null; blocks?: unknown[]; published_at?: string | null }
        Update: { title?: string; cover_url?: string | null; blocks?: unknown[]; published_at?: string | null }
        Relationships: Rel[]
      }
    }
    Views: Record<string, never>
    Functions: {
      save_stripe_account: { Args: { p_gym_id: string; p_stripe_account_id: string }; Returns: void }
      increment_invoice_counter: { Args: { p_gym_id: string }; Returns: number }
      get_classes_for_gym: { Args: { p_gym_id: string; p_from: string }; Returns: unknown[] }
      book_class_by_token: { Args: { p_token: string; p_class_id: string }; Returns: unknown }
      cancel_booking_by_token: { Args: { p_token: string; p_class_id: string }; Returns: unknown }
    }
  }
}
