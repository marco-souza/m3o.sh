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
    BASE_URL: pulumi.interpolate`https://${config.domain}`,
    CONTACT_EMAIL: config.contactEmail,
    RESUME_URL: config.resumeUrl,
    PUBLIC_POSTHOG_HOST: config.posthog.host,
    PUBLIC_POSTHOG_PROJECT_TOKEN: config.posthog.projectToken,
  },
  triggers: [gitCommitHash(process.env.FORCE === "true")],
});

const db = new cloudflare.D1Database(`m3o-database`, {
  accountId: config.accountId,
  name: `m3o-${config.environment}`,
});

const schemaFile = "./src/db/schema.sql";
const migrationsCommand = pulumi.interpolate`bun run wrangler d1 execute ${db.name} --remote --file=${schemaFile}`;
const runMigrations = new command.local.Command(
  "m3o-run-migrations",
  {
    dir: absolutePath(".."),
    create: migrationsCommand,
    update: migrationsCommand,
    environment: {
      CLOUDFLARE_ACCOUNT_ID: config.accountId,
    },
    triggers: [schemaFile],
  },
  { dependsOn: [db] },
);

// worker setup
const worker = new cloudflare.Worker(
  "m3o-worker",
  {
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
  },
  { dependsOn: [builder] },
);

// add cron trigger
const cronTrigger = new cloudflare.WorkersCronTrigger(
  `m3o-cron-trigger`,
  {
    accountId: config.accountId,
    scriptName: worker.name,
    schedules: [
      // midnight clean up
      { cron: "0 0 * * *" },
    ],
  },
  { dependsOn: [worker] },
);

const workerVersion = new cloudflare.WorkerVersion(
  `m3o-worker-version`,
  {
    mainModule: "index.js",
    workerId: worker.id,
    accountId: config.accountId,

    compatibilityDate: today(),
    compatibilityFlags: ["global_fetch_strictly_public", "nodejs_compat"],

    cacheOptions: {
      enabled: true,
      crossVersionCache: false,
    },

    assets: {
      directory: builder.id.apply(() => absolutePath("../dist/client/")),

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
        type: "d1",
        name: "DB",
        id: db.id,
      },

      {
        name: "BASE_URL",
        type: "plain_text",
        text: pulumi.interpolate`https://${config.domain}`,
      },

      {
        name: "CONTACT_EMAIL",
        type: "plain_text",
        text: config.contactEmail,
      },

      {
        name: "RESUME_URL",
        type: "plain_text",
        text: config.resumeUrl,
      },

      {
        name: "PUBLIC_POSTHOG_HOST",
        type: "plain_text",
        text: config.posthog.host,
      },

      {
        name: "PUBLIC_POSTHOG_PROJECT_TOKEN",
        type: "plain_text",
        text: config.posthog.projectToken,
      },
    ],

    modules: builder.id.apply(() =>
      discoverWorkerModules(absolutePath("../dist/server/")),
    ),
  },
  { dependsOn: [worker, db] },
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
  domain: pulumi.Output<string>;
  worker: pulumi.Output<string>;
  workerVersion: pulumi.Output<string>;
  database: pulumi.Output<string>;
  cronTrigger: pulumi.Output<string>;
  migrations: pulumi.Output<string>;
  emailRules: pulumi.Output<string>[];
};

const output: InfraOutput = {
  domain: pulumi.interpolate`https://${customDomain.hostname}`,
  database: db.name,
  migrations: runMigrations.stdout,

  worker: worker.name,
  workerVersion: workerVersion.id,

  cronTrigger: cronTrigger.id,
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
export default output;
