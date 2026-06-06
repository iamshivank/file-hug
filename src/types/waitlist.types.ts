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
