import {
  HandRaisedIcon,
  SparklesIcon,
  HeartIcon,
  TruckIcon,
  CheckBadgeIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

interface Feature {
  id: number
  title: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const features: Feature[] = [
  {
    id: 1,
    title: 'Traditional Methods',
    description:
      'Made using time-honoured recipes and traditional methods passed down through generations.',
    icon: HandRaisedIcon,
  },
  {
    id: 2,
    title: 'Pure Ingredients',
    description:
      'Quality ingredients sourced with care from trusted farmers and reliable suppliers.',
    icon: SparklesIcon,
  },
  {
    id: 3,
    title: 'Handmade Quality',
    description:
      'Every product receives careful attention to detail, from preparation to final packaging.',
    icon: HandRaisedIcon,
  },
  {
    id: 4,
    title: 'Fresh Delivery',
    description:
      'Freshly prepared products delivered safely to your doorstep with care and attention.',
    icon: TruckIcon,
  },
  {
    id: 5,
    title: 'Authentic Taste',
    description:
      'Traditional flavours and familiar recipes that bring the taste of home to every bite.',
    icon: CheckBadgeIcon,
  },
  {
    id: 6,
    title: 'Family Trust',
    description:
      'Built around honest products, dependable service, and relationships with our customers.',
    icon: UserGroupIcon,
  },
]

const stats = [
  {
    value: '1,000+',
    label: 'Happy Customers',
  },
  {
    value: '50+',
    label: 'Premium Products',
  },
  {
    value: '5.0',
    label: 'Average Rating',
  },
  {
    value: '24/7',
    label: 'Customer Support',
  },
]

export default function WhyChooseUs() {
  return (
    <section className="bg-white py-20 sm:py-24 lg:py-28">
      <div className="container-custom">

        {/* =====================================================
            SECTION HEADER
        ====================================================== */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-600">
            Why HomeShoppie
          </p>

          <h2
            className="
              mt-3
              text-3xl font-bold tracking-tight text-slate-950
              sm:text-4xl
              lg:text-[2.75rem]
            "
          >
            Good products. Honest values.
          </h2>

          <p
            className="
              mx-auto mt-5
              max-w-2xl
              text-base leading-7 text-slate-500
              sm:text-lg
            "
          >
            We combine traditional Indian craftsmanship with the
            convenience of modern shopping to bring quality products
            to your home.
          </p>
        </div>

        {/* =====================================================
            FEATURES
        ====================================================== */}
        <div
          className="
            mt-14
            grid
            grid-cols-1
            gap-5
            sm:grid-cols-2
            lg:grid-cols-3
            lg:gap-6
          "
        >
          {features.map((feature) => {
            const Icon = feature.icon

            return (
              <article
                key={feature.id}
                className="
                  group
                  flex h-full
                  rounded-2xl
                  border border-slate-200
                  bg-white
                  p-6
                  sm:p-7
                  shadow-[0_1px_3px_rgba(15,23,42,0.04)]
                  transition-all duration-200
                  hover:border-slate-300
                  hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]
                "
              >
                {/* Icon */}
                <div
                  className="
                    flex h-11 w-11
                    shrink-0
                    items-center justify-center
                    rounded-xl
                    border border-primary-100
                    bg-primary-50
                    text-primary-600
                    transition-colors duration-200
                    group-hover:bg-primary-600
                    group-hover:text-white
                  "
                >
                  <Icon
                    className="h-5.5 w-5.5"
                    aria-hidden="true"
                  />
                </div>

                {/* Content */}
                <div className="ml-4 min-w-0">
                  <h3
                    className="
                      text-base
                      font-semibold
                      text-slate-900
                    "
                  >
                    {feature.title}
                  </h3>

                  <p
                    className="
                      mt-2
                      text-sm
                      leading-6
                      text-slate-500
                    "
                  >
                    {feature.description}
                  </p>
                </div>
              </article>
            )
          })}
        </div>

        {/* =====================================================
            TRUST / STATS
        ====================================================== */}
        <div
          className="
            mt-14
            overflow-hidden
            rounded-2xl
            border border-slate-200
            bg-slate-50
          "
        >
          <div
            className="
              grid
              grid-cols-2
              divide-x divide-y divide-slate-200
              lg:grid-cols-4
              lg:divide-y-0
            "
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="
                  px-5 py-7
                  text-center
                  sm:px-6 sm:py-8
                "
              >
                <p
                  className="
                    text-2xl
                    font-bold
                    tracking-tight
                    text-slate-950
                    sm:text-3xl
                  "
                >
                  {stat.value}
                </p>

                <p
                  className="
                    mt-1.5
                    text-xs
                    font-medium
                    text-slate-500
                    sm:text-sm
                  "
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* =====================================================
            TRUST MESSAGE
        ====================================================== */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
            <HeartIcon
              className="h-4 w-4 text-primary-500"
              aria-hidden="true"
            />

            <span>
              Made with care for homes across India
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
