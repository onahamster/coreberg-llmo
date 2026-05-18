export interface RenderInput {
  typeKey: string;
  typeDef: { email_subject_template: string | null; category: string };
  data: Record<string, unknown>;
  locale: string;
  recipient: { name: string | null; email: string };
  actionUrl?: string;
  baseUrl: string;
}

export interface RenderedTemplate {
  title: string;
  subject: string | null;
  html: string;
  bodyText: string;
  actionUrl: string | null;
}
