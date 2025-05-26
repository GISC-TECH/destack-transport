<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>Upload de Documentos XML</h1>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card class="pa-4" outlined>
          <v-card-title>Enviar Arquivos XML</v-card-title>
          <v-card-text>
            <v-file-input
              v-model="selectedFiles"
              label="Selecionar arquivos XML (múltiplos)"
              accept=".xml"
              show-size
              prepend-icon="mdi-file-xml-box"
              variant="outlined"
              multiple
              chips
              counter
              :error-messages="fileGlobalError"
              @change="clearFileGlobalError"
            ></v-file-input>
            <v-btn
              color="primary"
              @click="handleUploadMultipleFiles"
              :loading="isUploading"
              :disabled="!selectedFiles.length || isUploading"
              class="mt-4"
            >
              <v-icon left>mdi-upload-multiple</v-icon>
              Enviar Selecionados ({{ selectedFiles.length }})
            </v-btn>

            <div v-if="uploadProgresses.length" class="mt-4">
              <h3 class="mb-2">Progresso dos Uploads:</h3>
              <div v-for="fileProgress in uploadProgresses" :key="fileProgress.name" class="mb-2">
                <p class="text-subtitle-2">{{ fileProgress.name }} - {{ fileProgress.status }}</p>
                <v-progress-linear
                  :model-value="fileProgress.percentage"
                  :color="fileProgress.error ? 'error' : (fileProgress.percentage === 100 && !fileProgress.processing ? 'success' : 'primary')"
                  height="20"
                  rounded
                  stream
                >
                  <template v-slot:default="{ value }">
                    <strong v-if="!fileProgress.error && !fileProgress.processing">{{ Math.ceil(value) }}%</strong>
                    <strong v-if="fileProgress.processing">Processando...</strong>
                     <span v-if="fileProgress.error" class="text-caption white--text">Erro</span>
                  </template>
                </v-progress-linear>
                <small v-if="fileProgress.message" :class="fileProgress.error ? 'text-error' : 'text-success'">
                  {{ fileProgress.message }}
                </small>
              </div>
            </div>

          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-6">
      <v-col cols="12">
        <v-card outlined>
          <v-card-title>
            Histórico de Uploads
            <v-spacer></v-spacer>
            <v-btn icon @click="fetchUploads" :loading="loadingUploads">
              <v-icon>mdi-refresh</v-icon>
              <v-tooltip activator="parent" location="top">Atualizar Lista</v-tooltip>
            </v-btn>
          </v-card-title>
          <v-data-table
            :headers="uploadHeaders"
            :items="uploads"
            :loading="loadingUploads"
            :items-per-page="itemsPerPage"
            :page="currentPage"
            @update:page="updatePage"
            class="elevation-1"
          >
            <template v-slot:item.data_upload="{ item }">
              {{ formatDate(item.data_upload) }}
            </template>
            <template v-slot:item.status="{ item }">
              <v-chip :color="getStatusColor(item.status)" small>
                {{ item.status }}
              </v-chip>
            </template>
             <template v-slot:item.actions="{ item }">
              <v-btn icon="mdi-eye" variant="text" density="comfortable" @click="showDetails(item)">
                 <v-tooltip activator="parent" location="top">Ver Detalhes</v-tooltip>
              </v-btn>
            </template>
            <template v-slot:loading>
              <v-skeleton-loader type="table-tbody"></v-skeleton-loader>
            </template>
            <template v-slot:no-data>
              <v-alert :value="true" color="info" icon="mdi-information-outline">
                Nenhum upload encontrado.
              </v-alert>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="detailsDialog" max-width="600px">
      <v-card>
        <v-card-title>
          <span class="text-h5">Detalhes do Upload</span>
        </v-card-title>
        <v-card-text v-if="selectedUploadDetails">
          <p><strong>ID:</strong> {{ selectedUploadDetails.id }}</p>
          <p><strong>Nome do Arquivo:</strong> {{ selectedUploadDetails.nome_arquivo }}</p>
          <p><strong>Data do Upload:</strong> {{ formatDate(selectedUploadDetails.data_upload) }}</p>
          <p><strong>Status:</strong> <v-chip :color="getStatusColor(selectedUploadDetails.status)" small>{{ selectedUploadDetails.status }}</v-chip></p>
          <p><strong>Chave Processada:</strong> {{ selectedUploadDetails.chave_doc_processado || 'N/A' }}</p>
          <p><strong>Detalhes do Processamento:</strong></p>
          <v-textarea
            readonly
            auto-grow
            variant="outlined"
            rows="3"
            :model-value="selectedUploadDetails.detalhes_processamento || 'Sem detalhes adicionais.'"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="detailsDialog = false">Fechar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import uploadService from '@/services/uploadService';

const selectedFiles = ref([]); // Alterado para array para múltiplos arquivos
const fileGlobalError = ref('');
const isUploading = ref(false); // Flag geral para o processo de batch

// Para progresso individual dos arquivos
const uploadProgresses = ref([]); // Array de objetos { name, percentage, status, message, error, processing }

const uploads = ref([]);
const loadingUploads = ref(true);
const uploadHeaders = ref([
  { title: 'Nome do Arquivo', key: 'nome_arquivo', sortable: true },
  { title: 'Data do Upload', key: 'data_upload', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Chave Processada', key: 'chave_doc_processado', sortable: false },
  { title: 'Ações', key: 'actions', sortable: false, align: 'center' },
]);
const itemsPerPage = ref(10);
const currentPage = ref(1);
const totalUploads = ref(0);

const detailsDialog = ref(false);
const selectedUploadDetails = ref(null);

const clearFileGlobalError = () => {
  fileGlobalError.value = '';
};

const handleUploadMultipleFiles = async () => {
  if (!selectedFiles.value.length) {
    fileGlobalError.value = 'Por favor, selecione um ou mais arquivos XML.';
    return;
  }

  const invalidFiles = selectedFiles.value.filter(file => !file.name.toLowerCase().endsWith('.xml'));
  if (invalidFiles.length > 0) {
    fileGlobalError.value = `Os seguintes arquivos não são XML: ${invalidFiles.map(f => f.name).join(', ')}`;
    return;
  }

  fileGlobalError.value = '';
  isUploading.value = true;
  uploadProgresses.value = selectedFiles.value.map(file => ({
    name: file.name,
    percentage: 0,
    status: 'Aguardando envio...',
    message: '',
    error: false,
    processing: false, // Adicionado para indicar processamento no backend
  }));

  for (let i = 0; i < selectedFiles.value.length; i++) {
    const file = selectedFiles.value[i];
    const progressIndex = i; // uploadProgresses.value.findIndex(p => p.name === file.name);

    try {
      uploadProgresses.value[progressIndex].status = 'Enviando...';
      uploadProgresses.value[progressIndex].percentage = 0; // Reset percentage for new file

      const response = await uploadService.uploadSingleFile(file, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        uploadProgresses.value[progressIndex].percentage = percentCompleted;
      });

      uploadProgresses.value[progressIndex].percentage = 100; // Garante 100% no final do upload HTTP
      uploadProgresses.value[progressIndex].status = 'Enviado, aguardando processamento...';
      uploadProgresses.value[progressIndex].message = `${response.data.message} (ID: ${response.data.id})`;
      uploadProgresses.value[progressIndex].error = false;
      uploadProgresses.value[progressIndex].processing = true; // Indica que o backend está processando

      // Simular um delay para o processamento do backend ou idealmente usar polling/websockets
      // Para demonstração, vamos apenas marcar como processado após um tempo
      // Em um cenário real, você atualizaria o status baseado na lista de uploads.
      // Ou o endpoint single poderia retornar o estado final se fosse síncrono (o que não é o caso aqui).
      // Por ora, o usuário precisará atualizar a lista de histórico manualmente.

    } catch (error) {
      uploadProgresses.value[progressIndex].status = 'Erro no envio';
      uploadProgresses.value[progressIndex].message = error.response?.data?.error || 'Erro desconhecido ao enviar arquivo.';
      uploadProgresses.value[progressIndex].error = true;
      uploadProgresses.value[progressIndex].percentage = 100; // Indica que a tentativa de upload terminou
      console.error(`Erro no upload de ${file.name}:`, error);
    } finally {
        // Não setar processing para false aqui, pois o processamento do backend é assíncrono.
        // O status "CONCLUIDO" ou "ERRO" virá da atualização da lista de Histórico de Uploads.
    }
  }
  isUploading.value = false;
  selectedFiles.value = []; // Limpa seleção após tentativa de todos os uploads
  // Sugerir atualização da lista após um tempo
  setTimeout(() => {
    fetchUploads(); // Atualiza a lista para pegar os status finais.
     uploadProgresses.value.forEach(p => p.processing = false); // Assume que após um tempo, o processamento terminou.
  }, 5000); // Ajuste este tempo ou implemente uma estratégia melhor
};


const fetchUploads = async () => {
  loadingUploads.value = true;
  try {
    const response = await uploadService.listUploads(currentPage.value, itemsPerPage.value);
    uploads.value = response.data.data;
    totalUploads.value = response.data.meta.total;
  } catch (error) {
    console.error('Erro ao buscar uploads:', error);
    uploads.value = [];
  } finally {
    loadingUploads.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleString('pt-BR', options);
};

const getStatusColor = (status) => {
  switch (status?.toUpperCase()) {
    case 'PENDENTE': return 'orange';
    case 'CONCLUIDO': return 'green';
    case 'PROCESSADO': return 'green'; // Alias para CONCLUIDO se vier do backend
    case 'ERRO': return 'red';
    default: return 'grey';
  }
};

const updatePage = (page) => {
  currentPage.value = page;
  fetchUploads();
};

const showDetails = async (item) => {
  try {
    const response = await uploadService.getUploadDetails(item.id);
    selectedUploadDetails.value = response.data;
    detailsDialog.value = true;
  } catch (error) {
    console.error('Erro ao buscar detalhes do upload:', error);
    // Adicionar feedback de erro
  }
};

onMounted(() => {
  fetchUploads();
});

</script>

<style scoped>
.text-caption {
  font-size: 0.75rem !important;
}
.white--text { /* Para Vuetify 3, use classes CSS ou inline style se necessário */
  color: white !important;
}
</style>