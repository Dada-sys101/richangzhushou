import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "./stores/auth";
import AccountView from "./views/AccountView.vue";
import AccountsView from "./views/AccountsView.vue";
import AiView from "./views/AiView.vue";
import BudgetsView from "./views/BudgetsView.vue";
import CalendarView from "./views/CalendarView.vue";
import CategoriesView from "./views/CategoriesView.vue";
import ChangePasswordView from "./views/ChangePasswordView.vue";
import DraftsView from "./views/DraftsView.vue";
import HomeView from "./views/HomeView.vue";
import LoginView from "./views/LoginView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import ProposalReviewView from "./views/ProposalReviewView.vue";
import QuickCaptureView from "./views/QuickCaptureView.vue";
import RecordsView from "./views/RecordsView.vue";
import RemindersView from "./views/RemindersView.vue";
import ShortcutsView from "./views/ShortcutsView.vue";
import SyncConflictsView from "./views/SyncConflictsView.vue";
import TasksView from "./views/TasksView.vue";
import PlanView from "./views/PlanView.vue";
import TransactionFormView from "./views/TransactionFormView.vue";
import TransactionsView from "./views/TransactionsView.vue";
import TripDetailView from "./views/TripDetailView.vue";
import TripsView from "./views/TripsView.vue";
import PlannerDetailView from "./views/PlannerDetailView.vue";
import {
  clearScrollPosition,
  readScrollPosition,
  sanitizeInternalPath,
  saveScrollPosition,
} from "./utils/navigation";
import { ensureDirectEntryFallback } from "./navigation-policy";

const recordsParent = { title: "记录", path: "/records" };
const planParent = { title: "计划", path: "/plan" };
const accountParent = { title: "我的", path: "/account" };
const collectionPathsWithoutImplicitReturnContext = new Set([
  "/account",
  "/calendar",
  "/drafts",
  "/plan",
  "/records",
  "/reminders",
  "/tasks",
  "/transactions",
  "/trips",
]);

function isBrowserBackNavigation(fromFullPath: string) {
  if (typeof window === "undefined") return false;
  const forward = window.history.state?.forward;
  return typeof forward === "string" && forward === fromFullPath;
}

function rootPage(title: string) {
  return { navigationKind: "ROOT_TAB" as const, page: { title } };
}

function childPage(title: string, parent: { title: string; path: string }) {
  return { navigationKind: "STACK_PAGE" as const, page: { title, parent } };
}

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }

    const storedPosition = readScrollPosition(to.fullPath);
    if (storedPosition !== null) {
      clearScrollPosition(to.fullPath);
      return { left: 0, top: storedPosition };
    }

    return { left: 0, top: 0 };
  },
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: rootPage("首页"),
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
      meta: {
        ...rootPage("登录"),
        navigationKind: "FLOW_PAGE",
        public: true,
      },
    },
    {
      path: "/account",
      name: "account",
      component: AccountView,
      meta: { ...rootPage("我的"), requiresAuth: true },
    },
    {
      path: "/change-password",
      name: "change-password",
      component: ChangePasswordView,
      meta: {
        ...childPage("修改密码", accountParent),
        navigationKind: "FLOW_PAGE",
        requiresAuth: true,
      },
    },
    {
      path: "/transactions",
      name: "transactions",
      component: TransactionsView,
      meta: { ...childPage("账单", recordsParent), requiresAuth: true },
    },
    {
      path: "/transactions/new",
      name: "transaction-new",
      component: TransactionFormView,
      meta: {
        ...childPage("新增记账", recordsParent),
        navigationKind: "FLOW_PAGE",
        requiresAuth: true,
      },
    },
    {
      path: "/transactions/:id/edit",
      name: "transaction-edit",
      component: TransactionFormView,
      meta: {
        ...childPage("编辑记账", recordsParent),
        navigationKind: "FLOW_PAGE",
        requiresAuth: true,
      },
    },
    {
      path: "/capture",
      name: "capture",
      component: QuickCaptureView,
      meta: {
        ...childPage("快速新增", { title: "首页", path: "/" }),
        navigationKind: "FLOW_PAGE",
        requiresAuth: true,
      },
    },
    {
      path: "/records",
      name: "records",
      component: RecordsView,
      meta: { ...rootPage("记录"), requiresAuth: true },
    },
    {
      path: "/plan",
      name: "plan",
      component: PlanView,
      meta: { ...rootPage("计划"), requiresAuth: true },
    },
    {
      path: "/ai",
      name: "ai",
      component: AiView,
      meta: { ...childPage("AI 助手", accountParent), requiresAuth: true },
    },
    {
      path: "/ai/proposals/:proposalId",
      name: "ai-proposal-review",
      component: ProposalReviewView,
      meta: {
        ...childPage("提案确认", { title: "AI 助手", path: "/ai" }),
        navigationKind: "FLOW_PAGE",
        requiresAuth: true,
      },
    },
    {
      path: "/drafts",
      name: "drafts",
      component: DraftsView,
      meta: { ...childPage("草稿中心", recordsParent), requiresAuth: true },
    },
    {
      path: "/shortcuts",
      name: "shortcuts",
      component: ShortcutsView,
      meta: { ...childPage("快捷指令", accountParent), requiresAuth: true },
    },
    {
      path: "/calendar",
      name: "calendar",
      component: CalendarView,
      meta: { ...childPage("日程", planParent), requiresAuth: true },
    },
    {
      path: "/calendar/:id",
      name: "calendar-detail",
      component: PlannerDetailView,
      meta: {
        ...childPage("日程详情", planParent),
        navigationKind: "DETAIL_PAGE",
        plannerEntity: "calendar-event",
        requiresAuth: true,
      },
    },
    {
      path: "/tasks",
      name: "tasks",
      component: TasksView,
      meta: { ...childPage("待办", planParent), requiresAuth: true },
    },
    {
      path: "/tasks/:id",
      name: "task-detail",
      component: PlannerDetailView,
      meta: {
        ...childPage("待办详情", planParent),
        navigationKind: "DETAIL_PAGE",
        plannerEntity: "task",
        requiresAuth: true,
      },
    },
    {
      path: "/reminders",
      name: "reminders",
      component: RemindersView,
      meta: { ...childPage("提醒", planParent), requiresAuth: true },
    },
    {
      path: "/reminders/:id",
      name: "reminder-detail",
      component: PlannerDetailView,
      meta: {
        ...childPage("提醒详情", planParent),
        navigationKind: "DETAIL_PAGE",
        plannerEntity: "reminder",
        requiresAuth: true,
      },
    },
    {
      path: "/sync/conflicts",
      name: "sync-conflicts",
      component: SyncConflictsView,
      meta: { ...childPage("同步冲突", accountParent), requiresAuth: true },
    },
    {
      path: "/trips",
      name: "trips",
      component: TripsView,
      meta: { ...childPage("行程", accountParent), requiresAuth: true },
    },
    {
      path: "/trips/:id",
      name: "trip-detail",
      component: TripDetailView,
      meta: {
        ...childPage("行程详情", { title: "行程", path: "/trips" }),
        navigationKind: "DETAIL_PAGE",
        requiresAuth: true,
      },
    },
    {
      path: "/finance/categories",
      name: "categories",
      component: CategoriesView,
      meta: { ...childPage("分类管理", accountParent), requiresAuth: true },
    },
    {
      path: "/finance/accounts",
      name: "accounts",
      component: AccountsView,
      meta: { ...childPage("资金账户", accountParent), requiresAuth: true },
    },
    {
      path: "/finance/budgets",
      name: "budgets",
      component: BudgetsView,
      meta: { ...childPage("预算设置", accountParent), requiresAuth: true },
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: NotFoundView,
    },
  ],
});

router.beforeEach(async (to, from) => {
  if (from.name && typeof window !== "undefined") {
    saveScrollPosition(from.fullPath, window.scrollY);
  }

  if (to.query.returnTo !== undefined) {
    const directReturn = sanitizeInternalPath(to.query.returnTo);
    if (directReturn !== to.query.returnTo) {
      const query = { ...to.query };
      if (directReturn) {
        query.returnTo = directReturn;
      } else {
        delete query.returnTo;
      }
      return {
        name: to.name,
        params: to.params,
        query,
        hash: to.hash,
        replace: true,
      };
    }
  }

  const auth = useAuthStore();
  if (!auth.accessToken && !auth.offlineMode && !to.meta.public) {
    try {
      await auth.refresh();
    } catch {
      auth.clear();
      if (to.name !== "home") {
        return { name: "login", query: { redirect: to.fullPath } };
      }
    }
  }
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (auth.mustChangePassword && to.name !== "change-password") {
    return { name: "change-password" };
  }
  if (to.name === "login" && auth.isAuthenticated) {
    return { name: "account" };
  }

  if (
    to.meta.page?.parent &&
    !to.query.returnTo &&
    from.name &&
    from.name !== "login" &&
    from.meta.page &&
    !isBrowserBackNavigation(from.fullPath) &&
    !collectionPathsWithoutImplicitReturnContext.has(to.path)
  ) {
    const directSource = sanitizeInternalPath(from.fullPath);
    return {
      name: to.name,
      params: to.params,
      query: {
        ...to.query,
        returnTo: directSource ?? to.meta.page.parent.path,
      },
      hash: to.hash,
    };
  }

  return true;
});

router.afterEach((to) => {
  ensureDirectEntryFallback(to);
});
