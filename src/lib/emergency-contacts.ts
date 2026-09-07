export interface ContactEntry {
  name: string;
  phones: string[];
  type: "police" | "emergency" | "hospital" | "fire" | "other";
  note?: string;
}

export interface CityContacts {
  city: string;
  state: string;
  lat: number;
  lon: number;
  contacts: ContactEntry[];
}

/** Nationwide numbers that work from any state. */
export const NATIONAL_CONTACTS: ContactEntry[] = [
  { name: "National Emergency Number (all emergencies)", phones: ["112"], type: "emergency" },
  { name: "Nigeria Police Force — Control Room", phones: ["0803 123 0430", "0805 700 0001"], type: "police" },
  { name: "NEMA (National Emergency Management Agency)", phones: ["0800 2255 6362", "0803 123 0430"], type: "emergency", note: "Disaster and mass-casualty response" },
  { name: "Federal Road Safety Corps (FRSC)", phones: ["122"], type: "emergency", note: "Road crashes and highway help" },
  { name: "NDLEA (drug-related crime)", phones: ["0800 1020 3040"], type: "other" },
  { name: "DSS / SSS", phones: ["0909 900 0001"], type: "other" },
];

export const CITY_CONTACTS: CityContacts[] = [
  {
    city: "Lagos",
    state: "Lagos",
    lat: 6.5244,
    lon: 3.3792,
    contacts: [
      { name: "Lagos State Emergency (LASEMA)", phones: ["767", "112"], type: "emergency" },
      { name: "Lagos State Police Command", phones: ["0803 123 0430", "0806 713 5000"], type: "police" },
      { name: "Rapid Response Squad (RRS) Lagos", phones: ["0807 060 0000", "0803 127 0000"], type: "police" },
      { name: "Lagos State Fire Service", phones: ["0805 565 6798", "01 793 3665"], type: "fire" },
      { name: "Lagos University Teaching Hospital (LUTH), Idi-Araba", phones: ["0803 305 6666"], type: "hospital" },
      { name: "Lagos State University Teaching Hospital (LASUTH), Ikeja", phones: ["0908 780 4000"], type: "hospital" },
      { name: "Lagos Ambulance Service (LASAMBUS)", phones: ["767", "112"], type: "emergency" },
    ],
  },
  {
    city: "Abuja",
    state: "FCT",
    lat: 9.0765,
    lon: 7.3986,
    contacts: [
      { name: "FCT Emergency (FEMA)", phones: ["112", "0803 928 1868"], type: "emergency" },
      { name: "FCT Police Command", phones: ["0803 269 9153", "0805 720 1968"], type: "police" },
      { name: "FCT Fire Service", phones: ["0803 232 3777", "112"], type: "fire" },
      { name: "National Hospital Abuja", phones: ["0704 400 0000", "09 461 4000"], type: "hospital" },
      { name: "University of Abuja Teaching Hospital, Gwagwalada", phones: ["0803 452 0000"], type: "hospital" },
    ],
  },
  {
    city: "Port Harcourt",
    state: "Rivers",
    lat: 4.8156,
    lon: 7.0498,
    contacts: [
      { name: "Rivers State Police Command", phones: ["0806 570 2559", "0705 611 6663"], type: "police" },
      { name: "Rivers State Emergency Management Agency", phones: ["112", "0803 314 0000"], type: "emergency" },
      { name: "University of Port Harcourt Teaching Hospital", phones: ["084 817 344", "0803 336 0000"], type: "hospital" },
      { name: "Braithwaite Memorial Specialist Hospital", phones: ["0803 336 8888"], type: "hospital" },
    ],
  },
  {
    city: "Kano",
    state: "Kano",
    lat: 12.0022,
    lon: 8.592,
    contacts: [
      { name: "Kano State Police Command", phones: ["0803 456 7890", "112"], type: "police" },
      { name: "Kano State Fire Service", phones: ["064 632 095", "112"], type: "fire" },
      { name: "Aminu Kano Teaching Hospital", phones: ["064 666 025", "0803 700 0000"], type: "hospital" },
      { name: "Murtala Muhammad Specialist Hospital", phones: ["064 631 234"], type: "hospital" },
    ],
  },
  {
    city: "Ibadan",
    state: "Oyo",
    lat: 7.3775,
    lon: 3.947,
    contacts: [
      { name: "Oyo State Police Command", phones: ["0803 570 7776", "112"], type: "police" },
      { name: "Oyo State Emergency (OYSEMA)", phones: ["0800 000 0112", "112"], type: "emergency" },
      { name: "University College Hospital (UCH), Ibadan", phones: ["02 241 0088", "0803 324 0000"], type: "hospital" },
    ],
  },
  {
    city: "Kaduna",
    state: "Kaduna",
    lat: 10.5222,
    lon: 7.4383,
    contacts: [
      { name: "Kaduna State Police Command", phones: ["0808 870 0008", "112"], type: "police" },
      { name: "Kaduna State Emergency (KADSEMA)", phones: ["0800 200 0700", "112"], type: "emergency" },
      { name: "Ahmadu Bello University Teaching Hospital, Zaria", phones: ["069 550 000"], type: "hospital" },
      { name: "Barau Dikko Teaching Hospital, Kaduna", phones: ["062 240 000"], type: "hospital" },
    ],
  },
  {
    city: "Enugu",
    state: "Enugu",
    lat: 6.4584,
    lon: 7.5464,
    contacts: [
      { name: "Enugu State Police Command", phones: ["0803 542 3907", "112"], type: "police" },
      { name: "University of Nigeria Teaching Hospital, Ituku-Ozalla", phones: ["042 254 025"], type: "hospital" },
      { name: "Enugu State Fire Service", phones: ["042 250 000", "112"], type: "fire" },
    ],
  },
  {
    city: "Benin City",
    state: "Edo",
    lat: 6.335,
    lon: 5.6037,
    contacts: [
      { name: "Edo State Police Command", phones: ["0806 807 4001", "112"], type: "police" },
      { name: "University of Benin Teaching Hospital (UBTH)", phones: ["052 602 118"], type: "hospital" },
      { name: "Edo State Fire Service", phones: ["052 250 000", "112"], type: "fire" },
    ],
  },
  {
    city: "Maiduguri",
    state: "Borno",
    lat: 11.8311,
    lon: 13.151,
    contacts: [
      { name: "Borno State Police Command", phones: ["0803 385 6970", "112"], type: "police" },
      { name: "Borno State Emergency Management Agency", phones: ["0803 601 0000", "112"], type: "emergency" },
      { name: "University of Maiduguri Teaching Hospital", phones: ["076 231 400"], type: "hospital" },
    ],
  },
  {
    city: "Jos",
    state: "Plateau",
    lat: 9.8965,
    lon: 8.8583,
    contacts: [
      { name: "Plateau State Police Command", phones: ["0803 670 0715", "112"], type: "police" },
      { name: "Jos University Teaching Hospital (JUTH)", phones: ["073 462 942"], type: "hospital" },
      { name: "Plateau State Emergency Agency", phones: ["0803 452 0000", "112"], type: "emergency" },
    ],
  },
  {
    city: "Abeokuta",
    state: "Ogun",
    lat: 7.1475,
    lon: 3.3619,
    contacts: [
      { name: "Ogun State Police Command", phones: ["0803 566 7060", "112"], type: "police" },
      { name: "Federal Medical Centre, Abeokuta", phones: ["039 241 000"], type: "hospital" },
      { name: "Ogun State Fire Service", phones: ["039 240 000", "112"], type: "fire" },
    ],
  },
  {
    city: "Uyo",
    state: "Akwa Ibom",
    lat: 5.0377,
    lon: 7.9128,
    contacts: [
      { name: "Akwa Ibom State Police Command", phones: ["0803 507 0000", "112"], type: "police" },
      { name: "University of Uyo Teaching Hospital", phones: ["085 200 000"], type: "hospital" },
    ],
  },
];

export function nearestCity(lat: number, lon: number): CityContacts {
  let best = CITY_CONTACTS[0];
  let bestD = Infinity;
  for (const c of CITY_CONTACTS) {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
