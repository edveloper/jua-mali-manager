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
      'Say how it was paid, or whether it went on deni. That is the only reason the app can tell you what should be in the drawer at closing.',
      'Haggled? Type the price you agreed over the usual one. That box only shows up if the owner has allowed it for you.',
    ],
  },
  {
    title: 'A sale recorded by mistake',
    points: [
      'Find it in the list on Home and tap Cancel. The stock goes back and the day stops counting it.',
      'Nothing is erased. A cancelled sale stays visible, crossed out, so the correction is on the record.',
      'Staff can cancel their own sales for 12 hours. After that, only the owner can.',
    ],
  },
  {
    title: 'Buying stock',
    points: [
      'Always use Restock on the item, not the Spending tab.',
      'Restock does three things at once: puts the goods on the shelf, works out what the item now costs you on average, and records the money that left.',
      'Put it through Spending instead and your shelves will say one thing while your books say another.',
    ],
  },
  {
    title: 'Stock added by mistake',
    points: [
      'Open Spending and find the delivery. The arrow beside it cancels the whole thing.',
      'The goods come back off the shelf, the cost price goes back to what it was, and the spending disappears with it.',
      'It will refuse if you have already sold the stock or paid the supplier. At that point a stock count is the honest fix.',
    ],
  },
  {
    title: 'Deni',
    points: [
      'Deni shows who owes you and how much, biggest debt first.',
      'Record part payments as they come. Each one is saved with its date and how it was paid.',
      'A sale on deni counts as income the day it happens. The payment later is not income again, it is the money finally arriving.',
    ],
  },
  {
    title: 'Closing the till',
    points: [
      'Home shows what should be in the drawer: cash sales, plus deni paid in cash, minus cash you paid out.',
      'M-Pesa and Airtel are left out on purpose. That money went to your phone, not into the drawer.',
      'Count what is really there and type it in. If it does not match, you know the same evening rather than at month end.',
    ],
  },
  {
    title: 'Your staff',
    points: [
      'Add staff under More. Give them a temporary password; they choose their own the first time they sign in.',
      'They can sell and see what is in stock. What you paid for goods, what you spend and what you make stay yours.',
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
      'You get two profit figures. The first is sales minus what the goods cost you. The second also takes off rent, wages and the rest. The gap between them is what it costs to keep the doors open.',
    ],
  },
  {
    title: 'When something looks wrong',
    points: [
      'Stuck on the loading screen? Close the app fully and open it again.',
      'Profit looking odd? Check every item has a cost price. Without one there is nothing to work it out from, and the figure will flatter you.',
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
