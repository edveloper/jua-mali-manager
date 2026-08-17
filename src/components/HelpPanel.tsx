const GUIDES: { title: string; points: string[] }[] = [
  {
    title: 'Getting started',
    points: [
      'Add a few of the things you sell, with what each one costs you and what you sell it for.',
      'Make one test sale and check Home. If the numbers look right, you are set up.',
      'Got a long stock list already? Shop details has a file import.',
    ],
  },
  {
    title: 'Selling',
    points: [
      'Tap an item on the Sell screen, set the quantity, done. Stock goes down on its own.',
      'Say whether it was paid now or taken on deni, and how it was paid. That is what lets the app tell you what should be in your till at closing.',
      'If you agreed a price with the customer, type it over the usual one. You only see that box if the owner has allowed it for you.',
    ],
  },
  {
    title: 'A sale recorded by mistake',
    points: [
      'Find it in the list on Home and tap Cancel. The stock goes back and the day stops counting it.',
      'Nothing is erased — a cancelled sale stays visible, crossed out, so the correction is on the record.',
      'Staff can cancel their own sales for 12 hours. After that, only the owner can.',
    ],
  },
  {
    title: 'Buying stock',
    points: [
      'Always use Restock on the item, not the Spending tab.',
      'Restock does three things at once: raises your stock, updates what the item costs you on average, and records the money you spent.',
      'Log stock as a plain expense instead and your shelves will say one thing while your books say another.',
    ],
  },
  {
    title: 'Deni',
    points: [
      'The Deni tab shows who owes you and how much, biggest first.',
      'Record part payments as they come. Each one is saved with its date and how it was paid.',
      'A sale on deni counts as income the day it happens. The payment later is not income again — it is the money finally arriving.',
    ],
  },
  {
    title: 'Closing the till',
    points: [
      'Home shows what should be in the drawer: cash sales, plus deni paid in cash, minus cash you paid out.',
      'Money that came by M-Pesa or Airtel is left out on purpose. It went to your phone, not the drawer.',
      'Count what is actually there and type it in. If it does not match, you find out the same day instead of at month end.',
    ],
  },
  {
    title: 'Your staff',
    points: [
      'Add staff under More. Give them a temporary password; they choose their own the first time they sign in.',
      'They can sell and see what is in stock. They cannot see what you paid for anything, your spending, or your profit.',
      'Forgotten their password? Open Staff, tap New password, and give them a temporary one. They choose their own again when they sign in.',
      'You can let someone agree prices with customers, handle deni, or record spending. Each one is a separate switch, off until you turn it on.',
      'For prices, set the lowest and highest you will accept on the item first, then switch it on for that person.',
    ],
  },
  {
    title: 'Knowing where you stand',
    points: [
      'Home is one day at a time. Use the arrows to look back.',
      'Money shows longer stretches, what sold best, how customers paid, and where your money went.',
      'Two profits appear, and the gap between them is your running costs: one is sales minus what the goods cost you, the other takes off rent, wages and the rest.',
    ],
  },
  {
    title: 'When something looks wrong',
    points: [
      'Stuck on the loading screen? Close the app fully and open it again.',
      'Numbers lower than you expected? Check every item has a cost price. Without one the app cannot work out profit and will flatter you.',
      'Still wrong? Use Contact us and say what you were doing when it happened.',
    ],
  },
];

export function HelpPanel() {
  return (
    <div className="space-y-3">
      {GUIDES.map((guide) => (
        <div key={guide.title} className="sheet">
          <p className="font-semibold">{guide.title}</p>
          <div className="mt-2 space-y-2">
            {guide.points.map((point, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {point}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
