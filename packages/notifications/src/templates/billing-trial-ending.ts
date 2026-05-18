import type { TemplateModule } from "./renderer";

export const billingTrialEndingTemplate: TemplateModule = {
  build({ data }) {
    const end = data.trialEnd
      ? new Date(data.trialEnd).toLocaleDateString("ja-JP")
      : "間近";
    return {
      title: "無料トライアル期間がまもなく終了します",
      bodyMarkdown:
        `Coreberg LLMO の無料トライアル期間が **${end}** に終了します。\n\n` +
        `引き続き全自動の AI 引用獲得対策機能を利用される場合は、決済情報の登録または本契約プランへの移行をお願いします。`,
      actionLabel: "プラン契約はこちら",
    };
  },
};
