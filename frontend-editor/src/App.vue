<template>
  <div class="app">
    <Toolbar @action="handleToolbarAction" @export="handleExportAction" />
    <EditorPane ref="editorPane" @ready="onEditorReady" />
    <StatusBar />
    <SummaryDialog
      @cancel="onSummaryCancel"
      @close="onSummaryClose"
      @copy-summary="onCopySummary"
      @download-summary="onDownloadSummary"
    />
    <input
      ref="fileInput"
      type="file"
      accept=".md,.markdown,.txt,text/markdown,text/plain"
      class="file-input"
      @change="onFilePicked"
    />
    <Transition name="toast">
      <div v-if="toast.visible" :class="['toast', `toast--${toast.type}`]">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import Toolbar from '@/components/Toolbar.vue'
import EditorPane from '@/components/EditorPane.vue'
import StatusBar from '@/components/StatusBar.vue'
import SummaryDialog from '@/components/SummaryDialog.vue'
import { useEditorStore } from '@/stores/editor'
import { useExportStore } from '@/stores/export'
import {
  EXPORT_LIMITS,
  isEmptyDocument,
  sanitizeFileName,
  downloadTextFile,
  copyTextToClipboard,
  generateShareSummary,
  readFileAsText,
  formatBytes,
  utf8Bytes
} from '@/services/exporter'

const editorPane = ref(null)
const fileInput = ref(null)
let editorView = null
let summaryAbort = null

const store = useEditorStore()
const exportStore = useExportStore()

const toast = reactive({ visible: false, message: '', type: 'info' })
let toastTimer = null

function showToast(msg, type = 'info', duration = 2000) {
  toast.message = msg; toast.type = type; toast.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.visible = false }, duration)
}

function onEditorReady(view) { editorView = view }

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

/* ================= 导出链路 ================= */

/**
 * 导出统一入口。所有分支共享三条防线：
 * 1. 空文档拦截 —— 不产生空白文件/记录
 * 2. begin() 防重入 —— 进行中的导出不接受新触发
 * 3. try/catch 兜底 —— 失败/取消均复位状态且不留记录
 */
async function handleExportAction(action) {
  if (action === 'open') {
    fileInput.value?.click()
    return
  }
  if (!editorView) return

  // 实时读取编辑器内容，保证导出内容与当前编辑状态一致
  const content = editorView.state.doc.toString()

  if (isEmptyDocument(content)) {
    showToast('文稿为空，没有什么可导出', 'warning')
    return
  }
  if (!exportStore.begin(action)) {
    showToast('正在导出中，请稍候…', 'info')
    return
  }

  try {
    if (action === 'download') await doDownload(content)
    else if (action === 'copy') await doCopy(content)
    else if (action === 'summary') await doSummary(content)
  } catch (err) {
    if (err?.name === 'AbortError') {
      // 用户取消：静默收尾，不写记录、不出文件
      exportStore.cancel()
      exportStore.closeSummary()
      exportStore.reset()
      showToast('已取消生成摘要', 'info')
    } else {
      exportStore.fail(err.message)
      if (action === 'summary') {
        // 错误在摘要对话框内展示，关闭时复位
      } else {
        showToast(err.message || '导出失败，请重试', 'error', 2600)
        exportStore.reset()
      }
    }
  }
}

async function doDownload(content) {
  const bytes = utf8Bytes(content)
  if (bytes > EXPORT_LIMITS.MAX_DOWNLOAD_BYTES) {
    throw new Error(`文稿过大（${formatBytes(bytes)}），超过下载上限 ${formatBytes(EXPORT_LIMITS.MAX_DOWNLOAD_BYTES)}`)
  }
  showToast('正在生成下载文件…', 'info', 1200)
  const fileName = sanitizeFileName(store.fileName)
  const res = downloadTextFile({ fileName, content })
  exportStore.succeed({ type: 'download', label: res.fileName, detail: formatBytes(res.bytes) })
  // 下载即落盘：磁盘文件与编辑器内容一致，清除未保存标记
  store.markSaved()
  showToast(`已下载 ${res.fileName}（${formatBytes(res.bytes)}）`, 'success', 2600)
}

async function doCopy(content) {
  if (content.length > EXPORT_LIMITS.MAX_COPY_CHARS) {
    throw new Error(`文稿过长（${content.length.toLocaleString()} 字符），请改用下载`)
  }
  await copyTextToClipboard(content)
  exportStore.succeed({
    type: 'copy',
    label: sanitizeFileName(store.fileName),
    detail: `${content.length.toLocaleString()} 字符`
  })
  showToast('源码已复制到剪贴板', 'success')
}

async function doSummary(content) {
  exportStore.openSummary()
  summaryAbort = new AbortController()
  const result = await generateShareSummary(content, {
    fileName: store.fileName,
    signal: summaryAbort.signal,
    onProgress: (p, msg) => exportStore.setProgress(p, msg)
  })
  exportStore.summaryResult = result
  // keepPhase：停留 done 态，由对话框展示结果；记录仅此一条
  exportStore.succeed(
    { type: 'summary', label: result.meta.title, detail: `${result.meta.words.toLocaleString()} 字` },
    { keepPhase: true }
  )
  summaryAbort = null
}

function onSummaryCancel() {
  summaryAbort?.abort()
}

function onSummaryClose() {
  exportStore.closeSummary()
  exportStore.reset()
  summaryAbort = null
}

async function onCopySummary() {
  const result = exportStore.summaryResult
  if (!result) return
  try {
    await copyTextToClipboard(result.text)
    showToast('摘要已复制到剪贴板', 'success')
  } catch (err) {
    showToast(err.message || '复制失败，请重试', 'error', 2600)
  }
}

function onDownloadSummary() {
  const result = exportStore.summaryResult
  if (!result) return
  try {
    const base = sanitizeFileName(store.fileName).replace(/\.(md|markdown|txt)$/i, '')
    const res = downloadTextFile({ fileName: `${base}.summary.md`, content: result.text })
    showToast(`已下载 ${res.fileName}（${formatBytes(res.bytes)}）`, 'success', 2600)
  } catch (err) {
    showToast(err.message || '下载失败，请重试', 'error', 2600)
  }
}

/* ================= 打开文稿 ================= */

async function onFilePicked(event) {
  const file = event.target.files?.[0]
  event.target.value = '' // 允许再次选择同一文件
  if (!file || !editorView) return
  try {
    const text = await readFileAsText(file)
    // 单个替换事务：可用 Ctrl+Z 撤销，编辑器插件与后续编辑不受影响
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: text }
    })
    store.setFileName(file.name)
    store.markSaved() // 内容与磁盘一致
    editorView.focus()
    showToast(`已打开 ${file.name}（Ctrl+Z 可撤销）`, 'success', 2600)
  } catch (err) {
    showToast(err.message || '文件打开失败', 'error', 2600)
  }
}
</script>

<style lang="scss" scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg;
}

.file-input {
  display: none;
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
  max-width: 80vw;

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
