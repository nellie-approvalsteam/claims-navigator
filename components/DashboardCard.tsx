import Link from "next/link";

export default function DashboardCard({
  href,
  eyebrow,
  title,
  description,
  icon,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="focus-ring group flex flex-col gap-3 rounded-2xl border border-teal-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-600 hover:shadow-md sm:p-6"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white">
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest text-brass-600">
          {eyebrow}
        </span>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-ink group-hover:text-teal-700">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink/65">{description}</p>
      </div>
    </Link>
  );
}
