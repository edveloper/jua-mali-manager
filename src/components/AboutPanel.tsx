import { Logo } from '@/components/Logo';

export function AboutPanel() {
  return (
    <div className="space-y-3">
      <div className="sheet flex flex-col items-center text-center py-6 gap-3">
        <Logo size="lg" wordmark={false} />
        <div>
          <p className="text-2xl font-bold tracking-tight">
            Duka<span className="text-primary">Konnect</span>
          </p>
          <p className="text-sm text-muted-foreground">biashara yako, siku kwa siku</p>
        </div>
      </div>

      <div className="sheet space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          Most shop owners can tell you exactly what they sold today. Ask what they
          made last month, and it gets quiet. The money came in, the money went out,
          and somewhere in between the answer got lost.
        </p>
        <p>
          This is the notebook you already keep. It just adds itself up, and it does
          not get rained on, lent to a child for homework, or left in the other jacket.
        </p>
        <p>
          <span className="text-foreground font-medium">Duka</span> is your shop.{' '}
          <span className="text-foreground font-medium">Konnect</span> is the family it
          belongs to, alongside RentKonnect for landlords.
        </p>
      </div>

      <div className="sheet space-y-2 text-sm">
        <p className="sheet-heading">Who it is for</p>
        <p className="text-muted-foreground leading-relaxed">
          Small businesses, the ones that actually run on cash, deni and memory. It is
          priced so a shop taking a few thousand a day can justify it without thinking
          hard, and built so that after a week you would notice if it went.
        </p>
      </div>

      <div className="sheet space-y-2 text-sm">
        <p className="sheet-heading">What it will not do</p>
        <p className="text-muted-foreground leading-relaxed">
          It will not tell you how to run your shop, and it is not a bank. It writes
          down what you did and shows you the total. What you do about it is yours.
        </p>
      </div>

      <div className="sheet space-y-2">
        <p className="sheet-heading">A word on your numbers</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          They are only as good as what goes in. Leave an item without a cost price and
          there is nothing to work profit out from, so the day will look better than it
          was. Home says so when it happens, rather than letting you find out later.
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        Made in Kenya, for Kenyan business.
      </p>
    </div>
  );
}
