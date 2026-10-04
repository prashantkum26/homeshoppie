import Link from 'next/link'

const quickLinks = [
  { label: 'All Products', href: '/products' },
  { label: 'Categories', href: '/categories' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact Us', href: '/contact' },
]

const customerLinks = [
  { label: 'Shipping Information', href: '/shipping' },
  { label: 'Returns & Refunds', href: '/returns' },
  { label: 'Frequently Asked Questions', href: '/faq' },
  { label: 'Track Your Order', href: '/track-order' },
]

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.7" r="1" fill="currentColor" />
    </svg>
  )
}

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M2.75 5.75A2.75 2.75 0 015.5 3h2.04a1.5 1.5 0 011.43 1.04l1.05 3.16a1.5 1.5 0 01-.55 1.68l-1.72 1.29a13.42 13.42 0 006.08 6.08l1.29-1.72a1.5 1.5 0 011.68-.55l3.16 1.05A1.5 1.5 0 0121 16.46v2.04A2.75 2.75 0 0118.25 21C9.78 21 3 14.22 3 5.75h-.25Z"
      />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="m3 7 7.74 5.42a2.18 2.18 0 002.52 0L21 7"
      />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1116 0Z"
      />
      <circle cx="12" cy="10" r="2.5" strokeWidth="1.7" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
      aria-hidden="true"
    >
      <path
        d="M4 10h12M11 5l5 5-5 5"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="container-custom">
        {/* Main footer */}
        <div className="py-14 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Brand */}
            <div className="lg:col-span-5">
              <Link
                href="/"
                className="inline-flex items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                aria-label="HomeShoppie home"
              >
                <span className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Home<span className="text-primary-400">Shoppie</span>
                </span>
              </Link>

              <p className="mt-5 max-w-md text-sm leading-7 text-slate-400 sm:text-[15px]">
                Authentic homemade goodness, traditional Indian favourites,
                and thoughtfully selected pooja essentials — brought to your
                doorstep with care.
              </p>

              {/* Trust message */}
              <div className="mt-7 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-primary-400">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m9 12 2 2 4-4"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Made with care
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Quality you can trust
                  </p>
                </div>
              </div>

              {/* Social */}
              <div className="mt-8 flex items-center gap-2.5">
                <a
                  href="#"
                  aria-label="HomeShoppie on Facebook"
                  className="group flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <FacebookIcon />
                </a>

                <a
                  href="#"
                  aria-label="HomeShoppie on Instagram"
                  className="group flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <InstagramIcon />
                </a>

                <a
                  href="#"
                  aria-label="HomeShoppie on X"
                  className="group flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <TwitterIcon />
                </a>
              </div>
            </div>

            {/* Quick links */}
            <nav className="lg:col-span-2" aria-label="Quick links">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                Explore
              </h2>

              <ul className="mt-5 space-y-3.5">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors duration-200 hover:text-white focus:outline-none focus-visible:text-white"
                    >
                      <span>{link.label}</span>
                      <ArrowIcon />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Customer service */}
            <nav className="lg:col-span-2" aria-label="Customer service">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                Help
              </h2>

              <ul className="mt-5 space-y-3.5">
                {customerLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors duration-200 hover:text-white focus:outline-none focus-visible:text-white"
                    >
                      <span>{link.label}</span>
                      <ArrowIcon />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Contact */}
            <div className="lg:col-span-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                Get in touch
              </h2>

              <div className="mt-5 space-y-4">
                <a
                  href="tel:+910000000000"
                  className="group flex items-start gap-3 rounded-lg transition-colors duration-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-primary-400 transition-colors group-hover:border-slate-700">
                    <PhoneIcon />
                  </span>

                  <span>
                    <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Call us
                    </span>
                    <span className="mt-1 block text-sm text-slate-300 group-hover:text-white">
                      +91 00000 00000
                    </span>
                  </span>
                </a>

                <a
                  href="mailto:support@homeshoppie.com"
                  className="group flex items-start gap-3 rounded-lg transition-colors duration-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-primary-400 transition-colors group-hover:border-slate-700">
                    <MailIcon />
                  </span>

                  <span>
                    <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Email us
                    </span>
                    <span className="mt-1 block break-all text-sm text-slate-300 group-hover:text-white">
                      support@homeshoppie.com
                    </span>
                  </span>
                </a>

                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-primary-400">
                    <LocationIcon />
                  </span>

                  <span>
                    <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Based in
                    </span>
                    <span className="mt-1 block text-sm text-slate-300">
                      Bihar, India
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact strip */}
        <div className="border-t border-slate-800">
          <div className="grid grid-cols-1 divide-y divide-slate-800 py-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:py-7">
            <div className="py-3 sm:px-6 sm:py-0 sm:first:pl-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                Quality
              </p>
              <p className="mt-1.5 text-sm text-slate-300">
                Carefully selected products
              </p>
            </div>

            <div className="py-3 sm:px-6 sm:py-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                Service
              </p>
              <p className="mt-1.5 text-sm text-slate-300">
                Here when you need us
              </p>
            </div>

            <div className="py-3 sm:px-6 sm:py-0 sm:last:pr-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                Delivery
              </p>
              <p className="mt-1.5 text-sm text-slate-300">
                Delivered with care
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 py-6">
          <div className="flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-500">
              © {currentYear} HomeShoppie. All rights reserved.
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                href="/privacy"
                className="text-slate-500 transition-colors duration-200 hover:text-white focus:outline-none focus-visible:text-white"
              >
                Privacy Policy
              </Link>

              <Link
                href="/terms"
                className="text-slate-500 transition-colors duration-200 hover:text-white focus:outline-none focus-visible:text-white"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
