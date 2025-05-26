<template>
  <v-container fluid>
    <v-row class="align-center mb-4">
      <v-col cols="12" md="6">
        <h1>Dashboard</h1>
      </v-col>
      <v-col cols="12" md="6">
        <v-row justify="end">
          <v-col cols="12" sm="auto">
            <v-select
              v-model="selectedPeriod"
              :items="periodOptions"
              label="Período"
              variant="outlined"
              density="compact"
              hide-details
              @update:modelValue="handlePeriodChange"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="auto" v-if="selectedPeriod === 'personalizado'">
            <v-text-field
              v-model="dateRange.start"
              label="Data Início"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              @change="fetchDashboardData"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="auto" v-if="selectedPeriod === 'personalizado'">
            <v-text-field
              v-model="dateRange.end"
              label="Data Fim"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              @change="fetchDashboardData"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <v-row v-if="!loadingCards">
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-3" outlined elevation="2">
          <div class="d-flex align-center">
            <v-avatar color="primary" size="50" class="mr-3">
              <v-icon color="white" size="x-large">mdi-file-document-multiple-outline</v-icon>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-bold">{{ cardsData.total_ctes !== null ? cardsData.total_ctes : '-' }}</div>
              <div class="text-subtitle-1">Total CT-es</div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-3" outlined elevation="2">
           <div class="d-flex align-center">
            <v-avatar color="secondary" size="50" class="mr-3">
              <v-icon color="white" size="x-large">mdi-currency-brl</v-icon>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-bold">{{ formatCurrency(cardsData.valor_total_cte) }}</div>
              <div class="text-subtitle-1">Valor Total CT-es</div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-3" outlined elevation="2">
           <div class="d-flex align-center">
            <v-avatar color="accent" size="50" class="mr-3">
              <v-icon color="white" size="x-large">mdi-truck-delivery-outline</v-icon>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-bold">{{ cardsData.total_mdfe !== null ? cardsData.total_mdfe : '-' }}</div>
              <div class="text-subtitle-1">Total MDF-es</div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
         <v-card class="pa-3" outlined elevation="2" :loading="loadingCards">
           <div class="d-flex align-center">
            <v-avatar color="info" size="50" class="mr-3">
              <v-icon color="white" size="x-large">mdi-calendar-check</v-icon>
            </v-avatar>
            <div>
              <div class="text-subtitle-2">Período dos Dados:</div>
              <div class="text-caption">
                {{ cardsData.periodo?.data_inicio ? formatDate(cardsData.periodo.data_inicio, false) : 'N/A' }}
                até
                {{ cardsData.periodo?.data_fim ? formatDate(cardsData.periodo.data_fim, false) : 'N/A' }}
              </div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>
    <v-row v-else>
        <v-col v-for="n in 4" :key="n" cols="12" sm="6" md="3">
            <v-skeleton-loader type="card-avatar, article"></v-skeleton-loader>
        </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="7">
        <v-card class="pa-2" outlined elevation="2" :loading="loadingCifFobChart">
          <v-card-title>Evolução Mensal Faturamento (CT-e)</v-card-title>
          <apexchart
            v-if="!loadingCifFobChart && cifFobChartOptions.xaxis.categories.length"
            type="bar"
            height="350"
            :options="cifFobChartOptions"
            :series="cifFobChartSeries"
          ></apexchart>
          <v-skeleton-loader v-if="loadingCifFobChart" type="image@2"></v-skeleton-loader>
           <v-alert v-if="!loadingCifFobChart && !cifFobChartOptions.xaxis.categories.length" type="info" class="ma-2">
            Sem dados para exibir no gráfico para o período selecionado.
          </v-alert>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card class="pa-2" outlined elevation="2" :loading="loadingCards">
          <v-card-title>Distribuição CIF vs FOB (Valor)</v-card-title>
          <apexchart
            v-if="!loadingCards && (cardsData.valor_cif > 0 || cardsData.valor_fob > 0)"
            type="pie"
            height="350"
            :options="pieChartOptions"
            :series="pieChartSeries"
          ></apexchart>
          <v-skeleton-loader v-if="loadingCards" type="image@2"></v-skeleton-loader>
          <v-alert v-if="!loadingCards && !(cardsData.valor_cif > 0 || cardsData.valor_fob > 0)" type="info" class="ma-2">
            Sem dados CIF/FOB para exibir no período.
          </v-alert>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12">
        <v-card outlined elevation="2" :loading="loadingLancamentos">
          <v-card-title>Últimos Lançamentos</v-card-title>
          <v-data-table
            :headers="lancamentosHeaders"
            :items="ultimosLancamentos"
            :items-per-page="5"
            density="compact"
          >
            <template v-slot:item.data_emissao="{ item }">
              {{ formatDate(item.data_emissao) }}
            </template>
            <template v-slot:item.valor_total="{ item }">
              {{ formatCurrency(item.valor_total) }}
            </template>
            <template v-slot:item.tipo="{ item }">
              <v-chip :color="item.tipo === 'CTE' ? 'blue' : 'green'" small>
                {{ item.tipo }}
              </v-chip>
            </template>
            <template v-slot:item.status="{ item }">
                <v-chip :color="getStatusColor(item.status, item.tipo)" small>
                 {{ getStatusDescription(item.status, item.tipo) }}
                </v-chip>
            </template>
          </v-data-table>
          <v-skeleton-loader v-if="loadingLancamentos" type="table-tbody@3"></v-skeleton-loader>
        </v-card>
      </v-col>
    </v-row>

  </v-container>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import VueApexCharts from 'vue3-apexcharts'; // Importar o componente ApexCharts
import dashboardService from '@/services/dashboardService';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays } from 'date-fns';

// Estado para os cards
const loadingCards = ref(true);
const cardsData = ref({
  total_ctes: null,
  valor_total_cte: null,
  valor_cif: null,
  valor_fob: null,
  total_mdfe: null,
  periodo: { data_inicio: '', data_fim: '' }
});

// Estado para últimos lançamentos
const loadingLancamentos = ref(true);
const ultimosLancamentos = ref([]);
const lancamentosHeaders = ref([
  { title: 'Tipo', key: 'tipo', sortable: false },
  { title: 'Chave/Número', key: 'chave', sortable: false, value: item => item.chave || item.numero },
  { title: 'Emissão', key: 'data_emissao' },
  { title: 'Valor', key: 'valor_total' },
  { title: 'Origem', key: 'origem', sortable: false },
  { title: 'Destino', key: 'destino', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
]);

// Estado para gráfico CIF/FOB
const loadingCifFobChart = ref(true);
const cifFobChartOptions = ref({
  chart: { id: 'cif-fob-evolution', stacked: true, toolbar: { show: true } },
  xaxis: { categories: [], title: { text: 'Mês/Ano' } },
  yaxis: { title: { text: 'Valor (R$)' }, labels: { formatter: val => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) } },
  plotOptions: { bar: { horizontal: false, columnWidth: '60%' } },
  dataLabels: { enabled: false },
  stroke: { show: true, width: 2, colors: ['transparent'] },
  tooltip: { y: { formatter: val => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) } },
  fill: { opacity: 1 },
  legend: { position: 'top' }
});
const cifFobChartSeries = ref([]);

// Estado para gráfico de Pizza CIF vs FOB
const pieChartOptions = ref({
  chart: { id: 'cif-fob-pie', type: 'pie' },
  labels: ['Valor CIF', 'Valor FOB'],
  legend: { position: 'bottom' },
  responsive: [{
    breakpoint: 480,
    options: {
      chart: { width: 200 },
      legend: { position: 'bottom' }
    }
  }],
  tooltip: { y: { formatter: val => formatCurrency(val) } }
});
const pieChartSeries = computed(() => {
  return [cardsData.value.valor_cif || 0, cardsData.value.valor_fob || 0];
});


// Filtro de período
const today = new Date();
const periodOptions = ref([
  { title: 'Mês Atual', value: 'mes' },
  { title: 'Últimos 7 dias', value: '7dias' },
  { title: 'Últimos 30 dias', value: '30dias' },
  { title: 'Trimestre Atual', value: 'trimestre' },
  { title: 'Ano Atual', value: 'ano' },
  { title: 'Personalizado', value: 'personalizado' },
]);
const selectedPeriod = ref('mes'); // Padrão: Mês atual
const dateRange = ref({
  start: format(startOfMonth(today), 'yyyy-MM-dd'),
  end: format(today, 'yyyy-MM-dd'),
});

const getRequestParams = () => {
  const params = { periodo: selectedPeriod.value };
  if (selectedPeriod.value === 'personalizado') {
    if (dateRange.value.start) params.data_inicio = dateRange.value.start;
    if (dateRange.value.end) params.data_fim = dateRange.value.end;
  }
  return params;
};

const fetchDashboardCards = async () => {
  loadingCards.value = true;
  try {
    const response = await dashboardService.getDashboardCards(getRequestParams());
    cardsData.value = response.data; // A API retorna todos os campos dos cards
  } catch (error) {
    console.error("Erro ao buscar dados dos cards:", error);
    // Tratar erro na UI, talvez com um v-alert
  } finally {
    loadingCards.value = false;
  }
};

const fetchUltimosLancamentos = async () => {
  loadingLancamentos.value = true;
  try {
    const response = await dashboardService.getUltimosLancamentos({ limit: 5 }); // Limite de 5 para o dashboard
    ultimosLancamentos.value = response.data; // A API retorna uma lista de lançamentos
  } catch (error) {
    console.error("Erro ao buscar últimos lançamentos:", error);
  } finally {
    loadingLancamentos.value = false;
  }
};

const fetchCifFobData = async () => {
  loadingCifFobChart.value = true;
  try {
    const response = await dashboardService.getCifFobData(getRequestParams());
    const data = response.data.dados; // A API retorna um array 'dados' com mes, ano, valor_cif, valor_fob, valor_total

    if (data && data.length > 0) {
        cifFobChartOptions.value = {
        ...cifFobChartOptions.value,
        xaxis: {
            categories: data.map(d => `${String(d.mes).padStart(2, '0')}/${d.ano}`),
            title: { text: 'Mês/Ano' }
        }
        };
        cifFobChartSeries.value = [
        { name: 'Valor CIF', data: data.map(d => d.valor_cif || 0) },
        { name: 'Valor FOB', data: data.map(d => d.valor_fob || 0) },
        { name: 'Valor Total', data: data.map(d => d.valor_total || 0) }
        ];
    } else {
        cifFobChartOptions.value.xaxis.categories = [];
        cifFobChartSeries.value = [];
    }
  } catch (error) {
    console.error("Erro ao buscar dados CIF/FOB:", error);
    cifFobChartOptions.value.xaxis.categories = [];
    cifFobChartSeries.value = [];
  } finally {
    loadingCifFobChart.value = false;
  }
};

const fetchDashboardData = () => {
  fetchDashboardCards();
  fetchUltimosLancamentos(); // Não depende do filtro de período no backend, mas podemos refazer a chamada
  fetchCifFobData();
};

const handlePeriodChange = (newPeriod) => {
  selectedPeriod.value = newPeriod;
  if (newPeriod !== 'personalizado') {
    // Atualizar dateRange.start e dateRange.end com base no selectedPeriod para UI,
    // mas o backend handle 'periodo' diretamente.
    // O backend já calcula as datas para períodos pré-definidos.
    // Apenas para 'personalizado' que data_inicio e data_fim são enviados.
    fetchDashboardData();
  } else {
    // Para 'personalizado', esperamos a mudança nas datas para buscar
    // Se as datas já estiverem preenchidas, busca.
    if(dateRange.value.start && dateRange.value.end) {
        fetchDashboardData();
    }
  }
};

// Funções utilitárias
const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'R$ -';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateString, includeTime = true) => {
  if (!dateString) return 'N/A';
  const date = parseISO(dateString);
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return new Date(date).toLocaleDateString('pt-BR', options);
};

const getStatusColor = (status, tipo = 'CTE') => {
  if (tipo === 'CTE') {
    switch (status) {
      case '100': return 'green'; // Autorizado
      case '101': return 'red';   // Cancelado
      default: return 'orange';   // Outros (Rejeitado, Denegado, etc.)
    }
  }
  // Adicionar lógica para MDFE se necessário
  return 'grey';
};

const getStatusDescription = (status, tipo = 'CTE') => {
  if (tipo === 'CTE') {
    // Esta função é simplificada, o backend já retorna strings de status em alguns casos.
    // O ideal seria ter um mapeamento completo ou usar o que vem do backend.
    switch (status) {
      case '100': return 'Autorizado';
      case '101': return 'Cancelado'; // Supondo que 'status' reflete cStat
      // Adicionar outros status de CT-e se 'status' for o cStat
      default: return status; // Retorna o código se não mapeado
    }
  }
  return status;
};


onMounted(() => {
  fetchDashboardData();
});

// Recarregar dados se o período selecionado mudar (exceto personalizado, que é tratado pelo @change nas datas)
watch(selectedPeriod, (newVal) => {
  if (newVal !== 'personalizado') {
    handlePeriodChange(newVal);
  }
});

</script>

<style scoped>
.v-card {
  transition: box-shadow .3s ease-in-out;
}
.v-card:hover {
  box-shadow: 0 4px 15px 0 rgba(0,0,0,0.1) !important;
}
.text-h5 {
    font-size: 1.75rem !important;
    line-height: 2rem;
}
.text-subtitle-1 {
    font-size: 0.9rem !important;
    color: #555;
}
</style>