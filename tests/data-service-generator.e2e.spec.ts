import * as path from "path";
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  gql,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import fetch from "cross-fetch";
import { omit } from "lodash";
import env from "../test-data/env";
import { v2 as compose } from "docker-compose";
import { getRandomPort } from "get-port-please";

const JSON_MIME = "application/json";
const STATUS_OK = 200;
const STATUS_CREATED = 201;
const NOT_FOUND = 404;

const {
  APP_USERNAME,
  APP_PASSWORD,
  APP_DEFAULT_USER_ROLES,
  APP_BASIC_AUTHORIZATION,
} = env;

const EXAMPLE_CUSTOMER = {
  email: "alice@example.com",
  firstName: "Alice",
  lastName: "Appleseed",
  organization: null,
};
const EXAMPLE_CUSTOMER_UPDATE = { firstName: "Bob" };
const EXAMPLE_ORGANIZATION = {
  name: "Amplication",
};

const testCaseName = process.env.TEST_CASE || "postgres-basic";
const verbose = process.env.VERBOSE ? true : false;
const SERVER_START_TIMEOUT = 30000;

function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

describe("Data Service Generator", () => {
  let host: string;
  let customer: { id: number };
  let apolloClient: ApolloClient<any>;

  describe("DSG E2E tests", () => {
    beforeAll(async () => {
      console.info("Setting up test environment...");
      const dockerComposeDir = path.resolve(
        __dirname,
        `../test-cases/${testCaseName}/generated/server`
      );
      const dotEnvPath = path.join(dockerComposeDir, ".env");
      const port = await getRandomPort();
      const dbPort = await getRandomPort();
      host = `localhost:${port}`;

      const dockerComposeOptions: compose.IDockerComposeOptions = {
        cwd: dockerComposeDir,
        log: verbose,
        composeOptions: [
          `--project-name=${testCaseName}`,
          `--env-file=${dotEnvPath}`,
        ],
        env: {
          ...process.env,
          PORT: String(port),
          DB_PORT: String(dbPort),
        },
      };

      console.info("Running docker-compose up");
      await compose.downAll(dockerComposeOptions);
      await compose.upAll({
        ...dockerComposeOptions,
        commandOptions: ["--build", "--force-recreate"],
      });

      compose
        .logs([], {
          ...dockerComposeOptions,
          follow: true,
        })
        .catch(console.error);

      console.info("Waiting for db migration to be completed...");
      let migrationCompleted = false;
      let startTime = Date.now();

      do {
        console.info("...");
        const containers = await compose.ps({
          ...dockerComposeOptions,
          commandOptions: ["--all"],
        });
        const migrateContainer = containers.data.services.find((s) =>
          s.name.endsWith("migrate-1")
        );
        if (migrateContainer?.state.indexOf("Exited (0)") !== -1) {
          migrationCompleted = true;
          console.info("migration completed!");
          break;
        }
        await sleep(2000);
      } while (
        !migrationCompleted ||
        startTime + SERVER_START_TIMEOUT < Date.now()
      );

      const authLink = setContext((_, { headers }) => ({
        headers: {
          ...headers,
          authorization: APP_BASIC_AUTHORIZATION,
        },
      }));

      const errorLink = onError(({ graphQLErrors, networkError }) => {
        if (graphQLErrors)
          graphQLErrors.map(({ message, locations, path }) =>
            console.error(
              `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
              null,
              { graphQLErrors }
            )
          );

        if (networkError)
          console.error(`[Network error]: ${networkError}`, networkError);
      });

      const httpLink = createHttpLink({
        uri: `http://${host}/graphql`,
        fetch,
      });

      apolloClient = new ApolloClient({
        link: authLink.concat(errorLink).concat(httpLink),
        cache: new InMemoryCache(),
      });
    });

    afterAll(async () => {
      console.info("Tearing down test environment...");
      const dockerComposeDir = path.resolve(__dirname, "../..");
      const dockerComposeOptions: compose.IDockerComposeOptions = {
        cwd: dockerComposeDir,
        composeOptions: [`--project-name=${testCaseName}`],
        commandOptions: ["-v"],
      };

      await compose.downAll(dockerComposeOptions);
    });

    it("check /api/health/live endpoint", async () => {
      const res = await fetch(`http://${host}/api/health/live`, {
        method: "GET",
      });
      expect(res.status === STATUS_OK);
    });

    it("check api/health/ready endpoint", async () => {
      const res = await fetch(`http://${host}/api/health/ready`, {
        method: "GET",
      });
      expect(res.status === STATUS_OK);
    });

    it("creates POST /api/login endpoint", async () => {
      const res = await fetch(`http://${host}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": JSON_MIME,
        },
        body: JSON.stringify({
          username: APP_USERNAME,
          password: APP_PASSWORD,
        }),
      });
      expect(res.status === STATUS_CREATED);
      expect(await res.json()).toEqual(
        expect.objectContaining({
          username: APP_USERNAME,
          roles: APP_DEFAULT_USER_ROLES,
        })
      );
    });

    describe("for customers entities", () => {
      describe("when using REST Api", () => {
        it("creates POST /api/customers endpoint", async () => {
          const res = await fetch(`http://${host}/api/customers`, {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify(EXAMPLE_CUSTOMER),
          });
          expect(res.status === STATUS_CREATED);
          customer = await res.json();
          expect(customer).toEqual(
            expect.objectContaining({
              ...EXAMPLE_CUSTOMER,
              id: expect.any(String),
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            })
          );
        });

        it("creates PATCH /api/customers/:id endpoint", async () => {
          const customer = await (
            await fetch(`http://${host}/api/customers`, {
              method: "POST",
              headers: {
                "Content-Type": JSON_MIME,
                Authorization: APP_BASIC_AUTHORIZATION,
              },
              body: JSON.stringify(EXAMPLE_CUSTOMER),
            })
          ).json();
          const res = await fetch(
            `http://${host}/api/customers/${customer.id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": JSON_MIME,
                Authorization: APP_BASIC_AUTHORIZATION,
              },
              body: JSON.stringify(EXAMPLE_CUSTOMER_UPDATE),
            }
          );
          expect(res.status === STATUS_OK);
        });

        it("handles PATCH /api/customers/:id for a non-existing id", async () => {
          const id = "nonExistingId";
          const res = await fetch(`http://${host}/api/customers/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify(EXAMPLE_CUSTOMER_UPDATE),
          });
          expect(res.status === NOT_FOUND);
        });

        it("creates DELETE /api/customers/:id endpoint", async () => {
          const customer = await (
            await fetch(`http://${host}/api/customers`, {
              method: "POST",
              headers: {
                "Content-Type": JSON_MIME,
                Authorization: APP_BASIC_AUTHORIZATION,
              },
              body: JSON.stringify(EXAMPLE_CUSTOMER),
            })
          ).json();
          const res = await fetch(
            `http://${host}/api/customers/${customer.id}`,
            {
              method: "DELETE",
              headers: {
                "Content-Type": JSON_MIME,
                Authorization: APP_BASIC_AUTHORIZATION,
              },
            }
          );
          expect(res.status === STATUS_OK);
        });

        it("handles DELETE /api/customers/:id for a non-existing id", async () => {
          const id = "nonExistingId";
          const res = await fetch(`http://${host}/api/customers/${id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
          });
          expect(res.status === NOT_FOUND);
        });

        it("creates GET /api/customers endpoint", async () => {
          const res = await fetch(`http://${host}/api/customers`, {
            headers: {
              Authorization: APP_BASIC_AUTHORIZATION,
            },
          });
          expect(res.status === STATUS_OK);
          const customers = await res.json();
          expect(customers).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                ...EXAMPLE_CUSTOMER,
                id: expect.any(String),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
              }),
            ])
          );
        });

        it("creates POST /api/customers to create a customer and then GET /api/customers/:id endpoint to fetch the newly created customer", async () => {
          const newCustomerRes = await fetch(`http://${host}/api/customers`, {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify({
              ...EXAMPLE_CUSTOMER,
              email: "test-rest@test.com",
            }),
          });

          const newCustomer = await newCustomerRes.json();

          const res = await fetch(
            `http://${host}/api/customers/${newCustomer.id}`,
            {
              headers: {
                Authorization: APP_BASIC_AUTHORIZATION,
              },
            }
          );

          expect(res.status === STATUS_OK);
          expect(await res.json()).toEqual(
            expect.objectContaining({
              ...EXAMPLE_CUSTOMER,
              id: expect.any(String),
              email: "test-rest@test.com",
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            })
          );
        });
      });

      describe("when using GraphQL Api", () => {
        it("gets all customer", async () => {
          const res = await apolloClient.query({
            query: gql`
              {
                customers(where: {}) {
                  id
                  createdAt
                  updatedAt
                  email
                  firstName
                  lastName
                }
              }
            `,
          });

          expect(res).toEqual(
            expect.objectContaining({
              data: {
                customers: expect.arrayContaining([
                  expect.objectContaining({
                    ...omit(EXAMPLE_CUSTOMER, ["organization"]),
                    id: customer.id,
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String),
                  }),
                ]),
              },
            })
          );
        });

        it("adds a new customer", async () => {
          try {
            const resp = await apolloClient.mutate({
              mutation: gql`
                mutation CreateCustomer($data: CustomerCreateInput!) {
                  createCustomer(data: $data) {
                    id
                    email
                  }
                }
              `,
              variables: {
                data: {
                  ...EXAMPLE_CUSTOMER,
                  email: `test-gql@example.com`,
                },
              },
            });
            expect(resp).toEqual(
              expect.objectContaining({
                data: {
                  createCustomer: expect.objectContaining({
                    id: expect.any(String),
                    email: "test-gql@example.com",
                  }),
                },
              })
            );
          } catch (error: any) {
            console.error(error.message, error);
            throw error;
          }
        });
      });
    });

    describe("for organizations entities", () => {
      it("creates POST /api/organizations/:id/customers endpoint", async () => {
        const customer = await (
          await fetch(`http://${host}/api/customers`, {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify({
              ...EXAMPLE_CUSTOMER,
              email: "test-org@post.com",
            }),
          })
        ).json();

        const organization = await (
          await fetch(`http://${host}/api/organizations`, {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify(EXAMPLE_ORGANIZATION),
          })
        ).json();

        const res = await fetch(
          `http://${host}/api/organizations/${organization.id}/customers`,
          {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify([
              {
                id: customer.id,
              },
            ]),
          }
        );
        expect(res.status).toBe(STATUS_CREATED);
        const data = await res.text();
        expect(data).toBe("");
      });

      it("creates DELETE /api/organizations/:id/customers endpoint", async () => {
        const customer = await (
          await fetch(`http://${host}/api/customers`, {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify({
              ...EXAMPLE_CUSTOMER,
              email: "test-org@delete.com",
            }),
          })
        ).json();
        const organization = await (
          await fetch(`http://${host}/api/organizations`, {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify(EXAMPLE_ORGANIZATION),
          })
        ).json();

        await fetch(
          `http://${host}/api/organizations/${organization.id}/customers`,
          {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify([
              {
                id: customer.id,
              },
            ]),
          }
        );

        const res = await fetch(
          `http://${host}/api/organizations/${organization.id}/customers`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify([
              {
                id: customer.id,
              },
            ]),
          }
        );
        expect(res.status).toBe(STATUS_OK);
        const data = await res.text();
        expect(data).toBe("");
      });

      it("creates GET /api/organizations/:id/customers endpoint", async () => {
        const customer = await (
          await fetch(`http://${host}/api/customers`, {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify({
              ...EXAMPLE_CUSTOMER,
              email: "test-org@get.com",
            }),
          })
        ).json();
        const organization = await (
          await fetch(`http://${host}/api/organizations`, {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify(EXAMPLE_ORGANIZATION),
          })
        ).json();

        await fetch(
          `http://${host}/api/organizations/${organization.id}/customers`,
          {
            method: "POST",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
            body: JSON.stringify([
              {
                id: customer.id,
              },
            ]),
          }
        );

        const res = await fetch(
          `http://${host}/api/organizations/${organization.id}/customers`,
          {
            method: "GET",
            headers: {
              "Content-Type": JSON_MIME,
              Authorization: APP_BASIC_AUTHORIZATION,
            },
          }
        );
        expect(res.status).toBe(STATUS_OK);
        const data = await res.json();
        expect(data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              ...EXAMPLE_CUSTOMER,
              id: customer.id,
              email: "test-org@get.com",
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
              organization: {
                id: organization.id,
              },
            }),
          ])
        );
      });
    });
  });
});
