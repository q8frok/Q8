import { NextResponse } from 'next/server';
import { runWorkOpsIngest } from '@/lib/lifeos/pipeline';

export async function POST() {
  try {
    const snapshot = await runWorkOpsIngest();
    return NextResponse.json({ ok: true, mode: 'db', snapshot });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'ingest failed' },
      { status: 500 }
    );
  }
}
