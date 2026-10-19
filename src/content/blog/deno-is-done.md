---
title: Deno is done
description: Deno's core team joined Cloudflare, leaving the runtime's future uncertain - and I'm not happy about it
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

I was a Deno enjoyer - it was a serious project with an amazing runtime, fully
integrated with TypeScript. Not only that: it had everything you needed to build
(outstanding standard library, linter, formatter, test engine), deploy (Deno
Deploy, KV, queues), and distribute (bundler, compiler, JSR) your code.

It offered a safer way to use TypeScript - secure by default, with no file or
network access unless you grant it - requiring less configuration, a better DX,
and no support for `node_modules` when it started 🙏.

Check [this video][2] for an overview.

## What really happened?

Cloudflare [hired the Deno team][3] to build their internal runtime (which gives
me hope). Cloudflare is a great cloud company - my default choice for building
for the web - and they open-sourced their runtime to counter the claim that
Cloudflare is a huge lock-in you'd never be able to leave, even if you wished.

Don't get me wrong, I'm a paying and happy customer of Cloudflare, but I do
consider Cloudflare a huge lock-in - we all have to lock in to something, am I
right?

Even better if my cloud provider at least makes some effort to open-source
their work - yes, AWS, I'm looking at you 👀.

## Celld

[Celld][4] is an open-source implementation of Cloudflare Durable Objects - a
promising one - which seems like a great primitive to build on top of.

Not much to say - I haven't tested it yet, but I'll give it a try eventually.
For Cloudflare, this was a big deal, probably the biggest reason for that
decision.

## Being honest

Deno is not actually dying - it will continue to receive support for some time,
but the core team will be focused on Cloudflare.

The community can pick it up, fork it, make it better - but we have to be honest
with each other: losing the core team makes things harder!

As for me, I'll keep building on Deno for now - but for anything new, I'm taking
a hard look at Node, Bun, and Workers.

[1]: https://blog.cloudflare.com/deno-joins-cloudflare/
[2]: https://www.youtube.com/watch?v=kdkGGiyCRYY
[3]: https://deno.com/blog/cloudflare
[4]: https://celld.dev/
