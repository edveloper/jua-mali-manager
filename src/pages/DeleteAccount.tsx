import { Link, useSearchParams } from 'react-router-dom';
import { PublicPage, Section } from '@/components/PublicPage';
import { usePageMeta } from '@/lib/page-meta';
import { CONTACT_EMAIL, LEGAL_UPDATED, PUBLIC_ROUTES } from '@/seo/public-routes';

const ul = 'list-disc pl-5 space-y-1.5';
const ol = 'list-decimal pl-5 space-y-1.5';

const REQUEST_SUBJECT = encodeURIComponent('Delete my DukaKonnect account');
const REQUEST_BODY = encodeURIComponent('Phone number or email I sign in with:\n\nMy shop name:\n');

// Google Play links here, so it must make sense to somebody who cannot sign in.
export default function DeleteAccount() {
  const meta = PUBLIC_ROUTES.deleteAccount;
  usePageMeta(meta.title, meta.description);
  const [params] = useSearchParams();

  return (
    <PublicPage title="Delete Your DukaKonnect Account" updated={LEGAL_UPDATED}>
      {params.get('deleted') === '1' && (
        <p role="status" className="sheet font-medium">
          Your account has been deleted. Thank you for using DukaKonnect.
        </p>
      )}

      <p>
        DukaKonnect is run by Eddie Ezekiel Ochieng in Kenya. You can delete your account yourself
        at any time, and it takes about a minute.
      </p>

      <Section heading="If You Can Sign In">
        <ol className={ol}>
          <li>
            <Link to="/auth" className="text-primary underline">Sign in</Link> to DukaKonnect.
          </li>
          <li>Open your account from the top of the screen, and scroll to the bottom.</li>
          <li>Tap Delete Account and follow the steps.</li>
        </ol>
      </Section>

      <Section heading="If You Cannot Sign In">
        <p>
          Email{' '}
          <a
            className="text-primary underline"
            href={`mailto:${CONTACT_EMAIL}?subject=${REQUEST_SUBJECT}&body=${REQUEST_BODY}`}
          >
            {CONTACT_EMAIL}
          </a>{' '}
          with the phone number or email you sign in with, and the name of your shop. We will check
          that the account is yours before deleting anything, and we will do it within 30 days.
        </p>
      </Section>

      <Section heading="What Is Deleted">
        <ul className={ul}>
          <li>Your login, your name and your contact details.</li>
          <li>
            For an owner, each shop you own and everything in it, from sales and stock to customers
            and invoices. This includes the shop&apos;s logo and any links to its invoices.
          </li>
          <li>The logins of your staff, unless they also work in another shop.</li>
        </ul>
      </Section>

      <Section heading="What Stays">
        <ul className={ul}>
          <li>
            If you are staff, the shop&apos;s owner keeps the shop&apos;s records, including sales
            you made. Your name no longer appears on them.
          </li>
          <li>
            Copies in our hosting provider&apos;s routine backups and logs are not removed one by
            one. They disappear as those backups and logs expire.
          </li>
        </ul>
        <p>
          Deleting cannot be undone, so export your records first if you might need them. More
          detail is in the <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.
        </p>
      </Section>
    </PublicPage>
  );
}
