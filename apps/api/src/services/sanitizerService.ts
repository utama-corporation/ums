import sanitizeHtml from "sanitize-html";

export function sanitizeMemoHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return "";

  return sanitizeHtml(dirtyHtml, {
    allowedTags: [
      "p", "br", "b", "i", "u", "em", "strong", "strike", "hr",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote", "code", "pre",
      "table", "thead", "tbody", "tr", "th", "td",
      "span", "div", "a", "img"
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      span: ["style", "class"],
      p: ["style", "class"],
      td: ["colspan", "rowspan", "style"],
      th: ["colspan", "rowspan", "style"],
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
  });
}
