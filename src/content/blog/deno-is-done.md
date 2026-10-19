---
title: Deno is done
description: One of the best JS runtime is sunsetting and I'm not happy about it
author: marco.souza

tags:
  - ai
  - deno
  - runtime
  - javascript
  - typescript

publishedAt: 2026-10-19
updatedAt: 2026-10-19
---

Deno [is now `done`][1]!

I was a Deno enjoyer, it was a serious project, had an amazing runtime fully
integrated with typescript! Not only that but everything you need to build
(outstanding standard lib, linter, formatter, test engine), deploy (Deno deploy,
KV, queues), and distribute (bundler, compiler, jsr) your code!

It offered a safer way to use typescript, requiring less configuration, a better
DX and no support for `node_modules` when it started 🙏.

Check [this video][3] for a overview.

## What really happened?

Cloudflare [bought deno's team][2], hired them to build their internal runtime (which
gives me hope). Cloudflare it's a great cloud company - my default option for
build for the web - and has published their runtime open-source to go against the
clain Cloudflare was a huge lock-in to build on top of, and you would never be able
to leave even if you wish.

Don't get me wrong, I'm a paying and happy customer of Cloudflare, but I do
consider Cloudflare a hugh lock-in - but we have to lock-in to something, am I
right?

Even better if my cloud provider at least does some effort to open-source
their work - yes, AWS, I'm looking at you 👀

## Celld

[Celld][4] its an open-source implementation of Cloudflare Durable Objects - a better
implementation IMO - which seems a great primitive to build on top of.

Not much to say, haven't test it yet but will give it a try eventually. But, for
Cloudflare, this was a big deal, probably the bigest reason for that decision.

## Being honest

Deno is not actually dying, it will continue to receive support for some time, but
the core team will be focused on Cloudflare.

The community can pick it up, fork it, make it better, but we have to be honest
with each other - losing the core team makes things harder!

Let's wait for the future and hope for the best!

[1]: https://blog.cloudflare.com/deno-joins-cloudflare/
[2]: https://deno.com/blog/cloudflare
[3]: https://www.youtube.com/watch?v=kdkGGiyCRYY
[4]: https://celld.dev/
