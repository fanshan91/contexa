export type LanguagePackShape = 'flat' | 'tree';

export type EntryDraft = {
  key: string;
  value: string;
  originalPath: string[];
};

export type ParseLanguagePackResult =
  | {
      ok: true;
      data: {
        shape: LanguagePackShape;
        drafts: EntryDraft[];
        map: Record<string, string>;
      };
    }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function joinPath(path: string[]) {
  return path.join('.');
}

function normalizeKeySegment(segment: string) {
  return segment.trim();
}

function formatPath(path: string[]) {
  return joinPath(path);
}

function formatEmptyKeyPath(path: string[]) {
  return joinPath([...path, '[空]']);
}

function flattenTree(
  node: Record<string, unknown>,
  basePath: string[],
  drafts: EntryDraft[],
  map: Record<string, string>
): ParseLanguagePackResult {
  for (const [rawKey, rawValue] of Object.entries(node)) {
    const seg = normalizeKeySegment(rawKey);
    if (!seg) {
      return {
        ok: false,
        error: `结构不符合约定：对象 key 不能为空（路径：${formatEmptyKeyPath(basePath)}）。`
      };
    }
    const nextPath = [...basePath, seg];

    if (typeof rawValue === 'string') {
      const key = joinPath(nextPath);
      if (map[key] !== undefined) {
        return { ok: false, error: `结构不符合约定：路径 ${key} 的 key 存在冲突。` };
      }
      map[key] = rawValue;
      drafts.push({ key, value: rawValue, originalPath: nextPath });
      continue;
    }

    if (Array.isArray(rawValue)) {
      return {
        ok: false,
        error: `结构不符合约定：路径 ${formatPath(nextPath)} 的 value 不能为数组。`
      };
    }

    if (isPlainObject(rawValue)) {
      const res = flattenTree(rawValue, nextPath, drafts, map);
      if (!res.ok) return res;
      continue;
    }

    return {
      ok: false,
      error: `结构不符合约定：路径 ${formatPath(nextPath)} 的 value 必须为字符串。`
    };
  }

  return { ok: true, data: { shape: 'tree', drafts, map } };
}

export function parseLanguagePack(raw: string): ParseLanguagePackResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'JSON 解析失败：请确认文件内容为合法 JSON。' };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: '结构不符合约定：顶层必须为 JSON 对象。' };
  }

  const entries = Object.entries(parsed);
  const hasNested = entries.some(([, v]) => isPlainObject(v));
  const shape: LanguagePackShape = hasNested ? 'tree' : 'flat';

  const drafts: EntryDraft[] = [];
  const map: Record<string, string> = {};

  if (shape === 'flat') {
    for (const [rawKey, rawValue] of entries) {
      const key = normalizeKeySegment(rawKey);
      if (!key) {
        return {
          ok: false,
          error: `结构不符合约定：对象 key 不能为空（路径：${formatEmptyKeyPath([])}）。`
        };
      }
      if (typeof rawValue !== 'string') {
        return {
          ok: false,
          error: `结构不符合约定：路径 ${formatPath([key])} 的 value 必须为字符串。`
        };
      }
      if (map[key] !== undefined) {
        return { ok: false, error: `结构不符合约定：路径 ${key} 的 key 存在冲突。` };
      }
      map[key] = rawValue;
      drafts.push({ key, value: rawValue, originalPath: [key] });
    }
    return { ok: true, data: { shape: 'flat', drafts, map } };
  }

  for (const [, v] of entries) {
    if (Array.isArray(v)) return { ok: false, error: '结构不符合约定：树形 JSON 不支持数组。' };
  }

  return flattenTree(parsed, [], drafts, map);
}
