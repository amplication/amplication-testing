import fs from "fs";
import path from "path";
import {
  DSGResourceData,
  PluginInstallation,
} from "@amplication/code-gen-types";
import { PluginCombinationName, TestConfig } from "./types";
import {
  authCore,
  authBasic,
  postgres,
  authJWT,
  auth0,
  authSAML,
  mysql,
} from "./test-data/plugins";
import {
  entities,
  resourceInfo,
  roles,
  moduleContainers,
  moduleDtos,
  customActions,
} from "./test-data";
import {
  EnumDataType,
  EnumResourceType,
} from "@amplication/code-gen-types/src/models";

const pluginCombinations: Record<PluginCombinationName, PluginInstallation[]> =
  {
    [PluginCombinationName.POSTGRES_NO_AUTH]: [postgres],
    [PluginCombinationName.POSTGRES_BASIC]: [postgres, authCore, authBasic],
    [PluginCombinationName.POSTGRES_JWT]: [postgres, authCore, authJWT],
    [PluginCombinationName.POSTGRES_AUTH0]: [postgres, authCore, auth0],
    [PluginCombinationName.POSTGRES_SAML]: [postgres, authSAML],
    [PluginCombinationName.MYSQL_NO_AUTH]: [mysql],
    [PluginCombinationName.MYSQL_BASIC]: [mysql, authCore, authBasic],
    [PluginCombinationName.MYSQL_JWT]: [mysql, authCore, authJWT],
    [PluginCombinationName.MYSQL_AUTH0]: [mysql, authCore, auth0],
  };

/**
 * Generates test config for each test case from the plugin combinations
 * Taking care of case such as when MySQL is installed, creating entities without multi-select option data type
 * @returns the test config for each test case
 */
function createTestConfig(): TestConfig[] {
  const results = Object.entries(pluginCombinations).map(([name, plugins]) => {
    let mockEntities = entities;

    // remove entity field types that are not supported by mysql
    if (plugins.find((plugin) => plugin.npm.indexOf("plugin-db-mysql"))) {
      mockEntities = entities.map((entity) => {
        entity.fields = entity.fields.filter(
          (field) => field.dataType !== EnumDataType.MultiSelectOptionSet
        );
        return entity;
      });
    }

    return {
      name: name as PluginCombinationName,
      data: {
        buildId: "1",
        entities: mockEntities,
        roles,
        resourceInfo,
        resourceType: EnumResourceType.Service,
        pluginInstallations: plugins,
        moduleActions: customActions,
        moduleContainers,
        moduleDtos,
      } as DSGResourceData,
      dsgEnv: {
        BUILD_SPEC_PATH: `/data/test-cases/${name}/input.json`,
        BUILD_OUTPUT_PATH: `/data/test-cases/${name}/generated`,
      },
    };
  });

  return results;
}

/**
 * Creates input.json and dsg.env for each test case from the test config
 */
function generateTestCasesDependencies(): void {
  const testConfigs = createTestConfig();
  testConfigs.forEach(({ name, data, dsgEnv }) => {
    const testCaseDir = path.join(process.cwd(), `test-cases/${name}`);
    fs.mkdirSync(testCaseDir, { recursive: true });

    const inputJsonPath = path.join(testCaseDir, "input.json");
    fs.writeFileSync(inputJsonPath, JSON.stringify(data, null, 2));

    const dsgEnvPath = path.join(testCaseDir, "dsg.env");
    const dsgEnvContent = `BUILD_SPEC_PATH=${dsgEnv.BUILD_SPEC_PATH}\nBUILD_OUTPUT_PATH=${dsgEnv.BUILD_OUTPUT_PATH}`;
    fs.writeFileSync(dsgEnvPath, dsgEnvContent);
  });
}

generateTestCasesDependencies();
