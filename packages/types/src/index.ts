// Common API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  WORKER = 'worker',
}

// Service Types
export interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  duration: number; // in minutes
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Order Types
export interface Order {
  id: string;
  userId: string;
  workerId?: string;
  serviceId: string;
  status: OrderStatus;
  scheduledAt: string;
  completedAt?: string;
  address: string;
  notes?: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}
