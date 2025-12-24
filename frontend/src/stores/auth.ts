import { defineStore } from "pinia";
import { api, type AuthResponse, type LoginPayload, type RegisterPayload, type User } from "../services/api";

type State = {
  user: User | null;
  token: string | null;
};

const STORAGE_KEY = "logisim-auth";

function loadPersisted(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw);
    return { user: parsed.user ?? null, token: parsed.token ?? null };
  } catch {
    return { user: null, token: null };
  }
}

export const useAuthStore = defineStore("auth", {
  state: (): State => ({
    user: loadPersisted().user,
    token: loadPersisted().token,
  }),
  getters: {
    isLoggedIn: (state) => !!state.user,
    role: (state) => state.user?.user_class,
  },
  actions: {
    persist(auth: AuthResponse) {
      this.user = auth.user;
      this.token = auth.token;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    },
    logout() {
      this.user = null;
      this.token = null;
      localStorage.removeItem(STORAGE_KEY);
    },
    async login(payload: LoginPayload) {
      const res = await api.login(payload);
      this.persist(res);
      return res.user;
    },
    async register(payload: RegisterPayload) {
      const res = await api.register(payload);
      this.persist(res);
      return res.user;
    },
    setUser(user: User) {
      this.user = user;
      if (this.token) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token: this.token }));
      }

    },
  },
});

