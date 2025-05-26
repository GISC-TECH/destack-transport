<template>
  <v-main class="bg-grey-lighten-3">
    <v-container fluid class="fill-height pa-0">
      <v-row align="center" justify="center" class="fill-height ma-0">
        <v-col cols="12" sm="8" md="6" lg="4" xl="3">
          <v-sheet rounded="lg" class="pa-md-10 pa-5" min-height="70vh" elevation="2">
            <div class="d-flex justify-center mb-6">
               <h1 class="text-h5 text-primary">Destack Transport</h1>
            </div>
            <router-view />
          </v-sheet>
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>

<script setup>
// Nenhuma lógica complexa aqui por enquanto
</script>
<style scoped>
.bg-grey-lighten-3 {
  background-color: #f5f5f5 !important; /* Exemplo de cor de fundo para a página de login */
}
</style>
