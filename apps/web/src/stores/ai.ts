import { defineStore } from "pinia";

import {
  api,
  ApiClientError,
  type AiFinalConfirmRequest,
  type AiOperationEditRequest,
  type AiProposalCreateRequest,
  type AiProposalCreateResponse,
  type AiProposalDetail,
} from "../api/client";

export type AiProposalLoadMode = "NORMAL" | "AUTHORITATIVE_RECOVERY";

interface AiState {
  activeLoadTargetId: string | null;
  errorMessage: string | null;
  errorKind:
    "CONFLICT" | "NOT_FOUND" | "STATE_CHANGED" | "REQUEST_FAILED" | null;
  loading: boolean;
  authoritativeRefreshPending: boolean;
  authoritativeRefreshRequired: boolean;
  loadGeneration: number;
  proposal: AiProposalDetail | null;
  saving: boolean;
}

export const useAiStore = defineStore("ai", {
  state: (): AiState => ({
    activeLoadTargetId: null,
    errorMessage: null,
    errorKind: null,
    loading: false,
    authoritativeRefreshPending: false,
    authoritativeRefreshRequired: false,
    loadGeneration: 0,
    proposal: null,
    saving: false,
  }),
  actions: {
    clearError() {
      this.errorMessage = null;
      this.errorKind = null;
    },
    setProposal(proposal: AiProposalDetail) {
      this.proposal = proposal;
      this.errorMessage = null;
      this.errorKind = null;
    },
    async createProposal(
      request: AiProposalCreateRequest,
      idempotencyKey: string,
    ): Promise<AiProposalCreateResponse> {
      this.clearError();
      try {
        const response = await api.createAiProposal(request, idempotencyKey);
        this.loadGeneration += 1;
        this.activeLoadTargetId = response.proposal.id;
        this.proposal = response.proposal;
        this.loading = false;
        this.authoritativeRefreshPending = false;
        this.authoritativeRefreshRequired = false;
        return response;
      } catch (error) {
        this.applyError(error);
        throw error;
      }
    },
    async getProposal(
      proposalId: string,
      mode: AiProposalLoadMode = "NORMAL",
    ): Promise<AiProposalDetail | null> {
      const generation = this.loadGeneration + 1;
      this.loadGeneration = generation;
      this.activeLoadTargetId = proposalId;
      this.authoritativeRefreshPending = true;
      this.authoritativeRefreshRequired =
        mode === "AUTHORITATIVE_RECOVERY" || this.proposal !== null;
      this.loading = true;
      this.clearError();
      try {
        const proposal = await api.getAiProposal(proposalId);
        if (!this.isCurrentProposalLoad(generation, proposalId)) {
          return null;
        }
        if (proposal.id !== proposalId) {
          throw new Error("Proposal response does not match the requested ID");
        }
        this.proposal = proposal;
        this.authoritativeRefreshRequired = false;
        return proposal;
      } catch (error) {
        if (!this.isCurrentProposalLoad(generation, proposalId)) {
          return null;
        }
        this.applyError(error);
        throw error;
      } finally {
        if (this.isCurrentProposalLoad(generation, proposalId)) {
          this.loading = false;
          this.authoritativeRefreshPending = false;
        }
      }
    },
    canMutateProposal(proposalId: string): boolean {
      return Boolean(
        this.proposal?.id === proposalId &&
        !this.authoritativeRefreshPending &&
        !this.authoritativeRefreshRequired,
      );
    },
    async editOperation(
      proposalId: string,
      operationId: string,
      request: AiOperationEditRequest,
    ): Promise<AiProposalDetail | null> {
      return this.runMutation(proposalId, async () => {
        const proposal = await api.editAiOperation(
          proposalId,
          operationId,
          request,
        );
        if (this.canMutateProposal(proposalId)) {
          this.setProposal(proposal);
        }
        return proposal;
      });
    },
    async acceptOperation(
      proposalId: string,
      operationId: string,
      version: number,
    ): Promise<AiProposalDetail | null> {
      return this.runMutation(proposalId, async () => {
        const proposal = await api.acceptAiOperation(proposalId, operationId, {
          version,
        });
        if (this.canMutateProposal(proposalId)) {
          this.setProposal(proposal);
        }
        return proposal;
      });
    },
    async rejectOperation(
      proposalId: string,
      operationId: string,
      version: number,
    ): Promise<AiProposalDetail | null> {
      return this.runMutation(proposalId, async () => {
        const proposal = await api.rejectAiOperation(proposalId, operationId, {
          version,
        });
        if (this.canMutateProposal(proposalId)) {
          this.setProposal(proposal);
        }
        return proposal;
      });
    },
    async rejectProposal(
      proposalId: string,
      version: number,
    ): Promise<AiProposalDetail | null> {
      return this.runMutation(proposalId, async () => {
        const proposal = await api.rejectAiProposal(proposalId, { version });
        if (this.canMutateProposal(proposalId)) {
          this.setProposal(proposal);
        }
        return proposal;
      });
    },
    async finalConfirm(
      proposalId: string,
      request: AiFinalConfirmRequest,
    ): Promise<AiProposalDetail | null> {
      return this.runMutation(proposalId, async () => {
        const proposal = await api.finalConfirmAiProposal(proposalId, request);
        if (this.canMutateProposal(proposalId)) {
          this.setProposal(proposal);
        }
        return proposal;
      });
    },
    async runMutation<T>(
      proposalId: string,
      mutation: () => Promise<T>,
    ): Promise<T | null> {
      if (!this.canMutateProposal(proposalId)) {
        return null;
      }
      this.saving = true;
      this.clearError();
      try {
        return await mutation();
      } catch (error) {
        if (this.canMutateProposal(proposalId)) {
          this.applyError(error);
        }
        throw error;
      } finally {
        this.saving = false;
      }
    },
    isCurrentProposalLoad(generation: number, proposalId: string): boolean {
      return (
        this.loadGeneration === generation &&
        this.activeLoadTargetId === proposalId
      );
    },
    applyError(error: unknown) {
      if (error instanceof ApiClientError) {
        this.errorMessage = error.message;
        if (error.code === "VERSION_CONFLICT") {
          this.errorKind = "CONFLICT";
        } else if (error.code === "AI_PROPOSAL_NOT_FOUND") {
          this.errorKind = "NOT_FOUND";
        } else if (
          error.code === "AI_OPERATION_INVALID_STATE" ||
          error.code === "AI_PROPOSAL_INVALID_STATE"
        ) {
          this.errorKind = "STATE_CHANGED";
        } else {
          this.errorKind = "REQUEST_FAILED";
        }
      } else {
        this.errorMessage =
          error instanceof Error ? error.message : "操作失败，请稍后重试";
        this.errorKind = "REQUEST_FAILED";
      }
    },
  },
});
