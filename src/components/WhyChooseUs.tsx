interface Feature {
  id: number
  title: string
  description: string
  icon: string
  color: string
}

const features: Feature[] = [
  {
    id: 1,
    title: 'Traditional Methods',
    description: 'Made using age-old traditional recipes and methods passed down through generations',
    icon: '👵',
    color: 'from-yellow-400 to-orange-400'
  },
  {
    id: 2,
    title: 'Pure Ingredients',
    description: 'Only the finest and purest ingredients sourced directly from trusted farmers',
    icon: '🌾',
    color: 'from-green-400 to-emerald-400'
  },
  {
    id: 3,
    title: 'Handmade Quality',
    description: 'Each product is carefully handcrafted with attention to detail and quality',
    icon: '✋',
    color: 'from-blue-400 to-cyan-400'
  },
  {
    id: 4,
    title: 'Fresh Delivery',
    description: 'Products are made fresh and delivered directly to your doorstep',
    icon: '🚚',
    color: 'from-purple-400 to-pink-400'
  },
  {
    id: 5,
    title: 'Authentic Taste',
    description: 'Experience the authentic taste of traditional Indian homemade products',
    icon: '👌',
    color: 'from-red-400 to-rose-400'
  },
  {
    id: 6,
    title: 'Family Trust',
    description: 'Trusted by families across India for genuine homemade quality products',
    icon: '👨‍👩‍👧‍👦',
    color: 'from-indigo-400 to-purple-400'
  }
]

export default function WhyChooseUs() {
  return (
    <section className="py-16 bg-white">
      <div className="container-custom">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Choose HomeShoppie?
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            We are committed to bringing you the finest homemade products that combine 
            traditional methods with modern convenience
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature: Feature) => (
            <div
              key={feature.id}
              className="text-center group hover:transform hover:scale-105 transition-all duration-300"
            >
              <div className="relative mb-6">
                <div className={`
                  w-20 h-20 mx-auto rounded-full bg-gradient-to-r ${feature.color}
                  flex items-center justify-center text-3xl shadow-lg
                  group-hover:shadow-xl transition-shadow duration-300
                `}>
                  {feature.icon}
                </div>
                <div className={`
                  absolute inset-0 w-20 h-20 mx-auto rounded-full bg-gradient-to-r ${feature.color}
                  opacity-20 scale-150 group-hover:scale-175 transition-transform duration-500
                `} />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors">
                {feature.title}
              </h3>
              
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-16 py-12 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-2xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600 mb-2">
                1000+
              </div>
              <div className="text-gray-600 font-medium">
                Happy Customers
              </div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600 mb-2">
                50+
              </div>
              <div className="text-gray-600 font-medium">
                Premium Products
              </div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600 mb-2">
                5★
              </div>
              <div className="text-gray-600 font-medium">
                Average Rating
              </div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary-600 mb-2">
                24/7
              </div>
              <div className="text-gray-600 font-medium">
                Customer Support
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
