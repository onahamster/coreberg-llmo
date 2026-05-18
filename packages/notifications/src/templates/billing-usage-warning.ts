import type { TemplateModule } from "./renderer";

export const billingUsageWarningTemplate: TemplateModule = {
  build({ data }) {
    const used = Number(data.used ?? 0);
    const quota = Number(data.quota ?? 0);
    const remaining = Number(data.remaining ?? 0);
    return {
      title: "今月の記事クォータが残り少なくなっています",
      bodyMarkdown:
        `今月の生成可能枠（クォータ）が上限に近づいています。\n\n` +
        `- 今月の使用済本数: **${used} / ${quota} 本**\n` +
        `- 残り生成枠: **${remaining} 本**\n\n` +
        `上限を超過すると自動的に追加請求が発生するか、新しい記事生成が制限されます。プラン変更や設定の確認をご検討ください。`,
      actionLabel: "プランを確認",
    };
  },
};
