import { Link } from 'react-router-dom';
import {
  Wallet, PackageSearch, HandCoins, Check, Share, Plus,
  Store, MessageCircle, ArrowRight,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';

/**
 * Where somebody lands who has not signed up yet.
 *
 * Written for a cheap Android on mobile data, which rules out the usual shape of
 * this page: no hero video, no stock photography, no web font fetched before a
 * word can be read. Everything here is text, colour and the icons the app
 * already ships, and the whole page is a few kilobytes.
 *
 * The hero shows a daybook rather than a screenshot of one. It is the same
 * markup the app uses, so it cannot go stale, it costs nothing to load, and it
 * shows the one number a shopkeeper actually opens this for before they have
 * read a single line of copy.
 *
 * Voice is warm and imperative, benefit first. Swahili is kept to the words a
 * shopkeeper uses in English anyway -- deni, duka -- and nowhere else. Half
 * translated headings read as decoration; when the whole thing can be switched
 * to Kiswahili properly, that is worth doing as one piece.
 */

/*
 * Real screens rather than a description of them.
 *
 * Cropped of the status bar, the browser chrome and the system nav, because
 * leaving those in is the difference between a product shot and a photograph of
 * somebody's phone. Nothing here carries a customer name, a number or an email:
 * the screens that did are the ones that were left out.
 */
const SHOTS = [
  { src: '/screens/daybook.webp', caption: 'Your day, added up for you' },
  { src: '/screens/catalogue.webp', caption: 'Type a little, pick the rest' },
  { src: '/screens/stock.webp', caption: 'What the shelf is really worth' },
  { src: '/screens/report.webp', caption: 'A month an accountant can read' },
  { src: '/screens/privacy.webp', caption: 'Your records stay yours' },
];

const WORRIES = [
  {
    question: 'Who owes me, and how much?',
    answer: 'Every deni in one place, with the name, the amount and how long it has been sitting there.',
    icon: HandCoins,
  },
  {
    question: 'What did I really take home?',
    answer: 'Not what passed through the till. What is left once the goods and the running costs are paid for.',
    icon: Wallet,
  },
  {
    question: 'Is stock walking off?',
    answer: 'Count the shelf against what the app expects. It tells you what is missing and what it was worth.',
    icon: PackageSearch,
  },
  {
    question: 'What do I owe my supplier?',
    answer: 'Stock on credit is a debt, not spending. The money only counts on the day you actually pay it.',
    icon: Store,
  },
];

const STEPS = [
  { title: 'Put in what you sell', body: 'Type a few letters and pick from a list of what shops here already sell, in English or Kiswahili.' },
  { title: 'Record as you go', body: 'Cash, M-Pesa, part now and part on deni. Whatever really happened at the counter.' },
  { title: 'Look at your day', body: 'Takings, spending, and what is actually left. Then the week and the month.' },
];

const FAQ = [
  { q: 'Does it cost anything?', a: 'No. It is free while we are getting started, and recording your sales will always be free.' },
  { q: 'Do I need to download it?', a: 'No. It opens in your browser, and you can put it on your home screen so it opens like any app.' },
  { q: 'Can my staff use it?', a: 'Yes, and you decide what each person may do. Staff never see what goods cost you or what the shop made.' },
  { q: 'More than one shop?', a: 'Add as many as you run and switch between them, whether branches or separate businesses.' },
  { q: 'Who can see my records?', a: 'You and the staff you add. Nobody else. We never sell your records and never pass on anything about your customers.' },
];

const PLANS = [
  { name: 'Basic', price: 'Free', now: true, lines: ['One shop, just you', 'Sales, stock, deni, spending', 'The last 30 days'] },
  { name: 'Duka', price: 'KSh 300', per: 'a month', now: false, lines: ['Up to 3 staff', 'All your history', 'Invoices and spreadsheets'] },
  { name: 'Biashara', price: 'KSh 800', per: 'a month', now: false, lines: ['Several shops and branches', 'Staff without limit', 'M-Pesa matching, cheques'] },
];

export default function Landing() {
  return (
    /*
     * One column, the same width as the app.
     *
     * The colour bands used to run the full width of the window while the words
     * sat in a narrow strip down the middle, which on anything wider than a
     * phone read as a mistake rather than a choice. Constraining the whole page
     * instead keeps the bands edge to edge on a phone, where nearly everyone
     * will see this, and makes it a phone-shaped column on a desktop, which is
     * exactly what the app itself does.
     */
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <Logo size="sm" />
          <Link to="/auth" className="text-sm font-semibold text-primary px-3 py-1.5 rounded-full active:bg-primary/10">
            Sign In
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------- hero */}
      <section className="bg-primary text-primary-foreground rounded-b-[2.5rem] pb-10">
        <div className="px-5 pt-10 space-y-5">
          <span className="inline-block text-xs font-bold tracking-wide uppercase bg-primary-foreground/15 rounded-full px-3 py-1">
            Free to Start
          </span>
          <h1 className="text-[2.6rem] leading-[1.05] font-extrabold tracking-tight">
            Your duka,
            <br />
            in your pocket.
          </h1>
          <p className="text-primary-foreground/85 text-lg leading-relaxed">
            Sales, stock, deni and spending. Know exactly what you made today,
            siku kwa siku.
          </p>

          {/* The app's own daybook, not a picture of one. Same figures a real
              day produces, so it can never drift from what the app looks like. */}
          <div className="bg-card text-foreground rounded-2xl p-4 shadow-xl">
            <p className="sheet-heading">Today</p>
            <div className="ledger-line ledger-rule">
              <span className="text-muted-foreground">Sales</span>
              <span className="num">8,800</span>
            </div>
            <div className="ledger-line">
              <span className="text-muted-foreground">Cost of those goods</span>
              <span className="num">- 6,384</span>
            </div>
            <div className="ledger-line ledger-total">
              <span className="font-semibold">Take-home</span>
              <span className="text-2xl amount text-success">2,416</span>
            </div>
          </div>

          <Link to="/auth" className="block">
            <Button className="w-full py-6 text-base font-bold bg-card text-primary hover:bg-card/90">
              Start Free <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <p className="text-xs text-primary-foreground/70 text-center">
            No card. No download. One minute.
          </p>
        </div>
      </section>

      <main className="px-5 py-12 space-y-14">
        {/* ------------------------------------------------- what you get */}
        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight">Have a Look</h2>
          <p className="text-muted-foreground">This is the whole thing, on a real phone.</p>
          {/* Scrolls sideways rather than stacking, so five screens cost one
              screenful instead of five. */}
          <div className="-mx-5 px-5 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2">
            {SHOTS.map((shot) => (
              <figure key={shot.src} className="snap-start shrink-0 w-[220px]">
                <img
                  src={shot.src}
                  alt={shot.caption}
                  width={560}
                  loading="lazy"
                  className="w-full rounded-2xl border border-border shadow-sm bg-card"
                />
                <figcaption className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {shot.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------ the real worry */}
        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight">The Questions at Closing Time</h2>
          <div className="space-y-3">
            {WORRIES.map((worry) => {
              const Icon = worry.icon;
              return (
                <div key={worry.question} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold">{worry.question}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{worry.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ------------------------------------------------------- getting on */}
        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight">Three Steps and You Are Running</h2>
          <div className="space-y-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-4">
                <span className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground text-lg font-extrabold flex items-center justify-center shrink-0 num">
                  {i + 1}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="font-bold">{step.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ----------------------------------------------------------- pricing */}
      <section className="bg-muted/60 py-12">
        <div className="px-5 space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight">What It Costs</h2>
          {/*
            * Said plainly, including the part that is not ready. Advertising a
            * price we cannot yet collect would mean walking it back later, and a
            * shopkeeper who feels caught out by pricing does not come back.
            */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            Everything is free while we are getting started. When the paid plans
            arrive, the shops already with us keep their price. Recording a sale
            will always be free, and nobody is ever locked out of their own records.
          </p>

          <div className="space-y-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-5 ${
                  plan.now
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-card border border-border'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-lg font-extrabold">{plan.name}</span>
                  <span className="text-right">
                    <span className={`text-2xl amount ${plan.now ? '' : 'text-foreground'}`}>{plan.price}</span>
                    {plan.per && (
                      <span className={`text-xs ml-1 ${plan.now ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {plan.per}
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {plan.lines.map((line) => (
                    <div key={line} className="flex items-start gap-2">
                      <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.now ? 'text-primary-foreground' : 'text-success'}`} />
                      <span className={`text-sm ${plan.now ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                        {line}
                      </span>
                    </div>
                  ))}
                </div>
                <p className={`text-xs mt-3 font-medium ${plan.now ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {plan.now ? 'Available now' : 'Not yet. Free for now.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="px-5 py-12 space-y-14">
        {/* --------------------------------------------------------- install */}
        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight">Put It on Your Home Screen</h2>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border/70">
            <div className="p-4">
              <p className="font-bold text-sm">Android</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Open the menu in Chrome, then tap Add to Home screen.
              </p>
            </div>
            <div className="p-4">
              <p className="font-bold text-sm">iPhone</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Tap <Share className="h-3.5 w-3.5 inline align-text-bottom" /> Share at the bottom
                of Safari, scroll down, then{' '}
                <Plus className="h-3.5 w-3.5 inline align-text-bottom" /> Add to Home Screen.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- faq */}
        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight">Questions</h2>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border/70">
            {FAQ.map((item) => (
              <div key={item.q} className="p-4">
                <p className="font-bold text-sm">{item.q}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------- last word */}
      <section className="bg-primary text-primary-foreground rounded-t-[2.5rem] py-12">
        <div className="px-5 space-y-4 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
            Start today. It is free.
          </h2>
          <p className="text-primary-foreground/85">
            Record your first sale before the kettle boils.
          </p>
          <Link to="/auth" className="block pt-1">
            <Button className="w-full py-6 text-base font-bold bg-card text-primary hover:bg-card/90">
              Start Free <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <a
            href="https://wa.me/254702931920"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 text-sm font-semibold text-primary-foreground/90 pt-2"
          >
            <MessageCircle className="h-4 w-4" />
            Ask us on WhatsApp
          </a>
        </div>
      </section>

      <footer className="flex flex-col items-center gap-2 py-8 opacity-70">
        <Logo size="sm" wordmark={false} />
        <p className="text-xs text-muted-foreground">biashara yako, siku kwa siku</p>
      </footer>
    </div>
  );
}
