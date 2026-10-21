import { Migration } from '@mikro-orm/migrations';

/**
 * Reference-not-found detection (carrier 404 / silent-empty).
 *
 * Additive only — two nullable/defaulted columns on `shipment_tracking_jobs`:
 *  - `not_found_since` (timestamptz, null): first consecutive not-found poll.
 *  - `not_found_count` (int, default 0): consecutive not-found polls.
 *
 * Existing rows default to not_found_count=0 / not_found_since=null — no backfill.
 * The service stamps these instead of retrying a bad reference to 'failed'.
 */
export class Migration20261021120000_shipment_tracking_reference_not_found extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "shipment_tracking_jobs" add column if not exists "not_found_since" timestamptz null;`);
    this.addSql(`alter table "shipment_tracking_jobs" add column if not exists "not_found_count" int not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "shipment_tracking_jobs" drop column if exists "not_found_count";`);
    this.addSql(`alter table "shipment_tracking_jobs" drop column if exists "not_found_since";`);
  }
}
