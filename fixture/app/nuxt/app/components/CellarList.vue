<script setup lang="ts">
// planted: code.hard-nuxt-composable (tie)
const client = useSupabase()
const { data: cellars } = await useAsyncData('cellars', async () => {
  const { data } = await client.from('cellars').select('id, name')
  return data ?? []
})
</script>

<template>
  <ul>
    <li v-for="cellar in cellars" :key="cellar.id">{{ cellar.name }}</li>
  </ul>
</template>
