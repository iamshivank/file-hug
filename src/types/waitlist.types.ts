export interface WaitlistEntry {
  id?: number;
  name: string;
  email: string;
  createdAt: Date;
}

export interface WaitlistFormData {
  name: string;
  email: string;
}

export interface WaitlistSuccessData {
  message: string;
  position: number;
}

export interface WaitlistCountData {
  count: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
