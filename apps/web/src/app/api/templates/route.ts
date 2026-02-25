import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = req.nextUrl;
  const page = Math.max(0, Number(searchParams.get('page') ?? 0));
  const limit = Math.min(96, Math.max(1, Number(searchParams.get('limit') ?? 48)));
  const platform = searchParams.get('platform') ?? '';
  const category = searchParams.get('category') ?? '';
  const complexity = searchParams.get('complexity') ?? '';
  const rawTags = searchParams.get('tags') ?? '';
  const q = searchParams.get('q') ?? '';
  const sort = searchParams.get('sort') ?? 'name';

  let query = supabase
    .from('templates')
    .select('id, name, platform, category, description, node_count, tags, complexity, trigger_type, source_repo', { count: 'exact' })
    .range(page * limit, (page + 1) * limit - 1);

  // Filters
  if (platform) query = query.eq('platform', platform);
  if (category) query = query.eq('category', category);
  if (complexity) query = query.eq('complexity', complexity);
  if (rawTags) {
    const tags = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length > 0) query = query.contains('tags', tags);
  }
  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  // Sort
  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'popular') {
    query = query.order('node_count', { ascending: false });
  } else {
    query = query.order('name', { ascending: true });
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totalPages = Math.ceil((count ?? 0) / limit);

  return NextResponse.json({
    templates: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages,
  });
}
