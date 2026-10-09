
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms & Conditions | HomeShoppie',
  description:
    'Read the terms governing purchases, payments, shipping, cancellations, returns, refunds, and use of HomeShoppie.',
  alternates: {
    canonical: 'https://homeshoppie.com/terms',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    paragraphs: [
      'Welcome to HomeShoppie. These Terms & Conditions govern your access to and use of homeshoppie.com, including browsing products, creating an account, placing orders, and using related services.',
      'By using our website or placing an order, you agree to these terms and our Privacy Policy. If you do not agree, please do not use the services. Nothing in these terms limits any consumer rights that cannot lawfully be excluded.',
    ],
  },
  {
    id: 'eligibility',
    title: '2. Eligibility and Customer Accounts',
    paragraphs: [
      'You must be legally capable of entering into a binding transaction under applicable law to place an order. If you create an account, you are responsible for providing accurate information, maintaining the confidentiality of your login credentials, and notifying us if you suspect unauthorised access.',
      'We may restrict or suspend access where reasonably necessary to protect customers, investigate suspected fraud, comply with law, or address misuse of the website.',
    ],
  },
  {
    id: 'products',
    title: '3. Products and Descriptions',
    paragraphs: [
      'HomeShoppie offers products that may include traditional Indian foods, snacks, sweets, ghee, cooking oils, and pooja essentials. We make reasonable efforts to display accurate product descriptions, images, ingredients, weights, prices, and other details.',
      'Actual packaging, colour, appearance, and presentation may vary. Food products may have batch-specific characteristics, and availability may change. Please read the product listing, ingredients, allergen information, storage instructions, and other applicable product details before purchasing.',
      'Product listings do not replace professional medical advice. Do not assume that a food product is suitable for a particular allergy, medical condition, or dietary requirement unless its relevant details have been verified.',
    ],
  },
  {
    id: 'pricing',
    title: '4. Prices, Offers, and Availability',
    paragraphs: [
      'Prices and offers are displayed on the website and may change before an order is accepted. The price applicable to your order is the price presented at checkout, subject to correction of genuine errors and applicable law.',
      'We endeavour to keep product and stock information current but cannot guarantee that every product will always be available. If an ordered product becomes unavailable or a material pricing error is identified, we will take appropriate steps under applicable law, which may include contacting you, cancelling the affected order, or arranging a refund where payment has been collected.',
      'Any applicable delivery charges, taxes, discounts, or other fees will be shown at checkout where relevant. Promotional offers may be subject to additional terms.',
    ],
  },
  {
    id: 'orders',
    title: '5. Orders and Acceptance',
    paragraphs: [
      'Placing an order is a request to purchase the selected products. An order confirmation or payment notification does not necessarily mean that the order has been finally accepted for fulfilment.',
      'We may need to verify order details, stock availability, payment status, delivery information, or suspected fraudulent activity. If we cannot fulfil an order, we will inform you as appropriate and arrange any refund due in accordance with applicable law.',
      'Please check your cart, delivery address, contact details, and order summary carefully before completing checkout.',
    ],
  },
  {
    id: 'payments',
    title: '6. Payments',
    paragraphs: [
      'Payments are processed using the payment methods made available at checkout. Where a third-party payment provider is used, its applicable terms and security processes may also apply.',
      'An order is not considered paid solely because a payment request was initiated. Payment confirmation is subject to verification of the transaction status. If an amount is debited but the order is not confirmed, please contact us with your order and transaction reference so we can investigate.',
      'Cash on Delivery, if offered for an order, is subject to the eligibility and availability displayed at checkout. Do not send card details, passwords, OTPs, or other confidential authentication information to customer support.',
    ],
  },
  {
    id: 'shipping',
    title: '7. Shipping and Delivery',
    paragraphs: [
      'We aim to dispatch and deliver orders within the estimated time shown at checkout or communicated to you. Delivery estimates are not guaranteed unless expressly stated otherwise.',
      'Delivery may be affected by the delivery location, product availability, weather, transport disruptions, public holidays, or other circumstances outside our reasonable control. We will make reasonable efforts to communicate material delays where appropriate.',
      'Please provide a complete and accurate delivery address and reachable contact details. If delivery fails because the supplied information is incorrect or the recipient is unavailable, additional arrangements or charges may apply where lawful and disclosed.',
    ],
  },
  {
    id: 'cancellations',
    title: '8. Cancellations',
    paragraphs: [
      'If you need to cancel an order, contact us as soon as possible at support@homeshoppie.com with your order number. Cancellation depends on the order status and whether processing, preparation, or dispatch has already begun.',
      'Certain food products may be prepared or packed specifically for an order. Any restrictions applicable to such products will be disclosed in accordance with applicable law. We will not use this section to remove cancellation rights that customers are entitled to under law.',
      'If a cancellation is accepted for an order already paid for, any refund due will be processed in accordance with the applicable refund terms and legal requirements.',
    ],
  },
  {
    id: 'returns',
    title: '9. Returns, Replacements, and Refunds',
    paragraphs: [
      'If an item is damaged, defective, incorrect, missing, or materially different from its description, please contact us promptly at support@homeshoppie.com with your order number and relevant photographs or other details where available.',
      'Because some products are perishable or food-related, return and replacement arrangements may differ by product type and applicable law. Please do not consume a product that appears unsafe, tampered with, or materially damaged. Retain the packaging and contact us for guidance.',
      'Approved refunds will be made through the original payment method where practicable, or through another lawful method agreed with the customer. The time for funds to appear in your account may depend on the payment provider or bank.',
      'Our operational return and refund policy, including eligibility, reporting timelines, and processing procedures, should be read alongside this section. Nothing here excludes mandatory remedies under applicable consumer law.',
    ],
  },
  {
    id: 'customer-conduct',
    title: '10. Acceptable Use',
    paragraphs: [
      'You agree not to misuse the website, attempt unauthorised access, interfere with its security or operation, submit fraudulent orders, provide knowingly false information, or use the services in violation of applicable law.',
      'We may take proportionate steps to investigate suspected misuse and protect our systems, customers, and business, subject to applicable law.',
    ],
  },
  {
    id: 'intellectual-property',
    title: '11. Intellectual Property',
    paragraphs: [
      'Unless otherwise stated, website content such as branding, logos, text, graphics, layouts, and original photographs is owned by or licensed to HomeShoppie and is protected by applicable intellectual property laws.',
      'You may use the website for personal, lawful shopping purposes. You may not reproduce, distribute, modify, or commercially exploit protected content without prior permission, except where permitted by law.',
    ],
  },
  {
    id: 'liability',
    title: '12. Liability and Consumer Rights',
    paragraphs: [
      'We aim to provide reliable services and accurate product information. To the extent permitted by law, HomeShoppie is not responsible for indirect losses arising from circumstances beyond our reasonable control, including certain service interruptions or third-party delivery delays.',
      'Nothing in these terms excludes or limits liability where such exclusion or limitation is prohibited by law, or removes your statutory rights concerning product quality, safety, refunds, or consumer remedies.',
    ],
  },
  {
    id: 'privacy',
    title: '13. Privacy',
    paragraphs: [
      'Our Privacy Policy explains how we handle personal information in connection with accounts, orders, payments, deliveries, customer support, and website operations.',
    ],
  },
  {
    id: 'changes',
    title: '14. Changes to These Terms',
    paragraphs: [
      'We may revise these terms when our services, business practices, or legal obligations change. Updated terms will be published on this page with a revised effective date. Changes will apply as permitted by law; an update will not retroactively remove rights that have already accrued to you.',
    ],
  },
  {
    id: 'law',
    title: '15. Governing Law and Disputes',
    paragraphs: [
      'These terms are governed by the applicable laws of India. Disputes will be handled by the competent authorities or courts having jurisdiction under applicable law. Nothing in these terms prevents a consumer from exercising a statutory right to approach a competent consumer commission or other appropriate forum.',
    ],
  },
]

export default function TermsPage() {
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
              Shopping with confidence
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              Terms &amp; Conditions
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-emerald-50 sm:text-lg">
              Clear guidelines for shopping with HomeShoppie, from placing
              your order to delivery, cancellations, returns, and customer
              support.
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
          <nav aria-label="Terms sections" className="mt-4">
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
              Before placing an order
            </h2>
            <p className="mt-2 text-sm leading-7 text-emerald-900/80">
              Please review the product details, ingredients and allergen
              information where provided, total price, delivery information,
              and applicable cancellation and refund terms before checkout.
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
                <div className="mt-4 space-y-4 text-sm leading-7 text-stone-600 sm:text-base sm:leading-8">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.id === 'privacy' && (
                    <p>
                      Read our{' '}
                      <Link
                        href="/privacy"
                        className="font-semibold text-emerald-700 underline underline-offset-4 hover:text-emerald-900"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-10 rounded-xl border border-stone-200 bg-stone-50 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-stone-900">
              Questions about an order?
            </h2>
            <p className="mt-2 text-sm leading-7 text-stone-600">
              Contact our support team and include your order number so we
              can assist you more efficiently.
            </p>
            <a
              href="mailto:support@homeshoppie.com"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
              Contact HomeShoppie
            </a>
          </section>
        </article>
      </div>
    </main>
  )
}
