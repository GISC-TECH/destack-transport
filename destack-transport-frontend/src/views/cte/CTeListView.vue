<template>
  <v-container>
    <v-row>
      <v-col>
        <h1>Conhecimentos de Transporte (CT-es)</h1>
        <v-btn color="primary" @click="novoCTe">Novo CT-e (Simulado)</v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-card>
          <v-card-title>
            Lista de CT-es
            <v-spacer></v-spacer>
            <v-text-field
              v-model="search"
              append-icon="mdi-magnify"
              label="Buscar"
              single-line
              hide-details
            ></v-text-field>
          </v-card-title>
          <v-data-table
            :headers="headers"
            :items="ctes"
            :search="search"
            :loading="loading"
            class="elevation-1"
          >
            <template v-slot:item.actions="{ item }">
              <v-icon small class="mr-2" @click="editItem(item)">mdi-pencil</v-icon>
              <v-icon small @click="deleteItem(item)">mdi-delete</v-icon>
            </template>
             <template v-slot:loading>
                <v-skeleton-loader type="table-tbody"></v-skeleton-loader>
            </template>
            <template v-slot:no-data>
              <v-alert :value="true" color="info" icon="mdi-information-outline">
                Nenhum CT-e encontrado.
              </v-alert>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
// import CTeService from '@/services/cteService' // Crie este serviço

const search = ref('')
const loading = ref(true)
const headers = ref([
  { title: 'Chave', key: 'chave' },
  { title: 'Número', key: 'numero' },
  { title: 'Série', key: 'serie' },
  { title: 'Emissão', key: 'dataEmissao' },
  { title: 'Valor (R$)', key: 'valorTotal' },
  { title: 'Status', key: 'status' },
  { title: 'Ações', key: 'actions', sortable: false },
])
const ctes = ref([])

onMounted(async () => {
  // Simulação de carregamento de dados
  setTimeout(() => {
    ctes.value = [
      { id: '1', chave: '31230512345678000195570010000000011234567890', numero: '000000001', serie: '001', dataEmissao: '2024-05-20', valorTotal: 1500.75, status: 'Autorizado' },
      { id: '2', chave: '31230598765432000160570020000000021987654321', numero: '000000002', serie: '002', dataEmissao: '2024-05-21', valorTotal: 2350.00, status: 'Cancelado' },
    ]
    loading.value = false
  }, 1500)
  // try {
  //   const response = await CTeService.getAllCTes();
  //   ctes.value = response.data.data; // Ajuste conforme a estrutura da sua API
  // } catch (error) {
  //   console.error("Erro ao buscar CT-es:", error);
  // } finally {
  //   loading.value = false;
  // }
})

const novoCTe = () => {
  console.log('Abrir formulário para novo CT-e')
  // router.push('/ctes/novo')
}

const editItem = (item) => {
  console.log('Editar CT-e:', item)
  // router.push(`/ctes/editar/${item.id}`)
}

const deleteItem = (item) => {
  console.log('Excluir CT-e:', item)
  // Adicionar lógica de confirmação e exclusão
}
</script>
