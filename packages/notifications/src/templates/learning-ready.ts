import type { TemplateModule } from "./renderer";

export const learningReadyTemplate: TemplateModule = {
  build({ data }) {
    const summary = (data.summary as string) ?? "新しい学びインサイトが追加されました。";
    return {
      title: "今月の最適化レポートが届きました",
      bodyMarkdown:
        `前月分の AI 引用状況をもとにした、LLM 最適化レポートが生成されました。\n\n` +
        `**要約:**\n${summary}\n\n` +
        `ダッシュボードで詳細なコンテンツギャップと次回に向けた推奨トピックを確認しましょう。`,
      actionLabel: "インサイトを開く",
    };
  },
};
