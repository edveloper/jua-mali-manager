import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, Banknote, ShieldCheck, UserPlus } from "lucide-react";

export function HelpPanel() {
  const guides = [
    {
      title: "Team Management",
      icon: <UserPlus className="h-5 w-5 text-purple-500" />,
      steps: [
        "As an Owner, go to 'Settings' to create Employee accounts.",
        "Employees get their own login credentials.",
        "Employees can record sales and view alerts but cannot see your total profits or expenses."
      ]
    },
    {
      title: "Inventory & Sales",
      icon: <Package className="h-5 w-5 text-primary" />,
      steps: [
        "Add products with 'Buying Price' and 'Selling Price'.",
        "Click any product to record a sale.",
        "Low stock items will show up in the 'Alerts' tab for staff to see."
      ]
    },
    {
      title: "Credit & Debts",
      icon: <Users className="h-5 w-5 text-blue-500" />,
      steps: [
        "When selling, choose 'Credit' to add to the customer's debt.",
        "Manage all debts in the 'Credit Book' via the top menu.",
        "Record partial or full payments when customers bring cash."
      ]
    },
    {
      title: "Business Health",
      icon: <Banknote className="h-5 w-5 text-green-600" />,
      steps: [
        "Owners can view total daily/monthly sales and net profit.",
        "Log 'Expenses' like rent or transport to get an accurate profit figure.",
        "Use the 'Reports' tab for a deeper breakdown of business performance."
      ]
    }
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="px-1">
        <h2 className="text-2xl font-bold">Help Center</h2>
        <p className="text-muted-foreground text-sm">How to manage your shop with Duka Manager</p>
      </div>
      <div className="grid gap-4">
        {guides.map((guide, i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              {guide.icon}
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