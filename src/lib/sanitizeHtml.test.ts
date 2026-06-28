import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "./sanitizeHtml";

describe("sanitizeRichHtml", () => {
  it("removes script and event-handler HTML", () => {
    const html = sanitizeRichHtml(`
      <p onclick="alert(1)">Hello <strong>candidate</strong></p>
      <img src="x" onerror="alert(1)" />
      <script>alert(1)</script>
      <a href="javascript:alert(1)">bad link</a>
    `);

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("<strong>candidate</strong>");
  });

  it("keeps safe rich text used by job descriptions", () => {
    const html = sanitizeRichHtml(
      '<h2>Role</h2><p>Build <em>useful</em> tools.</p><ul><li>React</li></ul><a href="https://example.com">Apply</a>',
    );

    expect(html).toContain("<h2>Role</h2>");
    expect(html).toContain("<em>useful</em>");
    expect(html).toContain("<li>React</li>");
    expect(html).toContain('href="https://example.com"');
  });
});
