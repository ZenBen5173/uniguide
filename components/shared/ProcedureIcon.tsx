/**
 * Shared Lucide icon mapping for procedures.
 * Use this everywhere — never hard-code emoji.
 */
import {
  Wallet,
  GraduationCap,
  PauseCircle,
  Scale,
  BookOpen,
  Plane,
  FileText,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  scholarship_application: Wallet,
  final_year_project: GraduationCap,
  deferment_of_studies: PauseCircle,
  exam_result_appeal: Scale,
  postgrad_admission: BookOpen,
  emgs_visa_renewal: Plane,
};

export function ProcedureIcon({
  procedureId,
  className = "h-5 w-5",
  strokeWidth = 1.75,
}: {
  procedureId: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ICON_MAP[procedureId] ?? FileText;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
