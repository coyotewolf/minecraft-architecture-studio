# Generic AI provider integration

Status: configurable server adapter implemented and tested at M8/M10. Real local HTTP adapter tests, four browser AI scenarios, and compiled production-server AI-disabled/manual-edit smoke passed. Configured upstream responses in tests are explicitly synthetic; no live provider, paid generation, deployment or photo-to-building accuracy is established. See progress/M8.md and progress/M10.md. No vendor SDK is required.

## Disabled by default

Leave provider settings blank to keep AI unavailable. Manual editing remains available. The browser reads GET /api/ai/capabilities; missing required provider configuration returns enabled: false. A ChatGPT connector connection does not configure this application's provider or authorize its users to spend the connector owner's credits.

The application sends POST /api/ai/propose only after the user selects the explicit consent checkbox and deliberately requests analysis, generation, or an edit. It must not call the provider automatically when a project opens, a photo is selected, or a form changes. Provider proposals must pass version, scope, revision and transaction validation, appear as a preview, and require a separate approval before the canonical project changes.

## Server configuration

Set these variables in the server process environment or the deployment's secret settings. The example file contains blank placeholders; do not put credentials in browser code, public-prefixed variables, source control, or exported projects. A .env.example file is documentation, not evidence that the server automatically loads a .env file.

| Variable | Meaning |
| --- | --- |
| STUDIO_AI_URL | Full provider endpoint URL. HTTPS is required except HTTP loopback endpoints used for local development. |
| STUDIO_AI_KEY | Server-only bearer credential sent to the configured provider. |
| STUDIO_AI_MODEL | Model label included in provider requests and associated with server configuration metadata. It is not proof that a provider executed that model. |
| STUDIO_PUBLIC_ORIGIN | Optional exact browser origin, including scheme and port where applicable. Configure it for the intended browser deployment. |
| PORT | Server port; defaults to 5174. The server binds to 127.0.0.1 by default. |

After dependencies are installed, build and start from the project directory:

~~~sh
npm run build
npm run start
~~~

The start command is part of the pending implementation contract and must be verified with the server acceptance tests. The default local address is http://127.0.0.1:5174. Blank provider configuration should leave the application usable with AI disabled. Set credentials in the actual server environment before starting a configured provider; never paste a real key into .env.example.

## Outbound JSON protocol

The server sends a generic JSON request to STUDIO_AI_URL using bearer authentication. The endpoint must implement this protocol or provide its own adapter; an arbitrary vendor chat endpoint is not automatically compatible.

~~~ts
{
  kind: 'analyze' | 'generate' | 'edit';
  project: Project;
  scope: { min: BlockPos; max: BlockPos };
  prompt: string;
  images: {
    name: string;
    mime: 'image/png' | 'image/jpeg' | 'image/webp';
    dataUrl: string;
  }[];
  dimensions?: { x: number; y: number; z: number };
  model: string;
}
~~~

Project, BlockPos and EditTransaction refer to the repository's canonical TypeScript contracts in src/core/contracts.ts. Scope uses integer canonical coordinates: +X east, +Y up, +Z south. Dimensions are proposed block counts, not independently verified measurements of the photographed building.

The response must be one of these two shapes:

~~~ts
{
  kind: 'analysis';
  summary: string;
  dimensions: { x: number; y: number; z: number };
  uncertainties: string[];
}

// Or:
{
  kind: 'proposal';
  minecraftVersion: '1.20.1';
  baseRevision: string;
  transaction: EditTransaction;
  summary: string;
  uncertainties: string[];
}
~~~

A proposal must reference the supplied design revision and contain a finite validated transaction, not executable code or a mesh substituted for block data. Unseen areas and inferred dimensions belong in uncertainties and block provenance. A stale or invalid proposal must not change the project. Analysis alone does not establish Minecraft buildability.

## Limits and data handling

- At most four images per request, at most 2 MiB per image; supported formats are PNG, JPEG and WebP.
- Scope is limited to 10,000 cells; proposals are limited to 5,000 changes.
- Provider timeout is 60 seconds.
- Selected photos stay in memory and are sent only through deliberate consent to the configured provider. Once sent, that provider's retention and privacy practices apply; this adapter does not establish deletion by the provider.
- The canonical project and prompt accompany the outbound request. Do not send personal or confidential project content without understanding the configured service.
- Server configuration supplies model metadata. Do not log credentials or image contents. A configured model label or mock response is not live execution evidence.

Before exposing a paid endpoint publicly, add authentication and rate limits at the reverse proxy, keep credentials server-side, and verify origin configuration, provider billing and user authorization. The default loopback listener is intended for local use. This document does not authorize deployment or any paid request.

## Acceptance boundary

Required verification includes disabled capabilities without settings; request consent; input and scope limits; provider errors/timeouts; stale or invalid response rejection; and validated preview followed by explicit application. Mock endpoint tests can verify adapter behavior but cannot establish a real provider's authentication, model selection, image analysis, cost, or output quality. Record those separately only after authorized live execution.
