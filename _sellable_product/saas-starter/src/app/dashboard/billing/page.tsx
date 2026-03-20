"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";

const plans = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    description: "For individuals getting started",
    features: ["Up to 3 projects", "Basic analytics", "Community support"],
    current: true,
  },
  {
    key: "pro",
    name: "Pro",
    price: "$19",
    description: "For professionals and small teams",
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Priority support",
      "Up to 5 team members",
      "API access",
    ],
    current: false,
  },
  {
    key: "business",
    name: "Business",
    price: "$49",
    description: "For growing businesses",
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "SSO",
      "Dedicated support",
      "SLA guarantee",
    ],
    current: false,
  },
];

export default function BillingPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string) => {
    setLoading(priceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Portal error:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          Manage your subscription and billing details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            You are currently on the <strong>Free</strong> plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handlePortal} disabled={loading === "portal"}>
            {loading === "portal" && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Manage Subscription
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.key}
            className={plan.current ? "border-primary" : ""}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                {plan.current && <Badge>Current</Badge>}
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {plan.current ? (
                <Button variant="outline" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleCheckout(plan.key)}
                  disabled={loading !== null}
                >
                  {loading === plan.key && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Upgrade
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
