import { PluginInstallation } from "@amplication/code-gen-types";
import { TestConfig } from "./types";

/**
 * Calls the API to get all the plugins from the catalog
 * @returns all the plugins from the catalog
 */
function getPlugins(): PluginInstallation[] {
  return [];
}

/**
 * Generates all possible combinations of 4 plugins to install together
 * @returns set of plugin combinations to install together (matrix  of all possible combinations), 4 plugins on each combination
 */
function createPluginCombination(): PluginInstallation[] {
  const plugins = getPlugins();
  return [];
}

/**
 * Generates test config for each test case
 * Taking care of case such as when MySQL is installed, creating entities without multi-select option data type
 * @returns the test config for each test case
 */
function createTestConfig(): TestConfig[] {
  const pluginCombinations = createPluginCombination();
  return [];
}

/**
 * Creates input.json and dsg.env for each test case from the test config
 */
function generateTestCasesDependencies(): void {
  const testConfigs = createTestConfig();
  testConfigs.forEach(({ name, data }) => {
    console.log({ name, data });
    // use the name and that data to create the input.json in the right path with the corresponding data
    // use the name to create the dsg.env in the right path and set the right data: BUILD_SPEC_PATH=/data/test-cases/{name}/input.json BUILD_OUTPUT_PATH=/data/test-cases/{name}/generated
  });
}

generateTestCasesDependencies();
