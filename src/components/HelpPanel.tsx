import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, Banknote, UserPlus, Sparkles, Scissors, Download } from "lucide-react";

export function HelpPanel() {
  const guides = [
    {
      title: "Quick Onboarding (First 10 Minutes)",
      icon: <Sparkles className="h-5 w-5 text-primary" />,
      steps: [
        "Create your shop profile: business category, offering mode (Products, Services, Mixed), and single-offering if applicable.",
        "Open Settings > Catalog Import to upload CSV/XLSX starter stock/service data.",
        "Add your first catalog items and set realistic low-stock/low-capacity thresholds.",
        "Run one test transaction (sale or service), then check Dashboard and Reports to confirm totals.",
        "Use Products > Restock to record purchases so stock and expense reports stay aligned."
      ]
    },
    {
      title: "Business Setup",
      icon: <Scissors className="h-5 w-5 text-primary" />,
      steps: [
        "Set your Business Profile in Settings: category, offering mode (Products, Services, Mixed), and single-offering toggle.",
        "Service businesses use capacity and session logs, while product businesses use stock and low-stock controls.",
        "Mixed mode lets you switch catalog view between products and services."
      ]
    },
    {
      title: "Team Management",
      icon: <UserPlus className="h-5 w-5 text-secondary" />,
      steps: [
        "As an Owner, go to Settings to add employee accounts.",
        "Employees can record transactions and view operational tabs.",
        "Owner-only financial controls stay protected."
      ]
    },
    {
      title: "Inventory / Services",
      icon: <Package className="h-5 w-5 text-blue-600" />,
      steps: [
        "Products track stock levels; Services track capacity and session details.",
        "Use Restock on product cards to add stock and auto-log purchase cost as an expense.",
        "Use Alerts to spot low stock or low capacity quickly.",
        "Record service sessions with staff name, session time, status, and notes."
      ]
    },
    {
      title: "Expenses Logic (Cash vs Accrual)",
      icon: <Banknote className="h-5 w-5 text-green-600" />,
      steps: [
        "Classify expenses as one-off, variable, or recurring to reflect real business spending patterns.",
        "Set allocation mode per entry: cash basis posts on transaction date, accrual basis spreads recurring costs over time.",
        "Home daily figures use date-scoped expense logic; Reports let you switch basis for period analysis."
      ]
    },
    {
      title: "Reports + AI",
      icon: <Sparkles className="h-5 w-5 text-amber-500" />,
      steps: [
        "Reports now include Overview, Ops, Tax, Loan, and AI tabs.",
        "Ops tab adds restock spend trends, top purchased items, and service session exports.",
        "Run AI Summary and AI Plan directly inside Reports.",
        "Ask AI specific report questions from the same screen."
      ]
    },
    {
      title: "Exports & Compliance",
      icon: <Download className="h-5 w-5 text-emerald-600" />,
      steps: [
        "Export Sales, Stock Purchases, and Service Sessions in CSV and Excel-compatible formats.",
        "Export Loan Readiness and Operations Summary text snapshots for external review.",
        "Export Expenses CSV from Expenses tab with expense type and allocation metadata.",
        "Use Tax tab estimates to prepare TOT workflows and filing records.",
        "Use Loan tab exports when presenting turnover consistency to lenders."
      ]
    },
    {
      title: "Credit & Cashflow",
      icon: <Users className="h-5 w-5 text-indigo-500" />,
      steps: [
        "Credit Book is available for product/mixed businesses.",
        "Track pending balances and record partial/full payments.",
        "Use reports to monitor credit impact on cashflow."
      ]
    },
    {
      title: "If App Seems Stuck Loading",
      icon: <Users className="h-5 w-5 text-indigo-500" />,
      steps: [
        "Wait a few seconds: the app now uses a startup loading state while sessions sync.",
        "If loading persists, tap browser refresh or close/reopen the PWA once.",
        "Check network connectivity and confirm your Supabase project is reachable."
      ]
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="panel-glass p-4">
        <p className="section-kicker">Support</p>
        <h2 className="text-2xl font-black mt-1">Help Center</h2>
        <p className="text-muted-foreground text-sm mt-1">Onboarding and operations playbook for products, services, and mixed businesses in Duka Manager.</p>
      </div>
      <div className="grid gap-4">
        {guides.map((guide, i) => (
          <Card key={i} className="border-border/60 shadow-sm rounded-2xl">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="p-2 rounded-xl bg-muted">{guide.icon}</div>
              <CardTitle className="text-lg">{guide.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
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
