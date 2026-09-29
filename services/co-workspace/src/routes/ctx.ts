import type { UserRecord } from "../users";

/** Per-request values computed once by handleRequest and shared with the route areas. */
export interface Ctx {
  url: URL;
  path: string;
  sessionUser: UserRecord | null;
  clientIp: string;
}
