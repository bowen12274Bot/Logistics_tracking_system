import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setNavigationRouter } from './services/navigation'

import './assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
setNavigationRouter(router)
app.mount('#app')
