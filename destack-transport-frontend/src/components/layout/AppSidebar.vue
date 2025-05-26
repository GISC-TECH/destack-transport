<template>
  <v-navigation-drawer
    v-model="internalDrawerValue"
    :temporary="$vuetify.display.mdAndDown"
    app
  >
    <v-list nav density="compact">
      <v-list-item prepend-icon="mdi-view-dashboard" title="Dashboard" value="dashboard" to="/dashboard"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>DOCUMENTOS</v-list-subheader>
      <v-list-item prepend-icon="mdi-file-document-multiple-outline" title="CT-es" value="ctes" to="/ctes"></v-list-item>
      <v-list-item prepend-icon="mdi-truck-delivery-outline" title="MDF-es" value="mdfes" to="/mdfes"></v-list-item>
      <v-list-item prepend-icon="mdi-upload-outline" title="Upload XML" value="upload" to="/upload"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>CADASTROS</v-list-subheader>
      <v-list-item prepend-icon="mdi-domain" title="Empresas" value="empresas" to="/empresas"></v-list-item>
      <v-list-item prepend-icon="mdi-car-wrench" title="Manutenções" value="manutencoes" to="/manutencoes"></v-list-item>
      <v-divider></v-divider>
      <v-list-subheader>ANÁLISES</v-list-subheader>
      <v-list-item prepend-icon="mdi-finance" title="Financeiro" value="financeiro" to="/financeiro"></v-list-item>
      <v-list-item prepend-icon="mdi-map-marker-outline" title="Geográfico" value="geografico" to="/geografico"></v-list-item>
      </v-list>
  </v-navigation-drawer>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: Boolean
});
const emit = defineEmits(['update:modelValue']);

const internalDrawerValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue\, val)
});
</script>
