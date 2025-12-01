export const getCategoryIcon = (categoryName: string) => {
  switch (categoryName) {
    case 'Ghee': return '🧈'
    case 'Oils': return '🫒'
    case 'Sweets': return '🍪'
    case 'Namkeen': return '🥨'
    case 'Pooja Items': return '🪔'
    default: return '📦'
  }
}

export const getCategoryImagePath = (categoryName: string) => {
  switch (categoryName) {
    case 'Ghee': return '/images/category/ghee.svg'
    case 'Oils': return '/images/category/oils.svg'
    case 'Sweets': return '/images/category/sweets.svg'
    case 'Namkeen': return '/images/category/namkeen.svg'
    case 'Pooja Items': return '/images/category/pooja-items.svg'
    default: return null
  }
}