const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: 'What we keep',
    paragraphs: [
      'What you type in: your shop name, the things you sell and their prices, every sale, your spending, and the names and phone numbers of customers you record for deni.',
      'DukaKonnect stores it on Supabase servers, not on your phone. That is why you can lose your phone and still have your records.',
    ],
  },
  {
    title: 'Who can see it',
    paragraphs: [
      'You and the staff you add, and nobody else. Another shop using DukaKonnect cannot see any of your records, and we do not sell or share your data.',
      'Staff see less than you do. They can sell and check stock, but not what you paid for goods, your spending, or your profit.',
    ],
  },
  {
    title: 'Passwords',
    paragraphs: [
      'When you add a member of staff you set a temporary password, and they choose their own the first time they sign in. After that you do not know it.',
      'If someone leaves, remove them under More. That deletes their login straight away, so they cannot get back in.',
    ],
  },
  {
    title: 'Getting it out, or getting rid of it',
    paragraphs: [
      'Money can export your sales and spending to a spreadsheet whenever you want. It is your business record, so take a copy.',
      'If you want your shop and everything in it deleted for good, ask through Contact us and we will do it.',
    ],
  },
  {
    title: 'One warning',
    paragraphs: [
      'The tax figure is a rough guide based on your recorded sales, not advice. Check with KRA or an accountant before you file anything.',
    ],
  },
];

export function PrivacyPanel() {
  return (
    <div className="space-y-3">
      {SECTIONS.map((section) => (
        <div key={section.title} className="sheet">
          <p className="font-semibold">{section.title}</p>
          <div className="mt-2 space-y-2">
            {section.paragraphs.map((paragraph, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
