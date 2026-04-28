import { MapPin, Calendar, Users, BedDouble, Plane, Car, Compass, type LucideIcon } from 'lucide-react';

export interface ProposalSummaryEntry {
  id: string;
  icon: LucideIcon;
  labelKey: string;
  subKey: string;
}

export interface ProposalItemEntry {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  metaKey: string;
  price: string;
  tagKey: string;
  stars?: number;
}

export const PROPOSAL_SUMMARY: ProposalSummaryEntry[] = [
  { id: 'destination', icon: MapPin, labelKey: 'mockup.proposal.summary.destination.label', subKey: 'mockup.proposal.summary.destination.sub' },
  { id: 'dates', icon: Calendar, labelKey: 'mockup.proposal.summary.dates.label', subKey: 'mockup.proposal.summary.dates.sub' },
  { id: 'pax', icon: Users, labelKey: 'mockup.proposal.summary.pax.label', subKey: 'mockup.proposal.summary.pax.sub' },
  { id: 'room', icon: BedDouble, labelKey: 'mockup.proposal.summary.room.label', subKey: 'mockup.proposal.summary.room.sub' },
];

export const PROPOSAL_ITEMS: ProposalItemEntry[] = [
  { id: 'flight', icon: Plane, titleKey: 'mockup.proposal.items.flight.title', metaKey: 'mockup.proposal.items.flight.meta', price: 'USD 742', tagKey: 'mockup.proposal.items.flight.tag' },
  { id: 'hotel', icon: BedDouble, titleKey: 'mockup.proposal.items.hotel.title', metaKey: 'mockup.proposal.items.hotel.meta', price: 'USD 2.180', tagKey: 'mockup.proposal.items.hotel.tag', stars: 5 },
  { id: 'transfer', icon: Car, titleKey: 'mockup.proposal.items.transfer.title', metaKey: 'mockup.proposal.items.transfer.meta', price: 'USD 95', tagKey: 'mockup.proposal.items.transfer.tag' },
  { id: 'tour', icon: Compass, titleKey: 'mockup.proposal.items.tour.title', metaKey: 'mockup.proposal.items.tour.meta', price: 'USD 320', tagKey: 'mockup.proposal.items.tour.tag' },
];

export const PROPOSAL_TOTAL = 'USD 3.337';
