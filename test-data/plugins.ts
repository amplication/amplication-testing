import { PluginInstallation } from "@amplication/code-gen-types";

export const postgres: PluginInstallation = {
  id: "postgres-id",
  pluginId: "db-postgres",
  npm: "@amplication/plugin-db-postgres",
  enabled: true,
  version: "latest",
};

export const mongo: PluginInstallation = {
  id: "mongo-id",
  pluginId: "db-mongo",
  npm: "@amplication/plugin-db-mongo",
  enabled: true,
  version: "latest",
};

export const mysql: PluginInstallation = {
  id: "mysql-id",
  pluginId: "db-mysql",
  npm: "@amplication/plugin-db-mysql",
  enabled: true,
  version: "latest",
};

export const authCore: PluginInstallation = {
  id: "auth-core-id",
  pluginId: "auth-core",
  npm: "@amplication/plugin-auth-core",
  enabled: true,
  version: "latest",
};

export const authBasic: PluginInstallation = {
  id: "auth-basic-id",
  pluginId: "auth-basic",
  npm: "@amplication/plugin-auth-basic",
  enabled: true,
  version: "latest",
};

export const authJWT: PluginInstallation = {
  id: "auth-jwt-id",
  pluginId: "auth-jwt",
  npm: "@amplication/plugin-auth-jwt",
  enabled: true,
  version: "latest",
};

export const auth0: PluginInstallation = {
  id: "auth-auth0-id",
  pluginId: "auth-auth0",
  npm: "@amplication/plugin-auth-auth0",
  enabled: true,
  version: "latest",
};

export const authSAML: PluginInstallation = {
  id: "auth-saml-id",
  pluginId: "auth-saml",
  npm: "@amplication/plugin-auth-saml",
  enabled: true,
  version: "latest",
};
