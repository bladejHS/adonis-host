import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException, createParamDecorator, BadRequestException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { ZodTypeAny, z } from "zod";
import { verifySession, type Role, type Session } from "@adonis/core/auth";

export const IS_PUBLIC = "isPublic";
export const ROLES = "roles";
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => (ctx.switchToHttp().getRequest() as Request & { user?: Session }).user);

/** Bearer JWT pe toate rutele, cu excepția celor marcate @Public. Rolurile se verifică cu @Roles. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: Session }>();
    const header = req.headers.authorization ?? "";
    const session = await verifySession(header.startsWith("Bearer ") ? header.slice(7) : null);
    if (!session) throw new UnauthorizedException("Autentificați-vă din nou.");
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles?.length && !roles.includes(session.role) && !["owner", "manager"].includes(session.role)) {
      throw new ForbiddenException("Rolul dumneavoastră nu are acces aici.");
    }
    req.user = session;
    return true;
  }
}

/** Validare corp cerere cu zod (fără class-validator, ca să nu depindem de metadate de tip). */
export function parse<S extends ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException({ message: "Date invalide", issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  return r.data;
}

export const day = (s: string) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new BadRequestException(`Dată invalidă: ${s}`);
  return d;
};
