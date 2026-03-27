import { Router } from 'express';
export declare class OrganizationRouter {
  router: Router;
  private controller;
  constructor();
  private setupRoutes;
  /**
   * POST /api/private/organization
   * Create a new organization with a CAPITALIST user
   * Only OWNER can create organizations
   * NOTE: New organizations do NOT inherit configuration
   */
  private createHandler;
  /**
   * POST /api/private/organization/:id/sub
   * Create a sub-organization (group) under a parent organization
   * Only OWNER and CAPITALIST can create sub-organizations
   * NOTE: Sub-organizations INHERIT configuration from parent
   */
  private createSubOrganizationHandler;
  /**
   * GET /api/private/organization/:id/children
   * Get direct sub-organizations of an organization
   * OWNER can see all, CAPITALIST can see their org's children
   */
  private getChildrenHandler;
  private getAllHandler;
  private getByIdHandler;
  private updateHandler;
  private deleteHandler;
}
