import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Lock, AlertCircle, Database, KeyRound } from "lucide-react";

export function PrivacyPanel() {
  return (
    <div className="panel-glass p-5 space-y-4 animate-in fade-in">
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck className="h-6 w-6" />
        <h2 className="text-xl font-black">Privacy & Policy</h2>
      </div>

      <ScrollArea className="h-[62vh] pr-4">
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <Lock className="h-4 w-4" />
              <span>Data Protection</span>
            </div>
            <p>
              Duka Manager stores business records (catalog, transactions, expenses, and reports) in a shop-scoped model.
              Owner and staff access are separated by role, and sensitive controls remain owner-restricted.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <Database className="h-4 w-4" />
              <span>Operational Records</span>
            </div>
            <p>
              The platform now supports product and service workflows, including service sessions with staff and timing metadata.
              Use export tools for accounting, tax preparation, and loan-readiness documentation.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <KeyRound className="h-4 w-4" />
              <span>Account Responsibility</span>
            </div>
            <p>
              Owners are responsible for staff credential management, role assignments, and periodic password updates.
              Ensure staff log out at shift end on shared devices.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <AlertCircle className="h-4 w-4" />
              <span>Compliance Disclaimer</span>
            </div>
            <p>
              Tax and loan insights are assistive estimates. Confirm all regulatory submissions and financing applications using official requirements and professional advice where needed.
            </p>
          </section>

          <div className="pt-4 border-t border-border">
            <p className="text-[10px] text-center uppercase tracking-wider font-semibold">
              Duka Manager - Operating System for Kenyan SMBs
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
