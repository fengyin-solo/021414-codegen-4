<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="dialog-backdrop" @click.self="emit('close')">
        <div class="dialog" role="dialog" aria-modal="true" aria-label="分享摘要">
          <header class="dialog__head">
            <h2 class="dialog__title">分享摘要</h2>
            <button class="dialog__close" title="关闭" @click="emit('close')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </header>
          <pre class="dialog__body">{{ summary }}</pre>
          <footer class="dialog__foot">
            <span class="dialog__meta">{{ summary.length }} 字符</span>
            <button class="btn btn--ghost" @click="emit('close')">取消</button>
            <button class="btn btn--primary" :disabled="copying" @click="emit('copy')">
              {{ copying ? '复制中…' : '复制摘要' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'

defineProps({
  visible: Boolean,
  summary: { type: String, default: '' },
  copying: Boolean,
})
const emit = defineEmits(['close', 'copy'])

// Esc 关闭（取消操作）：只关闭弹窗，不产生任何文件或记录
function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style lang="scss" scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(28, 25, 23, 0.32);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: $z-dialog;
}

.dialog {
  display: flex;
  flex-direction: column;
  width: min(560px, 90vw);
  max-height: 80vh;
  background: $bg-elevated;
  border-radius: $r-lg;
  box-shadow: $shadow-lg;
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $sp-4 $sp-5;
    border-bottom: 1px solid $border-light;
    flex-shrink: 0;
  }

  &__title {
    font-size: $fs-base;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  &__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: $r-md;
    cursor: pointer;
    color: $text-3;
    transition: all $t-fast $ease;

    &:hover {
      background: $accent-soft;
      color: $accent;
    }
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: $sp-4 $sp-5;
    font-family: $font-mono;
    font-size: $fs-sm;
    line-height: 1.7;
    color: $text-2;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: $sp-2;
    padding: $sp-3 $sp-5;
    border-top: 1px solid $border-light;
    flex-shrink: 0;
  }

  &__meta {
    flex: 1;
    font-size: $fs-xs;
    color: $text-3;
    font-family: $font-mono;
  }
}

.btn {
  padding: $sp-2 $sp-4;
  border-radius: $r-md;
  font-size: $fs-sm;
  font-weight: 500;
  cursor: pointer;
  transition: all $t-fast $ease;

  &--ghost {
    border: 1px solid $border;
    background: transparent;
    color: $text-2;

    &:hover { background: $bg-code; }
  }

  &--primary {
    border: none;
    background: $accent;
    color: #fff;

    &:hover { filter: brightness(1.08); }
    &:disabled {
      opacity: 0.5;
      cursor: default;
      &:hover { filter: none; }
    }
  }
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity $t-normal $ease;

  .dialog {
    transition: all $t-normal $ease;
  }
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;

  .dialog {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}
</style>
