import type {
  AiFinalConfirmRequest,
  AiFinalConfirmResponse,
  AiOperationAcceptRequest,
  AiOperationEditRequest,
  AiOperationRejectRequest,
  AiProposalCreateRequest,
  AiProposalCreateResponse,
  AiProposalDetail,
  AiProposalListQuery,
  AiProposalListResponse,
  AiProposalRejectRequest,
  Identifier,
} from "@daily-assistant/api-contracts";

/**
 * GPT-frozen application boundary for the PR18 AI Proposal HTTP layer.
 *
 * This port is deliberately a pure typed boundary: it holds no Prisma, no
 * repository, no Fake Provider, no Domain Service and no state transition
 * logic. Controllers delegate to this port; the concrete application/service
 * implementation is a later PR18 work package (H03).
 */
export abstract class AiProposalApplicationPort {
  abstract create(
    userId: string,
    idempotencyKey: string,
    request: AiProposalCreateRequest,
  ): Promise<AiProposalCreateResponse>;

  abstract list(
    userId: string,
    query: AiProposalListQuery,
  ): Promise<AiProposalListResponse>;

  abstract get(
    userId: string,
    proposalId: Identifier,
  ): Promise<AiProposalDetail>;

  abstract editOperation(
    userId: string,
    proposalId: Identifier,
    operationId: Identifier,
    request: AiOperationEditRequest,
  ): Promise<AiProposalDetail>;

  abstract acceptOperation(
    userId: string,
    proposalId: Identifier,
    operationId: Identifier,
    request: AiOperationAcceptRequest,
  ): Promise<AiProposalDetail>;

  abstract rejectOperation(
    userId: string,
    proposalId: Identifier,
    operationId: Identifier,
    request: AiOperationRejectRequest,
  ): Promise<AiProposalDetail>;

  abstract rejectProposal(
    userId: string,
    proposalId: Identifier,
    request: AiProposalRejectRequest,
  ): Promise<AiProposalDetail>;

  abstract finalConfirm(
    userId: string,
    proposalId: Identifier,
    request: AiFinalConfirmRequest,
  ): Promise<AiFinalConfirmResponse>;
}
