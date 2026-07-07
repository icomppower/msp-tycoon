// Flavor content: ticket titles, client/company names, personalities, tech
// names, event copy. English only (v0.1 decision).

export const TICKET_TYPES = [
  'password_reset',
  'printer',
  'email',
  'network',
  'server',
  'security_incident',
  'mystery',
];

export const TICKET_TITLES = {
  password_reset: [
    'locked out AGAIN (3rd time this week)',
    'password expired mid-presentation',
    'can’t log in — caps lock investigation requested',
    'new hire needs everything set up (starts in 20 minutes)',
    'forgot password, also forgot username',
    'MFA prompt "looks suspicious", denied it 14 times',
  ],
  printer: [
    'printer says PC LOAD LETTER',
    'printer prints one blank page then gives up',
    'printer offline (it is unplugged, they will not check)',
    'need color printing enabled for a 400-page deck',
    'printer making "a grinding noise, like it’s angry"',
    'scanned document came out "too scanned"',
  ],
  email: [
    'emails "not sending" (they are in Drafts)',
    'mailbox full, refuses to delete anything since 2014',
    'reply-all storm in progress, 300 unread',
    'signature is "the wrong shade of blue"',
    'important email missing (it’s in Junk, it’s always in Junk)',
    'calendar invite went to the whole company',
  ],
  network: [
    'internet slow (attached: speedtest screenshot from 2019)',
    'wifi drops "only during important calls"',
    'VPN won’t connect from a beach in Cancun',
    'someone plugged both ends of a cable into the switch',
    'the internet is down (one website is down)',
    'new smart fridge wants network access',
  ],
  server: [
    'server room "smells warm"',
    'shared drive missing (someone dragged it into a folder)',
    'app slow since "nothing changed" (something changed)',
    'backup job failing quietly for 6 weeks',
    'server rebooted itself "out of spite"',
    'RAID array degraded, second disk feeling ambitious',
  ],
  security_incident: [
    'CEO clicked the link',
    'accountant wired money to "the CEO" (it was not the CEO)',
    'ransomware note on the front desk PC',
    'USB drive from the parking lot plugged in "to see whose it was"',
    'password on a sticky note visible in the news interview',
    '"IT support" called them, they were very helpful',
  ],
  mystery: [
    'computer "feels haunted"',
    'everything is fine but it’s making a noise',
    'mouse cursor moving on its own (wireless mouse in a drawer)',
    'the thing from before is happening again',
    'monitor displays "in the wrong direction"',
    'PC won’t turn on (power strip switched off by cleaning crew)',
  ],
};

export const COMPANY_NAMES = [
  'Bayview Dental', 'Ling & Associates CPA', 'GoldenGate Realty', 'Pacific Dim Sum Group',
  'Summit Law Offices', 'Harborline Logistics', 'BrightPath Charter School', 'Wong Family Medicine',
  'Cascade Title Co', 'Ironclad Insurance', 'Lotus Garden Restaurants', 'Redwood Engineering',
  'FirstStreet Credit Union', 'Marina Physical Therapy', 'Sunset Property Mgmt', 'Peninsula Auto Group',
  'Evergreen Nonprofits Alliance', 'Bayside Architecture', 'Golden Dragon Trading', 'Hillcrest Vet Clinic',
  'MetroPoint Staffing', 'ClearWater Labs', 'Northgate Manufacturing', 'Vista Financial Planning',
  'Chinatown Community Center', 'Presidio Consulting', 'SilverLine Freight', 'Oakview Orthodontics',
];

export const TECH_NAMES = [
  'Sam', 'Priya', 'Marcus', 'Wing', 'Elena', 'Trevor', 'Kayla', 'Dmitri',
  'Jasmine', 'Carlos', 'Ah Keung', 'Becca', 'Norm', 'Fatima', 'Kyle', 'Mei',
];

// Personality archetypes. weight = relative spawn frequency.
// Hooks consumed across the engine:
//   mislabelUpMult   — multiplier on MISLABEL_UP
//   patienceDecayMult— multiplier on negative patience deltas
//   spawnMult(day,hour) — per-tick spawn multiplier
//   selfInflict      — chance a resolved ticket respawns worse ("fixed it myself")
//   ghostMult        — multiplier on ghost chance at prospect close
export const PERSONALITIES = {
  normal: {
    name: 'Regular Client', weight: 58,
    mislabelUpMult: 1, patienceDecayMult: 1, selfInflict: 0, ghostMult: 1,
  },
  escalator: {
    name: 'The Escalator', weight: 14, blurb: 'Everything is P1.',
    mislabelUpMult: 3.5, patienceDecayMult: 1.3, selfInflict: 0, ghostMult: 1,
  },
  ghost: {
    name: 'The Ghost', weight: 10, blurb: 'Never approves quotes.',
    mislabelUpMult: 1, patienceDecayMult: 0.9, selfInflict: 0, ghostMult: 2.5,
  },
  friday_special: {
    name: 'The Friday Special', weight: 9, blurb: 'Only breaks things at 4:55pm.',
    mislabelUpMult: 1.2, patienceDecayMult: 1, selfInflict: 0, ghostMult: 1,
    spawnMult: (day, hour) => (day === 4 && hour >= 14 && hour <= 17 ? 6 : 0.5),
  },
  diyer: {
    name: 'The DIYer', weight: 8, blurb: 'Fixes things themselves. Makes it worse.',
    mislabelUpMult: 0.8, patienceDecayMult: 1, selfInflict: 0.2, ghostMult: 1,
  },
  dream: {
    name: 'The Dream Client', weight: 1, blurb: 'Pays on time. Files clean tickets.',
    mislabelUpMult: 0, patienceDecayMult: 0.5, selfInflict: 0, ghostMult: 0.3,
    spawnMult: () => 0.7,
  },
};

export const EVENT_COPY = {
  isp_outage: 'Regional ISP outage. Every client is filing a P1. Several are calling. One is faxing.',
  phishing_ceo: 'The CEO clicked the link. The link was not good.',
  printer_uprising: 'Printer firmware update overnight. The printers have achieved sentience. They are not benevolent.',
  vendor_price_hike: '"Valued partner" email: your tooling vendor is raising prices 10%, effective immediately, to serve you better.',
  referral: 'A happy client bragged about you at a chamber of commerce mixer. A warm lead walks in.',
  poach: 'Competitor MSP "Synergy IT Partners" is sniffing around your least-happy client with a steak dinner and a lower quote.',
};

export const GAME_OVER_COPY = {
  broke: 'Cash has been negative for two weeks. You quietly update LinkedIn to "Open to Work". Your old clients’ tickets are someone else’s problem now.',
  sold: 'You sold the MSP. The buyer immediately renames it "Synergy IT Partners". You do not care. You are on a beach. Your phone is off. It stays off.',
};
