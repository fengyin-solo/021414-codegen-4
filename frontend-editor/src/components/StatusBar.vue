<template>
  <footer class="status">
    <span class="status__item">{{ store.statusText }}</span>
    <span class="status__sep">·</span>
    <span class="status__item">Markdown</span>
    <span class="status__sep">·</span>
    <span class="status__item">UTF-8</span>
    <span class="status__sep">·</span>
    <span class="status__item status__save" :class="{ 'status__save--dirty': store.isDirty }">
      <span class="status__save-dot" />{{ store.isDirty ? '未保存' : '已保存' }}
    </span>
  </footer>
</template>

<script setup>
import { useEditorStore } from '@/stores/editor'
const store = useEditorStore()
</script>

<style lang="scss" scoped>
.status {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  gap: $sp-2;
  background: $bg-elevated;
  border-top: 1px solid $border-light;
  flex-shrink: 0;

  &__item {
    font-size: $fs-xs;
    color: $text-3;
    font-family: $font-mono;
  }

  &__sep {
    font-size: $fs-xs;
    color: $border;
  }

  &__save {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: $success;
    transition: color $t-fast $ease;

    &--dirty { color: $warning; }
  }

  &__save-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }
}
</style>
