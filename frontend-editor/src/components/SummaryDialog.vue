<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="exportStore.summaryVisible" class="dialog-mask" @click.self="onMaskClick">
        <div class="dialog" role="dialog" aria-modal="true" aria-label="分享摘要">
          <header class="dialog__head">
            <div class="dialog__title-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span class="dialog__title">分享摘要</span>
            </div>
            <button class="dialog__close" :title="isWorking ? '取消生成' : '关闭'" @click="onClose">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </header>

          <!-- 进行中：进度条 + 取消 -->
          <div v-if="isWorking" class="dialog__body dialog__body--center">
            <div class="dialog__progress">
              <div class="dialog__progress-bar" :style="{ width: pct + '%' }" />
            </div>
            <p class="dialog__status">{{ exportStore.message || '正在准备…' }}</p>
            <button class="dialog__btn dialog__btn--ghost" @click="emit('cancel')">取消</button>
          </div>

          <!-- 成功：统计 + 摘要文本 + 操作 -->
          <div v-else-if="isDone && result" class="dialog__body">
            <div class="dialog__chips">
              <span class="dialog__chip">{{ result.meta.words.toLocaleString() }} 字</span>
              <span class="dialog__chip">{{ result.meta.paragraphs }} 段</span>
              <span class="dialog__chip">{{ result.meta.headings }} 个标题</span>
              <span class="dialog__chip">约 {{ result.meta.readingMinutes }} 分钟</span>
            </div>
            <pre class="dialog__summary">{{ result.text }}</pre>
            <div class="dialog__actions">
              <button class="dialog__btn dialog__btn--primary" @click="emit('copy-summary')">复制摘要</button>
              <button class="dialog__btn" @click="emit('download-summary')">下载摘要</button>
              <button class="dialog__btn dialog__btn--ghost" @click="onClose">关闭</button>
            </div>
          </div>

          <!-- 失败：错误信息 -->
          <div v-else-if="isError" class="dialog__body dialog__body--center">
            <svg class="dialog__error-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p class="dialog__error">{{ exportStore.errorMessage }}</p>
            <button class="dialog__btn dialog__btn--ghost" @click="onClose">关闭</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, watch, onBeforeUnmount } from 'vue'
import { useExportStore } from '@/stores/export'

const exportStore = useExportStore()
const emit = defineEmits(['cancel', 'close', 'copy-summary', 'download-summary'])

const isWorking = computed(() => exportStore.phase === 'working')
const isDone = computed(() => exportStore.phase === 'done')
const isError = computed(() => exportStore.phase === 'error')
const result = computed(() => exportStore.summaryResult)
const pct = computed(() => Math.round(exportStore.progress * 100))

function onClose() {
  // 进行中关闭 = 取消；其他状态 = 关闭
  if (isWorking.value) emit('cancel')
  else emit('close')
}

function onMaskClick() {
  onClose()
}

function onKeydown(e) {
  if (e.key === 'Escape' && exportStore.summaryVisible) {
    e.stopPropagation()
    onClose()
  }
}

watch(
  () => exportStore.summaryVisible,
  (visible) => {
    if (visible) document.addEventListener('keydown', onKeydown, true)
    else document.removeEventListener('keydown', onKeydown, true)
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true)
})
</script>

<style lang="scss" scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(28, 25, 23, 0.32);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: $z-modal;
  padding: $sp-5;
}

.dialog {
  width: 560px;
  max-width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: $bg-elevated;
  border-radius: $r-lg;
  box-shadow: $shadow-lg;
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $sp-3 $sp-4;
    border-bottom: 1px solid $border-light;
    flex-shrink: 0;
  }

  &__title-wrap {
    display: flex;
    align-items: center;
    gap: $sp-2;
    color: $text;
  }

  &__title {
    font-size: $fs-sm;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  &__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
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
    padding: $sp-5;
    display: flex;
    flex-direction: column;
    gap: $sp-4;
    overflow: hidden;

    &--center {
      align-items: center;
      justify-content: center;
      min-height: 180px;
      text-align: center;
    }
  }

  &__progress {
    width: 100%;
    max-width: 320px;
    height: 4px;
    background: $bg-code;
    border-radius: $r-full;
    overflow: hidden;
  }

  &__progress-bar {
    height: 100%;
    background: $accent;
    border-radius: $r-full;
    transition: width $t-normal $ease;
  }

  &__status {
    font-size: $fs-sm;
    color: $text-2;
    font-family: $font-mono;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: $sp-2;
  }

  &__chip {
    padding: 2px $sp-2;
    background: $accent-soft;
    color: $accent;
    border-radius: $r-full;
    font-size: $fs-xs;
    font-weight: 500;
  }

  &__summary {
    flex: 1;
    min-height: 160px;
    max-height: 40vh;
    overflow-y: auto;
    padding: $sp-4;
    background: $bg;
    border: 1px solid $border-light;
    border-radius: $r-md;
    font-family: $font-mono;
    font-size: $fs-xs;
    line-height: 1.7;
    color: $text-2;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: $sp-2;
  }

  &__btn {
    padding: 6px $sp-4;
    border: 1px solid $border;
    background: $bg-elevated;
    border-radius: $r-full;
    cursor: pointer;
    color: $text-2;
    font-size: $fs-sm;
    font-weight: 500;
    transition: all $t-fast $ease;

    &:hover {
      border-color: $accent;
      color: $accent;
      background: $accent-soft;
    }
    &:active { transform: scale(0.96); }

    &--primary {
      background: $accent;
      border-color: $accent;
      color: #fff;

      &:hover {
        background: darken($accent, 6%);
        color: #fff;
      }
    }

    &--ghost {
      border-color: transparent;
      color: $text-3;

      &:hover {
        border-color: $border;
        color: $text-2;
        background: transparent;
      }
    }
  }

  &__error-icon { color: $error; }

  &__error {
    font-size: $fs-sm;
    color: $text-2;
    max-width: 380px;
    word-break: break-word;
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
    transform: translateY(10px) scale(0.98);
  }
}
</style>
