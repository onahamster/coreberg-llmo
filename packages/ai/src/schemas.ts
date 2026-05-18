/**
 * Gemini Structured Output 用の OpenAPI 3.0 サブセット Schema 定義
 * すべてのプロンプトの出力構造はここに集約する
 */

export const SiteProfileSchema = {
  type: 'object',
  properties: {
    industry: { type: 'string' },
    value_proposition: { type: 'string' },
    tone: { type: 'string' },
    domain_terms: { type: 'array', items: { type: 'string' } },
    target_audience: { type: 'string' },
    existing_topics: { type: 'array', items: { type: 'string' } },
    structured_profile: { type: 'string' },
  },
  required: ['industry', 'value_proposition', 'tone', 'structured_profile'],
} as const;

export const CompetitorAnalysisSchema = {
  type: 'object',
  properties: {
    competitors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          name: { type: 'string' },
          top_articles: { type: 'array', items: { type: 'string' } },
        },
        required: ['domain', 'top_articles'],
      },
    },
    coverage_map: {
      type: 'object',
      properties: {
        covered: { type: 'array', items: { type: 'string' } },
        uncovered: { type: 'array', items: { type: 'string' } },
      },
      required: ['covered', 'uncovered'],
    },
  },
  required: ['competitors', 'coverage_map'],
} as const;

export const CitationLandscapeSchema = {
  type: 'object',
  properties: {
    user_questions: { type: 'array', items: { type: 'string' } },
    cited_domains: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          count: { type: 'integer' },
        },
        required: ['domain', 'count'],
      },
    },
    baseline_summary: { type: 'string' },
  },
  required: ['user_questions', 'cited_domains', 'baseline_summary'],
} as const;

export const SubqueryFanoutSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            enum: [
              'related',
              'implicit',
              'comparative',
              'recency',
              'reformulation',
              'contextual',
              'next_step',
            ],
          },
          text: { type: 'string' },
        },
        required: ['pattern', 'text'],
      },
    },
  },
  required: ['items'],
} as const;

export const CitationScoreSchema = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          citation_likelihood: { type: 'number' },
          competitor_weakness: { type: 'number' },
          topic_contribution: { type: 'number' },
        },
        required: ['id', 'citation_likelihood', 'competitor_weakness', 'topic_contribution'],
      },
    },
  },
  required: ['scores'],
} as const;

export const ClusteringSchema = {
  type: 'object',
  properties: {
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          subquery_ids: { type: 'array', items: { type: 'string' } },
          pillar_subquery_id: { type: 'string' },
        },
        required: ['name', 'subquery_ids', 'pillar_subquery_id'],
      },
    },
    selected_ids: { type: 'array', items: { type: 'string' } },
  },
  required: ['clusters', 'selected_ids'],
} as const;

export const ArticlePlanSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    lead: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          h2: { type: 'string' },
          h3s: { type: 'array', items: { type: 'string' } },
          target_chars: { type: 'integer' },
          self_contained_note: { type: 'string' },
        },
        required: ['h2'],
      },
    },
    statistics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          source_url: { type: 'string' },
        },
        required: ['claim'],
      },
    },
    expert_citations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          quote: { type: 'string' },
          source_url: { type: 'string' },
        },
        required: ['name', 'quote'],
      },
    },
    comparison_table: { type: 'boolean' },
    internal_links: { type: 'array', items: { type: 'string' } },
    target_subquery_ids: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'lead', 'sections', 'statistics', 'expert_citations'],
} as const;

export const ArticleDraftSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body_markdown: { type: 'string' },
    word_count: { type: 'integer' },
  },
  required: ['title', 'body_markdown'],
} as const;

export const StructureCheckSchema = {
  type: 'object',
  properties: {
    passes: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string' },
          kind: {
            type: 'string',
            enum: [
              'conclusion_first',
              'section_length',
              'statistics',
              'citations',
              'self_contained',
            ],
          },
          message: { type: 'string' },
        },
        required: ['section', 'kind', 'message'],
      },
    },
  },
  required: ['passes', 'issues'],
} as const;

export const FactCheckSchema = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          verified: { type: 'boolean' },
          source_url: { type: 'string' },
          action: { type: 'string', enum: ['kept', 'generalized', 'removed'] },
          replacement: { type: 'string' },
        },
        required: ['claim', 'verified', 'action'],
      },
    },
    revised_markdown: { type: 'string' },
  },
  required: ['claims', 'revised_markdown'],
} as const;

export const HtmlSchemaSchema = {
  type: 'object',
  properties: {
    html: { type: 'string' },
    json_ld: {
      type: 'object',
      properties: {
        article: { type: 'object' },
        breadcrumb: { type: 'object' },
        organization: { type: 'object' },
        person: { type: 'object' },
      },
    },
    slug: { type: 'string' },
  },
  required: ['html', 'json_ld', 'slug'],
} as const;

export const MonitoringJudgeSchema = {
  type: 'object',
  properties: {
    cited: { type: 'boolean' },
    position: { type: 'integer' },
    snippet: { type: 'string' },
    competitor_domains: { type: 'array', items: { type: 'string' } },
  },
  required: ['cited'],
} as const;

export const LearningInsightSchema = {
  type: 'object',
  properties: {
    patterns: {
      type: 'object',
      properties: {
        title_patterns_cited: { type: 'array', items: { type: 'string' } },
        title_patterns_not_cited: { type: 'array', items: { type: 'string' } },
        statistic_density_avg_cited: { type: 'number' },
        statistic_density_avg_not_cited: { type: 'number' },
        avg_lead_length_cited: { type: 'number' },
        avg_lead_length_not_cited: { type: 'number' },
        notes: { type: 'string' },
      },
    },
    prompt_diff: {
      type: 'object',
      properties: {
        target_keys: { type: 'array', items: { type: 'string' } },
        suggestions: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  required: ['patterns', 'prompt_diff'],
} as const;
