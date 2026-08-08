// HMC Partner Network — the partnership types an organization can apply for.
//
// The four ids here are the ones the data model already uses
// (PartnerApplication.partnershipTypes and
// PartnerAgency.approvedPartnershipTypes in types.ts). Do not invent a fifth
// without adding it to those unions first, or an application will be written
// with a type nothing downstream can read.
//
// Important distinction, per the PRM model: an organization REQUESTS a
// partnership type at registration. Only an HMC admin APPROVES it. Nothing on
// this page or in self-registration grants an approved type.

export type PartnershipTypeId = 'referral' | 'event_vendor' | 'subcontractor' | 'general';

export interface PartnershipType {
  id: PartnershipTypeId;
  name: string;
  tagline: string;
  /** Who this fits, in the organization's own terms. */
  forWhom: string;
  description: string;
  /** What the organization gets from HMC. */
  youGet: string[];
  /** What HMC asks in return. These are commitments, not paperwork. */
  weAsk: string[];
  /** Readiness status recorded on the organization profile once approved. */
  readinessStatus: string;
}

export const PARTNERSHIP_TYPES: PartnershipType[] = [
  {
    id: 'referral',
    name: 'Referral Partner',
    tagline: 'Receive and close referrals',
    forWhom: 'Clinics, community health centers, behavioral health providers, food and housing programs, legal aid, and social service agencies.',
    description:
      'You receive referrals routed to your organization based on the service capabilities you declare, and you close every one of them with a known outcome. This is the partnership type that keeps a resident from falling into a gap between two organizations.',
    youGet: [
      'Referrals matched to the services you actually provide',
      'A referral inbox with status tracking and outcome logging',
      'A performance view showing volume, response time and completion rate',
      'Your organization listed in the HMC Resource Directory',
    ],
    weAsk: [
      'Respond to referrals within a reasonable window',
      'Move every referral to a final status, including Unable to Serve',
      'Keep your service capabilities and contact information current',
    ],
    readinessStatus: 'Active Referral Partner',
  },
  {
    id: 'event_vendor',
    name: 'Event Vendor or Co-host',
    tagline: 'Show up where the community already is',
    forWhom: 'Organizations that bring services, screenings, education, or resources to community events and want reach without building an audience.',
    description:
      'You publish events to the HMC Event Finder, which is embedded on the HMC website and searchable by residents across Los Angeles County, and you co-host or table at HMC outreach. One submission reaches residents through every community-facing surface at once.',
    youGet: [
      'Event listings published to the Event Finder and the Member Hub',
      'Real-time RSVP notifications before event day',
      'Access to the community board to request volunteers or co-hosts',
      'Co-hosting opportunities at HMC health fairs and pop-up clinics',
    ],
    weAsk: [
      'Keep event details accurate, including any that are still to be determined',
      'Staff what you commit to staffing',
      'Share attendance and outcome counts after the event',
    ],
    readinessStatus: 'Active Event Partner',
  },
  {
    id: 'subcontractor',
    name: 'Subcontractor',
    tagline: 'Deliver scoped work under agreement',
    forWhom: 'Organizations with the capacity, insurance, and staffing to deliver a defined scope of work under a contract or memorandum of understanding.',
    description:
      'You deliver a defined scope alongside HMC under an agreement, whether that is clinical staffing, outreach capacity, translation, evaluation, or program delivery. This type carries the most requirements because it carries the most responsibility.',
    youGet: [
      'Scoped opportunities routed to qualified subcontractors',
      'A named HMC contact and a written scope of work',
      'Shared reporting infrastructure so funder deliverables are not rebuilt',
    ],
    weAsk: [
      'Current insurance appropriate to the scope',
      'Documented capacity, staffing and service area',
      'Compliance with the reporting and documentation the funding requires',
    ],
    readinessStatus: 'Active Subcontract Partner',
  },
  {
    id: 'general',
    name: 'General Community Partner',
    tagline: 'Stay connected without a formal scope',
    forWhom: 'Faith-based and neighborhood organizations, mutual aid groups, schools, and any organization that wants to stay connected to the network.',
    description:
      'You join the network, see what is happening, and participate when it fits. No referral obligations and no contract. This is the low-commitment door, and it is a real one rather than a placeholder.',
    youGet: [
      'Access to the partner community board',
      'Visibility into HMC events and volunteer requests',
      'A path to add referral or event partnership later without reapplying',
    ],
    weAsk: [
      'Keep your organization profile current',
      'Tell us when your capacity or focus changes',
    ],
    readinessStatus: 'Community Partner',
  },
];

/** Baseline eligibility. Stated plainly so an organization can self-assess. */
export const ELIGIBILITY = [
  'You are an organization, program, coalition, or agency serving Los Angeles County residents.',
  'You provide health, wellness, behavioral health, or a social service that affects health, including food, housing, legal aid, employment, transportation, and childcare.',
  'You have a person who can maintain the account and respond to what comes through it.',
  'You serve residents regardless of insurance status, immigration status, or ability to pay, or you can clearly state who you can and cannot serve.',
];

export const NOT_A_FIT = [
  'You are an individual looking to volunteer. The volunteer application is the right door.',
  'You are a resident looking for services. Search the Resource Directory or find an event near you.',
  'You are selling a product or service to HMC. Email partner@healthmatters.clinic instead.',
];

export const typeById = (id: PartnershipTypeId) =>
  PARTNERSHIP_TYPES.find((t) => t.id === id);

export const isPartnershipTypeId = (v: unknown): v is PartnershipTypeId =>
  typeof v === 'string' && PARTNERSHIP_TYPES.some((t) => t.id === v);
