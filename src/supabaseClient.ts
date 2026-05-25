import { createClient } from '@supabase/supabase-js';
import { Registration, Leader, FormField, UserProfile } from './types';

// Read env variables safely
const rawUrl = (import.meta as any).env.VITE_SUPABASE_URL || (import.meta as any).env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || (import.meta as any).env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Clean the strings of invisible quotes or whitespace (common when copy/pasting)
const supabaseUrl = rawUrl.trim().replace(/^['"]|['"]$/g, '');
const supabaseAnonKey = rawKey.trim().replace(/^['"]|['"]$/g, '');

// Detect if Supabase is fully configured on the platform
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseUrl !== 'https://your-project-id.supabase.co' && 
  supabaseAnonKey && 
  supabaseAnonKey !== 'your-supabase-anon-key'
);

// Gracefully instantiate client or a null proxy
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Real-time synchronization flags or status indicators helper
export async function testSupabaseConnection(): Promise<boolean> {
  if (!supabase) return false;
  try {
    // We try to fetch current auth state first which doesn't check any database tables,
    // which indicates that we successfully authorized to the Supabase endpoint.
    const { error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Supabase authentication check failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase integration offline / connection error:', err);
    return false;
  }
}

// ==========================================
// PROFILES API HELPERS
// ==========================================
export async function fetchProfile(profileId: string = 'p1'): Promise<UserProfile | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    if (error) throw error;
    return {
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      cpf: data.cpf || '',
      avatarUrl: data.avatar_url || ''
    };
  } catch (err) {
    console.error('Error fetching profile from Supabase:', err);
    return null;
  }
}

export async function upsertProfile(profileId: string, profile: UserProfile): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: profileId,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        cpf: profile.cpf,
        avatar_url: profile.avatarUrl
      });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error upserting profile in Supabase:', err);
    return false;
  }
}

// ==========================================
// LEADERS API HELPERS
// ==========================================
export async function fetchLeaders(): Promise<Leader[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('leaders')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      email: item.email || '',
      phone: item.phone || '',
      cpf: item.cpf || '',
      avatarUrl: item.avatar_url || '',
      registrationCount: item.registration_count || 0,
      status: item.status || 'Ativo'
    }));
  } catch (err) {
    console.error('Error fetching leaders from Supabase:', err);
    return null;
  }
}

export async function upsertLeader(leader: Leader): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('leaders')
      .upsert({
        id: leader.id,
        name: leader.name,
        email: leader.email,
        phone: leader.phone,
        cpf: leader.cpf,
        avatar_url: leader.avatarUrl,
        registration_count: leader.registrationCount,
        status: leader.status
      });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error saving leader to Supabase:', err);
    return false;
  }
}

export async function deleteLeaderFromDB(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('leaders')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting leader from Supabase:', err);
    return false;
  }
}

// ==========================================
// REGISTRATIONS API HELPERS
// ==========================================
export async function fetchRegistrations(): Promise<Registration[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category || '',
      leaderId: item.leader_id || '',
      leaderName: item.leader_name || '',
      date: item.date || '',
      createdAt: item.created_at || new Date().toISOString(),
      ...(item.dynamic_data || {})
    }));
  } catch (err) {
    console.error('Error fetching registrations from Supabase:', err);
    return null;
  }
}

export async function upsertRegistration(reg: Registration): Promise<boolean> {
  if (!supabase) return false;
  try {
    // Extract static attributes and bundle everything else into dynamic_data
    const { id, name, category, leaderId, leaderName, date, createdAt, ...dynamicData } = reg;
    const { error } = await supabase
      .from('registrations')
      .upsert({
        id,
        name,
        category,
        leader_id: leaderId,
        leader_name: leaderName,
        date,
        created_at: createdAt,
        dynamic_data: dynamicData
      });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error saving registration to Supabase:', err);
    return false;
  }
}

export async function deleteRegistrationFromDB(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('registrations')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting registration from Supabase:', err);
    return false;
  }
}

// ==========================================
// FORM FIELDS API HELPERS
// ==========================================
export async function fetchFormFields(): Promise<FormField[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('form_fields')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data.map((item: any) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      placeholder: item.placeholder || '',
      required: item.required || false,
      options: item.options || undefined
    }));
  } catch (err) {
    console.error('Error fetching form fields from Supabase:', err);
    return null;
  }
}

export async function upsertFormField(field: FormField): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('form_fields')
      .upsert({
        id: field.id,
        type: field.type,
        label: field.label,
        placeholder: field.placeholder || '',
        required: field.required || false,
        options: field.options || null
      });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error saving form field to Supabase:', err);
    return false;
  }
}

export async function deleteFormFieldFromDB(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('form_fields')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting form field from Supabase:', err);
    return false;
  }
}
