import type { TemplateModule } from "./renderer";

export const billingUsageExceededTemplate: TemplateModule = {
  build({ data }) {
    const used = Number(data.used ?? 0);
    const quota = Number(data.quota ?? 0);
    return {
      title: "今月の記事クォータの上限に達しました",
      bodyMarkdown:
        `今月の生成可能枠（クォータ）の上限（**${quota} 本**）に達しました。\n\n` +
        `現在、新規の自動生成プロセスは一時停止されています。超過分の「自動課金（オートチャージ）」設定を有効にするか、上位のプランへのアップグレードをご検討ください。`,
      actionLabel: "課金設定を変更",
    };
  },
};
