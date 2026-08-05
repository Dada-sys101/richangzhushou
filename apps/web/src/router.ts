import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "./stores/auth";
import AccountView from "./views/AccountView.vue";
import ForgotPasswordView from "./views/ForgotPasswordView.vue";
import HomeView from "./views/HomeView.vue";
import LoginView from "./views/LoginView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import RegisterView from "./views/RegisterView.vue";
import ResetPasswordView from "./views/ResetPasswordView.vue";

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
