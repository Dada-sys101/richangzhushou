import { expect, test } from "@playwright/test";

import {
  createActiveUserViaApi,
  E2E_ACTIVE_PASSWORD,
  loginViaUi,
  uniqueName,
} from "./helpers/e2e";

test("H05-B01/B02/B03/B05: create, accept, explicit final confirm, reload safety", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_ai");
  const taskTitle = `AI待办-${username}`;
  const blocking: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      blocking.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    blocking.push(String(error));
  });

  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");

  // H05-B01: navigate to /ai and create a TASK proposal.
  await page.goto("/ai");
  await expect(page.getByRole("heading", { name: "生成提案" })).toBeVisible();
  await page.getByLabel("类型").selectOption("TASK");
  await page.getByLabel("内容").fill(taskTitle);
  await page.getByRole("button", { name: "生成 Proposal" }).click();

  // Review route visible with the operation card.
  await expect(page).toHaveURL(/\/ai\/proposals\/.+/);
  await expect(page.getByRole("heading", { name: "提案核对" })).toBeVisible();
  await expect(page.getByText("待办").first()).toBeVisible();

  // H05-B02: accept the operation; formal Task must NOT exist yet.
  await page.getByRole("button", { name: "接受此项" }).click();
  await expect(page.getByText("已接受")).toBeVisible();
  await expect(page.getByText("最终确认写入")).toBeVisible();

  const taskCountAfterAccept = await countTasks(request, username);
  expect(taskCountAfterAccept).toBe(0);

  // H05-B05: reload must not send final-confirm; the task stays absent.
  await page.reload();
  await expect(page.getByRole("heading", { name: "提案核对" })).toBeVisible();
  await expect(page.getByText("已接受")).toBeVisible();
  const taskCountAfterReload = await countTasks(request, username);
  expect(taskCountAfterReload).toBe(0);

  // H05-B03: explicit Final Confirm writes exactly one Task.
  await page.getByRole("button", { name: "最终确认并写入" }).click();
  await expect(page.getByText("已写入")).toBeVisible();
  const taskCountAfterConfirm = await countTasks(request, username);
  expect(taskCountAfterConfirm).toBe(1);

  const unexpected = blocking.filter((text) =>
    /Access token is required|401|CORS|NetworkError|Failed to fetch/i.test(
      text,
    ),
  );
  expect(unexpected).toEqual([]);
});

test("H05-B04: reject path never offers final write and creates no Task", async ({
  page,
  request,
}) => {
  const username = uniqueName("qa_ai_reject");
  const taskTitle = `AI拒绝-${username}`;

  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");

  await page.goto("/ai");
  await expect(page.getByRole("heading", { name: "生成提案" })).toBeVisible();
  await page.getByLabel("类型").selectOption("TASK");
  await page.getByLabel("内容").fill(taskTitle);
  await page.getByRole("button", { name: "生成 Proposal" }).click();
  await expect(page).toHaveURL(/\/ai\/proposals\/.+/);
  await expect(page.getByRole("heading", { name: "提案核对" })).toBeVisible();

  // Reject the operation (not the whole proposal).
  await page.getByRole("button", { name: "拒绝此项" }).click();
  await expect(page.getByText("已拒绝")).toBeVisible();

  // No final confirm panel and no formal Task.
  await expect(page.getByText("最终确认写入")).not.toBeVisible();
  const taskCount = await countTasks(request, username);
  expect(taskCount).toBe(0);
});

test("H05-FINAL-BROWSER-BACK: back never auto-confirms and direct route reloads authoritative state", async ({
  page,
  request,
}) => {
  const { proposalId, username } = await createTaskProposal(
    page,
    request,
    "qa_ai_back",
  );

  await page.getByRole("button", { name: "接受此项" }).click();
  await expect(page.getByText("最终确认写入")).toBeVisible();

  let finalConfirmRequests = 0;
  page.on("request", (requestEvent) => {
    if (
      requestEvent.method() === "POST" &&
      requestEvent
        .url()
        .includes(`/api/v1/ai/proposals/${proposalId}/final-confirm`)
    ) {
      finalConfirmRequests += 1;
    }
  });

  await page.goBack();
  await expect(page).toHaveURL(/\/ai\/?$/);
  expect(await countTasks(request, username)).toBe(0);

  const authoritativeRead = page.waitForResponse((response) => {
    return (
      response.request().method() === "GET" &&
      new URL(response.url()).pathname ===
        `/api/v1/ai/proposals/${proposalId}` &&
      response.ok()
    );
  });
  await Promise.all([
    authoritativeRead,
    page.goto(`/ai/proposals/${proposalId}`),
  ]);
  await expect(page.getByText("已接受")).toBeVisible();
  await expect(page.getByText("最终确认写入")).toBeVisible();
  expect(finalConfirmRequests).toBe(0);
  expect(await countTasks(request, username)).toBe(0);
});

test("H05-FINAL-DOUBLE-CLICK: FinalConfirm creates one Task and one APPLIED operation", async ({
  page,
  request,
}) => {
  const { proposalId, username } = await createTaskProposal(
    page,
    request,
    "qa_ai_double",
  );

  await page.getByRole("button", { name: "接受此项" }).click();
  const finalConfirmButton = page.getByRole("button", {
    name: "最终确认并写入",
  });
  let finalConfirmRequests = 0;
  page.on("request", (requestEvent) => {
    if (
      requestEvent.method() === "POST" &&
      requestEvent
        .url()
        .includes(`/api/v1/ai/proposals/${proposalId}/final-confirm`)
    ) {
      finalConfirmRequests += 1;
    }
  });

  await Promise.all([
    page.waitForResponse((response) => {
      return (
        response.request().method() === "POST" &&
        response
          .url()
          .includes(`/api/v1/ai/proposals/${proposalId}/final-confirm`) &&
        response.ok()
      );
    }),
    finalConfirmButton.dblclick(),
  ]);

  await expect(page.getByText("已写入")).toBeVisible();
  expect(finalConfirmRequests).toBe(1);
  const detail = await getProposal(request, username, proposalId);
  const operation = detail.operations[0];
  expect(operation?.status).toBe("APPLIED");
  expect(operation?.resultEntityId).toBeTruthy();
  expect(await countTasks(request, username)).toBe(1);
});

test("H05-FINAL-RESPONSE-LOSS: a successful server write replays to the same APPLIED result", async ({
  page,
  request,
}) => {
  const { proposalId, username } = await createTaskProposal(
    page,
    request,
    "qa_ai_response_loss",
  );

  await page.getByRole("button", { name: "接受此项" }).click();
  let finalConfirmRequests = 0;
  let releaseResponseLoss!: () => void;
  const responseLoss = new Promise<void>((resolve) => {
    releaseResponseLoss = resolve;
  });
  const finalConfirmUrl = new RegExp(
    `/api/v1/ai/proposals/${proposalId}/final-confirm$`,
  );

  await page.route(finalConfirmUrl, async (route) => {
    finalConfirmRequests += 1;
    const serverResponse = await route.fetch();
    await serverResponse.body();
    await route.fulfill({
      body: JSON.stringify({
        code: "NETWORK_ERROR",
        message: "simulated response loss",
      }),
      contentType: "application/json",
      status: 503,
    });
    releaseResponseLoss();
  });

  await page.getByRole("button", { name: "最终确认并写入" }).click();
  await responseLoss;
  await page.unroute(finalConfirmUrl);

  const appliedBeforeReload = await getProposal(request, username, proposalId);
  const resultEntityId = appliedBeforeReload.operations[0]?.resultEntityId;
  expect(appliedBeforeReload.operations[0]?.status).toBe("APPLIED");
  expect(resultEntityId).toBeTruthy();
  expect(finalConfirmRequests).toBe(1);
  expect(await countTasks(request, username)).toBe(1);

  await page.reload();
  await expect(page.getByText("已写入")).toBeVisible();
  await expect(page.getByText(String(resultEntityId))).toBeVisible();
  await expect(
    page.getByRole("button", { name: "最终确认并写入" }),
  ).not.toBeVisible();
  expect(await countTasks(request, username)).toBe(1);
});

test("H05-FINAL-APPLIED-REPLAY: direct APPLIED entry is read-only and server replay preserves the result", async ({
  page,
  request,
}) => {
  const { proposalId, username } = await createTaskProposal(
    page,
    request,
    "qa_ai_applied",
  );

  await page.getByRole("button", { name: "接受此项" }).click();
  await page.getByRole("button", { name: "最终确认并写入" }).click();
  await expect(page.getByText("已写入")).toBeVisible();

  const applied = await getProposal(request, username, proposalId);
  const appliedOperation = applied.operations[0];
  const resultEntityId = appliedOperation?.resultEntityId;
  expect(applied.status).toBe("APPLIED");
  expect(appliedOperation?.status).toBe("APPLIED");
  expect(resultEntityId).toBeTruthy();

  let finalConfirmRequests = 0;
  page.on("request", (requestEvent) => {
    if (
      requestEvent.method() === "POST" &&
      requestEvent
        .url()
        .includes(`/api/v1/ai/proposals/${proposalId}/final-confirm`)
    ) {
      finalConfirmRequests += 1;
    }
  });
  const authoritativeRead = page.waitForResponse((response) => {
    return (
      response.request().method() === "GET" &&
      new URL(response.url()).pathname ===
        `/api/v1/ai/proposals/${proposalId}` &&
      response.ok()
    );
  });
  await Promise.all([
    authoritativeRead,
    page.goto(`/ai/proposals/${proposalId}`),
  ]);

  await expect(page.getByText("已写入")).toBeVisible();
  await expect(page.getByText(String(resultEntityId))).toBeVisible();
  await expect(
    page.getByRole("button", { name: "接受此项" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "拒绝此项" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "最终确认并写入" }),
  ).not.toBeVisible();
  expect(finalConfirmRequests).toBe(0);

  const token = await userAccessToken(request, username);
  const replay = await request.post(
    `/api/v1/ai/proposals/${proposalId}/final-confirm`,
    {
      data: {
        operationIds: [appliedOperation?.id],
        version: applied.version,
      },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  expect(replay.ok()).toBeTruthy();
  const replayed = (await replay.json()) as E2eProposal;
  expect(replayed.operations[0]?.status).toBe("APPLIED");
  expect(replayed.operations[0]?.resultEntityId).toBe(resultEntityId);
  expect(await countTasks(request, username)).toBe(1);
});

test("H05-FINAL-EDIT: incomplete field is blocked before authoritative Save, Accept, and FinalConfirm", async ({
  page,
  request,
}) => {
  const { proposalId, username } = await createTaskProposal(
    page,
    request,
    "qa_ai_edit",
  );
  const initial = await getProposal(request, username, proposalId);
  const initialOperation = initial.operations[0];
  if (!initialOperation) {
    throw new Error("Expected the Fake Provider to create a TASK operation");
  }

  const token = await userAccessToken(request, username);
  const incompleteResponse = await request.patch(
    `/api/v1/ai/proposals/${proposalId}/operations/${initialOperation.id}`,
    {
      data: {
        fields: {
          dueAt: initialOperation.fields.dueAt,
          priority: initialOperation.fields.priority,
        },
        version: initial.version,
      },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  expect(incompleteResponse.ok()).toBeTruthy();

  const incomplete = await getProposal(request, username, proposalId);
  expect(incomplete.operations[0]?.status).toBe("PENDING");
  expect(incomplete.operations[0]?.fields).not.toHaveProperty("title");

  let acceptRequests = 0;
  page.on("request", (requestEvent) => {
    if (
      requestEvent.method() === "POST" &&
      requestEvent
        .url()
        .includes(
          `/api/v1/ai/proposals/${proposalId}/operations/${initialOperation.id}/accept`,
        )
    ) {
      acceptRequests += 1;
    }
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "提案核对" })).toBeVisible();
  await expect(page.getByText("请核对并补充必填字段后再接受")).toBeVisible();
  const acceptButton = page.getByRole("button", { name: "接受此项" });
  await expect(acceptButton).toBeDisabled();
  await acceptButton.dispatchEvent("click");
  expect(acceptRequests).toBe(0);

  const editedTitle = `AI编辑-${username}`;
  const titleInput = page
    .locator("label.draft-field")
    .filter({ hasText: "title" })
    .locator("input");
  await titleInput.fill(editedTitle);
  await expect(acceptButton).toBeDisabled();
  const saveButton = page.getByRole("button", { name: "保存修改" });
  await expect(saveButton).toBeEnabled();

  const saved = page.waitForResponse((response) => {
    return (
      response.request().method() === "PATCH" &&
      response
        .url()
        .includes(`/api/v1/ai/proposals/${proposalId}/operations/`) &&
      response.ok()
    );
  });
  await Promise.all([saved, saveButton.click()]);
  const savedProposal = await getProposal(request, username, proposalId);
  expect(savedProposal.operations[0]?.status).toBe("PENDING");
  expect(savedProposal.operations[0]?.fields.title).toBe(editedTitle);
  await expect(acceptButton).toBeEnabled();

  const accepted = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response
        .url()
        .includes(
          `/api/v1/ai/proposals/${proposalId}/operations/${initialOperation.id}/accept`,
        ) &&
      response.ok()
    );
  });
  await Promise.all([accepted, acceptButton.click()]);
  expect(acceptRequests).toBe(1);
  await expect(page.getByText("已接受")).toBeVisible();

  const acceptedProposal = await getProposal(request, username, proposalId);
  expect(acceptedProposal.operations[0]?.status).toBe("ACCEPTED");
  expect(await countTasks(request, username)).toBe(0);

  await expect(page.getByText("最终确认写入")).toBeVisible();
  const finalConfirmed = page.waitForResponse((response) => {
    return (
      response.request().method() === "POST" &&
      response
        .url()
        .includes(`/api/v1/ai/proposals/${proposalId}/final-confirm`) &&
      response.ok()
    );
  });
  await Promise.all([
    finalConfirmed,
    page.getByRole("button", { name: "最终确认并写入" }).click(),
  ]);
  await expect(page.getByText("已写入")).toBeVisible();
  const applied = await getProposal(request, username, proposalId);
  expect(applied.operations[0]?.status).toBe("APPLIED");
  expect(applied.operations[0]?.resultEntityId).toBeTruthy();
  const tasks = await listTasks(request, username);
  if (!tasks) {
    throw new Error("Expected the task list request to succeed");
  }
  expect(tasks).toEqual(
    expect.arrayContaining([expect.objectContaining({ title: editedTitle })]),
  );
  expect(tasks).toHaveLength(1);
});

test("H05-FINAL-ACCEPTED-REJECT: accepted Operation can be rejected without a formal Task", async ({
  page,
  request,
}) => {
  const { proposalId, username } = await createTaskProposal(
    page,
    request,
    "qa_ai_accepted_reject",
  );

  await page.getByRole("button", { name: "接受此项" }).click();
  const rejectButton = page.getByRole("button", { name: "拒绝此项" });
  await expect(rejectButton).toBeVisible();
  await rejectButton.click();
  await expect(page.getByText("已拒绝")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "接受此项" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "拒绝此项" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "最终确认并写入" }),
  ).not.toBeVisible();

  const rejected = await getProposal(request, username, proposalId);
  expect(rejected.operations[0]?.status).toBe("REJECTED");
  expect(await countTasks(request, username)).toBe(0);

  await page.reload();
  await expect(page.getByText("已拒绝")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "最终确认并写入" }),
  ).not.toBeVisible();
  expect(await countTasks(request, username)).toBe(0);
});

interface E2eOperation {
  fields: Record<string, unknown>;
  id: string;
  resultEntityId: string | null;
  status: string;
}

interface E2eProposal {
  id: string;
  operations: E2eOperation[];
  status: string;
  version: number;
}

interface E2eTask {
  id: string;
  title: string;
}

async function createTaskProposal(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  prefix: string,
): Promise<{ proposalId: string; username: string }> {
  const username = uniqueName(prefix);
  await createActiveUserViaApi(request, username);
  await loginViaUi(page, username, E2E_ACTIVE_PASSWORD);
  await page.waitForURL("**/account");
  await page.goto("/ai");
  await expect(page.getByRole("heading", { name: "生成提案" })).toBeVisible();
  await page.getByLabel("类型").selectOption("TASK");
  await page.getByLabel("内容").fill(`AI待办-${username}`);
  await page.getByRole("button", { name: "生成 Proposal" }).click();
  await expect(page).toHaveURL(/\/ai\/proposals\/.+/);
  await expect(page.getByRole("heading", { name: "提案核对" })).toBeVisible();
  const proposalId = new URL(page.url()).pathname.split("/").pop() ?? "";
  expect(proposalId).not.toBe("");
  return { proposalId, username };
}

async function userAccessToken(
  request: import("@playwright/test").APIRequestContext,
  username: string,
): Promise<string> {
  const login = await request.post("/api/v1/auth/login", {
    data: { password: E2E_ACTIVE_PASSWORD, username },
  });
  expect(login.ok()).toBeTruthy();
  const body = (await login.json()) as { accessToken: string };
  return body.accessToken;
}

async function getProposal(
  request: import("@playwright/test").APIRequestContext,
  username: string,
  proposalId: string,
): Promise<E2eProposal> {
  const token = await userAccessToken(request, username);
  const response = await request.get(`/api/v1/ai/proposals/${proposalId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as E2eProposal;
}

async function countTasks(
  request: import("@playwright/test").APIRequestContext,
  username: string,
): Promise<number> {
  const tasks = await listTasks(request, username);
  return tasks ? tasks.length : -1;
}

async function listTasks(
  request: import("@playwright/test").APIRequestContext,
  username: string,
): Promise<E2eTask[] | null> {
  const token = await userAccessToken(request, username);
  const list = await request.get("/api/v1/tasks", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!list.ok()) {
    return null;
  }
  const data = (await list.json()) as { items: E2eTask[] };
  return data.items;
}
