// Using built-in fetch (available in Node.js 18+)

// Categories data
const categories = [
  {
    name: 'Ghee',
    description: 'Pure homemade ghee varieties made using traditional methods',
    slug: 'ghee',
    image: '/images/category-ghee.jpg'
  },
  {
    name: 'Oils',
    description: 'Cold-pressed oils extracted using traditional sarso mill',
    slug: 'oils',
    image: '/images/category-oils.jpg'
  },
  {
    name: 'Sweets',
    description: 'Traditional sweets and desserts made with authentic recipes',
    slug: 'sweets',
    image: '/images/category-sweets.jpg'
  },
  {
    name: 'Namkeen',
    description: 'Crispy and delicious savory snacks',
    slug: 'namkeen',
    image: '/images/category-namkeen.jpg'
  },
  {
    name: 'Pooja Items',
    description: 'Sacred items for worship and religious ceremonies',
    slug: 'pooja-items',
    image: '/images/category-pooja.jpg'
  }
]

// Products data
const products = [
  // Ghee Products
  {
    name: 'Pure Cow Ghee',
    description: 'Made from fresh cow milk using traditional bilona method. Rich in vitamins A, D, E, and K. Perfect for cooking, frying, and Ayurvedic remedies.',
    price: 599,
    compareAt: 699,
    images: ['/images/cow-ghee-1.jpg', '/images/cow-ghee-2.jpg'],
    categorySlug: 'ghee',
    stock: 50,
    slug: 'pure-cow-ghee',
    weight: 500,
    unit: 'g',
    tags: ['Organic', 'Traditional', 'A2 Milk', 'Bilona Method']
  },
  {
    name: 'Buffalo Ghee (Bilona)',
    description: 'Premium buffalo ghee made using ancient bilona method. Higher nutritional value with rich taste and aroma. Ideal for traditional cooking.',
    price: 799,
    compareAt: 899,
    images: ['/images/buffalo-ghee-1.jpg', '/images/buffalo-ghee-2.jpg'],
    categorySlug: 'ghee',
    stock: 30,
    slug: 'buffalo-ghee-bilona',
    weight: 500,
    unit: 'g',
    tags: ['Premium', 'Bilona Method', 'High Fat Content', 'Traditional']
  },
  {
    name: 'Mixed Ghee (Cow + Buffalo)',
    description: 'Perfect blend of cow and buffalo ghee combining the best of both. Balanced taste and nutrition for everyday cooking needs.',
    price: 699,
    compareAt: 799,
    images: ['/images/mixed-ghee-1.jpg', '/images/mixed-ghee-2.jpg'],
    categorySlug: 'ghee',
    stock: 40,
    slug: 'mixed-ghee-cow-buffalo',
    weight: 500,
    unit: 'g',
    tags: ['Blended', 'Nutritious', 'Daily Use', 'Economic']
  },
  // Oil Products
  {
    name: 'Cold-Pressed Mustard Oil',
    description: 'Pure mustard oil extracted using traditional wooden churner. Rich in omega-3 fatty acids and antioxidants. Perfect for cooking and massage.',
    price: 299,
    compareAt: 349,
    images: ['/images/mustard-oil-1.jpg', '/images/mustard-oil-2.jpg'],
    categorySlug: 'oils',
    stock: 60,
    slug: 'cold-pressed-mustard-oil',
    weight: 1,
    unit: 'L',
    tags: ['Cold-Pressed', 'Pure', 'Omega-3', 'Traditional']
  },
  {
    name: 'Organic Sesame Oil',
    description: 'Traditional til oil extracted from premium sesame seeds. Rich in vitamin E and minerals. Great for cooking and skin care.',
    price: 399,
    compareAt: 449,
    images: ['/images/sesame-oil-1.jpg', '/images/sesame-oil-2.jpg'],
    categorySlug: 'oils',
    stock: 35,
    slug: 'organic-sesame-oil',
    weight: 500,
    unit: 'ml',
    tags: ['Organic', 'Vitamin E', 'Skin Care', 'Premium']
  },
  // Sweet Products
  {
    name: 'Traditional Thekua',
    description: 'Authentic Bihar special thekua made with wheat flour, jaggery, and ghee. Perfect for festivals like Chhath Puja and daily snacking.',
    price: 199,
    compareAt: null,
    images: ['/images/thekua-1.jpg', '/images/thekua-2.jpg'],
    categorySlug: 'sweets',
    stock: 80,
    slug: 'traditional-thekua',
    weight: 250,
    unit: 'g',
    tags: ['Handmade', 'Festival Special', 'Chhath Puja', 'Traditional']
  },
  {
    name: 'Gujiya (Karanji)',
    description: 'Delicious sweet dumplings filled with khoya, dry fruits, and coconut. Perfect for Holi and other celebrations.',
    price: 299,
    compareAt: 349,
    images: ['/images/gujiya-1.jpg', '/images/gujiya-2.jpg'],
    categorySlug: 'sweets',
    stock: 45,
    slug: 'gujiya-karanji',
    weight: 250,
    unit: 'g',
    tags: ['Festival Special', 'Holi Special', 'Khoya Filled', 'Handmade']
  },
  {
    name: 'Kheer Mohan',
    description: 'Soft and spongy Bengali sweet soaked in flavored milk. Made with fresh chenna and aromatic cardamom.',
    price: 249,
    compareAt: 299,
    images: ['/images/kheer-mohan-1.jpg', '/images/kheer-mohan-2.jpg'],
    categorySlug: 'sweets',
    stock: 25,
    slug: 'kheer-mohan',
    weight: 200,
    unit: 'g',
    tags: ['Bengali Sweet', 'Milk Based', 'Soft Texture', 'Cardamom']
  },
  // Namkeen Products
  {
    name: 'Mixed Namkeen',
    description: 'Crispy mixture of sev, peanuts, curry leaves, and spices. Perfect tea-time snack with balanced spicy and tangy flavors.',
    price: 149,
    compareAt: 179,
    images: ['/images/mixed-namkeen-1.jpg', '/images/mixed-namkeen-2.jpg'],
    categorySlug: 'namkeen',
    stock: 100,
    slug: 'mixed-namkeen',
    weight: 200,
    unit: 'g',
    tags: ['Crispy', 'Spicy', 'Tea Time', 'Mix Variety']
  },
  {
    name: 'Aloo Bhujia',
    description: 'Crispy potato sticks seasoned with traditional spices. Light, crunchy, and perfectly spiced for snacking anytime.',
    price: 129,
    compareAt: 149,
    images: ['/images/aloo-bhujia-1.jpg', '/images/aloo-bhujia-2.jpg'],
    categorySlug: 'namkeen',
    stock: 75,
    slug: 'aloo-bhujia',
    weight: 150,
    unit: 'g',
    tags: ['Potato Based', 'Crispy', 'Light Spice', 'Crunchy']
  },
  {
    name: 'Masala Makhana',
    description: 'Roasted fox nuts seasoned with aromatic spices. Healthy, low-calorie snack perfect for weight watchers.',
    price: 179,
    compareAt: 199,
    images: ['/images/masala-makhana-1.jpg', '/images/masala-makhana-2.jpg'],
    categorySlug: 'namkeen',
    stock: 60,
    slug: 'masala-makhana',
    weight: 100,
    unit: 'g',
    tags: ['Healthy', 'Low Calorie', 'Protein Rich', 'Roasted']
  },
  // Pooja Items
  {
    name: 'Brass Diya Set',
    description: 'Handcrafted brass diyas perfect for daily worship and festivals. Set of 5 traditional oil lamps with beautiful finish.',
    price: 399,
    compareAt: null,
    images: ['/images/brass-diya-1.jpg', '/images/brass-diya-2.jpg'],
    categorySlug: 'pooja-items',
    stock: 40,
    slug: 'brass-diya-set',
    weight: null,
    unit: 'Set of 5',
    tags: ['Handcrafted', 'Brass', 'Festival Use', 'Traditional']
  },
  {
    name: 'Camphor Tablets',
    description: 'Pure camphor tablets for aarti and worship. Natural and chemical-free with long-lasting fragrance.',
    price: 89,
    compareAt: 99,
    images: ['/images/camphor-1.jpg', '/images/camphor-2.jpg'],
    categorySlug: 'pooja-items',
    stock: 120,
    slug: 'pure-camphor-tablets',
    weight: 50,
    unit: 'g',
    tags: ['Pure', 'Natural', 'Fragrant', 'Worship Essential']
  },
  {
    name: 'Kumkum Sindoor Pack',
    description: 'Traditional kumkum and sindoor made from natural ingredients. Safe for daily use with vibrant red color.',
    price: 149,
    compareAt: 169,
    images: ['/images/kumkum-sindoor-1.jpg', '/images/kumkum-sindoor-2.jpg'],
    categorySlug: 'pooja-items',
    stock: 85,
    slug: 'kumkum-sindoor-pack',
    weight: 25,
    unit: 'g',
    tags: ['Natural', 'Safe', 'Traditional', 'Daily Use']
  }
]

const BASE_URL = 'http://localhost:3000'

async function seedCategories() {
  console.log('📂 Creating categories via API...')
  const createdCategories = {}
  
  for (const category of categories) {
    try {
      const response = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(category)
      })
      
      if (response.ok) {
        const created = await response.json()
        createdCategories[category.slug] = created
        console.log(`✅ Created category: ${category.name}`)
      } else {
        const error = await response.text()
        console.log(`⚠️ Category ${category.name} failed:`, error)
      }
    } catch (error) {
      console.log(`❌ Category ${category.name} error:`, error.message)
    }
  }
  
  return createdCategories
}

async function seedProducts(createdCategories) {
  console.log('🛍️ Creating products via API...')
  let productsCreated = 0
  
  for (const product of products) {
    try {
      const category = createdCategories[product.categorySlug]
      if (!category) {
        console.log(`⚠️ Category not found for product: ${product.name}`)
        continue
      }
      
      const productData = {
        ...product,
        categoryId: category.id
      }
      delete productData.categorySlug
      
      const response = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData)
      })
      
      if (response.ok) {
        const created = await response.json()
        console.log(`✅ Created product: ${product.name}`)
        productsCreated++
      } else {
        const error = await response.text()
        console.log(`⚠️ Product ${product.name} failed:`, error)
      }
    } catch (error) {
      console.log(`❌ Product ${product.name} error:`, error.message)
    }
  }
  
  return productsCreated
}

async function main() {
  console.log('🌱 Starting database seeding via API endpoints...')
  console.log('⏳ Make sure your Next.js development server is running on port 3000')
  
  try {
    // Test API availability
    const healthCheck = await fetch(`${BASE_URL}/api/categories`)
    if (!healthCheck.ok) {
      throw new Error('API not available. Make sure Next.js dev server is running.')
    }
    
    // Step 1: Seed categories first
    const createdCategories = await seedCategories()
    
    // Wait a moment for consistency
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 2: Seed products
    const productsCreated = await seedProducts(createdCategories)
    
    console.log('✅ Database seeding completed successfully!')
    console.log(`📊 Summary:`)
    console.log(`   Categories created: ${Object.keys(createdCategories).length}`)
    console.log(`   Products created: ${productsCreated}`)
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message)
    process.exit(1)
  }
}

// Run the seeding
main()
