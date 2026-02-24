import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Total count
    const { count: total } = await supabase
      .from('templates')
      .select('*', { count: 'exact', head: true });

    // Platform counts
    const [n8nRes, makeRes, zapierRes] = await Promise.all([
      supabase.from('templates').select('*', { count: 'exact', head: true }).eq('platform', 'n8n'),
      supabase.from('templates').select('*', { count: 'exact', head: true }).eq('platform', 'make'),
      supabase.from('templates').select('*', { count: 'exact', head: true }).eq('platform', 'zapier'),
    ]);

    // Category breakdown — fetch a sample and aggregate
    // For large tables, we do this by fetching distinct categories with counts
    const { data: catData } = await supabase
      .from('templates')
      .select('category')
      .limit(10000);

    const catCounts: Record<string, number> = {};
    for (const row of catData ?? []) {
      if (row.category) catCounts[row.category] = (catCounts[row.category] ?? 0) + 1;
    }
    const categories = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // Top tags — aggregate from tag arrays
    const { data: tagData } = await supabase
      .from('templates')
      .select('tags')
      .limit(10000);

    const tagCounts: Record<string, number> = {};
    for (const row of tagData ?? []) {
      if (Array.isArray(row.tags)) {
        for (const tag of row.tags) {
          if (tag) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
        }
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([tag, count]) => ({ tag, count }));

    return NextResponse.json({
      total: total ?? 0,
      platforms: {
        n8n: n8nRes.count ?? 0,
        make: makeRes.count ?? 0,
        zapier: zapierRes.count ?? 0,
      },
      categories,
      topTags,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
