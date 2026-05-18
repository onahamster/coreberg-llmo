import type { TemplateModule } from "./renderer";

export const genericTemplate: TemplateModule = {
  build({ typeKey, data }) {
    const title = (data.title as string) ?? "お知らせ";
    const body = (data.body as string) ?? String(data.message ?? "");
    return {
      title,
      bodyMarkdown: body,
    };
  },
};
