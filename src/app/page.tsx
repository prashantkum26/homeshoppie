// import HeroSection from '@/components/HeroSection'
// import CategoryGrid from '@/components/CategoryGrid'
// import FeaturedProducts from '@/components/FeaturedProducts'
// import WhyChooseUs from '@/components/WhyChooseUs'
// import Testimonials from '@/components/Testimonials'

// export default function HomePage() {
//   return (
//     <div className="space-y-16">
//       <HeroSection />
//       <CategoryGrid />
//       <FeaturedProducts />
//       <WhyChooseUs />
//       <Testimonials />
//     </div>
//   )
// }


import HeroSection from '@/components/HeroSection'
import CategoryGrid from '@/components/CategoryGrid'
import FeaturedProducts from '@/components/FeaturedProducts'
import WhyChooseUs from '@/components/WhyChooseUs'
import Testimonials from '@/components/Testimonials'

export default async function HomePage() {
  let products = [];
  try {
    const params = new URLSearchParams({
      limit: '20',
      featured: 'true'
    })

    // Use proper URL construction for server-side fetching
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                   'http://localhost:3000')
    
    const response = await fetch(`${baseUrl}/api/products?${params}`, {
      cache: 'no-store'
    })
    if (!response.ok) {
      throw new Error('Failed to fetch products')
    }

    const json = await response.json();
    if (json?.data) {
      products = json.data || [];
    }
    console.log(products)
  } catch (error) {
    console.log(error);
  }

  return (
    <div className="space-y-16">
      <HeroSection />
      <CategoryGrid />
      <FeaturedProducts featuredProducts={products} />
      <WhyChooseUs />
      <Testimonials />
    </div>
  )
}
