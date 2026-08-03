import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { INITIAL_DOCUMENT_KEY, loadInitialDocument } from './workbench/documentPersistence'

const initialDocument = await loadInitialDocument()
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.provide(INITIAL_DOCUMENT_KEY, initialDocument)

app.mount('#app')
