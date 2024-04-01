import { DSGResourceData } from "@amplication/code-gen-types";

enum DSGEnv {
  BUILD_SPEC_PATH = "BUILD_SPEC_PATH",
  BUILD_OUTPUT_PATH = "BUILD_OUTPUT_PATH",
}

export enum PluginCombinationName {
  POSTGRES_NO_AUTH = "postgres-no-auth",
  POSTGRES_BASIC = "postgres-basic",
  POSTGRES_JWT = "postgres-jwt",
  POSTGRES_AUTH0 = "postgres-auth0",
  POSTGRES_SAML = "postgres-saml",
  MYSQL_NO_AUTH = "mysql-no-auth",
  MYSQL_BASIC = "mysql-basic",
  MYSQL_JWT = "mysql-jwt",
  MYSQL_AUTH0 = "mysql-auth0",
}

export type TestConfig = {
  name: PluginCombinationName;
  data: DSGResourceData;
  dsgEnv: Record<DSGEnv, string>;
};
