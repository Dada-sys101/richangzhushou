import { defineStore } from "pinia";

import {
  api,
  type DraftBatchDiscardIntentResponse,
  type DraftStatus,
  type DraftSummary,
  type TransactionDraftPayload,
} from "../api/client";

interface DraftsState {
  drafts: DraftSummary[];
  errorMessage: string | null;
  loading: boolean;
}

export const useDraftsStore = defineStore("drafts", {
  state: (): DraftsState => ({
    drafts: [],
    errorMessage: null,
    loading: false,
  }),
  getters: {
    pendingDrafts: (state) =>
      state.drafts.filter((draft) => draft.status === "PENDING"),
  },
  actions: {
    async loadDrafts(status?: DraftStatus) {
      this.loading = true;
      this.errorMessage = null;
      try {
        const result = await api.listDrafts(status ? { status } : {});
        this.drafts = result.items;
      } catch (error) {
        this.errorMessage = messageOf(error);
      } finally {
        this.loading = false;
      }
    },
    async createTextDraft(text: string) {
      this.errorMessage = null;
      try {
        return await api.parseTextDraft(text);
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async updateDraft(
      id: string,
      payload: TransactionDraftPayload,
      version: number,
    ) {
      this.errorMessage = null;
      try {
        return await api.updateDraft(id, { payload, version });
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async confirmDraft(id: string) {
      this.errorMessage = null;
      try {
        return await api.confirmDraft(id);
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async discardDraft(id: string) {
      this.errorMessage = null;
      try {
        await api.discardDraft(id);
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async createBatchDiscard(
      ids: string[] | undefined,
      reason: string,
    ): Promise<DraftBatchDiscardIntentResponse> {
      this.errorMessage = null;
      try {
        return await api.createBatchDiscard(ids ? { ids, reason } : { reason });
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    async confirmBatchDiscard(confirmationToken: string) {
      this.errorMessage = null;
      try {
        return await api.confirmBatchDiscard({ confirmationToken });
      } catch (error) {
        this.errorMessage = messageOf(error);
        throw error;
      }
    },
    clearError() {
      this.errorMessage = null;
    },
  },
});

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
