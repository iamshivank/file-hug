export interface WaitlistEntry {
  _id?: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface WaitlistFormData {
  name: string;
  email: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
