'use client'

import {
  CheckIcon,
  StarIcon,
  ArrowRightIcon,
  HeartIcon,
  ShieldCheckIcon,
  UsersIcon,
  SparklesIcon,
  HandRaisedIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline'

import {
  CheckBadgeIcon,
} from '@heroicons/react/24/solid'

interface Feature {
  name: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

// interface Stat {
//   name: string
//   value: string
// }

interface TeamMember {
  name: string
  role: string
  image: string
  bio: string
}

const features: Feature[] = [
  {
    name: 'Quality Products',
    description:
      'Thoughtfully selected products that meet our standards for quality, usefulness, and value.',
    icon: CheckBadgeIcon,
  },
  {
    name: 'Customer First',
    description:
      'Your satisfaction matters. We aim to make every interaction simple, helpful, and enjoyable.',
    icon: HeartIcon,
  },
  {
    name: 'Secure Shopping',
    description:
      'Shop with confidence with secure checkout and careful handling of your personal information.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Here to Help',
    description:
      'Our team is committed to helping you find what you need and answering your questions.',
    icon: UsersIcon,
  },
]

// const stats: Stat[] = [
//   { name: 'Customer focused', value: 'Always' },
//   { name: 'Product selection', value: 'Curated' },
//   { name: 'Shopping experience', value: 'Simple' },
//   { name: 'Our commitment', value: 'Quality' },
// ]

const team: TeamMember[] = [
  {
    name: 'Prashant Kumar',
    role: 'Founder & CEO',
    image: '/images/users/boy-avatar-img.png',
    bio: 'Prashant founded HomeShoppie with a vision to make quality products and everyday shopping more accessible.',
  },
  {
    name: 'Chandni Kumari',
    role: 'Head of Product',
    image: '/images/users/girl-avatar-img.png',
    bio: 'Chandni helps shape our product selection, with a focus on bringing customers useful products and a better shopping experience.',
  },
]

const values = [
  {
    name: 'Quality First',
    description:
      'We focus on offering products that deliver quality, usefulness, and value for your money.',
    icon: StarIcon,
  },
  {
    name: 'Customer Obsessed',
    description:
      'We listen to our customers, learn from their feedback, and continuously work to serve them better.',
    icon: HeartIcon,
  },
  {
    name: 'Honest & Transparent',
    description:
      'Clear product information, straightforward communication, and a shopping experience you can trust.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Growing Together',
    description:
      'We believe in building lasting relationships with customers, suppliers, and our wider community.',
    icon: HandRaisedIcon,
  },
]

export default function AboutPage() {
  return (
    <main className="overflow-hidden bg-white text-gray-900">
      {/* Hero */}
      <section className="relative isolate">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-br from-orange-50 via-white to-amber-50"
        />

        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl sm:h-96 sm:w-96"
        />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm">
              <SparklesIcon className="h-4 w-4" />
              Get to know HomeShoppie
            </div>

            <h1 className="mt-7 text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl lg:text-6xl lg:leading-[1.1]">
              Thoughtful shopping.
              <span className="mt-2 block text-orange-600">
                A happier home.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-gray-600 sm:text-lg">
              We believe everyday shopping should be simple, enjoyable, and
              rewarding. At HomeShoppie, we bring together carefully selected
              products with a commitment to quality, value, and customer care.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/products"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-600/20 transition duration-200 hover:-translate-y-0.5 hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2"
              >
                Explore our products
                <ArrowRightIcon className="h-4 w-4" />
              </a>

              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-800 transition hover:border-orange-300 hover:bg-orange-50"
              >
                Get in touch
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-2">
                <CheckCircleIconFallback />
                Carefully selected products
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircleIconFallback />
                Customer-focused service
              </span>
            </div>
          </div>

          {/* Decorative brand panel */}
          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-orange-200/60 to-amber-100/50 blur-xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white bg-white p-5 shadow-2xl shadow-orange-900/10 sm:p-7">
              <div className="rounded-[1.5rem] bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 p-7 text-white sm:p-9">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15">
                  <ShoppingBagIcon className="h-8 w-8" />
                </div>

                <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-orange-100">
                  Our promise
                </p>

                <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
                  Little things that make life better.
                </h2>

                <p className="mt-4 max-w-sm text-sm leading-7 text-orange-50 sm:text-base">
                  A more thoughtful way to discover the products you love,
                  with quality and care at the heart of what we do.
                </p>

                <div className="mt-8 flex items-center gap-3 border-t border-white/20 pt-5">
                  <div className="flex -space-x-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-orange-600 bg-amber-100 text-orange-800">
                      <HeartIcon className="h-4 w-4" />
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-orange-600 bg-orange-100 text-orange-800">
                      <StarIcon className="h-4 w-4" />
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-orange-600 bg-white text-orange-700">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">Made for your needs</p>
                    <p className="mt-0.5 text-xs text-orange-100">
                      Quality · Care · Value
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="rounded-2xl bg-orange-50 p-4">
                  <HeartIcon className="h-6 w-6 text-orange-600" />
                  <p className="mt-3 text-sm font-bold text-gray-900">
                    Customer care
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Your needs come first.
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-50 p-4">
                  <ShieldCheckIcon className="h-6 w-6 text-amber-700" />
                  <p className="mt-3 text-sm font-bold text-gray-900">
                    Shop confidently
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Trust in every interaction.
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 -left-3 hidden items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xl sm:flex">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                <CheckBadgeIcon className="h-6 w-6 text-green-600" />
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Quality matters
                </p>
                <p className="text-xs text-gray-500">
                  In everything we do
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
            <HeartIcon className="h-4 w-4" />
            Why we exist
          </span>

          <h2 className="mt-5 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Our mission is to make shopping better.
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-gray-600 sm:text-lg">
            We want to make it easier to discover products that fit your
            everyday life. By focusing on quality, thoughtful selection,
            affordability, and helpful service, HomeShoppie aims to make every
            shopping experience a little more enjoyable.
          </p>

          <div className="mx-auto mt-10 h-1 w-20 rounded-full bg-orange-500" />
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-gray-100 bg-gray-50/80 px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">
              The HomeShoppie difference
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              Shopping with you in mind
            </h2>
            <p className="mt-4 text-base leading-7 text-gray-600">
              The principles that shape how we select products and serve our
              customers.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
            {features.map((feature) => (
              <article
                key={feature.name}
                className="group rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-900/5 sm:p-7"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 transition-colors group-hover:bg-orange-600 group-hover:text-white">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </div>

                <h3 className="mt-6 text-lg font-bold text-gray-900">
                  {feature.name}
                </h3>

                <p className="mt-3 text-sm leading-7 text-gray-600">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Brand principles */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">
              What drives us
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              More than products.
              <span className="block text-orange-600">
                It&apos;s about trust.
              </span>
            </h2>

            <p className="mt-6 text-base leading-8 text-gray-600">
              We know that a great shopping experience is about more than
              finding an item. It is about knowing what you are buying,
              feeling confident in your choices, and receiving the support
              you deserve.
            </p>

            <a
              href="/products"
              className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-orange-700 transition hover:gap-3 hover:text-orange-800"
            >
              Discover HomeShoppie
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {values.map((value, index) => (
              <article
                key={value.name}
                className={`rounded-2xl border p-6 transition duration-200 hover:-translate-y-1 hover:shadow-lg ${
                  index % 2 === 0
                    ? 'border-orange-100 bg-orange-50/60'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm ring-1 ring-gray-100">
                  <value.icon className="h-6 w-6" aria-hidden="true" />
                </div>

                <h3 className="mt-5 text-base font-bold text-gray-900">
                  {value.name}
                </h3>

                <p className="mt-2 text-sm leading-7 text-gray-600">
                  {value.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="border-y border-gray-100 bg-gray-50 px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">
              The people behind the brand
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              Meet our team
            </h2>

            <p className="mt-4 text-base leading-7 text-gray-600 sm:text-lg">
              A shared commitment to thoughtful products, better service, and
              a shopping experience customers can feel good about.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2 lg:mt-16">
            {team.map((person) => (
              <article
                key={person.name}
                className="group overflow-hidden rounded-3xl border border-gray-200 bg-white p-7 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-9"
              >
                <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-orange-100 to-amber-50 p-1 ring-4 ring-orange-50 transition group-hover:ring-orange-100 sm:h-32 sm:w-32">
                  <img
                    src={person.image}
                    alt={person.name}
                    width={128}
                    height={128}
                    loading="lazy"
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>

                <h3 className="mt-6 text-xl font-bold text-gray-950">
                  {person.name}
                </h3>

                <p className="mt-2 inline-flex rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
                  {person.role}
                </p>

                <p className="mt-4 text-sm leading-7 text-gray-600">
                  {person.bio}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 via-orange-600 to-amber-600 px-6 py-12 text-center shadow-xl shadow-orange-900/10 sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-20 h-56 w-56 rounded-full border-[30px] border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full border-[30px] border-white/10"
          />

          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <SparklesIcon className="h-6 w-6 text-white" />
            </div>

            <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Your next favourite find awaits.
            </h2>

            <p className="mt-4 text-base leading-7 text-orange-50 sm:text-lg">
              Explore HomeShoppie and discover products selected with your
              everyday needs in mind.
            </p>

            <a
              href="/products"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-orange-700 shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-600"
            >
              Start exploring
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}

function CheckCircleIconFallback() {
  return (
    <CheckIcon
      className="h-4 w-4 shrink-0 text-green-600"
      aria-hidden="true"
    />
  )
}