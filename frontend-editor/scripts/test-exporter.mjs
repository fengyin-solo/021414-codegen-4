/**
 * exporter.js 纯逻辑边界测试（node 直接运行）
 * 覆盖：空文档 / 超长 / 取消 / 进度回调 / 文件名清洗 / 字节格式化
 */
import {
  EXPORT_LIMITS,
  isEmptyDocument,
  sanitizeFileName,
  formatBytes,
  utf8Bytes,
  generateShareSummary
} from '../src/services/exporter.js'

let passed = 0
let failed = 0

function assert(cond, name, extra = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name} ${extra}`) }
}

console.log('— isEmptyDocument —')
assert(isEmptyDocument('') === true, '空字符串为空')
assert(isEmptyDocument('   \n\t  ') === true, '纯空白字符为空')
assert(isEmptyDocument(null) === true, 'null 为空')
assert(isEmptyDocument('# hi') === false, '有内容不为空')

console.log('— sanitizeFileName —')
assert(sanitizeFileName('note') === 'note.md', '无后缀补 .md')
assert(sanitizeFileName('a/b:c*d?.md') === 'abcd.md', '非法字符被清除')
assert(sanitizeFileName('') === 'untitled.md', '空名回退 untitled')
assert(sanitizeFileName('  ') === 'untitled.md', '空白名回退 untitled')
assert(sanitizeFileName('doc.markdown') === 'doc.markdown', '保留 .markdown 后缀')
assert(sanitizeFileName('x.txt') === 'x.txt', '保留 .txt 后缀')

console.log('— formatBytes / utf8Bytes —')
assert(formatBytes(0) === '0 B', '0 字节')
assert(formatBytes(512) === '512 B', '字节级')
assert(formatBytes(2048) === '2.0 KB', 'KB 级')
assert(formatBytes(3 * 1024 * 1024) === '3.00 MB', 'MB 级')
assert(utf8Bytes('abc') === 3, 'ASCII 字节数')
assert(utf8Bytes('中文') === 6, '中文 UTF-8 字节数')

console.log('— generateShareSummary: 空文档 —')
try {
  await generateShareSummary('   \n  ')
  assert(false, '空文档应抛错')
} catch (e) {
  assert(e.code === 'EMPTY', '空文档抛 EMPTY', `got ${e.code}`)
}

console.log('— generateShareSummary: 超长 —')
try {
  await generateShareSummary('x'.repeat(EXPORT_LIMITS.MAX_SUMMARY_CHARS + 1))
  assert(false, '超长应抛错')
} catch (e) {
  assert(e.code === 'TOO_LONG', '超长抛 TOO_LONG', `got ${e.code}`)
}

console.log('— generateShareSummary: 正常生成 + 进度 —')
{
  const doc = [
    '# 我的文稿', '',
    '这是一段**加粗**的中文内容，用来测试摘要生成。', '',
    '## 第一章', '',
    'Hello world, this is a paragraph with `code` and [link](https://a.b).', '',
    '## 第二章', '',
    '> 引用一段文字', '',
    '- 列表项一', '- 列表项二'
  ].join('\n')
  const progressCalls = []
  const result = await generateShareSummary(doc, {
    fileName: 'test.md',
    onProgress: (p, msg) => progressCalls.push(p)
  })
  assert(result.meta.title === '我的文稿', '标题取自首个 H1', `got ${result.meta.title}`)
  assert(result.meta.headings === 3, '统计到 3 个标题', `got ${result.meta.headings}`)
  assert(result.meta.paragraphs > 0, '段落数大于 0')
  assert(result.meta.words > 0, '词数大于 0')
  assert(result.text.includes('## 大纲'), '包含大纲')
  assert(result.text.includes('## 概览'), '包含概览')
  assert(result.text.includes('## 内容摘录'), '包含摘录')
  assert(!result.text.includes('**'), '摘录已去除 Markdown 标记')
  assert(progressCalls.length > 0 && progressCalls.at(-1) === 1, '进度回调单调到 1')
}

console.log('— generateShareSummary: 长文档摘录截断 —')
{
  const longPara = '很长的段落。'.repeat(200)
  const result = await generateShareSummary(`# T\n\n${longPara}`)
  assert(result.meta.truncated === true, '标记已截断')
  assert(result.text.includes('（摘录已截断）'), '摘录带截断说明')
}

console.log('— generateShareSummary: 取消 —')
{
  const bigDoc = Array.from({ length: 5000 }, (_, i) => `第 ${i} 行内容 blah blah`).join('\n')
  const ac = new AbortController()
  let progressCount = 0
  const p = generateShareSummary(bigDoc, {
    signal: ac.signal,
    onProgress: () => { progressCount++; if (progressCount === 2) ac.abort() }
  })
  try {
    await p
    assert(false, '取消后应抛 AbortError')
  } catch (e) {
    assert(e.name === 'AbortError', '取消抛 AbortError', `got ${e.name}`)
  }
}

console.log('— generateShareSummary: 预取消信号 —')
{
  const ac = new AbortController()
  ac.abort()
  try {
    await generateShareSummary('# t\n\ncontent', { signal: ac.signal })
    assert(false, '预取消应抛 AbortError')
  } catch (e) {
    assert(e.name === 'AbortError', '预取消抛 AbortError', `got ${e.name}`)
  }
}

console.log(`\n结果：${passed} 通过，${failed} 失败`)
process.exit(failed ? 1 : 0)
