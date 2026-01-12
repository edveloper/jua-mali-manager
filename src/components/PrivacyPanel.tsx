import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Lock, AlertCircle } from "lucide-react";

export function PrivacyPanel() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4 animate-in fade-in">
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck className="h-6 w-6" />
        <h2 className="text-xl font-bold">Privacy & Policy</h2>
      </div>

      <ScrollArea className="h-[60vh] pr-4">
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <Lock className="h-4 w-4" />
              <span>Data & Security</span>
            </div>
            <p>Duka Manager stores your business name, inventory, and sales records securely. Owner and Employee accounts are isolated to ensure your sensitive financial data (like profit margins) is only visible to you.</p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <AlertCircle className="h-4 w-4" />
              <span>Usage Disclaimer</span>
            </div>
            <p>This app is a digital ledger intended for small shops and kiosks in Kenya. While we provide tools for TOT (Turnover Tax) calculation and profit tracking, Duka Manager is not a substitute for official KRA tax filing or professional accounting services.</p>
          </section>

          <section>
            <h3 className="font-bold text-foreground mb-2">Account Responsibility</h3>
            <p>Owners are responsible for managing their Employee credentials. We recommend changing passwords regularly and ensuring that employees log out after their shift.</p>
          </section>

          <div className="pt-4 border-t border-border">
            <p className="text-[10px] text-center uppercase tracking-wider font-semibold">
              Duka Manager — Simple Inventory for Kenya
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}