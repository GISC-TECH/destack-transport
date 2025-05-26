<template>
  <AppNavbar @toggle-sidebar="toggleDrawer" />
  <AppSidebar v-model="drawer" />
  <v-main>
    <v-container fluid class="pa-4">
      <router-view />
    </v-container>
  </v-main>
  <AppFooter />
</template>

<script setup>
import { ref } from 'vue';
import AppNavbar from './AppNavbar.vue';
import AppSidebar from './AppSidebar.vue';
import AppFooter from './AppFooter.vue';

const drawer = ref(true); // Ou false para começar fechado em telas menores

const toggleDrawer = () => {
  drawer.value = !drawer.value;
};
</script>
