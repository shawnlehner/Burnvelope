import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  return new Response('google-site-verification: google70bb9b47c4def2ba.html\n', {
    headers: {
      'Content-Type': 'text/html',
    },
  });
};
