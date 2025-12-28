import { createApp, watch, type Ref } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setNavigationRouter } from './services/navigation'
import { i18n } from './i18n'

import './assets/main.css'

const LOCALE_STORAGE_KEY = 'logistics.locale'
const SUPPORTED_LOCALES = new Set(['en-US', 'zh-TW'])

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.use(router)
setNavigationRouter(router)

const globalLocale = i18n.global.locale as unknown as Ref<string>

const loadSavedLocale = () => {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    return raw && SUPPORTED_LOCALES.has(raw) ? raw : null
  } catch {
    return null
  }
}

const persistLocale = (next: string) => {
  try {
    if (!SUPPORTED_LOCALES.has(next)) return
    localStorage.setItem(LOCALE_STORAGE_KEY, next)
  } catch {
    // ignore
  }
}

const applyDocumentLang = (next: string) => {
  try {
    document.documentElement.lang = next
  } catch {
    // ignore
  }
}

const savedLocale = loadSavedLocale()
if (savedLocale) globalLocale.value = savedLocale
applyDocumentLang(globalLocale.value)
watch(globalLocale, (next) => {
  persistLocale(next)
  applyDocumentLang(next)
})

app.mount('#app')
