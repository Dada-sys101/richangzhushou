import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "./stores/auth";
import AuditsView from "./views/AuditsView.vue";
import DashboardView from "./views/DashboardView.vue";
import HomeView from "./views/HomeView.vue";
import InvitesView from "./views/InvitesView.vue";
import LoginView from "./views/LoginView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import SettingsView from "./views/SettingsView.vue";
import UsersView from "./views/UsersView.vue";

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
      path: "/dashboard",
      name: "dashboard",
      component: DashboardView,
      meta: { requiresAuth: true },
    },
    {
      path: "/invites",
      name: "invites",
      component: InvitesView,
      meta: { requiresAuth: true },
    },
    {
      path: "/users",
      name: "users",
      component: UsersView,
      meta: { requiresAuth: true },
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsView,
      meta: { requiresAuth: true },
    },
    {
      path: "/audits",
      name: "audits",
      component: AuditsView,
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
  if (to.name === "login" && auth.accessToken) {
    return { name: "dashboard" };
  }
  return true;
});
