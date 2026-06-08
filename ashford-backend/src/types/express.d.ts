import type { SalesRep } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      user?: SalesRep;
    }
  }
}

export {};
