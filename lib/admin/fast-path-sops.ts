/**
 * Pre-canned SOPs that admin can fall back to during a live demo if the
 * "Analyse & make live" flow takes too long (Z.AI structuring + indexing
 * can spike past 15s under load and a stalling demo is worse than a less
 * polished one).
 *
 * The frontend (`components/admin/AdminProcedures.tsx > submitNew`) starts
 * a 15s timer alongside the live POST. If the live flow doesn't finish by
 * then, the timer fires and:
 *   1. aborts the in-flight request,
 *   2. POSTs to `/api/admin/procedures` with the canned name + description
 *      (overriding whatever the admin typed),
 *   3. POSTs to `/api/admin/procedures/{id}/sop` with `ai_structure: false`
 *      and the canned markdown so the chunker splits on the H2 headers we
 *      already structured below.
 *
 * Detection is by procedure id only — the admin types the matching id
 * (e.g. "free_parking_application") in the modal and the fallback fires
 * automatically. Procedure ids that aren't keys in this map run the
 * normal live flow without any 15s timer.
 *
 * To add a new fast-path SOP: drop a new key + value below. No frontend
 * code change needed.
 */

export interface FastPathSop {
  /** Display name shown to students on the portal. Overrides admin's typed name. */
  name: string;
  /** One-line description for the portal card. Overrides admin's typed desc. */
  description: string;
  /** Pre-structured markdown with `# H1` title + `## H2` sections so the
   *  /sop chunker splits cleanly without an AI structuring round-trip. */
  markdown: string;
}

/** Map: procedure_id (lowercase, snake_case) → canned SOP. */
export const FAST_PATH_SOPS: Record<string, FastPathSop> = {
  free_parking_application: {
    name: "Free Parking Application",
    description:
      "UM staff and students apply for the annual free-parking sticker for use across the Bukit Cerakah / FCSIT campuses.",
    markdown: `# Free Parking Application

Annual application for the UM staff/student free-parking sticker. Issued by the UM Security Office, valid for one academic year, renewable.

## Eligibility

- Active UM staff (full-time or contract) OR active student (undergraduate, postgraduate, intersession)
- Valid student ID or staff card (must not be expiring within 3 months of the application date)
- Vehicle registered to the applicant or to an immediate family member (proof required)
- No outstanding traffic summonses or unpaid fines with the UM Security Office
- Class B / B2 driving licence valid for at least 6 more months on the application date

## Documents Required

- Photocopy of valid student ID or staff card (front + back)
- Photocopy of vehicle registration document — Geran Kenderaan (front + back)
- Recent photo of the vehicle (front-on, full number plate clearly visible)
- Photocopy of valid driving licence (Class B or B2)
- If the vehicle is registered to a family member: a signed letter of authorisation from the registered owner + photocopy of their IC

## Process Steps

1. Submit the application through the UM Security online portal (link via the UM staff/student intranet).
2. Pay the RM 30 sticker fee online (e-wallet or FPX) — required before submission.
3. The UM Security Office reviews and verifies documents within 5 working days.
4. If approved, an SMS + email is sent to the applicant with the sticker pickup window.
5. Collect the sticker in person from the UM Security Office, Block A, Bangunan Canseleri, during office hours (Mon–Fri, 9 AM – 4 PM).
6. Affix the sticker on the front windscreen, top-left corner. The sticker must be visible at all times when parked.

## Eligibility Cap

- Each staff/student is entitled to ONE registered vehicle at a time on the parking sticker scheme.
- Sticker is non-transferable between vehicles. To switch vehicles, surrender the existing sticker and re-apply.
- Sticker validity: one academic year. Renew at least 4 weeks before expiry.

## Common Pitfalls

- Submitting an expired vehicle registration → automatic rejection
- Wrong vehicle photo angle (number plate not fully visible) → re-submission required
- Applying for multiple vehicles in the same academic year → all applications voided
- Missing driving licence photocopy → application held until provided
- Paying the sticker fee AFTER submission → application rejected; refund processed but slot lost

## Penalties

- Parking on UM grounds without a valid sticker: RM 50 fine per occurrence (issued by UM Security)
- Parking in restricted "Red Zone" areas (faculty deans / VVIP / disabled): RM 100 fine
- Repeat offenders (3+ summonses in one academic year): vehicle towed at owner's expense
- Forged or altered stickers: disciplinary action under UM Code of Conduct + permanent parking ban + report to PDRM

## Renewal

- Renew up to 4 weeks before the existing sticker's expiry date
- Renewals require all the same documents as a fresh application
- If the registered vehicle has not changed and there are no outstanding summonses, the renewal is processed online without a physical visit
- Late renewals (after expiry) are treated as fresh applications and may not be approved before the new academic semester begins

## Contact

- UM Security Office, Block A, Bangunan Canseleri
- Operating hours: Mon-Fri, 9 AM – 4 PM (closed on public holidays)
- Email: security@um.edu.my
- Phone: +603-7967-XXXX
- For the online portal: visit the UM staff/student intranet → Services → Parking → Apply Sticker
`,
  },
};
