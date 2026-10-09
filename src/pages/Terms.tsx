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
        By creating an account you agree to them. They are kept short and plain.
      </p>

      <Section heading="Using DukaKonnect">
        <ul className={ul}>
          <li>You need to be 18 or over and running, or working for, a real business.</li>
          <li>
            Keep your password to yourself. You are responsible for what happens under your account,
            and for the staff you add to your shop.
          </li>
          <li>Use it for lawful trade only.</li>
        </ul>
      </Section>

      <Section heading="Your records are yours">
        <p>
          Everything you record belongs to you. You let DukaKonnect store and process it only so
          that the app can work for you. You can export it at any time and ask for it to be deleted.
          How it is handled is set out in the <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section heading="What it costs">
        <p>
          DukaKonnect is free while it is getting started. If paid plans are introduced, you will be
          told before anything changes, shops already using it keep the price they joined on,
          recording a sale will always be free, and nobody is ever locked out of their own records.
        </p>
      </Section>

      <Section heading="Figures are a guide">
        <p>
          The totals, profit and tax figures in the app are worked out from what you record. They
          are only as accurate as what goes in. Tax figures are a guide, not advice: the thresholds
          change with each Finance Act, so check with KRA or an accountant before you file.
        </p>
      </Section>

      <Section heading="Keeping it running">
        <p>
          We work to keep DukaKonnect available and your records safe, but we cannot promise it will
          never be interrupted. Export your records from time to time and keep your own copy.
        </p>
        <p>
          To the extent Kenyan law allows, DukaKonnect is not liable for losses that come from
          relying on the app, from interruptions, or from information entered incorrectly.
        </p>
      </Section>

      <Section heading="Leaving, or being asked to leave">
        <p>
          You can stop using DukaKonnect whenever you like and ask for your shop to be deleted. An
          account used for fraud, unlawful trade or to attack the service may be suspended.
        </p>
      </Section>

      <Section heading="The rest">
        <p>
          These terms are governed by the laws of Kenya. If they change in a way that matters, the
          date at the top will change and shops will be told in the app. Questions go
          to <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </PublicPage>
  );
}
