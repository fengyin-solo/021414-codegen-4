/**
 * 导出服务 — 纯逻辑层
 * 负责：源文件下载、剪贴板复制、分享摘要生成、本地文件读取。
 * 不依赖 Vue / Pinia，所有边界（空文档、超长、失败、取消）在此统一抛出，
 * 由调用方（App.vue）决定如何反馈，保证不会产生空白文件或重复记录。
 */

export const EXPORT_LIMITS = {
  MAX_DOWNLOAD_BYTES: 10 * 1024 * 1024, // 下载上限 10 MB
  MAX_COPY_CHARS: 2 * 1024 * 1024,      // 复制上限 200 万字符
  MAX_SUMMARY_CHARS: 5 * 1024 * 1024,   // 摘要源文上限 5 MB
  MAX_OPEN_BYTES: 10 * 1024 * 1024,     // 打开文件上限 10 MB
  EXCERPT_CHARS: 200,                   // 摘要摘录长度
  OUTLINE_MAX: 12,                      // 大纲最大条目数
  SUMMARY_CHUNK_LINES: 200              // 摘要分块处理行数
}

/** 带错误码的导出异常，便于 UI 区分处理 */
export class ExportError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ExportError'
    this.code = code
  }
}

/** 用户主动取消（与 AbortController 配合） */
export class ExportAbortError extends Error {
  constructor(message = '已取消') {
    super(message)
    this.name = 'AbortError'
  }
}

/** 文档是否为空（纯空白字符也视为空） */
export function isEmptyDocument(content) {
  return !content || !content.trim()
}

/** 计算 UTF-8 字节数（下载前用于长度校验） */
export function utf8Bytes(text) {
  return new TextEncoder().encode(text).length
}

/** 清洗文件名：去非法字符、保证 .md 后缀、空名回退 */
export function sanitizeFileName(name, fallback = 'untitled') {
  // 去掉文件系统非法字符与控制字符
  let base = (name || '').trim().replace(/[\\\/:*?"<>|\x00-\x1f]/g, '').trim()
  if (!base) base = fallback
  if (!/\.(md|markdown|txt)$/i.test(base)) base += '.md'
  return base
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 触发浏览器下载。成功返回 { fileName, bytes }；失败抛 ExportError。
 * 任何异常都在创建 Blob 之前被捕获，不会留下空白文件。
 */
export function downloadTextFile({ fileName, content, mime = 'text/markdown;charset=utf-8' }) {
  let url = null
  try {
    const blob = new Blob([content], { type: mime })
    url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 延迟回收，确保下载已开始
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { fileName, bytes: blob.size }
  } catch (err) {
    if (url) URL.revokeObjectURL(url)
    throw new ExportError('DOWNLOAD_FAILED', `下载失败：${err.message || '浏览器拒绝了下载请求'}`)
  }
}

/**
 * 复制文本到剪贴板。优先异步 Clipboard API，失败回退 execCommand。
 */
export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // 权限被拒等情况，尝试回退方案
    }
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    ta.remove()
    if (!ok) throw new Error('execCommand rejected')
  } catch {
    throw new ExportError('COPY_FAILED', '复制失败：浏览器未授权访问剪贴板')
  }
}

/** 统计词数：中文按字、英文按词 */
function countWords(text) {
  if (!text) return 0
  const cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length
  const latin = text.replace(/[一-鿿㐀-䶿]/g, ' ').split(/\s+/).filter(Boolean).length
  return cjk + latin
}

/** 去除行内 Markdown 标记，得到纯文本（用于摘要摘录） */
function stripMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^>\s?/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^#{1,6}\s+/, '')
    .trim()
}

const pad = (n) => String(n).padStart(2, '0')

/**
 * 异步生成分享摘要：分块扫描全文（词数/段落/标题/大纲），
 * 每块结束让出主线程并回报进度，可随时通过 AbortSignal 取消。
 * 取消时抛 ExportAbortError，调用方据此静默收尾（不写记录、不出文件）。
 *
 * @param {string} content 文稿全文
 * @param {object} [opts]
 * @param {string} [opts.fileName] 当前文件名
 * @param {AbortSignal} [opts.signal] 取消信号
 * @param {(progress:number, message:string)=>void} [opts.onProgress] 进度回调 0..1
 * @returns {Promise<{text:string, meta:object}>}
 */
export async function generateShareSummary(content, { fileName = 'untitled.md', signal, onProgress } = {}) {
  if (isEmptyDocument(content)) {
    throw new ExportError('EMPTY', '文稿为空，无法生成摘要')
  }
  if (content.length > EXPORT_LIMITS.MAX_SUMMARY_CHARS) {
    throw new ExportError(
      'TOO_LONG',
      `文稿过长（${formatBytes(utf8Bytes(content))}），超过摘要上限 ${formatBytes(EXPORT_LIMITS.MAX_SUMMARY_CHARS)}`
    )
  }

  const throwIfAborted = () => { if (signal?.aborted) throw new ExportAbortError() }
  const tick = () => new Promise((r) => setTimeout(r, 16))

  const lines = content.split('\n')
  const total = lines.length
  let words = 0
  let paragraphs = 0
  let inParagraph = false
  const headings = []
  const plainParts = []
  let plainLen = 0

  for (let i = 0; i < total; i += EXPORT_LIMITS.SUMMARY_CHUNK_LINES) {
    throwIfAborted()
    const end = Math.min(i + EXPORT_LIMITS.SUMMARY_CHUNK_LINES, total)
    for (let j = i; j < end; j++) {
      const trimmed = lines[j].trim()
      if (trimmed) {
        if (!inParagraph) { paragraphs++; inParagraph = true }
      } else {
        inParagraph = false
      }
      words += countWords(trimmed)
      const hm = /^(#{1,6})\s+(.+)$/.exec(trimmed)
      if (hm) {
        headings.push({ level: hm[1].length, text: stripMarkdown(hm[2]) })
      } else if (trimmed && plainLen < EXPORT_LIMITS.EXCERPT_CHARS * 2) {
        const plain = stripMarkdown(trimmed)
        if (plain) { plainParts.push(plain); plainLen += plain.length }
      }
    }
    const pct = Math.round((end / total) * 100)
    onProgress?.((end / total) * 0.9, `正在分析文稿… ${pct}%`)
    await tick()
  }

  throwIfAborted()
  onProgress?.(0.95, '正在生成摘要…')
  await tick()
  throwIfAborted()

  const chars = content.length
  const readingMinutes = Math.max(1, Math.round(chars / 400))
  const title = headings.find((h) => h.level === 1)?.text
    || fileName.replace(/\.(md|markdown|txt)$/i, '')
  const plain = plainParts.join(' ').replace(/\s+/g, ' ').trim()
  const truncated = plain.length > EXPORT_LIMITS.EXCERPT_CHARS
  const excerpt = truncated ? `${plain.slice(0, EXPORT_LIMITS.EXCERPT_CHARS).trimEnd()} …` : plain

  const now = new Date()
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const outline = headings.slice(0, EXPORT_LIMITS.OUTLINE_MAX)

  const out = [
    `# 分享摘要 · ${title}`,
    '',
    `> 来源：${fileName} · 由 Mira 生成 · ${stamp}`,
    '',
    '## 概览',
    `- 字数：${words.toLocaleString()}`,
    `- 字符：${chars.toLocaleString()}`,
    `- 段落：${paragraphs}`,
    `- 标题：${headings.length}`,
    `- 预计阅读：约 ${readingMinutes} 分钟`
  ]
  if (outline.length) {
    out.push('', '## 大纲')
    for (const h of outline) {
      out.push(`${'  '.repeat(Math.min(h.level - 1, 3))}- ${h.text}`)
    }
    if (headings.length > outline.length) {
      out.push(`  - …（共 ${headings.length} 个标题，已省略 ${headings.length - outline.length} 个）`)
    }
  }
  if (excerpt) {
    out.push('', '## 内容摘录', '', truncated ? `${excerpt}（摘录已截断）` : excerpt)
  }
  out.push('')

  onProgress?.(1, '完成')
  return {
    text: out.join('\n'),
    meta: { title, words, chars, paragraphs, headings: headings.length, readingMinutes, truncated }
  }
}

/**
 * 读取本地文件为文本。空文件 / 超限 / 读取失败均抛 ExportError。
 */
export function readFileAsText(file, { maxBytes = EXPORT_LIMITS.MAX_OPEN_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new ExportError('NO_FILE', '未选择文件'))
    if (file.size === 0) return reject(new ExportError('EMPTY_FILE', '所选文件为空，未打开'))
    if (file.size > maxBytes) {
      return reject(new ExportError('TOO_LONG', `文件过大（${formatBytes(file.size)}），上限 ${formatBytes(maxBytes)}`))
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new ExportError('READ_FAILED', '文件读取失败，请重试'))
    reader.readAsText(file)
  })
}
