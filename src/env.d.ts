/// <reference path="../.astro/types.d.ts" />

type KVNamespace = import('@cloudflare/workers-types').KVNamespace;

interface Env {
  SECRETS: KVNamespace;
  ENCRYPTION_KEY: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
