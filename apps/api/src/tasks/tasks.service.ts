import { Injectable } from "@nestjs/common";
import type {
  TaskCompleteResponse,
  TaskListResponse,
  TaskSummary,
} from "@daily-assistant/api-contracts";

import {
  Prisma,
  type PrismaClient,
  type Task,
} from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toTaskSummary } from "./tasks.mapper.js";
import type {
  CreateTaskDto,
  ListTasksQueryDto,
  UpdateTaskDto,
} from "./dto/tasks.dto.js";

interface NormalizedTaskInput {
  clientMutationId: string | null;
  dueAt: Date | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  title: string;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: ListTasksQueryDto,
  ): Promise<TaskListResponse> {
    const limit = Number(query.limit ?? 50);
    const rows = await this.prisma.task.findMany({
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: query.cursor ? 1 : 0,
      take: limit + 1,
      where: {
        deletedAt: query.includeDeleted ? undefined : null,
        userId,
        ...(query.status ? { status: query.status } : {}),
      },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((row) =>
      toTaskSummary(row),
    );
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, id: string): Promise<TaskSummary> {
    const row = await this.prisma.task.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Task not found");
    }
    return toTaskSummary(row);
  }

  async create(
    userId: string,
    dto: CreateTaskDto,
    tx?: Prisma.TransactionClient,
  ): Promise<TaskSummary> {
    const db = tx ?? this.prisma;
    const input = this.normalizeInput(dto);
    if (input.clientMutationId) {
      const replayed = await this.findByIdempotencyKey(
        userId,
        input.clientMutationId,
        db,
      );
      if (replayed) {
        this.assertSameMutation(replayed, input);
        return toTaskSummary(replayed);
      }
    }
    try {
      const row = await db.task.create({
        data: {
          clientMutationId: input.clientMutationId,
          dueAt: input.dueAt,
          priority: input.priority,
          status: "OPEN",
          title: input.title,
          userId,
          version: 1,
        },
      });
      return toTaskSummary(row);
    } catch (error) {
      if (this.isUniqueViolation(error) && input.clientMutationId) {
        const global = await db.task.findUnique({
          where: { clientMutationId: input.clientMutationId },
        });
        if (global) {
          if (global.userId !== userId) {
            throw new ApiException(
              "IDEMPOTENCY_CONFLICT",
              409,
              "clientMutationId was already used",
            );
          }
          this.assertSameMutation(global, input);
          return toTaskSummary(global);
        }
      }
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTaskDto,
  ): Promise<TaskSummary> {
    const current = await this.prisma.task.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!current) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Task not found");
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Task was modified elsewhere",
      );
    }

    const title = dto.title === undefined ? current.title : dto.title.trim();
    if (!title) {
      throw new ApiException("VALIDATION_ERROR", 400, "Task title is required");
    }
    const priority = dto.priority ?? current.priority;
    const dueAt =
      dto.dueAt === undefined ? current.dueAt : this.toNullableDate(dto.dueAt);
    const status = dto.status ?? current.status;
    const transition = this.applyStatusTransition(current, status);

    const updated = await this.prisma.task.updateMany({
      data: {
        cancelledAt: transition.cancelledAt,
        completedAt: transition.completedAt,
        dueAt,
        priority,
        status,
        title,
        version: { increment: 1 },
      },
      where: { id, userId, version: current.version },
    });
    if (updated.count === 0) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Task was modified elsewhere",
      );
    }
    const row = await this.prisma.task.findFirstOrThrow({
      where: { id, userId },
    });
    return toTaskSummary(row);
  }

  async complete(userId: string, id: string): Promise<TaskCompleteResponse> {
    const now = new Date();
    const result = await this.prisma.task.updateMany({
      data: {
        completedAt: now,
        status: "COMPLETED",
        version: { increment: 1 },
      },
      where: { deletedAt: null, id, status: "OPEN", userId },
    });
    if (result.count === 0) {
      const existing = await this.prisma.task.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        throw new ApiException("RESOURCE_NOT_FOUND", 404, "Task not found");
      }
      throw new ApiException(
        "INVALID_STATE",
        409,
        "Only OPEN tasks can be completed",
      );
    }
    const row = await this.prisma.task.findFirstOrThrow({
      where: { id, userId },
    });
    return { task: toTaskSummary(row) };
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const result = await this.prisma.task.updateMany({
      data: { deletedAt: new Date(), version: { increment: 1 } },
      where: { id, userId, deletedAt: null },
    });
    if (result.count === 0) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Task not found");
    }
  }

  async restore(userId: string, id: string): Promise<TaskSummary> {
    const result = await this.prisma.task.updateMany({
      data: { deletedAt: null, version: { increment: 1 } },
      where: { id, userId, deletedAt: { not: null } },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Deleted task not found",
      );
    }
    const row = await this.prisma.task.findFirstOrThrow({
      where: { id, userId },
    });
    return toTaskSummary(row);
  }

  private normalizeInput(dto: CreateTaskDto): NormalizedTaskInput {
    const title = dto.title.trim();
    if (!title) {
      throw new ApiException("VALIDATION_ERROR", 400, "Task title is required");
    }
    return {
      clientMutationId: dto.clientMutationId ?? null,
      dueAt: dto.dueAt === undefined ? null : this.toNullableDate(dto.dueAt),
      priority: dto.priority ?? "MEDIUM",
      title,
    };
  }

  private applyStatusTransition(
    current: Task,
    status: "OPEN" | "COMPLETED" | "CANCELLED",
  ): { cancelledAt: Date | null; completedAt: Date | null } {
    if (status === current.status) {
      return {
        cancelledAt: current.cancelledAt,
        completedAt: current.completedAt,
      };
    }
    if (current.status !== "OPEN") {
      throw new ApiException(
        "INVALID_STATE",
        409,
        "Only OPEN tasks can change status",
      );
    }
    const now = new Date();
    return {
      cancelledAt: status === "CANCELLED" ? now : null,
      completedAt: status === "COMPLETED" ? now : null,
    };
  }

  private async findByIdempotencyKey(
    userId: string,
    clientMutationId: string,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<Task | null> {
    return db.task.findFirst({
      where: { clientMutationId, userId },
    });
  }

  private assertSameMutation(existing: Task, input: NormalizedTaskInput): void {
    const same =
      existing.title === input.title &&
      existing.priority === input.priority &&
      (existing.dueAt?.getTime() ?? null) === (input.dueAt?.getTime() ?? null);
    if (!same) {
      throw new ApiException(
        "IDEMPOTENCY_CONFLICT",
        409,
        "clientMutationId was already used with different content",
      );
    }
  }

  private toNullableDate(value: string | null): Date | null {
    return value ? new Date(value) : null;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}
