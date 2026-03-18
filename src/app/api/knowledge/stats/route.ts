import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/integrations/supabase/client";

/**
 * GET /api/workspaces/[workspaceSlug]/knowledge/stats
 * Live-Stats der RAG-Datenbanken aus Supabase.
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const [
      { count: foodItems },
      { count: foodChunks },
      { count: saasChunks },
      { count: exerciseChunks },
      { count: importRuns },
      { data: lastRun },
    ] = await Promise.all([
      supabase.from("food_items").select("*", { count: "exact", head: true }),
      supabase.from("rag_food_chunks").select("*", { count: "exact", head: true }),
      supabase.from("rag_saas_chunks").select("*", { count: "exact", head: true }),
      supabase.from("rag_exercise_chunks").select("*", { count: "exact", head: true }),
      supabase.from("import_runs").select("*", { count: "exact", head: true }),
      supabase
        .from("import_runs")
        .select("finished_at")
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      foodItems: foodItems ?? 0,
      foodChunks: foodChunks ?? 0,
      saasChunks: saasChunks ?? 0,
      exerciseChunks: exerciseChunks ?? 0,
      importRuns: importRuns ?? 0,
      lastImport: lastRun?.finished_at || null,
    });
  } catch {
    return NextResponse.json(
      { foodItems: 0, foodChunks: 0, saasChunks: 0, exerciseChunks: 0, importRuns: 0, lastImport: null },
      { status: 200 }
    );
  }
}
