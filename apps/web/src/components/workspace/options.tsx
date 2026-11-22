import {
  BookOpen,
  Bot,
  Boxes,
  Briefcase,
  Bug,
  ChartColumn,
  Code2,
  Feather,
  Gauge,
  Microscope,
  ScanSearch,
  Sparkles,
  Telescope,
} from "lucide-react";
import type { OptimizeMode, TargetModel, TaskFamily, TaskSelection } from "@/lib/contracts";
import { BLUEPRINTS, TASK_ORDER } from "@/lib/engine/taxonomy";
import type { SelectOption } from "../ui/Select";
import type { SegmentOption } from "../ui/primitives";

const ic = "size-4";

export const TASK_ICONS: Record<TaskFamily, React.ReactNode> = {
  coding: <Code2 className={ic} aria-hidden />,
  debugging: <Bug className={ic} aria-hidden />,
  system_design: <Boxes className={ic} aria-hidden />,
  research: <Telescope className={ic} aria-hidden />,
  writing: <Feather className={ic} aria-hidden />,
  data_analysis: <ChartColumn className={ic} aria-hidden />,
  learning: <BookOpen className={ic} aria-hidden />,
  business: <Briefcase className={ic} aria-hidden />,
  agent_instruction: <Bot className={ic} aria-hidden />,
};

export const TASK_OPTIONS: SelectOption<TaskSelection>[] = [
  {
    value: "auto",
    label: "Auto-detect",
    description: "Intruva picks the task type and explains why.",
    icon: <Sparkles className={ic} aria-hidden />,
  },
  ...TASK_ORDER.map((f) => ({
    value: f as TaskSelection,
    label: BLUEPRINTS[f].label,
    description: BLUEPRINTS[f].description,
    icon: TASK_ICONS[f],
  })),
];

export const MODE_OPTIONS: SegmentOption<OptimizeMode>[] = [
  { value: "quick", label: "Quick", hint: "One step. No questions; missing context becomes labelled assumptions.", icon: <Gauge className="size-3.5" aria-hidden /> },
  { value: "deep", label: "Deep", hint: "Diagnosis first, then up to three high-impact questions you can skip.", icon: <Microscope className="size-3.5" aria-hidden /> },
  { value: "minimal", label: "Minimal", hint: "Keep your wording. Only adds output structure.", icon: <ScanSearch className="size-3.5" aria-hidden /> },
];

export const MODE_COPY: Record<OptimizeMode, string> = {
  quick: "One step. No questions. Missing context becomes labelled assumptions.",
  deep: "Diagnosis first, then up to three high-impact questions. Every question can be skipped.",
  minimal: "Keeps your wording exactly and only adds output structure.",
};

export const MODEL_OPTIONS: SelectOption<TargetModel>[] = [
  { value: "generic", label: "Any AI", description: "Markdown sections. Works everywhere." },
  { value: "chatgpt", label: "ChatGPT", description: "Markdown sections." },
  { value: "claude", label: "Claude", description: "XML-tagged sections. A formatting convention, not benchmarked." },
  { value: "gemini", label: "Gemini", description: "Markdown sections." },
];
