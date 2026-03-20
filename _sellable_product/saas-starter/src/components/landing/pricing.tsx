"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    description: "For individuals getting started",
    price: { monthly: 0, yearly: 0 },
    features: [
      "Up to 3 projects",
      "Basic analytics",
      "Community support",
      "1 team member",
    ],
    cta: "Get Started",
    href: "/login",
    popular: false,
  },
  {
    name: "Pro",
    description: "For professionals and small teams",
    price: { monthly: 19, yearly: 190 },
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Priority email support",
      "Up to 5 team members",
      "Custom integrations",
      "API access",
    ],
    cta: "Start Free Trial",
    href: "/login",
    popular: true,
  },
  {
    name: "Business",
    description: "For growing businesses",
    price: { monthly: 49, yearly: 490 },
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "SSO authentication",
      "Advanced security",
      "Dedicated support",
      "Custom contracts",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    href: "/login",
    popular: false,
  },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="container space-y-12 py-8 md:py-12 lg:py-24">
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">
          Simple, transparent pricing
        </h2>
        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          Choose the plan that fits your needs. Upgrade or downgrade at any
          time.
        </p>

        <div className="flex items-center gap-3 pt-4">
          <span
            className={cn(
              "text-sm font-medium",
              !annual && "text-foreground",
              annual && "text-muted-foreground"
            )}
          >
            Monthly
          </span>
          <Switch checked={annual} onCheckedChange={setAnnual} />
          <span
            className={cn(
              "text-sm font-medium",
              annual && "text-foreground",
              !annual && "text-muted-foreground"
            )}
          >
            Annual
          </span>
          {annual && (
            <Badge variant="secondary" className="ml-1">
              Save 17%
            </Badge>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "relative flex flex-col rounded-xl border bg-card p-8",
              plan.popular && "border-primary shadow-lg scale-105"
            )}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
            )}

            <div className="mb-6">
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.description}
              </p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">
                ${annual ? plan.price.yearly : plan.price.monthly}
              </span>
              {plan.price.monthly > 0 && (
                <span className="text-muted-foreground">
                  /{annual ? "year" : "month"}
                </span>
              )}
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant={plan.popular ? "default" : "outline"}
              className="w-full"
              asChild
            >
              <Link href={plan.href}>{plan.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
