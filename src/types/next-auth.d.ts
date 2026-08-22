import type { DefaultUser } from "next-auth";
import type { UserType, UserStatus } from "./index";

declare module "next-auth" {
  interface User extends DefaultUser {
    id: string;
    username: string;
    type: UserType;
    status: UserStatus;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    type?: UserType;
    status?: UserStatus;
  }
}
