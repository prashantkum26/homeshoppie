import HeroSection from '@/components/HeroSection'
import CategoryGrid from '@/components/CategoryGrid'
import FeaturedProducts from '@/components/FeaturedProducts'
import WhyChooseUs from '@/components/WhyChooseUs'
import Testimonials from '@/components/Testimonials'

export default async function HomePage() {
  let products = [];
  let sliderCategories = [];

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const productParams = new URLSearchParams({
    limit: '20',
    featured: 'true'
  });

  try {
    const [productRes, categoryRes] = await Promise.all([
      fetch(`${baseUrl}/api/products?${productParams}`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/categories`, { cache: 'no-store' })
    ]);

    if (!productRes.ok) throw new Error('Failed to fetch products');
    if (!categoryRes.ok) throw new Error('Failed to fetch categories');

    const [{ data: productData = [] }, { data: categoryData = [] }] = await Promise.all([productRes.json(), categoryRes.json()]);

    products = productData;

    sliderCategories = categoryData.map((c: any, i: number) => ({
      id: i,
      title: c.name,
      subtitle: c.metaDescription,
      description: c.description,
      image: c.image,
      cta: `Shop ${c.name}`,
      link: `/categories/${c.slug}`
    }));

  } catch (error) {
    console.error('HomePage fetch error:', error);
  }

  return (
    <div className="space-y-16">
      <HeroSection heroSlides={sliderCategories} />
      <CategoryGrid />
      <FeaturedProducts featuredProducts={products} />
      <WhyChooseUs />
      <Testimonials />
    </div>
  );
}
