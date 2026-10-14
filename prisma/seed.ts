/**
 * Demo data for Hotel Imperial.
 *
 * Demo accounts (all share DEMO_PASSWORD from src/lib/demo.ts — change before any real use):
 *   admin@hotelimperial.al        Administrator
 *   manager@hotelimperial.al      Manager
 *   reception@hotelimperial.al    Receptionist
 *   housekeeping@hotelimperial.al Housekeeping
 *   guest@example.com             Guest (website account)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type BookingSource,
  type PaymentMethod,
  type ReservationStatus,
  type RoomStatus,
  type ServiceCategory,
} from "../src/generated/prisma/client";
import { addDays, eachNight, nightsBetween, parseISODate, toISODate, todayISO } from "../src/lib/dates";
import { round2 } from "../src/lib/format";
import { extraQuantity, nightlyRate, type SeasonLike } from "../src/lib/pricing";
import { DEMO_PASSWORD } from "../src/lib/demo";


const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// Deterministic PRNG so every seed produces the same hotel.
let state = 20261014;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
const chance = (p: number) => rand() < p;
const id = () => crypto.randomUUID();
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const usedCodes = new Set<string>();
function code() {
  let c: string;
  do c = "HI" + Array.from({ length: 6 }, () => pick(CODE_ALPHABET.split(""))).join("");
  while (usedCodes.has(c));
  usedCodes.add(c);
  return c;
}

const img = (photo: string) => `https://images.unsplash.com/photo-${photo}?auto=format&fit=crop&w=1600&q=80`;

const VAT = 20;
const CITY_TAX = 1;

async function reset() {
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.emailLog.deleteMany(),
    db.review.deleteMany(),
    db.invoice.deleteMany(),
    db.payment.deleteMany(),
    db.folioCharge.deleteMany(),
    db.reservation.deleteMany(),
    db.housekeepingTask.deleteMany(),
    db.seasonalRate.deleteMany(),
    db.room.deleteMany(),
    db.roomType.deleteMany(),
    db.service.deleteMany(),
    db.guest.deleteMany(),
    db.user.deleteMany(),
    db.contactMessage.deleteMany(),
    db.hotelSettings.deleteMany(),
  ]);
}

async function main() {
  console.log("Resetting database…");
  await reset();

  await db.hotelSettings.create({
    data: {
      id: 1,
      name: "Hotel Imperial",
      legalName: "Hotel Imperial sh.p.k.",
      taxId: "L91234567A",
      email: "reservations@hotelimperial.al",
      phone: "+355 4 222 7000",
      address: "Rruga e Durrësit 112",
      city: "Tirana",
      country: "Albania",
      currency: "EUR",
      vatRate: VAT,
      cityTaxPerPersonNight: CITY_TAX,
      checkInTime: "14:00",
      checkOutTime: "11:00",
      freeCancellationHours: 48,
    },
  });

  // ─── Staff & demo users ────────────────────────────────────────────────────
  console.log("Creating users…");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const staffSeed = [
    { email: "admin@hotelimperial.al", name: "Elira Hoxha", role: "ADMIN", phone: "+355 69 200 1001" },
    { email: "manager@hotelimperial.al", name: "Arben Kola", role: "MANAGER", phone: "+355 69 200 1002" },
    { email: "reception@hotelimperial.al", name: "Sara Leka", role: "RECEPTIONIST", phone: "+355 69 200 1003" },
    { email: "dritan.reception@hotelimperial.al", name: "Dritan Meta", role: "RECEPTIONIST", phone: "+355 69 200 1004" },
    { email: "housekeeping@hotelimperial.al", name: "Mira Gjoka", role: "HOUSEKEEPING", phone: "+355 69 200 1005" },
    { email: "blerta.hk@hotelimperial.al", name: "Blerta Shehu", role: "HOUSEKEEPING", phone: "+355 69 200 1006" },
    { email: "ilir.hk@hotelimperial.al", name: "Ilir Dervishi", role: "HOUSEKEEPING", phone: "+355 69 200 1007" },
  ] as const;
  const staff = await Promise.all(staffSeed.map((s) => db.user.create({ data: { ...s, passwordHash } })));
  const [admin, , reception, reception2] = staff;
  const frontDesk = [reception!, reception2!];
  const housekeepers = staff.filter((s) => s.role === "HOUSEKEEPING");

  // ─── Room types & rooms ────────────────────────────────────────────────────
  console.log("Creating rooms…");
  const typeSeed = [
    {
      slug: "standard",
      name: "Classic Room",
      tagline: "Quiet comfort in the heart of Tirana",
      description:
        "Our Classic Rooms pair calm, contemporary design with everything you need for a restful stay. Floor-to-ceiling windows, a plush queen bed with premium linen and a walk-in rain shower make it the ideal base for business or a city break.",
      baseRate: 120,
      weekendRate: 135,
      maxAdults: 2,
      maxChildren: 1,
      sizeSqm: 26,
      bedType: "Queen bed",
      view: "City view",
      amenities: ["Free high-speed Wi-Fi", "Air conditioning", "55\" smart TV", "Rain shower", "Nespresso machine", "In-room safe", "Work desk", "Minibar"],
      images: [img("1631049307264-da0ec9d70304"), img("1505693416388-ac5ce068fe85"), img("1584622650111-993a426fbf0a")],
      sortOrder: 1,
      count: 24,
    },
    {
      slug: "deluxe",
      name: "Deluxe Room",
      tagline: "Extra space, skyline views",
      description:
        "Set on the upper floors, the Deluxe Room offers generous space, a king-size bed and sweeping views over the city towards Mount Dajti. A deep soaking tub, lounge chair and curated minibar invite you to slow down.",
      baseRate: 165,
      weekendRate: 185,
      maxAdults: 2,
      maxChildren: 2,
      sizeSqm: 34,
      bedType: "King bed",
      view: "Skyline view",
      amenities: ["Free high-speed Wi-Fi", "Air conditioning", "65\" smart TV", "Soaking bathtub", "Nespresso machine", "Bathrobes & slippers", "Lounge chair", "Curated minibar"],
      images: [img("1591088398332-8a7791972843"), img("1618773928121-c32242e63f39"), img("1507652313519-d4e9174996dd")],
      sortOrder: 2,
      count: 20,
    },
    {
      slug: "junior-suite",
      name: "Junior Suite",
      tagline: "A separate lounge to unwind",
      description:
        "The Junior Suite adds a separate sitting area with a sofa bed — perfect for families or longer stays. Enjoy a king-size bed, a marble bathroom with bathtub and walk-in shower, and complimentary access to the Imperial Spa.",
      baseRate: 240,
      weekendRate: 265,
      maxAdults: 3,
      maxChildren: 2,
      sizeSqm: 48,
      bedType: "King bed + sofa bed",
      view: "Mountain view",
      amenities: ["Free high-speed Wi-Fi", "Separate living area", "Two smart TVs", "Marble bathroom", "Bathtub & walk-in shower", "Spa access included", "Nespresso machine", "Evening turndown"],
      images: [img("1578683010236-d716f9a3f461"), img("1590490360182-c33d57733427"), img("1587985064135-0366536eab42")],
      sortOrder: 3,
      count: 12,
    },
    {
      slug: "imperial-suite",
      name: "Imperial Suite",
      tagline: "Our signature residence",
      description:
        "Occupying the top floor, the Imperial Suite is our most distinguished residence: a grand living and dining room, a private terrace with panoramic views, a dressing room and a spa-inspired bathroom. Butler service and club-lounge access are included.",
      baseRate: 480,
      weekendRate: 540,
      maxAdults: 4,
      maxChildren: 2,
      sizeSqm: 92,
      bedType: "Emperor king bed",
      view: "Panoramic terrace",
      amenities: ["Private terrace", "Butler service", "Club lounge access", "Dining room for six", "Dressing room", "Steam shower & bathtub", "Bang & Olufsen sound", "Airport transfer included"],
      images: [img("1621293954908-907159247fc8"), img("1611892440504-42a792e24d32"), img("1596394516093-501ba68a0ba6")],
      sortOrder: 4,
      count: 4,
    },
  ];

  const roomTypes = [];
  for (const { count, ...t } of typeSeed) roomTypes.push({ ...(await db.roomType.create({ data: t })), count });

  // 12 rooms per floor across 5 floors: Classic on 1–2, Deluxe on 3 and part of 4, Junior Suites on 4–5, Imperial on 5.
  const layout: { floor: number; slug: string; n: number }[] = [
    { floor: 1, slug: "standard", n: 12 },
    { floor: 2, slug: "standard", n: 12 },
    { floor: 3, slug: "deluxe", n: 12 },
    { floor: 4, slug: "deluxe", n: 8 },
    { floor: 4, slug: "junior-suite", n: 4 },
    { floor: 5, slug: "junior-suite", n: 8 },
    { floor: 5, slug: "imperial-suite", n: 4 },
  ];
  const roomData: { id: string; number: string; floor: number; roomTypeId: string }[] = [];
  const floorCounter = new Map<number, number>();
  for (const block of layout) {
    const type = roomTypes.find((t) => t.slug === block.slug)!;
    for (let i = 0; i < block.n; i++) {
      const n = (floorCounter.get(block.floor) ?? 0) + 1;
      floorCounter.set(block.floor, n);
      roomData.push({ id: id(), number: `${block.floor}${String(n).padStart(2, "0")}`, floor: block.floor, roomTypeId: type.id });
    }
  }
  await db.room.createMany({ data: roomData });

  // ─── Seasons ───────────────────────────────────────────────────────────────
  const year = Number(todayISO().slice(0, 4));
  const seasonsData = [
    { name: "Summer high season", startDate: parseISODate(`${year}-06-15`), endDate: parseISODate(`${year}-09-16`), multiplier: 1.3 },
    { name: "Festive season", startDate: parseISODate(`${year}-12-20`), endDate: parseISODate(`${year + 1}-01-04`), multiplier: 1.25 },
    { name: "Summer high season", startDate: parseISODate(`${year + 1}-06-15`), endDate: parseISODate(`${year + 1}-09-16`), multiplier: 1.3 },
    { name: "Winter low season", startDate: parseISODate(`${year + 1}-01-07`), endDate: parseISODate(`${year + 1}-03-01`), multiplier: 0.85 },
  ];
  await db.seasonalRate.createMany({ data: seasonsData });
  const seasons: SeasonLike[] = seasonsData.map((s) => ({ ...s, roomTypeId: null }));

  // ─── Services ──────────────────────────────────────────────────────────────
  console.log("Creating services…");
  const serviceSeed: {
    name: string;
    category: ServiceCategory;
    price: number;
    unit: string;
    description: string;
    bookable?: boolean;
    perNight?: boolean;
    perGuest?: boolean;
  }[] = [
    { name: "Breakfast buffet", category: "DINING", price: 18, unit: "guest / night", description: "Daily breakfast buffet at Saffron with fresh pastries, local cheeses and made-to-order eggs.", bookable: true, perNight: true, perGuest: true },
    { name: "Airport transfer", category: "TRANSPORT", price: 35, unit: "trip", description: "Private chauffeured transfer from Tirana International Airport.", bookable: true },
    { name: "Spa day pass", category: "SPA", price: 25, unit: "guest", description: "Full-day access to the pool, sauna, steam room and relaxation lounge.", bookable: true, perGuest: true },
    { name: "Secure parking", category: "OTHER", price: 12, unit: "night", description: "Underground valet parking.", bookable: true, perNight: true },
    { name: "Romance package", category: "OTHER", price: 65, unit: "package", description: "Champagne, rose petals and handmade chocolates waiting in your room.", bookable: true },
    { name: "Late check-out (until 15:00)", category: "OTHER", price: 40, unit: "stay", description: "Keep your room until 15:00 on departure day.", bookable: true },
    { name: "Dinner at Saffron", category: "DINING", price: 45, unit: "cover", description: "Three-course dinner menu." },
    { name: "Room service order", category: "ROOM_SERVICE", price: 28, unit: "order", description: "24-hour in-room dining." },
    { name: "Imperial Lounge bar", category: "DINING", price: 16, unit: "item", description: "Cocktails and drinks at the lobby bar." },
    { name: "Minibar", category: "MINIBAR", price: 9, unit: "item", description: "In-room minibar consumption." },
    { name: "Signature massage (60 min)", category: "SPA", price: 75, unit: "treatment", description: "Full-body aromatherapy massage." },
    { name: "Facial treatment", category: "SPA", price: 60, unit: "treatment", description: "Hydrating facial with organic products." },
    { name: "Laundry & pressing", category: "LAUNDRY", price: 14, unit: "bag", description: "Same-day laundry service." },
    { name: "City tour with guide", category: "TRANSPORT", price: 55, unit: "guest", description: "Half-day guided tour of Tirana." },
  ];
  const services = [];
  for (const s of serviceSeed) services.push(await db.service.create({ data: s }));
  const breakfast = services.find((s) => s.name === "Breakfast buffet")!;
  const bookableExtras = services.filter((s) => s.bookable && s.id !== breakfast.id);
  const inStayServices = services.filter((s) => !s.bookable);

  // ─── Guests ────────────────────────────────────────────────────────────────
  console.log("Creating guests…");
  const people: { country: string; first: string[]; last: string[]; phone: string }[] = [
    { country: "Albania", first: ["Arta", "Besnik", "Klea", "Erion", "Jonida", "Gentian", "Ledia", "Fatos", "Anisa", "Kristi"], last: ["Hoxha", "Krasniqi", "Berisha", "Shehu", "Leka", "Dervishi", "Kola", "Basha"], phone: "+355 69" },
    { country: "Italy", first: ["Giulia", "Marco", "Francesca", "Luca", "Chiara", "Matteo", "Sofia", "Alessandro"], last: ["Rossi", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco"], phone: "+39 333" },
    { country: "Germany", first: ["Anna", "Lukas", "Lena", "Felix", "Hannah", "Jonas", "Laura", "Maximilian"], last: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker"], phone: "+49 151" },
    { country: "United Kingdom", first: ["Oliver", "Emily", "Harry", "Charlotte", "George", "Amelia", "James", "Isla"], last: ["Smith", "Jones", "Taylor", "Brown", "Wilson", "Evans", "Thomas"], phone: "+44 7700" },
    { country: "United States", first: ["Michael", "Jessica", "David", "Ashley", "Daniel", "Sarah", "Ryan", "Megan"], last: ["Johnson", "Williams", "Miller", "Davis", "Garcia", "Anderson", "Clark"], phone: "+1 212" },
    { country: "France", first: ["Camille", "Louis", "Manon", "Hugo", "Léa", "Jules", "Chloé"], last: ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Lefèvre"], phone: "+33 6" },
    { country: "Greece", first: ["Eleni", "Nikos", "Maria", "Giorgos", "Katerina", "Dimitris"], last: ["Papadopoulos", "Georgiou", "Nikolaou", "Ioannou", "Vlachos"], phone: "+30 694" },
    { country: "Kosovo", first: ["Driton", "Vjosa", "Agon", "Blerina", "Arben", "Teuta"], last: ["Gashi", "Morina", "Hasani", "Rexhepi", "Kastrati"], phone: "+383 44" },
    { country: "Netherlands", first: ["Daan", "Emma", "Sem", "Julia", "Bram", "Tess"], last: ["de Jong", "Jansen", "de Vries", "van Dijk", "Bakker"], phone: "+31 6" },
    { country: "Spain", first: ["Lucía", "Pablo", "Martina", "Javier", "Elena", "Diego"], last: ["García", "Fernández", "López", "Martínez", "Sánchez"], phone: "+34 612" },
    { country: "Switzerland", first: ["Noah", "Mia", "Leon", "Elin", "Luca"], last: ["Meier", "Keller", "Huber", "Steiner", "Brunner"], phone: "+41 79" },
    { country: "Turkey", first: ["Elif", "Mehmet", "Zeynep", "Emre", "Ayşe"], last: ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik"], phone: "+90 532" },
  ];
  const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const guestRows: { id: string; firstName: string; lastName: string; email: string; phone: string; country: string; vip: boolean; userId?: string; notes?: string; city?: string }[] = [];
  const emails = new Set<string>();
  while (guestRows.length < 124) {
    const group = rand() < 0.25 ? people[0]! : pick(people);
    const firstName = pick(group.first);
    const lastName = pick(group.last);
    let email = `${slug(firstName)}.${slug(lastName)}@${pick(["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "proton.me"])}`;
    if (emails.has(email)) email = email.replace("@", `${int(2, 99)}@`);
    if (emails.has(email)) continue;
    emails.add(email);
    guestRows.push({
      id: id(),
      firstName,
      lastName,
      email,
      phone: `${group.phone} ${int(100, 999)} ${int(1000, 9999)}`,
      country: group.country,
      vip: chance(0.08),
      notes: chance(0.12) ? pick(["Prefers a high floor.", "Allergic to feathers — hypoallergenic pillows.", "Frequent business traveller.", "Celebrating anniversary on previous visit.", "Requests quiet room away from elevator."]) : undefined,
    });
  }

  // The demo website guest has an account linked to a guest profile.
  const demoGuestUser = await db.user.create({
    data: { email: "guest@example.com", name: "Alex Morgan", role: "GUEST", passwordHash, phone: "+44 7700 900123" },
  });
  const demoGuest = { id: id(), firstName: "Alex", lastName: "Morgan", email: "guest@example.com", phone: "+44 7700 900123", country: "United Kingdom", city: "London", vip: true, userId: demoGuestUser.id };
  guestRows.unshift(demoGuest);
  await db.guest.createMany({ data: guestRows });

  // ─── Reservations ──────────────────────────────────────────────────────────
  console.log("Generating reservation history…");
  const today = parseISODate(todayISO());
  const historyStart = addDays(today, -150);
  const horizon = addDays(today, 75);

  type SeedReservation = { id: string; guestId: string; roomId: string; status: ReservationStatus; checkIn: Date; checkOut: Date } & Record<string, unknown>;
  const reservations: SeedReservation[] = [];
  const charges: object[] = [];
  const payments: object[] = [];
  const invoices: object[] = [];
  const roomStatus = new Map<string, RoomStatus>();
  const outOfOrder = new Set([roomData[17]!.id, roomData[41]!.id]);
  let invoiceSeq = 0;
  const checkoutsForInvoice: { reservationId: string; date: Date; billTo: string; total: number; vat: number }[] = [];
  const sources: BookingSource[] = ["WEBSITE", "WEBSITE", "WEBSITE", "WEBSITE", "OTA", "OTA", "OTA", "PHONE", "EMAIL", "WALK_IN", "CORPORATE"];
  const specialRequests = ["Late arrival around 23:00.", "Extra pillows, please.", "Celebrating a birthday.", "Twin beds if possible.", "Baby cot required.", "Quiet room, high floor.", "Vegetarian breakfast."];

  type Booking = { roomId: string; roomTypeId: string; checkIn: Date; checkOut: Date; status: ReservationStatus; cancelled?: boolean };
  const bookings: Booking[] = [];

  for (const room of roomData) {
    const type = roomTypes.find((t) => t.id === room.roomTypeId)!;
    // Suites are booked less densely than standard rooms.
    const gapMax = type.slug === "imperial-suite" ? 6 : type.slug === "junior-suite" ? 4 : 3;
    let cursor = addDays(historyStart, int(0, 4));
    let stillInHouse = false;
    while (cursor < horizon) {
      const futureFactor = cursor > today ? Math.min(1, (cursor.getTime() - today.getTime()) / (75 * 86_400_000)) : 0;
      cursor = addDays(cursor, int(0, gapMax) + Math.round(futureFactor * int(0, 5)));
      const nights = pick([1, 1, 2, 2, 2, 3, 3, 4, 5, 7]);
      const checkIn = cursor;
      const checkOut = addDays(checkIn, nights);
      if (checkIn >= horizon) break;
      if (outOfOrder.has(room.id) && checkOut > addDays(today, -2) && checkIn < addDays(today, 6)) {
        cursor = addDays(today, 6);
        continue;
      }
      let status: ReservationStatus;
      const departsToday = checkOut.getTime() === today.getTime();
      if (checkOut < today) status = chance(0.03) ? "NO_SHOW" : "CHECKED_OUT";
      else if (departsToday) status = chance(0.55) ? "CHECKED_IN" : "CHECKED_OUT";
      else if (checkIn < today) status = "CHECKED_IN";
      else if (checkIn.getTime() === today.getTime()) status = !stillInHouse && chance(0.4) ? "CHECKED_IN" : "CONFIRMED";
      else status = "CONFIRMED";
      stillInHouse = departsToday && status === "CHECKED_IN";
      bookings.push({ roomId: room.id, roomTypeId: room.roomTypeId, checkIn, checkOut, status });
      cursor = checkOut;
      // A sprinkling of cancellations that never occupied the room.
      if (chance(0.06)) {
        const cIn = addDays(checkIn, int(-20, 30));
        bookings.push({ roomId: room.id, roomTypeId: room.roomTypeId, checkIn: cIn, checkOut: addDays(cIn, int(1, 4)), status: "CANCELLED", cancelled: true });
      }
    }
  }
  bookings.sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());

  let guestIndex = 0;
  for (const b of bookings) {
    const type = roomTypes.find((t) => t.id === b.roomTypeId)!;
    const nights = nightsBetween(b.checkIn, b.checkOut);
    // Bias a handful of returning guests; the demo guest has a past, current-ish and future stay.
    const guest = guestRows[(guestIndex++ * 7 + int(0, 3)) % guestRows.length]!;
    const adults = Math.min(type.maxAdults, pick([1, 2, 2, 2, 2, 3]));
    const children = type.maxChildren > 0 && chance(0.18) ? int(1, Math.min(2, type.maxChildren)) : 0;
    const source = pick(sources);
    const resId = id();
    const createdAt = addDays(b.checkIn, -int(3, 60));
    const bookedBy = source === "WEBSITE" || source === "OTA" ? null : pick(frontDesk).id;

    let chargeTotal = 0;
    let vatTotal = 0;
    const addCharge = (c: { type: string; description: string; date: Date; quantity: number; unitPrice: number; vatRate: number; serviceId?: string; voided?: boolean }) => {
      const amount = round2(c.unitPrice * c.quantity);
      charges.push({ id: id(), reservationId: resId, ...c, amount, voided: c.voided ?? false, postedById: c.type === "SERVICE" && c.serviceId && !bookableExtras.some((s) => s.id === c.serviceId) ? pick(frontDesk).id : null, createdAt });
      if (!c.voided) {
        chargeTotal += amount;
        vatTotal += amount - amount / (1 + c.vatRate / 100);
      }
    };

    const voidAll = b.status === "CANCELLED";
    for (const night of eachNight(b.checkIn, b.checkOut)) {
      const price = nightlyRate(type, night, seasons);
      addCharge({ type: "ROOM", description: `${type.name} — ${price.label}`, date: night, quantity: 1, unitPrice: price.rate, vatRate: VAT, voided: voidAll || (b.status === "NO_SHOW" && night.getTime() !== b.checkIn.getTime()) });
    }
    addCharge({ type: "CITY_TAX", description: `City tax (${adults} × ${nights} nights)`, date: b.checkIn, quantity: adults * nights, unitPrice: CITY_TAX, vatRate: 0, voided: voidAll || b.status === "NO_SHOW" });
    if (chance(0.55)) {
      const qty = extraQuantity(breakfast, nights, adults + children);
      addCharge({ type: "SERVICE", description: breakfast.name, date: b.checkIn, quantity: qty, unitPrice: Number(breakfast.price), vatRate: VAT, serviceId: breakfast.id, voided: voidAll || b.status === "NO_SHOW" });
    }
    if (chance(0.2)) {
      const extra = pick(bookableExtras);
      const qty = extraQuantity(extra, nights, adults + children);
      addCharge({ type: "SERVICE", description: extra.name, date: b.checkIn, quantity: qty, unitPrice: Number(extra.price), vatRate: VAT, serviceId: extra.id, voided: voidAll || b.status === "NO_SHOW" });
    }
    // In-stay incidentals for guests who have stayed (or are staying).
    if (b.status === "CHECKED_OUT" || b.status === "CHECKED_IN") {
      const lastDay = b.status === "CHECKED_IN" ? today : addDays(b.checkOut, -1);
      for (let i = 0, n = int(0, 3); i < n; i++) {
        const svc = pick(inStayServices);
        const span = Math.max(0, nightsBetween(b.checkIn, lastDay));
        addCharge({ type: "SERVICE", description: svc.name, date: addDays(b.checkIn, int(0, span)), quantity: svc.category === "MINIBAR" || svc.name.includes("bar") ? int(1, 4) : 1, unitPrice: Number(svc.price), vatRate: VAT, serviceId: svc.id });
      }
    }
    chargeTotal = round2(chargeTotal);

    // Payments
    const pay = (amount: number, method: PaymentMethod, at: Date, kind: "CHARGE" | "REFUND" = "CHARGE") => {
      if (amount <= 0) return;
      const card = method === "CARD";
      payments.push({
        id: id(),
        reservationId: resId,
        kind,
        amount: round2(amount),
        method,
        status: "SUCCEEDED",
        provider: card ? "demo" : "manual",
        providerRef: card ? `demo_${kind === "CHARGE" ? "ch" : "re"}_${code().slice(2)}${code().slice(2)}` : null,
        cardBrand: card ? pick(["Visa", "Visa", "Mastercard", "Amex"]) : null,
        cardLast4: card ? String(int(1000, 9999)) : null,
        processedById: source === "WEBSITE" && kind === "CHARGE" && at <= b.checkIn ? null : pick(frontDesk).id,
        createdAt: at,
      });
    };
    const prepaid = (source === "WEBSITE" || source === "OTA") && chance(0.6);
    if (b.status === "CHECKED_OUT") {
      if (prepaid) {
        const roomPart = round2(chargeTotal * 0.8);
        pay(roomPart, "CARD", createdAt);
        pay(chargeTotal - roomPart, pick(["CARD", "CASH"] as const), b.checkOut);
      } else pay(chargeTotal, pick(["CARD", "CARD", "CASH", "BANK_TRANSFER"] as const), b.checkOut);
      checkoutsForInvoice.push({ reservationId: resId, date: b.checkOut, billTo: `${guest.firstName} ${guest.lastName}`, total: chargeTotal, vat: round2(vatTotal) });
    } else if (b.status === "NO_SHOW") {
      pay(chargeTotal, "CARD", addDays(b.checkIn, 1));
    } else if (b.status === "CHECKED_IN") {
      pay(prepaid ? round2(chargeTotal * 0.75) : round2(Math.min(chargeTotal, type.baseRate.toNumber())), "CARD", prepaid ? createdAt : b.checkIn);
    } else if (b.status === "CONFIRMED" && prepaid) {
      pay(chargeTotal, "CARD", createdAt);
    } else if (b.status === "CANCELLED" && prepaid) {
      pay(chargeTotal, "CARD", createdAt);
      pay(chargeTotal, "CARD", addDays(createdAt, 2), "REFUND");
    }

    reservations.push({
      id: resId,
      code: code(),
      guestId: guest.id,
      roomTypeId: b.roomTypeId,
      roomId: b.roomId,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      adults,
      children,
      status: b.status,
      source,
      specialRequests: chance(0.2) ? pick(specialRequests) : null,
      estimatedArrival: chance(0.4) ? pick(["13:00", "15:00", "16:30", "18:00", "21:00"]) : null,
      createdById: bookedBy,
      createdAt,
      checkedInAt: b.status === "CHECKED_IN" || b.status === "CHECKED_OUT" ? new Date(b.checkIn.getTime() + int(13, 20) * 3_600_000) : null,
      checkedOutAt: b.status === "CHECKED_OUT" ? new Date(b.checkOut.getTime() + int(8, 11) * 3_600_000) : null,
      cancelledAt: b.status === "CANCELLED" ? addDays(createdAt, 2) : null,
      cancellationReason: b.status === "CANCELLED" ? pick(["Change of travel plans", "Flight cancelled", "Booked elsewhere", "Personal reasons"]) : null,
    });

    if (b.status === "CHECKED_IN") roomStatus.set(b.roomId, chance(0.5) ? "DIRTY" : "CLEAN");
  }

  // Give the demo guest a confirmed upcoming stay in a Deluxe room.
  const demoRes = reservations.find((r) => r.status === "CONFIRMED" && r.checkIn > addDays(today, 10));
  if (demoRes) demoRes.guestId = demoGuest.id;
  const demoPast = reservations.find((r) => r.status === "CHECKED_OUT");
  if (demoPast) demoPast.guestId = demoGuest.id;

  checkoutsForInvoice.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const c of checkoutsForInvoice) {
    invoiceSeq++;
    invoices.push({
      id: id(),
      number: `INV-${c.date.getUTCFullYear()}-${String(invoiceSeq).padStart(5, "0")}`,
      reservationId: c.reservationId,
      status: "PAID",
      netTotal: round2(c.total - c.vat),
      vatTotal: c.vat,
      total: c.total,
      billTo: c.billTo,
      issuedAt: new Date(c.date.getTime() + 10 * 3_600_000),
    });
  }

  const chunk = <T,>(items: T[], size = 1000) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));
  for (const part of chunk(reservations)) await db.reservation.createMany({ data: part as never });
  for (const part of chunk(charges)) await db.folioCharge.createMany({ data: part as never });
  for (const part of chunk(payments)) await db.payment.createMany({ data: part as never });
  for (const part of chunk(invoices)) await db.invoice.createMany({ data: part as never });

  // ─── Room status & housekeeping ────────────────────────────────────────────
  console.log("Preparing housekeeping…");
  const departuresToday = reservations.filter(
    (r) => r.checkOut.getTime() === today.getTime() && r.status === "CHECKED_IN",
  );
  const yesterdayCheckouts = reservations.filter(
    (r) => r.checkOut.getTime() === today.getTime() && r.status === "CHECKED_OUT",
  );
  for (const r of yesterdayCheckouts) roomStatus.set(r.roomId, "DIRTY");
  for (const roomId of outOfOrder) roomStatus.set(roomId, "OUT_OF_ORDER");
  for (const room of roomData) if (!roomStatus.has(room.id)) roomStatus.set(room.id, chance(0.25) ? "INSPECTED" : "CLEAN");
  const reasons = ["Bathroom leak — plumber scheduled", "Air conditioning unit replacement"];
  let reasonIndex = 0;
  for (const [roomId, status] of roomStatus) {
    await db.room.update({
      where: { id: roomId },
      data: { status, outOfOrderReason: status === "OUT_OF_ORDER" ? reasons[reasonIndex++ % reasons.length] : null },
    });
  }

  const tasks: object[] = [];
  const roomNumber = (roomId: string) => roomData.find((r) => r.id === roomId)!.number;
  for (const r of departuresToday) tasks.push({ roomId: r.roomId, type: "CHECKOUT_CLEAN", priority: "HIGH", dueDate: today, notes: "Departure today — prepare for arrival." });
  for (const [roomId, status] of roomStatus) {
    if (status === "DIRTY" && !departuresToday.some((d) => d.roomId === roomId)) {
      tasks.push({ roomId, type: "STAYOVER", priority: "NORMAL", dueDate: today, status: chance(0.3) ? "IN_PROGRESS" : "PENDING" });
    }
  }
  for (const roomId of outOfOrder) tasks.push({ roomId, type: "MAINTENANCE", priority: "HIGH", dueDate: today, notes: roomStatus.get(roomId) === "OUT_OF_ORDER" ? "Room out of order — see notes." : null });
  // Some completed tasks from earlier today.
  for (let i = 0; i < 6; i++) {
    const room = pick(roomData);
    tasks.push({ roomId: room.id, type: pick(["CHECKOUT_CLEAN", "INSPECTION", "STAYOVER"] as const), status: "DONE", dueDate: today, completedAt: new Date(), notes: `Completed for room ${room.number}` });
  }
  await db.housekeepingTask.createMany({
    data: tasks.map((t, i) => ({ ...(t as object), id: id(), assignedToId: housekeepers[i % housekeepers.length]!.id })) as never,
  });
  void roomNumber;

  // ─── Reviews, messages, audit ──────────────────────────────────────────────
  console.log("Adding reviews and messages…");
  await db.review.createMany({
    data: [
      { guestName: "Giulia R.", country: "Italy", rating: 5, title: "Elegance in the centre of Tirana", body: "Impeccable service from the moment we arrived. The Deluxe room had a stunning view of Mount Dajti and the breakfast was the best we had in the Balkans." },
      { guestName: "James T.", country: "United Kingdom", rating: 5, title: "A perfect business base", body: "Quiet rooms, fast Wi-Fi and a team that remembered my name on day two. The Imperial Lounge is a great spot for meetings." },
      { guestName: "Anna M.", country: "Germany", rating: 5, title: "Wonderful spa and staff", body: "The signature massage was outstanding. Every member of staff went out of their way to make our anniversary special." },
      { guestName: "Arta H.", country: "Albania", rating: 4, title: "Beautiful rooms, great location", body: "Walking distance to Skanderbeg Square and the Blloku district. Rooms are spotless and very comfortable." },
      { guestName: "Michael J.", country: "United States", rating: 5, title: "The Imperial Suite is unforgettable", body: "The terrace views at sunset were spectacular and the butler service was faultless. We will be back." },
      { guestName: "Camille D.", country: "France", rating: 5, title: "Cuisine raffinée", body: "Dinner at Saffron was a highlight of our trip — local flavours with real finesse." },
    ],
  });
  await db.contactMessage.createMany({
    data: [
      { name: "Lukas Weber", email: "lukas.weber@outlook.com", phone: "+49 151 555 0192", subject: "Group booking for a conference", message: "We are planning a conference in March for 25 attendees. Could you share group rates for 3 nights and information about your meeting rooms?" },
      { name: "Eleni Georgiou", email: "eleni.g@gmail.com", subject: "Airport transfer at night", message: "Our flight lands at 01:30. Is the airport transfer available at that hour?" },
      { name: "Daniel Clark", email: "dclark@icloud.com", subject: "Wedding anniversary surprise", message: "I'd like to arrange flowers and champagne in the room for our arrival next month. What options do you have?", handled: true },
      { name: "Klea Basha", email: "klea.basha@yahoo.com", subject: "Spa opening hours", message: "Is the spa open to non-resident guests on Sundays?" },
    ],
  });
  await db.auditLog.createMany({
    data: [
      { userId: admin!.id, action: "settings.update", entity: "HotelSettings", entityId: "1", summary: "Updated cancellation policy to 48 hours", createdAt: addDays(new Date(), -12) },
      { userId: admin!.id, action: "user.create", entity: "User", entityId: reception2!.id, summary: "Created staff account for Dritan Meta", createdAt: addDays(new Date(), -30) },
    ],
  });

  console.log(
    `Done: ${roomData.length} rooms, ${guestRows.length} guests, ${reservations.length} reservations, ${charges.length} charges, ${payments.length} payments, ${invoices.length} invoices, ${tasks.length} housekeeping tasks.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
