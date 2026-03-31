import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: any | null;
  role: string | null;
  orgId: string | null;
  isLoading: boolean;
  login: (user: any, role: string, orgId: string) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  orgId: null,
  isLoading: true,

  login: (user, role, orgId) => set({ user, role, orgId, isLoading: false }),

  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('sb-access-token');
    set({ user: null, role: null, orgId: null, isLoading: false });
  },

  checkSession: async () => {
    try {
      set({ isLoading: true });
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        set({ user: null, role: null, isLoading: false });
        return;
      }

      // Save token for axios
      localStorage.setItem('sb-access-token', session.access_token);

      // Verify role from public.usuarios
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('rol, organizacion_id')
        .eq('id', session.user.id)
        .single();

      if (userError || !userData) {
        set({ user: null, role: null, isLoading: false });
        return;
      }

      set({ 
        user: session.user, 
        role: userData.rol, 
        orgId: userData.organizacion_id,
        isLoading: false 
      });

    } catch (err) {
      set({ user: null, role: null, orgId: null, isLoading: false });
    }
  }
}));
