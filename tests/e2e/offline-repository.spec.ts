import { expect, test } from "@playwright/test";

import {
  createActiveUserViaApi,
  E2E_ACTIVE_PASSWORD,
  loginViaUi,
  navLink,
  uniqueName,
} from "./helpers/e2e";

interface ApiSession {
  accessToken: string;
  user: { id: string };
}

interface ApiTask {
  id: string;
  title: string;
}

interface TaskListResponse {
  items: ApiTask[];
}

test("V1PlainRepository preserves IndexedDB v1 parity across reload", async ({
  page,
}) => {
  await page.goto("/");

  const initial = await page.evaluate(async () => {
    const { defaultRepository } =
      await import("/src/offline/repository-instance.ts");
    const now = "2026-08-13T00:00:00.000Z";
    await defaultRepository.clearUserData("pr9-user-a");
    await defaultRepository.clearUserData("pr9-user-b");
    await defaultRepository.entityPut("pr9-user-a", "TASK", {
      data: { id: "same-id", title: "first" },
      entityType: "TASK",
      id: "same-id",
      pending: false,
      updatedAt: now,
      userId: "pr9-user-a",
    });
    await defaultRepository.entityPut("pr9-user-a", "TASK", {
      data: { id: "same-id", title: "upserted" },
      entityType: "TASK",
      id: "same-id",
      pending: true,
      updatedAt: now,
      userId: "pr9-user-a",
    });
    await defaultRepository.entityPut("pr9-user-b", "TASK", {
      data: { id: "same-id", title: "isolated" },
      entityType: "TASK",
      id: "same-id",
      pending: false,
      updatedAt: now,
      userId: "pr9-user-b",
    });
    for (const [id, createdAt] of [
      ["later", 2],
      ["earlier", 1],
    ] as const) {
      await defaultRepository.pendingPut("pr9-user-a", {
        action: "UPDATE",
        createdAt,
        current: null,
        entityId: "same-id",
        entityType: "TASK",
        errorCode: null,
        errorMessage: null,
        id,
        localId: null,
        payload: {},
        status: "PENDING",
        userId: "pr9-user-a",
        version: 1,
      });
    }
    return {
      global: await defaultRepository.hasAnyStoredData(),
      isolated: (await defaultRepository.entityList("pr9-user-b", "TASK")).map(
        (row) => row.data.title,
      ),
      missing: await defaultRepository.entityGet(
        "pr9-user-a",
        "TASK",
        "missing",
      ),
      ordered: (await defaultRepository.pendingList("pr9-user-a")).map(
        (row) => row.id,
      ),
      upserted: (
        await defaultRepository.entityGet("pr9-user-a", "TASK", "same-id")
      )?.data.title,
    };
  });

  expect(initial).toEqual({
    global: true,
    isolated: ["isolated"],
    missing: null,
    ordered: ["earlier", "later"],
    upserted: "upserted",
  });

  await page.evaluate(() => history.pushState({}, "", "/pr9-repository-check"));
  await page.goBack();
  expect(new URL(page.url()).pathname).toBe("/");

  await page.reload();
  const afterReload = await page.evaluate(async () => {
    const { defaultRepository } =
      await import("/src/offline/repository-instance.ts");
    const row = await defaultRepository.entityGet(
      "pr9-user-a",
      "TASK",
      "same-id",
    );
    await defaultRepository.pendingUpdate("pr9-user-a", "earlier", {
      status: "FAILED",
    });
    const updated = await defaultRepository.pendingGet("pr9-user-a", "earlier");
    await defaultRepository.pendingDelete("pr9-user-a", "later");
    await defaultRepository.clearUserData("pr9-user-a");
    return {
      cleanedEntities: await defaultRepository.entityList("pr9-user-a", "TASK"),
      cleanedPending: await defaultRepository.pendingList("pr9-user-a"),
      otherUser: (
        await defaultRepository.entityGet("pr9-user-b", "TASK", "same-id")
      )?.data.title,
      persisted: row?.data.title,
      updatedStatus: updated?.status,
    };
  });

  expect(afterReload).toEqual({
    cleanedEntities: [],
    cleanedPending: [],
    otherUser: "isolated",
    persisted: "upserted",
    updatedStatus: "FAILED",
  });
});

test("offline task create reconnects once and converges local and server state", async ({
  context,
  page,
  request,
}) => {
  const username = uniqueName("qa_pr9_sync");
  const otherUsername = uniqueName("qa_pr9_other");
  const taskTitle = `离线待办-${username}`;

  await createActiveUserViaApi(request, username);
  await createActiveUserViaApi(request, otherUsername);
  const session = await apiLogin(request, username);
  const otherSession = await apiLogin(request, otherUsername);

  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await navLink(page, "待办").click();
  await expect(page.getByRole("heading", { name: "待办事项" })).toBeVisible();
  expect(
    await serverTasksByTitle(request, session.accessToken, taskTitle),
  ).toEqual([]);

  await context.setOffline(true);
  await expect(
    page.getByText("当前离线，新记录将保存在本地并在联网后同步。"),
  ).toBeVisible();
  await page.getByLabel("标题").fill(taskTitle);
  await page.getByRole("button", { name: "新建待办" }).click();
  await expect(page.getByText("待办已创建")).toBeVisible();
  await expect(page.getByText(taskTitle)).toBeVisible();

  const offlineState = await page.evaluate(
    async ({ title, userId }) => {
      const { defaultRepository } =
        await import("/src/offline/repository-instance.ts");
      const entity = (await defaultRepository.entityList(userId, "TASK")).find(
        (row) => row.data.title === title,
      );
      const pending = (await defaultRepository.pendingList(userId)).filter(
        (row) => row.entityType === "TASK" && row.payload.title === title,
      );
      return {
        localId: entity?.id ?? null,
        localVisible: entity?.data.title === title,
        pendingCount: pending.length,
        pendingLocalId: pending[0]?.localId ?? null,
      };
    },
    { title: taskTitle, userId: session.user.id },
  );
  expect(offlineState.localVisible).toBe(true);
  expect(offlineState.pendingCount).toBe(1);
  expect(offlineState.localId).toMatch(/^local-/);
  expect(offlineState.pendingLocalId).toBe(offlineState.localId);

  expect(
    await serverTasksByTitle(request, session.accessToken, taskTitle),
  ).toEqual([]);

  await context.setOffline(false);
  await expect
    .poll(
      async () =>
        (await serverTasksByTitle(request, session.accessToken, taskTitle))
          .length,
      { timeout: 20_000 },
    )
    .toBe(1);
  const serverTask = (
    await serverTasksByTitle(request, session.accessToken, taskTitle)
  )[0]!;

  await expect
    .poll(
      () =>
        page.evaluate(
          async ({ serverId, title, userId }) => {
            const { defaultRepository } =
              await import("/src/offline/repository-instance.ts");
            const pending = (
              await defaultRepository.pendingList(userId)
            ).filter(
              (row) => row.entityType === "TASK" && row.payload.title === title,
            );
            const serverEntity = await defaultRepository.entityGet(
              userId,
              "TASK",
              serverId,
            );
            return {
              pendingCount: pending.length,
              serverEntityTitle: serverEntity?.data.title ?? null,
            };
          },
          {
            serverId: serverTask.id,
            title: taskTitle,
            userId: session.user.id,
          },
        ),
      { timeout: 20_000 },
    )
    .toEqual({ pendingCount: 0, serverEntityTitle: taskTitle });

  const idRewrite = await page.evaluate(
    async ({ localId, serverId, userId }) => {
      const { defaultRepository } =
        await import("/src/offline/repository-instance.ts");
      return {
        localRemoved:
          (await defaultRepository.entityGet(userId, "TASK", localId)) === null,
        serverPresent:
          (await defaultRepository.entityGet(userId, "TASK", serverId)) !==
          null,
      };
    },
    {
      localId: offlineState.localId!,
      serverId: serverTask.id,
      userId: session.user.id,
    },
  );
  expect(idRewrite).toEqual({ localRemoved: true, serverPresent: true });

  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect
    .poll(
      async () =>
        (await serverTasksByTitle(request, session.accessToken, taskTitle))
          .length,
    )
    .toBe(1);
  expect(
    await serverTasksByTitle(request, otherSession.accessToken, taskTitle),
  ).toEqual([]);

  await page.reload();
  await expect(page.getByText(taskTitle)).toBeVisible();
  const reloaded = await page.evaluate(
    async ({ serverId, userId }) => {
      const { defaultRepository } =
        await import("/src/offline/repository-instance.ts");
      const row = await defaultRepository.entityGet(userId, "TASK", serverId);
      return {
        pending: await defaultRepository.pendingList(userId),
        title: row?.data.title,
      };
    },
    { serverId: serverTask.id, userId: session.user.id },
  );
  expect(reloaded.pending).toEqual([]);
  expect(reloaded.title).toBe(taskTitle);
});

async function apiLogin(
  request: Parameters<typeof createActiveUserViaApi>[0],
  username: string,
): Promise<ApiSession> {
  const response = await request.post("/api/v1/auth/login", {
    data: { password: E2E_ACTIVE_PASSWORD, username },
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<ApiSession>;
}

async function serverTasksByTitle(
  request: Parameters<typeof createActiveUserViaApi>[0],
  accessToken: string,
  title: string,
): Promise<ApiTask[]> {
  const response = await request.get("/api/v1/tasks", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as TaskListResponse;
  return body.items.filter((task) => task.title === title);
}
