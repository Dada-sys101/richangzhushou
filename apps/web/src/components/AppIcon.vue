<script setup lang="ts">
import { computed } from "vue";

const ICONS: Record<string, string[]> = {
  alert: ["M12 3 2 20h20L12 3Z", "M12 9v4", "M12 17h.01"],
  bell: [
    "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9",
    "M13.7 21a2 2 0 0 1-3.4 0",
  ],
  budget: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 3v9h9"],
  calendar: ["M4 5h16v15H4z", "M8 3v4", "M16 3v4", "M4 10h16"],
  card: ["M2 6h20v12H2z", "M2 10h20"],
  check: ["m5 12 5 5L20 7"],
  "chevron-down": ["m6 9 6 6 6-6"],
  "chevron-right": ["m9 6 6 6-6 6"],
  file: [
    "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z",
    "M13 2v6h6",
    "M9 13h6",
    "M9 17h6",
  ],
  finance: ["M4 20V10", "M10 20V4", "M16 20v-7", "M3 20h18"],
  home: [
    "M3 10.8 12 3l9 7.8",
    "M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5",
  ],
  lock: ["M6 10h12v11H6z", "M8 10V7a4 4 0 0 1 8 0v3"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  pen: ["M4 20l1-4L16 5l3 3L8 19z", "M14 7l3 3"],
  plus: ["M12 5v14", "M5 12h14"],
  receipt: [
    "M4 3h16v18l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z",
    "M8 8h8",
    "M8 12h8",
    "M8 16h5",
  ],
  refresh: ["M21 12a9 9 0 1 1-2.6-6.4", "M21 3v6h-6"],
  repeat: [
    "m17 2 4 4-4 4",
    "M21 6H8a5 5 0 0 0-5 5v1",
    "m7 22-4-4 4-4",
    "M3 18h13a5 5 0 0 0 5-5v-1",
  ],
  settings: ["M4 7h16", "M4 17h16", "M9 4v6", "M15 14v6"],
  tags: ["M20.6 13.4 12 22l-10-10V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z", "M7 7h.01"],
  tasks: [
    "M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z",
    "m8 12 2.5 2.5L16 9",
  ],
  trip: ["M6 8h12v13H6z", "M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2", "M6 13h12"],
  user: [
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M4 21c1.2-3.2 4.2-5 8-5s6.8 1.8 8 5",
  ],
  zap: ["M13 2 3 14h7l-1 8 10-12h-7l1-8Z"],
};

const props = defineProps<{ name: string; size?: number }>();

const paths = computed(() => ICONS[props.name] ?? []);
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="d in paths" :key="d" :d="d" />
  </svg>
</template>
