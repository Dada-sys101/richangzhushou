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
import RemindersView from "./views/RemindersView.vue";
import ShortcutsView from "./views/ShortcutsView.vue";
import SyncConflictsView from "./views/SyncConflictsView.vue";
import TasksView from "./views/TasksView.vue";
import TransactionFormView from "./views/TransactionFormView.vue";
import TransactionsView from "./views/TransactionsView.vue";
import TripDetailView from "./views/TripDetailView.vue";
import TripsView from "./views/TripsView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
      meta: { public: true },
    },
    {
      path: "/account",
      name: "account",
      component: AccountView,
      meta: { requiresAuth: true },
    },
    {
      path: "/change-password",
      name: "change-password",
      component: ChangePasswordView,
      meta: { requiresAuth: true },
    },
    {
      path: "/transactions",
      name: "transactions",
      component: TransactionsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/transactions/new",
      name: "transaction-new",
      component: TransactionFormView,
      meta: { requiresAuth: true },
    },
    {
      path: "/transactions/:id/edit",
      name: "transaction-edit",
      component: TransactionFormView,
      meta: { requiresAuth: true },
    },
    {
      path: "/capture",
      name: "capture",
      component: QuickCaptureView,
      meta: { requiresAuth: true },
    },
    {
      path: "/ai",
      name: "ai",
      component: AiView,
      meta: { requiresAuth: true },
    },
    {
      path: "/ai/proposals/:proposalId",
      name: "ai-proposal-review",
      component: ProposalReviewView,
      meta: { requiresAuth: true },
    },
    {
      path: "/drafts",
      name: "drafts",
      component: DraftsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/shortcuts",
      name: "shortcuts",
      component: ShortcutsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/calendar",
      name: "calendar",
      component: CalendarView,
      meta: { requiresAuth: true },
    },
    {
      path: "/tasks",
      name: "tasks",
      component: TasksView,
      meta: { requiresAuth: true },
    },
    {
      path: "/reminders",
      name: "reminders",
      component: RemindersView,
      meta: { requiresAuth: true },
    },
    {
      path: "/sync/conflicts",
      name: "sync-conflicts",
      component: SyncConflictsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/trips",
      name: "trips",
      component: TripsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/trips/:id",
      name: "trip-detail",
      component: TripDetailView,
      meta: { requiresAuth: true },
    },
    {
      path: "/finance/categories",
      name: "categories",
      component: CategoriesView,
      meta: { requiresAuth: true },
    },
    {
      path: "/finance/accounts",
      name: "accounts",
      component: AccountsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/finance/budgets",
      name: "budgets",
      component: BudgetsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: NotFoundView,
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.accessToken && !auth.offlineMode && !to.meta.public) {
    try {
      await auth.refresh();
    } catch {
      const entered = await auth.enterOfflineMode();
      if (!entered) {
        auth.clear();
        if (to.name !== "home") {
          return { name: "login", query: { redirect: to.fullPath } };
        }
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
  return true;
});
