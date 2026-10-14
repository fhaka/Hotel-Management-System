import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";

export type HotelConfig = {
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  currency: string;
  vatRate: number;
  cityTaxPerPersonNight: number;
  checkInTime: string;
  checkOutTime: string;
  freeCancellationHours: number;
};

export const getSettings = cache(async (): Promise<HotelConfig> => {
  const s = await db.hotelSettings.findUnique({ where: { id: 1 } });
  if (!s) throw new Error("Hotel settings missing — run `npm run db:seed`.");
  return {
    name: s.name,
    legalName: s.legalName,
    taxId: s.taxId,
    email: s.email,
    phone: s.phone,
    address: s.address,
    city: s.city,
    country: s.country,
    currency: s.currency,
    vatRate: toNumber(s.vatRate),
    cityTaxPerPersonNight: toNumber(s.cityTaxPerPersonNight),
    checkInTime: s.checkInTime,
    checkOutTime: s.checkOutTime,
    freeCancellationHours: s.freeCancellationHours,
  };
});
