import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

export const accountId = config.require("accountId");
export const zoneId = config.require("zoneId");
export const environment = config.require("environment");
export const isProd = environment === "production";

export const domain = isProd
  ? pulumi.interpolate`m3o.sh`
  : pulumi.interpolate`dev.m3o.sh`;
