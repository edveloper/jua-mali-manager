import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, Globe, MessageSquare, Bug, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContactPanel() {
  const contactData = {
    name: "Eddie Ezekiel Ochieng",
    phone: "+254702931920",
    email: "ed.veloper10@gmail.com",
    website: "https://www.eddie-ezekiel.com/",
  };

  const handleFeedback = (type: 'Bug' | 'Feature') => {
    const subject = encodeURIComponent(`Duka Manager: ${type} Report`);
    const body = encodeURIComponent(`Hello Eddie,\n\nI would like to report a ${type.toLowerCase()}:\n\n[Describe here]\n\nShop Name: `);
    window.location.href = `mailto:${contactData.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Contact Developer</h2>
        <p className="text-muted-foreground text-sm">Support for Ochieng's Stall (Duka Manager)</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          className="h-24 flex flex-col gap-2 border-destructive/20 hover:bg-destructive/5"
          onClick={() => handleFeedback('Bug')}
        >
          <Bug className="h-6 w-6 text-destructive" />
          <span>Report a Bug</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-24 flex flex-col gap-2 border-primary/20 hover:bg-primary/5"
          onClick={() => handleFeedback('Feature')}
        >
          <Lightbulb className="h-6 w-6 text-primary" />
          <span>Request Feature</span>
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm">
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
              className="bg-green-600 hover:bg-green-700 text-white rounded-full"
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
              <a href={`mailto:${contactData.email}`} className="text-sm font-semibold">{contactData.email}</a>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-border/50">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <a href={contactData.website} target="_blank" className="text-xs text-primary hover:underline">
              Visit eddie-ezekiel.com
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}