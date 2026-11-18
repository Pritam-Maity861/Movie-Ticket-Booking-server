import { describe, it } from "node:test";
import assert from "node:assert/strict";
import theaterRouter from "../theaters/theaters.routes";
import { requireRoles } from "../middleware/role.middleware";
import { AuthUser } from "../types/express";
import { ApiError } from "../utils/api-error";

describe("Bug 4 & Bug 5: Theater Routes & RBAC Test Suite", () => {
  const normalUser: AuthUser = {
    userId: "u_normal_1",
    role: "USER",
    email: "normal@cinema.com",
  };

  const adminUser: AuthUser = {
    userId: "u_admin_1",
    role: "ADMIN",
    email: "admin@cinema.com",
  };

  const superAdminUser: AuthUser = {
    userId: "u_superadmin_1",
    role: "SUPER_ADMIN",
    email: "superadmin@cinema.com",
  };

  const createMockContext = (user?: AuthUser) => {
    const req: any = { user };
    const res: any = {};
    return { req, res };
  };

  // --------------------------------------------------------------------------
  // SUITE 1: Bug 4 - Theater Router Paths Verification
  // --------------------------------------------------------------------------
  describe("Suite 1: Bug 4 - Theater Router REST Path Structure", () => {
    it("should register PATCH and DELETE on /:id without duplicate /theaters prefix", () => {
      const routes = theaterRouter.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const patchRoute = routes.find((r) => r.methods.includes("patch"));
      const deleteRoute = routes.find((r) => r.methods.includes("delete"));

      assert.ok(patchRoute, "PATCH route must exist");
      assert.equal(patchRoute.path, "/:id", "PATCH path must be /:id, NOT /theaters/:id");

      assert.ok(deleteRoute, "DELETE route must exist");
      assert.equal(deleteRoute.path, "/:id", "DELETE path must be /:id, NOT /theaters/:id");
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Bug 5 - Role-Based Access Control Middleware (RBAC)
  // --------------------------------------------------------------------------
  describe("Suite 2: Bug 5 - RBAC Middleware Enforcement", () => {
    const adminOnlyMiddleware = requireRoles(["ADMIN", "SUPER_ADMIN"]);
    const superAdminOnlyMiddleware = requireRoles(["SUPER_ADMIN"]);

    it("should reject unauthenticated request with 401", () => {
      const { req, res } = createMockContext(undefined);
      let errorThrown: any = null;
      adminOnlyMiddleware(req, res, (err?: any) => {
        errorThrown = err;
      });

      assert.ok(errorThrown instanceof ApiError);
      assert.equal(errorThrown.statusCode, 401);
      assert.match(errorThrown.message, /Authentication required/i);
    });

    it("should reject normal USER on admin-only routes with 403 Forbidden", () => {
      const { req, res } = createMockContext(normalUser);
      let errorThrown: any = null;
      adminOnlyMiddleware(req, res, (err?: any) => {
        errorThrown = err;
      });

      assert.ok(errorThrown instanceof ApiError);
      assert.equal(errorThrown.statusCode, 403);
      assert.match(errorThrown.message, /Forbidden/i);
    });

    it("should allow ADMIN on admin-only routes", () => {
      const { req, res } = createMockContext(adminUser);
      let nextCalled = false;
      let errorThrown: any = null;
      adminOnlyMiddleware(req, res, (err?: any) => {
        if (err) errorThrown = err;
        else nextCalled = true;
      });

      assert.equal(errorThrown, null);
      assert.equal(nextCalled, true);
    });

    it("should allow SUPER_ADMIN on admin-only routes", () => {
      const { req, res } = createMockContext(superAdminUser);
      let nextCalled = false;
      let errorThrown: any = null;
      adminOnlyMiddleware(req, res, (err?: any) => {
        if (err) errorThrown = err;
        else nextCalled = true;
      });

      assert.equal(errorThrown, null);
      assert.equal(nextCalled, true);
    });

    it("should reject ADMIN on SUPER_ADMIN-only routes (e.g., updateUserRole)", () => {
      const { req, res } = createMockContext(adminUser);
      let errorThrown: any = null;
      superAdminOnlyMiddleware(req, res, (err?: any) => {
        errorThrown = err;
      });

      assert.ok(errorThrown instanceof ApiError);
      assert.equal(errorThrown.statusCode, 403);
      assert.match(errorThrown.message, /Forbidden/i);
    });

    it("should allow SUPER_ADMIN on SUPER_ADMIN-only routes", () => {
      const { req, res } = createMockContext(superAdminUser);
      let nextCalled = false;
      let errorThrown: any = null;
      superAdminOnlyMiddleware(req, res, (err?: any) => {
        if (err) errorThrown = err;
        else nextCalled = true;
      });

      assert.equal(errorThrown, null);
      assert.equal(nextCalled, true);
    });
  });
});

