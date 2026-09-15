import { Link } from 'react-router-dom';
import {
  Users, Wallet, PackageSearch, HandCoins, Check, Share, Plus,
  MessageCircle, ArrowRight, LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';

/**
 * Where somebody lands who has not signed up yet.
 *
 * Written for a cheap Android on mobile data, which rules out the usual shape of
 * this page: no hero video, no stock photography, no font that has to be fetched
 * before anything can be read. Everything here is text and the icons that ship
 * with the app already.
 *
 * It is also written for somebody who was sent a link by another shopkeeper,
 * because that is how this spreads. So it opens with the questions a duka owner
 * actually has at the end of a day rather than with a list of features, and the
 * price is stated plainly instead of being hidden behind a form.
 */

interface Worry {
  question: string;
  answer: string;
  icon: LucideIcon;
}

const WORRIES: Worry[] = [
  {
    question: 'Who owes me, and how much?',
    answer:
      'Every deni in one place, with the name, the amount and how long it has been sitting. Record part payments as they come in.',
    icon: Users,
  },
  {
    question: 'What did I actually take home?',
    answer:
      'Not what came through the till. What is left after what the goods cost you and what you spent. Worked out for you, every day.',
    icon: Wallet,
  },
  {
    question: 'Is anything walking off the shelf?',
    answer:
      'Count the shelf against what the app expects. It tells you what is missing and what it was worth, not just how many units.',
    icon: PackageSearch,
  },
  {
    question: 'What do I owe my supplier?',
    answer:
      'Stock taken on credit is recorded as a debt, not as spending. The money only counts on the day you actually pay it.',
    icon: HandCoins,
  },
];

const STEPS = [
  {
    title: 'Put in what you sell',
    body: 'Start typing and pick from a list of things shops here already sell, in English or Kiswahili. You do not have to type every item from nothing.',
  },
  {
    title: 'Record as you go',
    body: 'A sale takes two taps. Cash, M-Pesa, part now and part on deni, whatever really happened at the counter.',
  },
  {
    title: 'Look at the day',
    body: 'Takings, spending and what is left. Then the week, the month, and a file for your accountant when you need one.',
  },
];

const FAQ = [
  {
    q: 'Does it cost anything?',
    a: 'No. It is free while we are getting started, and recording your sales will always be free.',
  },
  {
    q: 'Do I need to download it?',
    a: 'No. It opens in your browser, and you can add it to your home screen so it opens like any other app.',
  },
  {
    q: 'Can my staff use it?',
    a: 'Yes, and you choose what each person is allowed to do. Staff never see what goods cost you or what the shop made.',
  },
  {
    q: 'What if I have more than one shop?',
    a: 'Add as many as you run and switch between them. They can be branches of one business or separate businesses.',
  },
  {
    q: 'Who can see my records?',
    a: 'You and the staff you add. Nobody else. We never sell your records and we never pass on anything about your customers.',
  },
];

const PLANS = [
  {
    name: 'Bure',
    price: 'Free',
    now: true,
    lines: ['One shop, just you', 'Sales, stock, deni and spending', 'The last 30 days'],
  },
  {
    name: 'Duka',
    price: 'KSh 300 a month',
    now: false,
    lines: ['Up to 3 staff', 'All your history', 'Invoices and spreadsheets'],
  },
  {
    name: 'Biashara',
    price: 'KSh 800 a month',
    now: false,
    lines: ['Several shops and branches', 'As many staff as you need', 'M-Pesa matching and cheques'],
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Logo size="sm" />
          <Link to="/auth" className="text-sm font-medium text-primary px-2 py-1">
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-10">
        <section className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">
            Know what your shop really made today.
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            DukaKonnect keeps the book for small shops in Kenya. Sales, stock, deni
            and spending, on the phone already in your pocket.
          </p>
          <Link to="/auth" className="block">
            <Button className="w-full h-12 text-base">
              Start free <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground text-center">
            No card, no download. Takes a minute.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">The questions at the end of the day</h2>
          {WORRIES.map((worry) => {
            const Icon = worry.icon;
            return (
              <div key={worry.question} className="sheet">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{worry.question}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {worry.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Getting going</h2>
          <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-3 px-4 py-3.5">
                <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shrink-0 num">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">What it costs</h2>
          {/*
            * Said plainly, including the part that is not ready. Advertising a
            * price we cannot yet take money for would mean walking it back
            * later, and a shopkeeper who feels caught out by pricing does not
            * come back.
            */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            Everything is free while we are getting started. When the paid plans
            arrive, the shops already with us keep their price. Recording a sale
            will always be free, and nobody is ever locked out of their own records.
          </p>
          {PLANS.map((plan) => (
            <div key={plan.name} className={`sheet ${plan.now ? 'border-primary/40 bg-primary/5' : ''}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{plan.name}</span>
                <span className={`amount ${plan.now ? 'text-primary' : 'text-muted-foreground'}`}>
                  {plan.price}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {plan.lines.map((line) => (
                  <div key={line} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-success shrink-0 mt-1" />
                    <span className="text-sm text-muted-foreground">{line}</span>
                  </div>
                ))}
              </div>
              {!plan.now && (
                <p className="text-xs text-muted-foreground mt-2">Not yet. Free for now.</p>
              )}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Put it on your home screen</h2>
          <div className="sheet space-y-3">
            <div>
              <p className="font-medium text-sm">Android</p>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                Open the menu in Chrome and choose Add to Home screen. It then opens
                like any other app.
              </p>
            </div>
            <div>
              <p className="font-medium text-sm flex items-center gap-1.5">
                iPhone
              </p>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                Tap <Share className="h-3.5 w-3.5 inline align-text-bottom" /> Share at
                the bottom of Safari, scroll down, then tap{' '}
                <Plus className="h-3.5 w-3.5 inline align-text-bottom" /> Add to Home
                Screen.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Questions</h2>
          <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
            {FAQ.map((item) => (
              <div key={item.q} className="px-4 py-3">
                <p className="font-medium text-sm">{item.q}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <Link to="/auth" className="block">
            <Button className="w-full h-12 text-base">
              Start free <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <a
            href="https://wa.me/254702931920"
            target="_blank"
            rel="noreferrer"
            className="sheet w-full flex items-center justify-center gap-2 pressable text-sm font-medium"
          >
            <MessageCircle className="h-4 w-4 text-primary" />
            Ask us on WhatsApp
          </a>
        </section>

        <footer className="flex flex-col items-center gap-2 pt-2 pb-8 opacity-70">
          <Logo size="sm" wordmark={false} />
          <p className="text-xs text-muted-foreground">biashara yako, siku kwa siku</p>
        </footer>
      </main>
    </div>
  );
}
