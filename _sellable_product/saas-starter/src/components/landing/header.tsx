"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Features", href: "#features" },
  { name: "Pricing", href: "#pricing" },
  { name: "FAQ", href: "#faq" },
];

export function Header() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">S</span>
          </div>
          <span className="text-xl font-bold">
            {process.env.NEXT_PUBLIC_APP_NAME || "SaaS Starter"}
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.name}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <ThemeToggle />
          {session ? (
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/login">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t md:hidden">
          <div className="container space-y-4 py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block text-sm font-medium text-muted-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              {session ? (
                <Button asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/login">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
