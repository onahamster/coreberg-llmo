import type { TemplateModule } from "./renderer";

export const articlePublishedTemplate: TemplateModule = {
  build({ data }) {
    const title = (data.title as string) ?? "新しい記事";
    const url = (data.url as string) ?? "";
    return {
      title: `「${title}」を公開しました`,
      bodyMarkdown:
        `記事「**${title}**」の公開が完了しました。\n\n` +
        `WordPress URL: [${url}](${url})\n\n` +
        `公開後、IndexNow および llms.txt の更新も自動で実行されます。`,
      actionLabel: "公開記事を開く",
    };
  },
};
