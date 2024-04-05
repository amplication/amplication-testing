import { DSGResourceData } from "@amplication/code-gen-types";

enum DSGEnv {
  BUILD_SPEC_PATH = "BUILD_SPEC_PATH",
  BUILD_OUTPUT_PATH = "BUILD_OUTPUT_PATH",
}

export enum PluginCombinationName {
  POSTGRES_BASIC = "postgres-basic",
  POSTGRES_JWT = "postgres-jwt",
  POSTGRES_SAML = "postgres-saml",
  MYSQL_BASIC = "mysql-basic",
  MYSQL_JWT = "mysql-jwt",
}

export type TestConfig = {
  name: PluginCombinationName;
  data: DSGResourceData;
  dsgEnv: Record<DSGEnv, string>;
};
