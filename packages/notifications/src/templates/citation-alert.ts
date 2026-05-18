import type { TemplateModule } from "./renderer";

export const citationAlertTemplate: TemplateModule = {
  build({ data }) {
    const prev = Number(data.previousRate ?? 0) * 100;
    const curr = Number(data.currentRate ?? 0) * 100;
    const delta = (curr - prev).toFixed(1);
    return {
      title: `AI 引用率が ${delta}pt 変動しました`,
      bodyMarkdown:
        `直近の AI 引用率が **${prev.toFixed(1)}% → ${curr.toFixed(1)}%** に変動しました。\n\n` +
        `モニタリングダッシュボードで詳細をご確認ください。`,
      actionLabel: "モニタリングを開く",
    };
  },
};
