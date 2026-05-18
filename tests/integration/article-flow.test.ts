import { describe, it, expect, afterAll } from 'vitest';
import { testSupabase, cleanTables, withTestOwner } from '@coreberg/test-utils';

describe('article flow integration', () => {
  afterAll(async () => {
    await cleanTables(['articles', 'projects']);
  });

  it('orchestrates project creation, article drafting, and verification', async () => {
    await withTestOwner(async (ownerId) => {
      const sb = testSupabase();

      // 1. Create project
      const { data: project, error: pe } = await sb
        .from('projects')
        .insert({ owner_id: ownerId, name: 'Integration project', domain: 'int.test.com' })
        .select()
        .single();
      expect(pe).toBeNull();
      expect(project).toBeDefined();

      // 2. Insert draft article
      const { data: article, error: ae } = await sb
        .from('articles')
        .insert({
          project_id: project!.id,
          title: 'Integration Test Article',
          slug: 'integration-test-article',
          status: 'draft',
          body_md: 'This is a high quality generated draft.',
        })
        .select()
        .single();
      expect(ae).toBeNull();
      expect(article?.status).toBe('draft');

      // 3. Update status to scheduled
      const { data: updated, error: ue } = await sb
        .from('articles')
        .update({ status: 'scheduled' })
        .eq('id', article!.id)
        .select()
        .single();
      expect(ue).toBeNull();
      expect(updated?.status).toBe('scheduled');
    });
  });
});
