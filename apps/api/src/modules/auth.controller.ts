import { Body, Controller, Get, HttpCode, Post, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { prisma } from "@adonis/database";
import { signSession, type Role, type Session } from "@adonis/core/auth";
import { verifyPassword } from "@adonis/core/password";
import { CurrentUser, Public, parse } from "../common";

const Login = z.object({ email: z.string().email(), password: z.string().min(1) });

@ApiTags("Autentificare")
@Controller("auth")
export class AuthController {
  @Public()
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Autentificare personal", description: "Întoarce un token Bearer valabil 30 de zile (aplicația mobilă)." })
  @ApiBody({ schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", example: "mariana@casaadonis.ro" }, password: { type: "string" } } } })
  async login(@Body() body: unknown) {
    const { email, password } = parse(Login, body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) throw new UnauthorizedException("E-mail sau parolă greșite.");
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = await signSession({ uid: user.id, name: user.name, role: user.role as Role }, 24 * 30);
    return { token, user: { id: user.id, name: user.name, role: user.role, email: user.email } };
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Utilizatorul curent" })
  me(@CurrentUser() user: Session) {
    return user;
  }
}
