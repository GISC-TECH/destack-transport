<template>
  <v-app>
    <v-layout>
      <v-app-bar color="primary" density="compact" v-if="authStore.isAuthenticated">
        <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
        <v-toolbar-title>Destack Transport</v-toolbar-title>
        <v-spacer></v-spacer>
        <span v-if="authStore.currentUser" class="mr-3" style="color: white;">
          Olá, {{ authStore.currentUser.name || authStore.currentUser.username }}
        </span>
        <v-btn icon @click="handleLogout">
          <v-icon>mdi-logout</v-icon>
          <v-tooltip activator="parent" location="bottom">Sair</v-tooltip>
        </v-btn>
      </v-app-bar>

      <v-navigation-drawer
        v-if="authStore.isAuthenticated"
        v-model="drawer"
        temporary
      >
        <v-list-item
          v-if="authStore.currentUser"
          :prepend-avatar="userAvatar"
          :title="authStore.currentUser.name || 'Usuário'"
          :subtitle="authStore.currentUser.email || ''"
        ></v-list-item>
        <v-divider></v-divider>
        <v-list density="compact" nav>
          <v-list-item prepend-icon="mdi-view-dashboard" title="Dashboard" value="dashboard" to="/"></v-list-item>
          <v-list-item prepend-icon="mdi-file-document-multiple" title="CT-es" value="ctes" to="/ctes"></v-list-item>
          <v-list-item prepend-icon="mdi-truck-delivery" title="MDF-es" value="mdfes" to="/mdfes"></v-list-item>
          <v-list-item prepend-icon="mdi-upload" title="Upload XML" value="uploads" to="/uploads"></v-list-item>  
        </v-list>
      </v-navigation-drawer>

      <v-main>
        <v-container :fluid="!authStore.isAuthenticated" :class="{ 'pa-0': !authStore.isAuthenticated }">
          <router-view />
        </v-container>
      </v-main>
    </v-layout>
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/authStore';

const drawer = ref(null); // Iniciar como null para que não abra por padrão em mobile
const authStore = useAuthStore();

const userAvatar = computed(() => {
  const userName = authStore.currentUser?.name || authStore.currentUser?.username || 'DT';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=primary&color=white&bold=true&size=128`;
});

const handleLogout = () => {
  authStore.logout();
};

onMounted(async () => {
  // Tenta carregar o estado de autenticação ao montar o App.vue
  // Se houver um token, tenta buscar o perfil para validar.
  await authStore.tryAutoLogin();
});
</script>

<style>
/* Ajustes para o container principal quando não autenticado (página de login) */
.v-main .v-container.pa-0 {
  padding: 0 !important;
}
/* Garante que a v-main possa ocupar a altura total */
.v-layout, .v-main {
  min-height: 100vh;
}
</style>