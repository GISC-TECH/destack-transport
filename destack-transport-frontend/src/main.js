import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import VueApexCharts from "vue3-apexcharts";
// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components' // Necessário se autoImport não funcionar perfeitamente para todos os casos
import * as directives from 'vuetify/directives' // Necessário se autoImport não funcionar perfeitamente para todos os casos
import '@mdi/font/css/materialdesignicons.css' // Ícones Material Design

// Opcional: se você tiver um arquivo de variáveis SASS
// import './styles/variables.scss'

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
  },
  theme: {
    defaultTheme: 'light', // ou 'dark'
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#0D47A1', // Exemplo de cor primária (Azul Escuro Destack)
          secondary: '#1565C0', // Exemplo de cor secundária (Azul Médio Destack)
          accent: '#1E88E5', // Exemplo de cor de destaque (Azul Claro Destack)
          error: '#B71C1C',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FB8C00',
          // Adicione suas cores personalizadas
          // background: '#FFFFFF',
          // surface: '#FFFFFF',
        }
      },
      // dark: {
      //   dark: true,
      //   colors: {
      //     primary: '#1E88E5',
      //     // ...
      //   }
      // }
    }
  }
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(vuetify)
app.use(VueApexCharts)

app.mount('#app')
