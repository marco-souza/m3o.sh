import * as cloudflare from "@pulumi/cloudflare";
import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";

import * as config from "./src/config.ts";
import {
  absolutePath,
  discoverWorkerModules,
  gitCommitHash,
  today,
} from "./src/utils.ts";

const workerBuilderCommand = pulumi.interpolate`bun run build`;
const builder = new command.local.Command("m3o-builder", {
  dir: absolutePath(".."),
  create: workerBuilderCommand,
  update: workerBuilderCommand,
  environment: {
    NODE_ENV: "production",
  },
  triggers: [gitCommitHash],
});

// worker setup
const worker = new cloudflare.Worker("m3o-worker", {
  accountId: config.accountId,
  name: `m3o-${config.environment}`,
  tags: ["m3o", config.environment],

  subdomain: { enabled: true, previewsEnabled: true },

  observability: {
    enabled: false,
    headSamplingRate: 1.0,

    logs: {
      enabled: true,
      headSamplingRate: 1.0,
      persist: true,
      invocationLogs: true,
    },

    traces: {
      enabled: false,
      persist: true,
      headSamplingRate: 1,
    },
  },
});

const distFolder = pulumi.interpolate`${absolutePath("../dist")}`;

const workerVersion = new cloudflare.WorkerVersion(
  `m3o-worker-version`,
  {
    workerId: worker.id,
    mainModule: "index.js",
    accountId: config.accountId,

    compatibilityDate: today(),
    compatibilityFlags: ["global_fetch_strictly_public", "nodejs_compat"],

    assets: {
      directory: pulumi.interpolate`${distFolder}/client/`,
      config: {
        runWorkerFirst: false,
      },
    },

    bindings: [
      {
        type: "assets",
        name: "ASSETS",
      },

      {
        name: "BASE_URL",
        type: "plain_text",
        text: pulumi.interpolate`https://${config.domain}`,
      },
    ],

    modules: pulumi.interpolate`${distFolder}/server/`.apply((destination) =>
      discoverWorkerModules(destination),
    ),
  },
  { dependsOn: [worker, builder] },
);

const workerDeployment = new cloudflare.WorkersDeployment(
  `m3o-worker-deployment`,
  {
    accountId: config.accountId,
    scriptName: worker.name,
    strategy: "percentage",
    versions: [
      {
        versionId: workerVersion.id,
        percentage: 100,
      },
    ],
  },
  { dependsOn: [worker, workerVersion] },
);

// custom domain setup
const customDomain = new cloudflare.WorkersCustomDomain(
  `m3o-custom-domain`,
  {
    accountId: config.accountId,
    zoneId: config.zoneId,
    hostname: config.domain,
    service: worker.name,
  },
  { dependsOn: [worker, workerDeployment] },
);

type InfraOutput = {
  id: pulumi.Output<string>;
  name: pulumi.Output<string>;
  versionId: pulumi.Output<string>;
  deploymentId: pulumi.Output<string>;
  emailRules: pulumi.Output<string>[];
};

export const output: InfraOutput = {
  id: worker.id,
  name: worker.name,
  versionId: workerVersion.id,
  deploymentId: workerDeployment.id,
  emailRules: [],
};

const emailRouting = new cloudflare.EmailRoutingSettings(
  `m3o-email-routing`,
  { zoneId: config.zoneId },
  { dependsOn: [customDomain] },
);

if (config.emailMe) {
  const emailMeRule = new cloudflare.EmailRoutingRule(
    `m3o-email-me`,
    {
      zoneId: config.zoneId,
      enabled: true,
      matchers: [{ type: "literal", field: "to", value: "me@m3o.sh" }],
      actions: [{ type: "forward", values: [config.emailMe] }],
    },
    { dependsOn: [emailRouting], replacementTrigger: [config.emailMe] },
  );

  output.emailRules.push(emailMeRule.id);
}

if (config.emailCatchAll) {
  const emailMeRule = new cloudflare.EmailRoutingCatchAll(
    `m3o-email-catch-all`,
    {
      zoneId: config.zoneId,
      enabled: true,
      matchers: [{ type: "all" }],
      actions: [{ type: "forward", values: [config.emailCatchAll] }],
    },
    { dependsOn: [emailRouting], replacementTrigger: [config.emailCatchAll] },
  );

  output.emailRules.push(emailMeRule.id);
}

// output

export const domain = pulumi.interpolate`https://${customDomain.hostname}`;
