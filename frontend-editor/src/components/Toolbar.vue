<template>
  <header class="toolbar">
    <div class="toolbar__left">
      <div class="toolbar__brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span class="toolbar__name">Mira</span>
      </div>
      <span v-if="store.isDirty" class="toolbar__dot" />
    </div>

    <nav class="toolbar__actions">
      <div class="toolbar__group" v-for="(group, gi) in actionGroups" :key="gi">
        <button
          v-for="act in group"
          :key="act.id"
          class="toolbar__btn"
          :title="act.title"
          @click="emit('action', act.id)"
          v-html="act.icon"
        />
      </div>
    </nav>

    <div class="toolbar__right">
      <div class="export">
        <button
          class="toolbar__btn"
          :title="store.exporting ? '导出中…' : '导出'"
          :disabled="store.exporting"
          @click="toggleMenu"
        >
          <svg v-if="store.exporting" class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>

        <div v-if="menuOpen" class="export__backdrop" @click="menuOpen = false" />
        <Transition name="menu">
          <div v-if="menuOpen" class="export__menu">
            <button
              v-for="item in exportItems"
              :key="item.type"
              class="export__item"
              @click="onExport(item.type)"
            >
              <span class="export__item-icon" v-html="item.icon" />
              <span class="export__item-label">{{ item.label }}</span>
              <span class="export__item-hint">{{ item.hint }}</span>
            </button>
            <div v-if="store.exportHistory.length" class="export__history">
              <div class="export__history-title">最近导出</div>
              <div v-for="rec in recentHistory" :key="rec.id" class="export__record">
                <span class="export__record-icon" v-html="typeIcon(rec.type)" />
                <span class="export__record-label">{{ typeLabel(rec.type) }}</span>
                <span class="export__record-time">{{ formatTime(rec.time) }}</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>
      <span class="toolbar__file">{{ store.fileName }}</span>
    </div>
  </header>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()
const emit = defineEmits(['action', 'export'])

const I = (d, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

const actionGroups = [
  [
    { id: 'bold', title: '粗体', icon: I('<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>') },
    { id: 'italic', title: '斜体', icon: I('<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>') },
    { id: 'strikethrough', title: '删除线', icon: I('<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/>') },
  ],
  [
    { id: 'code', title: '行内代码', icon: I('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>') },
    { id: 'link', title: '链接', icon: I('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>') },
    { id: 'image', title: '图片', icon: I('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>') },
  ],
  [
    { id: 'blockquote', title: '引用', icon: I('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/>') },
    { id: 'bullet-list', title: '无序列表', icon: I('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>') },
    { id: 'ordered-list', title: '有序列表', icon: I('<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>') },
    { id: 'hr', title: '分割线', icon: I('<line x1="2" y1="12" x2="22" y2="12"/>') },
  ],
]

// === 导出菜单 ===
const ICONS = {
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  summary: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
}

const exportItems = [
  { type: 'download', label: '下载 Markdown', hint: '.md 源文件', icon: I(ICONS.download, 14) },
  { type: 'copy', label: '复制全部内容', hint: '写入剪贴板', icon: I(ICONS.copy, 14) },
  { type: 'summary', label: '生成分享摘要', hint: '大纲 + 摘录', icon: I(ICONS.summary, 14) },
]

const TYPE_LABEL = { download: '下载', copy: '复制', summary: '摘要' }

const menuOpen = ref(false)
const recentHistory = computed(() => store.exportHistory.slice(0, 3))

function toggleMenu() {
  if (store.exporting) return
  menuOpen.value = !menuOpen.value
}

function onExport(type) {
  menuOpen.value = false
  emit('export', type)
}

const typeLabel = t => TYPE_LABEL[t] || t
const typeIcon = t => ICONS[t] ? I(ICONS[t], 12) : ''

function formatTime(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 $sp-4;
  background: $bg-elevated;
  border-bottom: 1px solid $border-light;
  user-select: none;
  flex-shrink: 0;
  z-index: $z-toolbar;

  &__left {
    display: flex;
    align-items: center;
    gap: $sp-2;
    min-width: 140px;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 6px;
    color: $text;
  }

  &__name {
    font-size: $fs-sm;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $accent;
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $sp-1;
  }

  &__group {
    display: flex;
    align-items: center;
    gap: 1px;

    & + & {
      margin-left: $sp-2;
      padding-left: $sp-2;
      border-left: 1px solid $border-light;
    }
  }

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    background: transparent;
    border-radius: $r-md;
    cursor: pointer;
    color: $text-2;
    transition: all $t-fast $ease;

    &:hover {
      background: $accent-soft;
      color: $accent;
    }
    &:active {
      transform: scale(0.93);
    }
    &:disabled {
      opacity: 0.5;
      cursor: default;
      &:hover {
        background: transparent;
        color: $text-2;
      }
    }
  }

  &__right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: $sp-2;
    min-width: 140px;
  }

  &__file {
    font-size: $fs-xs;
    color: $text-3;
    font-family: $font-mono;
  }
}

// === 导出菜单 ===
.export {
  position: relative;

  &__backdrop {
    position: fixed;
    inset: 0;
    z-index: $z-toolbar + 1;
  }

  &__menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 230px;
    background: $bg-elevated;
    border: 1px solid $border-light;
    border-radius: $r-lg;
    box-shadow: $shadow-lg;
    padding: $sp-1;
    z-index: $z-toolbar + 2;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: $sp-2;
    width: 100%;
    padding: $sp-2 $sp-3;
    border: none;
    background: transparent;
    border-radius: $r-md;
    cursor: pointer;
    color: $text;
    font-size: $fs-sm;
    text-align: left;
    transition: background $t-fast $ease;

    &:hover {
      background: $accent-soft;

      .export__item-icon { color: $accent; }
    }
  }

  &__item-icon {
    display: flex;
    color: $text-2;
    flex-shrink: 0;
    transition: color $t-fast $ease;
  }

  &__item-label { flex: 1; }

  &__item-hint {
    font-size: $fs-xs;
    color: $text-3;
  }

  &__history {
    margin-top: $sp-1;
    padding: $sp-2 $sp-3 $sp-1;
    border-top: 1px solid $border-light;
  }

  &__history-title {
    font-size: $fs-xs;
    color: $text-3;
    margin-bottom: $sp-1;
  }

  &__record {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    font-size: $fs-xs;
    color: $text-2;
  }

  &__record-icon {
    display: flex;
    color: $text-3;
  }

  &__record-label { flex: 1; }

  &__record-time {
    color: $text-3;
    font-family: $font-mono;
  }
}

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.menu-enter-active,
.menu-leave-active {
  transition: all $t-fast $ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
