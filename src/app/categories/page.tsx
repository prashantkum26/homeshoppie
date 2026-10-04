"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { getCategoryIcon, getCategoryImagePath } from "@/utils/imageUtil";

interface Category {
  id: string;
  name: string;
  description: string;
  slug: string;
  image?: string;
  productCount?: number;
  _count?: {
    products: number;
  };
}

// ============================================================

// CATEGORY ACCENT

// ============================================================

const getCategoryAccent = (categoryName: string) => {
  switch (categoryName.toLowerCase()) {
    case "ghee":
      return {
        accent: "text-amber-600",
        badge: "bg-amber-50 text-amber-700 border-amber-100",
      };

    case "oils":
      return {
        accent: "text-emerald-600",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
      };

    case "sweets":
      return {
        accent: "text-orange-600",
        badge: "bg-orange-50 text-orange-700 border-orange-100",
      };

    case "namkeen":
      return {
        accent: "text-rose-600",
        badge: "bg-rose-50 text-rose-700 border-rose-100",
      };

    case "pooja items":
      return {
        accent: "text-purple-600",
        badge: "bg-purple-50 text-purple-700 border-purple-100",
      };

    default:
      return {
        accent: "text-slate-700",
        badge: "bg-slate-50 text-slate-700 border-slate-100",
      };
  }
};

// ============================================================

// CATEGORY IMAGE

// ============================================================

function CategoryImage({ category }: { category: Category }) {
  const [hasError, setHasError] = useState(false);

  const imagePath = getCategoryImagePath(category.name);

  if (!imagePath || hasError) {
    return (
      <div
        className="

          absolute

          inset-0

          flex

          items-center

          justify-center

          bg-gradient-to-br

          from-amber-50

          via-orange-50

          to-yellow-100

        "
      >
        <div
          className="

            flex

            h-24

            w-24

            items-center

            justify-center

            rounded-3xl

            border

            border-white/70

            bg-white/70

            text-5xl

            shadow-lg

            backdrop-blur-md

            transition-transform

            duration-500

            group-hover:scale-110

          "
        >
          {getCategoryIcon(category.name)}
        </div>
      </div>
    );
  }

  return (
    <img
      src={imagePath}

      alt={category.name}

      loading="lazy"

      className="

        absolute

        inset-0

        h-full

        w-full

        scale-[1.03]

        object-cover

        object-center

        transition-transform

        duration-700

        ease-out

        group-hover:scale-[1.09]

      "

      onError={() => setHasError(true)}
    />
  );
}

// ============================================================

// LOADING SKELETON

// ============================================================

function CategorySkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[24px] bg-white shadow-sm"
        >
          <div className="h-[280px] animate-pulse bg-slate-200 sm:h-[320px] lg:h-[360px]" />
        </div>
      ))}
    </div>
  );
}

// ============================================================

// CATEGORY CARD

// ============================================================

function CategoryCard({
  category,

  index,
}: {
  category: Category;

  index: number;
}) {
  const accent = getCategoryAccent(category.name);

  const count = category.productCount ?? category._count?.products;

  return (
    <Link
      href={`/categories/${category.slug}`}

      className="

        group

        block

        h-full

        outline-none

      "
    >
      <article
        className="

          relative

          h-full

          overflow-hidden

          rounded-[24px]

          bg-slate-100

          shadow-[0_8px_30px_rgba(15,23,42,0.07)]

          transition-all

          duration-500

          ease-out

          hover:-translate-y-1.5

          hover:shadow-[0_24px_55px_rgba(15,23,42,0.14)]

          focus-visible:ring-4

          focus-visible:ring-primary-500/20

          sm:rounded-[28px]

        "
      >
        {/* ====================================================

            LARGE IMAGE

        ==================================================== */}

        <div
          className="

            relative

            h-[280px]

            overflow-hidden

            sm:h-[320px]

            lg:h-[365px]

            xl:h-[385px]

          "
        >
          <CategoryImage category={category} />

          {/* ==================================================

              MAIN IMAGE GRADIENT

          ================================================== */}

          <div
            aria-hidden="true"

            className="

              pointer-events-none

              absolute

              inset-0

              bg-gradient-to-t

              from-black/75

              via-black/15

              to-transparent

            "
          />

          {/* ==================================================

              TOP LIGHT GRADIENT

          ================================================== */}

          <div
            aria-hidden="true"

            className="

              pointer-events-none

              absolute

              inset-x-0

              top-0

              h-32

              bg-gradient-to-b

              from-black/15

              to-transparent

            "
          />

          {/* ==================================================

              HOVER OVERLAY

          ================================================== */}

          <div
            aria-hidden="true"

            className="

              pointer-events-none

              absolute

              inset-0

              bg-black/0

              transition-colors

              duration-500

              group-hover:bg-black/10

            "
          />

          {/* ==================================================

              INDEX

          ================================================== */}

          <div
            className="

              absolute

              left-4

              top-4

              flex

              h-8

              min-w-8

              items-center

              justify-center

              rounded-full

              border

              border-white/40

              bg-white/85

              px-2

              text-[10px]

              font-bold

              tracking-[0.08em]

              text-slate-800

              shadow-lg

              backdrop-blur-md

              sm:left-5

              sm:top-5

              sm:h-9

              sm:min-w-9

            "
          >
            {String(index + 1).padStart(2, "0")}
          </div>

          {/* ==================================================

              PRODUCT COUNT

          ================================================== */}

          {count !== undefined && (
            <div
              className="

                absolute

                right-4

                top-4

                inline-flex

                items-center

                gap-1.5

                rounded-full

                border

                border-white/40

                bg-white/90

                px-2.5

                py-1.5

                text-[10px]

                font-semibold

                text-slate-800

                shadow-lg

                backdrop-blur-md

                sm:right-5

                sm:top-5

                sm:px-3

                sm:text-xs

              "
            >
              <ShoppingBagIcon
                className="

                  h-3.5

                  w-3.5

                  text-primary-600

                "
              />
              {count} {count === 1 ? "product" : "products"}
            </div>
          )}

          {/* ==================================================

              CATEGORY CONTENT

          ================================================== */}

          <div
            className="

              absolute

              inset-x-0

              bottom-0

              p-5

              sm:p-6

              lg:p-7

            "
          >
            <div
              className="

                flex

                items-end

                justify-between

                gap-4

              "
            >
              {/* Text */}

              <div className="min-w-0">
                <h3
                  className="

                    text-[22px]

                    font-bold

                    tracking-[-0.035em]

                    text-white

                    drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]

                    sm:text-[25px]

                    lg:text-[28px]

                  "
                >
                  {category.name}
                </h3>

                <p
                  className="

                    mt-1.5

                    line-clamp-2

                    max-w-lg

                    text-xs

                    leading-5

                    text-white/85

                    sm:text-sm

                    sm:leading-6

                  "
                >
                  {category.description}
                </p>
              </div>

              {/* Arrow */}

              <span
                className="

                  flex

                  h-10

                  w-10

                  shrink-0

                  translate-y-2

                  items-center

                  justify-center

                  rounded-full

                  border

                  border-white/50

                  bg-white/95

                  text-slate-900

                  opacity-0

                  shadow-xl

                  backdrop-blur-md

                  transition-all

                  duration-300

                  group-hover:translate-y-0

                  group-hover:opacity-100

                  sm:h-11

                  sm:w-11

                "
              >
                <ArrowRightIcon
                  className="

                    h-4

                    w-4

                    transition-transform

                    duration-300

                    group-hover:translate-x-0.5

                  "
                />
              </span>
            </div>
          </div>
        </div>

        {/* ====================================================

            SMALL BOTTOM BAR

            Only one clean CTA — no duplicated metadata.

        ==================================================== */}

        <div
          className="

            flex

            h-11

            items-center

            justify-between

            bg-white

            px-5

            sm:px-6

          "
        >
          <span
            className={`

              text-[10px]

              font-bold

              uppercase

              tracking-[0.16em]

              ${accent.accent}

            `}
          >
            Explore collection
          </span>

          <span
            className="

              text-[11px]

              font-medium

              text-slate-400

              transition-colors

              group-hover:text-slate-700

            "
          >
            Discover →
          </span>
        </div>
      </article>
    </Link>
  );
}

// ============================================================

// MAIN PAGE

// ============================================================

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");

  // Keep SSR and the first client render identical.
  // The loading skeleton appears only after hydration.
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // ==========================================================

  // FETCH CATEGORIES

  // ==========================================================

  useEffect(() => {
    let isMounted = true;

    const controller = new AbortController();

    const fetchCategories = async () => {
      try {
        setLoading(true);

        const response = await fetch(
          "/api/categories",

          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch categories");
        }

        const result = await response.json();

        const categoryData = result.success
          ? result.data
          : result.categories || result || [];

        if (isMounted) {
          setCategories(Array.isArray(categoryData) ? categoryData : []);

          setLoading(false);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        console.error(
          "Error fetching categories:",

          error,
        );

        if (isMounted) {
          setCategories([]);

          setLoading(false);
        }
      }
    };

    fetchCategories();

    return () => {
      isMounted = false;

      controller.abort();
    };
  }, []);

  // ==========================================================

  // FILTER

  // ==========================================================

  const filteredCategories = useMemo(() => {
    const query = searchQuery

      .trim()

      .toLowerCase();

    if (!query) {
      return categories;
    }

    return categories.filter(
      (category) =>
        category.name

          .toLowerCase()

          .includes(query) ||
        category.description

          .toLowerCase()

          .includes(query),
    );
  }, [categories, searchQuery]);

  // ==========================================================

  // CLEAR SEARCH

  // ==========================================================

  const clearSearch = () => {
    setSearchQuery("");
  };

  // ==========================================================
  // HYDRATION GATE
  // ==========================================================

  // The server and first client render return the same shell.
  // This prevents the loading skeleton from causing hydration mismatches.
  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-[#faf9f5]" aria-busy="true">
        <div className="mx-auto min-h-screen max-w-7xl px-4 sm:px-6 lg:px-8" />
      </main>
    );
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#faf9f5]">
        <div
          className="

            mx-auto

            max-w-7xl

            px-4

            py-12

            sm:px-6

            lg:px-8

          "
        >
          {/* Hero skeleton */}

          <div className="mb-12 space-y-4">
            <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />

            <div className="h-11 w-80 animate-pulse rounded-xl bg-slate-200" />

            <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-slate-100" />
          </div>

          {/* Search skeleton */}

          <div className="mb-8 flex justify-end">
            <div
              className="

                h-11

                w-full

                max-w-sm

                animate-pulse

                rounded-xl

                bg-slate-100

              "
            />
          </div>

          {/* Card skeleton */}

          <CategorySkeleton />
        </div>
      </main>
    );
  }

  // ==========================================================

  // PAGE

  // ==========================================================

  return (
    <main
      className="

        min-h-screen

        bg-[#faf9f5]

        text-slate-900

      "
    >
      {/* ======================================================

          HERO

      ====================================================== */}

      <section
        className="

          relative

          overflow-hidden

          border-b

          border-stone-200/70

          bg-white

        "
      >
        {/* Decorative glow */}

        <div
          aria-hidden="true"

          className="

            pointer-events-none

            absolute

            -right-40

            -top-40

            h-[420px]

            w-[420px]

            rounded-full

            bg-amber-100/50

            blur-3xl

          "
        />

        <div
          aria-hidden="true"

          className="

            pointer-events-none

            absolute

            -left-40

            bottom-[-220px]

            h-[420px]

            w-[420px]

            rounded-full

            bg-orange-100/40

            blur-3xl

          "
        />

        <div
          className="

            relative

            mx-auto

            max-w-7xl

            px-4

            py-10

            sm:px-6

            sm:py-12

            lg:px-8

            lg:py-14

          "
        >
          <div
            className="

              grid

              items-end

              gap-8

              lg:grid-cols-[1fr_auto]

            "
          >
            {/* =================================================

                HERO COPY

            ================================================= */}

            <div className="max-w-2xl">
              <div
                className="

                  mb-4

                  inline-flex

                  items-center

                  gap-2

                "
              >
                <span
                  className="

                    h-px

                    w-7

                    bg-primary-600

                  "
                />

                <span
                  className="

                    text-[10px]

                    font-bold

                    uppercase

                    tracking-[0.24em]

                    text-primary-700

                  "
                >
                  Our Collections
                </span>
              </div>

              <h1
                className="

                  max-w-2xl

                  text-3xl

                  font-bold

                  tracking-[-0.045em]

                  text-slate-950

                  sm:text-4xl

                  lg:text-[48px]

                  lg:leading-[1.05]

                "
              >
                Discover something{" "}
                <span className="text-primary-600">worth bringing home.</span>
              </h1>

              <p
                className="

                  mt-4

                  max-w-xl

                  text-sm

                  leading-6

                  text-slate-500

                  sm:text-[15px]

                  sm:leading-7

                "
              >
                Explore thoughtfully selected collections of authentic
                traditional foods, everyday essentials, and products made for
                your home.
              </p>
            </div>

            {/* =================================================

                SEARCH

            ================================================= */}

            <div className="w-full lg:w-[330px]">
              <label
                htmlFor="category-search"

                className="

                  mb-2

                  block

                  text-[10px]

                  font-bold

                  uppercase

                  tracking-[0.16em]

                  text-slate-500

                "
              >
                Find a collection
              </label>

              <div className="group relative">
                <div
                  className="

                    pointer-events-none

                    absolute

                    inset-y-0

                    left-0

                    flex

                    items-center

                    pl-3.5

                  "
                >
                  <MagnifyingGlassIcon
                    className="

                      h-[17px]

                      w-[17px]

                      text-slate-400

                      transition-colors

                      group-focus-within:text-primary-600

                    "
                  />
                </div>

                <input
                  id="category-search"

                  type="text"

                  placeholder="Search categories..."

                  value={searchQuery}

                  onChange={(e) => setSearchQuery(e.target.value)}

                  className="

                    block

                    h-11

                    w-full

                    rounded-xl

                    border

                    border-slate-200

                    bg-slate-50/70

                    pl-10

                    pr-10

                    text-sm

                    text-slate-900

                    outline-none

                    transition-all

                    placeholder:text-slate-400

                    hover:border-slate-300

                    hover:bg-white

                    focus:border-primary-500

                    focus:bg-white

                    focus:ring-4

                    focus:ring-primary-500/10

                  "
                />

                {searchQuery && (
                  <button
                    type="button"

                    onClick={clearSearch}

                    aria-label="Clear search"

                    className="

                      absolute

                      inset-y-0

                      right-0

                      flex

                      items-center

                      pr-3

                      text-slate-400

                      transition-colors

                      hover:text-slate-700

                    "
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================

          CATEGORY CONTENT

      ====================================================== */}

      <section
        className="

          mx-auto

          max-w-7xl

          px-4

          py-10

          sm:px-6

          sm:py-12

          lg:px-8

          lg:py-14

        "
      >
        {/* ====================================================

            SECTION HEADER

        ==================================================== */}

        <div
          className="

            mb-7

            flex

            items-end

            justify-between

            gap-4

          "
        >
          <div>
            <div
              className="

                mb-2

                flex

                items-center

                gap-2

              "
            >
              <span
                className="

                  h-1.5

                  w-1.5

                  rounded-full

                  bg-primary-600

                "
              />

              <span
                className="

                  text-[10px]

                  font-bold

                  uppercase

                  tracking-[0.18em]

                  text-primary-700

                "
              >
                Explore
              </span>
            </div>

            <h2
              className="

                text-xl

                font-bold

                tracking-[-0.03em]

                text-slate-950

                sm:text-2xl

              "
            >
              {searchQuery
                ? `Search results for "${searchQuery}"`
                : "Shop by category"}
            </h2>

            <p
              className="

                mt-1

                text-xs

                text-slate-500

                sm:text-sm

              "
            >
              {filteredCategories.length}{" "}
              {filteredCategories.length === 1 ? "collection" : "collections"}{" "}
              available
            </p>
          </div>

          {searchQuery && (
            <button
              type="button"

              onClick={clearSearch}

              className="

                hidden

                items-center

                gap-1.5

                rounded-lg

                border

                border-slate-200

                bg-white

                px-3

                py-2

                text-xs

                font-semibold

                text-slate-600

                shadow-sm

                transition-all

                hover:border-primary-200

                hover:text-primary-600

                sm:inline-flex

              "
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* ====================================================

            CATEGORY GRID

        ==================================================== */}

        {filteredCategories.length > 0 ? (
          <div
            className="

              grid

              grid-cols-1

              gap-5

              sm:grid-cols-2

              lg:grid-cols-3

              lg:gap-6

            "
          >
            {filteredCategories.map((category, index) => (
              <CategoryCard
                key={category.id}

                category={category}

                index={index}
              />
            ))}
          </div>
        ) : (
          /* ==================================================

             EMPTY SEARCH STATE

          ================================================== */

          <div
            className="

              flex

              min-h-[320px]

              items-center

              justify-center

              rounded-[24px]

              border

              border-dashed

              border-slate-200

              bg-white

              px-6

            "
          >
            <div className="max-w-sm text-center">
              <div
                className="

                  mx-auto

                  mb-5

                  flex

                  h-14

                  w-14

                  items-center

                  justify-center

                  rounded-2xl

                  bg-slate-50

                  text-slate-400

                "
              >
                <FunnelIcon className="h-6 w-6" />
              </div>

              <h3
                className="

                  text-base

                  font-semibold

                  text-slate-950

                "
              >
                No collections found
              </h3>

              <p
                className="

                  mt-2

                  text-xs

                  leading-5

                  text-slate-500

                  sm:text-sm

                "
              >
                {searchQuery
                  ? `We couldn't find any collection matching "${searchQuery}". Try a different search term.`
                  : "There are no collections available at the moment."}
              </p>

              {searchQuery && (
                <button
                  type="button"

                  onClick={clearSearch}

                  className="

                    mt-5

                    inline-flex

                    h-9

                    items-center

                    justify-center

                    rounded-lg

                    bg-slate-950

                    px-4

                    text-xs

                    font-semibold

                    text-white

                    shadow-sm

                    transition-all

                    hover:bg-slate-800

                  "
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ======================================================

          CTA

      ====================================================== */}

      <section
        className="

          border-t

          border-slate-200/70

          bg-white

        "
      >
        <div
          className="

            mx-auto

            max-w-7xl

            px-4

            py-10

            sm:px-6

            lg:px-8

          "
        >
          <div
            className="

              relative

              overflow-hidden

              rounded-[24px]

              bg-slate-950

              px-6

              py-9

              sm:px-10

            "
          >
            {/* Decorative glow */}

            <div
              aria-hidden="true"

              className="

                pointer-events-none

                absolute

                -right-20

                -top-28

                h-64

                w-64

                rounded-full

                bg-primary-600/20

                blur-3xl

              "
            />

            <div
              aria-hidden="true"

              className="

                pointer-events-none

                absolute

                -bottom-24

                -left-16

                h-56

                w-56

                rounded-full

                bg-white/5

                blur-3xl

              "
            />

            <div
              className="

                relative

                flex

                flex-col

                items-start

                justify-between

                gap-6

                sm:flex-row

                sm:items-center

              "
            >
              <div className="max-w-xl">
                <span
                  className="

                    text-[10px]

                    font-bold

                    uppercase

                    tracking-[0.2em]

                    text-primary-300

                  "
                >
                  Need a little help?
                </span>

                <h2
                  className="

                    mt-2

                    text-xl

                    font-bold

                    tracking-tight

                    text-white

                    sm:text-2xl

                  "
                >
                  Can't find what you're looking for?
                </h2>

                <p
                  className="

                    mt-2

                    max-w-lg

                    text-xs

                    leading-5

                    text-slate-400

                    sm:text-sm

                  "
                >
                  Browse the complete collection or get in touch with our team.
                  We're happy to help you find the right products.
                </p>
              </div>

              <div
                className="

                  flex

                  w-full

                  shrink-0

                  flex-col

                  gap-2.5

                  sm:w-auto

                  sm:flex-row

                "
              >
                <Link
                  href="/products"

                  className="

                    inline-flex

                    h-10

                    items-center

                    justify-center

                    gap-2

                    rounded-lg

                    bg-white

                    px-5

                    text-xs

                    font-semibold

                    text-slate-950

                    shadow-sm

                    transition-all

                    hover:bg-slate-100

                    hover:shadow-md

                  "
                >
                  Browse products
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>

                <Link
                  href="/contact"

                  className="

                    inline-flex

                    h-10

                    items-center

                    justify-center

                    rounded-lg

                    border

                    border-white/15

                    bg-white/5

                    px-5

                    text-xs

                    font-semibold

                    text-white

                    transition-all

                    hover:bg-white/10

                  "
                >
                  Contact us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
