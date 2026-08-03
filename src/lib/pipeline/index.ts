/**
 * Editorial Pipeline — barrel.
 */

export {
  PIPELINE_STAGES,
  APPROVAL_STAGE,
  QUALITY_PASS_THRESHOLD,
  runPipeline,
  approvePipeline,
  rejectPipeline,
} from "@/lib/pipeline/pipeline";
export type {
  PipelineOptions,
  PipelineStore,
  PipelineContentItem,
  StageExecutors,
} from "@/lib/pipeline/pipeline";
export type { PipelineStage, PipelineStageResult } from "@/types";
export { createPipelineExecutors, expandKeywords, buildOutline } from "@/lib/pipeline/executors";
export type { ExecutorsDeps } from "@/lib/pipeline/executors";
export { SupabasePipelineStore } from "@/lib/pipeline/supabase-store";
