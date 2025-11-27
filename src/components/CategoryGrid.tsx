import Link from 'next/link'

interface Category {
  id: number
  name: string
  description: string
  icon: string
  slug: string
  productCount: number
  color: string
  hoverColor: string
}

const categories: Category[] = [
  {
    id: 1,
    name: 'Ghee',
    description: 'Pure homemade ghee varieties',
    icon: '🧈',
    slug: 'ghee',
    productCount: 12,
    color: 'from-yellow-100 to-yellow-200',
    hoverColor: 'hover:from-yellow-200 hover:to-yellow-300'
  },
  {
    id: 2,
    name: 'Mustard Oil',
    description: 'Cold-pressed sarso oil',
    icon: '🫒',
    slug: 'oils',
    productCount: 5,
    color: 'from-green-100 to-green-200',
    hoverColor: 'hover:from-green-200 hover:to-green-300'
  },
  {
    id: 3,
    name: 'Thekua',
    description: 'Traditional Bihar sweet',
    icon: '🍪',
    slug: 'sweets',
    productCount: 8,
    color: 'from-orange-100 to-orange-200',
    hoverColor: 'hover:from-orange-200 hover:to-orange-300'
  },
  {
    id: 4,
    name: 'Namkeen',
    description: 'Crispy snacks & savories',
    icon: '🥨',
    slug: 'namkeen',
    productCount: 15,
    color: 'from-red-100 to-red-200',
    hoverColor: 'hover:from-red-200 hover:to-red-300'
  },
  {
    id: 5,
    name: 'Gujiya',
    description: 'Festival special sweets',
    icon: '🥟',
    slug: 'sweets',
    productCount: 6,
    color: 'from-purple-100 to-purple-200',
    hoverColor: 'hover:from-purple-200 hover:to-purple-300'
  },
  {
    id: 6,
    name: 'Pooja Items',
    description: 'Sacred ritual essentials',
    icon: '🪔',
    slug: 'pooja-items',
    productCount: 20,
    color: 'from-pink-100 to-pink-200',
    hoverColor: 'hover:from-pink-200 hover:to-pink-300'
  }
]

export default function CategoryGrid() {
  return (
    <section className="py-16 bg-white">
      <div className="container-custom">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Shop by Category
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover our authentic homemade products crafted with traditional methods 
            and finest ingredients
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category: Category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group"
            >
              <div className={`
                p-8 rounded-xl bg-gradient-to-br ${category.color} ${category.hoverColor}
                transition-all duration-300 transform group-hover:scale-105 group-hover:shadow-lg
                border border-white/50
              `}>
                <div className="flex flex-col items-center text-center">
                  <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    {category.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {category.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {category.description}
                  </p>
                  <span className="inline-block px-3 py-1 bg-white/70 rounded-full text-sm font-medium text-gray-700">
                    {category.productCount} products
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/categories"
            className="btn-primary px-8 py-3 text-lg"
          >
            View All Categories
          </Link>
        </div>
      </div>
    </section>
  )
}
