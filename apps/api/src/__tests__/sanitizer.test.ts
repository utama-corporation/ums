import { describe, it, expect } from "vitest";
import { sanitizeMemoHtml } from "../services/sanitizerService.js";

describe("HTML Sanitizer Service (XSS Defense)", () => {
  it("should strip dangerous script tags and inline event handlers", () => {
    const dirty = '<p>Hello</p><script>alert("xss")</script><img src="x" onerror="alert(1)">';
    const clean = sanitizeMemoHtml(dirty);

    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("onerror");
    expect(clean).toContain("<p>Hello</p>");
  });

  it("should preserve allowed rich text tags and style attributes", () => {
    const richText = '<h1>Memo Judul</h1><p><b>Penting:</b> Ini adalah <i>isi memo</i>.</p><ul><li>Poin 1</li></ul>';
    const clean = sanitizeMemoHtml(richText);

    expect(clean).toBe(richText);
  });
});
