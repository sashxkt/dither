export const NAV = [
  { href: "#home", n: "00", label: "Home", hint: "Start" },
  { href: "#about", n: "01", label: "About", hint: "Ethos" },
  { href: "#work", n: "02", label: "Work", hint: "Shipped" },
  { href: "#skills", n: "03", label: "Skills", hint: "Craft" },
  { href: "#contact", n: "04", label: "Contact", hint: "Reach" },
] as const;

export const ACCENTS = [
  { value: "#FA4C14", label: "Orange" },
  { value: "#EC39B6", label: "Pink" },
  { value: "#5014FA", label: "Blue" },
  { value: "#F2F2F2", label: "Grey" },
] as const;

// Field records from vinkura.in/case-studies. Figures are the ones
// stated on those pages. Keep them in step with the source.
export const VINKURA_CASES = [
  {
    name: "DDMS",
    where: "Kanwar Yatra",
    figure: "4,000+ personnel",
    note: "Live duty-point supervision across 230 sub-sectors.",
    href: "https://www.vinkura.in/case-studies/ddms",
  },
  {
    name: "Trinetra",
    where: "Amarnath Yatra",
    figure: "4.8 lakh+ pilgrims",
    note: "Offline-capable field-to-command coordination on two mountain axes.",
    href: "https://www.vinkura.in/case-studies/trinetra",
  },
  {
    name: "Hawk-Eye / ARGUS",
    where: "Bareilly zone",
    figure: "4,700+ cameras",
    note: "Visual detection feeding a nine-district zonal control room.",
    href: "https://www.vinkura.in/case-studies/hawk-eye",
  },
  {
    name: "Pehchan",
    where: "Amarnath Yatra",
    figure: "12,545 verified",
    note: "QR-based verification of service providers at access points.",
    href: "https://www.vinkura.in/case-studies/pehchan",
  },
  {
    name: "e-Maalkhana",
    where: "Mirganj, Bareilly",
    figure: "District first",
    note: "Digital evidence custody in place of manual property records.",
    href: "https://www.vinkura.in/case-studies/maalkhana",
  },
  {
    name: "Sentinel",
    where: "Command centre",
    figure: "One picture",
    note: "Duty, visual, identity and field reports on a single operating view.",
    href: "https://www.vinkura.in/case-studies/sentinel",
  },
] as const;

export const SKILLS = [
  { name: "Interface & motion", note: "Design systems, type, WebGL and canvas work. Pages people remember." },
  { name: "Agentic AI", note: "Agents wired into real workflows: intake, triage, records, follow-up." },
  { name: "Product engineering", note: "TypeScript, React and Next.js, from a blank repo to production." },
  { name: "Automation", note: "The repeat work in your week, taken off your staff and made reliable." },
  { name: "Deployment & support", note: "Standing it up on the hardware you own, then keeping it running." },
  { name: "Offline-first systems", note: "Built for dropped lines, shared desks and thin IT budgets." },
] as const;
