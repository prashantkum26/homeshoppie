// 'use client'

// import { useEffect } from 'react'
// import { useSession } from 'next-auth/react'
// import useCartStore from '@/store/cartStore'

// export default function CartSyncProvider() {
//   const { status } = useSession()
//   const mergeCartOnLogin = useCartStore(state => state.mergeCartOnLogin)
//   const setLoggedIn = useCartStore(state => state.setLoggedIn)

//   useEffect(() => {
//     if (status === 'authenticated') {
//       // User is logged in: merge guest cart items into DB once
//       mergeCartOnLogin()
//     } else if (status === 'unauthenticated') {
//       // User is a guest or logged out: ONLY disable server sync. 
//       // DO NOT clear local storage items here, so refreshes keep guest carts safe!
//       setLoggedIn(false)
//     }
//   }, [status, mergeCartOnLogin, setLoggedIn])

//   return null
// }