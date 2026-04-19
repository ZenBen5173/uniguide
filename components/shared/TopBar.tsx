import Link from "next/link";
import SignOutButton from "@/components/auth/SignOutButton";

interface NavItem { href: string; label: string; active?: boolean }

interface Props {
  /** Optional role-tinted chip after the brand mark. */
  roleChip?: { label: string; tone?: "crimson" | "navy" | "ai" };
  /** Centre nav items. */
  nav?: NavItem[];
  /** Right side: user display string + initials for the avatar. */
  user: { name: string; initials: string; email?: string };
}

export default function TopBar({ roleChip, nav, user }: Props) {
  return (
    <header className="ug-topbar">
      <div className="flex items-center">
        <Link href="/" className="ug-brand no-underline">
          <div className="ug-brand-mark">U</div>
          <div>
            <span className="ug-brand-name">UniGuide</span>
            <span className="ug-brand-tag">· Universiti Malaya</span>
          </div>
        </Link>
        {roleChip && (
          <span className="ug-role-chip">{roleChip.label}</span>
        )}
      </div>

      {nav && nav.length > 0 && (
        <nav className="ug-topnav">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={n.active ? "active" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex items-center gap-3 text-[13px] text-ink-3">
        <div className="hidden sm:flex items-center gap-2.5" title={user.email}>
          <div className="ug-avatar">{user.initials}</div>
          <span className="font-medium text-ink-2">{user.name}</span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
