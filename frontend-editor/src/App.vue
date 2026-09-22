<template>
  <div class="app">
    <Toolbar @action="handleToolbarAction" @export="handleExport" />
    <EditorPane ref="editorPane" @ready="onEditorReady" />
    <StatusBar />
    <SummaryDialog
      :visible="summaryDialog.visible"
      :summary="summaryDialog.text"
      :copying="summaryDialog.copying"
      @close="closeSummary"
      @copy="handleSummaryCopy"
    />
    <Transition name="toast">
      <div v-if="toast.visible" :class="['toast', `toast--${toast.type}`]">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import Toolbar from '@/components/Toolbar.vue'
import EditorPane from '@/components/EditorPane.vue'
import StatusBar from '@/components/StatusBar.vue'
import SummaryDialog from '@/components/SummaryDialog.vue'
import { useEditorStore } from '@/stores/editor'
import {
  EXPORT_LIMITS,
  isEmptyContent,
  safeFileName,
  byteSize,
  formatSize,
  hashContent,
  downloadMarkdown,
  copyText,
  buildSummary,
} from '@/utils/exporter'

const store = useEditorStore()
const editorPane = ref(null)
let editorView = null

const toast = reactive({ visible: false, message: '', type: 'info' })
let toastTimer = null

// sticky 模式用于导出进度：不自动消失，直到被结果 toast 替换
function showToast(msg, type = 'info', { sticky = false } = {}) {
  toast.message = msg; toast.type = type; toast.visible = true
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
  if (!sticky) toastTimer = setTimeout(() => { toast.visible = false }, 2400)
}

function onEditorReady(view) { editorView = view }

// === 导出管线 ===
const summaryDialog = reactive({ visible: false, text: '', copying: false })

const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
const sleep = ms => new Promise(r => setTimeout(r, ms))
// 进度提示至少展示这么久，保证用户能清楚看到「进行中」状态
const MIN_PROGRESS_MS = 450
const minDuration = t0 => {
  const rest = MIN_PROGRESS_MS - (performance.now() - t0)
  return rest > 0 ? sleep(rest) : Promise.resolve()
}

const STAGE_TEXT = {
  download: '正在生成文件…',
  copy: '正在复制到剪贴板…',
  summary: '正在生成摘要…',
}

async function handleExport(type) {
  if (!STAGE_TEXT[type]) return
  if (!editorView) {
    showToast('编辑器尚未就绪，无法导出', 'error')
    return
  }
  // 重复触发：导出进行中直接拒绝，不产生第二次导出或记录
  if (!store.beginExport()) {
    showToast('导出进行中，请稍候…', 'warning')
    return
  }
  const t0 = performance.now()
  try {
    // 始终从编辑器当前状态读取，保证导出内容与编辑状态、保存提示一致
    const content = editorView.state.doc.toString()
    const fileName = safeFileName(store.fileName)

    // 空文档：取消导出，不产生空白文件
    if (isEmptyContent(content)) {
      showToast('文档为空，已取消导出', 'warning')
      return
    }
    // 内容过长：超出上限拒绝导出，不产生异常文件
    if (type === 'download' && byteSize(content) > EXPORT_LIMITS.maxDownloadBytes) {
      showToast(`内容过长（${formatSize(byteSize(content))}，超过 ${formatSize(EXPORT_LIMITS.maxDownloadBytes)} 上限），已取消导出`, 'error')
      return
    }
    if (type === 'copy' && content.length > EXPORT_LIMITS.maxCopyChars) {
      showToast(`内容过长（${content.length} 字符，超过 ${EXPORT_LIMITS.maxCopyChars} 上限），已取消复制`, 'error')
      return
    }

    showToast(STAGE_TEXT[type], 'info', { sticky: true })
    await nextFrame()

    if (type === 'download') {
      const bytes = downloadMarkdown(content, fileName)
      // 下载即保存：清除未保存标记，与保存提示保持一致
      store.markSaved()
      store.recordExport({ type, fileName, size: bytes, hash: hashContent(content) })
      await minDuration(t0)
      showToast(`已下载 ${fileName}（${formatSize(bytes)}）`, 'success')
    } else if (type === 'copy') {
      try {
        await copyText(content)
      } catch (err) {
        await minDuration(t0)
        // 用户拒绝剪贴板授权视为取消：不写记录、不报错
        if (err?.name === 'NotAllowedError') {
          showToast('已取消复制（未授权剪贴板）', 'warning')
        } else {
          showToast(`复制失败：${err?.message || err}`, 'error')
        }
        return
      }
      store.recordExport({ type, fileName, size: content.length, hash: hashContent(content) })
      await minDuration(t0)
      showToast(`已复制 ${content.length} 字符到剪贴板`, 'success')
    } else if (type === 'summary') {
      const summary = buildSummary(content, fileName, {
        words: store.wordCount,
        chars: store.charCount,
        lines: store.lineCount,
      })
      store.recordExport({ type, fileName, size: summary.length, hash: hashContent(content) })
      await minDuration(t0)
      summaryDialog.text = summary
      summaryDialog.visible = true
      showToast('摘要已生成', 'success')
    }
  } catch (err) {
    // 导出失败：此时未触碰下载/剪贴板/记录，不会产生空白文件或残留记录
    showToast(`导出失败：${err?.message || err}`, 'error')
  } finally {
    store.endExport()
  }
}

async function handleSummaryCopy() {
  if (summaryDialog.copying || !summaryDialog.text) return
  summaryDialog.copying = true
  try {
    await copyText(summaryDialog.text)
    showToast('摘要已复制到剪贴板', 'success')
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      showToast('已取消复制（未授权剪贴板）', 'warning')
    } else {
      showToast(`复制失败：${err?.message || err}`, 'error')
    }
  } finally {
    summaryDialog.copying = false
  }
}

function closeSummary() {
  summaryDialog.visible = false
  // 焦点还给编辑器，继续原有编辑不受影响
  editorView?.focus()
}

// Ctrl/Cmd + S = 下载保存（与 markSaved 语义一致）
function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    handleExport('download')
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// === 工具栏编辑动作 ===
function insertText(before, after = '') {
  if (!editorView) return
  const { from, to } = editorView.state.selection.main
  const sel = editorView.state.sliceDoc(from, to)
  const text = `${before}${sel || 'text'}${after}`
  editorView.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + before.length, head: from + before.length + (sel || 'text').length }
  })
  editorView.focus()
}

function insertLine(prefix) {
  if (!editorView) return
  const line = editorView.state.doc.lineAt(editorView.state.selection.main.head)
  editorView.dispatch({ changes: { from: line.from, to: line.from, insert: prefix } })
  editorView.focus()
}

function handleToolbarAction(action) {
  const map = {
    bold: () => insertText('**', '**'),
    italic: () => insertText('*', '*'),
    strikethrough: () => insertText('~~', '~~'),
    code: () => insertText('`', '`'),
    link: () => insertText('[', '](url)'),
    image: () => insertText('![alt](', ')'),
    blockquote: () => insertLine('> '),
    'bullet-list': () => insertLine('- '),
    'ordered-list': () => insertLine('1. '),
    hr: () => {
      const pos = editorView.state.selection.main.head
      const line = editorView.state.doc.lineAt(pos)
      editorView.dispatch({ changes: { from: line.to, to: line.to, insert: '\n\n---\n\n' } })
      editorView.focus()
    },
  }
  const fn = map[action]
  fn ? fn() : showToast(`未知操作: ${action}`, 'warning')
}
</script>

<style lang="scss" scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg;
}

.toast {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  padding: $sp-2 $sp-5;
  border-radius: $r-full;
  font-size: $fs-sm;
  color: #fff;
  z-index: $z-toast;
  box-shadow: $shadow-lg;
  pointer-events: none;
  font-family: $font-ui;

  &--info { background: $accent; }
  &--success { background: $success; }
  &--warning { background: $warning; }
  &--error { background: $error; }
}

.toast-enter-active,
.toast-leave-active {
  transition: all $t-slow $ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
