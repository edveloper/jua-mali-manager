import { Link } from 'react-router-dom';
import { PublicPage, Section } from '@/components/PublicPage';
import { usePageMeta } from '@/lib/page-meta';
import { CONTACT_EMAIL, LEGAL_UPDATED, PUBLIC_ROUTES } from '@/seo/public-routes';

const ul = 'list-disc pl-5 space-y-1.5';

export default function Terms() {
  const meta = PUBLIC_ROUTES.terms;
  usePageMeta(meta.title, meta.description);

  return (
    <PublicPage title="Terms of Use" updated={LEGAL_UPDATED}>
      <p>
        These terms apply when you use DukaKonnect, which is run by Eddie Ezekiel Ochieng in Kenya.
        They cover the website and the Android app alike. By creating an account you agree to them.
        They are kept short and plain.
      </p>

      <Section heading="Using DukaKonnect">
        <ul className={ul}>
          <li>You need to be 18 or over and running, or working for, a real business.</li>
          <li>
            Keep your password to yourself. You are responsible for what happens under your account.
          </li>
          <li>Use it for lawful trade only.</li>
        </ul>
      </Section>

      <Section heading="Your Staff">
        <p>
          The staff logins you create are yours to look after. You choose who gets one, what they
          record happens under your shop, and when someone leaves it is up to you to remove them.
          Their login stops working as soon as you do.
        </p>
      </Section>

      <Section heading="Your Records Are Yours">
        <p>
          Everything you record belongs to you. You let DukaKonnect store and process it only so
          that the app can work for you. You can export it at any time and delete it yourself.
          How it is handled is set out in the <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section heading="Sharing Prices, Only If You Choose">
        <p>
          You can switch on sharing to help build a picture of prices across shops. It is off unless
          you turn it on, and you can turn it off again at any time. What is shared and what never
          is, whatever you choose, is listed in the Privacy Policy.
        </p>
      </Section>

      <Section heading="What It Costs">
        <p>
          DukaKonnect is free while it is getting started. If paid plans are introduced, you will be
          told before anything changes, shops already using it keep the price they joined on,
          recording a sale will always be free, and nobody is ever locked out of their own records.
        </p>
      </Section>

      <Section heading="Figures Are a Guide">
        <p>
          The totals, profit and tax figures in the app are worked out from what you record. They
          are only as accurate as what goes in. Tax figures are a guide, not advice. The thresholds
          change with each Finance Act, so check with KRA or an accountant before you file.
        </p>
      </Section>

      <Section heading="Keeping It Running">
        <p>
          We work to keep DukaKonnect available and your records safe, but we cannot promise it will
          never be interrupted. Features will change as the app grows, and anything that affects how
          you use it will be explained in the app first. Export your records from time to time and
          keep your own copy.
        </p>
        <p>
          To the extent Kenyan law allows, DukaKonnect is not liable for losses that come from
          relying on the app, from interruptions, or from information entered incorrectly.
        </p>
      </Section>

      <Section heading="Leaving, or Being Asked to Leave">
        <p>
          You can stop using DukaKonnect whenever you like and delete your account from the app.
          Deleting removes your records for good and cannot be undone. The{' '}
          <Link to="/delete-account" className="text-primary underline">Delete Your Account</Link>{' '}
          page explains how. An account used for fraud, unlawful trade or to attack the service may
          be suspended.
        </p>
      </Section>

      <Section heading="Google Play">
        <p>
          If you install DukaKonnect from Google Play, these terms are between you and DukaKonnect.
          Google is not a party to them and is not responsible for the app or its support.
        </p>
      </Section>

      <Section heading="The Rest">
        <p>
          These terms are governed by the laws of Kenya. If they change in a way that matters, the
          date at the top will change and shops will be told in the app. Questions go
          to <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </PublicPage>
  );
}
