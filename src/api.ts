// disable type checking for this file as we need to defer type checking when using these utility types
// indeed typescript seems to have a bug, where it tries to infer the type of an undecidable generic type
// but when using the functions, types are inferred correctly
import z4 from "zod/v4";
import { capitalize } from "./utils";
import { Narrow, TupleFlat, UnionToTuple } from "./utils.types";
import {
  ZodiosEndpointDefinition,
  ZodiosEndpointDefinitions,
  ZodiosEndpointError,
  ZodiosEndpointParameter,
} from "./zodios.types";

/**
 * check api for non unique paths
 * @param api - api to check
 * @return - nothing
 * @throws - error if api has non unique paths
 */
export function checkApi<Api extends ZodiosEndpointDefinition[]>(api: Api) {
  // check if no duplicate path
  const paths = new Set<string>();
  for (let endpoint of api) {
    const fullpath = `${endpoint.method} ${endpoint.path}`;
    if (paths.has(fullpath)) {
      throw new Error(`Zodios: Duplicate path '${fullpath}'`);
    }
    paths.add(fullpath);
  }

  // check if no duplicate alias
  const aliases = new Set<string>();
  for (let endpoint of api) {
    if (endpoint.alias) {
      if (aliases.has(endpoint.alias)) {
        throw new Error(`Zodios: Duplicate alias '${endpoint.alias}'`);
      }
      aliases.add(endpoint.alias);
    }
  }

  // check if no duplicate body in parameters
  for (let endpoint of api) {
    if (endpoint.parameters) {
      const bodyParams = endpoint.parameters.filter((p) => p.type === "Body");
      if (bodyParams.length > 1) {
        throw new Error(
          `Zodios: Multiple body parameters in endpoint '${endpoint.path}'`
        );
      }
    }
  }
}

/**
 * Simple helper to split your api definitions into multiple files
 * Mandatory to be used when declaring your endpoint definitions outside zodios constructor
 * to enable type inference and autocompletion
 * @param api - api definitions
 * @returns the api definitions
 */
export function makeApi<const Api extends ZodiosEndpointDefinition[]>(
  api: Api
): Api {
  checkApi(api as any);
  return api;
}

/*

Api < ZodiosEndpointDefinition (made out of)
api -> Gets narrowed / reduce

ZodiosEndpointDefinition -> API -> Narrow API -> CheckAPI -> ZodiosEndpointDefinitions

*/

/**
 * Simple helper to split your parameter definitions into multiple files
 * Mandatory to be used when declaring parameters apart from your endpoint definitions
 * to enable type inference and autocompletion
 * @param params - api parameter definitions
 * @returns the api parameter definitions
 */
export function makeParameters<
  ParameterDescriptions extends ZodiosEndpointParameter[]
>(params: Narrow<ParameterDescriptions>): ParameterDescriptions {
  return params as ParameterDescriptions;
}

export function parametersBuilder() {
  return new ParametersBuilder<[]>([]);
}

type ObjectToQueryParameters<
  Type extends "Query" | "Path" | "Header",
  T extends Record<string, z4.ZodType>,
  Keys = UnionToTuple<keyof T>
> = {
  [Index in keyof Keys]: {
    name: Keys[Index];
    type: Type;
    description?: string;
    schema: T[Extract<Keys[Index], keyof T>];
  };
};

class ParametersBuilder<T extends ZodiosEndpointParameter[]> {
  constructor(private params: T) {}

  addParameter<
    Name extends string,
    Type extends "Path" | "Query" | "Body" | "Header",
    Schema extends z4.ZodType
  >(name: Name, type: Type, schema: Schema) {
    return new ParametersBuilder<
      [...T, { name: Name; type: Type; description?: string; schema: Schema }]
    >([
      ...this.params,
      { name, type, description: schema.description, schema },
    ]);
  }

  addParameters<
    Type extends "Query" | "Path" | "Header",
    Schemas extends Record<string, z4.ZodType>
  >(type: Type, schemas: Schemas) {
    const parameters = Object.keys(schemas).map((key) => ({
      name: key,
      type,
      description: schemas[key].description,
      schema: schemas[key],
    }));
    return new ParametersBuilder<
      [
        ...T,
        ...Extract<
          ObjectToQueryParameters<Type, Schemas>,
          ZodiosEndpointParameter[]
        >
      ]
    >([...this.params, ...parameters] as any);
  }

  addBody<Schema extends z4.ZodType>(schema: Schema) {
    return this.addParameter("body", "Body", schema);
  }

  addQuery<Name extends string, Schema extends z4.ZodType>(
    name: Name,
    schema: Schema
  ) {
    return this.addParameter(name, "Query", schema);
  }

  addPath<Name extends string, Schema extends z4.ZodType>(
    name: Name,
    schema: Schema
  ) {
    return this.addParameter(name, "Path", schema);
  }

  addHeader<Name extends string, Schema extends z4.ZodType>(
    name: Name,
    schema: Schema
  ) {
    return this.addParameter(name, "Header", schema);
  }

  addQueries<Schemas extends Record<string, z4.ZodType>>(schemas: Schemas) {
    return this.addParameters("Query", schemas);
  }

  addPaths<Schemas extends Record<string, z4.ZodType>>(schemas: Schemas) {
    return this.addParameters("Path", schemas);
  }

  addHeaders<Schemas extends Record<string, z4.ZodType>>(schemas: Schemas) {
    return this.addParameters("Header", schemas);
  }

  build() {
    return this.params;
  }
}

/**
 * Simple helper to split your error definitions into multiple files
 * Mandatory to be used when declaring errors apart from your endpoint definitions
 * to enable type inference and autocompletion
 * @param errors - api error definitions
 * @returns the error definitions
 */
export function makeErrors<ErrorDescription extends ZodiosEndpointError[]>(
  errors: Narrow<ErrorDescription>
): ErrorDescription {
  return errors as ErrorDescription;
}

/**
 * Simple helper to split your error definitions into multiple files
 * Mandatory to be used when declaring errors apart from your endpoint definitions
 * to enable type inference and autocompletion
 * @param endpoint - api endpoint definition
 * @returns the endpoint definition
 */
export function makeEndpoint<T extends ZodiosEndpointDefinition<any>>(
  endpoint: Narrow<T>
): T {
  return endpoint as T;
}
export class Builder<T extends ZodiosEndpointDefinitions> {
  constructor(private api: T) {}
  addEndpoint<E extends ZodiosEndpointDefinition>(
    endpoint: Narrow<E>
  ): Builder<[...T, E]> {
    if (this.api.length === 0) {
      this.api = [endpoint] as unknown as T;
      return this as any;
    }
    this.api = [...this.api, endpoint] as any;
    return this as any;
  }
  build(): T {
    checkApi(this.api!);
    return this.api!;
  }
}

/**
 * Advanced helper to build your api definitions
 * compared to `makeApi()` you'll have better autocompletion experience and better error messages,
 * @param endpoint
 * @returns - a builder to build your api definitions
 */
export function apiBuilder(): Builder<[]>;
export function apiBuilder<T extends ZodiosEndpointDefinition<any>>(
  endpoint: Narrow<T>
): Builder<[T]>;
export function apiBuilder(endpoint?: any) {
  if (!endpoint) return new Builder([]);
  return new Builder([endpoint]);
}

/**
 * Helper to generate a basic CRUD api for a given resource
 * @param resource - the resource to generate the api for
 * @param schema - the schema of the resource
 * @returns - the api definitions
 */
export function makeCrudApi<
  T extends string,
  S extends z4.ZodObject
>(
  resource: T,
  schema: S
) {
  const capitalizedResource = capitalize(resource);
  return makeApi([
    {
      method: "get",
      path: `/${resource}s`,
      alias: `get${capitalizedResource}s`,
      description: `Get all ${resource}s`,
      response: z4.array(schema),
    },
    {
      method: "get",
      path: `/${resource}s/:id`,
      alias: `get${capitalizedResource}`,
      description: `Get a ${resource}`,
      response: schema,
    },
    {
      method: "post",
      path: `/${resource}s`,
      alias: `create${capitalizedResource}`,
      description: `Create a ${resource}`,
      parameters: [
        {
          name: "body",
          type: "Body",
          description: "The object to create",
          schema: schema.partial(), // as z.ZodType<Partial<Schema>>,
        },
      ],
      response: schema,
    },
    {
      method: "put",
      path: `/${resource}s/:id`,
      alias: `update${capitalizedResource}`,
      description: `Update a ${resource}`,
      parameters: [
        {
          name: "body",
          type: "Body",
          description: "The object to update",
          schema: schema,
        },
      ],
      response: schema,
    },
    {
      method: "patch",
      path: `/${resource}s/:id`,
      alias: `patch${capitalizedResource}`,
      description: `Patch a ${resource}`,
      parameters: [
        {
          name: "body",
          type: "Body",
          description: "The object to patch",
          schema: schema.partial(), // as z.ZodSchema<Partial<Schema>>,
        },
      ],
      response: schema,
    },
    {
      method: "delete",
      path: `/${resource}s/:id`,
      alias: `delete${capitalizedResource}`,
      description: `Delete a ${resource}`,
      response: schema,
    },
  ]);
}

type CleanPath<Path extends string> = Path extends `${infer PClean}/`
  ? PClean
  : Path;

type MapApiPath<
  Path extends string,
  Api,
  Acc extends unknown[] = []
> = Api extends readonly [infer Head, ...infer Tail]
  ? MapApiPath<
      Path,
      Tail,
      [
        ...Acc,
        {
          [K in keyof Head]: K extends "path"
            ? Head[K] extends string
              ? CleanPath<`${Path}${Head[K]}`>
              : Head[K]
            : Head[K];
        }
      ]
    >
  : Acc;

type MergeApis<
  Apis extends Record<string, ZodiosEndpointDefinition[]>,
  MergedPathApis = UnionToTuple<
    {
      [K in keyof Apis]: K extends string ? MapApiPath<K, Apis[K]> : never;
    }[keyof Apis]
  >
> = TupleFlat<MergedPathApis>;

function cleanPath(path: string) {
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * prefix all paths of an api with a given prefix
 * @param prefix - the prefix to add
 * @param api - the api to prefix
 * @returns the prefixed api
 */
export function prefixApi<
  Prefix extends string,
  Api extends ZodiosEndpointDefinition[]
>(prefix: Prefix, api: Api) {
  return api.map((endpoint) => ({
    ...endpoint,
    path: cleanPath(`${prefix}${endpoint.path}`),
  })) as MapApiPath<Prefix, Api>;
}

/**
 * Merge multiple apis into one in a route friendly way
 * @param apis - the apis to merge
 * @returns the merged api
 *
 * @example
 * ```ts
 * const api = mergeApis({
 *   "/users": usersApi,
 *   "/posts": postsApi,
 * });
 * ```
 */
export function mergeApis<
  Apis extends Record<string, ZodiosEndpointDefinition[]>
>(apis: Apis): MergeApis<Apis> {
  return Object.keys(apis).flatMap((key) => prefixApi(key, apis[key])) as any;
}
