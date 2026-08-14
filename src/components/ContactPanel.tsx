import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, Globe, Bug, Lightbulb, MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContactPanel() {
  const contactData = {
    name: "Eddie Ezekiel Ochieng",
    phone: "+254702931920",
    email: "ed.veloper10@gmail.com",
    website: "https://www.eddie-ezekiel.com/",
  };

  const handleFeedback = (type: 'Bug' | 'Feature') => {
    const subject = encodeURIComponent(`Tarihi: ${type}`);
    const body = encodeURIComponent(`Hello Eddie,\n\nI would like to report a ${type.toLowerCase()}:\n\n[Describe here]\n\nBusiness Type:\nShop Name:\nDevice/Browser:\n\nThank you.`);
    window.location.href = `mailto:${contactData.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="sheet p-5 text-center space-y-2">
        <p className="sheet-heading">Contact</p>
        <h2 className="text-2xl font-black">Talk to us</h2>
        <p className="text-muted-foreground text-sm">Something broken, or an idea? We would like to hear it.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-24 flex flex-col gap-2 border-destructive/20 hover:bg-destructive/5 rounded-lg"
          onClick={() => handleFeedback('Bug')}
        >
          <Bug className="h-6 w-6 text-destructive" />
          <span>Report a problem</span>
        </Button>
        <Button
          variant="outline"
          className="h-24 flex flex-col gap-2 border-primary/20 hover:bg-primary/5 rounded-lg"
          onClick={() => handleFeedback('Feature')}
        >
          <Lightbulb className="h-6 w-6 text-primary" />
          <span>Suggest something</span>
        </Button>
      </div>

      <Card className="border-border/60 rounded-lg">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Phone className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Call / WhatsApp</p>
              <p className="text-sm font-semibold">{contactData.phone}</p>
            </div>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => window.open(`https://wa.me/${contactData.phone.replace('+', '')}`, '_blank')}
            >
              Chat
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Email</p>
              <a href={`mailto:${contactData.email}`} className="text-sm font-semibold hover:underline">{contactData.email}</a>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-border/50">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <a href={contactData.website} target="_blank" className="text-xs text-primary hover:underline" rel="noreferrer">
              Visit eddie-ezekiel.com
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="sheet p-4 flex items-start gap-2">
        <MessageSquareHeart className="h-4 w-4 text-primary mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Tell us what you were doing when it happened, and send a screenshot if you can. It saves a lot of back and forth.
        </p>
      </div>
    </div>
  );
}
