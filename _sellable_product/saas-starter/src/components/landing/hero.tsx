import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="container flex flex-col items-center justify-center gap-4 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
      <Badge variant="secondary" className="gap-2 px-4 py-1">
        <Sparkles className="h-3 w-3" />
        Now with AI-powered features
      </Badge>

      <h1 className="text-center text-3xl font-bold leading-tight tracking-tighter md:text-6xl lg:leading-[1.1]">
        Ship your SaaS
        <br />
        <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
          in record time
        </span>
      </h1>

      <p className="max-w-[750px] text-center text-lg text-muted-foreground sm:text-xl">
        Stop wasting weeks on boilerplate. Get authentication, payments, teams,
        emails, and a beautiful UI out of the box. Focus on what makes your
        product unique.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button size="lg" asChild>
          <Link href="/login">
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="#features">See Features</Link>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Free plan available. No credit card required.
      </p>

      {/* Hero visual */}
      <div className="mt-8 w-full max-w-5xl overflow-hidden rounded-xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span className="ml-2 text-xs text-muted-foreground">
            dashboard.yoursaas.com
          </span>
        </div>
        <div className="grid grid-cols-12 gap-0">
          {/* Sidebar mock */}
          <div className="col-span-3 hidden border-r bg-muted/30 p-4 md:block">
            <div className="space-y-3">
              <div className="h-4 w-24 rounded bg-primary/20" />
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
          </div>
          {/* Main content mock */}
          <div className="col-span-12 p-6 md:col-span-9">
            <div className="space-y-4">
              <div className="h-5 w-48 rounded bg-foreground/10" />
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border bg-background p-4">
                  <div className="h-3 w-12 rounded bg-muted" />
                  <div className="mt-2 h-6 w-16 rounded bg-primary/20" />
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <div className="h-3 w-12 rounded bg-muted" />
                  <div className="mt-2 h-6 w-16 rounded bg-green-500/20" />
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <div className="h-3 w-12 rounded bg-muted" />
                  <div className="mt-2 h-6 w-16 rounded bg-orange-500/20" />
                </div>
              </div>
              <div className="h-32 rounded-lg border bg-gradient-to-br from-muted/50 to-muted" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
