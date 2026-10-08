export const SEO_CONFIG = {
  siteName: 'HomeShoppie',

  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    'https://homeshoppie.com',

  defaultTitle:
    'HomeShoppie | Authentic Indian Foods & Products Online',

  titleTemplate: '%s | HomeShoppie',

  description:
    'Shop authentic Indian foods, traditional snacks, groceries, pooja items and more online at HomeShoppie.',

  keywords: [
    'HomeShoppie',
    'Indian food online',
    'Indian products online',
    'traditional Indian snacks',
    'namkeen online',
    'thekua online',
    'gujiya online',
    'desi ghee',
    'mustard oil',
    'pooja items online',
  ],

  locale: 'en_IN',

  twitterHandle: '@HomeShoppie',

  organization: {
    name: 'HomeShoppie',
    url: 'https://homeshoppie.com',
  },
} as const