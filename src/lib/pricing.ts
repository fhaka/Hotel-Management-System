import { eachNight, isWeekendNight, nightsBetween } from "@/lib/dates";
import { round2, toNumber } from "@/lib/format";

type DecimalLike = Parameters<typeof toNumber>[0];

export type PricedRoomType = {
  id: string;
  baseRate: DecimalLike;
  weekendRate: DecimalLike | null;
};

export type SeasonLike = {
  name: string;
  startDate: Date;
  endDate: Date;
  multiplier: DecimalLike;
  roomTypeId: string | null;
};

export type ExtraService = {
  id: string;
  name: string;
  price: DecimalLike;
  perNight: boolean;
  perGuest: boolean;
};

export type NightPrice = { date: Date; rate: number; label: string };

export type ExtraLine = { serviceId: string; name: string; quantity: number; unitPrice: number; amount: number };

export type Quote = {
  nights: NightPrice[];
  nightCount: number;
  roomTotal: number;
  cityTax: number;
  extras: ExtraLine[];
  extrasTotal: number;
  total: number;
  vatIncluded: number;
};

/** Season multiplier for a night: a room-type specific season wins over a hotel-wide one. */
function seasonFor(date: Date, roomTypeId: string, seasons: SeasonLike[]) {
  const applicable = seasons.filter((s) => date >= s.startDate && date < s.endDate && (!s.roomTypeId || s.roomTypeId === roomTypeId));
  return applicable.find((s) => s.roomTypeId === roomTypeId) ?? applicable[0] ?? null;
}

export function nightlyRate(roomType: PricedRoomType, date: Date, seasons: SeasonLike[]): NightPrice {
  const weekend = isWeekendNight(date) && roomType.weekendRate != null;
  const base = toNumber(weekend ? roomType.weekendRate : roomType.baseRate);
  const season = seasonFor(date, roomType.id, seasons);
  const rate = round2(base * (season ? toNumber(season.multiplier) : 1));
  return { date, rate, label: season ? season.name : weekend ? "Weekend rate" : "Standard rate" };
}

export function extraQuantity(service: Pick<ExtraService, "perNight" | "perGuest">, nights: number, guests: number) {
  return (service.perNight ? nights : 1) * (service.perGuest ? guests : 1);
}

export function vatPortion(gross: number, vatRate: number) {
  return round2(gross - gross / (1 + vatRate / 100));
}

export function quoteStay(args: {
  roomType: PricedRoomType;
  seasons: SeasonLike[];
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  extras?: ExtraService[];
  cityTaxPerPersonNight: number;
  vatRate: number;
}): Quote {
  const nights = eachNight(args.checkIn, args.checkOut).map((d) => nightlyRate(args.roomType, d, args.seasons));
  const nightCount = nightsBetween(args.checkIn, args.checkOut);
  const roomTotal = round2(nights.reduce((sum, n) => sum + n.rate, 0));
  // City tax applies to adults only and is VAT-exempt.
  const cityTax = round2(args.cityTaxPerPersonNight * args.adults * nightCount);
  const guests = args.adults + args.children;
  const extras: ExtraLine[] = (args.extras ?? []).map((s) => {
    const quantity = extraQuantity(s, nightCount, guests);
    const unitPrice = toNumber(s.price);
    return { serviceId: s.id, name: s.name, quantity, unitPrice, amount: round2(unitPrice * quantity) };
  });
  const extrasTotal = round2(extras.reduce((sum, e) => sum + e.amount, 0));
  const total = round2(roomTotal + cityTax + extrasTotal);
  return {
    nights,
    nightCount,
    roomTotal,
    cityTax,
    extras,
    extrasTotal,
    total,
    vatIncluded: vatPortion(roomTotal + extrasTotal, args.vatRate),
  };
}
