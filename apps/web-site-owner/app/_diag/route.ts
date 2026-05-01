import { NextResponse } from 'next/server';

export async function GET() {
  const value = process.env.API_BASE_URL;
  return NextResponse.json({
    api_base_url_set: typeof value !== 'undefined',
    api_base_url_length: value?.length ?? 0,
    api_base_url_value: value ?? '(undefined)',
    api_base_url_starts_with_https: value?.startsWith('https://') ?? false,
    api_base_url_ends_with_slash: value?.endsWith('/') ?? false,
    api_base_url_has_whitespace: value !== value?.trim(),
  });
}
