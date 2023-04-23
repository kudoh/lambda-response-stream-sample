<script setup lang="ts">
const message = ref('');
const response = ref('');
const ask = async () => {
  response.value = '';
  const config = useRuntimeConfig()
  const stream = await $fetch(config.public.API_ENDPOINT, {
    method: 'POST',
    body: { message: message.value },
    responseType: 'stream'
  });
  const reader = (stream as ReadableStream).getReader();
  let done = false;
  const decoder = new TextDecoder();

  while (!done) {
    const { value, done: isDone } = await reader.read();
    if (isDone) {
      done = true;
      break;
    }
    const newData = new Uint8Array(value);
    response.value += decoder.decode(newData);
  }
}
</script>

<template>
  <div>
    <textarea v-model="message" cols="50" rows="5" style="display: block;margin-bottom: 5px"></textarea>
    <button @click="ask">送信!!</button>
    <div style="margin-top: 5px">{{ response }}</div>
  </div>
</template>

