import { create } from 'zustand';
import type { ApiClient } from '@/api/client';
import type { MeResponse } from '@/api/types';
import type { Role } from '@/lib/permissions';

interface AppState {
  client: ApiClient | null;
  isMock: boolean;
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  setClient: (client: ApiClient, isMock: boolean) => void;
  setMe: (me: MeResponse | null) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  currentRole: () => Role | null;
}

export const useAppStore = create<AppState>((set, get) => ({
  client: null,
  isMock: false,
  me: null,
  loading: true,
  error: null,
  setClient: (client, isMock) => set({ client, isMock }),
  setMe: (me) => set({ me }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  currentRole: () => get().me?.membership?.role ?? null,
}));
