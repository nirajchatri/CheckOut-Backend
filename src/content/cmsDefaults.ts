export type FdTenureRow = {
  id: string;
  label: string;
  months: number;
  regularRate: number;
  seniorRate: number;
  popular?: boolean;
};

export type FdRateRow = {
  id: string;
  name: string;
  rate: string;
  logoUrl: string;
  heroImageUrl: string;
  tenures: FdTenureRow[];
};

export type CmsSectionId =
  | 'hero'
  | 'about'
  | 'trusted'
  | 'features'
  | 'stats'
  | 'dicgc'
  | 'insights'
  | 'smart'
  | 'pricing'
  | 'testimonials'
  | 'onboarding'
  | 'footer'
  | 'liveFdRates';

export type CmsPageSection = {
  id: CmsSectionId;
  label: string;
  fieldSection: string;
};

export const CMS_PAGE_SECTIONS: CmsPageSection[] = [
  { id: 'hero', label: 'Hero', fieldSection: 'Hero' },
  { id: 'about', label: 'About', fieldSection: 'About' },
  { id: 'trusted', label: 'Trusted Companies', fieldSection: 'Trusted Companies' },
  { id: 'features', label: 'Features', fieldSection: 'Features' },
  { id: 'stats', label: 'Stats & Team', fieldSection: 'Stats & Team' },
  { id: 'dicgc', label: 'DICGC Insurance', fieldSection: 'DICGC Insurance' },
  { id: 'insights', label: 'Insights', fieldSection: 'Insights' },
  { id: 'smart', label: 'Smart Features', fieldSection: 'Smart Features' },
  { id: 'pricing', label: 'Pricing', fieldSection: 'Pricing' },
  { id: 'testimonials', label: 'Testimonials', fieldSection: 'Testimonials' },
  { id: 'onboarding', label: 'Onboarding', fieldSection: 'Onboarding' },
  { id: 'footer', label: 'Footer', fieldSection: 'Footer' },
  { id: 'liveFdRates', label: 'Live FD Rates', fieldSection: 'Live FD Rates' },
];

export const DEFAULT_SECTION_VISIBILITY: Record<CmsSectionId, boolean> = {
  hero: true,
  about: true,
  trusted: true,
  features: true,
  stats: true,
  dicgc: true,
  insights: true,
  smart: true,
  pricing: true,
  testimonials: true,
  onboarding: true,
  footer: true,
  liveFdRates: true,
};

export const DEFAULT_SECTION_ORDER: CmsSectionId[] = CMS_PAGE_SECTIONS.map((section) => section.id);

export function mergeSectionOrder(order: CmsSectionId[] | undefined): CmsSectionId[] {
  const knownIds = new Set(CMS_PAGE_SECTIONS.map((section) => section.id));
  const next = (order ?? [])
    .map((id) => ((id as string) === 'platform' ? 'dicgc' : id))
    .filter((id) => knownIds.has(id));

  for (const section of CMS_PAGE_SECTIONS) {
    if (!next.includes(section.id)) {
      next.push(section.id);
    }
  }

  return next;
}

export function getOrderedPageSections(order: CmsSectionId[]): CmsPageSection[] {
  const byId = new Map(CMS_PAGE_SECTIONS.map((section) => [section.id, section]));
  return order
    .map((id) => byId.get(id))
    .filter((section): section is CmsPageSection => Boolean(section));
}

function parseRatePercent(rate: string): number {
  const value = parseFloat(rate.replace(/[^\d.]/g, ''));
  return Number.isFinite(value) ? value : 0;
}

export function buildDefaultTenures(baseRate: number): FdTenureRow[] {
  const seniorBonus = 0.5;
  return [
    { id: '2y', label: '2Y', months: 24, regularRate: baseRate, seniorRate: baseRate + seniorBonus },
    {
      id: '2y3m',
      label: '2Y 3M',
      months: 27,
      regularRate: baseRate,
      seniorRate: baseRate + seniorBonus,
      popular: true,
    },
    {
      id: '1y6m',
      label: '1Y 6M',
      months: 18,
      regularRate: Math.max(baseRate - 0.25, 6),
      seniorRate: Math.max(baseRate - 0.25, 6) + seniorBonus,
    },
    {
      id: '1y',
      label: '1Y',
      months: 12,
      regularRate: Math.max(baseRate - 0.5, 6),
      seniorRate: Math.max(baseRate - 0.5, 6) + seniorBonus,
    },
    {
      id: '6m',
      label: '6M',
      months: 6,
      regularRate: Math.max(baseRate - 1, 5.5),
      seniorRate: Math.max(baseRate - 1, 5.5) + seniorBonus,
    },
    {
      id: '3m',
      label: '3M',
      months: 3,
      regularRate: Math.max(baseRate - 1.5, 5),
      seniorRate: Math.max(baseRate - 1.5, 5) + seniorBonus,
    },
    {
      id: '30d',
      label: '30D',
      months: 1,
      regularRate: Math.max(baseRate - 2, 4.5),
      seniorRate: Math.max(baseRate - 2, 4.5) + seniorBonus,
    },
  ];
}

function normalizeTenureRow(row: Partial<FdTenureRow>, index: number): FdTenureRow {
  return {
    id: row.id ?? `tenure-${index}`,
    label: row.label ?? '1Y',
    months: Number.isFinite(row.months) ? Number(row.months) : 12,
    regularRate: Number.isFinite(row.regularRate) ? Number(row.regularRate) : 0,
    seniorRate: Number.isFinite(row.seniorRate) ? Number(row.seniorRate) : 0,
    popular: Boolean(row.popular),
  };
}

function createDefaultFdRateRow(
  id: string,
  name: string,
  rate: string,
  tenures?: FdTenureRow[],
): FdRateRow {
  const baseRate = parseRatePercent(rate);
  return {
    id,
    name,
    rate,
    logoUrl: '',
    heroImageUrl: '',
    tenures: tenures ?? buildDefaultTenures(baseRate),
  };
}

export const DEFAULT_FD_RATES: FdRateRow[] = [
  createDefaultFdRateRow('rbl', 'RBL Bank', '7.70%'),
  createDefaultFdRateRow('sib', 'South Indian Bank', '7.30%'),
  createDefaultFdRateRow('iob', 'Indian Overseas Bank', '7.10%'),
  createDefaultFdRateRow('unity', 'Unity SF Bank', '8.50%'),
  createDefaultFdRateRow('shivalik', 'Shivalik SF Bank', '8.50%', [
    { id: '2y', label: '2Y', months: 24, regularRate: 8, seniorRate: 8.5 },
    { id: '2y3m', label: '2Y 3M', months: 27, regularRate: 8, seniorRate: 8.5, popular: true },
    { id: '1y6m', label: '1Y 6M', months: 18, regularRate: 7.75, seniorRate: 8.25 },
    { id: '1y', label: '1Y', months: 12, regularRate: 7.5, seniorRate: 8 },
    { id: '6m', label: '6M', months: 6, regularRate: 7, seniorRate: 7.5 },
    { id: '3m', label: '3M', months: 3, regularRate: 6.5, seniorRate: 7 },
    { id: '30d', label: '30D', months: 1, regularRate: 5.5, seniorRate: 6 },
  ]),
  createDefaultFdRateRow('ujjivan', 'Ujjivan SF Bank', '8.30%'),
  createDefaultFdRateRow('suryoday', 'Suryoday SF Bank', '8.25%'),
];

export function normalizeFdRateRow(row: Partial<FdRateRow> & Pick<FdRateRow, 'id' | 'name' | 'rate'>): FdRateRow {
  const baseRate = parseRatePercent(row.rate);
  return {
    id: row.id,
    name: row.name,
    rate: row.rate,
    logoUrl: row.logoUrl ?? '',
    heroImageUrl: row.heroImageUrl ?? '',
    tenures:
      row.tenures && row.tenures.length > 0
        ? row.tenures.map(normalizeTenureRow)
        : buildDefaultTenures(baseRate),
  };
}

export type CmsField = {
  key: string;
  label: string;
  section: string;
  multiline?: boolean;
  type?: 'text' | 'image' | 'url';
};

export const CMS_IMAGE_KEYS = new Set([
  'hero.image',
  'about.image',
  'features.image',
  'stats.image',
  'stats.avatar1',
  'stats.avatar2',
  'stats.avatar3',
  'stats.avatar4',
  'insights.image',
  'smart.image',
  'onboarding.image',
  'testimonials.avatar1',
  'testimonials.avatar2',
  'testimonials.avatar3',
]);

export function isAllowedCmsImageField(fieldKey: string): boolean {
  if (CMS_IMAGE_KEYS.has(fieldKey)) {
    return true;
  }
  return fieldKey.startsWith('fd.logo.') || fieldKey.startsWith('fd.hero.');
}

export const CMS_FIELD_GROUPS: CmsField[] = [
  { key: 'hero.badge', label: 'Badge', section: 'Hero' },
  { key: 'hero.title', label: 'Title', section: 'Hero', multiline: true },
  { key: 'hero.subtitle', label: 'Subtitle', section: 'Hero', multiline: true },
  { key: 'hero.appStoreUrl', label: 'App Store URL', section: 'Hero', type: 'url' },
  { key: 'hero.playStoreUrl', label: 'Google Play URL', section: 'Hero', type: 'url' },
  { key: 'hero.image', label: 'Block Image', section: 'Hero', type: 'image' },
  { key: 'liveRates.label', label: 'Marquee Label', section: 'Live FD Rates' },

  { key: 'about.badge', label: 'Badge', section: 'About' },
  { key: 'about.title', label: 'Title', section: 'About' },
  { key: 'about.image', label: 'Block Image', section: 'About', type: 'image' },
  { key: 'about.card1.title', label: 'Card 1 Title', section: 'About' },
  { key: 'about.card1.body', label: 'Card 1 Body', section: 'About', multiline: true },
  { key: 'about.card2.title', label: 'Card 2 Title', section: 'About' },
  { key: 'about.card2.body', label: 'Card 2 Body', section: 'About', multiline: true },
  { key: 'about.card3.title', label: 'Card 3 Title', section: 'About' },
  { key: 'about.card3.body', label: 'Card 3 Body', section: 'About', multiline: true },

  { key: 'trusted.title', label: 'Title', section: 'Trusted Companies' },

  { key: 'features.badge', label: 'Badge', section: 'Features' },
  { key: 'features.title', label: 'Title', section: 'Features' },
  { key: 'features.subtitle', label: 'Subtitle', section: 'Features', multiline: true },
  { key: 'features.image', label: 'Block Image', section: 'Features', type: 'image' },

  { key: 'dicgc.badge', label: 'Badge', section: 'DICGC Insurance' },
  { key: 'dicgc.headline', label: 'Headline', section: 'DICGC Insurance', multiline: true },
  { key: 'dicgc.body', label: 'Body', section: 'DICGC Insurance', multiline: true },
  { key: 'dicgc.amount', label: 'Insurance Amount', section: 'DICGC Insurance' },
  { key: 'dicgc.note', label: 'Note', section: 'DICGC Insurance', multiline: true },

  { key: 'insights.badge', label: 'Badge', section: 'Insights' },
  { key: 'insights.title', label: 'Title', section: 'Insights', multiline: true },
  { key: 'insights.subtitle', label: 'Subtitle', section: 'Insights', multiline: true },
  { key: 'insights.image', label: 'Block Image', section: 'Insights', type: 'image' },

  { key: 'smart.title', label: 'Title', section: 'Smart Features', multiline: true },
  { key: 'smart.subtitle', label: 'Subtitle', section: 'Smart Features', multiline: true },
  { key: 'smart.cta', label: 'CTA Button', section: 'Smart Features' },
  { key: 'smart.image', label: 'Block Image', section: 'Smart Features', type: 'image' },

  { key: 'pricing.badge', label: 'Badge', section: 'Pricing' },
  { key: 'pricing.title', label: 'Title', section: 'Pricing' },
  { key: 'pricing.subtitle', label: 'Subtitle', section: 'Pricing', multiline: true },

  { key: 'testimonials.badge', label: 'Badge', section: 'Testimonials' },
  { key: 'testimonials.title', label: 'Title', section: 'Testimonials' },
  { key: 'testimonials.subtitle', label: 'Subtitle', section: 'Testimonials', multiline: true },
  { key: 'testimonials.avatar1', label: 'Client 1 Photo', section: 'Testimonials', type: 'image' },
  { key: 'testimonials.avatar2', label: 'Client 2 Photo', section: 'Testimonials', type: 'image' },
  { key: 'testimonials.avatar3', label: 'Client 3 Photo', section: 'Testimonials', type: 'image' },

  { key: 'onboarding.badge', label: 'Badge', section: 'Onboarding' },
  { key: 'onboarding.title', label: 'Title', section: 'Onboarding', multiline: true },
  { key: 'onboarding.subtitle', label: 'Subtitle', section: 'Onboarding', multiline: true },
  { key: 'onboarding.cta', label: 'CTA Button', section: 'Onboarding' },
  { key: 'onboarding.image', label: 'Block Image', section: 'Onboarding', type: 'image' },

  { key: 'stats.image', label: 'Team Photo', section: 'Stats & Team', type: 'image' },
  { key: 'stats.avatar1', label: 'Team Avatar 1', section: 'Stats & Team', type: 'image' },
  { key: 'stats.avatar2', label: 'Team Avatar 2', section: 'Stats & Team', type: 'image' },
  { key: 'stats.avatar3', label: 'Team Avatar 3', section: 'Stats & Team', type: 'image' },
  { key: 'stats.avatar4', label: 'Team Avatar 4', section: 'Stats & Team', type: 'image' },

  { key: 'footer.description', label: 'Description', section: 'Footer', multiline: true },
  { key: 'footer.copyright', label: 'Copyright', section: 'Footer' },
];

export function createEmptyCmsContent(): Record<string, string> {
  const content: Record<string, string> = {};
  for (const field of CMS_FIELD_GROUPS) {
    content[field.key] = '';
  }
  return content;
}

/** Empty field scaffold — live copy comes from MS SQL Server via `/api/content`. */
export const DEFAULT_CMS_CONTENT: Record<string, string> = createEmptyCmsContent();

/** Legacy SaaS template strings previously seeded into SQL or file storage. */
export const LEGACY_SAAS_TEMPLATE_CONTENT: Record<string, string> = {
  'hero.badge': 'Turn Data Into Growth',
  'hero.title': 'All-in-One SaaS analytics platform',
  'hero.subtitle':
    'Our all-in-one Analytics Platform empowers businesses to transform raw data into actionable insights ease.',
  'hero.appStoreUrl': 'https://apps.apple.com/app/checkout',
  'hero.playStoreUrl': 'https://play.google.com/store/apps/details?id=com.checkout',
  'liveRates.label': 'Live Rates',
  'about.badge': 'Managed in One Place',
  'about.title': 'Unified platform for analytics solutions',
  'about.card1.title': 'Real-Time Insights',
  'about.card1.body':
    'Stay ahead with real-time insights that give once place intuitive platform into SaaS analytics.',
  'about.card2.title': 'Industry-Leading Security',
  'about.card2.body':
    'Protecting your data is our top priority. With industry-leading security measures, our platform ensures information.',
  'about.card3.title': 'Data-Driven Budgeting',
  'about.card3.body':
    'Take control of your finances with smart budgeting that adapts to your goals. Our platform provides real-time insights.',
  'trusted.title': 'Trusted by over 1.7 million companies worldwide',
  'features.badge': 'Fixed Deposits',
  'features.title': 'Compare And Book Your Fixed Deposits',
  'features.subtitle':
    'Browse partner bank FD rates and calculate returns for general and senior citizen customers in one place.',
  'platform.badge': 'What Stands Out',
  'platform.title': 'Innovation at Our Core',
  'platform.subtitle':
    'We go beyond traditional analytics by combining innovation, simplicity, and performance in one powerful platform.',
  'insights.badge': 'Simplify Your Finances',
  'insights.title': 'Manage your finances with confidence.',
  'insights.subtitle':
    'Take control of your finances with ease. Our platform helps you simplify your spending make smarter financial decisions.',
  'smart.title': 'Smart features. smarter growth.',
  'smart.subtitle':
    'Data Visualization turns complexity into clarity by transforming raw information into meaningful visuals. Instead of getting lost in endless numbers.',
  'smart.cta': 'Get 14-days Free Trials',
  'pricing.badge': 'Pricing Package',
  'pricing.title': 'Simple & transparent pricing',
  'pricing.subtitle':
    'Choose a plan that matches your needs and budget. Our pricing packages are designed to be simple and flexible.',
  'testimonials.badge': 'Our Testimonials',
  'testimonials.title': 'Lovely clients say us',
  'testimonials.subtitle':
    'Clients are at the heart of everything we do, and their success stories speak louder than words.',
  'onboarding.badge': 'Simplify Your Finances',
  'onboarding.title': 'Start your analytics journey in minutes',
  'onboarding.subtitle':
    'Ready to harness the full power of your data? Our platform makes analytics simple actionable.',
  'onboarding.cta': 'Get 14-days Free Trials',
  'footer.description':
    'We empower businesses to connect with their audience in smarter, faster, and more meaningful ways.',
  'footer.copyright': 'CheckOut, 2025 © All rights reserved',
};

export type CmsPayload = {
  content: Record<string, string>;
  fdRates: FdRateRow[];
  sections: Record<CmsSectionId, boolean>;
  sectionOrder: CmsSectionId[];
};

export function mergeCmsContent(overrides: Record<string, string> = {}): Record<string, string> {
  return { ...createEmptyCmsContent(), ...overrides };
}

export function mergeFdRates(rows: FdRateRow[] | undefined): FdRateRow[] {
  if (!rows || rows.length === 0) {
    return DEFAULT_FD_RATES.map((row) => normalizeFdRateRow(row));
  }

  const defaultsById = new Map(DEFAULT_FD_RATES.map((entry) => [entry.id, entry]));

  return rows.map((row) => {
    const fallback = defaultsById.get(row.id);
    return normalizeFdRateRow({
      id: row.id,
      name: row.name ?? fallback?.name ?? 'Bank',
      rate: row.rate ?? fallback?.rate ?? '0.00%',
      logoUrl: row.logoUrl ?? fallback?.logoUrl ?? '',
      heroImageUrl: row.heroImageUrl ?? fallback?.heroImageUrl ?? '',
      tenures: row.tenures?.length ? row.tenures : fallback?.tenures,
    });
  });
}

export function mergeSections(
  sections: Partial<Record<CmsSectionId, boolean>> | undefined,
): Record<CmsSectionId, boolean> {
  return { ...DEFAULT_SECTION_VISIBILITY, ...sections };
}

export function mergeCmsPayload(stored: {
  content?: Record<string, string>;
  fdRates?: FdRateRow[];
  sections?: Partial<Record<CmsSectionId, boolean>>;
  sectionOrder?: CmsSectionId[];
}): CmsPayload {
  return {
    content: mergeCmsContent(stored.content),
    fdRates: mergeFdRates(stored.fdRates),
    sections: mergeSections(stored.sections),
    sectionOrder: mergeSectionOrder(stored.sectionOrder),
  };
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export function splitMultiline(value: string): string[] {
  if (value.includes('<')) {
    return [value];
  }
  return value.split('\n').filter(Boolean);
}

export function resolveCmsImage(value: string | undefined, fallback = ''): string {
  if (!value) {
    return fallback;
  }
  return value;
}

export function createFdTenureRow(): FdTenureRow {
  return {
    id: `tenure-${Date.now()}`,
    label: '1Y',
    months: 12,
    regularRate: 7,
    seniorRate: 7.5,
    popular: false,
  };
}

export function createFdRateRow(): FdRateRow {
  return normalizeFdRateRow({
    id: `bank-${Date.now()}`,
    name: 'New Bank',
    rate: '7.00%',
    logoUrl: '',
    heroImageUrl: '',
    tenures: buildDefaultTenures(7),
  });
}
