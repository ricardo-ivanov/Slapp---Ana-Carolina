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
// ROLE DETERMINATION HELPER
// ==========================================
export function checkIfEmailIsAdmin(email: string): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e === 'contato@ricardoivanov.com.br' || e === 'ana.carolina@lideranca.com';
}

// ==========================================
// PASSWORD AND ROLE ENCODING IN AVATAR HELPER
// ==========================================
export function encodePasswordInAvatar(avatarUrl: string, password?: string, isAdmin?: boolean): string {
  const cleanUrl = (avatarUrl || '').split('#pwd:')[0].split('#meta:')[0];
  const meta = { password: password || '', isAdmin: !!isAdmin };
  return `${cleanUrl}#meta:${encodeURIComponent(JSON.stringify(meta))}`;
}

export function decodePasswordFromAvatar(avatarUrl: string): { cleanUrl: string; password?: string; isAdmin?: boolean } {
  const url = avatarUrl || '';
  if (url.includes('#meta:')) {
    const parts = url.split('#meta:');
    try {
      const parsed = JSON.parse(decodeURIComponent(parts[1]));
      return {
        cleanUrl: parts[0],
        password: parsed.password || undefined,
        isAdmin: parsed.isAdmin !== undefined ? parsed.isAdmin : undefined
      };
    } catch (e) {
      return { cleanUrl: parts[0] };
    }
  }
  if (url.includes('#pwd:')) {
    const parts = url.split('#pwd:');
    return {
      cleanUrl: parts[0],
      password: decodeURIComponent(parts[1]),
      isAdmin: undefined
    };
  }
  return { cleanUrl: url, password: undefined, isAdmin: undefined };
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
    const decoded = decodePasswordFromAvatar(data.avatar_url || '');
    return {
      id: data.id || profileId,
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      cpf: data.cpf || '',
      avatarUrl: decoded.cleanUrl,
      isAdmin: data.is_admin !== undefined ? data.is_admin : (decoded.isAdmin !== undefined ? decoded.isAdmin : checkIfEmailIsAdmin(data.email)),
      password: data.password || decoded.password
    };
  } catch (err) {
    console.error('Error fetching profile from Supabase:', err);
    return null;
  }
}

export async function fetchProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const decoded = decodePasswordFromAvatar(data.avatar_url || '');
    return {
      id: data.id,
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      cpf: data.cpf || '',
      avatarUrl: decoded.cleanUrl,
      isAdmin: data.is_admin !== undefined ? data.is_admin : (decoded.isAdmin !== undefined ? decoded.isAdmin : checkIfEmailIsAdmin(data.email)),
      password: data.password || decoded.password
    };
  } catch (err) {
    console.error('Error fetching profile by email from Supabase:', err);
    return null;
  }
}

export async function upsertProfile(profileId: string, profile: UserProfile): Promise<boolean> {
  if (!supabase) return false;
  try {
    const encodedAvatar = encodePasswordInAvatar(profile.avatarUrl, profile.password, profile.isAdmin);
    const payload: any = {
      id: profileId,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      cpf: profile.cpf,
      avatar_url: encodedAvatar,
      is_admin: profile.isAdmin,
      password: profile.password || ''
    };
    const { error } = await supabase
      .from('profiles')
      .upsert(payload);
    if (error) {
      if (error.message && (error.message.includes('column') || error.message.includes('relation'))) {
        console.warn('Supabase profile table fallback triggered:', error.message);
        delete payload.password;
        delete payload.is_admin;
        const { error: retryError } = await supabase
          .from('profiles')
          .upsert(payload);
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
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
    return data.map((item: any) => {
      const decoded = decodePasswordFromAvatar(item.avatar_url || '');
      return {
        id: item.id,
        name: item.name,
        email: item.email || '',
        phone: item.phone || '',
        cpf: item.cpf || '',
        avatarUrl: decoded.cleanUrl,
        registrationCount: item.registration_count || 0,
        status: item.status || 'Ativo',
        isAdmin: item.is_admin !== undefined ? item.is_admin : (decoded.isAdmin !== undefined ? decoded.isAdmin : checkIfEmailIsAdmin(item.email)),
        password: item.password || decoded.password
      };
    });
  } catch (err) {
    console.error('Error fetching leaders from Supabase:', err);
    return null;
  }
}

export async function upsertLeader(leader: Leader): Promise<boolean> {
  if (!supabase) return false;
  try {
    const encodedAvatar = encodePasswordInAvatar(leader.avatarUrl, leader.password, leader.isAdmin);
    const payload: any = {
      id: leader.id,
      name: leader.name,
      email: leader.email,
      phone: leader.phone,
      cpf: leader.cpf,
      avatar_url: encodedAvatar,
      registration_count: leader.registrationCount,
      status: leader.status,
      is_admin: leader.isAdmin,
      password: leader.password || ''
    };
    const { error } = await supabase
      .from('leaders')
      .upsert(payload);
    if (error) {
      if (error.message && (error.message.includes('column') || error.message.includes('relation'))) {
        console.warn('Supabase leaders table fallback triggered:', error.message);
        delete payload.password;
        delete payload.is_admin;
        const { error: retryError } = await supabase
          .from('leaders')
          .upsert(payload);
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
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

// ==========================================
// CATEGORIES API HELPERS
// ==========================================
export async function fetchCategoriesFromDB(): Promise<string[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('name')
      .order('created_at', { ascending: true });
    
    if (error) {
      if (error.message && (error.message.includes('relation') || error.message.includes('does not exist'))) {
        console.warn('Supabase categories table not found, fallback to localStorage.');
        return null;
      }
      throw error;
    }
    return data.map((item: any) => item.name);
  } catch (err) {
    console.warn('Error fetching categories from Supabase:', err);
    return null;
  }
}

export async function upsertCategoryInDB(id: string, name: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('categories')
      .upsert({ id, name });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error upserting category in Supabase:', err);
    return false;
  }
}

export async function deleteCategoryFromDB(name: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('name', name);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting category from Supabase:', err);
    return false;
  }
}

export async function syncCategoriesInDB(categories: string[]): Promise<boolean> {
  if (!supabase) return false;
  try {
    // 1. Delete all existing categories to prevent unique constraint crashes
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .neq('id', 'keep_none_of_them');
    
    if (deleteError) throw deleteError;

    if (categories.length === 0) return true;

    // 2. Perform bulk insert with sequential creation time to preserve ordering
    const rows = categories.map((cat, i) => {
      const timestamp = new Date();
      timestamp.setSeconds(timestamp.getSeconds() + i);
      return {
        id: `c_${i}_${Date.now()}_${encodeURIComponent(cat).slice(0, 30)}`,
        name: cat,
        created_at: timestamp.toISOString()
      };
    });

    const { error: insertError } = await supabase
      .from('categories')
      .insert(rows);

    if (insertError) throw insertError;
    return true;
  } catch (err) {
    console.error('Error in syncCategoriesInDB helper:', err);
    return false;
  }
}

