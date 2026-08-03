<script setup vapor>
import { ref } from 'vue'

const show = ref('todos')
</script>

<template>
  <section class="todoapp">{{ show }} i render to page</section>
</template>
