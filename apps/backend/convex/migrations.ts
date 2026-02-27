/**
 * Convex Migrations
 *
 * Provides a proper framework for schema migrations using @convex-dev/migrations.
 * Define individual migrations using `migrations.define()` and run them via the
 * `run` function from the Convex dashboard or CLI.
 */

import { Migrations } from "@convex-dev/migrations";

import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const migrations = new Migrations<DataModel>(components.migrations);

export const run = migrations.runner();
