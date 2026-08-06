import { defineStore } from "pinia";

import {
  api,
  isOfflineError,
  setAccessToken,
  type AuthSessionResponse,
  type UserSummary,
} from "../api/client";
import { getLastUserId, hasAnyLocalData, resetUserData } from "../offline/sync";

interface AuthState {
  accessToken: string | null;
  expiresAt: number;
  mustChangePassword: boolean;
  offlineMode: boolean;
  offlineUserId: string | null;
  user: UserSummary | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    accessToken: null,
    expiresAt: 0,
    mustChangePassword: false,
    offlineMode: false,
    offlineUserId: null,
    user: null,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken) || state.offlineMode,
    userId: (state) => state.user?.id ?? state.offlineUserId ?? null,
  },
  actions: {
    applySession(session: AuthSessionResponse) {
      setAccessToken(session.accessToken);
      this.accessToken = session.accessToken;
      this.expiresAt = Date.now() + session.expiresIn * 1000;
      this.mustChangePassword = session.mustChangePassword;
      this.offlineMode = false;
      this.offlineUserId = null;
      this.user = session.user;
    },
    clear() {
      setAccessToken(null);
      this.accessToken = null;
      this.expiresAt = 0;
      this.mustChangePassword = false;
      this.offlineMode = false;
      this.offlineUserId = null;
      if (this.user) {
        void resetUserData(this.user.id);
      }
      this.user = null;
    },
    async enterOfflineMode(): Promise<boolean> {
      if (this.offlineMode) {
        return true;
      }
      const userId = await getLastUserId();
      if (!userId || !(await hasAnyLocalData())) {
        return false;
      }
      this.offlineMode = true;
      this.offlineUserId = userId;
      return true;
    },
    exitOfflineMode() {
      this.offlineMode = false;
      this.offlineUserId = null;
    },
    async login(username: string, password: string) {
      this.applySession(await api.login({ password, username }));
    },
    async changePassword(currentPassword: string, newPassword: string) {
      await api.changePassword({ currentPassword, newPassword });
      this.mustChangePassword = false;
    },
    async refresh() {
      try {
        this.applySession(await api.refresh());
      } catch (error) {
        if (!isOfflineError(error)) {
          throw error;
        }
        const entered = await this.enterOfflineMode();
        if (!entered) {
          throw error;
        }
      }
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
