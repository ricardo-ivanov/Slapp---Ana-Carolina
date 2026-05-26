export interface Registration {
  id: string;
  name: string;
  category: string;
  leaderId: string;
  leaderName: string;
  date: string;
  createdAt: string;
  [key: string]: any;
}

export interface Leader {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  registrationCount: number;
  status: 'Ativo' | 'Inativo';
  phone: string;
  cpf?: string;
  isAdmin?: boolean;
  password?: string;
}

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'tel' | 'cpf' | 'select' | 'h2' | 'p';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // for dropdowns
}

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  avatarUrl: string;
  isAdmin?: boolean;
  password?: string;
}

export type ActiveView = 'dashboard' | 'cadastros' | 'lideranças' | 'formulário' | 'relatórios' | 'perfil';
