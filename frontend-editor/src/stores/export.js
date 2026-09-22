import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

let recordSeq = 0

/**
 * 导出状态机：
 *   idle → working → (done | error | cancelled) → idle
 * - begin() 防重入：working 期间拒绝新的导出，杜绝重复触发/重复记录
 * - 历史记录只写入成功项；失败与取消不留痕
 */
export const useExportStore = defineStore('export', () => {
  const phase = ref('idle')        // idle | working | done | error | cancelled
  const action = ref(null)         // download | copy | summary
  const progress = ref(0)          // 0..1
  const message = ref('')          // 进度描述
  const errorMessage = ref('')
  const history = ref([])          // 仅成功记录 { id, type, label, detail, at }
  const summaryVisible = ref(false)
  const summaryResult = ref(null)  // { text, meta }

  const working = computed(() => phase.value === 'working')

  /** 开始一次导出；已有导出进行中则返回 false（防重复触发） */
  function begin(act) {
    if (working.value) return false
    phase.value = 'working'
    action.value = act
    progress.value = 0
    message.value = ''
    errorMessage.value = ''
    summaryResult.value = null
    return true
  }

  function setProgress(p, msg) {
    progress.value = Math.min(1, Math.max(0, p))
    if (msg) message.value = msg
  }

  /**
   * 导出成功：写入历史记录。
   * keepPhase=true 时停留 done 态（摘要对话框展示结果），否则直接回 idle。
   */
  function succeed(record, { keepPhase = false } = {}) {
    history.value.unshift({ id: ++recordSeq, at: Date.now(), ...record })
    if (history.value.length > 20) history.value.length = 20
    progress.value = 1
    if (keepPhase) {
      phase.value = 'done'
    } else {
      phase.value = 'idle'
      action.value = null
    }
  }

  /** 导出失败：进入 error 态（摘要对话框内展示），不写记录 */
  function fail(msg) {
    errorMessage.value = msg || '导出失败，请重试'
    phase.value = 'error'
  }

  /** 用户取消：进入 cancelled 态，不写记录 */
  function cancel() {
    phase.value = 'cancelled'
  }

  /** 复位到 idle（关闭对话框 / 反馈展示完毕后调用） */
  function reset() {
    phase.value = 'idle'
    action.value = null
    progress.value = 0
    message.value = ''
    errorMessage.value = ''
  }

  function openSummary() { summaryVisible.value = true }
  function closeSummary() { summaryVisible.value = false }

  return {
    phase, action, progress, message, errorMessage,
    history, working, summaryVisible, summaryResult,
    begin, setProgress, succeed, fail, cancel, reset,
    openSummary, closeSummary
  }
})
