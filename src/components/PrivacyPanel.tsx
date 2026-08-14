import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Lock, Users, Database, Trash2, AlertCircle } from "lucide-react";

export function PrivacyPanel() {
  return (
    <div className="sheet p-5 space-y-4 animate-in fade-in">
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck className="h-6 w-6" />
        <h2 className="text-xl font-black">Your data</h2>
      </div>

      <ScrollArea className="h-[62vh] pr-4">
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <Database className="h-4 w-4" />
              <span>What we keep</span>
            </div>
            <p>
              What you type into the app: your shop name, the things you sell and
              their prices, every sale, your expenses, and the names and phone
              numbers of customers you record for deni.
            </p>
            <p className="mt-2">
              Tarihi stores it on Supabase servers, not on your phone. That is why you
              can lose your phone and still have your records.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <Users className="h-4 w-4" />
              <span>Who can see it</span>
            </div>
            <p>
              You and the staff you add, and nobody else. Another shop using this
              app cannot see any of your records, and we do not sell or share your
              data with anyone.
            </p>
            <p className="mt-2">
              Staff see less than you do. They can sell and check stock, but not
              what you paid for goods, your expenses, or your profit.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <Lock className="h-4 w-4" />
              <span>Passwords</span>
            </div>
            <p>
              When you add a member of staff you set a temporary password, and they
              are asked to choose their own the first time they sign in. After that
              you do not know it.
            </p>
            <p className="mt-2">
              If someone leaves, remove them in Settings. That deletes their login
              straight away, so they cannot get back in.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <Trash2 className="h-4 w-4" />
              <span>Getting it out, or getting rid of it</span>
            </div>
            <p>
              Reports can export your sales, expenses and stock purchases to Excel
              whenever you want. It is your business record — take a copy.
            </p>
            <p className="mt-2">
              If you want your shop and everything in it deleted for good, ask us
              through Contact and we will do it.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-foreground font-bold mb-2">
              <AlertCircle className="h-4 w-4" />
              <span>One warning</span>
            </div>
            <p>
              The tax figure in Reports is a rough guide based on your recorded
              sales, not advice. Check with KRA or an accountant before you file
              anything.
            </p>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
