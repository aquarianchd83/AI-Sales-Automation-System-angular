/** TenantPublicDto — the only fields safe to expose pre-login (GET /tenants/by-slug/{slug}),
 * cosmetic branding only. */
export interface TenantPublic {
  name: string;
  slug: string;
}
