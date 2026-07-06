export interface DemoScenario {
  id: string;
  seed: string;
  generatedAt: string;
  job: {
    title: string;
    baseTitle: string;
    reqId: string;
    location: string;
    department: string;
    hiringManager: string;
    descriptionHtml: string;
    descriptionText: string;
  };
  screening: {
    title: string;
    question: string;
  };
  candidate: {
    fullName: string;
    email: string;
    phone: string;
    country: string;
    streetAddress: string;
    parishState: string;
    educationLevel: string;
    linkedinUrl: string;
    resumeFileName: string;
  };
}

interface RoleProfile {
  baseTitle: string;
  department: string;
  location: string;
  locationCode: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  workModel: string;
  screeningQuestion: string;
  candidateHeadline: string;
  skills: string[];
}

const ROLE_PROFILES: RoleProfile[] = [
  {
    baseTitle: "Financial Operations Analyst",
    department: "Finance",
    location: "Kingston",
    locationCode: "KGN",
    summary:
      "Support month-end reporting, payment controls, and operating dashboards for a growing regional services business.",
    responsibilities: [
      "Prepare weekly cash movement, receivables, and expense variance summaries for leadership review.",
      "Partner with operations managers to explain margin shifts and identify process improvements.",
      "Maintain clean audit trails for vendor payments, reconciliations, and internal approvals.",
    ],
    requirements: [
      "Two or more years in finance operations, accounting support, or business analysis.",
      "Strong Excel or Google Sheets skills with comfort building simple reporting models.",
      "Clear written communication and a careful approach to confidential financial data.",
    ],
    workModel: "Hybrid schedule based in Kingston with two office days each week.",
    screeningQuestion:
      "Walk us through a time you used financial or operational data to recommend a business decision. What did you analyze and what changed as a result?",
    candidateHeadline: "Finance analyst with regional reporting and reconciliation experience.",
    skills: ["Financial reporting", "Variance analysis", "Excel modeling", "Vendor reconciliations"],
  },
  {
    baseTitle: "Talent Acquisition Specialist",
    department: "People Operations",
    location: "Montego Bay",
    locationCode: "MBJ",
    summary:
      "Own full-cycle hiring for customer-facing and corporate roles while creating a thoughtful candidate experience.",
    responsibilities: [
      "Build role scorecards with hiring managers and manage structured interview pipelines.",
      "Source qualified candidates across LinkedIn, local networks, referrals, and job boards.",
      "Track funnel quality, interview feedback, and time-to-fill trends for weekly updates.",
    ],
    requirements: [
      "Three or more years of recruiting, HR coordination, or high-volume selection experience.",
      "Comfort running interviews and giving hiring teams clear, evidence-based recommendations.",
      "Knowledge of Jamaican labor market norms and candidate communication best practices.",
    ],
    workModel: "Hybrid role supporting teams across western Jamaica and remote hiring panels.",
    screeningQuestion:
      "Describe how you would build a shortlist for a hard-to-fill role when the first applicant pool is weak.",
    candidateHeadline: "Recruiter focused on structured hiring and candidate communication.",
    skills: ["Full-cycle recruiting", "Interview coordination", "Candidate sourcing", "ATS reporting"],
  },
  {
    baseTitle: "Customer Experience Manager",
    department: "Customer Operations",
    location: "New Kingston",
    locationCode: "NKG",
    summary:
      "Lead a customer support team responsible for service quality, escalation handling, and client retention.",
    responsibilities: [
      "Coach team leads on response quality, service recovery, and customer follow-through.",
      "Review support metrics and turn recurring complaints into practical improvement plans.",
      "Coordinate with sales, billing, and operations teams on high-priority client issues.",
    ],
    requirements: [
      "Five or more years in customer operations, contact centre leadership, or account support.",
      "Experience using service metrics to improve team performance and customer satisfaction.",
      "Confident stakeholder management with calm, professional escalation handling.",
    ],
    workModel: "On-site leadership role with occasional remote administration days.",
    screeningQuestion:
      "Tell us about a customer escalation you personally handled. How did you stabilize the situation and prevent it from recurring?",
    candidateHeadline: "Customer operations leader with service recovery and team coaching experience.",
    skills: ["Team leadership", "Service recovery", "Customer analytics", "Escalation management"],
  },
  {
    baseTitle: "Procurement and Vendor Coordinator",
    department: "Operations",
    location: "Spanish Town",
    locationCode: "SPT",
    summary:
      "Coordinate vendor onboarding, purchase requests, and contract documentation for multi-site operations.",
    responsibilities: [
      "Maintain vendor records, quote comparisons, purchase orders, and approval documentation.",
      "Follow up with suppliers on delivery timelines, service issues, and invoice discrepancies.",
      "Support monthly spend reviews and identify savings opportunities with department heads.",
    ],
    requirements: [
      "Two or more years in procurement, vendor coordination, logistics, or administrative operations.",
      "Organized documentation habits and confidence following up with internal and external partners.",
      "Working knowledge of purchase orders, service agreements, and basic spend reporting.",
    ],
    workModel: "Primarily office-based with supplier visits as needed.",
    screeningQuestion:
      "Share an example of how you handled a supplier delay or invoice issue while keeping internal stakeholders informed.",
    candidateHeadline: "Procurement coordinator with supplier follow-up and purchase order experience.",
    skills: ["Vendor coordination", "Purchase orders", "Spend tracking", "Supplier communication"],
  },
  {
    baseTitle: "Compliance Analyst",
    department: "Risk and Compliance",
    location: "Kingston",
    locationCode: "KGN",
    summary:
      "Help monitor policies, controls, and evidence for a regulated business serving regional clients.",
    responsibilities: [
      "Review control evidence, exception logs, and policy attestations for completeness.",
      "Prepare concise compliance summaries for internal stakeholders and external auditors.",
      "Support privacy, vendor risk, and incident follow-up workflows with accurate documentation.",
    ],
    requirements: [
      "Experience in compliance, audit support, risk operations, legal administration, or quality assurance.",
      "Strong attention to detail and comfort handling confidential business information.",
      "Ability to translate policy requirements into practical checklists and follow-up actions.",
    ],
    workModel: "Hybrid role based in Kingston with scheduled audit preparation periods.",
    screeningQuestion:
      "Describe a time you found a process gap or documentation issue. How did you communicate it and make sure it was resolved?",
    candidateHeadline: "Compliance professional with audit evidence and policy tracking experience.",
    skills: ["Control testing", "Policy review", "Audit preparation", "Risk documentation"],
  },
];

const HIRING_MANAGERS = [
  "Marsha Bennett",
  "Rohan Ellis",
  "Samantha Reid",
  "Andre Thompson",
  "Nadia Campbell",
  "Gareth McKenzie",
];

const CANDIDATES = [
  {
    firstName: "Alicia",
    lastName: "Morgan",
    phone: "+1 876 555 0147",
    streetAddress: "24 Harbor View Terrace",
    parishState: "Kingston",
    educationLevel: "Bachelor's Degree",
  },
  {
    firstName: "Dwayne",
    lastName: "Clarke",
    phone: "+1 876 555 0184",
    streetAddress: "8 Coral Gardens Avenue",
    parishState: "St. James",
    educationLevel: "Post Graduate Degree",
  },
  {
    firstName: "Natalie",
    lastName: "Forbes",
    phone: "+1 876 555 0129",
    streetAddress: "16 Hopefield Close",
    parishState: "St. Andrew",
    educationLevel: "Master's Degree",
  },
  {
    firstName: "Kemani",
    lastName: "Richards",
    phone: "+1 876 555 0162",
    streetAddress: "5 Cedar Grove Lane",
    parishState: "St. Catherine",
    educationLevel: "Associate's Degree",
  },
  {
    firstName: "Briana",
    lastName: "Williams",
    phone: "+1 876 555 0198",
    streetAddress: "11 Palm Ridge Drive",
    parishState: "St. Ann",
    educationLevel: "Bachelor's Degree",
  },
];

const DEFAULT_EMAIL_DOMAIN = "example.com";
const DEFAULT_EMAIL_PREFIX = "candidate";

function hashSeed(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scenarioSeed(seed?: string) {
  return seed || process.env.E2E_DEMO_SEED || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function scenarioDate(seed: string) {
  const match = seed.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0].replace(/-/g, "");
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export function buildDemoScenario(seed?: string): DemoScenario {
  const resolvedSeed = scenarioSeed(seed);
  const random = mulberry32(hashSeed(resolvedSeed));
  const role = pick(ROLE_PROFILES, random);
  const candidate = pick(CANDIDATES, random);
  const manager = pick(HIRING_MANAGERS, random);
  const suffix = Math.floor(random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
  const reqId = `${role.locationCode}-${scenarioDate(resolvedSeed)}-${suffix}`;
  const id = reqId.replace(/-/g, "");
  const emailDomain = process.env.E2E_DEMO_EMAIL_DOMAIN || DEFAULT_EMAIL_DOMAIN;
  const emailPrefix = process.env.E2E_DEMO_EMAIL_PREFIX || DEFAULT_EMAIL_PREFIX;
  const fullName = `${candidate.firstName} ${candidate.lastName}`;
  const linkedinSlug = `${slug(candidate.firstName)}-${slug(candidate.lastName)}-${id.toLowerCase()}`;

  const title = `${role.baseTitle} - ${role.location} (Req ${reqId})`;
  const descriptionHtml = [
    `<h2>Role overview</h2>`,
    `<p>${escapeHtml(role.summary)}</p>`,
    `<h2>What you will do</h2>`,
    `<ul>${role.responsibilities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`,
    `<h2>What we are looking for</h2>`,
    `<ul>${role.requirements.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`,
    `<h2>Work model</h2>`,
    `<p>${escapeHtml(role.workModel)}</p>`,
  ].join("");
  const descriptionText = [
    "Role overview",
    role.summary,
    "",
    "What you will do",
    ...role.responsibilities.map((item) => `- ${item}`),
    "",
    "What we are looking for",
    ...role.requirements.map((item) => `- ${item}`),
    "",
    "Work model",
    role.workModel,
  ].join("\n");

  return {
    id,
    seed: resolvedSeed,
    generatedAt: new Date().toISOString(),
    job: {
      title,
      baseTitle: role.baseTitle,
      reqId,
      location: role.location,
      department: role.department,
      hiringManager: manager,
      descriptionHtml,
      descriptionText,
    },
    screening: {
      title,
      question: role.screeningQuestion,
    },
    candidate: {
      fullName,
      email: `${emailPrefix}+${id.toLowerCase()}@${emailDomain}`,
      phone: candidate.phone,
      country: "Jamaica",
      streetAddress: candidate.streetAddress,
      parishState: candidate.parishState,
      educationLevel: candidate.educationLevel,
      linkedinUrl: `https://www.linkedin.com/in/${linkedinSlug}`,
      resumeFileName: `${candidate.firstName}-${candidate.lastName}-Resume-${id}.pdf`,
    },
  };
}

export function scenarioFromHandoff(handoff: Record<string, unknown>): DemoScenario | null {
  const scenario = handoff.scenario;
  if (!scenario || typeof scenario !== "object") return null;
  const maybe = scenario as Partial<DemoScenario>;
  if (!maybe.id || !maybe.job?.title || !maybe.candidate?.email) return null;
  return maybe as DemoScenario;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(value: string, max = 88) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function createResumePdf(scenario: DemoScenario) {
  const lines = [
    scenario.candidate.fullName,
    `${scenario.candidate.email} | ${scenario.candidate.phone}`,
    `${scenario.candidate.streetAddress}, ${scenario.candidate.parishState}, ${scenario.candidate.country}`,
    scenario.candidate.linkedinUrl,
    "",
    "Profile",
    `Synthetic demo candidate for ${scenario.job.baseTitle}. ${ROLE_PROFILES.find((role) => role.baseTitle === scenario.job.baseTitle)?.candidateHeadline ?? "Experienced professional with relevant corporate operations experience."}`,
    "",
    "Selected Skills",
    ...(ROLE_PROFILES.find((role) => role.baseTitle === scenario.job.baseTitle)?.skills ?? ["Stakeholder communication", "Reporting", "Process improvement"]).map((skill) => `- ${skill}`),
    "",
    "Recent Experience",
    `Regional Services Group | ${scenario.job.department} Associate | 2022 - Present`,
    `- Supported cross-functional teams on reporting, documentation, and client-ready operating updates tied to ${scenario.job.department.toLowerCase()}.`,
    "- Built weekly trackers, followed up on outstanding actions, and prepared concise summaries for managers.",
    "",
    "Education",
    `${scenario.candidate.educationLevel}, Caribbean Business Institute`,
    "",
    `Generated for demo requisition ${scenario.job.reqId}. This resume is synthetic and contains no real personal data.`,
  ].flatMap((line) => wrapLine(line));

  let y = 760;
  const textCommands = lines.map((line, index) => {
    if (line === "") {
      y -= 12;
      return "";
    }
    const fontSize = index === 0 ? 18 : 10;
    const command = `BT /F1 ${fontSize} Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`;
    y -= index === 0 ? 22 : 14;
    return command;
  }).filter(Boolean).join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(textCommands, "utf8")} >>\nstream\n${textCommands}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}
