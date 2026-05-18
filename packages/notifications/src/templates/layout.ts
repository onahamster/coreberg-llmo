export interface LayoutInput {
  recipientName: string | null;
  title: string;
  bodyMarkdown: string;
  actionUrl?: string;
  actionLabel?: string;
  baseUrl: string;
}

export function layoutEmail(input: LayoutInput): string {
  const greeting = input.recipientName ? `${escapeHtml(input.recipientName)} 様` : "こんにちは";
  const bodyHtml = renderMarkdown(input.bodyMarkdown);
  const button = input.actionUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
         <tr><td bgcolor="#0f172a" style="border-radius:8px;">
           <a href="${escapeAttr(input.actionUrl)}" target="_blank"
              style="display:inline-block;padding:12px 22px;color:#ffffff;
                     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                     font-size:14px;font-weight:600;text-decoration:none;">
             ${escapeHtml(input.actionLabel ?? "詳細を開く")}
           </a>
         </td></tr>
       </table>`
    : "";
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#f4f4f5">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"
             style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 28px 0;">
          <div style="font-size:12px;letter-spacing:0.08em;color:#64748b;text-transform:uppercase;">Coreberg LLMO</div>
          <h1 style="margin:8px 0 0;font-size:20px;line-height:1.4;">${escapeHtml(input.title)}</h1>
        </td></tr>
        <tr><td style="padding:16px 28px 8px;font-size:14px;line-height:1.6;color:#334155;">
          <p style="margin:0 0 16px;">${greeting}</p>
          ${bodyHtml}
          ${button}
        </td></tr>
        <tr><td style="padding:16px 28px 28px;color:#94a3b8;font-size:12px;line-height:1.5;
                       border-top:1px solid #e2e8f0;">
          このメールに心当たりがない場合はご連絡ください。<br/>
          通知設定: <a href="${escapeAttr(input.baseUrl + "/settings/notifications")}" style="color:#475569;">${input.baseUrl}/settings/notifications</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderMarkdown(md: string): string {
  // Minimal: paragraphs, bold, links, lists.
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g,
      '<a href="$2" style="color:#2563eb;text-decoration:underline;">$1</a>')
    .split(/\n{2,}/)
    .map((para) => {
      if (para.startsWith("- ")) {
        const items = para.split(/\n- /).map((l) => l.replace(/^- /, ""));
        return `<ul style="margin:0 0 16px;padding-left:20px;">${items
          .map((i) => `<li style="margin:4px 0;">${i}</li>`).join("")}</ul>`;
      }
      return `<p style="margin:0 0 12px;">${para.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]!));
}
function escapeAttr(s: string): string { return escapeHtml(s); }
