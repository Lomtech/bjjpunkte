export type Belt = 'white' | 'blue' | 'purple' | 'brown' | 'black'
export type ClassType = 'gi' | 'no-gi' | 'open mat' | 'kids' | 'competition'

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[] }

export interface Database {
  __InternalSupabase: { PostgrestVersion: '12' }
  public: {
    Tables: {
      gyms: {
        Row: { id: string; owner_id: string; name: string; address: string | null; phone: string | null; email: string | null; logo_url: string | null; stripe_account_id: string | null; monthly_fee_cents: number | null; created_at: string }
        Insert: { owner_id: string; name: string; address?: string | null; phone?: string | null; email?: string | null; logo_url?: string | null; stripe_account_id?: string | null; monthly_fee_cents?: number | null }
        Update: { name?: string; address?: string | null; phone?: string | null; email?: string | null; logo_url?: string | null; stripe_account_id?: string | null; monthly_fee_cents?: number | null }
        Relationships: Rel[]
      }
      members: {
        Row: { id: string; gym_id: string; first_name: string; last_name: string; email: string | null; phone: string | null; date_of_birth: string | null; join_date: string; belt: Belt; stripes: number; is_active: boolean; notes: string | null; stripe_customer_id: string | null; subscription_status: 'none' | 'active' | 'past_due' | 'cancelled' | 'trial'; contract_end_date: string | null; monthly_fee_override_cents: number | null; portal_token: string | null; created_at: string }
        Insert: { gym_id: string; first_name: string; last_name: string; email?: string | null; phone?: string | null; date_of_birth?: string | null; join_date?: string; belt?: Belt; stripes?: number; is_active?: boolean; notes?: string | null; stripe_customer_id?: string | null; subscription_status?: 'none' | 'active' | 'past_due' | 'cancelled' | 'trial'; contract_end_date?: string | null; monthly_fee_override_cents?: number | null; portal_token?: string | null }
        Update: { first_name?: string; last_name?: string; email?: string | null; phone?: string | null; date_of_birth?: string | null; join_date?: string; belt?: Belt; stripes?: number; is_active?: boolean; notes?: string | null; stripe_customer_id?: string | null; subscription_status?: 'none' | 'active' | 'past_due' | 'cancelled' | 'trial'; contract_end_date?: string | null; monthly_fee_override_cents?: number | null; portal_token?: string | null }
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
        Row: { id: string; gym_id: string; title: string; class_type: ClassType; description: string | null; instructor: string | null; starts_at: string; ends_at: string; max_capacity: number | null; is_cancelled: boolean; created_at: string }
        Insert: { gym_id: string; title: string; class_type: ClassType; description?: string | null; instructor?: string | null; starts_at: string; ends_at: string; max_capacity?: number | null; is_cancelled?: boolean }
        Update: { title?: string; class_type?: ClassType; description?: string | null; instructor?: string | null; starts_at?: string; ends_at?: string; max_capacity?: number | null; is_cancelled?: boolean }
        Relationships: Rel[]
      }
      class_bookings: {
        Row: { id: string; class_id: string; member_id: string; gym_id: string; status: 'confirmed' | 'waitlist' | 'cancelled'; created_at: string }
        Insert: { class_id: string; member_id: string; gym_id: string; status?: 'confirmed' | 'waitlist' | 'cancelled' }
        Update: { status?: 'confirmed' | 'waitlist' | 'cancelled' }
        Relationships: Rel[]
      }
      payments: {
        Row: { id: string; gym_id: string; member_id: string; stripe_payment_intent_id: string | null; amount_cents: number; status: string; paid_at: string | null; created_at: string }
        Insert: { gym_id: string; member_id: string; stripe_payment_intent_id?: string | null; amount_cents: number; status?: string; paid_at?: string | null }
        Update: { status?: string; paid_at?: string | null }
        Relationships: Rel[]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
