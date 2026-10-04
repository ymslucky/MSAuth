/** 展示格式化工具 */

const dtf = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function fmtDateTime(ts: number | null | undefined): string {
  return ts ? dtf.format(new Date(ts)) : '—';
}

/** 从 UA 提取可读的浏览器/系统摘要 */
export function summarizeUa(ua: string | null): string {
  if (!ua) return '未知设备';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : '未知浏览器';
  const os =
    /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /(iPhone|iPad)/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '未知系统';
  return `${browser} · ${os}`;
}
