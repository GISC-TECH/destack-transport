<template>
  <v-container>
    <v-row>
      <v-col>
        <h1>Manifestos Eletrônicos (MDF-es)</h1>
         <v-btn color="primary" @click="novoMDFe">Novo MDF-e (Simulado)</v-btn>
      </v-col>
    </v-row>
     <v-row>
      <v-col>
        <v-card>
          <v-card-title>
            Lista de MDF-es
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
            :items="mdfes"
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
                Nenhum MDF-e encontrado.
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
// import MDFeService from '@/services/mdfeService' // Crie este serviço

const search = ref('')
const loading = ref(true)
const headers = ref([
  { title: 'Chave', key: 'chave' },
  { title: 'Número', key: 'numero' },
  { title: 'Série', key: 'serie' },
  { title: 'Emissão', key: 'dataEmissao' },
  { title: 'Placa Veículo', key: 'placa' },
  { title: 'Status', key: 'status' },
  { title: 'Ações', key: 'actions', sortable: false },
])
const mdfes = ref([])

onMounted(async () => {
  // Simulação de carregamento de dados
  setTimeout(() => {
    mdfes.value = [
      { id: '1', chave: '31230511111111000195570010000001011234567890', numero: '000000101', serie: '001', dataEmissao: '2024-05-22', placa: 'BRA2E19', status: 'Autorizado' },
      { id: '2', chave: '31230522222222000160570020000001021987654321', numero: '000000102', serie: '002', dataEmissao: '2024-05-23', placa: 'OPQ9R01', status: 'Encerrado' },
    ]
    loading.value = false
  }, 1500)
  // try {
  //   const response = await MDFeService.getAllMDFes();
  //   mdfes.value = response.data.data; // Ajuste conforme a estrutura da sua API
  // } catch (error) {
  //   console.error("Erro ao buscar MDF-es:", error);
  // } finally {
  //   loading.value = false;
  // }
})

const novoMDFe = () => {
  console.log('Abrir formulário para novo MDF-e')
  // router.push('/mdfes/novo')
}

const editItem = (item) => {
  console.log('Editar MDF-e:', item)
  // router.push(`/mdfes/editar/${item.id}`)
}

const deleteItem = (item) => {
  console.log('Excluir MDF-e:', item)
  // Adicionar lógica de confirmação e exclusão
}
</script>
