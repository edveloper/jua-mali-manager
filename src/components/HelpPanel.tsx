import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, Banknote, UserPlus, Store, Scissors, BarChart3 } from "lucide-react";

export function HelpPanel() {
  const guides = [
    {
      title: "Getting started",
      icon: <Store className="h-5 w-5 text-primary" />,
      steps: [
        "Add a few of the things you sell, with what each one costs you and what you sell it for.",
        "Make one test sale and check the Home screen. If the numbers look right, you are set up.",
        "Got a long stock list already? Settings has a CSV and Excel import."
      ]
    },
    {
      title: "Selling",
      icon: <Package className="h-5 w-5 text-primary" />,
      steps: [
        "Tap Sell on any item, set the quantity, done. Stock goes down on its own.",
        "Selling on deni? Choose Credit and type the customer's name. If they are new, add their number there and then — no need to leave the sale.",
        "If you have agreed a price with the customer, type it over the usual one. You will only see that box if the owner has allowed it for you."
      ]
    },
    {
      title: "Buying stock",
      icon: <Banknote className="h-5 w-5 text-secondary" />,
      steps: [
        "Always use Restock on the item, not the Expenses tab.",
        "Restock does three things at once: raises your stock, updates what the item costs you on average, and records the money you spent.",
        "Log stock as a plain expense instead and your shelves will say one thing while your books say another."
      ]
    },
    {
      title: "Deni",
      icon: <Users className="h-5 w-5 text-warning" />,
      steps: [
        "The Credit Book shows who owes you and how much.",
        "Record part payments as they come. Each one is saved with its date, so Reports can tell you what actually came in that day.",
        "A sale on deni counts as income the day it happens. The payment later is not income again — it is the money finally arriving."
      ]
    },
    {
      title: "Your staff",
      icon: <UserPlus className="h-5 w-5 text-primary" />,
      steps: [
        "Add staff in Settings. Give them a temporary password; they choose their own the first time they sign in.",
        "Staff can sell and see what is in stock. They cannot see what you paid for anything, your expenses, or your profit.",
        "You can let a staff member agree prices with customers. Set the lowest and highest you will accept on the item first, then switch it on for that person."
      ]
    },
    {
      title: "Knowing where you stand",
      icon: <BarChart3 className="h-5 w-5 text-primary" />,
      steps: [
        "Home shows one day at a time. Use the arrows to look back at yesterday or last week.",
        "Reports covers longer stretches, and you can export any of it to Excel.",
        "Two different profits appear, and the gap between them is your running costs: one is sales minus what the goods cost you, the other takes off rent, wages and the rest."
      ]
    },
    {
      title: "Services",
      icon: <Scissors className="h-5 w-5 text-secondary" />,
      steps: [
        "If you sell time rather than goods — a barber, a cyber, a salon — set your business to Services in Settings.",
        "You then track how many slots you have left in a day instead of stock on a shelf, and each session can carry the staff member's name and a note."
      ]
    },
    {
      title: "When something looks wrong",
      icon: <Package className="h-5 w-5 text-muted-foreground" />,
      steps: [
        "Stuck on the loading screen? Close the app fully and open it again.",
        "Numbers lower than you expected? Check that every item has a cost price. Without one the app cannot work out profit and will flatter you.",
        "Still stuck, or something is plainly wrong? Use Contact & Feedback. Say what you were doing when it happened."
      ]
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="panel-glass p-4">
        <p className="section-kicker">Help</p>
        <h2 className="text-2xl font-black mt-1">How this works</h2>
        <p className="text-muted-foreground text-sm mt-1">The short version of everything.</p>
      </div>
      <div className="grid gap-4">
        {guides.map((guide, i) => (
          <Card key={i} className="border-border/60 shadow-sm rounded-2xl">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="p-2 rounded-xl bg-muted">{guide.icon}</div>
              <CardTitle className="text-lg">{guide.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {guide.steps.map((step, j) => (
                  <li key={j}>{step}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
