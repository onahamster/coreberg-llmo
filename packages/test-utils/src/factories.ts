import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';

export const makeOwner = (overrides = {}) => ({
  id: nanoid(),
  email: faker.internet.email(),
  display_name: faker.person.fullName(),
  created_at: new Date().toISOString(),
  ...overrides,
});

export const makeProject = (overrides = {}) => ({
  id: nanoid(),
  owner_id: nanoid(),
  name: faker.company.name(),
  domain: faker.internet.domainName(),
  plan_id: 'starter',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const makeArticle = (overrides = {}) => ({
  id: nanoid(),
  project_id: nanoid(),
  title: faker.lorem.sentence(),
  slug: faker.lorem.slug(),
  status: 'draft' as const,
  body_md: faker.lorem.paragraphs(5),
  citations: [],
  created_at: new Date().toISOString(),
  ...overrides,
});

export const makeCitationHit = (overrides = {}) => ({
  url: faker.internet.url(),
  domain: faker.internet.domainName(),
  kind: 'native' as const,
  rank: faker.number.int({ min: 1, max: 10 }),
  ...overrides,
});

export const makeStripeEvent = (type: string, data: any) => ({
  id: `evt_${nanoid()}`,
  type,
  created: Math.floor(Date.now() / 1000),
  data: { object: data },
});
