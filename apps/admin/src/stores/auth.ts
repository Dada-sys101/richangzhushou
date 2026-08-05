import { defineStore } from "pinia";

import {
  adminApi,
  setAccessToken,
  type AdminUserSummary,
  type AuthSessionResponse,
} from "../api/client";

interface AuthState {
  accessToken: string | null;
  expiresAt: number;
  user: AdminUserSummary | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    accessToken: null,
    expiresAt: 0,
    user: null,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken),
  },
  actions: {
    applySession(session: AuthSessionResponse) {
      setAccessToken(session.accessToken);
      this.accessToken = session.accessToken;
      this.expiresAt = Date.now() + session.expiresIn * 1000;
      this.user = session.user;
    },
    clear() {
      setAccessToken(null);
      this.accessToken = null;
      this.expiresAt = 0;
      this.user = null;
    },
    async login(email: string, password: string) {
      this.applySession(await adminApi.login(email, password));
    },
    async refresh() {
      this.applySession(await adminApi.refresh());
    },
    async logout() {
      try {
        await adminApi.logout();
      } finally {
        this.clear();
      }
    },
  },
});
