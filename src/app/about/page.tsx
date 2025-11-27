'use client'

import { CheckIcon, StarIcon } from '@heroicons/react/24/solid'
import { UsersIcon, HeartIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

interface Feature {
  name: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

interface Stat {
  name: string
  value: string
}

interface TeamMember {
  name: string
  role: string
  image: string
  bio: string
}

const features: Feature[] = [
  {
    name: 'Quality Products',
    description: 'We carefully curate our product selection to ensure only the highest quality items make it to our customers.',
    icon: CheckIcon,
  },
  {
    name: 'Customer First',
    description: 'Our customers are at the heart of everything we do. We strive to provide exceptional service and support.',
    icon: HeartIcon,
  },
  {
    name: 'Secure Shopping',
    description: 'Your security and privacy are our top priorities. We use industry-standard encryption to protect your data.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Expert Team',
    description: 'Our team of experts is always ready to help you find exactly what you need for your home.',
    icon: UsersIcon,
  },
]

const stats: Stat[] = [
  { name: 'Happy Customers', value: '50,000+' },
  { name: 'Products Available', value: '10,000+' },
  { name: 'Years of Experience', value: '15+' },
  { name: 'Countries Served', value: '25+' },
]

const team: TeamMember[] = [
  {
    name: 'Sarah Johnson',
    role: 'Founder & CEO',
    image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80',
    bio: 'Sarah founded HomeShoppie with a vision to make quality home products accessible to everyone.',
  },
  {
    name: 'Michael Chen',
    role: 'Head of Product',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
    bio: 'Michael leads our product curation team, ensuring we offer the best selection for your home.',
  },
  {
    name: 'Emily Rodriguez',
    role: 'Customer Success Manager',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
    bio: 'Emily ensures every customer has an exceptional experience with our products and services.',
  },
]

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero section */}
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-16 sm:py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              About HomeShoppie
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              We're passionate about helping you create the perfect home. From furniture to decor, 
              we curate the finest products to transform your living spaces into something extraordinary.
            </p>
          </div>
        </div>
      </div>

      {/* Mission section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">Our Mission</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Making Beautiful Homes Accessible
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            At HomeShoppie, we believe that everyone deserves a beautiful, comfortable home. 
            Our mission is to provide high-quality home products at affordable prices, 
            backed by exceptional customer service.
          </p>
        </div>
      </div>

      {/* Features section */}
      <div className="mx-auto mt-16 max-w-7xl px-6 sm:mt-20 md:mt-24 lg:px-8">
        <dl className="mx-auto grid max-w-2xl grid-cols-1 gap-6 text-base leading-7 text-gray-600 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-4 lg:gap-8">
          {features.map((feature) => (
            <div key={feature.name} className="relative pl-9">
              <dt className="inline font-semibold text-gray-900">
                <feature.icon className="absolute left-1 top-1 h-5 w-5 text-primary-600" aria-hidden="true" />
                {feature.name}
              </dt>{' '}
              <dd className="inline">{feature.description}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Stats section */}
      <div className="bg-gray-50 py-24 sm:py-32 mt-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.name} className="mx-auto flex max-w-xs flex-col gap-y-4">
                <dt className="text-base leading-7 text-gray-600">{stat.name}</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Team section */}
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Meet Our Team</h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              The passionate people behind HomeShoppie, dedicated to bringing you the best home shopping experience.
            </p>
          </div>
          <ul
            role="list"
            className="mx-auto mt-20 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3"
          >
            {team.map((person) => (
              <li key={person.name}>
                <img className="aspect-[3/2] w-full rounded-2xl object-cover" src={person.image} alt={person.name} />
                <h3 className="mt-6 text-lg font-semibold leading-8 tracking-tight text-gray-900">{person.name}</h3>
                <p className="text-base leading-7 text-primary-600">{person.role}</p>
                <p className="mt-4 text-base leading-7 text-gray-600">{person.bio}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Values section */}
      <div className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Our Values</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              These core values guide everything we do at HomeShoppie
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
                    <StarIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  Quality First
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  We never compromise on quality. Every product in our catalog is carefully vetted to meet our high standards.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
                    <HeartIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  Customer Obsessed
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Our customers are at the heart of everything we do. We listen, learn, and continuously improve based on your feedback.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
                    <CheckIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  Sustainability
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  We're committed to sustainable practices and partnering with brands that share our environmental values.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
                    <UsersIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  Community
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  We believe in building strong communities and supporting local artisans and small businesses whenever possible.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
