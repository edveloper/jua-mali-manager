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
          <span className="text-foreground font-medium">Duka</span> is your shop.{' '}
          <span className="text-foreground font-medium">Konnect</span> is the family this
          belongs to, alongside RentKonnect for landlords. This one is your daybook: the
          same one you would keep on paper, except it adds up on its own and does not get
          rained on.
        </p>
        <p>
          It is built for shops in towns like Voi, Oyugis and Kilifi. Businesses that know
          exactly what they sold today, but not what they made this month.
        </p>
      </div>

      <div className="sheet space-y-2 text-sm">
        <p className="sheet-heading">What it does not do</p>
        <p className="text-muted-foreground leading-relaxed">
          It will not tell you how to run your shop, and it is not a bank. It records
          what you did and shows you the total. The decisions stay yours.
        </p>
      </div>

      <div className="sheet space-y-2">
        <p className="sheet-heading">A note on your numbers</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Everything here is only as good as what goes in. If an item has no cost
          price, DukaKonnect cannot work out profit on it and your day will look better
          than it was. The Home screen will tell you when that is happening.
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        Made in Kenya, for Kenyan shops.
      </p>
    </div>
  );
}
