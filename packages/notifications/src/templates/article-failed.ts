import type { TemplateModule } from "./renderer";

export const articleFailedTemplate: TemplateModule = {
  build({ data }) {
    const title = (data.title as string) ?? "新しい記事";
    const reason = (data.reason as string) ?? "不明なエラー";
    return {
      title: `「${title}」の生成に失敗しました`,
      bodyMarkdown:
        `記事「**${title}**」の生成プロセス中にエラーが発生しました。\n\n` +
        `エラー内容: **${reason}**\n\n` +
        `ダッシュボードからエラーログを確認し、必要に応じて再実行してください。`,
      actionLabel: "ダッシュボードを開く",
    };
  },
};
