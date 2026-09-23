import type { IncidentCategory } from "@/lib/safety";

export interface CrisisStep {
  title: string;
  detail: string;
}

const GENERIC: CrisisStep[] = [
  { title: "Get to a safe distance", detail: "Move away from the scene calmly. Put walls, vehicles or a crowd between you and the danger." },
  { title: "Call 112", detail: "Give your exact location, what is happening, and how many people are affected. Stay on the line." },
  { title: "Alert your circle", detail: "Send your live location to family and friends so they know where you are." },
  { title: "Record what you can safely", detail: "Note time, place, descriptions. Only take photos if it does not expose you." },
  { title: "Report it in the app", detail: "Filing a report warns everyone nearby within seconds." },
];

export const CRISIS_GUIDES: Partial<Record<IncidentCategory, CrisisStep[]>> = {
  robbery: [
    { title: "Do not resist", detail: "Property can be replaced. Keep hands visible and avoid sudden movements." },
    { title: "Comply, then withdraw", detail: "Hand over what is demanded and leave the area as soon as it is safe." },
    { title: "Call the police control room", detail: "Report immediately — response is far better in the first minutes." },
    { title: "Freeze your bank access", detail: "Call your bank to block cards and mobile transfers if your phone or cards were taken." },
    { title: "Report in the app", detail: "Mark the exact spot so others avoid that stretch tonight." },
  ],
  kidnapping: [
    { title: "Stay quiet and observant", detail: "Do not argue. Memorise voices, routes, sounds and timing." },
    { title: "Families: contact the police first", detail: "Call the police control room before responding to any ransom demand." },
    { title: "Do not broadcast details publicly", detail: "Public posts can raise ransom demands or endanger the victim." },
    { title: "Keep one calm contact person", detail: "One family member should handle all calls and keep a written log." },
    { title: "Share last known location", detail: "Any location, plate number or photo helps responders act fast." },
  ],
  assault: [
    { title: "Get to a public, lit place", detail: "Shops, filling stations and bus stops are safer than side streets." },
    { title: "Seek medical care", detail: "Go to the nearest hospital even for injuries that look minor." },
    { title: "Preserve evidence", detail: "Keep clothing and avoid washing before a medical report is taken." },
    { title: "File a police report", detail: "Ask for the report reference number and keep it." },
  ],
  accident: [
    { title: "Secure the scene", detail: "Switch on hazard lights, place a warning triangle, keep traffic away." },
    { title: "Call FRSC on 122 or 112", detail: "State the road, direction and whether anyone is trapped." },
    { title: "Do not move the seriously injured", detail: "Unless there is fire or fuel leaking, wait for trained responders." },
    { title: "Control bleeding", detail: "Press firmly on wounds with a clean cloth until help arrives." },
  ],
  fire: [
    { title: "Get everyone out first", detail: "Leave belongings. Stay low under smoke and feel doors before opening." },
    { title: "Call the fire service", detail: "Give the street, landmark and whether people are still inside." },
    { title: "Cut power and gas if safe", detail: "Only if you can reach the switch without passing the fire." },
    { title: "Meet at one agreed point", detail: "Count everyone so no one goes back inside to search." },
  ],
  protest: [
    { title: "Leave the area early", detail: "Crowds turn dangerous quickly. Move against the flow toward side streets." },
    { title: "Avoid checkpoints and barricades", detail: "Do not film security operations at close range." },
    { title: "Keep your phone charged and quiet", detail: "Silence notifications and keep location sharing on for your circle." },
    { title: "Stay home if you can", detail: "Wait for verified all-clear updates before travelling." },
  ],
  theft: [
    { title: "Do not chase", detail: "Pursuit in unfamiliar streets is how many robberies escalate." },
    { title: "Block accounts and SIM", detail: "Call your bank and network provider immediately." },
    { title: "Report at the nearest station", detail: "You need a police report for bank and insurance claims." },
  ],
  fraud: [
    { title: "Stop all payments now", detail: "Do not send more money, even if threatened or promised a refund." },
    { title: "Call your bank's fraud line", detail: "Ask for a recall of the transfer and a freeze on the receiving account." },
    { title: "Save all evidence", detail: "Screenshots, account numbers, phone numbers and chat history." },
    { title: "Report to the police / EFCC", detail: "Fraud reports with transaction proof are far more likely to progress." },
  ],
  harassment: [
    { title: "Move to a crowded place", detail: "Stay where there are witnesses and cameras." },
    { title: "Tell someone now", detail: "Call a trusted contact and keep the line open while you move." },
    { title: "Document everything", detail: "Times, words used, names and any recordings you can take safely." },
    { title: "Report it formally", detail: "File with the police and, where relevant, your workplace or school." },
  ],
};

export function guideFor(category?: IncidentCategory | null): CrisisStep[] {
  if (!category) return GENERIC;
  return CRISIS_GUIDES[category] ?? GENERIC;
}

export const UNIVERSAL_RULES = [
  "Your life matters more than any property.",
  "112 works on every Nigerian network, even with no airtime.",
  "Share your live location before you travel, not after trouble starts.",
  "Verified reports from the community are the fastest warning you will get.",
];
