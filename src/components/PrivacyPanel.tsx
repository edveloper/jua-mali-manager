const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: 'What we keep',
    paragraphs: [
      'What you type in. Your shop name, what you sell and for how much, every sale, what you spend, and the names and numbers of customers who take things on deni.',
      'It is kept on servers, not on your phone. Lose the phone and your records are still there when you sign in on another one.',
    ],
  },
  {
    title: 'Who can see it',
    paragraphs: [
      'You and the staff you add. Nobody else. Another shop on DukaKonnect cannot see a thing of yours, and we do not sell or share any of it.',
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
      'Export your sales and spending to a spreadsheet whenever you like, from Money. They are your records. Keep your own copy.',
      'Want the whole thing gone? Ask through Contact us and we will delete your shop and everything in it, for good.',
    ],
  },
  {
    title: 'One warning',
    paragraphs: [
      'The tax figures are worked out from what you recorded. They are a guide, not advice, and the thresholds change with each Finance Act. Check with KRA or an accountant before you file.',
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
