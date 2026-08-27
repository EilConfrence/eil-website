#!/usr/bin/env node
/**
 * Reads seo/site.json and writes JSON-LD into index.html between
 * SEO_SCHEMA_START / SEO_SCHEMA_END. Leave googleSiteVerification empty
 * until you have a Search Console token; then set it and re-run this script.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(readFileSync(join(root, 'seo/site.json'), 'utf8'));
const org = site.organization;
const event = site.event;
const orgId = `${site.siteUrl}/#organization`;
const eventId = `${site.siteUrl}/#event`;

const graph = [
  {
    '@type': 'Organization',
    '@id': orgId,
    name: org.name,
    alternateName: org.alternateName,
    url: org.url,
    description: org.description,
    email: org.email,
    telephone: org.telephone,
    logo: { '@type': 'ImageObject', url: site.logo },
    image: site.ogImage,
    address: { '@type': 'PostalAddress', ...org.address },
    sameAs: org.sameAs,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: org.telephone,
      email: org.email,
      contactType: 'customer support',
      availableLanguage: 'en',
    },
  },
  {
    '@type': 'Event',
    '@id': eventId,
    name: event.name,
    url: event.url,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    image: site.ogImage,
    organizer: { '@id': orgId },
    location: {
      '@type': 'Place',
      name: event.locationName,
      address: { '@type': 'PostalAddress', ...event.locationAddress },
    },
    offers: event.offers.map((offer) => ({
      '@type': 'Offer',
      name: offer.name,
      url: offer.url,
      price: offer.price,
      priceCurrency: offer.priceCurrency,
      availability: 'https://schema.org/InStock',
    })),
  },
];

const ld = {
  '@context': 'https://schema.org',
  '@graph': graph,
};

const json = JSON.stringify(ld, null, 2);
const block = `<!-- SEO_SCHEMA_START: edit seo/site.json, then run npm run sync-schema -->
<script type="application/ld+json">
${json}
</script>
<!-- SEO_SCHEMA_END -->`;

const indexPath = join(root, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const start = html.indexOf('<!-- SEO_SCHEMA_START');
const end = html.indexOf('<!-- SEO_SCHEMA_END -->');
if (start === -1 || end === -1) {
  console.error('index.html is missing SEO_SCHEMA markers');
  process.exit(1);
}
const endClose = end + '<!-- SEO_SCHEMA_END -->'.length;
html = html.slice(0, start) + block + html.slice(endClose);

const token = (site.googleSiteVerification || '').trim();
const gscLine = token
  ? `<meta name="google-site-verification" content="${token}">`
  : '<!-- Google Search Console: paste the HTML-tag meta here after you get a token.\n     Search Console → this property → Settings → Ownership verification → HTML tag.\n     Example: <meta name="google-site-verification" content="TOKEN"> -->';

html = html.replace(
  /<!-- GSC_VERIFICATION_START -->[\s\S]*?<!-- GSC_VERIFICATION_END -->/,
  `<!-- GSC_VERIFICATION_START -->\n${gscLine}\n<!-- GSC_VERIFICATION_END -->`
);

writeFileSync(indexPath, html);
console.log('Updated JSON-LD in index.html from seo/site.json');
if (!token) console.log('GSC token is empty — placeholder comment left in place.');
