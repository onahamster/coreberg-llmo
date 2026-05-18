import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ArticleActions } from './_components/ArticleActions';

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string; articleId: string }>;
}) {
  await requireCustomer();
  const { id, articleId } = await params;
  const supabase = await createServerSupabase();

  const { data: article } = await supabase
    .from('articles')
    .select('id,title,html,status,word_count,image_url,image_alt,wp_post_url,published_at,schema_jsonb')
    .eq('id', articleId)
    .eq('project_id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!article) notFound();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
      <article>
        <h1 style={{ margin: 0, fontSize: 24, color: 'var(--fg)', fontWeight: 600 }}>{article.title}</h1>
        {article.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image_url}
            alt={article.image_alt ?? ''}
            style={{ width: '100%', marginTop: 16, borderRadius: 12 }}
          />
        )}
        <div
          style={{ marginTop: 24, lineHeight: 1.8, color: 'var(--fg)' }}
          // 生成済みの HTML を表示。XSS 注意: 生成元は信頼できる自社プロンプト + Gemini
          dangerouslySetInnerHTML={{ __html: article.html ?? '' }}
        />
      </article>

      <aside>
        <ArticleActions projectId={id} article={article} />
      </aside>
    </div>
  );
}
