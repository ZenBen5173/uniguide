import Image from "next/image";

/**
 * Global sponsor attribution footer.
 *
 * UMHackathon 2026 Finalist Handbook §Rules requires the combined Z.AI +
 * YTL AI Labs logo to appear across every deliverable and the live demo.
 * This footer is mounted at the bottom of the root layout so every
 * authenticated and unauthenticated page picks it up automatically.
 *
 * Hidden on the printable letter page via the `no-print` class so PDF
 * exports don't carry the sponsor strip into the formal letter.
 */
export default function SponsorFooter() {
  return (
    <footer
      className="no-print mt-auto border-t border-line-2 bg-card/80 backdrop-blur-sm"
      aria-label="Powered by"
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10 py-2.5 flex items-center justify-between gap-4">
        <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-ink-4">
          Powered by{" "}
          <span className="text-ink-3 font-bold tracking-wider normal-case">
            Z.AI GLM
          </span>{" "}
          · Co-developed with{" "}
          <span className="text-ink-3 font-bold tracking-wider normal-case">
            YTL AI Labs
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-ink-4 hidden sm:inline">
            UMHackathon 2026 · Domain 1
          </span>
          <Image
            src="/sponsor-logo.png"
            alt="Z.AI and YTL AI Labs"
            width={160}
            height={29}
            className="h-[22px] sm:h-[26px] w-auto opacity-90"
            priority={false}
          />
        </div>
      </div>
    </footer>
  );
}
