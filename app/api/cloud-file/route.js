import { NextResponse } from 'next/server';
import { route, ApiError } from '@/lib/api';
import { signedPdfUrl } from '@/lib/storage';

export const GET = route(async ({ req }) => {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id.startsWith('paisabachao/')) throw new ApiError(404, 'Not found.');
  return NextResponse.redirect(signedPdfUrl(id));
});
