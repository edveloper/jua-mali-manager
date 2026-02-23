import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, Banknote, UserPlus, Sparkles, Scissors, Download } from "lucide-react";

export function HelpPanel() {
  const guides = [
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
        "Use Alerts to spot low stock or low capacity quickly.",
        "Record service sessions with staff name, session time, status, and notes."
      ]
    },
    {
      title: "Reports + AI",
      icon: <Sparkles className="h-5 w-5 text-amber-500" />,
      steps: [
        "Reports now include Overview, Tax, Loan, and AI tabs.",
        "Run AI Summary and AI Plan directly inside Reports.",
        "Ask AI specific report questions from the same screen."
      ]
    },
    {
      title: "Exports & Compliance",
      icon: <Download className="h-5 w-5 text-emerald-600" />,
      steps: [
        "Export Sales CSV from Reports and Expenses CSV from Expenses.",
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
      title: "Business Health",
      icon: <Banknote className="h-5 w-5 text-green-600" />,
      steps: [
        "Monitor revenue, profit, trend consistency, and top items.",
        "Track expenses with profile-aware categories and filterable analytics.",
        "Use one source of truth for both operations and growth planning."
      ]
    }
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="panel-glass p-4">
        <p className="section-kicker">Support</p>
        <h2 className="text-2xl font-black mt-1">Help Center</h2>
        <p className="text-muted-foreground text-sm mt-1">Practical playbook for running Duka Manager across products, services, and mixed businesses.</p>
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
