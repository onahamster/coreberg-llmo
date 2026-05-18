export interface LlmsTxtInput {
  siteName: string;
  siteUrl: string;            // e.g. https://example.com
  description: string;
  contact?: string;
  sections: LlmsTxtSection[];
}

export interface LlmsTxtSection {
  title: string;              // e.g. "Articles", "Products"
  items: { title: string; url: string; summary?: string }[];
}

export function renderLlmsTxt(input: LlmsTxtInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.siteName}`);
  lines.push("");
  lines.push(`> ${input.description}`);
  lines.push("");
  if (input.contact) {
    lines.push(`Contact: ${input.contact}`);
    lines.push("");
  }
  for (const section of input.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    for (const item of section.items) {
      const summary = item.summary ? `: ${item.summary}` : "";
      lines.push(`- [${item.title}](${item.url})${summary}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
