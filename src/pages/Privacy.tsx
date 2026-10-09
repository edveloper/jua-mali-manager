import { PublicPage, Section } from '@/components/PublicPage';
import { usePageMeta } from '@/lib/page-meta';
import { CONTACT_EMAIL, LEGAL_UPDATED, PUBLIC_ROUTES } from '@/seo/public-routes';

const ul = 'list-disc pl-5 space-y-1.5';

export default function Privacy() {
  const meta = PUBLIC_ROUTES.privacy;
  usePageMeta(meta.title, meta.description);

  return (
    <PublicPage title="Privacy Policy" updated={LEGAL_UPDATED}>
      <p>
        DukaKonnect keeps the books for small shops. To do that it has to hold your shop&apos;s
        records, and some details about your customers. This page sets out what is kept, who can
        see it, and what you can do about it. It is written plainly on purpose.
      </p>

      <Section heading="Who runs DukaKonnect">
        <p>
          DukaKonnect is run by Eddie Ezekiel Ochieng, in Kenya. For anything on this page, write
          to <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <Section heading="What is kept">
        <ul className={ul}>
          <li>
            <strong>Your account.</strong> Your name, and the phone number or email you sign in
            with. Your password is stored in a form that cannot be read back, by us or anyone else.
          </li>
          <li>
            <strong>Your shop&apos;s records.</strong> What you type in: your shop name, what you
            sell and for how much, every sale, your stock, what you spend, suppliers, cheques, and
            any M-Pesa entries you record.
          </li>
          <li>
            <strong>Your customers.</strong> The names, phone numbers and, if you add them, email
            addresses of customers who take things on deni, with what they owe and have paid.
          </li>
          <li>
            <strong>Your staff.</strong> The names and sign-in details of anyone you add to your shop.
          </li>
          <li>
            <strong>Visits to this website.</strong> Google Analytics records which pages are
            visited on dukakonnect.co.ke, from what kind of device and roughly where, so we can see
            what is useful. It does not see your shop&apos;s records.
          </li>
        </ul>
      </Section>

      <Section heading="Who can see it">
        <p>
          You, and the staff you add. Nobody else. Another shop on DukaKonnect cannot see anything
          of yours. Staff see less than you do: they can sell and check stock, but not what you paid
          for goods, your spending, or your profit.
        </p>
        <p>
          An invoice you share by link can be opened by anyone who has that link, so send it only
          to the customer it is for.
        </p>
        <p>
          We do not sell your information, show you advertising, or pass your records to anyone
          to market to you.
        </p>
      </Section>

      <Section heading="Your customers' details">
        <p>
          When you record a customer&apos;s name and number, you are the one collecting it, and
          DukaKonnect keeps it on your behalf. Only record what you need to follow up what they owe,
          and tell customers you keep a record if they ask.
        </p>
      </Section>

      <Section heading="Sharing prices with other shops (only if you choose)">
        <p>
          In the app you can choose to help build a picture of prices across shops. If you switch it
          on, what is shared is which items sell, at what price and how many, and the kind of
          business you run in a general area, always counted together with other shops and never on
          its own.
        </p>
        <p>
          Never shared, whatever you choose: customer names or numbers, who owes you or how much,
          your takings, spending or profit, and your shop name, exact location or anything that
          points to you. You can switch it off at any time.
        </p>
      </Section>

      <Section heading="The services that help run DukaKonnect">
        <p>A few companies process information for us, each only for its own job:</p>
        <ul className={ul}>
          <li><strong>Supabase</strong> stores your records and handles signing in.</li>
          <li><strong>Vercel</strong> hosts the website and app.</li>
          <li>
            <strong>Africa&apos;s Talking</strong> and <strong>Resend</strong> deliver the one-time
            codes sent by SMS or email when you reset a password.
          </li>
          <li><strong>Google Analytics</strong> counts visits to the website, as described above.</li>
        </ul>
        <p>
          Some of these keep data on servers outside Kenya. They are bound by their own security
          and data protection commitments.
        </p>
      </Section>

      <Section heading="Keeping it safe">
        <p>
          Your records are kept on servers, not on your phone, so losing the phone does not lose the
          books. Every shop&apos;s data is separated at the database level, connections are
          encrypted, and money changes run inside the database rather than on the phone. When a
          member of staff leaves and you remove them, their login stops working straight away.
        </p>
      </Section>

      <Section heading="Getting it out, or getting rid of it">
        <p>
          Under Kenya&apos;s Data Protection Act you can ask to see the information held about you,
          have it corrected, or have it deleted. In practice:
        </p>
        <ul className={ul}>
          <li>Export your sales and spending to a spreadsheet whenever you like, from Money.</li>
          <li>
            Ask through Contact us, or by email, and we will delete your shop and everything in it,
            for good.
          </li>
          <li>
            If you are unhappy with how your information is handled, you can complain to the Office
            of the Data Protection Commissioner (odpc.go.ke).
          </li>
        </ul>
      </Section>

      <Section heading="How long it is kept">
        <p>
          For as long as your shop uses DukaKonnect. When you ask for deletion, your shop and its
          records are removed; copies in routine backups are overwritten in the normal course.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If this policy changes in a way that matters, the date at the top will change and shops
          will be told in the app.
        </p>
      </Section>
    </PublicPage>
  );
}
