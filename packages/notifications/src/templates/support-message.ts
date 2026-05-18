import type { TemplateModule } from "./renderer";

export const supportMessageTemplate: TemplateModule = {
  build({ data }) {
    const preview = (data.messagePreview as string) ?? "";
    return {
      title: "サポートから返信が届きました",
      bodyMarkdown:
        `お問い合わせ中のチケットに対して、サポート担当者より返信がありました。\n\n` +
        `**返信内容のプレビュー:**\n` +
        `> ${preview}\n\n` +
        `メッセージの全体表示および追加の返信は、下記のボタンよりサポート管理画面を開いてください。`,
      actionLabel: "チケットを確認",
    };
  },
};
