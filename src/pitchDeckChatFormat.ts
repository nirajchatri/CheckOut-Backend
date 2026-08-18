/** Strip citation markers, control chars, and leftover markdown junk from LLM replies. */
export function sanitizePitchDeckChatReply(raw: string): string {
  let text = String(raw ?? '');

  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/<\/?[^>]+>/g, '');

  text = text
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*?†[^\]]*?\]/g, '')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/\[\d+(?::\d+)?(?:-[a-z0-9]+)?\]/gi, '')
    .replace(/[†‡]/g, '')
    .replace(/^\s*(?:sources?|references?|citations?)\s*:\s*$/gim, '');

  text = text.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF\uFFFD]/g,
    '',
  );

  text = text.replace(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/g, '$1');
  text = text.replace(/^[ \t]*[•●▪◦‣∙]\s+/gm, '- ');
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]{2,}/g, ' ');

  return text.trim();
}
