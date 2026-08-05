import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "./stores/auth";
import AccountView from "./views/AccountView.vue";
import AccountsView from "./views/AccountsView.vue";
import BudgetsView from "./views/BudgetsView.vue";
import CalendarView from "./views/CalendarView.vue";
import CategoriesView from "./views/CategoriesView.vue";
import DraftsView from "./views/DraftsView.vue";
import ForgotPasswordView from "./views/ForgotPasswordView.vue";
import HomeView from "./views/HomeView.vue";
import LoginView from "./views/LoginView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import QuickCaptureView from "./views/QuickCaptureView.vue";
import RegisterView from "./views/RegisterView.vue";
import RemindersView from "./views/RemindersView.vue";
import ResetPasswordView from "./views/ResetPasswordView.vue";
import ShortcutsView from "./views/ShortcutsView.vue";
import TasksView from "./views/TasksView.vue";
import TransactionFormView from "./views/TransactionFormView.vue";
import TransactionsView from "./views/TransactionsView.vue";

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
      path: "/register",
      name: "register",
      component: RegisterView,
      meta: { public: true },
    },
    {
      path: "/forgot-password",
      name: "forgot-password",
      component: ForgotPasswordView,
      meta: { public: true },
    },
    {
      path: "/reset-password",
      name: "reset-password",
      component: ResetPasswordView,
      meta: { public: true },
    },
    {
      path: "/account",
      name: "account",
      component: AccountView,
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
  if (!auth.accessToken && !to.meta.public) {
    try {
      await auth.refresh();
    } catch {
      auth.clear();
    }
  }
  if (to.meta.requiresAuth && !auth.accessToken) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if ((to.name === "login" || to.name === "register") && auth.accessToken) {
    return { name: "account" };
  }
  return true;
});
