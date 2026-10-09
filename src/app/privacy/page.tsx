
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | HomeShoppie',
  description:
    'Learn how HomeShoppie collects, uses, protects, and manages your personal information when you shop online.',
  alternates: {
    canonical: 'https://homeshoppie.com/privacy',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const sections = [
  {
    id: 'information-we-collect',
    title: '1. Information We Collect',
    content: (
      <>
        <p>
          When you use HomeShoppie, we may collect information necessary to
          provide our shopping services, process orders, and support your
          account.
        </p>
        <ul>
          <li>
            <strong>Account information:</strong> Name, email address, phone
            number, and authentication details you provide.
          </li>
          <li>
            <strong>Order information:</strong> Products purchased, order
            history, delivery address, billing details, and order status.
          </li>
          <li>
            <strong>Payment information:</strong> Payment status, transaction
            references, and related payment details. Payment credentials are
            handled according to the payment provider's systems and the
            integration used for your transaction.
          </li>
          <li>
            <strong>Technical information:</strong> IP address, browser type,
            device information, and website activity where collected by our
            systems or enabled services.
          </li>
          <li>
            <strong>Communications:</strong> Messages, feedback, and support
            requests you send us.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-we-use-information',
    title: '2. How We Use Your Information',
    content: (
      <>
        <p>We may use your information to:</p>
        <ul>
          <li>Create and manage your customer account.</li>
          <li>Process orders and payments and arrange deliveries.</li>
          <li>Send order confirmations, shipping updates, and service messages.</li>
          <li>Respond to customer support requests and resolve disputes.</li>
          <li>Detect fraud, prevent abuse, and protect website security.</li>
          <li>Maintain business records and comply with applicable laws.</li>
          <li>Improve our products, services, and shopping experience.</li>
          <li>
            Send promotional communications where permitted and, when required,
            with your consent.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'sharing-information',
    title: '3. When We Share Information',
    content: (
      <>
        <p>
          We do not sell your personal information as a business practice. We
          may share relevant information with trusted parties when necessary
          to operate HomeShoppie, including:
        </p>
        <ul>
          <li>
            <strong>Payment providers:</strong> To process and verify payments
            and refunds.
          </li>
          <li>
            <strong>Delivery partners:</strong> To ship orders and deliver
            products to your address.
          </li>
          <li>
            <strong>Technology providers:</strong> Hosting, infrastructure,
            email delivery, security, and other services used to operate our
            website.
          </li>
          <li>
            <strong>Authorities:</strong> When disclosure is required by law
            or is necessary to protect legal rights and safety.
          </li>
        </ul>
        <p>
          Such parties may process information under their own terms and
          privacy policies. We aim to share only information relevant to the
          purpose.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: '4. Cookies and Similar Technologies',
    content: (
      <p>
        HomeShoppie and services used on the website may use cookies or similar
        technologies to maintain sessions, support account authentication,
        remember preferences, protect against abuse, and understand website
        performance where applicable. You can manage cookies through your
        browser settings. Disabling certain cookies may affect sign-in,
        checkout, or other website features.
      </p>
    ),
  },
  {
    id: 'security',
    title: '5. Data Security and Retention',
    content: (
      <p>
        We use reasonable technical and organisational measures designed to
        protect personal information against unauthorised access, loss,
        misuse, or alteration. No method of electronic storage or transmission
        is completely secure, and absolute security cannot be guaranteed.
        Information is retained for as long as reasonably necessary for the
        purposes described in this policy, including order fulfilment,
        customer support, accounting, dispute resolution, and legal
        obligations. Retention periods depend on the type of information and
        applicable requirements.
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: '6. Your Privacy Choices and Rights',
    content: (
      <>
        <p>
          Subject to applicable law, you may request access to, correction of,
          or deletion of your personal information, and exercise any other
          applicable privacy rights.
        </p>
        <p>
          You can contact us to raise a privacy concern or request assistance
          with your account information. We may need to verify your identity
          before acting on a request. Some information may need to be retained
          where required by law or for legitimate business purposes.
        </p>
        <p>
          You can also opt out of promotional emails using the unsubscribe
          instructions provided, where available. Essential transactional and
          service communications may still be sent.
        </p>
      </>
    ),
  },
  {
    id: 'third-party-services',
    title: '7. Third-Party Services and Links',
    content: (
      <p>
        Our website may use third-party payment, delivery, authentication,
        hosting, or other services and may link to external websites. Those
        services and websites may have their own privacy practices. Please
        review their applicable policies. We are not responsible for the
        privacy practices of independent third parties, except to the extent
        required by applicable law.
      </p>
    ),
  },
  {
    id: 'children',
    title: '8. Children’s Privacy',
    content: (
      <p>
        HomeShoppie is intended for people who can lawfully make purchases
        under applicable law. We do not knowingly seek to collect personal
        information from children in circumstances where doing so is
        prohibited. If you believe a child has provided personal information
        inappropriately, please contact us so we can review the matter.
      </p>
    ),
  },
  {
    id: 'changes',
    title: '9. Changes to This Policy',
    content: (
      <p>
        We may update this Privacy Policy when our services, practices, or
        legal obligations change. The revised version will be published on
        this page with an updated effective date. We encourage you to review
        this page periodically.
      </p>
    ),
  },
  {
    id: 'contact',
    title: '10. Contact Us',
    content: (
      <>
        <p>
          For privacy questions, requests, or complaints, contact HomeShoppie
          using the details below.
        </p>
        <p>
          <strong>Email:</strong>{' '}
          <a
            className="font-semibold text-emerald-700 underline underline-offset-4"
            href="mailto:support@homeshoppie.com"
          >
            support@homeshoppie.com
          </a>
        </p>
        <p>
          <strong>Website:</strong>{' '}
          <a
            className="font-semibold text-emerald-700 underline underline-offset-4"
            href="https://homeshoppie.com"
          >
            homeshoppie.com
          </a>
        </p>
        <p>
          <strong>Location:</strong> Bihar, India
        </p>
      </>
    ),
  },
]

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-800">
      <section className="border-b border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-green-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-emerald-100 transition hover:text-white"
          >
            <span aria-hidden="true">←</span> Back to HomeShoppie
          </Link>

          <div className="mt-8 max-w-3xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Your privacy matters
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-emerald-50 sm:text-lg">
              We believe in transparent shopping. This policy explains how
              HomeShoppie handles your information when you visit our website,
              create an account, or place an order.
            </p>
            <p className="mt-6 text-sm text-emerald-100">
              Effective date: 9 October 2026
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">
            On this page
          </h2>
          <nav aria-label="Privacy policy sections" className="mt-4">
            <ul className="space-y-2.5">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm leading-6 text-stone-600 transition hover:text-emerald-700"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8 lg:p-10">
          <div className="mb-8 rounded-xl border border-emerald-100 bg-emerald-50 p-5">
            <h2 className="font-semibold text-emerald-950">
              In brief
            </h2>
            <p className="mt-2 text-sm leading-7 text-emerald-900/80">
              We use relevant information to manage accounts, fulfil orders,
              coordinate payments and deliveries, provide support, and protect
              our services. This policy describes those practices and the
              choices available to you.
            </p>
          </div>

          <div className="divide-y divide-stone-100">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28 py-7 first:pt-0 last:pb-0"
              >
                <h2 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-stone-600 sm:text-base sm:leading-8 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:max-w-none [&_strong]:font-semibold [&_strong]:text-stone-800 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10 border-t border-stone-200 pt-6 text-sm text-stone-500">
            Please also review our{' '}
            <Link
              href="/terms"
              className="font-semibold text-emerald-700 underline underline-offset-4 hover:text-emerald-900"
            >
              Terms &amp; Conditions
            </Link>
            .
          </div>
        </article>
      </div>
    </main>
  )
}
