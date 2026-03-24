export const createShortId = (length = 9) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, length);
  }

  return Math.random().toString(36).slice(2, 2 + length);
};

export const downloadTextFile = (
  fileName: string,
  mimeType: string,
  content: string,
) => {
  const dataUrl = `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataUrl);
  anchor.setAttribute('download', fileName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

export const toCsvCell = (value: string | number | undefined) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;
