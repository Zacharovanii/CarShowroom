import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { Roles } from "@thallesp/nestjs-better-auth";
import {
  createManagerSchema,
  usersQuerySchema,
  type CreateManager,
  type User,
  type UsersQuery,
  type UsersResponse,
} from "@carshowroom/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminService } from "./admin.service.js";

// Пользователи — только для админа (use-cases.md, «Роли»).
@Roles(["admin"])
@Controller("admin/users")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  getUsers(
    @Query(new ZodValidationPipe(usersQuerySchema)) query: UsersQuery,
  ): Promise<UsersResponse> {
    return this.admin.getUsers(query);
  }

  @Post()
  createManager(
    @Body(new ZodValidationPipe(createManagerSchema)) body: CreateManager,
  ): Promise<User> {
    return this.admin.createManager(body);
  }
}
