/**
 * format-json.mjs — 紧凑 JSON 格式化处理器
 *
 * 规则：
 *  - 顶层数组/对象保留 2 空格缩进展开
 *  - 叶级数组/对象（所有子项均为原始值或扁平对象）
 *    序列化后 <= INLINE_THRESHOLD 字符时，单行内联显示
 *  - 格式化后写回原文件，不改变数据内容
 *
 * 用法：
 *  node scripts/format-json.mjs              # 处理 src/config/*.json
 *  node scripts/format-json.mjs path/a.json  # 处理指定文件
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INLINE_THRESHOLD = 72; // 单行内联的最大字符数

// ─── 核心：紧凑 stringify ────────────────────────────────────────────────────

/**
 * 判断一个值是否"扁平"（仅含原始值，无嵌套数组/对象）。
 */
function isFlat(value) {
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) {
    return value.every((v) => v === null || typeof v !== 'object');
  }
  return Object.values(value).every((v) => v === null || typeof v !== 'object');
}

/**
 * 递归紧凑 stringify。
 * @param {unknown} value
 * @param {number} depth 当前缩进深度
 * @returns {string}
 */
function compactStringify(value, depth = 0) {
  const indent = '  '.repeat(depth);
  const childIndent = '  '.repeat(depth + 1);

  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';

    // 尝试单行
    if (value.every(isFlat)) {
      const inline = '[' + value.map((v) => compactStringify(v, 0)).join(', ') + ']';
      if (inline.length <= INLINE_THRESHOLD) return inline;
    }

    // 多行
    const items = value.map((v) => childIndent + compactStringify(v, depth + 1));
    return '[\n' + items.join(',\n') + '\n' + indent + ']';
  }

  // 对象
  const keys = Object.keys(value);
  if (keys.length === 0) return '{}';

  // 尝试单行（仅叶对象）
  if (isFlat(value)) {
    const inline =
      '{ ' +
      keys.map((k) => JSON.stringify(k) + ': ' + JSON.stringify(value[k])).join(', ') +
      ' }';
    if (inline.length <= INLINE_THRESHOLD) return inline;
  }

  // 多行
  const entries = keys.map(
    (k) => childIndent + JSON.stringify(k) + ': ' + compactStringify(value[k], depth + 1),
  );
  return '{\n' + entries.join(',\n') + '\n' + indent + '}';
}

// ─── 文件处理 ────────────────────────────────────────────────────────────────

function formatFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(ROOT, filePath);
  const raw = fs.readFileSync(abs, 'utf-8');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`[跳过] 解析失败: ${abs}\n  ${e.message}`);
    return;
  }

  const formatted = compactStringify(parsed, 0) + '\n';

  if (formatted === raw) {
    console.log(`[无变化] ${path.relative(ROOT, abs)}`);
    return;
  }

  fs.writeFileSync(abs, formatted, 'utf-8');
  const before = raw.split('\n').length;
  const after = formatted.split('\n').length;
  console.log(`[格式化] ${path.relative(ROOT, abs)}  ${before} → ${after} 行`);
}

// ─── 入口 ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length > 0) {
  for (const arg of args) formatFile(arg);
} else {
  const configDir = path.join(ROOT, 'src/config');
  const files = fs.readdirSync(configDir).filter((f) => f.endsWith('.json'));
  console.log(`处理 src/config/ 下 ${files.length} 个 JSON 文件...\n`);
  for (const f of files) formatFile(path.join(configDir, f));
}

console.log('\n完成。');
