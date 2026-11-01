/**
 * BROTHERS brand details in one place. Wording is draft copy for the owner to review.
 * Optional values stay null until the owner supplies them; the UI hides whatever is missing.
 */
export const store = {
  name: 'BROTHERS',
  description: "Men's fashion and lifestyle. Pay with bKash or Nagad, or cash on delivery.",
  themeColor: '#141413',
  announcement: 'bKash, Nagad or cash on delivery. Track every order from your account.' as
    string | null,
  hero: {
    eyebrow: "Men's fashion and lifestyle",
    title: 'Dress like you mean it',
    text: 'Shirts, panjabi, denim, footwear and the details that finish the look.',
    /** Stock photo under public/. Replace it with a real campaign photo before launch. */
    image: '/brand/hero.jpg' as string | null,
  },
  contact: {
    phone: '01758516069' as string | null,
    whatsapp: '8801758516069' as string | null,
    email: 'jh.tanjim.4@gmail.com' as string | null,
    address: 'Nimtala, Bandar, Chattogram' as string | null,
    hours: '10 AM to 11 PM' as string | null,
    facebook: null as string | null,
    instagram: null as string | null,
  },
  /** Days a customer has to return or exchange an item. */
  returnDays: 2,
  /** For the delivery page. Checkout charges what Admin > Settings says, so keep the two the same. */
  delivery: { insideDhaka: 60, outsideDhaka: 129, freeFrom: 3000 },
};
