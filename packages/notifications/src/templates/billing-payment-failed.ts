import type { TemplateModule } from "./renderer";

export const billingPaymentFailedTemplate: TemplateModule = {
  build({ data }) {
    const number = (data.number as string) ?? "";
    const amount = Number(data.amountJpy ?? 0).toLocaleString();
    return {
      title: "お支払いに失敗しました",
      bodyMarkdown:
        `請求書 **${number}** （¥${amount}）の決済に失敗しました。\n\n` +
        `7 日以内に支払い方法を更新しない場合、サービスが一時停止される可能性があります。\n\n` +
        `下記のボタンよりお支払い方法の確認・再試行をお願いします。`,
      actionLabel: "お支払い方法を管理",
    };
  },
};
