<template>
  <div class="export" ref="rootRef">
    <button
      class="export__trigger"
      :class="{ 'export__trigger--busy': exportStore.working }"
      :aria-expanded="open"
      title="导出 / 打开文稿"
      @click="toggle"
    >
      <svg v-if="exportStore.working" class="export__spinner" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      <span class="export__trigger-text">{{ exportStore.working ? '导出中' : '导出' }}</span>
      <svg class="export__chevron" :class="{ 'export__chevron--up': open }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>

    <Transition name="menu">
      <div v-if="open" class="export__menu" role="menu">
        <button
          v-for="item in menuItems"
          :key="item.id"
          class="export__item"
          :disabled="exportStore.working"
          role="menuitem"
          @click="pick(item.id)"
        >
          <span class="export__item-icon" v-html="item.icon" />
          <span class="export__item-label">{{ item.label }}</span>
          <span class="export__item-hint">{{ item.hint }}</span>
        </button>

        <div class="export__divider" />

        <button class="export__item" :disabled="exportStore.working" role="menuitem" @click="pick('open')">
          <span class="export__item-icon" v-html="icons.open" />
          <span class="export__item-label">打开文稿…</span>
          <span class="export__item-hint">.md / .txt</span>
        </button>

        <template v-if="exportStore.history.length">
          <div class="export__divider" />
          <div class="export__records">
            <div class="export__records-title">最近导出</div>
            <div v-for="rec in recentRecords" :key="rec.id" class="export__record">
              <span class="export__record-icon" v-html="recordIcon(rec.type)" />
              <span class="export__record-name" :title="rec.label">{{ rec.label }}</span>
              <span class="export__record-meta">{{ rec.detail }} · {{ relativeTime(rec.at) }}</span>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useExportStore } from '@/stores/export'

const exportStore = useExportStore()
const emit = defineEmits(['export'])

const open = ref(false)
const rootRef = ref(null)

const I = (d, size = 15) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

const icons = {
  download: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  copy: I('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  summary: I('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>'),
  open: I('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
}

const menuItems = [
  { id: 'download', label: '下载源文件', hint: '.md', icon: icons.download },
  { id: 'copy', label: '复制源码', hint: '剪贴板', icon: icons.copy },
  { id: 'summary', label: '生成分享摘要', hint: '统计 + 大纲', icon: icons.summary },
]

const recentRecords = computed(() => exportStore.history.slice(0, 5))

function recordIcon(type) {
  return icons[type] || icons.download
}

function relativeTime(at) {
  const diff = Date.now() - at
  if (diff < 10_000) return '刚刚'
  if (diff < 60_000) return `${Math.floor(diff / 1000)} 秒前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function toggle() { open.value = !open.value }

function pick(action) {
  open.value = false
  emit('export', action)
}

function onClickOutside(e) {
  if (rootRef.value && !rootRef.value.contains(e.target)) open.value = false
}

function onKeydown(e) {
  if (e.key === 'Escape' && open.value) {
    open.value = false
    e.stopPropagation()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style lang="scss" scoped>
.export {
  position: relative;

  &__trigger {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 $sp-3;
    border: 1px solid $border;
    background: $bg-elevated;
    border-radius: $r-full;
    cursor: pointer;
    color: $text-2;
    font-size: $fs-xs;
    font-weight: 500;
    transition: all $t-fast $ease;

    &:hover {
      border-color: $accent;
      color: $accent;
      background: $accent-soft;
    }
    &:active { transform: scale(0.96); }

    &--busy {
      color: $accent;
      border-color: $accent;
      background: $accent-soft;
      cursor: progress;
    }
  }

  &__trigger-text { letter-spacing: 0.01em; }

  &__spinner {
    animation: export-spin 0.9s linear infinite;
  }

  &__chevron {
    transition: transform $t-fast $ease;
    opacity: 0.6;
    &--up { transform: rotate(180deg); }
  }

  &__menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 232px;
    background: $bg-elevated;
    border: 1px solid $border-light;
    border-radius: $r-lg;
    box-shadow: $shadow-lg;
    padding: $sp-1;
    z-index: $z-dropdown;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: $sp-2;
    width: 100%;
    padding: 7px $sp-2;
    border: none;
    background: transparent;
    border-radius: $r-md;
    cursor: pointer;
    color: $text;
    font-size: $fs-sm;
    text-align: left;
    transition: all $t-fast $ease;

    &:hover:not(:disabled) {
      background: $accent-soft;
      .export__item-icon { color: $accent; }
    }
    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  &__item-icon {
    display: flex;
    align-items: center;
    color: $text-2;
    flex-shrink: 0;
    transition: color $t-fast $ease;
  }

  &__item-label { flex: 1; }

  &__item-hint {
    font-size: $fs-xs;
    color: $text-3;
    font-family: $font-mono;
  }

  &__divider {
    height: 1px;
    background: $border-light;
    margin: $sp-1 $sp-2;
  }

  &__records {
    padding: $sp-1 $sp-2 $sp-2;

    &-title {
      font-size: $fs-xs;
      color: $text-3;
      margin-bottom: $sp-1;
      letter-spacing: 0.02em;
    }
  }

  &__record {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    font-size: $fs-xs;
    color: $text-2;

    &-icon {
      display: flex;
      color: $text-3;
      flex-shrink: 0;
      :deep(svg) { width: 12px; height: 12px; }
    }

    &-name {
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: $font-mono;
    }

    &-meta {
      margin-left: auto;
      color: $text-3;
      white-space: nowrap;
    }
  }
}

@keyframes export-spin {
  to { transform: rotate(360deg); }
}

.menu-enter-active,
.menu-leave-active {
  transition: all $t-fast $ease;
  transform-origin: top right;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
</style>
