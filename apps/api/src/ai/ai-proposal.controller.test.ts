import { describe, expect, it, vi } from "vitest";

import { ApiException } from "../common/api-error.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { AiProposalApplicationPort } from "./ai-proposal.application-port.js";
import { AiProposalController } from "./ai-proposal.controller.js";
import {
  AiFinalConfirmDto,
  AiOperationAcceptDto,
  AiOperationEditDto,
  AiOperationRejectDto,
  AiProposalCreateDto,
  AiProposalListQueryDto,
  AiProposalRejectDto,
} from "./dto/ai-proposal.dto.js";

class MockApplicationPort extends AiProposalApplicationPort {
  create = vi.fn();
  list = vi.fn();
  get = vi.fn();
  editOperation = vi.fn();
  acceptOperation = vi.fn();
  rejectOperation = vi.fn();
  rejectProposal = vi.fn();
  finalConfirm = vi.fn();
}

function buildRequest(userId = "user_1"): AuthenticatedRequest {
  return {
    requestId: "req_test_1",
    user: {
      mustChangePassword: false,
      role: "USER",
      sessionId: "session_1",
      status: "ACTIVE",
      userId,
      username: "alice",
    },
  } as AuthenticatedRequest;
}

function buildCreateDto(): AiProposalCreateDto {
  const dto = new AiProposalCreateDto();
  dto.userInput = "明天下午三点和产品团队开会";
  dto.requestType = "CALENDAR_EVENT";
  dto.locale = "zh-CN";
  dto.timeZoneId = "Asia/Shanghai";
  dto.currentDateTime = "2026-08-14T00:00:00.000Z";
  dto.currency = "CNY";
  dto.allowedCategoryLabels = ["工作"];
  dto.explicitSelectedContext = [];
  return dto;
}

describe("PR18 AI Proposal controller", () => {
  it("CTRL-01: create delegates the authenticated userId", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const request = buildRequest("user_42");

    controller.create(request, "req-key-1234567890", buildCreateDto());

    expect(port.create).toHaveBeenCalledWith(
      "user_42",
      "req-key-1234567890",
      expect.any(AiProposalCreateDto),
    );
  });

  it("CTRL-02: create forwards the Idempotency-Key header", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);

    controller.create(
      buildRequest(),
      "req-key-abcdef0123456789",
      buildCreateDto(),
    );

    expect(port.create).toHaveBeenCalledWith(
      "user_1",
      "req-key-abcdef0123456789",
      expect.any(AiProposalCreateDto),
    );
  });

  it("CTRL-03: create throws VALIDATION_ERROR when Idempotency-Key is missing", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);

    expect(() =>
      controller.create(buildRequest(), undefined, buildCreateDto()),
    ).toThrow(ApiException);

    try {
      controller.create(buildRequest(), undefined, buildCreateDto());
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      const apiError = error as ApiException;
      expect(apiError.code).toBe("VALIDATION_ERROR");
      expect(apiError.statusCode).toBe(400);
    }

    expect(port.create).not.toHaveBeenCalled();
  });

  it("CTRL-03a: create throws VALIDATION_ERROR for a 15-character Idempotency-Key", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const shortKey = "req-key-1234567"; // length 15 < 16

    try {
      controller.create(buildRequest(), shortKey, buildCreateDto());
      expect.unreachable("expected a VALIDATION_ERROR to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      const apiError = error as ApiException;
      expect(apiError.code).toBe("VALIDATION_ERROR");
      expect(apiError.statusCode).toBe(400);
    }

    expect(port.create).not.toHaveBeenCalled();
  });

  it("CTRL-03b: create throws VALIDATION_ERROR for a 129-character Idempotency-Key", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const longKey = "k".repeat(129); // length 129 > 128

    try {
      controller.create(buildRequest(), longKey, buildCreateDto());
      expect.unreachable("expected a VALIDATION_ERROR to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      const apiError = error as ApiException;
      expect(apiError.code).toBe("VALIDATION_ERROR");
      expect(apiError.statusCode).toBe(400);
    }

    expect(port.create).not.toHaveBeenCalled();
  });

  it("CTRL-03c: accepts a 16-character Idempotency-Key and delegates", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const key16 = "req-key-12345678"; // length 16 == minLength

    controller.create(buildRequest(), key16, buildCreateDto());

    expect(port.create).toHaveBeenCalledTimes(1);
    expect(port.create).toHaveBeenCalledWith(
      "user_1",
      key16,
      expect.any(AiProposalCreateDto),
    );
  });

  it("CTRL-03d: accepts a 128-character Idempotency-Key and delegates", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const key128 = "k".repeat(128); // length 128 == maxLength

    controller.create(buildRequest(), key128, buildCreateDto());

    expect(port.create).toHaveBeenCalledTimes(1);
    expect(port.create).toHaveBeenCalledWith(
      "user_1",
      key128,
      expect.any(AiProposalCreateDto),
    );
  });

  it("CTRL-04: idempotencyKey never appears in the request body", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const dto = buildCreateDto();

    controller.create(buildRequest(), "req-key-1234567890", dto);

    const passedBody = port.create.mock.calls[0]?.[2];
    expect(passedBody).toBe(dto);
    expect("idempotencyKey" in dto).toBe(false);
    expect("history" in dto).toBe(false);
  });

  it("CTRL-05: list delegates userId and query", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const query = new AiProposalListQueryDto();
    query.unfinished = true;

    controller.list(buildRequest("user_9"), query);

    expect(port.list).toHaveBeenCalledWith("user_9", query);
  });

  it("CTRL-06: get delegates userId and proposalId", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);

    controller.get(buildRequest("user_9"), "proposal_7");

    expect(port.get).toHaveBeenCalledWith("user_9", "proposal_7");
  });

  it("CTRL-07: edit delegates userId, proposalId, operationId and DTO", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const dto = new AiOperationEditDto();
    dto.version = 2;
    dto.fields = { title: "Updated" };

    controller.editOperation(
      buildRequest("user_9"),
      "proposal_7",
      "operation_3",
      dto,
    );

    expect(port.editOperation).toHaveBeenCalledWith(
      "user_9",
      "proposal_7",
      "operation_3",
      dto,
    );
  });

  it("CTRL-08: accept delegates correctly", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const dto = new AiOperationAcceptDto();
    dto.version = 2;

    controller.acceptOperation(
      buildRequest("user_9"),
      "proposal_7",
      "operation_3",
      dto,
    );

    expect(port.acceptOperation).toHaveBeenCalledWith(
      "user_9",
      "proposal_7",
      "operation_3",
      dto,
    );
  });

  it("CTRL-09: reject operation delegates correctly", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const dto = new AiOperationRejectDto();
    dto.version = 2;

    controller.rejectOperation(
      buildRequest("user_9"),
      "proposal_7",
      "operation_3",
      dto,
    );

    expect(port.rejectOperation).toHaveBeenCalledWith(
      "user_9",
      "proposal_7",
      "operation_3",
      dto,
    );
  });

  it("CTRL-10: reject proposal delegates correctly", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const dto = new AiProposalRejectDto();
    dto.version = 2;

    controller.rejectProposal(buildRequest("user_9"), "proposal_7", dto);

    expect(port.rejectProposal).toHaveBeenCalledWith(
      "user_9",
      "proposal_7",
      dto,
    );
  });

  it("CTRL-11: finalConfirm is an independent method / delegate", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const dto = new AiFinalConfirmDto();
    dto.version = 2;
    dto.operationIds = ["operation_1"];

    controller.finalConfirm(buildRequest("user_9"), "proposal_7", dto);

    expect(port.finalConfirm).toHaveBeenCalledWith("user_9", "proposal_7", dto);
  });

  it("CTRL-12: accept never calls finalConfirm", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const dto = new AiOperationAcceptDto();
    dto.version = 2;

    controller.acceptOperation(
      buildRequest(),
      "proposal_7",
      "operation_3",
      dto,
    );

    expect(port.acceptOperation).toHaveBeenCalledTimes(1);
    expect(port.finalConfirm).not.toHaveBeenCalled();
    expect(port.rejectOperation).not.toHaveBeenCalled();
    expect(port.rejectProposal).not.toHaveBeenCalled();
  });

  it("CTRL-13: finalConfirm never implicitly calls accept", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);
    const dto = new AiFinalConfirmDto();
    dto.version = 2;
    dto.operationIds = ["operation_1"];

    controller.finalConfirm(buildRequest(), "proposal_7", dto);

    expect(port.finalConfirm).toHaveBeenCalledTimes(1);
    expect(port.acceptOperation).not.toHaveBeenCalled();
    expect(port.rejectOperation).not.toHaveBeenCalled();
    expect(port.rejectProposal).not.toHaveBeenCalled();
  });

  it("CTRL-14: controller never triggers business/domain side effects", () => {
    const port = new MockApplicationPort();
    const controller = new AiProposalController(port);

    controller.create(buildRequest(), "req-key-1234567890", buildCreateDto());
    controller.list(buildRequest(), new AiProposalListQueryDto());
    controller.get(buildRequest(), "proposal_1");
    controller.editOperation(
      buildRequest(),
      "proposal_1",
      "operation_1",
      new AiOperationEditDto(),
    );
    controller.acceptOperation(
      buildRequest(),
      "proposal_1",
      "operation_1",
      new AiOperationAcceptDto(),
    );
    controller.rejectOperation(
      buildRequest(),
      "proposal_1",
      "operation_1",
      new AiOperationRejectDto(),
    );
    controller.rejectProposal(
      buildRequest(),
      "proposal_1",
      new AiProposalRejectDto(),
    );
    controller.finalConfirm(
      buildRequest(),
      "proposal_1",
      new AiFinalConfirmDto(),
    );

    // The controller must only reach the port via delegation; none of the
    // port methods performs a business write.
    for (const method of [
      "create",
      "list",
      "get",
      "editOperation",
      "acceptOperation",
      "rejectOperation",
      "rejectProposal",
      "finalConfirm",
    ] as const) {
      expect(port[method]).toHaveBeenCalled();
    }
  });
});
