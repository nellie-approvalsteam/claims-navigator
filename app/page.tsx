import DashboardCard from "@/components/DashboardCard";

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8 sm:mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-brass-600">
          Approval Department
        </p>
        <h1 className="mt-1 text-3xl font-bold text-ink sm:text-4xl">Claims Navigator</h1>
        <p className="mt-2 max-w-2xl text-ink/65">
          Tell it what&apos;s happening with a claim and get a clear read on your options and your
          next move — built to get you to a decision in under a minute.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          href="/navigator"
          eyebrow="Claim Navigator"
          title="What's happening with the claim?"
          description="Answer a few quick questions about the claim and get a read on the situation, your options, and a recommended next step."
          icon={<CompassIcon />}
        />
        <DashboardCard
          href="/stuck"
          eyebrow="Scenario Solver"
          title="I'm stuck. What can I do?"
          description="Describe the situation in your own words and get matched to the closest scenario, with a recommended move."
          icon={<LifeBuoyIcon />}
        />
        <DashboardCard
          href="/next-step"
          eyebrow="Next Step"
          title="I know the situation. Tell me what to do next."
          description="Skip straight to a recommended next step for a specific path — reinspection, appraisal, documentation, and more."
          icon={<ArrowRightIcon />}
        />
        <DashboardCard
          href="/playbooks"
          eyebrow="Playbooks"
          title="Show me the process."
          description="Standardized, step-by-step workflows for reinspection, appraisal, denial, underpayment, and more."
          icon={<BookIcon />}
        />
        <DashboardCard
          href="/knowledge-base"
          eyebrow="Quick References"
          title="Give me the information I need."
          description="Definitions, carrier notes, and reference facts — the things you look up, not the steps you follow."
          icon={<InfoIcon />}
        />
        <DashboardCard
          href="/search"
          eyebrow="Search"
          title="Search our approval knowledge base."
          description="One search box across scenarios, playbooks, templates, and reference articles."
          icon={<SearchIconLg />}
        />
      </div>
    </div>
  );
}

function iconProps() {
  return { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
}

function CompassIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.5 9.5-2 5-5 2 2-5z" />
    </svg>
  );
}
function LifeBuoyIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="m4.9 4.9 4.2 4.2M19.1 4.9l-4.2 4.2M4.9 19.1l4.2-4.2M19.1 19.1l-4.2-4.2" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 18.5z" />
      <path d="M8 3v16" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </svg>
  );
}
function SearchIconLg() {
  return (
    <svg {...iconProps()}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
