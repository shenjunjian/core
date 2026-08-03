import { createVaporApp } from 'vue'

import * as PureVapor from 'vue'
import App from './App.vue'
import 'todomvc-app-css/index.css'
console.log(PureVapor, 'PureVapor')

createVaporApp(App).mount('#app')
