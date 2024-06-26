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
import { cloneDeep } from "lodash";

const pluginCombinations: Record<PluginCombinationName, PluginInstallation[]> =
  {
    [PluginCombinationName.POSTGRES_BASIC]: [postgres, authCore, authBasic],
    [PluginCombinationName.POSTGRES_JWT]: [postgres, authCore, authJWT],
    [PluginCombinationName.POSTGRES_SAML]: [postgres, authSAML],
    [PluginCombinationName.MYSQL_BASIC]: [mysql, authCore, authBasic],
    [PluginCombinationName.MYSQL_JWT]: [mysql, authCore, authJWT],
  };

const baseDsgResourceData: DSGResourceData = {
  buildId: "1",
  entities,
  roles,
  resourceInfo,
  resourceType: EnumResourceType.Service,
  pluginInstallations: pluginCombinations[PluginCombinationName.POSTGRES_BASIC],
  moduleActions: customActions,
  moduleContainers,
  moduleDtos,
};

function handlePluginCases(plugins: PluginInstallation[]): DSGResourceData {
  let mockedEntities = cloneDeep(entities);
  let mockedResourceInfo = cloneDeep(resourceInfo);
  // remove entity field types that are not supported by mysql
  if (plugins.some((plugin) => plugin === mysql)) {
    mockedEntities = mockedEntities.map((entity) => {
      entity.fields = entity.fields.filter(
        (field) => field.dataType !== EnumDataType.MultiSelectOptionSet
      );
      return entity;
    });
  }

  // when SAML is installed, add sessionId field to auth entity
  if (plugins.some((plugin) => plugin === authSAML)) {
    const authEntityName = resourceInfo.settings.authEntityName;
    const sessionIdField = {
      id: "22c4a27a-6490-4fb8-b951-7f42ded681bc",
      permanentId: "22c4a27a-6490-4fb8-b951-7f42ded681b1",
      name: "sessionId",
      displayName: "sessionId",
      dataType: EnumDataType.SingleLineText,
      properties: {},
      required: true,
      unique: true,
      searchable: false,
    };

    mockedEntities = mockedEntities.map((entity) => {
      if (entity.name === authEntityName) {
        const passwordField = entity.fields.find(
          (field) => field.name === "password"
        );
        passwordField!.required = false;
        entity.fields.push(sessionIdField);
      }
      return entity;
    });
  }

  if (
    !plugins.some((plugin) => plugin === authCore) &&
    !plugins.some((plugin) => plugin === authSAML)
  ) {
    mockedResourceInfo.settings.authEntityName = "";
  }

  return {
    ...baseDsgResourceData,
    entities: mockedEntities,
    resourceInfo: mockedResourceInfo,
  };
}

/**
 * Generates test config for each test case from the plugin combinations
 * Taking care of case such as when MySQL is installed, creating entities without multi-select option data type
 * @returns the test config for each test case
 */
function createTestConfig(): TestConfig[] {
  const results = Object.entries(pluginCombinations).map(([name, plugins]) => {
    const { entities: changedEntities, resourceInfo: changedResourceInfo } =
      handlePluginCases(plugins);

    return {
      name: name as PluginCombinationName,
      data: {
        buildId: "1",
        entities: changedEntities,
        roles,
        resourceInfo: changedResourceInfo,
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
