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
    case 'Ghee': return '/images/category/ghee.png'
    case 'Oils': return '/images/category/oil.png'
    case 'Sweets': return '/images/category/sweets.png'
    case 'Namkeen': return '/images/category/namkeen.png'
    case 'Pooja Items': return '/images/category/pooja-items.png'
    default: return '/images/category/default.png'
  }
}