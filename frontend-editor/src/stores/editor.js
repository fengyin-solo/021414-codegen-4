import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useEditorStore = defineStore('editor', () => {
  const content = ref('')
  const fileName = ref('untitled.md')
  const isDirty = ref(false)
  const wordCount = ref(0)
  const charCount = ref(0)
  const lineCount = ref(0)
  const cursorLine = ref(1)
  const cursorCol = ref(1)

  // === 导出状态 ===
  const exporting = ref(false)
  // 导出记录（仅成功导出才写入），新记录在前，最多保留 20 条
  const exportHistory = ref([])

  /**
   * 尝试开始一次导出。进行中时返回 false，调用方应拒绝重复触发。
   */
  function beginExport() {
    if (exporting.value) return false
    exporting.value = true
    return true
  }

  function endExport() {
    exporting.value = false
  }

  /**
   * 记录一次成功导出。
   * 与最近一条记录完全相同（同类型、同内容 hash、同文件名）时只刷新时间，
   * 不追加新记录 —— 重复触发不会产生重复记录。
   */
  function recordExport({ type, fileName, size, hash }) {
    const last = exportHistory.value[0]
    if (last && last.type === type && last.hash === hash && last.fileName === fileName) {
      last.time = Date.now()
      return last
    }
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      fileName,
      size,
      hash,
      time: Date.now(),
    }
    exportHistory.value.unshift(record)
    if (exportHistory.value.length > 20) exportHistory.value.pop()
    return record
  }

  const statusText = computed(() => {
    return `Ln ${cursorLine.value}, Col ${cursorCol.value} | ${wordCount.value} words | ${charCount.value} chars`
  })

  function updateContent(newContent) {
    content.value = newContent
    isDirty.value = true
    // Update stats
    charCount.value = newContent.length
    lineCount.value = newContent.split('\n').length
    wordCount.value = newContent.trim() ? newContent.trim().split(/\s+/).length : 0
  }

  function updateCursor(line, col) {
    cursorLine.value = line
    cursorCol.value = col
  }

  function setFileName(name) {
    fileName.value = name
  }

  function markSaved() {
    isDirty.value = false
  }

  return {
    content,
    fileName,
    isDirty,
    wordCount,
    charCount,
    lineCount,
    cursorLine,
    cursorCol,
    statusText,
    exporting,
    exportHistory,
    beginExport,
    endExport,
    recordExport,
    updateContent,
    updateCursor,
    setFileName,
    markSaved
  }
})
