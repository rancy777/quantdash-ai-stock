export const copyPlainText = async (content: string): Promise<void> => {
  await navigator.clipboard.writeText(content);
};

const sanitizeFileName = (value: string): string =>
  value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'quantdash-ai-output';

export const exportTextAsMarkdown = (title: string, content: string, subtitle?: string): void => {
  const lines = [
    `# ${title}`,
    subtitle ? `> ${subtitle}` : '',
    '',
    content.trim(),
    '',
  ].filter(Boolean);

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${sanitizeFileName(title)}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};
