import type { TemplateModule } from "./renderer";

export const weeklyDigestTemplate: TemplateModule = {
  build({ data }) {
    const start = data.periodStart
      ? new Date(data.periodStart).toLocaleDateString("ja-JP")
      : "";
    const end = data.periodEnd
      ? new Date(data.periodEnd).toLocaleDateString("ja-JP")
      : "";
    const counts = (data.counts as Record<string, number>) ?? {};
    return {
      title: "週次 LLMO レポートをお届けします",
      bodyMarkdown:
        `**${start} 〜 ${end}** の期間における、LLMO 運用の週次要約をお届けします。\n\n` +
        `### 今週の統計実績:\n` +
        `- 公開記事数: **${counts.published ?? 0} 本**\n` +
        `- 獲得した AI 引用: **${counts.citations ?? 0} 件**\n` +
        `- 平均コンテンツ品質スコア: **${counts.quality ?? 0}%**\n\n` +
        `ダッシュボードでは、より詳細な日次のアクセス被引用データをご確認いただけます。`,
      actionLabel: "ダッシュボードを開く",
    };
  },
};
