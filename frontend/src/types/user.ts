// Mirrors backend/app/schemas/user.py and schemas/auth.py verbatim (docs/API.md §2).
export interface UserOut {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  aws_account_id: string;
}

export interface SessionOut {
  expires_at: string;
}

export interface LoginResponse {
  user: UserOut;
  session: SessionOut;
}

export interface SessionResponse {
  user: UserOut;
}

export interface LogoutResponse {
  ok: true;
}
