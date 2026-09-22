/**
 * 导出工具集 —— 纯函数模块，不持有编辑器实例。
 * 所有函数只读取内容，绝不修改编辑器状态，保证既有编辑（撤销历史、选区、焦点）不受影响。
 */

// 导出限制：超出上限时拒绝导出，避免产生异常文件或卡死剪贴板
export const EXPORT_LIMITS = {
  maxDownloadBytes: 5 * 1024 * 1024, // 下载文件最大 5MB
  maxCopyChars: 1000000,             // 剪贴板最多 100 万字符
  summaryExcerptChars: 200,          // 分享摘要的正文摘录长度
  summaryMaxHeadings: 8,             // 分享摘要的大纲最大条目数
}

/** UTF-8 字节数 */
export function byteSize(text) {
  return new Blob([text]).size
}

/** 简单字符串 hash（djb2），用于导出记录去重 */
export function hashContent(text) {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

/** 清洗文件名：去掉非法字符、兜底默认名、保证 .md 后缀 */
export function safeFileName(name) {
  const base = String(name || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim() || 'untitled'
  return base.toLowerCase().endsWith('.md') ? base : `${base}.md`
}

/** 空文档判定：空串或纯空白都视为空，不允许产生空白文件 */
export function isEmptyContent(content) {
  return !content || !content.trim()
}

/** 人类可读的大小 */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 触发浏览器下载 .md 源文件。
 * 仅在内容校验通过后调用；Blob 构建失败时抛错，此时不会触碰 DOM，不会留下空白文件。
 * @returns {number} 实际写入的字节数
 */
export function downloadMarkdown(content, fileName) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  if (blob.size === 0) throw new Error('内容为空，拒绝生成空白文件')
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // 延迟回收，确保浏览器已接管下载
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return blob.size
}

/**
 * 复制文本到剪贴板（带 execCommand 降级）。
 * 用户拒绝授权时抛 NotAllowedError，由调用方按「用户取消」处理。
 */
export async function copyText(text) {
  if (!text) throw new Error('没有可复制的内容')
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
  document.body.appendChild(ta)
  ta.select()
  try {
    if (!document.execCommand('copy')) throw new Error('浏览器拒绝了复制操作')
  } finally {
    ta.remove()
  }
}

/**
 * 生成分享摘要（Markdown 文本）。
 * 无论原文多长，摘要长度始终有界：大纲最多 N 条，摘录超长自动截断并标注。
 */
export function buildSummary(content, fileName, stats = {}) {
  const lines = content.split('\n')
  const headings = []
  const paragraphLines = []
  let inFence = false

  for (const line of lines) {
    const t = line.trim()
    if (/^(```|~~~)/.test(t)) { inFence = !inFence; continue }
    if (inFence || !t) continue
    const m = t.match(/^(#{1,6})\s+(.+)$/)
    if (m) {
      if (headings.length < EXPORT_LIMITS.summaryMaxHeadings) {
        headings.push({ level: m[1].length, text: m[2].trim() })
      }
      continue
    }
    // 摘录只取普通段落，跳过引用 / 列表 / 表格 / 图片 / 分割线
    if (paragraphLines.length >= 5) continue
    if (/^(>|[-*+]\s|\d+[.)]\s|\||!\[|[-*_]{3,}$)/.test(t)) continue
    paragraphLines.push(t)
  }

  const title = headings.length ? headings[0].text : fileName.replace(/\.md$/i, '')

  let excerpt = paragraphLines.join(' ')
  let truncated = false
  if (excerpt.length > EXPORT_LIMITS.summaryExcerptChars) {
    excerpt = excerpt.slice(0, EXPORT_LIMITS.summaryExcerptChars).trimEnd()
    truncated = true
  }

  const outline = headings.length
    ? headings.map(h => `${'  '.repeat(h.level - 1)}- ${h.text}`).join('\n')
    : '（无标题）'

  return [
    `# ${title}`,
    '',
    '> 由 Mira 生成的分享摘要',
    '',
    `- 文件：${fileName}`,
    `- 统计：${stats.words ?? 0} 词 · ${stats.chars ?? 0} 字符 · ${stats.lines ?? 0} 行`,
    `- 时间：${new Date().toLocaleString()}`,
    '',
    '## 大纲',
    '',
    outline,
    '',
    '## 摘录',
    '',
    excerpt ? excerpt + (truncated ? ' …（正文过长，已截断）' : '') : '（无正文）',
    '',
  ].join('\n')
}
