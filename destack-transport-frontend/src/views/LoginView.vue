<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12" :loading="authStore.isLoading">
          <template v-slot:loader="{ isActive }">
            <v-progress-linear
              :active="isActive"
              color="primary"
              height="4"
              indeterminate
            ></v-progress-linear>
          </template>

          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Login - Destack Transport</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-form ref="loginForm" @submit.prevent="handleLogin">
              <v-alert
                v-if="authStore.authError"
                type="error"
                density="compact"
                closable
                @click:close="authStore.clearLoginError()"
                class="mb-4"
                variant="tonal"
              >
                {{ authStore.authError }}
              </v-alert>

              <v-text-field
                v-model="username"
                label="Usuário"
                name="username"
                prepend-inner-icon="mdi-account"
                type="text"
                required
                :rules="[rules.required]"
                variant="outlined"
                class="mb-3"
                @input="authStore.clearLoginError()"
                @keydown.enter="handleLogin"
                :disabled="authStore.isLoading"
              ></v-text-field>

              <v-text-field
                v-model="password"
                label="Senha"
                name="password"
                prepend-inner-icon="mdi-lock"
                type="password"
                required
                :rules="[rules.required]"
                variant="outlined"
                class="mb-3"
                @input="authStore.clearLoginError()"
                @keydown.enter="handleLogin"
                :disabled="authStore.isLoading"
              ></v-text-field>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              @click="handleLogin"
              :loading="authStore.isLoading"
              :disabled="authStore.isLoading"
              size="large"
            >
              Entrar
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/store/authStore';

const username = ref('admin'); // Valor padrão para facilitar testes
const password = ref('admin123'); // Valor padrão para facilitar testes
const loginForm = ref(null); // Referência para o v-form

const authStore = useAuthStore();

const rules = {
  required: value => !!value || 'Campo obrigatório.',
};

const handleLogin = async () => {
  const { valid } = await loginForm.value.validate();
  if (!valid) {
    return;
  }

  try {
    await authStore.login({ username: username.value, password: password.value });
    // A navegação é feita dentro da action 'login' do store em caso de sucesso
  } catch (error) {
    // O erro já é tratado e armazenado no store,
    // o v-alert no template irá exibi-lo.
    // username.value = ''; // Opcional: limpar campos em caso de erro
    // password.value = '';
  }
};
</script>

<style scoped>
.fill-height {
  min-height: 90vh; /* Ou use 100vh dependendo do seu layout */
  display: flex;
  align-items: center;
  justify-content: center;
}
.mb-3 {
  margin-bottom: 12px !important;
}
</style>