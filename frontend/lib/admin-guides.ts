/**
 * The "how this page works" guide for each admin page, in English and Bangla.
 * When a page's behaviour changes, update its guide here. Examples are made up, for illustration.
 */
export type GuideLanguage = 'en' | 'bn';

interface GuideText {
  title: string;
  summary: string;
  steps: string[];
  example: string;
  tip?: string;
}

export type AdminGuide = Record<GuideLanguage, GuideText>;

const GUIDES: { path: RegExp; guide: AdminGuide }[] = [
  {
    path: /^\/admin$/,
    guide: {
      en: {
        title: 'Dashboard',
        summary: 'A quick look at how the shop is doing and what needs attention.',
        steps: [
          'Check the cards at the top: sales, orders waiting, payments waiting and low stock.',
          'Open anything in "pending payments" first, because customers are waiting for those.',
          'Use the low stock list to see which products to reorder.',
        ],
        example:
          'You open the dashboard in the morning and see 2 pending payments. Click one, check it, and approve it.',
        tip: 'Low stock looks at the total of each product. One size can run out while the total still looks fine.',
      },
      bn: {
        title: 'ড্যাশবোর্ড',
        summary: 'দোকানের অবস্থা কেমন এবং কোন কাজগুলো এখন করতে হবে, তা এক নজরে দেখার পেজ।',
        steps: [
          'উপরের কার্ডগুলো দেখুন: বিক্রি, অপেক্ষমাণ অর্ডার, অপেক্ষমাণ পেমেন্ট এবং কম স্টক।',
          'আগে "pending payments" খুলুন, কারণ এগুলোর জন্য কাস্টমার অপেক্ষা করছেন।',
          'কোন পণ্য আবার কিনতে হবে, তা low stock তালিকা থেকে দেখুন।',
        ],
        example:
          'সকালে ড্যাশবোর্ড খুলে দেখলেন ২টি পেমেন্ট অপেক্ষায় আছে। একটিতে ক্লিক করে যাচাই করুন, তারপর approve করুন।',
        tip: 'Low stock প্রতিটি পণ্যের মোট স্টক দেখে। মোট ঠিক দেখালেও কোনো একটি সাইজ শেষ হয়ে যেতে পারে।',
      },
    },
  },
  {
    path: /^\/admin\/pos$/,
    guide: {
      en: {
        title: 'POS: selling in the shop',
        summary:
          'Use this when a customer buys in person. Stock goes down as soon as the sale is complete.',
        steps: [
          'Search by name or SKU, or scan a barcode. Click the right size and colour.',
          'Change quantities if needed, and add a discount or customer details if you want.',
          'Choose Cash, bKash or Nagad.',
          'For cash, enter the amount received, and the screen shows the change. For bKash or Nagad, enter the transaction ID.',
          'Click "Complete sale and print".',
        ],
        example:
          'A customer buys a shirt for 1,550 taka and gives you 2,000. Add the shirt, choose Cash, enter 2000. The screen shows change of 450. Complete the sale, then give the receipt and 450 taka.',
        tip: 'For bKash or Nagad, check the money has arrived on your own phone first. The system cannot check this for you.',
      },
      bn: {
        title: 'POS: দোকানে বিক্রি',
        summary:
          'কাস্টমার সরাসরি দোকান থেকে কিনলে এই পেজ ব্যবহার করুন। বিক্রি শেষ হলেই স্টক কমে যাবে।',
        steps: [
          'নাম বা SKU দিয়ে খুঁজুন, অথবা বারকোড স্ক্যান করুন। সঠিক সাইজ ও রঙে ক্লিক করুন।',
          'দরকার হলে পরিমাণ বদলান। চাইলে ডিসকাউন্ট বা কাস্টমারের তথ্য দিন।',
          'Cash, bKash বা Nagad বেছে নিন।',
          'নগদ টাকা হলে কত টাকা পেলেন তা লিখুন, স্ক্রিনে ফেরত দেওয়ার টাকা দেখাবে। bKash বা Nagad হলে Transaction ID লিখুন।',
          '"Complete sale and print" ক্লিক করুন।',
        ],
        example:
          'একজন কাস্টমার ১,৫৫০ টাকার শার্ট কিনে ২,০০০ টাকা দিলেন। শার্টটি যোগ করুন, Cash বেছে নিন, 2000 লিখুন। স্ক্রিনে ৪৫০ টাকা ফেরত দেখাবে। বিক্রি শেষ করে রসিদ ও ৪৫০ টাকা দিন।',
        tip: 'bKash বা Nagad হলে আগে নিজের ফোনে দেখে নিন টাকা এসেছে কি না। সিস্টেম এটি যাচাই করতে পারে না।',
      },
    },
  },
  {
    path: /^\/admin\/pos\/receipts\/[^/]+$/,
    guide: {
      en: {
        title: 'Sale receipt',
        summary: 'The receipt for one shop sale. You can print it again at any time.',
        steps: [
          '"Print receipt" prints it on your 80mm receipt printer.',
          '"New sale" goes back to the POS for the next customer.',
          '"Return or exchange" is for when the customer brings an item back later.',
          '"Cancel this sale" undoes the whole sale, if it was a mistake. All items go back into stock.',
        ],
        example:
          'You rang up the wrong shirt and the customer has not left. Click "Cancel this sale", enter "Wrong item", give the cash back, and make a new sale.',
        tip: 'A sale that already has a return cannot be cancelled. Cancelling does not give money back by itself: you do that yourself.',
      },
      bn: {
        title: 'বিক্রির রসিদ',
        summary: 'দোকানের একটি বিক্রির রসিদ। যেকোনো সময় আবার প্রিন্ট করতে পারবেন।',
        steps: [
          '"Print receipt" দিলে ৮০ মিমি রসিদ প্রিন্টারে প্রিন্ট হবে।',
          '"New sale" দিলে পরের কাস্টমারের জন্য POS-এ ফিরে যাবেন।',
          'কাস্টমার পরে পণ্য ফেরত আনলে "Return or exchange" ব্যবহার করুন।',
          'ভুল হলে "Cancel this sale" দিয়ে পুরো বিক্রি বাতিল করুন। সব পণ্য স্টকে ফিরে যাবে।',
        ],
        example:
          'ভুল শার্ট বিক্রি করে ফেলেছেন, কাস্টমার এখনো দোকানেই আছেন। "Cancel this sale" ক্লিক করে "Wrong item" লিখুন, টাকা ফেরত দিন, তারপর নতুন করে বিক্রি করুন।',
        tip: 'যে বিক্রিতে আগে থেকেই রিটার্ন আছে, সেটি বাতিল করা যায় না। বাতিল করলে টাকা নিজে থেকে ফেরত যায় না, আপনাকেই ফেরত দিতে হবে।',
      },
    },
  },
  {
    path: /^\/admin\/pos\/returns\/[^/]+$/,
    guide: {
      en: {
        title: 'Return slip',
        summary: 'The record of one return: what came back, and the refund or exchange credit.',
        steps: [
          '"Print slip" prints a copy for the customer.',
          'If it was an exchange and the credit is unused, "Use credit in POS" opens a sale with that credit.',
          '"View order" opens the original sale.',
        ],
        example:
          'A customer returned a shirt for exchange but wants to come back tomorrow. Print the slip. Tomorrow, open this page and click "Use credit in POS".',
      },
      bn: {
        title: 'রিটার্ন স্লিপ',
        summary:
          'একটি রিটার্নের হিসাব: কী ফেরত এলো, এবং কত টাকা ফেরত বা এক্সচেঞ্জ ক্রেডিট দেওয়া হলো।',
        steps: [
          '"Print slip" দিয়ে কাস্টমারের জন্য একটি কপি প্রিন্ট করুন।',
          'এক্সচেঞ্জের ক্রেডিট ব্যবহার না হয়ে থাকলে "Use credit in POS" দিলে সেই ক্রেডিটসহ নতুন বিক্রি খুলবে।',
          '"View order" দিয়ে আগের বিক্রিটি দেখুন।',
        ],
        example:
          'কাস্টমার শার্ট ফেরত দিয়ে এক্সচেঞ্জ চান, কিন্তু কাল আসবেন। স্লিপ প্রিন্ট করে দিন। কাল এই পেজ খুলে "Use credit in POS" ক্লিক করুন।',
      },
    },
  },
  {
    path: /^\/admin\/reports$/,
    guide: {
      en: {
        title: 'Daily report',
        summary:
          'What was sold on one day, the profit, what you take home, and whether the drawer is right.',
        steps: [
          'Pick the date. It opens on today.',
          'In the morning, enter Opening cash under Cash drawer, and click Save.',
          'At closing, count the money, enter Cash counted, and click Save. It tells you if the drawer matches.',
          'Check shop and online sales, split by payment method.',
          'Read Profit, Take-home, returns and best sellers lower down.',
        ],
        example:
          'Opening cash 2,000, cash sales 8,500, 300 spent on transport from the drawer. It should hold 10,200. You count 10,150, so the page says the drawer is short by 50 taka.',
        tip: 'Take-home is profit minus running expenses. Items with no buying price are left out, and the page warns you how many, so the real figure may differ.',
      },
      bn: {
        title: 'দৈনিক রিপোর্ট',
        summary:
          'একদিনে কী বিক্রি হলো, লাভ কত, হাতে কত থাকল, এবং ক্যাশ ড্রয়ারের হিসাব মিলছে কি না।',
        steps: [
          'তারিখ বেছে নিন। শুরুতে আজকের তারিখ থাকে।',
          'সকালে Cash drawer অংশে Opening cash লিখে Save করুন।',
          'দোকান বন্ধের সময় টাকা গুনে Cash counted লিখে Save করুন। হিসাব মিলছে কি না পেজেই দেখাবে।',
          'দোকান ও অনলাইনের বিক্রি পেমেন্টের ধরন অনুযায়ী দেখুন।',
          'নিচে লাভ (Profit), Take-home, রিটার্ন এবং সবচেয়ে বেশি বিক্রি হওয়া পণ্য দেখুন।',
        ],
        example:
          'সকালে ২,০০০ টাকা, নগদ বিক্রি ৮,৫০০ টাকা, ড্রয়ার থেকে যাতায়াতে ৩০০ টাকা খরচ। থাকার কথা ১০,২০০ টাকা। গুনে পেলেন ১০,১৫০ টাকা, তাই পেজে দেখাবে ৫০ টাকা কম আছে।',
        tip: 'Take-home হলো লাভ থেকে চলতি খরচ বাদ দিয়ে যা থাকে। কেনা দাম না দেওয়া পণ্য বাদ থাকে, এবং কয়টি বাদ গেছে তা পেজেই দেখাবে, তাই আসল হিসাব কিছুটা আলাদা হতে পারে।',
      },
    },
  },
  {
    path: /^\/admin\/expenses$/,
    guide: {
      en: {
        title: 'Expenses',
        summary: 'Record what the shop spends each day, such as rent, salary and transport.',
        steps: [
          'Check the date. It opens on today, and you can choose a past day.',
          'Choose the type, and enter the amount and a note if you want.',
          'Keep "Paid with cash from the drawer" ticked if the money came from the drawer. Untick it if you paid from elsewhere, such as your own bKash.',
          'Click "Add expense". Use Remove to fix a mistake.',
        ],
        example:
          'You pay 300 taka from the drawer for a van. Type: Transport and delivery. Amount: 300. Note: Van to Mirpur. Keep the box ticked and add it. Take-home falls by 300, and the drawer should hold 300 less.',
        tip: 'When you pay a supplier, choose "Supplier payment". It reduces the drawer but not take-home, because the buying cost already comes off profit when the goods sell.',
      },
      bn: {
        title: 'খরচ',
        summary: 'দোকানের প্রতিদিনের খরচ লিখে রাখুন, যেমন ভাড়া, বেতন ও যাতায়াত।',
        steps: [
          'তারিখ দেখে নিন। শুরুতে আজকের তারিখ থাকে, চাইলে আগের দিনও বেছে নিতে পারেন।',
          'ধরন বেছে নিন, টাকার পরিমাণ লিখুন, চাইলে নোট দিন।',
          'টাকা ড্রয়ার থেকে গেলে "Paid with cash from the drawer" টিক দেওয়া রাখুন। অন্য জায়গা থেকে দিলে, যেমন নিজের bKash, টিক তুলে দিন।',
          '"Add expense" ক্লিক করুন। ভুল হলে Remove দিয়ে ঠিক করুন।',
        ],
        example:
          'ড্রয়ার থেকে ভ্যান ভাড়া ৩০০ টাকা দিলেন। Type: Transport and delivery। Amount: 300। Note: মিরপুরে ভ্যান। টিক রেখে যোগ করুন। Take-home ৩০০ টাকা কমবে, এবং ড্রয়ারেও ৩০০ টাকা কম থাকার কথা।',
        tip: 'সরবরাহকারীকে টাকা দিলে "Supplier payment" বেছে নিন। এতে ড্রয়ারের টাকা কমবে, কিন্তু Take-home কমবে না, কারণ পণ্য বিক্রির সময়ই কেনা দাম লাভ থেকে বাদ যায়।',
      },
    },
  },
  {
    path: /^\/admin\/orders$/,
    guide: {
      en: {
        title: 'Orders',
        summary: 'Every online order and shop sale in one list. Shop sales carry a "Shop" label.',
        steps: [
          'Use the tabs to filter by status, such as Processing or Delivered.',
          'Search by order number, or filter by payment.',
          'Click an order to see it and move it forward.',
        ],
        example:
          'A customer calls about order ORD-20261030-ABC123. Type the order number in the search box and open it.',
      },
      bn: {
        title: 'অর্ডার',
        summary:
          'সব অনলাইন অর্ডার ও দোকানের বিক্রি এক তালিকায়। দোকানের বিক্রিতে "Shop" লেখা থাকে।',
        steps: [
          'ট্যাব দিয়ে স্ট্যাটাস অনুযায়ী দেখুন, যেমন Processing বা Delivered।',
          'অর্ডার নম্বর দিয়ে খুঁজুন, অথবা পেমেন্ট অনুযায়ী বাছাই করুন।',
          'অর্ডারে ক্লিক করে বিস্তারিত দেখুন এবং পরের ধাপে নিন।',
        ],
        example:
          'একজন কাস্টমার ORD-20261030-ABC123 অর্ডার নিয়ে ফোন করলেন। সার্চ বক্সে অর্ডার নম্বরটি লিখে অর্ডারটি খুলুন।',
      },
    },
  },
  {
    path: /^\/admin\/orders\/[^/]+$/,
    guide: {
      en: {
        title: 'Order details',
        summary: 'Everything about one order: items, customer, payment and history.',
        steps: [
          'An online order moves in this order: payment approved (Processing), then Confirmed, Shipped, Delivered.',
          'Use the buttons in Actions to move it to the next step.',
          'You can cancel before it is shipped. Stock goes back automatically.',
          'Once delivered, use "Return or exchange" if the customer brings something back.',
        ],
        example:
          'You handed a parcel to the courier: click Shipped. When the customer receives it: click Delivered.',
        tip: 'Delivered and Cancelled are final and cannot be changed. If a paid order is cancelled, you must send the refund yourself.',
      },
      bn: {
        title: 'অর্ডারের বিস্তারিত',
        summary: 'একটি অর্ডারের সবকিছু: পণ্য, কাস্টমার, পেমেন্ট ও ইতিহাস।',
        steps: [
          'অনলাইন অর্ডার এই ধাপে এগোয়: পেমেন্ট approve (Processing), তারপর Confirmed, Shipped, Delivered।',
          'Actions-এর বাটন দিয়ে পরের ধাপে নিন।',
          'Shipped হওয়ার আগে বাতিল করা যায়। স্টক নিজে থেকে ফিরে যাবে।',
          'Delivered হওয়ার পর কাস্টমার পণ্য ফেরত আনলে "Return or exchange" ব্যবহার করুন।',
        ],
        example:
          'পার্সেল কুরিয়ারে দিলেন: Shipped ক্লিক করুন। কাস্টমার পেয়ে গেলে: Delivered ক্লিক করুন।',
        tip: 'Delivered ও Cancelled শেষ ধাপ, এগুলো আর বদলানো যায় না। পেমেন্ট হওয়া অর্ডার বাতিল করলে টাকা আপনাকেই ফেরত পাঠাতে হবে।',
      },
    },
  },
  {
    path: /^\/admin\/orders\/[^/]+\/return$/,
    guide: {
      en: {
        title: 'Return or exchange',
        summary:
          'Take items back from a completed sale, then refund the customer or give credit for new items.',
        steps: [
          'Use + to choose how many of each item came back.',
          'Enter the reason.',
          'Leave "Put these items back in stock" ticked. Untick it for damaged items.',
          'Choose Exchange, or a refund by cash, bKash or Nagad.',
          'Save. For an exchange, the POS opens with the credit, ready for the new items.',
        ],
        example:
          'A customer bought an M shirt for 1,550 taka but needs an L. Add 1 M shirt, reason "Wrong size", choose Exchange, and save. In the POS, add the L shirt: the customer pays 0.',
        tip: 'The refund is what was really paid, including the share of any discount. For a refund, you give the money back yourself.',
      },
      bn: {
        title: 'রিটার্ন বা এক্সচেঞ্জ',
        summary:
          'বিক্রি হওয়া পণ্য ফেরত নিন, তারপর টাকা ফেরত দিন অথবা নতুন পণ্যের জন্য ক্রেডিট দিন।',
        steps: [
          '+ দিয়ে কোন পণ্য কয়টি ফেরত এলো তা বেছে নিন।',
          'কারণ লিখুন।',
          '"Put these items back in stock" টিক দেওয়া রাখুন। পণ্য নষ্ট হলে টিক তুলে দিন।',
          'Exchange অথবা cash, bKash বা Nagad-এ refund বেছে নিন।',
          'Save করুন। এক্সচেঞ্জ হলে ক্রেডিটসহ POS খুলবে, সেখানে নতুন পণ্য যোগ করুন।',
        ],
        example:
          'কাস্টমার ১,৫৫০ টাকায় M সাইজের শার্ট কিনেছেন, কিন্তু L দরকার। M শার্ট ১টি বেছে নিন, কারণ লিখুন "Wrong size", Exchange বেছে Save করুন। POS-এ L শার্ট যোগ করুন: কাস্টমারকে আর টাকা দিতে হবে না।',
        tip: 'ফেরতের টাকা হলো কাস্টমার আসলে যা দিয়েছেন, ডিসকাউন্টের ভাগ বাদ দিয়ে। Refund হলে টাকা আপনাকেই ফেরত দিতে হবে।',
      },
    },
  },
  {
    path: /^\/admin\/payments$/,
    guide: {
      en: {
        title: 'Payments',
        summary:
          'Online customers pay by bKash or Nagad and send a transaction ID. You check those here.',
        steps: [
          'The Pending tab shows the payments waiting, oldest first.',
          'Click Review to open one.',
          'Approved and Rejected tabs show past decisions.',
        ],
        example:
          'Three payments are waiting. Start with the top one, because that customer has waited longest.',
        tip: 'Shop sales paid by bKash or Nagad also appear under Approved. You checked those at the counter.',
      },
      bn: {
        title: 'পেমেন্ট',
        summary:
          'অনলাইন কাস্টমার bKash বা Nagad-এ টাকা পাঠিয়ে Transaction ID দেন। এখানে সেগুলো যাচাই করবেন।',
        steps: [
          'Pending ট্যাবে অপেক্ষমাণ পেমেন্ট থাকে, সবচেয়ে পুরনোটি আগে।',
          'Review ক্লিক করে একটি খুলুন।',
          'Approved ও Rejected ট্যাবে আগের সিদ্ধান্তগুলো দেখা যাবে।',
        ],
        example:
          '৩টি পেমেন্ট অপেক্ষায় আছে। উপরেরটি দিয়ে শুরু করুন, কারণ ওই কাস্টমার সবচেয়ে বেশি সময় অপেক্ষা করছেন।',
        tip: 'দোকানে bKash বা Nagad-এ হওয়া বিক্রিও Approved-এ দেখা যাবে। সেগুলো আপনি কাউন্টারেই যাচাই করেছেন।',
      },
    },
  },
  {
    path: /^\/admin\/payments\/[^/]+$/,
    guide: {
      en: {
        title: 'Check a payment',
        summary:
          'Compare what the customer sent with your own bKash or Nagad account before deciding.',
        steps: [
          'Open your bKash or Nagad app on your phone.',
          'Find the transaction ID shown here, and check the amount matches exactly.',
          'If it matches, approve it. The order moves to Processing.',
          'If it does not match, reject it with a clear reason. The customer can send a corrected ID.',
        ],
        example:
          'The customer entered 8N7A2B3C and the amount is 1,960 taka. Your bKash app shows the same ID and 1,960 taka, so approve. If the app shows 1,500, reject with "Amount does not match".',
        tip: 'Never approve without checking your own account. A screenshot alone is not proof, and it can be faked.',
      },
      bn: {
        title: 'পেমেন্ট যাচাই',
        summary:
          'সিদ্ধান্ত নেওয়ার আগে কাস্টমারের দেওয়া তথ্য নিজের bKash বা Nagad অ্যাকাউন্টের সাথে মিলিয়ে দেখুন।',
        steps: [
          'ফোনে নিজের bKash বা Nagad অ্যাপ খুলুন।',
          'এখানে দেখানো Transaction ID খুঁজে বের করুন, এবং টাকার পরিমাণ হুবহু মিলছে কি না দেখুন।',
          'মিললে approve করুন। অর্ডার Processing-এ যাবে।',
          'না মিললে পরিষ্কার কারণ লিখে reject করুন। কাস্টমার সঠিক ID আবার পাঠাতে পারবেন।',
        ],
        example:
          'কাস্টমার 8N7A2B3C দিয়েছেন, পরিমাণ ১,৯৬০ টাকা। bKash অ্যাপে একই ID ও ১,৯৬০ টাকা দেখালে approve করুন। অ্যাপে ১,৫০০ টাকা দেখালে "Amount does not match" লিখে reject করুন।',
        tip: 'নিজের অ্যাকাউন্ট না দেখে কখনো approve করবেন না। শুধু স্ক্রিনশট প্রমাণ নয়, এটি নকল করা যায়।',
      },
    },
  },
  {
    path: /^\/admin\/products$/,
    guide: {
      en: {
        title: 'Products',
        summary: 'All your products. Add, edit, hide or remove them here.',
        steps: [
          'Click "New product" to add one.',
          'Search or filter by status and category to find a product.',
          'Use Edit to change details, photos, sizes and prices.',
          'Set a product to Inactive to hide it from the store without losing it.',
        ],
        example:
          'A shirt is sold out and you will not restock it soon. Set it to Inactive: customers stop seeing it, and its order history stays.',
        tip: 'A product that has been ordered cannot be deleted. Archive it instead.',
      },
      bn: {
        title: 'পণ্য',
        summary: 'আপনার সব পণ্য। এখানে যোগ, পরিবর্তন, লুকানো বা মুছে ফেলা যায়।',
        steps: [
          'নতুন পণ্য যোগ করতে "New product" ক্লিক করুন।',
          'পণ্য খুঁজতে সার্চ করুন, অথবা স্ট্যাটাস ও ক্যাটাগরি দিয়ে বাছাই করুন।',
          'তথ্য, ছবি, সাইজ ও দাম বদলাতে Edit ব্যবহার করুন।',
          'পণ্য না মুছে স্টোর থেকে লুকাতে Inactive করুন।',
        ],
        example:
          'একটি শার্ট শেষ হয়ে গেছে, শিগগিরই আর আনবেন না। Inactive করে দিন: কাস্টমার আর দেখবেন না, কিন্তু অর্ডারের ইতিহাস থেকে যাবে।',
        tip: 'যে পণ্য আগে অর্ডার হয়েছে তা মোছা যায় না। সেটি Archive করুন।',
      },
    },
  },
  {
    path: /^\/admin\/products\/new$/,
    guide: {
      en: {
        title: 'Add a product',
        summary: 'Create the product first. Photos and sizes are added on the next page.',
        steps: [
          'Enter the name, category, SKU and regular price.',
          'Add a sale price if it is discounted, and your buying price for the profit report.',
          'If it has no sizes or colours, enter the stock here.',
          'Click "Create and add images". On the next page, add photos and sizes.',
        ],
        example:
          'Name: Classic Polo. SKU: POLO-002. Price: 1250. Buying price: 800. Then on the next page, add sizes M, L and XL with their stock.',
        tip: 'Keep SKUs short. Long SKUs make barcodes harder to scan.',
      },
      bn: {
        title: 'নতুন পণ্য যোগ',
        summary: 'আগে পণ্য তৈরি করুন। ছবি ও সাইজ পরের পেজে যোগ করবেন।',
        steps: [
          'নাম, ক্যাটাগরি, SKU ও নিয়মিত দাম লিখুন।',
          'ছাড় থাকলে sale price দিন। লাভের হিসাবের জন্য নিজের কেনা দাম দিন।',
          'সাইজ বা রঙ না থাকলে স্টক এখানেই লিখুন।',
          '"Create and add images" ক্লিক করুন। পরের পেজে ছবি ও সাইজ যোগ করুন।',
        ],
        example:
          'নাম: Classic Polo। SKU: POLO-002। দাম: 1250। কেনা দাম: 800। তারপর পরের পেজে M, L, XL সাইজ ও প্রতিটির স্টক যোগ করুন।',
        tip: 'SKU ছোট রাখুন। লম্বা SKU হলে বারকোড স্ক্যান করা কঠিন হয়।',
      },
    },
  },
  {
    path: /^\/admin\/products\/[^/]+\/edit$/,
    guide: {
      en: {
        title: 'Edit a product',
        summary: 'Change photos, sizes and colours, stock, prices and details.',
        steps: [
          'Images: upload up to 10. The primary image shows on product cards.',
          'Sizes and colours: add each option with its own stock. Enter a size, a colour or both.',
          'Once a product has options, its total stock is their sum, so change stock per option.',
          'Tick "New arrivals" or "Best sellers" to show it in those homepage sections.',
          'Click "Save changes" for the form fields. Options and images save on their own.',
        ],
        example:
          'Five more M shirts arrived, with no supplier record needed. Under Sizes and colours, change M from 6 to 11 and click Save on that row. To record the supplier and cost, use Stock purchases instead.',
        tip: 'An option that has been ordered cannot be deleted. Set its stock to 0.',
      },
      bn: {
        title: 'পণ্য পরিবর্তন',
        summary: 'ছবি, সাইজ ও রঙ, স্টক, দাম এবং অন্যান্য তথ্য বদলান।',
        steps: [
          'Images: সর্বোচ্চ ১০টি ছবি দিন। Primary ছবিটি পণ্যের কার্ডে দেখাবে।',
          'Sizes and colours: প্রতিটির জন্য আলাদা স্টক দিন। সাইজ, রঙ বা দুটোই লিখতে পারেন।',
          'সাইজ বা রঙ যোগ করলে মোট স্টক সেগুলোর যোগফল হয়, তাই স্টক প্রতিটিতে আলাদাভাবে বদলান।',
          'হোমপেজে দেখাতে "New arrivals" বা "Best sellers"-এ টিক দিন।',
          'ফর্মের জন্য "Save changes" ক্লিক করুন। সাইজ ও ছবি নিজে থেকেই সেভ হয়।',
        ],
        example:
          'M সাইজের আরও ৫টি শার্ট এসেছে, সরবরাহকারীর হিসাব রাখার দরকার নেই। Sizes and colours-এ M ৬ থেকে ১১ করে ওই সারির Save ক্লিক করুন। সরবরাহকারী ও দামের হিসাব রাখতে হলে Stock purchases ব্যবহার করুন।',
        tip: 'যে সাইজ আগে অর্ডার হয়েছে তা মোছা যায় না। স্টক 0 করে দিন।',
      },
    },
  },
  {
    path: /^\/admin\/purchases$/,
    guide: {
      en: {
        title: 'Stock purchases',
        summary: 'A record of the stock you bought from suppliers.',
        steps: [
          'Click "Add purchase" when new stock arrives.',
          'The list shows each purchase with its supplier, items and total cost, newest first.',
        ],
        example:
          'At month end, look here to see what you bought from each supplier and how much you spent.',
      },
      bn: {
        title: 'স্টক কেনা',
        summary: 'সরবরাহকারীর কাছ থেকে কেনা স্টকের হিসাব।',
        steps: [
          'নতুন স্টক এলে "Add purchase" ক্লিক করুন।',
          'তালিকায় প্রতিটি কেনাকাটার সরবরাহকারী, পণ্য ও মোট খরচ দেখা যাবে, নতুনটি আগে।',
        ],
        example: 'মাস শেষে এখানে দেখুন কোন সরবরাহকারীর কাছ থেকে কী কিনলেন এবং কত খরচ হলো।',
      },
    },
  },
  {
    path: /^\/admin\/purchases\/new$/,
    guide: {
      en: {
        title: 'Add a purchase',
        summary: 'Record new stock. Stock goes up and the buying price updates when you save.',
        steps: [
          'Enter the supplier name.',
          'Search for each item and click its size or colour.',
          'Enter the quantity and the buying price for one unit.',
          'Check the total, then click "Save and add to stock".',
        ],
        example:
          'Mirpur Traders delivered 20 M polos at 800 taka each. Supplier: Mirpur Traders. Find the polo, click M, quantity 20, price 800. The total shows 16,000. Save.',
        tip: 'Check carefully: a purchase cannot be edited or deleted. To fix a mistake, change the stock and buying price on the product page.',
      },
      bn: {
        title: 'নতুন কেনাকাটা যোগ',
        summary: 'নতুন স্টকের হিসাব রাখুন। সেভ করলে স্টক বাড়বে এবং কেনা দাম আপডেট হবে।',
        steps: [
          'সরবরাহকারীর নাম লিখুন।',
          'প্রতিটি পণ্য খুঁজে তার সাইজ বা রঙে ক্লিক করুন।',
          'পরিমাণ এবং একটির কেনা দাম লিখুন।',
          'মোট মিলিয়ে দেখে "Save and add to stock" ক্লিক করুন।',
        ],
        example:
          'Mirpur Traders ৮০০ টাকা দরে M সাইজের ২০টি পোলো দিয়েছে। Supplier-এ Mirpur Traders লিখুন। পোলো খুঁজে M ক্লিক করুন, পরিমাণ 20, দাম 800। মোট ১৬,০০০ দেখাবে। Save করুন।',
        tip: 'ভালো করে দেখে নিন: কেনাকাটা পরে বদলানো বা মোছা যায় না। ভুল হলে পণ্যের পেজ থেকে স্টক ও কেনা দাম ঠিক করুন।',
      },
    },
  },
  {
    path: /^\/admin\/labels$/,
    guide: {
      en: {
        title: 'Barcode labels',
        summary: 'Print stickers for your items, so a scanner can add them in the POS.',
        steps: [
          'Search for a product. Each size and colour has its own row.',
          'Enter how many labels you want, or click "One for each" to match the stock.',
          'Choose the label size and whether to show the price.',
          'Check the preview and click Print.',
        ],
        example:
          'You received 20 M polos. Search "polo", enter 20 on the M row, and print. Stick one on each polo.',
        tip: 'Print one label and test it with your scanner before printing many. In the print window, set the paper to your label size and margins to none.',
      },
      bn: {
        title: 'বারকোড লেবেল',
        summary: 'পণ্যের স্টিকার প্রিন্ট করুন, যাতে স্ক্যানার দিয়ে POS-এ যোগ করা যায়।',
        steps: [
          'পণ্য খুঁজুন। প্রতিটি সাইজ ও রঙের আলাদা সারি থাকবে।',
          'কয়টি লেবেল লাগবে লিখুন, অথবা স্টক অনুযায়ী নিতে "One for each" ক্লিক করুন।',
          'লেবেলের সাইজ বেছে নিন, এবং দাম দেখাবেন কি না ঠিক করুন।',
          'প্রিভিউ দেখে Print ক্লিক করুন।',
        ],
        example:
          'M সাইজের ২০টি পোলো এসেছে। "polo" খুঁজে M সারিতে 20 লিখে প্রিন্ট করুন। প্রতিটি পোলোতে একটি করে লাগান।',
        tip: 'অনেকগুলো প্রিন্টের আগে একটি প্রিন্ট করে স্ক্যানার দিয়ে পরীক্ষা করুন। প্রিন্ট উইন্ডোতে কাগজের মাপ লেবেলের সমান এবং margin none দিন।',
      },
    },
  },
  {
    path: /^\/admin\/categories$/,
    guide: {
      en: {
        title: 'Categories',
        summary:
          'The groups customers browse by, such as Shirts or Shoes, including subcategories.',
        steps: [
          'Add a category, or edit an existing one.',
          'A category marked "Subcategory" sits under a main category.',
          'Deactivate a category to hide it and its products from the store.',
        ],
        example:
          'You will start selling belts. Click to add a new category named Belts, and choose "Wallets & Belts" as its parent.',
        tip: 'A category can only be deleted when it has no products and no subcategories. Hiding a main category also hides its subcategories.',
      },
      bn: {
        title: 'ক্যাটাগরি',
        summary: 'যে ভাগে কাস্টমার পণ্য খোঁজেন, যেমন Shirts বা Shoes, সাবক্যাটাগরিসহ।',
        steps: [
          'নতুন ক্যাটাগরি যোগ করুন, অথবা আগেরটি বদলান।',
          '"Subcategory" লেখা ক্যাটাগরি কোনো মূল ক্যাটাগরির ভেতরে থাকে।',
          'Deactivate করলে ক্যাটাগরি ও তার পণ্য স্টোর থেকে লুকিয়ে যাবে।',
        ],
        example:
          'আপনি বেল্ট বিক্রি শুরু করবেন। Belts নামে নতুন ক্যাটাগরি যোগ করুন, Parent হিসেবে "Wallets & Belts" বেছে নিন।',
        tip: 'পণ্য বা সাবক্যাটাগরি না থাকলে তবেই ক্যাটাগরি মোছা যায়। মূল ক্যাটাগরি লুকালে তার সাবক্যাটাগরিও লুকিয়ে যায়।',
      },
    },
  },
  {
    path: /^\/admin\/categories\/(new|[^/]+\/edit)$/,
    guide: {
      en: {
        title: 'Category details',
        summary: 'Set the name, parent and order of a category.',
        steps: [
          'Enter the name. The slug (the web address) is made for you.',
          'Choose a parent to make it a subcategory, or leave "None" for a main category.',
          'Lower sort order numbers appear first.',
          'Save.',
        ],
        example:
          'To show Shirts first in the menu, give it sort order 1, and T-Shirts sort order 2.',
        tip: 'Changing the slug of an existing category breaks old links to it.',
      },
      bn: {
        title: 'ক্যাটাগরির তথ্য',
        summary: 'ক্যাটাগরির নাম, Parent এবং ক্রম ঠিক করুন।',
        steps: [
          'নাম লিখুন। Slug (ওয়েব ঠিকানা) নিজে থেকেই তৈরি হবে।',
          'সাবক্যাটাগরি করতে Parent বেছে নিন, মূল ক্যাটাগরি হলে "None" রাখুন।',
          'Sort order-এর সংখ্যা যত ছোট, তত আগে দেখাবে।',
          'Save করুন।',
        ],
        example: 'মেনুতে Shirts আগে দেখাতে Sort order 1 দিন, আর T-Shirts-এ 2 দিন।',
        tip: 'পুরনো ক্যাটাগরির Slug বদলালে আগের লিংকগুলো আর কাজ করবে না।',
      },
    },
  },
  {
    path: /^\/admin\/customers$/,
    guide: {
      en: {
        title: 'Customers',
        summary: 'People with an account on your website.',
        steps: [
          'Search by name, email or phone.',
          'See each customer and their status.',
          'Suspend an account to stop that person signing in. Reactivate it to undo.',
        ],
        example:
          'Someone keeps placing fake orders. Find their account and suspend it. Their existing orders stay unchanged.',
        tip: 'Walk-in customers in the POS have no account, so they do not appear here.',
      },
      bn: {
        title: 'কাস্টমার',
        summary: 'আপনার ওয়েবসাইটে যাদের অ্যাকাউন্ট আছে।',
        steps: [
          'নাম, ইমেইল বা ফোন দিয়ে খুঁজুন।',
          'প্রতিটি কাস্টমার ও তার স্ট্যাটাস দেখুন।',
          'Suspend করলে ওই ব্যক্তি আর সাইন ইন করতে পারবেন না। Reactivate করলে আবার পারবেন।',
        ],
        example:
          'কেউ বারবার ভুয়া অর্ডার করছেন। তার অ্যাকাউন্ট খুঁজে Suspend করুন। আগের অর্ডারগুলো একই থাকবে।',
        tip: 'POS-এর দোকানের কাস্টমারদের অ্যাকাউন্ট থাকে না, তাই তারা এখানে দেখাবেন না।',
      },
    },
  },
  {
    path: /^\/admin\/coupons$/,
    guide: {
      en: {
        title: 'Coupons',
        summary: 'Discount codes customers enter at online checkout.',
        steps: [
          'Add a coupon, or edit an existing one.',
          'Deactivate a coupon to stop it working straight away.',
          'Check how many times each one has been used.',
        ],
        example:
          'For Eid, make a coupon EID10 for 10% off. After Eid, deactivate it, or set an end date when you create it.',
        tip: 'Coupons are for online checkout. In the POS, use the Discount box instead.',
      },
      bn: {
        title: 'কুপন',
        summary: 'অনলাইন চেকআউটে কাস্টমার যে ডিসকাউন্ট কোড লেখেন।',
        steps: [
          'নতুন কুপন যোগ করুন, অথবা আগেরটি বদলান।',
          'Deactivate করলে কুপন সাথে সাথে বন্ধ হবে।',
          'প্রতিটি কুপন কতবার ব্যবহার হয়েছে দেখুন।',
        ],
        example:
          'ঈদের জন্য EID10 নামে ১০% ছাড়ের কুপন বানান। ঈদের পর Deactivate করুন, অথবা বানানোর সময়ই শেষ তারিখ দিন।',
        tip: 'কুপন শুধু অনলাইন চেকআউটের জন্য। POS-এ Discount ঘর ব্যবহার করুন।',
      },
    },
  },
  {
    path: /^\/admin\/coupons\/(new|[^/]+\/edit)$/,
    guide: {
      en: {
        title: 'Coupon details',
        summary: 'Set the code, the discount and its limits.',
        steps: [
          'Enter a code and choose the type: a percentage or a fixed amount.',
          'Minimum order amount: the coupon only works at or above this.',
          'Maximum discount: caps a percentage discount.',
          'Usage limits: how many uses in total, and per customer.',
          'Start and end dates are optional.',
        ],
        example:
          'EID10: Percentage 10, minimum order 2000, maximum discount 500, limit per customer 1. An order of 8,000 taka gets 500 off, not 800.',
      },
      bn: {
        title: 'কুপনের তথ্য',
        summary: 'কোড, ডিসকাউন্ট এবং সীমা ঠিক করুন।',
        steps: [
          'কোড লিখে ধরন বেছে নিন: শতকরা অথবা নির্দিষ্ট টাকা।',
          'Minimum order amount: এর সমান বা বেশি হলে তবেই কুপন কাজ করবে।',
          'Maximum discount: শতকরা ছাড়ের সর্বোচ্চ সীমা।',
          'Usage limit: মোট কতবার এবং একজন কাস্টমার কতবার ব্যবহার করতে পারবেন।',
          'শুরু ও শেষের তারিখ না দিলেও চলবে।',
        ],
        example:
          'EID10: Percentage 10, সর্বনিম্ন অর্ডার 2000, সর্বোচ্চ ছাড় 500, প্রতি কাস্টমার 1 বার। ৮,০০০ টাকার অর্ডারে ৮০০ নয়, ৫০০ টাকা ছাড় হবে।',
      },
    },
  },
  {
    path: /^\/admin\/settings$/,
    guide: {
      en: {
        title: 'Settings',
        summary: 'Payment numbers, delivery charges and order rules.',
        steps: [
          'Set your bKash and Nagad numbers, which customers send money to.',
          'Set the delivery charge for your home city and for other cities, and optional free delivery.',
          'Set how many payment tries a customer gets, and how long before an unpaid order is cancelled.',
          'Save, then confirm the changes.',
        ],
        example:
          'Delivery is 60 taka in Dhaka and 120 outside, free from 3,000 taka. Home city: Dhaka. Home city delivery charge: 60. Other cities delivery charge: 120. Free delivery from: 3000.',
        tip: 'Check your bKash and Nagad numbers carefully: customers send real money to them. New charges apply to new orders only.',
      },
      bn: {
        title: 'সেটিংস',
        summary: 'পেমেন্ট নম্বর, ডেলিভারি চার্জ এবং অর্ডারের নিয়ম।',
        steps: [
          'নিজের bKash ও Nagad নম্বর দিন, কাস্টমার এই নম্বরে টাকা পাঠাবেন।',
          'নিজের শহর ও অন্য শহরের ডেলিভারি চার্জ দিন। চাইলে ফ্রি ডেলিভারির সীমাও দিন।',
          'কাস্টমার কতবার পেমেন্ট দিতে পারবেন, এবং কত সময় পর অপরিশোধিত অর্ডার বাতিল হবে তা ঠিক করুন।',
          'Save করে পরিবর্তন নিশ্চিত করুন।',
        ],
        example:
          'ঢাকায় ডেলিভারি ৬০ টাকা, বাইরে ১২০ টাকা, ৩,০০০ টাকা থেকে ফ্রি। Home city: Dhaka। Home city delivery charge: 60। Other cities delivery charge: 120। Free delivery from: 3000।',
        tip: 'bKash ও Nagad নম্বর ভালো করে দেখে নিন: কাস্টমার এই নম্বরেই আসল টাকা পাঠাবেন। নতুন চার্জ শুধু নতুন অর্ডারে প্রযোজ্য হবে।',
      },
    },
  },
];

/** The guide for an admin page, or null when it has none. */
export function guideFor(pathname: string): AdminGuide | null {
  return GUIDES.find(({ path }) => path.test(pathname))?.guide ?? null;
}
