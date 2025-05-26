
<template>
  <v-app-bar color="primary" density="compact">
    <v-app-bar-nav-icon @click.stop="emit('toggle-sidebar')"></v-app-bar-nav-icon>
    <v-toolbar-title class="font-weight-medium">Destack Transport</v-toolbar-title>
    <v-spacer></v-spacer>
    <v-menu v-if="authStore.isAuthenticated">
      <template v-slot:activator="{ props }">
        <v-btn icon="mdi-account-circle" v-bind="props"></v-btn>
      </template>
      <v-list>
        <v-list-item :title="authStore.currentUser?.name || 'Usuário'" :subtitle="authStore.currentUser?.email">
        </v-list-item>
        <v-divider></v-divider>
        <v-list-item prepend-icon="mdi-logout" title="Sair" @click="handleLogout"></v-list-item>
      </v-list>
    </v-menu>
  </v-app-bar>
</template>

<script setup>
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'vue-router';

const emit = defineEmits(['toggle-sidebar']);
const authStore = useAuthStore();
const router = useRouter();

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>