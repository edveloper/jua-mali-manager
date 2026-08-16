import { Button } from '@/components/ui/button';

const CONTACT = {
  name: 'Eddie Ezekiel Ochieng',
  phone: '+254702931920',
  email: 'ed.veloper10@gmail.com',
  website: 'https://www.eddie-ezekiel.com/',
};

export function ContactPanel() {
  const mailto = (kind: 'problem' | 'idea') => {
    const subject = encodeURIComponent(
      kind === 'problem' ? 'Tarihi: something is wrong' : 'Tarihi: an idea'
    );
    const body = encodeURIComponent(
      kind === 'problem'
        ? 'What I was doing:\n\nWhat happened instead:\n\nMy shop name:\n\nPhone I am using:\n'
        : 'What I would like it to do:\n\nWhy that would help:\n\nMy shop name:\n'
    );
    window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-3">
      <div className="sheet">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Something broken, or an idea for what it should do? Say so. Tarihi is small
          enough that one message reaches the person who builds it.
        </p>
      </div>

      <div className="sheet space-y-2">
        <p className="sheet-heading">Fastest</p>
        <Button
          className="w-full justify-start"
          onClick={() => window.open(`https://wa.me/${CONTACT.phone.replace('+', '')}`, '_blank')}
        >
          WhatsApp {CONTACT.phone}
        </Button>
        <Button variant="outline" className="w-full justify-start" asChild>
          <a href={`tel:${CONTACT.phone}`}>Call {CONTACT.phone}</a>
        </Button>
      </div>

      <div className="sheet space-y-2">
        <p className="sheet-heading">By email</p>
        <Button variant="outline" className="w-full justify-start" onClick={() => mailto('problem')}>
          Report a problem
        </Button>
        <Button variant="outline" className="w-full justify-start" onClick={() => mailto('idea')}>
          Suggest something
        </Button>
        <p className="text-xs text-muted-foreground pt-1">
          Tell us what you were doing when it happened, and send a picture of the screen
          if you can. It saves a lot of back and forth.
        </p>
      </div>

      <div className="sheet">
        <p className="sheet-heading">Built by</p>
        <p className="text-sm mt-1">{CONTACT.name}</p>
        <a
          href={CONTACT.website}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary"
        >
          eddie-ezekiel.com
        </a>
      </div>
    </div>
  );
}
