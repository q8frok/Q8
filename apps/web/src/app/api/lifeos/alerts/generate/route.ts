import { NextResponse } from 'next/server';
import { runAlertsGenerate } from '@/lib/lifeos/pipeline';

export async function POST() {
  try {
    const result = await runAlertsGenerate();
    return NextResponse.json({ ok: true, ...result, mode: 'db' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'generation failed' },
      { status: 500 }
    );
  }
}
