import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { NavigationDrawer } from "@/components/navigation-drawer";
import { ThemeToggle } from "@/components/theme-toggle";

export function MarketingHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-page items-center justify-between gap-2 px-4 py-4 sm:px-6 lg:px-8">
        <Brand />
        <nav
          aria-label="Main"
          className="hidden items-center gap-8 text-sm text-muted md:flex"
        >
          <Link
            href="#product"
            className="inline-flex min-h-11 items-center rounded-md hover:text-text"
          >
            Product
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex min-h-11 items-center rounded-md hover:text-text"
          >
            How it works
          </Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/workspace"
            className="hidden min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover sm:inline-flex"
          >
            Open workspace
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <div className="md:hidden">
            <NavigationDrawer label="Site navigation" id="site-navigation">
              <nav aria-label="Mobile main" className="space-y-2">
                {[
                  { href: "#product", label: "Product" },
                  { href: "#how-it-works", label: "How it works" },
                  { href: "/workspace", label: "Explore PolicyForge" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-hover"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </NavigationDrawer>
          </div>
        </div>
      </div>
    </header>
  );
}
