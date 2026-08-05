import { defineStore } from "pinia";

import {
  api,
  setAccessToken,
  type AuthSessionResponse,
  type UserSummary,
} from "../api/client";

interface AuthState {
  accessToken: string | null;
  expiresAt: number;
  user: UserSummary | null;
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
      this.applySession(await api.login({ email, password }));
    },
    async register(input: {
      displayName: string;
      email: string;
      inviteCode?: string;
      password: string;
    }) {
      this.applySession(await api.register(input));
    },
    async refresh() {
      this.applySession(await api.refresh());
    },
    async logout() {
      try {
        await api.logout();
      } finally {
        this.clear();
      }
    },
    async closeAccount(password: string, reason: string) {
      await api.closeAccount({ password, reason });
      this.clear();
    },
    async requestDeletion(password: string, reason: string) {
      await api.requestDeletion({ password, reason });
      this.clear();
    },
  },
});
