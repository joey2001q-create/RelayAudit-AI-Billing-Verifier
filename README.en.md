<div align="center">

<p>
  <a href="README.md">简体中文</a>
  ·
  <strong>English</strong>
  ·
  <a href="README.es.md">Español</a>
  ·
  <a href="README.ja.md">日本語</a>
</p>

# RelayAudit

### AI Relay Billing Verifier

**Use reproducible requests, public prices, and real billing records to verify exactly what an AI relay charged.**

No speculation about internal routing. RelayAudit checks only whether the Token usage and charges observed in this test add up.

<p>
  <a href="https://relay-billing-verifier.vercel.app"><img alt="Available on Vercel" src="https://img.shields.io/badge/Vercel-Live-000000?style=for-the-badge&amp;logo=vercel&amp;logoColor=white"></a>
  <a href="https://github.com/joey2001q-create/RelayAudit-AI-Billing-Verifier/actions/workflows/ci.yml"><img alt="Continuous integration" src="https://img.shields.io/github/actions/workflow/status/joey2001q-create/RelayAudit-AI-Billing-Verifier/ci.yml?branch=main&amp;style=for-the-badge&amp;label=CI"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-146c43?style=for-the-badge"></a>
  <img alt="Node.js 20 or later" src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=for-the-badge&amp;logo=node.js&amp;logoColor=white">
</p>

<p>
  <a href="https://relay-billing-verifier.vercel.app"><strong>Try Online</strong></a>
  ·
  <a href="#quick-start"><strong>Quick Start</strong></a>
  ·
  <a href="#verification-method"><strong>Method</strong></a>
  ·
  <a href="#security"><strong>Security</strong></a>
</p>

</div>

## Current Scope

The current version verifies Token usage and pricing only. It does not test speed.

Relay speed is affected by the test region and network route, node load and concurrency, routing policy, upstream service status, DNS and TLS connection setup, and the time of the test. Latency from one location or one request cannot represent the overall service quality of a platform.

A future version is planned to treat speed as a separate dimension. It will sample multiple regions, time periods, and rounds, and report time to first Token, total response time, request success rate, and variance separately from billing conclusions.

## Overview

RelayAudit sends a reproducible batch of fixed requests to one or two OpenAI-compatible endpoints, reads the returned `usage`, calculates the nominal cost from public model prices, and compares it with the actual platform charge entered by the user.

The entire project is open source. Anyone can inspect the test corpus, request parameters, usage normalization, pricing formulas, and report generation, then repeat the experiment in their own environment. This reduces the room for selective reporting or platform-specific bias.

## Key Features

- Verify one platform by default, or send semantically identical requests to two platforms.
- Test single-turn stability, multi-turn context, and cache reuse.
- Show the current scenario, round, platform, and overall progress in real time.
- Use the built-in fixed corpus by default, or enable a custom corpus under Advanced Options.
- Synchronize 5.6 model prices from a public price repository and verify the file with SHA-256.
- Normalize common OpenAI- and Anthropic-style `usage` fields.
- Calculate the platform charge, nominal expected charge, relative deviation, and measured multiplier.
- Label each billing conclusion with its model and completion time, and keep the latest 20 redacted test summaries in the current browser.
- Export redacted JSON evidence, an HTML report, and a text summary.
- Use the API Key only for the current test. It is not persisted or included in reports.

## Choose How to Run It

The hosted and self-hosted versions use exactly the same test corpus, price synchronization, usage normalization, and billing formulas.

| Option | Best for | API Key path | Entry point |
| --- | --- | --- | --- |
| **Vercel hosted version** | Immediate use without installation | Browser → RelayAudit Vercel Function → target relay | [Run an online test](https://relay-billing-verifier.vercel.app) |
| **Self-hosted source version** | Independent verification, private endpoints, strict credential control | Browser → your RelayAudit service → target relay | [View the public source](https://github.com/joey2001q-create/RelayAudit-AI-Billing-Verifier) |

> [!NOTE]
> The hosted version can access only public HTTPS relay endpoints. Use the self-hosted version to test localhost, private network, or HTTP endpoints.

## Quick Start

### Use Online

Open the **[RelayAudit hosted version](https://relay-billing-verifier.vercel.app)** and enter the Base URL and API Key of the platform to test.

### Run Locally or Deploy to Vercel

Node.js 20 or later is required. Clone the repository once, then run it locally or deploy it to your own Vercel account.

```bash
git clone https://github.com/joey2001q-create/RelayAudit-AI-Billing-Verifier.git
cd RelayAudit-AI-Billing-Verifier
npm ci

# Option 1: run locally
npm start

# Option 2: deploy to your own Vercel account
npx vercel
```

After starting locally, open <http://127.0.0.1:4312>. You can also clone and deploy the repository with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjoey2001q-create%2FRelayAudit-AI-Billing-Verifier)

## Workflow

Both versions follow the same steps:

1. Paste a cURL command, JSON, or three-line configuration, or enter the Base URL, API Key, and model alias manually.
2. Select `gpt-5.6-sol`, `gpt-5.6-terra`, or `gpt-5.6-luna`.
3. Run the standard or professional verification suite and watch each request progress.
4. Find the high-precision charge for this test in the platform billing details. The multiplier defaults to `1`; change it only when the platform uses another multiplier.
5. Review the conclusion and export evidence when needed.

Selecting a 5.6 model automatically fills its model name and price from the dynamic price catalog. For a custom model, enter the model name and per-million-Token prices under Advanced Options. The README intentionally does not maintain a duplicate static price table, avoiding drift from the dynamic data source.

Prices come from [`Wei-Shaw/model-price-repo`](https://github.com/Wei-Shaw/model-price-repo). The running service downloads the price JSON and its SHA-256, and updates the page only after validation succeeds. If the network is unavailable or validation fails, it uses the most recent valid snapshot included in the repository. Reports record whether the test used remote prices, the built-in snapshot, or user-entered prices, together with the price file hash.

Maintainers can run `npm run pricing:sync` to update the built-in snapshot. A scheduled repository workflow also checks for updates daily.

When a custom corpus is enabled under Advanced Options, RelayAudit uses the supplied text as fixed input and still appends the short-output constraint to return only `BILLING_TEST_OK`. The default maximum output is `16` Tokens. This is an upper bound and does not guarantee an exact output Token count. Avoid prompts that request random generation, summarization, or rewriting, because they introduce unnecessary output Token variance.

The multiplier is entered in step three after requests finish and defaults to `1`. It affects only billing verification, not requests sent to the relay. Users can enter another platform multiplier, such as `0.8` or `1.2`.

## Verification Method

```text
Nominal base cost = regular input cost + cache-read cost + cache-creation cost + output cost
Nominal expected charge = nominal base cost × advertised multiplier
Measured multiplier = platform billing amount ÷ nominal base cost
Relative deviation = (platform billing amount - nominal expected charge) ÷ nominal expected charge
```

By default, RelayAudit displays a result as consistent with the advertised multiplier when the relative deviation is no more than `2%`. This is a tool-level interpretation rule, not an industry standard. Decimal truncation, rounding, or delayed billing can all cause small differences.

## Request Consistency

- Every test uses a fixed corpus, round markers, message structure, and generation parameters.
- A two-platform test changes only credentials and platform model aliases, and records a semantic request SHA-256.
- Multi-turn tests extend history with fixed assistant messages instead of feeding random model responses into the next turn.
- Cache reuse tests repeat exactly the same request content.
- Requests use `/v1/chat/completions` with `stream: false`; failed requests are not retried automatically.
- Model responses may differ. Costs are calculated independently from the actual `usage` returned by each platform.

The “cache-read share” is the proportion of cache-read Tokens within total input Tokens. It is not the same as the platform's true internal cache hit rate. When the upstream service does not return cache details, RelayAudit displays “not reported” rather than treating it as `0%`.

## Evidence Boundaries

RelayAudit can demonstrate:

- Which reproducible semantic requests were sent during this test;
- How much Token usage the platform returned;
- Whether the billing amount matches the public prices and multiplier entered by the user.

RelayAudit cannot demonstrate:

- Whether the relay actually called the upstream model it claims to use;
- The relay's internal upstream cost;
- Undisclosed routing, caching, or billing implementation details;
- Long-term billing behavior outside this test sample.

The report conclusion therefore applies only to the observable billing data from this test.

## Security

- In the Vercel hosted version, the API Key is sent temporarily from the browser to a Vercel Function, which then requests the relay entered by the user. The project does not persist or intentionally log the Key, and does not include it in responses or reports.
- The self-hosted version listens on `127.0.0.1` by default. The API Key passes only through the user's browser, local RelayAudit service, and target relay.
- The hosted version allows only public HTTPS addresses and rejects localhost, private, link-local, and reserved addresses. The local version can test HTTP or private endpoints according to the user's network environment.
- Confirm that the Base URL belongs to the intended platform so the Key is not sent to an untrusted address.
- Never commit terminal output, screenshots, or configuration files containing real Keys.
- Never commit the `.vercel` directory, Vercel credentials, or real Keys.
- Before exporting a report, check that the platform name, endpoint, and business information are suitable for disclosure.
- Custom corpus text is excluded from responses and exported reports. Reports record only its source, line count, character count, and SHA-256.
- Browser history stores only the model, completion time, and billing summary. It never stores API Keys, endpoint URLs, or test corpus content, and can be cleared from the page.

See [SECURITY.md](SECURITY.md) for complete vulnerability reporting instructions.

## Development

```bash
npm test
npm run check
npm run pricing:sync
```

The project uses Node.js native HTTP services and native frontend modules. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md) before contributing.

## License

[MIT](LICENSE) © 2026 RelayAudit contributors
