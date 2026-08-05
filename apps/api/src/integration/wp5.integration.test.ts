import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import "reflect-metadata";
import { hash } from "argon2";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "../app.module.js";
import { AllExceptionsFilter } from "../common/all-exceptions.filter.js";
import { RateLimiterService } from "../common/rate-limiter.service.js";
import { requestIdMiddleware } from "../common/request-id.middleware.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { MemoryMailAdapter } from "../mail/memory-mail.adapter.js";
import { RemindersScheduler } from "../reminders/reminders.scheduler.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const TEST_PASSWORD = "UserPassword123!";
const ADMIN_PASSWORD = "AdminPassword123!";

const describeWithDb = testDatabaseUrl ? describe : describe.skip;

describeWithDb("WP5 calendar, tasks, and reminders integration", () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let userSequence = 0;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      return;
    }
    process.env.DATABASE_URL = testDatabaseUrl;
    delete process.env.FAKE_NOTIFICATION_FAIL;
    prisma = new PrismaClient({
      adapter: new PrismaMariaDb(testDatabaseUrl),
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(async () => {
    if (!prisma) {
      return;
    }
    userSequence += 1;
    delete process.env.FAKE_NOTIFICATION_FAIL;
    await resetDatabase();
    await seedAdmin();
    app.get(RateLimiterService).reset();
    app.get(MemoryMailAdapter).reset();
  });

  afterAll(async () => {
    delete process.env.FAKE_NOTIFICATION_FAIL;
    await app?.close();
    await prisma?.$disconnect();
  });

  it("QA-CAL-001: rejects end before start, warns on overlap, and validates all-day boundaries", async () => {
    const token = await loginNewUser();

    const meeting = await createEvent(token, {
      endsAt: "2026-08-10T02:00:00.000Z",
      startsAt: "2026-08-10T01:00:00.000Z",
      title: "晨会",
    });
    expect(meeting.status).toBe(201);
    expect(meeting.body.overlapWarning).toBeUndefined();

    const overlapping = await createEvent(token, {
      endsAt: "2026-08-10T02:30:00.000Z",
      startsAt: "2026-08-10T01:30:00.000Z",
      title: "重叠会议",
    });
    expect(overlapping.status).toBe(201);
    expect(overlapping.body.overlapWarning).toMatchObject({
      code: "OVERLAP_WARNING",
      conflictingEventId: meeting.body.calendarEvent.id,
    });

    const separate = await createEvent(token, {
      endsAt: "2026-08-10T04:00:00.000Z",
      startsAt: "2026-08-10T03:00:00.000Z",
      title: "下午会议",
    });
    expect(separate.body.overlapWarning).toBeUndefined();

    const invalid = await createEvent(token, {
      endsAt: "2026-08-10T01:00:00.000Z",
      startsAt: "2026-08-10T02:00:00.000Z",
      title: "时间倒置",
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");

    const badAllDay = await createEvent(token, {
      allDay: true,
      endsAt: "2026-08-10T02:00:00.000Z",
      startsAt: "2026-08-10T01:00:00.000Z",
      title: "非午夜全天",
    });
    expect(badAllDay.status).toBe(400);

    const allDay = await createEvent(token, {
      allDay: true,
      endsAt: "2026-08-10T16:00:00.000Z",
      startsAt: "2026-08-09T16:00:00.000Z",
      title: "全天日程",
    });
    expect(allDay.status).toBe(201);
    expect(allDay.body.calendarEvent.allDay).toBe(true);

    const dayList = await request(app.getHttpServer())
      .get("/api/v1/calendar-events?date=2026-08-10")
      .set("Authorization", `Bearer ${token}`);
    expect(dayList.status).toBe(200);
    expect(dayList.body.items).toHaveLength(4);
  });

  it("calendar events support idempotency, version conflicts, and soft delete/restore", async () => {
    const token = await loginNewUser();
    const body = {
      clientMutationId: "cal-mutation-key-0001",
      endsAt: "2026-08-11T02:00:00.000Z",
      startsAt: "2026-08-11T01:00:00.000Z",
      title: "评审",
    };
    const first = await createEvent(token, body);
    expect(first.status).toBe(201);
    const id = first.body.calendarEvent.id as string;

    const replay = await createEvent(token, body);
    expect(replay.status).toBe(201);
    expect(replay.body.calendarEvent.id).toBe(id);

    const conflict = await createEvent(token, { ...body, title: "改标题" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("IDEMPOTENCY_CONFLICT");

    const stale = await request(app.getHttpServer())
      .patch(`/api/v1/calendar-events/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "过期版本", version: 99 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("VERSION_CONFLICT");

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/calendar-events/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "评审（更新）", version: 1 });
    expect(updated.status).toBe(200);
    expect(updated.body.calendarEvent.title).toBe("评审（更新）");
    expect(updated.body.calendarEvent.version).toBe(2);

    await request(app.getHttpServer())
      .delete(`/api/v1/calendar-events/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
    const active = await request(app.getHttpServer())
      .get("/api/v1/calendar-events")
      .set("Authorization", `Bearer ${token}`);
    expect(active.body.items).toHaveLength(0);
    const withDeleted = await request(app.getHttpServer())
      .get("/api/v1/calendar-events?includeDeleted=true")
      .set("Authorization", `Bearer ${token}`);
    expect(withDeleted.body.items).toHaveLength(1);

    const restored = await request(app.getHttpServer())
      .post(`/api/v1/calendar-events/${id}/restore`)
      .set("Authorization", `Bearer ${token}`);
    expect(restored.status).toBe(200);
    expect(restored.body.deletedAt).toBeNull();
  });

  it("QA-TASK-001: overdue is computed and complete/cancel transitions are enforced", async () => {
    const token = await loginNewUser();

    const past = await createTask(token, {
      dueAt: "2026-08-05T04:00:00.000Z",
      title: "已过期任务",
    });
    expect(past.status).toBe(201);
    expect(past.body.overdue).toBe(true);

    const future = await createTask(token, {
      dueAt: "2026-08-20T04:00:00.000Z",
      priority: "HIGH",
      title: "未来任务",
    });
    expect(future.status).toBe(201);
    expect(future.body.overdue).toBe(false);
    expect(future.body.priority).toBe("HIGH");
    const futureId = future.body.id as string;

    const postponed = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${futureId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ dueAt: "2026-08-21T04:00:00.000Z", version: 1 });
    expect(postponed.status).toBe(200);
    expect(postponed.body.dueAt).toBe("2026-08-21T04:00:00.000Z");
    expect(postponed.body.overdue).toBe(false);

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${futureId}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(completed.status).toBe(200);
    expect(completed.body.task.status).toBe("COMPLETED");
    expect(completed.body.task.completedAt).not.toBeNull();
    expect(completed.body.task.overdue).toBe(false);

    const completeAgain = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${futureId}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(completeAgain.status).toBe(409);
    expect(completeAgain.body.code).toBe("INVALID_STATE");

    const cancelTarget = await createTask(token, { title: "取消目标" });
    const cancelTargetId = cancelTarget.body.id as string;
    const cancelled = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${cancelTargetId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "CANCELLED", version: 1 });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.cancelledAt).not.toBeNull();

    const reopenDenied = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${cancelTargetId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "COMPLETED", version: 2 });
    expect(reopenDenied.status).toBe(409);
    expect(reopenDenied.body.code).toBe("INVALID_STATE");

    const stale = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${cancelTargetId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "过期", version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("VERSION_CONFLICT");
  });

  it("reminders support schedule types, target validation, idempotency, and cancel/reactivate", async () => {
    const token = await loginNewUser();
    const futureStarts = "2026-08-06T01:00:00.000Z";

    const once = await createReminder(token, {
      scheduleType: "ONCE",
      startsAt: futureStarts,
      title: "一次性提醒",
    });
    expect(once.status).toBe(201);
    expect(once.body).toMatchObject({
      recurrence: null,
      scheduleType: "ONCE",
      scheduledAt: futureStarts,
      status: "SCHEDULED",
    });

    const daily = await createReminder(token, {
      recurrence: { interval: 1 },
      scheduleType: "DAILY",
      startsAt: futureStarts,
      title: "每日提醒",
    });
    expect(daily.status).toBe(201);
    expect(daily.body.recurrence).toEqual({ interval: 1 });

    const weekly = await createReminder(token, {
      recurrence: { interval: 2, weekdays: [1, 4] },
      scheduleType: "WEEKLY",
      startsAt: futureStarts,
      title: "每周提醒",
    });
    expect(weekly.status).toBe(201);
    expect(weekly.body.recurrence?.weekdays).toEqual([1, 4]);

    const monthly = await createReminder(token, {
      recurrence: { dayOfMonth: 31 },
      scheduleType: "MONTHLY",
      startsAt: "2026-01-31T01:00:00.000Z",
      title: "每月提醒",
    });
    expect(monthly.status).toBe(201);

    const pastOnce = await createReminder(token, {
      scheduleType: "ONCE",
      startsAt: "2026-08-01T01:00:00.000Z",
      title: "过去的一次性提醒",
    });
    expect(pastOnce.status).toBe(400);
    expect(pastOnce.body.code).toBe("VALIDATION_ERROR");

    const task = await createTask(token, { title: "关联任务" });
    const linked = await createReminder(token, {
      scheduleType: "ONCE",
      startsAt: futureStarts,
      targetId: task.body.id,
      targetType: "TASK",
      title: "任务提醒",
    });
    expect(linked.status).toBe(201);
    expect(linked.body.targetType).toBe("TASK");

    const missingTarget = await createReminder(token, {
      scheduleType: "ONCE",
      startsAt: futureStarts,
      targetType: "TASK",
      title: "缺少目标",
    });
    expect(missingTarget.status).toBe(400);

    const otherToken = await loginNewUser();
    const otherTask = await createTask(otherToken, { title: "他人任务" });
    const crossTarget = await createReminder(token, {
      scheduleType: "ONCE",
      startsAt: futureStarts,
      targetId: otherTask.body.id,
      targetType: "TASK",
      title: "跨用户目标",
    });
    expect(crossTarget.status).toBe(404);

    const idempotentBody = {
      clientMutationId: "rem-mutation-key-0001",
      scheduleType: "ONCE",
      startsAt: futureStarts,
      title: "幂等提醒",
    };
    const first = await createReminder(token, idempotentBody);
    const replay = await createReminder(token, idempotentBody);
    expect(replay.body.id).toBe(first.body.id);
    const idConflict = await createReminder(token, {
      ...idempotentBody,
      title: "不同内容",
    });
    expect(idConflict.status).toBe(409);

    const onceId = once.body.id as string;
    const cancelled = await request(app.getHttpServer())
      .patch(`/api/v1/reminders/${onceId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "CANCELLED", version: 1 });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("CANCELLED");

    const reactivated = await request(app.getHttpServer())
      .patch(`/api/v1/reminders/${onceId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "SCHEDULED", version: 2 });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.status).toBe("SCHEDULED");

    const sentStatus = await request(app.getHttpServer())
      .patch(`/api/v1/reminders/${onceId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "SENT", version: 3 });
    expect(sentStatus.status).toBe(409);
    expect(sentStatus.body.code).toBe("INVALID_STATE");
  });

  it("QA-REM-001 + scheduler: sends once, advances recurring, retries with limits, and suppresses inactive accounts", async () => {
    const token = await loginNewUser();
    const userId = await userIdOf(token);

    const once = await createReminder(token, {
      scheduleType: "ONCE",
      startsAt: "2026-08-06T01:00:00.000Z",
      title: "待发送",
    });
    const onceId = once.body.id as string;
    await prisma.reminder.update({
      data: { scheduledAt: new Date(Date.now() - 60_000) },
      where: { id: onceId },
    });

    const scheduler = app.get(RemindersScheduler);
    const firstRun = await scheduler.runDueReminders();
    expect(firstRun.delivered).toBe(1);
    const sentRow = await prisma.reminder.findUniqueOrThrow({
      where: { id: onceId },
    });
    expect(sentRow.status).toBe("SENT");
    expect(sentRow.attemptCount).toBe(1);
    expect(sentRow.sentAt).not.toBeNull();

    const secondRun = await scheduler.runDueReminders();
    expect(secondRun.delivered).toBe(0);
    expect(
      (await prisma.reminder.findUniqueOrThrow({ where: { id: onceId } }))
        .attemptCount,
    ).toBe(1);

    const daily = await createReminder(token, {
      recurrence: { interval: 1 },
      scheduleType: "DAILY",
      startsAt: "2026-08-06T01:00:00.000Z",
      title: "每日提醒",
    });
    const dailyId = daily.body.id as string;
    await prisma.reminder.update({
      data: { scheduledAt: new Date(Date.now() - 60_000) },
      where: { id: dailyId },
    });
    await scheduler.runDueReminders();
    const advanced = await prisma.reminder.findUniqueOrThrow({
      where: { id: dailyId },
    });
    expect(advanced.status).toBe("SCHEDULED");
    expect(advanced.scheduledAt.getTime()).toBeGreaterThan(Date.now());
    expect(advanced.attemptCount).toBe(1);

    const failing = await createReminder(token, {
      scheduleType: "ONCE",
      startsAt: "2026-08-07T01:00:00.000Z",
      title: "失败重试",
    });
    const failingId = failing.body.id as string;
    await prisma.reminder.update({
      data: { scheduledAt: new Date(Date.now() - 60_000) },
      where: { id: failingId },
    });
    process.env.FAKE_NOTIFICATION_FAIL = "true";
    await scheduler.runDueReminders();
    const failedOnce = await prisma.reminder.findUniqueOrThrow({
      where: { id: failingId },
    });
    expect(failedOnce.status).toBe("FAILED");
    expect(failedOnce.attemptCount).toBe(1);
    expect(failedOnce.failureReason).not.toBeNull();
    expect(failedOnce.nextAttemptAt).not.toBeNull();

    await prisma.reminder.update({
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
      where: { id: failingId },
    });
    delete process.env.FAKE_NOTIFICATION_FAIL;
    await scheduler.runDueReminders();
    const recovered = await prisma.reminder.findUniqueOrThrow({
      where: { id: failingId },
    });
    expect(recovered.status).toBe("SENT");
    expect(recovered.attemptCount).toBe(2);

    const exhaust = await createReminder(token, {
      scheduleType: "ONCE",
      startsAt: "2026-08-08T01:00:00.000Z",
      title: "达到上限",
    });
    const exhaustId = exhaust.body.id as string;
    await prisma.reminder.update({
      data: { scheduledAt: new Date(Date.now() - 60_000) },
      where: { id: exhaustId },
    });
    process.env.FAKE_NOTIFICATION_FAIL = "true";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await scheduler.runDueReminders();
      if (attempt < 2) {
        await prisma.reminder.update({
          data: { nextAttemptAt: new Date(Date.now() - 1000) },
          where: { id: exhaustId },
        });
      }
    }
    const exhausted = await prisma.reminder.findUniqueOrThrow({
      where: { id: exhaustId },
    });
    expect(exhausted.status).toBe("FAILED");
    expect(exhausted.attemptCount).toBe(3);
    expect(exhausted.nextAttemptAt).toBeNull();
    delete process.env.FAKE_NOTIFICATION_FAIL;

    const suspendedReminder = await createReminder(token, {
      scheduleType: "ONCE",
      startsAt: "2026-08-09T01:00:00.000Z",
      title: "暂停用户提醒",
    });
    const suspendedId = suspendedReminder.body.id as string;
    await prisma.reminder.update({
      data: { scheduledAt: new Date(Date.now() - 60_000) },
      where: { id: suspendedId },
    });
    await prisma.user.update({
      data: { status: "SUSPENDED" },
      where: { id: userId },
    });
    const suppressedRun = await scheduler.runDueReminders();
    expect(suppressedRun.suppressed).toBe(1);
    const suppressed = await prisma.reminder.findUniqueOrThrow({
      where: { id: suspendedId },
    });
    expect(suppressed.status).toBe("SUPPRESSED");
    expect(suppressed.suppressedAt).not.toBeNull();
    expect(suppressed.sentAt).toBeNull();
  });

  it("scheduler claims a reminder at most once under concurrent runs", async () => {
    const token = await loginNewUser();
    const reminder = await createReminder(token, {
      scheduleType: "ONCE",
      startsAt: "2026-08-06T01:00:00.000Z",
      title: "并发提醒",
    });
    const reminderId = reminder.body.id as string;
    await prisma.reminder.update({
      data: { scheduledAt: new Date(Date.now() - 60_000) },
      where: { id: reminderId },
    });

    const scheduler = app.get(RemindersScheduler);
    const results = await Promise.all([
      scheduler.runDueReminders(),
      scheduler.runDueReminders(),
    ]);
    const delivered = results.reduce((sum, item) => sum + item.delivered, 0);
    expect(delivered).toBe(1);
    const row = await prisma.reminder.findUniqueOrThrow({
      where: { id: reminderId },
    });
    expect(row.status).toBe("SENT");
    expect(row.attemptCount).toBe(1);
  });

  it("QA-SEC-001/002 extension: cross-user access is 404 and admins get 403", async () => {
    const aToken = await loginNewUser();
    const bToken = await loginNewUser();

    const bEvent = await createEvent(bToken, {
      endsAt: "2026-08-12T02:00:00.000Z",
      startsAt: "2026-08-12T01:00:00.000Z",
      title: "B 的日程",
    });
    const bTask = await createTask(bToken, { title: "B 的任务" });
    const bReminder = await createReminder(bToken, {
      scheduleType: "ONCE",
      startsAt: "2026-08-13T01:00:00.000Z",
      title: "B 的提醒",
    });

    const eventId = bEvent.body.calendarEvent.id as string;
    const taskId = bTask.body.id as string;
    const reminderId = bReminder.body.id as string;
    const checks = [
      ["GET", `/api/v1/calendar-events/${eventId}`],
      ["PATCH", `/api/v1/calendar-events/${eventId}`],
      ["DELETE", `/api/v1/calendar-events/${eventId}`],
      ["POST", `/api/v1/calendar-events/${eventId}/restore`],
      ["GET", `/api/v1/tasks/${taskId}`],
      ["PATCH", `/api/v1/tasks/${taskId}`],
      ["DELETE", `/api/v1/tasks/${taskId}`],
      ["POST", `/api/v1/tasks/${taskId}/restore`],
      ["POST", `/api/v1/tasks/${taskId}/complete`],
      ["GET", `/api/v1/reminders/${reminderId}`],
      ["PATCH", `/api/v1/reminders/${reminderId}`],
      ["DELETE", `/api/v1/reminders/${reminderId}`],
      ["POST", `/api/v1/reminders/${reminderId}/restore`],
    ] as const;
    for (const [method, path] of checks) {
      const response = await sendWithAuth(method, path, aToken, { version: 1 });
      expect(response.status).toBe(404);
    }

    const admin = await login("admin@example.com", ADMIN_PASSWORD);
    for (const path of [
      "/api/v1/calendar-events",
      "/api/v1/tasks",
      "/api/v1/reminders",
    ]) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set("Authorization", `Bearer ${admin.accessToken}`);
      expect(response.status).toBe(403);
    }
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ title: "管理员任务" });
    expect(createResponse.status).toBe(403);
  });

  async function resetDatabase(): Promise<void> {
    await prisma.reminder.deleteMany();
    await prisma.task.deleteMany();
    await prisma.calendarEvent.deleteMany();
    await prisma.draftRecord.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.deviceCredential.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.financialAccount.deleteMany();
    await prisma.category.deleteMany();
    await prisma.inviteRedemption.deleteMany();
    await prisma.recoveryCode.deleteMany();
    await prisma.session.deleteMany();
    await prisma.adminAudit.deleteMany();
    await prisma.inviteCode.deleteMany();
    await prisma.user.deleteMany();
    await prisma.systemSetting.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        inviteRequired: true,
        maxActiveUsers: 20,
        registrationEnabled: true,
      },
      update: {
        inviteRequired: true,
        maxActiveUsers: 20,
        registrationEnabled: true,
      },
    });
  }

  async function seedAdmin(): Promise<void> {
    const passwordHash = await hash(ADMIN_PASSWORD, { type: 2 });
    await prisma.user.create({
      data: {
        displayName: "Admin",
        email: "admin@example.com",
        normalizedEmail: "admin@example.com",
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  }

  async function loginNewUser(): Promise<string> {
    const email = `wp5-${userSequence}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    const passwordHash = await hash(TEST_PASSWORD, { type: 2 });
    await prisma.user.create({
      data: {
        displayName: "Planner User",
        email,
        normalizedEmail: email,
        passwordHash,
        role: "USER",
        status: "ACTIVE",
      },
    });
    return login(email, TEST_PASSWORD).then((result) => result.accessToken);
  }

  async function userIdOf(accessToken: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`);
    return response.body.id as string;
  }

  async function login(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password });
    expect(response.status).toBe(200);
    return {
      accessToken: response.body.accessToken as string,
      cookie: getRefreshCookieHeader(response.headers["set-cookie"]),
    };
  }

  function createEvent(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post("/api/v1/calendar-events")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function createTask(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function createReminder(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  async function sendWithAuth(
    method: "DELETE" | "GET" | "PATCH" | "POST",
    path: string,
    token: string,
    body?: unknown,
  ) {
    const agent = request(app.getHttpServer());
    const call =
      method === "GET"
        ? agent.get(path)
        : method === "PATCH"
          ? agent.patch(path)
          : method === "DELETE"
            ? agent.delete(path)
            : agent.post(path);
    return call.set("Authorization", `Bearer ${token}`).send(body ?? {});
  }

  function getRefreshCookieHeader(
    setCookie: string | string[] | undefined,
  ): string {
    const cookie = Array.isArray(setCookie)
      ? (setCookie[0] ?? "")
      : (setCookie ?? "");
    const match = /^da_refresh=([^;]+)/.exec(cookie);
    return match?.[1] ? `da_refresh=${match[1]}` : "";
  }

  function configureApp(app: INestApplication): void {
    app.setGlobalPrefix("/api/v1");
    app.use(cookieParser());
    app.use(requestIdMiddleware);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
  }
});
