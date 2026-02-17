import React from 'react';

type SplitResult = {
  lead?: string;
  rest: string;
};

const SPLIT_DELIMS = ['；', '，', '。', '：', '、'] as const;

const COMMON_KEYWORDS = [
  '起收',
  '提按',
  '中锋',
  '侧锋',
  '顿挫',
  '使转',
  '转折',
  '结体',
  '章法',
  '行气',
  '重心',
  '取势',
  '虚实',
  '开合',
  '用墨',
  '枯润',
  '版本',
  '刻拓',
  '拓本',
  '刀痕',
  '残泐',
  '线质',
] as const;

const SCRIPT_KEYWORDS: Record<string, readonly string[]> = {
  楷书: ['中宫', '法度', '骨', '肉', '方圆', '入笔', '出锋', '收束', '欹正', '匀稳'],
  隶书: ['波磔', '蚕头', '燕尾', '扁方', '开张', '篆意', '古雅', '秀逸'],
  篆书: ['圆转', '匀净', '对称', '均衡', '计白当黑', '藏锋', '中轴'],
  行书: ['连带', '牵丝', '笔断意连', '节奏', '轻重'],
  草书: ['草法', '省略', '连并', '可读性', '势', '节奏'],
};

const TIP_VERBS = [
  '先',
  '再',
  '最后',
  '对照',
  '挑',
  '选',
  '固定',
  '每天',
  '至少',
  '反复',
  '慢写',
  '快写',
  '拆解',
  '还原',
] as const;

function uniqSortedByLengthDesc(items: string[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const t = String(item || '').trim();
    if (!t) continue;
    set.add(t);
  }
  return Array.from(set).sort((a, b) => b.length - a.length);
}

export function getKeywords(scriptType: string | undefined | null): string[] {
  const extra = scriptType ? SCRIPT_KEYWORDS[scriptType] || [] : [];
  return uniqSortedByLengthDesc([...(COMMON_KEYWORDS as unknown as string[]), ...(extra as unknown as string[])]);
}

export function splitLeadSentence(text: string): SplitResult {
  const s = String(text || '').trim();
  if (!s) return { rest: '' };

  let splitAt = -1;
  for (const d of SPLIT_DELIMS) {
    const idx = s.indexOf(d);
    if (idx > 0) {
      splitAt = idx;
      break;
    }
  }

  if (splitAt < 0) return { rest: s };

  const lead = s.slice(0, splitAt).trim();
  const rest = s.slice(splitAt).trim();

  // Avoid awkward splits.
  if (lead.length < 8 || lead.length > 26) return { rest: s };
  return { lead, rest };
}

type Match = { start: number; end: number; token: string };

function findMatches(text: string, keywords: string[], maxHits: number): Match[] {
  const s = String(text || '');
  if (!s) return [];
  const matches: Match[] = [];

  const overlaps = (a: Match, b: Match) => a.start < b.end && b.start < a.end;

  for (const token of keywords) {
    if (matches.length >= maxHits) break;
    if (!token || token.length < 2) continue;
    let fromIndex = 0;
    while (matches.length < maxHits) {
      const idx = s.indexOf(token, fromIndex);
      if (idx < 0) break;
      const m: Match = { start: idx, end: idx + token.length, token };
      if (!matches.some((x) => overlaps(x, m))) {
        matches.push(m);
      }
      fromIndex = idx + token.length;
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

export function highlightText(
  text: string,
  keywords: string[],
  opts?: { maxHits?: number; highlightClassName?: string }
): React.ReactNode {
  const s = String(text || '');
  if (!s) return null;
  const maxHits = opts?.maxHits ?? 2;
  const cls =
    opts?.highlightClassName ??
    'bg-amber-50/80 text-stone-900 rounded px-1 ring-1 ring-amber-200/60';

  const matches = findMatches(s, keywords, maxHits);
  if (!matches.length) return s;

  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.start > pos) parts.push(s.slice(pos, m.start));
    const token = s.slice(m.start, m.end);
    parts.push(
      <span key={`${m.start}-${m.end}`} className={cls}>
        {token}
      </span>
    );
    pos = m.end;
  }
  if (pos < s.length) parts.push(s.slice(pos));
  return <>{parts}</>;
}

export function emphasizeTip(
  text: string,
  opts?: { maxHits?: number; highlightClassName?: string; strongClassName?: string }
): React.ReactNode {
  const s = String(text || '').trim();
  if (!s) return null;
  const maxHits = opts?.maxHits ?? 2;
  const highlightCls =
    opts?.highlightClassName ??
    'bg-amber-50/80 text-stone-900 rounded px-1 ring-1 ring-amber-200/60';
  const strongCls = opts?.strongClassName ?? 'font-semibold text-stone-900';

  // First, mark one verb-ish token as strong.
  let strongToken: string | null = null;
  for (const v of TIP_VERBS) {
    if (s.includes(v)) {
      strongToken = v;
      break;
    }
  }

  // Then, highlight at most one numeric-ish fragment.
  const numMatch = s.match(/\d+\s*(?:个|处|遍|行|天|次|字|页)?/);
  const numToken = numMatch?.[0] || null;

  const tokens: string[] = [];
  if (numToken) tokens.push(numToken);

  let out: React.ReactNode = s;
  if (tokens.length) out = highlightText(s, uniqSortedByLengthDesc(tokens), { maxHits: 1, highlightClassName: highlightCls });

  if (strongToken) {
    // Wrap the first occurrence only.
    const idx = s.indexOf(strongToken);
    if (idx >= 0) {
      const before = s.slice(0, idx);
      const after = s.slice(idx + strongToken.length);
      const strongNode = (
        <span className={strongCls}>
          {strongToken}
        </span>
      );

      // If we already produced a ReactNode (because numeric highlight applied),
      // fall back to a simple strong-only transform to keep logic predictable.
      if (typeof out !== 'string') {
        return (
          <>
            {before}
            {strongNode}
            {after}
          </>
        );
      }
      out = (
        <>
          {before}
          {strongNode}
          {after}
        </>
      );
    }
  }

  // Ensure we don't over-emphasize; keep at most 2 transforms.
  void maxHits;
  return out;
}

export function extractGoldLine(args: {
  summary?: string | null;
  firstPointText?: string | null;
}): string | null {
  const s = String(args.summary || '').trim();
  if (s) return s.length > 42 ? s.slice(0, 42) + '…' : s;
  const p = String(args.firstPointText || '').trim();
  if (!p) return null;
  const split = splitLeadSentence(p);
  const lead = split.lead || split.rest;
  if (!lead) return null;
  return lead.length > 42 ? lead.slice(0, 42) + '…' : lead;
}
