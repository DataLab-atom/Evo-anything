import {
  Shield,
  CreditCard,
  Users,
  Zap,
  Palette,
  Mail,
  BarChart3,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Authentication",
    description:
      "Google, GitHub, and email authentication powered by NextAuth.js. Secure sessions with JWT tokens.",
  },
  {
    icon: CreditCard,
    title: "Stripe Payments",
    description:
      "Subscription billing, checkout sessions, customer portal, and webhook handling fully configured.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Invite team members, assign roles (Owner, Admin, Member), and manage permissions effortlessly.",
  },
  {
    icon: Zap,
    title: "Blazing Fast",
    description:
      "Built on Next.js 14 App Router with React Server Components for optimal performance.",
  },
  {
    icon: Palette,
    title: "Beautiful UI",
    description:
      "Polished components built on shadcn/ui and Tailwind CSS with dark mode support.",
  },
  {
    icon: Mail,
    title: "Transactional Emails",
    description:
      "Welcome emails, subscription confirmations, and more with Resend integration.",
  },
  {
    icon: BarChart3,
    title: "Dashboard",
    description:
      "Responsive dashboard layout with sidebar navigation, settings, billing, and team pages.",
  },
  {
    icon: Globe,
    title: "SEO Optimized",
    description:
      "Meta tags, Open Graph images, sitemap generation, and structured data out of the box.",
  },
];

export function Features() {
  return (
    <section id="features" className="container space-y-12 py-8 md:py-12 lg:py-24">
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">
          Everything you need to launch
        </h2>
        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          Stop rebuilding the same features for every project. Start with a
          production-ready foundation and focus on your unique value proposition.
        </p>
      </div>

      <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-4">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="relative overflow-hidden rounded-lg border bg-card p-6 transition-colors hover:bg-accent/50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <feature.icon className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
