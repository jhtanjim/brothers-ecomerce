/**
 * BROTHERS brand details in one place. Wording is draft copy for the owner to review.
 * Optional values stay null until the owner supplies them; the UI hides whatever is missing.
 */
export const store = {
  name: 'BROTHERS',
  description: "Men's fashion and lifestyle. Order online and pay with bKash or Nagad.",
  themeColor: '#141413',
  announcement: 'Pay with bKash or Nagad. Track every order from your account.' as string | null,
  hero: {
    eyebrow: "Men's fashion and lifestyle",
    title: 'Dress like you mean it',
    text: 'Shirts, panjabi, denim, footwear and the details that finish the look.',
    /** Path under public/, for example /brand/hero.jpg, once a campaign photo exists. */
    image: null as string | null,
  },
  contact: {
    phone: null as string | null,
    email: null as string | null,
    address: null as string | null,
    facebook: null as string | null,
    instagram: null as string | null,
  },
};
