import type { TemplateModule } from "./renderer";

export const securityNewLoginTemplate: TemplateModule = {
  build({ data }) {
    const ip = (data.ip as string) ?? "不明";
    const ua = (data.userAgent as string) ?? "不明";
    const time = data.at ? new Date(data.at).toLocaleString("ja-JP") : "最近";
    return {
      title: "新しい端末からのログインがありました",
      bodyMarkdown:
        `普段と異なる環境または新しい端末からアカウントへのログインが検出されました。\n\n` +
        `- 日時: **${time}**\n` +
        `- IPアドレス: **${ip}**\n` +
        `- デバイス情報: **${ua}**\n\n` +
        `もしご自身によるログインでない場合は、直ちにパスワードを変更し、セキュリティの確認を行ってください。`,
      actionLabel: "セキュリティ設定へ",
    };
  },
};
